use anchor_spl::token::{Burn, Mint, MintTo, Token, TokenAccount, Transfer};

use super::*;

#[derive(Accounts)]
pub struct InitializeMetaDAO<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + (100 * 32), // 100 member max
        seeds = [b"WWCACOTMICMIBMHAFTTWYGHMB"], // abbreviation of the last two sentences of the Declaration of Independence of Cyberspace
        bump
    )]
    pub meta_dao: Account<'info, MetaDAO>,
    pub seed_member: Account<'info, Member>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct InitializeMember<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + 20 + 1 + 32,
        seeds = [b"member", name.as_bytes()], // 256^20 possible names, so practically impossible for all names to be exhausted
        bump
    )]
    pub member: Account<'info, Member>,
    #[account(
        init,
        payer = initializer,
        space = 8,
        seeds = [b"treasury", member.key().as_ref()],
        bump
    )]
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub treasury: UncheckedAccount<'info>,
    // TODO: check this mint
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddMember<'info> {
    #[account(
        signer @ ErrorCode::UnauthorizedFunctionCall,
        mut,
        seeds = [b"WWCACOTMICMIBMHAFTTWYGHMB"], 
        bump
    )]
    pub meta_dao: Account<'info, MetaDAO>,
    pub member: Account<'info, Member>,
}

#[derive(Accounts)]
pub struct InitializeProposal<'info> {
    #[account(zero)]
    pub proposal: Account<'info, Proposal>,
    #[account(seeds = [b"WWCACOTMICMIBMHAFTTWYGHMB"], bump)]
    pub meta_dao: Account<'info, MetaDAO>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
}

#[derive(Accounts)]
pub struct FailProposal<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
}

#[derive(Accounts)]
#[instruction(pass_or_fail_flag: bool)]
pub struct InitializeConditionalExpression<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + 32 + 1,
        seeds = [b"conditional_expression", proposal.key().as_ref(), &[u8::from(pass_or_fail_flag)]],
        bump
    )]
    pub conditional_expression: Account<'info, ConditionalExpression>,
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeConditionalVault<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + (32 * 4) + 1,
        seeds = [b"conditional_vault", conditional_expression.key().as_ref(), underlying_token_mint.key().as_ref()], // for now, only SPL tokens
        bump
    )]
    pub conditional_vault: Account<'info, ConditionalVault>,
    pub conditional_expression: Account<'info, ConditionalExpression>,
    /// SPL mint of the underlying token
    pub underlying_token_mint: Account<'info, Mint>,
    /// token account for the vault that matches above mint
    #[account(
        token::authority = conditional_vault, 
        token::mint = underlying_token_mint
    )]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    /// SPL mint of the conditional token
    #[account(
        mint::authority = conditional_vault, 
        mint::freeze_authority = conditional_vault, 
        mint::decimals = underlying_token_mint.decimals
    )]
    pub conditional_token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(depositor: Pubkey)]
pub struct InitializeDepositSlip<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + 32 + 32 + 8,
        seeds = [b"deposit_slip", conditional_vault.key().as_ref(), depositor.key().as_ref()],
        bump
    )]
    pub deposit_slip: Account<'info, VaultDepositSlip>,
    pub conditional_vault: Account<'info, ConditionalVault>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintConditionalTokens<'info> {
    pub conditional_vault: Account<'info, ConditionalVault>,
    pub token_program: Program<'info, Token>,
    #[account(mut)]
    pub conditional_token_mint: Account<'info, Mint>,
    pub depositor: Signer<'info>,
    #[account(mut, has_one = depositor)]
    pub deposit_slip: Account<'info, VaultDepositSlip>,
    #[account(mut)]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_underlying_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_conditional_token_account: Account<'info, TokenAccount>,
}

impl<'info> MintConditionalTokens<'info> {
    pub fn into_transfer_underlying_tokens_to_vault_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.user_underlying_token_account.to_account_info().clone(),
            to: self
                .vault_underlying_token_account
                .to_account_info()
                .clone(),
            authority: self.depositor.to_account_info().clone(),
        };
        CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
    }

    pub fn into_mint_conditional_tokens_to_user_context(
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
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_conditional_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_underlying_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_underlying_token_account: Account<'info, TokenAccount>,
    pub conditional_vault: Account<'info, ConditionalVault>,
    pub proposal: Account<'info, Proposal>,
    pub token_program: Program<'info, Token>,
    pub conditional_expression: Account<'info, ConditionalExpression>,
    #[account(mut)]
    pub conditional_token_mint: Account<'info, Mint>,
}

impl<'info> RedeemConditionalTokensForUnderlyingTokens<'info> {
    pub fn into_burn_conditional_tokens_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
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

    pub fn into_transfer_underlying_tokens_to_user_context(
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

// #[derive(Accounts)]
// pub struct RedeemDepositAccountForUnderlyingTokens<'info> {
//     pub user: Signer<'info>,
//     #[account(mut)]
//     pub user_deposit_account: Account<'info, DepositAccount>,
//     #[account(mut)]
//     pub user_underlying_token_account: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub vault_underlying_token_account: Account<'info, TokenAccount>,
//     pub conditional_vault: Account<'info, ConditionalVault>,
//     pub proposal: Account<'info, Proposal>,
//     pub token_program: Program<'info, Token>,
//     pub conditional_expression: Account<'info, ConditionalExpression>,
// }

// impl<'info> RedeemDepositAccountForUnderlyingTokens<'info> {
//     pub fn into_transfer_underlying_tokens_to_user_context(
//         &self,
//     ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
//         let cpi_accounts = Transfer {
//             from: self
//                 .vault_underlying_token_account
//                 .to_account_info()
//                 .clone(),
//             to: self.user_underlying_token_account.to_account_info().clone(),
//             authority: self.conditional_vault.to_account_info().clone(),
//         };
//         CpiContext::new(self.token_program.to_account_info().clone(), cpi_accounts)
//     }
// }
