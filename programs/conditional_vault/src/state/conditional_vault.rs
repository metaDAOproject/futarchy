use super::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VaultStatus {
    Active,
    Finalized,
    Reverted,
}

#[account]
pub struct ConditionalVault {
    pub status: VaultStatus,
    /// The account that can either finalize the vault to make conditional tokens
    /// redeemable for underlying tokens or revert the vault to make deposit
    /// slips redeemable for underlying tokens.
    pub settlement_authority: Pubkey,
    /// The mint of the tokens that are deposited into the vault.
    pub underlying_token_mint: Pubkey,
    /// The vault's storage account for deposited funds.
    pub underlying_token_account: Pubkey,
    pub conditional_on_finalize_token_mint: Pubkey,
    pub conditional_on_revert_token_mint: Pubkey,
    pub pda_bump: u8,
    pub decimals: u8,
    pub base_reserves: u64,
    pub quote_reserves: u64,
    pub base_decimals: u8,
    pub quote_decimals: u8,
}

#[macro_export]
macro_rules! generate_vault_seeds {
    ($vault:expr) => {{
        &[
            b"conditional_vault",
            $vault.settlement_authority.as_ref(),
            $vault.underlying_token_mint.as_ref(),
            &[$vault.pda_bump],
        ]
    }};
}

impl ConditionalVault {
        
    pub fn buy_quote(&self, amount: u128) -> u64 {
        let quote_reserves = self.quote_reserves as u128;
        let base_reserves = self.base_reserves as u128;
        let cost: u64 = ((amount * quote_reserves * 10_u128.pow(self.base_decimals as u32))
            / (base_reserves * 10_u128.pow(self.quote_decimals as u32))) as u64;
        return cost + 1; // always round up
    }

    pub fn sell_quote(&self, amount: u128) -> u64 {
        let quote_reserves = self.quote_reserves as u128;
        let base_reserves = self.base_reserves as u128;
        let output: u64 = ((amount * quote_reserves * 10_u128.pow(self.base_decimals as u32))
            / (base_reserves * 10_u128.pow(self.quote_decimals as u32))) as u64;

        return output;
    }
    pub fn calculate_price(&self) -> Result<u128> {
        let quote_reserves = self.quote_reserves as u128;
        let base_reserves = self.base_reserves as u128;

        let price = (quote_reserves * 10_u128.pow(self.base_decimals as u32))
            / (base_reserves * 10_u128.pow(self.quote_decimals as u32));
        Ok(price)
    }
}