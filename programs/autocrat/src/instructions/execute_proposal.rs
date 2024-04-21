use super::*;

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(
        mut,
        constraint = proposal.state == ProposalState::Passed @ AutocratError::ProposalNotPassed,
    )]
    pub proposal: Account<'info, Proposal>,
    pub dao: Box<Account<'info, DAO>>,
    /// CHECK: never read
    #[account(
        seeds = [dao.key().as_ref()],
        bump = dao.treasury_pda_bump,
        mut
    )]
    pub dao_treasury: UncheckedAccount<'info>,
}

impl ExecuteProposal<'_> {
    pub fn handle(ctx: Context<Self>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        proposal.state = ProposalState::Executed;

        let dao_key = ctx.accounts.dao.key();
        let treasury_seeds = &[dao_key.as_ref(), &[ctx.accounts.dao.treasury_pda_bump]];
        let signer = &[&treasury_seeds[..]];

        let mut svm_instruction: Instruction = proposal.instruction.borrow().into();
        for acc in svm_instruction.accounts.iter_mut() {
            if &acc.pubkey == ctx.accounts.dao_treasury.key {
                acc.is_signer = true;
            }
        }

        solana_program::program::invoke_signed(&svm_instruction, ctx.remaining_accounts, signer)?;

        Ok(())
    }
}
