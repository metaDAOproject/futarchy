use super::*;

impl<'info, 'c: 'info> InteractWithNewVault<'info> {
    pub fn validate_redeem_tokens(&self) -> Result<()> {
        require!(
            self.question.is_resolved(),
            VaultError::CantRedeemConditionalTokens
        );

        Ok(())
    }

    pub fn handle_redeem_tokens(ctx: Context<'_, '_, 'c, 'info, Self>) -> Result<()> {
        let accs = &ctx.accounts;

        let (conditional_token_mints, user_conditional_token_accounts) =
            Self::get_mints_and_user_token_accounts(&ctx)?;

        let vault = &accs.vault;
        let question = &accs.question;

        // let pre_vault_underlying_balance = accs.vault_underlying_token_account.amount;
        // let pre_finalize_mint_supply = accs.conditional_on_finalize_token_mint.supply;
        // let pre_revert_mint_supply = accs.conditional_on_revert_token_mint.supply;

        // let pre_conditional_on_finalize_balance =
        //     accs.user_conditional_on_finalize_token_account.amount;
        // let pre_conditional_on_revert_balance =
        //     accs.user_conditional_on_revert_token_account.amount;

        let seeds = generate_new_vault_seeds!(vault);
        let signer = &[&seeds[..]];

        for (conditional_mint, user_conditional_token_account) in conditional_token_mints
            .iter()
            .zip(user_conditional_token_accounts.iter())
        {
            // this is safe because we check that every conditional mint is a part of the vault
            let payout_index = vault
                .conditional_token_mints
                .iter()
                .position(|mint| mint == &conditional_mint.key())
                .unwrap();

            let redeemable = ((user_conditional_token_account.amount as u128
                * question.payout_numerators[payout_index] as u128)
                / question.payout_denominator as u128) as u64;
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
        }

        // let redeemable = match vault_status {
        //     VaultStatus::Finalized => pre_conditional_on_finalize_balance,
        //     VaultStatus::Reverted => pre_conditional_on_revert_balance,
        //     _ => unreachable!(),
        // };

        // ctx.accounts
        //     .user_conditional_on_finalize_token_account
        //     .reload()?;
        // ctx.accounts
        //     .user_conditional_on_revert_token_account
        //     .reload()?;
        // ctx.accounts.vault_underlying_token_account.reload()?;
        // ctx.accounts.conditional_on_finalize_token_mint.reload()?;
        // ctx.accounts.conditional_on_revert_token_mint.reload()?;

        // let post_user_conditional_on_finalize_balance = ctx
        //     .accounts
        //     .user_conditional_on_finalize_token_account
        //     .amount;
        // let post_user_conditional_on_revert_balance =
        //     ctx.accounts.user_conditional_on_revert_token_account.amount;
        // let post_vault_underlying_balance = ctx.accounts.vault_underlying_token_account.amount;
        // let post_finalize_mint_supply = ctx.accounts.conditional_on_finalize_token_mint.supply;
        // let post_revert_mint_supply = ctx.accounts.conditional_on_revert_token_mint.supply;

        // assert!(post_user_conditional_on_finalize_balance == 0);
        // assert!(post_user_conditional_on_revert_balance == 0);
        // assert!(
        //     post_finalize_mint_supply
        //         == pre_finalize_mint_supply - pre_conditional_on_finalize_balance
        // );
        // assert!(
        //     post_revert_mint_supply == pre_revert_mint_supply - pre_conditional_on_revert_balance
        // );
        // match vault_status {
        //     VaultStatus::Finalized => {
        //         assert!(
        //             post_vault_underlying_balance
        //                 == pre_vault_underlying_balance - pre_conditional_on_finalize_balance
        //         );
        //     }
        //     VaultStatus::Reverted => {
        //         assert!(vault_status == VaultStatus::Reverted);
        //         assert!(
        //             post_vault_underlying_balance
        //                 == pre_vault_underlying_balance - pre_conditional_on_revert_balance
        //         );
        //     }
        //     _ => unreachable!(),
        // }

        Ok(())
    }
}
