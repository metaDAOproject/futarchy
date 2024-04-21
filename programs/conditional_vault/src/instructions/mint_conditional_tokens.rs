use super::*;

impl InteractWithVault<'_> {
    pub fn handle_mint_conditional_tokens(ctx: Context<Self>, amount: u64) -> Result<()> {
        let accs = &ctx.accounts;

        let pre_vault_underlying_balance = accs.vault_underlying_token_account.amount;
        let pre_user_conditional_on_finalize_balance =
            accs.user_conditional_on_finalize_token_account.amount;
        let pre_user_conditional_on_revert_balance =
            accs.user_conditional_on_revert_token_account.amount;
        let pre_finalize_mint_supply = accs.conditional_on_finalize_token_mint.supply;
        let pre_revert_mint_supply = accs.conditional_on_revert_token_mint.supply;

        require!(
            accs.user_underlying_token_account.amount >= amount,
            VaultError::InsufficientUnderlyingTokens
        );

        let vault = &accs.vault;

        let seeds = generate_vault_seeds!(vault);
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

        for (conditional_mint, user_conditional_token_account) in [
            (
                &accs.conditional_on_finalize_token_mint,
                &accs.user_conditional_on_finalize_token_account,
            ),
            (
                &accs.conditional_on_revert_token_mint,
                &accs.user_conditional_on_revert_token_account,
            ),
        ] {
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

        ctx.accounts
            .user_conditional_on_finalize_token_account
            .reload()?;
        ctx.accounts
            .user_conditional_on_revert_token_account
            .reload()?;
        ctx.accounts.vault_underlying_token_account.reload()?;
        ctx.accounts.conditional_on_finalize_token_mint.reload()?;
        ctx.accounts.conditional_on_revert_token_mint.reload()?;

        let post_user_conditional_on_finalize_balance = ctx
            .accounts
            .user_conditional_on_finalize_token_account
            .amount;
        let post_user_conditional_on_revert_balance =
            ctx.accounts.user_conditional_on_revert_token_account.amount;
        let post_vault_underlying_balance = ctx.accounts.vault_underlying_token_account.amount;
        let post_finalize_mint_supply = ctx.accounts.conditional_on_finalize_token_mint.supply;
        let post_revert_mint_supply = ctx.accounts.conditional_on_revert_token_mint.supply;

        // Only the paranoid survive ;)
        assert!(post_vault_underlying_balance == pre_vault_underlying_balance + amount);
        assert!(
            post_user_conditional_on_finalize_balance
                == pre_user_conditional_on_finalize_balance + amount
        );
        assert!(
            post_user_conditional_on_revert_balance
                == pre_user_conditional_on_revert_balance + amount
        );
        assert!(post_finalize_mint_supply == pre_finalize_mint_supply + amount);
        assert!(post_revert_mint_supply == pre_revert_mint_supply + amount);

        Ok(())
    }
}