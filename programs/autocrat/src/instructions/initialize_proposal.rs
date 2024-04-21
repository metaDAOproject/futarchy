use super::*;

use amm::state::ONE_MINUTE_IN_SLOTS;
use anchor_spl::token::TokenAccount;

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InitializeProposalParams {
    pub description_url: String,
    pub instruction: ProposalInstruction,
    pub pass_lp_tokens_to_lock: u64,
    pub fail_lp_tokens_to_lock: u64,
}

#[derive(Accounts)]
pub struct InitializeProposal<'info> {
    #[account(zero, signer)]
    pub proposal: Box<Account<'info, Proposal>>,
    #[account(mut)]
    pub dao: Account<'info, DAO>,
    #[account(
        has_one = proposal,
        constraint = quote_vault.underlying_token_mint == dao.usdc_mint,
        constraint = quote_vault.settlement_authority == dao.treasury @ AutocratError::InvalidSettlementAuthority,
    )]
    pub quote_vault: Account<'info, ConditionalVaultAccount>,
    #[account(
        has_one = proposal,
        constraint = base_vault.underlying_token_mint == dao.token_mint,
        constraint = base_vault.settlement_authority == dao.treasury @ AutocratError::InvalidSettlementAuthority,
    )]
    pub base_vault: Account<'info, ConditionalVaultAccount>,
    #[account(
        constraint = pass_amm.base_mint == base_vault.conditional_on_finalize_token_mint,
        constraint = pass_amm.quote_mint == quote_vault.conditional_on_finalize_token_mint,
        has_one = proposal
    )]
    pub pass_amm: Box<Account<'info, Amm>>,
    #[account(
        constraint = fail_amm.base_mint == base_vault.conditional_on_revert_token_mint,
        constraint = fail_amm.quote_mint == quote_vault.conditional_on_revert_token_mint,
        has_one = proposal
    )]
    pub fail_amm: Box<Account<'info, Amm>>,
    #[account(
        associated_token::mint = pass_amm.lp_mint,
        associated_token::authority = proposer,
    )]
    pub pass_lp_user_account: Account<'info, TokenAccount>,
    #[account(
        associated_token::mint = fail_amm.lp_mint,
        associated_token::authority = proposer,
    )]
    pub fail_lp_user_account: Account<'info, TokenAccount>,
    #[account(
        associated_token::mint = pass_amm.lp_mint,
        associated_token::authority = dao.treasury,
    )]
    pub pass_lp_vault_account: Account<'info, TokenAccount>,
    #[account(
        associated_token::mint = fail_amm.lp_mint,
        associated_token::authority = dao.treasury,
    )]
    pub fail_lp_vault_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub proposer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl InitializeProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        for amm in [&self.pass_amm, &self.fail_amm] {
            require!(
                clock.slot < amm.created_at_slot + (5 * ONE_MINUTE_IN_SLOTS),
                AutocratError::AmmTooOld
            );

            require_eq!(
                amm.oracle.initial_observation,
                self.dao.twap_initial_observation,
                AutocratError::InvalidInitialObservation
            );

            require_eq!(
                amm.oracle.max_observation_change_per_update,
                self.dao.twap_max_observation_change_per_update,
                AutocratError::InvalidMaxObservationChange
            );
        }

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, params: InitializeProposalParams) -> Result<()> {
        let Self {
            base_vault,
            quote_vault,
            proposal,
            dao,
            pass_amm,
            fail_amm,
            pass_lp_user_account,
            fail_lp_user_account,
            pass_lp_vault_account,
            fail_lp_vault_account,
            proposer,
            system_program: _,
        } = ctx.accounts;

        let InitializeProposalParams {
            description_url,
            instruction,
            pass_lp_tokens_to_lock,
            fail_lp_tokens_to_lock,
        } = params;

        require_gte!(pass_lp_user_account.amount, pass_lp_tokens_to_lock);
        require_gte!(fail_lp_user_account.amount, fail_lp_tokens_to_lock);

        let clock = Clock::get()?;

        dao.proposal_count += 1;

        proposal.set_inner(Proposal {
            number: dao.proposal_count,
            proposer: proposer.key(),
            description_url,
            slot_enqueued: clock.slot,
            state: ProposalState::Pending,
            instruction,
            pass_amm: pass_amm.key(),
            fail_amm: fail_amm.key(),
            base_vault: base_vault.key(),
            quote_vault: quote_vault.key(),
            dao: dao.key(),
        });

        Ok(())
    }
}