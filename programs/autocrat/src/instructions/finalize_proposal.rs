use super::*;

#[derive(Accounts)]
pub struct FinalizeProposal<'info> {
    #[account(mut,
        has_one = base_vault,
        has_one = quote_vault,
        has_one = pass_amm,
        has_one = fail_amm,
        has_one = dao,
    )]
    pub proposal: Account<'info, Proposal>,
    pub pass_amm: Account<'info, Amm>,
    pub fail_amm: Account<'info, Amm>,
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

impl FinalizeProposal<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let pass_amm = &ctx.accounts.pass_amm;
        let fail_amm = &ctx.accounts.fail_amm;
        let dao = &ctx.accounts.dao;
        let base_vault = &mut ctx.accounts.base_vault;
        let quote_vault = &mut ctx.accounts.quote_vault;

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

        let calculate_twap = |amm: &Amm| -> Result<u128> {
            let slots_passed = amm.oracle.last_updated_slot - proposal.slot_enqueued;

            require!(
                slots_passed >= dao.slots_per_proposal,
                AutocratError::MarketsTooYoung
            );

            amm.get_twap()
        };

        let pass_market_twap = calculate_twap(&pass_amm)?;
        let fail_market_twap = calculate_twap(&fail_amm)?;

        // this can't overflow because each twap can only be MAX_PRICE (~1e31),
        // MAX_BPS + pass_threshold_bps is at most 1e5, and a u128 can hold
        // 1e38. still, saturate
        let threshold = fail_market_twap
            .saturating_mul(MAX_BPS.saturating_add(dao.pass_threshold_bps).into())
            / MAX_BPS as u128;

        let (new_proposal_state, new_vault_state) = if pass_market_twap > threshold {
            (ProposalState::Passed, VaultStatus::Finalized)
        } else {
            (ProposalState::Failed, VaultStatus::Reverted)
        };

        proposal.state = new_proposal_state;

        for vault in [base_vault.to_account_info(), quote_vault.to_account_info()] {
            let vault_program = ctx.accounts.vault_program.to_account_info();
            let cpi_accounts = SettleConditionalVault {
                settlement_authority: ctx.accounts.dao_treasury.to_account_info(),
                vault,
            };
            let cpi_ctx = CpiContext::new(vault_program, cpi_accounts).with_signer(signer);
            conditional_vault::cpi::settle_conditional_vault(cpi_ctx, new_vault_state)?;
        }

        base_vault.reload()?;
        quote_vault.reload()?;

        match new_proposal_state {
            ProposalState::Passed => {
                assert!(base_vault.status == VaultStatus::Finalized);
                assert!(quote_vault.status == VaultStatus::Finalized);
            }
            ProposalState::Failed => {
                assert!(base_vault.status == VaultStatus::Reverted);
                assert!(quote_vault.status == VaultStatus::Reverted);
            }
            _ => assert!(false),
        }

        Ok(())
    }
}
