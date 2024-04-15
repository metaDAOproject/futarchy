export type Amm = {
  "version": "0.1.0",
  "name": "amm",
  "instructions": [
    {
      "name": "createAmm",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "baseMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "quoteMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vaultAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaQuote",
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
        },
        {
          "name": "authPda",
          "isMut": false,
          "isSigner": true,
          "isOptional": true
        }
      ],
      "args": [
        {
          "name": "createAmmParams",
          "type": {
            "defined": "CreateAmmParams"
          }
        }
      ]
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
          "name": "amm",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "ammPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "authPda",
          "isMut": false,
          "isSigner": true,
          "isOptional": true
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
          "name": "baseMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "quoteMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userAtaQuote",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaQuote",
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
        },
        {
          "name": "authPda",
          "isMut": false,
          "isSigner": true,
          "isOptional": true
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
          "name": "baseMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "quoteMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userAtaQuote",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaQuote",
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
        },
        {
          "name": "authPda",
          "isMut": false,
          "isSigner": true,
          "isOptional": true
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
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "baseMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "quoteMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userAtaQuote",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaQuote",
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
        },
        {
          "name": "authPda",
          "isMut": false,
          "isSigner": true,
          "isOptional": true
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
    },
    {
      "name": "updateLtwap",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "authPda",
          "isMut": false,
          "isSigner": true,
          "isOptional": true
        }
      ],
      "args": [
        {
          "name": "finalSlot",
          "type": {
            "option": "u64"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "ammPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "publicKey"
          },
          {
            "name": "amm",
            "type": "publicKey"
          },
          {
            "name": "ownership",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "amm",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "permissioned",
            "type": "bool"
          },
          {
            "name": "authProgram",
            "type": "publicKey"
          },
          {
            "name": "authPdaBump",
            "type": "u8"
          },
          {
            "name": "createdAtSlot",
            "type": "u64"
          },
          {
            "name": "baseMint",
            "type": "publicKey"
          },
          {
            "name": "quoteMint",
            "type": "publicKey"
          },
          {
            "name": "baseMintDecimals",
            "type": "u8"
          },
          {
            "name": "quoteMintDecimals",
            "type": "u8"
          },
          {
            "name": "baseAmount",
            "type": "u64"
          },
          {
            "name": "quoteAmount",
            "type": "u64"
          },
          {
            "name": "totalOwnership",
            "type": "u64"
          },
          {
            "name": "swapFeeBps",
            "type": "u64"
          },
          {
            "name": "ltwapDecimals",
            "type": "u8"
          },
          {
            "name": "ltwapSlotUpdated",
            "type": "u64"
          },
          {
            "name": "ltwapDenominatorAgg",
            "type": {
              "defined": "AnchorDecimal"
            }
          },
          {
            "name": "ltwapNumeratorAgg",
            "type": {
              "defined": "AnchorDecimal"
            }
          },
          {
            "name": "ltwapLatest",
            "type": "u64"
          },
          {
            "name": "ltwapFrozen",
            "type": "bool"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "CreateAmmParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "permissionedCaller",
            "type": "publicKey"
          },
          {
            "name": "swapFeeBps",
            "type": "u64"
          },
          {
            "name": "ltwapDecimals",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "AnchorDecimal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "data",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "AddLiquidityCalculationError",
      "msg": "Add liquidity calculation error"
    },
    {
      "code": 6001,
      "name": "DecimalScaleError",
      "msg": "Error in decimal scale conversion"
    }
  ]
};

export const IDL: Amm = {
  "version": "0.1.0",
  "name": "amm",
  "instructions": [
    {
      "name": "createAmm",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "baseMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "quoteMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vaultAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaQuote",
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
        },
        {
          "name": "authPda",
          "isMut": false,
          "isSigner": true,
          "isOptional": true
        }
      ],
      "args": [
        {
          "name": "createAmmParams",
          "type": {
            "defined": "CreateAmmParams"
          }
        }
      ]
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
          "name": "amm",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "ammPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "authPda",
          "isMut": false,
          "isSigner": true,
          "isOptional": true
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
          "name": "baseMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "quoteMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userAtaQuote",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaQuote",
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
        },
        {
          "name": "authPda",
          "isMut": false,
          "isSigner": true,
          "isOptional": true
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
          "name": "baseMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "quoteMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userAtaQuote",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaQuote",
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
        },
        {
          "name": "authPda",
          "isMut": false,
          "isSigner": true,
          "isOptional": true
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
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "baseMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "quoteMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "userAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userAtaQuote",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaBase",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultAtaQuote",
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
        },
        {
          "name": "authPda",
          "isMut": false,
          "isSigner": true,
          "isOptional": true
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
    },
    {
      "name": "updateLtwap",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "amm",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "authPda",
          "isMut": false,
          "isSigner": true,
          "isOptional": true
        }
      ],
      "args": [
        {
          "name": "finalSlot",
          "type": {
            "option": "u64"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "ammPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "publicKey"
          },
          {
            "name": "amm",
            "type": "publicKey"
          },
          {
            "name": "ownership",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "amm",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "permissioned",
            "type": "bool"
          },
          {
            "name": "authProgram",
            "type": "publicKey"
          },
          {
            "name": "authPdaBump",
            "type": "u8"
          },
          {
            "name": "createdAtSlot",
            "type": "u64"
          },
          {
            "name": "baseMint",
            "type": "publicKey"
          },
          {
            "name": "quoteMint",
            "type": "publicKey"
          },
          {
            "name": "baseMintDecimals",
            "type": "u8"
          },
          {
            "name": "quoteMintDecimals",
            "type": "u8"
          },
          {
            "name": "baseAmount",
            "type": "u64"
          },
          {
            "name": "quoteAmount",
            "type": "u64"
          },
          {
            "name": "totalOwnership",
            "type": "u64"
          },
          {
            "name": "swapFeeBps",
            "type": "u64"
          },
          {
            "name": "ltwapDecimals",
            "type": "u8"
          },
          {
            "name": "ltwapSlotUpdated",
            "type": "u64"
          },
          {
            "name": "ltwapDenominatorAgg",
            "type": {
              "defined": "AnchorDecimal"
            }
          },
          {
            "name": "ltwapNumeratorAgg",
            "type": {
              "defined": "AnchorDecimal"
            }
          },
          {
            "name": "ltwapLatest",
            "type": "u64"
          },
          {
            "name": "ltwapFrozen",
            "type": "bool"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "CreateAmmParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "permissionedCaller",
            "type": "publicKey"
          },
          {
            "name": "swapFeeBps",
            "type": "u64"
          },
          {
            "name": "ltwapDecimals",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "AnchorDecimal",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "data",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "AddLiquidityCalculationError",
      "msg": "Add liquidity calculation error"
    },
    {
      "code": 6001,
      "name": "DecimalScaleError",
      "msg": "Error in decimal scale conversion"
    }
  ]
};
