use super::*;

impl InteractWithVault<'_> {
    pub fn validate_redeem_conditional_tokens(&self) -> Result<()> {
        require!(
            self.vault.status != VaultStatus::Active,
            VaultError::CantRedeemConditionalTokens
        );

        Ok(())
    }

    pub fn handle_redeem_conditional_tokens(ctx: Context<Self>) -> Result<()> {
        let accs = &ctx.accounts;
        let vault_status = accs.vault.status;

        // storing some numbers for later invariant checks
        let pre_vault_underlying_balance = accs.vault_underlying_token_account.amount;
        let pre_finalize_mint_supply = accs.conditional_on_finalize_token_mint.supply;
        let pre_revert_mint_supply = accs.conditional_on_revert_token_mint.supply;

        let pre_conditional_on_finalize_balance =
            accs.user_conditional_on_finalize_token_account.amount;
        let pre_conditional_on_revert_balance =
            accs.user_conditional_on_revert_token_account.amount;

        let seeds = generate_vault_seeds!(accs.vault);
        let signer = &[&seeds[..]];

        // burn from both accounts even though we technically only need to burn from one
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
            token::burn(
                CpiContext::new(
                    accs.token_program.to_account_info(),
                    Burn {
                        mint: conditional_mint.to_account_info(),
                        from: user_conditional_token_account.to_account_info(),
                        authority: accs.authority.to_account_info(),
                    },
                ),
                user_conditional_token_account.amount,
            )?;
        }

        let redeemable = match vault_status {
            VaultStatus::Finalized => accs.vault.sell_quote(pre_conditional_on_finalize_balance.into()),
            VaultStatus::Reverted => accs.vault.sell_quote(pre_conditional_on_revert_balance.into()),
            _ => unreachable!(),
        };


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
            redeemable,
        )?;

        let _ = drop(accs);
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

        assert!(post_user_conditional_on_finalize_balance == 0);
        assert!(post_user_conditional_on_revert_balance == 0);
        assert!(
            post_finalize_mint_supply
                == pre_finalize_mint_supply - pre_conditional_on_finalize_balance
        );
        assert!(
            post_revert_mint_supply == pre_revert_mint_supply - pre_conditional_on_revert_balance
        );
        match vault_status {
            VaultStatus::Finalized => {
                assert!(
                    post_vault_underlying_balance
                        == pre_vault_underlying_balance - redeemable
                );
            }
            VaultStatus::Reverted => {
                assert!(vault_status == VaultStatus::Reverted);
                assert!(
                    post_vault_underlying_balance
                        == pre_vault_underlying_balance - redeemable
                );
            }
            _ => unreachable!(),
        }
        let vault = &mut ctx.accounts.vault;
        let epsilon = 1e-9; // Small value to prevent reaching zero
        let increase_factor = vault.base_reserves as f64 / vault.quote_reserves as f64;
        vault.base_reserves = 
            ((vault.base_reserves as f64 * increase_factor) + epsilon).ceil() as u64;
        vault.quote_reserves = 
            ((vault.quote_reserves as f64 - redeemable as f64) + epsilon).ceil() as u64;

        Ok(())
    }
}
