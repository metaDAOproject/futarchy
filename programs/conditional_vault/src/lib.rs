use anchor_lang::prelude::*;

declare_id!("4SrgFQyrvEYB3GupUaEjoULXCmzHCcAcTffHbpppycip");

#[program]
pub mod conditional_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
