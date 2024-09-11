use anchor_lang::prelude::*;

use crate::state::*;
use crate::events::{CrankThatTwapEvent, CommonFields};

#[event_cpi]
#[derive(Accounts)]
pub struct CrankThatTwap<'info> {
    #[account(mut)]
    pub amm: Account<'info, Amm>,
}

impl CrankThatTwap<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let CrankThatTwap { amm, program: _, event_authority: _ } = ctx.accounts;

        amm.update_twap(Clock::get()?.slot)?;

        let clock = Clock::get()?;
        emit_cpi!(CrankThatTwapEvent {
            common: CommonFields::new(&clock, Pubkey::default(), amm),
        });

        Ok(())
    }
}
