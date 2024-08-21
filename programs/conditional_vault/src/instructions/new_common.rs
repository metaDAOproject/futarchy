use super::*;

#[derive(Accounts)]
pub struct InteractWithNewVault<'info> {
    pub question: Account<'info, Question>,
    #[account(has_one = question)]
    pub vault: Account<'info, NewConditionalVault>,
    #[account(
        mut,
        constraint = vault_underlying_token_account.key() == vault.underlying_token_account @ VaultError::InvalidVaultUnderlyingTokenAccount
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = vault.underlying_token_mint
    )]
    pub user_underlying_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl<'info, 'c: 'info> InteractWithNewVault<'info> {
    pub fn get_mints_and_user_token_accounts(
        ctx: &Context<'_, '_, 'c, 'info, Self>,
    ) -> Result<(Vec<Account<'info, Mint>>, Vec<Account<'info, TokenAccount>>)> {
        let remaining_accs = &mut ctx.remaining_accounts.iter();

        let expected_num_conditional_tokens = ctx.accounts.question.num_outcomes();
        assert_eq!(remaining_accs.len(), expected_num_conditional_tokens * 2);

        let mut conditional_token_mints = vec![];
        let mut user_conditional_token_accounts = vec![];

        for _ in 0..expected_num_conditional_tokens {
            let conditional_token_mint = next_account_info(remaining_accs)?;
            conditional_token_mints.push(Account::<Mint>::try_from(conditional_token_mint)?);

            let user_conditional_token_account = next_account_info(remaining_accs)?;
            user_conditional_token_accounts.push(Account::<TokenAccount>::try_from(
                user_conditional_token_account,
            )?);
        }

        Ok((conditional_token_mints, user_conditional_token_accounts))
    }
}
