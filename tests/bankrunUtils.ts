import * as anchor from "@project-serum/anchor";
import { Signer, PublicKey } from anchor.web3;
import * as token from "@solana/spl-token";
import { BanksClient } from "solana-bankrun";

export async function createMint(
  banksClient: BanksClient,
  payer: Keypair,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number,
  keypair = anchor.web3.Keypair.generate(),
  programId = token.TOKEN_PROGRAM_ID,
): PublicKey {
    let rent = await banksClient.getRent();

    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: keypair.publicKey,
        space: token.MINT_SIZE,
        lamports: Number(await rent.minimumBalance(BigInt(token.MINT_SIZE))),
        programId: token.TOKEN_PROGRAM_ID,
      }),
      token.createInitializeMint2Instruction(
        keypair.publicKey,
        decimals,
        mintAuthority,
        freezeAuthority,
        programId
      )
    );
    [tx.recentBlockhash] = await banksClient.getLatestBlockhash();
    tx.sign(payer, keypair);

    await banksClient.processTransaction(tx);
    
    return keypair.publicKey;
}

export async function createAccount(
    banksClient: BanksClient,
    payer: Signer,
    mint: PublicKey,
    owner: PublicKey,
    keypair?: Keypair,
    programId = token.TOKEN_PROGRAM_ID
): Promise<PublicKey> {
    // If a keypair isn't provided, create the associated token account and return its address
    if (!keypair) return await createAssociatedTokenAccount(connection, payer, mint, owner, confirmOptions, programId);

    // Otherwise, create the account with the provided keypair and return its public key
    const mintState = await getMint(connection, mint, confirmOptions?.commitment, programId);
    const space = getAccountLenForMint(mintState);
    const lamports = await connection.getMinimumBalanceForRentExemption(space);

    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: keypair.publicKey,
            space,
            lamports,
            programId,
        }),
        createInitializeAccountInstruction(keypair.publicKey, mint, owner, programId)
    );

    await sendAndConfirmTransaction(connection, transaction, [payer, keypair], confirmOptions);

    return keypair.publicKey;
}
