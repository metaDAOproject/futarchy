use anchor_lang::prelude::*;

use crate::state::*;

#[derive(Accounts)]
pub struct CrankThatTwap<'info> {
    #[account(mut)]
    pub amm: Account<'info, Amm>,
}

impl CrankThatTwap<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let CrankThatTwap { amm } = ctx.accounts;

        amm.update_twap(Clock::get()?.slot)?;

        Ok(())
    }
}
