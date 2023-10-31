use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer},
};
#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "conditional_vault",
    project_url: "https://themetadao.org",
    contacts: "email:metaproph3t@protonmail.com",
    policy: "The market will decide whether we pay a bug bounty.",
    source_code: "https://github.com/metaDAOproject/meta-dao",
    source_release: "v0",
    auditors: "None",
    acknowledgements: "DCF = (CF1 / (1 + r)^1) + (CF2 / (1 + r)^2) + ... (CFn / (1 + r)^n)"
}

declare_id!("vaU1tVLj8RFk7mNj1BxqgAsMKKaL8UvEUHvU3tdbZPe");

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
    /// A nonce to allow a single account to be the settlement authority of multiple
    /// vaults with the same underlying token mints.
    pub nonce: u64,
    /// The vault's storage account for deposited funds.
    pub underlying_token_account: Pubkey,
    pub conditional_on_finalize_token_mint: Pubkey,
    pub conditional_on_revert_token_mint: Pubkey,
    pub pda_bump: u8,
}

// done in a macro instead of function bcuz lifetimes
macro_rules! generate_vault_seeds {
    ($vault:expr) => {{
        &[
            b"conditional_vault",
            $vault.settlement_authority.as_ref(),
            $vault.underlying_token_mint.as_ref(),
            &$vault.nonce.to_le_bytes(),
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
        nonce: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        vault.status = VaultStatus::Active;
        vault.settlement_authority = settlement_authority;
        vault.underlying_token_mint = ctx.accounts.underlying_token_mint.key();
        vault.nonce = nonce;
        vault.underlying_token_account = ctx.accounts.vault_underlying_token_account.key();
        vault.conditional_on_finalize_token_mint =
            ctx.accounts.conditional_on_finalize_token_mint.key();
        vault.conditional_on_revert_token_mint =
            ctx.accounts.conditional_on_revert_token_mint.key();
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

    pub fn mint_conditional_tokens(ctx: Context<MintConditionalTokens>, amount: u64) -> Result<()> {
        let accs = &ctx.accounts;

        let pre_user_conditional_on_finalize_balance =
            accs.user_conditional_on_finalize_token_account.amount;
        let pre_user_conditional_on_revert_balance =
            accs.user_conditional_on_revert_token_account.amount;
        let pre_vault_underlying_balance = accs.vault_underlying_token_account.amount;
        let pre_finalize_mint_supply = accs.conditional_on_finalize_token_mint.supply;
        let pre_revert_mint_supply = accs.conditional_on_revert_token_mint.supply;

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
                    mint: accs.conditional_on_finalize_token_mint.to_account_info(),
                    to: accs
                        .user_conditional_on_finalize_token_account
                        .to_account_info(),
                    authority: accs.vault.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        token::mint_to(
            CpiContext::new_with_signer(
                accs.token_program.to_account_info(),
                MintTo {
                    mint: accs.conditional_on_revert_token_mint.to_account_info(),
                    to: accs
                        .user_conditional_on_revert_token_account
                        .to_account_info(),
                    authority: accs.vault.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        ctx.accounts
            .user_conditional_on_finalize_token_account
            .reload()?;
        ctx.accounts
            .user_conditional_on_revert_token_account
            .reload()?;
        ctx.accounts.vault_underlying_token_account.reload()?;
        ctx.accounts.conditional_on_finalize_token_mint.reload()?;
        ctx.accounts.conditional_on_revert_token_mint.reload()?;

        let post_user_conditional_on_finalize_balance = ctx
            .accounts
            .user_conditional_on_finalize_token_account
            .amount;
        let post_user_conditional_on_revert_balance =
            ctx.accounts.user_conditional_on_revert_token_account.amount;
        let post_vault_underlying_balance = ctx.accounts.vault_underlying_token_account.amount;
        let post_finalize_mint_supply = ctx.accounts.conditional_on_finalize_token_mint.supply;
        let post_revert_mint_supply = ctx.accounts.conditional_on_revert_token_mint.supply;

        // Only the paranoid survive ;)
        assert!(post_vault_underlying_balance == pre_vault_underlying_balance + amount);
        assert!(
            post_user_conditional_on_finalize_balance
                == pre_user_conditional_on_finalize_balance + amount
        );
        assert!(
            post_user_conditional_on_revert_balance
                == pre_user_conditional_on_revert_balance + amount
        );
        assert!(post_finalize_mint_supply == pre_finalize_mint_supply + amount);
        assert!(post_revert_mint_supply == pre_revert_mint_supply + amount);

        Ok(())
    }

    pub fn redeem_conditional_tokens_for_underlying_tokens(
        ctx: Context<RedeemConditionalTokensForUnderlyingTokens>,
    ) -> Result<()> {
        let accs = &ctx.accounts;

        // storing some numbers for later invariant checks
        let pre_vault_underlying_balance = accs.vault_underlying_token_account.amount;
        let pre_finalize_mint_supply = accs.conditional_on_finalize_token_mint.supply;
        let pre_revert_mint_supply = accs.conditional_on_revert_token_mint.supply;

        let vault = &accs.vault;
        let vault_status = vault.status;

        let seeds = generate_vault_seeds!(vault);
        let signer = &[&seeds[..]];

        let conditional_on_finalize_balance =
            accs.user_conditional_on_finalize_token_account.amount;
        let conditional_on_revert_balance = accs.user_conditional_on_revert_token_account.amount;

        // burn everything for good measure
        token::burn(
            CpiContext::new(
                accs.token_program.to_account_info(),
                Burn {
                    mint: accs.conditional_on_finalize_token_mint.to_account_info(),
                    from: accs
                        .user_conditional_on_finalize_token_account
                        .to_account_info(),
                    authority: accs.authority.to_account_info(),
                },
            ),
            conditional_on_finalize_balance,
        )?;

        token::burn(
            CpiContext::new(
                accs.token_program.to_account_info(),
                Burn {
                    mint: accs.conditional_on_revert_token_mint.to_account_info(),
                    from: accs
                        .user_conditional_on_revert_token_account
                        .to_account_info(),
                    authority: accs.authority.to_account_info(),
                },
            ),
            conditional_on_revert_balance,
        )?;

        if vault_status == VaultStatus::Finalized {
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
                conditional_on_finalize_balance,
            )?;
        } else {
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
                conditional_on_revert_balance,
            )?;
        }

        ctx.accounts
            .user_conditional_on_finalize_token_account
            .reload()?;
        ctx.accounts
            .user_conditional_on_revert_token_account
            .reload()?;
        ctx.accounts.vault_underlying_token_account.reload()?;
        ctx.accounts.conditional_on_finalize_token_mint.reload()?;
        ctx.accounts.conditional_on_revert_token_mint.reload()?;

        let post_user_conditional_on_finalize_balance = ctx
            .accounts
            .user_conditional_on_finalize_token_account
            .amount;
        let post_user_conditional_on_revert_balance =
            ctx.accounts.user_conditional_on_revert_token_account.amount;
        let post_vault_underlying_balance = ctx.accounts.vault_underlying_token_account.amount;
        let post_finalize_mint_supply = ctx.accounts.conditional_on_finalize_token_mint.supply;
        let post_revert_mint_supply = ctx.accounts.conditional_on_revert_token_mint.supply;

        assert!(post_user_conditional_on_finalize_balance == 0);
        assert!(post_user_conditional_on_revert_balance == 0);
        assert!(
            post_finalize_mint_supply == pre_finalize_mint_supply - conditional_on_finalize_balance
        );
        assert!(post_revert_mint_supply == pre_revert_mint_supply - conditional_on_revert_balance);
        if vault_status == VaultStatus::Finalized {
            assert!(
                post_vault_underlying_balance
                    == pre_vault_underlying_balance - conditional_on_finalize_balance
            );
        } else {
            assert!(vault_status == VaultStatus::Reverted);
            assert!(
                post_vault_underlying_balance
                    == pre_vault_underlying_balance - conditional_on_revert_balance
            );
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(settlement_authority: Pubkey, nonce: u64)]
pub struct InitializeConditionalVault<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<ConditionalVault>(),
        seeds = [
            b"conditional_vault", 
            settlement_authority.key().as_ref(),
            underlying_token_mint.key().as_ref(),
            &nonce.to_le_bytes()
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
    pub conditional_on_finalize_token_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        mint::authority = vault,
        mint::freeze_authority = vault,
        mint::decimals = underlying_token_mint.decimals
    )]
    pub conditional_on_revert_token_mint: Account<'info, Mint>,
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
#[instruction(amount: u64)]
pub struct MintConditionalTokens<'info> {
    #[account(
        has_one = conditional_on_finalize_token_mint @ ErrorCode::InvalidConditionalTokenMint,
        has_one = conditional_on_revert_token_mint @ ErrorCode::InvalidConditionalTokenMint,
    )]
    pub vault: Account<'info, ConditionalVault>,
    #[account(mut)]
    pub conditional_on_finalize_token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub conditional_on_revert_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = vault_underlying_token_account.key() == vault.underlying_token_account @  ErrorCode::InvalidVaultUnderlyingTokenAccount
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
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
        token::mint = conditional_on_finalize_token_mint
    )]
    pub user_conditional_on_finalize_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = conditional_on_revert_token_mint
    )]
    pub user_conditional_on_revert_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RedeemConditionalTokensForUnderlyingTokens<'info> {
    #[account(
        has_one = conditional_on_finalize_token_mint @ ErrorCode::InvalidConditionalTokenMint,
        has_one = conditional_on_revert_token_mint @ ErrorCode::InvalidConditionalTokenMint,
        constraint = vault.status != VaultStatus::Active @ ErrorCode::CantRedeemConditionalTokens
    )]
    pub vault: Account<'info, ConditionalVault>,
    #[account(mut)]
    pub conditional_on_finalize_token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub conditional_on_revert_token_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = vault_underlying_token_account.key() == vault.underlying_token_account @ ErrorCode::InvalidVaultUnderlyingTokenAccount
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = conditional_on_finalize_token_mint
    )]
    pub user_conditional_on_finalize_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = conditional_on_revert_token_mint
    )]
    pub user_conditional_on_revert_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::authority = authority,
        token::mint = vault.underlying_token_mint
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
    #[msg("This conditional token mint is not this vault's conditional token mint")]
    InvalidConditionalTokenMint,
    #[msg("Vault needs to be settled as finalized before users can redeem conditional tokens for underlying tokens")]
    CantRedeemConditionalTokens,
    #[msg("Once a vault has been settled, its status as either finalized or reverted cannot be changed")]
    VaultAlreadySettled,
}
