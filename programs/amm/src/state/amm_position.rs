use anchor_lang::prelude::*;

#[account]
pub struct AmmPosition {
    pub user: Pubkey,
    pub amm: Pubkey,
    pub ownership: u64,
}
