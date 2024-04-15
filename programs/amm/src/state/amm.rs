use anchor_lang::prelude::*;
use num_traits::{FromPrimitive, ToPrimitive};
use rust_decimal::{Decimal, MathematicalOps};

use crate::error::AmmError;
use crate::{utils::*, ONE_MINUTE_IN_SLOTS};

#[account]
#[derive(Default)]
pub struct Amm {
    pub bump: u8,

    pub created_at_slot: u64,

    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,

    pub base_mint_decimals: u8,
    pub quote_mint_decimals: u8,

    pub base_amount: u64,
    pub quote_amount: u64,

    pub total_ownership: u64,

    pub twap_last_updated_slot: u64,
    /// To represent prices, we use fixed point numbers with 32 fractional
    /// bits. To convert to a normal number, you can divide by
    /// 2**32.
    pub twap_last_observation_uq64x32: u128,
    /// Running sum of slots_since_last_update * price.
    ///
    /// Assuming last observations are as big as possible (UQ64x32::MAX),
    /// we can store (2**32) of them. This translates into 54 years worth
    /// of slots.
    pub twap_aggregator_uq96x32: u128,
    /// The most that a price can change per update.
    pub twap_max_change_per_update_uq64x32: u128,
}

impl Amm {
    pub fn k(&self) -> u128 {
        self.base_amount as u128 * self.quote_amount as u128
    }

    pub fn swap(&mut self, input_amount: u64, is_quote_to_base: bool) -> Result<u64> {
        let base_amount_start = self.base_amount as u128;
        let quote_amount_start = self.quote_amount as u128;

        let k = self.k();

        let (input_reserve, output_reserve) = if is_quote_to_base {
            (quote_amount_start, base_amount_start)
        } else {
            (base_amount_start, quote_amount_start)
        };

        // airlifted from uniswap v1:
        // https://github.com/Uniswap/v1-contracts/blob/c10c08d81d6114f694baa8bd32f555a40f6264da/contracts/uniswap_exchange.vy#L106-L111

        require!(input_reserve != 0, AmmError::NoReserves);
        require!(output_reserve != 0, AmmError::NoReserves);

        let input_amount_with_fee = input_amount as u128 * 990;

        let numerator = input_amount_with_fee
            .checked_mul(output_reserve)
            .ok_or(error!(AmmError::InputAmountOverflow))?;

        let denominator = (input_reserve * 1000) + input_amount_with_fee;

        let output_amount = (numerator / denominator) as u64;

        if is_quote_to_base {
            self.quote_amount = self.quote_amount.checked_add(input_amount).unwrap();
            self.base_amount = self.base_amount.checked_sub(output_amount).unwrap();
        } else {
            self.base_amount = self.base_amount.checked_add(input_amount).unwrap();
            self.quote_amount = self.quote_amount.checked_sub(output_amount).unwrap();
        }

        let new_k = (self.base_amount as u128)
            .checked_mul(self.quote_amount as u128)
            .unwrap();

        // TODO: turn this into a require!()
        assert!(new_k >= k);

        Ok(output_amount)
    }

    /// Returns the time-weighted average price since market creation in UQ64x32 form.
    pub fn get_twap(&self) -> Result<u128> {
        let slots_passed = (self.twap_last_updated_slot - self.created_at_slot) as u128;

        require_neq!(slots_passed, 0, AmmError::NoSlotsPassed);
        assert_ne!(self.twap_aggregator_uq96x32, 0);

        Ok(self.twap_aggregator_uq96x32 / slots_passed)
    }

    pub fn update_twap(&mut self) -> Result<()> {
        let slot = Clock::get()?.slot;

        // a manipulator is likely to be "bursty" with their usage, such as a
        // validator who abuses their slots to manipulate the TWAP.
        // meanwhile, regular trading is less likely to happen in each slot.
        // suppose that in normal trading, one trade happens every 4 slots.
        // if we allow observations to move 1% per slot, a manipulator who
        // can land every slot would be able to move the last observation by 348%
        // over 1 minute (1.01^(# of slots in a minute)) whereas normal trading
        // activity would be only able to move it by 45% over 1 minute
        // (1.01^(# of slots in a minute / 4)). so it makes sense to not allow an
        // update every slot.
        //
        // on the other hand, you can't allow updates too infrequently either.
        // if you could only update once a day, a manipulator only needs to buy
        // one slot per day to drastically shift the TWAP.
        //
        // we allow updates once a minute as a happy medium. if you have an asset
        // that trades near $1500 and you allow $25 updates per minute, it can double
        // over an hour.
        if slot <= self.twap_last_updated_slot + ONE_MINUTE_IN_SLOTS {
            return Ok(());
        }

        let quote_amount_uq64x32 = (self.quote_amount as u128) << 32;
        let base_amount_uq64x32 = (self.base_amount as u128) << 32;

        let price_uq64x32 = (quote_amount_uq64x32 << 32) / base_amount_uq64x32;

        let last_observation_uq64x32 = self.twap_last_observation_uq64x32;

        let observation_uq64x32 = if price_uq64x32 > last_observation_uq64x32 {
            let max_observation_uq64x32 = last_observation_uq64x32
                + self.twap_max_change_per_update_uq64x32
                & 0x00_00_00_00_FF_FF_FF_FF_FF_FF_FF_FF_FF_FF_FF_FF;
            // we can't do `saturating_add` since a u128 can fit more than
            // a UQ64x32, so we do the bitwise AND instead

            std::cmp::min(price_uq64x32, max_observation_uq64x32)
        } else {
            let min_observation_uq64x32 =
                last_observation_uq64x32.saturating_sub(self.twap_max_change_per_update_uq64x32);

            std::cmp::max(price_uq64x32, min_observation_uq64x32)
        };

        let slot_difference = (slot - self.twap_last_updated_slot) as u128;
        let weighted_observation_uq96x64 = observation_uq64x32 * slot_difference;

        self.twap_last_updated_slot = slot;
        self.twap_last_observation_uq64x32 = observation_uq64x32;
        // TODO: add an error message since this can theoretically overflow
        self.twap_aggregator_uq96x32 += weighted_observation_uq96x64;

        Ok(())
    }

    // get base liquidity units
    // pub fn get_base_liquidity_units(&self) -> Result<Decimal> {
    //     let base_decimal_scale = get_decimal_scale_u64(self.base_mint_decimals)?;

    //     let base_amount_d = Decimal::from_u64(self.base_amount).unwrap();
    //     let base_decimal_scale_d = Decimal::from_u64(base_decimal_scale).unwrap();

    //     Ok(base_amount_d / base_decimal_scale_d)
    // }

    // // get quote liquidity units
    // pub fn get_quote_liquidity_units(&self) -> Result<Decimal> {
    //     let quote_decimal_scale = get_decimal_scale_u64(self.quote_mint_decimals)?;

    //     let quote_amount_d = Decimal::from_u64(self.quote_amount).unwrap();
    //     let quote_decimal_scale_d = Decimal::from_u64(quote_decimal_scale).unwrap();

    //     Ok(quote_amount_d / quote_decimal_scale_d)
    // }
}

#[cfg(test)]
mod simple_amm_tests {
    use crate::{error::AmmError, state::*};

    #[test]
    pub fn base_case_amm() {
        let mut amm = Amm { ..Amm::default() };

        let res = amm.get_twap();
        assert_eq!(res.unwrap_err(), AmmError::NoSlotsPassed.into());

        assert_eq!(amm.swap(1, true).unwrap_err(), AmmError::NoReserves.into());
        assert_eq!(amm.swap(1, false).unwrap_err(), AmmError::NoReserves.into());
        assert_eq!(amm.k(), 0);
    }

    #[test]
    pub fn medium_amm() {
        let mut amm = Amm {
            base_amount: 3,
            quote_amount: 8,
            ..Amm::default()
        };

        assert_eq!(amm.swap(1, true).unwrap(), 0);
        assert_eq!(amm.swap(1, false).unwrap(), 0);
        return;
        assert_eq!(amm.k(), 100020001);

        assert_eq!(amm.swap(100, true).unwrap(), 99);
        assert_eq!(amm.swap(100, false).unwrap(), 100);
        assert_eq!(amm.k(), 100030002);

        assert_eq!(amm.swap(1000, true).unwrap(), 909);
        assert_eq!(amm.swap(1000, false).unwrap(), 1089);
        assert_eq!(amm.k(), 100041816);
    }

    #[test]
    pub fn medium_amm_with_swap_err() {
        let mut amm = Amm {
            base_amount: 10000,
            quote_amount: 10000,
            ..Amm::default()
        };

        amm.swap(amm.quote_amount - 1, true).unwrap();

        assert_eq!(amm.k(), 10);

        // todo?
        // assert!(amm.swap(amm.quote_amount - 1, true).is_err());
    }
}
