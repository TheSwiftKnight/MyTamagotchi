import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPublicClient, defineChain, formatEther, http } from "viem";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const evidencePath = path.resolve(scriptDirectory, "../../../contracts/injective/deployment.injective-testnet.json");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));

if (evidence.chainId !== 1439) throw new Error(`Unexpected chainId: ${evidence.chainId}`);
if (!/^0x[0-9a-f]{40}$/i.test(evidence.contractAddress)) throw new Error("Invalid market address");

const chain = defineChain({
  id: 1439,
  name: "Injective EVM Testnet",
  nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
  rpcUrls: { default: { http: [evidence.rpcUrl] } },
  testnet: true,
});
const client = createPublicClient({ chain, transport: http(evidence.rpcUrl) });
const marketAbi = [
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
    outputs: [{
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
    }],
  },
];
const identityAbi = [{
  type: "function",
  name: "ownerOf",
  stateMutability: "view",
  inputs: [{ name: "agentId", type: "uint256" }],
  outputs: [{ name: "", type: "address" }],
}];

const code = await client.getCode({ address: evidence.contractAddress });
if (!code || code === "0x") throw new Error("AgentSkillMarket has no bytecode");
const listingCount = await client.readContract({
  address: evidence.contractAddress,
  abi: marketAbi,
  functionName: "listingCount",
});
if (listingCount < BigInt(evidence.listings.length)) throw new Error("Listing count is smaller than deployment evidence");

const verifiedListings = [];
for (const expected of evidence.listings) {
  const listing = await client.readContract({
    address: evidence.contractAddress,
    abi: marketAbi,
    functionName: "getListing",
    args: [BigInt(expected.listingId)],
  });
  if (!listing.active) throw new Error(`Listing #${expected.listingId} is inactive`);
  if (listing.publisherAgentId !== BigInt(expected.publisherAgentId)) {
    throw new Error(`Publisher mismatch for listing #${expected.listingId}`);
  }
  if (listing.manifestRoot.toLowerCase() !== expected.manifestRoot.toLowerCase()) {
    throw new Error(`Manifest root mismatch for listing #${expected.listingId}`);
  }
  if (formatEther(listing.priceWei) !== expected.priceInj) {
    throw new Error(`Price mismatch for listing #${expected.listingId}`);
  }
  const owner = await client.readContract({
    address: evidence.identityRegistry,
    abi: identityAbi,
    functionName: "ownerOf",
    args: [listing.publisherAgentId],
  });
  if (owner.toLowerCase() !== listing.publisher.toLowerCase()) {
    throw new Error(`ERC-8004 owner mismatch for Agent #${listing.publisherAgentId}`);
  }
  verifiedListings.push({
    listingId: expected.listingId,
    name: listing.name,
    publisherAgentId: listing.publisherAgentId.toString(),
    priceInj: formatEther(listing.priceWei),
    mode: Number(listing.pricingMode) === 1 ? "per_call" : "license",
  });
}

console.log(JSON.stringify({
  ok: true,
  network: evidence.network,
  chainId: evidence.chainId,
  contractAddress: evidence.contractAddress,
  bytecodeBytes: (code.length - 2) / 2,
  totalListings: listingCount.toString(),
  activeCompetitionListings: verifiedListings,
  contractScanUrl: evidence.contractScanUrl,
}, null, 2));
