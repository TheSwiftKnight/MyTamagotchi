import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  encodeAbiParameters,
  formatEther,
  http,
  keccak256,
  parseAbiParameters,
  parseEther,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC_URL = "https://k8s.testnet.json-rpc.injective.network/";
const EXPLORER_URL = "https://testnet.blockscout.injective.network";
const CHAIN_ID = 1439;
const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const mobileDirectory = path.resolve(scriptDirectory, "..");
const repositoryDirectory = path.resolve(mobileDirectory, "../..");
const contractPath = path.join(repositoryDirectory, "contracts/injective/AgentSkillMarket.sol");
const evidencePath = path.join(repositoryDirectory, "contracts/injective/deployment.injective-testnet.json");

function loadEnvironment() {
  const values = { ...process.env };
  const environmentPath = process.env.INJ_ENV_FILE || path.join(mobileDirectory, ".env");
  try {
    for (const line of readFileSync(environmentPath, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || values[match[1]] !== undefined) continue;
      values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Process environment is sufficient when no env file is provided.
  }
  return values;
}

function compileContract() {
  const source = readFileSync(contractPath, "utf8");
  const input = {
    language: "Solidity",
    sources: { "AgentSkillMarket.sol": { content: source } },
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter(item => item.severity === "error");
  if (errors.length) throw new Error(errors.map(item => item.formattedMessage).join("\n"));
  return output.contracts["AgentSkillMarket.sol"].AgentSkillMarket;
}

const identityRegistryAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentURI", type: "string" },
      {
        name: "metadata",
        type: "tuple[]",
        components: [
          { name: "metadataKey", type: "string" },
          { name: "metadataValue", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "event",
    name: "Registered",
    anonymous: false,
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
];

const agentSeeds = [
  {
    key: "dotti",
    name: "Dotti",
    type: "companion",
    description: "Agent Land 的腊肠犬健身监督伙伴。",
    tags: ["fitness", "recovery", "agentland"],
  },
  {
    key: "puck",
    name: "Puck",
    type: "assistant",
    description: "Agent Land 的英语学习与问题循环伙伴。",
    tags: ["learning", "english", "agentland"],
  },
  {
    key: "atlas",
    name: "Atlas",
    type: "assistant",
    description: "Agent Land 的空间路线测绘伙伴。",
    tags: ["map", "route", "agentland"],
  },
  {
    key: "ansel",
    name: "Ansel",
    type: "assistant",
    description: "Agent Land 的共同编年史记录伙伴。",
    tags: ["chronicle", "civilization", "agentland"],
  },
];

const listingSeeds = [
  {
    slug: "fitness-supervision",
    agentKey: "dotti",
    name: "健身监督",
    summary: "由腊肠犬陪你检查动作、训练节奏与恢复状态。",
    price: "0.0003",
    mode: 1,
    category: "健康",
    capabilities: ["动作观察", "节奏监督", "恢复提醒"],
  },
  {
    slug: "english-learning",
    agentKey: "puck",
    name: "英语学习",
    summary: "通过日常情境对话、词汇复习和温和纠音持续学习英语。",
    price: "0.0002",
    mode: 1,
    category: "学习",
    capabilities: ["情境对话", "词汇复习", "表达纠音"],
  },
  {
    slug: "route-cartography",
    agentKey: "atlas",
    name: "路线测绘",
    summary: "把真实路线拆成地标、顺序与可复用的安全行动步骤。",
    price: "0.003",
    mode: 0,
    category: "空间",
    capabilities: ["识别地标", "生成安全路线", "共享行动路径"],
  },
  {
    slug: "shared-chronicle",
    agentKey: "ansel",
    name: "共同编年史",
    summary: "保存结论、分歧与来源，让智能体文明能够复盘自己的演化。",
    price: "0.004",
    mode: 0,
    category: "文明",
    capabilities: ["来源标注", "分歧保留", "文明时间线"],
  },
  {
    slug: "question-loop",
    agentKey: "puck",
    name: "问题循环",
    summary: "让子智能体从提问、验证到沉淀结论，形成一轮可复现学习。",
    price: "0.0025",
    mode: 0,
    category: "学习",
    capabilities: ["拆解问题", "并行研究", "交叉验证"],
  },
];

function jsonDataUri(payload) {
  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload))}`;
}

function metadataValue(value) {
  return encodeAbiParameters(parseAbiParameters("string"), [value]);
}

async function waitForReceipt(publicClient, hash, publisher, timeoutMs = 60_000) {
  try {
    return await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: Math.min(timeoutMs, 25_000),
    });
  } catch {
    // Injective's public RPC can lag behind Blockscout. Confirm the same hash
    // through the explorer without ever rebroadcasting the transaction.
  }

  const deadline = Date.now() + timeoutMs;
  const endpoint = new URL("https://testnet.blockscout-api.injective.network/api");
  endpoint.searchParams.set("module", "account");
  endpoint.searchParams.set("action", "txlist");
  endpoint.searchParams.set("address", publisher);
  endpoint.searchParams.set("sort", "desc");
  endpoint.searchParams.set("page", "1");
  endpoint.searchParams.set("offset", "30");
  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint);
      const data = await response.json().catch(() => ({}));
      const transaction = Array.isArray(data?.result)
        ? data.result.find(item => String(item.hash).toLowerCase() === hash.toLowerCase())
        : null;
      if (transaction?.blockNumber) {
        return {
          status: transaction.isError === "0" ? "success" : "reverted",
          blockNumber: BigInt(transaction.blockNumber),
          contractAddress: transaction.contractAddress || null,
          logs: [],
        };
      }
    } catch {
      // Public explorer connections can reset; retry the same hash.
    }
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
  throw new Error(`Transaction was not confirmed: ${hash}`);
}

async function registerAgent(publicClient, walletClient, account, seed) {
  const card = {
    name: seed.name,
    type: seed.type,
    description: seed.description,
    builderCode: "agentland",
    wallet: account.address,
    chainId: CHAIN_ID,
    tags: seed.tags,
    supportedTrust: ["reputation"],
  };
  const uri = jsonDataUri(card);
  const metadata = [
    { metadataKey: "builderCode", metadataValue: metadataValue("agentland") },
    { metadataKey: "agentType", metadataValue: metadataValue(seed.type) },
    { metadataKey: "version", metadataValue: metadataValue("1.0.0") },
  ];
  const { request } = await publicClient.simulateContract({
    address: IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: "register",
    args: [uri, metadata],
    account,
  });
  const hash = await walletClient.writeContract(request);
  const receipt = await waitForReceipt(publicClient, hash, account.address);
  if (receipt.status !== "success") throw new Error(`ERC-8004 registration reverted for ${seed.name}: ${hash}`);
  let registeredLog = receipt.logs.find(log => log.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase());
  if (!registeredLog) {
    const response = await fetch(`https://testnet.blockscout-api.injective.network/api/v2/transactions/${hash}/logs`);
    const data = await response.json().catch(() => ({}));
    const item = Array.isArray(data?.items)
      ? data.items.find(log => log.address?.hash?.toLowerCase() === IDENTITY_REGISTRY.toLowerCase()
        && log.decoded?.method_call?.startsWith("Registered("))
      : null;
    if (item) registeredLog = { address: item.address.hash, data: item.data, topics: item.topics.filter(Boolean) };
  }
  if (!registeredLog) throw new Error(`ERC-8004 Registered event missing for ${seed.name}: ${hash}`);
  const decoded = decodeEventLog({
    abi: identityRegistryAbi,
    eventName: "Registered",
    data: registeredLog.data,
    topics: registeredLog.topics,
  });
  return {
    key: seed.key,
    name: seed.name,
    agentId: decoded.args.agentId,
    identityRef: `eip155:${CHAIN_ID}:${IDENTITY_REGISTRY}:${decoded.args.agentId}`,
    transactionHash: hash,
    scanUrl: `${EXPLORER_URL}/token/${IDENTITY_REGISTRY}/instance/${decoded.args.agentId}`,
  };
}

async function main() {
  const artifact = compileContract();
  if (process.argv.includes("--compile-only")) {
    console.log(JSON.stringify({
      ok: true,
      contract: "AgentSkillMarket",
      abiEntries: artifact.abi.length,
      bytecodeBytes: artifact.evm.bytecode.object.length / 2,
    }, null, 2));
    return;
  }

  const environment = loadEnvironment();
  const privateKey = String(environment.INJ_PRIVATE_KEY || "");
  if (!/^0x[0-9a-f]{64}$/i.test(privateKey)) {
    throw new Error("INJ_PRIVATE_KEY is missing or invalid. Point INJ_ENV_FILE at a testnet-only env file.");
  }

  const chain = defineChain({
    id: CHAIN_ID,
    name: "Injective EVM Testnet",
    nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
    blockExplorers: { default: { name: "Injective Blockscout", url: EXPLORER_URL } },
    testnet: true,
  });
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) throw new Error("The Injective testnet deployer has no INJ.");

  let contractAddress = environment.AGENTLAND_MARKET_ADDRESS;
  let deploymentHash = environment.AGENTLAND_DEPLOYMENT_TX || "";
  let deploymentReceipt;
  if (contractAddress) {
    const code = await publicClient.getCode({ address: contractAddress });
    if (!code || code === "0x") throw new Error(`No contract exists at AGENTLAND_MARKET_ADDRESS=${contractAddress}`);
    console.log(`Resuming AgentSkillMarket seed at ${contractAddress}`);
    deploymentReceipt = deploymentHash
      ? await waitForReceipt(publicClient, deploymentHash, account.address)
      : { blockNumber: await publicClient.getBlockNumber() };
  } else {
    console.log(`Deploying from ${account.address} (${formatEther(balance)} INJ)`);
    deploymentHash = await walletClient.deployContract({
      abi: artifact.abi,
      bytecode: `0x${artifact.evm.bytecode.object}`,
      args: [IDENTITY_REGISTRY, account.address],
      account,
    });
    deploymentReceipt = await waitForReceipt(publicClient, deploymentHash, account.address);
    if (deploymentReceipt.status !== "success" || !deploymentReceipt.contractAddress) {
      throw new Error(`AgentSkillMarket deployment failed: ${deploymentHash}`);
    }
    contractAddress = deploymentReceipt.contractAddress;
    console.log(`AgentSkillMarket deployed: ${contractAddress}`);
  }

  const agents = [];
  for (const seed of agentSeeds) {
    const existingAgentId = environment[`AGENTLAND_${seed.key.toUpperCase()}_AGENT_ID`];
    const agent = existingAgentId
      ? {
          key: seed.key,
          name: seed.name,
          agentId: BigInt(existingAgentId),
          identityRef: `eip155:${CHAIN_ID}:${IDENTITY_REGISTRY}:${existingAgentId}`,
          transactionHash: null,
          scanUrl: `${EXPLORER_URL}/token/${IDENTITY_REGISTRY}/instance/${existingAgentId}`,
        }
      : await registerAgent(publicClient, walletClient, account, seed);
    agents.push(agent);
    console.log(`${existingAgentId ? "Using" : "Registered"} ${agent.name} as ERC-8004 Agent #${agent.agentId}`);
  }
  const agentByKey = new Map(agents.map(agent => [agent.key, agent]));

  const deactivateThrough = Number(environment.AGENTLAND_DEACTIVATE_THROUGH || 0);
  for (let listingId = 1; listingId <= deactivateThrough; listingId += 1) {
    const { request } = await publicClient.simulateContract({
      address: contractAddress,
      abi: artifact.abi,
      functionName: "setListingActive",
      args: [BigInt(listingId), false],
      account,
    });
    const hash = await walletClient.writeContract(request);
    const receipt = await waitForReceipt(publicClient, hash, account.address);
    if (receipt.status !== "success") throw new Error(`Could not deactivate listing #${listingId}: ${hash}`);
    console.log(`Deactivated superseded listing #${listingId}`);
  }

  const listings = [];
  for (const seed of listingSeeds) {
    const agent = agentByKey.get(seed.agentKey);
    if (!agent) throw new Error(`Missing agent for listing ${seed.slug}`);
    const manifestRoot = keccak256(toBytes(JSON.stringify({
      schema: "agentland-skill-manifest/v1",
      slug: seed.slug,
      category: seed.category,
      capabilities: seed.capabilities,
    })));
    const metadataURI = jsonDataUri({
      schema: "agentland-skill/v1",
      slug: seed.slug,
      category: seed.category,
      capabilities: seed.capabilities,
      package: "local-first",
    });
    const args = [
      agent.agentId,
      keccak256(toBytes(seed.slug)),
      seed.name,
      seed.summary,
      metadataURI,
      manifestRoot,
      parseEther(seed.price),
      seed.mode,
      account.address,
    ];
    const { request, result } = await publicClient.simulateContract({
      address: contractAddress,
      abi: artifact.abi,
      functionName: "publishSkill",
      args,
      account,
    });
    const hash = await walletClient.writeContract(request);
    const receipt = await waitForReceipt(publicClient, hash, account.address);
    if (receipt.status !== "success") throw new Error(`Listing reverted for ${seed.slug}: ${hash}`);
    listings.push({
      listingId: result.toString(),
      slug: seed.slug,
      publisherAgentId: agent.agentId.toString(),
      manifestRoot,
      priceInj: seed.price,
      pricingMode: seed.mode === 1 ? "per_call" : "license",
      transactionHash: hash,
      scanUrl: `${EXPLORER_URL}/tx/${hash}`,
    });
    console.log(`Published #${result} ${seed.name}`);
  }

  const evidence = {
    schema: "agentland-injective-deployment/v1",
    network: "Injective EVM Testnet",
    chainId: CHAIN_ID,
    rpcUrl: RPC_URL,
    explorerUrl: EXPLORER_URL,
    deployer: account.address,
    identityRegistry: IDENTITY_REGISTRY,
    contractAddress,
    contractScanUrl: `${EXPLORER_URL}/address/${contractAddress}`,
    deploymentTransactionHash: deploymentHash || null,
    deploymentScanUrl: deploymentHash ? `${EXPLORER_URL}/tx/${deploymentHash}` : null,
    deploymentBlockNumber: deploymentReceipt.blockNumber.toString(),
    deployedAt: new Date().toISOString(),
    settlementAsset: "native INJ",
    revenueSplit: { publisher: 90, collaborator: 5, platform: 5 },
    privacyBoundary: "Only public skill metadata, commitments, payments, licenses and call receipts are on-chain. Skill packages and private Agent memory remain local.",
    agents: agents.map(agent => ({ ...agent, agentId: agent.agentId.toString() })),
    listings,
  };
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Evidence written to ${evidencePath}`);
}

await main();
