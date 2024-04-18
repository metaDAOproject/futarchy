use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};
use num_traits::ToPrimitive;

use crate::error::AmmError;
use crate::{utils::*, AddOrRemoveLiquidity};
use crate::{generate_vault_seeds, state::*};

pub fn handler(
    ctx: Context<AddOrRemoveLiquidity>,
    max_base_amount: u64,
    max_quote_amount: u64,
    min_base_amount: u64,
    min_quote_amount: u64,
) -> Result<()> {
    let AddOrRemoveLiquidity {
        user,
        amm,
        lp_mint,
        base_mint: _,
        quote_mint: _,
        user_ata_lp,
        user_ata_base,
        user_ata_quote,
        vault_ata_base,
        vault_ata_quote,
        associated_token_program: _,
        token_program,
        system_program: _,
    } = ctx.accounts;

    assert!(max_base_amount > 0);
    assert!(max_quote_amount > 0);

    amm.update_twap(Clock::get()?.slot);

    let mut temp_base_amount: u128;
    let mut temp_quote_amount: u128;

    let base_mint_key = amm.base_mint;
    let quote_mint_key = amm.quote_mint;

    let seeds = generate_vault_seeds!(base_mint_key, quote_mint_key, amm.bump);
    let signer = &[&seeds[..]];

    let amount_to_mint = if amm.base_amount == 0 && amm.quote_amount == 0 {
        // if there is no liquidity in the amm, then initialize with new ownership values
        temp_base_amount = max_base_amount as u128;
        temp_quote_amount = max_quote_amount as u128;

        // use the higher number for ownership, to reduce rounding errors
        std::cmp::max(max_base_amount, max_quote_amount)
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
                return err!(AmmError::AddLiquidityCalculationError);
            }
        }

        let additional_ownership_base = temp_base_amount
            .checked_mul(lp_mint.supply as u128)
            .unwrap()
            .checked_div(amm.base_amount as u128)
            .unwrap()
            .to_u64()
            .unwrap();

        let additional_ownership_quote = temp_quote_amount
            .checked_mul(lp_mint.supply as u128)
            .unwrap()
            .checked_div(amm.quote_amount as u128)
            .unwrap()
            .to_u64()
            .unwrap();

        std::cmp::min(additional_ownership_base, additional_ownership_quote)
    };

    token::mint_to(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            MintTo {
                mint: lp_mint.to_account_info(),
                to: user_ata_lp.to_account_info(),
                authority: amm.to_account_info(),
            },
            signer,
        ),
        amount_to_mint,
    )?;

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
