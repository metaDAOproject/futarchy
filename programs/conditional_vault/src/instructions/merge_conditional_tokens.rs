use super::*;

impl InteractWithVault<'_> {
    pub fn validate_merge_conditional_tokens(&self) -> Result<()> {
        require!(
            self.vault.status == VaultStatus::Active,
            VaultError::VaultAlreadySettled
        );

        Ok(())
    }

    pub fn handle_merge_conditional_tokens(ctx: Context<Self>, amount: u64) -> Result<()> {
        let accs = &ctx.accounts;

        let pre_user_conditional_on_finalize_balance = ctx
            .accounts
            .user_conditional_on_finalize_token_account
            .amount;
        let pre_user_conditional_on_revert_balance =
            ctx.accounts.user_conditional_on_revert_token_account.amount;
        let pre_vault_underlying_balance = ctx.accounts.vault_underlying_token_account.amount;
        let pre_finalize_mint_supply = ctx.accounts.conditional_on_finalize_token_mint.supply;
        let pre_revert_mint_supply = ctx.accounts.conditional_on_revert_token_mint.supply;

        let seeds = generate_vault_seeds!(accs.vault);
        let signer = &[&seeds[..]];
     
        // burn `amount` from both token accounts
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
                amount,
            )?;
        }
        let transfer_amount = accs.vault.sell_quote(amount.into());

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
            transfer_amount,
        )?;
        
        let _ = drop(accs);
        let vault = &mut ctx.accounts.vault;
        let epsilon = 1e-9; // Small value to prevent reaching zero
        let increase_factor = vault.base_reserves as f64 / vault.quote_reserves as f64;
        vault.base_reserves = 
            ((vault.base_reserves as f64 * increase_factor) + epsilon).ceil() as u64;
        vault.quote_reserves = 
            ((vault.quote_reserves as f64 - transfer_amount as f64) + epsilon).ceil() as u64;
        // Reload Accounts to Reflect Changes
        ctx.accounts
            .user_conditional_on_finalize_token_account
            .reload()?;
        ctx.accounts
            .user_conditional_on_revert_token_account
            .reload()?;
        ctx.accounts.vault_underlying_token_account.reload()?;
        ctx.accounts.conditional_on_finalize_token_mint.reload()?;
        ctx.accounts.conditional_on_revert_token_mint.reload()?;

        // Check post-operation balances
        let post_user_conditional_on_finalize_balance = ctx
            .accounts
            .user_conditional_on_finalize_token_account
            .amount;
        let post_user_conditional_on_revert_balance =
            ctx.accounts.user_conditional_on_revert_token_account.amount;
        let post_vault_underlying_balance = ctx.accounts.vault_underlying_token_account.amount;
        let post_finalize_mint_supply = ctx.accounts.conditional_on_finalize_token_mint.supply;
        let post_revert_mint_supply = ctx.accounts.conditional_on_revert_token_mint.supply;

        // Check that the user's conditional token balances are unchanged (since we're not necessarily burning all tokens)
        require_eq!(
            post_user_conditional_on_finalize_balance,
            pre_user_conditional_on_finalize_balance - amount
        );
        require_eq!(
            post_user_conditional_on_revert_balance,
            pre_user_conditional_on_revert_balance - amount
        );

        // Check that the mint supplies have been reduced by the burned amounts
        require_eq!(post_finalize_mint_supply, pre_finalize_mint_supply - amount);
        require_eq!(post_revert_mint_supply, pre_revert_mint_supply - amount);

        // Check that the vault's underlying balance has been reduced by the transferred amount
        require_eq!(
            post_vault_underlying_balance,
            pre_vault_underlying_balance - transfer_amount
        );

        Ok(())
    }
}
