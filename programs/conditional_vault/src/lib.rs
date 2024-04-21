use anchor_lang::prelude::*;
use anchor_spl::metadata::{
    create_metadata_accounts_v3, CreateMetadataAccountsV3, Metadata, MetadataAccount,
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer},
};
use mpl_token_metadata::state::DataV2;

pub mod state;
pub mod instructions;

pub use state::*;
pub use instructions::*;

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

#[program]
pub mod conditional_vault {
    use super::*;

    pub fn initialize_conditional_vault(
        ctx: Context<InitializeConditionalVault>,
        settlement_authority: Pubkey,
        proposal: Pubkey,
    ) -> Result<()> {
        InitializeConditionalVault::handle(ctx, settlement_authority, proposal)
    }

    pub fn add_metadata_to_conditional_tokens(
        ctx: Context<AddMetadataToConditionalTokens>,
        proposal_number: u64,
        on_finalize_uri: String,
        on_revert_uri: String,
    ) -> Result<()> {
        AddMetadataToConditionalTokens::handle(ctx, proposal_number, on_finalize_uri, on_revert_uri)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn settle_conditional_vault(
        ctx: Context<SettleConditionalVault>,
        new_status: VaultStatus,
    ) -> Result<()> {
        SettleConditionalVault::handle(ctx, new_status)
    }

    #[access_control(ctx.accounts.validate_merge_conditional_tokens())]
    pub fn merge_conditional_tokens_for_underlying_tokens(
        ctx: Context<InteractWithVault>,
        amount: u64,
    ) -> Result<()> {
        InteractWithVault::handle_merge_conditional_tokens(ctx, amount)
    }

    pub fn mint_conditional_tokens(ctx: Context<InteractWithVault>, amount: u64) -> Result<()> {
        InteractWithVault::handle_mint_conditional_tokens(ctx, amount)
    }

    #[access_control(ctx.accounts.validate_redeem_conditional_tokens())]
    pub fn redeem_conditional_tokens_for_underlying_tokens(
        ctx: Context<InteractWithVault>,
    ) -> Result<()> {
        InteractWithVault::handle_redeem_conditional_tokens(ctx)
    }
}

#[error_code]
pub enum VaultError {
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
