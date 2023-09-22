use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use solana_program::clock::Clock;
use std::mem::size_of;

declare_id!("Ap4Y89Jo1Xx7jtimjoWMGCPAKEgrarasU9iQ6Dc6Pxor");

pub mod error;
pub mod ix;
pub mod state;
pub mod token_utils;

use crate::error::CLOBError;
use crate::ix::*;
use crate::state::*;
use crate::token_utils::{token_transfer, token_transfer_signed};

pub const PRICE_PRECISION: u128 = 1_000_000_000;
pub const MAX_BPS: u16 = 10_000;

pub const MAX_TAKER_FEE_BPS: u16 = 50; // 0.5%
                                       // These are not typos :)
pub const MAX_MAX_OBSERVATION_CHANGE_PER_SLOT_BPS: u16 = 500; // 5%
pub const MAX_MAX_OBSERVATION_CHANGE_PER_CHANGE_BPS: u16 = 1500; // 15%

#[program]
pub mod clob {
    use super::*;

    pub fn initialize_global_state(
        ctx: Context<InitializeGlobalState>,
        admin: Pubkey,
    ) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;

        global_state.admin = admin;
        global_state.taker_fee_in_bps = 10;
        global_state.market_maker_burn_in_lamports = 1_000_000_000;
        global_state.default_max_observation_change_per_update_bps = 250;
        global_state.default_max_observation_change_per_slot_bps = 100;

        Ok(())
    }

    pub fn update_global_state(
        ctx: Context<UpdateGlobalState>,
        new_admin: Option<Pubkey>,
        new_taker_fee_in_bps: Option<u16>,
        new_market_maker_burn_in_lamports: Option<u64>,
        new_default_max_observation_change_per_update_bps: Option<u16>,
        new_default_max_observation_change_per_slot_bps: Option<u16>,
    ) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;

        if let Some(new_admin) = new_admin {
            global_state.admin = new_admin;
        }
        if let Some(new_taker_fee_in_bps) = new_taker_fee_in_bps {
            require!(
                new_taker_fee_in_bps <= MAX_TAKER_FEE_BPS,
                CLOBError::DisallowedConfigValue
            );
            global_state.taker_fee_in_bps = new_taker_fee_in_bps;
        }
        if let Some(new_market_maker_burn_in_lamports) = new_market_maker_burn_in_lamports {
            global_state.market_maker_burn_in_lamports = new_market_maker_burn_in_lamports;
        }
        if let Some(new_default_max_observation_change_per_update_bps) =
            new_default_max_observation_change_per_update_bps
        {
            global_state.default_max_observation_change_per_update_bps =
                new_default_max_observation_change_per_update_bps;
        }
        if let Some(new_default_max_observation_change_per_slot_bps) =
            new_default_max_observation_change_per_slot_bps
        {
            global_state.default_max_observation_change_per_slot_bps =
                new_default_max_observation_change_per_slot_bps;
        }

        Ok(())
    }

    pub fn initialize_order_book(ctx: Context<InitializeOrderBook>) -> Result<()> {
        let mut order_book = ctx.accounts.order_book.load_init()?;

        order_book.base = ctx.accounts.base.key();
        order_book.quote = ctx.accounts.quote.key();

        order_book.base_vault = ctx.accounts.base_vault.key();
        order_book.quote_vault = ctx.accounts.quote_vault.key();

        order_book.buys.side = Side::Buy.into();
        order_book.buys.free_bitmap = FreeBitmap::default();
        order_book.buys.best_order_idx = NULL;
        order_book.buys.worst_order_idx = NULL;

        order_book.sells.side = Side::Sell.into();
        order_book.sells.free_bitmap = FreeBitmap::default();
        order_book.sells.best_order_idx = NULL;
        order_book.sells.worst_order_idx = NULL;

        let global_state = &ctx.accounts.global_state;
        order_book.twap_oracle.max_observation_change_per_update_bps =
            global_state.default_max_observation_change_per_update_bps;
        order_book.twap_oracle.max_observation_change_per_slot_bps =
            global_state.default_max_observation_change_per_slot_bps;

        order_book.min_base_limit_amount = 1;
        order_book.min_quote_limit_amount = 1;

        order_book.inv.base_fees_sweepable = 0;
        order_book.inv.quote_fees_sweepable = 0;
        order_book.inv.base_liabilities = 0;
        order_book.inv.quote_liabilities = 0;

        order_book.pda_bump = *ctx.bumps.get("order_book").unwrap();

        Ok(())
    }

    pub fn update_order_book(
        ctx: Context<UpdateOrderBook>,
        new_max_observation_change_per_update_bps: u16,
        new_max_observation_change_per_slot_bps: u16,
        new_min_base_limit_amount: u64,
        new_min_quote_limit_amount: u64,
    ) -> Result<()> {
        let mut order_book = ctx.accounts.order_book.load_mut()?;

        require!(
            new_max_observation_change_per_update_bps <= MAX_MAX_OBSERVATION_CHANGE_PER_CHANGE_BPS,
            CLOBError::DisallowedConfigValue
        );
        order_book.twap_oracle.max_observation_change_per_update_bps =
            new_max_observation_change_per_update_bps;

        require!(
            new_max_observation_change_per_slot_bps <= MAX_MAX_OBSERVATION_CHANGE_PER_SLOT_BPS,
            CLOBError::DisallowedConfigValue
        );
        order_book.twap_oracle.max_observation_change_per_slot_bps =
            new_max_observation_change_per_slot_bps;

        require!(
            new_min_base_limit_amount > 0,
            CLOBError::DisallowedConfigValue
        );
        order_book.min_base_limit_amount = new_min_base_limit_amount;

        require!(
            new_min_quote_limit_amount > 0,
            CLOBError::DisallowedConfigValue
        );
        order_book.min_quote_limit_amount = new_min_quote_limit_amount;

        Ok(())
    }

    pub fn sweep_fees(ctx: Context<SweepFees>) -> Result<()> {
        let mut order_book = ctx.accounts.order_book.load_mut()?;

        let base_amount = order_book.inv.base_fees_sweepable;
        let quote_amount = order_book.inv.quote_fees_sweepable;

        order_book.inv.base_fees_sweepable = 0;
        order_book.inv.quote_fees_sweepable = 0;

        // Copy these onto the stack before we drop `order_book`
        let base = order_book.base;
        let quote = order_book.quote;
        let pda_bump = order_book.pda_bump;

        let seeds = &[b"order_book", base.as_ref(), quote.as_ref(), &[pda_bump]];

        drop(order_book);

        token_transfer_signed(
            base_amount,
            &ctx.accounts.token_program,
            &ctx.accounts.base_vault,
            &ctx.accounts.base_to,
            &ctx.accounts.order_book,
            seeds,
        )?;

        token_transfer_signed(
            quote_amount,
            &ctx.accounts.token_program,
            &ctx.accounts.quote_vault,
            &ctx.accounts.quote_to,
            &ctx.accounts.order_book,
            seeds,
        )
    }

    pub fn add_market_maker(
        ctx: Context<AddMarketMaker>,
        market_maker: Pubkey,
        index: u32,
    ) -> Result<()> {
        let global_state = &ctx.accounts.global_state;
        let mut order_book = ctx.accounts.order_book.load_mut()?;

        require!(
            order_book.market_makers[index as usize].authority == Pubkey::default(),
            CLOBError::IndexAlreadyTaken
        );

        let from = ctx.accounts.payer.key();
        let to = global_state.admin;
        let lamports_to_burn = global_state.market_maker_burn_in_lamports;

        solana_program::program::invoke(
            &solana_program::system_instruction::transfer(&from, &to, lamports_to_burn),
            &[
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.admin.to_account_info(),
            ],
        )?;

        order_book.market_makers[index as usize].authority = market_maker;

        Ok(())
    }

    pub fn top_up_balance(
        ctx: Context<TopUpBalance>,
        market_maker_index: u32,
        base_amount: u64,
        quote_amount: u64,
    ) -> Result<()> {
        let mut order_book = ctx.accounts.order_book.load_mut()?;

        let (market_maker, inv) = order_book.get_mm(market_maker_index as usize);

        let pre_base_liabilities = inv.base_liabilities;
        let pre_base_vault_balance = ctx.accounts.base_vault.amount;

        let pre_quote_liabilities = inv.quote_liabilities;
        let pre_quote_vault_balance = ctx.accounts.quote_vault.amount;

        token_transfer(
            base_amount,
            &ctx.accounts.token_program,
            &ctx.accounts.base_from,
            &ctx.accounts.base_vault,
            &ctx.accounts.authority,
        )?;

        market_maker.credit_base(base_amount, inv);

        token_transfer(
            quote_amount,
            &ctx.accounts.token_program,
            &ctx.accounts.quote_from,
            &ctx.accounts.quote_vault,
            &ctx.accounts.authority,
        )?;

        market_maker.credit_quote(quote_amount, inv);

        ctx.accounts.base_vault.reload()?;
        ctx.accounts.quote_vault.reload()?;

        let post_base_liabilities = inv.base_liabilities;
        let post_base_vault_balance = ctx.accounts.base_vault.amount;

        let post_quote_liabilities = inv.quote_liabilities;
        let post_quote_vault_balance = ctx.accounts.quote_vault.amount;

        assert!(post_base_liabilities == pre_base_liabilities + base_amount);
        assert!(post_base_vault_balance == pre_base_vault_balance + base_amount);

        assert!(post_quote_liabilities == pre_quote_liabilities + quote_amount);
        assert!(post_quote_vault_balance == pre_quote_vault_balance + quote_amount);

        OrderBook::assert_balance_invariant(
            post_base_vault_balance,
            post_quote_liabilities,
            order_book.inv.base_liquidity,
            order_book.inv.base_fees_sweepable,
        );
        OrderBook::assert_balance_invariant(
            post_quote_vault_balance,
            post_quote_liabilities,
            order_book.inv.quote_liquidity,
            order_book.inv.quote_fees_sweepable,
        );

        Ok(())
    }

    pub fn withdraw_balance(
        ctx: Context<WithdrawBalance>,
        market_maker_index: u32,
        base_amount: u64,
        quote_amount: u64,
    ) -> Result<()> {
        let mut order_book = ctx.accounts.order_book.load_mut()?;

        let (market_maker, inv) = order_book.get_mm(market_maker_index as usize);

        let pre_base_liabilities = inv.base_liabilities;
        let pre_base_vault_balance = ctx.accounts.base_vault.amount;

        let pre_quote_liabilities = inv.quote_liabilities;
        let pre_quote_vault_balance = ctx.accounts.quote_vault.amount;

        require!(
            market_maker.authority == ctx.accounts.authority.key(),
            CLOBError::UnauthorizedMarketMaker
        );

        // These debits cannot be inside the `if` blocks because we drop `order_book`
        market_maker.debit_base(base_amount, inv);
        market_maker.debit_quote(quote_amount, inv);

        let post_base_liabilities = inv.base_liabilities;
        let post_base_liquidity = inv.base_liquidity;
        let post_base_fees_sweepable = inv.base_fees_sweepable;

        let post_quote_liabilities = inv.quote_liabilities;
        let post_quote_liquidity = inv.quote_liquidity;
        let post_quote_fees_sweepable = inv.quote_fees_sweepable;

        // Copy these onto the stack before we drop `order_book`
        let base = order_book.base;
        let quote = order_book.quote;
        let pda_bump = order_book.pda_bump;

        let seeds = &[b"order_book", base.as_ref(), quote.as_ref(), &[pda_bump]];

        drop(order_book);

        token_transfer_signed(
            base_amount,
            &ctx.accounts.token_program,
            &ctx.accounts.base_vault,
            &ctx.accounts.base_to,
            &ctx.accounts.order_book,
            seeds,
        )?;

        token_transfer_signed(
            quote_amount,
            &ctx.accounts.token_program,
            &ctx.accounts.quote_vault,
            &ctx.accounts.quote_to,
            &ctx.accounts.order_book,
            seeds,
        )?;

        ctx.accounts.base_vault.reload()?;
        ctx.accounts.quote_vault.reload()?;

        let post_base_vault_balance = ctx.accounts.base_vault.amount;
        let post_quote_vault_balance = ctx.accounts.quote_vault.amount;

        assert!(post_base_liabilities == pre_base_liabilities - base_amount);
        assert!(post_base_vault_balance == pre_base_vault_balance - base_amount);

        assert!(post_quote_liabilities == pre_quote_liabilities - quote_amount);
        assert!(post_quote_vault_balance == pre_quote_vault_balance - quote_amount);

        OrderBook::assert_balance_invariant(
            ctx.accounts.base_vault.amount,
            post_base_liabilities,
            post_base_liquidity,
            post_base_fees_sweepable,
        );
        OrderBook::assert_balance_invariant(
            ctx.accounts.quote_vault.amount,
            post_quote_liabilities,
            post_quote_liquidity,
            post_quote_fees_sweepable,
        );

        Ok(())
    }

    pub fn submit_limit_order(
        ctx: Context<SubmitLimitOrder>,
        side: Side,
        amount_in: u64,
        price: u64,
        ref_id: u32,
        market_maker_index: u8,
    ) -> Result<u8> {
        let mut order_book = ctx.accounts.order_book.load_mut()?;

        let (pre_liabilities, pre_liquidity) = match side {
            Side::Buy => (
                order_book.inv.quote_liabilities,
                order_book.inv.quote_liquidity,
            ),
            Side::Sell => (
                order_book.inv.base_liabilities,
                order_book.inv.base_liquidity,
            ),
        };

        order_book.update_twap_oracle()?;

        let market_maker = order_book.market_makers[market_maker_index as usize];

        require!(
            market_maker.authority == ctx.accounts.authority.key(),
            CLOBError::UnauthorizedMarketMaker
        );

        let min_amount = match side {
            Side::Buy => order_book.min_quote_limit_amount,
            Side::Sell => order_book.min_base_limit_amount,
        };
        require!(amount_in >= min_amount, CLOBError::MinLimitAmountNotMet);

        let (order_list, makers, inv) = order_book.order_list(side);

        let order_idx =
            order_list.insert_order(amount_in, price, ref_id, market_maker_index, makers, inv);

        let order_id = order_idx.ok_or_else(|| error!(CLOBError::InferiorPrice))?;

        let (post_liabilities, post_liquidity) = match side {
            Side::Buy => (
                order_book.inv.quote_liabilities,
                order_book.inv.quote_liquidity,
            ),
            Side::Sell => (
                order_book.inv.base_liabilities,
                order_book.inv.base_liquidity,
            ),
        };

        assert!(post_liabilities == pre_liabilities - amount_in);
        assert!(post_liquidity == pre_liquidity + amount_in);

        Ok(order_id)
    }

    pub fn cancel_limit_order(
        ctx: Context<CancelLimitOrder>,
        side: Side,
        order_index: u8,
        market_maker_index: u8,
    ) -> Result<()> {
        let mut order_book = ctx.accounts.order_book.load_mut()?;

        let (pre_liabilities, pre_liquidity) = match side {
            Side::Buy => (
                order_book.inv.quote_liabilities,
                order_book.inv.quote_liquidity,
            ),
            Side::Sell => (
                order_book.inv.base_liabilities,
                order_book.inv.base_liquidity,
            ),
        };

        order_book.update_twap_oracle()?;

        let market_maker = order_book.market_makers[market_maker_index as usize];

        require!(
            market_maker.authority == ctx.accounts.authority.key(),
            CLOBError::UnauthorizedMarketMaker
        );

        let (order_list, makers, inv) = order_book.order_list(side);

        let order = order_list.orders[order_index as usize];

        require!(
            order.market_maker_index == market_maker_index,
            CLOBError::UnauthorizedMarketMaker
        );

        order_list.delete_order(order_index, makers, inv);

        let (post_liabilities, post_liquidity) = match side {
            Side::Buy => (
                order_book.inv.quote_liabilities,
                order_book.inv.quote_liquidity,
            ),
            Side::Sell => (
                order_book.inv.base_liabilities,
                order_book.inv.base_liquidity,
            ),
        };

        assert!(post_liabilities == pre_liabilities + order.amount_in);
        assert!(post_liquidity == pre_liquidity - order.amount_in);

        Ok(())
    }

    pub fn submit_take_order(
        ctx: Context<SubmitTakeOrder>,
        side: Side,
        amount_in: u64,
        min_out: u64,
    ) -> Result<()> {
        assert!(amount_in > 0);

        // set these up for invariant checks
        let pre_user_base_balance = ctx.accounts.user_base_account.amount;
        let pre_user_quote_balance = ctx.accounts.user_quote_account.amount;
        let pre_vault_base_balance = ctx.accounts.base_vault.amount;
        let pre_vault_quote_balance = ctx.accounts.quote_vault.amount;

        let global_state = &ctx.accounts.global_state;

        let mut amount_in_after_fees = ((amount_in as u128)
            * (MAX_BPS - global_state.taker_fee_in_bps) as u128)
            / MAX_BPS as u128;

        let mut order_book = ctx.accounts.order_book.load_mut()?;

        order_book.update_twap_oracle()?;

        let (receiving_vault, sending_vault, user_from, user_to) = match side {
            Side::Buy => {
                order_book.inv.quote_fees_sweepable += amount_in - amount_in_after_fees as u64;
                (
                    &ctx.accounts.quote_vault,
                    &ctx.accounts.base_vault,
                    &ctx.accounts.user_quote_account,
                    &ctx.accounts.user_base_account,
                )
            }
            Side::Sell => {
                order_book.inv.base_fees_sweepable += amount_in - amount_in_after_fees as u64;
                (
                    &ctx.accounts.base_vault,
                    &ctx.accounts.quote_vault,
                    &ctx.accounts.user_base_account,
                    &ctx.accounts.user_quote_account,
                )
            }
        };

        token_transfer(
            amount_in,
            &ctx.accounts.token_program,
            &user_from,
            &receiving_vault,
            &ctx.accounts.authority,
        )?;

        let mut amount_out = 0;
        // We cannot delete the orders inside the loop because
        // `order_list.iter()` holds an immutable borrow to the order list.
        let mut filled_orders = Vec::new();

        // If the user is buying, the maker is selling. If the maker is
        // selling, the user is buying.
        let (order_list, makers, inv) = order_book.opposing_order_list(side);

        for (book_order, book_order_idx) in order_list.iter() {
            let order_amount_available = book_order.amount_in as u128; // u128s prevent overflow
            let order_price = book_order.price as u128;

            // If an order is selling 10 BONK at a price of 2 USDC per BONK,
            // the order can take up to 5 USDC (10 / 2). If an order is buying
            // BONK with 10 USDC at a price of 2 USDC per BONK, the order can
            // take up to 20 BONK (10 * 2).
            let amount_order_can_absorb = match side {
                Side::Buy => (order_amount_available * PRICE_PRECISION) / order_price,
                Side::Sell => (order_amount_available * order_price) / PRICE_PRECISION,
            };

            // Can the book order absorb all of a user's input token?
            if amount_order_can_absorb >= amount_in_after_fees {
                // If an order can absorb 15 USDC at a price of 3 USDC per BONK
                // and a user is buying BONK with 6 USDC, the user should receive
                // 2 BONK (6 / 3).
                //
                // If an order can absorb 20 BONK at a price of 3 USDC per BONK
                // and a user is selling 10 BONK, the user should receive 30
                // USDC (10 * 3).
                let user_to_receive = match side {
                    Side::Buy => (amount_in_after_fees * PRICE_PRECISION) / order_price,
                    Side::Sell => (amount_in_after_fees * order_price) / PRICE_PRECISION,
                } as u64;
                amount_out += user_to_receive;

                order_list.sub_liquidity(user_to_receive, inv);
                order_list.orders[book_order_idx as usize].amount_in -= user_to_receive;

                match side {
                    Side::Buy => {
                        makers[book_order.market_maker_index as usize]
                            .credit_quote(amount_in_after_fees as u64, inv);
                    }
                    Side::Sell => {
                        makers[book_order.market_maker_index as usize]
                            .credit_base(amount_in_after_fees as u64, inv);
                    }
                };

                break;
            } else {
                amount_in_after_fees -= amount_order_can_absorb;
                amount_out += order_amount_available as u64;

                match side {
                    Side::Buy => {
                        makers[book_order.market_maker_index as usize]
                            .credit_quote(amount_order_can_absorb as u64, inv);
                    }
                    Side::Sell => {
                        makers[book_order.market_maker_index as usize]
                            .credit_base(amount_order_can_absorb as u64, inv);
                    }
                };

                filled_orders.push(book_order_idx);
            }
        }

        for order_idx in filled_orders {
            order_list.delete_order(order_idx, makers, inv);
        }

        require!(amount_out >= min_out, CLOBError::TakeNotFilled);

        let base = order_book.base;
        let quote = order_book.quote;
        let pda_bump = order_book.pda_bump;

        let seeds = &[b"order_book", base.as_ref(), quote.as_ref(), &[pda_bump]];

        let post_base_liabilities = order_book.inv.base_liabilities;
        let post_base_fees_sweepable = order_book.inv.base_fees_sweepable;
        let post_base_liquidity = order_book.inv.base_liquidity;

        let post_quote_liabilities = order_book.inv.quote_liabilities;
        let post_quote_fees_sweepable = order_book.inv.quote_fees_sweepable;
        let post_quote_liquidity = order_book.inv.quote_liquidity;

        drop(order_book);

        token_transfer_signed(
            amount_out,
            &ctx.accounts.token_program,
            sending_vault,
            user_to,
            &ctx.accounts.order_book,
            seeds,
        )?;

        ctx.accounts.user_base_account.reload()?;
        ctx.accounts.user_quote_account.reload()?;
        ctx.accounts.base_vault.reload()?;
        ctx.accounts.quote_vault.reload()?;

        let post_user_base_balance = ctx.accounts.user_base_account.amount;
        let post_user_quote_balance = ctx.accounts.user_quote_account.amount;
        let post_vault_base_balance = ctx.accounts.base_vault.amount;
        let post_vault_quote_balance = ctx.accounts.quote_vault.amount;

        OrderBook::assert_balance_invariant(
            post_vault_base_balance,
            post_base_liabilities,
            post_base_liquidity,
            post_base_fees_sweepable,
        );
        OrderBook::assert_balance_invariant(
            post_vault_quote_balance,
            post_quote_liabilities,
            post_quote_liquidity,
            post_quote_fees_sweepable,
        );

        match side {
            Side::Buy => {
                assert!(post_user_base_balance == pre_user_base_balance + amount_out);
                assert!(post_user_quote_balance == pre_user_quote_balance - amount_in);
                assert!(post_vault_base_balance == pre_vault_base_balance - amount_out);
                assert!(post_vault_quote_balance == pre_vault_quote_balance + amount_in);
            }
            Side::Sell => {
                assert!(post_user_base_balance == pre_user_base_balance - amount_in);
                assert!(post_user_quote_balance == pre_user_quote_balance + amount_out);
                assert!(post_vault_base_balance == pre_vault_base_balance + amount_in);
                assert!(post_vault_quote_balance == pre_vault_quote_balance - amount_out);
            }
        }

        Ok(())
    }

    /**** GETTERS ****/

    pub fn get_twap(ctx: Context<Getter>) -> Result<TWAPOracle> {
        let order_book = ctx.accounts.order_book.load()?;

        Ok(order_book.twap_oracle)
    }

    #[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
    pub struct MarketMakerBalances {
        pub base_balance: u64,
        pub quote_balance: u64,
    }

    pub fn get_market_maker_balances(
        ctx: Context<Getter>,
        maker_pubkey: Pubkey,
    ) -> Result<MarketMakerBalances> {
        let order_book = ctx.accounts.order_book.load()?;
        let makers = &order_book.market_makers;

        for market_maker in makers {
            if market_maker.authority == maker_pubkey {
                return Ok(MarketMakerBalances {
                    base_balance: market_maker.base_balance,
                    quote_balance: market_maker.quote_balance,
                });
            }
        }

        Err(error!(CLOBError::MakerNotFound))
    }

    pub fn get_order_index(
        ctx: Context<Getter>,
        side: Side,
        ref_id: u32,
        market_maker_index: u8,
    ) -> Result<Option<u8>> {
        let order_book = ctx.accounts.order_book.load()?;
        let order_list = match side {
            Side::Buy => order_book.buys,
            Side::Sell => order_book.sells,
        };

        for (order, order_idx) in order_list.iter() {
            if order.ref_id == ref_id && order.market_maker_index == market_maker_index {
                return Ok(Some(order_idx));
            }
        }

        Ok(None)
    }

    #[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
    pub struct AmountAndPrice {
        pub amount: u64,
        pub price: u64,
    }

    pub fn get_best_orders(ctx: Context<Getter>, side: Side) -> Result<Vec<AmountAndPrice>> {
        let order_book = ctx.accounts.order_book.load()?;
        let order_list = match side {
            Side::Buy => order_book.buys,
            Side::Sell => order_book.sells,
        };

        let max_returnable = (solana_program::program::MAX_RETURN_DATA - size_of::<u32>())
            / size_of::<AmountAndPrice>();

        let mut orders = Vec::with_capacity(max_returnable);

        for (order, _) in order_list.iter() {
            orders.push(AmountAndPrice {
                amount: order.amount_in,
                price: order.price,
            });

            if orders.len() == max_returnable {
                break;
            }
        }

        Ok(orders)
    }
}
