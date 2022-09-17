use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod conditional_vault {
    use super::*;

    pub fn initialize_conditional_expression(
        ctx: Context<InitializeConditionalExpression>,
        proposal_number: u64,
        pass_or_fail_flag: bool
    ) -> Result<()> {
        let conditional_expression = &mut ctx.accounts.conditional_expression;

        conditional_expression.proposal_number = proposal_number;
        conditional_expression.pass_or_fail_flag = pass_or_fail_flag;

        Ok(())
    }

    //pub fn initialize_conditional_token_account(
    //    ctx: Context<InitializeConditionalTokenAccount>, 
    //    proposal_number: u64, 
    //    redeemable_on_pass: bool
    //) -> Result<()> {
    //    let conditional_token_account = &mut ctx.accounts.conditional_token_account;

    //    conditional_token_account.proposal_number = proposal_number;
    //    conditional_token_account.redeemable_on_pass = redeemable_on_pass;
    //    conditional_token_account.balance = 0;
    //    conditional_token_account.authority = *ctx.accounts.authority.unsigned_key();

    //    Ok(())
    //}


}


#[derive(Accounts)]
pub struct InitializeConditionalExpression<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + 8 + 1 // TODO: PDA
    )]
    conditional_expression: Account<'info, ConditionalExpression>,
    #[account(mut)]
    initializer: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeConditionalVault<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + 32 + 32
    )]
    conditional_vault: Account<'info, ConditionalVault>,
    #[account(mut)]
    initializer: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeConditionalTokenAccount<'info> {
    #[account(
        init, 
        payer = authority, 
        space = 8 + 32 + 8 + 8 + 32 
    )]
    conditional_token_account: Account<'info, ConditionalTokenAccount>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}

#[account]
pub struct ConditionalExpression {
    proposal_number: u64,
    pass_or_fail_flag: bool, // true for tokens that are redeemable-on-pass, false for tokens that are redeemable-on-fail
}

#[account]
pub struct ConditionalVault {
    conditional_expression: Pubkey,
    token_account: Pubkey,
}

#[account]
pub struct ConditionalTokenAccount {
    conditional_vault: Pubkey,
    balance: u64,
    deposited_amount: u64,
    authority: Pubkey,
}
