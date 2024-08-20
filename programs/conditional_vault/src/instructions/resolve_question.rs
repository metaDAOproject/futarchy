use super::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ResolveQuestionArgs {
    pub payout_numerators: Vec<u32>,
}

#[derive(Accounts)]
#[instruction(args: ResolveQuestionArgs)]
pub struct ResolveQuestion<'info> {
    #[account(mut, has_one = oracle)]
    pub question: Account<'info, Question>,
    pub oracle: Signer<'info>,
}

impl ResolveQuestion<'_> {
    pub fn handle(ctx: Context<Self>, args: ResolveQuestionArgs) -> Result<()> {
        let question = &mut ctx.accounts.question;

        require_eq!(
            args.payout_numerators.len(),
            question.num_conditions(),
            VaultError::InvalidNumPayoutNumerators
        );

        question.is_resolved = true;
        question.payout_denominator = args.payout_numerators.iter().sum();
        question.payout_numerators = args.payout_numerators;

        Ok(())
    }
}
