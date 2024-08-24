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

impl NewConditionalVault {
    /// Checks that the vault's assets are always greater than its potential
    /// liabilities. Should be called anytime you mint or burn conditional
    /// tokens.
    ///
    /// `conditional_token_supplies` should be in the same order as
    /// `vault.conditional_token_mints`.
    pub fn invariant(
        &self,
        question: &Question,
        conditional_token_supplies: Vec<u64>,
        vault_underlying_balance: u64,
    ) -> Result<()> {
        // if the question isn't resolved, the vault should have more underlying
        // tokens than ANY conditional token mint's supply

        // if the question is resolved, the vault should have more underlying
        // tokens than the sum of the conditional token mint's supplies multiplied
        // by their respective payouts

        let max_possible_liability = if !question.is_resolved() {
            // safe because conditional_token_supplies is non-empty
            *conditional_token_supplies.iter().max().unwrap()
        } else {
            conditional_token_supplies
                .iter()
                .enumerate()
                .map(|(i, supply)| {
                    *supply * question.payout_numerators[i] as u64 / question.payout_denominator as u64
                })
                .sum::<u64>()
        };

        assert!(vault_underlying_balance >= max_possible_liability);

        Ok(())
    }
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