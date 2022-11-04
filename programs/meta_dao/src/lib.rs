use anchor_lang::prelude::*;
use anchor_spl::token;

pub mod state;
use state::*;

pub mod context;
use context::*;

pub mod error_code;
use error_code::ErrorCode;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod meta_dao {
    use super::*;

    pub fn initialize_meta_dao(
        _ctx: Context<InitializeMetaDAO>,
    ) -> Result<()> {
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

    /// Create an immutable conditional expression by combining a proposal and a
    /// `pass_or_fail_flag`.
    ///
    /// Because conditional expressions are PDAs and are deterministically derived
    /// from their proposal and pass_or_fail_flag, there can only exist one canonical
    /// conditional expression for a specified proposal and pass_or_fail_flag.
    ///
    /// If `pass_or_fail_flag` is true, the expression will evaluate to true if the
    /// proposal passes and false if it fails. If the flag is set to false, the
    /// expression will evalaute to false if the proposal passes and true if it fails.
    pub fn initialize_conditional_expression(
        ctx: Context<InitializeConditionalExpression>,
        pass_or_fail_flag: bool,
    ) -> Result<()> {
        let conditional_expression = &mut ctx.accounts.conditional_expression;

        conditional_expression.proposal = ctx.accounts.proposal.key();
        conditional_expression.pass_or_fail_flag = pass_or_fail_flag;

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
            require!(
                proposal_state == ProposalState::Passed,
                CantRedeemConditionalTokens
            );
        } else {
            require!(
                proposal_state == ProposalState::Failed,
                CantRedeemConditionalTokens
            );
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
            require!(
                proposal_state == ProposalState::Failed,
                CantRedeemDepositAccount
            );
        } else {
            require!(
                proposal_state == ProposalState::Passed,
                CantRedeemDepositAccount
            );
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
