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
/// Questions have 2 or more possible outcomes. For a question like "will this
/// proposal pass," the outcomes are "yes" and "no." For a question like "who
/// will be hired," the outcomes could be "Alice," "Bob," and "neither." 
///
/// Outcomes resolve to a number between 0 and 1. Binary questions like "will
/// this proposal pass" have outcomes that resolve to exactly 0 or 1. You can
/// also have questions with scalar outcomes. For example, the question "how
/// effective will the grant committee deem this grant" could have two outcomes:
/// "ineffective" and "effective." If the grant committee deems the grant 70%
/// effective, the "effective" outcome would resolve to 0.7 and the "ineffective"
/// outcome would resolve to 0.3.
/// 
/// Once resolved, the sum of all outcome resolutions is exactly 1.
#[account]
pub struct Question {
    pub question_id: [u8; 32],
    pub oracle: Pubkey,
    pub payout_numerators: Vec<u32>,
    pub payout_denominator: u32,
}

impl Question {
    pub fn num_outcomes(&self) -> usize {
        self.payout_numerators.len()
    }

    pub fn is_resolved(&self) -> bool {
        self.payout_denominator != 0
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
