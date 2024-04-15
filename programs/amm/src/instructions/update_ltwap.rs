use anchor_lang::prelude::*;

use crate::state::*;

#[derive(Accounts)]
pub struct UpdateLtwap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub amm: Account<'info, Amm>,
    pub system_program: Program<'info, System>,
    #[account(
        seeds = [AMM_AUTH_SEED_PREFIX],
        bump = amm.auth_pda_bump,
        seeds::program = amm.auth_program
    )]
    pub auth_pda: Option<Signer<'info>>,
}

pub fn handler(ctx: Context<UpdateLtwap>, final_slot: Option<u64>) -> Result<()> {
    let UpdateLtwap {
        user: _,
        amm,
        system_program: _,
        auth_pda,
    } = ctx.accounts;

    if amm.permissioned {
        assert!(auth_pda.is_some());
    }

    if final_slot.is_some() {
        assert!(amm.permissioned);
    }

    amm.update_ltwap(final_slot)?;

    Ok(())
}
