//! Raydium TWAP oracle
//! 
//! Raydium stores prices as token1 / token0. So if token1 is USDC and token0
//! is META, price could be 1000 (1000 USDC / 1 META, or 2000 USDC / 2 META).
//! If token0 is USDC and token1 is META, then price could be 0.001 
//! (1 META / 1000 USDC).
//! 
//! However, you need to account for decimals. 
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
