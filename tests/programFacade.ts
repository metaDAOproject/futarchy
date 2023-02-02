import * as anchor from "@project-serum/anchor";
import { assert } from "chai";
import * as token from "@solana/spl-token";

import { randomMemberName } from "./testUtils";

import { PDAGenerator } from "./pdaGenerator";
import { Program, PublicKey } from "./metaDAO";

export class ProgramFacade {
  program: Program;
  generator: PDAGenerator;
  connection: anchor.web3.Connection;
  payer: anchor.web3.Signer;
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
    decimals?: number
  ): Promise<[anchor.web3.PublicKey, anchor.web3.Keypair]> {
    const provider = this.program.provider;
    const mintAuthority = anchor.web3.Keypair.generate();

    const mint = await token.createMint(
      provider.connection,
      this.payer,
      mintAuthority.publicKey,
      mintAuthority.publicKey,
      typeof decimals != "undefined" ? decimals : 2
    );

    return [mint, mintAuthority];
  }

  async initializeMember(name: string): Promise<PublicKey> {
    const [member] = this.generator.generateMemberPDAAddress(name);
    const [treasury] = this.generator.generateTreasuryPDAAddress(member);

    const tokenMint = await token.createMint(
      this.connection,
      this.payer,
      treasury,
      null,
      2
    );

    await this.program.methods
      .initializeMember(name)
      .accounts({
        member,
        treasury,
        tokenMint,
        initializer: this.payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedMember = await this.program.account.member.fetch(member);

    assert.equal(storedMember.name, name);
    assert.ok(storedMember.tokenMint.equals(tokenMint));

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

    assert.exists(storedProposal.state.pending);
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

    assert.notExists(storedProposal.state.pending);
    assert.exists(storedProposal.state.passed);
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

    await this.program.methods
      .initializeConditionalExpression(redeemableOnPass)
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
    assert.equal(storedConditionalExpression.passOrFailFlag, redeemableOnPass);

    return conditionalExpression;
  }

  async initializeConditionalVault(
    conditionalExpression: PublicKey,
    underlyingTokenMint: PublicKey,
    _vaultUnderlyingTokenAccount?: PublicKey,
    _vaultUnderlyingTokenAccountMint?: PublicKey,
    _conditionalTokenMint?: PublicKey
  ): Promise<[PublicKey, PublicKey, PublicKey]> {
    const [conditionalVault] =
      this.generator.generateConditionalVaultPDAAddress(
        conditionalExpression,
        underlyingTokenMint
      );

    const conditionalTokenMint =
      typeof _conditionalTokenMint == "undefined"
        ? await token.createMint(
            this.connection,
            this.payer,
            conditionalVault, // mint authority
            conditionalVault,
            2
          )
        : _conditionalTokenMint;

    const vaultUnderlyingTokenAccount =
      typeof _vaultUnderlyingTokenAccount == "undefined"
        ? (
            await token.getOrCreateAssociatedTokenAccount(
              this.connection,
              this.payer,
              typeof _vaultUnderlyingTokenAccountMint == "undefined"
                ? underlyingTokenMint
                : _vaultUnderlyingTokenAccountMint,
              conditionalVault,
              true
            )
          ).address
        : _vaultUnderlyingTokenAccount;

    await this.program.methods
      .initializeConditionalVault()
      .accounts({
        conditionalVault,
        conditionalExpression,
        underlyingTokenMint,
        conditionalTokenMint,
        vaultUnderlyingTokenAccount,
        initializer: this.payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedConditionalVault =
      await this.program.account.conditionalVault.fetch(conditionalVault);

    assert.ok(
      storedConditionalVault.conditionalExpression.equals(conditionalExpression)
    );
    assert.ok(
      storedConditionalVault.underlyingTokenAccount.equals(
        vaultUnderlyingTokenAccount
      )
    );
    assert.ok(
      storedConditionalVault.underlyingTokenMint.equals(underlyingTokenMint)
    );
    assert.ok(
      storedConditionalVault.conditionalTokenMint.equals(conditionalTokenMint)
    );

    return [
      conditionalVault,
      conditionalTokenMint,
      vaultUnderlyingTokenAccount,
    ];
  }

  async initializeDepositSlip(
    conditionalVault: PublicKey,
    _depositor?: PublicKey
  ): Promise<PublicKey> {
    const provider = this.program.provider;

    let depositor =
      typeof _depositor == "undefined" ? this.payer.publicKey : _depositor;

    const [depositSlip] = this.generator.generateDepositSlipPDAAddress(
      conditionalVault,
      depositor
    );

    await this.program.methods
      .initializeDepositSlip(depositor)
      .accounts({
        conditionalVault,
        depositSlip,
        initializer: this.payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    let storedDepositSlip = await this.program.account.vaultDepositSlip.fetch(
      depositSlip
    );

    assert.ok(storedDepositSlip.conditionalVault.equals(conditionalVault));
    assert.ok(storedDepositSlip.depositor.equals(depositor));
    assert.ok(storedDepositSlip.depositedAmount.eq(new anchor.BN(0)));

    return depositSlip;
  }
}
