use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Proposal signers need to be either active members or the Meta-DAO.")]
    InvalidSigner,
    #[msg("Function can only be called recursively (during execution of a passed proposal)")]
    UnauthorizedFunctionCall,
    #[msg("This member is already active and thus cannot be added")]
    MemberAlreadyActive,
    #[msg("A signer pubkey should have been set to the Meta-DAO account pubkey but it wasn't")]
    InvalidMetaDAOSigner,
    #[msg("Proposals cannot be re-executed")]
    NoProposalReplay,
    #[msg("An inactive member (one that is not a part of the Meta-DAO `members` vector) cannot execute proposals")]
    InactiveMember,
    #[msg("Insufficient underlying token balance to mint this amount of conditional tokens")]
    InsufficientUnderlyingTokens,
    #[msg("This `vault_underlying_token_account` is not this vault's `underlying_token_account`")]
    InvalidVaultUnderlyingTokenAccount,
    #[msg("This `conditional_token_mint` is not this vault's `conditional_token_mint`")]
    InvalidConditionalTokenMint,
    #[msg("Conditional expression needs to evaluate to true before conditional tokens can be redeemed for underlying tokens")]
    CantRedeemConditionalTokens,
    #[msg("Conditional expression needs to evaluate to false before deposit slips can be redeemed for underlying tokens")]
    CantRedeemDepositSlip,
}
