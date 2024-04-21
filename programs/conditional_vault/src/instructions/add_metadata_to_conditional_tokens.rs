use super::*;

#[derive(Accounts)]
pub struct AddMetadataToConditionalTokens<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        has_one = underlying_token_mint,
    )]
    pub vault: Account<'info, ConditionalVault>,
    #[account(mut)]
    pub underlying_token_mint: Account<'info, Mint>,
    pub underlying_token_metadata: Account<'info, MetadataAccount>,
    #[account(
        mut,
        mint::authority = vault,
        mint::freeze_authority = vault,
        mint::decimals = underlying_token_mint.decimals
    )]
    pub conditional_on_finalize_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        mint::authority = vault,
        mint::freeze_authority = vault,
        mint::decimals = underlying_token_mint.decimals
    )]
    pub conditional_on_revert_token_mint: Account<'info, Mint>,
    /// CHECK: verified via cpi into token metadata
    #[account(mut)]
    pub conditional_on_finalize_token_metadata: AccountInfo<'info>,
    /// CHECK: verified via cpi into token metadata
    #[account(mut)]
    pub conditional_on_revert_token_metadata: AccountInfo<'info>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl AddMetadataToConditionalTokens<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(self.vault.status == VaultStatus::Active, VaultError::VaultAlreadySettled);

        Ok(())
    }
    pub fn handle(ctx: Context<Self>, proposal_number: u64, on_finalize_uri: String, on_revert_uri: String) -> Result<()> {
        let seeds = generate_vault_seeds!(ctx.accounts.vault);
        let signer_seeds = &[&seeds[..]];

        // there are null bytes we must trim from string, otherwise string value is longer than we want
        let underlying_token_symbol_raw =
            ctx.accounts.underlying_token_metadata.data.symbol.clone();
        let underlying_token_symbol = underlying_token_symbol_raw.trim_matches(char::from(0));

        let on_finalize_token_symbol = format!("p{}", underlying_token_symbol);
        let on_revert_token_symbol = format!("f{}", underlying_token_symbol);

        for (symbol, uri, metadata, mint) in [
            (
                on_finalize_token_symbol,
                on_finalize_uri,
                &ctx.accounts.conditional_on_finalize_token_metadata,
                &ctx.accounts.conditional_on_finalize_token_mint,
            ),
            (
                on_revert_token_symbol,
                on_revert_uri,
                &ctx.accounts.conditional_on_revert_token_metadata,
                &ctx.accounts.conditional_on_revert_token_mint,
            ),
        ] {
            let cpi_program = ctx.accounts.token_metadata_program.to_account_info();

            let cpi_accounts = CreateMetadataAccountsV3 {
                metadata: metadata.to_account_info(),
                mint: mint.to_account_info(),
                mint_authority: ctx.accounts.vault.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.vault.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            };

            create_metadata_accounts_v3(
                CpiContext::new(cpi_program, cpi_accounts).with_signer(signer_seeds),
                DataV2 {
                    name: format!("Proposal {}: {}", proposal_number, symbol),
                    symbol,
                    uri,
                    seller_fee_basis_points: 0,
                    creators: None,
                    collection: None,
                    uses: None,
                },
                false,
                true,
                None,
            )?;
        }

        Ok(())
    }
}