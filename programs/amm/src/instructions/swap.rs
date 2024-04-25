use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, *};

use crate::error::AmmError;
use crate::generate_amm_seeds;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SwapArgs {
    pub swap_type: SwapType,
    pub input_amount: u64,
    pub output_amount_min: u64,
}

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

impl Swap<'_> {
    pub fn handle(ctx: Context<Swap>, args: SwapArgs) -> Result<()> {
        let Swap {
            user,
            amm,
            base_mint: _,
            quote_mint: _,
            user_ata_base,
            user_ata_quote,
            vault_ata_base,
            vault_ata_quote,
            associated_token_program: _,
            token_program,
            system_program: _,
        } = ctx.accounts;

        let SwapArgs {
            swap_type,
            input_amount,
            output_amount_min,
        } = args;

        match swap_type {
            SwapType::Buy => require_gte!(
                user_ata_quote.amount,
                input_amount,
                AmmError::InsufficientBalance
            ),
            SwapType::Sell => require_gte!(
                user_ata_base.amount,
                input_amount,
                AmmError::InsufficientBalance
            ),
        };

        assert!(input_amount > 0);

        amm.update_twap(Clock::get()?.slot);

        let output_amount = amm.swap(input_amount, swap_type)?;

        let seeds = generate_amm_seeds!(amm);

        let (user_from, vault_to, vault_from, user_to) = match swap_type {
            SwapType::Buy => (
                user_ata_quote,
                vault_ata_quote,
                vault_ata_base,
                user_ata_base,
            ),
            SwapType::Sell => (
                user_ata_base,
                vault_ata_base,
                vault_ata_quote,
                user_ata_quote,
            ),
        };

        token::transfer(
            CpiContext::new(
                token_program.to_account_info(),
                Transfer {
                    from: user_from.to_account_info(),
                    to: vault_to.to_account_info(),
                    authority: user.to_account_info(),
                },
            ),
            input_amount,
        )?;

        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                Transfer {
                    from: vault_from.to_account_info(),
                    to: user_to.to_account_info(),
                    authority: amm.to_account_info(),
                },
                &[seeds],
            ),
            output_amount,
        )?;

        require_gte!(
            output_amount,
            output_amount_min,
            AmmError::SwapSlippageExceeded
        );

        Ok(())
    }
}
