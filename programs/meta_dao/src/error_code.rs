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
    #[msg("Conditional expression needs to evaluate to true before conditional tokens can be redeemed for underlying tokens")]
    CantRedeemConditionalTokens,
    #[msg("Conditional expression needs to evaluate to false before deposit accounts can be redeemed for underlying tokens")]
    CantRedeemDepositAccount,
}
