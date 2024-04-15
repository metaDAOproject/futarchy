use anchor_lang::prelude::*;

#[error_code]
pub enum AmmError {
    #[msg("Can't get a TWAP before some observations have been stored")]
    NoSlotsPassed,
    #[msg("Can't swap through a pool without token reserves on either side")]
    NoReserves,
    #[msg("Input token amount is too large for a swap, causes overflow")]
    InputAmountOverflow,
    #[msg("Add liquidity calculation error")]
    AddLiquidityCalculationError,
    #[msg("Error in decimal scale conversion")]
    DecimalScaleError,
}
