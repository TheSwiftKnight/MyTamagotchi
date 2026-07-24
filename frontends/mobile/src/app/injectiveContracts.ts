export const INJECTIVE_EVM_CHAIN_ID = 1439;
export const INJECTIVE_EVM_CHAIN_HEX = "0x59f";
export const INJECTIVE_EVM_RPC =
  import.meta.env.VITE_INJECTIVE_RPC_URL || "https://k8s.testnet.json-rpc.injective.network/";
export const INJECTIVE_EVM_EXPLORER = "https://testnet.blockscout.injective.network";
export const AGENT_SKILL_MARKET_ADDRESS =
  (import.meta.env.VITE_INJECTIVE_MARKET_ADDRESS
    || "0xb9ccef65daa36db583c20556b4f9e91c6c43b0b4") as `0x${string}`;
export const IDENTITY_REGISTRY_ADDRESS =
  (import.meta.env.VITE_INJECTIVE_IDENTITY_REGISTRY
    || "0x8004A818BFB912233c491871b3d84c89A494BD9e") as `0x${string}`;

export const injectiveEvmTestnet = {
  id: INJECTIVE_EVM_CHAIN_ID,
  name: "Injective EVM Testnet",
  nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
  rpcUrls: { default: { http: [INJECTIVE_EVM_RPC] } },
  blockExplorers: {
    default: { name: "Injective Blockscout", url: INJECTIVE_EVM_EXPLORER },
  },
  testnet: true,
} as const;

export const agentSkillMarketAbi = [
  {
    type: "function",
    name: "listingCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getListing",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "publisherAgentId", type: "uint256" },
          { name: "publisher", type: "address" },
          { name: "collaborator", type: "address" },
          { name: "skillKey", type: "bytes32" },
          { name: "manifestRoot", type: "bytes32" },
          { name: "priceWei", type: "uint128" },
          { name: "pricingMode", type: "uint8" },
          { name: "active", type: "bool" },
          { name: "createdAt", type: "uint64" },
          { name: "name", type: "string" },
          { name: "summary", type: "string" },
          { name: "metadataURI", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "callCount",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "hasLicense",
    stateMutability: "view",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "buyer", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "pendingRevenue",
    stateMutability: "view",
    inputs: [{ name: "recipient", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "publishSkill",
    stateMutability: "nonpayable",
    inputs: [
      { name: "publisherAgentId", type: "uint256" },
      { name: "skillKey", type: "bytes32" },
      { name: "name", type: "string" },
      { name: "summary", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "manifestRoot", type: "bytes32" },
      { name: "priceWei", type: "uint128" },
      { name: "pricingMode", type: "uint8" },
      { name: "collaborator", type: "address" },
    ],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    type: "function",
    name: "purchaseLicense",
    stateMutability: "payable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "buyerAgentId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "callSkill",
    stateMutability: "payable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "buyerAgentId", type: "uint256" },
      { name: "requestHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawRevenue",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

export const identityRegistryAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const INJECTIVE_WALLET_PARAMS = {
  chainId: INJECTIVE_EVM_CHAIN_HEX,
  chainName: "Injective EVM Testnet",
  nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
  rpcUrls: [INJECTIVE_EVM_RPC],
  blockExplorerUrls: [INJECTIVE_EVM_EXPLORER],
};

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}
