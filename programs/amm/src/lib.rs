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

use crate::instructions::*;
use crate::state::*;

declare_id!("Ens7Gx99whnA8zZm6ZiFnWgGq3x76nXbSmh5gaaJqpAz");
#[program]
pub mod amm {
    use super::*;

    pub fn create_amm(ctx: Context<CreateAmm>, args: CreateAmmArgs) -> Result<()> {
        instructions::create_amm::handler(ctx, args)
    }

    pub fn add_liquidity(
        ctx: Context<AddOrRemoveLiquidity>,
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

    pub fn remove_liquidity(
        ctx: Context<AddOrRemoveLiquidity>,
        params: RemoveLiquidityParams,
    ) -> Result<()> {
        instructions::remove_liquidity::handler(ctx, params)
    }

    pub fn swap(
        ctx: Context<Swap>,
        direction: SwapType,
        input_amount: u64,
        output_amount_min: u64,
    ) -> Result<()> {
        instructions::swap::handler(ctx, direction, input_amount, output_amount_min)
    }

    pub fn crank_that_twap(ctx: Context<CrankThatTwap>) -> Result<()> {
        instructions::crank_that_twap::handler(ctx)
    }
}
