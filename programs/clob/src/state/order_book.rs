use super::*;
use std::default::Default;

pub const BOOK_DEPTH: usize = 128;
pub const NUM_MARKET_MAKERS: usize = 64;

pub const NULL: u8 = 128;

#[account(zero_copy)]
pub struct OrderBook {
    pub base: Pubkey,
    pub quote: Pubkey,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub buys: OrderList,
    pub sells: OrderList,
    pub market_makers: [MarketMaker; NUM_MARKET_MAKERS],
    pub twap_oracle: TWAPOracle,
    // The minimum amount of base/quote tokens that a limit order can offer,
    // to prevent spam.
    pub min_base_limit_amount: u64,
    pub min_quote_limit_amount: u64,
    pub base_fees_sweepable: u64,
    pub quote_fees_sweepable: u64,
    pub pda_bump: u8,
    pub _padding: [u8; 7],
}

impl OrderBook {
    pub fn opposing_order_list(
        &mut self,
        side: Side,
    ) -> (&mut OrderList, &mut [MarketMaker; NUM_MARKET_MAKERS]) {
        let list = match side {
            Side::Buy => &mut self.sells,
            Side::Sell => &mut self.buys,
        };
        (list, &mut self.market_makers)
    }

    pub fn order_list(
        &mut self,
        side: Side,
    ) -> (&mut OrderList, &mut [MarketMaker; NUM_MARKET_MAKERS]) {
        let list = match side {
            Side::Buy => &mut self.buys,
            Side::Sell => &mut self.sells,
        };
        (list, &mut self.market_makers)
    }

    pub fn update_twap_oracle(&mut self) -> Result<()> {
        let clock = Clock::get()?;

        let oracle = &mut self.twap_oracle;

        if clock.slot > oracle.last_updated_slot {
            let best_bid = self.buys.iter().next();
            let best_offer = self.sells.iter().next();

            if best_bid.is_none() || best_offer.is_none() {
                return Ok(());
            }

            let (best_bid, _) = best_bid.unwrap();
            let (best_offer, _) = best_offer.unwrap();

            let spot_price = (best_bid.price + best_offer.price) / 2;

            let observation = if oracle.last_updated_slot == 0 {
                spot_price
            } else if spot_price > oracle.last_observation {
                // There are two maxes imposed: the max per change, and the max per
                // slot. We take the min of them to determine the max observation.
                let max_observation_from_change = (oracle.last_observation
                    * (MAX_BPS + oracle.max_observation_change_per_update_bps) as u64)
                    / MAX_BPS as u64;
                let max_observation_from_slots = (oracle.last_observation
                    * (MAX_BPS as u64
                        + (oracle.max_observation_change_per_slot_bps as u64
                            * (clock.slot - oracle.last_updated_slot)))
                        as u64)
                    / MAX_BPS as u64;

                // always round up 1 because of an edge case where the price
                // drops super low (e.g., 100), and can't climb back up because
                // 1.001 * 100 is still 100
                let max_observation =
                    std::cmp::min(max_observation_from_change, max_observation_from_slots) + 1;

                // this also means that TWAPs start getting more manipulation-prone
                // around 100 and lower

                // e.g., if 5 validators with 20 contiguous slots colluded, they could
                // move the price by 20, which would be 20% at a price of 100

                std::cmp::min(spot_price, max_observation)
            } else {
                let min_observation_from_change = (oracle.last_observation
                    * (MAX_BPS - oracle.max_observation_change_per_update_bps) as u64)
                    / MAX_BPS as u64;
                let min_observation_from_slots = (oracle.last_observation
                    * (MAX_BPS as u64
                        - (oracle.max_observation_change_per_slot_bps as u64
                            * (clock.slot - oracle.last_updated_slot)))
                        as u64)
                    / MAX_BPS as u64;

                let min_observation =
                    std::cmp::max(min_observation_from_change, min_observation_from_slots);

                std::cmp::max(spot_price, min_observation)
            };

            let weighted_observation = observation * (clock.slot - oracle.last_updated_slot);

            oracle.last_updated_slot = clock.slot;
            oracle.last_observation = observation;
            oracle.observation_aggregator += weighted_observation as u128;
        }

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
#[zero_copy]
pub struct TWAPOracle {
    pub last_updated_slot: u64,
    pub last_observation: u64,
    pub observation_aggregator: u128,
    /// The most, in basis points, an observation can change per update.
    /// For example, if it is 100 (1%), then the new observation can be between
    /// last_observation * 0.99 and last_observation * 1.01
    pub max_observation_change_per_update_bps: u16,
    /// The most, in basis points, an observation can change per slot.
    /// For example, if it is 10 (0.1%) and it has been 3 slots since an update,
    /// the new observation can be between last_observation * 0.997 and
    /// last_observation * 1.003
    pub max_observation_change_per_slot_bps: u16,
    pub _padding: [u8; 4],
}

#[zero_copy]
pub struct OrderList {
    pub side: StoredSide,
    pub best_order_idx: u8,
    pub worst_order_idx: u8,
    pub _padding: [u8; 5],
    pub free_bitmap: FreeBitmap,
    pub orders: [Order; BOOK_DEPTH],
}

impl OrderList {
    pub fn iter(&self) -> OrderListIterator {
        OrderListIterator::new(self)
    }
}

pub struct OrderListIterator<'a> {
    i: u8,
    orders: &'a [Order],
}

impl<'a> OrderListIterator<'a> {
    pub fn new(order_list: &'a OrderList) -> Self {
        Self {
            i: order_list.best_order_idx,
            orders: &order_list.orders,
        }
    }
}

impl Iterator for OrderListIterator<'_> {
    type Item = (Order, u8);

    fn next(&mut self) -> Option<Self::Item> {
        let i = self.i;

        if i == NULL || self.orders[i as usize].amount_in == 0 {
            None
        } else {
            let order = self.orders[i as usize];
            self.i = order.next_idx;
            Some((order, i))
        }
    }
}

impl OrderList {
    /// Try inserting an `Order` into the `OrderList`, returning the index of
    /// the slot where the order was placed if it was placed.
    ///
    /// If the order can be placed, debits the relevant tokens from the maker.
    pub fn insert_order(
        &mut self,
        amount: u64,
        price: u64,
        ref_id: u32,
        market_maker_index: u8,
        makers: &mut [MarketMaker; NUM_MARKET_MAKERS],
    ) -> Option<u8> {
        let mut order = Order {
            amount_in: amount,
            price,
            ref_id,
            market_maker_index,
            next_idx: NULL,
            prev_idx: NULL,
            _padding: Default::default(),
        };

        // Iterate until finding an order with an inferior price. At that point,
        // insert this order between it and the order from the previous iteration.
        let mut prev_iteration_order: Option<(Order, u8)> = None;
        for (book_order, book_order_idx) in self.iter() {
            if self.is_price_better(order.price, book_order.price) {
                let order_idx = self.free_bitmap.get_first_free_chunk().unwrap_or_else(|| {
                    // If no space remains, remove the worst-priced order from
                    // the order book, and store the current order in its chunk.
                    let i = self.worst_order_idx;
                    self.delete_order(i, makers);

                    i as usize
                });

                order.prev_idx = match prev_iteration_order {
                    Some((_, prev_order_idx)) => prev_order_idx,
                    None => NULL,
                };

                // This may evaluate to false in the rare event that this order
                // is the last one to place on the book, and the previous
                // `delete_order` removed `book_order`.
                order.next_idx = if self.orders[book_order_idx as usize].amount_in > 0 {
                    book_order_idx
                } else {
                    NULL
                };

                self.place_order(order, order_idx as u8, makers);

                return Some(order_idx as u8);
            }

            prev_iteration_order = Some((book_order, book_order_idx));
        }

        // This order is inferior to all orders on the book. Place it on the
        // book iff there is free space.
        self.free_bitmap.get_first_free_chunk().map(|free_chunk| {
            order.prev_idx = match prev_iteration_order {
                Some((_, prev_order_idx)) => prev_order_idx,
                None => NULL,
            };
            order.next_idx = NULL;

            self.place_order(order, free_chunk as u8, makers);

            free_chunk as u8
        })
    }

    //let market_maker = &mut order_book.market_makers[market_maker_index as usize];
    //match side {
    //    Side::Buy => {
    //        market_maker.quote_balance = market_maker
    //            .quote_balance
    //            .checked_sub(amount_in)
    //            .ok_or(CLOBError::InsufficientBalance)?;
    //    }
    //    Side::Sell => {
    //        market_maker.base_balance = market_maker
    //            .base_balance
    //            .checked_sub(amount_in)
    //            .ok_or(CLOBError::InsufficientBalance)?;
    //    }
    //}

    fn place_order(&mut self, order: Order, i: u8, makers: &mut [MarketMaker; NUM_MARKET_MAKERS]) {
        // this order shouldn't clobber any existing order
        assert!(self.orders[i as usize].amount_in == 0);

        if order.prev_idx == NULL {
            self.best_order_idx = i;
        } else {
            self.orders[order.prev_idx as usize].next_idx = i;
        }

        if order.next_idx == NULL {
            self.worst_order_idx = i;
        } else {
            self.orders[order.next_idx as usize].prev_idx = i;
        }

        self.debit_tokens(
            order.amount_in,
            &mut makers[order.market_maker_index as usize],
        );

        self.orders[i as usize] = order;
        self.free_bitmap.mark_reserved(i);
    }

    fn debit_tokens(&mut self, amount: u64, maker: &mut MarketMaker) {
        match self.side.into() {
            // overflow protection is compiled in with overflow-checks = true in the root Cargo.toml
            Side::Buy => maker.quote_balance -= amount,
            Side::Sell => maker.base_balance -= amount,
        };
    }

    fn credit_tokens(&mut self, amount: u64, maker: &mut MarketMaker) {
        match self.side.into() {
            Side::Buy => maker.quote_balance += amount,
            Side::Sell => maker.base_balance += amount,
        };
    }

    /// Deletes an order from the order book and returns the contents of that order.
    ///
    /// It is the client's responsibility to credit any tokens to the relevant
    /// maker.
    pub fn delete_order(&mut self, i: u8, makers: &mut [MarketMaker; NUM_MARKET_MAKERS]) -> Order {
        let order = self.orders[i as usize];

        if i == self.best_order_idx {
            self.best_order_idx = order.next_idx;
        } else {
            self.orders[order.prev_idx as usize].next_idx = order.next_idx;
        }

        if i == self.worst_order_idx {
            self.worst_order_idx = order.prev_idx;
        } else {
            self.orders[order.next_idx as usize].prev_idx = order.prev_idx;
        }

        self.credit_tokens(
            order.amount_in,
            &mut makers[order.market_maker_index as usize],
        );

        self.orders[i as usize] = Order::default();
        self.free_bitmap.mark_free(i);

        order
    }

    /// Is `lhs` a better price than `rhs`?
    fn is_price_better(&self, lhs: u64, rhs: u64) -> bool {
        match self.side.into() {
            Side::Buy => lhs > rhs,
            Side::Sell => lhs < rhs,
        }
    }
}

#[zero_copy]
pub struct Order {
    pub next_idx: u8,
    pub prev_idx: u8,
    pub market_maker_index: u8,
    pub _padding: [u8; 1],
    pub ref_id: u32,
    // if this order is filled, maker will receive (amount * price) / 1e9
    pub price: u64,
    pub amount_in: u64,
}

impl Default for Order {
    fn default() -> Self {
        Self {
            next_idx: NULL,
            prev_idx: NULL,
            market_maker_index: NULL,
            _padding: [0],
            ref_id: 0,
            price: 0,
            amount_in: 0,
        }
    }
}

#[zero_copy]
pub struct MarketMaker {
    pub base_balance: u64,
    pub quote_balance: u64,
    pub authority: Pubkey,
}
