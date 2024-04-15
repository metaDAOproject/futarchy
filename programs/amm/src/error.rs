use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Add liquidity calculation error")]
    AddLiquidityCalculationError,
    #[msg("Error in decimal scale conversion")]
    DecimalScaleError,
}
