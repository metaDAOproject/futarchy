use anchor_lang::prelude::*;
use anchor_spl::token;

pub fn token_mint_signed<'info, P: ToAccountInfo<'info>, M: ToAccountInfo<'info>, T: ToAccountInfo<'info>, A: ToAccountInfo<'info>>(
    amount: u64,
    token_program: &P,
    mint: &M,
    to: &T,
    authority: &A,
    seeds: &[&[u8]],
) -> Result<()> {
    if amount > 0 {
        token::mint_to(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                token::MintTo {
                    mint: mint.to_account_info(),
                    to: to.to_account_info(),
                    authority: authority.to_account_info(),
                },
                &[&seeds[..]],
            ),
            amount,
        )?
    }

    Ok(())
}

pub fn token_burn<'info, P: ToAccountInfo<'info>, M: ToAccountInfo<'info>, F: ToAccountInfo<'info>, A: ToAccountInfo<'info>>(
    amount: u64,
    token_program: &P,
    mint: &M,
    from: &F,
    authority: &A,
) -> Result<()> {
    if amount > 0 {
        token::burn(
            CpiContext::new(
                token_program.to_account_info(),
                token::Burn {
                    mint: mint.to_account_info(),
                    from: from.to_account_info(),
                    authority: authority.to_account_info(),
                },
            ),
            amount,
        )?
    }

    Ok(())
}

pub fn token_transfer<'info, P: ToAccountInfo<'info>, F: ToAccountInfo<'info>, T: ToAccountInfo<'info>, A: ToAccountInfo<'info>>(
    amount: u64,
    token_program: &P,
    from: &F,
    to: &T,
    authority: &A,
) -> Result<()> {
    if amount > 0 {
        token::transfer(
            CpiContext::new(
                token_program.to_account_info(),
                token::Transfer {
                    from: from.to_account_info(),
                    to: to.to_account_info(),
                    authority: authority.to_account_info(),
                },
            ),
            amount,
        )?
    }

    Ok(())
}

pub fn token_transfer_signed<'info, P: ToAccountInfo<'info>, F: ToAccountInfo<'info>, T: ToAccountInfo<'info>, A: ToAccountInfo<'info>>(
    amount: u64,
    token_program: &P,
    from: &F,
    to: &T,
    authority: &A,
    seeds: &[&[u8]],
) -> Result<()> {
    if amount > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                token::Transfer {
                    from: from.to_account_info(),
                    to: to.to_account_info(),
                    authority: authority.to_account_info(),
                },
                &[&seeds[..]],
            ),
            amount,
        )?
    }

    Ok(())
}
