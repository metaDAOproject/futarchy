use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_spl::token::Mint;
use conditional_vault::cpi::accounts::SettleConditionalVault;
use conditional_vault::program::ConditionalVault as ConditionalVaultProgram;
use conditional_vault::ConditionalVault as ConditionalVaultAccount;
use conditional_vault::VaultStatus;
use openbook_twap::TWAPMarket;
use openbook_v2::state::Market;
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

declare_id!("metaX99LHn3A7Gr7VAcCfXhpfocvpMpqQ3eyp3PGUUq");

pub const SLOTS_PER_10_SECS: u64 = 25;
pub const THREE_DAYS_IN_SLOTS: u64 = 5 * 24 * 60 * 6 * SLOTS_PER_10_SECS;

// by default, the pass price needs to be 5% higher than the fail price
pub const DEFAULT_PASS_THRESHOLD_BPS: u16 = 500;

// start at 10 SOL ($600 at current prices), decay by ~5 SOL per day
pub const DEFAULT_BASE_BURN_LAMPORTS: u64 = 10 * solana_program::native_token::LAMPORTS_PER_SOL;
pub const DEFAULT_BURN_DECAY_PER_SLOT_LAMPORTS: u64 = 23_150;

pub const MAX_BPS: u16 = 10_000;

#[account]
pub struct DAO {
    // treasury needed even though DAO is PDA for this reason: https://solana.stackexchange.com/questions/7667/a-peculiar-problem-with-cpis
    pub treasury_pda_bump: u8,
    pub treasury: Pubkey,
    pub meta_mint: Pubkey,
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
    pub twap_expected_value: u64,
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
    pub openbook_pass_market: Pubkey,
    pub openbook_fail_market: Pubkey,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
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

        dao.proposal_count = 2;

        dao.pass_threshold_bps = DEFAULT_PASS_THRESHOLD_BPS;
        dao.base_burn_lamports = DEFAULT_BASE_BURN_LAMPORTS;
        dao.burn_decay_per_slot_lamports = DEFAULT_BURN_DECAY_PER_SLOT_LAMPORTS;
        dao.slots_per_proposal = THREE_DAYS_IN_SLOTS;
        dao.market_taker_fee = 0;
        dao.twap_expected_value = 10_000; // 1 USDC per META

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
        let openbook_pass_market = ctx.accounts.openbook_pass_market.load()?;
        let openbook_fail_market = ctx.accounts.openbook_fail_market.load()?;
        let dao = &mut ctx.accounts.dao;

        require!(
            openbook_pass_market.base_mint
                == ctx.accounts.base_vault.conditional_on_finalize_token_mint,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_pass_market.quote_mint
                == ctx.accounts.quote_vault.conditional_on_finalize_token_mint,
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
            openbook_pass_market.taker_fee == dao.market_taker_fee,
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
            openbook_pass_market.collect_fee_admin == dao.treasury,
            AutocratError::InvalidMarket
        );

        require!(
            openbook_fail_market.base_mint
                == ctx.accounts.base_vault.conditional_on_revert_token_mint,
            AutocratError::InvalidMarket
        );
        require!(
            openbook_fail_market.quote_mint
                == ctx.accounts.quote_vault.conditional_on_revert_token_mint,
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
            openbook_fail_market.taker_fee == dao.market_taker_fee,
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
        require!(
            openbook_fail_market.collect_fee_admin == dao.treasury,
            AutocratError::InvalidMarket
        );
        let clock = Clock::get()?;

        let openbook_twap_pass_market = &ctx.accounts.openbook_twap_pass_market;
        let openbook_twap_fail_market = &ctx.accounts.openbook_twap_fail_market;

        require!(
            openbook_twap_pass_market.twap_oracle.initial_slot + 50 >= clock.slot,
            AutocratError::TWAPMarketTooOld
        );
        require!(
            openbook_twap_fail_market.twap_oracle.initial_slot + 50 >= clock.slot,
            AutocratError::TWAPMarketTooOld
        );
        require!(
            openbook_twap_pass_market.twap_oracle.expected_value == dao.twap_expected_value,
            AutocratError::TWAPMarketInvalidExpectedValue
        );
        require!(
            openbook_twap_fail_market.twap_oracle.expected_value == dao.twap_expected_value,
            AutocratError::TWAPMarketInvalidExpectedValue
        );

        let proposal = &mut ctx.accounts.proposal;

        proposal.number = dao.proposal_count;
        dao.proposal_count += 1;

        // least signficant 32 bits of nonce are proposal number
        // most significant bit of nonce is 0 for base (META) and 1 for quote (USDC)
        require!(
            ctx.accounts.base_vault.nonce == proposal.number as u64,
            AutocratError::InvalidVaultNonce
        );
        require!(
            ctx.accounts.quote_vault.nonce == (proposal.number as u64 | (1 << 63)),
            AutocratError::InvalidVaultNonce
        );

        proposal.quote_vault = ctx.accounts.quote_vault.key();
        proposal.base_vault = ctx.accounts.base_vault.key();

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

        proposal.openbook_twap_pass_market = ctx.accounts.openbook_twap_pass_market.key();
        proposal.openbook_twap_fail_market = ctx.accounts.openbook_twap_fail_market.key();
        proposal.openbook_pass_market = ctx.accounts.openbook_pass_market.key();
        proposal.openbook_fail_market = ctx.accounts.openbook_fail_market.key();

        proposal.proposer = ctx.accounts.proposer.key();
        proposal.description_url = description_url;
        proposal.slot_enqueued = clock.slot;
        proposal.state = ProposalState::Pending;
        proposal.instruction = instruction;

        Ok(())
    }

    pub fn finalize_proposal(ctx: Context<FinalizeProposal>) -> Result<()> {
        let openbook_twap_pass_market = &ctx.accounts.openbook_twap_pass_market;
        let openbook_twap_fail_market = &ctx.accounts.openbook_twap_fail_market;

        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;

        require!(
            clock.slot >= proposal.slot_enqueued + ctx.accounts.dao.slots_per_proposal,
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

        // should only overflow in a situation where we want a revert anyways
        let pass_market_slots_passed =
            openbook_twap_pass_market.twap_oracle.last_updated_slot - proposal.slot_enqueued;
        let fail_market_slots_passed =
            openbook_twap_fail_market.twap_oracle.last_updated_slot - proposal.slot_enqueued;

        require!(
            pass_market_slots_passed >= ctx.accounts.dao.slots_per_proposal,
            AutocratError::MarketsTooYoung
        );
        require!(
            fail_market_slots_passed >= ctx.accounts.dao.slots_per_proposal,
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
                conditional_vault::cpi::settle_conditional_vault(cpi_ctx, VaultStatus::Finalized)?;
            }
        } else {
            proposal.state = ProposalState::Failed;

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
                conditional_vault::cpi::settle_conditional_vault(cpi_ctx, VaultStatus::Reverted)?;
            }
        }

        Ok(())
    }

    pub fn update_dao(
        ctx: Context<UpdateDao>,
        dao_params: UpdateDaoParams,
    ) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        if let Some(pass_threshold_bps) = dao_params.pass_threshold_bps {
            dao.pass_threshold_bps = pass_threshold_bps;
        }

        if let Some(base_burn_lamports) = dao_params.base_burn_lamports {
            dao.base_burn_lamports = base_burn_lamports;
        }

        if let Some(burn_decay_per_slot_lamports) = dao_params.burn_decay_per_slot_lamports {
            dao.burn_decay_per_slot_lamports = burn_decay_per_slot_lamports;
        }

        if let Some(slots_per_proposal) = dao_params.slots_per_proposal {
            dao.slots_per_proposal = slots_per_proposal;
        }

        if let Some(market_taker_fee) = dao_params.market_taker_fee {
            dao.market_taker_fee = market_taker_fee;
        }

        if let Some(twap_expected_value) = dao_params.twap_expected_value {
            dao.twap_expected_value = twap_expected_value;
        }

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
        constraint = quote_vault.underlying_token_mint == dao.usdc_mint,
        constraint = quote_vault.settlement_authority == dao.treasury @ AutocratError::InvalidSettlementAuthority,
    )]
    pub quote_vault: Account<'info, ConditionalVaultAccount>,
    #[account(
        constraint = base_vault.underlying_token_mint == dao.meta_mint,
        constraint = base_vault.settlement_authority == dao.treasury @ AutocratError::InvalidSettlementAuthority,
    )]
    pub base_vault: Account<'info, ConditionalVaultAccount>,
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
    )]
    pub proposal: Account<'info, Proposal>,
    pub openbook_twap_pass_market: Account<'info, TWAPMarket>,
    pub openbook_twap_fail_market: Account<'info, TWAPMarket>,
    pub dao: Box<Account<'info, DAO>>,
    #[account(mut)]
    pub base_vault: Box<Account<'info, ConditionalVaultAccount>>,
    #[account(mut)]
    pub quote_vault: Box<Account<'info, ConditionalVaultAccount>>,
    pub vault_program: Program<'info, ConditionalVaultProgram>,
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
    #[msg("`TWAPMarket` has the wrong `expected_value`")]
    TWAPMarketInvalidExpectedValue,
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
