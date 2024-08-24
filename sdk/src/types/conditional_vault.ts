export type ConditionalVault = {
  version: "0.4.0";
  name: "conditional_vault";
  instructions: [
    {
      name: "initializeQuestion";
      accounts: [
        {
          name: "question";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "InitializeQuestionArgs";
          };
        }
      ];
    },
    {
      name: "resolveQuestion";
      accounts: [
        {
          name: "question";
          isMut: true;
          isSigner: false;
        },
        {
          name: "oracle";
          isMut: false;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "ResolveQuestionArgs";
          };
        }
      ];
    },
    {
      name: "initializeNewConditionalVault";
      accounts: [
        {
          name: "vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "question";
          isMut: false;
          isSigner: false;
        },
        {
          name: "underlyingTokenMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "associatedTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "splitTokens";
      accounts: [
        {
          name: "question";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vault";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "userUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "mergeTokens";
      accounts: [
        {
          name: "question";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vault";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "userUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "redeemTokens";
      accounts: [
        {
          name: "question";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vault";
          isMut: false;
          isSigner: false;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "userUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "initializeConditionalVault";
      accounts: [
        {
          name: "vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "underlyingTokenMint";
          isMut: false;
          isSigner: false;
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnRevertTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          isMut: false;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "associatedTokenProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "InitializeConditionalVaultArgs";
          };
        }
      ];
    },
    {
      name: "addMetadataToConditionalTokens";
      accounts: [
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "vault";
          isMut: true;
          isSigner: false;
        },
        {
          name: "underlyingTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "underlyingTokenMetadata";
          isMut: false;
          isSigner: false;
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnRevertTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnFinalizeTokenMetadata";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnRevertTokenMetadata";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenMetadataProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "args";
          type: {
            defined: "AddMetadataToConditionalTokensArgs";
          };
        }
      ];
    },
    {
      name: "settleConditionalVault";
      accounts: [
        {
          name: "settlementAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "vault";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "newStatus";
          type: {
            defined: "VaultStatus";
          };
        }
      ];
    },
    {
      name: "mergeConditionalTokensForUnderlyingTokens";
      accounts: [
        {
          name: "vault";
          isMut: false;
          isSigner: false;
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnRevertTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "userConditionalOnFinalizeTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userConditionalOnRevertTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "mintConditionalTokens";
      accounts: [
        {
          name: "vault";
          isMut: false;
          isSigner: false;
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnRevertTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "userConditionalOnFinalizeTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userConditionalOnRevertTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "redeemConditionalTokensForUnderlyingTokens";
      accounts: [
        {
          name: "vault";
          isMut: false;
          isSigner: false;
        },
        {
          name: "conditionalOnFinalizeTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "conditionalOnRevertTokenMint";
          isMut: true;
          isSigner: false;
        },
        {
          name: "vaultUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "authority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "userConditionalOnFinalizeTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userConditionalOnRevertTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "userUnderlyingTokenAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "tokenProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "newConditionalVault";
      type: {
        kind: "struct";
        fields: [
          {
            name: "question";
            type: "publicKey";
          },
          {
            name: "underlyingTokenMint";
            type: "publicKey";
          },
          {
            name: "underlyingTokenAccount";
            type: "publicKey";
          },
          {
            name: "conditionalTokenMints";
            type: {
              vec: "publicKey";
            };
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "decimals";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "conditionalVault";
      type: {
        kind: "struct";
        fields: [
          {
            name: "status";
            type: {
              defined: "VaultStatus";
            };
          },
          {
            name: "settlementAuthority";
            docs: [
              "The account that can either finalize the vault to make conditional tokens",
              "redeemable for underlying tokens or revert the vault to make deposit",
              "slips redeemable for underlying tokens."
            ];
            type: "publicKey";
          },
          {
            name: "underlyingTokenMint";
            docs: ["The mint of the tokens that are deposited into the vault."];
            type: "publicKey";
          },
          {
            name: "underlyingTokenAccount";
            docs: ["The vault's storage account for deposited funds."];
            type: "publicKey";
          },
          {
            name: "conditionalOnFinalizeTokenMint";
            type: "publicKey";
          },
          {
            name: "conditionalOnRevertTokenMint";
            type: "publicKey";
          },
          {
            name: "pdaBump";
            type: "u8";
          },
          {
            name: "decimals";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "question";
      docs: [
        "Questions represent statements about future events.",
        "",
        "These statements include:",
        '- "Will this proposal pass?"',
        '- "Who, if anyone, will be hired?"',
        '- "How effective will the grant committee deem this grant?"',
        "",
        'Questions have 2 or more possible outcomes. For a question like "will this',
        'proposal pass," the outcomes are "yes" and "no." For a question like "who',
        'will be hired," the outcomes could be "Alice," "Bob," and "neither."',
        "",
        'Outcomes resolve to a number between 0 and 1. Binary questions like "will',
        'this proposal pass" have outcomes that resolve to exactly 0 or 1. You can',
        'also have questions with scalar outcomes. For example, the question "how',
        'effective will the grant committee deem this grant" could have two outcomes:',
        '"ineffective" and "effective." If the grant committee deems the grant 70%',
        'effective, the "effective" outcome would resolve to 0.7 and the "ineffective"',
        "outcome would resolve to 0.3.",
        "",
        "Once resolved, the sum of all outcome resolutions is exactly 1."
      ];
      type: {
        kind: "struct";
        fields: [
          {
            name: "questionId";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "oracle";
            type: "publicKey";
          },
          {
            name: "payoutNumerators";
            type: {
              vec: "u32";
            };
          },
          {
            name: "payoutDenominator";
            type: "u32";
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "AddMetadataToConditionalTokensArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "proposalNumber";
            type: "u64";
          },
          {
            name: "onFinalizeUri";
            type: "string";
          },
          {
            name: "onRevertUri";
            type: "string";
          }
        ];
      };
    },
    {
      name: "InitializeConditionalVaultArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "settlementAuthority";
            type: "publicKey";
          }
        ];
      };
    },
    {
      name: "InitializeQuestionArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "questionId";
            type: {
              array: ["u8", 32];
            };
          },
          {
            name: "oracle";
            type: "publicKey";
          },
          {
            name: "numConditions";
            type: "u8";
          }
        ];
      };
    },
    {
      name: "ResolveQuestionArgs";
      type: {
        kind: "struct";
        fields: [
          {
            name: "payoutNumerators";
            type: {
              vec: "u32";
            };
          }
        ];
      };
    },
    {
      name: "VaultStatus";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Active";
          },
          {
            name: "Finalized";
          },
          {
            name: "Reverted";
          }
        ];
      };
    }
  ];
  errors: [
    {
      code: 6000;
      name: "InsufficientUnderlyingTokens";
      msg: "Insufficient underlying token balance to mint this amount of conditional tokens";
    },
    {
      code: 6001;
      name: "InvalidVaultUnderlyingTokenAccount";
      msg: "This `vault_underlying_token_account` is not this vault's `underlying_token_account`";
    },
    {
      code: 6002;
      name: "InvalidConditionalTokenMint";
      msg: "This conditional token mint is not this vault's conditional token mint";
    },
    {
      code: 6003;
      name: "CantRedeemConditionalTokens";
      msg: "Question needs to be resolved before users can redeem conditional tokens for underlying tokens";
    },
    {
      code: 6004;
      name: "VaultAlreadySettled";
      msg: "Once a vault has been settled, its status as either finalized or reverted cannot be changed";
    },
    {
      code: 6005;
      name: "InsufficientNumConditions";
      msg: "Questions need 2 or more conditions";
    },
    {
      code: 6006;
      name: "InvalidNumPayoutNumerators";
      msg: "Invalid number of payout numerators";
    },
    {
      code: 6007;
      name: "InvalidConditionals";
      msg: "Client needs to pass in the list of conditional mints for a vault followed by the user's token accounts for those tokens";
    },
    {
      code: 6008;
      name: "ConditionalMintMismatch";
      msg: "Conditional mint not in vault";
    },
    {
      code: 6009;
      name: "BadConditionalMint";
      msg: "Unable to deserialize a conditional token mint";
    },
    {
      code: 6010;
      name: "BadConditionalTokenAccount";
      msg: "Unable to deserialize a conditional token account";
    },
    {
      code: 6011;
      name: "ConditionalTokenMintMismatch";
      msg: "User conditional token account mint does not match conditional mint";
    },
    {
      code: 6012;
      name: "PayoutZero";
      msg: "Payouts must sum to 1 or more";
    }
  ];
};

export const IDL: ConditionalVault = {
  version: "0.4.0",
  name: "conditional_vault",
  instructions: [
    {
      name: "initializeQuestion",
      accounts: [
        {
          name: "question",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "args",
          type: {
            defined: "InitializeQuestionArgs",
          },
        },
      ],
    },
    {
      name: "resolveQuestion",
      accounts: [
        {
          name: "question",
          isMut: true,
          isSigner: false,
        },
        {
          name: "oracle",
          isMut: false,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "args",
          type: {
            defined: "ResolveQuestionArgs",
          },
        },
      ],
    },
    {
      name: "initializeNewConditionalVault",
      accounts: [
        {
          name: "vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "question",
          isMut: false,
          isSigner: false,
        },
        {
          name: "underlyingTokenMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vaultUnderlyingTokenAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "associatedTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "splitTokens",
      accounts: [
        {
          name: "question",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vault",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vaultUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "userUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "mergeTokens",
      accounts: [
        {
          name: "question",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vault",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vaultUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "userUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "redeemTokens",
      accounts: [
        {
          name: "question",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vault",
          isMut: false,
          isSigner: false,
        },
        {
          name: "vaultUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "userUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "initializeConditionalVault",
      accounts: [
        {
          name: "vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "underlyingTokenMint",
          isMut: false,
          isSigner: false,
        },
        {
          name: "conditionalOnFinalizeTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnRevertTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultUnderlyingTokenAccount",
          isMut: false,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "associatedTokenProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "args",
          type: {
            defined: "InitializeConditionalVaultArgs",
          },
        },
      ],
    },
    {
      name: "addMetadataToConditionalTokens",
      accounts: [
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "vault",
          isMut: true,
          isSigner: false,
        },
        {
          name: "underlyingTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "underlyingTokenMetadata",
          isMut: false,
          isSigner: false,
        },
        {
          name: "conditionalOnFinalizeTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnRevertTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnFinalizeTokenMetadata",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnRevertTokenMetadata",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenMetadataProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "args",
          type: {
            defined: "AddMetadataToConditionalTokensArgs",
          },
        },
      ],
    },
    {
      name: "settleConditionalVault",
      accounts: [
        {
          name: "settlementAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "vault",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "newStatus",
          type: {
            defined: "VaultStatus",
          },
        },
      ],
    },
    {
      name: "mergeConditionalTokensForUnderlyingTokens",
      accounts: [
        {
          name: "vault",
          isMut: false,
          isSigner: false,
        },
        {
          name: "conditionalOnFinalizeTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnRevertTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "userConditionalOnFinalizeTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userConditionalOnRevertTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "mintConditionalTokens",
      accounts: [
        {
          name: "vault",
          isMut: false,
          isSigner: false,
        },
        {
          name: "conditionalOnFinalizeTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnRevertTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "userConditionalOnFinalizeTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userConditionalOnRevertTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "redeemConditionalTokensForUnderlyingTokens",
      accounts: [
        {
          name: "vault",
          isMut: false,
          isSigner: false,
        },
        {
          name: "conditionalOnFinalizeTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "conditionalOnRevertTokenMint",
          isMut: true,
          isSigner: false,
        },
        {
          name: "vaultUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "authority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "userConditionalOnFinalizeTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userConditionalOnRevertTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "userUnderlyingTokenAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "tokenProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "newConditionalVault",
      type: {
        kind: "struct",
        fields: [
          {
            name: "question",
            type: "publicKey",
          },
          {
            name: "underlyingTokenMint",
            type: "publicKey",
          },
          {
            name: "underlyingTokenAccount",
            type: "publicKey",
          },
          {
            name: "conditionalTokenMints",
            type: {
              vec: "publicKey",
            },
          },
          {
            name: "pdaBump",
            type: "u8",
          },
          {
            name: "decimals",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "conditionalVault",
      type: {
        kind: "struct",
        fields: [
          {
            name: "status",
            type: {
              defined: "VaultStatus",
            },
          },
          {
            name: "settlementAuthority",
            docs: [
              "The account that can either finalize the vault to make conditional tokens",
              "redeemable for underlying tokens or revert the vault to make deposit",
              "slips redeemable for underlying tokens.",
            ],
            type: "publicKey",
          },
          {
            name: "underlyingTokenMint",
            docs: ["The mint of the tokens that are deposited into the vault."],
            type: "publicKey",
          },
          {
            name: "underlyingTokenAccount",
            docs: ["The vault's storage account for deposited funds."],
            type: "publicKey",
          },
          {
            name: "conditionalOnFinalizeTokenMint",
            type: "publicKey",
          },
          {
            name: "conditionalOnRevertTokenMint",
            type: "publicKey",
          },
          {
            name: "pdaBump",
            type: "u8",
          },
          {
            name: "decimals",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "question",
      docs: [
        "Questions represent statements about future events.",
        "",
        "These statements include:",
        '- "Will this proposal pass?"',
        '- "Who, if anyone, will be hired?"',
        '- "How effective will the grant committee deem this grant?"',
        "",
        'Questions have 2 or more possible outcomes. For a question like "will this',
        'proposal pass," the outcomes are "yes" and "no." For a question like "who',
        'will be hired," the outcomes could be "Alice," "Bob," and "neither."',
        "",
        'Outcomes resolve to a number between 0 and 1. Binary questions like "will',
        'this proposal pass" have outcomes that resolve to exactly 0 or 1. You can',
        'also have questions with scalar outcomes. For example, the question "how',
        'effective will the grant committee deem this grant" could have two outcomes:',
        '"ineffective" and "effective." If the grant committee deems the grant 70%',
        'effective, the "effective" outcome would resolve to 0.7 and the "ineffective"',
        "outcome would resolve to 0.3.",
        "",
        "Once resolved, the sum of all outcome resolutions is exactly 1.",
      ],
      type: {
        kind: "struct",
        fields: [
          {
            name: "questionId",
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "oracle",
            type: "publicKey",
          },
          {
            name: "payoutNumerators",
            type: {
              vec: "u32",
            },
          },
          {
            name: "payoutDenominator",
            type: "u32",
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "AddMetadataToConditionalTokensArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "proposalNumber",
            type: "u64",
          },
          {
            name: "onFinalizeUri",
            type: "string",
          },
          {
            name: "onRevertUri",
            type: "string",
          },
        ],
      },
    },
    {
      name: "InitializeConditionalVaultArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "settlementAuthority",
            type: "publicKey",
          },
        ],
      },
    },
    {
      name: "InitializeQuestionArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "questionId",
            type: {
              array: ["u8", 32],
            },
          },
          {
            name: "oracle",
            type: "publicKey",
          },
          {
            name: "numConditions",
            type: "u8",
          },
        ],
      },
    },
    {
      name: "ResolveQuestionArgs",
      type: {
        kind: "struct",
        fields: [
          {
            name: "payoutNumerators",
            type: {
              vec: "u32",
            },
          },
        ],
      },
    },
    {
      name: "VaultStatus",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Active",
          },
          {
            name: "Finalized",
          },
          {
            name: "Reverted",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "InsufficientUnderlyingTokens",
      msg: "Insufficient underlying token balance to mint this amount of conditional tokens",
    },
    {
      code: 6001,
      name: "InvalidVaultUnderlyingTokenAccount",
      msg: "This `vault_underlying_token_account` is not this vault's `underlying_token_account`",
    },
    {
      code: 6002,
      name: "InvalidConditionalTokenMint",
      msg: "This conditional token mint is not this vault's conditional token mint",
    },
    {
      code: 6003,
      name: "CantRedeemConditionalTokens",
      msg: "Question needs to be resolved before users can redeem conditional tokens for underlying tokens",
    },
    {
      code: 6004,
      name: "VaultAlreadySettled",
      msg: "Once a vault has been settled, its status as either finalized or reverted cannot be changed",
    },
    {
      code: 6005,
      name: "InsufficientNumConditions",
      msg: "Questions need 2 or more conditions",
    },
    {
      code: 6006,
      name: "InvalidNumPayoutNumerators",
      msg: "Invalid number of payout numerators",
    },
    {
      code: 6007,
      name: "InvalidConditionals",
      msg: "Client needs to pass in the list of conditional mints for a vault followed by the user's token accounts for those tokens",
    },
    {
      code: 6008,
      name: "ConditionalMintMismatch",
      msg: "Conditional mint not in vault",
    },
    {
      code: 6009,
      name: "BadConditionalMint",
      msg: "Unable to deserialize a conditional token mint",
    },
    {
      code: 6010,
      name: "BadConditionalTokenAccount",
      msg: "Unable to deserialize a conditional token account",
    },
    {
      code: 6011,
      name: "ConditionalTokenMintMismatch",
      msg: "User conditional token account mint does not match conditional mint",
    },
    {
      code: 6012,
      name: "PayoutZero",
      msg: "Payouts must sum to 1 or more",
    },
  ],
};
