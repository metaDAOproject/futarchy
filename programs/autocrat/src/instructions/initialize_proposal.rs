use super::*;

use amm::state::ONE_MINUTE_IN_SLOTS;

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

    pub fn handle(ctx: Context<Self>, description_url: String, instruction: ProposalInstruction) -> Result<()> {
        let base_vault = &ctx.accounts.base_vault;
        let quote_vault = &ctx.accounts.quote_vault;
        let dao = &mut ctx.accounts.dao;
        let clock = Clock::get()?;

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
            base_vault: base_vault.key(),
            quote_vault: quote_vault.key(),
            dao: dao.key(),
        });

        Ok(())
    }
}