use anchor_lang::prelude::*;
use num_traits::{FromPrimitive, ToPrimitive};
use rust_decimal::{Decimal, MathematicalOps};

use crate::error::ErrorCode;
use crate::utils::anchor_decimal::*;
use crate::utils::*;

#[account]
pub struct Amm {
    pub bump: u8,

    pub permissioned: bool,
    pub auth_program: Pubkey,
    pub auth_pda_bump: u8,

    pub created_at_slot: u64,

    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,

    pub base_mint_decimals: u8,
    pub quote_mint_decimals: u8,

    pub base_amount: u64,
    pub quote_amount: u64,

    pub total_ownership: u64,

    pub swap_fee_bps: u64,

    // ltwap stands for: liquidity time weighted average price
    pub ltwap_decimals: u8,
    pub ltwap_slot_updated: u64,
    // running sum of: current_liquidity * slots_since_last_update
    pub ltwap_denominator_agg: AnchorDecimal,
    // running sum of: current_liquidity * slots_since_last_update * price
    pub ltwap_numerator_agg: AnchorDecimal,
    pub ltwap_latest: u64,
    pub ltwap_frozen: bool,
}

impl Amm {
    pub fn get_ltwap(&self) -> Result<u64> {
        let ltwap_denominator_agg = self.ltwap_denominator_agg.deser();

        if ltwap_denominator_agg.is_zero() {
            return Ok(0);
        }

        let ltwap_numerator_agg = self.ltwap_numerator_agg.deser();

        let ltwap_decimal_scale = get_decimal_scale_u64(self.ltwap_decimals)?;

        Ok(((ltwap_numerator_agg / ltwap_denominator_agg)
            * Decimal::from_u64(ltwap_decimal_scale).unwrap())
        .to_u64()
        .unwrap_or(u64::MAX))
    }

    pub fn update_ltwap(&mut self, final_slot: Option<u64>) -> Result<u64> {
        if self.ltwap_frozen {
            return Ok(self.ltwap_latest);
        }

        let slot = Clock::get()?.slot;
        let slot_difference_u64 = if final_slot.is_some() && slot >= final_slot.unwrap() {
            self.ltwap_frozen = true;
            final_slot
                .unwrap()
                .checked_sub(self.ltwap_slot_updated)
                .unwrap()
        } else {
            slot.checked_sub(self.ltwap_slot_updated).unwrap()
        };
        let slot_difference = Decimal::from_u64(slot_difference_u64).unwrap();

        let base_liquidity_units = self.get_base_liquidity_units()?;
        let quote_liquidity_units = self.get_quote_liquidity_units()?;

        // for liquidity: use sqrt(quote_liquidity * base_liquidity)
        let liquidity = (base_liquidity_units * quote_liquidity_units)
            .sqrt()
            .unwrap();
        let liquidity_x_slot_diff = liquidity * slot_difference;

        let price = if base_liquidity_units.is_zero() {
            Decimal::ZERO
        } else {
            quote_liquidity_units / base_liquidity_units
        };

        let ltwap_denominator_agg = self.ltwap_denominator_agg.deser();
        let ltwap_numerator_agg = self.ltwap_numerator_agg.deser();

        let updated_ltwap_denominator_agg = ltwap_denominator_agg + liquidity_x_slot_diff;
        let updated_ltwap_numerator_agg = ltwap_numerator_agg + liquidity_x_slot_diff * price;

        self.ltwap_denominator_agg = AnchorDecimal::ser(updated_ltwap_denominator_agg);
        self.ltwap_numerator_agg = AnchorDecimal::ser(updated_ltwap_numerator_agg);

        let ltwap_decimal_scale = get_decimal_scale_u64(self.ltwap_decimals)?;

        if !updated_ltwap_denominator_agg.is_zero() {
            let ltwap_latest_dec: Decimal =
                updated_ltwap_numerator_agg / updated_ltwap_denominator_agg;

            self.ltwap_latest = (ltwap_latest_dec
                * Decimal::from_u64(ltwap_decimal_scale).unwrap())
            .to_u64()
            .unwrap_or(u64::MAX);

            // logs for data ingestion
            msg!("Price: {:?}", price);
            msg!("LTWAP: {:?}", ltwap_latest_dec);
        }

        self.ltwap_slot_updated = slot;

        Ok(self.ltwap_latest)
    }

    // get base liquidity units
    pub fn get_base_liquidity_units(&self) -> Result<Decimal> {
        let base_decimal_scale = get_decimal_scale_u64(self.base_mint_decimals)?;

        let base_amount_d = Decimal::from_u64(self.base_amount).unwrap();
        let base_decimal_scale_d = Decimal::from_u64(base_decimal_scale).unwrap();

        Ok(base_amount_d / base_decimal_scale_d)
    }

    // get quote liquidity units
    pub fn get_quote_liquidity_units(&self) -> Result<Decimal> {
        let quote_decimal_scale = get_decimal_scale_u64(self.quote_mint_decimals)?;

        let quote_amount_d = Decimal::from_u64(self.quote_amount).unwrap();
        let quote_decimal_scale_d = Decimal::from_u64(quote_decimal_scale).unwrap();

        Ok(quote_amount_d / quote_decimal_scale_d)
    }
}
