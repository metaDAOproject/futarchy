use anchor_lang::prelude::*;

declare_id!("AfRdKx58cmVzSHFKM7AjiEbxeidMrFs1KWghtwGJSSsE");

const DEFAULT_SPACE: usize = 1000;
const INCREASE_IN_SPACE: usize = 100;

#[account]
pub struct Metadata {
    dao_treasury: Pubkey,
    delegate: Pubkey,
    items: Vec<MetadataItem>,
    creation_slot: u64,
    last_updated_slot: u64,
}

#[account]
pub struct MetadataItem {
    update_authority: Pubkey,
    last_updated_slot: u64,
    key: String,
    value: Vec<u8>,
}

#[program]
pub mod metadata {
    use super::*;
    // Instruction to create a new Metadata object
    pub fn create_metadata(ctx: Context<CreateMetadata>) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        metadata.dao_treasury = ctx.accounts.dao_treasury.key();
        metadata.delegate = ctx.accounts.delegate.key();
        metadata.creation_slot = Clock::get()?.slot;
        metadata.last_updated_slot = Clock::get()?.slot;
        metadata.items = Vec::new();
        Ok(())
    }

    pub fn increase_metadata_account_size(
        _ctx: Context<IncreaseMetadataAccountSize>,
    ) -> Result<()> {
        Ok(())
    }

    pub fn set_delegate(ctx: Context<SetDelegate>) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        metadata.delegate = ctx.accounts.new_delegate.key();
        metadata.last_updated_slot = Clock::get()?.slot;
        Ok(())
    }

    // Instruction to add a new MetadataItem
    pub fn create_metadata_item(
        ctx: Context<ModifyMetadata>,
        key: String,
        value: Vec<u8>,
    ) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        require!(
            metadata.items.iter().all(|item| item.key != key),
            ErrorCode::DuplicateKey
        );
        let item = MetadataItem {
            update_authority: metadata.delegate,
            last_updated_slot: Clock::get()?.slot,
            key,
            value,
        };
        metadata.items.push(item);
        metadata.last_updated_slot = Clock::get()?.slot;
        Ok(())
    }

    // Instruction to delete a MetadataItem
    pub fn delete_metadata_item(ctx: Context<ModifyMetadata>, key: String) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        let current_slot = Clock::get()?.slot;
        if let Some(item) = metadata.items.iter_mut().find(|item| item.key == key) {
            require_gt!(
                current_slot,
                item.last_updated_slot,
                ErrorCode::InvalidOperationInCurrentSlot
            );
            metadata.items.retain(|item| item.key != key);
            metadata.last_updated_slot = Clock::get()?.slot;
        } else {
            msg!("Key: {}", key);
            return Err(error!(ErrorCode::KeyNotFound));
        }
        Ok(())
    }

    // Instruction to overwrite data on an existing MetadataItem
    pub fn write_metadata_item(
        ctx: Context<ModifyMetadata>,
        key: String,
        new_value: Vec<u8>,
    ) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        let current_slot = Clock::get()?.slot;
        if let Some(item) = metadata.items.iter_mut().find(|item| item.key == key) {
            require_gt!(
                current_slot,
                item.last_updated_slot,
                ErrorCode::InvalidOperationInCurrentSlot
            );
            item.value = new_value;
            item.last_updated_slot = current_slot;
            metadata.last_updated_slot = current_slot;
        } else {
            msg!("Key: {}", key);
            return Err(error!(ErrorCode::KeyNotFound));
        }
        Ok(())
    }

    // Instruction to append data to an existing MetadataItem
    pub fn append_metadata_item(
        ctx: Context<ModifyMetadata>,
        key: String,
        additional_value: Vec<u8>,
    ) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        let current_slot = Clock::get()?.slot;
        if let Some(item) = metadata.items.iter_mut().find(|item| item.key == key) {
            require_gt!(
                current_slot,
                item.last_updated_slot,
                ErrorCode::InvalidOperationInCurrentSlot
            );
            item.value.extend(additional_value);
            item.last_updated_slot = current_slot;
            metadata.last_updated_slot = current_slot;
        } else {
            msg!("Key: {}", key);
            return Err(error!(ErrorCode::KeyNotFound));
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateMetadata<'info> {
    #[account(init, payer = payer, seeds = [dao_treasury.key().as_ref()], bump, space = 8 + DEFAULT_SPACE)]
    pub metadata: Account<'info, Metadata>,
    pub dao_treasury: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: This is the metadata delegate account, it only ever signs
    pub delegate: UncheckedAccount<'info>,
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
pub struct SetDelegate<'info> {
    #[account(mut, has_one = dao_treasury)]
    pub metadata: Account<'info, Metadata>,
    pub dao_treasury: Signer<'info>,
    /// CHECK: This is the metadata delegate account, it only ever signs
    pub new_delegate: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ModifyMetadata<'info> {
    #[account(mut, has_one = delegate)]
    pub metadata: Account<'info, Metadata>,
    pub delegate: Signer<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The provided metadata key already exists.")]
    DuplicateKey,
    #[msg("Operation cannot be performed on an item updated in the current slot.")]
    InvalidOperationInCurrentSlot,
    #[msg("The specified key was not found.")]
    KeyNotFound,
}
