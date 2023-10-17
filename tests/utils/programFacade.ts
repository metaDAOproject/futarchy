import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";
import * as token from "@solana/spl-token";

import { randomMemberName } from "./testUtils";

import { PDAGenerator } from "./pdaGenerator";
import { Program, PublicKey, Signer } from "./metaDAO";

export class ProgramFacade {
  program: Program;
  generator: PDAGenerator;
  connection: anchor.web3.Connection;
  payer: Signer;
  metaDAO: PublicKey;

  constructor(program: Program) {
    this.generator = new PDAGenerator(program);
    this.program = program;
    this.connection = program.provider.connection;
    this.payer = program.provider.wallet.payer;
  }

  async createTokenAccount(
    mint: PublicKey,
    owner: PublicKey
  ): Promise<PublicKey> {
    return await token.createAccount(this.connection, this.payer, mint, owner);
  }

  async createMint(
    decimals?: number,
    mintAuthority?: PublicKey
  ): Promise<[PublicKey, Signer | PublicKey]> {
    let mintAuthorityToUse;
    let mintAuthorityToReturn;

    if (typeof mintAuthority != "undefined") {
      mintAuthorityToUse = mintAuthority;
      mintAuthorityToReturn = mintAuthority;
    } else {
      let signer = anchor.web3.Keypair.generate();
      mintAuthorityToUse = signer.publicKey;
      mintAuthorityToReturn = signer;
    }

    const mint = await token.createMint(
      this.connection,
      this.payer,
      mintAuthorityToUse,
      mintAuthorityToUse,
      typeof decimals != "undefined" ? decimals : 2
    );

    return [mint, mintAuthorityToReturn];
  }

  async mintTo(
    mint: PublicKey,
    destination: PublicKey,
    mintAuthority: Signer,
    amount: number
  ) {
    await token.mintTo(
      this.connection,
      this.payer,
      mint,
      destination,
      mintAuthority,
      amount
    );
  }

  async transfer(
    from: PublicKey,
    to: PublicKey,
    amount: number,
    authority: Signer
  ) {
    await token.transfer(
      this.connection,
      this.payer,
      from,
      to,
      authority,
      amount
    );
  }

  async initializeMember(name: string): Promise<PublicKey> {
    const [member] = this.generator.generateMemberPDAAddress(name);
    const [treasury] = this.generator.generateTreasuryPDAAddress(member);

    const tokenMint = anchor.web3.Keypair.generate();

    await this.program.methods
      .initializeMember(name)
      .accounts({
        member,
        treasury,
        tokenMint: tokenMint.publicKey,
        initializer: this.payer.publicKey,
      })
      .signers([tokenMint])
      .rpc();

    const storedMember = await this.program.account.member.fetch(member);

    assert.equal(storedMember.name, name);
    assert.ok(storedMember.tokenMint.equals(tokenMint.publicKey));

    return member;
  }

  async initializeMetaDAO(seedMember: PublicKey): Promise<PublicKey> {
    const [metaDAO] = this.generator.generateMetaDAOPDAAddress();

    await this.program.methods
      .initializeMetaDao()
      .accounts({
        metaDao: metaDAO,
        seedMember,
        initializer: this.payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedMetaDAO = await this.program.account.metaDao.fetch(metaDAO);

    assert.equal(storedMetaDAO.members.length, 1);

    this.metaDAO = metaDAO;

    return metaDAO;
  }

  async getOrCreateMetaDAO() {
    if (this.metaDAO == null) {
      let seedMember = await this.initializeMember(randomMemberName());
      await this.initializeMetaDAO(seedMember);
    }

    return this.metaDAO;
  }

  async initializeProposal(
    metaDAO: PublicKey,
    instructions: [],
    accounts: []
  ): Promise<PublicKey> {
    const provider = this.program.provider;
    const proposalKeypair = anchor.web3.Keypair.generate();

    await this.program.methods
      .initializeProposal(instructions, accounts)
      .preInstructions([
        await this.program.account.proposal.createInstruction(
          proposalKeypair,
          1000
        ),
      ])
      .accounts({
        proposal: proposalKeypair.publicKey,
        metaDao: metaDAO,
        initializer: this.payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([proposalKeypair])
      .rpc();

    const storedProposal = await this.program.account.proposal.fetch(
      proposalKeypair.publicKey
    );

    assert.exists(storedProposal.status.pending);
    assert.equal(storedProposal.instructions.length, instructions.length);

    for (let i = 0; i < instructions.length; i++) {
      const ix = instructions[i];
      const storedIx = storedProposal.instructions[i];

      // assert.ok(storedIx.memberSigner.equals(ix.memberSigner));
      assert.ok(storedIx.programId.equals(ix.programId));
      assert.deepEqual(storedIx.accounts, ix.accounts);
      assert.deepEqual(storedIx.data, ix.data);
    }

    return proposalKeypair.publicKey;
  }

  async executeProposal(proposal: PublicKey, remainingAccounts?: []) {
    let builder = this.program.methods.executeProposal().accounts({
      proposal,
    });

    if (typeof remainingAccounts != "undefined") {
      builder = builder.remainingAccounts(remainingAccounts);
    }

    await builder.rpc();

    const storedProposal = await this.program.account.proposal.fetch(proposal);

    assert.notExists(storedProposal.status.pending);
    assert.exists(storedProposal.status.passed);
  }

  async initializeConditionalExpression(
    proposal: anchor.web3.PublicKey,
    redeemableOnPass: boolean
  ): Promise<PublicKey> {
    const [conditionalExpression] =
      this.generator.generateConditionalExpressionPDAAddress(
        proposal,
        redeemableOnPass
      );

    const passOrFail = redeemableOnPass ? { pass: {} } : { fail: {} };

    await this.program.methods
      .initializeConditionalExpression(passOrFail)
      .accounts({
        conditionalExpression,
        initializer: this.payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        proposal,
      })
      .rpc();

    const storedConditionalExpression =
      await this.program.account.conditionalExpression.fetch(
        conditionalExpression
      );

    assert.ok(storedConditionalExpression.proposal.equals(proposal));
    assert.deepEqual(storedConditionalExpression.passOrFail, passOrFail);

    return conditionalExpression;
  }

  async initializeVault(
    conditionalExpression: PublicKey,
    underlyingTokenMint: PublicKey
  ): Promise<[PublicKey, PublicKey, PublicKey]> {
    const [vault] = this.generator.generateVaultPDAAddress(
      conditionalExpression,
      underlyingTokenMint
    );

    const conditionalTokenMint: Signer = anchor.web3.Keypair.generate();
    const vaultUnderlyingTokenAccount = await token.getAssociatedTokenAddress(
      underlyingTokenMint,
      vault,
      true
    );

    await this.program.methods
      .initializeVault()
      .accounts({
        vault,
        conditionalExpression,
        underlyingTokenMint,
        conditionalTokenMint: conditionalTokenMint.publicKey,
        vaultUnderlyingTokenAccount,
        initializer: this.payer.publicKey,
      })
      .signers([conditionalTokenMint])
      .rpc();

    const storedVault = await this.program.account.vault.fetch(vault);

    assert.ok(storedVault.conditionalExpression.equals(conditionalExpression));
    assert.ok(
      storedVault.underlyingTokenAccount.equals(vaultUnderlyingTokenAccount)
    );
    assert.ok(storedVault.underlyingTokenMint.equals(underlyingTokenMint));
    assert.ok(
      storedVault.conditionalTokenMint.equals(conditionalTokenMint.publicKey)
    );

    return [vault, conditionalTokenMint.publicKey, vaultUnderlyingTokenAccount];
  }

  async initializeDepositSlip(
    vault: PublicKey,
    _depositor?: PublicKey
  ): Promise<PublicKey> {
    const provider = this.program.provider;

    let depositor =
      typeof _depositor == "undefined" ? this.payer.publicKey : _depositor;

    const [depositSlip] = this.generator.generateDepositSlipPDAAddress(
      vault,
      depositor
    );

    await this.program.methods
      .initializeDepositSlip(depositor)
      .accounts({
        vault,
        depositSlip,
        initializer: this.payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    let storedDepositSlip = await this.program.account.depositSlip.fetch(
      depositSlip
    );

    assert.ok(storedDepositSlip.vault.equals(vault));
    assert.ok(storedDepositSlip.user.equals(depositor));
    assert.ok(storedDepositSlip.depositedAmount.eq(new anchor.BN(0)));

    return depositSlip;
  }

  async mintConditionalTokens(
    amount: number,
    user: Signer,
    depositSlip: PublicKey,
    vault: PublicKey,
    vaultUnderlyingTokenAccount: PublicKey,
    userUnderlyingTokenAccount: PublicKey,
    conditionalTokenMint: PublicKey,
    userConditionalTokenAccount: PublicKey
  ) {
    const depositSlipBefore = await this.program.account.depositSlip.fetch(
      depositSlip
    );
    const vaultUnderlyingTokenAccountBefore = await token.getAccount(
      this.connection,
      vaultUnderlyingTokenAccount
    );
    const userUnderlyingTokenAccountBefore = await token.getAccount(
      this.connection,
      userUnderlyingTokenAccount
    );
    const userConditionalTokenAccountBefore = await token.getAccount(
      this.connection,
      userConditionalTokenAccount
    );

    const bnAmount = new anchor.BN(amount);
    await this.program.methods
      .mintConditionalTokens(bnAmount)
      .accounts({
        user: user.publicKey,
        depositSlip,
        vault,
        vaultUnderlyingTokenAccount,
        userUnderlyingTokenAccount,
        conditionalTokenMint,
        userConditionalTokenAccount,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    const depositSlipAfter = await this.program.account.depositSlip.fetch(
      depositSlip
    );
    const vaultUnderlyingTokenAccountAfter = await token.getAccount(
      this.connection,
      vaultUnderlyingTokenAccount
    );
    const userUnderlyingTokenAccountAfter = await token.getAccount(
      this.connection,
      userUnderlyingTokenAccount
    );
    const userConditionalTokenAccountAfter = await token.getAccount(
      this.connection,
      userConditionalTokenAccount
    );

    assert.ok(
      depositSlipAfter.depositedAmount.eq(
        depositSlipBefore.depositedAmount.add(bnAmount)
      )
    );
    assert.equal(
      vaultUnderlyingTokenAccountAfter.amount,
      vaultUnderlyingTokenAccountBefore.amount + BigInt(amount)
    );
    assert.equal(
      userUnderlyingTokenAccountAfter.amount,
      userUnderlyingTokenAccountBefore.amount - BigInt(amount)
    );
    assert.equal(
      userConditionalTokenAccountAfter.amount,
      userConditionalTokenAccountBefore.amount + BigInt(amount)
    );
  }

  async redeemConditionalForUnderlyingTokens(
    user: Signer,
    userConditionalTokenAccount: PublicKey,
    userUnderlyingTokenAccount: PublicKey,
    vaultUnderlyingTokenAccount: PublicKey,
    vault: PublicKey,
    proposal: PublicKey,
    conditionalExpression: PublicKey,
    conditionalTokenMint: PublicKey
  ) {
    const vaultUnderlyingTokenAccountBefore = await token.getAccount(
      this.connection,
      vaultUnderlyingTokenAccount
    );
    const userUnderlyingTokenAccountBefore = await token.getAccount(
      this.connection,
      userUnderlyingTokenAccount
    );
    const userConditionalTokenAccountBefore = await token.getAccount(
      this.connection,
      userConditionalTokenAccount
    );

    await this.program.methods
      .redeemConditionalTokensForUnderlyingTokens()
      .accounts({
        user: user.publicKey,
        userConditionalTokenAccount,
        userUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault,
        proposal,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        conditionalExpression,
        conditionalTokenMint,
      })
      .signers([user])
      .rpc();

    const vaultUnderlyingTokenAccountAfter = await token.getAccount(
      this.connection,
      vaultUnderlyingTokenAccount
    );
    const userUnderlyingTokenAccountAfter = await token.getAccount(
      this.connection,
      userUnderlyingTokenAccount
    );
    const userConditionalTokenAccountAfter = await token.getAccount(
      this.connection,
      userConditionalTokenAccount
    );

    assert.equal(
      vaultUnderlyingTokenAccountAfter.amount,
      vaultUnderlyingTokenAccountBefore.amount -
        BigInt(userConditionalTokenAccountBefore.amount)
    );
    assert.equal(
      userUnderlyingTokenAccountAfter.amount,
      userUnderlyingTokenAccountBefore.amount +
        BigInt(userConditionalTokenAccountBefore.amount)
    );
    assert.equal(userConditionalTokenAccountAfter.amount, BigInt(0));
  }

  async redeemDepositSlipForUnderlyingTokens(
    user: Signer,
    userDepositSlip: PublicKey,
    userUnderlyingTokenAccount: PublicKey,
    vaultUnderlyingTokenAccount: PublicKey,
    vault: PublicKey,
    proposal: PublicKey,
    conditionalExpression: PublicKey
  ) {
    // const vaultUnderlyingTokenAccountBefore = await token.getAccount(
    //   this.connection,
    //   vaultUnderlyingTokenAccount
    // );
    // const userUnderlyingTokenAccountBefore = await token.getAccount(
    //   this.connection,
    //   userUnderlyingTokenAccount
    // );
    // const userConditionalTokenAccountBefore = await token.getAccount(
    //   this.connection,
    //   userConditionalTokenAccount
    // );

    await this.program.methods
      .redeemDepositSlipForUnderlyingTokens()
      .accounts({
        user: user.publicKey,
        userDepositSlip,
        userUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault,
        proposal,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        conditionalExpression,
      })
      .signers([user])
      .rpc();

    // const vaultUnderlyingTokenAccountAfter = await token.getAccount(
    //   this.connection,
    //   vaultUnderlyingTokenAccount
    // );
    // const userUnderlyingTokenAccountAfter = await token.getAccount(
    //   this.connection,
    //   userUnderlyingTokenAccount
    // );
    // const userConditionalTokenAccountAfter = await token.getAccount(
    //   this.connection,
    //   userConditionalTokenAccount
    // );

    // assert.equal(
    //   vaultUnderlyingTokenAccountAfter.amount,
    //   vaultUnderlyingTokenAccountBefore.amount -
    //     BigInt(userConditionalTokenAccountBefore.amount)
    // );
    // assert.equal(
    //   userUnderlyingTokenAccountAfter.amount,
    //   userUnderlyingTokenAccountBefore.amount +
    //     BigInt(userConditionalTokenAccountBefore.amount)
    // );
    // assert.equal(userConditionalTokenAccountAfter.amount, BigInt(0));
  }

  async failProposal(proposal: PublicKey) {
    await this.program.methods.failProposal().accounts({ proposal }).rpc();
  }
}
