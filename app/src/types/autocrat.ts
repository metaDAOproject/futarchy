export type Autocrat = {
  "version": "0.1.0",
  "name": "autocrat",
  "instructions": [
    {
      "name": "initializeDao",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "dao",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "daoTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "updateDao",
      "accounts": [
        {
          "name": "dao",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "daoTreasury",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "daoParams",
          "type": {
            "defined": "UpdateDaoParams"
          }
        }
      ]
    },
    {
      "name": "createProposalInstructions",
      "accounts": [
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalInstructions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "instructions",
          "type": {
            "vec": {
              "defined": "ProposalInstruction"
            }
          }
        }
      ]
    },
    {
      "name": "addProposalInstructions",
      "accounts": [
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalInstructions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "instructions",
          "type": {
            "vec": {
              "defined": "ProposalInstruction"
            }
          }
        }
      ]
    },
    {
      "name": "createProposal",
      "accounts": [
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "dao",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "metaProposerAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcProposerAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "descriptionUrl",
          "type": "string"
        },
        {
          "name": "mintCondMeta",
          "type": "u64"
        },
        {
          "name": "mintCondUsdc",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createProposalMarketSide",
      "accounts": [
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "dao",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammAuthPda",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "conditionalUsdcMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "conditionalMetaProposerAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcProposerAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalMetaAmmVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcAmmVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "isPassMarket",
          "type": "bool"
        },
        {
          "name": "ammCondMetaDeposit",
          "type": "u64"
        },
        {
          "name": "ammCondUsdcDeposit",
          "type": "u64"
        }
      ]
    },
    {
      "name": "submitProposal",
      "accounts": [
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "dao",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "daoTreasury",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalInstructions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcProposerAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcTreasuryVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "passMarketAmm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "failMarketAmm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammAuthPda",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "ammProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "finalizeProposal",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalInstructions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "dao",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "daoTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "passMarketAmm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "failMarketAmm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "mintConditionalTokens",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassMetaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailMetaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "metaAmount",
          "type": "u64"
        },
        {
          "name": "usdcAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "mergeConditionalTokens",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassMetaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailMetaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "metaAmount",
          "type": "u64"
        },
        {
          "name": "usdcAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "redeemConditionalTokens",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassMetaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailMetaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "createPosition",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "ammPosition",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "ammAuthPda",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "ammProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "addLiquidity",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammPosition",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "ammAuthPda",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalMetaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "maxBaseAmount",
          "type": "u64"
        },
        {
          "name": "maxQuoteAmount",
          "type": "u64"
        },
        {
          "name": "minBaseAmount",
          "type": "u64"
        },
        {
          "name": "minQuoteAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "removeLiquidity",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammPosition",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "ammAuthPda",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalMetaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "removeBps",
          "type": "u64"
        }
      ]
    },
    {
      "name": "swap",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammAuthPda",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalMetaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "isQuoteToBase",
          "type": "bool"
        },
        {
          "name": "inputAmount",
          "type": "u64"
        },
        {
          "name": "outputAmountMin",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "daoTreasury",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "dao",
            "type": "publicKey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "dao",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "treasuryPdaBump",
            "type": "u8"
          },
          {
            "name": "treasuryPda",
            "type": "publicKey"
          },
          {
            "name": "metaMint",
            "type": "publicKey"
          },
          {
            "name": "usdcMint",
            "type": "publicKey"
          },
          {
            "name": "proposalCount",
            "type": "u64"
          },
          {
            "name": "proposalsActive",
            "type": "u32"
          },
          {
            "name": "proposalFeeUsdc",
            "type": "u64"
          },
          {
            "name": "passThresholdBps",
            "type": "u64"
          },
          {
            "name": "proposalDurationSlots",
            "type": "u64"
          },
          {
            "name": "finalizeWindowSlots",
            "type": "u64"
          },
          {
            "name": "ammInitialQuoteLiquidityAmount",
            "type": "u64"
          },
          {
            "name": "ammSwapFeeBps",
            "type": "u64"
          },
          {
            "name": "ammLtwapDecimals",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "proposalVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "proposal",
            "type": "publicKey"
          },
          {
            "name": "metaVaultAta",
            "type": "publicKey"
          },
          {
            "name": "usdcVaultAta",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "proposal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "number",
            "type": "u64"
          },
          {
            "name": "proposer",
            "type": "publicKey"
          },
          {
            "name": "descriptionUrl",
            "type": "string"
          },
          {
            "name": "slotEnqueued",
            "type": "u64"
          },
          {
            "name": "slotsDuration",
            "type": "u64"
          },
          {
            "name": "state",
            "type": {
              "defined": "ProposalState"
            }
          },
          {
            "name": "instructions",
            "type": "publicKey"
          },
          {
            "name": "proposalVault",
            "type": "publicKey"
          },
          {
            "name": "isPassMarketCreated",
            "type": "bool"
          },
          {
            "name": "isFailMarketCreated",
            "type": "bool"
          },
          {
            "name": "metaMint",
            "type": "publicKey"
          },
          {
            "name": "usdcMint",
            "type": "publicKey"
          },
          {
            "name": "passMarketAmm",
            "type": "publicKey"
          },
          {
            "name": "failMarketAmm",
            "type": "publicKey"
          },
          {
            "name": "conditionalOnPassMetaMint",
            "type": "publicKey"
          },
          {
            "name": "conditionalOnPassUsdcMint",
            "type": "publicKey"
          },
          {
            "name": "conditionalOnFailMetaMint",
            "type": "publicKey"
          },
          {
            "name": "conditionalOnFailUsdcMint",
            "type": "publicKey"
          },
          {
            "name": "proposerInititialConditionalMetaMinted",
            "type": "u64"
          },
          {
            "name": "proposerInititialConditionalUsdcMinted",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "proposalInstructions",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposer",
            "type": "publicKey"
          },
          {
            "name": "proposal",
            "type": "publicKey"
          },
          {
            "name": "proposalInstructionsFrozen",
            "type": "bool"
          },
          {
            "name": "instructions",
            "type": {
              "vec": {
                "defined": "ProposalInstruction"
              }
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "UpdateDaoParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "passThresholdBps",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "proposalDurationSlots",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "finalizeWindowSlots",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "proposalFeeUsdc",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "ammInitialQuoteLiquidityAmount",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "ammSwapFeeBps",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "ammLtwapDecimals",
            "type": {
              "option": "u8"
            }
          }
        ]
      }
    },
    {
      "name": "ProposalAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pubkey",
            "type": "publicKey"
          },
          {
            "name": "isSigner",
            "type": "bool"
          },
          {
            "name": "isWritable",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "ProposalInstruction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "programId",
            "type": "publicKey"
          },
          {
            "name": "accounts",
            "type": {
              "vec": {
                "defined": "ProposalAccount"
              }
            }
          },
          {
            "name": "data",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "ProposalState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Initialize"
          },
          {
            "name": "Pending"
          },
          {
            "name": "Passed"
          },
          {
            "name": "Failed"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ProposalIsNoLongerPending",
      "msg": "The proposal is no longer pending"
    },
    {
      "code": 6001,
      "name": "AmmProposalMismatch",
      "msg": "The provided amm does not match the pass or fail market for this proposal"
    },
    {
      "code": 6002,
      "name": "RemoveLiquidityBpsOutOfRange",
      "msg": "Remove liquidity BPS is out of range"
    },
    {
      "code": 6003,
      "name": "InvalidMarket",
      "msg": "Either the `pass_market` or the `fail_market`'s tokens doesn't match the vaults supplied"
    },
    {
      "code": 6004,
      "name": "TWAPMarketTooOld",
      "msg": "`TWAPMarket` must have an `initial_slot` within 50 slots of the proposal's `slot_enqueued`"
    },
    {
      "code": 6005,
      "name": "TWAPMarketInvalidExpectedValue",
      "msg": "`TWAPMarket` has the wrong `expected_value`"
    },
    {
      "code": 6006,
      "name": "InvalidSettlementAuthority",
      "msg": "One of the vaults has an invalid `settlement_authority`"
    },
    {
      "code": 6007,
      "name": "ProposalTooYoung",
      "msg": "Proposal is too young to be executed or rejected"
    },
    {
      "code": 6008,
      "name": "ProposalStillPending",
      "msg": "Proposal is still pending"
    },
    {
      "code": 6009,
      "name": "MarketsTooYoung",
      "msg": "Markets too young for proposal to be finalized"
    },
    {
      "code": 6010,
      "name": "ProposalCannotPass",
      "msg": "The market dictates that this proposal cannot pass"
    },
    {
      "code": 6011,
      "name": "ProposalAlreadyFinalized",
      "msg": "This proposal has already been finalized"
    },
    {
      "code": 6012,
      "name": "InvalidVaultNonce",
      "msg": "A conditional vault has an invalid nonce. A nonce should encode pass = 0 / fail = 1 in its most significant bit, base = 0 / quote = 1 in its second most significant bit, and the proposal number in least significant 32 bits"
    },
    {
      "code": 6013,
      "name": "InsufficientUnderlyingTokens",
      "msg": "Insufficient underlying token balance to mint this amount of conditional tokens"
    },
    {
      "code": 6014,
      "name": "InvalidVaultUnderlyingTokenAccount",
      "msg": "This `vault_underlying_token_account` is not this vault's `underlying_token_account`"
    },
    {
      "code": 6015,
      "name": "InvalidConditionalTokenMint",
      "msg": "This conditional token mint is not this vault's conditional token mint"
    },
    {
      "code": 6016,
      "name": "CantRedeemConditionalTokens",
      "msg": "Vault needs to be settled as finalized before users can redeem conditional tokens for underlying tokens"
    },
    {
      "code": 6017,
      "name": "VaultAlreadySettled",
      "msg": "Once a vault has been settled, its status as either finalized or reverted cannot be changed"
    },
    {
      "code": 6018,
      "name": "ProposerCannotPullLiquidityWhileMarketIsPending",
      "msg": "Proposer cannot remove intitial liquidity while the proposal is pending"
    },
    {
      "code": 6019,
      "name": "NonConsecutiveProposalNumber",
      "msg": "Proposal numbers must be consecutive"
    },
    {
      "code": 6020,
      "name": "AddLiquidityCalculationError",
      "msg": "Add liquidity calculation error"
    },
    {
      "code": 6021,
      "name": "DecimalScaleError",
      "msg": "Error in decimal scale conversion"
    }
  ]
};

export const IDL: Autocrat = {
  "version": "0.1.0",
  "name": "autocrat",
  "instructions": [
    {
      "name": "initializeDao",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "dao",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "daoTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "updateDao",
      "accounts": [
        {
          "name": "dao",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "daoTreasury",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "daoParams",
          "type": {
            "defined": "UpdateDaoParams"
          }
        }
      ]
    },
    {
      "name": "createProposalInstructions",
      "accounts": [
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalInstructions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "instructions",
          "type": {
            "vec": {
              "defined": "ProposalInstruction"
            }
          }
        }
      ]
    },
    {
      "name": "addProposalInstructions",
      "accounts": [
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalInstructions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "instructions",
          "type": {
            "vec": {
              "defined": "ProposalInstruction"
            }
          }
        }
      ]
    },
    {
      "name": "createProposal",
      "accounts": [
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "dao",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "metaProposerAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcProposerAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "descriptionUrl",
          "type": "string"
        },
        {
          "name": "mintCondMeta",
          "type": "u64"
        },
        {
          "name": "mintCondUsdc",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createProposalMarketSide",
      "accounts": [
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "dao",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammAuthPda",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "conditionalUsdcMint",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "conditionalMetaProposerAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcProposerAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalMetaAmmVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcAmmVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "isPassMarket",
          "type": "bool"
        },
        {
          "name": "ammCondMetaDeposit",
          "type": "u64"
        },
        {
          "name": "ammCondUsdcDeposit",
          "type": "u64"
        }
      ]
    },
    {
      "name": "submitProposal",
      "accounts": [
        {
          "name": "proposer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "dao",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "daoTreasury",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalInstructions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcProposerAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcTreasuryVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "passMarketAmm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "failMarketAmm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammAuthPda",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "ammProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "finalizeProposal",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalInstructions",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "dao",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "daoTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "passMarketAmm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "failMarketAmm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "mintConditionalTokens",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassMetaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailMetaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "metaAmount",
          "type": "u64"
        },
        {
          "name": "usdcAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "mergeConditionalTokens",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassMetaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailMetaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "metaAmount",
          "type": "u64"
        },
        {
          "name": "usdcAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "redeemConditionalTokens",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassMetaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailMetaMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailUsdcMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnPassUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalOnFailUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "metaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "createPosition",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "ammPosition",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "ammAuthPda",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "ammProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "addLiquidity",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammPosition",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "ammAuthPda",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalMetaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "maxBaseAmount",
          "type": "u64"
        },
        {
          "name": "maxQuoteAmount",
          "type": "u64"
        },
        {
          "name": "minBaseAmount",
          "type": "u64"
        },
        {
          "name": "minQuoteAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "removeLiquidity",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammPosition",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "ammAuthPda",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalMetaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "removeBps",
          "type": "u64"
        }
      ]
    },
    {
      "name": "swap",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "proposalVault",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammAuthPda",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK"
          ]
        },
        {
          "name": "metaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "conditionalMetaUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcUserAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalMetaVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "conditionalUsdcVaultAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ammProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "isQuoteToBase",
          "type": "bool"
        },
        {
          "name": "inputAmount",
          "type": "u64"
        },
        {
          "name": "outputAmountMin",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "daoTreasury",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "dao",
            "type": "publicKey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "dao",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "treasuryPdaBump",
            "type": "u8"
          },
          {
            "name": "treasuryPda",
            "type": "publicKey"
          },
          {
            "name": "metaMint",
            "type": "publicKey"
          },
          {
            "name": "usdcMint",
            "type": "publicKey"
          },
          {
            "name": "proposalCount",
            "type": "u64"
          },
          {
            "name": "proposalsActive",
            "type": "u32"
          },
          {
            "name": "proposalFeeUsdc",
            "type": "u64"
          },
          {
            "name": "passThresholdBps",
            "type": "u64"
          },
          {
            "name": "proposalDurationSlots",
            "type": "u64"
          },
          {
            "name": "finalizeWindowSlots",
            "type": "u64"
          },
          {
            "name": "ammInitialQuoteLiquidityAmount",
            "type": "u64"
          },
          {
            "name": "ammSwapFeeBps",
            "type": "u64"
          },
          {
            "name": "ammLtwapDecimals",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "proposalVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "proposal",
            "type": "publicKey"
          },
          {
            "name": "metaVaultAta",
            "type": "publicKey"
          },
          {
            "name": "usdcVaultAta",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "proposal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "number",
            "type": "u64"
          },
          {
            "name": "proposer",
            "type": "publicKey"
          },
          {
            "name": "descriptionUrl",
            "type": "string"
          },
          {
            "name": "slotEnqueued",
            "type": "u64"
          },
          {
            "name": "slotsDuration",
            "type": "u64"
          },
          {
            "name": "state",
            "type": {
              "defined": "ProposalState"
            }
          },
          {
            "name": "instructions",
            "type": "publicKey"
          },
          {
            "name": "proposalVault",
            "type": "publicKey"
          },
          {
            "name": "isPassMarketCreated",
            "type": "bool"
          },
          {
            "name": "isFailMarketCreated",
            "type": "bool"
          },
          {
            "name": "metaMint",
            "type": "publicKey"
          },
          {
            "name": "usdcMint",
            "type": "publicKey"
          },
          {
            "name": "passMarketAmm",
            "type": "publicKey"
          },
          {
            "name": "failMarketAmm",
            "type": "publicKey"
          },
          {
            "name": "conditionalOnPassMetaMint",
            "type": "publicKey"
          },
          {
            "name": "conditionalOnPassUsdcMint",
            "type": "publicKey"
          },
          {
            "name": "conditionalOnFailMetaMint",
            "type": "publicKey"
          },
          {
            "name": "conditionalOnFailUsdcMint",
            "type": "publicKey"
          },
          {
            "name": "proposerInititialConditionalMetaMinted",
            "type": "u64"
          },
          {
            "name": "proposerInititialConditionalUsdcMinted",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "proposalInstructions",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposer",
            "type": "publicKey"
          },
          {
            "name": "proposal",
            "type": "publicKey"
          },
          {
            "name": "proposalInstructionsFrozen",
            "type": "bool"
          },
          {
            "name": "instructions",
            "type": {
              "vec": {
                "defined": "ProposalInstruction"
              }
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "UpdateDaoParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "passThresholdBps",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "proposalDurationSlots",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "finalizeWindowSlots",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "proposalFeeUsdc",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "ammInitialQuoteLiquidityAmount",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "ammSwapFeeBps",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "ammLtwapDecimals",
            "type": {
              "option": "u8"
            }
          }
        ]
      }
    },
    {
      "name": "ProposalAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pubkey",
            "type": "publicKey"
          },
          {
            "name": "isSigner",
            "type": "bool"
          },
          {
            "name": "isWritable",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "ProposalInstruction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "programId",
            "type": "publicKey"
          },
          {
            "name": "accounts",
            "type": {
              "vec": {
                "defined": "ProposalAccount"
              }
            }
          },
          {
            "name": "data",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "ProposalState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Initialize"
          },
          {
            "name": "Pending"
          },
          {
            "name": "Passed"
          },
          {
            "name": "Failed"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ProposalIsNoLongerPending",
      "msg": "The proposal is no longer pending"
    },
    {
      "code": 6001,
      "name": "AmmProposalMismatch",
      "msg": "The provided amm does not match the pass or fail market for this proposal"
    },
    {
      "code": 6002,
      "name": "RemoveLiquidityBpsOutOfRange",
      "msg": "Remove liquidity BPS is out of range"
    },
    {
      "code": 6003,
      "name": "InvalidMarket",
      "msg": "Either the `pass_market` or the `fail_market`'s tokens doesn't match the vaults supplied"
    },
    {
      "code": 6004,
      "name": "TWAPMarketTooOld",
      "msg": "`TWAPMarket` must have an `initial_slot` within 50 slots of the proposal's `slot_enqueued`"
    },
    {
      "code": 6005,
      "name": "TWAPMarketInvalidExpectedValue",
      "msg": "`TWAPMarket` has the wrong `expected_value`"
    },
    {
      "code": 6006,
      "name": "InvalidSettlementAuthority",
      "msg": "One of the vaults has an invalid `settlement_authority`"
    },
    {
      "code": 6007,
      "name": "ProposalTooYoung",
      "msg": "Proposal is too young to be executed or rejected"
    },
    {
      "code": 6008,
      "name": "ProposalStillPending",
      "msg": "Proposal is still pending"
    },
    {
      "code": 6009,
      "name": "MarketsTooYoung",
      "msg": "Markets too young for proposal to be finalized"
    },
    {
      "code": 6010,
      "name": "ProposalCannotPass",
      "msg": "The market dictates that this proposal cannot pass"
    },
    {
      "code": 6011,
      "name": "ProposalAlreadyFinalized",
      "msg": "This proposal has already been finalized"
    },
    {
      "code": 6012,
      "name": "InvalidVaultNonce",
      "msg": "A conditional vault has an invalid nonce. A nonce should encode pass = 0 / fail = 1 in its most significant bit, base = 0 / quote = 1 in its second most significant bit, and the proposal number in least significant 32 bits"
    },
    {
      "code": 6013,
      "name": "InsufficientUnderlyingTokens",
      "msg": "Insufficient underlying token balance to mint this amount of conditional tokens"
    },
    {
      "code": 6014,
      "name": "InvalidVaultUnderlyingTokenAccount",
      "msg": "This `vault_underlying_token_account` is not this vault's `underlying_token_account`"
    },
    {
      "code": 6015,
      "name": "InvalidConditionalTokenMint",
      "msg": "This conditional token mint is not this vault's conditional token mint"
    },
    {
      "code": 6016,
      "name": "CantRedeemConditionalTokens",
      "msg": "Vault needs to be settled as finalized before users can redeem conditional tokens for underlying tokens"
    },
    {
      "code": 6017,
      "name": "VaultAlreadySettled",
      "msg": "Once a vault has been settled, its status as either finalized or reverted cannot be changed"
    },
    {
      "code": 6018,
      "name": "ProposerCannotPullLiquidityWhileMarketIsPending",
      "msg": "Proposer cannot remove intitial liquidity while the proposal is pending"
    },
    {
      "code": 6019,
      "name": "NonConsecutiveProposalNumber",
      "msg": "Proposal numbers must be consecutive"
    },
    {
      "code": 6020,
      "name": "AddLiquidityCalculationError",
      "msg": "Add liquidity calculation error"
    },
    {
      "code": 6021,
      "name": "DecimalScaleError",
      "msg": "Error in decimal scale conversion"
    }
  ]
};
