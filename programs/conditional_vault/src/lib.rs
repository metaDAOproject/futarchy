use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer},
};

declare_id!("4SrgFQyrvEYB3GupUaEjoULXCmzHCcAcTffHbpppycip");

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VaultStatus {
    Active,
    Finalized,
    Reverted,
}

#[account]
pub struct ConditionalVault {
    pub status: VaultStatus,
    /// The account that can either finalize the vault to make conditional tokens
    /// redeemable for underlying tokens or revert the vault to make deposit
    /// slips redeemable for underlying tokens.
    pub settlement_authority: Pubkey,
    /// The mint of the tokens that are deposited into the vault.
    pub underlying_token_mint: Pubkey,
    /// The vault's storage account for deposited funds.
    pub underlying_token_account: Pubkey,
    pub conditional_token_mint: Pubkey,
    pub pda_bump: u8,
}

#[account]
pub struct DepositSlip {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub deposited_amount: u64,
}

// done in a macro instead of function bcuz lifetimes
macro_rules! generate_vault_seeds {
    ($vault:expr) => {{
        &[
            b"conditional_vault",
            $vault.settlement_authority.as_ref(),
            $vault.underlying_token_mint.as_ref(),
            &[$vault.pda_bump],
        ]
    }};
}

#[program]
pub mod conditional_vault {
    use super::*;

    pub fn initialize_conditional_vault(
        ctx: Context<InitializeConditionalVault>,
        settlement_authority: Pubkey,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        vault.status = VaultStatus::Active;
        vault.settlement_authority = settlement_authority;
        vault.underlying_token_mint = ctx.accounts.underlying_token_mint.key();
        vault.underlying_token_account = ctx.accounts.vault_underlying_token_account.key();
        vault.conditional_token_mint = ctx.accounts.conditional_token_mint.key();
        vault.pda_bump = *ctx.bumps.get("vault").unwrap();

        Ok(())
    }

    pub fn settle_conditional_vault(
        ctx: Context<SettleConditionalVault>,
        new_status: VaultStatus,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.status = new_status;

        Ok(())
    }

    pub fn initialize_deposit_slip(
        ctx: Context<InitializeDepositSlip>,
        authority: Pubkey,
    ) -> Result<()> {
        let deposit_slip = &mut ctx.accounts.deposit_slip;

        deposit_slip.authority = authority;
        deposit_slip.vault = ctx.accounts.vault.key();
        deposit_slip.deposited_amount = 0;

        Ok(())
    }

    pub fn mint_conditional_tokens(ctx: Context<MintConditionalTokens>, amount: u64) -> Result<()> {
        let accs = &ctx.accounts;

        let pre_user_conditional_balance = 
            accs.user_conditional_token_account.amount;
        let pre_vault_underlying_balance = 
            accs.vault_underlying_token_account.amount;

        let vault = &accs.vault;

        let seeds = generate_vault_seeds!(vault);
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new(
                accs.token_program.to_account_info(),
                Transfer {
                    from: accs.user_underlying_token_account.to_account_info(),
                    to: accs.vault_underlying_token_account.to_account_info(),
                    authority: accs.authority.to_account_info(),
                },
            ),
            amount,
        )?;
        token::mint_to(
            CpiContext::new_with_signer(
                accs.token_program.to_account_info(),
                MintTo {
                    mint: accs.conditional_token_mint.to_account_info(),
                    to: accs.user_conditional_token_account.to_account_info(),
                    authority: accs.vault.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        ctx.accounts.user_conditional_token_account.reload()?;
        ctx.accounts.vault_underlying_token_account.reload()?;

        let deposit_slip = &mut ctx.accounts.deposit_slip;

        deposit_slip.deposited_amount += amount;

        let post_user_conditional_balance = ctx.accounts.user_conditional_token_account.amount;
        let post_vault_underlying_balance = ctx.accounts.vault_underlying_token_account.amount;

        // Only the paranoid survive ;)
        assert!(post_vault_underlying_balance == pre_vault_underlying_balance + amount);
        assert!(post_user_conditional_balance == pre_user_conditional_balance + amount);

        Ok(())
    }

    pub fn redeem_conditional_tokens_for_underlying_tokens(
        ctx: Context<RedeemConditionalTokensForUnderlyingTokens>,
    ) -> Result<()> {
        let accs = &ctx.accounts;
        let vault = &accs.vault;

        let seeds = generate_vault_seeds!(vault);
        let signer = &[&seeds[..]];

        // no partial redemptions
        let amount = accs.user_conditional_token_account.amount;

        token::burn(
            CpiContext::new(
                accs.token_program.to_account_info(),
                Burn {
                    mint: accs.conditional_token_mint.to_account_info(),
                    from: accs.user_conditional_token_account.to_account_info(),
                    authority: accs.authority.to_account_info(),
                },
            ),
            amount,
        )?;

        token::transfer(
            CpiContext::new_with_signer(
                accs.token_program.to_account_info(),
                Transfer {
                    from: accs.vault_underlying_token_account.to_account_info(),
                    to: accs.user_underlying_token_account.to_account_info(),
                    authority: accs.vault.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        Ok(())
    }

    pub fn redeem_deposit_slip_for_underlying_tokens(
        ctx: Context<RedeemDepositSlipForUnderlyingTokens>,
    ) -> Result<()> {
        let deposit_slip = &mut ctx.accounts.user_deposit_slip;
        let vault = &ctx.accounts.vault;

        let seeds = generate_vault_seeds!(vault);
        let signer = &[&seeds[..]];

        let amount = deposit_slip.deposited_amount;

        deposit_slip.deposited_amount -= amount;

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx
                        .accounts
                        .vault_underlying_token_account
                        .to_account_info(),
                    to: ctx.accounts.user_underlying_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(settlement_authority: Pubkey)]
pub struct InitializeConditionalVault<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<VaultStatus>() + (4 * 32) + 1,
        seeds = [
            b"conditional_vault", 
            settlement_authority.key().as_ref(),
            underlying_token_mint.key().as_ref()
        ],
        bump
    )]
    pub vault: Account<'info, ConditionalVault>,
    pub underlying_token_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        mint::authority = vault,
        mint::freeze_authority = vault,
        mint::decimals = underlying_token_mint.decimals
    )]
    pub conditional_token_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        associated_token::authority = vault,
        associated_token::mint = underlying_token_mint
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleConditionalVault<'info> {
    pub settlement_authority: Signer<'info>,
    #[account(
        mut,
        has_one = settlement_authority,
        constraint = vault.status == VaultStatus::Active @ ErrorCode::VaultAlreadySettled
    )]
    pub vault: Account<'info, ConditionalVault>,
}

#[derive(Accounts)]
#[instruction(authority: Pubkey)]
pub struct InitializeDepositSlip<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 8,
        seeds = [b"deposit_slip", vault.key().as_ref(), authority.key().as_ref()],
        bump
    )]
    pub deposit_slip: Account<'info, DepositSlip>,
    pub vault: Account<'info, ConditionalVault>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct MintConditionalTokens<'info> {
    #[account(
        has_one = conditional_token_mint @ ErrorCode::InvalidConditionalTokenMint,
    )]
    pub vault: Account<'info, ConditionalVault>,
    #[account(mut)]
    pub conditional_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = vault_underlying_token_account.key() == vault.underlying_token_account @  ErrorCode::InvalidVaultUnderlyingTokenAccount
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        has_one = vault
    )]
    pub deposit_slip: Account<'info, DepositSlip>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = vault.underlying_token_mint,
        constraint = user_underlying_token_account.amount >= amount @ ErrorCode::InsufficientUnderlyingTokens
    )]
    pub user_underlying_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = conditional_token_mint
    )]
    pub user_conditional_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RedeemConditionalTokensForUnderlyingTokens<'info> {
    #[account(
        has_one = conditional_token_mint @ ErrorCode::InvalidConditionalTokenMint,
        constraint = vault.status == VaultStatus::Finalized @ ErrorCode::CantRedeemConditionalTokens
    )]
    pub vault: Account<'info, ConditionalVault>,
    #[account(mut)]
    pub conditional_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = vault_underlying_token_account.key() == vault.underlying_token_account @ ErrorCode::InvalidVaultUnderlyingTokenAccount
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = conditional_token_mint
    )]
    pub user_conditional_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = vault.underlying_token_mint
    )]
    pub user_underlying_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RedeemDepositSlipForUnderlyingTokens<'info> {
    #[account(
        constraint = vault.status == VaultStatus::Reverted @ ErrorCode::CantRedeemDepositSlip
    )]
    pub vault: Account<'info, ConditionalVault>,
    #[account(
        mut,
        constraint = vault_underlying_token_account.key() == vault.underlying_token_account @ ErrorCode::InvalidVaultUnderlyingTokenAccount
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        has_one = vault,
        close = authority
    )]
    pub user_deposit_slip: Account<'info, DepositSlip>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = vault_underlying_token_account.mint
    )]
    pub user_underlying_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient underlying token balance to mint this amount of conditional tokens")]
    InsufficientUnderlyingTokens,
    #[msg("This `vault_underlying_token_account` is not this vault's `underlying_token_account`")]
    InvalidVaultUnderlyingTokenAccount,
    #[msg("This `conditional_token_mint` is not this vault's `conditional_token_mint`")]
    InvalidConditionalTokenMint,
    #[msg("Vault needs to be settled as finalized before users can redeem conditional tokens for underlying tokens")]
    CantRedeemConditionalTokens,
    #[msg("Vault needs to be settled as reverted before users can redeem deposit slips for underlying tokens")]
    CantRedeemDepositSlip,
    #[msg("Once a vault has been settled, its status as either finalized or reverted cannot be changed")]
    VaultAlreadySettled,
}
