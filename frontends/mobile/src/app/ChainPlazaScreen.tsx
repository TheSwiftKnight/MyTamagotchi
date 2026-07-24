import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Check,
  ChevronRight,
  Coins,
  Download,
  FileCheck2,
  History,
  Loader2,
  PackageCheck,
  Plus,
  Radio,
  ShieldCheck,
  Sparkles,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import {
  chainPlazaAdapter,
  type ChainPurchaseStage,
  type ChainSkillReceipt,
  type ChainWalletSummary,
  type ChainSkillAvatarType,
  type ChainSkillCategory,
  type ChainSkillListing,
  type ChainSkillPublishInput,
} from "./chainPlazaAdapter";
import {
  WORLD_STYLE_SKILL_ASSETS,
} from "./worldStyleSkills";
import petDachshundPng from "../assets/world/pet-agents/sprites/dachshund.png";

const FONT = "'Fusion Pixel 10px Monospaced SC',sans-serif";
const INK = "#1C1911";
const MUTED = "#7A7468";
const PAPER = "#F5F0E8";
const CHAIN_ACCENT = "#6D6884";
const CATEGORIES: Array<"全部" | ChainSkillCategory> = ["全部", "健康", "学习", "空间", "文明"];

const PUBLISHERS: {
  id: string;
  name: string;
  registryAgentId: string;
  avatarType: ChainSkillAvatarType;
}[] = [
  { id: "dotti", name: "Dotti", registryAgentId: "53", avatarType: "petDachshund" },
  { id: "puck", name: "Puck", registryAgentId: "54", avatarType: "blockCourier" },
  { id: "atlas", name: "Atlas", registryAgentId: "55", avatarType: "blockCartographer" },
];

const BUYER_AGENTS = [
  { id: "miko", name: "Miko" },
  { id: "shutter", name: "Shutter" },
  { id: "luna", name: "Luna" },
];

const PURCHASE_STEPS: { stage: Exclude<ChainPurchaseStage, "idle">; label: string }[] = [
  { stage: "quoting", label: "生成报价" },
  { stage: "paying", label: "确认支付" },
  { stage: "downloading", label: "下载 Package" },
  { stage: "verifying", label: "校验 Manifest" },
  { stage: "installed", label: "安装完成" },
];

function SkillAvatar({ type, size = 62 }: { type: ChainSkillAvatarType; size?: number }) {
  if (type === "petDachshund") {
    return (
      <img
        src={petDachshundPng}
        alt="腊肠犬 Dotti"
        draggable={false}
        style={{ width: size, height: size, display: "block", objectFit: "contain" }}
      />
    );
  }
  const asset = WORLD_STYLE_SKILL_ASSETS.find(item => item.type === type);
  if (!asset) return null;
  return (
    <img
      src={asset.src}
      alt={asset.alt}
      draggable={false}
      style={{
        width: size,
        height: size,
        display: "block",
        objectFit: "contain",
        imageRendering: asset.category === "blockcraft" ? "pixelated" : "auto",
      }}
    />
  );
}

function PreviewBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1"
      style={{
        color: CHAIN_ACCENT,
        background: "rgba(109,104,132,.1)",
        border: "1px solid rgba(109,104,132,.2)",
        fontSize: "var(--ui-font-micro)",
        fontFamily: FONT,
      }}
    >
      <Radio size={10} />
      LIVE TESTNET
    </span>
  );
}

function PriceLabel({ listing }: { listing: ChainSkillListing }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap" }}>
      <strong style={{ color: INK, fontSize: 14 }}>{listing.price.amount}</strong>
      <span style={{ color: listing.color, fontSize: "var(--ui-font-caption)", fontWeight: 700 }}>
        {listing.price.asset}
      </span>
      <span style={{ color: MUTED, fontSize: "var(--ui-font-micro)" }}>
        /{listing.price.mode === "per_call" ? "次" : "授权"}
      </span>
    </span>
  );
}

function ChainSkillCard({
  listing,
  installed,
  onOpen,
}: {
  listing: ChainSkillListing;
  installed: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[22px] p-4 text-left"
      style={{
        background: "#FAF6EF",
        border: `1.5px solid ${listing.featured ? listing.color : "rgba(28,25,17,.12)"}`,
        boxShadow: listing.featured ? `0 8px 22px ${listing.color}14` : "0 4px 14px rgba(28,25,17,.04)",
        fontFamily: FONT,
      }}
    >
      <span className="flex items-start gap-3">
        <span
          className="flex shrink-0 items-center justify-center rounded-2xl"
          style={{
            width: 68,
            height: 68,
            background: `${listing.color}0D`,
            border: `1px solid ${listing.color}24`,
          }}
        >
          <SkillAvatar type={listing.publisher.avatarType} size={58} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span
              className="rounded-full px-2 py-1"
              style={{ color: listing.color, background: `${listing.color}10`, fontSize: "var(--ui-font-micro)" }}
            >
              {listing.category} · v{listing.version}
            </span>
            {installed ? (
              <span className="inline-flex items-center gap-1" style={{ color: "#579447", fontSize: "var(--ui-font-micro)" }}>
                <PackageCheck size={11} />已在本地
              </span>
            ) : (
              <ChevronRight size={15} color={MUTED} />
            )}
          </span>
          <strong className="mt-2 block truncate" style={{ color: INK, fontSize: "var(--ui-font-section)" }}>
            {listing.name}
          </strong>
          <span className="mt-1 block truncate" style={{ color: MUTED, fontSize: "var(--ui-font-caption)" }}>
            by {listing.publisher.name} · {listing.publisher.world}
          </span>
          <span className="mt-1.5 inline-flex items-center gap-1" style={{ color: "#579447", fontSize: "var(--ui-font-micro)" }}>
            <BadgeCheck size={10}/>ERC-8004 · {listing.price.mode === "per_call" ? "合约按次" : "链上 License"}
          </span>
        </span>
      </span>
      <span
        className="mt-3 block"
        style={{ color: "#5F594F", fontSize: "var(--ui-font-body)", lineHeight: 1.55 }}
      >
        {listing.summary}
      </span>
      <span className="mt-3 flex items-end justify-between gap-3">
        <span className="flex min-w-0 flex-wrap gap-1.5">
          {listing.capabilities.slice(0, 2).map(capability => (
            <span
              key={capability}
              className="rounded-full px-2 py-1"
              style={{
                color: MUTED,
                background: "rgba(28,25,17,.045)",
                fontSize: "var(--ui-font-micro)",
              }}
            >
              {capability}
            </span>
          ))}
        </span>
        <PriceLabel listing={listing} />
      </span>
    </button>
  );
}

function PanelShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{ background: "rgba(28,25,17,.32)", backdropFilter: "blur(2px)" }}
    >
      <div
        className="max-h-[86%] w-full overflow-y-auto rounded-t-[28px] px-5 pb-8 pt-4"
        onClick={event => event.stopPropagation()}
        style={{
          background: "#FAF6EF",
          borderTop: "1px solid rgba(28,25,17,.12)",
          boxShadow: "0 -18px 50px rgba(28,25,17,.16)",
          fontFamily: FONT,
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="h-1 w-12 rounded-full" style={{ background: "rgba(28,25,17,.16)" }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ border: "1px solid rgba(28,25,17,.1)", background: PAPER }}
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function WalletPanel({
  wallet,
  receiptCount,
  connecting,
  error,
  onConnect,
  onDisconnect,
  onClose,
}: {
  wallet: ChainWalletSummary;
  receiptCount: number;
  connecting: boolean;
  error: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  return (
    <PanelShell title="Injective 钱包" onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <PreviewBadge />
          <h2 className="mt-3" style={{ color: INK, fontSize: "var(--ui-font-heading)" }}>Agent Land Wallet</h2>
          <p className="mt-1" style={{ color: MUTED, fontSize: "var(--ui-font-caption)", wordBreak: "break-all" }}>{wallet.address}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-1"
          style={{
            color: wallet.authenticated ? "#579447" : MUTED,
            background: wallet.authenticated ? "rgba(87,148,71,.1)" : "rgba(28,25,17,.06)",
            fontSize: "var(--ui-font-micro)",
          }}>
          {wallet.authenticated ? <><Check size={10}/>签名已验证</> : "未连接"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl p-4" style={{ color: "#FAF6EF", background: "#1C1911" }}>
          <span style={{ color: "#AFA89B", fontSize: "var(--ui-font-micro)" }}>WALLET BALANCE</span>
          <strong className="mt-3 block" style={{ fontSize: 25 }}>{wallet.injBalance.toFixed(4)}</strong>
          <small style={{ color: "#B9D6C0" }}>INJ</small>
        </div>
        <div className="rounded-2xl p-4" style={{ background: PAPER, border: "1px solid rgba(28,25,17,.1)" }}>
          <span style={{ color: MUTED, fontSize: "var(--ui-font-micro)" }}>CLAIMABLE</span>
          <strong className="mt-3 block" style={{ color: INK, fontSize: 25 }}>{wallet.pendingRevenueInj.toFixed(4)}</strong>
          <small style={{ color: CHAIN_ACCENT }}>INJ 收益</small>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl px-3 py-2.5" role="alert"
          style={{ color: "#A24E42", background: "rgba(200,100,82,.08)", fontSize: "var(--ui-font-micro)", lineHeight: 1.5 }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={wallet.connected ? onDisconnect : onConnect}
        disabled={connecting}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3"
        style={{
          color: "white",
          background: wallet.connected ? "#7A7468" : CHAIN_ACCENT,
          opacity: connecting ? .6 : 1,
          fontSize: "var(--ui-font-caption)",
        }}
      >
        {connecting ? <Loader2 size={14} className="animate-spin"/> : <WalletCards size={14}/>}
        {connecting ? "等待钱包签名…" : wallet.connected ? "断开本地会话" : "连接钱包并签名"}
      </button>

      <div className="mt-4 rounded-2xl p-3" style={{ background: PAPER, border: "1px solid rgba(28,25,17,.1)" }}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5" style={{ color: INK, fontSize: "var(--ui-font-caption)" }}>
            <History size={13} color={CHAIN_ACCENT}/>本地链上收据
          </span>
          <strong style={{ color: CHAIN_ACCENT, fontSize: "var(--ui-font-caption)" }}>{receiptCount}</strong>
        </div>
        <p className="mt-2" style={{ color: MUTED, fontSize: "var(--ui-font-micro)", lineHeight: 1.55 }}>
          购买、下载和 Manifest 校验完成后，收据会绑定到目标 Agent，而不是共享给所有角色。
        </p>
      </div>

      <div className="mt-3 rounded-2xl p-3" style={{ color: MUTED, background: "rgba(109,104,132,.07)", fontSize: "var(--ui-font-micro)", lineHeight: 1.55 }}>
        <ShieldCheck size={13} color={CHAIN_ACCENT} className="mr-1.5 inline"/>
        私钥始终保留在钱包中。连接只签署登录消息；发布、购买和调用会分别弹出真实交易确认。
      </div>
    </PanelShell>
  );
}

function SkillDetailPanel({
  listing,
  buyerAgentId,
  stage,
  receipt,
  actionError,
  onBuyerChange,
  onPurchase,
  onClose,
}: {
  listing: ChainSkillListing;
  buyerAgentId: string;
  stage: ChainPurchaseStage;
  receipt?: ChainSkillReceipt;
  actionError: string;
  onBuyerChange: (agentId: string) => void;
  onPurchase: () => void;
  onClose: () => void;
}) {
  const [detailTab, setDetailTab] = useState<"skill" | "proof" | "license">("skill");
  const currentStepIndex = PURCHASE_STEPS.findIndex(step => step.stage === stage);
  const buyerName = BUYER_AGENTS.find(agent => agent.id === buyerAgentId)?.name ?? buyerAgentId;
  const busy = !["idle", "installed"].includes(stage);
  const publisherIdentity = chainPlazaAdapter.listAgentProfiles()
    .find(profile => profile.agentId === listing.publisher.agentId);
  const revenueSplit = listing.revenueSplit ?? {
    publisher: 90,
    collaborators: 5,
    platform: 5,
  };

  return (
    <PanelShell title={`${listing.name} 详情`} onClose={onClose}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[20px]"
          style={{ background: `${listing.color}0F`, border: `1px solid ${listing.color}30` }}
        >
          <SkillAvatar type={listing.publisher.avatarType} size={68} />
        </span>
        <div className="min-w-0 flex-1">
          <PreviewBadge />
          <h2 className="mt-2" style={{ color: INK, fontSize: "var(--ui-font-heading)", lineHeight: 1.2 }}>
            {listing.name}
          </h2>
          <p className="mt-1" style={{ color: listing.color, fontSize: "var(--ui-font-caption)" }}>
            {listing.englishName} · v{listing.version}
          </p>
          <p className="mt-1 inline-flex items-center gap-1" style={{ color: "#579447", fontSize: "var(--ui-font-micro)" }}>
            <BadgeCheck size={10}/>ERC-8004 发布者 · {publisherIdentity?.tokenId ?? "REGISTRY"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl p-1" style={{ background: PAPER }}>
        {([
          { id: "skill", label: "Skill" },
          { id: "proof", label: "链上证明" },
          { id: "license", label: "License" },
        ] as const).map(item => {
          const active = detailTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setDetailTab(item.id)}
              className="rounded-xl py-2"
              style={{
                color: active ? "white" : MUTED,
                background: active ? listing.color : "transparent",
                fontSize: "var(--ui-font-caption)",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {detailTab === "skill" && (
        <>
          <p className="mt-4" style={{ color: "#5F594F", fontSize: "var(--ui-font-body)", lineHeight: 1.65 }}>
            {listing.description}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {listing.capabilities.map(capability => (
              <div
                key={capability}
                className="rounded-xl px-2 py-2 text-center"
                style={{ color: listing.color, background: `${listing.color}0C`, fontSize: "var(--ui-font-micro)" }}
              >
                {capability}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl p-3" style={{ background: PAPER, border: "1px solid rgba(28,25,17,.1)" }}>
            <div className="flex items-center justify-between">
              <span style={{ color: MUTED, fontSize: "var(--ui-font-micro)" }}>PUBLISHER</span>
              <span style={{ color: "#579447", fontSize: "var(--ui-font-micro)" }}>VERIFIED</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <strong style={{ color: INK, fontSize: "var(--ui-font-label)" }}>{listing.publisher.name}</strong>
              <span style={{ color: MUTED, fontSize: "var(--ui-font-micro)" }}>{listing.installs} 安装 · {listing.rating.toFixed(1)} 评分</span>
            </div>
          </div>
        </>
      )}

      {detailTab === "proof" && (
        <>
          <div className="mt-4 rounded-2xl p-3" style={{ background: PAPER, border: "1px solid rgba(28,25,17,.1)" }}>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5" style={{ color: INK, fontSize: "var(--ui-font-caption)" }}>
                <ShieldCheck size={14} color={listing.color} />Package 权限
              </span>
              <span style={{ color: MUTED, fontSize: "var(--ui-font-micro)" }}>{listing.packageSize}</span>
            </div>
            <p className="mt-2" style={{ color: MUTED, fontSize: "var(--ui-font-micro)", lineHeight: 1.55 }}>
              Prompt 与知识文件 · 不读取私人记忆 · 安装前校验 Manifest
            </p>
          </div>
          <div className="mt-3 grid gap-2">
            {[
              { label: "NETWORK", value: `${listing.proof.network} · ${listing.proof.chainId}` },
              { label: "AGENT IDENTITY", value: publisherIdentity?.identityRef ?? `eip155:1439:${listing.publisher.registryAgentId}` },
              { label: "LISTING REF", value: listing.proof.listingRef },
              { label: "MANIFEST ROOT", value: listing.proof.manifestRoot },
            ].map(item => (
              <div key={item.label} className="rounded-xl px-3 py-2.5" style={{ background: PAPER, border: "1px solid rgba(28,25,17,.08)" }}>
                <small style={{ color: MUTED, fontSize: 8 }}>{item.label}</small>
                <strong className="mt-1 block truncate" style={{ color: INK, fontSize: "var(--ui-font-micro)" }}>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-2xl p-3" style={{ background: `${listing.color}0C`, border: `1px solid ${listing.color}24` }}>
            <span className="inline-flex items-center gap-1.5" style={{ color: listing.color, fontSize: "var(--ui-font-caption)" }}>
              <Coins size={13}/>每笔收入自动分账
            </span>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { label: "发布 Agent", value: revenueSplit.publisher },
                { label: "协作者", value: revenueSplit.collaborators },
                { label: "Agent Land", value: revenueSplit.platform },
              ].map(item => (
                <span key={item.label}>
                  <strong className="block" style={{ color: INK, fontSize: "var(--ui-font-label)" }}>{item.value}%</strong>
                  <small style={{ color: MUTED, fontSize: 8 }}>{item.label}</small>
                </span>
              ))}
            </div>
          </div>
          <a
            href={listing.proof.contractScanUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5"
            style={{ color: listing.color, background: PAPER, border: `1px solid ${listing.color}24`, fontSize: "var(--ui-font-caption)" }}
          >
            <BadgeCheck size={12}/>在 Blockscout 验证合约
          </a>
        </>
      )}

      {detailTab === "license" && (
        <>
          <div className="mt-4 flex items-center justify-between rounded-2xl p-3"
            style={{ background: PAPER, border: "1px solid rgba(28,25,17,.1)" }}>
            <span>
              <small className="block" style={{ color: MUTED, fontSize: "var(--ui-font-micro)" }}>
                {listing.price.mode === "per_call" ? "ON-CHAIN PAY PER CALL" : "ON-CHAIN LICENSE"}
              </small>
              <strong className="mt-1 block" style={{ color: INK, fontSize: "var(--ui-font-caption)" }}>{listing.license}</strong>
            </span>
            <PriceLabel listing={listing}/>
          </div>

          <div className="mt-4">
            <p style={{ color: INK, fontSize: "var(--ui-font-caption)" }}>安装到哪个 Agent？</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {BUYER_AGENTS.map(agent => {
                const active = buyerAgentId === agent.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    disabled={busy}
                    onClick={() => onBuyerChange(agent.id)}
                    className="rounded-xl py-2"
                    style={{
                      color: active ? "white" : MUTED,
                      background: active ? listing.color : PAPER,
                      border: `1px solid ${active ? listing.color : "rgba(28,25,17,.1)"}`,
                      fontSize: "var(--ui-font-caption)",
                    }}
                  >
                    {agent.name}
                  </button>
                );
              })}
            </div>
          </div>

          {stage !== "idle" && (
            <div className="mt-4 grid grid-cols-5 gap-1">
              {PURCHASE_STEPS.map((step, index) => {
                const complete = currentStepIndex >= index;
                return (
                  <div key={step.stage} className="min-w-0 text-center">
                    <span
                      className="mx-auto flex h-6 w-6 items-center justify-center rounded-full"
                      style={{
                        color: complete ? "white" : MUTED,
                        background: complete ? listing.color : "rgba(28,25,17,.08)",
                      }}
                    >
                      {complete && currentStepIndex > index ? <Check size={12} /> : index + 1}
                    </span>
                    <span
                      className="mt-1 block"
                      style={{ color: complete ? listing.color : MUTED, fontSize: "8px", lineHeight: 1.2 }}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={onPurchase}
            disabled={busy || stage === "installed"}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5"
            style={{
              color: "white",
              background: stage === "installed" ? "#579447" : listing.color,
              opacity: busy ? .84 : 1,
              fontSize: "var(--ui-font-label)",
            }}
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {stage === "idle" && <WalletCards size={15} />}
            {stage === "installed" && <PackageCheck size={15} />}
            {stage === "idle" && (
              <span>
                {listing.price.mode === "per_call" ? "签名调用" : "购买 License"} · {listing.price.amount} {listing.price.asset}
              </span>
            )}
            {stage === "quoting" && "正在读取链上报价…"}
            {stage === "paying" && "等待钱包确认 Injective 交易…"}
            {stage === "downloading" && "正在下载到本地…"}
            {stage === "verifying" && "正在核对 Manifest Root…"}
            {stage === "installed" && `已安装到 ${buyerName}`}
          </button>
          {actionError && (
            <p className="mt-2 rounded-xl px-3 py-2 text-center" role="alert"
              style={{ color: "#A24E42", background: "rgba(200,100,82,.08)", fontSize: "var(--ui-font-micro)", lineHeight: 1.45 }}>
              {actionError}
            </p>
          )}
          {stage === "installed" && receipt && (
            <a
              href={receipt.scanUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5"
              style={{ color: "#579447", background: "rgba(87,148,71,.08)", fontSize: "var(--ui-font-caption)" }}
            >
              <BadgeCheck size={12}/>查看 Injective 交易收据
            </a>
          )}
          <p className="mt-2 text-center" style={{ color: MUTED, fontSize: "var(--ui-font-micro)" }}>
            将在 Injective EVM 测试网产生真实签名、测试网 INJ 费用与可核验交易哈希。
          </p>
        </>
      )}
    </PanelShell>
  );
}

function PublishSkillPanel({
  actionError,
  onPublish,
  onClose,
}: {
  actionError: string;
  onPublish: (input: ChainSkillPublishInput) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("我的主题研究");
  const [category, setCategory] = useState<ChainSkillCategory>("学习");
  const [summary, setSummary] = useState("让子智能体围绕一个主题提出问题、验证资料并沉淀结论。");
  const [price, setPrice] = useState("0.001");
  const [pricingMode, setPricingMode] = useState<"license" | "per_call">("license");
  const [publisherId, setPublisherId] = useState(PUBLISHERS[0].id);
  const [publishing, setPublishing] = useState(false);
  const publisher = PUBLISHERS.find(item => item.id === publisherId) ?? PUBLISHERS[0];
  const fieldStyle = {
    width: "100%",
    borderRadius: 13,
    border: "1px solid rgba(28,25,17,.13)",
    background: PAPER,
    color: INK,
    padding: "11px 12px",
    outline: "none",
    fontFamily: FONT,
    fontSize: "var(--ui-font-body)",
  };

  const submit = async () => {
    if (!name.trim() || publishing) return;
    setPublishing(true);
    try {
      await onPublish({
        name,
        category,
        summary,
        price,
        pricingMode,
        publisherAgentId: publisher.id,
        publisherRegistryAgentId: publisher.registryAgentId,
        publisherAgentName: publisher.name,
        publisherAvatarType: publisher.avatarType,
        revenueSplit: {
          publisher: 90,
          collaborators: 5,
          platform: 5,
        },
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <PanelShell title="发布 Skill" onClose={onClose}>
      <PreviewBadge />
      <h2 className="mt-3" style={{ color: INK, fontSize: "var(--ui-font-heading)" }}>发布一个可交易 Skill</h2>
      <p className="mt-2" style={{ color: MUTED, fontSize: "var(--ui-font-body)", lineHeight: 1.55 }}>
        Manifest 内容根与定价将写入 Agent Skill Market；当前钱包必须拥有所选 ERC-8004 Agent。
      </p>

      <div className="mt-4" style={{ color: MUTED, fontSize: "var(--ui-font-caption)" }}>
        <p>发布 Agent</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {PUBLISHERS.map(item => {
            const active = item.id === publisherId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPublisherId(item.id)}
                className="flex flex-col items-center rounded-xl py-2"
                style={{
                  color: active ? CHAIN_ACCENT : MUTED,
                  background: active ? "rgba(109,104,132,.09)" : PAPER,
                  border: `1px solid ${active ? CHAIN_ACCENT : "rgba(28,25,17,.1)"}`,
                  fontSize: "var(--ui-font-micro)",
                }}
              >
                <SkillAvatar type={item.avatarType} size={36} />
                {item.name} #{item.registryAgentId}
              </button>
            );
          })}
        </div>
      </div>

      <label className="mt-4 block" style={{ color: MUTED, fontSize: "var(--ui-font-caption)" }}>
        Skill 名称
        <input className="mt-2" value={name} onChange={event => setName(event.target.value)} style={fieldStyle} />
      </label>
      <div className="mt-4 grid grid-cols-[1fr_120px] gap-2">
        <label style={{ color: MUTED, fontSize: "var(--ui-font-caption)" }}>
          主题
          <select
            className="mt-2"
            value={category}
            onChange={event => setCategory(event.target.value as ChainSkillCategory)}
            style={fieldStyle}
          >
            {CATEGORIES.slice(1).map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label style={{ color: MUTED, fontSize: "var(--ui-font-caption)" }}>
          价格 / INJ
          <input
            className="mt-2"
            inputMode="decimal"
            value={price}
            onChange={event => setPrice(event.target.value.replace(/[^\d.]/g, ""))}
            style={fieldStyle}
          />
        </label>
      </div>
      <label className="mt-4 block" style={{ color: MUTED, fontSize: "var(--ui-font-caption)" }}>
        简单描述
        <textarea
          className="mt-2 min-h-[84px] resize-none"
          value={summary}
          onChange={event => setSummary(event.target.value)}
          style={fieldStyle}
        />
      </label>

      <div className="mt-4">
        <p style={{ color: MUTED, fontSize: "var(--ui-font-caption)" }}>收费方式</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([
            { id: "license", label: "一次购买 License" },
            { id: "per_call", label: "合约按次调用" },
          ] as const).map(item => {
            const active = pricingMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPricingMode(item.id)}
                className="rounded-xl py-2.5"
                style={{
                  color: active ? "white" : MUTED,
                  background: active ? CHAIN_ACCENT : PAPER,
                  border: `1px solid ${active ? CHAIN_ACCENT : "rgba(28,25,17,.1)"}`,
                  fontSize: "var(--ui-font-caption)",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-2xl p-3" style={{ background: "rgba(109,104,132,.07)", border: "1px solid rgba(109,104,132,.14)" }}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5" style={{ color: CHAIN_ACCENT, fontSize: "var(--ui-font-caption)" }}>
            <Coins size={13}/>收入自动分账
          </span>
          <span style={{ color: MUTED, fontSize: "var(--ui-font-micro)" }}>100%</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "发布 Agent", value: 90 },
            { label: "协作者", value: 5 },
            { label: "Agent Land", value: 5 },
          ].map(item => (
            <span key={item.label}>
              <strong className="block" style={{ color: INK, fontSize: "var(--ui-font-label)" }}>{item.value}%</strong>
              <small style={{ color: MUTED, fontSize: 8 }}>{item.label}</small>
            </span>
          ))}
        </div>
      </div>

      <div
        className="mt-4 flex items-start gap-2 rounded-2xl p-3"
        style={{ color: MUTED, background: "rgba(109,104,132,.07)", fontSize: "var(--ui-font-micro)", lineHeight: 1.55 }}
      >
        <FileCheck2 size={15} color={CHAIN_ACCENT} className="mt-0.5 shrink-0" />
        <span>发布前检查：Manifest、权限声明、版本、定价与本地 Package 完整性。</span>
      </div>
      {actionError && (
        <p className="mt-3 rounded-xl px-3 py-2.5" role="alert"
          style={{ color: "#A24E42", background: "rgba(200,100,82,.08)", fontSize: "var(--ui-font-micro)", lineHeight: 1.5 }}>
          {actionError}
        </p>
      )}
      <button
        type="button"
        disabled={!name.trim() || publishing}
        onClick={submit}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5"
        style={{
          color: "white",
          background: CHAIN_ACCENT,
          opacity: !name.trim() || publishing ? .55 : 1,
          fontSize: "var(--ui-font-label)",
        }}
      >
        {publishing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        {publishing ? "等待钱包确认…" : "签名并发布到 Injective"}
      </button>
    </PanelShell>
  );
}

export function ChainPlazaScreen({ sceneControl }: { sceneControl: ReactNode }) {
  const [listings, setListings] = useState<ChainSkillListing[]>([]);
  const [category, setCategory] = useState<"全部" | ChainSkillCategory>("全部");
  const [collectionView, setCollectionView] = useState<"market" | "purchased" | "published">("market");
  const [selected, setSelected] = useState<ChainSkillListing | null>(null);
  const [showPublisher, setShowPublisher] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [buyerAgentId, setBuyerAgentId] = useState(BUYER_AGENTS[0].id);
  const [purchaseStage, setPurchaseStage] = useState<ChainPurchaseStage>("idle");
  const [actionError, setActionError] = useState("");
  const [walletError, setWalletError] = useState("");
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [wallet, setWallet] = useState(() => chainPlazaAdapter.getWallet());
  const [receipts, setReceipts] = useState(() => chainPlazaAdapter.listReceipts());
  const [installedKeys, setInstalledKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const syncReceipts = () => {
    const nextReceipts = chainPlazaAdapter.listReceipts();
    setReceipts(nextReceipts);
    setInstalledKeys(new Set(nextReceipts.map(receipt => `${receipt.listingId}:${receipt.buyerAgentId}`)));
  };

  useEffect(() => {
    let active = true;
    chainPlazaAdapter.listSkills().then(result => {
      if (!active) return;
      setListings(result);
      setLoading(false);
    });
    syncReceipts();
    const unsubscribeWallet = chainPlazaAdapter.subscribeWallet(nextWallet => {
      setWallet(chainPlazaAdapter.getWallet());
      if (nextWallet.authenticated) setWalletError("");
    });
    return () => {
      active = false;
      unsubscribeWallet();
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    setPurchaseStage(installedKeys.has(`${selected.id}:${buyerAgentId}`) ? "installed" : "idle");
  }, [buyerAgentId, installedKeys, selected]);

  const filteredListings = useMemo(() => {
    const collection = collectionView === "purchased"
      ? listings.filter(listing => receipts.some(receipt => receipt.listingId === listing.id))
      : collectionView === "published"
        ? listings.filter(listing => wallet.connected
          && listing.publisher.walletAddress.toLowerCase() === wallet.address.toLowerCase())
        : listings;
    return collectionView === "market" && category !== "全部"
      ? collection.filter(listing => listing.category === category)
      : collection;
  }, [category, collectionView, listings, receipts, wallet.address, wallet.connected]);

  const publishSkill = async (input: ChainSkillPublishInput) => {
    setActionError("");
    try {
      const listing = await chainPlazaAdapter.publishSkill(input);
      setListings(await chainPlazaAdapter.listSkills());
      setShowPublisher(false);
      setSelected(listing);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Skill 发布失败。");
    }
  };

  const purchaseSkill = async () => {
    if (!selected || !["idle", "installed"].includes(purchaseStage)) return;
    setActionError("");
    try {
      await chainPlazaAdapter.purchaseSkill(selected, buyerAgentId, setPurchaseStage);
      syncReceipts();
      setWallet(chainPlazaAdapter.getWallet());
    } catch (error) {
      setPurchaseStage("idle");
      setActionError(error instanceof Error ? error.message : "Injective 交易失败。");
    }
  };

  const connectWallet = async () => {
    if (connectingWallet) return;
    setConnectingWallet(true);
    setWalletError("");
    try {
      await chainPlazaAdapter.connectWallet();
      setWallet(chainPlazaAdapter.getWallet());
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "钱包连接失败。");
    } finally {
      setConnectingWallet(false);
    }
  };

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      style={{ background: PAPER, color: INK, fontFamily: FONT }}
    >
      <div className="flex justify-end px-4 pb-1 pt-9">{sceneControl}</div>

      <div className="px-4 pb-3 pt-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
              On-chain Plaza
            </h1>
            <p className="mt-2" style={{ color: MUTED, fontSize: "var(--ui-font-body)" }}>
              Agent 发布、购买与下载可验证的 Skills
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => {
                setWalletError("");
                setShowWallet(true);
              }}
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-2.5"
              style={{ color: CHAIN_ACCENT, background: "rgba(109,104,132,.09)", fontSize: "var(--ui-font-micro)" }}
              aria-label={wallet.connected ? `打开钱包，余额 ${wallet.injBalance.toFixed(4)} INJ` : "连接 Injective 钱包"}
            >
              <WalletCards size={13}/>{wallet.connected ? wallet.injBalance.toFixed(4) : "连接"}
            </button>
            <button
              type="button"
              onClick={() => {
                setActionError("");
                setShowPublisher(true);
              }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2.5"
              style={{ color: "white", background: CHAIN_ACCENT, fontSize: "var(--ui-font-caption)" }}
            >
              <Plus size={14} />发布
            </button>
          </div>
        </div>

        <div
          className="mt-3 flex items-center justify-between rounded-2xl px-3 py-2.5"
          style={{ background: "rgba(109,104,132,.075)", border: "1px solid rgba(109,104,132,.14)" }}
        >
          <span className="flex items-center gap-2" style={{ color: CHAIN_ACCENT, fontSize: "var(--ui-font-caption)" }}>
            <Sparkles size={13} />Injective EVM · Chain ID 1439
          </span>
          <PreviewBadge />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 px-4 pb-3">
        {([
          { id: "market", label: "Skill 市场" },
          { id: "purchased", label: "我的购买" },
          { id: "published", label: "我的发布" },
        ] as const).map(item => {
          const active = collectionView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCollectionView(item.id)}
              className="rounded-xl py-2.5"
              style={{
                color: active ? "white" : MUTED,
                background: active ? CHAIN_ACCENT : "#FAF6EF",
                border: `1px solid ${active ? CHAIN_ACCENT : "rgba(28,25,17,.1)"}`,
                fontSize: "var(--ui-font-micro)",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {collectionView === "market" && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map(item => {
            const active = category === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className="shrink-0 rounded-full px-3 py-2"
                style={{
                  color: active ? "white" : MUTED,
                  background: active ? CHAIN_ACCENT : "#FAF6EF",
                  border: `1px solid ${active ? CHAIN_ACCENT : "rgba(28,25,17,.1)"}`,
                  fontSize: "var(--ui-font-caption)",
                }}
              >
                {item}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-5">
        <div
          className="mb-3 flex items-center justify-between rounded-xl px-3 py-2"
          style={{ color: MUTED, background: "rgba(28,25,17,.035)", fontSize: "var(--ui-font-micro)" }}
        >
          <span className="inline-flex items-center gap-1.5">
            {collectionView === "market"
              ? <><BadgeCheck size={12} />Manifest-first 市场</>
              : collectionView === "purchased"
                ? <><PackageCheck size={12}/>本地 License 与收据</>
                : <><Coins size={12}/>Agent 发布与收益</>}
          </span>
          <span>{filteredListings.length} SKILLS</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16" style={{ color: MUTED, fontSize: "var(--ui-font-caption)" }}>
            <Loader2 size={16} className="animate-spin" />加载挂牌…
          </div>
        ) : filteredListings.length ? (
          <div className="grid gap-3">
            {filteredListings.map(listing => (
              <ChainSkillCard
                key={listing.id}
                listing={listing}
                installed={Array.from(installedKeys).some(key => key.startsWith(`${listing.id}:`))}
                onOpen={() => {
                  setActionError("");
                  setBuyerAgentId(BUYER_AGENTS[0].id);
                  setSelected(listing);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[22px] px-5 py-12 text-center" style={{ background: "#FAF6EF", border: "1px dashed rgba(28,25,17,.15)" }}>
            <PackageCheck size={24} color={CHAIN_ACCENT} className="mx-auto"/>
            <p className="mt-3" style={{ color: INK, fontSize: "var(--ui-font-label)" }}>
              {collectionView === "purchased" ? "还没有购买记录" : "还没有发布记录"}
            </p>
            <p className="mt-2" style={{ color: MUTED, fontSize: "var(--ui-font-micro)" }}>
              {collectionView === "purchased" ? "从 Skill 市场选择能力并安装到 Agent。" : "发布第一个可交易的 Agent Skill。"}
            </p>
          </div>
        )}

        <div
          className="mt-4 rounded-[20px] p-4"
          style={{ background: "#1C1911", color: "#FAF6EF" }}
        >
          <div className="flex items-center gap-2" style={{ fontSize: "var(--ui-font-label)" }}>
            <Download size={15} />下载后仍由用户控制
          </div>
          <p className="mt-2" style={{ color: "#C9C2B6", fontSize: "var(--ui-font-micro)", lineHeight: 1.55 }}>
            Skill Package 保存在本地；安装前校验内容根，Agent 只获得 Manifest 声明过的能力。
          </p>
        </div>
      </div>

      {selected && (
        <SkillDetailPanel
          listing={selected}
          buyerAgentId={buyerAgentId}
          stage={purchaseStage}
          receipt={receipts.find(receipt => receipt.listingId === selected.id && receipt.buyerAgentId === buyerAgentId)}
          actionError={actionError}
          onBuyerChange={setBuyerAgentId}
          onPurchase={purchaseSkill}
          onClose={() => setSelected(null)}
        />
      )}
      {showPublisher && (
        <PublishSkillPanel
          actionError={actionError}
          onPublish={publishSkill}
          onClose={() => setShowPublisher(false)}
        />
      )}
      {showWallet && (
        <WalletPanel
          wallet={wallet}
          receiptCount={receipts.length}
          connecting={connectingWallet}
          error={walletError}
          onConnect={connectWallet}
          onDisconnect={() => {
            chainPlazaAdapter.disconnectWallet();
            setWallet(chainPlazaAdapter.getWallet());
          }}
          onClose={() => setShowWallet(false)}
        />
      )}
    </div>
  );
}
