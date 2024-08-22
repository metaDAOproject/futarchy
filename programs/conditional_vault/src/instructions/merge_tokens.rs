use super::*;

impl<'info, 'c: 'info> InteractWithNewVault<'info> {
    pub fn handle_merge_tokens(ctx: Context<'_, '_, 'c, 'info, Self>, amount: u64) -> Result<()> {
        let accs = &ctx.accounts;

        let (conditional_token_mints, user_conditional_token_accounts) =
            Self::get_mints_and_user_token_accounts(&ctx)?;


        let vault = &accs.vault;

        // Store Pre-operation Balances
        // let pre_user_conditional_on_finalize_balance = ctx
        //     .accounts
        //     .user_conditional_on_finalize_token_account
        //     .amount;
        // let pre_user_conditional_on_revert_balance =
        //     ctx.accounts.user_conditional_on_revert_token_account.amount;
        // let pre_vault_underlying_balance = ctx.accounts.vault_underlying_token_account.amount;
        // let pre_finalize_mint_supply = ctx.accounts.conditional_on_finalize_token_mint.supply;
        // let pre_revert_mint_supply = ctx.accounts.conditional_on_revert_token_mint.supply;

        let seeds = generate_new_vault_seeds!(vault);
        let signer = &[&seeds[..]];

        // burn `amount` from both token accounts
        // for (conditional_mint, user_conditional_token_account) in [
        //     (
        //         &accs.conditional_on_finalize_token_mint,
        //         &accs.user_conditional_on_finalize_token_account,
        //     ),
        //     (
        //         &accs.conditional_on_revert_token_mint,
        //         &accs.user_conditional_on_revert_token_account,
        //     ),
        // ] {
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

        // Reload Accounts to Reflect Changes
        // ctx.accounts
        //     .user_conditional_on_finalize_token_account
        //     .reload()?;
        // ctx.accounts
        //     .user_conditional_on_revert_token_account
        //     .reload()?;
        // ctx.accounts.vault_underlying_token_account.reload()?;
        // ctx.accounts.conditional_on_finalize_token_mint.reload()?;
        // ctx.accounts.conditional_on_revert_token_mint.reload()?;

        // // Check post-operation balances
        // let post_user_conditional_on_finalize_balance = ctx
        //     .accounts
        //     .user_conditional_on_finalize_token_account
        //     .amount;
        // let post_user_conditional_on_revert_balance =
        //     ctx.accounts.user_conditional_on_revert_token_account.amount;
        // let post_vault_underlying_balance = ctx.accounts.vault_underlying_token_account.amount;
        // let post_finalize_mint_supply = ctx.accounts.conditional_on_finalize_token_mint.supply;
        // let post_revert_mint_supply = ctx.accounts.conditional_on_revert_token_mint.supply;

        // Check that the user's conditional token balances are unchanged (since we're not necessarily burning all tokens)
        // require_eq!(
        //     post_user_conditional_on_finalize_balance,
        //     pre_user_conditional_on_finalize_balance - amount
        // );
        // require_eq!(
        //     post_user_conditional_on_revert_balance,
        //     pre_user_conditional_on_revert_balance - amount
        // );

        // // Check that the mint supplies have been reduced by the burned amounts
        // require_eq!(post_finalize_mint_supply, pre_finalize_mint_supply - amount);
        // require_eq!(post_revert_mint_supply, pre_revert_mint_supply - amount);

        // // Check that the vault's underlying balance has been reduced by the transferred amount
        // require_eq!(
        //     post_vault_underlying_balance,
        //     pre_vault_underlying_balance - amount
        // );


        Ok(())
    }
}
