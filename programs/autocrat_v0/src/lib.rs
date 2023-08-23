use anchor_lang::prelude::*;

declare_id!("5QBbGKFSoL1hS4s5dsCBdNRVnJcMuHXFwhooKk2ar25S");

#[program]
pub mod autocrat_v0 {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
