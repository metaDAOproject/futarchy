use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VaultStatus {
    Active,
    Finalized,
    Reverted,
}

/// Questions represent statements about future events.
///
/// These statements include:
/// - "Will this proposal pass?"
/// - "Who, if anyone, will be hired?"
/// - "How effective will the grant committee deem this grant?"
///
/// Questions have 2 or more conditions. For example, these conditions could be
/// "this proposal passes" and "this proposal fails" or "the committee deems this
/// grant effective" and "the committee deems this grant ineffective."
///
/// Conditions resolve to a number between 0 and 1. Binary conditions like "will
/// this proposal pass" resolve to exactly 0 or 1. You can also have scalar
/// conditions. For example, the condition "the grant committee deems this grant
/// effective" could resolve to 0.5 if the committee finds the grant partially
/// effective. Once resolved, the sum of all condition resolutions is exactly 1.
#[account]
pub struct Question {
    pub is_resolved: bool,
    pub oracle: Pubkey,
    pub payout_numerators: Vec<u32>,
    pub payout_denominator: u32,
}

impl Question {
    pub fn num_conditions(&self) -> usize {
        self.payout_numerators.len()
    }
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
