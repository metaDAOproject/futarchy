use super::*;

#[derive(Accounts)]
pub struct SettleConditionalVault<'info> {
    pub settlement_authority: Signer<'info>,
    #[account(
        mut,
        has_one = settlement_authority,
    )]
    pub vault: Account<'info, ConditionalVault>,
}

impl SettleConditionalVault<'_> {
    pub fn validate(&self) -> Result<()> {
        require!(
            self.vault.status == VaultStatus::Active,
            VaultError::VaultAlreadySettled
        );

        Ok(())
    }

    pub fn handle(ctx: Context<Self>, new_status: VaultStatus) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        vault.status = new_status;

        Ok(())
    }
}
