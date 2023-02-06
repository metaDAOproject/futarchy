use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_spl::token;

use solana_program::instruction::{AccountMeta, Instruction};

use std::borrow::Borrow;

pub mod state;
use state::*;

pub mod context;
use context::*;

pub mod error_code;
pub use error_code::ErrorCode;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod meta_dao {

    use super::*;

    pub fn initialize_meta_dao(ctx: Context<InitializeMetaDAO>) -> Result<()> {
        let meta_dao = &mut ctx.accounts.meta_dao;

        // The Meta-DAO needs an initial seed member. Otherwise, it can't
        // evaluate proposals (including ones that would add new members).
        meta_dao.members.push(ctx.accounts.seed_member.key());

        Ok(())
    }

    pub fn initialize_member(ctx: Context<InitializeMember>, name: String) -> Result<()> {
        let member = &mut ctx.accounts.member;

        member.name = name;
        member.treasury_bump = *ctx.bumps.get("treasury").unwrap();
        member.token_mint = ctx.accounts.token_mint.key();

        Ok(())
    }

    pub fn add_member(ctx: Context<AddMember>) -> Result<()> {
        let meta_dao = &mut ctx.accounts.meta_dao;
        let new_member = ctx.accounts.member.key();

        let member_already_active = meta_dao
            .members
            .iter()
            .any(|&existing_member| existing_member.key() == new_member);

        require!(!member_already_active, MemberAlreadyActive);

        meta_dao.members.push(new_member);

        Ok(())
    }

    pub fn initialize_proposal(
        ctx: Context<InitializeProposal>,
        instructions: Vec<ProposalInstruction>,
        accts: Vec<ProposalAccount>,
    ) -> Result<()> {
        let meta_dao = &ctx.accounts.meta_dao;

        for instruction in &instructions {
            match instruction.signer.kind {
                ProposalSignerKind::MetaDAO => require!(
                    instruction.signer.pubkey == meta_dao.key(),
                    InvalidMetaDAOSigner
                ),
                ProposalSignerKind::Member => require!(
                    meta_dao.members.contains(&instruction.signer.pubkey),
                    InactiveMember
                ),
            };
        }

        let proposal = &mut ctx.accounts.proposal;

        proposal.state = ProposalState::Pending;
        proposal.instructions = instructions;
        proposal.accounts = accts;

        Ok(())
    }

    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        require!(proposal.state == ProposalState::Pending, NoProposalReplay);

        proposal.state = ProposalState::Passed;

        for instruction in &proposal.instructions {
            // Collect accounts relevant to this instruction
            let mut account_metas = Vec::new();
            let mut account_infos = Vec::new();

            for i in instruction.account_indexes.iter() {
                account_metas.push(proposal.accounts[*i as usize].borrow().into());
                account_infos.push(ctx.remaining_accounts[*i as usize].clone());
            }

            let solana_instruction = Instruction {
                program_id: instruction.program_id,
                accounts: account_metas,
                data: instruction.data.clone(),
            };

            let signer_pubkey = instruction.signer.pubkey.as_ref();
            let pda_bump = &[instruction.signer.pda_bump];

            let mut seeds: Vec<&[u8]> = Vec::new();

            match instruction.signer.kind {
                ProposalSignerKind::MetaDAO => {
                    seeds.push(b"WWCACOTMICMIBMHAFTTWYGHMB");
                }
                ProposalSignerKind::Member => {
                    seeds.push(b"treasury");
                    seeds.push(signer_pubkey);
                }
            };
            seeds.push(pda_bump);
            let signer = &[&seeds[..]];

            solana_program::program::invoke_signed(&solana_instruction, &account_infos, signer)?;
        }

        Ok(())
    }

    pub fn fail_proposal(ctx: Context<FailProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        proposal.state = ProposalState::Failed;

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
        conditional_vault.pda_bump = *ctx.bumps.get("conditional_vault").unwrap();

        Ok(())
    }

    pub fn initialize_deposit_slip(
        ctx: Context<InitializeDepositSlip>,
        user: Pubkey,
    ) -> Result<()> {
        let deposit_slip = &mut ctx.accounts.deposit_slip;

        deposit_slip.user = user;
        deposit_slip.conditional_vault = ctx.accounts.conditional_vault.key();
        deposit_slip.deposited_amount = 0;

        Ok(())
    }

    pub fn mint_conditional_tokens(ctx: Context<MintConditionalTokens>, amount: u64) -> Result<()> {
        let conditional_vault = &ctx.accounts.conditional_vault;

        let seeds = &[
            b"conditional_vault",
            conditional_vault.conditional_expression.as_ref(),
            conditional_vault.underlying_token_mint.as_ref(),
            &[ctx.accounts.conditional_vault.pda_bump],
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

        let deposit_slip = &mut ctx.accounts.deposit_slip;

        deposit_slip.deposited_amount += amount;

        Ok(())
    }

    /// Called if the conditional expression evaluates to true
    pub fn redeem_conditional_tokens_for_underlying_tokens(
        ctx: Context<RedeemConditionalTokensForUnderlyingTokens>,
    ) -> Result<()> {
        let conditional_expression = &ctx.accounts.conditional_expression;
        let proposal_state = ctx.accounts.proposal.state;

        match conditional_expression.pass_or_fail_flag {
            true => require!(
                proposal_state == ProposalState::Passed,
                CantRedeemConditionalTokens
            ),
            false => require!(
                proposal_state == ProposalState::Failed,
                CantRedeemConditionalTokens
            ),
        }

        let conditional_vault = &ctx.accounts.conditional_vault;
        let seeds = &[
            b"conditional_vault",
            conditional_vault.conditional_expression.as_ref(),
            conditional_vault.underlying_token_mint.as_ref(),
            &[ctx.accounts.conditional_vault.pda_bump],
        ];
        let signer = &[&seeds[..]];

        // no partial redemptions
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

    pub fn redeem_deposit_slip_for_underlying_tokens(
        ctx: Context<RedeemDepositSlipForUnderlyingTokens>,
    ) -> Result<()> {
        Ok(())
    }
    //     let conditional_expression = &ctx.accounts.conditional_expression;
    //     let proposal_state = ctx.accounts.proposal.proposal_state;

    //     // test that expression has evaluated to false
    //     if conditional_expression.pass_or_fail_flag {
    //         require!(
    //             proposal_state == ProposalState::Failed,
    //             CantRedeemDepositAccount
    //         );
    //     } else {
    //         require!(
    //             proposal_state == ProposalState::Passed,
    //             CantRedeemDepositAccount
    //         );
    //     }

    //     let conditional_vault = &ctx.accounts.conditional_vault;
    //     let seeds = &[
    //         b"conditional-vault",
    //         conditional_vault.conditional_expression.as_ref(),
    //         conditional_vault.underlying_token_mint.as_ref(),
    //         &[ctx.accounts.conditional_vault.bump],
    //     ];


    //     let signer = &[&seeds[..]];

    //     // require!((proposal_state == Passed && conditional_expression.pass_or_fail == Fail) ||
    //     //          (proposal_state == Failed && conditional_expression.pass_or_fail == Passed));

    //     let amount = ctx.accounts.user_deposit_account.deposited_amount;

    //     (&mut ctx.accounts.user_deposit_account).deposited_amount -= amount;

    //     token::transfer(
    //         ctx.accounts
    //             .into_transfer_underlying_tokens_to_user_context()
    //             .with_signer(signer),
    //         amount,
    //     )?;

    //     Ok(())
    // }
}
