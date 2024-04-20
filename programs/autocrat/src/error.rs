use super::*;

#[error_code]
pub enum AutocratError {
    #[msg(
        "Either the `pass_market` or the `fail_market`'s tokens doesn't match the vaults supplied"
    )]
    InvalidMarket,
    #[msg("`TWAPMarket` must have an `initial_slot` within 50 slots of the proposal's `slot_enqueued`")]
    TWAPMarketTooOld,
    #[msg("`TWAPOracle` has an incorrect max_observation_change_per_update_lots value")]
    TWAPOracleWrongChangeLots,
    #[msg("`TWAPMarket` has the wrong `expected_value`")]
    TWAPMarketInvalidExpectedValue,
    #[msg("One of the vaults has an invalid `settlement_authority`")]
    InvalidSettlementAuthority,
    #[msg("Proposal is too young to be executed or rejected")]
    ProposalTooYoung,
    #[msg("Markets too young for proposal to be finalized. TWAP might need to be cranked")]
    MarketsTooYoung,
    #[msg("This proposal has already been finalized")]
    ProposalAlreadyFinalized,
    #[msg("A conditional vault has an invalid nonce. A nonce should encode the proposal number")]
    InvalidVaultNonce,
    #[msg("This proposal can't be executed because it isn't in the passed state")]
    ProposalNotPassed,
}