use super::*;

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct UpdateDaoParams {
    pub pass_threshold_bps: Option<u16>,
    pub slots_per_proposal: Option<u64>,
    pub twap_initial_observation: Option<u128>,
    pub twap_max_observation_change_per_update: Option<u128>,
}

#[derive(Accounts)]
pub struct UpdateDao<'info> {
    #[account(mut, has_one = treasury)]
    pub dao: Account<'info, Dao>,
    pub treasury: Signer<'info>,
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
        update_dao_if_passed!(twap_initial_observation);
        update_dao_if_passed!(twap_max_observation_change_per_update);

        Ok(())
    }
}
