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
        }
      ],
      "args": [
        {
          "name": "direction",
          "type": {
            "defined": "SwapType"
          }
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
        }
      ],
      "args": []
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
            "name": "twapLastUpdatedSlot",
            "type": "u64"
          },
          {
            "name": "twapLastObservationUq64X32",
            "docs": [
              "To represent prices, we use fixed point numbers with 32 fractional",
              "bits. To convert to a normal number, you can divide by",
              "2**32."
            ],
            "type": "u128"
          },
          {
            "name": "twapAggregatorUq96X32",
            "docs": [
              "Running sum of slots_since_last_update * price.",
              "",
              "Assuming last observations are as big as possible (UQ64x32::MAX),",
              "we can store (2**32) of them. This translates into 54 years worth",
              "of slots. At this point, the aggregator will roll back to 0. It's the",
              "client's responsibility to check that the second aggregator is bigger",
              "than the first aggregator."
            ],
            "type": "u128"
          },
          {
            "name": "twapMaxChangePerUpdateUq64X32",
            "docs": [
              "The most that a price can change per update."
            ],
            "type": "u128"
          }
        ]
      }
    }
  ],
  "types": [
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
    },
    {
      "name": "SwapType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Buy"
          },
          {
            "name": "Sell"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "NoSlotsPassed",
      "msg": "Can't get a TWAP before some observations have been stored"
    },
    {
      "code": 6001,
      "name": "NoReserves",
      "msg": "Can't swap through a pool without token reserves on either side"
    },
    {
      "code": 6002,
      "name": "InputAmountOverflow",
      "msg": "Input token amount is too large for a swap, causes overflow"
    },
    {
      "code": 6003,
      "name": "AddLiquidityCalculationError",
      "msg": "Add liquidity calculation error"
    },
    {
      "code": 6004,
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
        }
      ],
      "args": [
        {
          "name": "direction",
          "type": {
            "defined": "SwapType"
          }
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
        }
      ],
      "args": []
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
            "name": "twapLastUpdatedSlot",
            "type": "u64"
          },
          {
            "name": "twapLastObservationUq64X32",
            "docs": [
              "To represent prices, we use fixed point numbers with 32 fractional",
              "bits. To convert to a normal number, you can divide by",
              "2**32."
            ],
            "type": "u128"
          },
          {
            "name": "twapAggregatorUq96X32",
            "docs": [
              "Running sum of slots_since_last_update * price.",
              "",
              "Assuming last observations are as big as possible (UQ64x32::MAX),",
              "we can store (2**32) of them. This translates into 54 years worth",
              "of slots. At this point, the aggregator will roll back to 0. It's the",
              "client's responsibility to check that the second aggregator is bigger",
              "than the first aggregator."
            ],
            "type": "u128"
          },
          {
            "name": "twapMaxChangePerUpdateUq64X32",
            "docs": [
              "The most that a price can change per update."
            ],
            "type": "u128"
          }
        ]
      }
    }
  ],
  "types": [
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
    },
    {
      "name": "SwapType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Buy"
          },
          {
            "name": "Sell"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "NoSlotsPassed",
      "msg": "Can't get a TWAP before some observations have been stored"
    },
    {
      "code": 6001,
      "name": "NoReserves",
      "msg": "Can't swap through a pool without token reserves on either side"
    },
    {
      "code": 6002,
      "name": "InputAmountOverflow",
      "msg": "Input token amount is too large for a swap, causes overflow"
    },
    {
      "code": 6003,
      "name": "AddLiquidityCalculationError",
      "msg": "Add liquidity calculation error"
    },
    {
      "code": 6004,
      "name": "DecimalScaleError",
      "msg": "Error in decimal scale conversion"
    }
  ]
};
