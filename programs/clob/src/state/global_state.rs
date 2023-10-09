use super::*;

#[account]
pub struct GlobalState {
    /// Admins can do the following:
    /// - collect taker fees
    /// - change fees (within bounds)
    /// - change TWAP parameters (within bounds)
    /// - TODO: change min_{quote,base}_limit_amount
    pub admin: Pubkey,
    /// The CLOB needs fees to disincentivize wash trading / TWAP manipulation.
    /// Besides, profits are virtuous :)
    pub taker_fee_in_bps: u16,
    /// Since market maker slots are finite, we need some cost to prevent someone
    /// from taking all the market maker slots. Also, have I mentioned that profits
    /// are virtuous?
    pub market_maker_burn_in_lamports: u64,
    // the defaults that new markets get initialized with
    pub default_max_observation_change_per_update_bps: u16,
}
