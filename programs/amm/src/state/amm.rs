use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Slot;

use crate::error::AmmError;
use crate::ONE_MINUTE_IN_SLOTS;

#[derive(Clone, Copy, Debug, AnchorSerialize, AnchorDeserialize)]
pub enum SwapType {
    /// Swap quote tokens into base tokens
    Buy,
    /// Swap base tokens into quote tokens
    Sell,
}

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
    pub twap_last_observation_uq64X32: u128,
    /// Running sum of slots_since_last_update * price.
    ///
    /// Assuming last observations are as big as possible (UQ64x32::MAX),
    /// we can store (2**32) of them. This translates into 54 years worth
    /// of slots. At this point, the aggregator will roll back to 0. It's the
    /// client's responsibility to check that the second aggregator is bigger
    /// than the first aggregator.
    pub twap_aggregator_uq96X32: u128,
    /// The most that a price can change per update.
    pub twap_max_change_per_update_uq64X32: u128,
}

impl Amm {
    pub fn k(&self) -> u128 {
        self.base_amount as u128 * self.quote_amount as u128
    }

    /// Does the internal accounting to swap `input_amount` into the returned
    /// output amount so that output amount can be transferred to the user.
    pub fn swap(&mut self, input_amount: u64, swap_type: SwapType) -> Result<u64> {
        let base_amount_start = self.base_amount as u128;
        let quote_amount_start = self.quote_amount as u128;

        let k = self.k();

        let (input_reserve, output_reserve) = match swap_type {
            SwapType::Buy => (quote_amount_start, base_amount_start),
            SwapType::Sell => (base_amount_start, quote_amount_start),
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

        match swap_type {
            SwapType::Buy => {
                self.quote_amount = self.quote_amount.checked_add(input_amount).unwrap();
                self.base_amount = self.base_amount.checked_sub(output_amount).unwrap();
            }
            SwapType::Sell => {
                self.base_amount = self.base_amount.checked_add(input_amount).unwrap();
                self.quote_amount = self.quote_amount.checked_sub(output_amount).unwrap();
            }
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
        assert!(self.twap_aggregator_uq96X32 != 0);

        Ok(self.twap_aggregator_uq96X32 / slots_passed)
    }

    /// Updates the TWAP. Should be called before any changes to the AMM's state
    /// have been made.
    ///
    /// Returns an observation, stored in UQ64x32, if one was recorded.
    pub fn update_twap(&mut self, current_slot: Slot) -> Option<u128> {
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
        if current_slot < self.twap_last_updated_slot + ONE_MINUTE_IN_SLOTS {
            return None;
        }

        let quote_amount_uq64x32 = (self.quote_amount as u128) << 32;
        let base_amount_uq64x32 = (self.base_amount as u128) << 32;

        let price_uq64x32 = (quote_amount_uq64x32 << 32) / base_amount_uq64x32;

        let last_observation_uq64x32 = self.twap_last_observation_uq64X32;

        let observation_uq64x32 = if price_uq64x32 > last_observation_uq64x32 {
            let max_observation_uq64x32 = last_observation_uq64x32
                + self.twap_max_change_per_update_uq64X32
                & 0x00_00_00_00_FF_FF_FF_FF_FF_FF_FF_FF_FF_FF_FF_FF;
            // we can't do `saturating_add` since a u128 can fit more than
            // a UQ64x32, so we do the bitwise AND instead

            std::cmp::min(price_uq64x32, max_observation_uq64x32)
        } else {
            let min_observation_uq64x32 =
                last_observation_uq64x32.saturating_sub(self.twap_max_change_per_update_uq64X32);

            std::cmp::max(price_uq64x32, min_observation_uq64x32)
        };

        let slot_difference = (current_slot - self.twap_last_updated_slot) as u128;
        let weighted_observation_uq96x64 = observation_uq64x32 * slot_difference;

        self.twap_last_updated_slot = current_slot;
        self.twap_last_observation_uq64X32 = observation_uq64x32;
        // will eventually wrap back to 0 theoretically after at least 2**32 slots 
        // but more likely after 2**40 - 2**90 slots. 2**40 slots is 5 million years
        self.twap_aggregator_uq96X32 = self
            .twap_aggregator_uq96X32
            .wrapping_add(weighted_observation_uq96x64);

        Some(observation_uq64x32)
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
    use SwapType::{Buy, Sell};

    #[test]
    pub fn base_case_amm() {
        let mut amm = Amm { ..Amm::default() };

        let res = amm.get_twap();
        assert_eq!(res.unwrap_err(), AmmError::NoSlotsPassed.into());

        assert_eq!(amm.swap(1, Buy).unwrap_err(), AmmError::NoReserves.into());
        assert_eq!(amm.swap(1, Sell).unwrap_err(), AmmError::NoReserves.into());
        assert_eq!(amm.k(), 0);
    }

    #[test]
    pub fn smol_amm() {
        let mut amm = Amm {
            base_amount: 3,
            quote_amount: 8,
            ..Amm::default()
        };

        assert_eq!(amm.k(), 24);

        // 4 x 6 = 24, would be 2 but we take out 1 for fee
        assert_eq!(amm.swap(1, Sell).unwrap(), 1);
        assert_eq!(amm.k(), 28); // 4 x 7

        let mut amm_clone = amm.clone();
        // 2 x 14 = 28, but we take one for fee
        assert_eq!(amm.swap(7, Buy).unwrap(), 1);
        assert_eq!(amm.k(), 42); // 3 x 14

        // re-run on the clone but give an extra for fee,
        // we should now get back 2
        assert_eq!(amm_clone.swap(8, Buy).unwrap(), 2);
        assert_eq!(amm_clone.k(), 30); // 2 x 15
    }

    #[test]
    pub fn simple_twap_math_amm() {
        let mut amm = Amm {
            base_amount: 5,
            quote_amount: 50,
            twap_last_observation_uq64X32: 10 * 2_u128.pow(32),
            twap_max_change_per_update_uq64X32: 100,
            twap_last_updated_slot: 0,
            ..Amm::default()
        };

        // minute hasn't passed since last slot
        assert_eq!(amm.update_twap(1), None);
        assert_eq!(amm.twap_last_updated_slot, 0);

        assert_eq!(amm.update_twap(ONE_MINUTE_IN_SLOTS), Some(10 * 2_u128.pow(32)));
    }
}
