import { Connection, PublicKey } from "@solana/web3.js";
import { ShdwDrive, ShadowFile, StorageAccountV2 } from "@shadow-drive/sdk";
import { Wallet } from "@coral-xyz/anchor";
import {} from "@metaplex-foundation/mpl-token-metadata"

export type ShadowStorageAccount = {
  publicKey: PublicKey;
  account: StorageAccountV2;
};

export class ShadowProvider {
  public drive!: ShdwDrive;

  constructor(
    private connection: Connection,
    private wallet: Wallet,
  ) {}

  public async init() {
    this.drive = await new ShdwDrive(this.connection, this.wallet).init();
  }

  public async getStorageAccounts() {
    return this.drive.getStorageAccounts();
  }

  public async getStorageAccount() {
    return (await this.getStorageAccounts()).at(0);
  }

  public async hasStorageAccounts() {
    try {
      await this.getStorageAccounts();
      return true;
    } catch {
      return false;
    }
  }

  async upsertFile(inputs: {
    name: string;
    buffer: Buffer;
    account: PublicKey;
  }) {
    const shadowFile: ShadowFile = {
      file: inputs.buffer,
      name: inputs.name,
    };
    // If file exists, edit and overwrite it
    const objects = await this.drive.listObjects(inputs.account);
    if (objects.keys.includes(inputs.name)) {
      const uri = `https://shdw-drive.genesysgo.net/${inputs.account.toBase58()}/${
        inputs.name
      }`;
      const editedResult = await this.drive.editFile(inputs.account, uri, {
        file: inputs.buffer,
        name: inputs.name,
      } as ShadowFile);
      const jsonUri = editedResult.finalized_location;
      return jsonUri;
    }

    const jsonUpload = await this.drive.uploadFile(inputs.account, shadowFile);
    const jsonUri = jsonUpload.finalized_locations[0];
    if (!jsonUri) throw new Error("JSON upload failed");
    return jsonUri;
  }

  /**
   *
   * @param name What is your storage account name? (e;g some_bucket_name
   * @param size What is your storage size? (e.g 10MB, 1GB)
   * @returns
   */
    async shadowAccountCreation(name: string, size: string) {
        const result = await this.drive.createStorageAccount(name, size)
        console.log('Shadow account created', result)
        return result.shdw_bucket
    }

}
