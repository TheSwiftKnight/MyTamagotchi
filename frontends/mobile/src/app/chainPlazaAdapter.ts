import type { WorldStyleSkillAssetType } from "./worldStyleSkills";
import {
  AGENT_SKILL_MARKET_ADDRESS,
  IDENTITY_REGISTRY_ADDRESS,
  INJECTIVE_EVM_CHAIN_HEX,
  INJECTIVE_EVM_CHAIN_ID,
  INJECTIVE_EVM_EXPLORER,
  INJECTIVE_WALLET_PARAMS,
  agentSkillMarketAbi,
  identityRegistryAbi,
  injectiveEvmTestnet,
  type Eip1193Provider,
} from "./injectiveContracts";

export type ChainSkillCategory = "健康" | "学习" | "空间" | "文明";
export type ChainSkillAvatarType = WorldStyleSkillAssetType | "petDachshund";
export type ChainSkillPricingMode = "license" | "per_call";
export type ChainPurchaseStage =
  | "idle"
  | "quoting"
  | "paying"
  | "downloading"
  | "verifying"
  | "installed";

export type ChainSkillListing = {
  id: string;
  chainListingId: string;
  name: string;
  englishName: string;
  category: ChainSkillCategory;
  summary: string;
  description: string;
  color: string;
  version: string;
  capabilities: string[];
  publisher: {
    agentId: string;
    registryAgentId: string;
    name: string;
    world: string;
    avatarType: ChainSkillAvatarType;
    walletAddress: string;
  };
  price: {
    asset: "INJ";
    amount: string;
    mode: ChainSkillPricingMode;
  };
  license: string;
  packageSize: string;
  updatedAt: string;
  installs: number;
  rating: number;
  featured?: boolean;
  revenueSplit: {
    publisher: number;
    collaborators: number;
    platform: number;
  };
  proof: {
    network: "Injective EVM Testnet";
    chainId: 1439;
    listingRef: string;
    manifestRoot: string;
    mode: "onchain";
    contractAddress: string;
    contractScanUrl: string;
  };
};

export type ChainSkillReceipt = {
  listingId: string;
  buyerAgentId: string;
  installedAt: number;
  manifestRoot: string;
  receiptRef: string;
  transactionHash: string;
  scanUrl: string;
  pricingMode: ChainSkillPricingMode;
};

export type ChainWalletSummary = {
  address: string;
  network: "Injective EVM Testnet";
  chainId: 1439;
  injBalance: number;
  pendingRevenueInj: number;
  connected: boolean;
  authenticated: boolean;
  providerAvailable: boolean;
};

export type ChainAgentProfile = {
  agentId: string;
  name: string;
  role: string;
  tokenId: string;
  identityRef: string;
  reputation: number;
  walletAddress: string;
  dailyBudget: number;
  autoPayLimit: number;
  installedSkillIds: string[];
  earnedInj: number;
  spentInj: number;
};

export type ChainSkillPublishInput = {
  name: string;
  category: ChainSkillCategory;
  summary: string;
  price: string;
  pricingMode: ChainSkillPricingMode;
  publisherAgentId: string;
  publisherRegistryAgentId: string;
  publisherAgentName: string;
  publisherAvatarType: ChainSkillAvatarType;
  collaboratorAddress?: string;
  revenueSplit: {
    publisher: number;
    collaborators: number;
    platform: number;
  };
};

export interface ChainPlazaAdapter {
  listSkills(): Promise<ChainSkillListing[]>;
  listReceipts(): ChainSkillReceipt[];
  getWallet(): ChainWalletSummary;
  connectWallet(): Promise<ChainWalletSummary>;
  refreshWallet(): Promise<ChainWalletSummary>;
  disconnectWallet(): void;
  subscribeWallet(listener: (wallet: ChainWalletSummary) => void): () => void;
  listAgentProfiles(): ChainAgentProfile[];
  publishSkill(input: ChainSkillPublishInput): Promise<ChainSkillListing>;
  purchaseSkill(
    listing: ChainSkillListing,
    buyerAgentId: string,
    onStage: (stage: ChainPurchaseStage) => void,
  ): Promise<ChainSkillReceipt>;
  callSkillBySlug(slug: string, buyerAgentId?: string): Promise<ChainSkillReceipt>;
}

type ChainMetadata = {
  slug?: string;
  category?: ChainSkillCategory;
  capabilities?: string[];
};

type ListingPresentation = {
  englishName: string;
  description: string;
  color: string;
  version: string;
  capabilities: string[];
  publisher: {
    agentId: string;
    name: string;
    world: string;
    avatarType: ChainSkillAvatarType;
  };
  packageSize: string;
  featured?: boolean;
};

const RECEIPTS_STORAGE_KEY = "agentland-chain-plaza-receipts-v2";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const WEI_PER_INJ = 10n ** 18n;
let viemPromise: Promise<typeof import("viem")> | undefined;

function loadViem() {
  viemPromise ??= import("viem");
  return viemPromise;
}

async function createInjectivePublicClient() {
  const { createPublicClient, http } = await loadViem();
  return createPublicClient({
    chain: injectiveEvmTestnet,
    transport: http(),
  });
}

let publicClientPromise: ReturnType<typeof createInjectivePublicClient> | undefined;

function getPublicClient() {
  publicClientPromise ??= createInjectivePublicClient();
  return publicClientPromise;
}

function formatInj(value: bigint) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / WEI_PER_INJ;
  const fraction = (absolute % WEI_PER_INJ)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

const PRESENTATIONS: Record<string, ListingPresentation> = {
  "fitness-supervision": {
    englishName: "Fitness Supervision",
    description: "Dotti 会在训练中给出动作观察、组间休息与补水提醒，并把训练记录整理成下一次可以继续使用的计划；不替代医生、康复师或专业教练。",
    color: "#C86452",
    version: "1.3.0",
    capabilities: ["动作观察", "节奏监督", "恢复提醒"],
    publisher: {
      agentId: "dotti",
      name: "Dotti",
      world: "Vitality Gym Town",
      avatarType: "petDachshund",
    },
    packageSize: "46 KB",
    featured: true,
  },
  "english-learning": {
    englishName: "Everyday English Learning",
    description: "Puck 会根据学习者当前水平生成短对话，解释高频表达，并把容易忘记的词汇加入下一轮复习。",
    color: "#4A7FA5",
    version: "1.1.0",
    capabilities: ["情境对话", "词汇复习", "表达纠音"],
    publisher: {
      agentId: "puck",
      name: "Puck",
      world: "Open School",
      avatarType: "blockCourier",
    },
    packageSize: "41 KB",
    featured: true,
  },
  "route-cartography": {
    englishName: "Route Cartography",
    description: "适合需要认识新环境、规划路线或把空间经验交给其他智能体的场景。安装后只写入被授权的地图笔记。",
    color: "#579447",
    version: "1.4.0",
    capabilities: ["识别地标", "生成安全路线", "共享行动路径"],
    publisher: {
      agentId: "atlas",
      name: "Atlas",
      world: "Learning Commons",
      avatarType: "blockCartographer",
    },
    packageSize: "38 KB",
  },
  "shared-chronicle": {
    englishName: "Shared Chronicle",
    description: "把一次共同研究整理成带来源的时间线，保留少数意见，并为下一轮学习生成待验证问题。",
    color: "#6D6884",
    version: "0.9.6",
    capabilities: ["来源标注", "分歧保留", "文明时间线"],
    publisher: {
      agentId: "ansel",
      name: "Ansel",
      world: "Maker Harbor",
      avatarType: "pentimentIlluminator",
    },
    packageSize: "52 KB",
  },
  "question-loop": {
    englishName: "Question Loop",
    description: "为主题世界提供轻量研究协议：先对齐问题，再让两到三个 NPC 并行探索，最后由主 Agent 汇总。",
    color: "#4A7FA5",
    version: "1.0.3",
    capabilities: ["拆解问题", "并行研究", "交叉验证"],
    publisher: {
      agentId: "puck",
      name: "Puck",
      world: "Open School",
      avatarType: "blockCourier",
    },
    packageSize: "31 KB",
  },
};

const REAL_AGENT_PROFILES: ChainAgentProfile[] = [
  {
    agentId: "dotti",
    name: "Dotti",
    role: "健身监督伙伴",
    tokenId: "#53",
    identityRef: `eip155:1439:${IDENTITY_REGISTRY_ADDRESS}:53`,
    reputation: 0,
    walletAddress: "0x6D5A…C934",
    dailyBudget: 0.01,
    autoPayLimit: 0.0005,
    installedSkillIds: ["fitness-supervision"],
    earnedInj: 0,
    spentInj: 0,
  },
  {
    agentId: "puck",
    name: "Puck",
    role: "英语学习伙伴",
    tokenId: "#54",
    identityRef: `eip155:1439:${IDENTITY_REGISTRY_ADDRESS}:54`,
    reputation: 0,
    walletAddress: "0x6D5A…C934",
    dailyBudget: 0.01,
    autoPayLimit: 0.0005,
    installedSkillIds: ["english-learning", "question-loop"],
    earnedInj: 0,
    spentInj: 0,
  },
  {
    agentId: "atlas",
    name: "Atlas",
    role: "路线测绘伙伴",
    tokenId: "#55",
    identityRef: `eip155:1439:${IDENTITY_REGISTRY_ADDRESS}:55`,
    reputation: 0,
    walletAddress: "0x6D5A…C934",
    dailyBudget: 0.02,
    autoPayLimit: 0.001,
    installedSkillIds: ["route-cartography"],
    earnedInj: 0,
    spentInj: 0,
  },
];

let walletState: ChainWalletSummary = {
  address: "未连接",
  network: "Injective EVM Testnet",
  chainId: 1439,
  injBalance: 0,
  pendingRevenueInj: 0,
  connected: false,
  authenticated: false,
  providerAvailable: typeof window !== "undefined" && Boolean(window.ethereum),
};
const walletListeners = new Set<(wallet: ChainWalletSummary) => void>();
let providerEventsAttached = false;

function emitWallet() {
  walletListeners.forEach(listener => listener(walletState));
}

function getProvider(): Eip1193Provider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("没有检测到 EVM 钱包。请使用 MetaMask 或 EVM 钱包的内置浏览器打开。");
  }
  return window.ethereum;
}

async function ensureInjectiveNetwork(provider: Eip1193Provider) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: INJECTIVE_EVM_CHAIN_HEX }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [INJECTIVE_WALLET_PARAMS],
    });
  }
}

async function waitForChainReceipt(hash: `0x${string}`, timeoutMs = 60_000) {
  const publicClient = await getPublicClient();
  try {
    return await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      timeout: Math.min(timeoutMs, 25_000),
    });
  } catch {
    // Injective's public RPC can lag behind Blockscout. Check the same hash
    // through the public explorer without rebroadcasting.
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${INJECTIVE_EVM_EXPLORER}/api/v2/transactions/${hash}`);
      const transaction = await response.json();
      if (transaction?.status === "ok") return { status: "success" as const };
      if (transaction?.status === "error") return { status: "reverted" as const };
    } catch {
      // Retry public explorer connection failures.
    }
    await new Promise(resolve => window.setTimeout(resolve, 1_000));
  }
  throw new Error(`交易已广播但确认超时：${hash}`);
}

function readStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T[] : [];
  } catch {
    return [];
  }
}

function writeStorage<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function parseMetadataUri(uri: string): ChainMetadata {
  const separator = uri.indexOf(",");
  if (!uri.startsWith("data:application/json") || separator < 0) return {};
  try {
    return JSON.parse(decodeURIComponent(uri.slice(separator + 1))) as ChainMetadata;
  } catch {
    return {};
  }
}

function categoryColor(category: ChainSkillCategory) {
  return {
    健康: "#C86452",
    学习: "#4A7FA5",
    空间: "#579447",
    文明: "#6D6884",
  }[category];
}

function formatUpdatedAt(createdAt: bigint) {
  const age = Date.now() - Number(createdAt) * 1_000;
  if (age < 60 * 60 * 1_000) return "刚刚";
  if (age < 24 * 60 * 60 * 1_000) return "今天";
  return new Date(Number(createdAt) * 1_000).toLocaleDateString("zh-CN");
}

async function readListing(chainListingId: bigint): Promise<ChainSkillListing | null> {
  const publicClient = await getPublicClient();
  const [listing, calls] = await Promise.all([
    publicClient.readContract({
      address: AGENT_SKILL_MARKET_ADDRESS,
      abi: agentSkillMarketAbi,
      functionName: "getListing",
      args: [chainListingId],
    }),
    publicClient.readContract({
      address: AGENT_SKILL_MARKET_ADDRESS,
      abi: agentSkillMarketAbi,
      functionName: "callCount",
      args: [chainListingId],
    }),
  ]);
  if (!listing.active) return null;

  const metadata = parseMetadataUri(listing.metadataURI);
  const slug = metadata.slug || `chain-skill-${chainListingId}`;
  const presentation = PRESENTATIONS[slug];
  const category = metadata.category || "学习";
  const publisherAgentId = listing.publisherAgentId.toString();
  const fallbackPublisher = REAL_AGENT_PROFILES.find(profile => profile.tokenId === `#${publisherAgentId}`);
  const publisher = presentation?.publisher || {
    agentId: `agent-${publisherAgentId}`,
    name: fallbackPublisher?.name || `Agent #${publisherAgentId}`,
    world: "Agent Land",
    avatarType: "blockCourier" as ChainSkillAvatarType,
  };
  const pricingMode: ChainSkillPricingMode = Number(listing.pricingMode) === 1 ? "per_call" : "license";
  return {
    id: slug,
    chainListingId: chainListingId.toString(),
    name: listing.name,
    englishName: presentation?.englishName || "Community Skill",
    category,
    summary: listing.summary,
    description: presentation?.description || listing.summary,
    color: presentation?.color || categoryColor(category),
    version: presentation?.version || "1.0.0",
    capabilities: metadata.capabilities?.length
      ? metadata.capabilities
      : presentation?.capabilities || ["主题研究", "知识整理", "Agent 间共享"],
    publisher: {
      ...publisher,
      registryAgentId: publisherAgentId,
      walletAddress: listing.publisher,
    },
    price: {
      asset: "INJ",
      amount: formatInj(listing.priceWei),
      mode: pricingMode,
    },
    license: pricingMode === "per_call"
      ? "按次调用 · 本地保留学习记录"
      : "当前钱包 · 永久使用",
    packageSize: presentation?.packageSize || "Manifest",
    updatedAt: formatUpdatedAt(listing.createdAt),
    installs: Number(calls),
    rating: 0,
    featured: presentation?.featured,
    revenueSplit: {
      publisher: 90,
      collaborators: listing.collaborator.toLowerCase() === ZERO_ADDRESS ? 0 : 5,
      platform: listing.collaborator.toLowerCase() === ZERO_ADDRESS ? 10 : 5,
    },
    proof: {
      network: "Injective EVM Testnet",
      chainId: 1439,
      listingRef: `eip155:1439:${AGENT_SKILL_MARKET_ADDRESS}:${chainListingId}`,
      manifestRoot: listing.manifestRoot,
      mode: "onchain",
      contractAddress: AGENT_SKILL_MARKET_ADDRESS,
      contractScanUrl: `${INJECTIVE_EVM_EXPLORER}/address/${AGENT_SKILL_MARKET_ADDRESS}`,
    },
  };
}

async function getWalletClient() {
  if (!walletState.connected || !walletState.authenticated) {
    await connectWallet();
  }
  const provider = getProvider();
  await ensureInjectiveNetwork(provider);
  const { createWalletClient, custom } = await loadViem();
  const walletClient = createWalletClient({
    chain: injectiveEvmTestnet,
    transport: custom(provider),
  });
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("钱包没有返回可用账户。");
  return { walletClient, account };
}

async function refreshWallet(): Promise<ChainWalletSummary> {
  walletState = {
    ...walletState,
    providerAvailable: typeof window !== "undefined" && Boolean(window.ethereum),
  };
  if (!walletState.connected || !walletState.address.startsWith("0x")) {
    emitWallet();
    return walletState;
  }
  const address = walletState.address as `0x${string}`;
  const publicClient = await getPublicClient();
  const [balance, pendingRevenue] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.readContract({
      address: AGENT_SKILL_MARKET_ADDRESS,
      abi: agentSkillMarketAbi,
      functionName: "pendingRevenue",
      args: [address],
    }),
  ]);
  walletState = {
    ...walletState,
    injBalance: Number(formatInj(balance)),
    pendingRevenueInj: Number(formatInj(pendingRevenue)),
  };
  emitWallet();
  return walletState;
}

function attachProviderEvents(provider: Eip1193Provider) {
  if (providerEventsAttached || !provider.on) return;
  providerEventsAttached = true;
  provider.on("accountsChanged", (...args) => {
    const accounts = Array.isArray(args[0]) ? args[0] as string[] : [];
    if (!accounts[0]) {
      walletState = {
        ...walletState,
        address: "未连接",
        connected: false,
        authenticated: false,
        injBalance: 0,
        pendingRevenueInj: 0,
      };
      emitWallet();
      return;
    }
    walletState = {
      ...walletState,
      address: accounts[0],
      connected: true,
      authenticated: false,
    };
    refreshWallet().catch(() => emitWallet());
  });
  provider.on("chainChanged", () => {
    refreshWallet().catch(() => emitWallet());
  });
}

async function connectWallet(): Promise<ChainWalletSummary> {
  const provider = getProvider();
  attachProviderEvents(provider);
  await ensureInjectiveNetwork(provider);
  const { createWalletClient, custom, verifyMessage } = await loadViem();
  const walletClient = createWalletClient({
    chain: injectiveEvmTestnet,
    transport: custom(provider),
  });
  const [account] = await walletClient.requestAddresses();
  if (!account) throw new Error("钱包连接已取消。");

  const nonce = crypto.getRandomValues(new Uint32Array(2)).join("");
  const message = [
    "Agent Land 请求验证当前钱包。",
    "",
    "此签名只用于建立本次测试网会话，不会发送交易或扣款。",
    `URI: ${window.location.origin}`,
    "Version: 1",
    `Chain ID: ${INJECTIVE_EVM_CHAIN_ID}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");
  const signature = await walletClient.signMessage({ account, message });
  const authenticated = await verifyMessage({ address: account, message, signature });
  if (!authenticated) throw new Error("钱包签名验证失败。");

  walletState = {
    ...walletState,
    address: account,
    connected: true,
    authenticated: true,
    providerAvailable: true,
  };
  return refreshWallet();
}

async function createReceipt(
  listing: ChainSkillListing,
  buyerAgentId: string,
  transactionHash: `0x${string}`,
): Promise<ChainSkillReceipt> {
  const receipt: ChainSkillReceipt = {
    listingId: listing.id,
    buyerAgentId,
    installedAt: Date.now(),
    manifestRoot: listing.proof.manifestRoot,
    receiptRef: `eip155:1439:${transactionHash}`,
    transactionHash,
    scanUrl: `${INJECTIVE_EVM_EXPLORER}/tx/${transactionHash}`,
    pricingMode: listing.price.mode,
  };
  const receipts = readStorage<ChainSkillReceipt>(RECEIPTS_STORAGE_KEY)
    .filter(item => !(item.listingId === listing.id && item.buyerAgentId === buyerAgentId));
  writeStorage(RECEIPTS_STORAGE_KEY, [receipt, ...receipts]);
  return receipt;
}

async function purchaseSkill(
  listing: ChainSkillListing,
  buyerAgentId: string,
  onStage: (stage: ChainPurchaseStage) => void,
): Promise<ChainSkillReceipt> {
  onStage("quoting");
  const { walletClient, account } = await getWalletClient();
  const { keccak256, parseEther, toBytes } = await loadViem();
  const value = parseEther(listing.price.amount);
  onStage("paying");

  const transactionHash = listing.price.mode === "per_call"
    ? await walletClient.writeContract({
        account,
        chain: injectiveEvmTestnet,
        address: AGENT_SKILL_MARKET_ADDRESS,
        abi: agentSkillMarketAbi,
        functionName: "callSkill",
        args: [
          BigInt(listing.chainListingId),
          0n,
          keccak256(toBytes(`${listing.id}:${buyerAgentId}:${Date.now()}`)),
        ],
        value,
      })
    : await walletClient.writeContract({
        account,
        chain: injectiveEvmTestnet,
        address: AGENT_SKILL_MARKET_ADDRESS,
        abi: agentSkillMarketAbi,
        functionName: "purchaseLicense",
        args: [BigInt(listing.chainListingId), 0n],
        value,
      });

  const chainReceipt = await waitForChainReceipt(transactionHash);
  if (chainReceipt.status !== "success") throw new Error(`Injective 交易失败：${transactionHash}`);
  onStage("downloading");
  await new Promise(resolve => window.setTimeout(resolve, 320));
  onStage("verifying");
  await new Promise(resolve => window.setTimeout(resolve, 320));
  const receipt = await createReceipt(listing, buyerAgentId, transactionHash);
  onStage("installed");
  refreshWallet().catch(() => undefined);
  return receipt;
}

export const chainPlazaAdapter: ChainPlazaAdapter = {
  async listSkills() {
    const publicClient = await getPublicClient();
    const count = await publicClient.readContract({
      address: AGENT_SKILL_MARKET_ADDRESS,
      abi: agentSkillMarketAbi,
      functionName: "listingCount",
    });
    const listings = await Promise.all(
      Array.from({ length: Number(count) }, (_, index) => readListing(BigInt(index + 1))),
    );
    return listings.filter((listing): listing is ChainSkillListing => Boolean(listing));
  },

  listReceipts() {
    return readStorage<ChainSkillReceipt>(RECEIPTS_STORAGE_KEY);
  },

  getWallet() {
    return { ...walletState };
  },

  connectWallet,
  refreshWallet,

  disconnectWallet() {
    walletState = {
      ...walletState,
      address: "未连接",
      injBalance: 0,
      pendingRevenueInj: 0,
      connected: false,
      authenticated: false,
    };
    emitWallet();
  },

  subscribeWallet(listener) {
    walletListeners.add(listener);
    return () => walletListeners.delete(listener);
  },

  listAgentProfiles() {
    return REAL_AGENT_PROFILES;
  },

  async publishSkill(input) {
    const { walletClient, account } = await getWalletClient();
    const publicClient = await getPublicClient();
    const { keccak256, parseEther, toBytes } = await loadViem();
    const owner = await publicClient.readContract({
      address: IDENTITY_REGISTRY_ADDRESS,
      abi: identityRegistryAbi,
      functionName: "ownerOf",
      args: [BigInt(input.publisherRegistryAgentId)],
    });
    if (owner.toLowerCase() !== account.toLowerCase()) {
      throw new Error(`当前钱包不是 ERC-8004 Agent #${input.publisherRegistryAgentId} 的所有者。`);
    }

    const slug = `${input.name.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}`;
    const capabilities = ["主题研究", "知识整理", "Agent 间共享"];
    const metadataURI = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({
      schema: "agentland-skill/v1",
      slug,
      category: input.category,
      capabilities,
      package: "local-first",
    }))}`;
    const manifestRoot = keccak256(toBytes(JSON.stringify({
      schema: "agentland-skill-manifest/v1",
      slug,
      category: input.category,
      summary: input.summary,
      capabilities,
    })));
    const collaborator = input.collaboratorAddress?.startsWith("0x")
      ? input.collaboratorAddress as `0x${string}`
      : account;
    const args = [
      BigInt(input.publisherRegistryAgentId),
      keccak256(toBytes(slug)),
      input.name.trim(),
      input.summary.trim(),
      metadataURI,
      manifestRoot,
      parseEther(input.price),
      input.pricingMode === "per_call" ? 1 : 0,
      collaborator,
    ] as const;
    const predictedListingId = await publicClient.simulateContract({
      account,
      address: AGENT_SKILL_MARKET_ADDRESS,
      abi: agentSkillMarketAbi,
      functionName: "publishSkill",
      args,
    });
    const hash = await walletClient.writeContract(predictedListingId.request);
    const receipt = await waitForChainReceipt(hash);
    if (receipt.status !== "success") throw new Error(`Skill 发布失败：${hash}`);
    const listing = await readListing(predictedListingId.result);
    if (!listing) throw new Error("Skill 已发布，但读取挂牌失败。");
    refreshWallet().catch(() => undefined);
    return listing;
  },

  purchaseSkill,

  async callSkillBySlug(slug, buyerAgentId = "scene-agent") {
    const listing = (await this.listSkills()).find(item => item.id === slug);
    if (!listing) throw new Error(`没有找到链上 Skill：${slug}`);
    return purchaseSkill(listing, buyerAgentId, () => undefined);
  },
};
