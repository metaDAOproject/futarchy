pub use super::*;

#[account]
pub struct DAO {
    pub treasury_pda_bump: u8,
    pub treasury: Pubkey,
    pub token_mint: Pubkey,
    pub usdc_mint: Pubkey,
    pub proposal_count: u32,
    // the percentage, in basis points, the pass price needs to be above the
    // fail price in order for the proposal to pass
    pub pass_threshold_bps: u16,
    pub slots_per_proposal: u64,
    // the TWAP can only move by a certain amount per update, so it needs to start at
    // a value. that's `twap_expected_value`, and it's in base lots divided by quote lots.
    // so if you expect your token to trade around $1, your token has 9 decimals and a base_lot_size
    // of 1_000_000_000, your `twap_expected_value` could be 10_000 (10,000 hundredths of pennies = $1).
    pub twap_expected_value: u64,
    pub max_observation_change_per_update_lots: u64,
}

