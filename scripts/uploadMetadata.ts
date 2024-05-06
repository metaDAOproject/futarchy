import * as anchor from "@coral-xyz/anchor";
import { ConditionalVaultClient, uploadConditionalTokenMetadataJson } from "@metadaoproject/futarchy-ts";
import { AutocratClient, assetImageMap } from "@metadaoproject/futarchy-ts";
import { keypairIdentity } from "@metaplex-foundation/umi";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const provider = anchor.AnchorProvider.env();

let autocratClient: AutocratClient = AutocratClient.createClient({
  provider,
});

let vaultClient: ConditionalVaultClient = ConditionalVaultClient.createClient({
  provider,
});

// const PROPOSAL_NUMBER = 3;
const proposal = new PublicKey("Dssb1oTTqKjWJTe8QVrStFXxcMZfd7LTSpTRbuHuNdnW");

async function main() {
  // const proposals = await autocratProgram.account.proposal.all();
  // const proposal = proposals.find(
  //   (proposal) => proposal.account.number == PROPOSAL_NUMBER
  // );
  const storedProposal = await autocratClient.getProposal(proposal);
//   const baseVault = new PublicKey("DXWDLrDxqVn1b7F2jtWMRdg1rUYf1XmhwwTbiUUTcSru");
  const DEAN = new PublicKey("DEANPaCEAfW2SCJCdEtGvV1nT9bAShWrajnieSzUcWzh");
  const mUSDC = new PublicKey("ABizbp4pXowKQJ1pWgPeWPYDfSKwg34A7Xy1fxTu7No9");

  const passUri = await uploadConditionalTokenMetadataJson(provider.connection, keypairIdentity(autocratClient.provider.wallet['payer']), 1, "pMETA");
  const failUri = await uploadConditionalTokenMetadataJson(provider.connection, keypairIdentity(autocratClient.provider.wallet['payer']), 1, "fMETA");

  // console.log(await uploadImageJson(autocratClient.provider.connection, keypairIdentity(autocratClient.provider.wallet['payer'])));
  const tx = await vaultClient.addMetadataToConditionalTokensIx(storedProposal.quoteVault, mUSDC, 1, passUri, failUri).rpc();
  console.log(tx)

  // await autocratClient.finalizeProposal(proposal);
}

main();