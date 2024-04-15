use anchor_lang::prelude::*;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "futarchy_amm_v1",
    project_url: "https://themetadao.org",
    contacts: "email:metaproph3t@protonmail.com",
    policy: "The market will decide whether we pay a bug bounty.",
    source_code: "https://github.com/metaDAOproject/meta-dao",
    source_release: "v1",
    auditors: "None",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

pub mod error;
pub mod instructions;
pub mod state;
pub mod utils;

use crate::error::*;
use crate::instructions::*;
use crate::state::*;
use crate::utils::*;

declare_id!("Ens7Gx99whnA8zZm6ZiFnWgGq3x76nXbSmh5gaaJqpAz");
#[program]
pub mod amm {
    use super::*;

    pub fn create_amm(ctx: Context<CreateAmm>, create_amm_params: CreateAmmParams) -> Result<()> {
        instructions::create_amm::handler(ctx, create_amm_params)
    }

    pub fn create_position(ctx: Context<CreatePosition>) -> Result<()> {
        instructions::create_position::handler(ctx)
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        max_base_amount: u64,
        max_quote_amount: u64,
        min_base_amount: u64,
        min_quote_amount: u64,
    ) -> Result<()> {
        instructions::add_liquidity::handler(
            ctx,
            max_base_amount,
            max_quote_amount,
            min_base_amount,
            min_quote_amount,
        )
    }

    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, remove_bps: u64) -> Result<()> {
        instructions::remove_liquidity::handler(ctx, remove_bps)
    }

    pub fn swap(
        ctx: Context<Swap>,
        is_quote_to_base: bool,
        input_amount: u64,
        output_amount_min: u64,
    ) -> Result<()> {
        instructions::swap::handler(ctx, is_quote_to_base, input_amount, output_amount_min)
    }

    pub fn update_ltwap(ctx: Context<UpdateLtwap>, final_slot: Option<u64>) -> Result<()> {
        instructions::update_ltwap::handler(ctx, final_slot)
    }
}
