use anchor_lang::prelude::*;

declare_id!("865v1CyvRbUK2dPpPT5jgRBh1Hu3wxxy7p19YFugURHX");

#[program]
pub mod timelock {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
