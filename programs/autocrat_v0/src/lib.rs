use anchor_lang::prelude::*;

use anchor_spl::{
    token::{Mint, Token},
};

declare_id!("5QBbGKFSoL1hS4s5dsCBdNRVnJcMuHXFwhooKk2ar25S");

#[account]
pub struct DAO {
    pub token: Pubkey,
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

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeDAO<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32,
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

impl From<&ProposalAccount> for AccountMeta {
    fn from(acc: &ProposalAccount) -> Self {
        Self {
            pubkey: acc.pubkey,
            is_signer: acc.is_signer,
            is_writable: acc.is_writable,
        }
    }
}
