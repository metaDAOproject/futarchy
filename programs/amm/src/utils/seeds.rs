#[macro_export]
macro_rules! generate_amm_seeds {
    ($amm:expr) => {{
        &[
            AMM_SEED_PREFIX,
            $amm.base_mint.as_ref(),
            $amm.quote_mint.as_ref(),
            $amm.proposal.as_ref(),
            &[$amm.bump],
        ]
    }};
}
