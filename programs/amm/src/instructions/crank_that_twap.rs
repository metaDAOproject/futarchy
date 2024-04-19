use anchor_lang::prelude::*;

use crate::state::*;

#[derive(Accounts)]
pub struct CrankThatTwap<'info> {
    #[account(mut)]
    pub amm: Account<'info, Amm>,
}

pub fn handler(ctx: Context<CrankThatTwap>) -> Result<()> {
    let CrankThatTwap {
        amm,
    } = ctx.accounts;

    amm.update_twap(Clock::get()?.slot);

    Ok(())
}
