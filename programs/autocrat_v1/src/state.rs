use super::*;

// use ProposalStatus::*;

#[account]
pub struct MetaDAO {
    pub members: Vec<Pubkey>,
}

#[account]
pub struct Member {
    pub name: String,
    pub pda_bump: u8,
    pub token_mint: Pubkey,
}

#[account]
pub struct Proposal {
    pub status: ProposalStatus,
    pub instructions: Vec<ProposalInstruction>,
    pub accounts: Vec<ProposalAccount>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Passed,
    Failed,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ProposalInstruction {
    pub program_id: Pubkey,
    // Accounts to pass to the target program, stored as
    // indexes into the `proposal.accounts` vector.
    pub accounts: Vec<u8>,
    pub data: Vec<u8>,
    // Configures which account will sign this instruction.
    pub signer: ProposalSigner,
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
