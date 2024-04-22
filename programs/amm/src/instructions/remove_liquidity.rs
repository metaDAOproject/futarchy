use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Transfer};

use crate::{error::AmmError, *};

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct RemoveLiquidityParams {
    pub lp_tokens_to_burn: u64,
    pub min_quote_amount: u64,
    pub min_base_amount: u64,
}

pub fn handler(ctx: Context<AddOrRemoveLiquidity>, params: RemoveLiquidityParams) -> Result<()> {
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

    let RemoveLiquidityParams {
        lp_tokens_to_burn,
        min_quote_amount,
        min_base_amount,
    } = params;

    require_gte!(
        user_ata_lp.amount,
        lp_tokens_to_burn,
        AmmError::InsufficientBalance
    );

    amm.update_twap(Clock::get()?.slot);

    // airlifted from uniswap v1:
    // https://github.com/Uniswap/v1-contracts/blob/c10c08d81d6114f694baa8bd32f555a40f6264da/contracts/uniswap_exchange.vy#L83

    let total_liquidity = lp_mint.supply as u128;
    assert!(total_liquidity > 0);

    // these must fit back into u64 since `lp_tokens_to_burn` <= `total_liquidity`
    let base_to_withdraw =
        ((lp_tokens_to_burn as u128 * amm.base_amount as u128) / total_liquidity) as u64;
    let quote_to_withdraw =
        ((lp_tokens_to_burn as u128 * amm.quote_amount as u128) / total_liquidity) as u64;

    require_gte!(
        base_to_withdraw,
        min_base_amount,
        AmmError::SlippageExceeded
    );
    require_gte!(
        quote_to_withdraw,
        min_quote_amount,
        AmmError::SlippageExceeded
    );

    token::burn(
        CpiContext::new(
            token_program.to_account_info(),
            Burn {
                mint: lp_mint.to_account_info(),
                from: user_ata_lp.to_account_info(),
                authority: user.to_account_info(),
            },
        ),
        lp_tokens_to_burn,
    )?;

    amm.base_amount -= base_to_withdraw;
    amm.quote_amount -= quote_to_withdraw;

    let seeds = generate_amm_seeds!(amm);

    for (amount_to_withdraw, from, to) in [
        (base_to_withdraw, vault_ata_base, user_ata_base),
        (quote_to_withdraw, vault_ata_quote, user_ata_quote),
    ] {
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                Transfer {
                    from: from.to_account_info(),
                    to: to.to_account_info(),
                    authority: amm.to_account_info(),
                },
                &[seeds],
            ),
            amount_to_withdraw as u64,
        )?;
    }

    Ok(())
}
