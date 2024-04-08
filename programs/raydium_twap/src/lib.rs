use anchor_lang::prelude::*;
use raydium_amm_v3::states::PoolState;

declare_id!("8D57r6T9RaBTeDFezQzzoHRxywk1bMqYmbprsmx6Y8XV");

pub struct PoolTWAP {
    pub pool: Pubkey,
    pub twap_oracle: TWAPOracle,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TWAPOracle {
    pub expected_value: u64,
    pub initial_slot: u64,
    pub last_updated_slot: u64,
    pub last_observed_slot: u64,
    pub last_observation: u64,
    pub observation_aggregator: u128,
    pub max_observation_change_per_update_lots: u64,
}

#[program]
pub mod raydium_twap {
    use super::*;

    pub fn initialize_pool_twap(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    pub pool: AccountLoader<'info, PoolState>,
}
