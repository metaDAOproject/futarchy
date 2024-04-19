//! The orchestrator of a futarchy. Equivalent to the 'governor' of Compound's
//! governance system.
//!
//! Autocrat has two types of accounts: DAOs and proposals. Every DAO has its
//! own token, its own treasury account, and list of configs. Proposals are
//! created for a specific DAO, and contain an SVM instruction and a URL that
//! should point to a description and justification of that instruction.
//!
//! Proposals pass through various states in their lifecycle. Here's a description
//! of these states:
//! - Pre-creation: this is when you initialize the accounts needed for a proposal,
//!   including the vaults and the AMM accounts. The proposer will also deposit to
//!   create their LP during this time.
//! - Price discovery: to create a proposal, the proposer must call
//!   `initialize_proposal`, which requires them to lock up some LP tokens in each
//!   of the markets. Once a proposal is created, anyone can trade its markets. But
//!   its market prices don't get included in the proposal's TWAP.
//! - TWAP recording: after some period of time, such as a day, has passed, there
//!   is a smaller period of time, such as an hour, for market prices to be recorded
//!   into a TWAP. This is so that market participants can be informed ahead of time
//!   when the TWAP recording will occur and a malicious actor can't slip in some TWAP
//!   manipulation while noone is paying attention.
//! - Pass or fail: if the TWAP of the pass market is sufficiently higher than the
//!   TWAP of the fail market, the proposal will pass. If it's not, the proposal will
//!   fail. If it passes, both vaults will be finalized, allowing pTOKEN holders to
//!   redeem. If it fails, both vaults will be reverted, allowing fTOKEN holders to
//!   redeem.
//! - Executed: if a proposal passes, anyone can make autocrat execute its SVM
//!   instruction by calling `execute_proposal`.
use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_spl::token::Mint;
use conditional_vault::cpi::accounts::SettleConditionalVault;
use conditional_vault::program::ConditionalVault as ConditionalVaultProgram;
use conditional_vault::ConditionalVault as ConditionalVaultAccount;
use conditional_vault::VaultStatus;

use amm::state::Amm;

use openbook_twap::TWAPMarket;
use openbook_v2::state::Market;
use solana_program::instruction::Instruction;
#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;
use std::borrow::Borrow;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "autocrat",
    project_url: "https://themetadao.org",
    contacts: "email:metaproph3t@protonmail.com",
    policy: "The market will decide whether we pay a bug bounty.",
    source_code: "https://github.com/metaDAOproject/futarchy",
    source_release: "v1",
    auditors: "None",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("FuTPR6ScKMPHtZFwacq9qrtf9VjscawNEFTb2wSYr1gY");

pub const SLOTS_PER_10_SECS: u64 = 25;
pub const THREE_DAYS_IN_SLOTS: u64 = 3 * 24 * 60 * 6 * SLOTS_PER_10_SECS;

pub const TEN_DAYS_IN_SECONDS: i64 = 10 * 24 * 60 * 60;

// by default, the pass price needs to be 3% higher than the fail price
pub const DEFAULT_PASS_THRESHOLD_BPS: u16 = 300;

// start at 10 SOL ($600 at current prices), decay by ~5 SOL per day
pub const DEFAULT_BASE_BURN_LAMPORTS: u64 = 10 * solana_program::native_token::LAMPORTS_PER_SOL;
pub const DEFAULT_BURN_DECAY_PER_SLOT_LAMPORTS: u64 = 23_150;

pub const MAX_BPS: u16 = 10_000;

// TWAP can only move by $5 per slot
pub const DEFAULT_MAX_OBSERVATION_CHANGE_PER_UPDATE_LOTS: u64 = 5_000;

#[account]
pub struct DAO {
    pub treasury_pda_bump: u8,
    pub treasury: Pubkey,
    pub token_mint: Pubkey,
    pub usdc_mint: Pubkey,
    pub proposal_count: u32,
    pub last_proposal_slot: u64,
    // the percentage, in basis points, the pass price needs to be above the
    // fail price in order for the proposal to pass
    pub pass_threshold_bps: u16,
    // for anti-spam, proposers need to burn some SOL. the amount that they need
    // to burn is inversely proportional to the amount of time that has passed
    // since the last proposal.
    // burn_amount = base_lamport_burn - (lamport_burn_decay_per_slot * slots_passed)
    pub base_burn_lamports: u64,
    pub burn_decay_per_slot_lamports: u64,
    pub slots_per_proposal: u64,
    pub market_taker_fee: i64,
    // the TWAP can only move by a certain amount per update, so it needs to start at
    // a value. that's `twap_expected_value`, and it's in base lots divided by quote lots.
    // so if you expect your token to trade around $1, your token has 9 decimals and a base_lot_size
    // of 1_000_000_000, your `twap_expected_value` could be 10_000 (10,000 hundredths of pennies = $1).
    pub twap_expected_value: u64,
    pub max_observation_change_per_update_lots: u64,
    // amount of base tokens that constitute a lot. for example, if TOKEN has
    // 9 decimals, then if lot size was 1_000_000_000 you could trade in increments
    // of 1 TOKEN. ideally, you want to pick a lot size where each lot is worth $1 - $10.
    // this balances spam-prevention with allowing users to trade small amounts.
    pub base_lot_size: i64,
}

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub enum ProposalState {
    Pending,
    Passed,
    Failed,
    Executed,
}

#[account]
pub struct Proposal {
    pub number: u32,
    pub proposer: Pubkey,
    pub description_url: String,
    pub slot_enqueued: u64,
    pub state: ProposalState,
    pub instruction: ProposalInstruction,
    pub pass_amm: Pubkey,
    pub fail_amm: Pubkey,
    pub amm_nonce: u64,
    pub openbook_twap_pass_market: Pubkey,
    pub openbook_twap_fail_market: Pubkey,
    pub openbook_pass_market: Pubkey,
    pub openbook_fail_market: Pubkey,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub dao: Pubkey,
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
pub mod autocrat {
    use super::*;

    pub fn initialize_dao(
        ctx: Context<InitializeDAO>,
        base_lot_size: i64,
        twap_expected_value: u64,
    ) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        let (treasury, treasury_pda_bump) =
            Pubkey::find_program_address(&[dao.key().as_ref()], ctx.program_id);

        dao.set_inner(DAO {
            token_mint: ctx.accounts.token_mint.key(),
            usdc_mint: ctx.accounts.usdc_mint.key(),
            treasury_pda_bump,
            treasury,
            proposal_count: 0,
            last_proposal_slot: 0,
            pass_threshold_bps: DEFAULT_PASS_THRESHOLD_BPS,
            base_burn_lamports: DEFAULT_BASE_BURN_LAMPORTS,
            burn_decay_per_slot_lamports: DEFAULT_BURN_DECAY_PER_SLOT_LAMPORTS,
            slots_per_proposal: THREE_DAYS_IN_SLOTS,
            market_taker_fee: 0,
            twap_expected_value,
            max_observation_change_per_update_lots: DEFAULT_MAX_OBSERVATION_CHANGE_PER_UPDATE_LOTS,
            base_lot_size,
        });

        Ok(())
    }

    pub fn initialize_proposal(
        ctx: Context<InitializeProposal>,
        description_url: String,
        instruction: ProposalInstruction,
    ) -> Result<()> {
        let pass_market = ctx.accounts.openbook_pass_market.load()?;
        let fail_market = ctx.accounts.openbook_fail_market.load()?;
        let base_vault = &ctx.accounts.base_vault;
        let quote_vault = &ctx.accounts.quote_vault;
        let dao = &mut ctx.accounts.dao;
        let clock = Clock::get()?;

        require_eq!(
            pass_market.base_mint,
            base_vault.conditional_on_finalize_token_mint,
            AutocratError::InvalidMarket
        );
        require_eq!(
            pass_market.quote_mint,
            quote_vault.conditional_on_finalize_token_mint,
            AutocratError::InvalidMarket
        );
        require_eq!(
            fail_market.base_mint,
            base_vault.conditional_on_revert_token_mint,
            AutocratError::InvalidMarket
        );
        require_eq!(
            fail_market.quote_mint,
            quote_vault.conditional_on_revert_token_mint,
            AutocratError::InvalidMarket
        );

        for market in [&pass_market, &fail_market] {
            // The market expires a minimum of 7 days after the end of a 3 day proposal.
            // Make sure to do final TWAP crank after the proposal period has ended
            // and before the market expires, or else! Allows for rent retrieval from openbook
            require!(
                market.time_expiry > clock.unix_timestamp as i64 + TEN_DAYS_IN_SECONDS,
                AutocratError::InvalidMarket
            );

            require_eq!(
                market.taker_fee,
                dao.market_taker_fee,
                AutocratError::InvalidMarket
            );

            require_eq!(market.maker_fee, 0, AutocratError::InvalidMarket);

            require_eq!(
                market.base_lot_size,
                dao.base_lot_size,
                AutocratError::InvalidMarket
            );

            require_eq!(
                market.quote_lot_size,
                100, // you can quote in increments of a hundredth of a penny
                AutocratError::InvalidMarket
            );

            require_eq!(
                market.collect_fee_admin,
                dao.treasury,
                AutocratError::InvalidMarket
            );
        }

        let pass_twap_market = &ctx.accounts.openbook_twap_pass_market;
        let fail_twap_market = &ctx.accounts.openbook_twap_fail_market;

        for twap_market in [pass_twap_market, fail_twap_market] {
            let oracle = &twap_market.twap_oracle;

            require!(
                clock.slot <= oracle.initial_slot + 50,
                AutocratError::TWAPMarketTooOld
            );

            require_eq!(
                oracle.max_observation_change_per_update_lots,
                dao.max_observation_change_per_update_lots,
                AutocratError::TWAPOracleWrongChangeLots
            );

            require_eq!(
                oracle.expected_value,
                dao.twap_expected_value,
                AutocratError::TWAPMarketInvalidExpectedValue
            );
        }

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

        dao.proposal_count += 1;

        let proposal = &mut ctx.accounts.proposal;
        proposal.set_inner(Proposal {
            number: dao.proposal_count,
            proposer: ctx.accounts.proposer.key(),
            description_url,
            slot_enqueued: clock.slot,
            state: ProposalState::Pending,
            instruction,
            pass_amm: ctx.accounts.pass_amm.key(),
            fail_amm: ctx.accounts.fail_amm.key(),
            amm_nonce: ctx.accounts.pass_amm.nonce,
            openbook_twap_pass_market: pass_twap_market.key(),
            openbook_twap_fail_market: fail_twap_market.key(),
            openbook_pass_market: ctx.accounts.openbook_pass_market.key(),
            openbook_fail_market: ctx.accounts.openbook_fail_market.key(),
            base_vault: base_vault.key(),
            quote_vault: quote_vault.key(),
            dao: dao.key(),
        });

        // least signficant 32 bits of nonce are proposal number
        // most significant bit of nonce is 0 for base (META) and 1 for quote (USDC)
        require_eq!(
            base_vault.nonce,
            proposal.number as u64,
            AutocratError::InvalidVaultNonce
        );
        require_eq!(
            quote_vault.nonce,
            proposal.number as u64,
            AutocratError::InvalidVaultNonce
        );

        Ok(())
    }

    pub fn finalize_proposal(ctx: Context<FinalizeProposal>) -> Result<()> {
        let pass_twap_market = &ctx.accounts.openbook_twap_pass_market;
        let fail_twap_market = &ctx.accounts.openbook_twap_fail_market;
        let dao = &ctx.accounts.dao;

        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;

        require!(
            clock.slot >= proposal.slot_enqueued + dao.slots_per_proposal,
            AutocratError::ProposalTooYoung
        );

        require!(
            proposal.state == ProposalState::Pending,
            AutocratError::ProposalAlreadyFinalized
        );

        let dao_key = dao.key();
        let treasury_seeds = &[dao_key.as_ref(), &[dao.treasury_pda_bump]];
        let signer = &[&treasury_seeds[..]];

        let calculate_twap = |twap_market: &TWAPMarket| -> Result<u128> {
            let oracle = &twap_market.twap_oracle;
            let aggregator = oracle.observation_aggregator;
            assert!(aggregator != 0);

            let slots_passed = oracle.last_updated_slot - proposal.slot_enqueued;

            require!(
                slots_passed >= dao.slots_per_proposal,
                AutocratError::MarketsTooYoung
            );

            let twap = aggregator / slots_passed as u128;
            assert!(twap != 0);

            Ok(twap)
        };

        let fail_market_twap = calculate_twap(&fail_twap_market)?;
        let pass_market_twap = calculate_twap(&pass_twap_market)?;

        let threshold =
            (fail_market_twap * (MAX_BPS + dao.pass_threshold_bps) as u128) / MAX_BPS as u128;

        let (new_proposal_state, new_vault_state) = if pass_market_twap > threshold {
            (ProposalState::Passed, VaultStatus::Finalized)
        } else {
            (ProposalState::Failed, VaultStatus::Reverted)
        };

        proposal.state = new_proposal_state;

        for vault in [
            ctx.accounts.base_vault.to_account_info(),
            ctx.accounts.quote_vault.to_account_info(),
        ] {
            let vault_program = ctx.accounts.vault_program.to_account_info();
            let cpi_accounts = SettleConditionalVault {
                settlement_authority: ctx.accounts.dao_treasury.to_account_info(),
                vault,
            };
            let cpi_ctx = CpiContext::new(vault_program, cpi_accounts).with_signer(signer);
            conditional_vault::cpi::settle_conditional_vault(cpi_ctx, new_vault_state)?;
        }

        Ok(())
    }

    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        proposal.state = ProposalState::Executed;

        let dao_key = ctx.accounts.dao.key();
        let treasury_seeds = &[dao_key.as_ref(), &[ctx.accounts.dao.treasury_pda_bump]];
        let signer = &[&treasury_seeds[..]];

        let mut svm_instruction: Instruction = proposal.instruction.borrow().into();
        for acc in svm_instruction.accounts.iter_mut() {
            if &acc.pubkey == ctx.accounts.dao_treasury.key {
                acc.is_signer = true;
            }
        }

        solana_program::program::invoke_signed(&svm_instruction, ctx.remaining_accounts, signer)?;

        Ok(())
    }

    pub fn update_dao(ctx: Context<UpdateDao>, dao_params: UpdateDaoParams) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        macro_rules! update_dao_if_passed {
            ($field:ident) => {
                if let Some(value) = dao_params.$field {
                    dao.$field = value;
                }
            };
        }

        update_dao_if_passed!(pass_threshold_bps);
        update_dao_if_passed!(base_burn_lamports);
        update_dao_if_passed!(burn_decay_per_slot_lamports);
        update_dao_if_passed!(slots_per_proposal);
        update_dao_if_passed!(market_taker_fee);
        update_dao_if_passed!(twap_expected_value);
        update_dao_if_passed!(base_lot_size);
        update_dao_if_passed!(max_observation_change_per_update_lots);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeDAO<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<DAO>()
    )]
    pub dao: Account<'info, DAO>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_mint: Account<'info, Mint>,
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
        constraint = quote_vault.underlying_token_mint == dao.usdc_mint,
        constraint = quote_vault.settlement_authority == dao.treasury @ AutocratError::InvalidSettlementAuthority,
    )]
    pub quote_vault: Account<'info, ConditionalVaultAccount>,
    #[account(
        constraint = base_vault.underlying_token_mint == dao.token_mint,
        constraint = base_vault.settlement_authority == dao.treasury @ AutocratError::InvalidSettlementAuthority,
    )]
    pub base_vault: Account<'info, ConditionalVaultAccount>,
    #[account(
        constraint = pass_amm.base_mint == base_vault.conditional_on_finalize_token_mint,
        constraint = pass_amm.quote_mint == quote_vault.conditional_on_finalize_token_mint,
        constraint = pass_amm.nonce == fail_amm.nonce
    )]
    pub pass_amm: Box<Account<'info, Amm>>,
    #[account(
        constraint = fail_amm.base_mint == base_vault.conditional_on_revert_token_mint,
        constraint = fail_amm.quote_mint == quote_vault.conditional_on_revert_token_mint
    )]
    pub fail_amm: Box<Account<'info, Amm>>,
    pub openbook_pass_market: AccountLoader<'info, Market>,
    pub openbook_fail_market: AccountLoader<'info, Market>,
    #[account(constraint = openbook_twap_pass_market.market == openbook_pass_market.key())]
    pub openbook_twap_pass_market: Account<'info, TWAPMarket>,
    #[account(constraint = openbook_twap_fail_market.market == openbook_fail_market.key())]
    pub openbook_twap_fail_market: Account<'info, TWAPMarket>,
    #[account(mut)]
    pub proposer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeProposal<'info> {
    #[account(mut,
        has_one = base_vault,
        has_one = quote_vault,
        has_one = openbook_twap_pass_market,
        has_one = openbook_twap_fail_market,
        has_one = pass_amm,
        has_one = fail_amm,
        has_one = dao,
    )]
    pub proposal: Account<'info, Proposal>,
    pub pass_amm: Account<'info, Amm>,
    pub fail_amm: Account<'info, Amm>,
    pub openbook_twap_pass_market: Account<'info, TWAPMarket>,
    pub openbook_twap_fail_market: Account<'info, TWAPMarket>,
    pub dao: Box<Account<'info, DAO>>,
    #[account(mut)]
    pub base_vault: Box<Account<'info, ConditionalVaultAccount>>,
    #[account(mut)]
    pub quote_vault: Box<Account<'info, ConditionalVaultAccount>>,
    pub vault_program: Program<'info, ConditionalVaultProgram>,
    /// CHECK: never read
    /// TODO: use a different thing to prevent collision
    #[account(
        seeds = [dao.key().as_ref()],
        bump = dao.treasury_pda_bump,
        mut
    )]
    pub dao_treasury: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(
        mut,
        constraint = proposal.state == ProposalState::Passed @ AutocratError::ProposalNotPassed,
    )]
    pub proposal: Account<'info, Proposal>,
    pub dao: Box<Account<'info, DAO>>,
    /// CHECK: never read
    #[account(
        seeds = [dao.key().as_ref()],
        bump = dao.treasury_pda_bump,
        mut
    )]
    pub dao_treasury: UncheckedAccount<'info>,
}

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct UpdateDaoParams {
    pub pass_threshold_bps: Option<u16>,
    pub base_burn_lamports: Option<u64>,
    pub burn_decay_per_slot_lamports: Option<u64>,
    pub slots_per_proposal: Option<u64>,
    pub market_taker_fee: Option<i64>,
    pub twap_expected_value: Option<u64>,
    pub max_observation_change_per_update_lots: Option<u64>,
    pub base_lot_size: Option<i64>,
}

#[derive(Accounts)]
pub struct UpdateDao<'info> {
    #[account(mut)]
    pub dao: Account<'info, DAO>,
    /// CHECK: never read
    #[account(
        seeds = [dao.key().as_ref()],
        bump = dao.treasury_pda_bump,
    )]
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
    #[msg("`TWAPMarket` must have an `initial_slot` within 50 slots of the proposal's `slot_enqueued`")]
    TWAPMarketTooOld,
    #[msg("`TWAPOracle` has an incorrect max_observation_change_per_update_lots value")]
    TWAPOracleWrongChangeLots,
    #[msg("`TWAPMarket` has the wrong `expected_value`")]
    TWAPMarketInvalidExpectedValue,
    #[msg("One of the vaults has an invalid `settlement_authority`")]
    InvalidSettlementAuthority,
    #[msg("Proposal is too young to be executed or rejected")]
    ProposalTooYoung,
    #[msg("Markets too young for proposal to be finalized. TWAP might need to be cranked")]
    MarketsTooYoung,
    #[msg("This proposal has already been finalized")]
    ProposalAlreadyFinalized,
    #[msg("A conditional vault has an invalid nonce. A nonce should encode the proposal number")]
    InvalidVaultNonce,
    #[msg("This proposal can't be executed because it isn't in the passed state")]
    ProposalNotPassed,
}
