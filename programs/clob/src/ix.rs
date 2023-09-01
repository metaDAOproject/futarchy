use super::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};
use std::mem::size_of;

#[derive(Accounts)]
pub struct InitializeGlobalState<'info> {
    #[account(
        init,
        seeds = [b"WWCACOTMICMIBMHAFTTWYGHMB"],
        bump,
        payer = payer,
        space = 8 + size_of::<GlobalState>()
    )]
    pub global_state: Account<'info, GlobalState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeOrderBook<'info> {
    pub base: Account<'info, Mint>,
    pub quote: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        associated_token::authority = order_book,
        associated_token::mint = base
    )]
    pub base_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = payer,
        associated_token::authority = order_book,
        associated_token::mint = quote
    )]
    pub quote_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        seeds = [b"order_book", base.key().as_ref(), quote.key().as_ref()],
        bump,
        payer = payer,
        space = 8 + size_of::<OrderBook>()
    )]
    pub order_book: AccountLoader<'info, OrderBook>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SweepFees<'info> {
    #[account(has_one = admin)]
    pub global_state: Account<'info, GlobalState>,
    pub admin: Signer<'info>,
    #[account(mut, has_one = base_vault, has_one = quote_vault)]
    pub order_book: AccountLoader<'info, OrderBook>,
    #[account(mut)]
    pub base_to: Account<'info, TokenAccount>,
    #[account(mut)]
    pub quote_to: Account<'info, TokenAccount>,
    #[account(mut)]
    pub base_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub quote_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateGlobalState<'info> {
    #[account(mut, has_one = admin)]
    pub global_state: Account<'info, GlobalState>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateOrderBook<'info> {
    #[account(has_one = admin)]
    pub global_state: Account<'info, GlobalState>,
    pub admin: Signer<'info>,
    #[account(mut)]
    pub order_book: AccountLoader<'info, OrderBook>,
}

#[derive(Accounts)]
pub struct AddMarketMaker<'info> {
    #[account(mut)]
    pub order_book: AccountLoader<'info, OrderBook>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(has_one = admin)]
    pub global_state: Account<'info, GlobalState>,
    /// CHECK: no r/w, just lamport transfer
    #[account(mut)]
    pub admin: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TopUpBalance<'info> {
    #[account(mut, has_one = base_vault, has_one = quote_vault)]
    pub order_book: AccountLoader<'info, OrderBook>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub base_from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub quote_from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub base_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub quote_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawBalance<'info> {
    #[account(mut, has_one = base_vault, has_one = quote_vault)]
    pub order_book: AccountLoader<'info, OrderBook>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub base_to: Account<'info, TokenAccount>,
    #[account(mut)]
    pub quote_to: Account<'info, TokenAccount>,
    #[account(mut)]
    pub base_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub quote_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SubmitLimitOrder<'info> {
    #[account(mut)]
    pub order_book: AccountLoader<'info, OrderBook>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelLimitOrder<'info> {
    #[account(mut)]
    pub order_book: AccountLoader<'info, OrderBook>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateLimitOrder<'info> {
    #[account(mut)]
    pub order_book: AccountLoader<'info, OrderBook>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SubmitTakeOrder<'info> {
    #[account(mut)]
    pub order_book: AccountLoader<'info, OrderBook>,
    #[account(mut)]
    pub user_base_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_quote_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub base_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub quote_vault: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub global_state: Account<'info, GlobalState>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Getter<'info> {
    pub order_book: AccountLoader<'info, OrderBook>,
}
