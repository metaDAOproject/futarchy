pub use super::*;

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
    // todo: statically check that this is USDC given a feature flag
    #[account(mint::decimals = 6)]
    pub usdc_mint: Account<'info, Mint>,
}

impl InitializeDAO<'_> {
    pub fn handle(ctx: Context<Self>, base_lot_size: i64, twap_expected_value: u64) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        let (treasury, treasury_pda_bump) =
            Pubkey::find_program_address(&[dao.key().as_ref()], ctx.program_id);

        dao.set_inner(DAO {
            token_mint: ctx.accounts.token_mint.key(),
            usdc_mint: ctx.accounts.usdc_mint.key(),
            treasury_pda_bump,
            treasury,
            proposal_count: 0,
            pass_threshold_bps: DEFAULT_PASS_THRESHOLD_BPS,
            slots_per_proposal: THREE_DAYS_IN_SLOTS,
            twap_expected_value,
            max_observation_change_per_update_lots: DEFAULT_MAX_OBSERVATION_CHANGE_PER_UPDATE_LOTS,
        });

        Ok(())
    }
}