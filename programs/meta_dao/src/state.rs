use super::*;

#[account]
pub struct MetaDAO {
    pub members: Vec<Pubkey>,
}

#[account]
pub struct Member {
    // Name of this member. 20 byte max.
    pub name: String,
    // Bump used to derive this PDA.
    pub treasury_bump: u8,
    // SPL mint of this member's token.
    pub token_mint: Pubkey,
}

#[account]
pub struct Proposal {
    pub state: ProposalState,
    pub instructions: Vec<ProposalInstruction>,
    pub accounts: Vec<ProposalAccount>,
}

// TODO: rename `ProposalState` to `ProposalStatus`
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum ProposalState {
    Pending,
    Passed,
    Failed,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ProposalInstruction {
    // Configures which account will sign this instruction
    pub signer: ProposalSigner,
    // Program ID of target program
    pub program_id: Pubkey,
    // Accounts to pass to the target program, stored as
    // indexes into the `proposal.accounts` vector
    pub account_indexes: Vec<u8>,
    // Data to pass to target program
    pub data: Vec<u8>,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ProposalSigner {
    pub kind: ProposalSignerKind,
    pub pubkey: Pubkey,
    pub pda_bump: u8,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub enum ProposalSignerKind {
    MetaDAO,
    Member,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ProposalAccount {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}

impl From<&ProposalAccount> for AccountMeta {
    fn from(acc: &ProposalAccount) -> Self {
        Self {
            pubkey: acc.pubkey,
            is_signer: acc.is_signer,
            is_writable: acc.is_writable,
        }
    }
}

#[account]
pub struct ConditionalExpression {
    pub proposal: Pubkey,
    pub pass_or_fail_flag: bool, // true for tokens that are redeemable-on-pass, false for tokens that are redeemable-on-fail
}

#[account]
pub struct ConditionalVault {
    pub conditional_expression: Pubkey,
    pub underlying_token_mint: Pubkey,
    pub underlying_token_account: Pubkey,
    pub conditional_token_mint: Pubkey,
    pub pda_bump: u8,
}

#[account]
pub struct VaultDepositSlip {
    pub conditional_vault: Pubkey,
    pub user: Pubkey,
    pub deposited_amount: u64,
}
