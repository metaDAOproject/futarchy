use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount, Mint};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod conditional_vault {
    use super::*;

    pub fn initialize_conditional_expression(
        ctx: Context<InitializeConditionalExpression>,
        proposal_number: u64,
        pass_or_fail_flag: bool,
    ) -> Result<()> {
        let conditional_expression = &mut ctx.accounts.conditional_expression;

        conditional_expression.proposal_number = proposal_number;
        conditional_expression.pass_or_fail_flag = pass_or_fail_flag;

        Ok(())
    }

    pub fn initialize_conditional_vault(ctx: Context<InitializeConditionalVault>) -> Result<()> {
        let conditional_vault = &mut ctx.accounts.conditional_vault;

        conditional_vault.conditional_expression = ctx.accounts.conditional_expression.key();
        conditional_vault.spl_token_account = ctx.accounts.spl_token_account.key();
        conditional_vault.spl_mint = ctx.accounts.spl_mint.key();

        Ok(())
    }

    pub fn initialize_conditional_token_account(
        ctx: Context<InitializeConditionalTokenAccount>,
    ) -> Result<()> {
        let conditional_token_account = &mut ctx.accounts.conditional_token_account;

        conditional_token_account.authority = ctx.accounts.authority.key();
        conditional_token_account.conditional_vault = ctx.accounts.conditional_vault.key();

        conditional_token_account.balance = 0;
        conditional_token_account.deposited_amount = 0;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(proposal_number: u64, pass_or_fail_flag: bool)]
pub struct InitializeConditionalExpression<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + 8 + 1,
        seeds = [b"conditional-expression", proposal_number.to_be_bytes().as_ref(), &[u8::from(pass_or_fail_flag)]],
        bump
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
        space = 8 + 32 + 32 + 32,
        seeds = [b"conditional-vault", conditional_expression.key().as_ref(), spl_mint.key().as_ref()], // for now, only SPL tokens
        bump
    )]
    conditional_vault: Account<'info, ConditionalVault>,
    conditional_expression: Account<'info, ConditionalExpression>,
    spl_mint: Account<'info, Mint>,
    spl_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    initializer: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeConditionalTokenAccount<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 32,
        seeds = [b"conditional-token-account", authority.key().as_ref(), conditional_vault.key().as_ref()],
        bump
    )]
    conditional_token_account: Account<'info, ConditionalTokenAccount>,
    conditional_vault: Account<'info, ConditionalVault>,
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
    spl_mint: Pubkey,
    spl_token_account: Pubkey,
}

#[account]
pub struct ConditionalTokenAccount {
    conditional_vault: Pubkey,
    balance: u64,
    deposited_amount: u64,
    authority: Pubkey,
}
