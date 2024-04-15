pub use amm::*;
pub use amm_position::*;

pub mod amm;
pub mod amm_position;

pub const BPS_SCALE: u64 = 100 * 100;

pub const AMM_SEED_PREFIX: &[u8] = b"amm__";
pub const AMM_POSITION_SEED_PREFIX: &[u8] = b"amm_position";
pub const AMM_AUTH_SEED_PREFIX: &[u8] = b"amm_auth";
