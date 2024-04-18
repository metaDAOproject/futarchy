use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::*;

use crate::error::AmmError;
use crate::generate_vault_seeds;
use crate::state::*;
use crate::utils::{token_transfer, token_transfer_signed};

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        has_one = base_mint,
        has_one = quote_mint,
    )]
    pub amm: Account<'info, Amm>,
    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,
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

pub fn handler(
    ctx: Context<Swap>,
    swap_type: SwapType,
    input_amount: u64,
    output_amount_min: u64,
) -> Result<()> {
    let Swap {
        user,
        amm,
        base_mint,
        quote_mint,
        user_ata_base,
        user_ata_quote,
        vault_ata_base,
        vault_ata_quote,
        associated_token_program: _,
        token_program,
        system_program: _,
    } = ctx.accounts;

    assert!(input_amount > 0);

    amm.update_twap(Clock::get()?.slot);

    let output_amount = amm.swap(input_amount, swap_type)?;

    let base_mint_key = base_mint.key();
    let quote_mint_key = quote_mint.key();

    let seeds = generate_vault_seeds!(base_mint_key, quote_mint_key, amm.bump);

    match swap_type {
        SwapType::Buy => {
            token_transfer(
                input_amount,
                token_program,
                user_ata_quote,
                vault_ata_quote,
                &user,
            )?;

            // send vault base tokens to user
            token_transfer_signed(
                output_amount,
                token_program,
                vault_ata_base,
                user_ata_base,
                amm,
                seeds,
            )?;
        }
        SwapType::Sell => {
            // send user base tokens to vault
            token_transfer(
                input_amount,
                token_program,
                &user_ata_base,
                &vault_ata_base,
                &user,
            )?;

            // send vault quote tokens to user
            token_transfer_signed(
                output_amount,
                token_program,
                vault_ata_quote,
                user_ata_quote,
                amm,
                seeds,
            )?;
        }
    }

    require_gte!(output_amount, output_amount_min, AmmError::SlippageExceeded);

    Ok(())
}
