use super::*;

#[error_code]
pub enum CLOBError {
    #[msg("Tried to become a market maker in an index that is already taken")]
    IndexAlreadyTaken,
    #[msg("This signer does not have authority over this market maker index")]
    UnauthorizedMarketMaker,
    #[msg("This market maker has insufficient balance for this limit order")]
    InsufficientBalance,
    #[msg("This limit order's price was not good enough to land on the order book")]
    InferiorPrice,
    #[msg("This take order could not be filled at this `min_out`")]
    TakeNotFilled,
    #[msg("Unable to find this maker for this market")]
    MakerNotFound,
    #[msg("The admin is trying to set a configurable to a disallowed value")]
    DisallowedConfigValue,
    #[msg("Your size is not size. Try a bigger limit order")]
    MinLimitAmountNotMet,
}
