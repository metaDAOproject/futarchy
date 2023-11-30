//! A program to help autocrat migrate by transferring both its META and USDC
//! to the new autocrat.

use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};

declare_id!("8C4WEdr54tBPdtmeTPUBuZX5bgUMZw4XdvpNoNaQ6NwR");

#[program]
pub mod autocrat_migrator {
    use super::*;

    pub fn multi_transfer2(ctx: Context<MultiTransfer2>) -> Result<()> {
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.from0.to_account_info(),
                    to: ctx.accounts.to0.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            ctx.accounts.from0.amount,
        )?;

        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.from1.to_account_info(),
                    to: ctx.accounts.to1.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            ctx.accounts.from1.amount,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct MultiTransfer2<'info> {
    token_program: Program<'info, Token>,
    #[account(mut)]
    authority: Signer<'info>,
    #[account(mut)]
    from0: Account<'info, TokenAccount>,
    #[account(mut)]
    to0: Account<'info, TokenAccount>,
    #[account(mut)]
    from1: Account<'info, TokenAccount>,
    #[account(mut)]
    to1: Account<'info, TokenAccount>,
}
