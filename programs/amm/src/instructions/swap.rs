use anchor_lang::prelude::*;
use anchor_spl::associated_token;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token;
use anchor_spl::token::*;
use num_traits::ToPrimitive;

use crate::generate_vault_seeds;
use crate::state::*;
use crate::{utils::*, BPS_SCALE};

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
    #[account(address = associated_token::ID)]
    pub associated_token_program: Program<'info, AssociatedToken>,
    #[account(address = token::ID)]
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    #[account(
        seeds = [AMM_AUTH_SEED_PREFIX],
        bump = amm.auth_pda_bump,
        seeds::program = amm.auth_program
    )]
    pub auth_pda: Option<Signer<'info>>,
}

pub fn handler(
    ctx: Context<Swap>,
    is_quote_to_base: bool,
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
        auth_pda,
    } = ctx.accounts;

    assert!(input_amount > 0);
    assert!(amm.total_ownership > 0);

    if amm.permissioned {
        assert!(auth_pda.is_some());
    }

    amm.update_ltwap(None)?;

    let base_amount_start = amm.base_amount as u128;
    let quote_amount_start = amm.quote_amount as u128;

    let k = base_amount_start.checked_mul(quote_amount_start).unwrap();

    let input_amount_minus_fee = input_amount
        .checked_mul(BPS_SCALE.checked_sub(amm.swap_fee_bps).unwrap())
        .unwrap()
        .checked_div(BPS_SCALE)
        .unwrap() as u128;

    let base_mint_key = base_mint.key();
    let quote_mint_key = quote_mint.key();
    let swap_fee_bps_bytes = amm.swap_fee_bps.to_le_bytes();
    let permissioned_caller = amm.auth_program;

    let seeds = generate_vault_seeds!(
        base_mint_key,
        quote_mint_key,
        swap_fee_bps_bytes,
        permissioned_caller,
        amm.bump
    );

    let output_amount = if is_quote_to_base {
        let temp_quote_amount = quote_amount_start
            .checked_add(input_amount_minus_fee)
            .unwrap();

        // for rounding up, if we have, a = b / c, we use: a = (b + (c - 1)) / c
        let temp_base_amount = k
            .checked_add(temp_quote_amount.checked_sub(1).unwrap())
            .unwrap()
            .checked_div(temp_quote_amount)
            .unwrap();

        let output_amount_base = base_amount_start
            .checked_sub(temp_base_amount)
            .unwrap()
            .to_u64()
            .unwrap();

        amm.quote_amount = amm.quote_amount.checked_add(input_amount).unwrap();
        amm.base_amount = amm.base_amount.checked_sub(output_amount_base).unwrap();

        // send user quote tokens to vault
        token_transfer(
            input_amount,
            token_program,
            user_ata_quote,
            vault_ata_quote,
            &user,
        )?;

        // send vault base tokens to user
        token_transfer_signed(
            output_amount_base,
            token_program,
            vault_ata_base,
            user_ata_base,
            amm,
            seeds,
        )?;

        output_amount_base
    } else {
        let temp_base_amount = base_amount_start
            .checked_add(input_amount_minus_fee)
            .unwrap();

        // for rounding up, if we have, a = b / c, we use: a = (b + (c - 1)) / c
        let temp_quote_amount = k
            .checked_add(temp_base_amount.checked_sub(1).unwrap())
            .unwrap()
            .checked_div(temp_base_amount)
            .unwrap();

        let output_amount_quote = quote_amount_start
            .checked_sub(temp_quote_amount)
            .unwrap()
            .to_u64()
            .unwrap();

        amm.base_amount = amm.base_amount.checked_add(input_amount).unwrap();
        amm.quote_amount = amm.quote_amount.checked_sub(output_amount_quote).unwrap();

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
            output_amount_quote,
            token_program,
            vault_ata_quote,
            user_ata_quote,
            amm,
            seeds,
        )?;

        output_amount_quote
    };

    let new_k = (amm.base_amount as u128)
        .checked_mul(amm.quote_amount as u128)
        .unwrap();

    assert!(new_k >= k); // with non-zero fees, k should always increase
    assert!(output_amount >= output_amount_min);

    Ok(())
}
