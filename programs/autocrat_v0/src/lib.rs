use anchor_lang::prelude::*;

use anchor_spl::token::{Mint, Token};

// by default, the pass price needs to be 20% higher than the fail price
pub const DEFAULT_PASS_THRESHOLD_BPS: u16 = 2000;

declare_id!("5QBbGKFSoL1hS4s5dsCBdNRVnJcMuHXFwhooKk2ar25S");

#[account]
pub struct DAO {
    pub token: Pubkey,
    // the percentage, in basis points, the pass price needs to be above the
    // fail price in order for the proposal to pass
    pub pass_threshold_bps: u16,
}

#[account]
pub struct Proposal {
    pub did_execute: bool,
    pub instructions: Vec<ProposalInstruction>,
    pub accounts: Vec<ProposalAccount>,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ProposalInstruction {
    pub program_id: Pubkey,
    // Accounts to pass to the target program, stored as
    // indexes into the `proposal.accounts` vector.
    pub accounts: Vec<u8>,
    pub data: Vec<u8>,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct ProposalAccount {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}

#[program]
pub mod autocrat_v0 {
    use super::*;

    pub fn initialize_dao(ctx: Context<InitializeDAO>) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        dao.token = ctx.accounts.token.key();
        dao.pass_threshold_bps = DEFAULT_PASS_THRESHOLD_BPS;

        Ok(())
    }

    pub fn initialize_proposal(
        ctx: Context<InitializeProposal>,
        instructions: Vec<ProposalInstruction>,
        accts: Vec<ProposalAccount>,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        proposal.did_execute = false;
        proposal.instructions = instructions;
        proposal.accounts = accts;

        Ok(())
    }

    pub fn set_pass_threshold_bps(ctx: Context<Auth>, pass_threshold_bps: u16) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeDAO<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 2,
        seeds = [b"WWCACOTMICMIBMHAFTTWYGHMB"], // abbreviation of the last two sentences of the Declaration of Independence of Cyberspace
        bump
    )]
    pub dao: Account<'info, DAO>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(mint::decimals = 9)]
    pub token: Account<'info, Mint>,
}

#[derive(Accounts)]
pub struct InitializeProposal<'info> {
    #[account(zero)]
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Auth<'info> {
    #[account(
        // signer @ ErrorCode::UnauthorizedFunctionCall,
        mut
    )]
    pub dao: Account<'info, DAO>,
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
