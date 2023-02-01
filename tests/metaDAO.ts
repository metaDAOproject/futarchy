import * as anchor from "@project-serum/anchor";

import { expect, assert } from "chai";
import { randomBytes } from "crypto";

import { MetaDao as MetaDAO } from "../target/types/meta_dao";
import { AccountInitializer } from "./accountInitializer";

export type Program = anchor.Program<MetaDAO>;
export type PublicKey = anchor.web3.PublicKey;

const randomMemberName = () => randomBytes(5).toString("hex");

describe("meta_dao", async function () {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MetaDao as Program;

  let initializer: AccountInitializer;
  before(function () {
    initializer = new AccountInitializer(program);
  });

  describe("#initialize_member", async function () {
    it("initializes members", async function () {
      await initializer.initializeMember(randomMemberName());
    });
  });

  describe("#initialize_meta_dao", async function () {
    it("initializes the Meta-DAO", async function () {
      const seedMember = await initializer.initializeMember(randomMemberName());
      await initializer.initializeMetaDAO(seedMember);
    })
  })
});
