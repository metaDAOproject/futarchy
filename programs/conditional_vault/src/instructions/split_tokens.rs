use super::*;

impl<'info, 'c: 'info> InteractWithNewVault<'info> {
    pub fn handle_split_tokens(ctx: Context<'_, '_, 'c, 'info, Self>, amount: u64) -> Result<()> {
        let accs = &ctx.accounts;

        let (mut conditional_token_mints, mut user_conditional_token_accounts) =
            Self::get_mints_and_user_token_accounts(&ctx)?;

        let pre_vault_underlying_balance = accs.vault_underlying_token_account.amount;
        let pre_conditional_user_balances = user_conditional_token_accounts
            .iter()
            .map(|acc| acc.amount)
            .collect::<Vec<u64>>();
        let pre_conditional_mint_supplies = conditional_token_mints
            .iter()
            .map(|mint| mint.supply)
            .collect::<Vec<u64>>();

        require!(
            accs.user_underlying_token_account.amount >= amount,
            VaultError::InsufficientUnderlyingTokens
        );

        let vault = &accs.vault;

        let seeds = generate_new_vault_seeds!(vault);
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new(
                accs.token_program.to_account_info(),
                Transfer {
                    from: accs.user_underlying_token_account.to_account_info(),
                    to: accs.vault_underlying_token_account.to_account_info(),
                    authority: accs.authority.to_account_info(),
                },
            ),
            amount,
        )?;

        for (conditional_mint, user_conditional_token_account) in conditional_token_mints
            .iter()
            .zip(user_conditional_token_accounts.iter())
        {
            token::mint_to(
                CpiContext::new_with_signer(
                    accs.token_program.to_account_info(),
                    MintTo {
                        mint: conditional_mint.to_account_info(),
                        to: user_conditional_token_account.to_account_info(),
                        authority: accs.vault.to_account_info(),
                    },
                    signer,
                ),
                amount,
            )?;
        }

        ctx.accounts.vault_underlying_token_account.reload()?;
        assert!(
            ctx.accounts.vault_underlying_token_account.amount
                == pre_vault_underlying_balance + amount
        );

        for (i, mint) in conditional_token_mints.iter_mut().enumerate() {
            mint.reload()?;
            assert!(mint.supply == pre_conditional_mint_supplies[i] + amount);
        }

        for (i, acc) in user_conditional_token_accounts.iter_mut().enumerate() {
            acc.reload()?;
            assert!(acc.amount == pre_conditional_user_balances[i] + amount);
        }

        ctx.accounts.vault.invariant(
            &ctx.accounts.question,
            conditional_token_mints.iter().map(|mint| mint.supply).collect::<Vec<u64>>(),
            ctx.accounts.vault_underlying_token_account.amount,
        )?;

        Ok(())
    }
}
