use anchor_lang::prelude::*;
use anchor_spl::token::{self, *};

use crate::error::AmmError;
use crate::AddOrRemoveLiquidity;
use crate::{generate_amm_seeds, state::*};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AddLiquidityArgs {
    /// How much quote token you will deposit to the pool
    quote_amount: u64,
    /// The maximum base token you will deposit to the pool
    max_base_amount: u64,
    /// The minimum LP token you will get back
    min_lp_tokens: u64,
}

impl AddOrRemoveLiquidity<'_> {
    pub fn handle_add(ctx: Context<Self>, args: AddLiquidityArgs) -> Result<()> {
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

        let AddLiquidityArgs {
            quote_amount,
            max_base_amount,
            min_lp_tokens,
        } = args;

        require_gte!(
            user_ata_base.amount,
            max_base_amount,
            AmmError::InsufficientBalance
        );
        require_gte!(
            user_ata_quote.amount,
            quote_amount,
            AmmError::InsufficientBalance
        );

        amm.update_twap(Clock::get()?.slot);

        // airlifted from uniswap v1:
        // https://github.com/Uniswap/v1-contracts/blob/c10c08d81d6114f694baa8bd32f555a40f6264da/contracts/uniswap_exchange.vy#L48

        require!(max_base_amount > 0, AmmError::ZeroLiquidityToAdd);
        require!(quote_amount > 0, AmmError::ZeroLiquidityToAdd);

        let total_lp_supply = lp_mint.supply;

        let (lp_tokens_to_mint, base_amount) = if total_lp_supply > 0 {
            require!(min_lp_tokens > 0, AmmError::ZeroMinLpTokens);

            let quote_reserve = amm.quote_amount as u128;
            let base_reserve = amm.base_amount as u128;

            let base_amount = (((quote_amount as u128 * base_reserve) / quote_reserve) + 1) as u64;

            let lp_tokens_to_mint =
                ((quote_amount as u128 * total_lp_supply as u128) / quote_reserve) as u64;

            require_gte!(
                max_base_amount,
                base_amount,
                AmmError::AddLiquidityMaxBaseExceeded
            );
            require_gte!(
                lp_tokens_to_mint,
                min_lp_tokens,
                AmmError::AddLiquiditySlippageExceeded
            );

            (lp_tokens_to_mint, base_amount)
        } else {
            // equivalent to $100 if quote is USDC, here for rounding
            require_gte!(quote_amount, 100000000, AmmError::InsufficientQuoteAmount);

            let base_amount = max_base_amount;

            let initial_lp_tokens = quote_amount;

            (initial_lp_tokens, base_amount)
        };

        amm.base_amount += base_amount;
        amm.quote_amount += quote_amount;

        let seeds = generate_amm_seeds!(amm);
        let signer = &[&seeds[..]];

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
            lp_tokens_to_mint,
        )?;

        for (amount, from, to) in [
            (base_amount, user_ata_base, vault_ata_base),
            (quote_amount, user_ata_quote, vault_ata_quote),
        ] {
            token::transfer(
                CpiContext::new(
                    token_program.to_account_info(),
                    Transfer {
                        from: from.to_account_info(),
                        to: to.to_account_info(),
                        authority: user.to_account_info(),
                    },
                ),
                amount,
            )?;
        }

        Ok(())
    }
}
