export type RaydiumTwap = {
  version: "0.1.0";
  name: "raydium_twap";
  instructions: [
    {
      name: "initializePoolTwap";
      accounts: [
        {
          name: "pool";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    }
  ];
  types: [
    {
      name: "TWAPOracle";
      type: {
        kind: "struct";
        fields: [
          {
            name: "expectedValue";
            type: "u64";
          },
          {
            name: "initialSlot";
            type: "u64";
          },
          {
            name: "lastUpdatedSlot";
            type: "u64";
          },
          {
            name: "lastObservedSlot";
            type: "u64";
          },
          {
            name: "lastObservation";
            type: "u64";
          },
          {
            name: "observationAggregator";
            type: "u128";
          },
          {
            name: "maxObservationChangePerUpdateLots";
            type: "u64";
          }
        ];
      };
    }
  ];
};

export const IDL: RaydiumTwap = {
  version: "0.1.0",
  name: "raydium_twap",
  instructions: [
    {
      name: "initializePoolTwap",
      accounts: [
        {
          name: "pool",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
  ],
  types: [
    {
      name: "TWAPOracle",
      type: {
        kind: "struct",
        fields: [
          {
            name: "expectedValue",
            type: "u64",
          },
          {
            name: "initialSlot",
            type: "u64",
          },
          {
            name: "lastUpdatedSlot",
            type: "u64",
          },
          {
            name: "lastObservedSlot",
            type: "u64",
          },
          {
            name: "lastObservation",
            type: "u64",
          },
          {
            name: "observationAggregator",
            type: "u128",
          },
          {
            name: "maxObservationChangePerUpdateLots",
            type: "u64",
          },
        ],
      },
    },
  ],
};
