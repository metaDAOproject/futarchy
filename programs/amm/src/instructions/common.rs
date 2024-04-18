use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount, Token};
use anchor_spl::associated_token::AssociatedToken;

use crate::*;

#[derive(Accounts)]
pub struct AddOrRemoveLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        has_one = lp_mint,
        has_one = base_mint,
        has_one = quote_mint,
    )]
    pub amm: Account<'info, Amm>,
    #[account(mut)]
    pub lp_mint: Box<Account<'info, Mint>>,
    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = lp_mint,
        associated_token::authority = user,
    )]
    pub user_ata_lp: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = user,
    )]
    pub user_ata_base: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = user,
    )]
    pub user_ata_quote: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = base_mint,
        associated_token::authority = amm,
    )]
    pub vault_ata_base: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = amm,
    )]
    pub vault_ata_quote: Account<'info, TokenAccount>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}