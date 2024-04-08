use anchor_lang::prelude::*;
use anchor_spl::metadata::{
    create_metadata_accounts_v3, CreateMetadataAccountsV3, Metadata, MetadataAccount,
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer},
};
use mpl_token_metadata::state::DataV2;

#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "conditional_vault",
    project_url: "https://themetadao.org",
    contacts: "email:metaproph3t@protonmail.com",
    policy: "The market will decide whether we pay a bug bounty.",
    source_code: "https://github.com/metaDAOproject/meta-dao",
    source_release: "v0",
    auditors: "None",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("vAuLTQjV5AZx5f3UgE75wcnkxnQowWxThn1hGjfCVwP");

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VaultStatus {
    Active,
    Finalized,
    Reverted,
}

#[account]
pub struct ConditionalVault {
    pub status: VaultStatus,
    /// The account that can either finalize the vault to make conditional tokens
    /// redeemable for underlying tokens or revert the vault to make deposit
    /// slips redeemable for underlying tokens.
    pub settlement_authority: Pubkey,
    /// The mint of the tokens that are deposited into the vault.
    pub underlying_token_mint: Pubkey,
    /// A nonce to allow a single account to be the settlement authority of multiple
    /// vaults with the same underlying token mints.
    pub nonce: u64,
    /// The vault's storage account for deposited funds.
    pub underlying_token_account: Pubkey,
    pub conditional_on_finalize_token_mint: Pubkey,
    pub conditional_on_revert_token_mint: Pubkey,
    pub pda_bump: u8,
}

// done in a macro instead of function bcuz lifetimes
macro_rules! generate_vault_seeds {
    ($vault:expr) => {{
        &[
            b"conditional_vault",
            $vault.settlement_authority.as_ref(),
            $vault.underlying_token_mint.as_ref(),
            &$vault.nonce.to_le_bytes(),
            &[$vault.pda_bump],
        ]
    }};
}

#[program]
pub mod conditional_vault {
    use super::*;

    pub fn initialize_conditional_vault(
        ctx: Context<InitializeConditionalVault>,
        settlement_authority: Pubkey,
        nonce: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        vault.set_inner(ConditionalVault {
            status: VaultStatus::Active,
            settlement_authority,
            underlying_token_mint: ctx.accounts.underlying_token_mint.key(),
            nonce,
            underlying_token_account: ctx.accounts.vault_underlying_token_account.key(),
            conditional_on_finalize_token_mint: ctx
                .accounts
                .conditional_on_finalize_token_mint
                .key(),
            conditional_on_revert_token_mint: ctx.accounts.conditional_on_revert_token_mint.key(),
            pda_bump: *ctx.bumps.get("vault").unwrap(),
        });

        Ok(())
    }

    pub fn add_metadata_to_conditional_tokens(
        ctx: Context<AddMetadataToConditionalTokens>,
        proposal_number: u64,
        on_finalize_uri: String,
        on_revert_uri: String,
    ) -> Result<()> {
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

    pub fn settle_conditional_vault(
        ctx: Context<SettleConditionalVault>,
        new_status: VaultStatus,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.status = new_status;

        Ok(())
    }

    pub fn merge_conditional_tokens_for_underlying_tokens(
        ctx: Context<MergeConditionalTokensForUnderlyingTokens>,
        amount: u64,
    ) -> Result<()> {
        let accs = &ctx.accounts;

        let vault = &accs.vault;

        // Store Pre-operation Balances
        let pre_user_conditional_on_finalize_balance = ctx
            .accounts
            .user_conditional_on_finalize_token_account
            .amount;
        let pre_user_conditional_on_revert_balance =
            ctx.accounts.user_conditional_on_revert_token_account.amount;
        let pre_vault_underlying_balance = ctx.accounts.vault_underlying_token_account.amount;
        let pre_finalize_mint_supply = ctx.accounts.conditional_on_finalize_token_mint.supply;
        let pre_revert_mint_supply = ctx.accounts.conditional_on_revert_token_mint.supply;

        let seeds = generate_vault_seeds!(vault);
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
            pre_vault_underlying_balance - amount
        );

        Ok(())
    }

    pub fn mint_conditional_tokens(ctx: Context<MintConditionalTokens>, amount: u64) -> Result<()> {
        let accs = &ctx.accounts;

        let pre_vault_underlying_balance = accs.vault_underlying_token_account.amount;
        let pre_user_conditional_on_finalize_balance =
            accs.user_conditional_on_finalize_token_account.amount;
        let pre_user_conditional_on_revert_balance =
            accs.user_conditional_on_revert_token_account.amount;
        let pre_finalize_mint_supply = accs.conditional_on_finalize_token_mint.supply;
        let pre_revert_mint_supply = accs.conditional_on_revert_token_mint.supply;

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

    pub fn redeem_conditional_tokens_for_underlying_tokens(
        ctx: Context<RedeemConditionalTokensForUnderlyingTokens>,
    ) -> Result<()> {
        let accs = &ctx.accounts;

        // storing some numbers for later invariant checks
        let pre_vault_underlying_balance = accs.vault_underlying_token_account.amount;
        let pre_finalize_mint_supply = accs.conditional_on_finalize_token_mint.supply;
        let pre_revert_mint_supply = accs.conditional_on_revert_token_mint.supply;

        let vault = &accs.vault;
        let vault_status = vault.status;

        let seeds = generate_vault_seeds!(vault);
        let signer = &[&seeds[..]];

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

        let conditional_on_finalize_balance =
            accs.user_conditional_on_finalize_token_account.amount;
        let conditional_on_revert_balance = accs.user_conditional_on_revert_token_account.amount;

        if vault_status == VaultStatus::Finalized {
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
                conditional_on_finalize_balance,
            )?;
        } else {
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
                conditional_on_revert_balance,
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

        assert!(post_user_conditional_on_finalize_balance == 0);
        assert!(post_user_conditional_on_revert_balance == 0);
        assert!(
            post_finalize_mint_supply == pre_finalize_mint_supply - conditional_on_finalize_balance
        );
        assert!(post_revert_mint_supply == pre_revert_mint_supply - conditional_on_revert_balance);
        if vault_status == VaultStatus::Finalized {
            assert!(
                post_vault_underlying_balance
                    == pre_vault_underlying_balance - conditional_on_finalize_balance
            );
        } else {
            assert!(vault_status == VaultStatus::Reverted);
            assert!(
                post_vault_underlying_balance
                    == pre_vault_underlying_balance - conditional_on_revert_balance
            );
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(settlement_authority: Pubkey, nonce: u64)]
pub struct InitializeConditionalVault<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<ConditionalVault>(),
        seeds = [
            b"conditional_vault", 
            settlement_authority.key().as_ref(),
            underlying_token_mint.key().as_ref(),
            &nonce.to_le_bytes()
        ],
        bump
    )]
    pub vault: Account<'info, ConditionalVault>,
    pub underlying_token_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        mint::authority = vault,
        mint::freeze_authority = vault,
        mint::decimals = underlying_token_mint.decimals
    )]
    pub conditional_on_finalize_token_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        mint::authority = vault,
        mint::freeze_authority = vault,
        mint::decimals = underlying_token_mint.decimals
    )]
    pub conditional_on_revert_token_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        associated_token::authority = vault,
        associated_token::mint = underlying_token_mint
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddMetadataToConditionalTokens<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        has_one = underlying_token_mint,
        constraint = vault.status == VaultStatus::Active @ ErrorCode::VaultAlreadySettled
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

#[derive(Accounts)]
pub struct SettleConditionalVault<'info> {
    pub settlement_authority: Signer<'info>,
    #[account(
        mut,
        has_one = settlement_authority,
        constraint = vault.status == VaultStatus::Active @ ErrorCode::VaultAlreadySettled
    )]
    pub vault: Account<'info, ConditionalVault>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct MintConditionalTokens<'info> {
    #[account(
        has_one = conditional_on_finalize_token_mint @ ErrorCode::InvalidConditionalTokenMint,
        has_one = conditional_on_revert_token_mint @ ErrorCode::InvalidConditionalTokenMint,
    )]
    pub vault: Account<'info, ConditionalVault>,
    #[account(mut)]
    pub conditional_on_finalize_token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub conditional_on_revert_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = vault_underlying_token_account.key() == vault.underlying_token_account @  ErrorCode::InvalidVaultUnderlyingTokenAccount
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = vault.underlying_token_mint,
        constraint = user_underlying_token_account.amount >= amount @ ErrorCode::InsufficientUnderlyingTokens
    )]
    pub user_underlying_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = conditional_on_finalize_token_mint
    )]
    pub user_conditional_on_finalize_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = conditional_on_revert_token_mint
    )]
    pub user_conditional_on_revert_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct MergeConditionalTokensForUnderlyingTokens<'info> {
    #[account(
        has_one = conditional_on_finalize_token_mint @ ErrorCode::InvalidConditionalTokenMint,
        has_one = conditional_on_revert_token_mint @ ErrorCode::InvalidConditionalTokenMint,
        constraint = vault.status == VaultStatus::Active @ ErrorCode::VaultAlreadySettled
    )]
    pub vault: Account<'info, ConditionalVault>,
    #[account(mut)]
    pub conditional_on_finalize_token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub conditional_on_revert_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = vault_underlying_token_account.key() == vault.underlying_token_account @ ErrorCode::InvalidVaultUnderlyingTokenAccount
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = conditional_on_finalize_token_mint
    )]
    pub user_conditional_on_finalize_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = conditional_on_revert_token_mint
    )]
    pub user_conditional_on_revert_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = vault.underlying_token_mint
    )]
    pub user_underlying_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RedeemConditionalTokensForUnderlyingTokens<'info> {
    #[account(
        has_one = conditional_on_finalize_token_mint @ ErrorCode::InvalidConditionalTokenMint,
        has_one = conditional_on_revert_token_mint @ ErrorCode::InvalidConditionalTokenMint,
        constraint = vault.status != VaultStatus::Active @ ErrorCode::CantRedeemConditionalTokens
    )]
    pub vault: Account<'info, ConditionalVault>,
    #[account(mut)]
    pub conditional_on_finalize_token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub conditional_on_revert_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = vault_underlying_token_account.key() == vault.underlying_token_account @ ErrorCode::InvalidVaultUnderlyingTokenAccount
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = conditional_on_finalize_token_mint
    )]
    pub user_conditional_on_finalize_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = conditional_on_revert_token_mint
    )]
    pub user_conditional_on_revert_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = vault.underlying_token_mint
    )]
    pub user_underlying_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient underlying token balance to mint this amount of conditional tokens")]
    InsufficientUnderlyingTokens,
    #[msg("This `vault_underlying_token_account` is not this vault's `underlying_token_account`")]
    InvalidVaultUnderlyingTokenAccount,
    #[msg("This conditional token mint is not this vault's conditional token mint")]
    InvalidConditionalTokenMint,
    #[msg("Vault needs to be settled as finalized before users can redeem conditional tokens for underlying tokens")]
    CantRedeemConditionalTokens,
    #[msg("Once a vault has been settled, its status as either finalized or reverted cannot be changed")]
    VaultAlreadySettled,
}
