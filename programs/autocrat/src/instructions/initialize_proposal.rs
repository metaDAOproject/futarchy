use super::*;

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
    pub fn handle(ctx: Context<Self>, description_url: String, instruction: ProposalInstruction) -> Result<()> {
        // let pass_market = ctx.accounts.openbook_pass_market.load()?;
        // let fail_market = ctx.accounts.openbook_fail_market.load()?;
        let base_vault = &ctx.accounts.base_vault;
        let quote_vault = &ctx.accounts.quote_vault;
        let dao = &mut ctx.accounts.dao;
        let clock = Clock::get()?;

        // require_eq!(
        //     pass_market.base_mint,
        //     base_vault.conditional_on_finalize_token_mint,
        //     AutocratError::InvalidMarket
        // );
        // require_eq!(
        //     pass_market.quote_mint,
        //     quote_vault.conditional_on_finalize_token_mint,
        //     AutocratError::InvalidMarket
        // );
        // require_eq!(
        //     fail_market.base_mint,
        //     base_vault.conditional_on_revert_token_mint,
        //     AutocratError::InvalidMarket
        // );
        // require_eq!(
        //     fail_market.quote_mint,
        //     quote_vault.conditional_on_revert_token_mint,
        //     AutocratError::InvalidMarket
        // );

        // for market in [&pass_market, &fail_market] {
            // The market expires a minimum of 7 days after the end of a 3 day proposal.
            // Make sure to do final TWAP crank after the proposal period has ended
            // and before the market expires, or else! Allows for rent retrieval from openbook
        //     require!(
        //         market.time_expiry > clock.unix_timestamp as i64 + TEN_DAYS_IN_SECONDS,
        //         AutocratError::InvalidMarket
        //     );

        //     require_eq!(
        //         market.taker_fee,
        //         dao.market_taker_fee,
        //         AutocratError::InvalidMarket
        //     );

        //     require_eq!(market.maker_fee, 0, AutocratError::InvalidMarket);

        //     require_eq!(
        //         market.base_lot_size,
        //         dao.base_lot_size,
        //         AutocratError::InvalidMarket
        //     );

        //     require_eq!(
        //         market.quote_lot_size,
        //         100, // you can quote in increments of a hundredth of a penny
        //         AutocratError::InvalidMarket
        //     );

        //     require_eq!(
        //         market.collect_fee_admin,
        //         dao.treasury,
        //         AutocratError::InvalidMarket
        //     );
        // }

        // let pass_twap_market = &ctx.accounts.openbook_twap_pass_market;
        // let fail_twap_market = &ctx.accounts.openbook_twap_fail_market;

        // for twap_market in [pass_twap_market, fail_twap_market] {
        //     let oracle = &twap_market.twap_oracle;

        //     require!(
        //         clock.slot <= oracle.initial_slot + 50,
        //         AutocratError::TWAPMarketTooOld
        //     );

        //     require_eq!(
        //         oracle.max_observation_change_per_update_lots,
        //         dao.max_observation_change_per_update_lots,
        //         AutocratError::TWAPOracleWrongChangeLots
        //     );

        //     require_eq!(
        //         oracle.expected_value,
        //         dao.twap_expected_value,
        //         AutocratError::TWAPMarketInvalidExpectedValue
        //     );
        // }

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
            base_vault: base_vault.key(),
            quote_vault: quote_vault.key(),
            dao: dao.key(),
        });

        Ok(())
    }
}