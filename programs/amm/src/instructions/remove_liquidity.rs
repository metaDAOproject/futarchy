use anchor_lang::prelude::*;
use anchor_spl::associated_token;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token;
use anchor_spl::token::*;
use num_traits::ToPrimitive;

use crate::error::ErrorCode;
use crate::generate_vault_seeds;
use crate::state::*;
use crate::{utils::*, BPS_SCALE};

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        has_one = base_mint,
        has_one = quote_mint,
    )]
    pub amm: Account<'info, Amm>,
    #[account(
        mut,
        has_one = user,
        has_one = amm,
        seeds = [
            AMM_POSITION_SEED_PREFIX,
            amm.key().as_ref(),
            user.key().as_ref(),
        ],
        bump
    )]
    pub amm_position: Account<'info, AmmPosition>,
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

pub fn handler(ctx: Context<RemoveLiquidity>, withdraw_bps: u64) -> Result<()> {
    let RemoveLiquidity {
        user: _,
        amm,
        amm_position,
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

    assert!(amm_position.ownership > 0);
    assert!(withdraw_bps > 0);
    assert!(withdraw_bps <= BPS_SCALE);

    if amm.permissioned {
        assert!(auth_pda.is_some());
    }

    amm.update_ltwap(None)?;

    let base_to_withdraw = (amm.base_amount as u128)
        .checked_mul(amm_position.ownership as u128)
        .unwrap()
        .checked_mul(withdraw_bps as u128)
        .unwrap()
        .checked_div(BPS_SCALE as u128)
        .unwrap()
        .checked_div(amm.total_ownership as u128)
        .unwrap()
        .to_u64()
        .unwrap();

    let quote_to_withdraw = (amm.quote_amount as u128)
        .checked_mul(amm_position.ownership as u128)
        .unwrap()
        .checked_mul(withdraw_bps as u128)
        .unwrap()
        .checked_div(BPS_SCALE as u128)
        .unwrap()
        .checked_div(amm.total_ownership as u128)
        .unwrap()
        .to_u64()
        .unwrap();

    // for rounding up, if we have, a = b / c, we use: a = (b + (c - 1)) / c
    let less_ownership = (amm_position.ownership as u128)
        .checked_mul(withdraw_bps as u128)
        .unwrap()
        .checked_add(BPS_SCALE as u128 - 1)
        .unwrap()
        .checked_div(BPS_SCALE as u128)
        .unwrap()
        .to_u64()
        .unwrap();

    amm_position.ownership = amm_position.ownership.checked_sub(less_ownership).unwrap();
    amm.total_ownership = amm.total_ownership.checked_sub(less_ownership).unwrap();

    amm.base_amount = amm.base_amount.checked_sub(base_to_withdraw).unwrap();
    amm.quote_amount = amm.quote_amount.checked_sub(quote_to_withdraw).unwrap();

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

    // send vault base tokens to user
    token_transfer_signed(
        base_to_withdraw,
        token_program,
        vault_ata_base,
        user_ata_base,
        amm,
        seeds,
    )?;

    // send vault quote tokens to user
    token_transfer_signed(
        quote_to_withdraw,
        token_program,
        vault_ata_quote,
        user_ata_quote,
        amm,
        seeds,
    )?;

    Ok(())
}
