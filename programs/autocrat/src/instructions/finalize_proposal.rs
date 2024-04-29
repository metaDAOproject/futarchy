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
    #[account(has_one = treasury)]
    pub dao: Box<Account<'info, Dao>>,
    #[account(mut)]
    pub base_vault: Box<Account<'info, ConditionalVaultAccount>>,
    #[account(mut)]
    pub quote_vault: Box<Account<'info, ConditionalVaultAccount>>,
    /// CHECK: never read
    pub treasury: UncheckedAccount<'info>,
    #[account(
        mut,
        associated_token::mint = pass_amm.lp_mint,
        associated_token::authority = proposal.proposer,
    )]
    pub pass_lp_user_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = fail_amm.lp_mint,
        associated_token::authority = proposal.proposer,
    )]
    pub fail_lp_user_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = pass_amm.lp_mint,
        associated_token::authority = dao.treasury,
    )]
    pub pass_lp_vault_account: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        associated_token::mint = fail_amm.lp_mint,
        associated_token::authority = dao.treasury,
    )]
    pub fail_lp_vault_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub vault_program: Program<'info, ConditionalVaultProgram>,
}

impl FinalizeProposal<'_> {
    pub fn validate(&self) -> Result<()> {
        let clock = Clock::get()?;

        require!(
            clock.slot >= self.proposal.slot_enqueued + self.dao.slots_per_proposal,
            AutocratError::ProposalTooYoung
        );

        require!(
            self.proposal.state == ProposalState::Pending,
            AutocratError::ProposalAlreadyFinalized
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let FinalizeProposal {
            proposal,
            pass_amm,
            fail_amm,
            dao,
            base_vault,
            quote_vault,
            treasury,
            pass_lp_user_account,
            fail_lp_user_account,
            pass_lp_vault_account,
            fail_lp_vault_account,
            vault_program,
            token_program,
        } = ctx.accounts;

        let dao_key = dao.key();
        let treasury_seeds = &[dao_key.as_ref(), &[dao.treasury_pda_bump]];
        let signer = &[&treasury_seeds[..]];

        for (lp_tokens_to_unlock, from, to) in [
            (
                proposal.pass_lp_tokens_locked,
                pass_lp_vault_account,
                pass_lp_user_account,
            ),
            (
                proposal.fail_lp_tokens_locked,
                fail_lp_vault_account,
                fail_lp_user_account,
            ),
        ] {
            // without this, someone can brick a proposal if they have another proposal transfer
            // out its LP tokens from the treasury.
            let lp_tokens_to_unlock = std::cmp::min(lp_tokens_to_unlock, from.amount);

            token::transfer(
                CpiContext::new(
                    token_program.to_account_info(),
                    Transfer {
                        from: from.to_account_info(),
                        to: to.to_account_info(),
                        authority: treasury.to_account_info(),
                    },
                )
                .with_signer(signer),
                lp_tokens_to_unlock,
            )?;
        }

        let calculate_twap = |amm: &Amm| -> Result<u128> {
            let slots_passed = amm.oracle.last_updated_slot - proposal.slot_enqueued;

            require!(
                slots_passed >= dao.slots_per_proposal,
                AutocratError::MarketsTooYoung
            );

            amm.get_twap()
        };

        let pass_market_twap = calculate_twap(pass_amm)?;
        let fail_market_twap = calculate_twap(fail_amm)?;

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
            let vault_program = vault_program.to_account_info();
            let cpi_accounts = SettleConditionalVault {
                settlement_authority: treasury.to_account_info(),
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
            _ => unreachable!("Encountered an unexpected proposal state"),
        }

        Ok(())
    }
}
