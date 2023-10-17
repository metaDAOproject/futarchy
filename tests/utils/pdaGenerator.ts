import * as anchor from "@coral-xyz/anchor";

import { Program, PublicKey } from "./metaDAO";

export type AddressAndBump = [PublicKey, number];

export class PDAGenerator {
  program: Program;

  constructor(program: Program) {
    this.program = program;
  }

  generateMetaDAOPDAAddress(): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
      this.program.programId
    );
  }

  generateMemberPDAAddress(name: string): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("member"),
        anchor.utils.bytes.utf8.encode(name),
      ],
      this.program.programId
    );
  }

  generateTreasuryPDAAddress(memberAddress: PublicKey): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("treasury"), memberAddress.toBuffer()],
      this.program.programId
    );
  }

  generateConditionalExpressionPDAAddress(
    proposal: PublicKey,
    redeemableOnPass: boolean
  ): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("conditional_expression"),
        proposal.toBuffer(),
        Buffer.from([redeemableOnPass]),
      ],
      this.program.programId
    );
  }

  generateVaultPDAAddress(
    conditionalExpressionAddress: PublicKey,
    underlyingMint: PublicKey
  ): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("vault"),
        conditionalExpressionAddress.toBuffer(),
        underlyingMint.toBuffer(),
      ],
      this.program.programId
    );
  }

  generateDepositSlipPDAAddress(
    conditionalVault: PublicKey,
    user: PublicKey
  ): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("deposit_slip"),
        conditionalVault.toBuffer(),
        user.toBuffer(),
      ],
      this.program.programId
    );
  }
}
