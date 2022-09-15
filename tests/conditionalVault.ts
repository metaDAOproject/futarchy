import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { ConditionalVault } from "../target/types/conditional_vault";
import { expect, assert } from "chai";

describe("Conditional vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ConditionalVault as Program<ConditionalVault>;

  it("Accounts can initialize conditional token accounts", async () => {
    const conditionalTokenAccount = anchor.web3.Keypair.generate();
    const proposalNumber = 564;
    const redeemableOnPass = true;

    await program.methods.initializeConditionalTokenAccount(new anchor.BN(proposalNumber), redeemableOnPass)
    	.accounts({
		    conditionalTokenAccount: conditionalTokenAccount.publicKey,
		    authority: provider.wallet.publicKey,
		    systemProgram: anchor.web3.SystemProgram.programId
	})
	.signers([conditionalTokenAccount])
	.rpc();

    const createdAccount = await program.account.conditionalTokenAccount.fetch(conditionalTokenAccount.publicKey);

    assert.ok(createdAccount.balance.eq(new anchor.BN(0)));
    assert.ok(createdAccount.proposalNumber.eq(new anchor.BN(proposalNumber)));
    assert.ok(createdAccount.authority.equals(provider.wallet.publicKey)); 
    assert.equal(createdAccount.redeemableOnPass, redeemableOnPass);
  });

  it("Accounts can mint redeemable-on-pass tokens", async () => {
    //
  });

  it("Accounts can mint redeemable-on-fail tokens", async () => {
    //
  });

  it("Accounts cannot mint conditional tokens for a proposal that isn't active", async () => {
    //
  });

  it("Accounts cannot mint conditional tokens with an insufficient normal token balance", async () => {
    //
  });

  it("Accounts can burn redeemable-on-pass tokens", async () => {
    //
  });
  it("Accounts can burn redeemable-on-fail tokens", async () => {
    //
  });

  it("Accounts cannot burn conditional tokens before a proposal has passed or failed", async () => {
    //
  });


});
