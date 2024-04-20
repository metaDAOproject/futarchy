use super::*;

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct UpdateDaoParams {
    pub pass_threshold_bps: Option<u16>,
    pub slots_per_proposal: Option<u64>,
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

impl UpdateDao<'_> {
    pub fn handle(ctx: Context<Self>, dao_params: UpdateDaoParams) -> Result<()> {
        let dao = &mut ctx.accounts.dao;

        macro_rules! update_dao_if_passed {
            ($field:ident) => {
                if let Some(value) = dao_params.$field {
                    dao.$field = value;
                }
            };
        }

        update_dao_if_passed!(pass_threshold_bps);
        update_dao_if_passed!(slots_per_proposal);
        update_dao_if_passed!(twap_expected_value);
        update_dao_if_passed!(base_lot_size);
        update_dao_if_passed!(max_observation_change_per_update_lots);

        Ok(())
    }
}