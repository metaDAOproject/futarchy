use anchor_lang::prelude::*;

#[account]
pub struct MetaDao {
    pub members: Vec<Pubkey>, // TODO: add commons DAO
}

#[account]
pub struct MemberDAO {
    pub name: String, // 20 byte max
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum ProposalState {
    Pending,
    Passed,
    Failed,
}

#[account] // will eventually be split into a separate program, just here for testing
pub struct Proposal {
    pub proposal_number: u64,
    pub proposal_state: ProposalState,
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
