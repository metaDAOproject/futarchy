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
		vault.pda_bump = *ctx.bumps.get("conditional_vault").unwrap();

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
	// impl<'info> MintConditionalTokens<'info> {
	//     pub fn into_transfer_underlying_tokens_to_vault_context(
	//         &self,
	//     ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
	//         let cpi_accounts = Transfer {
	//             from: self.user_underlying_token_account.to_account_info().clone(),
	//             to: self
	//                 .vault_underlying_token_account
	//                 .to_account_info()
	//                 .clone(),
	//             authority: self.user.to_account_info().clone(),
	//         };
	//         CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
	//     }

	//     pub fn into_mint_conditional_tokens_to_user_context(
	//         &self,
	//     ) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
	//         let cpi_accounts = MintTo {
	//             mint: self.conditional_token_mint.to_account_info().clone(),
	//             to: self
	//                 .user_conditional_token_account
	//                 .to_account_info()
	//                 .clone(),
	//             authority: self.vault.to_account_info().clone(),
	//         };
	//         CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
	//     }
	// }

	pub fn mint_conditional_tokens(ctx: Context<MintConditionalTokens>, amount: u64) -> Result<()> {
		let accs = &ctx.accounts;
		let vault = &accs.vault;

		let seeds = &[
			b"conditional_vault",
			vault.settlement_authority.as_ref(),
			vault.underlying_token_mint.as_ref(),
			&[vault.pda_bump],
		];
		let signer = &[&seeds[..]];
		//         let cpi_accounts = Transfer {
		//             from: self.user_underlying_token_account.to_account_info().clone(),
		//             to: self
		//                 .vault_underlying_token_account
		//                 .to_account_info()
		//                 .clone(),
		//             authority: self.user.to_account_info().clone(),
		//         };
		//         CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)

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
		// token::mint_to(
		//     ctx.accounts
		//         .into_mint_conditional_tokens_to_user_context()
		//         .with_signer(signer),
		//     amount,
		// )?;

		let deposit_slip = &mut ctx.accounts.deposit_slip;

		deposit_slip.deposited_amount += amount;

		Ok(())
	}

	// pub fn redeem_conditional_tokens_for_underlying_tokens(
	//     ctx: Context<RedeemConditionalTokensForUnderlyingTokens>,
	// ) -> Result<()> {
	//     let conditional_expression = &ctx.accounts.conditional_expression;
	//     let proposal_status = ctx.accounts.proposal.status;

	//     require!(
	//         conditional_expression.evaluate(proposal_status)?,
	//         ErrorCode::CantRedeemConditionalTokens
	//     );

	//     let vault = &ctx.accounts.vault;
	//     let seeds = &[
	//         b"vault",
	//         vault.conditional_expression.as_ref(),
	//         vault.underlying_token_mint.as_ref(),
	//         &[vault.pda_bump],
	//     ];
	//     let signer = &[&seeds[..]];

	//     // no partial redemptions
	//     let amount = ctx.accounts.user_conditional_token_account.amount;

	//     token::burn(ctx.accounts.into_burn_conditional_tokens_context(), amount)?;

	//     token::transfer(
	//         ctx.accounts
	//             .into_transfer_underlying_tokens_to_user_context()
	//             .with_signer(signer),
	//         amount,
	//     )?;

	//     Ok(())
	// }

	// pub fn redeem_deposit_slip_for_underlying_tokens(
	//     ctx: Context<RedeemDepositSlipForUnderlyingTokens>,
	// ) -> Result<()> {
	//     let conditional_expression = &ctx.accounts.conditional_expression;
	//     let deposit_slip = &mut ctx.accounts.user_deposit_slip;
	//     let proposal_status = ctx.accounts.proposal.status;

	//     require!(
	//         !conditional_expression.evaluate(proposal_status)?,
	//         ErrorCode::CantRedeemDepositSlip
	//     );

	//     let vault = &ctx.accounts.vault;
	//     let seeds = &[
	//         b"vault",
	//         vault.conditional_expression.as_ref(),
	//         vault.underlying_token_mint.as_ref(),
	//         &[vault.pda_bump],
	//     ];
	//     let signer = &[&seeds[..]];

	//     let amount = deposit_slip.deposited_amount;

	//     deposit_slip.deposited_amount -= amount;

	//     token::transfer(
	//         ctx.accounts
	//             .into_transfer_underlying_tokens_to_user_context()
	//             .with_signer(signer),
	//         amount,
	//     )?;

	//     Ok(())
	// }
}

#[derive(Accounts)]
pub struct InitializeConditionalVault<'info> {
	#[account(
        init,
        payer = payer,
        space = 8 + (32 * 4) + 1,
        seeds = [
            b"conditional_vault", 
            authority.key().as_ref(),
            underlying_token_mint.key().as_ref()
        ],
        bump
    )]
	pub vault: Account<'info, ConditionalVault>,
	/// CHECK: CNBC 11/Nov/2022 Sam Bankman-Fried steps down, FTX files for bankruptcy
	pub authority: UncheckedAccount<'info>,
	pub underlying_token_mint: Account<'info, Mint>,
	#[account(
        init,
        payer = payer,
        associated_token::authority = vault,
        associated_token::mint = underlying_token_mint
    )]
	pub vault_underlying_token_account: Account<'info, TokenAccount>,
	#[account(
        init,
        payer = payer,
        mint::authority = vault,
        mint::freeze_authority = vault,
        mint::decimals = underlying_token_mint.decimals
    )]
	pub conditional_token_mint: Account<'info, Mint>,
	#[account(mut)]
	pub payer: Signer<'info>,
	pub token_program: Program<'info, Token>,
	pub associated_token_program: Program<'info, AssociatedToken>,
	pub system_program: Program<'info, System>,
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
        constraint = vault.status == VaultStatus::Finalized
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
        constraint = vault.status == VaultStatus::Reverted
    )]
	pub vault: Account<'info, ConditionalVault>,
	#[account(
        mut,
        constraint = vault_underlying_token_account.key() == vault.underlying_token_account @ ErrorCode::InvalidVaultUnderlyingTokenAccount
    )]
	pub vault_underlying_token_account: Account<'info, TokenAccount>,
	pub authority: Signer<'info>,
	#[account(
        mut,
        has_one = authority,
        has_one = vault
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
	#[msg("Proposal signers need to be either active members or the Meta-DAO.")]
	InvalidSigner,
	#[msg("Function can only be called recursively (during execution of a passed proposal)")]
	UnauthorizedFunctionCall,
	#[msg("This member is already active and thus cannot be added")]
	MemberAlreadyActive,
	#[msg("A signer pubkey should have been set to the Meta-DAO account pubkey but it wasn't")]
	InvalidMetaDAOSigner,
	#[msg("Proposals cannot be re-executed")]
	NoProposalReplay,
	#[msg("An inactive member (one that is not a part of the Meta-DAO `members` vector) cannot execute proposals")]
	InactiveMember,
	#[msg("Insufficient underlying token balance to mint this amount of conditional tokens")]
	InsufficientUnderlyingTokens,
	#[msg("This `vault_underlying_token_account` is not this vault's `underlying_token_account`")]
	InvalidVaultUnderlyingTokenAccount,
	#[msg("This `conditional_token_mint` is not this vault's `conditional_token_mint`")]
	InvalidConditionalTokenMint,
	#[msg("This `conditional_expression` is not the vault's `conditional_expression`")]
	InvalidConditionalExpression,
	#[msg("This `proposal` is not the one referenced by this `conditional_expression`")]
	InvalidProposal,
	#[msg("Cannot evaluate this conditional expression yet because the proposal is still pending")]
	ConditionalExpressionNotEvaluatable,
	#[msg("Conditional expression needs to evaluate to true before conditional tokens can be redeemed for underlying tokens")]
	CantRedeemConditionalTokens,
	#[msg("Conditional expression needs to evaluate to false before deposit slips can be redeemed for underlying tokens")]
	CantRedeemDepositSlip,
}
