use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod conditional_vault {
    use super::*;

    pub fn initialize_conditional_token_account(
        ctx: Context<InitializeConditionalTokenAccount>, 
        proposal_number: u64, 
        redeemable_on_pass: bool
    ) -> Result<()> {
        let conditional_token_account = &mut ctx.accounts.conditional_token_account;

        conditional_token_account.proposal_number = proposal_number;
        conditional_token_account.redeemable_on_pass = redeemable_on_pass;
        conditional_token_account.balance = 0;
        conditional_token_account.authority = *ctx.accounts.authority.unsigned_key();

        Ok(())
    }


}

#[derive(Accounts)]
pub struct InitializeConditionalTokenAccount<'info> {
    #[account(init, payer = authority, space = 8 + 8 + 1 + 8 + 32)]
    conditional_token_account: Account<'info, ConditionalTokenAccount>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}

#[account]
pub struct ConditionalTokenAccount {
    proposal_number: u64,
    redeemable_on_pass: bool,
    balance: u64,
    authority: Pubkey,
}
