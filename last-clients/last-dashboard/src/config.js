const PlasmaConfig = {
  abi: [
    {
      "constant": true,
      "inputs": [],
      "name": "lastBlockNumber",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "",
          "type": "address"
        },
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "depositRecords",
      "outputs": [
        {
          "name": "blockNumber",
          "type": "uint256"
        },
        {
          "name": "txIndex",
          "type": "uint256"
        },
        {
          "name": "depositor",
          "type": "address"
        },
        {
          "name": "amount",
          "type": "uint256"
        },
        {
          "name": "timeCreated",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "headers",
      "outputs": [
        {
          "name": "blockNumber",
          "type": "uint256"
        },
        {
          "name": "previousHash",
          "type": "bytes32"
        },
        {
          "name": "merkleRoot",
          "type": "bytes32"
        },
        {
          "name": "r",
          "type": "bytes32"
        },
        {
          "name": "s",
          "type": "bytes32"
        },
        {
          "name": "v",
          "type": "uint8"
        },
        {
          "name": "timeSubmitted",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "txCounter",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "name": "",
          "type": "address"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "withdrawRecords",
      "outputs": [
        {
          "name": "blockNumber",
          "type": "uint256"
        },
        {
          "name": "txIndex",
          "type": "uint256"
        },
        {
          "name": "oIndex",
          "type": "uint256"
        },
        {
          "name": "beneficiary",
          "type": "address"
        },
        {
          "name": "amount",
          "type": "uint256"
        },
        {
          "name": "priority",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "",
          "type": "uint256"
        },
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "withdrawalIds",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "name": "exitAge",
          "type": "uint256"
        },
        {
          "name": "exitWait",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "name": "signer",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "blockNumber",
          "type": "uint32"
        }
      ],
      "name": "HeaderSubmittedEvent",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "name": "from",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "amount",
          "type": "uint256"
        },
        {
          "indexed": true,
          "name": "blockNumber",
          "type": "uint256"
        },
        {
          "indexed": false,
          "name": "txIndex",
          "type": "uint256"
        }
      ],
      "name": "DepositEvent",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "name": "withdrawalId",
          "type": "uint256"
        }
      ],
      "name": "WithdrawalStartedEvent",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "name": "withdrawalId",
          "type": "uint256"
        }
      ],
      "name": "WithdrawalChallengedEvent",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "blockNumber",
          "type": "uint256"
        },
        {
          "indexed": false,
          "name": "exitBlockNumber",
          "type": "uint256"
        },
        {
          "indexed": false,
          "name": "exitTxIndex",
          "type": "uint256"
        },
        {
          "indexed": false,
          "name": "exitOIndex",
          "type": "uint256"
        }
      ],
      "name": "WithdrawalCompleteEvent",
      "type": "event"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "header",
          "type": "bytes"
        }
      ],
      "name": "submitBlockHeader",
      "outputs": [
        {
          "name": "success",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [],
      "name": "deposit",
      "outputs": [
        {
          "name": "success",
          "type": "bool"
        }
      ],
      "payable": true,
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "blockNumber",
          "type": "uint256"
        },
        {
          "name": "txIndex",
          "type": "uint256"
        },
        {
          "name": "oIndex",
          "type": "uint256"
        },
        {
          "name": "targetTx",
          "type": "bytes"
        },
        {
          "name": "proof",
          "type": "bytes"
        }
      ],
      "name": "startWithdrawal",
      "outputs": [
        {
          "name": "withdrawalId",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "withdrawalId",
          "type": "uint256"
        },
        {
          "name": "blockNumber",
          "type": "uint256"
        },
        {
          "name": "txIndex",
          "type": "uint256"
        },
        {
          "name": "oIndex",
          "type": "uint256"
        },
        {
          "name": "targetTx",
          "type": "bytes"
        },
        {
          "name": "proof",
          "type": "bytes"
        }
      ],
      "name": "challengeWithdrawal",
      "outputs": [
        {
          "name": "success",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [],
      "name": "finalizeWithdrawal",
      "outputs": [
        {
          "name": "success",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ],
  "address": "0x92600088d7d7c913ec18095d953b812f56675e2d" 
}

  export default PlasmaConfig;