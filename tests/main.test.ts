import { startAnchor } from "solana-bankrun";
import conditionalVault from "./conditionalVault/main.test";
import { BankrunProvider } from "anchor-bankrun";
import * as anchor from "@coral-xyz/anchor";
import { ConditionalVaultClient } from "@metadaoproject/futarchy";

before(async function () {
    let context = await startAnchor(
        "./",
        [],
        //   [
        //     // even though the program is loaded into the test validator, we need
        //     // to tell banks test client to load it as well
        //     {
        //       name: "mpl_token_metadata",
        //       programId: MPL_TOKEN_METADATA_PROGRAM_ID,
        //     },
        //   ],
        []
    );
    this.banksClient = context.banksClient;
    let provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    // umi = createUmi(anchor.AnchorProvider.env().connection);

    // vaultProgram = new Program<ConditionalVault>(
    //   ConditionalVaultIDL,
    //   CONDITIONAL_VAULT_PROGRAM_ID,
    //   provider
    // );

    this.vaultClient = ConditionalVaultClient.createClient({ provider: provider as any });
    this.payer = provider.wallet.payer;
    // });
    // describe("1", () => test1(vaultClient));
    // describe("2", () => test2(vaultClient));
    // test2();
});

describe("conditional_vault", conditionalVault);