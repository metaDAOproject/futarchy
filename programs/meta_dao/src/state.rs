use anchor_lang::prelude::*;

#[account]
pub struct MetaDao {
    pub members: Vec<Pubkey>, // TODO: add commons DAO
}

#[account]
pub struct MemberDao {
    pub name: String, // 20 byte max
    pub proposal_counter: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum ProposalState {
    Pending,
    Passed,
    Failed,
}

#[account] 
pub struct Proposal {
    // Instructions to execute if proposal passes
    pub instruction: Vec<ProposalInstruction>,
    pub proposal_number: u64,
    pub proposal_state: ProposalState,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ProposalInstruction {
    pub program_id: Pubkey,
    pub accounts: Vec<ProposalAccount>,
    pub data: Vec<u8>,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ProposalAccount {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
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
    pub bump: u8,
}

#[account]
pub struct DepositAccount {
    pub conditional_vault: Pubkey,
    pub depositor: Pubkey,
    pub deposited_amount: u64,
}
