use super::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeQuestionArgs {
    pub question_id: [u8; 32],
    pub oracle: Pubkey,
    pub num_conditions: u8,
}

#[derive(Accounts)]
#[instruction(args: InitializeQuestionArgs)]
pub struct InitializeQuestion<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 1 + 4 + (args.num_conditions as usize * 4) + 4,
        seeds = [
            b"question", 
            args.question_id.as_ref(),
            args.oracle.key().as_ref(),
            &[args.num_conditions],
        ],
        bump
    )]
    pub question: Box<Account<'info, Question>>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl InitializeQuestion<'_> {
    pub fn handle(ctx: Context<Self>, args: InitializeQuestionArgs) -> Result<()> {
        require_gte!(
            args.num_conditions,
            2,
            VaultError::InsufficientNumConditions
        );

        let question = &mut ctx.accounts.question;

        let InitializeQuestionArgs {
            question_id,
            oracle,
            num_conditions,
        } = args;

        question.set_inner(Question {
            question_id,
            oracle,
            payout_numerators: vec![0; num_conditions as usize],
            payout_denominator: 0,
        });

        Ok(())
    }
}
