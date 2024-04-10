use anchor_lang::prelude::*;
use autocrat_v0::DAO;

declare_id!("DATAwTH3mTx43ekTTYoNXL2Z8EAMTGwENkJab7tKXHok");

const DEFAULT_SPACE: usize = 1_000;
const INCREASE_IN_SPACE: usize = 500;
const MAX_SPACE: usize = 4_000; // 8kb is probably the true account size limit, but 4kb is more reasonable for now

#[account]
pub struct Metadata {
    dao: Pubkey,
    treasury: Pubkey,
    delegate: Pubkey,
    creation_slot: u64,
    last_updated_slot: u64,
    items: Vec<MetadataItem>,
}

impl Metadata {
    fn update_delegate(&mut self, new_delegate: Pubkey) -> Result<()> {
        self.delegate = new_delegate;
        self.last_updated_slot = Clock::get()?.slot;
         Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct MetadataItem {
    // update_authority: Pubkey,
    last_updated_slot: u64,
    key: String,
    value: Vec<u8>,
}

#[program]
pub mod metadata {
    use super::*;
    // Instruction to initialize a new Metadata object
    pub fn initialize_metadata(ctx: Context<InitializeMetadata>) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        let current_slot = Clock::get()?.slot;
        metadata.set_inner(Metadata {
            dao: ctx.accounts.dao.key(),
            treasury: ctx.accounts.treasury.key(),
            delegate: ctx.accounts.delegate.key(),
            creation_slot: current_slot,
            last_updated_slot: current_slot,
            items: Vec::new(),
        });
        Ok(())
    }

    pub fn increase_metadata_account_size(
        ctx: Context<IncreaseMetadataAccountSize>,
    ) -> Result<()> {
        let metadata = &ctx.accounts.metadata;
        let current_size = metadata.to_account_info().data_len();
        // require(current size <= Max_space)
        require_gte!(MAX_SPACE, current_size, MetadataError::MaxSizeExceeded);
        Ok(())
    }

    pub fn dao_update_delegate(ctx: Context<DaoUpdateDelegate>) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        metadata.delegate = ctx.accounts.new_delegate.key();
        metadata.update_delegate(ctx.accounts.new_delegate.key())
    }

    pub fn delegate_update_delegate(ctx: Context<DelegateUpdateDelegate>) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        metadata.update_delegate(ctx.accounts.new_delegate.key())
    }

    pub fn initialize_metadata_item(
        ctx: Context<UpdateMetadata>,
        key: String,
        value: Vec<u8>,
    ) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        require!(
            metadata.items.iter().all(|item| item.key != key),
            MetadataError::DuplicateKey
        );
        let item = MetadataItem {
            // update_authority: metadata.delegate,
            last_updated_slot: Clock::get()?.slot,
            key,
            value,
        };
        metadata.items.push(item);
        metadata.last_updated_slot = Clock::get()?.slot;
        Ok(())
    }

    pub fn delete_metadata_item(ctx: Context<UpdateMetadata>, key: String) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        let current_slot = Clock::get()?.slot;
        if let Some(item) = metadata.items.iter_mut().find(|item| item.key == key) {
            require_gt!(
                current_slot,
                item.last_updated_slot,
                MetadataError::InvalidOperationInCurrentSlot
            );
            metadata.items.retain(|item| item.key != key);
            metadata.last_updated_slot = Clock::get()?.slot;
        } else {
            msg!("Key: {}", key);
            return Err(error!(MetadataError::KeyNotFound));
        }
        Ok(())
    }

    pub fn write_metadata_item(
        ctx: Context<UpdateMetadata>,
        key: String,
        new_value: Vec<u8>,
    ) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        let current_slot = Clock::get()?.slot;
        if let Some(item) = metadata.items.iter_mut().find(|item| item.key == key) {
            require_gt!(
                current_slot,
                item.last_updated_slot,
                MetadataError::InvalidOperationInCurrentSlot
            );
            item.value = new_value;
            item.last_updated_slot = current_slot;
            metadata.last_updated_slot = current_slot;
        } else {
            msg!("Key: {}", key);
            return Err(error!(MetadataError::KeyNotFound));
        }
        Ok(())
    }

    pub fn append_metadata_item(
        ctx: Context<UpdateMetadata>,
        key: String,
        additional_value: Vec<u8>,
    ) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        let current_slot = Clock::get()?.slot;
        if let Some(item) = metadata.items.iter_mut().find(|item| item.key == key) {
            require_gt!(
                current_slot,
                item.last_updated_slot,
                MetadataError::InvalidOperationInCurrentSlot
            );
            item.value.extend(additional_value);
            item.last_updated_slot = current_slot;
            metadata.last_updated_slot = current_slot;
        } else {
            msg!("Key: {}", key);
            return Err(error!(MetadataError::KeyNotFound));
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMetadata<'info> {
    // PDA restricts metadata accounts to one per DAO
    #[account(init, payer = payer, seeds = [dao.key().as_ref()], bump, space = DEFAULT_SPACE)]
    pub metadata: Account<'info, Metadata>,
    pub treasury: SystemAccount<'info>,
    // Requires the DAO to exist, so InitializeMetadata needs to be called in the same transaction as InitializeDAO
    #[account(has_one = treasury)]
    pub dao: Account<'info, DAO>,
    /// CHECK: This is the metadata delegate account, it only ever signs
    pub delegate: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct IncreaseMetadataAccountSize<'info> {
    #[account(
        mut,
        has_one = delegate,
        realloc = metadata.to_account_info().data_len() + INCREASE_IN_SPACE,
        realloc::payer = payer,
        realloc::zero = false,
    )]
    pub metadata: Account<'info, Metadata>,
    pub delegate: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DaoUpdateDelegate<'info> {
    #[account(mut, has_one = treasury)]
    pub metadata: Account<'info, Metadata>,
    pub treasury: Signer<'info>,
    /// CHECK: This is the metadata delegate account, it only ever signs
    pub new_delegate: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct DelegateUpdateDelegate<'info> {
    #[account(mut, has_one = delegate)]
    pub metadata: Account<'info, Metadata>,
    pub delegate: Signer<'info>,
    /// CHECK: This is the metadata delegate account, it only ever signs
    pub new_delegate: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    #[account(mut, has_one = delegate)]
    pub metadata: Account<'info, Metadata>,
    pub delegate: Signer<'info>,
}

#[error_code]
pub enum MetadataError {
    #[msg("The provided metadata key already exists.")]
    DuplicateKey,
    #[msg("Operation cannot be performed on an item updated in the current slot.")]
    InvalidOperationInCurrentSlot,
    #[msg("The specified key was not found.")]
    KeyNotFound,
    #[msg("The requested size exceeds the maximum allowed size.")]
    MaxSizeExceeded,   
}
