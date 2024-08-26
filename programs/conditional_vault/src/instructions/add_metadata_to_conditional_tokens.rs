use super::*;

pub mod proph3t_deployer {
    use anchor_lang::declare_id;

    declare_id!("HfFi634cyurmVVDr9frwu4MjGLJzz9XbAJz981HdVaNz");
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct AddMetadataToConditionalTokensArgs {
    // pub uri: String,
    pub name: String,
    pub symbol: String,
    pub image: String,
}

#[derive(Accounts)]
pub struct AddMetadataToConditionalTokens<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub vault: Account<'info, ConditionalVault>,
    // pub underlying_token_metadata: Account<'info, MetadataAccount>,
    #[account(
        mut,
        mint::authority = vault,
        mint::freeze_authority = vault,
    )]
    pub conditional_token_mint: Account<'info, Mint>,
    /// CHECK: verified via cpi into token metadata
    #[account(mut)]
    pub conditional_token_metadata: AccountInfo<'info>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl AddMetadataToConditionalTokens<'_> {
    pub fn validate(&self) -> Result<()> {
        // require!(
        //     self.vault.status == VaultStatus::Active,
        //     VaultError::VaultAlreadySettled
        // );

        #[cfg(feature = "production")]
        require_eq!(
            self.payer.key(), proph3t_deployer::ID
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, args: AddMetadataToConditionalTokensArgs) -> Result<()> {
        let seeds = generate_vault_seeds!(ctx.accounts.vault);
        let signer_seeds = &[&seeds[..]];

        // let underlying_token_symbol_raw = ctx.accounts.underlying_token_metadata.symbol.clone();
        // let underlying_token_symbol = underlying_token_symbol_raw.trim_matches(char::from(0));

        let cpi_program = ctx.accounts.token_metadata_program.to_account_info();

        let cpi_accounts = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.conditional_token_metadata.to_account_info(),
            mint: ctx.accounts.conditional_token_mint.to_account_info(),
            mint_authority: ctx.accounts.vault.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            update_authority: ctx.accounts.vault.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };

        create_metadata_accounts_v3(
            CpiContext::new(cpi_program, cpi_accounts).with_signer(signer_seeds),
            DataV2 {
                name: args.name.clone(),
                symbol: args.symbol.clone(),
                uri: format!(
                    "data:,{{\"name\":\"{}\",\"symbol\":\"{}\",\"image\":\"{}\"}}",
                    args.name, args.symbol, args.image
                ),
                seller_fee_basis_points: 0,
                creators: None,
                collection: None,
                uses: None,
            },
            false,
            true,
            None,
        )?;

        Ok(())
    }
}
