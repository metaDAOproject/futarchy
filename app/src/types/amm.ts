export type Amm = {
  "version": "1.0.0",
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
          "name": "lpMint",
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
      "args": [
        {
          "name": "args",
          "type": {
            "defined": "CreateAmmArgs"
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
          "name": "lpMint",
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
          "name": "userAtaLp",
          "isMut": true,
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
          "name": "lpMint",
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
            "name": "lpMint",
            "type": "publicKey"
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
            "name": "oracle",
            "type": {
              "defined": "TwapOracle"
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "CreateAmmArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "twapInitialObservation",
            "type": "u128"
          },
          {
            "name": "twapMaxObservationChangePerUpdate",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "TwapOracle",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lastUpdatedSlot",
            "type": "u64"
          },
          {
            "name": "lastPrice",
            "docs": [
              "A price is the number of quote units per base unit multiplied by 1e12.",
              "You cannot simply divide by 1e12 to get a price you can display in the UI",
              "because the base and quote decimals may be different. Instead, do:",
              "ui_price = (price * (10**(base_decimals - quote_decimals))) / 1e12"
            ],
            "type": "u128"
          },
          {
            "name": "lastObservation",
            "docs": [
              "If we did a raw TWAP over prices, someone could push the TWAP heavily with",
              "a few extremely large outliers. So we use observations, which can only move",
              "by `max_observation_change_per_update` per update."
            ],
            "type": "u128"
          },
          {
            "name": "aggregator",
            "docs": [
              "Running sum of slots_per_last_update * last_observation.",
              "",
              "Assuming latest observations are as big as possible (u64::MAX * 1e12),",
              "we can store 18 million slots worth of observations, which turns out to",
              "be ~85 days worth of slots.",
              "",
              "Assuming that latest observations are 100x smaller than they could theoretically",
              "be, we can store 8500 days (23 years) worth of them. Even this is a very",
              "very conservative assumption - META/USDC prices should be between 1e9 and",
              "1e15, which would overflow after 1e15 years worth of slots.",
              "",
              "So in the case of an overflow, the aggregator rolls back to 0. It's the",
              "client's responsibility to sanity check the assets or to handle an",
              "aggregator at t2 being smaller than an aggregator at t1."
            ],
            "type": "u128"
          },
          {
            "name": "maxObservationChangePerUpdate",
            "docs": [
              "The most that an observation can change per update."
            ],
            "type": "u128"
          },
          {
            "name": "initialObservation",
            "docs": [
              "What the initial `latest_observation` is set to."
            ],
            "type": "u128"
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
    },
    {
      "code": 6005,
      "name": "SameTokenMints",
      "msg": "You can't create an AMM pool where the token mints are the same"
    },
    {
      "code": 6006,
      "name": "SlippageExceeded",
      "msg": "A user wouldn't have gotten back their `output_amount_min`, reverting"
    }
  ]
};

export const IDL: Amm = {
  "version": "1.0.0",
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
          "name": "lpMint",
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
      "args": [
        {
          "name": "args",
          "type": {
            "defined": "CreateAmmArgs"
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
          "name": "lpMint",
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
          "name": "userAtaLp",
          "isMut": true,
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
          "name": "lpMint",
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
            "name": "lpMint",
            "type": "publicKey"
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
            "name": "oracle",
            "type": {
              "defined": "TwapOracle"
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "CreateAmmArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "twapInitialObservation",
            "type": "u128"
          },
          {
            "name": "twapMaxObservationChangePerUpdate",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "TwapOracle",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lastUpdatedSlot",
            "type": "u64"
          },
          {
            "name": "lastPrice",
            "docs": [
              "A price is the number of quote units per base unit multiplied by 1e12.",
              "You cannot simply divide by 1e12 to get a price you can display in the UI",
              "because the base and quote decimals may be different. Instead, do:",
              "ui_price = (price * (10**(base_decimals - quote_decimals))) / 1e12"
            ],
            "type": "u128"
          },
          {
            "name": "lastObservation",
            "docs": [
              "If we did a raw TWAP over prices, someone could push the TWAP heavily with",
              "a few extremely large outliers. So we use observations, which can only move",
              "by `max_observation_change_per_update` per update."
            ],
            "type": "u128"
          },
          {
            "name": "aggregator",
            "docs": [
              "Running sum of slots_per_last_update * last_observation.",
              "",
              "Assuming latest observations are as big as possible (u64::MAX * 1e12),",
              "we can store 18 million slots worth of observations, which turns out to",
              "be ~85 days worth of slots.",
              "",
              "Assuming that latest observations are 100x smaller than they could theoretically",
              "be, we can store 8500 days (23 years) worth of them. Even this is a very",
              "very conservative assumption - META/USDC prices should be between 1e9 and",
              "1e15, which would overflow after 1e15 years worth of slots.",
              "",
              "So in the case of an overflow, the aggregator rolls back to 0. It's the",
              "client's responsibility to sanity check the assets or to handle an",
              "aggregator at t2 being smaller than an aggregator at t1."
            ],
            "type": "u128"
          },
          {
            "name": "maxObservationChangePerUpdate",
            "docs": [
              "The most that an observation can change per update."
            ],
            "type": "u128"
          },
          {
            "name": "initialObservation",
            "docs": [
              "What the initial `latest_observation` is set to."
            ],
            "type": "u128"
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
    },
    {
      "code": 6005,
      "name": "SameTokenMints",
      "msg": "You can't create an AMM pool where the token mints are the same"
    },
    {
      "code": 6006,
      "name": "SlippageExceeded",
      "msg": "A user wouldn't have gotten back their `output_amount_min`, reverting"
    }
  ]
};
