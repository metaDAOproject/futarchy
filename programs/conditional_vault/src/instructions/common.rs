use super::*;

#[derive(Accounts)]
pub struct InteractWithVault<'info> {
    #[account(
        mut,
        has_one = conditional_on_finalize_token_mint @ VaultError::InvalidConditionalTokenMint,
        has_one = conditional_on_revert_token_mint @ VaultError::InvalidConditionalTokenMint,
    )]
    pub vault: Account<'info, ConditionalVault>,
    #[account(mut)]
    pub conditional_on_finalize_token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub conditional_on_revert_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = vault_underlying_token_account.key() == vault.underlying_token_account @ VaultError::InvalidVaultUnderlyingTokenAccount
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = conditional_on_finalize_token_mint
    )]
    pub user_conditional_on_finalize_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = conditional_on_revert_token_mint
    )]
    pub user_conditional_on_revert_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = vault.underlying_token_mint
    )]
    pub user_underlying_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}