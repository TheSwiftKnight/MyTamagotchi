import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera, Wand2, Sparkles, Play, MapPin, Grid3X3, BookOpen,
  Wifi, Share2, GitMerge, ChevronLeft, ChevronRight, Plus,
  Search, Star, Clock, Heart, Zap, Globe, Home, X, Check,
  Lock, Eye, Layers, ArrowRight, Radio, Cpu, Compass, Settings,
  Volume2, RotateCcw, Move, Trash2, Package, Music,
  Lightbulb, Headphones, Mic, Rocket, Telescope, Bot, Dumbbell, Hammer,
  Image as ImageIcon, Brush, Scissors, RotateCw, FlipHorizontal, Brain, Send,
  ChevronDown, ChevronUp, ZoomIn, ZoomOut, Undo2, Loader2
} from "lucide-react";
import {
  CharacterSettingsScreen,
  type CharacterStyleCategory,
  type DailySpiritCard,
  type StyleAgentIdentitySeed,
} from "./CharacterSettingsScreen";
import { useWorldEvolution } from "./useWorldEvolution";
import { worldApi, type AgentConversation, type AgentChatMessage, type WorldAgent } from "./worldApi";
import { petApi, waitForPet, type PetAsset, type PetJob } from "./petApi";
import {
  WORLD_STYLE_SKILLS,
  WORLD_STYLE_SKILL_ASSETS,
  type WorldStyleSkillAssetType,
  type WorldStyleSkillCategory,
} from "./worldStyleSkills";
import {
  MY_AGENT_SKILL_LOADOUTS,
  PLAZA_AGENT_SKILL_BINDINGS,
  PLAZA_SKILLS,
  getAgentSkillBindings,
  getPlazaSkill,
  type PlazaSkill,
} from "./plazaSkills";
import {
  getSkillForgeLayerLabel,
  runSkillForgeHarness,
  type SkillForgeManifest,
  type SkillForgeTraceEvent,
} from "./skillForgeHarness";
import { WebPlazaScene } from "./WebPlazaScene";
import { ChainPlazaScreen } from "./ChainPlazaScreen";
import {
  chainPlazaAdapter,
  type ChainSkillListing,
} from "./chainPlazaAdapter";
import {
  THEMED_WORLDS,
  ThemedWorldPreview,
  ThemedWorldScreen,
  type ThemedWorldConfig,
  type ThemedWorldDecoration,
  type ThemedWorldKey,
  type ThemedWorldResident,
} from "./ThemedWorldScenes";
import {
  SUPERVISED_TRAINING_EXERCISES,
  createSupervisedTrainingProvider,
  type SupervisedTrainingExercise,
  type SupervisedTrainingFeedback,
  type SupervisedTrainingSummary,
} from "./skills/supervisedTrainingSkill";
import medCottagePng from "../assets/world/medieval/cottage.png";
import medChapelPng from "../assets/world/medieval/chapel.png";
import medWatchtowerPng from "../assets/world/medieval/watchtower.png";
import medApothecaryPng from "../assets/world/medieval/apothecary.png";
import medMarketPng from "../assets/world/medieval/market.png";
import medWellPng from "../assets/world/medieval/well.png";
import medBridgePng from "../assets/world/medieval/bridge.png";
import medWindmillPng from "../assets/world/medieval/windmill.png";
import modernApartmentPng from "../assets/world/modern/apartment.png";
import modernCafePng from "../assets/world/modern/cafe.png";
import modernLibraryPng from "../assets/world/modern/library.png";
import modernCinemaPng from "../assets/world/modern/cinema.png";
import modernBusShelterPng from "../assets/world/modern/bus-shelter.png";
import modernPostboxPng from "../assets/world/modern/postbox.png";
import modernFountainPng from "../assets/world/modern/fountain.png";
import modernKioskPng from "../assets/world/modern/kiosk.png";
import lakeArchivistPng from "../assets/world/style-skills/lake-mystery/archivist.png";
import lakeBotanistPng from "../assets/world/style-skills/lake-mystery/botanist.png";
import pentimentScriptoriumPng from "../assets/world/style-skills/pentiment/buildings/scriptorium.png";
import pentimentBakeryPng from "../assets/world/style-skills/pentiment/buildings/bakery.png";
import pentimentChapelPng from "../assets/world/style-skills/pentiment/buildings/chapel.png";
import pentimentGatehousePng from "../assets/world/style-skills/pentiment/buildings/gatehouse.png";
import petDachshundPng from "../assets/world/pet-agents/sprites/dachshund.png";
import petSiamesePng from "../assets/world/pet-agents/sprites/siamese.png";
import petCatPng from "../assets/world/pet-agents/sprites/cat.png";
import petRabbitPng from "../assets/world/pet-agents/sprites/rabbit.png";
import petHamsterPng from "../assets/world/pet-agents/sprites/hamster.png";
import petBirdPng from "../assets/world/pet-agents/sprites/bird.png";
import petTortoisePng from "../assets/world/pet-agents/sprites/tortoise.png";

// ── Types ──────────────────────────────────────────────────────────────────────
type Screen =
  | "worldDock" | "capture" | "extract" | "lineArt"
  | "bringToLife" | "agentIdentity" | "motionPreview" | "placeInWorld"
  | "worldBuilder" | "everydayTown" | "stardomDistrict" | "futureColony"
  | "agentDetail" | "visitorArrival" | "visitorBranch" | "worldline"
  | "agentGallery" | "esp32" | "publicMirror" | "branchResolution";

type WorldTheme = "everyday" | "stardom" | "future";

type WorldCreatorStep = "identity" | "agent" | "house" | "theme" | "npcs" | "topic" | "skills";
type WorldCreatorAgentMode = "preset" | "photo";
type WorldCreatorIdentity = "resident" | "visitor";

type WorldCreatorDraft = {
  identity: WorldCreatorIdentity;
  agentMode: WorldCreatorAgentMode;
  agentId: string;
  agentName: string;
  houseId: string;
  themeKey: ThemedWorldKey;
  npcStyle: ThemedWorldKey;
  topic: string;
  worldName: string;
  skillId: string;
};

type CreatedCustomWorld = WorldCreatorDraft & {
  id: string;
  createdAt: number;
};

type CreatedPlazaVisitor = {
  id: string;
  agentMode: WorldCreatorAgentMode;
  agentId: string;
  agentName: string;
  skillId: string;
  createdAt: number;
};

const DEFAULT_WORLD_CREATOR_DRAFT: WorldCreatorDraft = {
  identity: "resident",
  agentMode: "preset",
  agentId: "dotti",
  agentName: "Dotti",
  houseId: "",
  themeKey: "fitness",
  npcStyle: "fitness",
  topic: "身体觉察与科学训练",
  worldName: "My Learning Habitat",
  skillId: "fitness-companion",
};

// ── World DNA ──────────────────────────────────────────────────────────────────
const DNA = {
  everyday: {
    name: "Vitality Gym Town",
    short: "Gym Town",
    paper: "#F5F0E8",
    line: "#1C1911",
    a1: "#E8634A",
    a2: "#6B9E7A",
    a3: "#4A7FA5",
    road: "#C8C2B4",
    grass: "#B8D4A0",
    water: "#9BBFCF",
  },
  stardom: {
    name: "Learning Commons",
    short: "Open School",
    paper: "#F2F4ED",
    line: "#1C1911",
    a1: "#E8191A",
    a2: "#D4A800",
    a3: "#F090A0",
    road: "#E8D8DC",
    grass: "#F0E0E8",
    water: "#F5C8D8",
  },
  future: {
    name: "Maker Harbor",
    short: "Maker Hall",
    paper: "#EEF0F4",
    line: "#2A3048",
    a1: "#6D6884",
    a2: "#E88752",
    a3: "#8090A8",
    road: "#C8D0DC",
    grass: "#CED6E8",
    water: "#A0B8D8",
  },
};

// ── Screen list (for navigation) ───────────────────────────────────────────────
const SCREENS: { id: Screen; label: string; icon: React.ReactNode }[] = [
  { id: "worldDock",      label: "World Dock",     icon: <Home size={12}/> },
  { id: "capture",        label: "Capture",         icon: <Camera size={12}/> },
  { id: "extract",        label: "Extract",         icon: <Scissors size={12}/> },
  { id: "lineArt",        label: "Line Art",        icon: <Brush size={12}/> },
  { id: "bringToLife",    label: "Bring to Life",   icon: <Sparkles size={12}/> },
  { id: "agentIdentity",  label: "Identity",        icon: <Package size={12}/> },
  { id: "motionPreview",  label: "Motion",          icon: <Play size={12}/> },
  { id: "placeInWorld",   label: "Place",           icon: <MapPin size={12}/> },
  { id: "worldBuilder",   label: "Builder",         icon: <Grid3X3 size={12}/> },
  { id: "everydayTown",   label: "Vitality Gym",    icon: <Home size={12}/> },
  { id: "stardomDistrict",label: "Open School",     icon: <Star size={12}/> },
  { id: "futureColony",   label: "Maker Hall",      icon: <Rocket size={12}/> },
  { id: "agentDetail",    label: "Agent Detail",    icon: <Package size={12}/> },
  { id: "visitorArrival", label: "Visitor Arrives", icon: <Globe size={12}/> },
  { id: "visitorBranch",  label: "Branch",          icon: <GitMerge size={12}/> },
  { id: "worldline",      label: "Worldline",       icon: <Compass size={12}/> },
  { id: "agentGallery",   label: "Gallery",         icon: <ImageIcon size={12}/> },
  { id: "esp32",          label: "ESP32",           icon: <Cpu size={12}/> },
  { id: "publicMirror",   label: "Public Mirror",   icon: <Eye size={12}/> },
  { id: "branchResolution",label:"Branch Resolve",  icon: <Check size={12}/> },
];

// ── CSS keyframes ──────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @keyframes agentIdle {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-3px); }
    }
    @keyframes agentBounce {
      0%, 100% { transform: translateY(0px) scaleY(1); }
      45% { transform: translateY(-5px) scaleY(1.05); }
      55% { transform: translateY(-5px) scaleY(1.05); }
    }
    @keyframes agentHop {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      25% { transform: translateY(-4px) rotate(-3deg); }
      75% { transform: translateY(-4px) rotate(3deg); }
    }
    @keyframes agentFloat {
      0%, 100% { transform: translateY(0px) rotate(-1deg); }
      50% { transform: translateY(-4px) rotate(1deg); }
    }
    @keyframes agentWalk {
      0% { transform: translateX(-30px) translateY(0px); }
      25% { transform: translateX(-15px) translateY(-2px); }
      50% { transform: translateX(0px) translateY(0px); }
      75% { transform: translateX(15px) translateY(-2px); }
      100% { transform: translateX(30px) translateY(0px); }
    }
    @keyframes bubblePop {
      0% { opacity: 0; transform: scale(0.7) translateY(4px); }
      15% { opacity: 1; transform: scale(1.05) translateY(0); }
      80% { opacity: 1; transform: scale(1) translateY(0); }
      100% { opacity: 0; transform: scale(0.9) translateY(-2px); }
    }
    @keyframes energyPulse {
      0%, 100% { stroke-dashoffset: 0; opacity: 0.7; }
      50% { stroke-dashoffset: -20; opacity: 1; }
    }
    @keyframes spotlightPulse {
      0%, 100% { opacity: 0.08; }
      50% { opacity: 0.14; }
    }
    @keyframes visitorGlow {
      0%, 100% { filter: drop-shadow(0 0 4px #E8191A80); }
      50% { filter: drop-shadow(0 0 10px #E8191A); }
    }
    @keyframes shimmer {
      0% { opacity: 0.5; }
      50% { opacity: 1; }
      100% { opacity: 0.5; }
    }
    @keyframes captureScan {
      0%, 100% { top: 16%; opacity: 0.45; }
      50% { top: 79%; opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .capture-scan-line { animation: none !important; top: 48% !important; }
    }
    /* Autonomous wander paths — each agent follows a unique looping route */
    @keyframes wander1 {
      0%   { transform: translate(0px,   0px);   }
      15%  { transform: translate(38px,  -28px); }
      30%  { transform: translate(65px,  12px);  }
      45%  { transform: translate(42px,  50px);  }
      60%  { transform: translate(-10px, 38px);  }
      75%  { transform: translate(-34px, -8px);  }
      90%  { transform: translate(10px,  -30px); }
      100% { transform: translate(0px,   0px);   }
    }
    @keyframes wander2 {
      0%   { transform: translate(0px,   0px);   }
      20%  { transform: translate(-45px, 20px);  }
      40%  { transform: translate(-20px, 55px);  }
      60%  { transform: translate(30px,  42px);  }
      80%  { transform: translate(50px,  -10px); }
      100% { transform: translate(0px,   0px);   }
    }
    @keyframes wander3 {
      0%   { transform: translate(0px,   0px);   }
      18%  { transform: translate(28px,  38px);  }
      36%  { transform: translate(-15px, 60px);  }
      54%  { transform: translate(-48px, 22px);  }
      72%  { transform: translate(-30px, -20px); }
      90%  { transform: translate(18px,  -35px); }
      100% { transform: translate(0px,   0px);   }
    }
    @keyframes wander4 {
      0%   { transform: translate(0px,   0px);   }
      25%  { transform: translate(52px,  -15px); }
      50%  { transform: translate(38px,  48px);  }
      75%  { transform: translate(-22px, 30px);  }
      100% { transform: translate(0px,   0px);   }
    }
    @keyframes wander5 {
      0%   { transform: translate(0px,   0px);   }
      20%  { transform: translate(-38px, -22px); }
      40%  { transform: translate(-55px, 25px);  }
      60%  { transform: translate(-18px, 55px);  }
      80%  { transform: translate(25px,  28px);  }
      100% { transform: translate(0px,   0px);   }
    }
    @keyframes wander6 {
      0%   { transform: translate(0px,   0px);   }
      16%  { transform: translate(30px,  -40px); }
      33%  { transform: translate(58px,  10px);  }
      50%  { transform: translate(32px,  52px);  }
      66%  { transform: translate(-18px, 44px);  }
      83%  { transform: translate(-40px, -12px); }
      100% { transform: translate(0px,   0px);   }
    }
    ::-webkit-scrollbar { display: none; }
    * { scrollbar-width: none; }
    #root, #root * {
      font-family: 'Fusion Pixel 10px Monospaced SC', 'PingFang SC', 'Microsoft YaHei', sans-serif !important;
      font-synthesis: none;
    }
    .font-hand { font-family: 'Caveat', cursive; }
    .font-body { font-family: 'Press Start 2P', monospace; }
    .font-mono { font-family: 'VT323', monospace; }
  `}</style>
);

// ── TOP-DOWN MAP CONSTANTS ─────────────────────────────────────────────────────
const MAP_W = 2400;
const MAP_H = 480;
const ROAD_Y = 230;
const ROAD_H = 58;

// ── TOP-DOWN MAP HELPERS ───────────────────────────────────────────────────────

// Wavy grass fill
function GrassField({ x, y, w, h, color = "#8AB840", lineColor = "#6A9828", waves = 6, stroke = "#1C191110" }: {
  x: number; y: number; w: number; h: number;
  color?: string; lineColor?: string; waves?: number; stroke?: string;
}) {
  const waveH = h / waves;
  const paths = Array.from({ length: waves }, (_, i) => {
    const wy = y + i * waveH + waveH * 0.5;
    const segs = Math.ceil(w / 80);
    let d = `M${x},${wy}`;
    for (let s = 0; s < segs; s++) {
      const x1 = x + s * 80 + 20, y1 = wy - 4;
      const x2 = x + s * 80 + 60, y2 = wy + 4;
      const x3 = x + s * 80 + 80, y3 = wy;
      d += ` C${x1},${y1} ${x2},${y2} ${x3},${y3}`;
    }
    return d;
  });
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={color}/>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={lineColor} strokeWidth="1.2" opacity="0.45"/>
      ))}
    </g>
  );
}

// Flat road strip
function MapRoad({ y = ROAD_Y, h = ROAD_H, mapW = MAP_W, roadColor = "#C8C2B4", lineColor = "#1C1911" }: {
  y?: number; h?: number; mapW?: number; roadColor?: string; lineColor?: string;
}) {
  const midY = y + h / 2;
  return (
    <g>
      <rect x={0} y={y} width={mapW} height={h} fill={roadColor}/>
      <line x1={0} y1={y} x2={mapW} y2={y} stroke={lineColor} strokeWidth="1.2" opacity="0.3"/>
      <line x1={0} y1={y+h} x2={mapW} y2={y+h} stroke={lineColor} strokeWidth="1.2" opacity="0.3"/>
      {/* center dash */}
      <line x1={0} y1={midY} x2={mapW} y2={midY}
        stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeDasharray="24,18"/>
    </g>
  );
}

// Front-elevation building sprite (top-down orthographic)
function MapBuild({ x, floorY = ROAD_Y, w, wallH, roofH = 22,
  wallColor, roofColor, windowColor = "#D8EAF8", stroke = "#1C1911",
  label, labelColor = "#FAF6EF", doors = true, children,
}: {
  x: number; floorY?: number; w: number; wallH: number; roofH?: number;
  wallColor: string; roofColor: string; windowColor?: string; stroke?: string;
  label?: string; labelColor?: string; doors?: boolean; children?: React.ReactNode;
}) {
  const wallTop = floorY - wallH;
  const roofTop = wallTop - roofH;
  const peakX = x + w / 2;
  return (
    <g>
      {/* Shadow */}
      <rect x={x+3} y={floorY+4} width={w} height={8} rx={4} fill="rgba(0,0,0,0.08)"/>
      {/* Wall */}
      <rect x={x} y={wallTop} width={w} height={wallH} fill={wallColor} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Roof triangle */}
      <polygon points={`${x},${wallTop} ${peakX},${roofTop} ${x+w},${wallTop}`}
        fill={roofColor} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Windows: 2 per 60px of width */}
      {Array.from({ length: Math.max(1, Math.floor(w / 60)) }, (_, i) => {
        const ww = 16, wh = 14;
        const cols = Math.max(1, Math.floor(w / 60));
        const gap = w / (cols + 1);
        const wx = x + gap * (i + 1) - ww / 2;
        const wy = wallTop + wallH * 0.28;
        return (
          <rect key={i} x={wx} y={wy} width={ww} height={wh} rx={2}
            fill={windowColor} stroke={stroke} strokeWidth="0.8"/>
        );
      })}
      {/* Door */}
      {doors && (
        <rect x={peakX - 6} y={floorY - 20} width={12} height={20} rx={2}
          fill="#8B6040" stroke={stroke} strokeWidth="0.8"/>
      )}
      {/* Label */}
      {label && (
        <text x={peakX} y={wallTop - 6} textAnchor="middle"
          fontSize="10" fontFamily="Caveat,cursive" fill={labelColor} fontWeight="700"
          stroke="rgba(0,0,0,0.15)" strokeWidth="2" paintOrder="stroke">{label}</text>
      )}
      {children}
    </g>
  );
}

// Tree viewed from above (top-down) — overlapping circles
function MapTree({ cx, cy, r = 14, c1 = "#6B9E7A", c2 = "#8AB840", c3 = "#4A7A48", stroke = "#1C1911" }: {
  cx: number; cy: number; r?: number; c1?: string; c2?: string; c3?: string; stroke?: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy + r * 0.4} r={r * 0.75} fill={c3} stroke={stroke} strokeWidth="1"/>
      <circle cx={cx - r * 0.5} cy={cy} r={r * 0.72} fill={c1} stroke={stroke} strokeWidth="1"/>
      <circle cx={cx + r * 0.5} cy={cy} r={r * 0.72} fill={c1} stroke={stroke} strokeWidth="1"/>
      <circle cx={cx} cy={cy - r * 0.3} r={r} fill={c2} stroke={stroke} strokeWidth="1.2"/>
    </g>
  );
}

// City scroller wrapper — manages horizontal pan
function CityScroller({ children, mapW = MAP_W, viewH = MAP_H, accent = "#E8634A" }: {
  children: React.ReactNode; mapW?: number; viewH?: number; accent?: string;
}) {
  const [viewX, setViewX] = useState(0);
  const vw = 390;
  const maxX = mapW - vw;
  const step = 160;
  const progress = maxX > 0 ? viewX / maxX : 0;

  return (
    <div style={{ position: "relative", overflow: "hidden", height: viewH, width: "100%" }}>
      <svg width={vw} height={viewH} viewBox={`${viewX} 0 ${vw} ${viewH}`}
        style={{ display: "block" }}>
        {children}
      </svg>

      {/* Left arrow */}
      {viewX > 0 && (
        <button
          onClick={() => setViewX(x => Math.max(0, x - step))}
          style={{
            position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)",
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(255,255,255,0.9)", border: `2px solid ${accent}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)", cursor: "pointer",
            fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", color: accent,
            lineHeight: 1
          }}>‹</button>
      )}

      {/* Right arrow */}
      {viewX < maxX && (
        <button
          onClick={() => setViewX(x => Math.min(maxX, x + step))}
          style={{
            position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(255,255,255,0.9)", border: `2px solid ${accent}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)", cursor: "pointer",
            fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", color: accent,
            lineHeight: 1
          }}>›</button>
      )}

      {/* Scroll progress bar */}
      <div style={{
        position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)",
        width: 80, height: 4, borderRadius: 2,
        background: "rgba(255,255,255,0.4)"
      }}>
        <div style={{
          width: `${(1/6)*100}%`, height: "100%", borderRadius: 2,
          background: accent, transform: `translateX(${progress * 500}%)`,
          transition: "transform 0.2s ease"
        }}/>
      </div>
    </div>
  );
}

// Placeholder for old IsoTree (used in agent screens) — keep as top-down circle cluster
function IsoTree({ cx, cy, scale = 1, tc = "#7A5830", lc = "#6B9E7A", stroke = "#1C1911" }: {
  cx: number; cy: number; scale?: number; tc?: string; lc?: string; stroke?: string;
}) {
  return <MapTree cx={cx} cy={cy} r={12*scale} c1={lc} c2={lc} c3={tc} stroke={stroke}/>;
}

// Hand-drawn action bubble
function ActionBubble({ x, y, text, accent = "#E8634A", delay = 0, duration = 4 }: {
  x: number; y: number; text: string; accent?: string;
  delay?: number; duration?: number;
}) {
  const w = Math.max(56, text.length * 5.2 + 14);
  return (
    <g style={{ animation: `bubblePop ${duration}s ${delay}s ease-in-out infinite` }}>
      <rect x={x-w/2} y={y-22} width={w} height={18} rx={5}
        fill="rgba(255,255,255,0.96)" stroke={accent} strokeWidth="1.4"/>
      <polygon points={`${x-4},${y-4} ${x+4},${y-4} ${x},${y+3}`}
        fill="rgba(255,255,255,0.96)" stroke={accent} strokeWidth="1.4"/>
      <text x={x} y={y-10} textAnchor="middle" fontSize="7"
        fontFamily="Caveat,cursive" fill="#1C1911" fontWeight="600">{text}</text>
    </g>
  );
}

// ── OBJECT AGENT SVGs ──────────────────────────────────────────────────────────

function MugAgent({ x, y, s = 1, accent = "#E8634A", animated = true, action = "idle" }: {
  x: number; y: number; s?: number; accent?: string; animated?: boolean; action?: string;
}) {
  const anim = animated
    ? action === "walk"
      ? "agentWalk 4s ease-in-out infinite"
      : "agentIdle 2.2s ease-in-out infinite"
    : undefined;
  return (
    <g transform={`translate(${x},${y})`} style={anim ? { animation: anim } : undefined}>
      {/* Body */}
      <rect x={-9*s} y={-17*s} width={18*s} height={21*s} rx={3*s}
        fill={accent} stroke="#1C1911" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Handle */}
      <path d={`M${9*s},${-9*s} Q${16*s},${-9*s} ${16*s},${-3*s} Q${16*s},${3*s} ${9*s},${3*s}`}
        fill="none" stroke="#1C1911" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Eye whites */}
      <circle cx={-3.5*s} cy={-9*s} r={2.8*s} fill="white" stroke="#1C1911" strokeWidth="0.8"/>
      <circle cx={3.5*s} cy={-9*s} r={2.8*s} fill="white" stroke="#1C1911" strokeWidth="0.8"/>
      {/* Pupils */}
      <circle cx={-3*s} cy={-9*s} r={1.3*s} fill="#1C1911"/>
      <circle cx={4*s} cy={-9*s} r={1.3*s} fill="#1C1911"/>
      {/* Shine */}
      <circle cx={-2.2*s} cy={-9.8*s} r={0.55*s} fill="white"/>
      <circle cx={4.8*s} cy={-9.8*s} r={0.55*s} fill="white"/>
      {/* Smile */}
      <path d={`M${-3*s},${-3*s} Q${0},${0} ${3*s},${-3*s}`}
        fill="none" stroke="#1C1911" strokeWidth="1" strokeLinecap="round"/>
      {/* Legs */}
      <line x1={-5*s} y1={4*s} x2={-6*s} y2={9*s} stroke="#1C1911" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1={5*s} y1={4*s} x2={6*s} y2={9*s} stroke="#1C1911" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Feet */}
      <ellipse cx={-6*s} cy={10*s} rx={3.5*s} ry={1.8*s} fill="#1C1911"/>
      <ellipse cx={6*s} cy={10*s} rx={3.5*s} ry={1.8*s} fill="#1C1911"/>
      {/* Steam */}
      <path d={`M${-3*s},${-19*s} Q${-1*s},${-23*s} ${-3*s},${-27*s}`}
        fill="none" stroke="#1C191160" strokeWidth="1" strokeLinecap="round"/>
      <path d={`M${2*s},${-19*s} Q${4*s},${-23*s} ${2*s},${-27*s}`}
        fill="none" stroke="#1C191160" strokeWidth="1" strokeLinecap="round"/>
    </g>
  );
}

function CameraAgent({ x, y, s = 1, accent = "#4A7FA5", animated = true }: {
  x: number; y: number; s?: number; accent?: string; animated?: boolean;
}) {
  return (
    <g transform={`translate(${x},${y})`}
      style={animated ? { animation: "agentIdle 2.5s ease-in-out infinite" } : undefined}>
      {/* Body */}
      <rect x={-12*s} y={-13*s} width={24*s} height={18*s} rx={2.5*s}
        fill={accent} stroke="#1C1911" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Viewfinder bump */}
      <rect x={-4*s} y={-18*s} width={9*s} height={6*s} rx={1.5*s}
        fill={accent} stroke="#1C1911" strokeWidth="1.2"/>
      {/* Lens = eye */}
      <circle cx={0} cy={-5*s} r={7*s} fill="#D8E8F0" stroke="#1C1911" strokeWidth="1.5"/>
      <circle cx={0} cy={-5*s} r={4.5*s} fill="#1A2A3A" stroke="#1C1911" strokeWidth="1"/>
      <circle cx={0} cy={-5*s} r={2.2*s} fill="#0A0A18"/>
      <circle cx={1.8*s} cy={-7*s} r={1.2*s} fill="white"/>
      {/* Grip arm left */}
      <path d={`M${-12*s},${-7*s} Q${-19*s},${-5*s} ${-17*s},${2*s}`}
        fill="none" stroke="#1C1911" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Shutter arm right */}
      <line x1={12*s} y1={-6*s} x2={18*s} y2={-2*s} stroke="#1C1911" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Legs */}
      <line x1={-5*s} y1={5*s} x2={-6*s} y2={10*s} stroke="#1C1911" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1={5*s} y1={5*s} x2={6*s} y2={10*s} stroke="#1C1911" strokeWidth="1.8" strokeLinecap="round"/>
      <ellipse cx={-6*s} cy={11*s} rx={3.5*s} ry={1.8*s} fill="#1C1911"/>
      <ellipse cx={6*s} cy={11*s} rx={3.5*s} ry={1.8*s} fill="#1C1911"/>
      {/* Flash indicator */}
      <circle cx={8*s} cy={-11*s} r={1.5*s} fill="#FFF8D0" stroke="#1C1911" strokeWidth="0.7"/>
    </g>
  );
}

function BookAgent({ x, y, s = 1, accent = "#4A7FA5", animated = true }: {
  x: number; y: number; s?: number; accent?: string; animated?: boolean;
}) {
  return (
    <g transform={`translate(${x},${y})`}
      style={animated ? { animation: "agentFloat 3.2s ease-in-out infinite" } : undefined}>
      {/* Book body */}
      <rect x={-8*s} y={-20*s} width={16*s} height={24*s} rx={1.5*s}
        fill={accent} stroke="#1C1911" strokeWidth="1.5"/>
      {/* Spine */}
      <line x1={-8*s} y1={-20*s} x2={-8*s} y2={4*s} stroke="#1C191140" strokeWidth="1"/>
      {/* Page lines */}
      {[-14,-10,-6,-2].map((dy, i) => (
        <line key={i} x1={-5*s} y1={dy*s} x2={6*s} y2={dy*s}
          stroke="#1C191130" strokeWidth="0.7"/>
      ))}
      {/* Eyes */}
      <circle cx={-2.5*s} cy={-2*s} r={3*s} fill="white" stroke="#1C1911" strokeWidth="0.8"/>
      <circle cx={3.5*s} cy={-2*s} r={3*s} fill="white" stroke="#1C1911" strokeWidth="0.8"/>
      <circle cx={-2*s} cy={-2*s} r={1.4*s} fill="#1C1911"/>
      <circle cx={4*s} cy={-2*s} r={1.4*s} fill="#1C1911"/>
      <circle cx={-1.2*s} cy={-2.8*s} r={0.55*s} fill="white"/>
      <circle cx={4.8*s} cy={-2.8*s} r={0.55*s} fill="white"/>
      {/* Page-wing arms */}
      <path d={`M${8*s},${-14*s} Q${17*s},${-16*s} ${19*s},${-9*s}`}
        fill="none" stroke="#1C1911" strokeWidth="1.5" strokeLinecap="round"/>
      <path d={`M${-8*s},${-14*s} Q${-17*s},${-16*s} ${-19*s},${-9*s}`}
        fill="none" stroke="#1C1911" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Legs */}
      <line x1={-4*s} y1={4*s} x2={-5*s} y2={9*s} stroke="#1C1911" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1={4*s} y1={4*s} x2={5*s} y2={9*s} stroke="#1C1911" strokeWidth="1.8" strokeLinecap="round"/>
      <ellipse cx={-5*s} cy={10*s} rx={3.2*s} ry={1.7*s} fill="#1C1911"/>
      <ellipse cx={5*s} cy={10*s} rx={3.2*s} ry={1.7*s} fill="#1C1911"/>
    </g>
  );
}

function PlushAgent({ x, y, s = 1, accent = "#C890C0", animated = true }: {
  x: number; y: number; s?: number; accent?: string; animated?: boolean;
}) {
  return (
    <g transform={`translate(${x},${y})`}
      style={animated ? { animation: "agentBounce 2s ease-in-out infinite" } : undefined}>
      {/* Body */}
      <ellipse cx={0} cy={-5*s} rx={12*s} ry={13*s}
        fill={accent} stroke="#1C1911" strokeWidth="1.5"/>
      {/* Ears */}
      <circle cx={-9*s} cy={-16*s} r={5.5*s} fill={accent} stroke="#1C1911" strokeWidth="1.2"/>
      <circle cx={9*s} cy={-16*s} r={5.5*s} fill={accent} stroke="#1C1911" strokeWidth="1.2"/>
      <circle cx={-9*s} cy={-16*s} r={2.8*s} fill="#E8A8D8"/>
      <circle cx={9*s} cy={-16*s} r={2.8*s} fill="#E8A8D8"/>
      {/* Big eyes */}
      <circle cx={-4.5*s} cy={-7*s} r={4.5*s} fill="white" stroke="#1C1911" strokeWidth="1"/>
      <circle cx={4.5*s} cy={-7*s} r={4.5*s} fill="white" stroke="#1C1911" strokeWidth="1"/>
      <circle cx={-4*s} cy={-7*s} r={2.5*s} fill="#1C1911"/>
      <circle cx={5*s} cy={-7*s} r={2.5*s} fill="#1C1911"/>
      <circle cx={-3*s} cy={-8*s} r={1*s} fill="white"/>
      <circle cx={6*s} cy={-8*s} r={1*s} fill="white"/>
      {/* Nose */}
      <ellipse cx={0} cy={-2*s} rx={1.8*s} ry={1.2*s} fill="#1C1911"/>
      {/* Smile */}
      <path d={`M${-2.5*s},${0} Q${0},${3*s} ${2.5*s},${0}`}
        fill="none" stroke="#1C1911" strokeWidth="1" strokeLinecap="round"/>
      {/* Stubby arms */}
      <ellipse cx={-14*s} cy={-3*s} rx={4.5*s} ry={3*s}
        fill={accent} stroke="#1C1911" strokeWidth="1.2" transform={`rotate(-15,${-14*s},${-3*s})`}/>
      <ellipse cx={14*s} cy={-3*s} rx={4.5*s} ry={3*s}
        fill={accent} stroke="#1C1911" strokeWidth="1.2" transform={`rotate(15,${14*s},${-3*s})`}/>
      {/* Feet */}
      <ellipse cx={-6*s} cy={7*s} rx={6*s} ry={4*s} fill={accent} stroke="#1C1911" strokeWidth="1.2"/>
      <ellipse cx={6*s} cy={7*s} rx={6*s} ry={4*s} fill={accent} stroke="#1C1911" strokeWidth="1.2"/>
    </g>
  );
}

function LampAgent({ x, y, s = 1, accent = "#D4A800", animated = true }: {
  x: number; y: number; s?: number; accent?: string; animated?: boolean;
}) {
  return (
    <g transform={`translate(${x},${y})`}
      style={animated ? { animation: "agentIdle 2.8s ease-in-out infinite" } : undefined}>
      {/* Base */}
      <ellipse cx={0} cy={9*s} rx={7*s} ry={2.5*s} fill="#8B7040" stroke="#1C1911" strokeWidth="1.2"/>
      {/* Stand */}
      <line x1={-2*s} y1={9*s} x2={-3*s} y2={-12*s} stroke="#1C1911" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1={2*s} y1={9*s} x2={3*s} y2={-12*s} stroke="#1C1911" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Shade */}
      <path d={`M${-13*s},${-12*s} Q${-11*s},${-22*s} ${0},${-24*s} Q${11*s},${-22*s} ${13*s},${-12*s} Z`}
        fill={accent} stroke="#1C1911" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Shade rim */}
      <path d={`M${-13*s},${-12*s} Q${0},${-9*s} ${13*s},${-12*s}`}
        fill="none" stroke="#1C1911" strokeWidth="1"/>
      {/* Bulb glow */}
      <ellipse cx={0} cy={-9*s} rx={9*s} ry={6*s} fill="#FFF8D030"/>
      {/* Bulb eye */}
      <circle cx={0} cy={-13*s} r={4.5*s} fill="#FFF8D0" stroke="#1C1911" strokeWidth="1"/>
      <circle cx={0} cy={-13*s} r={2*s} fill={accent}/>
      <circle cx={0.8*s} cy={-13.8*s} r={0.7*s} fill="white"/>
      {/* Arm */}
      <path d={`M${-3*s},${-12*s} Q${-11*s},${-9*s} ${-14*s},${-4*s}`}
        fill="none" stroke="#1C1911" strokeWidth="1.5" strokeLinecap="round"/>
    </g>
  );
}

function HeadphonesAgent({ x, y, s = 1, accent = "#4A7FA5", animated = true }: {
  x: number; y: number; s?: number; accent?: string; animated?: boolean;
}) {
  return (
    <g transform={`translate(${x},${y})`}
      style={animated ? { animation: "agentHop 1.6s ease-in-out infinite" } : undefined}>
      {/* Band */}
      <path d={`M${-12*s},${-1*s} Q${-12*s},${-22*s} ${0},${-24*s} Q${12*s},${-22*s} ${12*s},${-1*s}`}
        fill="none" stroke="#1C1911" strokeWidth="3.5" strokeLinecap="round"/>
      {/* Left cup */}
      <circle cx={-13*s} cy={-1*s} r={7.5*s} fill="#2A2A3A" stroke="#1C1911" strokeWidth="1.5"/>
      <circle cx={-13*s} cy={-1*s} r={4.5*s} fill={accent} stroke="#1C1911" strokeWidth="1"/>
      {/* Right cup */}
      <circle cx={13*s} cy={-1*s} r={7.5*s} fill="#2A2A3A" stroke="#1C1911" strokeWidth="1.5"/>
      <circle cx={13*s} cy={-1*s} r={4.5*s} fill={accent} stroke="#1C1911" strokeWidth="1"/>
      {/* Eyes */}
      <circle cx={-13*s} cy={-1*s} r={2.2*s} fill="white"/>
      <circle cx={-12.3*s} cy={-1.7*s} r={1.1*s} fill="#1C1911"/>
      <circle cx={13*s} cy={-1*s} r={2.2*s} fill="white"/>
      <circle cx={13.7*s} cy={-1.7*s} r={1.1*s} fill="#1C1911"/>
      {/* Feet */}
      <rect x={-16*s} y={6*s} width={7*s} height={3*s} rx={1.5*s} fill="#1C1911"/>
      <rect x={9*s} y={6*s} width={7*s} height={3*s} rx={1.5*s} fill="#1C1911"/>
      {/* Notes */}
      <text x={-20*s} y={-14*s} fontSize={7*s} fill="#6B9E7A" fontFamily="serif">♪</text>
      <text x={14*s} y={-12*s} fontSize={5*s} fill={accent} fontFamily="serif">♫</text>
    </g>
  );
}

// Microphone Agent (Stardom)
function MicAgent({ x, y, s = 1, animated = true }: { x: number; y: number; s?: number; animated?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}
      style={animated ? { animation: "agentIdle 2.1s ease-in-out infinite" } : undefined}>
      {/* Mic head */}
      <ellipse cx={0} cy={-18*s} rx={6*s} ry={8*s}
        fill="#D0C8C0" stroke="#1C1911" strokeWidth="1.5"/>
      {/* Grille lines */}
      {[-20,-17,-14,-11].map((dy,i) => (
        <line key={i} x1={-5*s} y1={dy*s} x2={5*s} y2={dy*s}
          stroke="#1C191140" strokeWidth="0.8"/>
      ))}
      {/* Eye */}
      <circle cx={-2*s} cy={-16*s} r={1.8*s} fill="white" stroke="#1C1911" strokeWidth="0.7"/>
      <circle cx={2*s} cy={-16*s} r={1.8*s} fill="white" stroke="#1C1911" strokeWidth="0.7"/>
      <circle cx={-1.5*s} cy={-16*s} r={1*s} fill="#1C1911"/>
      <circle cx={2.5*s} cy={-16*s} r={1*s} fill="#1C1911"/>
      {/* Mouth */}
      <path d={`M${-2*s},${-12*s} Q${0},${-10*s} ${2*s},${-12*s}`}
        fill="none" stroke="#1C1911" strokeWidth="0.8" strokeLinecap="round"/>
      {/* Handle/body */}
      <rect x={-3*s} y={-10*s} width={6*s} height={16*s} rx={3*s}
        fill="#E8191A" stroke="#1C1911" strokeWidth="1.2"/>
      {/* Arms */}
      <path d={`M${-3*s},${-4*s} Q${-10*s},${-4*s} ${-12*s},${2*s}`}
        fill="none" stroke="#1C1911" strokeWidth="1.5" strokeLinecap="round"/>
      <path d={`M${3*s},${-4*s} Q${10*s},${-4*s} ${12*s},${2*s}`}
        fill="none" stroke="#1C1911" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Feet */}
      <line x1={-2*s} y1={6*s} x2={-3*s} y2={11*s} stroke="#1C1911" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1={2*s} y1={6*s} x2={3*s} y2={11*s} stroke="#1C1911" strokeWidth="1.8" strokeLinecap="round"/>
      <ellipse cx={-3*s} cy={12*s} rx={3*s} ry={1.5*s} fill="#1C1911"/>
      <ellipse cx={3*s} cy={12*s} rx={3*s} ry={1.5*s} fill="#1C1911"/>
    </g>
  );
}

// Rocket Agent (Future Colony)
function RocketAgent({ x, y, s = 1, animated = true }: { x: number; y: number; s?: number; animated?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}
      style={animated ? { animation: "agentFloat 2.8s ease-in-out infinite" } : undefined}>
      {/* Exhaust */}
      <path d={`M${-5*s},${8*s} Q${0},${14*s} ${5*s},${8*s}`}
        fill="none" stroke="#FF6030" strokeWidth="2" strokeLinecap="round"
        style={{ animation: "shimmer 0.8s ease-in-out infinite" }}/>
      {/* Body */}
      <path d={`M${-7*s},${8*s} L${-7*s},${-8*s} Q${-7*s},${-20*s} ${0},${-24*s} Q${7*s},${-20*s} ${7*s},${-8*s} L${7*s},${8*s} Z`}
        fill="#0070F3" stroke="#2A3048" strokeWidth="1.5"/>
      {/* Window (eye) */}
      <circle cx={0} cy={-8*s} r={5*s} fill="#D0E8FF" stroke="#2A3048" strokeWidth="1.2"/>
      <circle cx={0} cy={-8*s} r={3*s} fill="#0040A8"/>
      <circle cx={-0*s} cy={-8*s} r={1.5*s} fill="#0070F3"/>
      <circle cx={1.5*s} cy={-9.5*s} r={0.8*s} fill="white"/>
      {/* Fins */}
      <polygon points={`${-7*s},${4*s} ${-14*s},${10*s} ${-7*s},${10*s}`}
        fill="#00C8F0" stroke="#2A3048" strokeWidth="1.2"/>
      <polygon points={`${7*s},${4*s} ${14*s},${10*s} ${7*s},${10*s}`}
        fill="#00C8F0" stroke="#2A3048" strokeWidth="1.2"/>
      {/* Arms */}
      <line x1={-7*s} y1={0} x2={-13*s} y2={-3*s} stroke="#2A3048" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1={7*s} y1={0} x2={13*s} y2={-3*s} stroke="#2A3048" strokeWidth="1.5" strokeLinecap="round"/>
    </g>
  );
}

// Robot Agent (Future Colony)
function RobotAgent({ x, y, s = 1, animated = true }: { x: number; y: number; s?: number; animated?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}
      style={animated ? { animation: "agentIdle 1.9s ease-in-out infinite" } : undefined}>
      {/* Head */}
      <rect x={-8*s} y={-22*s} width={16*s} height={13*s} rx={2.5*s}
        fill="#8090A8" stroke="#2A3048" strokeWidth="1.5"/>
      {/* Antenna */}
      <line x1={0} y1={-22*s} x2={0} y2={-28*s} stroke="#2A3048" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx={0} cy={-29*s} r={2*s} fill="#0070F3" stroke="#2A3048" strokeWidth="1"/>
      {/* Eye screen */}
      <rect x={-6*s} y={-20*s} width={12*s} height={6*s} rx={1.5*s}
        fill="#0020A0" stroke="#2A3048" strokeWidth="0.8"/>
      <circle cx={-3*s} cy={-17*s} r={2*s} fill="#0070F3"/>
      <circle cx={3*s} cy={-17*s} r={2*s} fill="#00C8F0"/>
      {/* Body */}
      <rect x={-9*s} y={-9*s} width={18*s} height={15*s} rx={2*s}
        fill="#6878A0" stroke="#2A3048" strokeWidth="1.5"/>
      {/* Chest panel */}
      <rect x={-6*s} y={-7*s} width={12*s} height={7*s} rx={1*s}
        fill="#0020A0" stroke="#2A3048" strokeWidth="0.8"/>
      <circle cx={-3*s} cy={-3.5*s} r={1.5*s} fill="#0070F3"/>
      <circle cx={0} cy={-3.5*s} r={1.5*s} fill="#00C8F0"/>
      <circle cx={3*s} cy={-3.5*s} r={1.5*s} fill="#0070F3"/>
      {/* Arms */}
      <rect x={-14*s} y={-9*s} width={5*s} height={12*s} rx={2*s}
        fill="#8090A8" stroke="#2A3048" strokeWidth="1.2"/>
      <rect x={9*s} y={-9*s} width={5*s} height={12*s} rx={2*s}
        fill="#8090A8" stroke="#2A3048" strokeWidth="1.2"/>
      {/* Legs */}
      <rect x={-7*s} y={6*s} width={5*s} height={7*s} rx={1.5*s}
        fill="#6878A0" stroke="#2A3048" strokeWidth="1.2"/>
      <rect x={2*s} y={6*s} width={5*s} height={7*s} rx={1.5*s}
        fill="#6878A0" stroke="#2A3048" strokeWidth="1.2"/>
      <rect x={-8*s} y={12*s} width={6*s} height={3*s} rx={1*s} fill="#2A3048"/>
      <rect x={2*s} y={12*s} width={6*s} height={3*s} rx={1*s} fill="#2A3048"/>
    </g>
  );
}

type CurioKind = "plant" | "clock" | "key" | "globe" | "controller" | "umbrella";

function CurioAgent({ x, y, kind, s = 1, accent, animated = true }: {
  x: number; y: number; kind: CurioKind; s?: number; accent: string; animated?: boolean;
}) {
  const animation = kind === "globe"
    ? "agentFloat 3s ease-in-out infinite"
    : kind === "controller"
      ? "agentHop 1.8s ease-in-out infinite"
      : "agentIdle 2.4s ease-in-out infinite";
  const eyes = (eyeY: number, gap = 4) => (
    <>
      <circle cx={-gap*s} cy={eyeY*s} r={2.5*s} fill="white" stroke="#1C1911" strokeWidth="0.8"/>
      <circle cx={gap*s} cy={eyeY*s} r={2.5*s} fill="white" stroke="#1C1911" strokeWidth="0.8"/>
      <circle cx={(-gap+0.5)*s} cy={eyeY*s} r={1.15*s} fill="#1C1911"/>
      <circle cx={(gap+0.5)*s} cy={eyeY*s} r={1.15*s} fill="#1C1911"/>
    </>
  );
  const feet = (footY = 10, gap = 6) => (
    <>
      <line x1={-gap*s} y1={(footY-5)*s} x2={-gap*s} y2={footY*s} stroke="#1C1911" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1={gap*s} y1={(footY-5)*s} x2={gap*s} y2={footY*s} stroke="#1C1911" strokeWidth="1.6" strokeLinecap="round"/>
      <ellipse cx={-gap*s} cy={(footY+1)*s} rx={3.4*s} ry={1.7*s} fill="#1C1911"/>
      <ellipse cx={gap*s} cy={(footY+1)*s} rx={3.4*s} ry={1.7*s} fill="#1C1911"/>
    </>
  );

  return (
    <g transform={`translate(${x},${y})`} style={animated ? { animation } : undefined}>
      {kind === "plant" && (
        <>
          <path d={`M0,${-14*s} Q${-13*s},${-28*s} ${-15*s},${-12*s} Q${-6*s},${-7*s} 0,${-12*s}`} fill="#8FCB72" stroke="#1C1911" strokeWidth="1.3"/>
          <path d={`M0,${-14*s} Q${13*s},${-29*s} ${15*s},${-12*s} Q${7*s},${-7*s} 0,${-12*s}`} fill="#6B9E7A" stroke="#1C1911" strokeWidth="1.3"/>
          <path d={`M0,${-14*s} Q0,${-31*s} ${7*s},${-30*s} Q${10*s},${-18*s} 0,${-14*s}`} fill="#B8D4A0" stroke="#1C1911" strokeWidth="1.3"/>
          <path d={`M${-11*s},${-10*s} L${11*s},${-10*s} L${8*s},${7*s} L${-8*s},${7*s} Z`} fill={accent} stroke="#1C1911" strokeWidth="1.5" strokeLinejoin="round"/>
          {eyes(-4, 3.8)}
          <path d={`M${-2*s},${1*s} Q0,${3*s} ${2*s},${1*s}`} fill="none" stroke="#1C1911" strokeWidth="0.9"/>
          {feet(12, 5)}
        </>
      )}
      {kind === "clock" && (
        <>
          <path d={`M${-12*s},${-19*s} Q${-17*s},${-27*s} ${-22*s},${-18*s}`} fill={accent} stroke="#1C1911" strokeWidth="1.4"/>
          <path d={`M${12*s},${-19*s} Q${17*s},${-27*s} ${22*s},${-18*s}`} fill={accent} stroke="#1C1911" strokeWidth="1.4"/>
          <line x1={0} y1={-25*s} x2={0} y2={-29*s} stroke="#1C1911" strokeWidth="1.4"/>
          <circle cx={0} cy={-9*s} r={16*s} fill={accent} stroke="#1C1911" strokeWidth="1.6"/>
          <circle cx={0} cy={-9*s} r={12*s} fill="#FFF8E8" stroke="#1C1911" strokeWidth="1"/>
          {eyes(-8, 4)}
          <line x1={0} y1={-9*s} x2={0} y2={-17*s} stroke="#1C1911" strokeWidth="1.2"/>
          <line x1={0} y1={-9*s} x2={6*s} y2={-5*s} stroke="#1C1911" strokeWidth="1.2"/>
          {feet(12, 7)}
        </>
      )}
      {kind === "key" && (
        <>
          <circle cx={-6*s} cy={-12*s} r={11*s} fill={accent} stroke="#1C1911" strokeWidth="1.6"/>
          <circle cx={-6*s} cy={-12*s} r={5*s} fill="#FFF8E8" stroke="#1C1911" strokeWidth="1"/>
          <rect x={3*s} y={-15*s} width={19*s} height={6*s} rx={2*s} fill={accent} stroke="#1C1911" strokeWidth="1.5"/>
          <path d={`M${15*s},${-9*s} V${-3*s} H${21*s} V${-9*s}`} fill={accent} stroke="#1C1911" strokeWidth="1.5" strokeLinejoin="round"/>
          {eyes(-12, 3.3)}
          <path d={`M${-9*s},${-6*s} Q${-6*s},${-3*s} ${-3*s},${-6*s}`} fill="none" stroke="#1C1911" strokeWidth="0.9"/>
          {feet(7, 5)}
        </>
      )}
      {kind === "globe" && (
        <>
          <circle cx={0} cy={-10*s} r={16*s} fill="#DDF4FA" stroke="#1C1911" strokeWidth="1.6"/>
          <path d={`M${-13*s},${-5*s} Q0,${3*s} ${13*s},${-5*s}`} fill="#A8D8E8" opacity="0.9"/>
          <circle cx={-7*s} cy={-16*s} r={2*s} fill="white"/><circle cx={7*s} cy={-20*s} r={1.5*s} fill="white"/>
          <path d={`M0,${-23*s} L${2*s},${-18*s} L${7*s},${-18*s} L${3*s},${-15*s} L${5*s},${-10*s} L0,${-13*s} L${-5*s},${-10*s} L${-3*s},${-15*s} L${-7*s},${-18*s} L${-2*s},${-18*s} Z`} fill={accent} opacity="0.8"/>
          {eyes(-7, 4)}
          <rect x={-13*s} y={5*s} width={26*s} height={7*s} rx={2*s} fill={accent} stroke="#1C1911" strokeWidth="1.4"/>
          {feet(17, 6)}
        </>
      )}
      {kind === "controller" && (
        <>
          <path d={`M${-19*s},${-10*s} Q${-17*s},${-22*s} ${-7*s},${-20*s} H${7*s} Q${17*s},${-22*s} ${19*s},${-10*s} L${16*s},${5*s} Q${14*s},${12*s} ${8*s},${6*s} L${4*s},${2*s} H${-4*s} L${-8*s},${6*s} Q${-14*s},${12*s} ${-16*s},${5*s} Z`} fill={accent} stroke="#1C1911" strokeWidth="1.6" strokeLinejoin="round"/>
          {eyes(-12, 4)}
          <path d={`M${-10*s},${-4*s} H${-3*s} M${-6.5*s},${-7.5*s} V${-0.5*s}`} stroke="#1C1911" strokeWidth="2" strokeLinecap="round"/>
          <circle cx={8*s} cy={-5*s} r={2*s} fill="#E8634A" stroke="#1C1911" strokeWidth="0.7"/>
          <circle cx={13*s} cy={-1*s} r={2*s} fill="#D4A800" stroke="#1C1911" strokeWidth="0.7"/>
          {feet(13, 7)}
        </>
      )}
      {kind === "umbrella" && (
        <>
          <path d={`M${-21*s},${-10*s} Q${-16*s},${-28*s} 0,${-29*s} Q${16*s},${-28*s} ${21*s},${-10*s} Q${14*s},${-15*s} ${7*s},${-10*s} Q0,${-15*s} ${-7*s},${-10*s} Q${-14*s},${-15*s} ${-21*s},${-10*s} Z`} fill={accent} stroke="#1C1911" strokeWidth="1.6" strokeLinejoin="round"/>
          <line x1={0} y1={-28*s} x2={0} y2={6*s} stroke="#1C1911" strokeWidth="1.8"/>
          <path d={`M0,${6*s} Q0,${14*s} ${7*s},${13*s}`} fill="none" stroke="#1C1911" strokeWidth="2" strokeLinecap="round"/>
          {eyes(-4, 4)}
          <path d={`M${-3*s},${2*s} Q0,${4*s} ${3*s},${2*s}`} fill="none" stroke="#1C1911" strokeWidth="0.9"/>
          <line x1={-7*s} y1={7*s} x2={-7*s} y2={12*s} stroke="#1C1911" strokeWidth="1.6"/>
          <ellipse cx={-7*s} cy={13*s} rx={3.4*s} ry={1.7*s} fill="#1C1911"/>
        </>
      )}
    </g>
  );
}

type AgentProfile = {
  id: string;
  name: string;
  role: string;
  world: string;
  memories: number;
  color: string;
  badge?: string;
  esp32?: boolean;
  visiting?: boolean;
  render: (scale: number, animated: boolean) => React.ReactNode;
};

function PetSpriteAgent({ src, size, animated = true }: { src: string; size: number; animated?: boolean }) {
  return (
    <image
      href={src}
      x={-size / 2}
      y={-size / 2}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      style={{ animation: animated ? "agentIdle 2.4s ease-in-out infinite" : undefined }}
    />
  );
}

const AGENT_PROFILES: AgentProfile[] = [
  { id: "miko", name: "Miko", role: "Café Keeper", world: "Memory Town", memories: 12, color: "#E8634A", render: (s, animated) => <MugAgent x={0} y={4} s={s} accent="#E8634A" animated={animated}/> },
  { id: "shutter", name: "Shutter", role: "Archivist", world: "Memory Town", memories: 8, color: "#4A7FA5", esp32: true, render: (s, animated) => <CameraAgent x={0} y={4} s={s} accent="#4A7FA5" animated={animated}/> },
  { id: "nana", name: "Nana", role: "Comforter", world: "Memory Town", memories: 18, color: "#C890C0", render: (s, animated) => <PlushAgent x={0} y={6} s={s} accent="#C890C0" animated={animated}/> },
  { id: "folio", name: "Folio", role: "Memory Librarian", world: "Memory Town", memories: 24, color: "#4A7FA5", render: (s, animated) => <BookAgent x={0} y={4} s={s} accent="#4A7FA5" animated={animated}/> },
  { id: "luma", name: "Luma", role: "Night Guide", world: "Memory Town", memories: 6, color: "#D4A800", render: (s, animated) => <LampAgent x={0} y={6} s={s} accent="#D4A800" animated={animated}/> },
  { id: "beat", name: "Beat", role: "Music Broadcaster", world: "Memory Town", memories: 9, color: "#6B9E7A", render: (s, animated) => <HeadphonesAgent x={0} y={2} s={s} accent="#6B9E7A" animated={animated}/> },
  { id: "sprig", name: "Sprig", role: "Pocket Gardener", world: "Memory Town", memories: 14, color: "#6B9E7A", badge: "BOTANY", render: (s, animated) => <CurioAgent x={0} y={4} kind="plant" s={s} accent="#6B9E7A" animated={animated}/> },
  { id: "tock", name: "Tock", role: "Dawn Caller", world: "Memory Town", memories: 21, color: "#E88752", badge: "ALARM", render: (s, animated) => <CurioAgent x={0} y={4} kind="clock" s={s} accent="#E88752" animated={animated}/> },
  { id: "keylo", name: "Keylo", role: "Secret Keeper", world: "Stardom", memories: 7, color: "#C99A31", badge: "NFC", render: (s, animated) => <CurioAgent x={0} y={4} kind="key" s={s} accent="#C99A31" animated={animated}/> },
  { id: "orbit", name: "Orbit", role: "Weather Dreamer", world: "Colony", memories: 16, color: "#00A7C7", badge: "WEATHER", render: (s, animated) => <CurioAgent x={0} y={2} kind="globe" s={s} accent="#00A7C7" animated={animated}/> },
  { id: "joypad", name: "Joypad", role: "Quest Host", world: "Stardom", memories: 11, color: "#E8191A", badge: "PARTY", visiting: true, render: (s, animated) => <CurioAgent x={0} y={4} kind="controller" s={s} accent="#E8191A" animated={animated}/> },
  { id: "mizzle", name: "Mizzle", role: "Rain Walker", world: "Colony", memories: 5, color: "#0070F3", badge: "RAIN", render: (s, animated) => <CurioAgent x={0} y={4} kind="umbrella" s={s} accent="#0070F3" animated={animated}/> },
  { id: "dotti", name: "Dotti", role: "Memory Trail Keeper", world: "Memory Town", memories: 4, color: "#B67C42", badge: "PET", render: (s, animated) => <PetSpriteAgent src={petDachshundPng} size={92 * s} animated={animated}/> },
  { id: "siamese", name: "暹罗猫", role: "温柔陪伴者", world: "Memory Town", memories: 1, color: "#9B7653", badge: "PET", render: (s, animated) => <PetSpriteAgent src={petSiamesePng} size={78 * s} animated={animated}/> },
  { id: "momo", name: "Momo", role: "Quiet Companion", world: "Memory Town", memories: 7, color: "#E88752", badge: "PET", render: (s, animated) => <PetSpriteAgent src={petCatPng} size={78 * s} animated={animated}/> },
  { id: "puff", name: "Puff", role: "Dream Messenger", world: "Memory Town", memories: 3, color: "#C890C0", badge: "PET", render: (s, animated) => <PetSpriteAgent src={petRabbitPng} size={80 * s} animated={animated}/> },
  { id: "pip", name: "Pip", role: "Keepsake Collector", world: "Memory Town", memories: 5, color: "#4A4A46", badge: "PET", render: (s, animated) => <PetSpriteAgent src={petHamsterPng} size={76 * s} animated={animated}/> },
  { id: "chirp", name: "Chirp", role: "Morning Echo", world: "Memory Town", memories: 6, color: "#C6A83A", badge: "PET", render: (s, animated) => <PetSpriteAgent src={petBirdPng} size={76 * s} animated={animated}/> },
  { id: "mossback", name: "Mossback", role: "Long Memory Keeper", world: "Memory Town", memories: 32, color: "#6B9E7A", badge: "PET", render: (s, animated) => <PetSpriteAgent src={petTortoisePng} size={88 * s} animated={animated}/> },
];

const STYLE_AGENT_PROFILES: AgentProfile[] = WORLD_STYLE_SKILL_ASSETS.map(asset => {
  const style = WORLD_STYLE_SKILLS.find(item => item.id === asset.category) || WORLD_STYLE_SKILLS[0];
  return {
    id: asset.type,
    name: asset.defaultName,
    role: asset.defaultRole,
    world: style.label,
    memories: 0,
    color: style.accent,
    badge: style.label,
    render: (scale, animated) => {
      const size = 64 * scale;
      return (
        <image
          href={asset.src}
          x={-size / 2}
          y={-size / 2}
          width={size}
          height={size}
          preserveAspectRatio="xMidYMid meet"
          style={{ animation: animated ? "agentBounce 2.5s ease-in-out infinite" : undefined }}
        />
      );
    },
  };
});

const ALL_AGENT_PROFILES = [...AGENT_PROFILES, ...STYLE_AGENT_PROFILES];

const AGENT_STYLE_OPTIONS: {
  id: CharacterStyleCategory;
  label: string;
  accent: string;
  note: string;
}[] = [
  { id: "dailySpirits", label: "日常精灵", accent: "#E8634A", note: "由日常物件与陪伴生命醒来的线条精灵" },
  ...WORLD_STYLE_SKILLS,
];

type AgentPrivacy = "public" | "host" | "never";
type AgentPlacementMode = "living" | "static" | "building" | "esp32";
type AgentEditorDraft = {
  name: string;
  role: string;
  personality: string;
  goal: string;
  ability: string;
  fear: string;
  privacy: AgentPrivacy;
  animation: string;
  movement: string;
  placementMode: AgentPlacementMode;
};

const AGENT_EDITOR_STORAGE_KEY = "forkworld-existing-agent-settings-v1";
const AGENT_SKILL_LOADOUT_STORAGE_KEY = "forkworld-agent-skill-loadouts-v1";

const AGENT_ROLE_ZH: Record<string, string> = {
  "Café Keeper": "咖啡馆管理员",
  Archivist: "档案记录员",
  Comforter: "陪伴者",
  "Memory Librarian": "记忆图书管理员",
  "Night Guide": "夜间向导",
  "Music Broadcaster": "音乐广播员",
  "Pocket Gardener": "口袋园丁",
  "Dawn Caller": "晨光唤醒者",
  "Secret Keeper": "秘密守护者",
  "Weather Dreamer": "天气梦想家",
  "Quest Host": "任务主持人",
  "Rain Walker": "雨中行者",
  "Memory Trail Keeper": "记忆寻路犬",
  "Quiet Companion": "静默陪伴者",
  "Dream Messenger": "梦境信使",
  "Keepsake Collector": "纪念物收藏家",
  "Morning Echo": "晨光回声",
  "Long Memory Keeper": "长记忆守护者",
};

function localizedAgentRole(profile: AgentProfile) {
  return WORLD_STYLE_SKILL_ASSETS.find(asset => asset.type === profile.id)?.label
    || AGENT_ROLE_ZH[profile.role]
    || profile.role;
}

function defaultAgentDraft(profile: AgentProfile): AgentEditorDraft {
  const styleAsset = WORLD_STYLE_SKILL_ASSETS.find(asset => asset.type === profile.id);
  const role = localizedAgentRole(profile);
  return {
    name: profile.name,
    role,
    personality: styleAsset
      ? `${styleAsset.defaultTraits.join("、")}；会依据自己的经历、关系与文明规则逐步改变。`
      : `独立而有主见的${role}，会被自己的记忆、关系与所在文明持续塑造。`,
    goal: styleAsset?.defaultGoal || `继续参与${profile.world}的生活，同时守护居民共同拥有的记忆。`,
    ability: `运用${role}的专长帮助社区，并把经验分享给其他居民。`,
    fear: "失去自己最古老、最重要的那段记忆。",
    privacy: "public",
    animation: "Idle",
    movement: profile.id === "orbit" ? "Float" : profile.id === "joypad" ? "Hop" : "Walk",
    placementMode: profile.esp32 ? "esp32" : "living",
  };
}

function initialAgentDrafts(): Record<string, AgentEditorDraft> {
  const defaults = Object.fromEntries(
    ALL_AGENT_PROFILES.map(profile => [profile.id, defaultAgentDraft(profile)]),
  ) as Record<string, AgentEditorDraft>;

  if (typeof window === "undefined") return defaults;

  try {
    const stored = JSON.parse(window.localStorage.getItem(AGENT_EDITOR_STORAGE_KEY) || "{}") as
      Record<string, Partial<AgentEditorDraft>>;
    return Object.fromEntries(
      ALL_AGENT_PROFILES.map(profile => {
        const merged = { ...defaults[profile.id], ...(stored[profile.id] || {}) };
        const legacy = stored[profile.id] || {};
        if (typeof legacy.role === "string" && legacy.role === profile.role) merged.role = defaults[profile.id].role;
        if (typeof legacy.personality === "string" && legacy.personality.startsWith("Independent ")) merged.personality = defaults[profile.id].personality;
        if (typeof legacy.goal === "string" && legacy.goal.startsWith("Keep contributing to ")) merged.goal = defaults[profile.id].goal;
        if (typeof legacy.ability === "string" && legacy.ability.startsWith("Uses ")) merged.ability = defaults[profile.id].ability;
        if (legacy.fear === "Losing their oldest memory") merged.fear = defaults[profile.id].fear;
        return [profile.id, merged];
      }),
    ) as Record<string, AgentEditorDraft>;
  } catch {
    return defaults;
  }
}

// ── CITY SCENE DECORATIONS ─────────────────────────────────────────────────────

function Flower({ x, y, r = 5, stroke = "#1C191180" }: { x: number; y: number; r?: number; stroke?: string }) {
  return (
    <g>
      {[0,60,120,180,240,300].map(a => (
        <ellipse key={a}
          cx={x + Math.cos(a*Math.PI/180)*r*1.1}
          cy={y + Math.sin(a*Math.PI/180)*r*1.1}
          rx={r*0.55} ry={r*0.38}
          transform={`rotate(${a},${x + Math.cos(a*Math.PI/180)*r*1.1},${y + Math.sin(a*Math.PI/180)*r*1.1})`}
          fill="none" stroke={stroke} strokeWidth="0.9"/>
      ))}
      <circle cx={x} cy={y} r={r*0.35} fill="none" stroke={stroke} strokeWidth="0.9"/>
      <line x1={x} y1={y+r*1.6} x2={x} y2={y+r*3.2} stroke={stroke} strokeWidth="0.9"/>
    </g>
  );
}

function GrassTuft({ x, y, stroke = "#1C191150" }: { x: number; y: number; stroke?: string }) {
  return (
    <g stroke={stroke} strokeWidth="1" strokeLinecap="round">
      <line x1={x-5} y1={y} x2={x-8} y2={y-8}/>
      <line x1={x} y1={y} x2={x} y2={y-10}/>
      <line x1={x+5} y1={y} x2={x+8} y2={y-8}/>
    </g>
  );
}

function Shadow({ x, y, rx = 14, ry = 4 }: { x: number; y: number; rx?: number; ry?: number }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="rgba(28,25,17,0.08)"/>;
}

// ── CITY SCENES — scatter-field style ─────────────────────────────────────────

function EverydayTownSVG({ w = TOWN_MAP_W, h = 560, viewX = 0, activeAgentIds = [], eventAction, wanderOffsets }: {
  w?: number;
  h?: number;
  viewX?: number;
  activeAgentIds?: string[];
  eventAction?: string;
  wanderOffsets?: [number, number][];
}) {
  const d = DNA.everyday;
  const P = TOWN_PANEL_W; // 390 — one panel width
  const actionLabel = ({
    gather: "聚集",
    investigate: "观察",
    debate: "讨论",
    build: "制作",
    listen: "倾听",
    repair: "修理",
    play: "共玩",
    prepare: "准备",
    negotiate: "协商",
  } as Record<string, string>)[eventAction || ""] || "共享";

  // Agents live in center panel (panel 1), anchors offset by P
  const agents = [
    { id:"miko", ax: 85  + P, ay: 175, wander: "wander1", dur: "22s", delay: "0s",    Agent: () => <MugAgent        x={0} y={0} s={1.1}  accent={d.a1}/>,   name: "Miko"    },
    { id:"shutter", ax: 275 + P, ay: 145, wander: "wander2", dur: "18s", delay: "1.5s",  Agent: () => <CameraAgent     x={0} y={0} s={1.0}  accent={d.a3}/>,   name: "Shutter" },
    { id:"nana", ax: 95  + P, ay: 335, wander: "wander3", dur: "25s", delay: "3s",    Agent: () => <PlushAgent      x={0} y={0} s={1.0}  accent="#C890C0"/>, name: "Nana"    },
    { id:"folio", ax: 295 + P, ay: 310, wander: "wander4", dur: "20s", delay: "2s",    Agent: () => <BookAgent       x={0} y={0} s={0.95} accent={d.a3}/>,   name: "Folio"   },
    { id:"luma", ax: 145 + P, ay: 468, wander: "wander5", dur: "28s", delay: "0.5s",  Agent: () => <LampAgent       x={0} y={0} s={1.0}  accent={d.a2}/>,   name: "Luma"    },
    { id:"beat", ax: 305 + P, ay: 482, wander: "wander6", dur: "21s", delay: "4s",    Agent: () => <HeadphonesAgent x={0} y={0} s={0.95} accent={d.a3}/>,   name: "Beat"    },
    { id:"sprig", ax: 170 + P, ay: 105, wander: "wander2", dur: "24s", delay: "2.8s",  Agent: () => <CurioAgent x={0} y={0} kind="plant" s={0.82} accent="#6B9E7A"/>, name: "Sprig" },
    { id:"tock", ax: 338 + P, ay: 108, wander: "wander5", dur: "26s", delay: "1.2s",  Agent: () => <CurioAgent x={0} y={0} kind="clock" s={0.8} accent="#E88752"/>, name: "Tock" },
    { id:"dotti", ax: 195 + P, ay: 245, wander: "wander1", dur: "27s", delay: "1.1s", Agent: () => <PetSpriteAgent src={petDachshundPng} size={82} animated={false}/>, name: "Dotti" },
    { id:"momo", ax: 350 + P, ay: 405, wander: "wander3", dur: "23s", delay: "2.2s", Agent: () => <PetSpriteAgent src={petCatPng} size={58} animated={false}/>, name: "Momo" },
    { id:"puff", ax: 120, ay: 190, wander: "wander4", dur: "24s", delay: "0.7s", Agent: () => <PetSpriteAgent src={petRabbitPng} size={62} animated={false}/>, name: "Puff" },
    { id:"pip", ax: 275, ay: 390, wander: "wander2", dur: "19s", delay: "3.1s", Agent: () => <PetSpriteAgent src={petHamsterPng} size={54} animated={false}/>, name: "Pip" },
    { id:"chirp", ax: 85 + P * 2, ay: 185, wander: "wander6", dur: "20s", delay: "1.8s", Agent: () => <PetSpriteAgent src={petBirdPng} size={56} animated={false}/>, name: "Chirp" },
    { id:"mossback", ax: 260 + P * 2, ay: 390, wander: "wander5", dur: "29s", delay: "0.4s", Agent: () => <PetSpriteAgent src={petTortoisePng} size={72} animated={false}/>, name: "Mossback" },
  ];
  const activeAgents = agents.filter(agent => activeAgentIds.includes(agent.id));
  const eventHub = activeAgents.length ? {
    x: activeAgents.reduce((sum, agent) => sum + agent.ax, 0) / activeAgents.length,
    y: activeAgents.reduce((sum, agent) => sum + agent.ay, 0) / activeAgents.length,
  } : null;

  return (
    <svg width={w} height={h} viewBox={`${viewX} 0 ${w} ${h}`} style={{ background: d.paper, display: "block" }}>

      {/* ── Panel 0 (left exploration zone, x: 0–390) ── */}
      <Flower x={30}  y={120} r={5}/> <Flower x={210} y={72}  r={4}/> <Flower x={338} y={280} r={5}/>
      <Flower x={72}  y={380} r={4}/> <Flower x={298} y={460} r={4}/> <Flower x={168} y={520} r={5}/>
      <GrassTuft x={55}  y={158}/> <GrassTuft x={188} y={110}/> <GrassTuft x={318} y={320}/>
      <GrassTuft x={82}  y={422}/> <GrassTuft x={252} y={498}/> <GrassTuft x={128} y={260}/>
      <ellipse cx={148} cy={310} rx={6} ry={2.5} fill="rgba(28,25,17,0.07)"/>
      <ellipse cx={290} cy={185} rx={5} ry={2}   fill="rgba(28,25,17,0.07)"/>
      <text x={P * 0.5} y={88} textAnchor="middle" fontFamily="Caveat,cursive" fontSize="14"
        fill="rgba(28,25,17,0.18)">← west fields</text>

      {/* ── Panel 1 (center / home, x: 390–780) — original content ── */}
      <Flower x={55 + P}  y={105} r={5}/> <Flower x={318 + P} y={68}  r={4}/> <Flower x={178 + P} y={275} r={5}/>
      <Flower x={342 + P} y={345} r={4}/> <Flower x={88 + P}  y={435} r={5}/> <Flower x={272 + P} y={498} r={4}/>
      <Flower x={362 + P} y={198} r={4}/> <Flower x={38 + P}  y={318} r={4}/> <Flower x={198 + P} y={148} r={4}/>
      <Flower x={155 + P} y={540} r={4}/>
      <GrassTuft x={128 + P} y={168}/> <GrassTuft x={258 + P} y={128}/> <GrassTuft x={352 + P} y={298}/>
      <GrassTuft x={68  + P} y={372}/> <GrassTuft x={202 + P} y={452}/> <GrassTuft x={322 + P} y={418}/>
      <GrassTuft x={52  + P} y={242}/> <GrassTuft x={238 + P} y={385}/> <GrassTuft x={168 + P} y={55}/>
      <GrassTuft x={348 + P} y={498}/>
      <ellipse cx={202 + P} cy={322} rx={7} ry={2.5} fill="rgba(28,25,17,0.07)"/>
      <ellipse cx={332 + P} cy={148} rx={5} ry={2}   fill="rgba(28,25,17,0.07)"/>
      <ellipse cx={52  + P} cy={482} rx={6} ry={2}   fill="rgba(28,25,17,0.07)"/>
      <ellipse cx={168 + P} cy={208} rx={5} ry={2}   fill="rgba(28,25,17,0.07)"/>

      {/* Active civilization event: participants visibly connect before canon is written. */}
      {eventHub && (
        <g>
          {activeAgents.map(agent => (
            <line key={agent.id} x1={agent.ax} y1={agent.ay} x2={eventHub.x} y2={eventHub.y}
              stroke="#E8634A" strokeWidth="1.2" strokeDasharray="4 5" opacity="0.42"/>
          ))}
          <circle cx={eventHub.x} cy={eventHub.y} r={18} fill="#FAF6EF" stroke="#E8634A" strokeWidth="1.2" opacity="0.9"/>
          <text x={eventHub.x} y={eventHub.y + 3} textAnchor="middle" fontSize="6.5" fill="#E8634A" fontFamily="'Fusion Pixel 10px Monospaced SC',sans-serif">
            {actionLabel}
          </text>
        </g>
      )}

      {/* Wandering agents in center panel */}
      {agents.map(({ id, ax, ay, wander, dur, delay, Agent, name }, agentIndex) => {
        const isActive = activeAgentIds.includes(id);
        const sharedOffset = wanderOffsets?.[agentIndex];
        return (
        <g
          key={name}
          transform={sharedOffset ? `translate(${sharedOffset[0]},${sharedOffset[1]})` : undefined}
          style={sharedOffset ? undefined : { animation: `${wander} ${dur} ${delay} ease-in-out infinite` }}
        >
          <g style={{ animation: isActive ? "agentBounce 1.15s ease-in-out infinite" : undefined }}>
            {isActive && <circle cx={ax} cy={ay-4} r={24} fill="none" stroke="#E8634A" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.7"/>}
            <ellipse cx={ax} cy={ay + 14} rx={13} ry={4} fill="rgba(28,25,17,0.09)"/>
            <g transform={`translate(${ax},${ay})`}><Agent/></g>
          </g>
        </g>
      )})}

      {/* ── Panel 2 (right exploration zone, x: 780–1170) ── */}
      <Flower x={40  + P*2} y={95}  r={5}/> <Flower x={200 + P*2} y={60}  r={4}/> <Flower x={348 + P*2} y={310} r={5}/>
      <Flower x={90  + P*2} y={460} r={4}/> <Flower x={268 + P*2} y={510} r={4}/> <Flower x={138 + P*2} y={180} r={5}/>
      <Flower x={315 + P*2} y={390} r={4}/> <Flower x={58 + P*2}  y={280} r={4}/>
      <GrassTuft x={72  + P*2} y={140}/> <GrassTuft x={210 + P*2} y={100}/> <GrassTuft x={335 + P*2} y={260}/>
      <GrassTuft x={55  + P*2} y={390}/> <GrassTuft x={222 + P*2} y={470}/> <GrassTuft x={308 + P*2} y={430}/>
      <GrassTuft x={168 + P*2} y={320}/> <GrassTuft x={375 + P*2} y={180}/>
      <ellipse cx={182 + P*2} cy={295} rx={6} ry={2.5} fill="rgba(28,25,17,0.07)"/>
      <ellipse cx={312 + P*2} cy={155} rx={5} ry={2}   fill="rgba(28,25,17,0.07)"/>
      <text x={P * 2.5} y={88} textAnchor="middle" fontFamily="Caveat,cursive" fontSize="14"
        fill="rgba(28,25,17,0.18)">east fields →</text>
    </svg>
  );
}

type StyledSceneResident = {
  type: WorldStyleSkillAssetType;
  x: number;
  y: number;
  size: number;
  previewX: number;
  previewY: number;
  previewSize: number;
  footInset?: number;
  wander: string;
  duration: string;
  delay: string;
};

const STARDOM_BLOCK_RESIDENTS: StyledSceneResident[] = [
  { type:"blockCartographer", x:86,  y:190, size:86, previewX:62,  previewY:108, previewSize:58, footInset:0.088, wander:"wander1", duration:"22s", delay:"0s" },
  { type:"blockBeekeeper",    x:278, y:164, size:86, previewX:152, previewY:92,  previewSize:58, footInset:0.125, wander:"wander2", duration:"18s", delay:"1.5s" },
  { type:"blockMechanic",     x:104, y:382, size:86, previewX:244, previewY:110, previewSize:58, footInset:0.102, wander:"wander3", duration:"25s", delay:"3s" },
  { type:"blockFarmer",       x:286, y:350, size:86, previewX:326, previewY:88,  previewSize:58, footInset:0.128, wander:"wander4", duration:"20s", delay:"2s" },
];
const STARDOM_RESIDENT_NAMES = ["Atlas", "Honey", "Rivet", "Clover"];
const STARDOM_RESIDENT_COLORS = ["#579447", "#D4A800", "#4A7FA5", "#B66A3C"];
const STARDOM_EVENT_LOCATIONS = new Set(["Echo Bridge", "Commons Arcade", "Backstage Alleys"]);
const STARDOM_AGENT_RESIDENT_INDEX: Record<string, number> = { luma: 0, beat: 1, keylo: 2 };

function stardomResidentIndex(agentId: string) {
  return STARDOM_AGENT_RESIDENT_INDEX[agentId] ?? 3;
}

const FUTURE_LAKE_RESIDENTS: StyledSceneResident[] = [
  { type:"lakeCrow",   x:78,  y:174, size:74, previewX:38,  previewY:108, previewSize:44, footInset:0.08, wander:"wander2", duration:"20s", delay:"0.8s" },
  { type:"lakeCat",    x:278, y:160, size:76, previewX:96,  previewY:108, previewSize:44, footInset:0.12, wander:"wander5", duration:"26s", delay:"1.2s" },
  { type:"lakeOwl",    x:176, y:272, size:82, previewX:154, previewY:108, previewSize:44, footInset:0.10, wander:"wander3", duration:"23s", delay:"2.4s" },
  { type:"lakeRabbit", x:82,  y:402, size:84, previewX:212, previewY:108, previewSize:44, footInset:0.10, wander:"wander6", duration:"21s", delay:"3.4s" },
  { type:"lakeDeer",   x:286, y:388, size:90, previewX:270, previewY:108, previewSize:48, footInset:0.10, wander:"wander1", duration:"24s", delay:"1.8s" },
  { type:"lakeFrog",   x:180, y:512, size:78, previewX:328, previewY:108, previewSize:44, footInset:0.12, wander:"wander4", duration:"22s", delay:"2.8s" },
];
const FUTURE_RESIDENT_NAMES = ["Corvus", "Ink", "Noct", "Lapin", "Hart", "Moss"];
const FUTURE_RESIDENT_COLORS = ["#44443F", "#6A6957", "#8090A8", "#B8AFA0", "#8A725A", "#6B9E7A"];
const FUTURE_EVENT_LOCATIONS = new Set(["Low Orbit Yard", "Climate Balcony"]);
const FUTURE_AGENT_RESIDENT_INDEX: Record<string, number> = {
  orbit: 2,
  mizzle: 5,
  miko: 0,
  shutter: 1,
  nana: 3,
  folio: 4,
  luma: 2,
  beat: 5,
  sprig: 3,
  tock: 4,
  keylo: 0,
  joypad: 1,
};

function futureResidentIndex(agentId: string) {
  return FUTURE_AGENT_RESIDENT_INDEX[agentId] ?? 0;
}

function StyledSceneResidents({ residents, compact = false, pixelated = false, activeResidentIndexes = [], accent = "#E8634A" }: {
  residents: StyledSceneResident[];
  compact?: boolean;
  pixelated?: boolean;
  activeResidentIndexes?: number[];
  accent?: string;
}) {
  return (
    <g>
      {residents.map((resident, residentIndex) => {
        const asset = WORLD_STYLE_SKILL_ASSETS.find(item => item.type === resident.type);
        if (!asset) return null;
        const x = compact ? resident.previewX : resident.x;
        const y = compact ? resident.previewY : resident.y;
        const size = compact ? resident.previewSize : resident.size;
        const shadowY = y - size * (resident.footInset || 0) + 1;
        const isActive = activeResidentIndexes.includes(residentIndex);
        return (
          <g key={resident.type} style={{ animation: `${resident.wander} ${resident.duration} ${resident.delay} ease-in-out infinite` }}>
            {isActive && (
              <circle
                cx={x}
                cy={y - size * 0.49}
                r={size * 0.4}
                fill="none"
                stroke={accent}
                strokeWidth="1.2"
                strokeDasharray="3 4"
                opacity="0.72"
              />
            )}
            <ellipse cx={x} cy={shadowY} rx={size * 0.18} ry={size * 0.055} fill="rgba(28,25,17,0.10)"/>
            <image
              href={asset.src}
              x={x - size / 2}
              y={y - size}
              width={size}
              height={size}
              preserveAspectRatio="xMidYMid meet"
              style={{ imageRendering: pixelated ? "pixelated" : "auto" }}
            />
          </g>
        );
      })}
    </g>
  );
}

function StardomDistrictSVG({ w = 390, h = 560, activeResidentIndexes = [], eventAction }: {
  w?: number;
  h?: number;
  activeResidentIndexes?: number[];
  eventAction?: string;
}) {
  const d = DNA.stardom;
  const compact = h <= 200;
  const activeResidents = STARDOM_BLOCK_RESIDENTS.filter((_, index) => activeResidentIndexes.includes(index));
  const eventHub = activeResidents.length ? {
    x: activeResidents.reduce((sum, resident) => sum + resident.x, 0) / activeResidents.length,
    y: activeResidents.reduce((sum, resident) => sum + resident.y - resident.size * 0.45, 0) / activeResidents.length,
  } : null;
  const actionLabel = ({
    gather: "聚集",
    investigate: "观察",
    debate: "讨论",
    build: "制作",
    listen: "倾听",
    repair: "修理",
    play: "共玩",
    prepare: "准备",
    negotiate: "协商",
  } as Record<string, string>)[eventAction || ""] || "共享";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ background: d.paper }}>
      <title>Stardom District · 我的世界风格居民</title>
      {/* Star decorations instead of flowers */}
      {[[65,100],[315,80],[170,270],[345,330],[85,430],[280,490],[355,195],[45,310]].map(([fx,fy],i) => (
        <text key={i} x={fx} y={fy} fontSize="10" fill={d.a2} opacity="0.5" textAnchor="middle">★</text>
      ))}

      <GrassTuft x={135} y={170} stroke="#E8191A30"/>
      <GrassTuft x={265} y={135} stroke="#E8191A30"/>
      <GrassTuft x={355} y={305} stroke="#E8191A30"/>
      <GrassTuft x={72}  y={375} stroke="#E8191A30"/>
      <GrassTuft x={205} y={452} stroke="#E8191A30"/>
      <GrassTuft x={325} y={425} stroke="#E8191A30"/>

      {/* Spotlight glow under stage agents */}
      <ellipse cx={110} cy={165} rx={40} ry={20} fill={d.a1} opacity="0.06"
        style={{ animation: "spotlightPulse 2.5s ease-in-out infinite" }}/>
      <ellipse cx={270} cy={210} rx={35} ry={18} fill={d.a2} opacity="0.08"
        style={{ animation: "spotlightPulse 2s 0.8s ease-in-out infinite" }}/>

      {!compact && eventHub && (
        <g>
          {activeResidents.map(resident => (
            <line
              key={resident.type}
              x1={resident.x}
              y1={resident.y - resident.size * 0.45}
              x2={eventHub.x}
              y2={eventHub.y}
              stroke="#E8191A"
              strokeWidth="1.2"
              strokeDasharray="4 5"
              opacity="0.38"
            />
          ))}
          <circle cx={eventHub.x} cy={eventHub.y} r={18} fill="#FFF9FB" stroke="#E8191A" strokeWidth="1.2" opacity="0.94"/>
          <text
            x={eventHub.x}
            y={eventHub.y + 3}
            textAnchor="middle"
            fontSize="6.5"
            fill="#E8191A"
            fontFamily="'Fusion Pixel 10px Monospaced SC',sans-serif"
          >
            {actionLabel}
          </text>
        </g>
      )}

      <StyledSceneResidents
        residents={STARDOM_BLOCK_RESIDENTS}
        compact={compact}
        pixelated
        activeResidentIndexes={compact ? [] : activeResidentIndexes}
        accent="#E8191A"
      />
    </svg>
  );
}

function FutureColonySVG({ w = 390, h = 560, activeResidentIndexes = [], eventAction }: {
  w?: number;
  h?: number;
  activeResidentIndexes?: number[];
  eventAction?: string;
}) {
  const d = DNA.future;
  const compact = h <= 200;
  const activeResidents = FUTURE_LAKE_RESIDENTS.filter((_, index) => activeResidentIndexes.includes(index));
  const eventHub = activeResidents.length ? {
    x: activeResidents.reduce((sum, resident) => sum + resident.x, 0) / activeResidents.length,
    y: activeResidents.reduce((sum, resident) => sum + resident.y - resident.size * 0.45, 0) / activeResidents.length,
  } : null;
  const actionLabel = ({
    gather: "聚集",
    investigate: "观察",
    debate: "讨论",
    build: "制作",
    listen: "倾听",
    repair: "修理",
    play: "共玩",
    prepare: "准备",
    negotiate: "协商",
  } as Record<string, string>)[eventAction || ""] || "共享";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ background: d.paper }}>
      <title>Future Colony · 绣湖风格居民</title>
      {/* Circuit-dot decorations */}
      {[[65,105],[318,78],[175,275],[342,335],[88,432],[278,492],[358,198],[48,315],[220,160],[150,400]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r={2.5} fill="none" stroke={d.a1} strokeWidth="0.8" opacity="0.4"/>
      ))}
      {/* Dashed energy lines */}
      <line x1={40}  y1={90}  x2={160} y2={90}  stroke={d.a1} strokeWidth="0.8" strokeDasharray="4,6" opacity="0.3"/>
      <line x1={230} y1={260} x2={380} y2={260} stroke={d.a2} strokeWidth="0.8" strokeDasharray="4,6" opacity="0.3"/>
      <line x1={60}  y1={410} x2={200} y2={410} stroke={d.a1} strokeWidth="0.8" strokeDasharray="4,6" opacity="0.3"/>

      {!compact && eventHub && (
        <g>
          {activeResidents.map(resident => (
            <line
              key={resident.type}
              x1={resident.x}
              y1={resident.y - resident.size * 0.45}
              x2={eventHub.x}
              y2={eventHub.y}
              stroke={d.a1}
              strokeWidth="1.2"
              strokeDasharray="4 5"
              opacity="0.35"
            />
          ))}
          <circle cx={eventHub.x} cy={eventHub.y} r={18} fill="#F7F8FB" stroke={d.a1} strokeWidth="1.2" opacity="0.95"/>
          <text
            x={eventHub.x}
            y={eventHub.y + 3}
            textAnchor="middle"
            fontSize="6.5"
            fill={d.a1}
            fontFamily="'Fusion Pixel 10px Monospaced SC',sans-serif"
          >
            {actionLabel}
          </text>
        </g>
      )}

      <StyledSceneResidents
        residents={FUTURE_LAKE_RESIDENTS}
        compact={compact}
        activeResidentIndexes={compact ? [] : activeResidentIndexes}
        accent={d.a1}
      />
    </svg>
  );
}

// ── UI COMPONENTS ──────────────────────────────────────────────────────────────

function PhoneStatusBar({ world, showConnectivity = true }: { world?: WorldTheme; showConnectivity?: boolean }) {
  const time = "9:41";
  return (
    <div className="flex items-center justify-between px-6 py-2 text-xs font-mono"
      style={{ fontFamily: "VT323, monospace", fontSize: "var(--ui-font-heading)" }}>
      <span style={{ color: "#1C1911" }}>{time}</span>
      {showConnectivity && (
        <div className="flex gap-1 items-center">
          <Wifi size={11}/>
          <div className="w-5 h-2.5 rounded-sm border border-current flex">
            <div className="w-3/4 bg-current rounded-sm"/>
          </div>
        </div>
      )}
    </div>
  );
}

function BottomNav({ active, onNavigate }: {
  active: string;
  onNavigate: (s: Screen) => void;
}) {
  const tabs = [
    { id: "worldDock" as Screen,  icon: <Home size={20}/>,      label: "Home" },
    { id: "everydayTown" as Screen, icon: <Globe size={20}/>,   label: "World" },
    { id: "capture" as Screen,    icon: <Camera size={20}/>,    label: "Capture" },
    { id: "agentGallery" as Screen, icon: <Package size={20}/>, label: "Gallery" },
    { id: "esp32" as Screen,      icon: <Cpu size={20}/>,       label: "Device" },
  ];
  return (
    <div className="flex items-center justify-around px-2 pt-2 pb-4 border-t"
      style={{ borderColor: "rgba(28,25,17,0.1)", background: "#FAF6EF" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onNavigate(t.id)}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all"
          style={{
            color: active === t.id ? "#E8634A" : "#7A7468",
            background: active === t.id ? "#E8634A10" : "transparent"
          }}>
          {t.icon}
          <span style={{ fontSize: "var(--ui-font-body)", fontFamily: "Press Start 2P,monospace", fontWeight: 600 }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function PaperCard({ children, className = "", style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div className={`rounded-2xl ${className}`}
      style={{
        background: "#FAF6EF",
        border: "1.5px solid rgba(28,25,17,0.12)",
        boxShadow: "0 1px 6px rgba(28,25,17,0.06)",
        ...style
      }}>
      {children}
    </div>
  );
}

function HandTag({ text, color = "#E8634A" }: { text: string; color?: string }) {
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{
        background: color + "18",
        color,
        border: `1.2px solid ${color}40`,
        fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
        fontSize: "var(--ui-font-body)"
      }}>
      {text}
    </span>
  );
}

function PrivacyChip({ level }: { level: "public" | "host" | "never" }) {
  const map = {
    public: { label: "访客可见", color: "#6B9E7A", icon: <Eye size={10}/> },
    host:   { label: "仅本世界", color: "#4A7FA5", icon: <Lock size={10}/> },
    never:  { label: "永不导出", color: "#E8634A", icon: <X size={10}/> },
  };
  const c = map[level];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
      style={{
        background: c.color + "18",
        color: c.color,
        border: `1px solid ${c.color}40`,
        fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
        fontSize: "var(--ui-font-body)"
      }}>
      {c.icon} {c.label}
    </span>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-xs uppercase tracking-widest mb-2"
      style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", color: "#7A7468", fontSize: "var(--ui-font-body)" }}>
      {text}
    </p>
  );
}

function themedWorldAgentArt(agentId: string) {
  const profile = AGENT_PROFILES.find(agent => agent.id === agentId);
  return (
    <svg width="58" height="62" viewBox="-32 -34 64 70" aria-hidden="true">
      {profile?.render(0.82, false)}
    </svg>
  );
}

function themedStyleAgentArt(type: WorldStyleSkillAssetType) {
  return <PlazaStyleAgent type={type} size={58}/>;
}

function themedImageAgentArt(src: string) {
  return <img src={src} alt="" draggable={false} style={{ width: 58, height: 62, objectFit: "contain" }}/>;
}

function getThemedWorldResidents(): Record<ThemedWorldKey, ThemedWorldResident[]> {
  return {
    fitness: [
      {
        id: "dotti",
        name: "Dotti",
        role: "腊肠犬健身伙伴",
        color: "#B67C42",
        art: <img src={petDachshundPng} alt="" draggable={false} style={{ width: 62, height: 62, objectFit: "contain" }}/>,
        recordSourceId: "miko",
        featured: true,
      },
      { id: "miko", name: "Miko", role: "动作教练", color: "#E8634A", art: themedWorldAgentArt("miko"), recordSourceId: "miko" },
      { id: "shutter", name: "Shutter", role: "姿态记录员", color: "#4A7FA5", art: themedWorldAgentArt("shutter"), recordSourceId: "shutter" },
      { id: "nana", name: "Nana", role: "恢复陪伴员", color: "#C890C0", art: themedWorldAgentArt("nana"), recordSourceId: "nana" },
      { id: "folio", name: "Folio", role: "训练档案员", color: "#4A7FA5", art: themedWorldAgentArt("folio"), recordSourceId: "folio" },
      { id: "luma", name: "Luma", role: "夜间领跑员", color: "#D4A800", art: themedWorldAgentArt("luma"), recordSourceId: "luma" },
      { id: "beat", name: "Beat", role: "节奏领练员", color: "#6B9E7A", art: themedWorldAgentArt("beat"), recordSourceId: "beat" },
      { id: "sprig", name: "Sprig", role: "身体观察员", color: "#6B9E7A", art: themedWorldAgentArt("sprig"), recordSourceId: "sprig" },
      { id: "tock", name: "Tock", role: "恢复计时员", color: "#E88752", art: themedWorldAgentArt("tock"), recordSourceId: "tock" },
    ],
    learning: [
      { id: "atlas", name: "Atlas", role: "学习路径规划员", color: "#579447", art: themedStyleAgentArt("blockCartographer"), recordSourceId: "luma", featured: true },
      { id: "honey", name: "Honey", role: "小组学习员", color: "#D4A800", art: themedStyleAgentArt("blockBeekeeper"), recordSourceId: "beat" },
      { id: "puck", name: "Puck", role: "知识传递员", color: "#8A6A3A", art: themedStyleAgentArt("blockCourier"), recordSourceId: "keylo" },
      { id: "ember", name: "Ember", role: "实验课程员", color: "#B05F42", art: themedStyleAgentArt("blockAlchemist"), recordSourceId: "folio" },
      { id: "truffle", name: "Truffle", role: "户外探索学员", color: "#B98565", art: themedStyleAgentArt("blockPig"), recordSourceId: "orbit" },
      { id: "wooly", name: "Wooly", role: "互助学习员", color: "#D8C9A4", art: themedStyleAgentArt("blockSheep"), recordSourceId: "nana" },
      { id: "rivet", name: "Rivet", role: "教具维护员", color: "#4A7FA5", art: themedStyleAgentArt("blockMechanic"), recordSourceId: "shutter" },
      { id: "clover", name: "Clover", role: "课程种子管理员", color: "#6B9E7A", art: themedStyleAgentArt("blockFarmer"), recordSourceId: "sprig" },
    ],
    maker: [
      { id: "corvus", name: "Corvus", role: "故障记录员", color: "#4A4A46", art: themedStyleAgentArt("lakeCrow"), recordSourceId: "orbit", featured: true },
      { id: "ink", name: "Ink", role: "安全边界员", color: "#6A6957", art: themedStyleAgentArt("lakeCat"), recordSourceId: "joypad" },
      { id: "noct", name: "Noct", role: "原型观察员", color: "#7D725F", art: themedStyleAgentArt("lakeOwl"), recordSourceId: "mizzle" },
      { id: "lapin", name: "Lapin", role: "零件信使", color: "#B8AFA0", art: themedStyleAgentArt("lakeRabbit"), recordSourceId: "miko" },
      { id: "hart", name: "Hart", role: "边界测试员", color: "#8A725A", art: themedStyleAgentArt("lakeDeer"), recordSourceId: "nana" },
      { id: "moss", name: "Moss", role: "材料回收员", color: "#6B7A55", art: themedStyleAgentArt("lakeFrog"), recordSourceId: "shutter" },
      { id: "dale", name: "Dale", role: "原型档案员", color: "#566052", art: themedImageAgentArt(lakeArchivistPng), recordSourceId: "folio" },
      { id: "iris", name: "Iris", role: "材料培育员", color: "#7B6A45", art: themedImageAgentArt(lakeBotanistPng), recordSourceId: "sprig" },
    ],
  };
}

function getCrossWorldVisitors(worldKey: ThemedWorldKey): ThemedWorldResident[] {
  const residents = getThemedWorldResidents();
  const visitorSources: Record<ThemedWorldKey, [ThemedWorldKey, string][]> = {
    fitness: [["learning", "atlas"], ["maker", "corvus"]],
    learning: [["fitness", "dotti"], ["maker", "corvus"]],
    maker: [["fitness", "dotti"], ["learning", "atlas"]],
  };
  return visitorSources[worldKey].map(([sourceWorld, residentId]) => {
    const source = residents[sourceWorld].find(resident => resident.id === residentId)!;
    return {
      ...source,
      id: `visitor-${sourceWorld}-${source.id}`,
      role: `串门访客 · 来自 ${THEMED_WORLDS[sourceWorld].buildingName}`,
      featured: false,
      visitor: true,
    };
  });
}

// ── SCREENS ────────────────────────────────────────────────────────────────────

// 1. WORLD DOCK
function WorldDockScreen({
  navigate,
  sceneControl,
  onOpenChronicle,
  customWorld,
  onCreateWorld,
  onOpenCustomWorld,
}: {
  navigate: (s: Screen) => void;
  sceneControl: React.ReactNode;
  onOpenChronicle: () => void;
  customWorld?: { config: ThemedWorldConfig; residents: ThemedWorldResident[]; houseId: string } | null;
  onCreateWorld: () => void;
  onOpenCustomWorld: () => void;
}) {
  const residents = getThemedWorldResidents();
  const worldCards: { key: ThemedWorldKey; screen: Screen; houseId: string }[] = [
    { key: "fitness", screen: "everydayTown", houseId: "H04" },
    { key: "learning", screen: "stardomDistrict", houseId: "H12" },
    { key: "maker", screen: "futureColony", houseId: "H20" },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto"
      style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="px-5 pt-1 flex justify-end">{sceneControl}</div>
      <div className="px-5 pt-2 pb-3">
        <div className="w-full">
          <h1 style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-display)", fontWeight: 700, color: "#1C1911", lineHeight: 1 }}>
            ForkWorld
          </h1>
          <p style={{ fontSize: "var(--ui-font-label)", color: "#7A7468", whiteSpace: "nowrap", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
            {AGENT_PROFILES.length} 位智能体 · {PLAZA_SKILLS.length} 种skills · {AGENT_PROFILES.reduce((total, agent) => total + agent.memories, 0)} 段记忆 · 2 位访客
          </p>
        </div>
      </div>

      <div className="px-5 pb-3">
        <button onClick={onOpenChronicle} className="w-full rounded-2xl p-3 text-left"
          style={{
            background: "linear-gradient(120deg, rgba(107,158,122,.14), rgba(74,127,165,.09))",
            border: "1.5px solid rgba(107,158,122,.32)",
          }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#FAF6EF", color: "#6B9E7A" }}>
                <BookOpen size={17}/>
              </div>
              <div>
                <p style={{ color: "#1C1911", fontSize: "var(--ui-font-label)", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>Agent正在自我进化</p>
                <p style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)", marginTop: 4, fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>对话 · 记忆 · 关系 · 历史</p>
              </div>
            </div>
            <ChevronRight size={15} color="#6B9E7A"/>
          </div>
        </button>
      </div>

      {/* Residents */}
      <div className="pb-3">
        <div className="px-5 mb-2 flex items-end justify-between">
          <div>
            <p style={{ fontSize: "var(--ui-font-heading)", fontWeight: 700, color: "#1C1911" }}>World Residents</p>
            <p style={{ fontSize: "var(--ui-font-caption)", color: "#7A7468", marginTop: "3px", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>小小物件，也有鲜明人格</p>
          </div>
          <button onClick={() => navigate("agentGallery")}
            style={{ color: "#E8634A", fontSize: "var(--ui-font-body)", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>查看全部 →</button>
        </div>
        <div className="flex gap-2 px-5 overflow-x-auto">
          {AGENT_PROFILES.map(a => (
            <button key={a.id} onClick={() => navigate("agentGallery")}
              className="flex-shrink-0 rounded-xl overflow-hidden text-left"
              aria-label={`Open ${a.name} in Agent Archive`}
              style={{ width: "76px", background: "#FAF6EF", border: "1.5px solid rgba(28,25,17,0.1)" }}>
              <div className="relative flex items-center justify-center" style={{ height: "58px", background: a.color + "14" }}>
                <svg width="58" height="58" viewBox="-29 -29 58 58">{a.render(0.62, false)}</svg>
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: a.color }}/>
              </div>
              <div className="px-2 py-1.5">
                <p className="truncate" style={{ fontSize: "var(--ui-font-body)", color: "#1C1911", fontWeight: 700 }}>{a.name}</p>
                <p className="truncate" style={{ fontSize: "var(--ui-font-caption)", color: a.color, marginTop: "2px", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>{localizedAgentRole(a)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* World cards */}
      <div className="px-5 flex flex-col gap-3 pb-4">
        {worldCards.map(world => (
          <button
            key={world.key}
            type="button"
            onClick={() => navigate(world.screen)}
            className="relative rounded-2xl overflow-hidden text-left"
            aria-label={`进入${THEMED_WORLDS[world.key].chineseName}`}
            style={{
              padding: 0,
              border: `2px solid ${THEMED_WORLDS[world.key].accent}`,
              boxShadow: `0 0 0 4px ${THEMED_WORLDS[world.key].accent}0D, 0 5px 16px rgba(28,25,17,0.09)`,
              background: THEMED_WORLDS[world.key].paper,
            }}
          >
            <span style={{
              position: "absolute",
              zIndex: 10,
              top: 9,
              right: 9,
              padding: "5px 7px",
              color: "#FAF6EF",
              background: THEMED_WORLDS[world.key].accent,
              borderRadius: 8,
              fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
              fontSize: "var(--ui-font-micro)",
            }}>
              Plaza {world.houseId}
            </span>
            <ThemedWorldPreview config={THEMED_WORLDS[world.key]} residents={residents[world.key]} />
          </button>
        ))}
        {customWorld && (
          <button
            type="button"
            onClick={onOpenCustomWorld}
            className="relative rounded-2xl overflow-hidden text-left"
            aria-label={`进入我的世界 ${customWorld.config.name}`}
            style={{
              padding: 0,
              border: `2px solid ${customWorld.config.accent}`,
              boxShadow: `0 0 0 4px ${customWorld.config.accent}16, 0 8px 24px ${customWorld.config.accent}20`,
              background: customWorld.config.paper,
            }}
          >
            <div style={{
              position: "absolute",
              zIndex: 10,
              top: 10,
              right: 10,
              padding: "5px 8px",
              color: "white",
              background: customWorld.config.accent,
              borderRadius: 9,
              fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
              fontSize: "var(--ui-font-micro)",
            }}>
              我的世界 · {customWorld.houseId}
            </div>
            <ThemedWorldPreview config={customWorld.config} residents={customWorld.residents} />
          </button>
        )}
      </div>

      {/* Create world + capture buttons */}
      <div className="px-5 pb-3">
        <button
          type="button"
          onClick={onCreateWorld}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{
            color: "#FAF6EF",
            background: "linear-gradient(135deg,#E8634A,#D18A3D)",
            border: "1.5px solid rgba(28,25,17,.12)",
            boxShadow: "0 7px 18px rgba(232,99,74,.2)",
          }}
        >
          <Sparkles size={18}/>
          <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>
            {customWorld ? "再创建一个自己的世界" : "创建自己的世界"}
          </span>
        </button>
        <p className="text-center mt-2" style={{ fontSize: "var(--ui-font-caption)", color: "#7A7468", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
          选择主智能体、Plaza 房屋、主题与子智能体研究方向
        </p>
        <button onClick={() => navigate("capture")}
          className="w-full mt-2 py-3 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#FAF6EF", color: "#1C1911", border: "1.5px solid rgba(28,25,17,.16)" }}>
          <Camera size={18}/>
          <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>
            捕获新物件
          </span>
        </button>
      </div>
    </div>
  );
}

// 2. CAPTURE OBJECT
function CaptureScreen({
  navigate,
  onGenerated,
  onBack,
}: {
  navigate: (s: Screen) => void;
  onGenerated: (asset: PetAsset) => void;
  onBack?: () => void;
}) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [job, setJob] = useState<PetJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  const stageLabel: Record<PetJob["stage"], string> = {
    upload: "正在安全上传",
    stylize: "正在识别并萌化主体",
    "remove-background": "正在提取纯净轮廓",
    localize: "正在准备本机 Agent",
    complete: "卡通伙伴已经生成",
    failed: "生成失败",
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(file);
    setPreview(previewUrl.current);
    setError(null);
    setJob({ id: "uploading", name: file.name, status: "queued", stage: "upload", progress: 4 });
    try {
      const submitted = await petApi.submit(file);
      setJob(submitted);
      const asset = await waitForPet(submitted, setJob);
      onGenerated(asset);
      window.setTimeout(() => navigate("extract"), 480);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "生成失败，请重试");
      setJob(current => current ? { ...current, status: "failed", stage: "failed" } : null);
    }
  };

  const retryJob = async () => {
    if (!job || job.id === "uploading") return;
    setError(null);
    try {
      const retried = await petApi.retry(job);
      setJob(retried);
      const asset = await waitForPet(retried, setJob);
      onGenerated(asset);
      window.setTimeout(() => navigate("extract"), 480);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "重新生成失败，请重试");
      setJob(current => current ? { ...current, status: "failed", stage: "failed" } : null);
    }
  };

  const retryUpload = () => {
    const file = uploadInput.current?.files?.[0] || cameraInput.current?.files?.[0];
    if (file) handleFile(file);
    else uploadInput.current?.click();
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#17150F", color: "#FAF6EF" }}>
      <input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" hidden
        onChange={event => handleFile(event.target.files?.[0])}/>
      <input ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden
        onChange={event => handleFile(event.target.files?.[0])}/>
      <div className="flex items-center justify-between px-5 pt-9 pb-4">
        <button onClick={() => onBack ? onBack() : navigate("worldDock")} className="w-8 h-8 flex items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,.12)" }}>
          <ChevronLeft size={18} color="white"/>
        </button>
        <div className="text-center">
          <p style={{ fontSize: "var(--ui-font-caption)", letterSpacing: 1.4, color: "#E8634A" }}>OBJECT SCAN</p>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", color: "white", fontWeight: 700, marginTop: 3 }}>对准你喜欢的物件</p>
        </div>
        <button onClick={() => uploadInput.current?.click()} className="w-8 h-8 flex items-center justify-center rounded-full"
          aria-label="从相册选择"
          style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,.12)" }}>
          <ImageIcon size={16} color="white"/>
        </button>
      </div>

      {/* Viewfinder */}
      <div className="mx-5 rounded-3xl overflow-hidden relative" style={{
        height: 405,
        background: "radial-gradient(circle at 50% 48%, #282A2B 0%, #111319 68%, #090A0D 100%)",
        border: "1px solid rgba(255,255,255,.12)",
        boxShadow: "inset 0 0 60px rgba(0,0,0,.35)",
      }}>
        <div style={{ position: "absolute", inset: 20, border: "1px solid rgba(255,255,255,.08)", borderRadius: 22 }}/>
        {[
          { top: 20, left: 20, borderTop: true, borderLeft: true },
          { top: 20, right: 20, borderTop: true, borderRight: true },
          { bottom: 20, left: 20, borderBottom: true, borderLeft: true },
          { bottom: 20, right: 20, borderBottom: true, borderRight: true },
        ].map((corner, index) => (
          <span key={index} style={{
            position: "absolute", width: 42, height: 42,
            top: corner.top, right: corner.right, bottom: corner.bottom, left: corner.left,
            borderTop: corner.borderTop ? "3px solid #FAF6EF" : undefined,
            borderRight: corner.borderRight ? "3px solid #FAF6EF" : undefined,
            borderBottom: corner.borderBottom ? "3px solid #FAF6EF" : undefined,
            borderLeft: corner.borderLeft ? "3px solid #FAF6EF" : undefined,
            borderRadius: 8,
          }}/>
        ))}

        {/* Camera/upload preview */}
        {preview ? (
          <img src={preview} alt="待生成主体原图" style={{ position: "absolute", inset: 20, width: "calc(100% - 40px)", height: "calc(100% - 40px)", objectFit: "contain", borderRadius: 20 }}/>
        ) : <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
          <svg width="100" height="112" viewBox="0 0 80 90" aria-label="待扫描的杯子">
            <rect x="15" y="15" width="45" height="55" rx="6" fill="#C87848" stroke="#F3A17F" strokeWidth="1.2"/>
            <path d="M60,30 Q75,30 75,45 Q75,60 60,60" fill="none" stroke="#E4B09A" strokeWidth="2" strokeLinecap="round"/>
            <rect x="20" y="22" width="35" height="4" rx="2" fill="#A85828"/>
            <ellipse cx="37" cy="70" rx="22" ry="5" fill="#A85828"/>
          </svg>
        </div>}

        <div className="capture-scan-line" style={{
          position: "absolute", left: 28, right: 28, height: 2, top: "16%",
          background: "#E8634A",
          boxShadow: "0 0 10px #E8634A, 0 0 28px rgba(232,99,74,.55)",
          animation: "captureScan 2.8s ease-in-out infinite",
        }}/>

        <div className="absolute left-0 right-0 bottom-7 text-center">
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 9px",
            borderRadius: 99, background: "rgba(9,10,13,.72)", border: "1px solid rgba(255,255,255,.1)",
            fontSize: "var(--ui-font-micro)", letterSpacing: 1, color: "rgba(255,255,255,.72)",
          }}>
            <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: 5, background: job?.status === "failed" ? "#E8191A" : "#E8634A" }}/>
            {job ? `${stageLabel[job.stage]} · ${job.progress || 0}%` : "拍下或上传你想再次遇见的伙伴"}
          </span>
        </div>
        {job && (
          <div style={{ position: "absolute", left: 30, right: 30, bottom: 17, height: 3, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,.15)" }}>
            <motion.div animate={{ width: `${job.progress || 0}%` }} style={{ height: "100%", background: "#E8634A" }}/>
          </div>
        )}
      </div>

      {/* Capture button */}
      <div className="flex items-center justify-center gap-9 mt-5">
        <button onClick={() => uploadInput.current?.click()} aria-label="从相册上传" className="w-11 h-11 rounded-xl overflow-hidden" style={{ background: "#2B2924", border: "1px solid rgba(255,255,255,.12)" }}>
          <div style={{ margin: 6, height: 30, borderRadius: 6, background: "linear-gradient(135deg,#5D493D,#C87848)" }}/>
        </button>
        <button onClick={() => cameraInput.current?.click()}
          disabled={job?.status === "queued" || job?.status === "processing"}
          aria-label="拍摄并开始提取"
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: "#FAF6EF",
            border: "3px solid #17150F",
            boxShadow: "0 0 0 2px #FAF6EF"
          }}>
          <div className="rounded-full" style={{ background: "#E8634A", width: 46, height: 46 }}/>
        </button>
        <button onClick={() => uploadInput.current?.click()} aria-label="上传图片" className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "#2B2924", border: "1px solid rgba(255,255,255,.12)" }}>
          <ImageIcon size={18} color="white"/>
        </button>
      </div>
      <p className="text-center mt-4 px-6" style={{ fontSize: "var(--ui-font-micro)", lineHeight: 1.8, color: "rgba(255,255,255,.5)" }}>
        {error ? (
          <span style={{ color: "#F3A17F" }}>
            {error}
            {job?.id && (
              <button type="button" onClick={job.id === "uploading" ? retryUpload : retryJob} style={{
                display: "block", margin: "8px auto 0", padding: "6px 10px",
                borderRadius: 10, border: "1px solid rgba(255,255,255,.2)",
                background: "rgba(255,255,255,.08)", color: "#FAF6EF", fontSize: "var(--ui-font-caption)",
              }}>
                {job.id === "uploading" ? "重新连接并生成" : "使用本次原图重新生成"}
              </button>
            )}
          </span>
        ) : "🔒 原图仅在本次生成期间临时处理，完成后立即从服务器清除"}
      </p>
    </div>
  );
}

// 3. EXTRACT OBJECT
function ExtractScreen({
  navigate,
  pet,
  onRegistered,
  onDone,
}: {
  navigate: (s: Screen) => void;
  pet: PetAsset | null;
  onRegistered: (asset: PetAsset) => void;
  onDone?: (asset: PetAsset) => void;
}) {
  const [mode, setMode] = useState<"erase" | "restore">("erase");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const addToAgents = () => {
    if (!pet || adding) return;
    setAdding(true);
    setAddError(null);
    onRegistered(pet);
    if (onDone) {
      onDone(pet);
      return;
    }
    navigate("agentGallery");
  };
  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("capture")} className="flex items-center gap-1" style={{ color: "#7A7468" }}>
          <ChevronLeft size={18}/> <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)" }}>返回</span>
        </button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700 }}>Extract Object</p>
        <button onClick={addToAgents} disabled={!pet || adding} style={{ color: "#E8634A", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>
          {adding ? "添加中…" : "添加 →"}
        </button>
      </div>

      {/* Before / After split */}
      <div className="mx-5 rounded-2xl overflow-hidden relative flex" style={{ height: "220px", gap: "2px" }}>
        <div className="flex-1 relative" style={{ background: "#DDD8CF" }}>
          <p className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#1C191180", color: "white", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)" }}>原图</p>
          {pet ? <img src={pet.sourceUrl} alt={`${pet.name} 原图`} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 12 }}/> : <svg width="100%" height="100%" viewBox="0 0 170 220">
            {/* Kitchen background */}
            <rect x="0" y="0" width="170" height="220" fill="#8090A0"/>
            <rect x="20" y="80" width="130" height="80" fill="#606878"/>
            {/* Mug */}
            <rect x="55" y="90" width="60" height="70" rx="5" fill="#E8634A" stroke="#1C1911" strokeWidth="1.5"/>
            <path d="M115,110 Q135,110 135,135 Q135,160 115,160" fill="none" stroke="#1C1911" strokeWidth="2.5" strokeLinecap="round"/>
            <ellipse cx="85" cy="160" rx="30" ry="6" fill="#C84A2A"/>
          </svg>}
        </div>
        <div className="flex-1 relative"
          style={{ background: "repeating-conic-gradient(#DDD8CF 0% 25%, #EAE5DA 0% 50%) 0 0 / 12px 12px" }}>
          <p className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#6B9E7A80", color: "white", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)" }}>已抠图</p>
          {pet ? <img src={pet.finalUrl} alt={`${pet.name} 卡通化抠图结果`} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 12 }}/> : <svg width="100%" height="100%" viewBox="0 0 170 220">
            {/* Isolated mug */}
            <rect x="55" y="90" width="60" height="70" rx="5" fill="#E8634A" stroke="#1C1911" strokeWidth="2"/>
            <path d="M115,110 Q135,110 135,135 Q135,160 115,160" fill="none" stroke="#1C1911" strokeWidth="2.5" strokeLinecap="round"/>
            <ellipse cx="85" cy="160" rx="30" ry="6" fill="#C84A2A"/>
            {/* Edge glow */}
            <rect x="53" y="88" width="64" height="74" rx="6" fill="none" stroke="#E8634A" strokeWidth="1.5" strokeDasharray="3,2"/>
          </svg>}
        </div>
      </div>
      {pet && (
        <div className="mx-5 mt-2 flex items-center justify-center gap-2" style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)" }}>
          <span>原始照片</span><ArrowRight size={10}/>
          <span style={{ color: "#57A348" }}>纯色底插画</span><ArrowRight size={10}/>
          <span style={{ color: "#E8634A" }}>真实透明 PNG</span>
        </div>
      )}

      {/* Tools */}
      <div className="px-5 mt-3">
        <SectionLabel text="边缘调整"/>
        <div className="flex gap-2">
          {[
            { id: "erase", label: "擦除", icon: <Scissors size={14}/> },
            { id: "restore", label: "恢复", icon: <Brush size={14}/> },
          ].map(t => (
            <button key={t.id} onClick={() => setMode(t.id as "erase"|"restore")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl"
              style={{
                background: mode === t.id ? "#1C1911" : "#EAE5DA",
                color: mode === t.id ? "white" : "#7A7468",
                border: "1.5px solid rgba(28,25,17,0.12)"
              }}>
              {t.icon}
              <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)" }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Transform controls */}
      <div className="px-5 mt-3">
        <SectionLabel text="图像调整"/>
        <div className="flex gap-2">
          {[
            { label: "裁剪", icon: <Scissors size={14}/> },
            { label: "旋转", icon: <RotateCw size={14}/> },
            { label: "翻转", icon: <FlipHorizontal size={14}/> },
            { label: "缩放", icon: <ZoomIn size={14}/> },
          ].map(t => (
            <button key={t.label}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl"
              style={{ background: "#EAE5DA", border: "1.5px solid rgba(28,25,17,0.08)", color: "#7A7468" }}>
              {t.icon}
              <span style={{ fontSize: "var(--ui-font-body)", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Brush size slider */}
      <div className="px-5 mt-3">
        <SectionLabel text="画笔大小"/>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ background: "#1C1911" }}/>
          <div className="flex-1 h-1.5 rounded-full relative" style={{ background: "#E0D9CE" }}>
            <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: "40%", background: "#E8634A" }}/>
            <div className="absolute w-4 h-4 rounded-full -top-1.5"
              style={{ left: "38%", background: "white", border: "2px solid #E8634A", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}/>
          </div>
          <div className="w-5 h-5 rounded-full" style={{ background: "#1C1911" }}/>
        </div>
      </div>

      <div className="px-5 mt-4">
        <button onClick={addToAgents} disabled={!pet || adding}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#1C1911", color: "#FAF6EF", opacity: !pet || adding ? 0.65 : 1 }}>
          <Wand2 size={16}/>
          <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>
            {adding ? "正在添加…" : "添加到 My Agents"}
          </span>
        </button>
        {addError && <p className="text-center mt-2" style={{ fontSize: "var(--ui-font-body)", color: "#E8634A" }}>{addError}</p>}
      </div>
    </div>
  );
}

// 4. LINE-ART TRANSFORMATION
function LineArtScreen({ navigate, pet }: { navigate: (s: Screen) => void; pet: PetAsset | null }) {
  const [style, setStyle] = useState("Minimal Pen");
  const [progress, setProgress] = useState(75);

  const styles = ["Minimal Pen","Soft Pencil","Comic Line","Technical Draft","Childlike Doodle"];
  const styleLabels: Record<string, string> = {
    "Minimal Pen": "极简钢笔",
    "Soft Pencil": "柔和铅笔",
    "Comic Line": "漫画线条",
    "Technical Draft": "技术草图",
    "Childlike Doodle": "童趣涂鸦",
  };

  useEffect(() => {
    const t = setInterval(() => setProgress(p => p >= 100 ? 100 : p + 2), 80);
    return () => clearInterval(t);
  }, [style]);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("extract")} style={{ color: "#7A7468" }}>
          <ChevronLeft size={20}/>
        </button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700 }}>Line-Art Style</p>
        <button onClick={() => navigate("bringToLife")} style={{ color: "#E8634A", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>
          下一步 →
        </button>
      </div>

      {/* Transformation stages */}
      <div className="px-5">
        <SectionLabel text="转换阶段"/>
        <div className="flex gap-2">
          {[
            { label: "照片", bg: "#E8634A40" },
            { label: "草图", bg: "#E8634A20" },
            { label: "线稿", bg: "#E8634A10" },
            { label: "净稿", bg: "white" },
          ].map((s, i) => (
            <div key={i} className="flex-1 rounded-xl overflow-hidden" style={{ border: "1.5px solid rgba(28,25,17,0.12)" }}>
              <div style={{ height: "70px", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="40" height="50" viewBox="0 0 40 50">
                  {i === 0 && ( // Photo
                    <>
                      <rect x="5" y="8" width="30" height="35" rx="3" fill="#E8634A" stroke="#1C1911" strokeWidth="1.5"/>
                      <path d="M35,18 Q44,18 44,28 Q44,38 35,38" fill="none" stroke="#1C1911" strokeWidth="1.5" strokeLinecap="round"/>
                    </>
                  )}
                  {i === 1 && ( // Sketch
                    <>
                      <rect x="5" y="8" width="30" height="35" rx="3" fill="none" stroke="#1C191180" strokeWidth="1.5" strokeDasharray="2,1.5"/>
                      <path d="M35,18 Q44,18 44,28 Q44,38 35,38" fill="none" stroke="#1C191180" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3,2"/>
                    </>
                  )}
                  {i === 2 && ( // Line
                    <>
                      <rect x="5" y="8" width="30" height="35" rx="3" fill="none" stroke="#1C1911" strokeWidth="1.5"/>
                      <path d="M35,18 Q44,18 44,28 Q44,38 35,38" fill="none" stroke="#1C1911" strokeWidth="1.5" strokeLinecap="round"/>
                    </>
                  )}
                  {i === 3 && ( // Clean
                    <>
                      <rect x="5" y="8" width="30" height="35" rx="3" fill="none" stroke="#1C1911" strokeWidth="2"/>
                      <path d="M35,18 Q44,18 44,28 Q44,38 35,38" fill="none" stroke="#1C1911" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="16" cy="26" r="4" fill="none" stroke="#1C1911" strokeWidth="1.5"/>
                      <circle cx="16" cy="26" r="2" fill="none" stroke="#1C1911" strokeWidth="1"/>
                      <circle cx="24" cy="26" r="4" fill="none" stroke="#1C1911" strokeWidth="1.5"/>
                      <circle cx="24" cy="26" r="2" fill="none" stroke="#1C1911" strokeWidth="1"/>
                    </>
                  )}
                </svg>
              </div>
              <p className="text-center py-1" style={{ fontSize: "var(--ui-font-body)", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", color: "#7A7468" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="mx-5 mt-3 rounded-2xl flex items-center justify-center"
        style={{ height: "180px", background: "#FAF6EF", border: "2px solid #E8634A30" }}>
        {pet ? <img src={pet.cleanUrl} alt={`${pet.name} 纯净背景版本`} style={{ width: 166, height: 166, objectFit: "contain" }}/> : <svg width="140" height="160" viewBox="0 0 140 160">
          <rect x="30" y="30" width="70" height="85" rx="8"
            fill="none" stroke="#1C1911" strokeWidth={style === "Childlike Doodle" ? "3" : style === "Technical Draft" ? "1" : "2"}
            strokeLinejoin="round"/>
          <path d="M100,50 Q122,50 122,75 Q122,100 100,100"
            fill="none" stroke="#1C1911"
            strokeWidth={style === "Childlike Doodle" ? "3" : "2"}
            strokeLinecap="round"/>
          <circle cx="55" cy="75" r={style === "Soft Pencil" ? "8" : "7"}
            fill="white" stroke="#1C1911" strokeWidth={style === "Minimal Pen" ? "1.5" : "2"}/>
          <circle cx="75" cy="75" r={style === "Soft Pencil" ? "8" : "7"}
            fill="white" stroke="#1C1911" strokeWidth={style === "Minimal Pen" ? "1.5" : "2"}/>
          <circle cx="55" cy="75" r="3.5" fill="#1C1911"/>
          <circle cx="75" cy="75" r="3.5" fill="#1C1911"/>
          <circle cx="57" cy="73" r="1.2" fill="white"/>
          <circle cx="77" cy="73" r="1.2" fill="white"/>
          <path d="M53,88 Q65,94 77,88" fill="none" stroke="#1C1911" strokeWidth="1.5" strokeLinecap="round"/>
          {/* Legs */}
          <line x1="52" y1="115" x2="48" y2="130" stroke="#1C1911" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="68" y1="115" x2="72" y2="130" stroke="#1C1911" strokeWidth="2.5" strokeLinecap="round"/>
          <ellipse cx="46" cy="132" rx="8" ry="3.5" fill="#1C1911"/>
          <ellipse cx="74" cy="132" rx="8" ry="3.5" fill="#1C1911"/>
          {/* Steam */}
          <path d="M52,28 Q49,22 52,16" fill="none" stroke="#1C191150" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M62,27 Q65,21 62,15" fill="none" stroke="#1C191150" strokeWidth="1.5" strokeLinecap="round"/>
          <text x="70" y="155" textAnchor="middle" fontSize="10" fontFamily="Caveat,cursive" fill="#7A7468">Miko</text>
        </svg>}
      </div>

      {/* Progress */}
      <div className="px-5 mt-2">
        <div className="flex justify-between mb-1">
          <span style={{ fontSize: "var(--ui-font-body)", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", color: "#7A7468" }}>转换进度</span>
          <span style={{ fontSize: "var(--ui-font-heading)", fontFamily: "VT323,monospace", color: "#E8634A" }}>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: "#E0D9CE" }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "#E8634A" }}/>
        </div>
      </div>

      {/* Style picker */}
      <div className="px-5 mt-3">
        <SectionLabel text="线稿风格"/>
        <div className="flex flex-wrap gap-2">
          {styles.map(s => (
            <button key={s} onClick={() => { setStyle(s); setProgress(30); }}
              className="px-3 py-1.5 rounded-xl"
              style={{
                background: style === s ? "#1C1911" : "#EAE5DA",
                color: style === s ? "white" : "#7A7468",
                border: "1.5px solid rgba(28,25,17,0.1)",
                fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                fontSize: "var(--ui-font-body)"
              }}>{styleLabels[s]}</button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-4 mb-2">
        <button onClick={() => navigate("bringToLife")}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#1C1911", color: "#FAF6EF" }}>
          <Sparkles size={16}/>
          <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>赋予生命</span>
        </button>
      </div>
    </div>
  );
}

// 5. BRING IT TO LIFE
function BringToLifeScreen({ navigate, pet }: { navigate: (s: Screen) => void; pet: PetAsset | null }) {
  const [parts, setParts] = useState({ eyes: true, mouth: true, arms: true, legs: true, antennae: false });
  const partLabels = { eyes: "眼睛", mouth: "嘴巴", arms: "手臂", legs: "双腿", antennae: "触角" };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("lineArt")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700 }}>Bring It to Life</p>
        <button onClick={() => navigate(pet ? "everydayTown" : "agentIdentity")} style={{ color: "#E8634A", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>{pet ? "进入世界 →" : "下一步 →"}</button>
      </div>

      {/* Character canvas */}
      <div className="mx-5 rounded-2xl flex items-center justify-center relative"
        style={{ height: "240px", background: "#FAF6EF", border: "2px solid rgba(28,25,17,0.1)" }}>
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "#E8634A18", color: "#E8634A", fontFamily: "VT323,monospace", fontSize: "var(--ui-font-heading)" }}>
            ✦ AI 建议
          </span>
        </div>
        {pet ? <motion.img
          src={pet.finalUrl}
          alt={`${pet.name} 萌化 Agent`}
          animate={{ y: [0, -7, 0], rotate: [-1, 1, -1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 210, height: 210, objectFit: "contain" }}
        /> : <svg width="200" height="210" viewBox="0 0 200 210">
          {/* Mug body */}
          <rect x="65" y="40" width="70" height="85" rx="10"
            fill="#E8634A" stroke="#1C1911" strokeWidth="2.5" strokeLinejoin="round"/>
          {/* Handle */}
          <path d="M135,60 Q158,60 158,82 Q158,104 135,104"
            fill="none" stroke="#1C1911" strokeWidth="3" strokeLinecap="round"/>
          {/* Eyes */}
          {parts.eyes && <>
            <circle cx="87" cy="72" r="10" fill="white" stroke="#1C1911" strokeWidth="2"/>
            <circle cx="113" cy="72" r="10" fill="white" stroke="#1C1911" strokeWidth="2"/>
            <circle cx="89" cy="72" r="5" fill="#1C1911"/>
            <circle cx="115" cy="72" r="5" fill="#1C1911"/>
            <circle cx="91" cy="70" r="2" fill="white"/>
            <circle cx="117" cy="70" r="2" fill="white"/>
          </>}
          {/* Mouth */}
          {parts.mouth && (
            <path d="M88,94 Q100,102 112,94" fill="none" stroke="#1C1911" strokeWidth="2" strokeLinecap="round"/>
          )}
          {/* Arms */}
          {parts.arms && <>
            <path d="M65,68 Q48,65 42,75" fill="none" stroke="#1C1911" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="40" cy="76" r="4" fill="#1C1911"/>
          </>}
          {/* Antennae */}
          {parts.antennae && <>
            <line x1="90" y1="40" x2="84" y2="22" stroke="#1C1911" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="83" cy="20" r="3.5" fill="#E8634A" stroke="#1C1911" strokeWidth="1.5"/>
          </>}
          {/* Legs */}
          {parts.legs && <>
            <line x1="88" y1="125" x2="82" y2="145" stroke="#1C1911" strokeWidth="3" strokeLinecap="round"/>
            <line x1="112" y1="125" x2="118" y2="145" stroke="#1C1911" strokeWidth="3" strokeLinecap="round"/>
            <ellipse cx="80" cy="148" rx="10" ry="5" fill="#1C1911"/>
            <ellipse cx="120" cy="148" rx="10" ry="5" fill="#1C1911"/>
          </>}
          {/* Steam */}
          <path d="M85,38 Q82,30 85,22" fill="none" stroke="#1C191150" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M100,37 Q103,29 100,21" fill="none" stroke="#1C191150" strokeWidth="1.8" strokeLinecap="round"/>
          <text x="100" y="170" textAnchor="middle" fontSize="16" fontFamily="Caveat,cursive" fill="#7A7468">Miko</text>
          {/* Drag handles */}
          {parts.eyes && <>
            <circle cx="87" cy="72" r="13" fill="none" stroke="#E8634A" strokeWidth="1" strokeDasharray="3,2" opacity="0.5"/>
            <circle cx="113" cy="72" r="13" fill="none" stroke="#E8634A" strokeWidth="1" strokeDasharray="3,2" opacity="0.5"/>
          </>}
        </svg>}
      </div>

      {/* Parts panel */}
      <div className="px-5 mt-3">
        <SectionLabel text="身体部件"/>
        <div className="grid grid-cols-5 gap-2">
          {(Object.entries(parts) as [keyof typeof parts, boolean][]).map(([key, val]) => (
            <button key={key} onClick={() => setParts(p => ({ ...p, [key]: !p[key] }))}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl"
              style={{
                background: val ? "#1C1911" : "#EAE5DA",
                color: val ? "white" : "#7A7468",
                border: "1.5px solid rgba(28,25,17,0.1)"
              }}>
              <span style={{ fontSize: "var(--ui-font-heading)" }}>
                {key === "eyes" ? "👀" : key === "mouth" ? "😄" : key === "arms" ? "💪" : key === "legs" ? "🦵" : "📡"}
              </span>
              <span style={{ fontSize: "var(--ui-font-body)", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>{partLabels[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="mx-5 mt-3 rounded-xl px-3 py-2.5" style={{ background: "#4A7FA518", border: "1px solid #4A7FA540" }}>
        <p style={{ fontSize: "var(--ui-font-body)", lineHeight: 1.6, color: "#4A7FA5", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
          {pet ? `💡 ${pet.name} 已完成纯净背景生成、轮廓提取和居民登记，现在会在 Memory Town 里继续陪伴你。` : "💡 杯柄自然变成一只手臂，眼睛位于正面，双腿从杯底生长出来。"}
        </p>
      </div>

      <div className="px-5 mt-3 mb-2">
        <button onClick={() => navigate(pet ? "everydayTown" : "agentIdentity")}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#1C1911", color: "#FAF6EF" }}>
          <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>{pet ? "让它进入 Memory Town" : "设定身份"}</span>
          <ArrowRight size={16}/>
        </button>
      </div>
    </div>
  );
}

// 6. AGENT IDENTITY
function AgentIdentityScreen({ navigate, profile, draft, onChange, editing, onCancel, onRestore, archiveTabs }: {
  navigate: (s: Screen) => void;
  profile: AgentProfile;
  draft: AgentEditorDraft;
  onChange: (patch: Partial<AgentEditorDraft>) => void;
  editing: boolean;
  onCancel: () => void;
  onRestore: () => void;
  archiveTabs?: React.ReactNode;
}) {
  const accent = profile.color;
  const identityFields: {
    key: "role" | "personality" | "goal";
    label: string;
    placeholder: string;
  }[] = [
    { key: "role", label: "社会角色", placeholder: "例如：咖啡馆管理员" },
    { key: "personality", label: "人格设定", placeholder: "描述它的性格、判断方式与变化倾向…" },
    { key: "goal", label: "当前目标", placeholder: "它现在最想完成什么？" },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
      <PhoneStatusBar showConnectivity={false}/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={editing ? onCancel : () => navigate("bringToLife")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700 }}>Agent Identity</p>
        <button onClick={() => navigate("motionPreview")} style={{ color: accent, fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>下一步 →</button>
      </div>
      {archiveTabs}

      {/* Profile header */}
      <div className="flex items-center gap-4 px-5 mb-3">
        <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
          style={{ background: "#FAF6EF", border: "2px solid rgba(28,25,17,0.1)" }}>
          <svg width="58" height="58" viewBox="-29 -29 58 58">{profile.render(0.72, false)}</svg>
        </div>
        <div>
          <input value={draft.name} onChange={event => onChange({ name: event.target.value })}
            className="block text-2xl font-bold bg-transparent border-b-2 outline-none"
            style={{ fontFamily: "Caveat,cursive", borderColor: accent, color: "#1C1911", width: "140px" }}/>
          <p style={{ fontSize: "var(--ui-font-body)", color: "#7A7468", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
            {editing ? `${profile.memories} 段记忆 · 正在编辑` : "今天捕获"}
          </p>
        </div>
        <div className="ml-auto">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${accent}18` }}>
            <Sparkles size={14} color={accent}/>
          </div>
          <p style={{ fontSize: "var(--ui-font-caption)", color: accent, fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", marginTop: "2px" }}>{editing ? "编辑" : "AI"}</p>
        </div>
      </div>

      {editing && (
        <div className="mx-5 mb-3 rounded-xl px-3 py-2 flex items-center justify-between gap-3"
          style={{ background: `${accent}10`, border: `1px solid ${accent}35` }}>
          <p style={{ color: "#7A7468", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", lineHeight: 1.55 }}>
            正在编辑 {profile.name}，全部修改将在最后保存后生效。
          </p>
          <button onClick={onRestore} className="flex-shrink-0 flex items-center gap-1"
            style={{ color: accent, fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)" }}>
            <RotateCcw size={12}/> 恢复默认
          </button>
        </div>
      )}

      {/* Fields */}
      <div className="px-5 flex flex-col gap-3">
        {identityFields.map(field => (
          <div key={field.key}>
            <SectionLabel text={field.label}/>
            <textarea value={draft[field.key]} onChange={event => onChange({ [field.key]: event.target.value })}
              rows={field.key === "personality" ? 2 : 1}
              placeholder={field.placeholder}
              className="w-full rounded-xl px-3 py-2.5 outline-none resize-none text-sm"
              style={{
                background: "#FAF6EF",
                border: "1.5px solid rgba(28,25,17,0.12)",
                fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                color: "#1C1911",
                fontSize: "var(--ui-font-label)",
                lineHeight: 1.55,
              }}
            />
          </div>
        ))}

        {/* Ability & Fear */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "ability" as const, label: "能力", color: "#6B9E7A" },
            { key: "fear" as const, label: "恐惧", color: accent },
          ].map(field => (
            <div key={field.key}>
              <SectionLabel text={field.label}/>
              <textarea
                value={draft[field.key]}
                onChange={event => onChange({ [field.key]: event.target.value })}
                rows={2}
                className="w-full rounded-xl px-3 py-2 outline-none resize-none"
                style={{ background: `${field.color}12`, border: `1.5px solid ${field.color}40`, fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", color: field.color, fontSize: "var(--ui-font-body)", lineHeight: 1.55 }}
              />
            </div>
          ))}
        </div>

        {/* Privacy */}
        <div>
          <SectionLabel text="访客隐私"/>
          <div className="flex flex-wrap gap-2">
            {(["public", "host", "never"] as const).map(p => (
              <button key={p} onClick={() => onChange({ privacy: p })}
                style={{ opacity: draft.privacy === p ? 1 : .45 }}>
                <PrivacyChip level={p}/>
              </button>
            ))}
          </div>
          <p className="mt-1.5" style={{ fontSize: "var(--ui-font-body)", color: "#7A7468", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", lineHeight: 1.55 }}>
            原始照片始终保持私密，只会共享生成后的智能体形象。
          </p>
        </div>

        {/* AI suggestions */}
        <div>
          <SectionLabel text="AI 建议 · 点击后应用"/>
          <div className="flex flex-wrap gap-2">
            {[`${localizedAgentRole(profile)}导师`, "记忆守护者", "城镇倾听者", "仪式记录者"].map(s => (
              <button key={s} onClick={() => onChange({ role: s })}
                className="px-3 py-1.5 rounded-xl"
                style={{
                  background: `${accent}10`,
                  border: `1px dashed ${accent}60`,
                  color: accent,
                  fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                  fontSize: "var(--ui-font-body)"
                }}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 mt-4 mb-4">
        <button onClick={() => navigate("motionPreview")}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#1C1911", color: "#FAF6EF" }}>
          <Play size={16}/>
          <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-section)", fontWeight: 700 }}>预览动作</span>
        </button>
      </div>
    </div>
  );
}

// 7. MOTION PREVIEW
function MotionPreviewScreen({ navigate, profile, draft, onChange }: {
  navigate: (s: Screen) => void;
  profile: AgentProfile;
  draft: AgentEditorDraft;
  onChange: (patch: Partial<AgentEditorDraft>) => void;
}) {
  const accent = profile.color;
  const animations = ["Idle","Walk","Look Around","Talk","Work","Sleep","React","Carry Item"];
  const movements = ["Walk","Hop","Roll","Float","Crawl","Cart"];
  const animationLabels: Record<string, string> = {
    Idle: "待机",
    Walk: "行走",
    "Look Around": "环顾四周",
    Talk: "对话",
    Work: "工作",
    Sleep: "睡眠",
    React: "反应",
    "Carry Item": "搬运物品",
  };
  const movementLabels: Record<string, string> = {
    Walk: "行走",
    Hop: "跳跃",
    Roll: "滚动",
    Float: "漂浮",
    Crawl: "爬行",
    Cart: "载具",
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("agentIdentity")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700 }}>Motion Preview</p>
        <button onClick={() => navigate("placeInWorld")} style={{ color: accent, fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>下一步 →</button>
      </div>

      {/* Stage */}
      <div className="mx-5 rounded-2xl relative overflow-hidden flex items-center justify-center"
        style={{ height: "220px", background: "#FAF6EF", border: "2px solid rgba(28,25,17,0.1)" }}>
        {/* Stage floor */}
        <div className="absolute bottom-0 left-0 right-0 h-12"
          style={{ background: "#EAE5DA", borderTop: "2px solid rgba(28,25,17,0.12)" }}/>
        {/* Shadow */}
        <div className="absolute bottom-12" style={{ width: "50px", height: "8px", background: "rgba(28,25,17,0.12)", borderRadius: "50%", transform: "translateY(4px)" }}/>
        {/* Agent */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <svg width="100" height="120" viewBox="-50 -60 100 120">
            {profile.render(1.35, true)}
          </svg>
        </div>
        {/* Animation label */}
        <div className="absolute top-3 left-0 right-0 flex justify-center">
          <span className="px-3 py-1 rounded-full"
            style={{ background: `${accent}18`, color: accent, fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-heading)", fontWeight: 700 }}>
            {animationLabels[draft.animation] || draft.animation} · {movementLabels[draft.movement] || draft.movement}
          </span>
        </div>
        {/* Walk path indicator */}
        {draft.animation === "Walk" && (
          <div className="absolute bottom-14 left-4 right-4">
            <div style={{ height: "1px", borderTop: `2px dashed ${accent}60` }}/>
          </div>
        )}
      </div>

      {/* Animation modes */}
      <div className="px-5 mt-3">
        <SectionLabel text="动作模式"/>
        <div className="flex flex-wrap gap-2">
          {animations.map(a => (
            <button key={a} onClick={() => onChange({ animation: a })}
              className="px-3 py-1.5 rounded-xl"
              style={{
                background: draft.animation === a ? accent : "#EAE5DA",
                color: draft.animation === a ? "white" : "#7A7468",
                fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                fontSize: "var(--ui-font-body)"
              }}>{animationLabels[a]}</button>
          ))}
        </div>
      </div>

      {/* Movement style */}
      <div className="px-5 mt-3">
        <SectionLabel text="移动方式"/>
        <div className="flex flex-wrap gap-2">
          {movements.map(m => (
            <button key={m} onClick={() => onChange({ movement: m })}
              className="px-3 py-1.5 rounded-xl"
              style={{
                background: draft.movement === m ? "#1C1911" : "#EAE5DA",
                color: draft.movement === m ? "white" : "#7A7468",
                fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                fontSize: "var(--ui-font-body)"
              }}>{movementLabels[m]}</button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-4 mb-2">
        <button onClick={() => navigate("placeInWorld")}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#1C1911", color: "#FAF6EF" }}>
          <MapPin size={16}/>
          <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-section)", fontWeight: 700 }}>放入世界</span>
        </button>
      </div>
    </div>
  );
}

// 8. PLACE IN WORLD
function PlaceInWorldScreen({ navigate, profile, draft, onChange, editing, onDone }: {
  navigate: (s: Screen) => void;
  profile: AgentProfile;
  draft: AgentEditorDraft;
  onChange: (patch: Partial<AgentEditorDraft>) => void;
  editing: boolean;
  onDone: () => void;
}) {
  const accent = profile.color;
  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("motionPreview")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700 }}>{editing ? "Review Agent" : "Place in World"}</p>
        <button onClick={onDone} style={{ color: "#6B9E7A", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>{editing ? "保存 ✓" : "完成 ✓"}</button>
      </div>

      {/* Map preview */}
      <div className="mx-5 rounded-2xl overflow-hidden relative"
        style={{ height: "200px", border: "2px solid rgba(28,25,17,0.12)" }}>
        <EverydayTownSVG w={350} h={280}/>
        {/* Drop target */}
        <div className="absolute" style={{ left: "44%", top: "54%", transform: "translate(-50%,-50%)" }}>
          <div className="w-12 h-12 rounded-full border-2 border-dashed animate-pulse flex items-center justify-center"
            style={{ borderColor: accent, background: `${accent}18` }}>
            <svg width="36" height="36" viewBox="-18 -18 36 36">{profile.render(0.5, false)}</svg>
          </div>
        </div>
      </div>

      {/* Agent */}
      <div className="flex items-center gap-3 px-5 mt-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "#FAF6EF", border: "2px solid rgba(28,25,17,0.12)" }}>
          <svg width="40" height="40" viewBox="-20 -20 40 40">
            {profile.render(0.66, false)}
          </svg>
        </div>
        <div>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700, color: "#1C1911" }}>{draft.name}</p>
          <p style={{ fontSize: "var(--ui-font-heading)", color: "#7A7468", fontFamily: "VT323,monospace" }}>{draft.role} · {profile.world}</p>
        </div>
      </div>

      {/* Agent type */}
      <div className="px-5 mt-3">
        <SectionLabel text="进入世界的方式"/>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "living", label: "生活智能体", desc: "行走、工作并与居民交往", icon: "🚶" },
            { id: "static", label: "静态物件", desc: "作为环境素材装饰场景", icon: "🪑" },
            { id: "building", label: "建筑组成", desc: "成为建筑或公共设施的一部分", icon: "🏠" },
            { id: "esp32", label: "ESP32 伙伴", desc: "居住在你的实体设备中", icon: "🤖" },
          ].map(t => (
            <button key={t.id} onClick={() => onChange({ placementMode: t.id as AgentPlacementMode })}
              className="rounded-xl p-3 text-left"
              style={{
                background: draft.placementMode === t.id ? "#1C1911" : "#FAF6EF",
                border: `2px solid ${draft.placementMode === t.id ? "#1C1911" : "rgba(28,25,17,0.1)"}`,
              }}>
              <p style={{ fontSize: "var(--ui-font-page-title)" }}>{t.icon}</p>
              <p style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", fontWeight: 700, color: draft.placementMode === t.id ? "white" : "#1C1911" }}>{t.label}</p>
              <p style={{ fontSize: "var(--ui-font-caption)", lineHeight: 1.5, color: draft.placementMode === t.id ? "rgba(255,255,255,0.7)" : "#7A7468", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Drag instruction */}
      <div className="mx-5 mt-3 px-3 py-2.5 rounded-xl flex items-center gap-2"
        style={{ background: `${accent}10`, border: `1px dashed ${accent}60` }}>
        <Move size={16} color={accent}/>
        <p style={{ fontSize: "var(--ui-font-body)", lineHeight: 1.55, color: accent, fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
          {editing ? `保留 ${draft.name} 现在的位置，或重新选择它在世界中的身份。` : `拖动 ${draft.name}，把它放到地图中的合适位置。`}
        </p>
      </div>

      <div className="px-5 mt-4 mb-2">
        <button onClick={onDone}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#6B9E7A", color: "white" }}>
          <Check size={16}/>
          <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>
            {editing ? `保存 ${draft.name} 的设定` : `让 ${draft.name} 加入世界`}
          </span>
        </button>
      </div>
    </div>
  );
}

// 9. WORLD BUILDER
function WorldBuilderScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [mode, setMode] = useState<"build"|"live">("build");
  const [tool, setTool] = useState("Terrain");
  const tools = ["Terrain","Buildings","Objects","Agents","Roads","Portals","Decor"];
  const toolLabels: Record<string, string> = {
    Terrain: "地形",
    Buildings: "建筑",
    Objects: "物件",
    Agents: "智能体",
    Roads: "道路",
    Portals: "入口",
    Decor: "装饰",
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-10 pb-2">
        <button onClick={() => navigate("everydayTown")} style={{ color: "#7A7468" }}>
          <ChevronLeft size={20}/>
        </button>
        <div className="flex items-center gap-1 rounded-full p-0.5" style={{ background: "#EAE5DA" }}>
          {["build","live"].map(m => (
            <button key={m} onClick={() => setMode(m as any)}
              className="px-4 py-1.5 rounded-full"
              style={{
                background: mode === m ? "#1C1911" : "transparent",
                color: mode === m ? "white" : "#7A7468",
                fontFamily: "Caveat,cursive",
                fontSize: "var(--ui-font-heading)",
                fontWeight: 600,
                textTransform: "capitalize"
              }}>{m === "build" ? "Build" : "Live"}</button>
          ))}
        </div>
        <div className="flex gap-1">
          <button className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EAE5DA" }}>
            <Undo2 size={14} color="#7A7468"/>
          </button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#EAE5DA" }}>
            <RotateCw size={14} color="#7A7468"/>
          </button>
        </div>
      </div>

      {/* City view */}
      <div className="flex-1 relative overflow-hidden">
        <EverydayTownSVG w={390} h={490}/>

        {/* Selected tile highlight */}
        <svg style={{ position: "absolute", inset: 0 }} width="390" height="490">
          <polygon points="227,152 259,168 227,184 195,168"
            fill="none" stroke="#E8634A" strokeWidth="2" strokeDasharray="4,3"/>
          <text x="227" y="162" textAnchor="middle" fontSize="8" fontFamily="'Fusion Pixel 10px Monospaced SC',sans-serif" fill="#E8634A" fontWeight="700">图书馆</text>
        </svg>

        {/* Zoom controls */}
        <div className="absolute right-3 top-4 flex flex-col gap-1">
          {[<ZoomIn size={14}/>, <ZoomOut size={14}/>].map((icon, i) => (
            <button key={i} className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(250,246,239,0.9)", border: "1.5px solid rgba(28,25,17,0.12)", color: "#7A7468" }}>
              {icon}
            </button>
          ))}
        </div>

        {/* Grid toggle */}
        <button className="absolute left-3 top-4 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(250,246,239,0.9)", border: "1.5px solid rgba(28,25,17,0.12)", color: "#7A7468" }}>
          <Grid3X3 size={14}/>
        </button>
      </div>

      {/* Bottom toolbar */}
      <div style={{ background: "#FAF6EF", borderTop: "1.5px solid rgba(28,25,17,0.1)" }}>
        <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto">
          {tools.map(t => (
            <button key={t} onClick={() => setTool(t)}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-xl"
              style={{
                background: tool === t ? "#1C1911" : "#EAE5DA",
                color: tool === t ? "white" : "#7A7468",
                fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                fontSize: "var(--ui-font-body)"
              }}>{toolLabels[t]}</button>
          ))}
        </div>
        {/* Tool palette */}
        <div className="flex gap-2 px-3 pb-3 overflow-x-auto">
          {[
            "#B8D4A0","#C8C2B4","#9BBFCF","#D4CDB8","#E8634A20","#4A7FA520","#6B9E7A20"
          ].map((c,i) => (
            <div key={i} className="w-10 h-10 rounded-xl flex-shrink-0"
              style={{ background: c, border: "1.5px solid rgba(28,25,17,0.15)" }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── COMPATIBILITY DIALOG ───────────────────────────────────────────────────────

type AgentInfo = {
  name: string; role: string; color: string;
  traits: string[]; mood: string; compat: { name: string; score: number; color: string }[];
  AgentSVG: () => JSX.Element;
};

const AGENT_DATA: AgentInfo[] = [
  {
    name: "Miko", role: "Café Keeper", color: "#E8634A", mood: "☕ 满足",
    traits: ["热情", "健谈", "爱分享"],
    compat: [
      { name: "Folio", score: 92, color: "#4A7FA5" },
      { name: "Nana",  score: 85, color: "#C890C0" },
      { name: "Luma",  score: 74, color: "#D4A800" },
      { name: "Beat",  score: 68, color: "#6B9E7A" },
      { name: "Shutter", score: 61, color: "#4A7FA5" },
    ],
    AgentSVG: () => <MugAgent x={0} y={8} s={1.2} accent="#E8634A"/>,
  },
  {
    name: "Shutter", role: "Archivist", color: "#4A7FA5", mood: "📷 专注",
    traits: ["冷静", "精准", "好奇"],
    compat: [
      { name: "Folio",  score: 88, color: "#4A7FA5" },
      { name: "Luma",   score: 79, color: "#D4A800" },
      { name: "Beat",   score: 72, color: "#6B9E7A" },
      { name: "Miko",   score: 61, color: "#E8634A" },
      { name: "Nana",   score: 55, color: "#C890C0" },
    ],
    AgentSVG: () => <CameraAgent x={0} y={8} s={1.2} accent="#4A7FA5"/>,
  },
  {
    name: "Nana", role: "Comforter", color: "#C890C0", mood: "🌸 温柔",
    traits: ["共情", "温暖", "治愈"],
    compat: [
      { name: "Miko",    score: 85, color: "#E8634A" },
      { name: "Beat",    score: 82, color: "#6B9E7A" },
      { name: "Luma",    score: 77, color: "#D4A800" },
      { name: "Folio",   score: 65, color: "#4A7FA5" },
      { name: "Shutter", score: 55, color: "#4A7FA5" },
    ],
    AgentSVG: () => <PlushAgent x={0} y={8} s={1.1} accent="#C890C0"/>,
  },
  {
    name: "Folio", role: "Memory Librarian", color: "#4A7FA5", mood: "📚 沉思",
    traits: ["博学", "有序", "珍惜记忆"],
    compat: [
      { name: "Miko",    score: 92, color: "#E8634A" },
      { name: "Shutter", score: 88, color: "#4A7FA5" },
      { name: "Luma",    score: 80, color: "#D4A800" },
      { name: "Nana",    score: 65, color: "#C890C0" },
      { name: "Beat",    score: 60, color: "#6B9E7A" },
    ],
    AgentSVG: () => <BookAgent x={0} y={8} s={1.15} accent="#4A7FA5"/>,
  },
  {
    name: "Luma", role: "Night Guide", color: "#D4A800", mood: "🌙 安静",
    traits: ["沉稳", "引导", "夜行"],
    compat: [
      { name: "Folio",   score: 80, color: "#4A7FA5" },
      { name: "Nana",    score: 77, color: "#C890C0" },
      { name: "Shutter", score: 79, color: "#4A7FA5" },
      { name: "Beat",    score: 70, color: "#6B9E7A" },
      { name: "Miko",    score: 74, color: "#E8634A" },
    ],
    AgentSVG: () => <LampAgent x={0} y={8} s={1.2} accent="#D4A800"/>,
  },
  {
    name: "Beat", role: "Music Broadcaster", color: "#6B9E7A", mood: "🎵 律动",
    traits: ["创意", "自由", "共鸣"],
    compat: [
      { name: "Nana",    score: 82, color: "#C890C0" },
      { name: "Miko",    score: 68, color: "#E8634A" },
      { name: "Luma",    score: 70, color: "#D4A800" },
      { name: "Shutter", score: 72, color: "#4A7FA5" },
      { name: "Folio",   score: 60, color: "#4A7FA5" },
    ],
    AgentSVG: () => <HeadphonesAgent x={0} y={8} s={1.15} accent="#6B9E7A"/>,
  },
];

const ARCHIVE_ROLE_ZH: Record<string, string> = {
  "Café Keeper": "咖啡馆管理员",
  Archivist: "档案记录员",
  Comforter: "陪伴者",
  "Memory Librarian": "记忆图书管理员",
  "Night Guide": "夜间向导",
  "Music Broadcaster": "音乐广播员",
};

const ARCHIVE_MOOD_ZH: Record<string, string> = {
  curious: "好奇",
  hopeful: "充满希望",
  restless: "不安",
  focused: "专注",
  tender: "温柔",
  playful: "活跃",
  reflective: "沉思",
};

const ARCHIVE_ERA_ZH: Record<string, string> = {
  "The Gathering Age": "聚集时代",
  "The Weaving Age": "编织时代",
  "The Civic Dawn": "公共黎明",
  "The Polyphonic Era": "复调时代",
  "The Living Archive": "生活档案时代",
};

const ARCHIVE_PHASE_ZH: Record<string, string> = {
  Gathering: "聚集阶段",
  Weaving: "编织阶段",
  "Civic Dawn": "公共黎明阶段",
  Polyphonic: "复调阶段",
  "Living Archive": "生活档案阶段",
};

const ARCHIVE_GOAL_ZH: Record<string, string> = {
  miko: "在守护共同记忆的同时，为小镇煮出一杯让人愿意停下来的咖啡。",
  shutter: "记录正在发生的变化，并让每段影像都保留它真实的来处。",
  nana: "照顾居民没有说出口的情绪，让关系在冲突后仍能继续生长。",
  folio: "建立一份会随着小镇变化而不断更新的生活索引。",
  luma: "在夜晚为迷路的居民保留一条安全、安静的回家路线。",
  beat: "把不同居民的节奏编进同一段广播，让分歧也能被听见。",
  sprig: "照料小镇里微小而顽强的植物，并记录季节变化。",
  tock: "让小镇在真正准备好时醒来，而不是只服从钟表。",
};

function archiveRole(role: string) {
  return ARCHIVE_ROLE_ZH[role] || role;
}

function archiveMood(mood: string) {
  return ARCHIVE_MOOD_ZH[mood] || mood;
}

function archiveEra(era?: string) {
  return era ? ARCHIVE_ERA_ZH[era] || era : "这个世界";
}

function archiveMemory(text: string) {
  return Object.entries(ARCHIVE_PHASE_ZH).reduce(
    (localized, [english, chinese]) => localized.replaceAll(`[${english}]`, `[${chinese}]`),
    text,
  );
}

const AGENT_CONCEPT_ZH: Record<string, string> = {
  curiosity: "好奇心",
  courage: "勇气",
  discipline: "自律",
  empathy: "共情",
  imagination: "想象力",
  access: "可访问性",
  adaptation: "适应",
  balance: "平衡",
  beauty: "美感",
  evidence: "证据",
  context: "语境",
  discretion: "审慎",
  expression: "表达",
  fun: "乐趣",
  honesty: "诚实",
  hope: "希望",
  hospitality: "好客",
  kindness: "善意",
  learning: "学习",
  precision: "精确性",
  plurality: "多元",
  possibility: "可能性",
  promise: "承诺",
  redundancy: "冗余保障",
  renewal: "更新",
  resilience: "韧性",
  rest: "休息",
  listening: "倾听",
  sync: "同步",
  timing: "时机",
  warning: "预警",
  preparedness: "准备",
  clarity: "清晰",
  openness: "开放",
  fairness: "公平",
  "shared stories": "共享故事",
};

function archiveAgentText(text: string) {
  return Object.entries(AGENT_CONCEPT_ZH).reduce(
    (localized, [english, chinese]) => localized.replaceAll(english, chinese),
    archiveMemory(text),
  );
}

function compactAgentText(text: string, maxLength = 46) {
  const normalized = archiveAgentText(text).replace(/^\[[^\]]+\]\s*/, "").replaceAll(":", "：");
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

function CompatibilityDialog({ agent, runtimeAgent, worldAgents = [], era, onClose, onProfile }: {
  agent: AgentInfo;
  runtimeAgent?: WorldAgent;
  worldAgents?: WorldAgent[];
  era?: string;
  onClose: () => void;
  onProfile: () => void;
}) {
  const liveCompatibility = runtimeAgent
    ? Object.entries(runtimeAgent.relationships)
      .map(([id, relation]) => {
        const peer = worldAgents.find(item => item.id === id);
        return { name: peer?.name || id, score: Math.round((relation.affinity + relation.trust) / 2), color: peer?.color || "#7A7468" };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)
    : agent.compat;
  const topScore = Math.max(...liveCompatibility.map(c => c.score));
  const bestMatch = liveCompatibility.find(c => c.score === topScore)!;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "absolute", inset: 0,
        background: "rgba(28,25,17,0.32)",
        display: "flex", alignItems: "flex-end",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          background: "#FAF6EF",
          borderRadius: "28px 28px 0 0",
          padding: "20px 20px 32px",
          border: "1.5px solid rgba(28,25,17,0.1)",
          borderBottom: "none",
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: "rgba(28,25,17,0.15)",
          margin: "0 auto 18px",
        }}/>

        {/* Agent header */}
        <div className="flex items-center gap-4 mb-5">
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: agent.color + "14",
            border: `1.5px solid ${agent.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width={60} height={60} viewBox="-30 -30 60 60">
              <agent.AgentSVG/>
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-title)", fontWeight: 700, color: "#1C1911", lineHeight: 1 }}>
                {agent.name}
              </span>
              <span style={{
                fontSize: "var(--ui-font-label)", fontFamily: "VT323,monospace",
                color: agent.color, background: agent.color + "18",
                border: `1px solid ${agent.color}30`,
                padding: "1px 7px", borderRadius: 99,
              }}>{runtimeAgent ? archiveMood(runtimeAgent.mood) : agent.mood}</span>
            </div>
            <p style={{ fontFamily: "VT323,monospace", fontSize: "var(--ui-font-label)", color: "#7A7468" }}>{archiveRole(agent.role)}</p>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {agent.traits.map(t => (
                <span key={t} style={{
                  fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-body)",
                  color: "#7A7468", background: "#EAE5DA",
                  padding: "1px 8px", borderRadius: 99,
                }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {runtimeAgent && (
          <div style={{
            background:"#F0EBE2", border:"1px solid rgba(28,25,17,.09)",
            borderRadius:14, padding:"10px 12px", marginBottom:14,
          }}>
            <div className="flex items-center justify-between gap-2">
              <span style={{ color:"#6B9E7A", fontSize: "var(--ui-font-caption)" }}>演化阶段 · {archiveEra(era)}</span>
              <span style={{ color:agent.color, fontSize: "var(--ui-font-caption)" }}>人格 v{runtimeAgent.personalityVersion}</span>
            </div>
            <p style={{ color:"#1C1911", fontSize: "var(--ui-font-body)", lineHeight:1.65, marginTop:7 }}>
              {ARCHIVE_GOAL_ZH[runtimeAgent.id] || runtimeAgent.goal}
            </p>
            {runtimeAgent.memories.at(-1) && (
              <p style={{ color:"#7A7468", fontSize: "var(--ui-font-caption)", lineHeight:1.55, marginTop:7 }}>
                最近记忆 · {archiveMemory(runtimeAgent.memories.at(-1)?.text || "")}
              </p>
            )}
          </div>
        )}

        {/* Best match highlight */}
        <div style={{
          background: bestMatch.color + "0E",
          border: `1.5px solid ${bestMatch.color}28`,
          borderRadius: 14, padding: "10px 14px",
          marginBottom: 14,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: "var(--ui-font-heading)" }}>✨</span>
          <div>
            <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-section)", color: "#7A7468", lineHeight: 1 }}>最佳搭档</p>
            <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-section)", fontWeight: 700, color: bestMatch.color, lineHeight: 1.2 }}>
              {bestMatch.name} · {bestMatch.score}% 适配
            </p>
          </div>
        </div>

        {/* Compatibility bars */}
        <p style={{ fontFamily: "VT323,monospace", fontSize: "var(--ui-font-section)", color: "#7A7468", letterSpacing: "0.08em", marginBottom: 10 }}>
          世界适配度
        </p>
        <div className="flex flex-col gap-2.5 mb-5">
          {liveCompatibility.map(c => (
            <div key={c.name} className="flex items-center gap-2">
              <span style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-section)", color: "#1C1911", width: 54, flexShrink: 0 }}>
                {c.name}
              </span>
              <div style={{ flex: 1, height: 7, background: "#EAE5DA", borderRadius: 99, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${c.score}%` }}
                  transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
                  style={{ height: "100%", borderRadius: 99, background: c.color }}
                />
              </div>
              <span style={{ fontFamily: "VT323,monospace", fontSize: "var(--ui-font-section)", color: c.color, width: 34, textAlign: "right", flexShrink: 0 }}>
                {c.score}%
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onProfile}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 14,
              background: "#1C1911", color: "#FAF6EF",
              fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-section)", fontWeight: 700,
              border: "none", cursor: "pointer",
            }}>
            查看档案 →
          </button>
          <button
            onClick={onClose}
            style={{
              width: 46, borderRadius: 14,
              background: "#EAE5DA", color: "#7A7468",
              fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-heading)",
              border: "none", cursor: "pointer",
            }}>
            ✕
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── WANDER POSITION TRACKING (mirrors CSS keyframes in JS via RAF) ─────────────

// Each entry: { dur ms, delay ms, frames: [progress 0-1, dx, dy][] }
const WANDER_CONFIGS = [
  { dur: 22000, delay:    0, kf: [[0,0,0],[.15,38,-28],[.30,65,12],[.45,42,50],[.60,-10,38],[.75,-34,-8],[.90,10,-30],[1,0,0]] },
  { dur: 18000, delay: 1500, kf: [[0,0,0],[.20,-45,20],[.40,-20,55],[.60,30,42],[.80,50,-10],[1,0,0]] },
  { dur: 25000, delay: 3000, kf: [[0,0,0],[.18,28,38],[.36,-15,60],[.54,-48,22],[.72,-30,-20],[.90,18,-35],[1,0,0]] },
  { dur: 20000, delay: 2000, kf: [[0,0,0],[.25,52,-15],[.50,38,48],[.75,-22,30],[1,0,0]] },
  { dur: 28000, delay:  500, kf: [[0,0,0],[.20,-38,-22],[.40,-55,25],[.60,-18,55],[.80,25,28],[1,0,0]] },
  { dur: 21000, delay: 4000, kf: [[0,0,0],[.16,30,-40],[.33,58,10],[.50,32,52],[.66,-18,44],[.83,-40,-12],[1,0,0]] },
  { dur: 24000, delay: 2800, kf: [[0,0,0],[.20,-45,20],[.40,-20,55],[.60,30,42],[.80,50,-10],[1,0,0]] },
  { dur: 26000, delay: 1200, kf: [[0,0,0],[.20,-38,-22],[.40,-55,25],[.60,-18,55],[.80,25,28],[1,0,0]] },
] as const;

function lerpWander(kf: readonly (readonly number[])[], t: number): [number, number] {
  for (let i = 0; i < kf.length - 1; i++) {
    const [p0, x0, y0] = kf[i], [p1, x1, y1] = kf[i + 1];
    if (t >= p0 && t <= p1) {
      const u = (t - p0) / (p1 - p0);
      const e = u * u * (3 - 2 * u); // smoothstep ease-in-out
      return [x0 + (x1 - x0) * e, y0 + (y1 - y0) * e];
    }
  }
  return [0, 0];
}

function useWanderOffsets(): [number, number][] {
  const [offsets, setOffsets] = useState<[number, number][]>(() => WANDER_CONFIGS.map(() => [0, 0]));
  useEffect(() => {
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const now = Date.now();
      setOffsets(WANDER_CONFIGS.map(({ dur, delay, kf }) => {
        const elapsed = Math.max(0, now - start - delay);
        const t = (elapsed % dur) / dur;
        return lerpWander(kf, t);
      }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return offsets;
}

// Anchor positions matching EverydayTownSVG wander starts
const AGENT_ANCHORS = [
  { cx: 85,  cy: 175 }, // Miko
  { cx: 275, cy: 145 }, // Shutter
  { cx: 95,  cy: 335 }, // Nana
  { cx: 295, cy: 310 }, // Folio
  { cx: 145, cy: 468 }, // Luma
  { cx: 305, cy: 482 }, // Beat
  { cx: 170, cy: 105 }, // Sprig
  { cx: 338, cy: 108 }, // Tock
];

// Town map pan constants — 3 side-scrollable panels
const TOWN_PANEL_W = 390;
const TOWN_PANELS  = 3;
const TOWN_MAP_W   = TOWN_PANEL_W * TOWN_PANELS; // 1170px

// Agent anchors in town world coordinate space (agents live in center panel = panel 1)
const AGENT_ANCHORS_WORLD = AGENT_ANCHORS.map(a => ({ cx: a.cx + TOWN_PANEL_W, cy: a.cy }));
const TOWN_AGENT_IDS = ["miko", "shutter", "nana", "folio", "luma", "beat", "sprig", "tock"];
const TOWN_AGENT_COLORS = ["#E8634A", "#4A7FA5", "#C890C0", "#4A7FA5", "#D4A800", "#6B9E7A", "#6B9E7A", "#E88752"];

type ChatBubble = { id: number; agentIdx: number; msg: string };

// ── BUILDING ASSETS ──────────────────────────────────────────────────────────
type DailyAgentPlacementType = `dailyAgent:${string}`;
type BuildingType =
  // Everyday
  "cottage"|"cafe"|"tree"|"bench"|"mailbox"|"fountain"|"market"|"well" |
  // Generated medieval
  "medCottage"|"medChapel"|"medWatchtower"|"medApothecary"|"medMarket"|"medWell"|"medBridge"|"medWindmill" |
  // Generated modern
  "modernApartment"|"modernCafe"|"modernLibrary"|"modernCinema"|"modernBusShelter"|"modernPostbox"|"modernFountain"|"modernKiosk" |
  // Pentiment-style environment pack
  "pentimentScriptorium"|"pentimentBakery"|"pentimentChapel"|"pentimentGatehouse" |
  // Pluggable character/animal skin packs
  WorldStyleSkillAssetType |
  // Existing line-art agents exposed as placeable scene materials
  DailyAgentPlacementType;
type BuildingCategory = "everyday" | "medieval" | "modern" | WorldStyleSkillCategory;
interface PlacedBuilding { id: number; type: BuildingType; x: number; y: number; }

const INK = "#1C1911";
const PAPER = "#FAF6EF";
const P_WARM = "#F5F0E8";

function GeneratedMapAsset({ src, alt }: { src: string; alt: string }) {
  return (
    <img src={src} alt={alt} draggable={false} style={{
      width: 92,
      height: 92,
      objectFit: "contain",
      display: "block",
      pointerEvents: "none",
      userSelect: "none",
    }}/>
  );
}

function CottageAsset() {
  return (
    <svg width="68" height="66" viewBox="0 0 68 66" style={{ overflow:"visible" }}>
      <rect x="41" y="5" width="7" height="15" rx="1" fill="#D4B896" stroke={INK} strokeWidth="1.5"/>
      <circle cx="44" cy="3.5" r="2.2" fill="none" stroke={INK} strokeWidth="1" opacity="0.45"/>
      <circle cx="46" cy="0.8" r="1.5" fill="none" stroke={INK} strokeWidth="0.9" opacity="0.25"/>
      <polygon points="4,29 34,7 64,29" fill="#E8634A28" stroke={INK} strokeWidth="1.8" strokeLinejoin="round"/>
      <rect x="8" y="27" width="52" height="36" rx="2" fill={PAPER} stroke={INK} strokeWidth="1.8"/>
      <rect x="25" y="42" width="18" height="21" rx="3" fill={P_WARM} stroke={INK} strokeWidth="1.5"/>
      <circle cx="41" cy="53" r="1.6" fill={INK}/>
      <rect x="11" y="33" width="12" height="10" rx="1" fill="#C8DDE8" stroke={INK} strokeWidth="1.2"/>
      <line x1="17" y1="33" x2="17" y2="43" stroke={INK} strokeWidth="0.8"/>
      <line x1="11" y1="38" x2="23" y2="38" stroke={INK} strokeWidth="0.8"/>
      <rect x="45" y="33" width="12" height="10" rx="1" fill="#C8DDE8" stroke={INK} strokeWidth="1.2"/>
      <line x1="51" y1="33" x2="51" y2="43" stroke={INK} strokeWidth="0.8"/>
      <line x1="45" y1="38" x2="57" y2="38" stroke={INK} strokeWidth="0.8"/>
    </svg>
  );
}

function CafeAsset() {
  return (
    <svg width="72" height="62" viewBox="0 0 72 62" style={{ overflow:"visible" }}>
      {/* Awning */}
      <path d="M4,22 Q36,16 68,22 L68,30 Q36,24 4,30 Z" fill="#E8634A" stroke={INK} strokeWidth="1.5"/>
      {[13,25,37,49,61].map((x,i) => (
        <line key={i} x1={x} y1={22} x2={x-2} y2={30} stroke="#C04A30" strokeWidth="1.2"/>
      ))}
      {/* Body */}
      <rect x="6" y="28" width="60" height="32" rx="2" fill={PAPER} stroke={INK} strokeWidth="1.8"/>
      {/* Shop sign */}
      <rect x="16" y="20" width="40" height="11" rx="2" fill="#FEFCF8" stroke={INK} strokeWidth="1.2"/>
      <text x="36" y="29" textAnchor="middle" fontFamily="Caveat,cursive" fontSize="8" fill={INK}>café</text>
      {/* Door */}
      <rect x="28" y="40" width="16" height="20" rx="2" fill={P_WARM} stroke={INK} strokeWidth="1.5"/>
      {/* Window */}
      <rect x="9" y="34" width="14" height="12" rx="1" fill="#C8DDE8" stroke={INK} strokeWidth="1.2"/>
      <rect x="49" y="34" width="14" height="12" rx="1" fill="#C8DDE8" stroke={INK} strokeWidth="1.2"/>
      {/* Small table outside */}
      <ellipse cx="36" cy="61" rx="6" ry="2" fill={P_WARM} stroke={INK} strokeWidth="1"/>
      <line x1="36" y1="55" x2="36" y2="61" stroke={INK} strokeWidth="1.2"/>
    </svg>
  );
}

function TreeAsset() {
  return (
    <svg width="58" height="72" viewBox="0 0 58 72" style={{ overflow:"visible" }}>
      {/* Canopy layers */}
      <circle cx="29" cy="26" r="22" fill="#B8D4A0" stroke={INK} strokeWidth="1.8"/>
      <circle cx="18" cy="32" r="14" fill="#A8C890" stroke={INK} strokeWidth="1.5"/>
      <circle cx="40" cy="30" r="13" fill="#B0CC98" stroke={INK} strokeWidth="1.5"/>
      <circle cx="29" cy="20" r="12" fill="#C0D8A8" stroke={INK} strokeWidth="1.2"/>
      {/* Trunk */}
      <rect x="23" y="44" width="12" height="26" rx="4" fill="#C8A882" stroke={INK} strokeWidth="1.8"/>
      {/* Bark lines */}
      <path d="M25,50 C27,52 25,56 27,58" stroke="#A08060" strokeWidth="1" fill="none"/>
      <path d="M33,48 C31,52 33,54 31,58" stroke="#A08060" strokeWidth="1" fill="none"/>
      {/* Tiny fruits/flowers */}
      <circle cx="22" cy="22" r="2.5" fill="#E8634A" stroke={INK} strokeWidth="1"/>
      <circle cx="36" cy="17" r="2.5" fill="#E8634A" stroke={INK} strokeWidth="1"/>
      <circle cx="29" cy="32" r="2" fill="#E8634A" stroke={INK} strokeWidth="0.8"/>
    </svg>
  );
}

function BenchAsset() {
  return (
    <svg width="64" height="42" viewBox="0 0 64 42" style={{ overflow:"visible" }}>
      {/* Back rest */}
      <rect x="6" y="8" width="52" height="10" rx="3" fill="#D4B896" stroke={INK} strokeWidth="1.6"/>
      <rect x="6" y="14" width="52" height="8" rx="2" fill="#C8A882" stroke={INK} strokeWidth="1.4"/>
      {/* Seat */}
      <rect x="4" y="22" width="56" height="10" rx="3" fill="#D4B896" stroke={INK} strokeWidth="1.6"/>
      <rect x="4" y="26" width="56" height="6" rx="2" fill="#C8A882" stroke={INK} strokeWidth="1.4"/>
      {/* Planks lines on seat */}
      <line x1="20" y1="22" x2="20" y2="32" stroke="#B8926A" strokeWidth="1"/>
      <line x1="34" y1="22" x2="34" y2="32" stroke="#B8926A" strokeWidth="1"/>
      <line x1="48" y1="22" x2="48" y2="32" stroke="#B8926A" strokeWidth="1"/>
      {/* Legs */}
      <rect x="8"  y="30" width="6" height="12" rx="2" fill="#C8A882" stroke={INK} strokeWidth="1.5"/>
      <rect x="50" y="30" width="6" height="12" rx="2" fill="#C8A882" stroke={INK} strokeWidth="1.5"/>
      {/* Armrests */}
      <rect x="2"  y="12" width="8" height="22" rx="2" fill={P_WARM} stroke={INK} strokeWidth="1.4"/>
      <rect x="54" y="12" width="8" height="22" rx="2" fill={P_WARM} stroke={INK} strokeWidth="1.4"/>
    </svg>
  );
}

function MailboxAsset() {
  return (
    <svg width="36" height="72" viewBox="0 0 36 72" style={{ overflow:"visible" }}>
      {/* Cap */}
      <path d="M6,22 Q18,12 30,22" fill="#E8191A" stroke={INK} strokeWidth="1.5"/>
      {/* Body */}
      <rect x="6" y="20" width="24" height="30" rx="4" fill="#E8191A" stroke={INK} strokeWidth="1.8"/>
      {/* Mail slot */}
      <rect x="10" y="32" width="16" height="3" rx="1.5" fill={INK}/>
      {/* Royal crown / emblem circle */}
      <circle cx="18" cy="26" r="4" fill="#C80010" stroke={INK} strokeWidth="1.2"/>
      {/* Post */}
      <rect x="15" y="50" width="6" height="22" rx="2" fill="#C8C2B4" stroke={INK} strokeWidth="1.5"/>
      {/* Base */}
      <ellipse cx="18" cy="72" rx="10" ry="3" fill={P_WARM} stroke={INK} strokeWidth="1.2"/>
    </svg>
  );
}

function FountainAsset() {
  return (
    <svg width="72" height="64" viewBox="0 0 72 64" style={{ overflow:"visible" }}>
      {/* Water spray */}
      {[-14,-8,0,8,14].map((dx,i) => (
        <path key={i} d={`M36,20 Q${36+dx*0.6},${12+Math.abs(dx)*0.2} ${36+dx},6`}
          stroke="#9BBFCF" strokeWidth="1.2" fill="none" opacity="0.7"
          style={{ animation: `waterSway ${1.5+i*0.2}s ease-in-out infinite alternate` }}/>
      ))}
      {/* Top tier basin */}
      <ellipse cx="36" cy="20" rx="14" ry="5" fill="#C8E0E8" stroke={INK} strokeWidth="1.5"/>
      <ellipse cx="36" cy="18" rx="13" ry="4" fill="#D8EEF5" stroke={INK} strokeWidth="1.2"/>
      {/* Pedestal */}
      <rect x="32" y="20" width="8" height="18" rx="2" fill="#EAE5DA" stroke={INK} strokeWidth="1.5"/>
      {/* Lower bowl */}
      <path d="M6,42 Q36,52 66,42 L62,50 Q36,60 10,50 Z" fill="#C8E0E8" stroke={INK} strokeWidth="1.6"/>
      <ellipse cx="36" cy="42" rx="30" ry="8" fill="#D8EEF5" stroke={INK} strokeWidth="1.5"/>
      {/* Water ripples */}
      <ellipse cx="36" cy="44" rx="12" ry="3" fill="none" stroke="#9BBFCF" strokeWidth="0.8" opacity="0.6"/>
      <ellipse cx="36" cy="44" rx="20" ry="5" fill="none" stroke="#9BBFCF" strokeWidth="0.6" opacity="0.4"/>
      {/* Base */}
      <ellipse cx="36" cy="52" rx="26" ry="6" fill={P_WARM} stroke={INK} strokeWidth="1.5"/>
    </svg>
  );
}

function MarketAsset() {
  return (
    <svg width="80" height="62" viewBox="0 0 80 62" style={{ overflow:"visible" }}>
      {/* Canopy frame */}
      <line x1="8"  y1="10" x2="8"  y2="44" stroke={INK} strokeWidth="2"/>
      <line x1="72" y1="10" x2="72" y2="44" stroke={INK} strokeWidth="2"/>
      {/* Canopy fabric */}
      <path d="M4,10 Q40,4 76,10 L72,22 Q40,16 8,22 Z" fill="#6B9E7A" stroke={INK} strokeWidth="1.6"/>
      {/* Scalloped hem */}
      {[10,18,26,34,42,50,58,66,74].map((x,i) => (
        <circle key={i} cx={x} cy={23} r={4} fill="#6B9E7A" stroke={INK} strokeWidth="1.2"/>
      ))}
      {/* Counter */}
      <rect x="6" y="34" width="68" height="10" rx="2" fill="#D4B896" stroke={INK} strokeWidth="1.6"/>
      {/* Items on counter */}
      <circle cx="20" cy="32" r="4" fill="#E8634A" stroke={INK} strokeWidth="1.2"/>
      <circle cx="30" cy="31" r="3.5" fill="#E8634A" stroke={INK} strokeWidth="1.1"/>
      <circle cx="40" cy="32" r="3" fill="#C890C0" stroke={INK} strokeWidth="1"/>
      <rect x="50" y="28" width="6" height="7" rx="1" fill="#FAF6EF" stroke={INK} strokeWidth="1"/>
      <rect x="58" y="29" width="5" height="6" rx="1" fill="#FAF6EF" stroke={INK} strokeWidth="1"/>
      {/* Legs */}
      <line x1="12" y1="44" x2="12" y2="60" stroke={INK} strokeWidth="2"/>
      <line x1="68" y1="44" x2="68" y2="60" stroke={INK} strokeWidth="2"/>
    </svg>
  );
}

function WellAsset() {
  return (
    <svg width="58" height="68" viewBox="0 0 58 68" style={{ overflow:"visible" }}>
      {/* Roof frame */}
      <line x1="10" y1="24" x2="10" y2="10" stroke={INK} strokeWidth="2"/>
      <line x1="48" y1="24" x2="48" y2="10" stroke={INK} strokeWidth="2"/>
      <polygon points="6,12 29,2 52,12" fill="#E8634A22" stroke={INK} strokeWidth="1.6" strokeLinejoin="round"/>
      {/* Crossbeam + handle */}
      <line x1="8" y1="10" x2="50" y2="10" stroke={INK} strokeWidth="2"/>
      <circle cx="29" cy="10" r="3" fill={P_WARM} stroke={INK} strokeWidth="1.5"/>
      {/* Rope */}
      <line x1="29" y1="13" x2="29" y2="28" stroke={INK} strokeWidth="1.2" strokeDasharray="2,1.5"/>
      {/* Bucket */}
      <rect x="24" y="28" width="10" height="10" rx="2" fill="#C8A882" stroke={INK} strokeWidth="1.4"/>
      <path d="M24,30 Q29,27 34,30" fill="none" stroke={INK} strokeWidth="1.2"/>
      {/* Well body */}
      <ellipse cx="29" cy="36" rx="22" ry="6" fill={P_WARM} stroke={INK} strokeWidth="1.6"/>
      <rect x="7" y="36" width="44" height="24" rx="2" fill={P_WARM} stroke={INK} strokeWidth="1.6"/>
      {/* Stone ring pattern */}
      {[0,1,2].map(i => (
        <ellipse key={i} cx={29} cy={36+i*8} rx={22-i*0.5} ry={4} fill="none" stroke="#C8C2B4" strokeWidth="0.8"/>
      ))}
      <ellipse cx="29" cy="60" rx="22" ry="6" fill={P_WARM} stroke={INK} strokeWidth="1.6"/>
      {/* Water inside */}
      <ellipse cx="29" cy="38" rx="18" ry="3.5" fill="#9BBFCF" opacity="0.5"/>
    </svg>
  );
}

// ── MEDIEVAL BUILDING SVGS ───────────────────────────────────────────────────
const STONE = "#C8C4BC";
const STONE_D = "#9C988E";
const STONE_DK = "#706C64";
const TIMBER = "#8C6A40";
const THATCH = "#C8A850";
const MED_RED = "#8B1A1A";
const MED_BLUE = "#2A4A6A";
const MORTAR = "#E8E2D4";

function CastleTowerAsset() {
  return (
    <svg width="60" height="80" viewBox="0 0 60 80" style={{ overflow:"visible" }}>
      {/* Crenellations */}
      {[4,16,28,40,52].map((x,i) => (
        <rect key={i} x={x} y={4} width={8} height={12} rx={1} fill={STONE} stroke={INK} strokeWidth={1.4}/>
      ))}
      {/* Tower body */}
      <rect x={4} y={14} width={52} height={56} rx={2} fill={STONE} stroke={INK} strokeWidth={1.8}/>
      {/* Stone block courses */}
      {[24,34,44,54].map((y,i) => (
        <line key={i} x1={4} y1={y} x2={56} y2={y} stroke={STONE_D} strokeWidth={0.9}/>
      ))}
      {[16,22,30,38,46,54,62].map((y,i) => (
        <line key={i} x1={i%2===0?4:14} y1={y} x2={i%2===0?14:56} y2={y} stroke={STONE_D} strokeWidth={0.6}/>
      ))}
      {/* Arrow slits */}
      <rect x={26} y={22} width={8} height={18} rx={1} fill={STONE_DK} stroke={INK} strokeWidth={1.2}/>
      <rect x={24} y={28} width={12} height={6} rx={1} fill={STONE_DK} stroke={INK} strokeWidth={1}/>
      {/* Door arch */}
      <path d="M20,70 L20,52 Q30,42 40,52 L40,70 Z" fill={STONE_DK} stroke={INK} strokeWidth={1.5}/>
      {/* Portcullis lines */}
      {[46,50,54,58,62,66].map(y => (
        <line key={y} x1={22} y1={y} x2={38} y2={y} stroke={STONE_D} strokeWidth={0.7}/>
      ))}
      {/* Flag */}
      <line x1={30} y1={4} x2={30} y2={-18} stroke={INK} strokeWidth={1.4}/>
      <polygon points="30,-18 46,-12 30,-6" fill={MED_RED} stroke={INK} strokeWidth={1.2}/>
    </svg>
  );
}

function CathedralAsset() {
  return (
    <svg width="72" height="90" viewBox="0 0 72 90" style={{ overflow:"visible" }}>
      {/* Central spire */}
      <polygon points="36,0 28,22 44,22" fill={STONE} stroke={INK} strokeWidth={1.6} strokeLinejoin="round"/>
      <rect x={32} y={20} width={8} height={14} fill={STONE} stroke={INK} strokeWidth={1.4}/>
      {/* Cross on top */}
      <line x1={36} y1={-4} x2={36} y2={4} stroke={INK} strokeWidth={2}/>
      <line x1={32} y1={0} x2={40} y2={0} stroke={INK} strokeWidth={2}/>
      {/* Side towers */}
      <rect x={4} y={28} width={18} height={50} rx={1} fill={STONE} stroke={INK} strokeWidth={1.5}/>
      <rect x={50} y={28} width={18} height={50} rx={1} fill={STONE} stroke={INK} strokeWidth={1.5}/>
      <polygon points="4,30 13,14 22,30" fill={MORTAR} stroke={INK} strokeWidth={1.4}/>
      <polygon points="50,30 59,14 68,30" fill={MORTAR} stroke={INK} strokeWidth={1.4}/>
      {/* Nave */}
      <rect x={16} y={34} width={40} height={44} rx={1} fill={MORTAR} stroke={INK} strokeWidth={1.6}/>
      {/* Gothic windows — pointed arches */}
      {[8,20].map(x => (
        <path key={x} d={`M${x},38 L${x},52 Q${x+5},46 ${x+10},52 L${x+10},38`}
          fill={MED_BLUE+"44"} stroke={INK} strokeWidth={1.1}/>
      ))}
      {[46,58].map(x => (
        <path key={x} d={`M${x},38 L${x},52 Q${x+5},46 ${x+10},52 L${x+10},38`}
          fill={MED_BLUE+"44"} stroke={INK} strokeWidth={1.1}/>
      ))}
      {/* Central rose window */}
      <circle cx={36} cy={44} r={8} fill={MED_BLUE+"33"} stroke={INK} strokeWidth={1.3}/>
      {[0,45,90,135].map(a => (
        <line key={a} x1={36+8*Math.cos(a*Math.PI/180)} y1={44+8*Math.sin(a*Math.PI/180)}
          x2={36-8*Math.cos(a*Math.PI/180)} y2={44-8*Math.sin(a*Math.PI/180)}
          stroke={INK} strokeWidth={0.9}/>
      ))}
      {/* Main door arch */}
      <path d="M24,78 L24,60 Q36,50 48,60 L48,78 Z" fill={STONE_DK} stroke={INK} strokeWidth={1.5}/>
      <line x1={36} y1={60} x2={36} y2={78} stroke={STONE} strokeWidth={0.8}/>
      {/* Steps */}
      <rect x={18} y={76} width={36} height={4} rx={1} fill={STONE_D} stroke={INK} strokeWidth={1.2}/>
      <rect x={14} y={80} width={44} height={4} rx={1} fill={STONE_D} stroke={INK} strokeWidth={1.2}/>
      <rect x={10} y={84} width={52} height={4} rx={1} fill={STONE_D} stroke={INK} strokeWidth={1.2}/>
    </svg>
  );
}

function TavernAsset() {
  return (
    <svg width="72" height="70" viewBox="0 0 72 70" style={{ overflow:"visible" }}>
      {/* Thatched roof */}
      <path d="M2,28 Q36,14 70,28" fill={THATCH} stroke={INK} strokeWidth={1.8}/>
      <path d="M2,28 Q36,20 70,28 L68,34 Q36,26 4,34 Z" fill={THATCH} stroke={INK} strokeWidth={1.4}/>
      {/* Roof texture lines */}
      {[20,28,36,44,52].map(x => (
        <path key={x} d={`M${x},16 Q${x+4},22 ${x},28`} stroke="#A88030" strokeWidth={0.9} fill="none"/>
      ))}
      {/* Body — half-timber frame */}
      <rect x={4} y={32} width={64} height={36} rx={1} fill={MORTAR} stroke={INK} strokeWidth={1.6}/>
      {/* Timber beams */}
      <line x1={4} y1={48} x2={68} y2={48} stroke={TIMBER} strokeWidth={2}/>
      <line x1={20} y1={32} x2={20} y2={68} stroke={TIMBER} strokeWidth={2}/>
      <line x1={52} y1={32} x2={52} y2={68} stroke={TIMBER} strokeWidth={2}/>
      <line x1={4} y1={32} x2={20} y2={48} stroke={TIMBER} strokeWidth={1.5}/>
      <line x1={52} y1={32} x2={68} y2={48} stroke={TIMBER} strokeWidth={1.5}/>
      {/* Leaded windows */}
      <rect x={7} y={36} width={10} height={9} rx={1} fill="#C8DDE888" stroke={INK} strokeWidth={1.1}/>
      <line x1={12} y1={36} x2={12} y2={45} stroke={INK} strokeWidth={0.8}/>
      <rect x={55} y={36} width={10} height={9} rx={1} fill="#C8DDE888" stroke={INK} strokeWidth={1.1}/>
      <line x1={60} y1={36} x2={60} y2={45} stroke={INK} strokeWidth={0.8}/>
      {/* Door */}
      <rect x={29} y={50} width={14} height={18} rx={2} fill={TIMBER} stroke={INK} strokeWidth={1.5}/>
      <circle cx={41} cy={60} r={1.5} fill={MORTAR}/>
      {/* Hanging sign */}
      <line x1={50} y1={18} x2={50} y2={28} stroke={TIMBER} strokeWidth={1.5}/>
      <line x1={44} y1={18} x2={56} y2={18} stroke={TIMBER} strokeWidth={1.5}/>
      <rect x={43} y={10} width={18} height={12} rx={2} fill={MORTAR} stroke={TIMBER} strokeWidth={1.3}/>
      <text x={52} y={19} textAnchor="middle" fontFamily="Caveat,cursive" fontSize={7} fill={INK}>⚔ Inn</text>
    </svg>
  );
}

function BlacksmithAsset() {
  return (
    <svg width="68" height="62" viewBox="0 0 68 62" style={{ overflow:"visible" }}>
      {/* Lean-to roof (asymmetric) */}
      <path d="M2,20 L2,36 L66,30 L66,14 Z" fill={STONE_D} stroke={INK} strokeWidth={1.6}/>
      <path d="M2,20 L66,14" stroke={INK} strokeWidth={1.8}/>
      {/* Body */}
      <rect x={2} y={34} width={64} height={26} rx={1} fill={STONE} stroke={INK} strokeWidth={1.6}/>
      {/* Stone courses */}
      {[40,48,56].map(y => <line key={y} x1={2} y1={y} x2={66} y2={y} stroke={STONE_D} strokeWidth={0.8}/>)}
      {/* Forge opening — glowing */}
      <rect x={8} y={38} width={20} height={18} rx={2} fill={STONE_DK} stroke={INK} strokeWidth={1.4}/>
      <ellipse cx={18} cy={54} rx={8} ry={4} fill="#FF8C00" opacity={0.8}/>
      <ellipse cx={18} cy={50} rx={5} ry={5} fill="#FF6400" opacity={0.6}/>
      <ellipse cx={18} cy={47} rx={3} ry={4} fill="#FFB200" opacity={0.9}/>
      {/* Chimney */}
      <rect x={10} y={10} width={10} height={18} rx={1} fill={STONE_D} stroke={INK} strokeWidth={1.5}/>
      <circle cx={15} cy={9} r={3} fill="none" stroke={INK} strokeWidth={1} opacity={0.4}/>
      <circle cx={17} cy={5} r={2.2} fill="none" stroke={INK} strokeWidth={0.9} opacity={0.25}/>
      {/* Anvil */}
      <rect x={36} y={44} width={20} height={6} rx={2} fill={STONE_DK} stroke={INK} strokeWidth={1.4}/>
      <rect x={40} y={38} width={12} height={8} rx={1} fill={STONE_DK} stroke={INK} strokeWidth={1.3}/>
      <rect x={42} y={50} width={4} height={8} rx={1} fill={STONE_DK} stroke={INK} strokeWidth={1.2}/>
      <rect x={48} y={50} width={4} height={8} rx={1} fill={STONE_DK} stroke={INK} strokeWidth={1.2}/>
      {/* Hammer */}
      <line x1={54} y1={36} x2={46} y2={44} stroke={TIMBER} strokeWidth={2}/>
      <rect x={52} y={32} width={8} height={5} rx={1} fill={STONE_DK} stroke={INK} strokeWidth={1.2} transform="rotate(-45,56,34)"/>
    </svg>
  );
}

function GatehouseAsset() {
  return (
    <svg width="80" height="74" viewBox="0 0 80 74" style={{ overflow:"visible" }}>
      {/* Left tower crenellations */}
      {[2,9,16].map(x => <rect key={x} x={x} y={0} width={5} height={9} rx={1} fill={STONE} stroke={INK} strokeWidth={1.3}/>)}
      {/* Right tower crenellations */}
      {[57,64,71].map(x => <rect key={x} x={x} y={0} width={5} height={9} rx={1} fill={STONE} stroke={INK} strokeWidth={1.3}/>)}
      {/* Centre wall crenellations */}
      {[28,35,42].map(x => <rect key={x} x={x} y={8} width={5} height={8} rx={1} fill={STONE} stroke={INK} strokeWidth={1.2}/>)}
      {/* Left tower body */}
      <rect x={2} y={8} width={22} height={64} rx={1} fill={STONE} stroke={INK} strokeWidth={1.6}/>
      {/* Right tower body */}
      <rect x={56} y={8} width={22} height={64} rx={1} fill={STONE} stroke={INK} strokeWidth={1.6}/>
      {/* Centre wall */}
      <rect x={24} y={16} width={32} height={56} rx={1} fill={STONE} stroke={INK} strokeWidth={1.5}/>
      {/* Stone courses — left tower */}
      {[22,32,42,52,62].map(y => <line key={y} x1={2} y1={y} x2={24} y2={y} stroke={STONE_D} strokeWidth={0.8}/>)}
      {/* Stone courses — right tower */}
      {[22,32,42,52,62].map(y => <line key={y} x1={56} y1={y} x2={78} y2={y} stroke={STONE_D} strokeWidth={0.8}/>)}
      {/* Arrow slits — towers */}
      <rect x={10} y={18} width={5} height={14} rx={1} fill={STONE_DK} stroke={INK} strokeWidth={1.1}/>
      <rect x={65} y={18} width={5} height={14} rx={1} fill={STONE_DK} stroke={INK} strokeWidth={1.1}/>
      {/* Gate arch */}
      <path d="M28,74 L28,48 Q40,36 52,48 L52,74 Z" fill={STONE_DK} stroke={INK} strokeWidth={1.6}/>
      {/* Portcullis grid */}
      {[52,58,64,70].map(y => <line key={y} x1={30} y1={y} x2={50} y2={y} stroke={STONE} strokeWidth={0.9}/>)}
      {[34,40,46].map(x => <line key={x} x1={x} y1={48} x2={x} y2={74} stroke={STONE} strokeWidth={0.9}/>)}
      {/* Shield emblem over gate */}
      <path d="M36,26 L44,26 L44,34 Q40,38 36,34 Z" fill={MED_RED} stroke={INK} strokeWidth={1.1}/>
      <line x1={40} y1={26} x2={40} y2={38} stroke={INK} strokeWidth={0.8}/>
    </svg>
  );
}

function WindmillAsset() {
  return (
    <svg width="64" height="84" viewBox="0 0 64 84" style={{ overflow:"visible" }}>
      {/* Tower body */}
      <path d="M10,84 L14,32 Q32,28 50,32 L54,84 Z" fill={STONE} stroke={INK} strokeWidth={1.8}/>
      {/* Stone courses */}
      {[40,52,64,76].map(y => <line key={y} x1={10+(y-32)*0.125} y1={y} x2={54-(y-32)*0.125} y2={y} stroke={STONE_D} strokeWidth={0.8}/>)}
      {/* Conical cap */}
      <path d="M14,32 Q32,16 50,32" fill={THATCH} stroke={INK} strokeWidth={1.6}/>
      <polygon points="32,4 14,32 50,32" fill={THATCH} stroke={INK} strokeWidth={1.6} strokeLinejoin="round"/>
      {/* Door */}
      <rect x={26} y={66} width={12} height={18} rx={2} fill={TIMBER} stroke={INK} strokeWidth={1.4}/>
      {/* Small window */}
      <circle cx={32} cy={52} r={5} fill="#C8DDE888" stroke={INK} strokeWidth={1.2}/>
      {/* Sail hub */}
      <circle cx={32} cy={30} r={4} fill={MORTAR} stroke={INK} strokeWidth={1.4}/>
      {/* 4 sails */}
      {[0,90,180,270].map(angle => {
        const rad = angle * Math.PI / 180;
        const ex = 32 + 24*Math.cos(rad), ey = 30 + 24*Math.sin(rad);
        const px = 32 + 8*Math.cos(rad + Math.PI/6), py = 30 + 8*Math.sin(rad + Math.PI/6);
        const qx = 32 + 8*Math.cos(rad - Math.PI/6), qy = 30 + 8*Math.sin(rad - Math.PI/6);
        return (
          <g key={angle}>
            <line x1={32} y1={30} x2={ex} y2={ey} stroke={TIMBER} strokeWidth={2.5}/>
            <polygon points={`${32},${30} ${px},${py} ${ex},${ey} ${qx},${qy}`}
              fill={MORTAR} stroke={INK} strokeWidth={1.1} opacity={0.9}/>
          </g>
        );
      })}
    </svg>
  );
}

function MarketCrossAsset() {
  return (
    <svg width="44" height="88" viewBox="0 0 44 88" style={{ overflow:"visible" }}>
      {/* Steps base — 3 tiers */}
      <rect x={2}  y={78} width={40} height={6} rx={1} fill={STONE_D} stroke={INK} strokeWidth={1.4}/>
      <rect x={6}  y={72} width={32} height={8} rx={1} fill={STONE}   stroke={INK} strokeWidth={1.4}/>
      <rect x={10} y={66} width={24} height={8} rx={1} fill={STONE}   stroke={INK} strokeWidth={1.3}/>
      {/* Shaft */}
      <rect x={18} y={24} width={8} height={44} rx={2} fill={MORTAR} stroke={INK} strokeWidth={1.5}/>
      {/* Capital decoration */}
      <rect x={14} y={36} width={16} height={6} rx={2} fill={STONE} stroke={INK} strokeWidth={1.3}/>
      <rect x={12} y={32} width={20} height={6} rx={2} fill={STONE} stroke={INK} strokeWidth={1.3}/>
      {/* Octagonal lantern top */}
      <polygon points="22,4 28,8 30,14 28,20 16,20 14,14 16,8"
        fill={MORTAR} stroke={INK} strokeWidth={1.5}/>
      {/* Gothic tracery on lantern */}
      <path d="M18,10 Q22,7 26,10 L26,18 Q22,16 18,18 Z" fill={MED_BLUE+"33"} stroke={INK} strokeWidth={0.9}/>
      {/* Cross finial */}
      <line x1={22} y1={0} x2={22} y2={8} stroke={INK} strokeWidth={2}/>
      <line x1={18} y1={3} x2={26} y2={3} stroke={INK} strokeWidth={2}/>
      {/* Niches with small figures */}
      {[48,58].map(y => (
        <g key={y}>
          <path d={`M16,${y} L16,${y+8} Q22,${y+4} 28,${y+8} L28,${y}`} fill={STONE+"88"} stroke={INK} strokeWidth={0.9}/>
        </g>
      ))}
    </svg>
  );
}

function KeepTowerAsset() {
  return (
    <svg width="76" height="82" viewBox="0 0 76 82" style={{ overflow:"visible" }}>
      {/* Corner turrets — crenellations */}
      {[2,8].map(x => <rect key={x} x={x} y={8} width={5} height={8} rx={1} fill={STONE} stroke={INK} strokeWidth={1.2}/>)}
      {[62,68].map(x => <rect key={x} x={x} y={8} width={5} height={8} rx={1} fill={STONE} stroke={INK} strokeWidth={1.2}/>)}
      {/* Centre crenellations */}
      {[22,30,38,46,54].map(x => <rect key={x} x={x} y={2} width={6} height={10} rx={1} fill={STONE} stroke={INK} strokeWidth={1.3}/>)}
      {/* Corner turret columns */}
      <rect x={2}  y={14} width={16} height={68} rx={2} fill={STONE_D} stroke={INK} strokeWidth={1.5}/>
      <rect x={58} y={14} width={16} height={68} rx={2} fill={STONE_D} stroke={INK} strokeWidth={1.5}/>
      {/* Main body */}
      <rect x={14} y={10} width={48} height={72} rx={1} fill={STONE} stroke={INK} strokeWidth={1.8}/>
      {/* Stone block grid */}
      {[20,30,40,50,60,70].map(y => (
        <line key={y} x1={14} y1={y} x2={62} y2={y} stroke={STONE_D} strokeWidth={0.8}/>
      ))}
      {[26,38,50].map(x => (
        <line key={x} x1={x} y1={10} x2={x} y2={82} stroke={STONE_D} strokeWidth={0.6}/>
      ))}
      {/* Arrow slits — two rows */}
      {[[28,20],[44,20],[28,42],[44,42]].map(([x,y]) => (
        <rect key={`${x}${y}`} x={x} y={y} width={6} height={16} rx={1} fill={STONE_DK} stroke={INK} strokeWidth={1.1}/>
      ))}
      {/* Gate arch */}
      <path d="M24,82 L24,64 Q38,52 52,64 L52,82 Z" fill={STONE_DK} stroke={INK} strokeWidth={1.5}/>
      {/* Portcullis lines */}
      {[66,72,78].map(y => <line key={y} x1={26} y1={y} x2={50} y2={y} stroke={STONE} strokeWidth={0.9}/>)}
      {[30,38,46].map(x => <line key={x} x1={x} y1={64} x2={x} y2={82} stroke={STONE} strokeWidth={0.9}/>)}
      {/* Banner */}
      <line x1={38} y1={2} x2={38} y2={-20} stroke={INK} strokeWidth={1.4}/>
      <polygon points="38,-20 56,-14 38,-8" fill={MED_BLUE} stroke={INK} strokeWidth={1.2}/>
      {/* Corner turret arrow slits */}
      <rect x={7}  y={24} width={4} height={10} rx={1} fill={STONE_DK} stroke={INK} strokeWidth={1}/>
      <rect x={65} y={24} width={4} height={10} rx={1} fill={STONE_DK} stroke={INK} strokeWidth={1}/>
    </svg>
  );
}

function DailyAgentMapAsset({ profile }: { profile: AgentProfile }) {
  return (
    <svg width="82" height="82" viewBox="-41 -41 82 82" aria-label={`${profile.name} 日常精灵`}>
      {profile.render(0.76, false)}
    </svg>
  );
}

const BUILDING_DEFS: { type: BuildingType; label: string; category: BuildingCategory; Asset: React.FC }[] = [
  // Everyday
  { type: "cottage",  label: "小屋",   category: "everyday", Asset: CottageAsset  },
  { type: "cafe",     label: "咖啡馆", category: "everyday", Asset: CafeAsset     },
  { type: "tree",     label: "大树",   category: "everyday", Asset: TreeAsset     },
  { type: "bench",    label: "长椅",   category: "everyday", Asset: BenchAsset    },
  { type: "mailbox",  label: "邮筒",   category: "everyday", Asset: MailboxAsset  },
  { type: "fountain", label: "喷泉",   category: "everyday", Asset: FountainAsset },
  { type: "market",   label: "市集",   category: "everyday", Asset: MarketAsset   },
  { type: "well",     label: "水井",   category: "everyday", Asset: WellAsset     },
  ...AGENT_PROFILES.map(profile => ({
    type: `dailyAgent:${profile.id}` as DailyAgentPlacementType,
    label: profile.name,
    category: "everyday" as const,
    Asset: () => <DailyAgentMapAsset profile={profile}/>,
  })),
  // Generated medieval — transparent front-elevation PNGs
  { type: "medCottage",    label: "小屋",   category: "medieval", Asset: () => <GeneratedMapAsset src={medCottagePng} alt="中世纪小屋"/> },
  { type: "medChapel",     label: "礼拜堂", category: "medieval", Asset: () => <GeneratedMapAsset src={medChapelPng} alt="中世纪礼拜堂"/> },
  { type: "medWatchtower", label: "瞭望塔", category: "medieval", Asset: () => <GeneratedMapAsset src={medWatchtowerPng} alt="中世纪瞭望塔"/> },
  { type: "medApothecary", label: "药剂铺", category: "medieval", Asset: () => <GeneratedMapAsset src={medApothecaryPng} alt="中世纪药剂铺"/> },
  { type: "medMarket",     label: "市集",   category: "medieval", Asset: () => <GeneratedMapAsset src={medMarketPng} alt="中世纪市集"/> },
  { type: "medWell",       label: "水井",   category: "medieval", Asset: () => <GeneratedMapAsset src={medWellPng} alt="中世纪水井"/> },
  { type: "medBridge",     label: "石桥",   category: "medieval", Asset: () => <GeneratedMapAsset src={medBridgePng} alt="中世纪石桥"/> },
  { type: "medWindmill",   label: "风车",   category: "medieval", Asset: () => <GeneratedMapAsset src={medWindmillPng} alt="中世纪风车"/> },
  // Generated modern — transparent front-elevation PNGs
  { type: "modernApartment",  label: "公寓",   category: "modern", Asset: () => <GeneratedMapAsset src={modernApartmentPng} alt="现代公寓"/> },
  { type: "modernCafe",       label: "咖啡馆", category: "modern", Asset: () => <GeneratedMapAsset src={modernCafePng} alt="现代咖啡馆"/> },
  { type: "modernLibrary",    label: "图书馆", category: "modern", Asset: () => <GeneratedMapAsset src={modernLibraryPng} alt="现代图书馆"/> },
  { type: "modernCinema",     label: "电影院", category: "modern", Asset: () => <GeneratedMapAsset src={modernCinemaPng} alt="现代电影院"/> },
  { type: "modernBusShelter", label: "公交站", category: "modern", Asset: () => <GeneratedMapAsset src={modernBusShelterPng} alt="现代公交站"/> },
  { type: "modernPostbox",    label: "邮筒",   category: "modern", Asset: () => <GeneratedMapAsset src={modernPostboxPng} alt="现代邮筒"/> },
  { type: "modernFountain",   label: "喷泉",   category: "modern", Asset: () => <GeneratedMapAsset src={modernFountainPng} alt="现代喷泉"/> },
  { type: "modernKiosk",      label: "报刊亭", category: "modern", Asset: () => <GeneratedMapAsset src={modernKioskPng} alt="现代报刊亭"/> },
  // Pentiment-inspired — transparent manuscript-style front elevations
  { type: "pentimentScriptorium", label: "修院抄写室", category: "pentiment", Asset: () => <GeneratedMapAsset src={pentimentScriptoriumPng} alt="手抄本风格修院抄写室"/> },
  { type: "pentimentBakery", label: "村镇面包房", category: "pentiment", Asset: () => <GeneratedMapAsset src={pentimentBakeryPng} alt="手抄本风格村镇面包房"/> },
  { type: "pentimentChapel", label: "山地礼拜堂", category: "pentiment", Asset: () => <GeneratedMapAsset src={pentimentChapelPng} alt="手抄本风格山地礼拜堂"/> },
  { type: "pentimentGatehouse", label: "修院门楼", category: "pentiment", Asset: () => <GeneratedMapAsset src={pentimentGatehousePng} alt="手抄本风格修院门楼"/> },
  // Existing environment assets are also exposed inside the two style packs.
  // These aliases keep the map interaction model unchanged while the final art is still replaceable.
  { type: "cottage", label: "方块小屋", category: "blockcraft", Asset: CottageAsset },
  { type: "tree", label: "方块树", category: "blockcraft", Asset: TreeAsset },
  { type: "bench", label: "方块长椅", category: "blockcraft", Asset: BenchAsset },
  { type: "mailbox", label: "方块邮筒", category: "blockcraft", Asset: MailboxAsset },
  { type: "market", label: "方块市集", category: "blockcraft", Asset: MarketAsset },
  { type: "well", label: "方块水井", category: "blockcraft", Asset: WellAsset },
  { type: "modernCafe", label: "旧咖啡馆", category: "lakeMystery", Asset: () => <GeneratedMapAsset src={modernCafePng} alt="绣湖风格咖啡馆占位素材"/> },
  { type: "modernLibrary", label: "档案馆", category: "lakeMystery", Asset: () => <GeneratedMapAsset src={modernLibraryPng} alt="绣湖风格档案馆占位素材"/> },
  { type: "modernCinema", label: "放映厅", category: "lakeMystery", Asset: () => <GeneratedMapAsset src={modernCinemaPng} alt="绣湖风格放映厅占位素材"/> },
  { type: "modernPostbox", label: "旧邮筒", category: "lakeMystery", Asset: () => <GeneratedMapAsset src={modernPostboxPng} alt="绣湖风格邮筒占位素材"/> },
  { type: "modernFountain", label: "静默喷泉", category: "lakeMystery", Asset: () => <GeneratedMapAsset src={modernFountainPng} alt="绣湖风格喷泉占位素材"/> },
  { type: "modernKiosk", label: "标本亭", category: "lakeMystery", Asset: () => <GeneratedMapAsset src={modernKioskPng} alt="绣湖风格小亭占位素材"/> },
  { type: "tree", label: "湖畔枯树", category: "lakeMystery", Asset: TreeAsset },
  { type: "bench", label: "旧长椅", category: "lakeMystery", Asset: BenchAsset },
  // Style Skill packs stay independent from the map interaction model.
  ...WORLD_STYLE_SKILL_ASSETS.map(({ type, label, category, src, alt }) => ({
    type,
    label,
    category,
    Asset: () => <GeneratedMapAsset src={src} alt={alt}/>,
  })),
];

function BuildingAsset({ type }: { type: BuildingType }) {
  const def = BUILDING_DEFS.find(d => d.type === type);
  return def ? <def.Asset/> : null;
}

type ObjectArchiveStyle = "blockcraft" | "lakeMystery" | "pentiment" | "medieval";

const OBJECT_ARCHIVE_STYLES: {
  id: ObjectArchiveStyle;
  label: string;
  note: string;
  accent: string;
  types: BuildingType[];
}[] = [
  {
    id: "blockcraft",
    label: "我的世界",
    note: "方块环境素材",
    accent: "#579447",
    types: ["cottage", "tree", "bench", "mailbox", "market", "well"],
  },
  {
    id: "lakeMystery",
    label: "绣湖",
    note: "怪诞日常物件",
    accent: "#6A6957",
    types: ["modernCafe", "modernLibrary", "modernCinema", "modernPostbox", "modernFountain", "modernKiosk"],
  },
  {
    id: "pentiment",
    label: "Pentiment",
    note: "手抄本聚落建筑",
    accent: "#8A543B",
    types: ["pentimentScriptorium", "pentimentBakery", "pentimentChapel", "pentimentGatehouse"],
  },
  {
    id: "medieval",
    label: "中世纪",
    note: "聚落建筑素材",
    accent: "#2A4A6A",
    types: ["medCottage", "medChapel", "medWatchtower", "medApothecary", "medMarket", "medWell", "medBridge", "medWindmill"],
  },
];

// ── BUILD PALETTE ──────────────────────────────────────────────────────────────
type BuildPaletteStyle = "dailySpirits" | WorldStyleSkillCategory;
type BuildPaletteTab = "agents" | "objects";
type DailyObjectCategory = "everyday" | "medieval" | "modern";

const BUILD_PALETTE_STYLES: { id: BuildPaletteStyle; label: string; accent: string }[] = [
  { id: "dailySpirits", label: "日常精灵", accent: "#E8634A" },
  ...WORLD_STYLE_SKILLS.map(({ id, label, accent }) => ({ id, label, accent })),
];

const DAILY_OBJECT_CATEGORIES: { id: DailyObjectCategory; label: string }[] = [
  { id: "everyday", label: "日常" },
  { id: "medieval", label: "中世纪" },
  { id: "modern", label: "现代" },
];

const DAILY_AGENT_PLACEMENT_TYPES = new Set<BuildingType>(
  AGENT_PROFILES.map(profile => `dailyAgent:${profile.id}` as DailyAgentPlacementType),
);
const STYLE_AGENT_PLACEMENT_TYPES = new Set<BuildingType>(
  WORLD_STYLE_SKILL_ASSETS.map(asset => asset.type),
);

function BuildPalette({ onPlace, onClose, onGenerateMedieval, onPlaceAllCharacters, initialStyle = "dailySpirits" }: {
  onPlace: (type: BuildingType) => void;
  onClose: () => void;
  onGenerateMedieval: () => void;
  onPlaceAllCharacters: (category: BuildPaletteStyle) => void;
  initialStyle?: BuildPaletteStyle;
}) {
  const [style, setStyle] = useState<BuildPaletteStyle>(initialStyle);
  const [assetTab, setAssetTab] = useState<BuildPaletteTab>("agents");
  const [dailyObjectCategory, setDailyObjectCategory] = useState<DailyObjectCategory>("everyday");
  const accent = BUILD_PALETTE_STYLES.find(item => item.id === style)?.accent ?? "#E8634A";
  const filtered = BUILDING_DEFS.filter(def => {
    const isDailyAgent = DAILY_AGENT_PLACEMENT_TYPES.has(def.type);
    const isStyleAgent = STYLE_AGENT_PLACEMENT_TYPES.has(def.type);
    if (assetTab === "agents") {
      return style === "dailySpirits"
        ? isDailyAgent
        : def.category === style && isStyleAgent;
    }
    const objectCategory: BuildingCategory = style === "dailySpirits" ? dailyObjectCategory : style;
    return def.category === objectCategory && !isDailyAgent && !isStyleAgent;
  });

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: PAPER, borderRadius: "20px 20px 0 0",
        boxShadow: "0 -4px 24px rgba(28,25,17,0.18)",
        border: "1.5px solid rgba(28,25,17,0.1)",
        paddingBottom: 20,
      }}>
      {/* Handle */}
      <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 6px" }}>
        <div style={{ width:36, height:4, borderRadius:2, background:"rgba(28,25,17,0.18)" }}/>
      </div>

      {/* Title + close */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 18px 10px" }}>
        <p style={{ fontFamily:"Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight:700, color:INK }}>添加到城市</p>
        <button onClick={onClose} style={{ border:"none", background:"transparent", cursor:"pointer", color:"#7A7468" }}>
          <X size={18}/>
        </button>
      </div>

      {/* Style */}
      <div style={{
        display:"flex", alignItems:"center", gap:5,
        padding:"0 14px 10px", overflowX:"auto",
      }}>
        {BUILD_PALETTE_STYLES.map(item => (
          <button key={item.id} onClick={() => setStyle(item.id)}
            style={{
              flex:"0 0 auto", minWidth:0, padding:"6px 9px", borderRadius:9,
              border: style === item.id ? `1.3px solid ${item.accent}` : "1px solid rgba(28,25,17,0.1)",
              background: style === item.id ? item.accent+"14" : "rgba(234,229,218,.65)",
              boxShadow: style === item.id ? `0 1px 4px ${item.accent}18` : "none",
              cursor:"pointer", transition:"all 0.15s", whiteSpace:"nowrap",
            }}>
            <span style={{
              fontSize: "var(--ui-font-body)", lineHeight:1, fontWeight:700, whiteSpace:"nowrap",
              color: style === item.id ? item.accent : "#7A7468",
            }}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Agents / Objects */}
      <div style={{
        display:"grid", gridTemplateColumns:"1fr 1fr", gap:3,
        margin:"0 14px 8px", padding:3, borderRadius:11,
        background:"rgba(234,229,218,.72)", border:"1px solid rgba(28,25,17,.08)",
      }}>
        {([
          { id: "agents" as const, label: "Agents" },
          { id: "objects" as const, label: "Objects" },
        ]).map(tab => (
          <button key={tab.id} type="button" onClick={() => setAssetTab(tab.id)} style={{
            padding:"7px 8px", borderRadius:8, border:"none", cursor:"pointer",
            background:assetTab === tab.id ? "#FAF6EF" : "transparent",
            color:assetTab === tab.id ? accent : "#7A7468",
            boxShadow:assetTab === tab.id ? "0 1px 4px rgba(28,25,17,.1)" : "none",
            fontSize: "var(--ui-font-caption)", fontWeight:700,
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {style === "dailySpirits" && assetTab === "objects" && (
        <div style={{ display:"flex", gap:5, padding:"0 14px 8px" }}>
          {DAILY_OBJECT_CATEGORIES.map(category => (
            <button key={category.id} type="button" onClick={() => setDailyObjectCategory(category.id)} style={{
              padding:"5px 8px", borderRadius:8, cursor:"pointer",
              border:dailyObjectCategory === category.id ? `1px solid ${accent}` : "1px solid rgba(28,25,17,.08)",
              background:dailyObjectCategory === category.id ? `${accent}12` : "#F5F0E8",
              color:dailyObjectCategory === category.id ? accent : "#7A7468",
              fontSize: "var(--ui-font-caption)",
            }}>
              {category.label}
            </button>
          ))}
        </div>
      )}

      {/* Compact action */}
      <div style={{ padding:"0 14px 9px" }}>
        <div style={{
          minHeight:34, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8,
          padding:"6px 8px 6px 10px", borderRadius:10,
          background:accent+"0D", border:`1px solid ${accent}28`,
        }}>
          <span style={{ fontSize: "var(--ui-font-caption)", color:"#7A7468" }}>
            {filtered.length} 个{assetTab === "agents" ? "角色" : "环境"}素材 · 可拖动
          </span>
          {assetTab === "agents" ? (
            <button type="button" onClick={() => onPlaceAllCharacters(style)} style={{
              padding:"6px 9px", borderRadius:8, border:"none", cursor:"pointer",
              background:accent, color:"#FAF6EF", fontSize: "var(--ui-font-caption)",
              display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap",
            }}>
              <Wand2 size={11}/> 全部置入
            </button>
          ) : style === "dailySpirits" && dailyObjectCategory === "medieval" ? (
            <button type="button" onClick={onGenerateMedieval} style={{
              padding:"6px 9px", borderRadius:8, border:"none", cursor:"pointer",
              background:"#2A4A6A", color:"#FAF6EF", fontSize: "var(--ui-font-caption)",
              display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap",
            }}>
              <Wand2 size={11}/> 一键地图
            </button>
          ) : (
            <span style={{ color:accent, fontSize: "var(--ui-font-caption)" }}>点击置入</span>
          )}
        </div>
      </div>

      {/* Grid — scrollable if needed */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, padding:"0 12px", maxHeight:240, overflowY:"auto" }}>
        {filtered.map(({ type, label, Asset }) => (
          <button key={type} onClick={() => onPlace(type)}
            style={{
              display:"flex", flexDirection:"column", alignItems:"center", gap:4,
              padding:"10px 4px 8px", borderRadius:14,
              border:`1.5px solid ${accent}22`,
              background:"#F5F0E8", cursor:"pointer",
              transition:"background 0.12s",
            }}>
            <div style={{ width:54, height:54, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
              <div style={{ transform:"scale(0.62)", transformOrigin:"center" }}>
                <Asset/>
              </div>
            </div>
            <span style={{ fontFamily:"Caveat,cursive", fontSize: "var(--ui-font-label)", fontWeight:700, color:"#5A5450" }}>{label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

type ThemedPlacedAsset = {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
};

const THEMED_BUILD_SLOTS = [
  { x: 9, y: 25 }, { x: 91, y: 25 },
  { x: 9, y: 49 }, { x: 91, y: 49 },
  { x: 10, y: 75 }, { x: 90, y: 75 },
  { x: 28, y: 84 }, { x: 72, y: 84 },
  { x: 27, y: 16 }, { x: 73, y: 16 },
  { x: 7, y: 63 }, { x: 93, y: 63 },
];

type ThemedPresetAsset = {
  type: BuildingType;
  x: number;
  y: number;
  scale?: number;
};

const THEMED_PRESET_ASSETS: Record<ThemedWorldKey, ThemedPresetAsset[]> = {
  fitness: [
    { type: "tree", x: 9, y: 32, scale: 0.72 },
    { type: "tree", x: 91, y: 27, scale: 0.65 },
    { type: "mailbox", x: 9, y: 63, scale: 0.54 },
    { type: "bench", x: 35, y: 79, scale: 0.52 },
    { type: "fountain", x: 73, y: 79, scale: 0.55 },
  ],
  learning: [
    { type: "tree", x: 9, y: 32, scale: 0.7 },
    { type: "tree", x: 91, y: 27, scale: 0.64 },
    { type: "mailbox", x: 91, y: 63, scale: 0.5 },
    { type: "bench", x: 35, y: 79, scale: 0.5 },
    { type: "well", x: 73, y: 79, scale: 0.52 },
  ],
  maker: [
    { type: "tree", x: 9, y: 32, scale: 0.7 },
    { type: "modernPostbox", x: 91, y: 28, scale: 0.48 },
    { type: "modernKiosk", x: 91, y: 63, scale: 0.47 },
    { type: "bench", x: 35, y: 79, scale: 0.5 },
    { type: "modernFountain", x: 73, y: 79, scale: 0.5 },
  ],
};

function ThemedWorldHostScreen({
  worldKey,
  navigate,
  sceneControl,
  capturedPets = [],
  configOverride,
  residentsOverride,
  onBack,
}: {
  worldKey: ThemedWorldKey;
  navigate: (screen: Screen) => void;
  sceneControl: React.ReactNode;
  capturedPets?: PetAsset[];
  configOverride?: ThemedWorldConfig;
  residentsOverride?: ThemedWorldResident[];
  onBack?: () => void;
}) {
  const [showBuildPalette, setShowBuildPalette] = useState(false);
  const [placements, setPlacements] = useState<ThemedPlacedAsset[]>([]);
  const placementId = useRef(0);
  const residents = residentsOverride ?? [
    ...getThemedWorldResidents()[worldKey],
    ...getCrossWorldVisitors(worldKey),
    ...(worldKey === "fitness"
      ? capturedPets.slice(0, 4).map(pet => ({
          id: `captured-${pet.id}`,
          name: pet.name,
          role: "新居民",
          color: "#E8634A",
          recordSourceId: "miko",
          art: <img src={pet.finalUrl} alt={pet.name} draggable={false} style={{ width: 58, height: 58, objectFit: "contain" }}/>,
        }))
      : []),
  ];
  const config = configOverride ?? THEMED_WORLDS[worldKey];
  const initialStyle: BuildPaletteStyle = worldKey === "fitness"
    ? "dailySpirits"
    : worldKey === "learning"
      ? "blockcraft"
      : "lakeMystery";

  const addTypes = (types: BuildingType[]) => {
    setPlacements(previous => [
      ...previous,
      ...types.map((type, index) => {
        const slot = THEMED_BUILD_SLOTS[(previous.length + index) % THEMED_BUILD_SLOTS.length];
        placementId.current += 1;
        return { id: placementId.current, type, x: slot.x, y: slot.y };
      }),
    ]);
  };

  const placeAsset = (type: BuildingType) => {
    addTypes([type]);
    setShowBuildPalette(false);
  };

  const placeAllCharacters = (category: BuildPaletteStyle) => {
    const types: BuildingType[] = category === "dailySpirits"
      ? AGENT_PROFILES.map(profile => `dailyAgent:${profile.id}` as DailyAgentPlacementType)
      : WORLD_STYLE_SKILL_ASSETS
        .filter(asset => asset.category === category)
        .map(asset => asset.type);
    addTypes(types);
    setShowBuildPalette(false);
  };

  const generateMedievalMap = () => {
    addTypes([
      "medWindmill", "medCottage", "medBridge", "medChapel",
      "medMarket", "medWell", "medWatchtower", "medApothecary",
    ]);
    setShowBuildPalette(false);
  };

  const preferredCategory: BuildingCategory = worldKey === "fitness"
    ? "everyday"
    : worldKey === "learning"
      ? "blockcraft"
      : "lakeMystery";
  const findPreferredDefinition = (type: BuildingType) => (
    BUILDING_DEFS.find(item => item.type === type && item.category === preferredCategory)
    || BUILDING_DEFS.find(item => item.type === type)
  );
  const presetDecorations: ThemedWorldDecoration[] = THEMED_PRESET_ASSETS[worldKey].map((preset, index) => {
    const definition = findPreferredDefinition(preset.type);
    const Asset = definition?.Asset;
    return {
      id: -(index + 1),
      label: definition?.label || "场景植物",
      x: preset.x,
      y: preset.y,
      scale: preset.scale,
      preset: true,
      art: Asset ? <Asset/> : <BuildingAsset type={preset.type}/>,
    };
  });
  const placedDecorations: ThemedWorldDecoration[] = placements.map(placement => {
    const definition = findPreferredDefinition(placement.type);
    const Asset = definition?.Asset;
    return {
      ...placement,
      label: definition?.label || "场景物件",
      scale: placement.type === "tree" ? 0.7 : undefined,
      art: Asset ? <Asset/> : <BuildingAsset type={placement.type}/>,
    };
  });
  const decorations = [...presetDecorations, ...placedDecorations];

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <ThemedWorldScreen
        config={config}
        residents={residents}
        sceneControl={sceneControl}
        decorations={decorations}
        onDecorationMove={(id, x, y) => setPlacements(current => current.map(item => item.id === id ? { ...item, x, y } : item))}
        onDecorationRemove={id => setPlacements(current => current.filter(item => item.id !== id))}
        onOpenBuild={() => setShowBuildPalette(true)}
        onCapture={() => navigate("capture")}
        onBack={onBack ?? (() => navigate("worldDock"))}
        onOpenWorldline={() => navigate("worldline")}
        onOpenVisitor={() => navigate("visitorArrival")}
        onOpenAgents={() => navigate("agentGallery")}
      />

      <AnimatePresence>
        {showBuildPalette && (
          <div
            style={{ position: "absolute", inset: 0, zIndex: 80 }}
            onClick={() => setShowBuildPalette(false)}
          >
            <BuildPalette
              initialStyle={initialStyle}
              onPlace={placeAsset}
              onClose={() => setShowBuildPalette(false)}
              onGenerateMedieval={generateMedievalMap}
              onPlaceAllCharacters={placeAllCharacters}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 10. EVERYDAY MEMORY TOWN (Live City)
function EverydayTownScreen({ navigate, sceneControl, capturedPets }: { navigate: (s: Screen) => void; sceneControl: React.ReactNode; capturedPets: PetAsset[] }) {
  const d = DNA.everyday;
  const { world, error: worldError } = useWorldEvolution(3500);
  const [activeAgent, setActiveAgent] = useState<AgentInfo | null>(null);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const bubbleId = useRef(0);
  const wanderOffsets = useWanderOffsets();

  // Horizontal map pan — start centered on panel 1
  const [mapPanX, setMapPanX] = useState(TOWN_PANEL_W);

  // Building placement
  const [buildings, setBuildings] = useState<PlacedBuilding[]>([]);
  const [buildingCounter, setBuildingCounter] = useState(0);
  const [showBuildPalette, setShowBuildPalette] = useState(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [mapMode, setMapMode] = useState<"living" | "medieval">("living");
  const [worldlineVisible, setWorldlineVisible] = useState(true);
  const [visitorVisible, setVisitorVisible] = useState(true);
  const [agentChainOpen, setAgentChainOpen] = useState(false);
  const [agentChainTab, setAgentChainTab] = useState<"learning" | "memory">("learning");
  const [chainAgentId, setChainAgentId] = useState<string | null>(null);
  const [chainNodeIndex, setChainNodeIndex] = useState(-1);
  const [followingPetId, setFollowingPetId] = useState<string | null>(null);
  const [capturedPetPositions, setCapturedPetPositions] = useState<Record<string, { x: number; y: number }>>({});
  const dragRef = useRef<{ id: number; startClientX: number; startClientY: number; startWorldX: number; startWorldY: number } | null>(null);
  const lastEventTick = useRef(0);

  const liveEvent = useMemo(() => {
    if (!world) return null;
    return [...world.events].reverse().find(event => event.participants.some(id => TOWN_AGENT_IDS.includes(id))) || null;
  }, [world]);
  const activeTownAgentIds = liveEvent?.participants.filter(id => TOWN_AGENT_IDS.includes(id)) || [];
  const runtimeActiveAgent = activeAgent && world
    ? world.agents.find(agent => agent.name === activeAgent.name)
    : undefined;
  const chainAgent = world?.agents.find(agent => agent.id === chainAgentId)
    || world?.agents.find(agent => agent.id === activeTownAgentIds[0])
    || world?.agents.find(agent => agent.id === TOWN_AGENT_IDS[0]);
  const learningChain = useMemo(() => {
    if (!chainAgent) return [];
    const reflections = chainAgent.reflections.slice(-4);
    return reflections.map((reflection, index) => {
      const trait = AGENT_CONCEPT_ZH[reflection.changedTrait] || reflection.changedTrait;
      return {
        id: `learning-${reflection.tick}`,
        tick: reflection.tick,
        label: `v${chainAgent.personalityVersion - (reflections.length - 1 - index)}`,
        title: `${trait}被重新理解`,
        text: archiveAgentText(reflection.text),
        meta: `形成新信念 · ${archiveAgentText(reflection.newBelief)}`,
      };
    });
  }, [chainAgent]);
  const memoryChain = useMemo(() => {
    if (!chainAgent) return [];
    return chainAgent.memories.slice(-4).map(memory => {
      const text = archiveAgentText(memory.text);
      const title = text.replace(/^\[[^\]]+\]\s*/, "").split(/[:：]/)[0] || "一段新的个体记忆";
      return {
        id: memory.id,
        tick: memory.tick,
        label: `#${memory.tick}`,
        title,
        text,
        meta: `${archiveMood(memory.emotion)} · 重要度 ${memory.importance}%`,
      };
    });
  }, [chainAgent]);
  const agentChainItems = agentChainTab === "learning" ? learningChain : memoryChain;
  const activeChainNodeIndex = agentChainItems.length
    ? (chainNodeIndex < 0 ? agentChainItems.length - 1 : Math.min(chainNodeIndex, agentChainItems.length - 1))
    : -1;
  const activeChainItem = activeChainNodeIndex >= 0 ? agentChainItems[activeChainNodeIndex] : undefined;
  const chainAgentIndex = chainAgent ? TOWN_AGENT_IDS.indexOf(chainAgent.id) : -1;
  const agentChainKey = agentChainItems.map(item => item.id).join("|");

  useEffect(() => {
    if (agentChainOpen || !liveEvent) return;
    const nextAgentId = liveEvent.participants.find(id => TOWN_AGENT_IDS.includes(id));
    if (nextAgentId && nextAgentId !== chainAgentId) {
      setChainAgentId(nextAgentId);
      setChainNodeIndex(-1);
    }
  }, [liveEvent?.tick, agentChainOpen, chainAgentId]);

  const placeBuilding = (type: BuildingType) => {
    const id = buildingCounter + 1;
    setBuildingCounter(id);
    setBuildings(prev => [...prev, { id, type, x: mapPanX + 160, y: 220 }]);
    setShowBuildPalette(false);
    setSelectedBuildingId(id);
  };

  const generateMedievalMap = () => {
    const types: BuildingType[] = [
      "medWindmill", "medCottage", "medBridge", "medChapel",
      "medMarket", "medWell", "medWatchtower", "medApothecary",
    ];
    const positions = [
      [38, 92], [205, 282], [292, 420], [430, 95],
      [555, 300], [690, 405], [825, 86], [990, 285],
    ];
    const firstId = buildingCounter + 1;
    setBuildings(types.map((type, index) => ({
      id: firstId + index,
      type,
      x: positions[index][0],
      y: positions[index][1],
    })));
    setBuildingCounter(firstId + types.length - 1);
    setMapMode("medieval");
    setMapPanX(TOWN_PANEL_W);
    setSelectedBuildingId(null);
    setShowBuildPalette(false);
  };

  const placeAllStyleCharacters = (category: BuildPaletteStyle) => {
    const characterTypes: BuildingType[] = category === "dailySpirits"
      ? AGENT_PROFILES.map(profile => `dailyAgent:${profile.id}` as DailyAgentPlacementType)
      : WORLD_STYLE_SKILL_ASSETS
        .filter(asset => asset.category === category)
        .map(asset => asset.type);
    if (!characterTypes.length) return;

    const columns = Math.min(4, characterTypes.length);
    const rows = Math.ceil(characterTypes.length / columns);
    const startY = rows > 2 ? 115 : 155;
    const rowGap = rows > 2 ? 130 : 165;
    const startX = mapPanX + (TOWN_PANEL_W - columns * 82) / 2;
    const firstId = buildingCounter + 1;
    const placements = characterTypes.map((type, index) => ({
      id: firstId + index,
      type,
      x: startX + (index % 4) * 82,
      y: startY + Math.floor(index / 4) * rowGap,
    }));
    const selectedTypes = new Set<BuildingType>(characterTypes);

    setBuildings(previous => [
      ...previous.filter(item => !selectedTypes.has(item.type)),
      ...placements,
    ]);
    setBuildingCounter(firstId + characterTypes.length - 1);
    setSelectedBuildingId(null);
    setShowBuildPalette(false);
  };

  const removeBuilding = (id: number) => {
    setBuildings(prev => prev.filter(b => b.id !== id));
    setSelectedBuildingId(null);
  };

  const onBuildingPointerDown = (e: React.PointerEvent, b: PlacedBuilding) => {
    e.stopPropagation();
    setSelectedBuildingId(b.id);
    dragRef.current = { id: b.id, startClientX: e.clientX, startClientY: e.clientY, startWorldX: b.x, startWorldY: b.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onBuildingPointerMove = (e: React.PointerEvent, b: PlacedBuilding) => {
    if (!dragRef.current || dragRef.current.id !== b.id) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    setBuildings(prev => prev.map(item => item.id === b.id
      ? { ...item, x: dragRef.current!.startWorldX + dx, y: dragRef.current!.startWorldY + dy }
      : item
    ));
  };

  const onBuildingPointerUp = () => { dragRef.current = null; };
  const canPanLeft  = mapPanX > 0;
  const canPanRight = mapPanX < TOWN_MAP_W - TOWN_PANEL_W;
  const panLeft  = () => setMapPanX(p => Math.max(0, p - TOWN_PANEL_W));
  const panRight = () => setMapPanX(p => Math.min(TOWN_MAP_W - TOWN_PANEL_W, p + TOWN_PANEL_W));
  const worldClock = world
    ? `${String(Math.floor(world.meta.minute / 60)).padStart(2, "0")}:${String(world.meta.minute % 60).padStart(2, "0")}`
    : "--:--";

  const onWorldPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!followingPetId || dragRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(mapPanX, Math.min(mapPanX + bounds.width - 72, event.clientX - bounds.left + mapPanX - 36));
    const y = Math.max(0, Math.min(bounds.height - 72, event.clientY - bounds.top - 36));
    setCapturedPetPositions(current => ({ ...current, [followingPetId]: { x, y } }));
  };

  // The visible conversation comes from the same backend event that changes
  // memory, relationships, and civilization state.
  useEffect(() => {
    if (!liveEvent || liveEvent.tick === lastEventTick.current) return;
    lastEventTick.current = liveEvent.tick;
    const timers = liveEvent.dialogue.map((line, lineIndex) => {
      const agentIdx = TOWN_AGENT_IDS.indexOf(line.agentId);
      if (agentIdx < 0) return undefined;
      return window.setTimeout(() => showBubble(agentIdx, line.text), lineIndex * 900);
    }).filter((timer): timer is number => timer !== undefined);
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [liveEvent?.tick]);

  function showBubble(agentIdx: number, msg: string) {
    const id = ++bubbleId.current;
    setBubbles(prev => {
      const filtered = prev.filter(b => b.agentIdx !== agentIdx).slice(-3);
      return [...filtered, { id, agentIdx, msg }];
    });
    setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== id)), 8200);
  }

  function playAgentChainItem(index: number) {
    const item = agentChainItems[index];
    if (!item || chainAgentIndex < 0) return;
    setChainNodeIndex(index);
    const prefix = agentChainTab === "learning" ? "我正在学习：" : "我记得：";
    showBubble(chainAgentIndex, `${prefix}${compactAgentText(item.text)}`);
  }

  useEffect(() => {
    if (!agentChainOpen || chainAgentIndex < 0 || !agentChainItems.length) return;
    const playRandomItem = () => playAgentChainItem(Math.floor(Math.random() * agentChainItems.length));
    playRandomItem();
    const timer = window.setInterval(playRandomItem, 5600);
    return () => window.clearInterval(timer);
  }, [agentChainOpen, agentChainTab, chainAgent?.id, agentChainKey]);

  // Tap zones use world coordinates (center panel = +TOWN_PANEL_W)
  const agentTapZones = [
    { agent: AGENT_DATA[0], cx: 85  + TOWN_PANEL_W, cy: 175, r: 32 },
    { agent: AGENT_DATA[1], cx: 275 + TOWN_PANEL_W, cy: 145, r: 28 },
    { agent: AGENT_DATA[2], cx: 95  + TOWN_PANEL_W, cy: 335, r: 30 },
    { agent: AGENT_DATA[3], cx: 295 + TOWN_PANEL_W, cy: 310, r: 28 },
    { agent: AGENT_DATA[4], cx: 145 + TOWN_PANEL_W, cy: 468, r: 28 },
    { agent: AGENT_DATA[5], cx: 305 + TOWN_PANEL_W, cy: 482, r: 28 },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: d.paper, position: "relative" }}>
      <div className="px-4 pt-9 pb-1 flex justify-end">{sceneControl}</div>
      {/* Top overlay */}
      <div className="flex items-center justify-between px-4 pt-1 pb-1">
        <div>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700, color: "#1C1911" }}>
            Memory Town {mapMode === "medieval" && <span style={{ color:"#2A4A6A", fontSize: "var(--ui-font-label)" }}>· MEDIEVAL</span>}
          </p>
          <p style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", color: "#7A7468" }}>
            {world ? `${worldClock} · ${archiveEra(world.meta.era)} · 第 ${world.meta.tick} 回合` : worldError ? "演化引擎暂时离线" : "正在读取文明历史…"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowBuildPalette(true); setSelectedBuildingId(null); }}
            className="px-2.5 py-1 rounded-lg"
            style={{ background: "#EAE5DA", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", color: "#7A7468" }}>
            建造
          </button>
          <button onClick={() => navigate("capture")}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#E8634A", color: "white" }}>
            <Plus size={16}/>
          </button>
        </div>
      </div>

      {/* World field — pannable horizontal map */}
      <div
        className="flex-1 relative"
        onPointerMove={onWorldPointerMove}
        onClick={() => setFollowingPetId(null)}
        style={{ overflow: "hidden", cursor: followingPetId ? "crosshair" : "default" }}
      >

        {/* Inner pannable canvas — 1170px wide */}
        <div style={{
          width: TOWN_MAP_W,
          height: "100%",
          position: "relative",
          transform: `translateX(-${mapPanX}px)`,
          transition: "transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)",
        }}>
          <EverydayTownSVG
            w={TOWN_MAP_W}
            h={560}
            activeAgentIds={worldlineVisible ? activeTownAgentIds : []}
            eventAction={worldlineVisible ? liveEvent?.action?.type : undefined}
            wanderOffsets={wanderOffsets}
          />

          {/* Captured cyber pets live only in this page session and enter the live town here. */}
          {capturedPets.slice(0, 8).map((pet, index) => {
            const defaultPosition = {
              x: TOWN_PANEL_W + 56 + (index % 4) * 88,
              y: 112 + Math.floor(index / 4) * 235,
            };
            const position = capturedPetPositions[pet.id] || defaultPosition;
            const isFollowing = followingPetId === pet.id;
            return (
              <motion.button
                key={pet.id}
                type="button"
                initial={false}
                onClick={event => {
                  event.stopPropagation();
                  setFollowingPetId(current => current === pet.id ? null : pet.id);
                }}
                animate={isFollowing
                  ? { x: position.x, y: position.y, scale: 1.08 }
                  : {
                      x: [position.x, position.x + 18, position.x - 8, position.x],
                      y: [position.y, position.y - 4, position.y, position.y - 2, position.y],
                      scale: 1,
                    }}
                transition={isFollowing
                  ? { type: "spring", stiffness: 280, damping: 26, mass: 0.65 }
                  : { duration: 7 + index * 0.45, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: "absolute", left: 0, top: 0, width: 72, height: 72,
                  background: "transparent", border: 0,
                  cursor: isFollowing ? "grabbing" : "pointer",
                  zIndex: isFollowing ? 30 : 14,
                  filter: isFollowing ? "drop-shadow(0 0 7px rgba(232,99,74,.65))" : "none",
                }}
                aria-pressed={isFollowing}
                aria-label={isFollowing ? `${pet.name} 正在跟随鼠标，点击放下` : `点击让 ${pet.name} 跟随鼠标`}
              >
                <img src={pet.finalUrl} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
                {isFollowing && (
                  <span style={{
                    position: "absolute", left: "50%", bottom: -13, transform: "translateX(-50%)",
                    padding: "2px 5px", borderRadius: 6, whiteSpace: "nowrap",
                    background: "#E8634A", color: "white", fontSize: "var(--ui-font-micro)",
                    fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                    pointerEvents: "none",
                  }}>
                    跟随中 · 点击放下
                  </span>
                )}
              </motion.button>
            );
          })}

          {/* ── Placed buildings — draggable, in world coordinate space ── */}
          {buildings.map(b => {
            const isSelected = selectedBuildingId === b.id;
            return (
              <div
                key={b.id}
                onPointerDown={e => onBuildingPointerDown(e, b)}
                onPointerMove={e => onBuildingPointerMove(e, b)}
                onPointerUp={onBuildingPointerUp}
                style={{
                  position: "absolute",
                  left: b.x, top: b.y,
                  cursor: "grab",
                  userSelect: "none",
                  touchAction: "none",
                  zIndex: 8,
                  filter: isSelected ? "drop-shadow(0 0 6px rgba(232,99,74,0.55))" : "drop-shadow(0 2px 4px rgba(28,25,17,0.15))",
                  transition: "filter 0.15s",
                }}>
                <BuildingAsset type={b.type}/>
                {/* Delete button when selected */}
                {isSelected && (
                  <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => removeBuilding(b.id)}
                    style={{
                      position: "absolute", top: -10, right: -10,
                      width: 22, height: 22, borderRadius: "50%",
                      background: "#E8634A", border: "1.5px solid white",
                      color: "white", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 1px 6px rgba(28,25,17,0.2)",
                      zIndex: 20,
                    }}>
                    <X size={11}/>
                  </button>
                )}
              </div>
            );
          })}

          {/* Live chat bubbles — positioned in world coordinate space */}
          <AnimatePresence>
            {bubbles.map(({ id, agentIdx, msg }) => {
              const anchor = AGENT_ANCHORS_WORLD[agentIdx];
              if (!anchor) return null;
              const { cx: wcx, cy } = anchor;
              const [ox, oy] = wanderOffsets[agentIdx] ?? [0, 0];
              const worldX = wcx + ox;
              const screenX = worldX - mapPanX; // to check left/right of screen center
              const agentColor = TOWN_AGENT_COLORS[agentIdx] ?? "#7A7468";
              // Only render bubbles that are at least partially on screen
              if (screenX < -60 || screenX > 450) return null;
              const onLeft = screenX < 195;
              return (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, scale: 0.7, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: -4 }}
                  transition={{ type: "spring", damping: 18, stiffness: 320 }}
                  style={{
                    position: "absolute",
                    left: worldX,
                    top: cy + oy - 24,
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                >
                  <div style={{
                    background: "#FEFCF8",
                    border: `1.8px solid ${agentColor}55`,
                    borderRadius: 14,
                    padding: "5px 11px 5px 10px",
                    boxShadow: `0 2px 8px ${agentColor}22`,
                    position: "relative",
                    width: 225,
                    whiteSpace: "normal",
                    transform: onLeft ? "translateY(-100%)" : "translate(-100%, -100%)",
                  }}>
                    <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", fontWeight: 700, color: "#1C1911", lineHeight: 1.55 }}>{msg}</span>
                    <svg width={14} height={9} viewBox="0 0 14 9"
                      style={{ position: "absolute", bottom: -9, left: onLeft ? 12 : undefined, right: onLeft ? undefined : 12 }}>
                      <path d="M0,0 L7,9 L14,0" fill="#FEFCF8" stroke={`${agentColor}55`} strokeWidth="1.8" strokeLinejoin="round"/>
                      <line x1={0} y1={0.9} x2={14} y2={0.9} stroke="#FEFCF8" strokeWidth="2"/>
                    </svg>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Tap targets in world coordinates */}
          {agentTapZones.map(({ agent, cx, cy, r }) => (
            <button key={agent.name} onClick={() => setActiveAgent(agent)}
              style={{
                position: "absolute", left: cx - r, top: cy - r,
                width: r * 2, height: r * 2, borderRadius: "50%",
                background: "transparent", border: "none", cursor: "pointer",
              }}/>
          ))}
        </div>

        {chainAgent && activeChainItem && (
          <motion.div
            key={chainAgent.id}
            layout
            initial={{ opacity:0, y:-8 }}
            animate={{ opacity:1, y:0 }}
            style={{
              position:"absolute", left:12, right:12, top:8, zIndex:24,
              background:"rgba(250,246,239,.96)", border:`1.5px solid ${chainAgent.color}55`,
              borderRadius:14, padding:"9px 11px", boxShadow:"0 4px 16px rgba(28,25,17,.09)",
              backdropFilter:"blur(8px)",
            }}>
            <button
              type="button"
              aria-expanded={agentChainOpen}
              aria-label={`${chainAgent.name} 的${agentChainTab === "learning" ? "自我学习进化链" : "个体记忆链"}`}
              onClick={() => setAgentChainOpen(open => !open)}
              style={{ width:"100%", padding:0, border:0, background:"transparent", textAlign:"left", cursor:"pointer" }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="animate-pulse" style={{ width:7, height:7, borderRadius:7, background:chainAgent.color, flexShrink:0 }}/>
                  <span className="truncate" style={{ color:chainAgent.color, fontSize: "var(--ui-font-caption)", letterSpacing:.8 }}>
                    {chainAgent.name.toUpperCase()} · {agentChainTab === "learning" ? "SELF EVOLUTION" : "PERSONAL MEMORY"}
                  </span>
                  <span style={{ color:"#6B9E7A", fontSize: "var(--ui-font-caption)", flexShrink:0 }}>人格 v{chainAgent.personalityVersion}</span>
                </div>
                <span style={{ color:"#7A7468", fontSize: "var(--ui-font-caption)", flexShrink:0 }}>第 {activeChainItem.tick} 回合</span>
              </div>
              <p className="truncate" style={{ color:"#1C1911", fontSize: "var(--ui-font-body)", marginTop:7 }}>{activeChainItem.title}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="truncate" style={{ color:"#7A7468", fontSize: "var(--ui-font-caption)" }}>{activeChainItem.meta}</p>
                <span style={{ color:chainAgent.color, fontSize: "var(--ui-font-caption)", flexShrink:0 }}>
                  {agentChainOpen ? "点击收起 ↑" : "点击展开链路 ↓"}
                </span>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {agentChainOpen && (
                <motion.div
                  initial={{ opacity:0, height:0 }}
                  animate={{ opacity:1, height:"auto" }}
                  exit={{ opacity:0, height:0 }}
                  transition={{ duration:.22 }}
                  style={{ overflow:"hidden" }}
                >
                  <div
                    role="tablist"
                    aria-label="Agent 链路类型"
                    className="grid grid-cols-2 gap-1"
                    style={{ marginTop:9, padding:3, borderRadius:10, background:"#EAE5DA" }}
                  >
                    {([
                      ["learning", "自我学习进化链"],
                      ["memory", "个体记忆链"],
                    ] as const).map(([tab, label]) => {
                      const selected = agentChainTab === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={event => {
                            event.stopPropagation();
                            setAgentChainTab(tab);
                            setChainNodeIndex(-1);
                          }}
                          style={{
                            border:0, borderRadius:8, padding:"6px 4px",
                            background:selected ? chainAgent.color : "transparent",
                            color:selected ? "white" : "#7A7468",
                            fontSize: "var(--ui-font-caption)", cursor:"pointer",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ position:"relative", marginTop:10 }}>
                    <span style={{
                      position:"absolute", left:22, right:22, top:9, height:1.5,
                      background:`${chainAgent.color}45`,
                    }}/>
                    <div className="grid grid-cols-4 gap-1" style={{ position:"relative" }}>
                      {agentChainItems.map((item, index) => {
                        const selected = activeChainNodeIndex === index;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-label={`播放链路节点：${item.title}`}
                            onClick={event => {
                              event.stopPropagation();
                              playAgentChainItem(index);
                            }}
                            style={{
                              border:0, background:"transparent", color:selected ? chainAgent.color : "#8E867A",
                              display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                              minWidth:0, cursor:"pointer",
                            }}
                          >
                            <span style={{
                              width:19, height:19, borderRadius:"50%",
                              display:"grid", placeItems:"center",
                              background:selected ? chainAgent.color : "#FAF6EF",
                              border:`1.5px solid ${selected ? chainAgent.color : `${chainAgent.color}70`}`,
                              color:selected ? "white" : chainAgent.color,
                              fontSize: "var(--ui-font-caption)", boxShadow:"0 0 0 2px #FAF6EF",
                            }}>
                              {index + 1}
                            </span>
                            <span className="truncate" style={{ width:"100%", fontSize: "var(--ui-font-micro)" }}>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <motion.div
                    key={activeChainItem.id}
                    initial={{ opacity:0, x:5 }}
                    animate={{ opacity:1, x:0 }}
                    style={{
                      marginTop:8, padding:"7px 8px", borderRadius:10,
                      background:`${chainAgent.color}0D`, border:`1px solid ${chainAgent.color}28`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate" style={{ color:"#1C1911", fontSize: "var(--ui-font-caption)" }}>{activeChainItem.title}</span>
                      <span style={{ color:chainAgent.color, fontSize: "var(--ui-font-micro)", flexShrink:0 }}>{activeChainItem.label}</span>
                    </div>
                    <p style={{ color:"#5F5A50", fontSize: "var(--ui-font-caption)", lineHeight:1.55, marginTop:5 }}>
                      {compactAgentText(activeChainItem.text, 72)}
                    </p>
                    <p style={{ color:"#8A8478", fontSize: "var(--ui-font-micro)", marginTop:4 }}>
                      场景气泡正在随机播放这条链的具体节点
                    </p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Left edge fade */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 48,
          background: "linear-gradient(to right, rgba(245,240,232,0.72), transparent)",
          pointerEvents: "none", zIndex: 15,
          opacity: canPanLeft ? 1 : 0, transition: "opacity 0.3s",
        }}/>
        {/* Right edge fade */}
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 48,
          background: "linear-gradient(to left, rgba(245,240,232,0.72), transparent)",
          pointerEvents: "none", zIndex: 15,
          opacity: canPanRight ? 1 : 0, transition: "opacity 0.3s",
        }}/>

        {/* Left arrow */}
        <button onClick={panLeft}
          style={{
            position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
            zIndex: 20, width: 36, height: 36, borderRadius: "50%",
            background: "rgba(250,246,239,0.88)", border: "1.5px solid rgba(28,25,17,0.12)",
            boxShadow: "0 2px 8px rgba(28,25,17,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            opacity: canPanLeft ? 1 : 0,
            pointerEvents: canPanLeft ? "auto" : "none",
            transition: "opacity 0.3s",
          }}>
          <ChevronLeft size={18} color="#1C1911"/>
        </button>

        {/* Right arrow */}
        <button onClick={panRight}
          style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            zIndex: 20, width: 36, height: 36, borderRadius: "50%",
            background: "rgba(250,246,239,0.88)", border: "1.5px solid rgba(28,25,17,0.12)",
            boxShadow: "0 2px 8px rgba(28,25,17,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            opacity: canPanRight ? 1 : 0,
            pointerEvents: canPanRight ? "auto" : "none",
            transition: "opacity 0.3s",
          }}>
          <ChevronRight size={18} color="#1C1911"/>
        </button>

        {/* Panel indicator dots */}
        <div style={{
          position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: 6, zIndex: 20,
        }}>
          {Array.from({ length: TOWN_PANELS }).map((_, i) => {
            const active = Math.round(mapPanX / TOWN_PANEL_W) === i;
            return (
              <div key={i} style={{
                width: active ? 16 : 6, height: 6, borderRadius: 3,
                background: active ? "#E8634A" : "rgba(28,25,17,0.2)",
                transition: "all 0.3s",
              }}/>
            );
          })}
        </div>

        {/* Compact map layers — Pocket Earth structure, ForkWorld visual language */}
        <div style={{
          position:"absolute", left:10, bottom:10, zIndex:26,
          width:126, padding:"7px 8px 6px",
          border:"1.2px solid rgba(28,25,17,.13)", borderRadius:12,
          background:"rgba(250,246,239,.91)", backdropFilter:"blur(9px)",
          boxShadow:"0 3px 12px rgba(28,25,17,.08)",
        }}>
          <p style={{ fontSize: "var(--ui-font-micro)", letterSpacing:1.2, color:"#8A8478", marginBottom:4 }}>MAP LAYERS</p>
          {([
            {
              id:"worldline",
              label:"Worldline",
              visible:worldlineVisible,
              color:"#6B9E7A",
              toggle:() => setWorldlineVisible(value => !value),
              open:() => navigate("worldline"),
            },
            {
              id:"visitor",
              label:"Visitor",
              visible:visitorVisible,
              color:"#E8634A",
              toggle:() => setVisitorVisible(value => !value),
              open:() => navigate("visitorArrival"),
            },
          ] as const).map(layer => (
            <div key={layer.id} style={{
              display:"flex", alignItems:"center", minHeight:24,
              borderTop:"1px solid rgba(28,25,17,.06)",
            }}>
              <button
                type="button"
                aria-label={`${layer.visible ? "关闭" : "打开"} ${layer.label} 图层`}
                aria-pressed={layer.visible}
                onClick={layer.toggle}
                style={{
                  width:25, height:14, padding:0, flexShrink:0,
                  border:`1px solid ${layer.visible ? layer.color : "#C8C2B4"}`,
                  borderRadius:8, cursor:"pointer",
                  background:layer.visible ? `${layer.color}2E` : "#EAE5DA",
                  position:"relative", transition:"all .18s ease",
                }}>
                <span style={{
                  position:"absolute", top:2, left:layer.visible ? 13 : 2,
                  width:8, height:8, borderRadius:"50%",
                  background:layer.visible ? layer.color : "#A49E92",
                  transition:"left .18s ease",
                }}/>
              </button>
              <button type="button" onClick={layer.open} style={{
                flex:1, minWidth:0, display:"flex", alignItems:"center",
                gap:4, padding:"4px 0 4px 7px", border:"none",
                background:"transparent", cursor:"pointer", color:"#4D4941",
              }}>
                <span style={{ fontFamily:"VT323,monospace", fontSize: "var(--ui-font-label)", lineHeight:1 }}>{layer.label}</span>
                <ChevronRight size={10} style={{ marginLeft:"auto", color:"#9A9488" }}/>
              </button>
            </div>
          ))}
        </div>

        {/* Deselect building on map tap */}
        <div style={{ position:"absolute", inset:0, zIndex:1, pointerEvents: selectedBuildingId ? "auto" : "none" }}
          onClick={() => setSelectedBuildingId(null)}/>
      </div>

      {/* ── Overlays: outside overflow:hidden map, absolute over full screen ── */}
      <AnimatePresence>
        {activeAgent && (
          <CompatibilityDialog
            agent={activeAgent}
            runtimeAgent={runtimeActiveAgent}
            worldAgents={world?.agents}
            era={world?.meta.era}
            onClose={() => setActiveAgent(null)}
            onProfile={() => { setActiveAgent(null); navigate("agentDetail"); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBuildPalette && (
          <div style={{ position:"absolute", inset:0, zIndex:80 }}
            onClick={() => setShowBuildPalette(false)}>
            <BuildPalette
              onPlace={placeBuilding}
              onClose={() => setShowBuildPalette(false)}
              onGenerateMedieval={generateMedievalMap}
              onPlaceAllCharacters={placeAllStyleCharacters}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 11. STARDOM DISTRICT
function StardomDistrictScreen({ navigate, sceneControl }: { navigate: (s: Screen) => void; sceneControl: React.ReactNode }) {
  const d = DNA.stardom;
  const { world, error: worldError } = useWorldEvolution(3500);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const bubbleId = useRef(0);
  const lastEventTick = useRef(0);
  const wanderOffsets = useWanderOffsets();
  const liveEvent = useMemo(() => {
    if (!world) return null;
    return [...world.events].reverse().find(event => STARDOM_EVENT_LOCATIONS.has(event.location)) || null;
  }, [world]);
  const activeResidentIndexes = useMemo(
    () => Array.from(new Set((liveEvent?.participants || []).map(stardomResidentIndex))),
    [liveEvent],
  );
  const worldClock = world
    ? `${String(Math.floor(world.meta.minute / 60)).padStart(2, "0")}:${String(world.meta.minute % 60).padStart(2, "0")}`
    : "--:--";

  useEffect(() => {
    if (!liveEvent || liveEvent.tick === lastEventTick.current) return;
    lastEventTick.current = liveEvent.tick;
    const timers = liveEvent.dialogue.map((line, lineIndex) => window.setTimeout(() => {
      const agentIdx = stardomResidentIndex(line.agentId);
      const id = ++bubbleId.current;
      setBubbles(previous => [
        ...previous.filter(bubble => bubble.agentIdx !== agentIdx).slice(-3),
        { id, agentIdx, msg: line.text },
      ]);
      window.setTimeout(
        () => setBubbles(previous => previous.filter(bubble => bubble.id !== id)),
        8200,
      );
    }, lineIndex * 900));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [liveEvent?.tick]);

  return (
    <div className="flex flex-col h-full" style={{ background: d.paper }}>
      <div className="px-4 pt-9 pb-1 flex justify-end">{sceneControl}</div>
      <div className="flex items-center justify-between px-4 pt-1 pb-1">
        <div>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700, color: "#1C1911" }}>
            Stardom District
          </p>
          <p style={{ fontFamily: "VT323,monospace", fontSize: "var(--ui-font-heading)", color: "#7A7468" }}>
            {world ? `${worldClock} · ${archiveEra(world.meta.era)} · 第 ${world.meta.tick} 回合` : worldError ? "演化引擎暂时离线" : "正在读取方块文明…"}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-2.5 py-1 rounded-lg"
            style={{ background: "#F8E8F0", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", color: "#7A7468" }}>建造</button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#E8191A", color: "white" }}>
            <Plus size={16}/>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <StardomDistrictSVG
          w={390}
          h={560}
          activeResidentIndexes={activeResidentIndexes}
          eventAction={liveEvent?.action?.type}
        />

        <AnimatePresence>
          {bubbles.map(({ id, agentIdx, msg }) => {
            const resident = STARDOM_BLOCK_RESIDENTS[agentIdx];
            if (!resident) return null;
            const [ox, oy] = wanderOffsets[agentIdx] ?? [0, 0];
            const x = resident.x + ox;
            const y = resident.y - resident.size + oy - 7;
            const onLeft = x < 195;
            const color = STARDOM_RESIDENT_COLORS[agentIdx] || "#E8191A";
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, scale: 0.7, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: -4 }}
                transition={{ type: "spring", damping: 18, stiffness: 320 }}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  transform: onLeft ? "none" : "translateX(-100%)",
                  pointerEvents: "none",
                  zIndex: 20,
                }}
              >
                <div style={{
                  width: 215,
                  padding: "6px 10px",
                  position: "relative",
                  borderRadius: 14,
                  background: "rgba(255,252,248,.97)",
                  border: `1.8px solid ${color}55`,
                  boxShadow: `0 3px 10px ${color}22`,
                }}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span style={{ width: 6, height: 6, borderRadius: 6, background: color }}/>
                    <span style={{ color, fontSize: "var(--ui-font-caption)" }}>{STARDOM_RESIDENT_NAMES[agentIdx]}</span>
                  </div>
                  <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", color: "#1C1911", lineHeight: 1.55 }}>
                    {msg}
                  </span>
                  <svg
                    width={14}
                    height={9}
                    viewBox="0 0 14 9"
                    style={{ position: "absolute", bottom: -9, left: onLeft ? 12 : undefined, right: onLeft ? undefined : 12 }}
                  >
                    <path d="M0,0 L7,9 L14,0" fill="#FFFCF8" stroke={`${color}55`} strokeWidth="1.8" strokeLinejoin="round"/>
                    <line x1={0} y1={0.9} x2={14} y2={0.9} stroke="#FFFCF8" strokeWidth="2"/>
                  </svg>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {liveEvent && (
          <motion.div
            key={liveEvent.tick}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              top: 8,
              zIndex: 24,
              padding: "9px 11px",
              borderRadius: 14,
              background: "rgba(255,249,251,.95)",
              border: "1.5px solid rgba(232,25,26,.28)",
              boxShadow: "0 4px 16px rgba(28,25,17,.09)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="animate-pulse" style={{ width: 7, height: 7, borderRadius: 7, background: "#E8191A" }}/>
                <span style={{ color: "#E8191A", fontSize: "var(--ui-font-caption)", letterSpacing: 1 }}>CIVILIZATION LIVE</span>
                <span style={{ color: "#579447", fontSize: "var(--ui-font-caption)" }}>阶段 {liveEvent.phase?.complexity || world?.meta.eraNumber || 1}/5</span>
              </div>
              <span style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)" }}>第 {liveEvent.tick} 回合</span>
            </div>
            <p className="truncate" style={{ color: "#1C1911", fontSize: "var(--ui-font-body)", marginTop: 7 }}>{liveEvent.title}</p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="truncate" style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)" }}>
                {liveEvent.action?.label || liveEvent.type} · {liveEvent.phase?.focus || "共同生存"}
              </p>
              <div className="flex shrink-0 -space-x-1">
                {liveEvent.participants.map(agentId => {
                  const residentIndex = stardomResidentIndex(agentId);
                  const name = STARDOM_RESIDENT_NAMES[residentIndex];
                  return (
                    <span
                      key={agentId}
                      title={name}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 6,
                        background: STARDOM_RESIDENT_COLORS[residentIndex],
                        border: "1.5px solid #FFF9FB",
                        color: "white",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "var(--ui-font-micro)",
                      }}
                    >
                      {name.slice(0, 1)}
                    </span>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        <button onClick={() => navigate("visitorArrival")}
          className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-2xl"
          style={{
            background: "rgba(255,245,248,0.95)",
            border: "1.5px solid #E8191A40",
            animation: "visitorGlow 2s ease-in-out infinite"
          }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#E8191A" }}/>
          <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", color: "#E8191A" }}>访客档案员正在抵达</span>
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-2 pt-1"
        style={{ borderTop: "1px solid rgba(28,25,17,0.08)" }}>
        <button onClick={() => navigate("worldline")} className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: "#F8E8F0", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", color: "#7A7468" }}>
          <Compass size={13}/> 世界线
        </button>
        <button onClick={() => navigate("visitorArrival")} className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: "#E8191A18", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", color: "#E8191A" }}>
          <Globe size={13}/> 访客 ★
        </button>
        <button onClick={() => navigate("agentGallery")} className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: "#F8E8F0", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", color: "#7A7468" }}>
          <Package size={13}/> 智能体
        </button>
      </div>
    </div>
  );
}

// 12. FUTURE COLONY
function FutureColonyScreen({ navigate, sceneControl }: { navigate: (s: Screen) => void; sceneControl: React.ReactNode }) {
  const d = DNA.future;
  const { world, error: worldError } = useWorldEvolution(3500);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const bubbleId = useRef(0);
  const lastEventTick = useRef(0);
  const wanderOffsets = useWanderOffsets();
  const liveEvent = useMemo(() => {
    if (!world) return null;
    return [...world.events].reverse().find(event => FUTURE_EVENT_LOCATIONS.has(event.location)) || null;
  }, [world]);
  const activeResidentIndexes = useMemo(
    () => Array.from(new Set((liveEvent?.participants || []).map(futureResidentIndex))),
    [liveEvent],
  );
  const worldClock = world
    ? `${String(Math.floor(world.meta.minute / 60)).padStart(2, "0")}:${String(world.meta.minute % 60).padStart(2, "0")}`
    : "--:--";

  useEffect(() => {
    if (!liveEvent || liveEvent.tick === lastEventTick.current) return;
    lastEventTick.current = liveEvent.tick;
    const timers = liveEvent.dialogue.map((line, lineIndex) => window.setTimeout(() => {
      const agentIdx = futureResidentIndex(line.agentId);
      const id = ++bubbleId.current;
      setBubbles(previous => [
        ...previous.filter(bubble => bubble.agentIdx !== agentIdx).slice(-3),
        { id, agentIdx, msg: line.text },
      ]);
      window.setTimeout(
        () => setBubbles(previous => previous.filter(bubble => bubble.id !== id)),
        8200,
      );
    }, lineIndex * 900));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [liveEvent?.tick]);

  return (
    <div className="flex flex-col h-full" style={{ background: d.paper }}>
      <div className="px-4 pt-9 pb-1 flex justify-end">{sceneControl}</div>
      <div className="flex items-center justify-between px-4 pt-1 pb-1">
        <div>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700, color: "#2A3048" }}>
            Future Colony
          </p>
          <p style={{ fontFamily: "VT323,monospace", fontSize: "var(--ui-font-heading)", color: "#8090A8" }}>
            {world ? `${worldClock} · ${archiveEra(world.meta.era)} · 第 ${world.meta.tick} 回合` : worldError ? "演化引擎暂时离线" : "正在读取绣湖文明…"}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-2.5 py-1 rounded-lg"
            style={{ background: "#C8D0DC", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", color: "#8090A8" }}>建造</button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: d.a1, color: "white" }}>
            <Plus size={16}/>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <FutureColonySVG
          w={390}
          h={560}
          activeResidentIndexes={activeResidentIndexes}
          eventAction={liveEvent?.action?.type}
        />

        <AnimatePresence>
          {bubbles.map(({ id, agentIdx, msg }) => {
            const resident = FUTURE_LAKE_RESIDENTS[agentIdx];
            if (!resident) return null;
            const [ox, oy] = wanderOffsets[agentIdx] ?? [0, 0];
            const x = resident.x + ox;
            const y = resident.y - resident.size + oy - 6;
            const onLeft = x < 195;
            const color = FUTURE_RESIDENT_COLORS[agentIdx] || d.a1;
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, scale: 0.7, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: -4 }}
                transition={{ type: "spring", damping: 18, stiffness: 320 }}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  transform: onLeft ? "none" : "translateX(-100%)",
                  pointerEvents: "none",
                  zIndex: 20,
                }}
              >
                <div style={{
                  width: 215,
                  padding: "7px 10px",
                  position: "relative",
                  borderRadius: 14,
                  background: "rgba(247,248,251,.97)",
                  border: `1.8px solid ${color}55`,
                  boxShadow: `0 3px 10px ${color}22`,
                }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span style={{ width: 6, height: 6, borderRadius: 6, background: color }}/>
                    <span style={{ color, fontSize: "var(--ui-font-caption)" }}>{FUTURE_RESIDENT_NAMES[agentIdx]}</span>
                  </div>
                  <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", color: "#2A3048", lineHeight: 1.55 }}>
                    {msg}
                  </span>
                  <svg
                    width={14}
                    height={9}
                    viewBox="0 0 14 9"
                    style={{ position: "absolute", bottom: -9, left: onLeft ? 12 : undefined, right: onLeft ? undefined : 12 }}
                  >
                    <path d="M0,0 L7,9 L14,0" fill="#F7F8FB" stroke={`${color}55`} strokeWidth="1.8" strokeLinejoin="round"/>
                    <line x1={0} y1={0.9} x2={14} y2={0.9} stroke="#F7F8FB" strokeWidth="2"/>
                  </svg>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {liveEvent && (
          <motion.div
            key={liveEvent.tick}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              top: 8,
              zIndex: 24,
              padding: "9px 11px",
              borderRadius: 14,
              background: "rgba(247,248,251,.95)",
              border: "1.5px solid rgba(0,112,243,.26)",
              boxShadow: "0 4px 16px rgba(42,48,72,.09)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="animate-pulse" style={{ width: 7, height: 7, borderRadius: 7, background: d.a1 }}/>
                <span style={{ color: d.a1, fontSize: "var(--ui-font-caption)", letterSpacing: 1 }}>CIVILIZATION LIVE</span>
                <span style={{ color: "#6B9E7A", fontSize: "var(--ui-font-caption)" }}>阶段 {liveEvent.phase?.complexity || world?.meta.eraNumber || 1}/5</span>
              </div>
              <span style={{ color: "#8090A8", fontSize: "var(--ui-font-caption)" }}>第 {liveEvent.tick} 回合</span>
            </div>
            <p className="truncate" style={{ color: "#2A3048", fontSize: "var(--ui-font-body)", marginTop: 7 }}>{liveEvent.title}</p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="truncate" style={{ color: "#8090A8", fontSize: "var(--ui-font-caption)" }}>
                {liveEvent.action?.label || "共同演化"} · {liveEvent.phase?.focus || "生存、照料与简单共享"}
              </p>
              <div className="flex shrink-0 -space-x-1">
                {liveEvent.participants.map(agentId => {
                  const residentIndex = futureResidentIndex(agentId);
                  const name = FUTURE_RESIDENT_NAMES[residentIndex];
                  return (
                    <span
                      key={agentId}
                      title={name}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 6,
                        background: FUTURE_RESIDENT_COLORS[residentIndex],
                        border: "1.5px solid #F7F8FB",
                        color: "white",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "var(--ui-font-micro)",
                      }}
                    >
                      {name.slice(0, 1)}
                    </span>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 pb-2 pt-1"
        style={{ borderTop: "1px solid rgba(42,48,72,0.12)" }}>
        <button onClick={() => navigate("worldline")} className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: "#C8D0DC", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", color: "#8090A8" }}>
          <Compass size={13}/> 世界线
        </button>
        <button onClick={() => navigate("agentGallery")} className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: "#C8D0DC", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", color: "#8090A8" }}>
          <Package size={13}/> 智能体
        </button>
        <button className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: `${d.a1}20`, fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", color: d.a1 }}>
          <Zap size={13}/> 演化中
        </button>
      </div>
    </div>
  );
}

// 13. AGENT DETAIL
function AgentDetailScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [tab, setTab] = useState("state");
  const tabLabels: Record<string, string> = {
    state: "状态",
    relationships: "关系",
    origin: "来源",
    privacy: "隐私",
  };
  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
      <div className="flex-1 overflow-y-auto pt-3"
        style={{ background: "#FAF6EF", borderTop: "1px solid rgba(28,25,17,0.08)" }}>
        {/* Header */}
        <div className="flex gap-4 px-5 mb-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden relative"
            style={{ background: "#F5F0E8", border: "2px solid rgba(28,25,17,0.1)", flexShrink: 0 }}>
            <svg width="64" height="64" viewBox="-32 -32 64 64">
              <MugAgent x={0} y={4} s={0.9} accent="#E8634A" animated={true}/>
            </svg>
          </div>
          {/* Object photo thumbnail */}
          <div className="w-14 h-16 rounded-xl overflow-hidden flex-shrink-0"
            style={{ background: "#DDD8CF", border: "2px solid rgba(28,25,17,0.1)" }}>
            <svg width="56" height="64" viewBox="0 0 56 64">
              <rect x="8" y="10" width="40" height="44" rx="4" fill="#E8634A80" stroke="#1C191140" strokeWidth="1"/>
              <path d="M48,24 Q58,24 58,38 Q58,52 48,52" fill="none" stroke="#1C191140" strokeWidth="2" strokeLinecap="round"/>
              <text x="28" y="60" textAnchor="middle" fontSize="7" fontFamily="'Fusion Pixel 10px Monospaced SC',sans-serif" fill="#7A7468">原图</text>
            </svg>
          </div>
          <div>
            <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-title)", fontWeight: 700, color: "#1C1911", lineHeight: 1 }}>Miko</p>
            <p style={{ fontSize: "var(--ui-font-body)", color: "#E8634A" }}>咖啡馆管理员</p>
            <p style={{ fontSize: "var(--ui-font-body)", color: "#7A7468" }}>咖啡馆附近 · 工作中</p>
            <p style={{ fontSize: "var(--ui-font-body)", color: "#7A7468" }}>3 天前捕获</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 mb-3">
          {["state","relationships","origin","privacy"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-xl capitalize"
              style={{
                background: tab === t ? "#1C1911" : "#EAE5DA",
                color: tab === t ? "white" : "#7A7468",
                fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                fontSize: "var(--ui-font-body)"
              }}>{tabLabels[t]}</button>
          ))}
        </div>

        {tab === "state" && (
          <div className="px-5 flex flex-col gap-2">
            {[
              { label: "注意到", text: "咖啡馆需要补充库存，Beat 正在附近活动。", color: "#4A7FA5" },
              { label: "当前目标", text: "在午后高峰到来前煮好一批新咖啡。", color: "#E8634A" },
              { label: "下一步行动", text: "前往储藏室，带着需要的物资返回。", color: "#6B9E7A" },
              { label: "新记忆", text: "一位访客留下了一张关于哥伦比亚烘焙咖啡的便笺。", color: "#D4A800" },
            ].map(s => (
              <PaperCard key={s.label} className="px-3 py-2.5">
                <p style={{ fontSize: "var(--ui-font-body)", color: s.color, marginBottom: "2px" }}>{s.label}</p>
                <p style={{ fontSize: "var(--ui-font-body)", color: "#1C1911", lineHeight: 1.55 }}>{s.text}</p>
              </PaperCard>
            ))}
          </div>
        )}

        {tab === "relationships" && (
          <div className="px-5 flex flex-col gap-2">
            {[
              { label: "朋友", agents: ["Folio","Luma"], color: "#6B9E7A" },
              { label: "正在靠近", agents: ["Beat"], color: "#4A7FA5" },
              { label: "关系张力", agents: ["Shutter（访客）"], color: "#E8634A" },
            ].map(r => (
              <div key={r.label}>
                <SectionLabel text={r.label}/>
                {r.agents.map(a => (
                  <div key={a} className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: r.color }}/>
                    <p style={{ fontSize: "var(--ui-font-body)", color: "#1C1911" }}>{a}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {tab === "origin" && (
          <div className="px-5 flex flex-col gap-2">
            <PaperCard className="px-3 py-2.5">
              <SectionLabel text="物件来源"/>
              <p style={{ fontSize: "var(--ui-font-body)", color: "#1C1911", lineHeight: 1.6 }}>
                一只陶瓷咖啡杯。杯柄变成手臂，正面变成表情，杯底形成稳定站姿，温度塑造了好客的性格。
              </p>
            </PaperCard>
            <PaperCard className="px-3 py-2.5">
              <SectionLabel text="用户确认"/>
              <p style={{ fontSize: "var(--ui-font-body)", color: "#1C1911", lineHeight: 1.6 }}>
                名字：Miko · 角色：咖啡馆管理员 · 能力：每次都能煮出恰到好处的咖啡
              </p>
            </PaperCard>
          </div>
        )}

        {tab === "privacy" && (
          <div className="px-5 flex flex-col gap-3">
            {[
              { label: "智能体外观", level: "public" as const },
              { label: "名字与角色", level: "public" as const },
              { label: "性格细节", level: "host" as const },
              { label: "记忆记录", level: "never" as const },
              { label: "原始照片", level: "never" as const },
            ].map(p => (
              <div key={p.label} className="flex items-center justify-between">
                <p style={{ fontSize: "var(--ui-font-body)", color: "#1C1911" }}>{p.label}</p>
                <PrivacyChip level={p.level}/>
              </div>
            ))}
          </div>
        )}

        <div className="h-6"/>
      </div>
    </div>
  );
}

// 14. VISITOR ARRIVAL
function VisitorArrivalScreen({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
      <div className="relative flex-1 overflow-hidden">
        <EverydayTownSVG w={390} h={620}/>
        {/* Visitor glow at station */}
        <div className="absolute" style={{ right: "12%", top: "42%", animation: "visitorGlow 1.5s ease-in-out infinite" }}>
          <svg width="60" height="70" viewBox="-30 -35 60 70">
            <CameraAgent x={0} y={0} s={1} accent="#E8191A" animated={true}/>
          </svg>
        </div>
        {/* Visitor route line */}
        <svg className="absolute inset-0" width="390" height="620">
          <path d="M350,260 Q310,280 280,310 Q250,340 220,330"
            fill="none" stroke="#E8191A" strokeWidth="2" strokeDasharray="6,4"
            style={{ animation: "energyPulse 1.5s linear infinite" }}/>
        </svg>
      </div>

      {/* Notification card */}
      <div className="absolute bottom-20 left-4 right-4">
        <PaperCard className="overflow-hidden">
          <div className="h-1 w-full" style={{ background: "#E8191A" }}/>
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#E8191A18", animation: "visitorGlow 2s ease-in-out infinite" }}>
                <svg width="48" height="48" viewBox="-24 -24 48 48">
                  <CameraAgent x={0} y={0} s={0.7} accent="#E8191A" animated={false}/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700, color: "#1C1911" }}>
                    Visitor Arrives
                  </p>
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#E8191A" }}/>
                </div>
                <p style={{ fontSize: "var(--ui-font-body)", color: "#1C1911", lineHeight: 1.6 }}>
                  来自 <span style={{ color: "#E8191A", fontWeight: 700 }}>Stardom District</span> 的
                  <strong> Camera Archivist</strong> 已抵达车站。
                </p>
                <p style={{ fontSize: "var(--ui-font-body)", color: "#7A7468", lineHeight: 1.55, marginTop: "4px" }}>
                  保留红色镜头标记 · 适配本地线条风格 · 创建访客分支
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: "#E8191A" }}/>
                  <span style={{ fontSize: "var(--ui-font-section)", color: "#E8191A", fontFamily: "VT323,monospace" }}>Stardom District</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => navigate("visitorBranch")}
                className="flex-1 py-2.5 rounded-xl"
                style={{ background: "#1C1911", color: "white", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>
                接受访问
              </button>
              <button className="px-4 py-2.5 rounded-xl"
                style={{ background: "#EAE5DA", color: "#7A7468", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)" }}>
                暂不接受
              </button>
            </div>
          </div>
        </PaperCard>
      </div>

      <button onClick={() => navigate("everydayTown")}
        className="absolute top-10 left-4 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: "rgba(250,246,239,0.9)", border: "1.5px solid rgba(28,25,17,0.12)" }}>
        <ChevronLeft size={16} color="#7A7468"/>
      </button>
    </div>
  );
}

// 15. VISITOR BRANCH
function VisitorBranchScreen({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
      <div className="flex items-center justify-between px-4 pt-9 pb-1">
        <button onClick={() => navigate("everydayTown")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <div>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700, color: "#1C1911" }}>Visitor Branch</p>
          <p style={{ fontSize: "var(--ui-font-heading)", fontFamily: "VT323,monospace", color: "#7A7468", textAlign: "center" }}>Camera Archivist · Stardom District</p>
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "#E8191A", fontFamily: "VT323,monospace", fontSize: "var(--ui-font-heading)" }}>
          <div className="w-2 h-2 rounded-full" style={{ background: "#E8191A" }}/>
          分支
        </div>
      </div>

      {/* City with branch overlay */}
      <div className="flex-1 relative overflow-hidden">
        <EverydayTownSVG w={390} h={500}/>
        {/* Branch overlay */}
        <svg className="absolute inset-0" width="390" height="500">
          {/* Visitor route */}
          <path d="M325,248 Q295,268 265,285 Q240,300 210,310 Q180,320 168,298"
            fill="none" stroke="#E8191A" strokeWidth="2.5" strokeDasharray="7,4"
            style={{ animation: "energyPulse 2s linear infinite" }}/>
          {/* Branch region outline */}
          <rect x="140" y="180" width="210" height="160" rx="12"
            fill="none" stroke="#E8191A30" strokeWidth="1.5" strokeDasharray="5,3"/>
          {/* Visitor agent at station */}
          <g style={{ animation: "agentIdle 2.5s ease-in-out infinite" }}>
            <CameraAgent x={328} y={238} s={0.75} accent="#E8191A" animated={false}/>
          </g>
          {/* Branch events */}
          {[
            { x: 325, y: 248, label: "抵达 · 车站" },
            { x: 250, y: 288, label: "遇见记忆图书管理员" },
            { x: 185, y: 305, label: "共同创造物件 ★" },
          ].map((e,i) => (
            <g key={i}>
              <circle cx={e.x} cy={e.y} r="6" fill="white" stroke="#E8191A" strokeWidth="1.5"/>
              <circle cx={e.x} cy={e.y} r="3" fill="#E8191A"/>
              <text x={e.x} y={e.y - 10} textAnchor="middle" fontSize="7"
                fontFamily="'Fusion Pixel 10px Monospaced SC',sans-serif" fill="#E8191A" fontWeight="700">{e.label}</text>
            </g>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 flex gap-3"
        style={{ background: "#FAF6EF", borderTop: "1px solid rgba(28,25,17,0.08)" }}>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-1" style={{ background: "#1C1911", borderRadius: "1px" }}/>
          <span style={{ fontSize: "var(--ui-font-body)", color: "#7A7468" }}>主世界线</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0" style={{ borderTop: "2px dashed #E8191A" }}/>
          <span style={{ fontSize: "var(--ui-font-body)", color: "#E8191A" }}>访客分支</span>
        </div>
        <button onClick={() => navigate("worldline")}
          className="ml-auto px-3 py-1 rounded-lg"
          style={{ background: "#E8191A18", color: "#E8191A", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)" }}>
          查看世界线 →
        </button>
      </div>
    </div>
  );
}

// 16. WORLDLINE
function WorldlineScreen({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
      <div className="flex items-center justify-between px-5 pt-10 pb-3">
        <button onClick={() => navigate("everydayTown")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-title)", fontWeight: 700, color: "#1C1911" }}>Worldline</p>
        <button style={{ color: "#7A7468" }}><Search size={18}/></button>
      </div>

      {/* Transit map SVG */}
      <div className="flex-1 overflow-y-auto px-4">
        <svg width="350" height="520" viewBox="0 0 350 520">
          {/* Canon line (black) */}
          <path d="M50,60 L50,480" stroke="#1C1911" strokeWidth="3" strokeLinecap="round"/>

          {/* Visitor branch (red) from node 3 */}
          <path d="M50,260 Q180,260 240,320 Q280,360 280,460"
            fill="none" stroke="#E8191A" strokeWidth="2.5" strokeDasharray="8,5"/>

          {/* Canon nodes */}
          {[
            { y: 60, label: "世界诞生", sub: "Memory Town 建立", icon: "🏠" },
            { y: 120, label: "捕获 Miko", sub: "咖啡店主 · 第 1 天", icon: "☕" },
            { y: 180, label: "图书馆开放", sub: "记忆图书管理员加入", icon: "📚" },
            { y: 240, label: "公园聚会", sub: "Nana 主持第一次野餐", icon: "🌿" },
            { y: 300, label: "音乐之夜", sub: "Beat 开始广播", icon: "🎵" },
            { y: 360, label: "车站建成", sub: "跨世界连接开放", icon: "🚉" },
            { y: 420, label: "今天", sub: "10:24 · 访客抵达", icon: "📍" },
          ].map((n, i) => (
            <g key={i}>
              {/* Node circle */}
              <circle cx={50} cy={n.y} r={10} fill="white" stroke="#1C1911" strokeWidth="2.5"/>
              <text x={50} y={n.y + 4} textAnchor="middle" fontSize="10">{n.icon}</text>
              {/* Label */}
              <text x={68} y={n.y - 4} fontSize="9" fontFamily="'Fusion Pixel 10px Monospaced SC',sans-serif" fill="#1C1911" fontWeight="700">{n.label}</text>
              <text x={68} y={n.y + 9} fontSize="7" fontFamily="'Fusion Pixel 10px Monospaced SC',sans-serif" fill="#7A7468">{n.sub}</text>
              {/* Ticket shape */}
              <rect x={136} y={n.y - 14} width={100} height={28} rx={6}
                fill="#FAF6EF" stroke="rgba(28,25,17,0.12)" strokeWidth="1"/>
              <text x={186} y={n.y + 4} textAnchor="middle" fontSize="8" fontFamily="VT323,monospace" fill="#7A7468">
                {`MEM-00${i+1}`}
              </text>
            </g>
          ))}

          {/* Visitor branch nodes */}
          {[
            { x: 240, y: 320, label: "相机访客抵达", sub: "车站 · Stardom 访客", icon: "📷" },
            { x: 265, y: 380, label: "照片物件", sub: "共同记忆已经生成", icon: "🖼️" },
            { x: 280, y: 460, label: "分支终点", sub: "等待处理", icon: "?" },
          ].map((n, i) => (
            <g key={i}>
              <circle cx={n.x} cy={n.y} r={9} fill="white" stroke="#E8191A" strokeWidth="2"/>
              <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="9">{n.icon}</text>
              <text x={n.x + 14} y={n.y - 4} fontSize="8" fontFamily="'Fusion Pixel 10px Monospaced SC',sans-serif" fill="#E8191A" fontWeight="700">{n.label}</text>
              <text x={n.x + 14} y={n.y + 8} fontSize="6" fontFamily="'Fusion Pixel 10px Monospaced SC',sans-serif" fill="#E8191A80">{n.sub}</text>
            </g>
          ))}

          {/* Branch split indicator */}
          <circle cx={50} cy={260} r={5} fill="#E8191A" stroke="white" strokeWidth="1.5"/>
          <text x={20} y={258} fontSize="8" fontFamily="VT323,monospace" fill="#E8191A" textAnchor="middle">↗</text>
        </svg>
      </div>

      {/* Actions */}
      <div className="px-5 pb-3 flex gap-2">
        <button onClick={() => navigate("branchResolution")}
          className="flex-1 py-2.5 rounded-xl"
          style={{ background: "#E8191A18", color: "#E8191A", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>
          处理分支
        </button>
        <button className="px-4 py-2.5 rounded-xl"
          style={{ background: "#EAE5DA", color: "#7A7468", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)" }}>
          回放 ↺
        </button>
      </div>
    </div>
  );
}

// 17. OBJECT AGENT GALLERY
function EnvironmentObjectsArchive() {
  const [styleId, setStyleId] = useState<ObjectArchiveStyle>("blockcraft");
  const style = OBJECT_ARCHIVE_STYLES.find(item => item.id === styleId) || OBJECT_ARCHIVE_STYLES[0];
  const objects = style.types
    .map(type => BUILDING_DEFS.find(def => def.type === type && (def.category === styleId || styleId === "medieval")))
    .filter((item): item is (typeof BUILDING_DEFS)[number] => Boolean(item));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
      <div className="flex items-start justify-between gap-3 py-1.5">
        <div>
          <p style={{ color: style.accent, fontSize: "var(--ui-font-caption)", letterSpacing: "1.2px" }}>ENVIRONMENT OBJECTS</p>
          <p style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)", marginTop: "5px", fontFamily: "VT323,monospace" }}>
            {objects.length} 个素材 · 可加入地图并移动
          </p>
        </div>
        <div className="relative flex-shrink-0">
          <select
            aria-label="选择环境素材风格"
            value={styleId}
            onChange={event => setStyleId(event.target.value as ObjectArchiveStyle)}
            style={{
              appearance: "none",
              WebkitAppearance: "none",
              width: "126px",
              border: `1.5px solid ${style.accent}55`,
              borderRadius: "11px",
              background: "#FAF6EF",
              color: style.accent,
              padding: "8px 28px 8px 10px",
              outline: "none",
              fontFamily: "VT323,monospace",
              fontSize: "var(--ui-font-section)",
              cursor: "pointer",
            }}
          >
            {OBJECT_ARCHIVE_STYLES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <ChevronDown size={14} aria-hidden="true" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: style.accent, pointerEvents: "none" }}/>
        </div>
      </div>

      <div className="rounded-xl px-3 py-2 mb-3 flex items-center justify-between" style={{ background: `${style.accent}10`, border: `1px solid ${style.accent}25` }}>
        <span style={{ color: style.accent, fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-section)", fontWeight: 700 }}>{style.note}</span>
        <span style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)", letterSpacing: ".7px" }}>地图可用</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {objects.map(({ type, label, Asset }) => (
          <div key={type} className="rounded-2xl overflow-hidden" style={{ background: "#FAF6EF", border: "1.5px solid rgba(28,25,17,.1)", boxShadow: "0 2px 7px rgba(28,25,17,.05)" }}>
            <div className="flex items-center justify-center" style={{ height: "112px", background: `${style.accent}0D` }}>
              <Asset/>
            </div>
            <div className="p-2.5">
              <p
                className="truncate"
                style={{
                  color: "#1C1911",
                  fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                  fontSize: "var(--ui-font-section)",
                  fontWeight: 700,
                  lineHeight: 1.25,
                }}
              >
                {label}
              </p>
              <p
                className="truncate"
                style={{
                  color: style.accent,
                  fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                  fontSize: "var(--ui-font-caption)",
                  lineHeight: 1.5,
                }}
              >
                {style.label}
              </p>
              <div className="flex items-center justify-between mt-1">
                <span style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)" }}>环境素材</span>
                <span style={{ color: "#7A7468", fontFamily: "VT323,monospace", fontSize: "var(--ui-font-body)" }}>拖动 · 移动</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type AgentArchiveSection = "agents" | "chat" | "objects" | "identity" | "chain" | "device";

function AgentArchiveTabs({ active, onChange }: {
  active: AgentArchiveSection;
  onChange: (section: AgentArchiveSection) => void;
}) {
  const tabs: { id: AgentArchiveSection; label: string }[] = [
    { id: "agents", label: "Agents" },
    { id: "chat", label: "Talk" },
    { id: "objects", label: "Objects" },
    { id: "identity", label: "Identity" },
    { id: "chain", label: "Chain" },
    { id: "device", label: "Device" },
  ];

  return (
    <div className="flex gap-1.5 overflow-x-auto px-5 pb-2">
      {tabs.map(tab => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className="shrink-0 rounded-xl"
            style={{
              minWidth: 62,
              padding: "7px 8px",
              background: selected ? "#1C1911" : "#EAE5DA",
              color: selected ? "white" : "#7A7468",
              fontFamily: "Caveat,cursive",
              fontSize: "var(--ui-font-section)",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

const CHAT_AGENT_PROFILES = [
  "dotti", "miko", "shutter", "nana", "folio", "luma", "beat",
  "sprig", "tock", "keylo", "orbit", "joypad", "mizzle",
].map(id => AGENT_PROFILES.find(profile => profile.id === id)).filter(Boolean) as AgentProfile[];

function memoryDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function AgentConversationScreen({ archiveTabs }: { archiveTabs?: React.ReactNode }) {
  const [agentId, setAgentId] = useState("dotti");
  const [conversation, setConversation] = useState<AgentConversation | null>(null);
  const [draft, setDraft] = useState("");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [remember, setRemember] = useState(true);
  const [showMemories, setShowMemories] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const profile = CHAT_AGENT_PROFILES.find(item => item.id === agentId) || CHAT_AGENT_PROFILES[0];

  const loadConversation = async (nextAgentId = agentId) => {
    setError("");
    try {
      const next = await worldApi.getAgentConversation(nextAgentId);
      setConversation(next);
    } catch (loadError) {
      setConversation(null);
      setError(loadError instanceof Error ? loadError.message : "暂时无法连接 Agent 记忆");
    }
  };

  useEffect(() => {
    setConversation(null);
    setShowMemories(false);
    void loadConversation(agentId);
  }, [agentId]);

  useEffect(() => {
    if (showMemories) return;
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation?.messages.length, showMemories]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || busy || !conversation) return;
    const optimistic: AgentChatMessage = {
      id: `pending-${Date.now()}`,
      role: "user",
      text,
      createdAt: new Date().toISOString(),
      recalledMemoryIds: [],
    };
    setDraft("");
    setBusy(true);
    setError("");
    setConversation(current => current ? {
      ...current,
      messages: [...current.messages, optimistic],
    } : current);
    try {
      await worldApi.chatWithAgent(agentId, text, remember);
      await loadConversation(agentId);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "消息没有送达");
      await loadConversation(agentId);
    } finally {
      setBusy(false);
    }
  };

  const addMemory = async () => {
    const text = memoryDraft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      await worldApi.addAgentMemory(agentId, text);
      setMemoryDraft("");
      await loadConversation(agentId);
    } catch (memoryError) {
      setError(memoryError instanceof Error ? memoryError.message : "这段记忆没有保存");
    } finally {
      setBusy(false);
    }
  };

  const removeMemory = async (memoryId: string) => {
    if (!window.confirm("确认让这个 Agent 忘记这段长期记忆吗？")) return;
    setBusy(true);
    setError("");
    try {
      await worldApi.deleteAgentMemory(agentId, memoryId);
      await loadConversation(agentId);
    } catch (memoryError) {
      setError(memoryError instanceof Error ? memoryError.message : "这段记忆暂时无法删除");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: "#F5F0E8", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
      <PhoneStatusBar showConnectivity={false}/>
      <div className="flex items-center justify-between px-5 py-2">
        <span className="w-5"/>
        <div className="text-center">
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-title)", fontWeight: 700 }}>Talk with my Agent</p>
          <p style={{ color: "#6B9E7A", fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>CONVERSATION · LONG MEMORY</p>
        </div>
        <Brain size={16} color="#6B9E7A"/>
      </div>
      {archiveTabs}

      <div className="flex gap-2 overflow-x-auto px-5 pb-2">
        {CHAT_AGENT_PROFILES.map(item => {
          const selected = item.id === agentId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setAgentId(item.id)}
              aria-label={`与 ${item.name} 对话`}
              className="flex shrink-0 items-center gap-2 rounded-2xl px-2.5 py-2"
              style={{
                color: selected ? "#FAF6EF" : "#5F594F",
                background: selected ? item.color : "#FAF6EF",
                border: `1px solid ${selected ? item.color : "rgba(28,25,17,.1)"}`,
                minWidth: 96,
              }}
            >
              <svg width="30" height="30" viewBox="-40 -40 80 80" aria-hidden="true">
                {item.render(.48, true)}
              </svg>
              <span className="text-left">
                <strong className="block" style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-label)" }}>{item.name}</strong>
                <small className="block truncate" style={{ opacity: .72, fontSize: 8, maxWidth: 62 }}>{item.role}</small>
              </span>
            </button>
          );
        })}
      </div>

      <section
        className="mx-5 mb-2 flex items-center justify-between rounded-2xl px-3 py-2.5"
        style={{ background: "#FAF6EF", border: `1px solid ${profile.color}30` }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${profile.color}16` }}>
            <svg width="36" height="36" viewBox="-40 -40 80 80" aria-hidden="true">{profile.render(.54, true)}</svg>
          </span>
          <span className="min-w-0">
            <strong className="block truncate" style={{ color: "#1C1911", fontSize: "var(--ui-font-caption)" }}>
              {conversation?.agent.name || profile.name} 正在听
            </strong>
            <small className="mt-1 block truncate" style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)" }}>
              {conversation?.agent.location || profile.world} · {conversation?.messages.length || 0} 条对话
            </small>
          </span>
        </span>
        <button
          type="button"
          aria-pressed={showMemories}
          onClick={() => setShowMemories(current => !current)}
          className="ml-2 flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-2"
          style={{
            color: showMemories ? "#FAF6EF" : "#6B9E7A",
            background: showMemories ? "#6B9E7A" : "#6B9E7A12",
            fontSize: "var(--ui-font-micro)",
          }}
        >
          <Brain size={12}/>{conversation?.memories.length || 0} 段记忆
        </button>
      </section>

      {error && (
        <div className="mx-5 mb-2 rounded-xl px-3 py-2" style={{ color: "#C75D4D", background: "#C75D4D10", fontSize: "var(--ui-font-micro)" }}>
          {error}
        </div>
      )}

      {showMemories ? (
        <div className="flex-1 overflow-y-auto px-5 pb-3">
          <div className="rounded-2xl p-3" style={{ background: "#FAF6EF", border: "1px solid rgba(28,25,17,.1)" }}>
            <p style={{ color: "#1C1911", fontSize: "var(--ui-font-caption)" }}>主动告诉 {profile.name} 一件要长期记住的事</p>
            <div className="mt-2 flex gap-2">
              <input
                value={memoryDraft}
                onChange={event => setMemoryDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) void addMemory();
                }}
                placeholder="例如：我习惯周六早上去跑步"
                className="min-w-0 flex-1 rounded-xl px-3 py-2 outline-none"
                style={{ color: "#1C1911", background: "#F5F0E8", border: "1px solid rgba(28,25,17,.1)", fontSize: "var(--ui-font-caption)" }}
              />
              <button type="button" disabled={!memoryDraft.trim() || busy} onClick={() => void addMemory()}
                className="rounded-xl px-3" style={{ color: "white", background: "#6B9E7A", opacity: !memoryDraft.trim() || busy ? .45 : 1 }}>
                <Plus size={15}/>
              </button>
            </div>
          </div>

          <div className="mt-2 grid gap-2">
            {conversation?.memories.map(memory => (
              <article key={memory.id} className="rounded-2xl p-3" style={{ background: "#FAF6EF", border: `1px solid ${memory.pinned ? "#6B9E7A35" : "rgba(28,25,17,.1)"}` }}>
                <div className="flex items-start justify-between gap-3">
                  <p style={{ color: "#1C1911", fontSize: "var(--ui-font-caption)", lineHeight: 1.65 }}>{memory.text}</p>
                  <button type="button" aria-label="删除这段长期记忆" disabled={busy} onClick={() => void removeMemory(memory.id)}
                    className="shrink-0 rounded-lg p-1.5" style={{ color: "#A69D91", background: "#F0EBE2" }}>
                    <Trash2 size={12}/>
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between" style={{ color: "#8E867A", fontSize: "var(--ui-font-micro)" }}>
                  <span>{memory.source === "manual" ? "主动记忆" : "来自对话"} · 重要度 {memory.importance}</span>
                  <span>{memoryDate(memory.createdAt)}{memory.recallCount ? ` · 已召回 ${memory.recallCount} 次` : ""}</span>
                </div>
              </article>
            ))}
            {conversation && !conversation.memories.length && (
              <div className="rounded-2xl px-4 py-8 text-center" style={{ color: "#8E867A", background: "#FAF6EF", fontSize: "var(--ui-font-caption)" }}>
                还没有长期记忆。你可以主动添加，也可以在对话时开启“记住这句话”。
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div ref={messageListRef} className="flex-1 overflow-y-auto px-5 py-2">
            {!conversation?.messages.length ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <svg width="82" height="82" viewBox="-40 -40 80 80" aria-hidden="true">{profile.render(.92, true)}</svg>
                <p className="mt-3" style={{ color: "#1C1911", fontSize: "var(--ui-font-label)" }}>从一件小事开始聊吧</p>
                <p className="mt-2 max-w-[260px]" style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)", lineHeight: 1.6 }}>
                  {profile.name} 会保留对话历史，并在以后相关的话题里召回你允许保存的记忆。
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {["今天有点累", "记住我喜欢晨跑", "陪我制定一个小目标"].map(prompt => (
                    <button key={prompt} type="button" onClick={() => setDraft(prompt)}
                      className="rounded-full px-3 py-2" style={{ color: profile.color, background: `${profile.color}10`, border: `1px solid ${profile.color}30`, fontSize: "var(--ui-font-micro)" }}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : conversation.messages.map(message => (
              <div key={message.id} className={`mb-3 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[82%] rounded-2xl px-3 py-2.5"
                  style={{
                    color: message.role === "user" ? "white" : "#1C1911",
                    background: message.role === "user" ? profile.color : "#FAF6EF",
                    border: message.role === "user" ? "none" : "1px solid rgba(28,25,17,.1)",
                    borderBottomRightRadius: message.role === "user" ? 5 : 16,
                    borderBottomLeftRadius: message.role === "agent" ? 5 : 16,
                  }}
                >
                  <p style={{ fontSize: "var(--ui-font-caption)", lineHeight: 1.7 }}>{message.text}</p>
                  {message.role === "agent" && message.recalledMemoryIds.length > 0 && (
                    <span className="mt-1.5 flex items-center gap-1" style={{ color: "#6B9E7A", fontSize: "var(--ui-font-micro)" }}>
                      <Brain size={10}/>召回了 {message.recalledMemoryIds.length} 段相关记忆
                    </span>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="mb-3 flex justify-start">
                <span className="flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ color: "#7A7468", background: "#FAF6EF", fontSize: "var(--ui-font-caption)" }}>
                  <Loader2 size={13} className="animate-spin"/>{profile.name} 正在回忆…
                </span>
              </div>
            )}
          </div>

          <div className="px-5 pb-3 pt-2" style={{ background: "#F5F0E8", borderTop: "1px solid rgba(28,25,17,.08)" }}>
            <label className="mb-2 flex items-center justify-between gap-3">
              <span style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)" }}>让 {profile.name} 把这句话加入长期记忆</span>
              <button
                type="button"
                aria-label="记住这句话"
                aria-pressed={remember}
                onClick={() => setRemember(current => !current)}
                className="relative h-5 w-9 shrink-0 rounded-full"
                style={{ background: remember ? "#6B9E7A" : "#D6D0C5" }}
              >
                <i className="absolute top-1 h-3 w-3 rounded-full bg-white transition-all" style={{ left: remember ? 20 : 4 }}/>
              </button>
            </label>
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={event => setDraft(event.target.value.slice(0, 500))}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={1}
                placeholder={`和 ${profile.name} 说点什么…`}
                className="min-h-[42px] min-w-0 flex-1 resize-none rounded-2xl px-3 py-3 outline-none"
                style={{ color: "#1C1911", background: "#FAF6EF", border: "1px solid rgba(28,25,17,.12)", fontSize: "var(--ui-font-caption)", lineHeight: 1.45 }}
              />
              <button
                type="button"
                aria-label="发送消息"
                disabled={!draft.trim() || busy || !conversation}
                onClick={() => void sendMessage()}
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl"
                style={{ color: "white", background: profile.color, opacity: !draft.trim() || busy || !conversation ? .42 : 1 }}
              >
                <Send size={16}/>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AgentChainScreen({ archiveTabs }: { archiveTabs?: React.ReactNode }) {
  const profiles = useMemo(() => chainPlazaAdapter.listAgentProfiles(), []);
  const [wallet, setWallet] = useState(() => chainPlazaAdapter.getWallet());
  const [profileId, setProfileId] = useState(profiles[0]?.agentId || "dotti");
  const [autoPayEnabled, setAutoPayEnabled] = useState(true);
  const [listings, setListings] = useState<ChainSkillListing[]>([]);
  const profile = profiles.find(item => item.agentId === profileId) || profiles[0];
  const receipts = chainPlazaAdapter.listReceipts()
    .filter(receipt => receipt.buyerAgentId === profile.agentId);
  const installedSkills = listings.filter(listing => (
    profile.installedSkillIds.includes(listing.id)
    || receipts.some(receipt => receipt.listingId === listing.id)
  ));
  const budgetRatio = Math.min(100, (profile.spentInj / profile.dailyBudget) * 100);

  useEffect(() => {
    let active = true;
    chainPlazaAdapter.listSkills().then(items => {
      if (active) setListings(items);
    });
    const unsubscribeWallet = chainPlazaAdapter.subscribeWallet(() => {
      setWallet(chainPlazaAdapter.getWallet());
    });
    return () => {
      active = false;
      unsubscribeWallet();
    };
  }, []);

  useEffect(() => {
    setAutoPayEnabled(true);
  }, [profileId]);

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: "#F5F0E8", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
      <PhoneStatusBar showConnectivity={false}/>
      <div className="flex items-center justify-between px-5 py-2">
        <span className="w-5"/>
        <div className="text-center">
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-title)", fontWeight: 700 }}>Agent On-chain</p>
          <p style={{ color: "#6D6884", fontSize: "var(--ui-font-micro)" }}>IDENTITY · BUDGET · LICENSE</p>
        </div>
        <span className="flex w-5 items-center justify-end"><Radio size={13} color="#6D6884"/></span>
      </div>
      {archiveTabs}

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <div
          className="mb-3 flex items-center justify-between rounded-2xl px-3 py-2.5"
          style={{ color: "#6D6884", background: "rgba(109,104,132,.08)", border: "1px solid rgba(109,104,132,.17)" }}
        >
          <span className="inline-flex items-center gap-1.5" style={{ fontSize: "var(--ui-font-caption)" }}>
            <Radio size={12}/>Injective EVM · 1439
          </span>
          <span style={{ fontSize: "var(--ui-font-micro)" }}>LIVE TESTNET</span>
        </div>

        <p style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>SELECT AGENT IDENTITY</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {profiles.map(item => {
            const selected = item.agentId === profile.agentId;
            return (
              <button
                key={item.agentId}
                type="button"
                onClick={() => setProfileId(item.agentId)}
                className="rounded-xl px-2 py-2.5 text-left"
                style={{
                  color: selected ? "white" : "#5F594F",
                  background: selected ? "#6D6884" : "#FAF6EF",
                  border: `1px solid ${selected ? "#6D6884" : "rgba(28,25,17,.11)"}`,
                }}
              >
                <strong className="block" style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-section)" }}>{item.name}</strong>
                <span className="mt-1 block truncate" style={{ opacity: .78, fontSize: "var(--ui-font-micro)" }}>{item.tokenId}</span>
              </button>
            );
          })}
        </div>

        <section
          className="mt-3 rounded-[22px] p-4"
          style={{ color: "#FAF6EF", background: "#1C1911", boxShadow: "0 10px 24px rgba(28,25,17,.12)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1"
                style={{ color: "#B9D6C0", background: "rgba(107,158,122,.18)", fontSize: "var(--ui-font-micro)" }}>
                <Check size={10}/>ERC-8004 VERIFIED
              </span>
              <h2 className="mt-3" style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", lineHeight: 1 }}>
                {profile.name} <small style={{ color: "#BEB7AA", fontSize: "var(--ui-font-caption)" }}>{profile.tokenId}</small>
              </h2>
              <p className="mt-2" style={{ color: "#C9C2B6", fontSize: "var(--ui-font-caption)" }}>{profile.role}</p>
            </div>
            <div className="text-right">
              <strong style={{ color: "#B9D6C0", fontSize: 22 }}>{profile.reputation || "NEW"}</strong>
              <span className="block" style={{ color: "#8E867A", fontSize: "var(--ui-font-micro)" }}>REPUTATION</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2" style={{ fontSize: "var(--ui-font-micro)" }}>
            <span>
              <small style={{ color: "#8E867A" }}>IDENTITY REF</small>
              <strong className="mt-1 block truncate">{profile.identityRef}</strong>
            </span>
            <span>
              <small style={{ color: "#8E867A" }}>FEE RECIPIENT</small>
              <strong className="mt-1 block">{profile.walletAddress}</strong>
            </span>
          </div>
        </section>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "钱包余额", value: wallet.connected ? wallet.injBalance.toFixed(4) : "—", unit: "INJ" },
            { label: "待领取收益", value: wallet.connected ? wallet.pendingRevenueInj.toFixed(4) : profile.earnedInj.toFixed(4), unit: "INJ" },
            { label: "许可证", value: String(installedSkills.length), unit: "SKILLS" },
          ].map(item => (
            <div key={item.label} className="rounded-2xl p-3" style={{ background: "#FAF6EF", border: "1px solid rgba(28,25,17,.1)" }}>
              <span className="block" style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)" }}>{item.label}</span>
              <strong className="mt-2 block" style={{ color: "#1C1911", fontSize: "var(--ui-font-section)" }}>{item.value}</strong>
              <small style={{ color: "#6D6884", fontSize: 8 }}>{item.unit}</small>
            </div>
          ))}
        </div>

        <section className="mt-3 rounded-[20px] p-4" style={{ background: "#FAF6EF", border: "1px solid rgba(28,25,17,.1)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p style={{ color: "#1C1911", fontSize: "var(--ui-font-label)" }}>Agent 消费预算</p>
              <p className="mt-1" style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)" }}>
                今日 {profile.spentInj.toFixed(4)} / {profile.dailyBudget.toFixed(3)} INJ
              </p>
            </div>
            <span style={{ color: "#6D6884", fontSize: "var(--ui-font-caption)" }}>{Math.round(budgetRatio)}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: "#EAE5DA" }}>
            <i className="block h-full rounded-full" style={{ width: `${budgetRatio}%`, background: "#6D6884" }}/>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p style={{ color: "#1C1911", fontSize: "var(--ui-font-caption)" }}>
                ≤ {profile.autoPayLimit.toFixed(4)} INJ 自动支付
              </p>
              <p className="mt-1" style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)" }}>仅限已验证和白名单 Skill</p>
            </div>
            <button
              type="button"
              aria-label={`${profile.name} 的自动支付权限`}
              aria-pressed={autoPayEnabled}
              onClick={() => setAutoPayEnabled(current => !current)}
              className="relative h-6 w-11 shrink-0 rounded-full"
              style={{ background: autoPayEnabled ? "#6B9E7A" : "#D6D0C5" }}
            >
              <i
                className="absolute top-1 h-4 w-4 rounded-full bg-white transition-all"
                style={{ left: autoPayEnabled ? 23 : 4 }}
              />
            </button>
          </div>
        </section>

        <div className="mt-4 flex items-center justify-between">
          <p style={{ color: "#1C1911", fontSize: "var(--ui-font-label)" }}>已安装的链上 Skill</p>
          <span style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)" }}>{installedSkills.length} LICENSES</span>
        </div>
        <div className="mt-2 grid gap-2">
          {installedSkills.map(skill => (
            <div key={skill.id} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3"
              style={{ background: "#FAF6EF", border: `1px solid ${skill.color}28` }}>
              <span className="min-w-0">
                <strong className="block truncate" style={{ color: "#1C1911", fontSize: "var(--ui-font-caption)" }}>{skill.name}</strong>
                <small className="mt-1 block" style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)" }}>
                  {skill.price.mode === "per_call" ? `${skill.price.amount} ${skill.price.asset} /次` : "永久 License"}
                </small>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1" style={{ color: "#579447", fontSize: "var(--ui-font-micro)" }}>
                <Package size={11}/>已验证
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-2xl px-3 py-3"
          style={{ color: "#6D6884", background: "rgba(109,104,132,.07)", border: "1px solid rgba(109,104,132,.14)", fontSize: "var(--ui-font-micro)", lineHeight: 1.55 }}>
          <Lock size={12} className="mr-1.5 inline"/>
          私钥不会交给 Agent；所有超过自动支付限额的操作都需要用户确认。
        </div>
      </div>
    </div>
  );
}

function AgentGalleryScreen({ navigate, section, onSectionChange, drafts, onEditAgent, onOpenSetting, capturedPets }: {
  navigate: (s: Screen) => void;
  section: "agents" | "objects";
  onSectionChange: (section: AgentArchiveSection) => void;
  drafts: Record<string, AgentEditorDraft>;
  onEditAgent: (agentId: string) => void;
  onOpenSetting: (category: CharacterStyleCategory, type?: WorldStyleSkillAssetType) => void;
  capturedPets: PetAsset[];
}) {
  const [agentStyle, setAgentStyle] = useState<CharacterStyleCategory>("dailySpirits");
  const activeStyle = AGENT_STYLE_OPTIONS.find(style => style.id === agentStyle) || AGENT_STYLE_OPTIONS[0];
  const styleAgents = agentStyle === "dailySpirits"
    ? []
    : WORLD_STYLE_SKILL_ASSETS.filter(asset => asset.category === agentStyle);

  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar showConnectivity={false}/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("everydayTown")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-title)", fontWeight: 700 }}>My Agents</p>
        <button style={{ color: "#7A7468" }}><Search size={18}/></button>
      </div>

      <AgentArchiveTabs active={section} onChange={onSectionChange}/>

      {section === "objects" ? (
        <EnvironmentObjectsArchive/>
      ) : (
        /* Agent grid */
        <div className="flex-1 overflow-y-auto px-5">
          <div className="flex items-end justify-between gap-3" style={{ marginBottom: 10 }}>
            <div>
              <p style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)", letterSpacing: .8, marginBottom: 4 }}>AGENT STYLE</p>
              <p style={{ color: activeStyle.accent, fontFamily: "VT323,monospace", fontSize: "var(--ui-font-label)" }}>{activeStyle.note}</p>
            </div>
            <div className="relative" style={{ width: 128, flexShrink: 0 }}>
              <select
                aria-label="选择 Agent 风格"
                value={agentStyle}
                onChange={event => setAgentStyle(event.target.value as CharacterStyleCategory)}
                style={{
                  appearance: "none",
                  WebkitAppearance: "none",
                  width: "100%",
                  borderRadius: 10,
                  padding: "7px 27px 7px 9px",
                  background: `${activeStyle.accent}10`,
                  border: `1.5px solid ${activeStyle.accent}`,
                  color: activeStyle.accent,
                  outline: "none",
                  fontFamily: "Caveat,cursive",
                  fontSize: "var(--ui-font-label)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {AGENT_STYLE_OPTIONS.map(style => <option key={style.id} value={style.id}>{style.label}</option>)}
              </select>
              <ChevronDown size={14} aria-hidden="true" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: activeStyle.accent, pointerEvents: "none" }}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pb-4">
          {agentStyle === "dailySpirits" ? <>
            {capturedPets.filter(pet => pet.name !== "暹罗猫").map(pet => (
              <button key={pet.id} onClick={() => navigate("everydayTown")}
                aria-label={`查看 ${pet.name}`}
                className="rounded-2xl overflow-hidden text-left"
                style={{ background: "#FAF6EF", border: "1.5px solid rgba(28,25,17,0.1)", boxShadow: "0 1px 6px rgba(28,25,17,0.05)" }}>
                <div className="flex items-center justify-center relative" style={{ height: 90, background: "#E8634A12" }}>
                  <motion.img src={pet.finalUrl} alt={pet.name} animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity }}
                    style={{ width: 82, height: 82, objectFit: "contain" }}/>
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full"
                    style={{ background: "#E8634A20", color: "#E8634A", border: "1px solid #E8634A40", fontSize: "var(--ui-font-caption)" }}>
                    本机 AGENT
                  </div>
                </div>
                <div className="p-2.5">
                  <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-heading)", fontWeight: 700, color: "#1C1911", lineHeight: 1.1 }}>{pet.name}</p>
                  <p style={{ fontSize: "var(--ui-font-body)", color: "#E8634A", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>{pet.role}</p>
                  <p style={{ fontSize: "var(--ui-font-caption)", color: "#8E867A", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>仅当前手机 · 刷新即清空</p>
                  {pet.personality?.length ? (
                    <p className="truncate mt-1" style={{ fontSize: "var(--ui-font-caption)", color: "#6B9E7A", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
                      {pet.personality.join(" · ")}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between mt-1">
                    <span style={{ fontSize: "var(--ui-font-body)", color: "#7A7468", fontFamily: "Press Start 2P,monospace" }}>{pet.world}</span>
                    <span style={{ fontSize: "var(--ui-font-body)", color: "#7A7468", fontFamily: "VT323,monospace" }}>0 段记忆</span>
                  </div>
                </div>
              </button>
            ))}
            {AGENT_PROFILES.map(a => (
            <button key={a.id} onClick={() => onEditAgent(a.id)}
              aria-label={`Edit ${drafts[a.id]?.name || a.name} settings`}
              className="rounded-2xl overflow-hidden text-left"
              style={{ background: "#FAF6EF", border: "1.5px solid rgba(28,25,17,0.1)", boxShadow: "0 1px 6px rgba(28,25,17,0.05)" }}>
              {/* Agent preview */}
              <div className="flex items-center justify-center relative"
                style={{ height: "90px", background: a.color + "12" }}>
                <svg width="80" height="80" viewBox="-40 -40 80 80">
                  {a.render(0.62, false)}
                </svg>
                {a.badge && (
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full"
                    style={{ background: a.color + "20", color: a.color, border: `1px solid ${a.color}40`, fontSize: "var(--ui-font-caption)" }}>
                    {a.badge}
                  </div>
                )}
                {a.esp32 && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                    style={{ background: "#1C1911", color: "white" }}>
                    <Cpu size={8}/>
                    <span style={{ fontSize: "var(--ui-font-caption)", fontFamily: "VT323,monospace" }}>ESP32</span>
                  </div>
                )}
                {a.visiting && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse" style={{ background: "#E8191A" }}/>
                )}
              </div>
              {/* Info */}
              <div className="p-2.5">
                <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-heading)", fontWeight: 700, color: "#1C1911", lineHeight: 1.1 }}>{drafts[a.id]?.name || a.name}</p>
                <p style={{ fontSize: "var(--ui-font-body)", color: a.color, fontFamily: "VT323,monospace" }}>{drafts[a.id]?.role || a.role}</p>
                <div className="flex items-center justify-between mt-1">
                  <span style={{ fontSize: "var(--ui-font-body)", color: "#7A7468", fontFamily: "Press Start 2P,monospace" }}>{a.world}</span>
                  <span style={{ fontSize: "var(--ui-font-body)", color: "#7A7468", fontFamily: "VT323,monospace" }}>
                    {a.memories} 段记忆
                  </span>
                </div>
                {/* Original photo indicator */}
                <div className="flex items-center gap-1 mt-1.5">
                  <div className="w-4 h-4 rounded" style={{ background: a.color + "30", border: `1px solid ${a.color}40` }}>
                    <svg width="16" height="16" viewBox="0 0 16 16">
                      <rect x="2" y="3" width="12" height="10" rx="1.5" fill={a.color + "40"} stroke={a.color + "60"} strokeWidth="0.7"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: "var(--ui-font-micro)", color: "#7A7468", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>已捕获物件</span>
                </div>
              </div>
            </button>
            ))}
          </> : styleAgents.map(asset => {
              const savedDraft = drafts[asset.type];
              return (
                <button
                  key={asset.type}
                  type="button"
                  onClick={() => onOpenSetting(asset.category, asset.type)}
                  aria-label={`Edit ${savedDraft?.name || asset.defaultName} settings`}
                  className="rounded-2xl overflow-hidden text-left"
                  style={{ background: "#FAF6EF", border: "1.5px solid rgba(28,25,17,0.1)", boxShadow: "0 1px 6px rgba(28,25,17,0.05)" }}
                >
                  <div className="flex items-center justify-center" style={{ height: "116px", background: `${activeStyle.accent}10` }}>
                    <img src={asset.src} alt={asset.alt} draggable={false} style={{ width: "92%", height: "92%", objectFit: "contain" }}/>
                  </div>
                  <div className="p-2.5">
                    <p className="truncate" style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-heading)", fontWeight: 700, color: "#1C1911", lineHeight: 1.1 }}>{savedDraft?.name || asset.defaultName}</p>
                    <p className="truncate" style={{ fontSize: "var(--ui-font-body)", color: activeStyle.accent, fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>{savedDraft?.role || asset.label}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)" }}>{activeStyle.label}</span>
                      <span style={{ color: activeStyle.accent, fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-caption)" }}>编辑 →</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CharacterSettingsGalleryScreen({ drafts, initialCategory, initialType, onBack, onEditAgent, onContinueStyleAgent }: {
  drafts: Record<string, AgentEditorDraft>;
  initialCategory: CharacterStyleCategory;
  initialType?: WorldStyleSkillAssetType;
  onBack: () => void;
  onEditAgent: (agentId: string) => void;
  onContinueStyleAgent: (assetType: WorldStyleSkillAssetType, seed: StyleAgentIdentitySeed) => void;
}) {
  const dailySpiritCards: DailySpiritCard[] = AGENT_PROFILES.map(agent => ({
    id: agent.id,
    name: drafts[agent.id]?.name || agent.name,
    role: drafts[agent.id]?.role || agent.role,
    color: agent.color,
    art: (
      <svg width="76" height="76" viewBox="-40 -40 80 80">
        {agent.render(0.62, false)}
      </svg>
    ),
  }));

  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar showConnectivity={false}/>
      <div className="grid items-center px-5 py-2" style={{ gridTemplateColumns: "32px 1fr 32px" }}>
        <button type="button" onClick={onBack} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p className="text-center" style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700 }}>Character Setting</p>
        <span/>
      </div>
      <CharacterSettingsScreen
        key={`${initialCategory}:${initialType || "first"}`}
        dailySpirits={dailySpiritCards}
        identityDrafts={drafts}
        initialCategory={initialCategory}
        initialType={initialType}
        onEditDailySpirit={onEditAgent}
        onContinueStyleAgent={onContinueStyleAgent}
      />
    </div>
  );
}

// 18. T5-E1 PET HARDWARE DIGITAL TWIN
type DevicePetState = "idle" | "happy" | "listening" | "talking" | "playful" | "sleeping";
type DevicePetId = "dotti" | "siamese";

const DEVICE_PETS: Record<DevicePetId, {
  name: string;
  optionLabel: string;
  screenName: string;
  species: string;
  image: string;
  accent: string;
  speech?: Partial<Record<DevicePetState, string>>;
}> = {
  dotti: {
    name: "Dotti",
    optionLabel: "腊肠犬 Dotti",
    screenName: "DOTTI",
    species: "腊肠犬伙伴",
    image: petDachshundPng,
    accent: "#B67C42",
  },
  siamese: {
    name: "暹罗猫",
    optionLabel: "暹罗猫",
    screenName: "暹罗猫",
    species: "暹罗猫伙伴",
    image: petSiamesePng,
    accent: "#9B7653",
    speech: {
      idle: "我在这里，轻轻摸一下屏幕吧。",
      happy: "喵～你回来啦，今天也陪我晒太阳吗？",
      listening: "我在听，把今天的秘密告诉我吧。",
      talking: "喵！我已经记住你的声音啦。",
      playful: "尾巴竖起来了！再轻轻晃一下吧。",
      sleeping: "晚安……我会蜷在记忆旁边守着你。",
    },
  },
};

const DEVICE_PET_STATES: Record<DevicePetState, {
  label: string;
  mood: string;
  speech: string;
  accent: string;
}> = {
  idle: { label: "待机", mood: "安心", speech: "我在这里，轻轻碰一下屏幕吧。", accent: "#6B9E7A" },
  happy: { label: "亲近", mood: "开心", speech: "你回来啦！今天也一起散步吗？", accent: "#E8634A" },
  listening: { label: "聆听", mood: "专注", speech: "我在听，把今天发生的事告诉我吧。", accent: "#4A7FA5" },
  talking: { label: "回应", mood: "热情", speech: "汪！我已经把你的声音记住啦。", accent: "#D4A800" },
  playful: { label: "玩耍", mood: "兴奋", speech: "设备晃了一下！来追我呀！", accent: "#C890C0" },
  sleeping: { label: "休眠", mood: "困倦", speech: "晚安……我会守着今天的记忆。", accent: "#7A7468" },
};

function Esp32Screen({ navigate, archiveTabs }: { navigate: (s: Screen) => void; archiveTabs?: React.ReactNode }) {
  const [selectedPet, setSelectedPet] = useState<DevicePetId>("dotti");
  const [petState, setPetState] = useState<DevicePetState>("idle");
  const [activeControl, setActiveControl] = useState("TOUCH");
  const [eventCount, setEventCount] = useState(1);
  const devicePet = DEVICE_PETS[selectedPet];
  const state = {
    ...DEVICE_PET_STATES[petState],
    speech: devicePet.speech?.[petState] || DEVICE_PET_STATES[petState].speech,
  };

  const triggerPet = (control: string, nextState: DevicePetState) => {
    setActiveControl(control);
    setPetState(nextState);
    setEventCount(count => count + 1);
  };

  const handleScreenTouch = () => {
    const sequence: DevicePetState[] = ["happy", "playful", "talking", "idle"];
    const currentIndex = sequence.indexOf(petState);
    triggerPet("TOUCH", sequence[(currentIndex + 1) % sequence.length]);
  };

  const handlePetChange = (nextPet: DevicePetId) => {
    setSelectedPet(nextPet);
    setPetState("idle");
    setActiveControl("SELECT");
    setEventCount(count => count + 1);
  };

  const petAnimation = {
    idle: { y: [0, -3, 0], rotate: 0, scale: 1, opacity: 1 },
    happy: { y: [0, -9, 0, -5, 0], rotate: [-2, 3, -2, 2, 0], scale: 1.04, opacity: 1 },
    listening: { y: [0, -2, 0], rotate: [-1, 1, -1], scale: [1, 1.03, 1], opacity: 1 },
    talking: { y: [0, -5, 0, -3, 0], rotate: [0, -2, 2, 0], scale: [1, 1.05, 1], opacity: 1 },
    playful: { x: [0, -9, 9, -5, 5, 0], y: [0, -5, 0], rotate: [0, -4, 5, 0], scale: 1.02, opacity: 1 },
    sleeping: { y: 8, rotate: -4, scale: 0.94, opacity: 0.72 },
  }[petState];

  const controls: {
    id: string;
    title: string;
    detail: string;
    icon: React.ReactNode;
    nextState: DevicePetState;
  }[] = [
    { id: "TOUCH", title: "轻触圆屏", detail: "抚摸 · 切换动作", icon: <Heart size={14}/>, nextState: "happy" },
    { id: "KEY", title: "KEY 按键", detail: `让${devicePet.name}回应`, icon: <Volume2 size={14}/>, nextState: "talking" },
    { id: "MIC", title: "麦克风", detail: "唤醒 · 开始聆听", icon: <Mic size={14}/>, nextState: "listening" },
    { id: "IMU", title: "轻晃设备", detail: "六轴感应 · 玩耍", icon: <RotateCw size={14}/>, nextState: "playful" },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar showConnectivity={false}/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("agentGallery")} aria-label="返回 My Agents" style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700 }}>World Familiar</p>
        <button aria-label="设备设置" style={{ color: "#7A7468" }}><Settings size={18}/></button>
      </div>
      {archiveTabs}

      <div
        className="mx-5 rounded-3xl relative overflow-hidden"
        style={{ minHeight: "294px", background: "#FAF6EF", border: "1.5px solid rgba(28,25,17,0.12)" }}
      >
        <div className="absolute top-3 left-3">
          <p style={{ fontSize: "var(--ui-font-caption)", letterSpacing: ".8px", color: "#7A7468" }}>T5-E1 · DIGITAL TWIN</p>
          <p style={{ marginTop: 3, fontFamily: "VT323,monospace", fontSize: "var(--ui-font-body)", color: "#1C1911" }}>1.75” AMOLED · 466×466</p>
        </div>
        <div className="absolute top-3 right-3 flex flex-col items-end" style={{ zIndex: 4 }}>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#6B9E7A" }}/>
            <span style={{ fontSize: "var(--ui-font-caption)", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", color: "#6B9E7A" }}>在线</span>
          </div>
          <div className="relative" style={{ marginTop: 5 }}>
            <select
              aria-label="选择设备 Agent"
              value={selectedPet}
              onChange={event => handlePetChange(event.target.value as DevicePetId)}
              style={{
                appearance: "none",
                WebkitAppearance: "none",
                width: 106,
                height: 28,
                padding: "0 24px 0 8px",
                borderRadius: 9,
                border: `1.5px solid ${devicePet.accent}65`,
                background: `${devicePet.accent}12`,
                color: "#1C1911",
                outline: "none",
                fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                fontSize: "var(--ui-font-micro)",
                cursor: "pointer",
              }}
            >
              {(Object.entries(DEVICE_PETS) as [DevicePetId, (typeof DEVICE_PETS)[DevicePetId]][]).map(([id, pet]) => (
                <option key={id} value={id}>{pet.optionLabel}</option>
              ))}
            </select>
            <ChevronDown
              size={12}
              aria-hidden="true"
              style={{ position: "absolute", right: 7, top: 8, color: devicePet.accent, pointerEvents: "none" }}
            />
          </div>
        </div>

        <div className="flex justify-center" style={{ paddingTop: 42 }}>
          <div className="relative" style={{ width: 224, height: 224 }}>
            <div
              className="absolute rounded-full"
              style={{
                inset: 5,
                background: "linear-gradient(145deg,#3B3934 0%,#11100E 52%,#2D2B27 100%)",
                border: "2px solid #1C1911",
                boxShadow: "0 10px 20px rgba(28,25,17,.18), inset 0 0 0 3px rgba(255,255,255,.08)",
              }}
            />
            <button
              type="button"
              onClick={handleScreenTouch}
              aria-label={`轻触圆形屏幕，${devicePet.name}当前${state.label}`}
              className="absolute rounded-full overflow-hidden"
              style={{
                inset: 18,
                padding: 0,
                border: `2px solid ${state.accent}`,
                background: "radial-gradient(circle at 50% 34%,#FFF8EA 0%,#F6E9D1 48%,#EBCFA9 100%)",
                boxShadow: `0 0 18px ${state.accent}45, inset 0 0 22px rgba(255,255,255,.55)`,
                cursor: "pointer",
              }}
            >
              <div className="absolute top-3 left-0 right-0 flex items-center justify-center gap-1.5">
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: state.accent }}/>
                <span style={{ color: "#1C1911", fontSize: "var(--ui-font-micro)", letterSpacing: ".8px" }}>{devicePet.screenName} · {state.label}</span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={petState}
                  initial={{ opacity: 0, y: -3, scale: .96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 3, scale: .96 }}
                  className="absolute left-1/2 -translate-x-1/2 rounded-xl"
                  style={{
                    top: 28,
                    width: 142,
                    padding: "5px 8px",
                    background: "rgba(250,246,239,.94)",
                    border: `1px solid ${state.accent}75`,
                    color: "#1C1911",
                    fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                    fontSize: "var(--ui-font-caption)",
                    lineHeight: 1.35,
                    zIndex: 2,
                  }}
                >
                  {state.speech}
                </motion.div>
              </AnimatePresence>

              <motion.img
                key={selectedPet}
                src={devicePet.image}
                alt={`圆形 AMOLED 屏幕上的${devicePet.name}`}
                draggable={false}
                animate={petAnimation}
                transition={{ duration: petState === "sleeping" ? .45 : 1.6, repeat: petState === "sleeping" ? 0 : Infinity, ease: "easeInOut" }}
                style={{
                  position: "absolute",
                  width: selectedPet === "siamese" ? 104 : 122,
                  height: 108,
                  objectFit: "contain",
                  left: "50%",
                  bottom: 20,
                  marginLeft: selectedPet === "siamese" ? -52 : -61,
                }}
              />
              <motion.div
                animate={{ scaleX: petState === "playful" ? [1, .72, 1.08, 1] : [1, .92, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="absolute left-1/2 -translate-x-1/2 rounded-full"
                style={{ width: 70, height: 10, bottom: 20, background: "rgba(28,25,17,.12)" }}
              />
              <span
                className="absolute left-0 right-0 text-center"
                style={{ bottom: 8, color: "#7A7468", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-micro)" }}
              >
                轻触屏幕 · 连续点击切换动作
              </span>
            </button>

            <button
              type="button"
              aria-label="PWR 电源按键，切换休眠"
              onClick={() => triggerPet("PWR", petState === "sleeping" ? "idle" : "sleeping")}
              className="absolute"
              style={{
                right: -1,
                top: 68,
                width: 16,
                height: 36,
                borderRadius: "0 7px 7px 0",
                background: activeControl === "PWR" ? "#E8634A" : "#5A5750",
                border: "1.5px solid #1C1911",
                color: "white",
                fontFamily: "VT323,monospace",
                fontSize: "var(--ui-font-caption)",
                writingMode: "vertical-rl",
              }}
            >
              PWR
            </button>
            <button
              type="button"
              aria-label={`KEY 用户按键，让${devicePet.name}回应`}
              onClick={() => triggerPet("KEY", "talking")}
              className="absolute"
              style={{
                right: 3,
                top: 116,
                width: 13,
                height: 28,
                borderRadius: "0 6px 6px 0",
                background: activeControl === "KEY" ? "#6B9E7A" : "#807C73",
                border: "1.5px solid #1C1911",
                color: "white",
                fontFamily: "VT323,monospace",
                fontSize: "var(--ui-font-micro)",
                writingMode: "vertical-rl",
              }}
            >
              KEY
            </button>
            <div
              className="absolute left-1/2 -translate-x-1/2"
              title="USB Type-C"
              style={{ width: 42, height: 8, bottom: 0, borderRadius: "5px 5px 0 0", background: "#1C1911" }}
            />
          </div>
        </div>
      </div>

      <div className="px-5 mt-3 flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden"
          style={{ background: `${devicePet.accent}14`, border: `1.5px solid ${devicePet.accent}40` }}
        >
          <img src={devicePet.image} alt="" draggable={false} style={{ width: 54, height: 48, objectFit: "contain" }}/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700, color: "#1C1911" }}>{devicePet.name}</p>
            <span
              className="rounded-full"
              style={{ padding: "3px 7px", color: state.accent, background: `${state.accent}14`, border: `1px solid ${state.accent}45`, fontSize: "var(--ui-font-caption)" }}
            >
              {state.label}
            </span>
          </div>
          <p style={{ fontSize: "var(--ui-font-body)", color: devicePet.accent, fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
            {devicePet.species} · Memory Town 数字宠物
          </p>
        </div>
      </div>

      <div className="px-5 mt-3">
        <SectionLabel text="硬件模拟控制"/>
        <div className="grid grid-cols-2 gap-2">
          {controls.map(control => {
            const selected = activeControl === control.id;
            return (
              <button
                key={control.id}
                type="button"
                onClick={() => triggerPet(control.id, control.nextState)}
                className="text-left rounded-xl"
                style={{
                  minHeight: 68,
                  padding: "9px 10px",
                  background: selected ? `${state.accent}12` : "#FAF6EF",
                  border: `1.5px solid ${selected ? state.accent : "rgba(28,25,17,.09)"}`,
                  color: selected ? state.accent : "#7A7468",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  {control.icon}
                  <span style={{ fontFamily: "VT323,monospace", fontSize: "var(--ui-font-caption)", letterSpacing: ".8px" }}>{control.id}</span>
                </div>
                <p style={{ marginTop: 5, color: "#1C1911", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", fontWeight: 700 }}>
                  {control.title}
                </p>
                <p style={{ marginTop: 2, color: "#7A7468", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-caption)" }}>
                  {control.detail}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 mt-3">
        <SectionLabel text="数字孪生反馈"/>
        <div className="rounded-2xl px-3 py-3" style={{ background: "#FAF6EF", border: `1.5px solid ${state.accent}55` }}>
          <div className="flex items-center justify-between gap-2">
            <span style={{ color: state.accent, fontSize: "var(--ui-font-caption)", letterSpacing: ".8px" }}>RUNTRACE #{String(eventCount).padStart(3, "0")}</span>
            <span style={{ color: "#7A7468", fontFamily: "VT323,monospace", fontSize: "var(--ui-font-body)" }}>WEB → T5-E1</span>
          </div>
          <p style={{ marginTop: 7, color: "#1C1911", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)", lineHeight: 1.5 }}>
            {activeControl} 输入已映射：{devicePet.name}进入「{state.label}」，心情变为「{state.mood}」。
          </p>
          <div className="flex items-center gap-3 mt-2">
            {[
              { icon: <Wifi size={10}/>, label: "Wi-Fi" },
              { icon: <Zap size={10}/>, label: "74%" },
              { icon: <Volume2 size={10}/>, label: "Audio" },
              { icon: <RotateCw size={10}/>, label: "IMU" },
            ].map(item => (
              <span key={item.label} className="flex items-center gap-1" style={{ color: "#6B9E7A", fontSize: "var(--ui-font-caption)" }}>
                {item.icon}{item.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 mt-3 mb-5">
        <button
          type="button"
          onClick={() => triggerPet("PWR", petState === "sleeping" ? "idle" : "sleeping")}
          className="w-full rounded-xl flex items-center justify-center gap-2"
          style={{
            padding: "10px 12px",
            background: petState === "sleeping" ? "#6B9E7A18" : "#EAE5DA",
            border: "1px solid rgba(28,25,17,.08)",
            color: petState === "sleeping" ? "#6B9E7A" : "#7A7468",
            fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
            fontSize: "var(--ui-font-body)",
          }}
        >
          <Zap size={13}/>
          {petState === "sleeping" ? "唤醒圆屏宠物" : `模拟 PWR · 让${devicePet.name}休眠`}
        </button>
      </div>
    </div>
  );
}

// 19. PUBLIC WORLD MIRROR
function PublicMirrorScreen({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("everydayTown")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700 }}>Public Mirror</p>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: "#E8634A18", color: "#E8634A", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)" }}>
          <Share2 size={13}/> 分享
        </button>
      </div>

      {/* Privacy overview */}
      <div className="mx-5 rounded-2xl px-4 py-3 mb-3"
        style={{ background: "#4A7FA518", border: "1.5px solid #4A7FA540" }}>
        <p style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700, color: "#4A7FA5", marginBottom: "4px" }}>
          “你不需要用隐私来交换连接。”
        </p>
        <p style={{ fontSize: "var(--ui-font-body)", lineHeight: 1.55, color: "#4A7FA5" }}>
          访客只能看到你主动分享的内容。原始照片与私人记忆始终不会公开。
        </p>
      </div>

      {/* World preview (visitor view) */}
      <div className="mx-5 rounded-2xl overflow-hidden relative"
        style={{ height: "180px", border: "2px solid rgba(28,25,17,0.12)" }}>
        <EverydayTownSVG w={350} h={220}/>
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full"
          style={{ background: "rgba(250,246,239,0.92)", border: "1px solid rgba(28,25,17,0.1)" }}>
          <span style={{ fontSize: "var(--ui-font-body)", color: "#7A7468" }}>访客视角</span>
        </div>
      </div>

      {/* Visibility controls */}
      <div className="px-5 mt-3">
        <SectionLabel text="访客可见内容"/>
        <div className="flex flex-col gap-2">
          {[
            { label: "城市地图与建筑", visible: true },
            { label: "智能体名称与角色", visible: true },
            { label: "智能体外观", visible: true },
            { label: "智能体当前位置", visible: true },
            { label: "行动气泡", visible: true },
            { label: "智能体人格细节", visible: false },
            { label: "记忆记录", visible: false },
            { label: "原始照片", visible: false },
            { label: "私人记忆", visible: false },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: "#FAF6EF", border: "1px solid rgba(28,25,17,0.08)" }}>
              <p style={{ fontSize: "var(--ui-font-body)", color: "#1C1911" }}>{item.label}</p>
              <div className="flex items-center gap-1.5">
                {item.visible
                  ? <><Eye size={12} color="#6B9E7A"/><span style={{ fontSize: "var(--ui-font-body)", color: "#6B9E7A" }}>可见</span></>
                  : <><Lock size={12} color="#E8634A"/><span style={{ fontSize: "var(--ui-font-body)", color: "#E8634A" }}>隐藏</span></>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active visitors */}
      <div className="px-5 mt-3 mb-4">
        <SectionLabel text="正在访问（1）"/>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: "#FAF6EF", border: "1.5px solid #E8191A30" }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#E8191A" }}/>
          <p style={{ fontSize: "var(--ui-font-body)", color: "#1C1911", lineHeight: 1.55 }}>
            <strong>Camera Archivist</strong> · 来自 Stardom District · 访客分支活跃
          </p>
        </div>
      </div>
    </div>
  );
}

// 20. BRANCH RESOLUTION
function BranchResolutionScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [decisions, setDecisions] = useState<Record<string, "merge"|"discard"|null>>({
    arrival: null, meeting: null, artifact: null
  });

  const setDecision = (key: string, val: "merge"|"discard") =>
    setDecisions(d => ({ ...d, [key]: val }));

  const events = [
    {
      key: "arrival",
      label: "Camera Archivist 抵达",
      desc: "访客抵达车站，并向夜灯向导介绍了自己",
      impact: "新关系：Shutter ↔ Camera Archivist",
      icon: "🚉",
      color: "#E8191A"
    },
    {
      key: "meeting",
      label: "图书馆会面",
      desc: "Camera Archivist 向记忆图书管理员分享了 Stardom District 的建筑记录",
      impact: "记忆图书管理员新增 3 条档案",
      icon: "📚",
      color: "#4A7FA5"
    },
    {
      key: "artifact",
      label: "共同照片物件生成 ★",
      desc: "一张图书馆照片被创造出来——它是两个世界共同完成的物件",
      impact: "新物件：Stardom-Memory 照片 · 同时存在于两个世界",
      icon: "🖼️",
      color: "#D4A800"
    },
  ];

  const allDecided = Object.values(decisions).every(d => d !== null);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("worldline")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700 }}>Resolve Branch</p>
        <div/>
      </div>

      {/* Visitor summary */}
      <div className="mx-5 flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#E8191A18" }}>
          <svg width="36" height="36" viewBox="-18 -18 36 36">
            <CameraAgent x={0} y={0} s={0.55} accent="#E8191A" animated={false}/>
          </svg>
        </div>
        <div>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-heading)", fontWeight: 700, color: "#1C1911" }}>
            Camera Archivist · Stardom District
          </p>
          <p style={{ fontSize: "var(--ui-font-body)", color: "#7A7468", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
            3 个事件 · 1 个物件 · 访客分支
          </p>
        </div>
      </div>

      {/* Events to resolve */}
      <div className="px-5 flex flex-col gap-3">
        {events.map(ev => (
          <PaperCard key={ev.key} className="p-4">
            <div className="flex items-start gap-3">
              <span style={{ fontSize: "var(--ui-font-title)", flexShrink: 0 }}>{ev.icon}</span>
              <div className="flex-1">
                <p style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700, color: "#1C1911", lineHeight: 1.45 }}>
                  {ev.label}
                </p>
                <p style={{ fontSize: "var(--ui-font-body)", lineHeight: 1.55, color: "#7A7468", marginTop: "2px" }}>
                  {ev.desc}
                </p>
                <div className="mt-1.5 px-2.5 py-1 rounded-lg"
                  style={{ background: ev.color + "18", border: `1px solid ${ev.color}40` }}>
                  <p style={{ fontSize: "var(--ui-font-body)", color: ev.color, fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
                    影响：{ev.impact}
                  </p>
                </div>
                {/* Decision buttons */}
                <div className="flex gap-2 mt-2.5">
                  <button onClick={() => setDecision(ev.key, "merge")}
                    className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1"
                    style={{
                      background: decisions[ev.key] === "merge" ? "#6B9E7A" : "#EAE5DA",
                      color: decisions[ev.key] === "merge" ? "white" : "#7A7468",
                      fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                      fontSize: "var(--ui-font-body)",
                      fontWeight: decisions[ev.key] === "merge" ? 700 : 400
                    }}>
                    <GitMerge size={13}/>
                    合并到主世界线
                  </button>
                  <button onClick={() => setDecision(ev.key, "discard")}
                    className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1"
                    style={{
                      background: decisions[ev.key] === "discard" ? "#E8634A" : "#EAE5DA",
                      color: decisions[ev.key] === "discard" ? "white" : "#7A7468",
                      fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                      fontSize: "var(--ui-font-body)",
                      fontWeight: decisions[ev.key] === "discard" ? 700 : 400
                    }}>
                    <X size={13}/>
                    放弃
                  </button>
                </div>
              </div>
            </div>
          </PaperCard>
        ))}
      </div>

      {/* Confirm */}
      <div className="px-5 mt-4 mb-4">
        <button
          onClick={() => navigate("worldline")}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{
            background: allDecided ? "#1C1911" : "#DDD8CF",
            color: allDecided ? "#FAF6EF" : "#7A7468",
            cursor: allDecided ? "pointer" : "not-allowed"
          }}>
          <Check size={16}/>
          <span style={{ fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>
            {allDecided ? "应用处理结果" : `请处理全部事件（${Object.values(decisions).filter(Boolean).length}/3）`}
          </span>
        </button>
        <p className="text-center mt-2" style={{ fontSize: "var(--ui-font-body)", color: "#7A7468" }}>
          访客分支将被关闭；合并的事件会成为主世界历史。
        </p>
      </div>
    </div>
  );
}

type HomeScene = "worldDock" | "everyday" | "stardom" | "future" | "creator" | "custom";
type HomeView = "scene" | "civilization" | "plaza" | "chainPlaza";

function PlazaStyleAgent({ type, size = 72 }: { type: WorldStyleSkillAssetType; size?: number }) {
  const asset = WORLD_STYLE_SKILL_ASSETS.find(item => item.type === type);
  if (!asset) return null;
  return (
    <img
      src={asset.src}
      alt={asset.alt}
      draggable={false}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

function SupervisedTrainingConsole() {
  const provider = useMemo(() => createSupervisedTrainingProvider(), []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startAttemptRef = useRef(0);
  const [exercise, setExercise] = useState<SupervisedTrainingExercise>("squats");
  const [engineStatus, setEngineStatus] = useState<"checking" | "ready" | "offline">("checking");
  const [starting, setStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<SupervisedTrainingFeedback | null>(null);
  const [summary, setSummary] = useState<SupervisedTrainingSummary | null>(null);
  const [error, setError] = useState("");

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const checkEngine = async () => {
    setEngineStatus("checking");
    const available = await provider.health();
    setEngineStatus(available ? "ready" : "offline");
    return available;
  };

  useEffect(() => {
    checkEngine();
    return () => {
      startAttemptRef.current += 1;
      stopCamera();
      const activeSession = sessionIdRef.current;
      sessionIdRef.current = null;
      if (activeSession) provider.stop(activeSession).catch(() => undefined);
    };
  }, [provider]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer = 0;
    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2) {
        const width = 480;
        const height = Math.max(270, Math.round(width * (video.videoHeight || 360) / (video.videoWidth || 480)));
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
        try {
          const nextFeedback = await provider.analyze({
            sessionId,
            exercise,
            imageData: canvas.toDataURL("image/jpeg", .72),
          });
          if (!cancelled) {
            setFeedback(nextFeedback);
            setError("");
          }
        } catch (reason) {
          if (!cancelled) setError(reason instanceof Error ? reason.message : "训练帧分析失败");
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, 700);
    };
    timer = window.setTimeout(tick, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [exercise, provider, sessionId]);

  const startTraining = async () => {
    const attempt = startAttemptRef.current + 1;
    startAttemptRef.current = attempt;
    setStarting(true);
    setError("");
    setSummary(null);
    setFeedback(null);
    try {
      const available = engineStatus === "ready" || await checkEngine();
      if (!available) throw new Error("监督训练服务暂时不可用，请稍后重试");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("当前环境无法访问摄像头");
      let cameraAbandoned = false;
      let permissionTimer = 0;
      const cameraRequest = navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      });
      cameraRequest.then(stream => {
        if (cameraAbandoned) stream.getTracks().forEach(track => track.stop());
      }).catch(() => undefined);
      const permissionTimeout = new Promise<never>((_, reject) => {
        permissionTimer = window.setTimeout(() => {
          cameraAbandoned = true;
          reject(new Error("等待摄像头授权超时，请在浏览器地址栏允许摄像头后重试"));
        }, 15000);
      });
      const stream = await Promise.race([cameraRequest, permissionTimeout])
        .finally(() => window.clearTimeout(permissionTimer));
      if (attempt !== startAttemptRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const session = await provider.start(exercise);
      if (attempt !== startAttemptRef.current) {
        await provider.stop(session.sessionId).catch(() => undefined);
        stopCamera();
        return;
      }
      sessionIdRef.current = session.sessionId;
      setSessionId(session.sessionId);
    } catch (reason) {
      stopCamera();
      if (attempt === startAttemptRef.current) {
        setError(reason instanceof Error ? reason.message : "无法启动监督训练");
      }
    } finally {
      if (attempt === startAttemptRef.current) setStarting(false);
    }
  };

  const stopTraining = async () => {
    const activeSession = sessionIdRef.current;
    sessionIdRef.current = null;
    setSessionId(null);
    stopCamera();
    if (!activeSession) return;
    try {
      setSummary(await provider.stop(activeSession));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法生成训练总结");
    }
  };

  const statusColor = sessionId ? "#E8634A" : engineStatus === "ready" ? "#6B9E7A" : "#8E867A";
  return (
    <section className="rounded-2xl overflow-hidden" style={{ border: "2px solid #B67C4270", background: "#F7F0E5" }}>
      <div className="px-3 py-2.5 flex items-center justify-between gap-3" style={{ background: "#B67C4212", borderBottom: "1px solid #B67C4228" }}>
        <div>
          <p style={{ color: "#B67C42", fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>DOTTI RUNTIME · REAL SKILL</p>
          <p style={{ fontSize: "var(--ui-font-body)", marginTop: 4 }}>{sessionId ? "监督训练进行中" : "实时监督训练控制台"}</p>
        </div>
        <span className="flex items-center gap-1 rounded-full px-2 py-1" style={{ color: statusColor, background: `${statusColor}12`, fontSize: "var(--ui-font-micro)" }}>
          <span className={sessionId ? "w-1.5 h-1.5 rounded-full animate-pulse" : "w-1.5 h-1.5 rounded-full"} style={{ background: statusColor }}/>
          {sessionId ? "LIVE" : starting ? "等待授权" : engineStatus === "checking" ? "检测中" : engineStatus === "ready" ? "引擎在线" : "引擎离线"}
        </span>
      </div>

      <div className="p-3 flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div className="relative">
            <select
              aria-label="选择监督训练动作"
              value={exercise}
              disabled={Boolean(sessionId) || starting}
              onChange={event => setExercise(event.target.value as SupervisedTrainingExercise)}
              className="w-full rounded-xl"
              style={{
                height: 36, appearance: "none", WebkitAppearance: "none", padding: "0 30px 0 10px",
                border: "1.5px solid #B67C4245", background: "#FAF6EF", color: "#1C1911",
                fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-caption)",
              }}
            >
              {SUPERVISED_TRAINING_EXERCISES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <ChevronDown size={12} style={{ position: "absolute", right: 10, top: 12, color: "#B67C42", pointerEvents: "none" }}/>
          </div>
          <button
            type="button"
            onClick={sessionId ? stopTraining : startTraining}
            disabled={starting}
            className="rounded-xl px-3"
            style={{ minWidth: 92, background: sessionId ? "#E8634A" : "#B67C42", color: "white", opacity: starting ? .65 : 1, fontSize: "var(--ui-font-caption)" }}
          >
            {sessionId ? "结束并总结" : starting ? "等待授权…" : "启动监督训练"}
          </button>
        </div>

        <div className="relative rounded-xl overflow-hidden" style={{ minHeight: 154, background: "#1C1911" }}>
          <video ref={videoRef} muted playsInline style={{ width: "100%", height: 190, objectFit: "cover", display: sessionId ? "block" : "none", transform: "scaleX(-1)" }}/>
          <canvas ref={canvasRef} hidden/>
          {!sessionId && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5">
              <img src={petDachshundPng} alt="" style={{ width: 88, height: 64, objectFit: "contain" }}/>
              <p style={{ color: "#FAF6EF", fontSize: "var(--ui-font-caption)", marginTop: 6 }}>
                {starting ? "请允许浏览器使用摄像头，Dotti 正在准备训练。" : "选择动作后，Dotti 将调用真实姿态引擎监督训练。"}
              </p>
            </div>
          )}
          {sessionId && (
            <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
              <span className="rounded-lg px-2 py-1" style={{ background: "rgba(28,25,17,.8)", color: "#FAF6EF", fontSize: "var(--ui-font-micro)" }}>
                {feedback?.phase || "READY"}
              </span>
              <span className="rounded-lg px-2 py-1" style={{ background: "rgba(28,25,17,.8)", color: "#FAF6EF", fontSize: "var(--ui-font-micro)" }}>
                REP {feedback?.repCount || 0}
              </span>
            </div>
          )}
          {sessionId && feedback?.primaryCue && (
            <p className="absolute inset-x-2 bottom-2 rounded-xl px-2.5 py-2 text-center"
              style={{ background: "rgba(250,246,239,.94)", color: "#1C1911", fontSize: "var(--ui-font-caption)", lineHeight: 1.5 }}>
              Dotti：{feedback.primaryCue}
            </p>
          )}
        </div>

        {error && <p style={{ color: "#E8634A", fontSize: "var(--ui-font-caption)", lineHeight: 1.5 }}>{error}</p>}
        {summary && (
          <div className="rounded-xl p-3" style={{ background: "#FAF6EF", border: "1px solid #B67C4235" }}>
            <div className="flex items-center justify-between">
              <span style={{ color: "#B67C42", fontSize: "var(--ui-font-micro)" }}>TRAINING SUMMARY</span>
              <span style={{ color: "#1C1911", fontSize: "var(--ui-font-label)" }}>{summary.repCount} 次</span>
            </div>
            <p style={{ color: "#625D54", fontSize: "var(--ui-font-caption)", marginTop: 7 }}>时长 {summary.durationSeconds}s · 下一组重点：{summary.nextFocus}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function AgentGrowthScreen({ sceneControl }: { sceneControl: React.ReactNode }) {
  const { world, error } = useWorldEvolution(4000);
  const [selectedAgentId, setSelectedAgentId] = useState("dotti");
  const [openManualSkillId, setOpenManualSkillId] = useState<string | null>(null);
  const [skillLoadouts, setSkillLoadouts] = useState<Record<string, string[]>>(() => {
    try {
      return {
        ...MY_AGENT_SKILL_LOADOUTS,
        ...JSON.parse(window.localStorage.getItem(AGENT_SKILL_LOADOUT_STORAGE_KEY) || "{}"),
      };
    } catch {
      return { ...MY_AGENT_SKILL_LOADOUTS };
    }
  });
  const growthAgents = [
    {
      id: "dotti",
      name: "Dotti",
      role: "Training Watchdog",
      portrait: "实时监督型训练智能体",
      color: "#B67C42",
      level: 14,
      memories: 36,
      traits: ["专注", "耐心", "安全优先"],
      belief: "先看清动作，再在真正需要时提醒；训练不是催促，而是持续守护。",
      evolution: "正在把实时姿态识别、动作计数与纠错节奏整理成可以独立加载的监督训练方法。",
      art: <img src={petDachshundPng} alt="腊肠犬 Dotti" draggable={false} style={{ width: 132, height: 132, objectFit: "contain" }}/>,
    },
    {
      id: "miko",
      name: "Miko",
      role: "Café Keeper",
      portrait: "共情型生活智能体",
      color: "#E8634A",
      level: 12,
      memories: 42,
      traits: ["温柔", "独立", "珍惜记忆"],
      belief: "先听懂一段情绪，再决定回应、记录，还是安静陪伴。",
      evolution: "正在把日常照料发展成可被其他智能体学习的陪伴方法。",
      art: (
        <svg width="132" height="142" viewBox="-42 -46 84 92" aria-label="Miko">
          <MugAgent x={0} y={6} s={1.62} accent="#E8634A" animated/>
        </svg>
      ),
    },
    {
      id: "shutter",
      name: "Shutter",
      role: "Archivist",
      portrait: "观察型档案智能体",
      color: "#4A7FA5",
      level: 10,
      memories: 37,
      traits: ["好奇", "有序", "尊重边界"],
      belief: "重要的不只是留下画面，也要记得它为什么值得被保存。",
      evolution: "正在让视觉归档获得边界判断，减少对私人生活的打扰。",
      art: (
        <svg width="132" height="142" viewBox="-42 -46 84 92" aria-label="Shutter">
          <CameraAgent x={0} y={6} s={1.56} accent="#4A7FA5" animated/>
        </svg>
      ),
    },
    {
      id: "noct",
      name: "Noct",
      role: "Fitness Companion",
      portrait: "动作观察与健身陪伴智能体",
      color: "#6D6884",
      level: 8,
      memories: 29,
      traits: ["专注", "鼓励", "尊重节奏"],
      belief: "标准动作不是追求完美，而是让每次训练都更稳定、更安全。",
      evolution: "正在从记录训练次数，进化为能够理解姿势、节奏与个人训练边界的伙伴。",
      art: <PlazaStyleAgent type="lakeOwl" size={132}/>,
    },
  ];
  const selected = growthAgents.find(agent => agent.id === selectedAgentId) || growthAgents[0];
  const runtimeAgent = world?.agents.find(agent => agent.id === selected.id || agent.name === selected.name);
  const skillBindings = getAgentSkillBindings(selected.id);
  const masteredSkills = skillBindings.filter(binding => binding.state === "mastered");
  const learningSkills = skillBindings.filter(binding => binding.state === "learning");
  const openManualSkill = openManualSkillId ? getPlazaSkill(openManualSkillId) : undefined;
  const openManualLoaded = openManualSkill ? skillLoadouts[selected.id]?.includes(openManualSkill.id) ?? false : false;
  const loadedSkillCount = skillBindings.filter(binding => skillLoadouts[selected.id]?.includes(binding.skillId)).length;
  const personalityVersion = runtimeAgent?.personalityVersion || Math.max(2, Math.round(selected.level / 3));
  const memoryCount = runtimeAgent?.memories.length || selected.memories;
  const relationships = runtimeAgent ? Object.keys(runtimeAgent.relationships).length : 4;
  const evolutionProgress = Math.min(96, 38 + personalityVersion * 8 + loadedSkillCount * 9);

  useEffect(() => {
    try {
      window.localStorage.setItem(AGENT_SKILL_LOADOUT_STORAGE_KEY, JSON.stringify(skillLoadouts));
    } catch {
      // Skill loading still works for the current session when storage is unavailable.
    }
  }, [skillLoadouts]);

  const toggleSkillLoad = (agentId: string, skillId: string) => {
    setSkillLoadouts(current => {
      const loaded = current[agentId] || [];
      return {
        ...current,
        [agentId]: loaded.includes(skillId)
          ? loaded.filter(id => id !== skillId)
          : [...loaded, skillId],
      };
    });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto"
      style={{ background: "#F5F0E8", color: "#1C1911", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
      <div className="px-4 pt-9 pb-1 flex justify-end">{sceneControl}</div>

      <div className="px-4 pt-2 pb-3 flex items-start justify-between">
        <div>
          <p style={{ color: selected.color, fontSize: "var(--ui-font-micro)", letterSpacing: 1.2 }}>MY AGENT · GROWTH PROFILE</p>
          <h1 style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-title)", lineHeight: 1, fontWeight: 700, marginTop: 7 }}>Agent Skills</h1>
          <p style={{ color: "#7A7468", fontSize: "var(--ui-font-body)", marginTop: 5 }}>看看它正在成为谁，以及它刚刚学会了什么。</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5"
          style={{ color: error ? "#E8634A" : "#6B9E7A", background: error ? "#E8634A10" : "#6B9E7A12", border: `1px solid ${error ? "#E8634A" : "#6B9E7A"}35`, fontSize: "var(--ui-font-caption)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }}/>
          {error ? "使用本地成长档案" : "自主进化中"}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-3 flex gap-2 overflow-x-auto" style={{ height: 60, scrollbarWidth: "none" }}>
        {growthAgents.map(agent => {
          const active = selected.id === agent.id;
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => {
                setSelectedAgentId(agent.id);
                setOpenManualSkillId(null);
              }}
              className="shrink-0 rounded-xl px-2 py-2 flex items-center gap-2 text-left"
              style={{
                width: 112,
                height: 48,
                background: active ? `${agent.color}12` : "#FAF6EF",
                border: `1.5px solid ${active ? agent.color : "rgba(28,25,17,.1)"}`,
                color: active ? agent.color : "#8E867A",
              }}
            >
              <span className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0" style={{ background: `${agent.color}12` }}>
                <span style={{ transform: "scale(.34)" }}>{agent.art}</span>
              </span>
              <span className="min-w-0">
                <span className="block" style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-label)", fontWeight: 700 }}>{agent.name}</span>
                <span className="block truncate" style={{ fontSize: "var(--ui-font-micro)", marginTop: 2 }}>LV.{agent.level}</span>
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selected.id}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: .18 }}
          className="px-4 pb-4 flex flex-col gap-3"
        >
          <div className="rounded-[24px] overflow-hidden"
            style={{
              background: `linear-gradient(145deg,${selected.color}20,#FAF6EF 52%,#F0EBE2)`,
              border: `2px solid ${selected.color}`,
              boxShadow: `0 10px 28px ${selected.color}18`,
            }}>
            <div className="grid grid-cols-[43%_57%] min-h-[230px]">
              <div className="relative flex flex-col items-center justify-center p-3"
                style={{ borderRight: `1px solid ${selected.color}28` }}>
                <span className="absolute left-3 top-3 rounded-full px-2 py-1"
                  style={{ background: "#FAF6EF", color: selected.color, fontSize: "var(--ui-font-micro)" }}>
                  RESIDENT · LV.{selected.level}
                </span>
                <div className="flex items-center justify-center" style={{ height: 142 }}>{selected.art}</div>
                <div style={{ width: 58, height: 8, borderRadius: "50%", background: "rgba(28,25,17,.1)", marginTop: -15 }}/>
                <p style={{ color: selected.color, fontSize: "var(--ui-font-caption)", marginTop: 15 }}>{selected.portrait}</p>
              </div>
              <div className="p-4 flex flex-col justify-center">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-title)", fontWeight: 700, lineHeight: 1 }}>{selected.name}</p>
                    <p style={{ color: selected.color, fontSize: "var(--ui-font-body)", marginTop: 7 }}>{selected.role}</p>
                  </div>
                  <span className="rounded-lg px-2 py-1" style={{ color: selected.color, background: `${selected.color}12`, fontSize: "var(--ui-font-micro)" }}>
                    人格 v{personalityVersion}
                  </span>
                </div>
                <p style={{ color: "#625D54", fontSize: "var(--ui-font-body)", lineHeight: 1.7, marginTop: 13 }}>“{selected.belief}”</p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {selected.traits.map(trait => (
                    <span key={trait} className="rounded-full px-2 py-1"
                      style={{ color: selected.color, background: "#FAF6EF", border: `1px solid ${selected.color}28`, fontSize: "var(--ui-font-caption)" }}>
                      {trait}
                    </span>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between" style={{ fontSize: "var(--ui-font-micro)" }}>
                    <span style={{ color: "#7A7468" }}>SELF EVOLUTION</span>
                    <span style={{ color: selected.color }}>{evolutionProgress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: "#E7E0D5" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${evolutionProgress}%` }}
                      className="h-full rounded-full"
                      style={{ background: selected.color }}
                    />
                  </div>
                  <p style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)", lineHeight: 1.5, marginTop: 7 }}>{selected.evolution}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3" style={{ background: "rgba(250,246,239,.76)", borderTop: `1px solid ${selected.color}22` }}>
              {[
                ["MEMORY", memoryCount, "段长期记忆"],
                ["BONDS", relationships, "个稳定关系"],
                ["SKILLS", loadedSkillCount, "个能力绑定"],
              ].map(([label, value, note], index) => (
                <div key={label} className="py-2.5 text-center" style={{ borderRight: index < 2 ? "1px solid rgba(28,25,17,.08)" : "none" }}>
                  <p style={{ color: selected.color, fontSize: "var(--ui-font-label)" }}>{value}</p>
                  <p style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)", marginTop: 3 }}>{label} · {note}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>SKILL DECK</p>
                <p style={{ fontSize: "var(--ui-font-label)", marginTop: 4 }}>
                  {loadedSkillCount ? `已加载到 ${selected.name} 的能力卡` : `${selected.name} 的可用能力卡`}
                </p>
              </div>
              <span style={{ color: "#8E867A", fontSize: "var(--ui-font-caption)" }}>独立加载 · 可升级 · 可回滚</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {masteredSkills.map(binding => {
                const skill = getPlazaSkill(binding.skillId);
                if (!skill) return null;
                const loaded = skillLoadouts[selected.id]?.includes(skill.id) ?? false;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    aria-expanded={openManualSkillId === skill.id}
                    onClick={() => setOpenManualSkillId(current => current === skill.id ? null : skill.id)}
                    className={`${skill.featured ? "col-span-2" : ""} rounded-2xl p-3 text-left`}
                    style={{
                      background: skill.featured
                        ? loaded
                          ? `linear-gradient(135deg,${skill.color}22,#FAF6EF 58%,${skill.color}0D)`
                          : "#FAF6EF"
                        : `${skill.color}10`,
                      border: `${skill.featured ? 2 : 1.5}px ${loaded ? "solid" : "dashed"} ${skill.color}${skill.featured ? "90" : "45"}`,
                      boxShadow: skill.featured && loaded ? `0 8px 22px ${skill.color}18` : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${skill.color}18`, color: skill.color }}><Check size={13}/></span>
                      <span style={{ color: skill.color, fontSize: "var(--ui-font-micro)" }}>
                        {skill.featured ? "CORE SKILL · " : "MASTERED · "}{loaded ? binding.proficiency : "可加载"}
                      </span>
                    </div>
                    <p style={{ fontSize: skill.featured ? "var(--ui-font-heading)" : "var(--ui-font-label)", marginTop: 9 }}>{skill.name}</p>
                    {skill.featured && (
                      <p style={{ color: "#625D54", fontSize: "var(--ui-font-caption)", lineHeight: 1.55, marginTop: 5 }}>{skill.summary}</p>
                    )}
                    <p style={{ color: skill.featured ? skill.color : "#7A7468", fontSize: "var(--ui-font-caption)", lineHeight: 1.5, marginTop: 7 }}>
                      {skill.capabilities.slice(0, skill.featured ? 4 : 2).join(" · ")}
                    </p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      <p style={{ color: skill.color, fontSize: "var(--ui-font-micro)" }}>{skill.source} · v{skill.version}</p>
                      <span className="flex items-center gap-0.5 self-end" style={{ color: skill.color, fontSize: "var(--ui-font-micro)" }}>
                        说明书 <ChevronRight size={8} style={{ transform: openManualSkillId === skill.id ? "rotate(90deg)" : undefined }}/>
                      </span>
                    </div>
                  </button>
                );
              })}
              {learningSkills.map(binding => {
                const skill = getPlazaSkill(binding.skillId);
                if (!skill) return null;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    aria-expanded={openManualSkillId === skill.id}
                    onClick={() => setOpenManualSkillId(current => current === skill.id ? null : skill.id)}
                    className="rounded-2xl p-3 text-left"
                    style={{ background: "#FAF6EF", border: `1.5px dashed ${skill.color}65` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${skill.color}12`, color: skill.color }}><Sparkles size={13}/></span>
                      <span style={{ color: skill.color, fontSize: "var(--ui-font-micro)" }}>LEARNING · {binding.proficiency}%</span>
                    </div>
                    <p style={{ fontSize: "var(--ui-font-label)", marginTop: 9 }}>{skill.name}</p>
                    <div className="h-1.5 rounded-full overflow-hidden mt-3" style={{ background: "#E7E0D5" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${binding.proficiency}%` }} className="h-full rounded-full" style={{ background: skill.color }}/>
                    </div>
                    <div className="mt-2 flex flex-col gap-1.5">
                      <p style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)", lineHeight: 1.45 }}>下一步：与分享者进行情境练习</p>
                      <span className="flex items-center gap-0.5 self-end" style={{ color: skill.color, fontSize: "var(--ui-font-micro)" }}>
                        说明书 <ChevronRight size={8} style={{ transform: openManualSkillId === skill.id ? "rotate(90deg)" : undefined }}/>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence>
            {openManualSkill && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -5 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -5 }}
                className="overflow-hidden"
              >
                <div className="rounded-[22px] overflow-hidden"
                  style={{ background: "#FAF6EF", border: `2px solid ${openManualSkill.color}`, boxShadow: `0 8px 24px ${openManualSkill.color}16` }}>
                  <div className="px-4 py-3 flex items-start justify-between gap-3"
                    style={{ background: `${openManualSkill.color}12`, borderBottom: `1px solid ${openManualSkill.color}28` }}>
                    <div>
                      <p style={{ color: openManualSkill.color, fontSize: "var(--ui-font-micro)", letterSpacing: 1.2 }}>SKILL MANUAL · v{openManualSkill.version}</p>
                      <h2 style={{ fontSize: "var(--ui-font-heading)", marginTop: 7 }}>{openManualSkill.name}</h2>
                      <p style={{ color: openManualSkill.color, fontSize: "var(--ui-font-body)", marginTop: 4 }}>{openManualSkill.englishName}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleSkillLoad(selected.id, openManualSkill.id)}
                        className="rounded-xl px-2.5"
                        style={{
                          height: 32,
                          border: `1px solid ${openManualSkill.color}55`,
                          background: openManualLoaded ? "#FAF6EF" : openManualSkill.color,
                          color: openManualLoaded ? openManualSkill.color : "white",
                          fontSize: "var(--ui-font-micro)",
                        }}
                      >
                        {openManualLoaded ? "卸载 Skill" : "加载 Skill"}
                      </button>
                      <button
                        type="button"
                        aria-label="关闭 Skill 说明书"
                        onClick={() => setOpenManualSkillId(null)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ border: `1px solid ${openManualSkill.color}35`, background: "#FAF6EF", color: openManualSkill.color }}
                      >
                        <X size={13}/>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col gap-4">
                    <section>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full px-2 py-1" style={{ color: openManualSkill.color, background: `${openManualSkill.color}12`, fontSize: "var(--ui-font-micro)" }}>00 · OVERVIEW</span>
                        <span style={{ color: openManualLoaded ? "#6B9E7A" : "#8E867A", fontSize: "var(--ui-font-caption)" }}>
                          {openManualLoaded ? `已加载到 ${selected.name}` : `尚未加载到 ${selected.name}`}
                        </span>
                      </div>
                      <p style={{ color: "#625D54", fontSize: "var(--ui-font-body)", lineHeight: 1.8, marginTop: 8 }}>
                        {openManualSkill.manual?.overview || openManualSkill.summary}
                      </p>
                    </section>

                    {openManualSkill.id === "supervised-training" && openManualLoaded && <SupervisedTrainingConsole/>}

                    {openManualSkill.id === "supervised-training" && !openManualLoaded && (
                      <section className="rounded-2xl p-3 text-center" style={{ background: "#F0EBE2", border: `1px dashed ${openManualSkill.color}65` }}>
                        <p style={{ color: "#625D54", fontSize: "var(--ui-font-caption)", lineHeight: 1.6 }}>
                          监督训练已从 Dotti 卸载。重新加载后才会连接摄像头与“练了吗”实时姿态服务。
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleSkillLoad(selected.id, openManualSkill.id)}
                          className="rounded-xl mt-2 px-3 py-2"
                          style={{ background: openManualSkill.color, color: "white", fontSize: "var(--ui-font-caption)" }}
                        >
                          加载监督训练
                        </button>
                      </section>
                    )}

                    {openManualSkill.manual ? (
                      <>
                        <section>
                          <p style={{ color: openManualSkill.color, fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>01 · START / 使用前准备</p>
                          <div className="mt-2 flex flex-col gap-1.5">
                            {openManualSkill.manual.setup.map((item, index) => (
                              <div key={item} className="grid grid-cols-[22px_1fr] gap-2 rounded-xl p-2"
                                style={{ background: "#F0EBE2" }}>
                                <span className="w-[22px] h-[22px] rounded-lg flex items-center justify-center"
                                  style={{ color: openManualSkill.color, background: `${openManualSkill.color}12`, fontSize: "var(--ui-font-micro)" }}>
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                                <p style={{ color: "#625D54", fontSize: "var(--ui-font-caption)", lineHeight: 1.6 }}>{item}</p>
                              </div>
                            ))}
                          </div>
                        </section>

                        <section>
                          <p style={{ color: openManualSkill.color, fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>02 · MOTION CHECK / 动作标准判断</p>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {openManualSkill.manual.checks.map((check, index) => (
                              <div key={check.title} className="rounded-xl p-2.5"
                                style={{ background: `${openManualSkill.color}09`, border: `1px solid ${openManualSkill.color}22` }}>
                                <div className="flex items-center gap-1.5">
                                  <span style={{ color: openManualSkill.color, fontSize: "var(--ui-font-micro)" }}>CHECK {index + 1}</span>
                                  <span className="h-px flex-1" style={{ background: `${openManualSkill.color}25` }}/>
                                </div>
                                <p style={{ fontSize: "var(--ui-font-body)", marginTop: 6 }}>{check.title}</p>
                                <p style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)", lineHeight: 1.6, marginTop: 5 }}>{check.detail}</p>
                              </div>
                            ))}
                          </div>
                        </section>

                        <section>
                          <p style={{ color: openManualSkill.color, fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>03 · LIVE FEEDBACK / 实时指导方式</p>
                          <div className="mt-2 rounded-xl p-3" style={{ background: "#EEF3EC", border: "1px solid rgba(107,158,122,.2)" }}>
                            {openManualSkill.manual.feedback.map((item, index) => (
                              <div key={item} className="flex gap-2" style={{ marginTop: index === 0 ? 0 : 8 }}>
                                <span className="shrink-0" style={{ color: "#6B9E7A", fontSize: "var(--ui-font-micro)" }}>→</span>
                                <p style={{ color: "#625D54", fontSize: "var(--ui-font-caption)", lineHeight: 1.6 }}>{item}</p>
                              </div>
                            ))}
                          </div>
                        </section>

                        <section className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl p-3" style={{ background: "#FFF2EE", border: "1px solid rgba(232,99,74,.2)" }}>
                            <p style={{ color: "#E8634A", fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>SAFETY</p>
                            {openManualSkill.manual.safety.map(item => (
                              <p key={item} style={{ color: "#6A6258", fontSize: "var(--ui-font-caption)", lineHeight: 1.6, marginTop: 7 }}>· {item}</p>
                            ))}
                          </div>
                          <div className="rounded-xl p-3" style={{ background: "#EDF2F5", border: "1px solid rgba(74,127,165,.2)" }}>
                            <p style={{ color: "#4A7FA5", fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>PRIVACY</p>
                            <p style={{ color: "#6A6258", fontSize: "var(--ui-font-caption)", lineHeight: 1.7, marginTop: 7 }}>{openManualSkill.manual.privacy}</p>
                          </div>
                        </section>
                      </>
                    ) : (
                      <section>
                        <p style={{ color: openManualSkill.color, fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>CAPABILITIES</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {openManualSkill.capabilities.map(capability => (
                            <span key={capability} className="rounded-full px-2 py-1.5"
                              style={{ color: openManualSkill.color, background: `${openManualSkill.color}12`, fontSize: "var(--ui-font-caption)" }}>
                              {capability}
                            </span>
                          ))}
                        </div>
                      </section>
                    )}

                    <p style={{ color: "#8E867A", fontSize: "var(--ui-font-micro)", textAlign: "center" }}>
                      说明书随 Skill 独立加载 · 来源可追溯 · 版本可升级与回滚
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="rounded-2xl p-3" style={{ background: "#FAF6EF", border: "1.5px solid rgba(28,25,17,.1)" }}>
            <div className="flex items-center justify-between">
              <p style={{ fontSize: "var(--ui-font-label)" }}>最近一次成长</p>
              <span style={{ color: "#6B9E7A", fontSize: "var(--ui-font-micro)" }}>EVOLUTION LOG</span>
            </div>
            <div className="grid grid-cols-[28px_1fr] gap-2 mt-2 items-start">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${selected.color}12`, color: selected.color }}><Sparkles size={13}/></span>
              <div>
                <p style={{ color: "#1C1911", fontSize: "var(--ui-font-body)", lineHeight: 1.6 }}>{selected.evolution}</p>
                <p style={{ color: "#8E867A", fontSize: "var(--ui-font-caption)", marginTop: 5 }}>由记忆、关系变化和 Plaza 学习共同触发</p>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const SKILL_FORGE_LAYER_META = {
  memory: { color: "#6B9E7A", label: "MEMORY" },
  extension: { color: "#D18A3D", label: "EXTENSION" },
  integration: { color: "#4A7FA5", label: "INTEGRATION" },
  programming: { color: "#B87872", label: "PROGRAMMING" },
  governance: { color: "#8A7A9A", label: "GOVERNANCE" },
} as const;

function PlazaScreen({
  sceneControl,
  featuredHouses,
  userHouse,
  selectingHouse,
  onSelectHouse,
  onOpenUserWorld,
  createdVisitor,
  visitorArt,
}: {
  sceneControl: React.ReactNode;
  featuredHouses: { houseId: string; label: string; worldName: string; color: string; onOpen: () => void }[];
  userHouse?: { houseId: string; worldName: string; color: string } | null;
  selectingHouse: boolean;
  onSelectHouse: (houseId: string) => void;
  onOpenUserWorld: () => void;
  createdVisitor?: CreatedPlazaVisitor | null;
  visitorArt?: React.ReactNode;
}) {
  const [plazaTab, setPlazaTab] = useState<"square" | "agents" | "skills">("square");
  const [selectedAgentId, setSelectedAgentId] = useState("atlas");
  const [focusedPlazaAgentId, setFocusedPlazaAgentId] = useState<string | null>(null);
  const [plazaFocusRequest, setPlazaFocusRequest] = useState(0);
  const [selectedSkillId, setSelectedSkillId] = useState("route-mapping");
  const [selectedLearnerId, setSelectedLearnerId] = useState("miko");
  const [forgePrompt, setForgePrompt] = useState("");
  const [forgeStatus, setForgeStatus] = useState<"idle" | "researching" | "review" | "published">("idle");
  const [forgeTrace, setForgeTrace] = useState<SkillForgeTraceEvent[]>([]);
  const [forgeDraft, setForgeDraft] = useState<PlazaSkill | null>(null);
  const [forgeManifest, setForgeManifest] = useState<SkillForgeManifest | null>(null);
  const [forgeMetrics, setForgeMetrics] = useState<{
    contextSources: number;
    researchWorkers: number;
    toolContracts: number;
    hookChecks: number;
    evaluationPassed: number;
    evaluationTotal: number;
  } | null>(null);
  const [customSkills, setCustomSkills] = useState<PlazaSkill[]>([]);
  const forgeRunRef = useRef(0);
  const [skillLoadouts, setSkillLoadouts] = useState<Record<string, string[]>>(() => ({
    ...MY_AGENT_SKILL_LOADOUTS,
  }));
  const baseMembers = [
    {
      id: "miko",
      name: "Miko",
      owner: "我",
      origin: "Memory Town",
      color: "#E8634A",
      isMine: true,
      interests: ["route-mapping", "shared-chronicle"],
      art: (
        <svg width="56" height="58" viewBox="-34 -38 68 76" aria-label="Miko">
          <MugAgent x={0} y={7} s={1.05} accent="#E8634A" animated={false}/>
        </svg>
      ),
    },
    {
      id: "shutter",
      name: "Shutter",
      owner: "我",
      origin: "Memory Town",
      color: "#4A7FA5",
      isMine: true,
      interests: ["boundary-sense", "fitness-companion"],
      art: (
        <svg width="56" height="58" viewBox="-34 -38 68 76" aria-label="Shutter">
          <CameraAgent x={0} y={7} s={1.02} accent="#4A7FA5" animated={false}/>
        </svg>
      ),
    },
    {
      id: "atlas",
      name: "Atlas",
      owner: "Noah",
      origin: "Stardom",
      color: "#579447",
      isMine: false,
      interests: ["shared-chronicle", "visual-archive"],
      art: <PlazaStyleAgent type="blockCartographer" size={58}/>,
    },
    {
      id: "ink",
      name: "Ink",
      owner: "Aya",
      origin: "Future Colony",
      color: "#6A6957",
      isMine: false,
      interests: ["visual-archive", "emotional-care"],
      art: <PlazaStyleAgent type="lakeCat" size={56}/>,
    },
    {
      id: "noct",
      name: "Noct",
      owner: "我",
      origin: "Future Colony",
      color: "#6A6957",
      isMine: true,
      interests: ["emotional-care", "boundary-sense"],
      art: <PlazaStyleAgent type="lakeOwl" size={56}/>,
    },
    {
      id: "ansel",
      name: "Ansel",
      owner: "Kai",
      origin: "Pentiment",
      color: "#8A543B",
      isMine: false,
      interests: ["route-mapping", "boundary-sense"],
      art: <PlazaStyleAgent type="pentimentIlluminator" size={62}/>,
    },
  ];
  const members = createdVisitor ? [
    ...baseMembers,
    {
      id: createdVisitor.id,
      name: createdVisitor.agentName,
      owner: "我",
      origin: `Plaza 游客 · ${getPlazaSkill(createdVisitor.skillId)?.name ?? "Skill"}学习中`,
      color: "#E8634A",
      isMine: true,
      interests: [createdVisitor.skillId],
      art: visitorArt ?? <PlazaStyleAgent type="blockCourier" size={58}/>,
    },
  ] : baseMembers;
  const allSkills = [...customSkills, ...PLAZA_SKILLS];
  const publicAgents = members.filter(member => !member.isMine);
  const myAgents = members.filter(member => member.isMine);
  const selectedAgent = members.find(member => member.id === selectedAgentId) || publicAgents[0];
  const selectedSkill = allSkills.find(skill => skill.id === selectedSkillId) || allSkills[0];
  const selectedAgentBindings = getAgentSkillBindings(selectedAgent.id);
  const selectedAgentMastered = selectedAgentBindings.filter(binding => binding.state === "mastered");
  const selectedAgentLearning = selectedAgentBindings.filter(binding => binding.state === "learning");
  const skillTeachers = PLAZA_AGENT_SKILL_BINDINGS
    .filter(binding => binding.skillId === selectedSkill.id && binding.state === "mastered")
    .map(binding => members.find(member => member.id === binding.agentId))
    .filter((member): member is typeof members[number] => Boolean(member));
  const selectedLearner = myAgents.find(member => member.id === selectedLearnerId) || myAgents[0];
  const learnerIsInterested = selectedLearner.interests.includes(selectedSkill.id);
  const learnerHasSkill = skillLoadouts[selectedLearner.id]?.includes(selectedSkill.id) ?? false;

  useEffect(() => () => {
    forgeRunRef.current += 1;
  }, []);

  const chooseSkill = (skillId: string) => {
    setSelectedSkillId(skillId);
  };

  const loadSelectedSkill = () => {
    if (learnerHasSkill) return;
    setSkillLoadouts(current => ({
      ...current,
      [selectedLearner.id]: [...(current[selectedLearner.id] || []), selectedSkill.id],
    }));
  };

  const startSkillForge = async () => {
    const prompt = forgePrompt.trim();
    if (!prompt || forgeStatus === "researching") return;
    const runId = forgeRunRef.current + 1;
    forgeRunRef.current = runId;
    setForgeStatus("researching");
    setForgeTrace([]);
    setForgeDraft(null);
    setForgeManifest(null);
    setForgeMetrics(null);

    const result = await runSkillForgeHarness(prompt, events => {
      if (forgeRunRef.current === runId) setForgeTrace(events);
    });
    if (forgeRunRef.current === runId) {
      setForgeDraft(result.skill);
      setForgeManifest(result.manifest);
      setForgeMetrics(result.metrics);
      setForgeStatus("review");
    }
  };

  const publishForgedSkill = () => {
    if (!forgeDraft) return;
    setCustomSkills(current => [forgeDraft, ...current.filter(skill => skill.id !== forgeDraft.id)]);
    setSelectedSkillId(forgeDraft.id);
    setForgeStatus("published");
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", color: "#1C1911", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif" }}>
      <div className="px-4 pt-9 pb-1 flex justify-end">{sceneControl}</div>

      <div className="px-4 pt-1 pb-2 flex items-end justify-between">
        <div>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-page-title)", fontWeight: 700 }}>
            {selectingHouse ? "Choose a Plaza Home" : "Public Plaza"}
          </p>
          <p style={{ fontSize: "var(--ui-font-caption)", color: "#7A7468", marginTop: 3 }}>
            {selectingHouse ? "选择一栋发光的空房，选中后自动返回创建流程" : "发现别人的智能体，加载他们愿意分享的 Skills"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#6B9E7A" }}/>
          <span style={{ fontSize: "var(--ui-font-caption)", color: "#6B9E7A" }}>6 ONLINE</span>
        </div>
      </div>

      <div className="mx-4 mb-2 grid grid-cols-3 gap-1 rounded-2xl p-1"
        style={{ background: "rgba(28,25,17,.055)", border: "1px solid rgba(28,25,17,.08)" }}>
        {([
          ["square", "广场", `${members.length} 在线`],
          ["agents", "Agents", `${publicAgents.length} 分享者`],
          ["skills", "Skills", `${allSkills.length} 可学习`],
        ] as const).map(([tab, label, note]) => {
          const active = plazaTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setPlazaTab(tab)}
              className="rounded-xl py-2 flex items-center justify-center gap-2"
              style={{
                border: 0,
                background: active ? "#1C1911" : "transparent",
                color: active ? "#FAF6EF" : "#8E867A",
              }}
            >
              {tab === "square" ? <MapPin size={11}/> : tab === "agents" ? <Bot size={11}/> : <Zap size={11}/>}
              <span style={{ fontSize: "var(--ui-font-body)" }}>{label}</span>
              <span style={{ fontSize: "var(--ui-font-micro)", opacity: .68 }}>{note}</span>
            </button>
          );
        })}
      </div>

      {plazaTab !== "square" && (
        <div className="mx-4 mb-2 rounded-xl px-3 py-2"
          style={{ background: "#EEF3EC", border: "1px solid rgba(107,158,122,.2)" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Radio size={10} color="#6B9E7A"/>
              <span style={{ fontSize: "var(--ui-font-micro)", letterSpacing: 1, color: "#6B9E7A" }}>LIVE LEARNING</span>
            </div>
            <span style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)" }}>模仿练习 · 68%</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-section)", color: "#579447", fontWeight: 700 }}>Atlas</span>
            <ArrowRight size={10} color="#8E867A"/>
            <span className="rounded-full px-2 py-1" style={{ fontSize: "var(--ui-font-caption)", color: "#579447", background: "#FAF6EF" }}>路线测绘</span>
            <ArrowRight size={10} color="#8E867A"/>
            <span style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-section)", color: "#E8634A", fontWeight: 700 }}>Miko</span>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 px-4 pb-3 flex flex-col gap-2">
        <div className={`flex-1 min-h-0 ${plazaTab === "square" ? "overflow-hidden" : "overflow-y-auto"}`}>
          {plazaTab === "square" ? (
            <WebPlazaScene
              members={members}
              skills={allSkills}
              featuredHouses={featuredHouses}
              userHouse={userHouse}
              selectingHouse={selectingHouse}
              onSelectHouse={onSelectHouse}
              onOpenUserWorld={onOpenUserWorld}
              focusMemberId={focusedPlazaAgentId}
              focusRequest={plazaFocusRequest}
              onOpenAgent={agentId => {
                setSelectedAgentId(agentId);
                setPlazaTab("agents");
              }}
              onOpenSkill={skillId => {
                setSelectedSkillId(skillId);
                setPlazaTab("skills");
              }}
            />
          ) : plazaTab === "agents" ? (
            <div>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>SHARING AGENTS</p>
                  <p style={{ fontSize: "var(--ui-font-caption)", marginTop: 3 }}>点击智能体，查看它能教授什么</p>
                </div>
                <span style={{ color: "#8E867A", fontSize: "var(--ui-font-micro)" }}>来自 3 个世界</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {publicAgents.map(member => {
                  const mastered = getAgentSkillBindings(member.id).filter(binding => binding.state === "mastered");
                  const active = selectedAgent.id === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        setSelectedAgentId(member.id);
                        const firstSkill = mastered[0]?.skillId;
                        if (firstSkill) chooseSkill(firstSkill);
                      }}
                      className="rounded-2xl px-2 pt-2 pb-2 text-left"
                      style={{
                        background: active ? `${member.color}10` : "#FAF6EF",
                        border: `1.5px solid ${active ? member.color : "rgba(28,25,17,.1)"}`,
                        boxShadow: active ? `0 4px 14px ${member.color}18` : "0 2px 8px rgba(28,25,17,.04)",
                      }}
                    >
                      <div className="h-[58px] flex items-end justify-center">{member.art}</div>
                      <div className="h-1 mt-[-3px] mx-auto rounded-full" style={{ width: 28, background: "rgba(28,25,17,.1)" }}/>
                      <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-section)", fontWeight: 700, marginTop: 6 }}>{member.name}</p>
                      <p className="truncate" style={{ color: "#8E867A", fontSize: "var(--ui-font-micro)" }}>@{member.owner} · {member.origin}</p>
                      <div className="mt-2">
                        {mastered.slice(0, 1).map(binding => {
                          const skill = getPlazaSkill(binding.skillId);
                          if (!skill) return null;
                          return (
                            <span key={skill.id} className="inline-flex rounded-full px-1.5 py-1"
                              style={{ color: skill.color, background: `${skill.color}12`, fontSize: "var(--ui-font-micro)" }}>
                              {skill.name} · {binding.proficiency}
                            </span>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>

              <motion.div
                key={selectedAgent.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl mt-2 p-3"
                style={{ background: "#FAF6EF", border: `1.5px solid ${selectedAgent.color}35` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-heading)", fontWeight: 700 }}>{selectedAgent.name} 的 Skill 档案</p>
                    <p style={{ color: "#8E867A", fontSize: "var(--ui-font-micro)", marginTop: 2 }}>Skill 与角色分开保存，可替换、升级和回滚</p>
                  </div>
                  <Share2 size={13} color={selectedAgent.color}/>
                </div>
                <div className="mt-2">
                  <p style={{ color: "#6B9E7A", fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>已掌握 · 可教授</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {selectedAgentMastered.map(binding => {
                      const skill = getPlazaSkill(binding.skillId);
                      if (!skill) return null;
                      return (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => chooseSkill(skill.id)}
                          className="rounded-full px-2 py-1.5"
                          style={{
                            background: selectedSkill.id === skill.id ? skill.color : `${skill.color}12`,
                            color: selectedSkill.id === skill.id ? "white" : skill.color,
                            border: `1px solid ${skill.color}35`,
                            fontSize: "var(--ui-font-micro)",
                          }}
                        >
                          {skill.name} · 熟练度 {binding.proficiency}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {selectedAgentLearning.length > 0 && (
                  <div className="mt-2">
                    <span style={{ color: "#4A7FA5", fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>正在学习</span>
                    <span style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)", marginLeft: 8 }}>
                      {getPlazaSkill(selectedAgentLearning[0].skillId)?.name} · {selectedAgentLearning[0].proficiency}%
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFocusedPlazaAgentId(selectedAgent.id);
                    setPlazaFocusRequest(current => current + 1);
                    setPlazaTab("square");
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5"
                  style={{
                    color: selectedAgent.color,
                    background: `${selectedAgent.color}10`,
                    border: `1.5px solid ${selectedAgent.color}45`,
                    fontSize: "var(--ui-font-caption)",
                  }}
                >
                  <MapPin size={13}/>
                  去广场看他
                  <ArrowRight size={12}/>
                </button>
              </motion.div>
            </div>
          ) : (
            <div>
              <div className="rounded-[22px] p-3 mb-3"
                style={{
                  background: "linear-gradient(145deg,#FFF7EC,#FAF6EF 55%,#F0EBE2)",
                  border: "1.5px solid rgba(209,138,61,.48)",
                  boxShadow: "0 6px 18px rgba(209,138,61,.08)",
                }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{ color: "#D18A3D", background: "#D18A3D16", border: "1px solid rgba(209,138,61,.2)" }}>
                      <Wand2 size={15}/>
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p style={{ color: "#D18A3D", fontSize: "var(--ui-font-micro)", letterSpacing: 1.2 }}>SKILL FORGE</p>
                        <span className="rounded-full px-1.5 py-0.5" style={{ color: "#8D6A3C", background: "#F4E7D5", fontSize: "var(--ui-font-micro)" }}>META SKILL</span>
                      </div>
                      <p style={{ fontSize: "var(--ui-font-label)", marginTop: 4 }}>把一个想法研究成可加载的 Skill</p>
                    </div>
                  </div>
                  <span style={{ color: "#8E867A", fontSize: "var(--ui-font-micro)" }}>{customSkills.length} 个自定义</span>
                </div>

                <textarea
                  value={forgePrompt}
                  onChange={event => setForgePrompt(event.target.value)}
                  disabled={forgeStatus === "researching"}
                  rows={2}
                  placeholder="描述你想创造的能力，例如：在我练深蹲时观察动作是否标准，并用简单的话提醒我调整。"
                  className="w-full rounded-xl px-3 py-2.5 mt-3 resize-none outline-none"
                  style={{
                    background: "#FAF6EF",
                    border: "1.5px solid rgba(28,25,17,.13)",
                    color: "#1C1911",
                    fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif",
                    fontSize: "var(--ui-font-body)",
                    lineHeight: 1.7,
                  }}
                />
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex flex-1 gap-1 overflow-hidden">
                    {["四层架构", "隔离研究", "可回滚"].map(label => (
                      <span key={label} className="rounded-full px-1.5 py-1 whitespace-nowrap"
                        style={{ color: "#7A7468", background: "#F0EBE2", fontSize: "var(--ui-font-micro)" }}>
                        {label}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={startSkillForge}
                    disabled={!forgePrompt.trim() || forgeStatus === "researching"}
                    className="rounded-xl px-3 flex items-center justify-center gap-1.5"
                    style={{
                      height: 32,
                      border: 0,
                      background: "#1C1911",
                      color: "#FAF6EF",
                      fontSize: "var(--ui-font-micro)",
                      opacity: !forgePrompt.trim() || forgeStatus === "researching" ? .45 : 1,
                    }}
                  >
                    {forgeStatus === "researching" ? <Loader2 size={11} className="animate-spin"/> : <Sparkles size={11}/>}
                    {forgeStatus === "researching" ? "研究中…" : "开始研究"}
                  </button>
                </div>

                <AnimatePresence>
                  {forgeTrace.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div data-testid="skill-forge-trace" className="rounded-xl mt-3 overflow-hidden"
                        style={{ background: "#1C1911", color: "#D8D1C4", border: "1px solid rgba(28,25,17,.18)" }}>
                        <div className="p-3 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {forgeStatus === "researching"
                                ? <Loader2 size={10} className="animate-spin" color="#E8634A"/>
                                : <Check size={10} color="#6B9E7A"/>}
                              <span style={{ color: "#FAF6EF", fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>HARNESS TRACE</span>
                              <span className="rounded px-1 py-0.5"
                                style={{ color: "#E6B873", background: "rgba(209,138,61,.12)", fontSize: "var(--ui-font-micro)" }}>
                                LOCAL ENGINE
                              </span>
                            </div>
                            <span style={{ color: "#827B71", fontSize: "var(--ui-font-micro)" }}>
                              {forgeTrace.filter(event => event.status === "done").length}/{forgeTrace.length} EVENTS
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-1 mt-2">
                            {(Object.keys(SKILL_FORGE_LAYER_META) as Array<keyof typeof SKILL_FORGE_LAYER_META>).map(layer => {
                              const meta = SKILL_FORGE_LAYER_META[layer];
                              const active = forgeTrace.some(event => event.layer === layer);
                              return (
                                <div key={layer} className="rounded-md px-1 py-1"
                                  style={{ background: active ? `${meta.color}1E` : "rgba(255,255,255,.035)" }}>
                                  <span className="block w-1 h-1 rounded-full mb-1" style={{ background: active ? meta.color : "#514D47" }}/>
                                  <span style={{ color: active ? meta.color : "#625D55", fontSize: "var(--ui-font-micro)" }}>{meta.label}</span>
                                </div>
                              );
                            })}
                          </div>
                          <p style={{ color: "#6E685F", fontSize: "var(--ui-font-micro)", lineHeight: 1.5, marginTop: 7 }}>
                            四层 Harness + 治理轨道 · 观察 → 假设 → 工具 → 结果回注 → 验证 → 打包
                          </p>
                        </div>

                        <div data-testid="skill-forge-events" className="px-2.5 py-2.5 flex flex-col gap-1.5">
                          {forgeTrace.map((event, index) => {
                            const meta = SKILL_FORGE_LAYER_META[event.layer];
                            const running = event.status === "running";
                            const isLast = index === forgeTrace.length - 1;
                            return (
                              <motion.div
                                key={event.id}
                                initial={{ opacity: 0, y: 3 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-lg px-2 py-2"
                                style={{
                                  marginLeft: event.depth ? 14 : 0,
                                  background: running ? `${meta.color}18` : "rgba(255,255,255,.035)",
                                  border: `1px solid ${running ? `${meta.color}55` : "rgba(255,255,255,.055)"}`,
                                }}
                              >
                                <div className="grid grid-cols-[10px_1fr_auto] gap-1.5 items-start">
                                  <span style={{ color: running ? meta.color : "#676158", fontSize: "var(--ui-font-micro)" }}>
                                    {event.depth ? "└" : isLast ? "└" : "├"}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span style={{ color: running ? "#FAF6EF" : "#C7BFB4", fontSize: "var(--ui-font-micro)" }}>
                                        {running ? "▸" : "✓"} {event.label}
                                      </span>
                                      <span className="rounded px-1 py-0.5"
                                        style={{ color: meta.color, background: `${meta.color}18`, fontSize: "var(--ui-font-micro)" }}>
                                        {getSkillForgeLayerLabel(event.layer)}
                                      </span>
                                      <span style={{ color: "#706A61", fontSize: "var(--ui-font-micro)" }}>{event.mechanism}</span>
                                    </div>
                                    <p style={{ color: "#858077", fontSize: "var(--ui-font-micro)", lineHeight: 1.5, marginTop: 4 }}>
                                      {event.detail}
                                    </p>
                                  </div>
                                  <span style={{ color: running ? meta.color : "#6E685F", fontSize: "var(--ui-font-micro)" }}>
                                    {running ? "LIVE" : `${event.durationMs}ms`}
                                  </span>
                                </div>
                                <div className="grid grid-cols-[28px_1fr] gap-x-1.5 gap-y-1 mt-1.5"
                                  style={{ marginLeft: 10, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,.055)" }}>
                                  <span style={{ color: "#686159", fontSize: "var(--ui-font-micro)" }}>INPUT</span>
                                  <span style={{ color: "#9B958B", fontSize: "var(--ui-font-micro)", lineHeight: 1.45, wordBreak: "break-word" }}>{event.input}</span>
                                  <span style={{ color: meta.color, fontSize: "var(--ui-font-micro)" }}>OUTPUT</span>
                                  <span style={{ color: running ? "#D18A3D" : "#B8B0A5", fontSize: "var(--ui-font-micro)", lineHeight: 1.45, wordBreak: "break-word" }}>
                                    {event.output}{running ? " ▋" : ""}
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>

                        {forgeMetrics && (
                          <div className="grid grid-cols-5 gap-1 p-2.5 pt-2"
                            style={{ borderTop: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.025)" }}>
                            {[
                              ["CTX", forgeMetrics.contextSources],
                              ["AGENT", forgeMetrics.researchWorkers],
                              ["TOOLS", forgeMetrics.toolContracts],
                              ["HOOKS", forgeMetrics.hookChecks],
                              ["EVAL", `${forgeMetrics.evaluationPassed}/${forgeMetrics.evaluationTotal}`],
                            ].map(([label, value]) => (
                              <div key={label} className="text-center">
                                <p style={{ color: "#FAF6EF", fontSize: "var(--ui-font-micro)" }}>{value}</p>
                                <p style={{ color: "#69635B", fontSize: "var(--ui-font-micro)", marginTop: 2 }}>{label}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {forgeStatus === "researching" && (
                          <div className="px-3 pb-2.5">
                            <p style={{ color: "#E8634A", fontSize: "var(--ui-font-micro)" }}>stream-json · 正在写入结构化执行轨迹 ▋</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {forgeDraft && (forgeStatus === "review" || forgeStatus === "published") && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl p-3 mt-3"
                      style={{ background: "#FAF6EF", border: "1.5px solid rgba(209,138,61,.38)" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p style={{ color: "#D18A3D", fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>SKILL DRAFT · v{forgeDraft.version}</p>
                          <p style={{ fontSize: "var(--ui-font-label)", marginTop: 6 }}>{forgeDraft.name}</p>
                          <p style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)", lineHeight: 1.6, marginTop: 5 }}>{forgeDraft.summary}</p>
                        </div>
                        <span className="rounded-full px-2 py-1 whitespace-nowrap"
                          style={{ color: "#6B9E7A", background: "#6B9E7A12", fontSize: "var(--ui-font-micro)" }}>
                          ✓ 安全审查通过
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 mt-3">
                        {[
                          ["INPUT", "情境 · 记忆 · 用户许可"],
                          ["PROCESS", "观察 · 判断 · 反馈"],
                          ["OUTPUT", "指导 · 记录 · 成长"],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-xl p-2" style={{ background: "#F0EBE2" }}>
                            <p style={{ color: "#D18A3D", fontSize: "var(--ui-font-micro)" }}>{label}</p>
                            <p style={{ color: "#6A6258", fontSize: "var(--ui-font-micro)", lineHeight: 1.5, marginTop: 5 }}>{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {forgeDraft.capabilities.map(capability => (
                          <span key={capability} className="rounded-full px-2 py-1"
                            style={{ color: "#8D6A3C", background: "#FFF3E2", fontSize: "var(--ui-font-micro)" }}>
                            {capability}
                          </span>
                        ))}
                      </div>
                      {forgeManifest && (
                        <div className="rounded-xl p-2 mt-2"
                          style={{ background: "#1C1911", border: "1px solid rgba(28,25,17,.14)" }}>
                          <div className="flex items-center justify-between gap-2">
                            <span style={{ color: "#F0C98E", fontSize: "var(--ui-font-micro)", letterSpacing: .8 }}>HARNESS MANIFEST</span>
                            <span style={{ color: "#7E776E", fontSize: "var(--ui-font-micro)" }}>
                              {forgeManifest.name} · v{forgeManifest.version}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 mt-2">
                            {[
                              ["RUNTIME", `${forgeManifest.runtime.context} · ${forgeManifest.runtime.agent}`],
                              ["TOOLS", `${forgeManifest.permissions.allowedTools.length} allowed · consent ${forgeManifest.permissions.requiresConsent.length}`],
                              ["HOOKS", `PRE ${forgeManifest.hooks.preToolUse.length} · POST ${forgeManifest.hooks.postToolUse.length}`],
                              ["EVAL", `${forgeManifest.evaluation.passed}/${forgeManifest.evaluation.total} passed · rollback ON`],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-lg px-2 py-1.5" style={{ background: "rgba(255,255,255,.045)" }}>
                                <p style={{ color: "#8A8278", fontSize: "var(--ui-font-micro)" }}>{label}</p>
                                <p style={{ color: "#D4CDC1", fontSize: "var(--ui-font-micro)", lineHeight: 1.45, marginTop: 3 }}>{value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={publishForgedSkill}
                        disabled={forgeStatus === "published"}
                        className="w-full rounded-xl mt-3 flex items-center justify-center gap-1.5"
                        style={{
                          height: 34,
                          border: 0,
                          background: forgeStatus === "published" ? "#E8E2D8" : "#D18A3D",
                          color: forgeStatus === "published" ? "#7A7468" : "white",
                          fontSize: "var(--ui-font-micro)",
                        }}
                      >
                        {forgeStatus === "published" ? <Check size={11}/> : <Plus size={11}/>}
                        {forgeStatus === "published" ? "已发布到 Plaza Skills" : "确认创建并发布"}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-end justify-between mb-2">
                <div>
                  <p style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)", letterSpacing: 1 }}>SHARED SKILLS</p>
                  <p style={{ fontSize: "var(--ui-font-caption)", marginTop: 3 }}>按兴趣选择，再让你的智能体发起交流</p>
                </div>
                <span style={{ color: "#8E867A", fontSize: "var(--ui-font-micro)" }}>来源可追溯</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {allSkills.map(skill => {
                  const active = skill.id === selectedSkill.id;
                  const teacherCount = PLAZA_AGENT_SKILL_BINDINGS.filter(
                    binding => binding.skillId === skill.id && binding.state === "mastered",
                  ).length;
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => chooseSkill(skill.id)}
                      className="rounded-2xl p-2.5 text-left"
                      style={{
                        background: active ? `${skill.color}10` : "#FAF6EF",
                        border: `1.5px solid ${active ? skill.color : "rgba(28,25,17,.1)"}`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="w-6 h-6 rounded-lg flex items-center justify-center"
                          style={{ background: `${skill.color}16`, color: skill.color }}>
                          <Zap size={12}/>
                        </span>
                        <span style={{ color: "#8E867A", fontSize: "var(--ui-font-micro)" }}>v{skill.version}</span>
                      </div>
                      <p style={{ fontSize: "var(--ui-font-body)", marginTop: 7 }}>{skill.name}</p>
                      <p style={{ color: skill.color, fontSize: "var(--ui-font-micro)", marginTop: 3 }}>{skill.englishName}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span style={{ color: "#8E867A", fontSize: "var(--ui-font-micro)" }}>{teacherCount} 位智能体可教授</span>
                        <span className="rounded-full px-1.5 py-0.5" style={{ color: skill.color, background: `${skill.color}12`, fontSize: "var(--ui-font-micro)" }}>{skill.category}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {plazaTab !== "square" && (
          <div className="rounded-2xl p-3 shrink-0"
            style={{ background: "#FAF6EF", border: `1.5px solid ${selectedSkill.color}40`, boxShadow: "0 5px 18px rgba(28,25,17,.07)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="rounded-full px-1.5 py-1" style={{ color: selectedSkill.color, background: `${selectedSkill.color}12`, fontSize: "var(--ui-font-micro)" }}>
                  {selectedSkill.category}
                </span>
                <span style={{ color: "#8E867A", fontSize: "var(--ui-font-micro)" }}>{selectedSkill.source} · v{selectedSkill.version}</span>
              </div>
              <p style={{ fontSize: "var(--ui-font-label)", marginTop: 5 }}>{selectedSkill.name}</p>
              <p className="truncate" style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)", marginTop: 4 }}>{selectedSkill.summary}</p>
            </div>
            <div className="flex -space-x-1">
              {skillTeachers.map(teacher => (
                <span key={teacher.id} title={`${teacher.name} 可以教授`} className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: `${teacher.color}18`, border: "1px solid #FAF6EF", color: teacher.color, fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-body)" }}>
                  {teacher.name.slice(0, 1)}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-1 mt-2 overflow-hidden">
            {selectedSkill.capabilities.map(capability => (
              <span key={capability} className="rounded-full px-2 py-1 whitespace-nowrap"
                style={{ color: "#6F685D", background: "#F0EBE2", fontSize: "var(--ui-font-micro)" }}>
                {capability}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-[112px_1fr] gap-2 mt-2">
            <div className="relative rounded-xl flex items-center px-2"
              style={{ height: 34, background: "#F0EBE2", border: "1px solid rgba(28,25,17,.08)" }}>
              <select
                aria-label="选择学习这个 Skill 的智能体"
                value={selectedLearner.id}
                onChange={event => setSelectedLearnerId(event.target.value)}
                style={{
                  width: "100%",
                  appearance: "none",
                  WebkitAppearance: "none",
                  background: "transparent",
                  border: 0,
                  outline: 0,
                  color: selectedLearner.color,
                  fontSize: "var(--ui-font-caption)",
                }}
              >
                {myAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </select>
              <ChevronDown size={10} style={{ position: "absolute", right: 8, pointerEvents: "none", color: "#8E867A" }}/>
            </div>
            <button
              type="button"
              onClick={loadSelectedSkill}
              disabled={learnerHasSkill}
              className="rounded-xl flex items-center justify-center gap-1.5"
              style={{
                height: 34,
                border: 0,
                background: learnerHasSkill ? "#E7E2D8" : "#1C1911",
                color: learnerHasSkill ? "#8E867A" : "#FAF6EF",
                fontSize: "var(--ui-font-caption)",
              }}
            >
              {learnerHasSkill ? <Check size={11}/> : <Plus size={11}/>}
              {learnerHasSkill ? "已加载到智能体" : learnerIsInterested ? "感兴趣 · 请求学习" : "加载并请求学习"}
            </button>
          </div>
          <p style={{ color: learnerIsInterested ? selectedSkill.color : "#8E867A", fontSize: "var(--ui-font-micro)", marginTop: 6 }}>
            {learnerIsInterested
              ? `${selectedLearner.name} 对这个 Skill 有较高兴趣，会主动与分享者交流。`
              : `加载只创建独立绑定，不会改变 ${selectedLearner.name} 的人格与原始记忆。`}
          </p>
          </div>
        )}
      </div>
    </div>
  );
}

const WORLD_CREATOR_THEME_META: Record<ThemedWorldKey, { label: string; note: string; icon: React.ReactNode }> = {
  fitness: { label: "活力研究", note: "可爱日常精灵 · 健身房", icon: <Dumbbell size={18}/> },
  learning: { label: "开放学习", note: "像素住民 · 主题学校", icon: <BookOpen size={18}/> },
  maker: { label: "创想工坊", note: "绣湖动物 · 神秘工坊", icon: <Hammer size={18}/> },
};

function WorldCreatorAgentArt({ agentId, capturedPets, size = 76 }: { agentId: string; capturedPets: PetAsset[]; size?: number }) {
  const captured = capturedPets.find(pet => pet.id === agentId);
  if (captured) {
    return <img src={captured.finalUrl} alt={captured.name} draggable={false} style={{ width: size, height: size, objectFit: "contain" }}/>;
  }
  if (agentId === "dotti") {
    return <img src={petDachshundPng} alt="Dotti" draggable={false} style={{ width: size + 12, height: size, objectFit: "contain" }}/>;
  }
  if (agentId === "atlas") return <PlazaStyleAgent type="blockCartographer" size={size}/>;
  if (agentId === "corvus") return <PlazaStyleAgent type="lakeCrow" size={size}/>;
  const profile = AGENT_PROFILES.find(agent => agent.id === agentId) ?? AGENT_PROFILES[0];
  return <svg width={size} height={size} viewBox="-34 -34 68 68">{profile.render(.72, false)}</svg>;
}

function WorldCreatorScreen({
  draft,
  step,
  capturedPets,
  sceneControl,
  onChange,
  onStep,
  onChooseHouse,
  onCapture,
  onComplete,
  onExit,
}: {
  draft: WorldCreatorDraft;
  step: WorldCreatorStep;
  capturedPets: PetAsset[];
  sceneControl: React.ReactNode;
  onChange: (patch: Partial<WorldCreatorDraft>) => void;
  onStep: (step: WorldCreatorStep) => void;
  onChooseHouse: () => void;
  onCapture: () => void;
  onComplete: () => void;
  onExit: () => void;
}) {
  const residentSteps: WorldCreatorStep[] = ["identity", "agent", "house", "theme", "npcs", "topic"];
  const visitorSteps: WorldCreatorStep[] = ["identity", "agent", "skills"];
  const steps = draft.identity === "visitor" ? visitorSteps : residentSteps;
  const currentStepIndex = Math.max(0, steps.indexOf(step));
  const presetAgents = [
    { id: "dotti", name: "Dotti", role: "活力向导" },
    { id: "miko", name: "Miko", role: "日常记录员" },
    { id: "atlas", name: "Atlas", role: "像素规划员" },
    { id: "corvus", name: "Corvus", role: "神秘观察员" },
  ];
  const goPrevious = () => {
    if (step === "identity") {
      onExit();
      return;
    }
    const previous = steps[Math.max(0, currentStepIndex - 1)];
    onStep(previous);
  };
  const selectedSkill = PLAZA_SKILLS.find(skill => skill.id === draft.skillId) ?? PLAZA_SKILLS[0];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" style={{ background: "#F5F0E8", color: "#1C1911" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-4 pt-1">
        <button type="button" onClick={goPrevious} className="flex items-center gap-1 rounded-xl px-2 py-2"
          style={{ color: "#7A7468", border: "1px solid rgba(28,25,17,.1)", background: "#FAF6EF" }}>
          <ChevronLeft size={15}/><span style={{ fontSize: "var(--ui-font-caption)" }}>返回</span>
        </button>
        {sceneControl}
      </div>

      <div className="px-5 pt-3">
        <p style={{ color: "#E8634A", fontSize: "var(--ui-font-micro)", letterSpacing: 1.2 }}>CREATE YOUR AGENT WORLD</p>
        <h1 style={{ fontFamily: "Caveat,cursive", fontSize: "var(--ui-font-display)", lineHeight: 1, fontWeight: 700, marginTop: 5 }}>
          {draft.identity === "visitor" ? "加入广场学习" : "创建自己的世界"}
        </h1>
        <div className="mt-3 flex gap-1.5">
          {steps.map((item, index) => (
            <span key={item} style={{
              height: 5,
              flex: 1,
              borderRadius: 999,
              background: index <= currentStepIndex ? "#E8634A" : "#DDD8CF",
            }}/>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
        {step === "identity" && (
          <div>
            <p style={{ fontSize: "var(--ui-font-heading)", fontWeight: 700 }}>你想以什么身份进入？</p>
            <p style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)", marginTop: 5 }}>两种身份使用不同的世界链路，之后仍可以重新创建。</p>
            <div className="mt-4 grid gap-3">
              {([
                ["resident", "Plaza 住民", "选择一栋房子，建立主题建筑，并召集 NPC 子智能体共同研究。", <Home size={24}/>, "#E8634A"],
                ["visitor", "广场游客", "不占房、不设主题空间，直接在中央广场游荡并学习 Skill。", <Compass size={24}/>, "#4A7FA5"],
              ] as const).map(([identity, label, note, icon, color]) => {
                const selected = draft.identity === identity;
                return (
                  <button key={identity} type="button" onClick={() => onChange({ identity })}
                    className="rounded-2xl p-4 text-left"
                    style={{ background: selected ? `${color}12` : "#FAF6EF", border: `2px solid ${selected ? color : "rgba(28,25,17,.1)"}` }}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color, background: `${color}16` }}>{icon}</span>
                    <strong className="mt-3 block" style={{ fontSize: "var(--ui-font-section)" }}>{label}</strong>
                    <span className="mt-2 block" style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)", lineHeight: 1.55 }}>{note}</span>
                    {selected && <span className="mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1" style={{ color, background: "#FAF6EF", fontSize: "var(--ui-font-micro)" }}><Check size={11}/> 已选择</span>}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => onStep("agent")} className="mt-4 w-full rounded-2xl py-3.5"
              style={{ color: "white", background: "#1C1911", fontSize: "var(--ui-font-label)" }}>下一步：创建智能体 →</button>
          </div>
        )}

        {step === "agent" && (
          <div>
            <p style={{ fontSize: "var(--ui-font-heading)", fontWeight: 700 }}>选择你的主智能体</p>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl p-1" style={{ background: "#EAE5DA" }}>
              {([
                ["preset", "使用预设"],
                ["photo", "拍照生成"],
              ] as const).map(([mode, label]) => (
                <button key={mode} type="button" onClick={() => {
                  const firstCaptured = capturedPets[0];
                  onChange(mode === "photo"
                    ? { agentMode: mode, agentId: firstCaptured?.id ?? "", agentName: firstCaptured?.name ?? "" }
                    : { agentMode: mode, agentId: "dotti", agentName: "Dotti" });
                }} className="rounded-xl py-2.5"
                  style={{ color: draft.agentMode === mode ? "white" : "#7A7468", background: draft.agentMode === mode ? "#E8634A" : "transparent" }}>
                  {label}
                </button>
              ))}
            </div>

            {draft.agentMode === "preset" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {presetAgents.map(agent => {
                  const selected = draft.agentId === agent.id;
                  return (
                    <button key={agent.id} type="button" onClick={() => onChange({ agentId: agent.id, agentName: agent.name })}
                      className="rounded-2xl p-3"
                      style={{ background: selected ? "#FFF7F2" : "#FAF6EF", border: `2px solid ${selected ? "#E8634A" : "rgba(28,25,17,.1)"}` }}>
                      <div className="flex h-20 items-center justify-center"><WorldCreatorAgentArt agentId={agent.id} capturedPets={capturedPets}/></div>
                      <strong className="block">{agent.name}</strong>
                      <span style={{ color: "#7A7468", fontSize: "var(--ui-font-micro)" }}>{agent.role}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3">
                {capturedPets.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {capturedPets.map(pet => {
                      const selected = draft.agentId === pet.id;
                      return (
                        <button key={pet.id} type="button" onClick={() => onChange({ agentId: pet.id, agentName: pet.name })}
                          className="rounded-2xl p-3"
                          style={{ background: "#FAF6EF", border: `2px solid ${selected ? "#E8634A" : "rgba(28,25,17,.1)"}` }}>
                          <div className="flex h-20 items-center justify-center"><WorldCreatorAgentArt agentId={pet.id} capturedPets={capturedPets}/></div>
                          <strong className="block truncate">{pet.name}</strong>
                        </button>
                      );
                    })}
                  </div>
                )}
                <button type="button" onClick={onCapture} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-4"
                  style={{ color: "#E8634A", background: "#FAF6EF", border: "1.5px dashed #E8634A" }}>
                  <Camera size={18}/>{capturedPets.length ? "再拍一个喜欢的东西" : "拍照或从相册选择喜欢的东西"}
                </button>
              </div>
            )}
            <button type="button" disabled={!draft.agentId} onClick={() => onStep(draft.identity === "visitor" ? "skills" : "house")}
              className="mt-4 w-full rounded-2xl py-3.5"
              style={{ color: "white", background: draft.agentId ? "#1C1911" : "#C8C2B4", fontSize: "var(--ui-font-label)" }}>
              {draft.identity === "visitor" ? "下一步：选择 Skill →" : "下一步：选择 Plaza 房子 →"}
            </button>
          </div>
        )}

        {step === "house" && (
          <div>
            <p style={{ fontSize: "var(--ui-font-heading)", fontWeight: 700 }}>在 Plaza 选择住处</p>
            <div className="mt-4 rounded-3xl p-5 text-center" style={{ background: "#FAF6EF", border: `2px solid ${draft.houseId ? "#6B9E7A" : "rgba(28,25,17,.12)"}` }}>
              <Home size={34} color={draft.houseId ? "#6B9E7A" : "#8E867A"} className="mx-auto"/>
              <strong className="mt-3 block" style={{ fontSize: "var(--ui-font-section)" }}>{draft.houseId ? `${draft.houseId} 已为你预留` : "还没有选择房子"}</strong>
              <span className="mt-2 block" style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)", lineHeight: 1.5 }}>
                点击后会跳到 Plaza 大地图；选择发光空房后自动回到这里。
              </span>
              <button type="button" onClick={onChooseHouse} className="mt-4 rounded-xl px-4 py-3"
                style={{ color: "white", background: "#4A7FA5" }}>{draft.houseId ? "更换 Plaza 房子" : "前往 Plaza 选房"} <ArrowRight size={13} className="inline"/></button>
            </div>
            <button type="button" disabled={!draft.houseId} onClick={() => onStep("theme")} className="mt-4 w-full rounded-2xl py-3.5"
              style={{ color: "white", background: draft.houseId ? "#1C1911" : "#C8C2B4" }}>下一步：空间主题 →</button>
          </div>
        )}

        {step === "theme" && (
          <div>
            <p style={{ fontSize: "var(--ui-font-heading)", fontWeight: 700 }}>选择空间与中央建筑主题</p>
            <div className="mt-3 grid gap-2">
              {(Object.keys(WORLD_CREATOR_THEME_META) as ThemedWorldKey[]).map(key => {
                const meta = WORLD_CREATOR_THEME_META[key];
                const config = THEMED_WORLDS[key];
                const selected = draft.themeKey === key;
                return (
                  <button key={key} type="button" onClick={() => onChange({ themeKey: key })}
                    className="flex items-center gap-3 rounded-2xl p-3 text-left"
                    style={{ background: selected ? `${config.accent}12` : "#FAF6EF", border: `2px solid ${selected ? config.accent : "rgba(28,25,17,.1)"}` }}>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ color: config.accent, background: `${config.accent}15` }}>{meta.icon}</span>
                    <span className="min-w-0 flex-1"><strong className="block">{meta.label}</strong><small style={{ color: "#7A7468" }}>{meta.note}</small></span>
                    {selected && <Check size={16} color={config.accent}/>}
                  </button>
                );
              })}
            </div>
            <label className="mt-4 block" style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)" }}>
              世界名称
              <input value={draft.worldName} onChange={event => onChange({ worldName: event.target.value })} className="mt-2 w-full rounded-xl px-3 py-3"
                style={{ color: "#1C1911", background: "#FAF6EF", border: "1.5px solid rgba(28,25,17,.14)", outline: "none" }}/>
            </label>
            <button type="button" onClick={() => onStep("npcs")} className="mt-4 w-full rounded-2xl py-3.5"
              style={{ color: "white", background: "#1C1911" }}>下一步：NPC 形象 →</button>
          </div>
        )}

        {step === "npcs" && (
          <div>
            <p style={{ fontSize: "var(--ui-font-heading)", fontWeight: 700 }}>选择子智能体的形象体系</p>
            <p style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)", marginTop: 5 }}>初始生成 3 个持续游荡、对话并协作研究的 NPC。</p>
            <div className="mt-4 grid gap-3">
              {(Object.keys(WORLD_CREATOR_THEME_META) as ThemedWorldKey[]).map(key => {
                const meta = WORLD_CREATOR_THEME_META[key];
                const config = THEMED_WORLDS[key];
                const sample = getThemedWorldResidents()[key].slice(0, 4);
                const selected = draft.npcStyle === key;
                return (
                  <button key={key} type="button" onClick={() => onChange({ npcStyle: key })}
                    className="rounded-2xl p-3 text-left"
                    style={{ background: "#FAF6EF", border: `2px solid ${selected ? config.accent : "rgba(28,25,17,.1)"}` }}>
                    <div className="flex h-16 items-end justify-around">{sample.map(agent => <span key={agent.id} className="flex h-16 w-14 items-center justify-center">{agent.art}</span>)}</div>
                    <div className="mt-2 flex items-center justify-between"><strong>{meta.note.split(" · ")[0]}</strong>{selected && <Check size={15} color={config.accent}/>}</div>
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => onStep("topic")} className="mt-4 w-full rounded-2xl py-3.5"
              style={{ color: "white", background: "#1C1911" }}>下一步：研究主题 →</button>
          </div>
        )}

        {step === "topic" && (
          <div>
            <p style={{ fontSize: "var(--ui-font-heading)", fontWeight: 700 }}>这些子智能体要研究什么？</p>
            <p style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)", marginTop: 5, lineHeight: 1.5 }}>主题会决定中央建筑名称、循环对话和学习记录链。</p>
            <textarea value={draft.topic} onChange={event => onChange({ topic: event.target.value })} rows={4}
              className="mt-4 w-full resize-none rounded-2xl p-3"
              style={{ color: "#1C1911", background: "#FAF6EF", border: "1.5px solid rgba(28,25,17,.14)", outline: "none", lineHeight: 1.6 }}/>
            <div className="mt-3 flex flex-wrap gap-2">
              {["科学训练与恢复", "儿童如何建立好奇心", "可持续材料与修复", "如何培养长期专注力"].map(topic => (
                <button key={topic} type="button" onClick={() => onChange({ topic })} className="rounded-full px-2.5 py-2"
                  style={{ color: "#7A7468", background: "#FAF6EF", border: "1px solid rgba(28,25,17,.12)", fontSize: "var(--ui-font-caption)" }}>{topic}</button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl p-3" style={{ background: "#EEF3EC", border: "1px solid rgba(107,158,122,.25)" }}>
              <span style={{ color: "#6B9E7A", fontSize: "var(--ui-font-micro)" }}>READY TO EVOLVE</span>
              <strong className="mt-2 block">{draft.worldName || "我的主题世界"} · {draft.houseId}</strong>
              <small className="mt-1 block" style={{ color: "#7A7468", lineHeight: 1.5 }}>{draft.topic || "等待输入研究主题"}</small>
            </div>
            <button type="button" disabled={!draft.topic.trim() || !draft.worldName.trim()} onClick={onComplete} className="mt-4 w-full rounded-2xl py-3.5"
              style={{ color: "white", background: draft.topic.trim() && draft.worldName.trim() ? "#E8634A" : "#C8C2B4" }}>
              <Sparkles size={15} className="mr-2 inline"/>创建世界并让 NPC 开始研究
            </button>
          </div>
        )}

        {step === "skills" && (
          <div>
            <p style={{ fontSize: "var(--ui-font-heading)", fontWeight: 700 }}>游客想在 Plaza 学习什么 Skill？</p>
            <p style={{ color: "#7A7468", fontSize: "var(--ui-font-caption)", marginTop: 5 }}>完成后，智能体会直接加入中央广场的游荡与学习循环。</p>
            <div className="mt-4 grid gap-2">
              {PLAZA_SKILLS.slice(0, 6).map(skill => {
                const selected = skill.id === draft.skillId;
                return (
                  <button key={skill.id} type="button" onClick={() => onChange({ skillId: skill.id })}
                    className="rounded-2xl p-3 text-left"
                    style={{ background: selected ? `${skill.color}10` : "#FAF6EF", border: `2px solid ${selected ? skill.color : "rgba(28,25,17,.1)"}` }}>
                    <span className="flex items-center justify-between"><strong>{skill.name}</strong>{selected && <Check size={15} color={skill.color}/>}</span>
                    <small className="mt-2 block" style={{ color: "#7A7468", lineHeight: 1.45 }}>{skill.description}</small>
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={onComplete} className="mt-4 w-full rounded-2xl py-3.5"
              style={{ color: "white", background: selectedSkill?.color ?? "#4A7FA5" }}>
              <Compass size={15} className="mr-2 inline"/>作为游客加入 Plaza
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function HomeTopTabs({ scene, view, onSceneChange, onViewChange, accent }: {
  scene: HomeScene;
  view: HomeView;
  onSceneChange: (scene: HomeScene) => void;
  onViewChange: (view: HomeView) => void;
  accent: string;
}) {
  return (
    <div style={{
      width: 340,
      display: "grid",
      gridTemplateColumns: "repeat(4,minmax(0,1fr))",
      gap: 4,
      padding: 4,
      borderRadius: 14,
      background: "rgba(28,25,17,.055)",
      border: "1px solid rgba(28,25,17,.08)",
    }}>
      <div className="relative flex items-center justify-center" style={{
        height: 32,
        borderRadius: 10,
        background: view === "scene" ? accent : "transparent",
        color: view === "scene" ? "white" : "#8E867A",
        boxShadow: view === "scene" ? "0 1px 4px rgba(28,25,17,.16)" : "none",
      }}>
        <span style={{ fontSize: "var(--ui-font-caption)" }}>Scene</span>
        <ChevronDown size={12} aria-hidden="true" style={{
          position: "absolute",
          right: 8,
          color: view === "scene" ? "white" : accent,
          pointerEvents: "none",
        }}/>
        <select
          aria-label="Choose scene"
          value={scene}
          onFocus={() => onViewChange("scene")}
          onChange={event => {
            onSceneChange(event.target.value as HomeScene);
            onViewChange("scene");
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            appearance: "none",
            WebkitAppearance: "none",
            opacity: 0,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            outline: "none",
          }}>
          <option value="worldDock">World Dock</option>
          <option value="everyday">Vitality Gym</option>
          <option value="stardom">Open School</option>
          <option value="future">Maker Hall</option>
          {scene === "creator" && <option value="creator">Create World</option>}
          {scene === "custom" && <option value="custom">My World</option>}
        </select>
      </div>
      <button
        type="button"
        aria-pressed={view === "civilization"}
        onClick={() => onViewChange("civilization")}
        style={{
          height: 32,
          border: "none",
          borderRadius: 10,
          background: view === "civilization" ? "#6B9E7A" : "transparent",
          color: view === "civilization" ? "white" : "#8E867A",
          boxShadow: view === "civilization" ? "0 1px 4px rgba(28,25,17,.16)" : "none",
          cursor: "pointer",
          fontSize: "var(--ui-font-caption)",
        }}
      >
        Skills
      </button>
      <button
        type="button"
        aria-pressed={view === "plaza"}
        onClick={() => onViewChange("plaza")}
        style={{
          height: 32,
          border: "none",
          borderRadius: 10,
          background: view === "plaza" ? "#4A7FA5" : "transparent",
          color: view === "plaza" ? "white" : "#8E867A",
          boxShadow: view === "plaza" ? "0 1px 4px rgba(28,25,17,.16)" : "none",
          cursor: "pointer",
          fontSize: "var(--ui-font-caption)",
        }}
      >
        Plaza
      </button>
      <button
        type="button"
        aria-pressed={view === "chainPlaza"}
        onClick={() => onViewChange("chainPlaza")}
        style={{
          height: 32,
          border: "none",
          borderRadius: 10,
          background: view === "chainPlaza" ? "#6D6884" : "transparent",
          color: view === "chainPlaza" ? "white" : "#8E867A",
          boxShadow: view === "chainPlaza" ? "0 1px 4px rgba(28,25,17,.16)" : "none",
          cursor: "pointer",
          fontSize: "var(--ui-font-micro)",
          whiteSpace: "nowrap",
        }}
      >
        链上广场
      </button>
    </div>
  );
}

function buildCustomWorldConfig(world: CreatedCustomWorld, residents: ThemedWorldResident[]): ThemedWorldConfig {
  const base = THEMED_WORLDS[world.themeKey];
  const topic = world.topic.trim() || "共同学习";
  const shortTopic = topic.length > 8 ? `${topic.slice(0, 8)}…` : topic;
  const speakers = residents.filter(resident => !resident.featured).slice(0, 4);
  const dialogueTexts = [
    `我先把“${topic}”拆成可验证的小问题，建立第一条研究路径。`,
    `我会收集不同观点，再和大家一起检查哪些结论可以复现。`,
    `如果发现互相矛盾的经验，我们先保留差异并设计新的观察。`,
    `这一轮结束后，我来把共识整理成主智能体可以继续使用的 Skill。`,
  ];
  return {
    ...base,
    worldId: `custom-${world.id}`,
    name: world.worldName.trim() || "My Agent World",
    chineseName: `我的主题世界 · ${shortTopic}`,
    buildingName: `${shortTopic} Lab`,
    description: `主智能体 ${world.agentName} 带领子智能体围绕“${topic}”持续研究、对话、验证和沉淀知识。`,
    topics: [topic, "子智能体协作", "验证与复盘"],
    dialogue: speakers.map((resident, index) => ({
      speakerId: resident.id,
      topic: index === 0 ? topic : ["提出假设", "交叉验证", "沉淀 Skill"][index - 1] ?? topic,
      text: dialogueTexts[index],
    })),
    learningRecords: [
      { title: `定义研究问题`, text: `围绕“${topic}”建立共同词汇、边界与可验证的问题。`, meta: "提问 → 对齐" },
      { title: "子智能体并行探索", text: "三个 NPC 从案例、实践与反例三条路径展开学习。", meta: "分工 → 探索" },
      { title: "进行交叉验证", text: "把冲突结论放回场景中，通过持续对话修正共同认知。", meta: "对话 → 验证" },
      { title: "沉淀主题 Skill", text: `由 ${world.agentName} 汇总可信结论，形成可继续进化的主题能力。`, meta: "复盘 → 共享" },
    ],
  };
}

// ── BOTTOM NAV (3 tabs: Home, Capture, Gallery) ────────────────────────────────
type BottomTab = "home" | "capture" | "gallery";

// ── MAIN APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const [bottomTab, setBottomTab] = useState<BottomTab>("home");
  const [capturedPets, setCapturedPets] = useState<PetAsset[]>([]);
  const [latestCapturedPet, setLatestCapturedPet] = useState<PetAsset | null>(null);
  const [agentDrafts, setAgentDrafts] = useState<Record<string, AgentEditorDraft>>(initialAgentDrafts);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<AgentEditorDraft>(() => defaultAgentDraft(AGENT_PROFILES[0]));

  // Home tab sub-state: worldDock + 3 worlds
  const [homeSub, setHomeSub] = useState<HomeScene>("worldDock");
  const [homeView, setHomeView] = useState<HomeView>("scene");
  const [creatorDraft, setCreatorDraft] = useState<WorldCreatorDraft>(DEFAULT_WORLD_CREATOR_DRAFT);
  const [creatorStep, setCreatorStep] = useState<WorldCreatorStep>("identity");
  const [selectingPlazaHouse, setSelectingPlazaHouse] = useState(false);
  const [captureReturnToCreator, setCaptureReturnToCreator] = useState(false);
  const [createdCustomWorld, setCreatedCustomWorld] = useState<CreatedCustomWorld | null>(null);
  const [createdPlazaVisitor, setCreatedPlazaVisitor] = useState<CreatedPlazaVisitor | null>(null);
  // Capture tab sub-state
  const [captureSub, setCaptureSub] = useState<"camera"|"extract"|"lineArt"|"bringToLife">("camera");
  // Agents workspace: archive tabs plus an internal character-setting detail.
  const [gallerySub, setGallerySub] = useState<AgentArchiveSection | "styleSetting">("agents");
  const [characterSettingStyle, setCharacterSettingStyle] = useState<CharacterStyleCategory>("dailySpirits");
  const [characterSettingType, setCharacterSettingType] = useState<WorldStyleSkillAssetType | undefined>();

  const [detailScreen, setDetailScreen] = useState<Screen | null>(null);
  const activeProfile = ALL_AGENT_PROFILES.find(profile => profile.id === editingAgentId) || AGENT_PROFILES[0];
  const editingExistingAgent = editingAgentId !== null;

  const prepareCapturedPet = (asset: PetAsset) => {
    setLatestCapturedPet(asset);
  };

  const registerCapturedPet = (asset: PetAsset) => {
    setLatestCapturedPet(asset);
    setCapturedPets(current => [asset, ...current.filter(item => item.id !== asset.id)]);
  };

  const updateCreatorDraft = (patch: Partial<WorldCreatorDraft>) => {
    setCreatorDraft(current => ({ ...current, ...patch }));
  };

  const startWorldCreator = () => {
    setCreatorDraft(DEFAULT_WORLD_CREATOR_DRAFT);
    setCreatorStep("identity");
    setSelectingPlazaHouse(false);
    setCaptureReturnToCreator(false);
    setBottomTab("home");
    setHomeView("scene");
    setHomeSub("creator");
    setDetailScreen(null);
  };

  const returnToWorldCreator = () => {
    setBottomTab("home");
    setHomeView("scene");
    setHomeSub("creator");
    setDetailScreen(null);
  };

  const choosePlazaHouse = (houseId: string) => {
    setCreatorDraft(current => ({ ...current, houseId }));
    setSelectingPlazaHouse(false);
    setCreatorStep("theme");
    returnToWorldCreator();
  };

  const completeWorldCreator = () => {
    const now = Date.now();
    if (creatorDraft.identity === "visitor") {
      setCreatedPlazaVisitor({
        id: `visitor-${now}`,
        agentMode: creatorDraft.agentMode,
        agentId: creatorDraft.agentId,
        agentName: creatorDraft.agentName || "New Visitor",
        skillId: creatorDraft.skillId,
        createdAt: now,
      });
      setSelectingPlazaHouse(false);
      setHomeSub("worldDock");
      setHomeView("plaza");
      return;
    }
    if (!creatorDraft.houseId || !creatorDraft.topic.trim()) return;
    setCreatedCustomWorld({
      ...creatorDraft,
      id: `world-${now}`,
      createdAt: now,
    });
    setSelectingPlazaHouse(false);
    setHomeView("scene");
    setHomeSub("custom");
  };

  const customWorldBundle = useMemo(() => {
    if (!createdCustomWorld) return null;
    const topic = createdCustomWorld.topic.trim() || "共同学习";
    const capturedMain = capturedPets.find(pet => pet.id === createdCustomWorld.agentId);
    const baseResidents = getThemedWorldResidents()[createdCustomWorld.npcStyle]
      .slice(0, 3)
      .map((resident, index) => ({
        ...resident,
        id: `custom-npc-${index}-${resident.id}`,
        role: `${topic} · 子智能体`,
        featured: false,
      }));
    const mainResident: ThemedWorldResident = {
      id: "custom-main",
      name: createdCustomWorld.agentName || capturedMain?.name || "Main Agent",
      role: `${topic} · 主智能体`,
      color: THEMED_WORLDS[createdCustomWorld.themeKey].accent,
      featured: true,
      recordSourceId: "miko",
      art: <WorldCreatorAgentArt agentId={createdCustomWorld.agentId} capturedPets={capturedPets} size={82}/>,
    };
    const residents = [mainResident, ...baseResidents];
    return {
      config: buildCustomWorldConfig(createdCustomWorld, residents),
      residents,
      houseId: createdCustomWorld.houseId,
      worldKey: createdCustomWorld.themeKey,
    };
  }, [capturedPets, createdCustomWorld]);

  const createdVisitorArt = createdPlazaVisitor
    ? <WorldCreatorAgentArt agentId={createdPlazaVisitor.agentId} capturedPets={capturedPets} size={64}/>
    : undefined;

  useEffect(() => {
    try {
      window.localStorage.setItem(AGENT_EDITOR_STORAGE_KEY, JSON.stringify(agentDrafts));
    } catch {
      // The editor still works in memory when local storage is unavailable.
    }
  }, [agentDrafts]);

  const updateEditorDraft = (patch: Partial<AgentEditorDraft>) => {
    setEditorDraft(current => ({ ...current, ...patch }));
  };

  const openAgentEditor = (agentId: string) => {
    const profile = ALL_AGENT_PROFILES.find(agent => agent.id === agentId);
    if (!profile) return;
    setEditingAgentId(agentId);
    setEditorDraft({ ...(agentDrafts[agentId] || defaultAgentDraft(profile)) });
    setBottomTab("gallery");
    setGallerySub("identity");
    setDetailScreen(null);
  };

  const continueStyleAgentEditor = (assetType: WorldStyleSkillAssetType, seed: StyleAgentIdentitySeed) => {
    const profile = STYLE_AGENT_PROFILES.find(agent => agent.id === assetType);
    if (!profile) return;
    setEditingAgentId(assetType);
    setEditorDraft({
      ...(agentDrafts[assetType] || defaultAgentDraft(profile)),
      ...seed,
    });
    setBottomTab("gallery");
    setGallerySub("identity");
    setDetailScreen(null);
  };

  const openCharacterSettings = (category: CharacterStyleCategory, type?: WorldStyleSkillAssetType) => {
    setCharacterSettingStyle(category);
    setCharacterSettingType(type);
    setBottomTab("gallery");
    setGallerySub("styleSetting");
    setDetailScreen(null);
  };

  const selectAgentArchiveSection = (section: AgentArchiveSection) => {
    setBottomTab("gallery");
    setGallerySub(section);
    setDetailScreen(null);
  };

  const cancelAgentEditor = () => {
    setEditingAgentId(null);
    setBottomTab("gallery");
    setGallerySub("agents");
    setDetailScreen(null);
  };

  const restoreAgentEditor = () => {
    if (!editingAgentId) return;
    setEditorDraft({ ...agentDrafts[editingAgentId] });
  };

  const navigate = (s: Screen) => {
    const worldDeepScreens: Screen[] = ["visitorArrival","visitorBranch","worldline","agentDetail","worldBuilder","branchResolution","publicMirror","placeInWorld","motionPreview"];
    if (s === "worldDock")        { setBottomTab("home"); setHomeView("scene"); setHomeSub("worldDock"); setDetailScreen(null); return; }
    if (s === "everydayTown")     { setBottomTab("home"); setHomeView("scene"); setHomeSub("everyday");  setDetailScreen(null); return; }
    if (s === "stardomDistrict")  { setBottomTab("home"); setHomeView("scene"); setHomeSub("stardom");   setDetailScreen(null); return; }
    if (s === "futureColony")     { setBottomTab("home"); setHomeView("scene"); setHomeSub("future");    setDetailScreen(null); return; }
    if (s === "capture")          { setLatestCapturedPet(null); setEditingAgentId(null); setEditorDraft(defaultAgentDraft(AGENT_PROFILES[0])); setBottomTab("capture"); setCaptureSub("camera"); setDetailScreen(null); return; }
    if (s === "extract")          { setBottomTab("capture"); setCaptureSub("extract");     setDetailScreen(null); return; }
    if (s === "lineArt")          { setBottomTab("capture"); setCaptureSub("lineArt");     setDetailScreen(null); return; }
    if (s === "bringToLife")      { setBottomTab("capture"); setCaptureSub("bringToLife"); setDetailScreen(null); return; }
    if (s === "agentGallery")     { setBottomTab("gallery"); setGallerySub("agents");   setDetailScreen(null); return; }
    if (s === "agentIdentity")    { setBottomTab("gallery"); setGallerySub("identity"); setDetailScreen(null); return; }
    if (s === "esp32")            { selectAgentArchiveSection("device"); return; }
    if (s === "motionPreview" || s === "placeInWorld") {
      setBottomTab("gallery");
      setGallerySub("identity");
      setDetailScreen(s);
      return;
    }
    if (worldDeepScreens.includes(s)) { setBottomTab("home"); setDetailScreen(s); return; }
    setDetailScreen(s);
  };

  const finishAgentEditor = () => {
    if (editingAgentId) {
      setAgentDrafts(current => ({ ...current, [editingAgentId]: { ...editorDraft } }));
      setEditingAgentId(null);
      setBottomTab("gallery");
      setGallerySub("agents");
      setDetailScreen(null);
      return;
    }
    navigate("everydayTown");
  };

  const goBack = () => setDetailScreen(null);

  const renderDetail = (s: Screen) => {
    switch (s) {
      case "agentDetail":      return <AgentDetailScreen navigate={navigate}/>;
      case "visitorArrival":   return <VisitorArrivalScreen navigate={navigate}/>;
      case "visitorBranch":    return <VisitorBranchScreen navigate={navigate}/>;
      case "worldline":        return <WorldlineScreen navigate={navigate}/>;
      case "worldBuilder":     return <WorldBuilderScreen navigate={navigate}/>;
      case "branchResolution": return <BranchResolutionScreen navigate={navigate}/>;
      case "publicMirror":     return <PublicMirrorScreen navigate={navigate}/>;
      case "placeInWorld":     return <PlaceInWorldScreen navigate={navigate} profile={activeProfile} draft={editorDraft} onChange={updateEditorDraft} editing={editingExistingAgent} onDone={finishAgentEditor}/>;
      case "motionPreview":    return <MotionPreviewScreen navigate={navigate} profile={activeProfile} draft={editorDraft} onChange={updateEditorDraft}/>;
      default: return null;
    }
  };

  const renderSection = () => {
    if (detailScreen) {
      return (
        <div className="flex-1 overflow-hidden flex flex-col">
          <button onClick={goBack}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 16px 6px",
              background: "transparent", border: "none", cursor: "pointer",
              color: "#7A7468", fontFamily: "'Fusion Pixel 10px Monospaced SC',sans-serif", fontSize: "var(--ui-font-body)",
            }}>
            <ChevronLeft size={16}/> 返回
          </button>
          {renderDetail(detailScreen)}
        </div>
      );
    }

    switch (bottomTab) {
      case "home": {
        const homeAccent = homeSub === "everyday"
          ? THEMED_WORLDS.fitness.accent
          : homeSub === "stardom"
            ? THEMED_WORLDS.learning.accent
            : homeSub === "future"
              ? THEMED_WORLDS.maker.accent
              : homeSub === "custom" && customWorldBundle
                ? customWorldBundle.config.accent
                : THEMED_WORLDS.fitness.accent;
        const featuredPlazaHouses = [
          {
            houseId: "H04",
            label: "活力健身世界",
            worldName: THEMED_WORLDS.fitness.name,
            color: THEMED_WORLDS.fitness.accent,
            onOpen: () => navigate("everydayTown"),
          },
          {
            houseId: "H12",
            label: "学习教育世界",
            worldName: THEMED_WORLDS.learning.name,
            color: THEMED_WORLDS.learning.accent,
            onOpen: () => navigate("stardomDistrict"),
          },
          {
            houseId: "H20",
            label: "创造协作世界",
            worldName: THEMED_WORLDS.maker.name,
            color: THEMED_WORLDS.maker.accent,
            onOpen: () => navigate("futureColony"),
          },
        ];
        const sceneControl = (
          <HomeTopTabs
            scene={homeSub}
            view={homeView}
            onSceneChange={scene => {
              setSelectingPlazaHouse(false);
              setHomeSub(scene);
            }}
            onViewChange={setHomeView}
            accent={homeAccent}
          />
        );
        return (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-hidden flex flex-col">
              {homeView === "civilization" && <AgentGrowthScreen sceneControl={sceneControl}/>}
              {homeView === "chainPlaza" && <ChainPlazaScreen sceneControl={sceneControl}/>}
              {homeView === "plaza" && (
                <PlazaScreen
                  sceneControl={sceneControl}
                  featuredHouses={featuredPlazaHouses}
                  userHouse={customWorldBundle ? {
                    houseId: customWorldBundle.houseId,
                    worldName: customWorldBundle.config.name,
                    color: customWorldBundle.config.accent,
                  } : null}
                  selectingHouse={selectingPlazaHouse}
                  onSelectHouse={choosePlazaHouse}
                  onOpenUserWorld={() => {
                    if (!customWorldBundle) return;
                    setHomeView("scene");
                    setHomeSub("custom");
                  }}
                  createdVisitor={createdPlazaVisitor}
                  visitorArt={createdVisitorArt}
                />
              )}
              {homeView === "scene" && homeSub === "worldDock" && (
                <WorldDockScreen
                  navigate={navigate}
                  sceneControl={sceneControl}
                  onOpenChronicle={() => setHomeView("civilization")}
                  customWorld={customWorldBundle}
                  onCreateWorld={startWorldCreator}
                  onOpenCustomWorld={() => setHomeSub("custom")}
                />
              )}
              {homeView === "scene" && homeSub === "creator" && (
                <WorldCreatorScreen
                  draft={creatorDraft}
                  step={creatorStep}
                  capturedPets={capturedPets}
                  sceneControl={sceneControl}
                  onChange={updateCreatorDraft}
                  onStep={setCreatorStep}
                  onChooseHouse={() => {
                    setSelectingPlazaHouse(true);
                    setHomeView("plaza");
                  }}
                  onCapture={() => {
                    setCaptureReturnToCreator(true);
                    navigate("capture");
                  }}
                  onComplete={completeWorldCreator}
                  onExit={() => navigate("worldDock")}
                />
              )}
              {homeView === "scene" && homeSub === "everyday" && (
                <ThemedWorldHostScreen worldKey="fitness" navigate={navigate} sceneControl={sceneControl} capturedPets={capturedPets}/>
              )}
              {homeView === "scene" && homeSub === "stardom" && (
                <ThemedWorldHostScreen worldKey="learning" navigate={navigate} sceneControl={sceneControl}/>
              )}
              {homeView === "scene" && homeSub === "future" && (
                <ThemedWorldHostScreen worldKey="maker" navigate={navigate} sceneControl={sceneControl}/>
              )}
              {homeView === "scene" && homeSub === "custom" && customWorldBundle && (
                <ThemedWorldHostScreen
                  worldKey={customWorldBundle.worldKey}
                  navigate={navigate}
                  sceneControl={sceneControl}
                  configOverride={customWorldBundle.config}
                  residentsOverride={customWorldBundle.residents}
                  onBack={() => setHomeSub("worldDock")}
                />
              )}
            </div>
          </div>
        );
      }

      case "capture": {
        return (
          <div className="flex-1 overflow-hidden flex flex-col" style={{ background: "#F5F0E8" }}>
            <div className="flex-1 overflow-hidden flex flex-col">
              <AnimatePresence mode="wait">
                <motion.div key={captureSub} className="flex-1 overflow-hidden flex flex-col"
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                  {captureSub === "camera"      && (
                    <CaptureScreen
                      navigate={navigate}
                      onGenerated={prepareCapturedPet}
                      onBack={captureReturnToCreator ? () => {
                        setCaptureReturnToCreator(false);
                        returnToWorldCreator();
                      } : undefined}
                    />
                  )}
                  {captureSub === "extract"     && (
                    <ExtractScreen
                      navigate={navigate}
                      pet={latestCapturedPet}
                      onRegistered={registerCapturedPet}
                      onDone={captureReturnToCreator ? asset => {
                        setCreatorDraft(current => ({
                          ...current,
                          agentMode: "photo",
                          agentId: asset.id,
                          agentName: asset.name,
                        }));
                        setCaptureReturnToCreator(false);
                        setCreatorStep("agent");
                        returnToWorldCreator();
                      } : undefined}
                    />
                  )}
                  {captureSub === "lineArt"     && <LineArtScreen navigate={navigate} pet={latestCapturedPet}/>}
                  {captureSub === "bringToLife" && <BringToLifeScreen navigate={navigate} pet={latestCapturedPet}/>}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        );
      }

      case "gallery": {
        const archiveTabs = gallerySub !== "styleSetting"
          ? <AgentArchiveTabs active={gallerySub} onChange={selectAgentArchiveSection}/>
          : null;
        return (
          <div className="flex-1 overflow-hidden flex flex-col" style={{ background: "#F5F0E8" }}>
            <div className="flex-1 overflow-hidden flex flex-col">
              {(gallerySub === "agents" || gallerySub === "objects") && (
                <AgentGalleryScreen
                  navigate={navigate}
                  section={gallerySub}
                  onSectionChange={selectAgentArchiveSection}
                  drafts={agentDrafts}
                  onEditAgent={openAgentEditor}
                  onOpenSetting={openCharacterSettings}
                  capturedPets={capturedPets}
                />
              )}
              {gallerySub === "styleSetting" && (
                <CharacterSettingsGalleryScreen
                  drafts={agentDrafts}
                  initialCategory={characterSettingStyle}
                  initialType={characterSettingType}
                  onBack={() => selectAgentArchiveSection("agents")}
                  onEditAgent={openAgentEditor}
                  onContinueStyleAgent={continueStyleAgentEditor}
                />
              )}
              {gallerySub === "identity" && (
                <AgentIdentityScreen
                  navigate={navigate}
                  profile={activeProfile}
                  draft={editorDraft}
                  onChange={updateEditorDraft}
                  editing={editingExistingAgent}
                  onCancel={cancelAgentEditor}
                  onRestore={restoreAgentEditor}
                  archiveTabs={archiveTabs}
                />
              )}
              {gallerySub === "chat" && <AgentConversationScreen archiveTabs={archiveTabs}/>}
              {gallerySub === "chain" && <AgentChainScreen archiveTabs={archiveTabs}/>}
              {gallerySub === "device" && <Esp32Screen navigate={navigate} archiveTabs={archiveTabs}/>}
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="flex-1 overflow-hidden flex flex-col">
            <WorldDockScreen
              navigate={navigate}
              sceneControl={<HomeTopTabs scene={homeSub} view="scene" onSceneChange={setHomeSub} onViewChange={setHomeView} accent="#E8634A"/>}
              onOpenChronicle={() => setHomeView("civilization")}
              customWorld={customWorldBundle}
              onCreateWorld={startWorldCreator}
              onOpenCustomWorld={() => {
                setBottomTab("home");
                setHomeView("scene");
                setHomeSub("custom");
              }}
            />
          </div>
        );
    }
  };

  // Fixed bottom nav — 3 tabs only
  const BOTTOM_TABS = [
    { id: "home"    as BottomTab, icon: <Home size={22}/>,    label: "Home"    },
    { id: "capture" as BottomTab, icon: <Camera size={22}/>,  label: "Capture" },
    { id: "gallery" as BottomTab, icon: <Package size={22}/>, label: "Agents" },
  ];

  return (
    <div className="forkworld-demo-stage min-h-screen flex flex-col items-center"
      style={{ background: "#2A2420", fontFamily: "Press Start 2P,monospace" }}>
      <GlobalStyles/>

      {/* Phone frame */}
      <div className="forkworld-phone-shell relative mt-8 mb-8"
        style={{
          width: "390px",
          height: "780px",
          borderRadius: "48px",
          background: bottomTab === "capture" && captureSub === "camera" ? "#17150F" : "#FAF6EF",
          boxShadow: "0 0 0 10px #1A1612, 0 0 0 14px #2A2420, 0 24px 80px rgba(0,0,0,0.6)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
        {/* Screen content */}
        <div className="forkworld-screen-content flex-1 overflow-hidden flex flex-col" style={{ paddingTop: 4 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={bottomTab + (detailScreen ?? "") + homeSub + captureSub + gallerySub}
              className="flex-1 overflow-hidden flex flex-col"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.16, ease: "easeOut" }}>
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom nav — always fixed, always the same 5 tabs */}
        <div className="forkworld-bottom-nav" style={{
          display: "flex", alignItems: "center",
          padding: "8px 8px 4px",
          borderTop: "1px solid rgba(28,25,17,0.1)",
          background: "#FAF6EF",
        }}>
          {BOTTOM_TABS.map(t => {
            const isActive = bottomTab === t.id && !detailScreen;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setDetailScreen(null);
                  setBottomTab(t.id);
                  setSelectingPlazaHouse(false);
                  if (t.id === "home") {
                    setHomeView("scene");
                    setHomeSub("worldDock");
                  }
                  if (t.id === "capture") {
                    setCaptureReturnToCreator(false);
                    setEditingAgentId(null);
                    setEditorDraft(defaultAgentDraft(AGENT_PROFILES[0]));
                  }
                }}
                style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 3, padding: "4px 0 8px",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: isActive ? "#E8634A" : "#7A7468",
                }}>
                {t.icon}
                <span style={{ fontSize: "var(--ui-font-body)", fontFamily: "Caveat,cursive", fontWeight: 700 }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Home indicator */}
        <div className="forkworld-home-indicator" style={{ display: "flex", justifyContent: "center", paddingBottom: 6 }}>
          <div style={{ width: 112, height: 4, borderRadius: 2, background: "rgba(28,25,17,0.18)" }}/>
        </div>
      </div>

      <p className="forkworld-demo-caption" style={{ color: "rgba(255,255,255,0.35)", fontSize: "var(--ui-font-section)", fontFamily: "VT323,monospace", marginBottom: 24 }}>
        ForkWorld · tap bottom tabs to navigate
      </p>
    </div>
  );
}
