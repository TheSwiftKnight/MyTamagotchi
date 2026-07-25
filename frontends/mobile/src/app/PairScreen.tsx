/** 合影配对：我的二维码 + 配对结果页。
 *
 * 玩法：在这里调出自己 agent 的二维码，和朋友一起举到摊位的 Link 2 Pro 镜头前；
 * 识别服务配对成功后，本页 2 秒内自动翻转为结果页（契合度 + 相遇对话 + 羁绊）。
 * 数据面：二维码图取后端 GET /api/pair/qr/{id}.png，结果轮询 GET /api/pair/latest/{id}。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, API_ORIGIN } from "./apiBase";
import type { BackendAgent } from "./backendApi";

const INK = "#1C1911";
const SOFT = "#7A7468";
const PAPER = "#F5F0E8";
const ACCENT = "#E8634A";
const PIXEL_FONT = "'Fusion Pixel 10px Monospaced SC',sans-serif";

const FRESH_SEC = 120;                     // 只认 2 分钟内的新配对，防止翻出旧结果
const DISMISS_KEY = "fw_pair_dismissed";   // 看过的 pair_id 不再重复弹

type PairResult = {
  pair_id: string;
  ts?: number;
  agents: { id: number; name: string; image?: string }[];
  lines: { agent_id: number; name: string; image?: string; text: string }[];
  resonance: { score: number; reason: string; topic: string };
  learned?: { learner: string; teacher: string; skill: string } | null;
  bond?: { pair_count: number; is_new: boolean };
};

const imgUrl = (path?: string) => (path ? (path.startsWith("http") ? path : API_ORIGIN + path) : "");

export function PairScreen({ myAgents }: { myAgents: BackendAgent[] }) {
  const [agentId, setAgentId] = useState<number | null>(null);
  const [result, setResult] = useState<PairResult | null>(null);
  const [online, setOnline] = useState(true);
  const dismissedRef = useRef<string>(localStorage.getItem(DISMISS_KEY) || "");

  useEffect(() => {
    if (agentId == null && myAgents.length) setAgentId(myAgents[0].id);
  }, [myAgents, agentId]);

  // 轮询最近配对：配对成功自动翻结果页
  useEffect(() => {
    if (agentId == null) return;
    let alive = true;
    const poll = async () => {
      try {
        const r: PairResult = await fetch(`${API_BASE}/pair/latest/${agentId}`).then(res => res.json());
        if (!alive) return;
        setOnline(true);
        const fresh = r && r.pair_id && Date.now() / 1000 - (r.ts || 0) < FRESH_SEC;
        if (fresh && r.pair_id !== dismissedRef.current) {
          dismissedRef.current = r.pair_id;
          localStorage.setItem(DISMISS_KEY, r.pair_id);
          setResult(r);
          if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
        }
      } catch {
        if (alive) setOnline(false);
      }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => { alive = false; clearInterval(t); };
  }, [agentId]);

  const me = useMemo(() => myAgents.find(a => a.id === agentId) ?? null, [myAgents, agentId]);

  if (!myAgents.length) {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <p style={{ fontFamily: PIXEL_FONT, color: INK, fontSize: 14 }}>还没有自己的 agent</p>
          <p style={{ fontFamily: PIXEL_FONT, color: SOFT, fontSize: 11, lineHeight: 1.8 }}>
            先去 Capture 用镜头捕获一只随身物品伙伴，再来合影配对
          </p>
        </div>
      </Shell>
    );
  }

  if (result) {
    return <ResultView result={result} onBack={() => setResult(null)} />;
  }

  return (
    <Shell>
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-6 pb-8">
        <p style={{ fontFamily: PIXEL_FONT, color: SOFT, fontSize: 11, margin: "6px 0 12px" }}>
          和朋友一起把二维码举到摊位镜头前
        </p>

        {/* agent 选择（多只时） */}
        {myAgents.length > 1 && (
          <div className="w-full flex gap-2 overflow-x-auto pb-3" style={{ scrollbarWidth: "none" }}>
            {myAgents.map(a => (
              <button key={a.id} onClick={() => setAgentId(a.id)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 shrink-0"
                style={{
                  border: `1.5px solid ${a.id === agentId ? ACCENT : "rgba(28,25,17,.2)"}`,
                  background: a.id === agentId ? "rgba(232,99,74,.1)" : "#FAF6EF",
                }}>
                {a.image
                  ? <img src={imgUrl(a.image)} alt="" className="w-6 h-6 rounded-full object-contain"
                         style={{ background: "#EFE9DD", border: `1px solid ${INK}` }}/>
                  : <span style={{ fontSize: 14 }}>🐾</span>}
                <span style={{ fontFamily: PIXEL_FONT, fontSize: 11, color: INK }}>{a.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* 二维码卡片 */}
        <div className="rounded-2xl p-4 mt-2"
          style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: "6px 6px 0 rgba(28,25,17,.85)", transform: "rotate(-1deg)" }}>
          {agentId != null && (
            <img key={agentId} src={`${API_BASE}/pair/qr/${agentId}.png`} alt={`FW1:${agentId}`}
              className="block" style={{ width: "min(64vw, 300px)", imageRendering: "pixelated" }}/>
          )}
        </div>

        {me && (
          <p className="mt-4" style={{ fontFamily: PIXEL_FONT, color: INK, fontSize: 13 }}>
            {me.name} · Agent #{me.id}
          </p>
        )}

        <div className="flex items-center gap-2 rounded-full px-4 py-2 mt-3"
          style={{ background: INK, color: PAPER }}>
          <span className="w-2 h-2 rounded-full"
            style={{ background: online ? "#7BC47F" : ACCENT, animation: online ? "fwPulse 1.6s ease-in-out infinite" : "none" }}/>
          <span style={{ fontFamily: PIXEL_FONT, fontSize: 11 }}>
            {online ? "等待合影 · 镜头认出你们就开演" : "后端连接中…"}
          </span>
        </div>
        <p className="mt-2" style={{ fontFamily: PIXEL_FONT, color: SOFT, fontSize: 10 }}>
          屏幕亮度调到最高效果更好
        </p>
        <style>{`@keyframes fwPulse{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
      </div>
    </Shell>
  );
}

function ResultView({ result, onBack }: { result: PairResult; onBack: () => void }) {
  const [score, setScore] = useState(0);
  const target = result.resonance?.score ?? 0;
  useEffect(() => {
    setScore(0);
    const step = Math.max(1, Math.round(target / 40));
    const t = setInterval(() => {
      setScore(v => {
        const nv = Math.min(target, v + step);
        if (nv >= target) clearInterval(t);
        return nv;
      });
    }, 28);
    return () => clearInterval(t);
  }, [target]);

  const names = (result.agents || []).map(a => a.name).join(" × ");
  return (
    <Shell>
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-6 pb-8 text-center">
        <p className="mt-1" style={{ fontFamily: PIXEL_FONT, color: INK, fontSize: 14, fontWeight: 700 }}>{names}</p>
        {result.bond && (
          <p className="mt-1" style={{ fontFamily: PIXEL_FONT, color: SOFT, fontSize: 10 }}>
            {result.bond.is_new ? "✨ 结为伙伴！之后他们会互相串门" : `第 ${result.bond.pair_count} 次相遇，羁绊加深`}
          </p>
        )}
        <div className="mt-3" style={{ color: ACCENT, fontSize: 64, fontWeight: 800, lineHeight: 1, textShadow: "3px 3px 0 rgba(28,25,17,.14)" }}>
          {score}<span style={{ fontSize: 18, color: INK, fontWeight: 600 }}> / 100 灵魂契合</span>
        </div>
        <p className="mt-3 max-w-xs" style={{ fontFamily: PIXEL_FONT, color: INK, fontSize: 12, lineHeight: 1.8 }}>
          {result.resonance?.reason}
        </p>
        {result.resonance?.topic && (
          <div className="rounded-2xl px-5 py-3 mt-4 max-w-xs"
            style={{ background: "#fff", border: `2px solid ${INK}`, boxShadow: "4px 4px 0 rgba(28,25,17,.85)", transform: "rotate(1deg)" }}>
            <p style={{ fontFamily: PIXEL_FONT, color: ACCENT, fontSize: 9, letterSpacing: 2 }}>值得聊的那件事</p>
            <p className="mt-1" style={{ fontFamily: PIXEL_FONT, color: INK, fontSize: 12 }}>{result.resonance.topic}</p>
          </div>
        )}
        <div className="w-full max-w-sm mt-5 flex flex-col gap-2">
          {(result.lines || []).map((l, i) => (
            <div key={i} className="flex items-start gap-2 text-left">
              {l.image
                ? <img src={imgUrl(l.image)} alt="" className="w-7 h-7 rounded-full object-contain shrink-0"
                       style={{ background: "#EFE9DD", border: `1.5px solid ${INK}` }}/>
                : <span className="w-7 text-center shrink-0" style={{ fontSize: 16 }}>🐾</span>}
              <p className="rounded-xl px-3 py-2"
                style={{ background: "#fff", border: `1.5px solid ${INK}`, borderTopLeftRadius: 4,
                         fontFamily: PIXEL_FONT, fontSize: 11, color: INK, lineHeight: 1.6 }}>
                {l.name}：{l.text}
              </p>
            </div>
          ))}
        </div>
        {result.learned && (
          <p className="rounded-full px-4 py-2 mt-4"
            style={{ background: "#FBE8A6", border: `1.5px solid ${INK}`, fontFamily: PIXEL_FONT, fontSize: 11, color: INK }}>
            ✨ {result.learned.learner} 学会了「{result.learned.skill}」
          </p>
        )}
        <button onClick={onBack} className="rounded-full px-8 py-3 mt-6"
          style={{ background: INK, color: PAPER, fontFamily: PIXEL_FONT, fontSize: 12, letterSpacing: 2,
                   boxShadow: `3px 3px 0 ${ACCENT}` }}>
          继续配对
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col" style={{ background: PAPER }}>
      <div className="px-6 pt-2">
        <h2 style={{ fontFamily: "Caveat,cursive", fontSize: 28, fontWeight: 700, color: INK }}>合影配对</h2>
      </div>
      {children}
    </div>
  );
}
