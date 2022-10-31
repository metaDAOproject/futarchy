use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Conditional expression needs to evaluate to true before conditional tokens can be redeemed for underlying tokens")]
    CantRedeemConditionalTokens,
    #[msg("Conditional expression needs to evaluate to false before deposit accounts can be redeemed for underlying tokens")]
    CantRedeemDepositAccount,
}