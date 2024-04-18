pub use amm::*;
pub use amm_position::*;

pub mod amm;
pub mod amm_position;

pub const BPS_SCALE: u64 = 100 * 100;
pub const TEN_SECONDS_IN_SLOTS: u64 = 25;
pub const ONE_MINUTE_IN_SLOTS: u64 = TEN_SECONDS_IN_SLOTS * 6;
pub const PRICE_SCALE: u128 = 1_000_000_000_000;
pub const MAX_PRICE: u128 = u64::MAX as u128 * PRICE_SCALE as u128;

pub const AMM_SEED_PREFIX: &[u8] = b"amm__";
pub const AMM_LP_MINT_SEED_PREFIX: &[u8] = b"amm_lp_mint";
pub const AMM_POSITION_SEED_PREFIX: &[u8] = b"amm_position";
pub const AMM_AUTH_SEED_PREFIX: &[u8] = b"amm_auth";
