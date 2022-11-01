import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { MetaDao as MetaDAO } from "../target/types/meta_dao";
import { expect, assert } from "chai";
import * as token from "@solana/spl-token";
import * as accountInitUtils from "./accountInitializationUtils";
import {
  generateConditionalVaultPDAAddress,
  generateDepositAccountPDAAddress,
  generateConditionalExpressionPDAAddress,
} from "./pdaGenerationUtils";
import * as utils from "./utils"; 

export type Program = anchor.Program<MetaDAO>;

describe("Meta-DAO", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .MetaDao as Program<MetaDAO>;

  it("Can be initialized", async () => {
    const proposal = await accountInitUtils.initializeProposalAccount(
      program,
      123
    );
    const conditionalExpression =
      await accountInitUtils.initializeConditionalExpression(
        program,
        proposal,
        true
      );
    console.log(program.programId);
    await accountInitUtils.initializeMetaDAO(program);

  });
});

