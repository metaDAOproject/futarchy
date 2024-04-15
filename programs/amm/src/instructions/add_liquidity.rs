use anchor_lang::prelude::*;
use anchor_spl::associated_token;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token;
use anchor_spl::token::*;
use num_traits::ToPrimitive;

use crate::error::ErrorCode;
use crate::state::*;
use crate::utils::*;

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
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

pub fn handler(
    ctx: Context<AddLiquidity>,
    max_base_amount: u64,
    max_quote_amount: u64,
    min_base_amount: u64,
    min_quote_amount: u64,
) -> Result<()> {
    let AddLiquidity {
        user,
        amm,
        amm_position,
        base_mint: _,
        quote_mint: _,
        user_ata_base,
        user_ata_quote,
        vault_ata_base,
        vault_ata_quote,
        associated_token_program: _,
        token_program,
        system_program: _,
        auth_pda,
    } = ctx.accounts;

    assert!(max_base_amount > 0);
    assert!(max_quote_amount > 0);

    if amm.permissioned {
        assert!(auth_pda.is_some());
    }

    amm.update_ltwap(None)?;

    let mut temp_base_amount: u128;
    let mut temp_quote_amount: u128;

    // if there is no liquidity in the amm, then initialize with new ownership values
    if amm.base_amount == 0 && amm.quote_amount == 0 {
        temp_base_amount = max_base_amount as u128;
        temp_quote_amount = max_quote_amount as u128;

        // use the higher number for ownership, to reduce rounding errors
        let max_base_or_quote_amount = std::cmp::max(temp_base_amount, temp_quote_amount);

        amm_position.ownership = max_base_or_quote_amount.to_u64().unwrap();
        amm.total_ownership = max_base_or_quote_amount.to_u64().unwrap();
    } else {
        temp_base_amount = max_base_amount as u128;

        temp_quote_amount = temp_base_amount
            .checked_mul(amm.quote_amount as u128)
            .unwrap()
            .checked_div(amm.base_amount as u128)
            .unwrap();

        // if the temp_quote_amount calculation with max_base_amount led to a value higher than max_quote_amount,
        // then use the max_quote_amount and calculate in the other direction
        if temp_quote_amount > max_quote_amount as u128 {
            temp_quote_amount = max_quote_amount as u128;

            temp_base_amount = temp_quote_amount
                .checked_mul(amm.base_amount as u128)
                .unwrap()
                .checked_div(amm.quote_amount as u128)
                .unwrap();

            if temp_base_amount > max_base_amount as u128 {
                return err!(ErrorCode::AddLiquidityCalculationError);
            }
        }

        let additional_ownership_base = temp_base_amount
            .checked_mul(amm.total_ownership as u128)
            .unwrap()
            .checked_div(amm.base_amount as u128)
            .unwrap()
            .to_u64()
            .unwrap();

        let additional_ownership_quote = temp_quote_amount
            .checked_mul(amm.total_ownership as u128)
            .unwrap()
            .checked_div(amm.quote_amount as u128)
            .unwrap()
            .to_u64()
            .unwrap();

        let additional_ownership =
            std::cmp::min(additional_ownership_base, additional_ownership_quote);

        amm_position.ownership = amm_position
            .ownership
            .checked_add(additional_ownership)
            .unwrap();
        amm.total_ownership = amm
            .total_ownership
            .checked_add(additional_ownership)
            .unwrap();
    }

    assert!(temp_base_amount >= min_base_amount as u128);
    assert!(temp_quote_amount >= min_quote_amount as u128);

    amm.base_amount = amm
        .base_amount
        .checked_add(temp_base_amount.to_u64().unwrap())
        .unwrap();

    amm.quote_amount = amm
        .quote_amount
        .checked_add(temp_quote_amount.to_u64().unwrap())
        .unwrap();

    // send user base tokens to vault
    token_transfer(
        temp_base_amount as u64,
        &token_program,
        user_ata_base,
        vault_ata_base,
        user,
    )?;

    // send user quote tokens to vault
    token_transfer(
        temp_quote_amount as u64,
        token_program,
        user_ata_quote,
        vault_ata_quote,
        user,
    )?;

    Ok(())
}
