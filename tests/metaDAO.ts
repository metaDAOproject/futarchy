import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { MetaDao } from "../target/types/meta_dao";

describe("metaDAO", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.MetaDao as Program<MetaDao>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
