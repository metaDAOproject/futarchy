use super::*;

#[error_code]
pub enum AutocratError {
    #[msg("Amms must have been created within 5 minutes (counted in slots) of proposal initialization")]
    AmmTooOld,
    #[msg("An amm has an `initial_observation` that doesn't match the `dao`'s config")]
    InvalidInitialObservation,
    #[msg("An amm has a `max_observation_change_per_update` that doesn't match the `dao`'s config")]
    InvalidMaxObservationChange,
    // #[msg("`TWAPOracle` has an incorrect max_observation_change_per_update_lots value")]
    // TWAPOracleWrongChangeLots,
    // #[msg("`TWAPMarket` has the wrong `expected_value`")]
    // TWAPMarketInvalidExpectedValue,
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