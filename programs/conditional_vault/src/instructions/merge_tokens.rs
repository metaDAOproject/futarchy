use super::*;

impl<'info, 'c: 'info> InteractWithNewVault<'info> {
    pub fn handle_merge_tokens(ctx: Context<'_, '_, 'c, 'info, Self>, amount: u64) -> Result<()> {
        let accs = &ctx.accounts;

        let (mut conditional_token_mints, mut user_conditional_token_accounts) =
            Self::get_mints_and_user_token_accounts(&ctx)?;

        for conditional_token_account in user_conditional_token_accounts.iter() {
            require!(
                conditional_token_account.amount >= amount,
                VaultError::InsufficientConditionalTokens
            );
        }

        let vault = &accs.vault;

        let pre_user_underlying_balance = accs.user_underlying_token_account.amount;
        let pre_vault_underlying_balance = accs.vault_underlying_token_account.amount;

        let expected_future_balances: Vec<u64> = user_conditional_token_accounts
            .iter()
            .map(|account| account.amount - amount)
            .collect();
        let expected_future_supplies: Vec<u64> = conditional_token_mints
            .iter()
            .map(|mint| mint.supply - amount)
            .collect();

        let seeds = generate_vault_seeds!(vault);
        let signer = &[&seeds[..]];

        for (conditional_mint, user_conditional_token_account) in conditional_token_mints
            .iter()
            .zip(user_conditional_token_accounts.iter())
        {
            token::burn(
                CpiContext::new(
                    accs.token_program.to_account_info(),
                    Burn {
                        mint: conditional_mint.to_account_info(),
                        from: user_conditional_token_account.to_account_info(),
                        authority: accs.authority.to_account_info(),
                    },
                ),
                amount,
            )?;
        }

        // Transfer `amount` from vault to user
        token::transfer(
            CpiContext::new_with_signer(
                accs.token_program.to_account_info(),
                Transfer {
                    from: accs.vault_underlying_token_account.to_account_info(),
                    to: accs.user_underlying_token_account.to_account_info(),
                    authority: accs.vault.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        ctx.accounts.user_underlying_token_account.reload()?;
        ctx.accounts.vault_underlying_token_account.reload()?;

        assert!(
            ctx.accounts.user_underlying_token_account.amount
                == pre_user_underlying_balance + amount
        );
        assert!(
            ctx.accounts.vault_underlying_token_account.amount
                == pre_vault_underlying_balance - amount
        );

        for (mint, expected_supply) in conditional_token_mints
            .iter_mut()
            .zip(expected_future_supplies.iter())
        {
            mint.reload()?;
            assert!(mint.supply == *expected_supply);
        }

        for (account, expected_balance) in user_conditional_token_accounts
            .iter_mut()
            .zip(expected_future_balances.iter())
        {
            account.reload()?;
            assert!(account.amount == *expected_balance);
        }

        ctx.accounts.vault.invariant(
            &ctx.accounts.question,
            conditional_token_mints
                .iter()
                .map(|mint| mint.supply)
                .collect::<Vec<u64>>(),
            ctx.accounts.vault_underlying_token_account.amount,
        )?;

        Ok(())
    }
}
