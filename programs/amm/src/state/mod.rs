pub use amm::*;
pub use amm_position::*;

pub mod amm;
pub mod amm_position;

pub const BPS_SCALE: u64 = 100 * 100;
pub const TEN_SECONDS_IN_SLOTS: u64 = 25;
pub const ONE_MINUTE_IN_SLOTS: u64 = TEN_SECONDS_IN_SLOTS * 6;
pub const Q32: u128 = 2_u128.pow(32);

pub const AMM_SEED_PREFIX: &[u8] = b"amm__";
pub const AMM_POSITION_SEED_PREFIX: &[u8] = b"amm_position";
pub const AMM_AUTH_SEED_PREFIX: &[u8] = b"amm_auth";
