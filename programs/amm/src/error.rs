use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Add liquidity calculation error")]
    AddLiquidityCalculationError,
    #[msg("Error in decimal scale conversion")]
    DecimalScaleError,
}

#[macro_export]
macro_rules! print_error {
    ($err:expr) => {{
        || {
            let error_code: ErrorCode = $err;
            msg!("{:?} thrown at {}:{}", error_code, file!(), line!());
            $err
        }
    }};
}
