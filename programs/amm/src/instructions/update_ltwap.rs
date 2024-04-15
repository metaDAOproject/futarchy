use anchor_lang::prelude::*;

use crate::state::*;

#[derive(Accounts)]
pub struct UpdateLtwap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub amm: Account<'info, Amm>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<UpdateLtwap>) -> Result<()> {
    let UpdateLtwap {
        user: _,
        amm,
        system_program: _,
    } = ctx.accounts;

    amm.update_ltwap()?;

    Ok(())
}
