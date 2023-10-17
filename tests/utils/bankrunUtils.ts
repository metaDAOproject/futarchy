import * as anchor from "@project-serum/anchor";
const { Signer, PublicKey, Transaction, Commitment, ConfirmOptions } =
  anchor.web3;
import * as token from "@solana/spl-token";
import {
  BanksClient,
  BanksTransactionMeta,
  ProgramTestContext,
} from "solana-bankrun";

export async function createMint(
  banksClient: BanksClient,
  payer: Keypair,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number,
  keypair = anchor.web3.Keypair.generate(),
  programId = token.TOKEN_PROGRAM_ID
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
  confirmOptions?: ConfirmOptions,
  programId = token.TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  let rent = await banksClient.getRent();
  // If a keypair isn't provided, create the associated token account and return its address
  if (!keypair)
    return await createAssociatedTokenAccount(
      banksClient,
      payer,
      mint,
      owner,
      programId
    );

  // Otherwise, create the account with the provided keypair and return its public key
  const mintState = await getMint(
    banksClient,
    mint,
    confirmOptions?.commitment,
    programId
  );
  const space = token.getAccountLenForMint(mintState);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: keypair.publicKey,
      space,
      lamports: Number(await rent.minimumBalance(BigInt(space))),
      programId,
    }),
    token.createInitializeAccountInstruction(
      keypair.publicKey,
      mint,
      owner,
      programId
    )
  );
  [tx.recentBlockhash] = await banksClient.getLatestBlockhash();
  tx.sign(payer, keypair);

  await banksClient.processTransaction(tx);

  return keypair.publicKey;
}

export async function createAssociatedTokenAccount(
  banksClient: BanksClient,
  payer: Signer,
  mint: PublicKey,
  owner: PublicKey,
  programId = token.TOKEN_PROGRAM_ID,
  associatedTokenProgramId = token.ASSOCIATED_TOKEN_PROGRAM_ID
): Promise<PublicKey> {
  const associatedToken = token.getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    programId,
    associatedTokenProgramId
  );

  const tx = new Transaction().add(
    token.createAssociatedTokenAccountInstruction(
      payer.publicKey,
      associatedToken,
      owner,
      mint,
      programId,
      associatedTokenProgramId
    )
  );

  [tx.recentBlockhash] = await banksClient.getLatestBlockhash();
  tx.sign(payer);

  await banksClient.processTransaction(tx);

  return associatedToken;
}

export async function getMint(
  banksClient: BanksClient,
  address: PublicKey,
  commitment?: Commitment,
  programId = token.TOKEN_PROGRAM_ID
): Promise<Mint> {
  const info = await banksClient.getAccountInfo(address, commitment);
  return token.unpackMint(address, info, programId);
}

// `mintTo` without the mintAuthority signer
// uses bankrun's special `setAccount` function
export async function mintToOverride(
  context: ProgramTestContext,
  destination: PublicKey,
  amount: bigint
) {
  const banksClient = context.banksClient;

  const existingAccount = await getAccount(banksClient, destination);
  const { mint, owner } = existingAccount;

  const accData = Buffer.alloc(token.ACCOUNT_SIZE);
  token.AccountLayout.encode(
    {
      mint,
      owner,
      amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      delegatedAmount: 0n,
      state: 1,
      isNativeOption: 0,
      isNative: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    accData
  );

  await context.setAccount(destination, {
    data: accData,
    executable: false,
    lamports: 1_000_000_000n,
    owner: token.TOKEN_PROGRAM_ID,
  });
}

export async function mintTo(
  banksClient: BanksClient,
  payer: Signer,
  mint: PublicKey,
  destination: PublicKey,
  authority: Signer | PublicKey,
  amount: number | bigint,
  multiSigners: Signer[] = [],
  programId = token.TOKEN_PROGRAM_ID
): Promise<BanksTransactionMeta> {
  const [authorityPublicKey, signers] = getSigners(authority, multiSigners);

  const tx = new Transaction().add(
    token.createMintToInstruction(
      mint,
      destination,
      authorityPublicKey,
      amount,
      multiSigners,
      programId
    )
  );
  [tx.recentBlockhash] = await banksClient.getLatestBlockhash();
  tx.sign(payer, ...signers);

  return await banksClient.processTransaction(tx);
}

export function getSigners(
  signerOrMultisig: Signer | PublicKey,
  multiSigners: Signer[]
): [PublicKey, Signer[]] {
  return signerOrMultisig instanceof PublicKey
    ? [signerOrMultisig, multiSigners]
    : [signerOrMultisig.publicKey, [signerOrMultisig]];
}

export async function getAccount(
  banksClient: BanksClient,
  address: PublicKey,
  commitment?: Commitment,
  programId = token.TOKEN_PROGRAM_ID
): Promise<Account> {
  const info = await banksClient.getAccount(address, commitment);
  return token.unpackAccount(address, info, programId);
}
