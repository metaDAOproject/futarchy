use anchor_lang::prelude::*;

declare_id!("8D57r6T9RaBTeDFezQzzoHRxywk1bMqYmbprsmx6Y8XV");

#[program]
pub mod raydium_twap {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
