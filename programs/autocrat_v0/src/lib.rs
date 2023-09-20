use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_spl::token::Mint;
use solana_program::instruction::Instruction;
// use conditional_vault::program::ConditionalVault;
use clob::state::order_book::OrderBook;
use conditional_vault::ConditionalVault as ConditionalVaultAccount;
use std::borrow::Borrow;

// by default, the pass price needs to be 20% higher than the fail price
pub const DEFAULT_PASS_THRESHOLD_BPS: u16 = 2_000;
pub const MAX_BPS: u16 = 10_000;
pub const SLOTS_PER_10_SECS: u64 = 25;
pub const TEN_DAYS_IN_SLOTS: u64 = 10 * 24 * 60 * 6 * SLOTS_PER_10_SECS;

pub use wsol::ID as WSOL;
mod wsol {
    use super::*;
    declare_id!("So11111111111111111111111111111111111111112");
}

declare_id!("5QBbGKFSoL1hS4s5dsCBdNRVnJcMuHXFwhooKk2ar25S");

#[account]
pub struct DAO {
    pub token: Pubkey,
    // the percentage, in basis points, the pass price needs to be above the
    // fail price in order for the proposal to pass
    pub pass_threshold_bps: u16,
    pub pda_bump: u8,
}

#[account]
pub struct Proposal {
    pub slot_enqueued: u64,
    pub did_execute: bool,
    pub instruction: ProposalInstruction,
    pub pass_market: Pubkey,
    pub fail_market: Pubkey,
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

#[program]
pub mod autocrat_v0 {
    use super::*;

    pub fn initialize_dao(ctx: Context<InitializeDAO>) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        dao.token = ctx.accounts.token.key();
        dao.pass_threshold_bps = DEFAULT_PASS_THRESHOLD_BPS;
        dao.pda_bump = *ctx.bumps.get("dao").unwrap();

        Ok(())
    }

    pub fn initialize_proposal(
        ctx: Context<InitializeProposal>,
        instruction: ProposalInstruction,
    ) -> Result<()> {
        // TODO: add some staking mechanism as an anti-spam mechanism, you put in like 1000
        // USDC or something
        let pass_market = ctx.accounts.pass_market.load()?;
        let fail_market = ctx.accounts.fail_market.load()?;

        require!(
            pass_market.base == ctx.accounts.base_pass_vault.conditional_token_mint,
            AutocratError::InvalidMarket
        );
        require!(
            pass_market.quote == ctx.accounts.quote_pass_vault.conditional_token_mint,
            AutocratError::InvalidMarket
        );

        require!(
            fail_market.base == ctx.accounts.base_fail_vault.conditional_token_mint,
            AutocratError::InvalidMarket
        );
        require!(
            fail_market.quote == ctx.accounts.quote_fail_vault.conditional_token_mint,
            AutocratError::InvalidMarket
        );

        let proposal = &mut ctx.accounts.proposal;

        let (quote_pass_settlement_authority, _) =
            Pubkey::find_program_address(&[proposal.key().as_ref(), b"quote_pass"], &self::ID);
        let (base_pass_settlement_authority, _) =
            Pubkey::find_program_address(&[proposal.key().as_ref(), b"base_pass"], &self::ID);
        let (quote_fail_settlement_authority, _) =
            Pubkey::find_program_address(&[proposal.key().as_ref(), b"quote_fail"], &self::ID);
        let (base_fail_settlement_authority, _) =
            Pubkey::find_program_address(&[proposal.key().as_ref(), b"base_fail"], &self::ID);

        require!(
            ctx.accounts.quote_pass_vault.settlement_authority == quote_pass_settlement_authority,
            AutocratError::InvalidSettlementAuthority
        );
        require!(
            ctx.accounts.base_pass_vault.settlement_authority == base_pass_settlement_authority,
            AutocratError::InvalidSettlementAuthority
        );
        require!(
            ctx.accounts.quote_fail_vault.settlement_authority == quote_fail_settlement_authority,
            AutocratError::InvalidSettlementAuthority
        );
        require!(
            ctx.accounts.base_fail_vault.settlement_authority == base_fail_settlement_authority,
            AutocratError::InvalidSettlementAuthority
        );

        let clock = Clock::get()?;

        proposal.pass_market = ctx.accounts.pass_market.key();
        proposal.fail_market = ctx.accounts.fail_market.key();

        proposal.slot_enqueued = clock.slot;
        proposal.did_execute = false;
        proposal.instruction = instruction;

        Ok(())
    }

    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let pass_market = ctx.accounts.pass_market.load()?;
        let fail_market = ctx.accounts.fail_market.load()?;

        let proposal = &ctx.accounts.proposal;
        let clock = Clock::get()?;

        require!(
            clock.slot >= proposal.slot_enqueued + TEN_DAYS_IN_SLOTS,
            AutocratError::ProposalTooYoung
        );

        let pass_market_aggregator = pass_market.twap_oracle.observation_aggregator;
        let fail_market_aggregator = fail_market.twap_oracle.observation_aggregator;

        let pass_market_slots_passed =
            pass_market.twap_oracle.last_updated_slot - proposal.slot_enqueued;
        let fail_market_slots_passed =
            fail_market.twap_oracle.last_updated_slot - proposal.slot_enqueued;

        let pass_market_twap = (pass_market_aggregator / pass_market_slots_passed as u128) as u64;
        let fail_market_twap = (fail_market_aggregator / fail_market_slots_passed as u128) as u64;

        // TODO: change this to have the threshold involved. deal with overflow
        require!(
            pass_market_twap > fail_market_twap,
            AutocratError::ProposalCannotPass
        );

        let svm_instruction: Instruction = proposal.instruction.borrow().into();

        let seeds = &[
            b"WWCACOTMICMIBMHAFTTWYGHMB".as_ref(),
            &[ctx.accounts.dao.pda_bump],
        ];
        let signer = &[&seeds[..]];

        solana_program::program::invoke_signed(&svm_instruction, ctx.remaining_accounts, signer)?;

        Ok(())
    }

    pub fn set_pass_threshold_bps(ctx: Context<Auth>, pass_threshold_bps: u16) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        dao.pass_threshold_bps = pass_threshold_bps;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeDAO<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 2 + 1,
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
    pub dao: Account<'info, DAO>,
    #[account(
        constraint = quote_pass_vault.underlying_token_mint == dao.token,
    )]
    pub quote_pass_vault: Account<'info, ConditionalVaultAccount>,
    #[account(
        constraint = quote_fail_vault.underlying_token_mint == dao.token,
    )]
    pub quote_fail_vault: Account<'info, ConditionalVaultAccount>,
    #[account(
        constraint = base_pass_vault.underlying_token_mint == WSOL,
    )]
    pub base_pass_vault: Account<'info, ConditionalVaultAccount>,
    #[account(
        constraint = base_fail_vault.underlying_token_mint == WSOL,
    )]
    pub base_fail_vault: Account<'info, ConditionalVaultAccount>,
    pub pass_market: AccountLoader<'info, OrderBook>,
    pub fail_market: AccountLoader<'info, OrderBook>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(has_one = pass_market, has_one = fail_market)]
    pub proposal: Account<'info, Proposal>,
    pub pass_market: AccountLoader<'info, OrderBook>,
    pub fail_market: AccountLoader<'info, OrderBook>,
    //#[account(mut)]
    pub dao: Account<'info, DAO>,
}

#[derive(Accounts)]
pub struct Auth<'info> {
    #[account(mut, signer)]
    pub dao: Account<'info, DAO>,
}

impl From<&ProposalInstruction> for Instruction {
    fn from(ix: &ProposalInstruction) -> Self {
        Self {
            program_id: ix.program_id,
            data: ix.data.clone(),
            accounts: ix.accounts.iter().map(Into::into).collect(),
        }
    }
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

#[error_code]
pub enum AutocratError {
    #[msg(
        "Either the `pass_market` or the `fail_market`'s tokens doesn't match the vaults supplied"
    )]
    InvalidMarket,
    #[msg("One of the vaults has an invalid `settlement_authority`")]
    InvalidSettlementAuthority,
    #[msg("Proposal is too young to be executed or rejected")]
    ProposalTooYoung,
    #[msg("The market dictates that this proposal cannot pass")]
    ProposalCannotPass,
}
