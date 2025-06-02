const ABI_MACH_BRIDGE = [
    {
      "inputs": [
        {
          "components": [
            { "internalType": "address", "name": "srcAsset", "type": "address" },
            { "internalType": "bytes32", "name": "dstAsset", "type": "bytes32" },
            { "internalType": "uint32", "name": "dstLzc", "type": "uint32" }
          ],
          "internalType": "struct TradeInterface.OrderDirection",
          "name": "direction",
          "type": "tuple"
        },
        {
          "components": [
            { "internalType": "uint96", "name": "srcQuantity", "type": "uint96" },
            { "internalType": "uint96", "name": "dstQuantity", "type": "uint96" },
            { "internalType": "uint16", "name": "bondFee", "type": "uint16" },
            { "internalType": "address", "name": "bondAsset", "type": "address" },
            { "internalType": "uint96", "name": "bondAmount", "type": "uint96" }
          ],
          "internalType": "struct TradeInterface.OrderFunding",
          "name": "funding",
          "type": "tuple"
        },
        {
          "components": [
            { "internalType": "uint32", "name": "timestamp", "type": "uint32" },
            { "internalType": "uint16", "name": "challengeOffset", "type": "uint16" },
            { "internalType": "uint16", "name": "challengeWindow", "type": "uint16" }
          ],
          "internalType": "struct TradeInterface.OrderExpiration",
          "name": "expiration",
          "type": "tuple"
        },
        { "internalType": "bytes32", "name": "target", "type": "bytes32" },
        { "internalType": "address", "name": "filler", "type": "address" }
      ],
      "name": "placeOrder",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];
  
  const ABI_TOKEN_WITHDRAW = [
      {
          "inputs": [
              {
                  "internalType": "address",
                  "name": "_admin",
                  "type": "address"
              }
          ],
          "name": "addAdmin",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
      },
      {
          "inputs": [
              {
                  "internalType": "address",
                  "name": "initialOwner",
                  "type": "address"
              }
          ],
          "stateMutability": "nonpayable",
          "type": "constructor"
      },
      {
          "inputs": [
              {
                  "internalType": "address",
                  "name": "owner",
                  "type": "address"
              }
          ],
          "name": "OwnableInvalidOwner",
          "type": "error"
      },
      {
          "inputs": [
              {
                  "internalType": "address",
                  "name": "account",
                  "type": "address"
              }
          ],
          "name": "OwnableUnauthorizedAccount",
          "type": "error"
      },
      {
          "anonymous": false,
          "inputs": [
              {
                  "indexed": true,
                  "internalType": "address",
                  "name": "newAdmin",
                  "type": "address"
              }
          ],
          "name": "AdminAdded",
          "type": "event"
      },
      {
          "anonymous": false,
          "inputs": [
              {
                  "indexed": true,
                  "internalType": "address",
                  "name": "previousOwner",
                  "type": "address"
              },
              {
                  "indexed": true,
                  "internalType": "address",
                  "name": "newOwner",
                  "type": "address"
              }
          ],
          "name": "OwnershipTransferred",
          "type": "event"
      },
      {
          "inputs": [],
          "name": "renounceOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
      },
      {
          "inputs": [
              {
                  "internalType": "address",
                  "name": "newOwner",
                  "type": "address"
              }
          ],
          "name": "transferOwnership",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
      },
      {
          "inputs": [
              {
                  "internalType": "address",
                  "name": "token",
                  "type": "address"
              },
              {
                  "internalType": "address",
                  "name": "to",
                  "type": "address"
              },
              {
                  "internalType": "uint256",
                  "name": "amount",
                  "type": "uint256"
              }
          ],
          "name": "withdraw",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
      },
      {
          "anonymous": false,
          "inputs": [
              {
                  "indexed": true,
                  "internalType": "address",
                  "name": "token",
                  "type": "address"
              },
              {
                  "indexed": true,
                  "internalType": "address",
                  "name": "to",
                  "type": "address"
              },
              {
                  "indexed": false,
                  "internalType": "uint256",
                  "name": "amount",
                  "type": "uint256"
              }
          ],
          "name": "Withdrawn",
          "type": "event"
      },
      {
          "inputs": [
              {
                  "internalType": "address",
                  "name": "",
                  "type": "address"
              }
          ],
          "name": "admins",
          "outputs": [
              {
                  "internalType": "bool",
                  "name": "",
                  "type": "bool"
              }
          ],
          "stateMutability": "view",
          "type": "function"
      },
      {
          "inputs": [],
          "name": "owner",
          "outputs": [
              {
                  "internalType": "address",
                  "name": "",
                  "type": "address"
              }
          ],
          "stateMutability": "view",
          "type": "function"
      }
  ]
  
  module.exports = {ABI_MACH_BRIDGE, ABI_TOKEN_WITHDRAW}