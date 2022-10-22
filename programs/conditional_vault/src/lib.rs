use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod conditional_vault {
    use super::*;

    pub fn initialize_conditional_expression(
        ctx: Context<InitializeConditionalExpression>,
        pass_or_fail_flag: bool,
    ) -> Result<()> {
        let conditional_expression = &mut ctx.accounts.conditional_expression;

        conditional_expression.proposal = ctx.accounts.proposal.key();
        conditional_expression.pass_or_fail_flag = pass_or_fail_flag;

        Ok(())
    }

    pub fn initialize_proposal(
        ctx: Context<InitializeProposal>,
        proposal_number: u64,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        proposal.proposal_number = proposal_number;
        proposal.proposal_state = ProposalState::Pending;

        Ok(())
    }

    pub fn pass_proposal(ctx: Context<PassProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        proposal.proposal_state = ProposalState::Passed;

        Ok(())
    }

    pub fn fail_proposal(ctx: Context<FailProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        proposal.proposal_state = ProposalState::Failed;

        Ok(())
    }

    pub fn initialize_conditional_vault(ctx: Context<InitializeConditionalVault>) -> Result<()> {
        let conditional_vault = &mut ctx.accounts.conditional_vault;

        conditional_vault.conditional_expression = ctx.accounts.conditional_expression.key();
        conditional_vault.underlying_token_mint = ctx.accounts.underlying_token_mint.key();
        conditional_vault.underlying_token_account =
            ctx.accounts.vault_underlying_token_account.key();
        conditional_vault.conditional_token_mint = ctx.accounts.conditional_token_mint.key();
        conditional_vault.bump = *ctx.bumps.get("conditional_vault").unwrap();

        Ok(())
    }

    pub fn initialize_deposit_account(ctx: Context<InitializeDepositAccount>) -> Result<()> {
        let deposit_account = &mut ctx.accounts.deposit_account;

        deposit_account.depositor = ctx.accounts.depositor.key();
        deposit_account.conditional_vault = ctx.accounts.conditional_vault.key();
        deposit_account.deposited_amount = 0;

        Ok(())
    }

    pub fn mint_conditional_tokens(ctx: Context<MintConditionalTokens>, amount: u64) -> Result<()> {
        let conditional_vault = &ctx.accounts.conditional_vault;

        let seeds = &[
            b"conditional-vault",
            conditional_vault.conditional_expression.as_ref(),
            conditional_vault.underlying_token_mint.as_ref(),
            &[ctx.accounts.conditional_vault.bump],
        ];
        let signer = &[&seeds[..]];

        token::transfer(
            ctx.accounts
                .into_transfer_underlying_tokens_to_vault_context(),
            amount,
        )?;
        token::mint_to(
            ctx.accounts
                .into_mint_conditional_tokens_to_user_context()
                .with_signer(signer),
            amount,
        )?;

        let deposit_account = &mut ctx.accounts.deposit_account;

        deposit_account.deposited_amount += amount;

        Ok(())
    }

    /// Called if the conditional expression evaluates to true
    pub fn redeem_conditional_tokens_for_underlying_tokens(
        ctx: Context<RedeemConditionalTokensForUnderlyingTokens>,
    ) -> Result<()> {
        let conditional_expression = &ctx.accounts.conditional_expression;
        let proposal_state = ctx.accounts.proposal.proposal_state;

        if conditional_expression.pass_or_fail_flag {
            require!(proposal_state == ProposalState::Passed, CantRedeemConditionalTokens);
        } else {
            require!(proposal_state == ProposalState::Failed, CantRedeemConditionalTokens);
        }

        let conditional_vault = &ctx.accounts.conditional_vault;
        let seeds = &[
            b"conditional-vault",
            conditional_vault.conditional_expression.as_ref(),
            conditional_vault.underlying_token_mint.as_ref(),
            &[ctx.accounts.conditional_vault.bump],
        ];
        let signer = &[&seeds[..]];

        let amount = ctx.accounts.user_conditional_token_account.amount;

        token::burn(ctx.accounts.into_burn_conditional_tokens_context(), amount)?;

        token::transfer(
            ctx.accounts
                .into_transfer_underlying_tokens_to_user_context()
                .with_signer(signer),
            amount,
        )?;

        Ok(())
    }

    pub fn redeem_deposit_account_for_underlying_tokens(
        ctx: Context<RedeemDepositAccountForUnderlyingTokens>,
    ) -> Result<()> {
        let conditional_expression = &ctx.accounts.conditional_expression;
        let proposal_state = ctx.accounts.proposal.proposal_state;

        // test that expression has evaluated to false
        if conditional_expression.pass_or_fail_flag {
            require!(proposal_state == ProposalState::Failed, CantRedeemDepositAccount);
        } else {
            require!(proposal_state == ProposalState::Passed, CantRedeemDepositAccount);
        }

        let conditional_vault = &ctx.accounts.conditional_vault;
        let seeds = &[
            b"conditional-vault",
            conditional_vault.conditional_expression.as_ref(),
            conditional_vault.underlying_token_mint.as_ref(),
            &[ctx.accounts.conditional_vault.bump],
        ];
        let signer = &[&seeds[..]];


        // require!((proposal_state == Passed && conditional_expression.pass_or_fail == Fail) ||
        //          (proposal_state == Failed && conditional_expression.pass_or_fail == Passed));

        let amount = ctx.accounts.user_deposit_account.deposited_amount;

        (&mut ctx.accounts.user_deposit_account).deposited_amount -= amount;

        token::transfer(
            ctx.accounts
                .into_transfer_underlying_tokens_to_user_context()
                .with_signer(signer),
            amount,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(pass_or_fail_flag: bool)]
pub struct InitializeConditionalExpression<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + 32 + 1,
        seeds = [b"conditional-expression", proposal.key().as_ref(), &[u8::from(pass_or_fail_flag)]],
        bump
    )]
    conditional_expression: Account<'info, ConditionalExpression>,
    proposal: Account<'info, Proposal>,
    #[account(mut)]
    initializer: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeProposal<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + 8 + 1
    )]
    proposal: Account<'info, Proposal>,
    #[account(mut)]
    initializer: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PassProposal<'info> {
    #[account(mut)]
    proposal: Account<'info, Proposal>,
}

#[derive(Accounts)]
pub struct FailProposal<'info> {
    #[account(mut)]
    proposal: Account<'info, Proposal>,
}

#[derive(Accounts)]
pub struct InitializeConditionalVault<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + (32 * 4) + 1,
        seeds = [b"conditional-vault", conditional_expression.key().as_ref(), underlying_token_mint.key().as_ref()], // for now, only SPL tokens
        bump
    )]
    conditional_vault: Account<'info, ConditionalVault>,
    conditional_expression: Account<'info, ConditionalExpression>,
    /// SPL mint of the underlying token
    underlying_token_mint: Account<'info, Mint>,
    /// token account for the vault that matches above mint
    vault_underlying_token_account: Account<'info, TokenAccount>,
    /// SPL mint of the conditional token
    conditional_token_mint: Account<'info, Mint>,
    #[account(mut)]
    initializer: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeDepositAccount<'info> {
    #[account(
        init,
        payer = depositor,
        space = 8 + 32 + 8 + 8 + 32,
        seeds = [b"deposit-account", conditional_vault.key().as_ref(), depositor.key().as_ref()],
        bump
    )]
    deposit_account: Account<'info, DepositAccount>,
    conditional_vault: Account<'info, ConditionalVault>,
    #[account(mut)]
    depositor: Signer<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintConditionalTokens<'info> {
    conditional_vault: Account<'info, ConditionalVault>,
    token_program: Program<'info, Token>,
    #[account(mut)]
    conditional_token_mint: Account<'info, Mint>,
    user: Signer<'info>,
    #[account(mut)]
    deposit_account: Account<'info, DepositAccount>,
    #[account(mut)]
    vault_underlying_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    user_underlying_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    user_conditional_token_account: Account<'info, TokenAccount>,
}

impl<'info> MintConditionalTokens<'info> {
    fn into_transfer_underlying_tokens_to_vault_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.user_underlying_token_account.to_account_info().clone(),
            to: self
                .vault_underlying_token_account
                .to_account_info()
                .clone(),
            authority: self.user.to_account_info().clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }

    fn into_mint_conditional_tokens_to_user_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_accounts = MintTo {
            mint: self.conditional_token_mint.to_account_info().clone(),
            to: self
                .user_conditional_token_account
                .to_account_info()
                .clone(),
            authority: self.conditional_vault.to_account_info().clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct RedeemConditionalTokensForUnderlyingTokens<'info> {
    user: Signer<'info>,
    #[account(mut)]
    user_conditional_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    user_underlying_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    vault_underlying_token_account: Account<'info, TokenAccount>,
    conditional_vault: Account<'info, ConditionalVault>,
    proposal: Account<'info, Proposal>,
    token_program: Program<'info, Token>,
    conditional_expression: Account<'info, ConditionalExpression>,
    #[account(mut)]
    conditional_token_mint: Account<'info, Mint>,
}

impl<'info> RedeemConditionalTokensForUnderlyingTokens<'info> {
    fn into_burn_conditional_tokens_context(&self) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
        let cpi_accounts = Burn {
            mint: self.conditional_token_mint.to_account_info().clone(),
            from: self
                .user_conditional_token_account
                .to_account_info()
                .clone(),
            authority: self.user.to_account_info().clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }

    fn into_transfer_underlying_tokens_to_user_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .vault_underlying_token_account
                .to_account_info()
                .clone(),
            to: self.user_underlying_token_account.to_account_info().clone(),
            authority: self.conditional_vault.to_account_info().clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct RedeemDepositAccountForUnderlyingTokens<'info> {
    user: Signer<'info>,
    #[account(mut)]
    user_deposit_account: Account<'info, DepositAccount>,
    #[account(mut)]
    user_underlying_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    vault_underlying_token_account: Account<'info, TokenAccount>,
    conditional_vault: Account<'info, ConditionalVault>,
    proposal: Account<'info, Proposal>,
    token_program: Program<'info, Token>,
    conditional_expression: Account<'info, ConditionalExpression>,
}

impl<'info> RedeemDepositAccountForUnderlyingTokens<'info> {
    fn into_transfer_underlying_tokens_to_user_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .vault_underlying_token_account
                .to_account_info()
                .clone(),
            to: self.user_underlying_token_account.to_account_info().clone(),
            authority: self.conditional_vault.to_account_info().clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum ProposalState {
    Pending,
    Passed,
    Failed,
}

#[account] // will eventually be split into a separate program, just here for testing
pub struct Proposal {
    proposal_number: u64,
    proposal_state: ProposalState,
}

#[account]
pub struct ConditionalExpression {
    proposal: Pubkey,
    pass_or_fail_flag: bool, // true for tokens that are redeemable-on-pass, false for tokens that are redeemable-on-fail
}

#[account]
pub struct ConditionalVault {
    conditional_expression: Pubkey,
    underlying_token_mint: Pubkey,
    underlying_token_account: Pubkey,
    conditional_token_mint: Pubkey,
    bump: u8,
}

#[account]
pub struct DepositAccount {
    conditional_vault: Pubkey,
    depositor: Pubkey,
    deposited_amount: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Conditional expression needs to evaluate to true before conditional tokens can be redeemed for underlying tokens")]
    CantRedeemConditionalTokens,
    #[msg("Conditional expression needs to evaluate to false before deposit accounts can be redeemed for underlying tokens")]
    CantRedeemDepositAccount,
}