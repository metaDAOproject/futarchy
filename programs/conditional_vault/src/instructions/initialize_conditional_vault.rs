use super::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeConditionalVaultArgs {
    pub settlement_authority: Pubkey,
}

#[derive(Accounts)]
#[instruction(args: InitializeConditionalVaultArgs)]
pub struct InitializeConditionalVault<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<ConditionalVault>(),
        seeds = [
            b"conditional_vault", 
            args.settlement_authority.key().as_ref(),
            underlying_token_mint.key().as_ref(),
        ],
        bump
    )]
    pub vault: Box<Account<'info, ConditionalVault>>,
    pub underlying_token_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        seeds = [b"conditional_on_finalize_mint", vault.key().as_ref()],
        bump,
        mint::authority = vault,
        mint::freeze_authority = vault,
        mint::decimals = underlying_token_mint.decimals
    )]
    pub conditional_on_finalize_token_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        payer = payer,
        seeds = [b"conditional_on_revert_mint", vault.key().as_ref()],
        bump,
        mint::authority = vault,
        mint::freeze_authority = vault,
        mint::decimals = underlying_token_mint.decimals
    )]
    pub conditional_on_revert_token_mint: Box<Account<'info, Mint>>,
    #[account(
        associated_token::authority = vault,
        associated_token::mint = underlying_token_mint
    )]
    pub vault_underlying_token_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl InitializeConditionalVault<'_> {
    pub fn handle(ctx: Context<Self>, args: InitializeConditionalVaultArgs) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        let InitializeConditionalVaultArgs {
            settlement_authority,
        } = args;

        vault.set_inner(ConditionalVault {
            status: VaultStatus::Active,
            settlement_authority,
            underlying_token_mint: ctx.accounts.underlying_token_mint.key(),
            underlying_token_account: ctx.accounts.vault_underlying_token_account.key(),
            conditional_on_finalize_token_mint: ctx
                .accounts
                .conditional_on_finalize_token_mint
                .key(),
            conditional_on_revert_token_mint: ctx.accounts.conditional_on_revert_token_mint.key(),
            pda_bump: ctx.bumps.vault,
            decimals: ctx.accounts.underlying_token_mint.decimals,
            base_reserves: 10_u128.pow(ctx.accounts.conditional_on_revert_token_mint.decimals as u32) as u64,
            quote_reserves: 10_u128.pow(ctx.accounts.underlying_token_mint.decimals as u32) as u64,
            base_decimals: ctx.accounts.conditional_on_revert_token_mint.decimals,
            quote_decimals: ctx.accounts.underlying_token_mint.decimals,
        });

        Ok(())
    }
}
