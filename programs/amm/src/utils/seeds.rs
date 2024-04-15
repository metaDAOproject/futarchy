use crate::state::*;

#[macro_export]
macro_rules! generate_vault_seeds {
    ($base_mint:expr, $quote_mint:expr, $swap_fee_bps:expr, $permissioned_caller:expr, $bump:expr) => {{
        &[
            AMM_SEED_PREFIX,
            $base_mint.as_ref(),
            $quote_mint.as_ref(),
            $swap_fee_bps.as_ref(),
            $permissioned_caller.as_ref(),
            &[$bump],
        ]
    }};
}
