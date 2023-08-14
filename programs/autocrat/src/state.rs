use super::*;

use PassOrFail::*;
use ProposalStatus::*;

#[account]
pub struct MetaDAO {
    pub members: Vec<Pubkey>,
}

#[account]
pub struct Member {
    // Name of this member.
    pub name: String,
    // Bump used to derive this member's treasury.
    pub treasury_pda_bump: u8,
    // SPL mint of this member's token.
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
    // Program ID of target program.
    pub program_id: Pubkey,
    // Accounts to pass to the target program, stored as
    // indexes into the `proposal.accounts` vector.
    pub accounts: Vec<u8>,
    // Data to pass to target program.
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

/// We can think of conditional expressions in the following form:
/// "proposal {proposal} will {pass_or_fail}". For example, given a
/// proposal 123, a possible expression is "proposal 123 will pass."
/// Then, if proposal 123 passes, the expression will evaluate to true.
///
/// Because the "proposal ... will" part of the expression is unchanging,
/// we only need to store a reference to the proposal and a choice between
/// pass and fail. The rest is implied.
///
/// While a proposal is still pending, any conditional expressions that
/// reference it are not evaluatable.
#[account]
pub struct ConditionalExpression {
    pub proposal: Pubkey,
    pub pass_or_fail: PassOrFail,
}

impl ConditionalExpression {
    pub fn evaluate(&self, current_proposal_status: ProposalStatus) -> Result<bool> {
        match current_proposal_status {
            Pending => err!(ErrorCode::ConditionalExpressionNotEvaluatable),
            Passed => Ok(self.pass_or_fail == Pass),
            Failed => Ok(self.pass_or_fail == Fail),
        }
    }
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq)]
pub enum PassOrFail {
    Pass = 1,
    Fail = 0,
}

