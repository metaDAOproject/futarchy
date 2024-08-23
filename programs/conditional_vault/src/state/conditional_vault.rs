use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VaultStatus {
    Active,
    Finalized,
    Reverted,
}

#[account]
pub struct NewConditionalVault {
    pub question: Pubkey,
    pub underlying_token_mint: Pubkey,
    pub underlying_token_account: Pubkey,
    pub conditional_token_mints: Vec<Pubkey>,
    pub pda_bump: u8,
    pub decimals: u8,
}

#[macro_export]
macro_rules! generate_new_vault_seeds {
    ($vault:expr) => {{
        &[
            b"conditional_vault",
            $vault.question.as_ref(),
            $vault.underlying_token_mint.as_ref(),
            &[$vault.pda_bump],
        ]
    }};
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
    /// The vault's storage account for deposited funds.
    pub underlying_token_account: Pubkey,
    pub conditional_on_finalize_token_mint: Pubkey,
    pub conditional_on_revert_token_mint: Pubkey,
    pub pda_bump: u8,
    pub decimals: u8,
}

#[macro_export]
macro_rules! generate_vault_seeds {
    ($vault:expr) => {{
        &[
            b"conditional_vault",
            $vault.settlement_authority.as_ref(),
            $vault.underlying_token_mint.as_ref(),
            &[$vault.pda_bump],
        ]
    }};
}
