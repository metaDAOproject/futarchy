export type Timelock = {
  version: "0.3.0";
  name: "timelock";
  instructions: [
    {
      name: "createTimelock";
      accounts: [
        {
          name: "timelockSigner";
          isMut: false;
          isSigner: false;
        },
        {
          name: "timelock";
          isMut: true;
          isSigner: true;
        }
      ];
      args: [
        {
          name: "authority";
          type: "publicKey";
        },
        {
          name: "delayInSlots";
          type: "u64";
        },
        {
          name: "enqueuers";
          type: {
            vec: "publicKey";
          };
        },
        {
          name: "enqueuerCooldownSlots";
          type: "u64";
        }
      ];
    },
    {
      name: "setDelayInSlots";
      accounts: [
        {
          name: "timelockSigner";
          isMut: false;
          isSigner: true;
        },
        {
          name: "timelock";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "delayInSlots";
          type: "u64";
        }
      ];
    },
    {
      name: "setAuthority";
      accounts: [
        {
          name: "timelockSigner";
          isMut: false;
          isSigner: true;
        },
        {
          name: "timelock";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "authority";
          type: "publicKey";
        }
      ];
    },
    {
      name: "setEnqueuerCooldownSlots";
      accounts: [
        {
          name: "timelockSigner";
          isMut: false;
          isSigner: true;
        },
        {
          name: "timelock";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "cooldownSlots";
          type: "u64";
        }
      ];
    },
    {
      name: "addEnqueuer";
      accounts: [
        {
          name: "timelockSigner";
          isMut: false;
          isSigner: true;
        },
        {
          name: "timelock";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "enqueuer";
          type: "publicKey";
        }
      ];
    },
    {
      name: "removeEnqueuer";
      accounts: [
        {
          name: "timelockSigner";
          isMut: false;
          isSigner: true;
        },
        {
          name: "timelock";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "enqueuer";
          type: "publicKey";
        }
      ];
    },
    {
      name: "createTransactionBatch";
      accounts: [
        {
          name: "transactionBatchAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "timelock";
          isMut: false;
          isSigner: false;
        },
        {
          name: "transactionBatch";
          isMut: true;
          isSigner: true;
        }
      ];
      args: [];
    },
    {
      name: "addTransaction";
      accounts: [
        {
          name: "transactionBatchAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "transactionBatch";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "programId";
          type: "publicKey";
        },
        {
          name: "accounts";
          type: {
            vec: {
              defined: "TransactionAccount";
            };
          };
        },
        {
          name: "data";
          type: "bytes";
        }
      ];
    },
    {
      name: "sealTransactionBatch";
      accounts: [
        {
          name: "transactionBatchAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "transactionBatch";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "enqueueTransactionBatch";
      accounts: [
        {
          name: "enqueuerOrAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "timelock";
          isMut: true;
          isSigner: false;
        },
        {
          name: "transactionBatch";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "cancelTransactionBatch";
      accounts: [
        {
          name: "enqueuerOrAuthority";
          isMut: false;
          isSigner: true;
        },
        {
          name: "timelock";
          isMut: true;
          isSigner: false;
        },
        {
          name: "transactionBatch";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [];
    },
    {
      name: "executeTransactionBatch";
      accounts: [
        {
          name: "timelockSigner";
          isMut: false;
          isSigner: false;
        },
        {
          name: "timelock";
          isMut: false;
          isSigner: false;
        },
        {
          name: "transactionBatch";
          isMut: true;
          isSigner: false;
        }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "timelock";
      type: {
        kind: "struct";
        fields: [
          {
            name: "authority";
            type: "publicKey";
          },
          {
            name: "signerBump";
            type: "u8";
          },
          {
            name: "delayInSlots";
            type: "u64";
          },
          {
            name: "enqueuers";
            type: {
              vec: {
                defined: "Enqueuer";
              };
            };
          },
          {
            name: "enqueuerCooldownSlots";
            docs: [
              "The cooldown period for enqueuers to prevent spamming the timelock."
            ];
            type: "u64";
          }
        ];
      };
    },
    {
      name: "transactionBatch";
      type: {
        kind: "struct";
        fields: [
          {
            name: "status";
            type: {
              defined: "TransactionBatchStatus";
            };
          },
          {
            name: "transactions";
            type: {
              vec: {
                defined: "Transaction";
              };
            };
          },
          {
            name: "timelock";
            type: "publicKey";
          },
          {
            name: "enqueuedSlot";
            type: "u64";
          },
          {
            name: "transactionBatchAuthority";
            type: "publicKey";
          },
          {
            name: "commitmentLevel";
            type: {
              defined: "CommitmentLevel";
            };
          }
        ];
      };
    }
  ];
  types: [
    {
      name: "Enqueuer";
      type: {
        kind: "struct";
        fields: [
          {
            name: "pubkey";
            type: "publicKey";
          },
          {
            name: "lastSlotEnqueued";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "Transaction";
      type: {
        kind: "struct";
        fields: [
          {
            name: "programId";
            type: "publicKey";
          },
          {
            name: "accounts";
            type: {
              vec: {
                defined: "TransactionAccount";
              };
            };
          },
          {
            name: "data";
            type: "bytes";
          },
          {
            name: "didExecute";
            type: "bool";
          }
        ];
      };
    },
    {
      name: "TransactionAccount";
      type: {
        kind: "struct";
        fields: [
          {
            name: "pubkey";
            type: "publicKey";
          },
          {
            name: "isSigner";
            type: "bool";
          },
          {
            name: "isWritable";
            type: "bool";
          }
        ];
      };
    },
    {
      name: "CommitmentLevel";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Soft";
          },
          {
            name: "Hard";
          }
        ];
      };
    },
    {
      name: "TransactionBatchStatus";
      type: {
        kind: "enum";
        variants: [
          {
            name: "Created";
          },
          {
            name: "Sealed";
          },
          {
            name: "Enqueued";
          },
          {
            name: "Cancelled";
          },
          {
            name: "Executed";
          }
        ];
      };
    }
  ];
  errors: [
    {
      code: 6000;
      name: "NotReady";
      msg: "This transaction is not yet ready to be executed";
    },
    {
      code: 6001;
      name: "CannotAddTransactions";
      msg: "Can only add instructions when transaction batch status is `Created`";
    },
    {
      code: 6002;
      name: "CannotSealTransactionBatch";
      msg: "Can only seal the transaction batch when status is `Created`";
    },
    {
      code: 6003;
      name: "CannotEnqueueTransactionBatch";
      msg: "Can only enqueue the timelock running once the status is `Sealed`";
    },
    {
      code: 6004;
      name: "CannotCancelTimelock";
      msg: "Can only cancel the transactions if the status `Enqueued`";
    },
    {
      code: 6005;
      name: "CanOnlyCancelDuringTimelockPeriod";
      msg: "Can only cancel the transactions during the timelock period";
    },
    {
      code: 6006;
      name: "CannotExecuteTransactions";
      msg: "Can only execute the transactions if the status is `Enqueued`";
    },
    {
      code: 6007;
      name: "NoCommitmentLevel";
      msg: "The approver is neither the timelock authority nor an enqueuer";
    },
    {
      code: 6008;
      name: "InsufficientCommitmentLevel";
      msg: "Enqueuers can't cancel transaction batches enqueued by the timelock authority";
    },
    {
      code: 6009;
      name: "EnqueuerCooldown";
      msg: "This enqueuer is still in its cooldown period";
    }
  ];
};

export const IDL: Timelock = {
  version: "0.3.0",
  name: "timelock",
  instructions: [
    {
      name: "createTimelock",
      accounts: [
        {
          name: "timelockSigner",
          isMut: false,
          isSigner: false,
        },
        {
          name: "timelock",
          isMut: true,
          isSigner: true,
        },
      ],
      args: [
        {
          name: "authority",
          type: "publicKey",
        },
        {
          name: "delayInSlots",
          type: "u64",
        },
        {
          name: "enqueuers",
          type: {
            vec: "publicKey",
          },
        },
        {
          name: "enqueuerCooldownSlots",
          type: "u64",
        },
      ],
    },
    {
      name: "setDelayInSlots",
      accounts: [
        {
          name: "timelockSigner",
          isMut: false,
          isSigner: true,
        },
        {
          name: "timelock",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "delayInSlots",
          type: "u64",
        },
      ],
    },
    {
      name: "setAuthority",
      accounts: [
        {
          name: "timelockSigner",
          isMut: false,
          isSigner: true,
        },
        {
          name: "timelock",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "authority",
          type: "publicKey",
        },
      ],
    },
    {
      name: "setEnqueuerCooldownSlots",
      accounts: [
        {
          name: "timelockSigner",
          isMut: false,
          isSigner: true,
        },
        {
          name: "timelock",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "cooldownSlots",
          type: "u64",
        },
      ],
    },
    {
      name: "addEnqueuer",
      accounts: [
        {
          name: "timelockSigner",
          isMut: false,
          isSigner: true,
        },
        {
          name: "timelock",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "enqueuer",
          type: "publicKey",
        },
      ],
    },
    {
      name: "removeEnqueuer",
      accounts: [
        {
          name: "timelockSigner",
          isMut: false,
          isSigner: true,
        },
        {
          name: "timelock",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "enqueuer",
          type: "publicKey",
        },
      ],
    },
    {
      name: "createTransactionBatch",
      accounts: [
        {
          name: "transactionBatchAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "timelock",
          isMut: false,
          isSigner: false,
        },
        {
          name: "transactionBatch",
          isMut: true,
          isSigner: true,
        },
      ],
      args: [],
    },
    {
      name: "addTransaction",
      accounts: [
        {
          name: "transactionBatchAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "transactionBatch",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "programId",
          type: "publicKey",
        },
        {
          name: "accounts",
          type: {
            vec: {
              defined: "TransactionAccount",
            },
          },
        },
        {
          name: "data",
          type: "bytes",
        },
      ],
    },
    {
      name: "sealTransactionBatch",
      accounts: [
        {
          name: "transactionBatchAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "transactionBatch",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "enqueueTransactionBatch",
      accounts: [
        {
          name: "enqueuerOrAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "timelock",
          isMut: true,
          isSigner: false,
        },
        {
          name: "transactionBatch",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "cancelTransactionBatch",
      accounts: [
        {
          name: "enqueuerOrAuthority",
          isMut: false,
          isSigner: true,
        },
        {
          name: "timelock",
          isMut: true,
          isSigner: false,
        },
        {
          name: "transactionBatch",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: "executeTransactionBatch",
      accounts: [
        {
          name: "timelockSigner",
          isMut: false,
          isSigner: false,
        },
        {
          name: "timelock",
          isMut: false,
          isSigner: false,
        },
        {
          name: "transactionBatch",
          isMut: true,
          isSigner: false,
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "timelock",
      type: {
        kind: "struct",
        fields: [
          {
            name: "authority",
            type: "publicKey",
          },
          {
            name: "signerBump",
            type: "u8",
          },
          {
            name: "delayInSlots",
            type: "u64",
          },
          {
            name: "enqueuers",
            type: {
              vec: {
                defined: "Enqueuer",
              },
            },
          },
          {
            name: "enqueuerCooldownSlots",
            docs: [
              "The cooldown period for enqueuers to prevent spamming the timelock.",
            ],
            type: "u64",
          },
        ],
      },
    },
    {
      name: "transactionBatch",
      type: {
        kind: "struct",
        fields: [
          {
            name: "status",
            type: {
              defined: "TransactionBatchStatus",
            },
          },
          {
            name: "transactions",
            type: {
              vec: {
                defined: "Transaction",
              },
            },
          },
          {
            name: "timelock",
            type: "publicKey",
          },
          {
            name: "enqueuedSlot",
            type: "u64",
          },
          {
            name: "transactionBatchAuthority",
            type: "publicKey",
          },
          {
            name: "commitmentLevel",
            type: {
              defined: "CommitmentLevel",
            },
          },
        ],
      },
    },
  ],
  types: [
    {
      name: "Enqueuer",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pubkey",
            type: "publicKey",
          },
          {
            name: "lastSlotEnqueued",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "Transaction",
      type: {
        kind: "struct",
        fields: [
          {
            name: "programId",
            type: "publicKey",
          },
          {
            name: "accounts",
            type: {
              vec: {
                defined: "TransactionAccount",
              },
            },
          },
          {
            name: "data",
            type: "bytes",
          },
          {
            name: "didExecute",
            type: "bool",
          },
        ],
      },
    },
    {
      name: "TransactionAccount",
      type: {
        kind: "struct",
        fields: [
          {
            name: "pubkey",
            type: "publicKey",
          },
          {
            name: "isSigner",
            type: "bool",
          },
          {
            name: "isWritable",
            type: "bool",
          },
        ],
      },
    },
    {
      name: "CommitmentLevel",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Soft",
          },
          {
            name: "Hard",
          },
        ],
      },
    },
    {
      name: "TransactionBatchStatus",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Created",
          },
          {
            name: "Sealed",
          },
          {
            name: "Enqueued",
          },
          {
            name: "Cancelled",
          },
          {
            name: "Executed",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "NotReady",
      msg: "This transaction is not yet ready to be executed",
    },
    {
      code: 6001,
      name: "CannotAddTransactions",
      msg: "Can only add instructions when transaction batch status is `Created`",
    },
    {
      code: 6002,
      name: "CannotSealTransactionBatch",
      msg: "Can only seal the transaction batch when status is `Created`",
    },
    {
      code: 6003,
      name: "CannotEnqueueTransactionBatch",
      msg: "Can only enqueue the timelock running once the status is `Sealed`",
    },
    {
      code: 6004,
      name: "CannotCancelTimelock",
      msg: "Can only cancel the transactions if the status `Enqueued`",
    },
    {
      code: 6005,
      name: "CanOnlyCancelDuringTimelockPeriod",
      msg: "Can only cancel the transactions during the timelock period",
    },
    {
      code: 6006,
      name: "CannotExecuteTransactions",
      msg: "Can only execute the transactions if the status is `Enqueued`",
    },
    {
      code: 6007,
      name: "NoCommitmentLevel",
      msg: "The approver is neither the timelock authority nor an enqueuer",
    },
    {
      code: 6008,
      name: "InsufficientCommitmentLevel",
      msg: "Enqueuers can't cancel transaction batches enqueued by the timelock authority",
    },
    {
      code: 6009,
      name: "EnqueuerCooldown",
      msg: "This enqueuer is still in its cooldown period",
    },
  ],
};
