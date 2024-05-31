//! A simple program that allows users, DAOs, and multisigs to delay transaction
//! execution. May be useful in enhancing an application's decentralization
//! and/or security.

use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_lang::solana_program::instruction::Instruction;
#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;
use std::convert::Into;
use std::ops::Deref;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "timelock",
    project_url: "https://themetadao.org",
    contacts: "email:metaproph3t@protonmail.com",
    policy: "The market will decide whether we pay a bug bounty.",
    source_code: "https://github.com/metaDAOproject/solana-timelock",
    source_release: "v0",
    auditors: "None",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("tiME1hz9F5C5ZecbvE5z6Msjy8PKfTqo1UuRYXfndKF");

#[account]
pub struct Timelock {
    pub authority: Pubkey,
    pub signer_bump: u8,
    pub delay_in_slots: u64,
    pub enqueuers: Vec<Pubkey>,
}

#[account]
pub struct TransactionBatch {
    pub status: TransactionBatchStatus,
    pub transactions: Vec<Transaction>,
    pub timelock: Pubkey,
    pub enqueued_slot: u64,
    pub transaction_batch_authority: Pubkey,
    pub commitment_level: CommitmentLevel,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum CommitmentLevel {
    Soft,
    Hard,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Transaction {
    pub program_id: Pubkey,
    pub accounts: Vec<TransactionAccount>,
    pub data: Vec<u8>,
    pub did_execute: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TransactionAccount {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum TransactionBatchStatus {
    Created,
    Sealed,
    Enqueued,
    Cancelled,
    Executed,
}

#[program]
pub mod timelock {
    use super::*;

    pub fn create_timelock(
        ctx: Context<CreateTimelock>,
        authority: Pubkey,
        delay_in_slots: u64,
        enqueuers: Vec<Pubkey>
    ) -> Result<()> {
        let timelock = &mut ctx.accounts.timelock;

        timelock.authority = authority;
        timelock.delay_in_slots = delay_in_slots;
        timelock.signer_bump = ctx.bumps.timelock_signer;
        timelock.enqueuers = enqueuers;

        Ok(())
    }

    pub fn set_delay_in_slots(ctx: Context<Auth>, delay_in_slots: u64) -> Result<()> {
        let timelock = &mut ctx.accounts.timelock;

        timelock.delay_in_slots = delay_in_slots;

        Ok(())
    }

    pub fn set_authority(ctx: Context<Auth>, authority: Pubkey) -> Result<()> {
        let timelock = &mut ctx.accounts.timelock;

        timelock.authority = authority;

        Ok(())
    }

    pub fn add_enqueuer(ctx: Context<Auth>, enqueuer: Pubkey) -> Result<()> {
        let timelock = &mut ctx.accounts.timelock;

        timelock.enqueuers.push(enqueuer);

        Ok(())
    }

    pub fn create_transaction_batch(ctx: Context<CreateTransactionBatch>) -> Result<()> {
        let tx_batch = &mut ctx.accounts.transaction_batch;

        tx_batch.timelock = ctx.accounts.timelock.key();
        tx_batch.transaction_batch_authority = ctx.accounts.transaction_batch_authority.key();
        tx_batch.status = TransactionBatchStatus::Created;

        Ok(())
    }

    pub fn add_transaction(
        ctx: Context<UpdateTransactionBatch>,
        program_id: Pubkey,
        accounts: Vec<TransactionAccount>,
        data: Vec<u8>,
    ) -> Result<()> {
        let tx_batch = &mut ctx.accounts.transaction_batch;

        msg!("Current transaction batch status: {:?}", tx_batch.status);
        require!(
            tx_batch.status == TransactionBatchStatus::Created,
            TimelockError::CannotAddTransactions
        );

        let this_transaction = Transaction {
            program_id,
            accounts,
            data,
            did_execute: false,
        };

        tx_batch.transactions.push(this_transaction);

        Ok(())
    }

    pub fn seal_transaction_batch(ctx: Context<UpdateTransactionBatch>) -> Result<()> {
        let tx_batch = &mut ctx.accounts.transaction_batch;

        msg!("Current transaction batch status: {:?}", tx_batch.status);
        require!(
            tx_batch.status == TransactionBatchStatus::Created,
            TimelockError::CannotSealTransactionBatch
        );

        tx_batch.status = TransactionBatchStatus::Sealed;

        Ok(())
    }

    pub fn enqueue_transaction_batch(ctx: Context<EnqueueOrCancelTransactionBatch>) -> Result<()> {
        let commitment_level = ctx.accounts.get_commitment_level()?;

        let tx_batch = &mut ctx.accounts.transaction_batch;
        let clock = Clock::get()?;

        msg!("Current transaction batch status: {:?}", tx_batch.status);
        require!(
            tx_batch.status == TransactionBatchStatus::Sealed,
            TimelockError::CannotEnqueueTransactionBatch
        );

        tx_batch.status = TransactionBatchStatus::Enqueued;
        tx_batch.enqueued_slot = clock.slot;
        tx_batch.commitment_level = commitment_level;

        Ok(())
    }

    pub fn cancel_transaction_batch(ctx: Context<EnqueueOrCancelTransactionBatch>) -> Result<()> {
        let commitment_level = ctx.accounts.get_commitment_level()?;
        let tx_batch = &mut ctx.accounts.transaction_batch;

        if commitment_level == CommitmentLevel::Soft {
            require!(
                tx_batch.commitment_level == CommitmentLevel::Soft,
                TimelockError::InsufficientCommitmentLevel
            );
        }

        msg!("Current transaction batch status: {:?}", tx_batch.status);
        require!(
            tx_batch.status == TransactionBatchStatus::Enqueued,
            TimelockError::CannotCancelTimelock
        );

        let clock = Clock::get()?;
        let enqueued_slot = tx_batch.enqueued_slot;
        let required_delay = ctx.accounts.timelock.delay_in_slots;
        require!(
            clock.slot - enqueued_slot < required_delay,
            TimelockError::CanOnlyCancelDuringTimelockPeriod
        );

        // A fallback option that allows the timelock authority to prevent the
        // transaction batch from executing by canceling it during the timelock period.
        tx_batch.status = TransactionBatchStatus::Cancelled;

        Ok(())
    }

    pub fn execute_transaction_batch(ctx: Context<ExecuteTransactionBatch>) -> Result<()> {
        let tx_batch = &mut ctx.accounts.transaction_batch;

        msg!("Current transaction batch status: {:?}", tx_batch.status);
        require!(
            tx_batch.status == TransactionBatchStatus::Enqueued,
            TimelockError::CannotExecuteTransactions
        );

        let clock = Clock::get()?;
        let enqueued_slot = tx_batch.enqueued_slot;
        let required_delay = ctx.accounts.timelock.delay_in_slots;
        require!(
            clock.slot - enqueued_slot > required_delay,
            TimelockError::NotReady
        );

        if let Some(transaction) = tx_batch.transactions.iter_mut().find(|tx| !tx.did_execute) {
            let mut ix: Instruction = transaction.deref().into();
            for acc in ix.accounts.iter_mut() {
                if &acc.pubkey == ctx.accounts.timelock_signer.key {
                    acc.is_signer = true;
                }
            }
            let timelock_key = ctx.accounts.timelock.key();
            let seeds = &[timelock_key.as_ref(), &[ctx.accounts.timelock.signer_bump]];
            let signer = &[&seeds[..]];
            let accounts = ctx.remaining_accounts;
            solana_program::program::invoke_signed(&ix, accounts, signer)?;

            transaction.did_execute = true;
        }

        if tx_batch.transactions.iter().all(|tx| tx.did_execute) {
            tx_batch.status = TransactionBatchStatus::Executed;
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateTimelock<'info> {
    #[account(
        seeds = [timelock.key().as_ref()],
        bump,
    )]
    timelock_signer: SystemAccount<'info>,
    #[account(zero, signer)]
    timelock: Box<Account<'info, Timelock>>,
}

#[derive(Accounts)]
pub struct Auth<'info> {
    #[account(
        seeds = [timelock.key().as_ref()],
        bump = timelock.signer_bump,
    )]
    timelock_signer: Signer<'info>,
    #[account(mut)]
    timelock: Box<Account<'info, Timelock>>,
}

#[derive(Accounts)]
pub struct CreateTransactionBatch<'info> {
    transaction_batch_authority: Signer<'info>,
    timelock: Box<Account<'info, Timelock>>,
    #[account(zero, signer)]
    transaction_batch: Box<Account<'info, TransactionBatch>>,
}

#[derive(Accounts)]
pub struct UpdateTransactionBatch<'info> {
    transaction_batch_authority: Signer<'info>,
    #[account(mut, has_one=transaction_batch_authority)]
    transaction_batch: Box<Account<'info, TransactionBatch>>,
}

#[derive(Accounts)]
pub struct EnqueueOrCancelTransactionBatch<'info> {
    enqueuer_or_authority: Signer<'info>,
    timelock: Box<Account<'info, Timelock>>,
    #[account(mut, has_one = timelock)]
    transaction_batch: Box<Account<'info, TransactionBatch>>,
}

impl EnqueueOrCancelTransactionBatch<'_> {
    pub fn get_commitment_level(&self) -> Result<CommitmentLevel> {
        if self.enqueuer_or_authority.key() == self.timelock.authority {
            Ok(CommitmentLevel::Hard)
        } else {
            require!(
                self.timelock
                    .enqueuers
                    .iter()
                    .any(|enqueuer| *enqueuer == self.enqueuer_or_authority.key()),
                TimelockError::NoCommitmentLevel
            );
            Ok(CommitmentLevel::Soft)
        }
    }
}

#[derive(Accounts)]
pub struct ExecuteTransactionBatch<'info> {
    #[account(
        seeds = [timelock.key().as_ref()],
        bump = timelock.signer_bump,
    )]
    timelock_signer: SystemAccount<'info>,
    timelock: Box<Account<'info, Timelock>>,
    #[account(mut, has_one = timelock)]
    transaction_batch: Box<Account<'info, TransactionBatch>>,
}

impl From<&Transaction> for Instruction {
    fn from(tx: &Transaction) -> Instruction {
        Instruction {
            program_id: tx.program_id,
            accounts: tx.accounts.iter().map(Into::into).collect(),
            data: tx.data.clone(),
        }
    }
}

impl From<&TransactionAccount> for AccountMeta {
    fn from(account: &TransactionAccount) -> AccountMeta {
        match account.is_writable {
            false => AccountMeta::new_readonly(account.pubkey, account.is_signer),
            true => AccountMeta::new(account.pubkey, account.is_signer),
        }
    }
}

impl From<&AccountMeta> for TransactionAccount {
    fn from(account_meta: &AccountMeta) -> TransactionAccount {
        TransactionAccount {
            pubkey: account_meta.pubkey,
            is_signer: account_meta.is_signer,
            is_writable: account_meta.is_writable,
        }
    }
}

#[error_code]
pub enum TimelockError {
    #[msg("This transaction is not yet ready to be executed")]
    NotReady,
    #[msg("Can only add instructions when transaction batch status is `Created`")]
    CannotAddTransactions,
    #[msg("Can only seal the transaction batch when status is `Created`")]
    CannotSealTransactionBatch,
    #[msg("Can only enqueue the timelock running once the status is `Sealed`")]
    CannotEnqueueTransactionBatch,
    #[msg("Can only cancel the transactions if the status `Enqueued`")]
    CannotCancelTimelock,
    #[msg("Can only cancel the transactions during the timelock period")]
    CanOnlyCancelDuringTimelockPeriod,
    #[msg("Can only execute the transactions if the status is `Enqueued`")]
    CannotExecuteTransactions,
    #[msg("The approver is neither the timelock authority nor an enqueuer")]
    NoCommitmentLevel,
    #[msg("Enqueuers can't cancel transaction batches enqueued by the timelock authority")]
    InsufficientCommitmentLevel,
}
