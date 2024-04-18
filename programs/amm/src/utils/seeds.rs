#[macro_export]
macro_rules! generate_vault_seeds {
    ($base_mint:expr, $quote_mint:expr, $bump:expr) => {{
        &[
            AMM_SEED_PREFIX,
            $base_mint.as_ref(),
            $quote_mint.as_ref(),
            &[$bump],
        ]
    }};
}
