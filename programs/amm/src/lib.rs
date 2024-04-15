use anchor_lang::prelude::*;

declare_id!("4kjgd1q5qAQfujsXPCwc4zw277h9ToF6h6EYYa2RjThe");

#[program]
pub mod amm {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
