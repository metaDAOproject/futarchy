use anchor_lang::prelude::*;

declare_id!("AfRdKx58cmVzSHFKM7AjiEbxeidMrFs1KWghtwGJSSsE");

#[account]
pub struct Metadata {
    dao_treasury: Pubkey,
    // TODO: dao_treasury_bump probably
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
    // Additional UI-relevant fields can be added here, e.g. a content_field enum
}

#[program]
pub mod metadata {
    use super::*;
    // Instruction to create a new Metadata object
    pub fn create_metadata(ctx: Context<CreateMetadata>, delegate: Pubkey) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        metadata.dao_treasury = *ctx.accounts.dao_treasury.key;
        metadata.delegate = delegate;
        metadata.creation_slot = Clock::get()?.slot;
        metadata.last_updated_slot = Clock::get()?.slot;
        metadata.items = Vec::new();
        Ok(())
    }

    pub fn set_delegate(ctx: Context<SetDelegate>, new_delegate: Pubkey) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        metadata.delegate = new_delegate;
        metadata.last_updated_slot = Clock::get()?.slot;
        Ok(())
    }

    // Instruction to add a new MetadataItem
    pub fn add_metadata_item(
        ctx: Context<ModifyMetadata>,
        key: String,
        value: Vec<u8>,
    ) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        require!(!metadata.items.iter().any(|item| item.key == key), ErrorCode::DuplicateKey);
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
        metadata.items.retain(|item| item.key != key);
        metadata.last_updated_slot = Clock::get()?.slot;
        Ok(())
    }

    // Instruction to write data to an existing MetadataItem
    // Assumes the existence of a helper method to find the item by key
    pub fn write_metadata_item(
        ctx: Context<ModifyMetadata>,
        key: String,
        new_value: Vec<u8>,
    ) -> Result<()> {
        let metadata = &mut ctx.accounts.metadata;
        if let Some(item) = metadata.items.iter_mut().find(|item| item.key == key) {
            item.value = new_value;
            item.last_updated_slot = Clock::get()?.slot;
            metadata.last_updated_slot = Clock::get()?.slot;
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
        if let Some(item) = metadata.items.iter_mut().find(|item| item.key == key) {
            item.value.extend(additional_value);
            item.last_updated_slot = Clock::get()?.slot;
            metadata.last_updated_slot = Clock::get()?.slot;
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateMetadata<'info> {
    #[account(init, payer = payer, seeds = [dao_treasury.key().as_ref()], bump, space = 8 + 8000)]
    pub metadata: Account<'info, Metadata>,
    pub dao_treasury: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: This is the metadata delegate account, it only ever signs
    pub delegate: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetDelegate<'info> {
    #[account(mut, has_one = dao_treasury)]
    pub metadata: Account<'info, Metadata>,
    pub dao_treasury: Signer<'info>,
    /// CHECK: This is the metadata delegate account, it only ever signs
    pub delegate: UncheckedAccount<'info>,
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
}