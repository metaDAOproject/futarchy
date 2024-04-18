use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::*;

use crate::error::AmmError;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
#[allow(non_snake_case)]
pub struct CreateAmmArgs {
    pub twap_initial_observation: u128,
    pub twap_max_observation_change_per_update: u128,
}

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
    #[account(
        init,
        payer = user,
        seeds = [AMM_LP_MINT_SEED_PREFIX, amm.key().as_ref()],
        bump,
        mint::authority = amm,
        mint::freeze_authority = amm,
        mint::decimals = 9,
    )]
    pub lp_mint: Box<Account<'info, Mint>>,
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

impl CreateAmm<'_> {
    fn validate(&self) -> Result<()> {
        require_neq!(
            self.base_mint.key(),
            self.quote_mint.key(),
            AmmError::SameTokenMints
        );

        Ok(())
    }
}

#[access_control(ctx.accounts.validate())]
pub fn handler(ctx: Context<CreateAmm>, args: CreateAmmArgs) -> Result<()> {
    let CreateAmm {
        user: _,
        amm,
        lp_mint,
        base_mint,
        quote_mint,
        vault_ata_base: _,
        vault_ata_quote: _,
        associated_token_program: _,
        token_program: _,
        system_program: _,
    } = ctx.accounts;

    let current_slot = Clock::get()?.slot;

    let CreateAmmArgs {
        twap_initial_observation,
        twap_max_observation_change_per_update,
    } = args;

    amm.set_inner(Amm {
        bump: *ctx.bumps.get("amm").unwrap(),

        created_at_slot: current_slot,

        lp_mint: lp_mint.key(),
        base_mint: base_mint.key(),
        quote_mint: quote_mint.key(),

        base_mint_decimals: base_mint.decimals,
        quote_mint_decimals: quote_mint.decimals,

        base_amount: 0,
        quote_amount: 0,

        oracle: TwapOracle::new(
            current_slot,
            twap_initial_observation,
            twap_max_observation_change_per_update,
        ),
    });

    Ok(())
}
