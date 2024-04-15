use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::*;

use crate::state::*;

#[derive(Accounts)]
pub struct CreateAmm<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 8 + std::mem::size_of::<Amm>(),
        seeds = [
            AMM_SEED_PREFIX,
            base_mint.key().as_ref(),
            quote_mint.key().as_ref(),
        ],
        bump
    )]
    pub amm: Account<'info, Amm>,
    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::authority = amm,
        associated_token::mint = base_mint
    )]
    pub vault_ata_base: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::authority = amm,
        associated_token::mint = quote_mint
    )]
    pub vault_ata_quote: Account<'info, TokenAccount>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateAmm>) -> Result<()> {
    let CreateAmm {
        user: _,
        amm,
        base_mint,
        quote_mint,
        vault_ata_base: _,
        vault_ata_quote: _,
        associated_token_program: _,
        token_program: _,
        system_program: _,
    } = ctx.accounts;

    amm.created_at_slot = Clock::get()?.slot;

    assert_ne!(base_mint.key(), quote_mint.key());

    amm.base_mint = base_mint.key();
    amm.quote_mint = quote_mint.key();

    amm.base_mint_decimals = base_mint.decimals;
    amm.quote_mint_decimals = quote_mint.decimals;

    amm.bump = *ctx.bumps.get("amm").unwrap();

    Ok(())
}
