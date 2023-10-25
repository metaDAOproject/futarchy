use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_spl::token::Mint;
use openbook_v2::state::Market;
use openbook_twap::TWAPMarket;
use clob::state::order_book::OrderBook;
use conditional_vault::cpi::accounts::SettleConditionalVault;
use conditional_vault::program::ConditionalVault as ConditionalVaultProgram;
use conditional_vault::ConditionalVault as ConditionalVaultAccount;
use conditional_vault::VaultStatus;
use solana_program::instruction::Instruction;
#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;
use std::borrow::Borrow;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "autocrat_v0",
    project_url: "https://themetadao.org",
    contacts: "email:metaproph3t@protonmail.com",
    policy: "The market will decide whether we pay a bug bounty.",
    source_code: "https://github.com/metaDAOproject/meta-dao",
    source_release: "v0",
    auditors: "None",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("Ctt7cFZM6K7phtRo5NvjycpQju7X6QTSuqNen2ebXiuc");

// by default, the pass price needs to be 5% higher than the fail price
pub const DEFAULT_PASS_THRESHOLD_BPS: u16 = 500;

// start at 50 SOL ($1000 at current prices), decay by ~10 SOL per day
pub const DEFAULT_BASE_BURN_LAMPORTS: u64 = 50 * solana_program::native_token::LAMPORTS_PER_SOL;
pub const DEFAULT_BURN_DECAY_PER_SLOT_LAMPORTS: u64 = 46_300;

pub const MAX_BPS: u16 = 10_000;
pub const SLOTS_PER_10_SECS: u64 = 25;
pub const TEN_DAYS_IN_SLOTS: u64 = 10 * 24 * 60 * 6 * SLOTS_PER_10_SECS;

#[account]
pub struct DAO {
    pub meta_mint: Pubkey,
    pub usdc_mint: Pubkey,
    // the percentage, in basis points, the pass price needs to be above the
    // fail price in order for the proposal to pass
    pub pass_threshold_bps: u16,
    pub proposal_count: u32,
    // for anti-spam, proposers need to burn some SOL. the amount that they need
    // to burn is inversely proportional to the amount of time that has passed
    // since the last proposal.
    // burn_amount = base_lamport_burn - (lamport_burn_decay_per_slot * slots_passed)
    pub last_proposal_slot: u64,
    pub base_burn_lamports: u64,
    pub burn_decay_per_slot_lamports: u64,
    // treasury needed even though DAO is PDA for this reason: https://solana.stackexchange.com/questions/7667/a-peculiar-problem-with-cpis
    pub treasury_pda_bump: u8,
    pub treasury: Pubkey,
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub enum ProposalState {
    Pending,
    Passed,
    Failed,
}

#[account]
pub struct Proposal {
    pub number: u32,
    pub proposer: Pubkey,
    pub description_url: String,
    pub slot_enqueued: u64,
    pub state: ProposalState,
    pub instruction: ProposalInstruction,
    pub openbook_twap_pass_market: Pubkey,
    pub openbook_twap_fail_market: Pubkey,
    pub pass_market: Pubkey,
    pub fail_market: Pubkey,
    pub base_pass_vault: Pubkey,
    pub quote_pass_vault: Pubkey,
    pub base_fail_vault: Pubkey,
    pub quote_fail_vault: Pubkey,
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

        dao.meta_mint = ctx.accounts.meta_mint.key();
        dao.usdc_mint = ctx.accounts.usdc_mint.key();

        dao.pass_threshold_bps = DEFAULT_PASS_THRESHOLD_BPS;
        dao.base_burn_lamports = DEFAULT_BASE_BURN_LAMPORTS;
        dao.burn_decay_per_slot_lamports = DEFAULT_BURN_DECAY_PER_SLOT_LAMPORTS;

        let (treasury_pubkey, treasury_bump) =
            Pubkey::find_program_address(&[dao.key().as_ref()], ctx.program_id);
        dao.treasury_pda_bump = treasury_bump;
        dao.treasury = treasury_pubkey;

        Ok(())
    }

    pub fn initialize_proposal(
        ctx: Context<InitializeProposal>,
        description_url: String,
        instruction: ProposalInstruction,
    ) -> Result<()> {
        let pass_market = ctx.accounts.pass_market.load()?;
        let fail_market = ctx.accounts.fail_market.load()?;

        let openbook_pass_market = ctx.accounts.openbook_pass_market.load()?;
        let openbook_fail_market = ctx.accounts.openbook_fail_market.load()?;

        require!(
            pass_market.base == ctx.accounts.base_pass_vault.conditional_token_mint,
            AutocratError::InvalidMarket
        );
        require!(
            pass_market.quote == ctx.accounts.quote_pass_vault.conditional_token_mint,
            AutocratError::InvalidMarket
        );

        require!(
            openbook_pass_market.base_mint == ctx.accounts.base_pass_vault.conditional_token_mint,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_pass_market.quote_mint == ctx.accounts.quote_pass_vault.conditional_token_mint,
            AutocratError::InvalidMarket
        );
        // this should also be checked by `openbook_twap`, but why not take the
        // precaution?
        require!(
            openbook_pass_market.time_expiry == 0,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_pass_market.seq_num == 0,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_pass_market.taker_fee == 0,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_pass_market.maker_fee == 0,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_pass_market.base_lot_size == 1_000_000_000, // minimum tradeable = 1 META
            AutocratError::InvalidMarket
        );
        require!(
            openbook_pass_market.quote_lot_size == 100, // you can quote META in increments of a hundredth of a penny
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
        require!(
            openbook_fail_market.base_mint == ctx.accounts.base_fail_vault.conditional_token_mint,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_fail_market.quote_mint == ctx.accounts.quote_fail_vault.conditional_token_mint,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_fail_market.time_expiry == 0,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_fail_market.seq_num == 0,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_fail_market.taker_fee == 0,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_fail_market.maker_fee == 0,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_fail_market.base_lot_size == 1_000_000_000,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_pass_market.quote_lot_size == 100,
            AutocratError::InvalidMarket
        );

        let dao = &mut ctx.accounts.dao;
        let proposal = &mut ctx.accounts.proposal;

        proposal.number = dao.proposal_count;
        dao.proposal_count += 1;

        // least signficant 32 bits of nonce are proposal number
        // most significant bit of nonce is 0 for pass and 1 for fail
        // second most significant bit of nonce is 0 for base and 1 for quote
        require!(
            ctx.accounts.base_pass_vault.nonce == proposal.number as u64,
            AutocratError::InvalidVaultNonce
        );
        require!(
            ctx.accounts.quote_pass_vault.nonce == (proposal.number as u64 | (1 << 63)),
            AutocratError::InvalidVaultNonce
        );
        require!(
            ctx.accounts.base_fail_vault.nonce == proposal.number as u64 | (1 << 62),
            AutocratError::InvalidVaultNonce
        );
        require!(
            ctx.accounts.quote_fail_vault.nonce == (proposal.number as u64 | (1 << 63) | (1 << 62)),
            AutocratError::InvalidVaultNonce
        );

        proposal.quote_pass_vault = ctx.accounts.quote_pass_vault.key();
        proposal.base_pass_vault = ctx.accounts.base_pass_vault.key();
        proposal.quote_fail_vault = ctx.accounts.quote_fail_vault.key();
        proposal.base_fail_vault = ctx.accounts.base_fail_vault.key();

        let clock = Clock::get()?;

        let slots_passed = clock.slot - dao.last_proposal_slot;
        let burn_amount = dao.base_burn_lamports.saturating_sub(
            dao.burn_decay_per_slot_lamports
                .saturating_mul(slots_passed),
        );
        dao.last_proposal_slot = clock.slot;

        let lockup_ix = solana_program::system_instruction::transfer(
            &ctx.accounts.proposer.key(),
            &ctx.accounts.dao_treasury.key(),
            burn_amount,
        );

        solana_program::program::invoke(
            &lockup_ix,
            &[
                ctx.accounts.proposer.to_account_info(),
                ctx.accounts.dao_treasury.to_account_info(),
            ],
        )?;

        proposal.pass_market = ctx.accounts.pass_market.key();
        proposal.fail_market = ctx.accounts.fail_market.key();

        proposal.openbook_twap_pass_market = ctx.accounts.openbook_twap_pass_market.key();
        proposal.openbook_twap_fail_market = ctx.accounts.openbook_twap_fail_market.key();

        proposal.proposer = ctx.accounts.proposer.key();
        proposal.description_url = description_url;
        proposal.slot_enqueued = clock.slot;
        proposal.state = ProposalState::Pending;
        proposal.instruction = instruction;

        Ok(())
    }

    pub fn finalize_proposal(ctx: Context<FinalizeProposal>) -> Result<()> {
        // let pass_market = ctx.accounts.pass_market.load()?;
        // let fail_market = ctx.accounts.fail_market.load()?;

        let openbook_twap_pass_market = &ctx.accounts.openbook_twap_pass_market;
        let openbook_twap_fail_market = &ctx.accounts.openbook_twap_fail_market;

        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;

        require!(
            clock.slot >= proposal.slot_enqueued + TEN_DAYS_IN_SLOTS,
            AutocratError::ProposalTooYoung
        );

        require!(
            proposal.state == ProposalState::Pending,
            AutocratError::ProposalAlreadyFinalized
        );

        let dao_key = ctx.accounts.dao.key();
        let treasury_seeds = &[dao_key.as_ref(), &[ctx.accounts.dao.treasury_pda_bump]];
        let signer = &[&treasury_seeds[..]];

        let pass_market_aggregator = openbook_twap_pass_market.twap_oracle.observation_aggregator;
        let fail_market_aggregator = openbook_twap_fail_market.twap_oracle.observation_aggregator;

        assert!(pass_market_aggregator != 0);
        assert!(fail_market_aggregator != 0);

        let pass_market_slots_passed =
            openbook_twap_pass_market.twap_oracle.last_updated_slot - proposal.slot_enqueued;
        let fail_market_slots_passed =
            openbook_twap_fail_market.twap_oracle.last_updated_slot - proposal.slot_enqueued;


        require!(
            pass_market_slots_passed >= TEN_DAYS_IN_SLOTS,
            AutocratError::MarketsTooYoung
        );
        require!(
            fail_market_slots_passed >= TEN_DAYS_IN_SLOTS,
            AutocratError::MarketsTooYoung
        );

        let pass_market_twap = pass_market_aggregator / pass_market_slots_passed as u128;
        let fail_market_twap = fail_market_aggregator / fail_market_slots_passed as u128;

        assert!(pass_market_twap != 0);
        assert!(fail_market_twap != 0);

        let threshold = (fail_market_twap
            * (MAX_BPS + ctx.accounts.dao.pass_threshold_bps) as u128)
            / MAX_BPS as u128;

        if pass_market_twap > threshold {
            proposal.state = ProposalState::Passed;

            let mut svm_instruction: Instruction = proposal.instruction.borrow().into();
            for acc in svm_instruction.accounts.iter_mut() {
                if &acc.pubkey == ctx.accounts.dao_treasury.key {
                    acc.is_signer = true;
                }
            }

            solana_program::program::invoke_signed(
                &svm_instruction,
                ctx.remaining_accounts,
                signer,
            )?;

            for (vault, new_state) in [
                (
                    ctx.accounts.base_pass_vault.to_account_info(),
                    VaultStatus::Finalized,
                ),
                (
                    ctx.accounts.quote_pass_vault.to_account_info(),
                    VaultStatus::Finalized,
                ),
                (
                    ctx.accounts.base_fail_vault.to_account_info(),
                    VaultStatus::Reverted,
                ),
                (
                    ctx.accounts.quote_fail_vault.to_account_info(),
                    VaultStatus::Reverted,
                ),
            ] {
                let vault_program = ctx.accounts.vault_program.to_account_info();
                let cpi_accounts = SettleConditionalVault {
                    settlement_authority: ctx.accounts.dao_treasury.to_account_info(),
                    vault,
                };
                let cpi_ctx = CpiContext::new(vault_program, cpi_accounts).with_signer(signer);
                conditional_vault::cpi::settle_conditional_vault(cpi_ctx, new_state)?;
            }
        } else {
            proposal.state = ProposalState::Failed;

            for (vault, new_state) in [
                (
                    ctx.accounts.base_pass_vault.to_account_info(),
                    VaultStatus::Reverted,
                ),
                (
                    ctx.accounts.quote_pass_vault.to_account_info(),
                    VaultStatus::Reverted,
                ),
                (
                    ctx.accounts.base_fail_vault.to_account_info(),
                    VaultStatus::Finalized,
                ),
                (
                    ctx.accounts.quote_fail_vault.to_account_info(),
                    VaultStatus::Finalized,
                ),
            ] {
                let vault_program = ctx.accounts.vault_program.to_account_info();
                let cpi_accounts = SettleConditionalVault {
                    settlement_authority: ctx.accounts.dao_treasury.to_account_info(),
                    vault,
                };
                let cpi_ctx = CpiContext::new(vault_program, cpi_accounts).with_signer(signer);
                conditional_vault::cpi::settle_conditional_vault(cpi_ctx, new_state)?;
            }
        }

        Ok(())
    }

    pub fn set_pass_threshold_bps(ctx: Context<Auth>, pass_threshold_bps: u16) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        dao.pass_threshold_bps = pass_threshold_bps;

        Ok(())
    }

    pub fn set_last_proposal_slot(ctx: Context<Auth>, last_proposal_slot: u64) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        dao.last_proposal_slot = last_proposal_slot;

        Ok(())
    }

    pub fn set_base_burn_lamports(ctx: Context<Auth>, base_burn_lamports: u64) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        dao.base_burn_lamports = base_burn_lamports;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeDAO<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<DAO>(),
        // We will create a civilization of the Mind in Cyberspace. May it be
        // more humane and fair than the world your governments have made before.
        //  - John Perry Barlow, A Declaration of the Independence of Cyberspace
        seeds = [b"WWCACOTMICMIBMHAFTTWYGHMB"], 
        bump
    )]
    pub dao: Account<'info, DAO>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    #[account(mint::decimals = 9)]
    pub meta_mint: Account<'info, Mint>,
    #[account(mint::decimals = 6)]
    pub usdc_mint: Account<'info, Mint>,
}

#[derive(Accounts)]
pub struct InitializeProposal<'info> {
    #[account(zero, signer)]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut)]
    pub dao: Account<'info, DAO>,
    /// CHECK: never read
    #[account(
        seeds = [dao.key().as_ref()],
        bump = dao.treasury_pda_bump,
        mut
    )]
    pub dao_treasury: UncheckedAccount<'info>,
    #[account(
        constraint = quote_pass_vault.underlying_token_mint == dao.usdc_mint,
        constraint = quote_pass_vault.settlement_authority == dao.treasury @ AutocratError::InvalidSettlementAuthority,
    )]
    pub quote_pass_vault: Account<'info, ConditionalVaultAccount>,
    #[account(
        constraint = quote_fail_vault.underlying_token_mint == dao.usdc_mint,
        constraint = quote_fail_vault.settlement_authority == dao.treasury @ AutocratError::InvalidSettlementAuthority,
    )]
    pub quote_fail_vault: Account<'info, ConditionalVaultAccount>,
    #[account(
        constraint = base_pass_vault.underlying_token_mint == dao.meta_mint,
        constraint = base_pass_vault.settlement_authority == dao.treasury @ AutocratError::InvalidSettlementAuthority,
    )]
    pub base_pass_vault: Account<'info, ConditionalVaultAccount>,
    #[account(
        constraint = base_fail_vault.underlying_token_mint == dao.meta_mint,
        constraint = base_fail_vault.settlement_authority == dao.treasury @ AutocratError::InvalidSettlementAuthority,
    )]
    pub base_fail_vault: Account<'info, ConditionalVaultAccount>,
    pub openbook_pass_market: AccountLoader<'info, Market>,
    pub openbook_fail_market: AccountLoader<'info, Market>,
    #[account(constraint = openbook_twap_pass_market.market == openbook_pass_market.key())]
    pub openbook_twap_pass_market: Account<'info, TWAPMarket>,
    #[account(constraint = openbook_twap_fail_market.market == openbook_fail_market.key())]
    pub openbook_twap_fail_market: Account<'info, TWAPMarket>,
    pub pass_market: AccountLoader<'info, OrderBook>,
    pub fail_market: AccountLoader<'info, OrderBook>,
    #[account(mut)]
    pub proposer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeProposal<'info> {
    #[account(mut, has_one = pass_market, has_one = fail_market, has_one = proposer,
        has_one = quote_pass_vault,
        has_one = quote_fail_vault,
        has_one = base_pass_vault,
        has_one = base_fail_vault,
        has_one = openbook_twap_pass_market,
        has_one = openbook_twap_fail_market,
    )]
    pub proposal: Account<'info, Proposal>,
    pub openbook_twap_pass_market: Account<'info, TWAPMarket>,
    pub openbook_twap_fail_market: Account<'info, TWAPMarket>,
    pub pass_market: AccountLoader<'info, OrderBook>,
    pub fail_market: AccountLoader<'info, OrderBook>,
    pub dao: Box<Account<'info, DAO>>,
    #[account(mut)]
    pub quote_pass_vault: Box<Account<'info, ConditionalVaultAccount>>,
    #[account(mut)]
    pub quote_fail_vault: Box<Account<'info, ConditionalVaultAccount>>,
    #[account(mut)]
    pub base_pass_vault: Box<Account<'info, ConditionalVaultAccount>>,
    #[account(mut)]
    pub base_fail_vault: Box<Account<'info, ConditionalVaultAccount>>,
    pub vault_program: Program<'info, ConditionalVaultProgram>,
    /// CHECK: never read
    #[account(
        seeds = [dao.key().as_ref()],
        bump = dao.treasury_pda_bump,
        mut
    )]
    pub dao_treasury: UncheckedAccount<'info>,
    pub proposer: Signer<'info>,
}

#[derive(Accounts)]
pub struct Auth<'info> {
    #[account(mut)]
    pub dao: Account<'info, DAO>,
    /// CHECK: never read
    pub dao_treasury: Signer<'info>,
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
    #[msg("Markets too young for proposal to be finalized")]
    MarketsTooYoung,
    #[msg("The market dictates that this proposal cannot pass")]
    ProposalCannotPass,
    #[msg("This proposal has already been finalized")]
    ProposalAlreadyFinalized,
    #[msg("A conditional vault has an invalid nonce. A nonce should encode pass = 0 / fail = 1 in its most significant bit, base = 0 / quote = 1 in its second most significant bit, and the proposal number in least significant 32 bits")]
    InvalidVaultNonce,
}
