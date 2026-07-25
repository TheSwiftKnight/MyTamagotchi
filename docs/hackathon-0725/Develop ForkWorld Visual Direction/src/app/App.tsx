import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Camera, Wand2, Sparkles, Play, MapPin, Grid3X3, BookOpen,
  Wifi, Share2, GitMerge, ChevronLeft, ChevronRight, Plus,
  Search, Star, Clock, Heart, Zap, Globe, Home, X, Check,
  Lock, Eye, Layers, ArrowRight, Radio, Cpu, Compass, Settings,
  Volume2, RotateCcw, Move, Trash2, Package, Music,
  Lightbulb, Headphones, Mic, Rocket, Telescope, Bot,
  Image as ImageIcon, Brush, Scissors, RotateCw, FlipHorizontal,
  ChevronDown, ChevronUp, ZoomIn, ZoomOut, Undo2
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Screen =
  | "worldDock" | "capture" | "extract" | "lineArt"
  | "bringToLife" | "agentIdentity" | "motionPreview" | "placeInWorld"
  | "worldBuilder" | "everydayTown" | "stardomDistrict" | "futureColony"
  | "agentDetail" | "visitorArrival" | "visitorBranch" | "worldline"
  | "agentGallery" | "esp32" | "publicMirror" | "branchResolution";

type WorldTheme = "everyday" | "stardom" | "future";

// ── World DNA ──────────────────────────────────────────────────────────────────
const DNA = {
  everyday: {
    name: "Everyday Memory Town",
    short: "Memory Town",
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
    name: "Stardom District",
    short: "Stardom",
    paper: "#FFF5F8",
    line: "#1C1911",
    a1: "#E8191A",
    a2: "#D4A800",
    a3: "#F090A0",
    road: "#E8D8DC",
    grass: "#F0E0E8",
    water: "#F5C8D8",
  },
  future: {
    name: "Future Colony",
    short: "Colony",
    paper: "#EAECF2",
    line: "#2A3048",
    a1: "#0070F3",
    a2: "#00C8F0",
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
  { id: "everydayTown",   label: "Memory Town",     icon: <Home size={12}/> },
  { id: "stardomDistrict",label: "Stardom",         icon: <Star size={12}/> },
  { id: "futureColony",   label: "Colony",          icon: <Rocket size={12}/> },
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
            fontFamily: "Caveat,cursive", fontSize: "22px", color: accent,
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
            fontFamily: "Caveat,cursive", fontSize: "22px", color: accent,
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

function EverydayTownSVG({ w = TOWN_MAP_W, h = 560 }: { w?: number; h?: number }) {
  const d = DNA.everyday;
  const P = TOWN_PANEL_W; // 390 — one panel width

  // Agents live in center panel (panel 1), anchors offset by P
  const agents = [
    { ax: 85  + P, ay: 175, wander: "wander1", dur: "22s", delay: "0s",    Agent: () => <MugAgent        x={0} y={0} s={1.1}  accent={d.a1}/>,   name: "Miko"    },
    { ax: 275 + P, ay: 145, wander: "wander2", dur: "18s", delay: "1.5s",  Agent: () => <CameraAgent     x={0} y={0} s={1.0}  accent={d.a3}/>,   name: "Shutter" },
    { ax: 95  + P, ay: 335, wander: "wander3", dur: "25s", delay: "3s",    Agent: () => <PlushAgent      x={0} y={0} s={1.0}  accent="#C890C0"/>, name: "Nana"    },
    { ax: 295 + P, ay: 310, wander: "wander4", dur: "20s", delay: "2s",    Agent: () => <BookAgent       x={0} y={0} s={0.95} accent={d.a3}/>,   name: "Folio"   },
    { ax: 145 + P, ay: 468, wander: "wander5", dur: "28s", delay: "0.5s",  Agent: () => <LampAgent       x={0} y={0} s={1.0}  accent={d.a2}/>,   name: "Luma"    },
    { ax: 305 + P, ay: 482, wander: "wander6", dur: "21s", delay: "4s",    Agent: () => <HeadphonesAgent x={0} y={0} s={0.95} accent={d.a3}/>,   name: "Beat"    },
  ];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ background: d.paper, display: "block" }}>

      {/* ── Panel 0 (left exploration zone, x: 0–390) ── */}
      <Flower x={30}  y={120} r={5}/> <Flower x={210} y={72}  r={4}/> <Flower x={338} y={280} r={5}/>
      <Flower x={72}  y={380} r={4}/> <Flower x={298} y={460} r={4}/> <Flower x={168} y={520} r={5}/>
      <GrassTuft x={55}  y={158}/> <GrassTuft x={188} y={110}/> <GrassTuft x={318} y={320}/>
      <GrassTuft x={82}  y={422}/> <GrassTuft x={252} y={498}/> <GrassTuft x={128} y={260}/>
      <ellipse cx={148} cy={310} rx={6} ry={2.5} fill="rgba(28,25,17,0.07)"/>
      <ellipse cx={290} cy={185} rx={5} ry={2}   fill="rgba(28,25,17,0.07)"/>
      {/* Subtle zone label */}
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

      {/* Wandering agents in center panel */}
      {agents.map(({ ax, ay, wander, dur, delay, Agent, name }) => (
        <g key={name} style={{ animation: `${wander} ${dur} ${delay} ease-in-out infinite` }}>
          <ellipse cx={ax} cy={ay + 14} rx={13} ry={4} fill="rgba(28,25,17,0.09)"/>
          <g transform={`translate(${ax},${ay})`}><Agent/></g>
        </g>
      ))}

      {/* ── Panel 2 (right exploration zone, x: 780–1170) ── */}
      <Flower x={40  + P*2} y={95}  r={5}/> <Flower x={200 + P*2} y={60}  r={4}/> <Flower x={348 + P*2} y={310} r={5}/>
      <Flower x={90  + P*2} y={460} r={4}/> <Flower x={268 + P*2} y={510} r={4}/> <Flower x={138 + P*2} y={180} r={5}/>
      <Flower x={315 + P*2} y={390} r={4}/> <Flower x={58 + P*2}  y={280} r={4}/>
      <GrassTuft x={72  + P*2} y={140}/> <GrassTuft x={210 + P*2} y={100}/> <GrassTuft x={335 + P*2} y={260}/>
      <GrassTuft x={55  + P*2} y={390}/> <GrassTuft x={222 + P*2} y={470}/> <GrassTuft x={308 + P*2} y={430}/>
      <GrassTuft x={168 + P*2} y={320}/> <GrassTuft x={375 + P*2} y={180}/>
      <ellipse cx={182 + P*2} cy={295} rx={6} ry={2.5} fill="rgba(28,25,17,0.07)"/>
      <ellipse cx={312 + P*2} cy={155} rx={5} ry={2}   fill="rgba(28,25,17,0.07)"/>
      {/* Subtle zone label */}
      <text x={P * 2.5} y={88} textAnchor="middle" fontFamily="Caveat,cursive" fontSize="14"
        fill="rgba(28,25,17,0.18)">east fields →</text>
    </svg>
  );
}

function StardomDistrictSVG({ w = 390, h = 560 }: { w?: number; h?: number }) {
  const d = DNA.stardom;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ background: d.paper }}>
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

      <Shadow x={110} y={178} rx={16}/>
      <Shadow x={270} y={225} rx={14}/>
      <Shadow x={115} y={358} rx={15}/>
      <Shadow x={290} y={388} rx={14}/>
      <Shadow x={168} y={488} rx={13}/>
      <Shadow x={315} y={502} rx={13}/>

      {/* Spotlight glow under stage agents */}
      <ellipse cx={110} cy={165} rx={40} ry={20} fill={d.a1} opacity="0.06"
        style={{ animation: "spotlightPulse 2.5s ease-in-out infinite" }}/>
      <ellipse cx={270} cy={210} rx={35} ry={18} fill={d.a2} opacity="0.08"
        style={{ animation: "spotlightPulse 2s 0.8s ease-in-out infinite" }}/>

      <MicAgent        x={110} y={158} s={1.1}/>
      <CameraAgent     x={270} y={200} s={1.0}  accent={d.a1}/>
      <HeadphonesAgent x={115} y={330} s={1.0}  accent={d.a1}/>
      <MugAgent        x={290} y={360} s={0.95} accent={d.a1}/>
      <MicAgent        x={168} y={460} s={0.95}/>
      <CameraAgent     x={315} y={478} s={0.9}  accent={d.a2}/>
    </svg>
  );
}

function FutureColonySVG({ w = 390, h = 560 }: { w?: number; h?: number }) {
  const d = DNA.future;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ background: d.paper }}>
      {/* Circuit-dot decorations */}
      {[[65,105],[318,78],[175,275],[342,335],[88,432],[278,492],[358,198],[48,315],[220,160],[150,400]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r={2.5} fill="none" stroke={d.a1} strokeWidth="0.8" opacity="0.4"/>
      ))}
      {/* Dashed energy lines */}
      <line x1={40}  y1={90}  x2={160} y2={90}  stroke={d.a1} strokeWidth="0.8" strokeDasharray="4,6" opacity="0.3"/>
      <line x1={230} y1={260} x2={380} y2={260} stroke={d.a2} strokeWidth="0.8" strokeDasharray="4,6" opacity="0.3"/>
      <line x1={60}  y1={410} x2={200} y2={410} stroke={d.a1} strokeWidth="0.8" strokeDasharray="4,6" opacity="0.3"/>

      <Shadow x={110} y={178} rx={16}/>
      <Shadow x={270} y={225} rx={14}/>
      <Shadow x={115} y={358} rx={15}/>
      <Shadow x={290} y={388} rx={14}/>
      <Shadow x={168} y={488} rx={13}/>
      <Shadow x={315} y={502} rx={13}/>

      <RocketAgent     x={110} y={158} s={1.1}/>
      <RobotAgent      x={270} y={200} s={1.0}/>
      <CameraAgent     x={115} y={330} s={1.0}  accent={d.a1}/>
      <LampAgent       x={290} y={360} s={0.95} accent={d.a2}/>
      <RocketAgent     x={168} y={460} s={0.95}/>
      <RobotAgent      x={315} y={478} s={0.9}/>
    </svg>
  );
}

// ── UI COMPONENTS ──────────────────────────────────────────────────────────────

function PhoneStatusBar({ world }: { world?: WorldTheme }) {
  const time = "9:41";
  return (
    <div className="flex items-center justify-between px-6 py-2 text-xs font-mono"
      style={{ fontFamily: "VT323, monospace", fontSize: "16px" }}>
      <span style={{ color: "#1C1911" }}>{time}</span>
      <div className="flex gap-1 items-center">
        <Wifi size={11}/>
        <div className="w-5 h-2.5 rounded-sm border border-current flex">
          <div className="w-3/4 bg-current rounded-sm"/>
        </div>
      </div>
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
          <span style={{ fontSize: "9px", fontFamily: "Press Start 2P,monospace", fontWeight: 600 }}>{t.label}</span>
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
        fontFamily: "Caveat, cursive",
        fontSize: "13px"
      }}>
      {text}
    </span>
  );
}

function PrivacyChip({ level }: { level: "public" | "host" | "never" }) {
  const map = {
    public: { label: "Visible to visitors", color: "#6B9E7A", icon: <Eye size={10}/> },
    host:   { label: "Host world only",     color: "#4A7FA5", icon: <Lock size={10}/> },
    never:  { label: "Never export",        color: "#E8634A", icon: <X size={10}/> },
  };
  const c = map[level];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
      style={{
        background: c.color + "18",
        color: c.color,
        border: `1px solid ${c.color}40`,
        fontFamily: "VT323, monospace",
        fontSize: "10px"
      }}>
      {c.icon} {c.label}
    </span>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-xs uppercase tracking-widest mb-2"
      style={{ fontFamily: "VT323,monospace", color: "#7A7468", fontSize: "15px" }}>
      {text}
    </p>
  );
}

// ── SCREENS ────────────────────────────────────────────────────────────────────

// 1. WORLD DOCK
function WorldDockScreen({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto"
      style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="px-5 pt-2 pb-3 flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: "Caveat,cursive", fontSize: "32px", fontWeight: 700, color: "#1C1911", lineHeight: 1 }}>
            ForkWorld
          </h1>
          <p style={{ fontSize: "16px", color: "#7A7468", fontFamily: "VT323,monospace" }}>
            6 agents · 18 memories · 2 visitors
          </p>
        </div>
        <button className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "#EAE5DA", border: "1.5px solid rgba(28,25,17,0.12)" }}>
          <Settings size={16} color="#7A7468"/>
        </button>
      </div>

      {/* World cards */}
      <div className="px-5 flex flex-col gap-3 pb-4">
        {/* Everyday Memory Town */}
        <button onClick={() => navigate("everydayTown")}
          className="relative rounded-2xl overflow-hidden text-left"
          style={{ border: "2px solid rgba(28,25,17,0.13)", boxShadow: "0 2px 12px rgba(28,25,17,0.08)" }}>
          <div style={{ background: "#F5F0E8", height: "140px", position: "relative", overflow: "hidden" }}>
            <EverydayTownSVG w={360} h={180}/>
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, transparent 50%, rgba(245,240,232,0.9) 100%)"
            }}/>
          </div>
          <div className="px-3.5 py-2.5" style={{ background: "#FAF6EF" }}>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700, color: "#1C1911" }}>
                  Everyday Memory Town
                </p>
                <div className="flex gap-2 mt-0.5">
                  <HandTag text="6 agents" color="#E8634A"/>
                  <HandTag text="12 memories" color="#6B9E7A"/>
                </div>
              </div>
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "#6B9E7A" }}/>
            </div>
          </div>
        </button>

        {/* Stardom District */}
        <button onClick={() => navigate("stardomDistrict")}
          className="relative rounded-2xl overflow-hidden text-left"
          style={{ border: "2px solid rgba(28,25,17,0.13)", boxShadow: "0 2px 12px rgba(28,25,17,0.08)" }}>
          <div style={{ background: "#FFF5F8", height: "110px", position: "relative", overflow: "hidden" }}>
            <StardomDistrictSVG w={360} h={150}/>
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, transparent 40%, rgba(255,245,248,0.9) 100%)"
            }}/>
          </div>
          <div className="px-3.5 py-2.5" style={{ background: "#FFF5F8" }}>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontFamily: "Caveat,cursive", fontSize: "18px", fontWeight: 700, color: "#1C1911" }}>
                  Stardom District
                </p>
                <div className="flex gap-2 mt-0.5">
                  <HandTag text="4 agents" color="#E8191A"/>
                  <HandTag text="1 visitor" color="#D4A800"/>
                </div>
              </div>
              <div className="w-3 h-3 rounded-full" style={{ background: "#E8191A", boxShadow: "0 0 6px #E8191A80" }}/>
            </div>
          </div>
        </button>

        {/* Future Colony */}
        <button onClick={() => navigate("futureColony")}
          className="relative rounded-2xl overflow-hidden text-left"
          style={{ border: "2px solid rgba(28,25,17,0.13)", boxShadow: "0 2px 12px rgba(28,25,17,0.08)" }}>
          <div style={{ background: "#EAECF2", height: "100px", position: "relative", overflow: "hidden" }}>
            <FutureColonySVG w={360} h={140}/>
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, transparent 30%, rgba(234,236,242,0.9) 100%)"
            }}/>
          </div>
          <div className="px-3.5 py-2.5" style={{ background: "#EAECF2" }}>
            <div className="flex items-center justify-between">
              <div>
                <p style={{ fontFamily: "Caveat,cursive", fontSize: "18px", fontWeight: 700, color: "#1C1911" }}>
                  Future Colony
                </p>
                <div className="flex gap-2 mt-0.5">
                  <HandTag text="5 agents" color="#0070F3"/>
                  <HandTag text="3 memories" color="#00C8F0"/>
                </div>
              </div>
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: "#0070F3" }}/>
            </div>
          </div>
        </button>
      </div>

      {/* Capture button */}
      <div className="px-5 pb-2">
        <button onClick={() => navigate("capture")}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#1C1911", color: "#FAF6EF" }}>
          <Camera size={18}/>
          <span style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700 }}>
            Capture New Object
          </span>
        </button>
        <p className="text-center mt-2" style={{ fontSize: "10px", color: "#7A7468", fontFamily: "Press Start 2P,monospace" }}>
          "Capture what you cherish. Let it become a resident of your world."
        </p>
      </div>
    </div>
  );
}

// 2. CAPTURE OBJECT
function CaptureScreen({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#1C1911" }}>
      <div className="flex items-center justify-between px-5 pt-10 pb-3">
        <button onClick={() => navigate("worldDock")} className="w-8 h-8 flex items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.12)" }}>
          <ChevronLeft size={18} color="white"/>
        </button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "22px", color: "white", fontWeight: 700 }}>
          Capture Object
        </p>
        <button className="w-8 h-8 flex items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.12)" }}>
          <ImageIcon size={16} color="white"/>
        </button>
      </div>

      {/* Viewfinder */}
      <div className="mx-5 rounded-2xl overflow-hidden relative" style={{ height: "340px", background: "#0A0A14" }}>
        {/* Grid overlay */}
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <line x1="33%" y1="0" x2="33%" y2="100%" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"/>
          <line x1="66%" y1="0" x2="66%" y2="100%" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"/>
          <line x1="0" y1="33%" x2="100%" y2="33%" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"/>
          <line x1="0" y1="66%" x2="100%" y2="66%" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"/>
          {/* Object guide */}
          <ellipse cx="50%" cy="48%" rx="30%" ry="36%"
            stroke="#E8634A" strokeWidth="1.5" fill="none" strokeDasharray="8,5"/>
          {/* Corner brackets */}
          {[[18,18],[82,18],[18,82],[82,82]].map(([x,y],i) => (
            <g key={i}>
              <line x1={`${x-4}%`} y1={`${y}%`} x2={`${x+4}%`} y2={`${y}%`} stroke="white" strokeWidth="2"/>
              <line x1={`${x}%`} y1={`${y-4}%`} x2={`${x}%`} y2={`${y+4}%`} stroke="white" strokeWidth="2"/>
            </g>
          ))}
        </svg>
        {/* Simulated object: mug */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
          <svg width="80" height="90" viewBox="0 0 80 90">
            <rect x="15" y="15" width="45" height="55" rx="6" fill="#C87848" stroke="#1C1911" strokeWidth="1.5"/>
            <path d="M60,30 Q75,30 75,45 Q75,60 60,60" fill="none" stroke="#1C1911" strokeWidth="2" strokeLinecap="round"/>
            <rect x="20" y="22" width="35" height="4" rx="2" fill="#A85828"/>
            <ellipse cx="37" cy="70" rx="22" ry="5" fill="#A85828"/>
          </svg>
        </div>
        {/* Privacy note */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-2.5"
          style={{ background: "rgba(0,0,0,0.5)" }}>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "9px", fontFamily: "Press Start 2P,monospace" }}>
            🔒 Only the selected object is retained. Background will not become public.
          </p>
        </div>
      </div>

      {/* Copy */}
      <p className="text-center mt-3 px-6" style={{ fontFamily: "Caveat,cursive", fontSize: "17px", color: "rgba(255,255,255,0.7)" }}>
        "Capture something you want to bring into your world."
      </p>

      {/* Capture button */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="w-12 h-12 rounded-xl overflow-hidden" style={{ background: "#333" }}>
          <svg width="48" height="48" viewBox="0 0 48 48">
            <rect x="4" y="10" width="40" height="28" rx="4" fill="#E8634A80"/>
          </svg>
        </div>
        <button onClick={() => navigate("extract")}
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: "white",
            border: "4px solid rgba(255,255,255,0.3)",
            boxShadow: "0 0 0 2px white"
          }}>
          <div className="w-15 h-15 rounded-full" style={{ background: "#1C1911", width: "60px", height: "60px" }}/>
        </button>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "#333" }}>
          <RotateCw size={20} color="white"/>
        </div>
      </div>

      {/* Recent thumbnails */}
      <div className="px-5 mt-4 flex gap-2">
        {["#E8634A","#4A7FA5","#6B9E7A","#D4A800","#C890C0"].map((c,i) => (
          <div key={i} className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden"
            style={{ border: i===0 ? "2px solid white" : "2px solid rgba(255,255,255,0.2)", background: "#333" }}>
            <svg width="48" height="48" viewBox="0 0 48 48">
              <rect x="8" y="8" width="32" height="32" rx="4" fill={c + "80"}/>
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. EXTRACT OBJECT
function ExtractScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [mode, setMode] = useState<"erase" | "restore">("erase");
  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("capture")} className="flex items-center gap-1" style={{ color: "#7A7468" }}>
          <ChevronLeft size={18}/> <span style={{ fontSize: "14px" }}>Back</span>
        </button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "22px", fontWeight: 700 }}>Extract Object</p>
        <button onClick={() => navigate("lineArt")} style={{ color: "#E8634A", fontFamily: "Caveat,cursive", fontSize: "17px", fontWeight: 700 }}>
          Next →
        </button>
      </div>

      {/* Before / After split */}
      <div className="mx-5 rounded-2xl overflow-hidden relative flex" style={{ height: "220px", gap: "2px" }}>
        <div className="flex-1 relative" style={{ background: "#DDD8CF" }}>
          <p className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#1C191180", color: "white", fontFamily: "VT323,monospace", fontSize: "16px" }}>ORIGINAL</p>
          <svg width="100%" height="100%" viewBox="0 0 170 220">
            {/* Kitchen background */}
            <rect x="0" y="0" width="170" height="220" fill="#8090A0"/>
            <rect x="20" y="80" width="130" height="80" fill="#606878"/>
            {/* Mug */}
            <rect x="55" y="90" width="60" height="70" rx="5" fill="#E8634A" stroke="#1C1911" strokeWidth="1.5"/>
            <path d="M115,110 Q135,110 135,135 Q135,160 115,160" fill="none" stroke="#1C1911" strokeWidth="2.5" strokeLinecap="round"/>
            <ellipse cx="85" cy="160" rx="30" ry="6" fill="#C84A2A"/>
          </svg>
        </div>
        <div className="flex-1 relative"
          style={{ background: "repeating-conic-gradient(#DDD8CF 0% 25%, #EAE5DA 0% 50%) 0 0 / 12px 12px" }}>
          <p className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "#6B9E7A80", color: "white", fontFamily: "VT323,monospace", fontSize: "16px" }}>ISOLATED</p>
          <svg width="100%" height="100%" viewBox="0 0 170 220">
            {/* Isolated mug */}
            <rect x="55" y="90" width="60" height="70" rx="5" fill="#E8634A" stroke="#1C1911" strokeWidth="2"/>
            <path d="M115,110 Q135,110 135,135 Q135,160 115,160" fill="none" stroke="#1C1911" strokeWidth="2.5" strokeLinecap="round"/>
            <ellipse cx="85" cy="160" rx="30" ry="6" fill="#C84A2A"/>
            {/* Edge glow */}
            <rect x="53" y="88" width="64" height="74" rx="6" fill="none" stroke="#E8634A" strokeWidth="1.5" strokeDasharray="3,2"/>
          </svg>
        </div>
      </div>

      {/* Tools */}
      <div className="px-5 mt-3">
        <SectionLabel text="Refinement tools"/>
        <div className="flex gap-2">
          {[
            { id: "erase", label: "Erase", icon: <Scissors size={14}/> },
            { id: "restore", label: "Restore", icon: <Brush size={14}/> },
          ].map(t => (
            <button key={t.id} onClick={() => setMode(t.id as "erase"|"restore")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl"
              style={{
                background: mode === t.id ? "#1C1911" : "#EAE5DA",
                color: mode === t.id ? "white" : "#7A7468",
                border: "1.5px solid rgba(28,25,17,0.12)"
              }}>
              {t.icon}
              <span style={{ fontFamily: "Caveat,cursive", fontSize: "15px" }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Transform controls */}
      <div className="px-5 mt-3">
        <SectionLabel text="Transform"/>
        <div className="flex gap-2">
          {[
            { label: "Crop", icon: <Scissors size={14}/> },
            { label: "Rotate", icon: <RotateCw size={14}/> },
            { label: "Flip", icon: <FlipHorizontal size={14}/> },
            { label: "Scale", icon: <ZoomIn size={14}/> },
          ].map(t => (
            <button key={t.label}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl"
              style={{ background: "#EAE5DA", border: "1.5px solid rgba(28,25,17,0.08)", color: "#7A7468" }}>
              {t.icon}
              <span style={{ fontSize: "16px", fontFamily: "VT323,monospace" }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Brush size slider */}
      <div className="px-5 mt-3">
        <SectionLabel text="Brush size"/>
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
        <button onClick={() => navigate("lineArt")}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#1C1911", color: "#FAF6EF" }}>
          <Wand2 size={16}/>
          <span style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700 }}>Transform to Line Art</span>
        </button>
      </div>
    </div>
  );
}

// 4. LINE-ART TRANSFORMATION
function LineArtScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [style, setStyle] = useState("Minimal Pen");
  const [progress, setProgress] = useState(75);

  const styles = ["Minimal Pen","Soft Pencil","Comic Line","Technical Draft","Childlike Doodle"];

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
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "22px", fontWeight: 700 }}>Line-Art Style</p>
        <button onClick={() => navigate("bringToLife")} style={{ color: "#E8634A", fontFamily: "Caveat,cursive", fontSize: "17px", fontWeight: 700 }}>
          Next →
        </button>
      </div>

      {/* Transformation stages */}
      <div className="px-5">
        <SectionLabel text="Transformation stages"/>
        <div className="flex gap-2">
          {[
            { label: "Photo", bg: "#E8634A40" },
            { label: "Sketch", bg: "#E8634A20" },
            { label: "Line", bg: "#E8634A10" },
            { label: "Clean", bg: "white" },
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
              <p className="text-center py-1" style={{ fontSize: "16px", fontFamily: "VT323,monospace", color: "#7A7468" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="mx-5 mt-3 rounded-2xl flex items-center justify-center"
        style={{ height: "180px", background: "#FAF6EF", border: "2px solid #E8634A30" }}>
        <svg width="140" height="160" viewBox="0 0 140 160">
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
        </svg>
      </div>

      {/* Progress */}
      <div className="px-5 mt-2">
        <div className="flex justify-between mb-1">
          <span style={{ fontSize: "16px", fontFamily: "VT323,monospace", color: "#7A7468" }}>Transform</span>
          <span style={{ fontSize: "16px", fontFamily: "VT323,monospace", color: "#E8634A" }}>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: "#E0D9CE" }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "#E8634A" }}/>
        </div>
      </div>

      {/* Style picker */}
      <div className="px-5 mt-3">
        <SectionLabel text="Style"/>
        <div className="flex flex-wrap gap-2">
          {styles.map(s => (
            <button key={s} onClick={() => { setStyle(s); setProgress(30); }}
              className="px-3 py-1.5 rounded-xl"
              style={{
                background: style === s ? "#1C1911" : "#EAE5DA",
                color: style === s ? "white" : "#7A7468",
                border: "1.5px solid rgba(28,25,17,0.1)",
                fontFamily: "Caveat,cursive",
                fontSize: "15px"
              }}>{s}</button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-4 mb-2">
        <button onClick={() => navigate("bringToLife")}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#1C1911", color: "#FAF6EF" }}>
          <Sparkles size={16}/>
          <span style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700 }}>Bring It to Life</span>
        </button>
      </div>
    </div>
  );
}

// 5. BRING IT TO LIFE
function BringToLifeScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [parts, setParts] = useState({ eyes: true, mouth: true, arms: true, legs: true, antennae: false });

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("lineArt")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "22px", fontWeight: 700 }}>Bring It to Life</p>
        <button onClick={() => navigate("agentIdentity")} style={{ color: "#E8634A", fontFamily: "Caveat,cursive", fontSize: "17px", fontWeight: 700 }}>Next →</button>
      </div>

      {/* Character canvas */}
      <div className="mx-5 rounded-2xl flex items-center justify-center relative"
        style={{ height: "240px", background: "#FAF6EF", border: "2px solid rgba(28,25,17,0.1)" }}>
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "#E8634A18", color: "#E8634A", fontFamily: "VT323,monospace", fontSize: "16px" }}>
            ✦ AI suggested
          </span>
        </div>
        <svg width="200" height="210" viewBox="0 0 200 210">
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
        </svg>
      </div>

      {/* Parts panel */}
      <div className="px-5 mt-3">
        <SectionLabel text="Body parts"/>
        <div className="grid grid-cols-5 gap-2">
          {(Object.entries(parts) as [keyof typeof parts, boolean][]).map(([key, val]) => (
            <button key={key} onClick={() => setParts(p => ({ ...p, [key]: !p[key] }))}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl"
              style={{
                background: val ? "#1C1911" : "#EAE5DA",
                color: val ? "white" : "#7A7468",
                border: "1.5px solid rgba(28,25,17,0.1)"
              }}>
              <span style={{ fontSize: "16px" }}>
                {key === "eyes" ? "👀" : key === "mouth" ? "😄" : key === "arms" ? "💪" : key === "legs" ? "🦵" : "📡"}
              </span>
              <span style={{ fontSize: "16px", fontFamily: "VT323,monospace", textTransform: "capitalize" }}>{key}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="mx-5 mt-3 rounded-xl px-3 py-2.5" style={{ background: "#4A7FA518", border: "1px solid #4A7FA540" }}>
        <p style={{ fontSize: "10px", color: "#4A7FA5", fontFamily: "Press Start 2P,monospace" }}>
          💡 The mug handle naturally becomes an arm. Eyes are placed on the front face. Legs emerge from the base.
        </p>
      </div>

      <div className="px-5 mt-3 mb-2">
        <button onClick={() => navigate("agentIdentity")}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#1C1911", color: "#FAF6EF" }}>
          <span style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700 }}>Set Identity</span>
          <ArrowRight size={16}/>
        </button>
      </div>
    </div>
  );
}

// 6. AGENT IDENTITY
function AgentIdentityScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [name, setName] = useState("Miko");
  const [role, setRole] = useState("Café Keeper");
  const [personality, setPersonality] = useState("Warm, hospitable, a little stubborn about coffee temperature");
  const [goal, setGoal] = useState("Keep the café cozy and everyone well-caffeinated");
  const [privacy, setPrivacy] = useState<"public" | "host" | "never">("public");

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("bringToLife")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "22px", fontWeight: 700 }}>Agent Identity</p>
        <button onClick={() => navigate("motionPreview")} style={{ color: "#E8634A", fontFamily: "Caveat,cursive", fontSize: "17px", fontWeight: 700 }}>Next →</button>
      </div>

      {/* Profile header */}
      <div className="flex items-center gap-4 px-5 mb-3">
        <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center"
          style={{ background: "#FAF6EF", border: "2px solid rgba(28,25,17,0.1)" }}>
          <MugAgent x={0} y={5} s={0.7} accent="#E8634A" animated={false}/>
        </div>
        <div>
          <input value={name} onChange={e => setName(e.target.value)}
            className="block text-2xl font-bold bg-transparent border-b-2 outline-none"
            style={{ fontFamily: "Caveat,cursive", borderColor: "#E8634A", color: "#1C1911", width: "140px" }}/>
          <p style={{ fontSize: "16px", color: "#7A7468", fontFamily: "VT323,monospace" }}>captured today</p>
        </div>
        <div className="ml-auto">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#E8634A18" }}>
            <Sparkles size={14} color="#E8634A"/>
          </div>
          <p style={{ fontSize: "8px", color: "#E8634A", fontFamily: "VT323,monospace", marginTop: "2px" }}>AI</p>
        </div>
      </div>

      {/* Fields */}
      <div className="px-5 flex flex-col gap-3">
        {[
          { label: "SOCIAL ROLE", value: role, set: setRole, placeholder: "e.g. Café Keeper" },
          { label: "PERSONALITY", value: personality, set: setPersonality, placeholder: "Describe their character..." },
          { label: "CURRENT GOAL", value: goal, set: setGoal, placeholder: "What are they working on?" },
        ].map(f => (
          <div key={f.label}>
            <SectionLabel text={f.label}/>
            <textarea value={f.value} onChange={e => f.set(e.target.value)}
              rows={f.label === "PERSONALITY" ? 2 : 1}
              className="w-full rounded-xl px-3 py-2.5 outline-none resize-none text-sm"
              style={{
                background: "#FAF6EF",
                border: "1.5px solid rgba(28,25,17,0.12)",
                fontFamily: "Press Start 2P,monospace",
                color: "#1C1911",
                fontSize: "14px"
              }}
            />
          </div>
        ))}

        {/* Ability & Fear */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "ABILITY", value: "Perfect espresso every time", color: "#6B9E7A" },
            { label: "FEAR", value: "Running out of oat milk", color: "#E8634A" },
          ].map(f => (
            <div key={f.label}>
              <SectionLabel text={f.label}/>
              <div className="rounded-xl px-3 py-2 text-xs"
                style={{ background: f.color + "18", border: `1.5px solid ${f.color}40`, fontFamily: "Press Start 2P,monospace", color: f.color }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>

        {/* Privacy */}
        <div>
          <SectionLabel text="VISITOR PRIVACY"/>
          <div className="flex flex-wrap gap-2">
            {(["public", "host", "never"] as const).map(p => (
              <button key={p} onClick={() => setPrivacy(p)}>
                <PrivacyChip level={p}/>
              </button>
            ))}
          </div>
          <p className="mt-1.5" style={{ fontSize: "10px", color: "#7A7468", fontFamily: "Press Start 2P,monospace" }}>
            Original photo stays private. Only the agent representation is shared.
          </p>
        </div>

        {/* AI suggestions */}
        <div>
          <SectionLabel text="AI SUGGESTIONS — confirm to apply"/>
          <div className="flex flex-wrap gap-2">
            {["Café Philosopher","Memory Keeper","Espresso Scholar","Morning Ritual Keeper"].map(s => (
              <button key={s} onClick={() => setRole(s)}
                className="px-3 py-1.5 rounded-xl"
                style={{
                  background: "#E8634A10",
                  border: "1px dashed #E8634A60",
                  color: "#E8634A",
                  fontFamily: "Caveat,cursive",
                  fontSize: "14px"
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
          <span style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700 }}>Preview Motion</span>
        </button>
      </div>
    </div>
  );
}

// 7. MOTION PREVIEW
function MotionPreviewScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [anim, setAnim] = useState("Idle");
  const [move, setMove] = useState("Walk");
  const animations = ["Idle","Walk","Look Around","Talk","Work","Sleep","React","Carry Item"];
  const movements = ["Walk","Hop","Roll","Float","Crawl","Cart"];

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("agentIdentity")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "22px", fontWeight: 700 }}>Motion Preview</p>
        <button onClick={() => navigate("placeInWorld")} style={{ color: "#E8634A", fontFamily: "Caveat,cursive", fontSize: "17px", fontWeight: 700 }}>Next →</button>
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
            <MugAgent x={0} y={0} s={1.4} accent="#E8634A"
              animated={true}
              action={anim === "Walk" ? "walk" : "idle"}/>
          </svg>
        </div>
        {/* Animation label */}
        <div className="absolute top-3 left-0 right-0 flex justify-center">
          <span className="px-3 py-1 rounded-full"
            style={{ background: "#E8634A18", color: "#E8634A", fontFamily: "Caveat,cursive", fontSize: "16px", fontWeight: 700 }}>
            {anim} · {move}
          </span>
        </div>
        {/* Walk path indicator */}
        {anim === "Walk" && (
          <div className="absolute bottom-14 left-4 right-4">
            <div style={{ height: "1px", borderTop: "2px dashed #E8634A60" }}/>
          </div>
        )}
      </div>

      {/* Animation modes */}
      <div className="px-5 mt-3">
        <SectionLabel text="Animation mode"/>
        <div className="flex flex-wrap gap-2">
          {animations.map(a => (
            <button key={a} onClick={() => setAnim(a)}
              className="px-3 py-1.5 rounded-xl"
              style={{
                background: anim === a ? "#E8634A" : "#EAE5DA",
                color: anim === a ? "white" : "#7A7468",
                fontFamily: "Caveat,cursive",
                fontSize: "15px"
              }}>{a}</button>
          ))}
        </div>
      </div>

      {/* Movement style */}
      <div className="px-5 mt-3">
        <SectionLabel text="Movement style"/>
        <div className="flex flex-wrap gap-2">
          {movements.map(m => (
            <button key={m} onClick={() => setMove(m)}
              className="px-3 py-1.5 rounded-xl"
              style={{
                background: move === m ? "#1C1911" : "#EAE5DA",
                color: move === m ? "white" : "#7A7468",
                fontFamily: "Caveat,cursive",
                fontSize: "15px"
              }}>{m}</button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-4 mb-2">
        <button onClick={() => navigate("placeInWorld")}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#1C1911", color: "#FAF6EF" }}>
          <MapPin size={16}/>
          <span style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700 }}>Place in World</span>
        </button>
      </div>
    </div>
  );
}

// 8. PLACE IN WORLD
function PlaceInWorldScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [mode, setMode] = useState<"living"|"static"|"building"|"esp32">("living");

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("motionPreview")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "22px", fontWeight: 700 }}>Place in World</p>
        <button onClick={() => navigate("everydayTown")} style={{ color: "#6B9E7A", fontFamily: "Caveat,cursive", fontSize: "17px", fontWeight: 700 }}>Done ✓</button>
      </div>

      {/* Map preview */}
      <div className="mx-5 rounded-2xl overflow-hidden relative"
        style={{ height: "200px", border: "2px solid rgba(28,25,17,0.12)" }}>
        <EverydayTownSVG w={350} h={280}/>
        {/* Drop target */}
        <div className="absolute" style={{ left: "44%", top: "54%", transform: "translate(-50%,-50%)" }}>
          <div className="w-12 h-12 rounded-full border-2 border-dashed animate-pulse flex items-center justify-center"
            style={{ borderColor: "#E8634A", background: "#E8634A18" }}>
            <span style={{ fontSize: "20px" }}>☕</span>
          </div>
        </div>
      </div>

      {/* Agent */}
      <div className="flex items-center gap-3 px-5 mt-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "#FAF6EF", border: "2px solid rgba(28,25,17,0.12)" }}>
          <svg width="40" height="40" viewBox="-20 -20 40 40">
            <MugAgent x={0} y={2} s={0.7} accent="#E8634A" animated={false}/>
          </svg>
        </div>
        <div>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "22px", fontWeight: 700, color: "#1C1911" }}>Miko</p>
          <p style={{ fontSize: "16px", color: "#7A7468", fontFamily: "VT323,monospace" }}>Café Keeper · Everyday Memory Town</p>
        </div>
      </div>

      {/* Agent type */}
      <div className="px-5 mt-3">
        <SectionLabel text="Object type"/>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "living", label: "Living Agent", desc: "Walks, works, socializes", icon: "🚶" },
            { id: "static", label: "Static Object", desc: "Decorates a place", icon: "🪑" },
            { id: "building", label: "Part of Building", desc: "Becomes a structure", icon: "🏠" },
            { id: "esp32", label: "ESP32 Familiar", desc: "Lives in your device", icon: "🤖" },
          ].map(t => (
            <button key={t.id} onClick={() => setMode(t.id as any)}
              className="rounded-xl p-3 text-left"
              style={{
                background: mode === t.id ? "#1C1911" : "#FAF6EF",
                border: `2px solid ${mode === t.id ? "#1C1911" : "rgba(28,25,17,0.1)"}`,
              }}>
              <p style={{ fontSize: "20px" }}>{t.icon}</p>
              <p style={{ fontFamily: "Caveat,cursive", fontSize: "16px", fontWeight: 700, color: mode === t.id ? "white" : "#1C1911" }}>{t.label}</p>
              <p style={{ fontSize: "10px", color: mode === t.id ? "rgba(255,255,255,0.7)" : "#7A7468", fontFamily: "Press Start 2P,monospace" }}>{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Drag instruction */}
      <div className="mx-5 mt-3 px-3 py-2.5 rounded-xl flex items-center gap-2"
        style={{ background: "#E8634A10", border: "1px dashed #E8634A60" }}>
        <Move size={16} color="#E8634A"/>
        <p style={{ fontSize: "10px", color: "#E8634A", fontFamily: "Press Start 2P,monospace" }}>
          Drag Miko onto the map near the café
        </p>
      </div>

      <div className="px-5 mt-4 mb-2">
        <button onClick={() => navigate("everydayTown")}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2"
          style={{ background: "#6B9E7A", color: "white" }}>
          <Check size={16}/>
          <span style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700 }}>Miko joins the world!</span>
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

  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
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
                fontSize: "16px",
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
          <text x="227" y="162" textAnchor="middle" fontSize="8" fontFamily="Caveat,cursive" fill="#E8634A" fontWeight="700">Library</text>
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
                fontFamily: "Caveat,cursive",
                fontSize: "15px"
              }}>{t}</button>
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

function CompatibilityDialog({ agent, onClose, onProfile }: {
  agent: AgentInfo; onClose: () => void; onProfile: () => void;
}) {
  const topScore = Math.max(...agent.compat.map(c => c.score));
  const bestMatch = agent.compat.find(c => c.score === topScore)!;

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
              <span style={{ fontFamily: "Caveat,cursive", fontSize: 24, fontWeight: 700, color: "#1C1911", lineHeight: 1 }}>
                {agent.name}
              </span>
              <span style={{
                fontSize: 11, fontFamily: "VT323,monospace",
                color: agent.color, background: agent.color + "18",
                border: `1px solid ${agent.color}30`,
                padding: "1px 7px", borderRadius: 99,
              }}>{agent.mood}</span>
            </div>
            <p style={{ fontFamily: "VT323,monospace", fontSize: 16, color: "#7A7468" }}>{agent.role}</p>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {agent.traits.map(t => (
                <span key={t} style={{
                  fontFamily: "Caveat,cursive", fontSize: 12,
                  color: "#7A7468", background: "#EAE5DA",
                  padding: "1px 8px", borderRadius: 99,
                }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Best match highlight */}
        <div style={{
          background: bestMatch.color + "0E",
          border: `1.5px solid ${bestMatch.color}28`,
          borderRadius: 14, padding: "10px 14px",
          marginBottom: 14,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>✨</span>
          <div>
            <p style={{ fontFamily: "Caveat,cursive", fontSize: 13, color: "#7A7468", lineHeight: 1 }}>最佳搭档</p>
            <p style={{ fontFamily: "Caveat,cursive", fontSize: 18, fontWeight: 700, color: bestMatch.color, lineHeight: 1.2 }}>
              {bestMatch.name} · {bestMatch.score}% 适配
            </p>
          </div>
        </div>

        {/* Compatibility bars */}
        <p style={{ fontFamily: "VT323,monospace", fontSize: 14, color: "#7A7468", letterSpacing: "0.08em", marginBottom: 10 }}>
          WORLD COMPATIBILITY
        </p>
        <div className="flex flex-col gap-2.5 mb-5">
          {agent.compat.map(c => (
            <div key={c.name} className="flex items-center gap-2">
              <span style={{ fontFamily: "Caveat,cursive", fontSize: 14, color: "#1C1911", width: 54, flexShrink: 0 }}>
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
              <span style={{ fontFamily: "VT323,monospace", fontSize: 15, color: c.color, width: 34, textAlign: "right", flexShrink: 0 }}>
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
              fontFamily: "Caveat,cursive", fontSize: 16, fontWeight: 700,
              border: "none", cursor: "pointer",
            }}>
            查看档案 →
          </button>
          <button
            onClick={onClose}
            style={{
              width: 46, borderRadius: 14,
              background: "#EAE5DA", color: "#7A7468",
              fontFamily: "Caveat,cursive", fontSize: 18,
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

// ── CHAT BUBBLE MESSAGES ──────────────────────────────────────────────────────
const AGENT_LINES = [
  // 0 Miko
  ["今天的咖啡特别香～", "有没有人要热水？", "来坐坐吧！", "我发现新配方了", "☕ 刚冲好一壶"],
  // 1 Shutter
  ["拍到了！", "光线不够好...", "这个角度完美", "记录今天的记忆", "📷 等我一下"],
  // 2 Nana
  ["抱抱？", "你今天很累吧", "我来陪你吧～", "一切都会好的", "🌸 摸摸头"],
  // 3 Folio
  ["第1024页了", "这段历史很有趣！", "我找到新线索", "请勿打扰·阅读中", "📚 等等等等"],
  // 4 Luma
  ["黑暗中我来引路", "今晚月色真好", "安静一点嘛～", "灯光调暗了", "🌙 嘘..."],
  // 5 Beat
  ["♪ ♫ ♪", "这个节奏不对！", "新曲子写好了", "跟着节拍走～", "🎵 听这段！"],
];

// Anchor positions matching EverydayTownSVG wander starts
const AGENT_ANCHORS = [
  { cx: 85,  cy: 175 }, // Miko
  { cx: 275, cy: 145 }, // Shutter
  { cx: 95,  cy: 335 }, // Nana
  { cx: 295, cy: 310 }, // Folio
  { cx: 145, cy: 468 }, // Luma
  { cx: 305, cy: 482 }, // Beat
];

// Town map pan constants — 3 side-scrollable panels
const TOWN_PANEL_W = 390;
const TOWN_PANELS  = 3;
const TOWN_MAP_W   = TOWN_PANEL_W * TOWN_PANELS; // 1170px

// Agent anchors in town world coordinate space (agents live in center panel = panel 1)
const AGENT_ANCHORS_WORLD = AGENT_ANCHORS.map(a => ({ cx: a.cx + TOWN_PANEL_W, cy: a.cy }));

type ChatBubble = { id: number; agentIdx: number; msg: string };

// ── BUILDING ASSETS ──────────────────────────────────────────────────────────
type BuildingType =
  // Everyday
  "cottage"|"cafe"|"tree"|"bench"|"mailbox"|"fountain"|"market"|"well" |
  // Medieval
  "castleTower"|"cathedral"|"tavern"|"blacksmith"|"gatehouse"|"windmill"|"marketCross"|"keepTower";
type BuildingCategory = "everyday" | "medieval";
interface PlacedBuilding { id: number; type: BuildingType; x: number; y: number; }

const INK = "#1C1911";
const PAPER = "#FAF6EF";
const P_WARM = "#F5F0E8";

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
  // Medieval
  { type: "castleTower", label: "城堡塔", category: "medieval", Asset: CastleTowerAsset },
  { type: "cathedral",   label: "大教堂", category: "medieval", Asset: CathedralAsset   },
  { type: "tavern",      label: "酒馆",   category: "medieval", Asset: TavernAsset      },
  { type: "blacksmith",  label: "铁匠铺", category: "medieval", Asset: BlacksmithAsset  },
  { type: "gatehouse",   label: "城门",   category: "medieval", Asset: GatehouseAsset   },
  { type: "windmill",    label: "风车",   category: "medieval", Asset: WindmillAsset    },
  { type: "marketCross", label: "市场柱", category: "medieval", Asset: MarketCrossAsset },
  { type: "keepTower",   label: "碉堡",   category: "medieval", Asset: KeepTowerAsset   },
];

function BuildingAsset({ type }: { type: BuildingType }) {
  const def = BUILDING_DEFS.find(d => d.type === type);
  return def ? <def.Asset/> : null;
}

// ── BUILD PALETTE ──────────────────────────────────────────────────────────────
const PALETTE_CATEGORIES: { id: BuildingCategory; label: string; accent: string }[] = [
  { id: "everyday", label: "日常",   accent: "#E8634A" },
  { id: "medieval", label: "中世纪", accent: "#2A4A6A" },
];

function BuildPalette({ onPlace, onClose }: {
  onPlace: (type: BuildingType) => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState<BuildingCategory>("everyday");
  const accent = PALETTE_CATEGORIES.find(c => c.id === cat)?.accent ?? "#E8634A";
  const filtered = BUILDING_DEFS.filter(d => d.category === cat);

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
        <p style={{ fontFamily:"Caveat,cursive", fontSize:20, fontWeight:700, color:INK }}>添加到城市</p>
        <button onClick={onClose} style={{ border:"none", background:"transparent", cursor:"pointer", color:"#7A7468" }}>
          <X size={18}/>
        </button>
      </div>

      {/* Category tabs */}
      <div style={{ display:"flex", gap:8, padding:"0 14px 12px" }}>
        {PALETTE_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)}
            style={{
              flex:1, padding:"7px 0", borderRadius:10,
              border: cat === c.id ? `1.8px solid ${c.accent}` : "1.5px solid rgba(28,25,17,0.12)",
              background: cat === c.id ? c.accent+"18" : "#F5F0E8",
              cursor:"pointer", transition:"all 0.15s",
            }}>
            <span style={{
              fontFamily:"Caveat,cursive", fontSize:15, fontWeight:700,
              color: cat === c.id ? c.accent : "#7A7468",
            }}>{c.label}</span>
          </button>
        ))}
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
            <span style={{ fontFamily:"Caveat,cursive", fontSize:12, fontWeight:700, color:"#5A5450" }}>{label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// 10. EVERYDAY MEMORY TOWN (Live City)
function EverydayTownScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const d = DNA.everyday;
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
  const dragRef = useRef<{ id: number; startClientX: number; startClientY: number; startWorldX: number; startWorldY: number } | null>(null);

  const placeBuilding = (type: BuildingType) => {
    const id = buildingCounter + 1;
    setBuildingCounter(id);
    setBuildings(prev => [...prev, { id, type, x: mapPanX + 160, y: 220 }]);
    setShowBuildPalette(false);
    setSelectedBuildingId(id);
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

  // Spawn chat bubbles on a staggered random schedule
  useEffect(() => {
    // Initial burst — stagger first appearances
    const initialTimers = AGENT_LINES.map((_, idx) =>
      setTimeout(() => spawnBubble(idx), idx * 600 + Math.random() * 400)
    );

    // Ongoing random chatter
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * AGENT_LINES.length);
      spawnBubble(idx);
    }, 1800 + Math.random() * 1200);

    return () => {
      initialTimers.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, []);

  function spawnBubble(agentIdx: number) {
    const lines = AGENT_LINES[agentIdx];
    const msg = lines[Math.floor(Math.random() * lines.length)];
    const id = ++bubbleId.current;
    setBubbles(prev => {
      // Max 3 bubbles visible at once; also deduplicate same agent
      const filtered = prev.filter(b => b.agentIdx !== agentIdx).slice(-2);
      return [...filtered, { id, agentIdx, msg }];
    });
    setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== id)), 2800);
  }

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
      {/* Top overlay */}
      <div className="flex items-center justify-between px-4 pt-9 pb-1">
        <div>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700, color: "#1C1911" }}>
            Memory Town
          </p>
          <p style={{ fontFamily: "VT323,monospace", fontSize: "16px", color: "#7A7468" }}>
            10:24 · Canon Branch · 1 visitor nearby
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowBuildPalette(true); setSelectedBuildingId(null); }}
            className="px-2.5 py-1 rounded-lg"
            style={{ background: "#EAE5DA", fontFamily: "Caveat,cursive", fontSize: "14px", color: "#7A7468" }}>
            Build
          </button>
          <button onClick={() => navigate("capture")}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#E8634A", color: "white" }}>
            <Plus size={16}/>
          </button>
        </div>
      </div>

      {/* World field — pannable horizontal map */}
      <div className="flex-1 relative" style={{ overflow: "hidden" }}>

        {/* Inner pannable canvas — 1170px wide */}
        <div style={{
          width: TOWN_MAP_W,
          height: "100%",
          position: "relative",
          transform: `translateX(-${mapPanX}px)`,
          transition: "transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)",
        }}>
          <EverydayTownSVG w={TOWN_MAP_W} h={560}/>

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
              const { cx: wcx, cy } = AGENT_ANCHORS_WORLD[agentIdx];
              const [ox, oy] = wanderOffsets[agentIdx] ?? [0, 0];
              const worldX = wcx + ox;
              const screenX = worldX - mapPanX; // to check left/right of screen center
              const agentColor = AGENT_DATA[agentIdx].color;
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
                    top: cy + oy - 66,
                    transform: onLeft ? "none" : "translateX(-100%)",
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
                    whiteSpace: "nowrap",
                  }}>
                    <span style={{ fontFamily: "Caveat,cursive", fontSize: 15, fontWeight: 700, color: "#1C1911", lineHeight: 1.3 }}>{msg}</span>
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

        {/* Deselect building on map tap */}
        <div style={{ position:"absolute", inset:0, zIndex:1, pointerEvents: selectedBuildingId ? "auto" : "none" }}
          onClick={() => setSelectedBuildingId(null)}/>
      </div>

      {/* Bottom quick actions */}
      <div className="flex items-center gap-2 px-4 pb-2 pt-1"
        style={{ borderTop: "1px solid rgba(28,25,17,0.08)" }}>
        <button onClick={() => navigate("worldline")}
          className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: "#EAE5DA", fontFamily: "Caveat,cursive", fontSize: "15px", color: "#7A7468" }}>
          <Compass size={13}/> Worldline
        </button>
        <button onClick={() => navigate("visitorArrival")}
          className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: "#E8634A18", fontFamily: "Caveat,cursive", fontSize: "15px", color: "#E8634A" }}>
          <Globe size={13}/> Visitor!
        </button>
        <button onClick={() => navigate("agentGallery")}
          className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: "#EAE5DA", fontFamily: "Caveat,cursive", fontSize: "15px", color: "#7A7468" }}>
          <Package size={13}/> Gallery
        </button>
      </div>

      {/* ── Overlays: outside overflow:hidden map, absolute over full screen ── */}
      <AnimatePresence>
        {activeAgent && (
          <CompatibilityDialog
            agent={activeAgent}
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
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 11. STARDOM DISTRICT
function StardomDistrictScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const d = DNA.stardom;
  return (
    <div className="flex flex-col h-full" style={{ background: d.paper }}>
      <div className="flex items-center justify-between px-4 pt-9 pb-1">
        <div>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700, color: "#1C1911" }}>
            Stardom District
          </p>
          <p style={{ fontFamily: "VT323,monospace", fontSize: "16px", color: "#7A7468" }}>
            21:08 · Live Performance · Camera Archivist visiting →
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-2.5 py-1 rounded-lg"
            style={{ background: "#F8E8F0", fontFamily: "Caveat,cursive", fontSize: "14px", color: "#7A7468" }}>Build</button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#E8191A", color: "white" }}>
            <Plus size={16}/>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <StardomDistrictSVG w={390} h={560}/>
        <button onClick={() => navigate("visitorArrival")}
          className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-2xl"
          style={{
            background: "rgba(255,245,248,0.95)",
            border: "1.5px solid #E8191A40",
            animation: "visitorGlow 2s ease-in-out infinite"
          }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#E8191A" }}/>
          <span style={{ fontFamily: "Caveat,cursive", fontSize: "14px", color: "#E8191A" }}>Camera Archivist arriving</span>
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-2 pt-1"
        style={{ borderTop: "1px solid rgba(28,25,17,0.08)" }}>
        <button onClick={() => navigate("worldline")} className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: "#F8E8F0", fontFamily: "Caveat,cursive", fontSize: "15px", color: "#7A7468" }}>
          <Compass size={13}/> Worldline
        </button>
        <button onClick={() => navigate("visitorArrival")} className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: "#E8191A18", fontFamily: "Caveat,cursive", fontSize: "15px", color: "#E8191A" }}>
          <Globe size={13}/> Visitor ★
        </button>
        <button onClick={() => navigate("agentGallery")} className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: "#F8E8F0", fontFamily: "Caveat,cursive", fontSize: "15px", color: "#7A7468" }}>
          <Package size={13}/> Gallery
        </button>
      </div>
    </div>
  );
}

// 12. FUTURE COLONY
function FutureColonyScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const d = DNA.future;
  return (
    <div className="flex flex-col h-full" style={{ background: d.paper }}>
      <div className="flex items-center justify-between px-4 pt-9 pb-1">
        <div>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700, color: "#2A3048" }}>
            Future Colony
          </p>
          <p style={{ fontFamily: "VT323,monospace", fontSize: "16px", color: "#8090A8" }}>
            CYCLE 2184.07.22 · SECTOR 07 · 5 agents active
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-2.5 py-1 rounded-lg"
            style={{ background: "#C8D0DC", fontFamily: "Caveat,cursive", fontSize: "14px", color: "#8090A8" }}>Build</button>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: d.a1, color: "white" }}>
            <Plus size={16}/>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <FutureColonySVG w={390} h={560}/>
      </div>

      <div className="flex items-center gap-2 px-4 pb-2 pt-1"
        style={{ borderTop: "1px solid rgba(42,48,72,0.12)" }}>
        <button onClick={() => navigate("worldline")} className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: "#C8D0DC", fontFamily: "Caveat,cursive", fontSize: "15px", color: "#8090A8" }}>
          <Compass size={13}/> Worldline
        </button>
        <button onClick={() => navigate("agentGallery")} className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: "#C8D0DC", fontFamily: "Caveat,cursive", fontSize: "15px", color: "#8090A8" }}>
          <Package size={13}/> Gallery
        </button>
        <button className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5"
          style={{ background: `${d.a1}20`, fontFamily: "Caveat,cursive", fontSize: "15px", color: d.a1 }}>
          <Zap size={13}/> Energy
        </button>
      </div>
    </div>
  );
}

// 13. AGENT DETAIL
function AgentDetailScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [tab, setTab] = useState("state");
  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      {/* City behind */}
      <div className="relative" style={{ height: "260px", overflow: "hidden" }}>
        <EverydayTownSVG w={390} h={300}/>
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, transparent 40%, rgba(245,240,232,0.95) 100%)"
        }}/>
        <button onClick={() => navigate("everydayTown")}
          className="absolute top-10 left-4 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(250,246,239,0.9)", border: "1.5px solid rgba(28,25,17,0.12)" }}>
          <ChevronLeft size={16} color="#7A7468"/>
        </button>
      </div>

      {/* Bottom sheet */}
      <div className="flex-1 -mt-8 rounded-t-3xl overflow-y-auto"
        style={{ background: "#FAF6EF", border: "2px solid rgba(28,25,17,0.08)", boxShadow: "0 -4px 24px rgba(28,25,17,0.1)" }}>
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-3">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(28,25,17,0.15)" }}/>
        </div>

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
              <text x="28" y="60" textAnchor="middle" fontSize="7" fontFamily="VT323,monospace" fill="#7A7468">original</text>
            </svg>
          </div>
          <div>
            <p style={{ fontFamily: "Caveat,cursive", fontSize: "26px", fontWeight: 700, color: "#1C1911", lineHeight: 1 }}>Miko</p>
            <p style={{ fontSize: "16px", color: "#E8634A", fontFamily: "VT323,monospace" }}>Café Keeper</p>
            <p style={{ fontSize: "10px", color: "#7A7468", fontFamily: "Press Start 2P,monospace" }}>Near Café · Working</p>
            <p style={{ fontSize: "15px", color: "#7A7468", fontFamily: "VT323,monospace" }}>captured 3 days ago</p>
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
                fontFamily: "Caveat,cursive",
                fontSize: "14px"
              }}>{t}</button>
          ))}
        </div>

        {tab === "state" && (
          <div className="px-5 flex flex-col gap-2">
            {[
              { label: "NOTICED", text: "The café needs restocking. Headphones Agent is nearby.", color: "#4A7FA5" },
              { label: "CURRENT GOAL", text: "Brew fresh batch before the afternoon rush", color: "#E8634A" },
              { label: "NEXT ACTION", text: "Walk to storage room, return with supplies", color: "#6B9E7A" },
              { label: "NEW MEMORY", text: "A visitor left a note about Colombian roast", color: "#D4A800" },
            ].map(s => (
              <PaperCard key={s.label} className="px-3 py-2.5">
                <p style={{ fontSize: "16px", fontFamily: "VT323,monospace", color: s.color, marginBottom: "2px" }}>{s.label}</p>
                <p style={{ fontSize: "11px", color: "#1C1911", fontFamily: "Press Start 2P,monospace" }}>{s.text}</p>
              </PaperCard>
            ))}
          </div>
        )}

        {tab === "relationships" && (
          <div className="px-5 flex flex-col gap-2">
            {[
              { label: "Friends", agents: ["Book Librarian","Lamp Night Guide"], color: "#6B9E7A" },
              { label: "Moving closer to", agents: ["Headphones Broadcaster"], color: "#4A7FA5" },
              { label: "Tensions", agents: ["Camera Archivist (Visitor)"], color: "#E8634A" },
            ].map(r => (
              <div key={r.label}>
                <SectionLabel text={r.label}/>
                {r.agents.map(a => (
                  <div key={a} className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: r.color }}/>
                    <p style={{ fontSize: "11px", color: "#1C1911", fontFamily: "Press Start 2P,monospace" }}>{a}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {tab === "origin" && (
          <div className="px-5 flex flex-col gap-2">
            <PaperCard className="px-3 py-2.5">
              <SectionLabel text="Object origin"/>
              <p style={{ fontSize: "11px", color: "#1C1911", fontFamily: "Press Start 2P,monospace" }}>
                A ceramic coffee mug. Handle → arm. Front face → expression. Base → stable stance. Warmth → hospitable role.
              </p>
            </PaperCard>
            <PaperCard className="px-3 py-2.5">
              <SectionLabel text="Confirmed by user"/>
              <p style={{ fontSize: "11px", color: "#1C1911", fontFamily: "Press Start 2P,monospace" }}>
                Name: Miko · Role: Café Keeper · Ability: Perfect coffee every time
              </p>
            </PaperCard>
          </div>
        )}

        {tab === "privacy" && (
          <div className="px-5 flex flex-col gap-3">
            {[
              { label: "Agent appearance", level: "public" as const },
              { label: "Name & role", level: "public" as const },
              { label: "Personality details", level: "host" as const },
              { label: "Memory logs", level: "never" as const },
              { label: "Original photo", level: "never" as const },
            ].map(p => (
              <div key={p.label} className="flex items-center justify-between">
                <p style={{ fontSize: "11px", color: "#1C1911", fontFamily: "Press Start 2P,monospace" }}>{p.label}</p>
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
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
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
                  <p style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700, color: "#1C1911" }}>
                    Visitor Arrives
                  </p>
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#E8191A" }}/>
                </div>
                <p style={{ fontSize: "11px", color: "#1C1911", fontFamily: "Press Start 2P,monospace" }}>
                  <strong>Camera Archivist</strong> from{" "}
                  <span style={{ color: "#E8191A", fontWeight: 700 }}>Stardom District</span> arrived at the Station.
                </p>
                <p style={{ fontSize: "10px", color: "#7A7468", fontFamily: "Press Start 2P,monospace", marginTop: "4px" }}>
                  Keeps red lens symbol · adapted to local hand-drawn style · creates visitor branch
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: "#E8191A" }}/>
                  <span style={{ fontSize: "15px", color: "#E8191A", fontFamily: "VT323,monospace" }}>Stardom District</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => navigate("visitorBranch")}
                className="flex-1 py-2.5 rounded-xl"
                style={{ background: "#1C1911", color: "white", fontFamily: "Caveat,cursive", fontSize: "18px", fontWeight: 700 }}>
                Accept Visit
              </button>
              <button className="px-4 py-2.5 rounded-xl"
                style={{ background: "#EAE5DA", color: "#7A7468", fontFamily: "Caveat,cursive", fontSize: "18px" }}>
                Decline
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
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <div className="flex items-center justify-between px-4 pt-9 pb-1">
        <button onClick={() => navigate("everydayTown")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <div>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700, color: "#1C1911" }}>Visitor Branch</p>
          <p style={{ fontSize: "16px", fontFamily: "VT323,monospace", color: "#7A7468", textAlign: "center" }}>Camera Archivist · Stardom District</p>
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "#E8191A", fontFamily: "VT323,monospace", fontSize: "16px" }}>
          <div className="w-2 h-2 rounded-full" style={{ background: "#E8191A" }}/>
          Branch
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
            { x: 325, y: 248, label: "Arrived · Station" },
            { x: 250, y: 288, label: "Met Book Librarian" },
            { x: 185, y: 305, label: "Created Artifact ★" },
          ].map((e,i) => (
            <g key={i}>
              <circle cx={e.x} cy={e.y} r="6" fill="white" stroke="#E8191A" strokeWidth="1.5"/>
              <circle cx={e.x} cy={e.y} r="3" fill="#E8191A"/>
              <text x={e.x} y={e.y - 10} textAnchor="middle" fontSize="7"
                fontFamily="Caveat,cursive" fill="#E8191A" fontWeight="700">{e.label}</text>
            </g>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 flex gap-3"
        style={{ background: "#FAF6EF", borderTop: "1px solid rgba(28,25,17,0.08)" }}>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-1" style={{ background: "#1C1911", borderRadius: "1px" }}/>
          <span style={{ fontSize: "16px", fontFamily: "VT323,monospace", color: "#7A7468" }}>Canon</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0" style={{ borderTop: "2px dashed #E8191A" }}/>
          <span style={{ fontSize: "16px", fontFamily: "VT323,monospace", color: "#E8191A" }}>Visitor Branch</span>
        </div>
        <button onClick={() => navigate("worldline")}
          className="ml-auto px-3 py-1 rounded-lg"
          style={{ background: "#E8191A18", color: "#E8191A", fontFamily: "Caveat,cursive", fontSize: "14px" }}>
          View Worldline →
        </button>
      </div>
    </div>
  );
}

// 16. WORLDLINE
function WorldlineScreen({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <div className="flex items-center justify-between px-5 pt-10 pb-3">
        <button onClick={() => navigate("everydayTown")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "24px", fontWeight: 700, color: "#1C1911" }}>Worldline</p>
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
            { y: 60, label: "World Created", sub: "Memory Town founded", icon: "🏠" },
            { y: 120, label: "Miko Captured", sub: "Café Keeper · day 1", icon: "☕" },
            { y: 180, label: "Library Opened", sub: "Book Librarian joins", icon: "📚" },
            { y: 240, label: "Park Gathering", sub: "Plush hosts first picnic", icon: "🌿" },
            { y: 300, label: "Music Night", sub: "Headphones broadcasts", icon: "🎵" },
            { y: 360, label: "Station Built", sub: "Connections opened", icon: "🚉" },
            { y: 420, label: "Today", sub: "10:24 · Visitor arrives", icon: "📍" },
          ].map((n, i) => (
            <g key={i}>
              {/* Node circle */}
              <circle cx={50} cy={n.y} r={10} fill="white" stroke="#1C1911" strokeWidth="2.5"/>
              <text x={50} y={n.y + 4} textAnchor="middle" fontSize="10">{n.icon}</text>
              {/* Label */}
              <text x={68} y={n.y - 4} fontSize="12" fontFamily="Caveat,cursive" fill="#1C1911" fontWeight="700">{n.label}</text>
              <text x={68} y={n.y + 9} fontSize="9" fontFamily="VT323,monospace" fill="#7A7468">{n.sub}</text>
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
            { x: 240, y: 320, label: "Camera Arrives", sub: "Station · Stardom visitor", icon: "📷" },
            { x: 265, y: 380, label: "Photo Artifact", sub: "Joint memory created", icon: "🖼️" },
            { x: 280, y: 460, label: "Branch End", sub: "Awaiting resolution", icon: "?" },
          ].map((n, i) => (
            <g key={i}>
              <circle cx={n.x} cy={n.y} r={9} fill="white" stroke="#E8191A" strokeWidth="2"/>
              <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="9">{n.icon}</text>
              <text x={n.x + 14} y={n.y - 4} fontSize="11" fontFamily="Caveat,cursive" fill="#E8191A" fontWeight="700">{n.label}</text>
              <text x={n.x + 14} y={n.y + 8} fontSize="8" fontFamily="VT323,monospace" fill="#E8191A80">{n.sub}</text>
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
          style={{ background: "#E8191A18", color: "#E8191A", fontFamily: "Caveat,cursive", fontSize: "16px", fontWeight: 700 }}>
          Resolve Branch
        </button>
        <button className="px-4 py-2.5 rounded-xl"
          style={{ background: "#EAE5DA", color: "#7A7468", fontFamily: "Caveat,cursive", fontSize: "16px" }}>
          Replay ↺
        </button>
      </div>
    </div>
  );
}

// 17. OBJECT AGENT GALLERY
function AgentGalleryScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [filter, setFilter] = useState("Agents");
  const filters = ["Agents","Objects","Buildings","Visitors","Memories","Archived"];

  const agents = [
    { name: "Miko", role: "Café Keeper", world: "Memory Town", memories: 12, agent: <MugAgent x={0} y={4} s={0.65} accent="#E8634A" animated={false}/>, color: "#E8634A", esp32: false, visiting: false },
    { name: "Shutter", role: "Archivist", world: "Memory Town", memories: 8, agent: <CameraAgent x={0} y={4} s={0.6} accent="#4A7FA5" animated={false}/>, color: "#4A7FA5", esp32: true, visiting: false },
    { name: "Nana", role: "Comforter", world: "Memory Town", memories: 18, agent: <PlushAgent x={0} y={6} s={0.55} accent="#C890C0" animated={false}/>, color: "#C890C0", esp32: false, visiting: false },
    { name: "Folio", role: "Memory Librarian", world: "Memory Town", memories: 24, agent: <BookAgent x={0} y={4} s={0.55} accent="#4A7FA5" animated={false}/>, color: "#4A7FA5", esp32: false, visiting: false },
    { name: "Luma", role: "Night Guide", world: "Memory Town", memories: 6, agent: <LampAgent x={0} y={6} s={0.55} accent="#D4A800" animated={false}/>, color: "#D4A800", esp32: false, visiting: false },
    { name: "Beat", role: "Music Broadcaster", world: "Memory Town", memories: 9, agent: <HeadphonesAgent x={0} y={2} s={0.55} accent="#6B9E7A" animated={false}/>, color: "#6B9E7A", esp32: false, visiting: false },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("everydayTown")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "24px", fontWeight: 700 }}>Agent Archive</p>
        <button style={{ color: "#7A7468" }}><Search size={18}/></button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 px-5 pb-2 overflow-x-auto">
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-xl"
            style={{
              background: filter === f ? "#1C1911" : "#EAE5DA",
              color: filter === f ? "white" : "#7A7468",
              fontFamily: "Caveat,cursive",
              fontSize: "15px"
            }}>{f}</button>
        ))}
      </div>

      {/* Agent grid */}
      <div className="flex-1 overflow-y-auto px-5">
        <div className="grid grid-cols-2 gap-3 pb-4">
          {agents.map((a, i) => (
            <button key={i} onClick={() => navigate("agentDetail")}
              className="rounded-2xl overflow-hidden text-left"
              style={{ background: "#FAF6EF", border: "1.5px solid rgba(28,25,17,0.1)", boxShadow: "0 1px 6px rgba(28,25,17,0.05)" }}>
              {/* Agent preview */}
              <div className="flex items-center justify-center relative"
                style={{ height: "90px", background: a.color + "12" }}>
                <svg width="80" height="80" viewBox="-40 -40 80 80">
                  {a.agent}
                </svg>
                {a.esp32 && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                    style={{ background: "#1C1911", color: "white" }}>
                    <Cpu size={8}/>
                    <span style={{ fontSize: "8px", fontFamily: "VT323,monospace" }}>ESP32</span>
                  </div>
                )}
                {a.visiting && (
                  <div className="absolute top-2 left-2 w-2 h-2 rounded-full animate-pulse" style={{ background: "#E8191A" }}/>
                )}
              </div>
              {/* Info */}
              <div className="p-2.5">
                <p style={{ fontFamily: "Caveat,cursive", fontSize: "18px", fontWeight: 700, color: "#1C1911", lineHeight: 1.1 }}>{a.name}</p>
                <p style={{ fontSize: "15px", color: a.color, fontFamily: "VT323,monospace" }}>{a.role}</p>
                <div className="flex items-center justify-between mt-1">
                  <span style={{ fontSize: "9px", color: "#7A7468", fontFamily: "Press Start 2P,monospace" }}>{a.world}</span>
                  <span style={{ fontSize: "15px", color: "#7A7468", fontFamily: "VT323,monospace" }}>
                    {a.memories}mem
                  </span>
                </div>
                {/* Original photo indicator */}
                <div className="flex items-center gap-1 mt-1.5">
                  <div className="w-4 h-4 rounded" style={{ background: a.color + "30", border: `1px solid ${a.color}40` }}>
                    <svg width="16" height="16" viewBox="0 0 16 16">
                      <rect x="2" y="3" width="12" height="10" rx="1.5" fill={a.color + "40"} stroke={a.color + "60"} strokeWidth="0.7"/>
                    </svg>
                  </div>
                  <span style={{ fontSize: "8px", color: "#7A7468", fontFamily: "VT323,monospace" }}>object captured</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// 18. ESP32 WORLD FAMILIAR
function Esp32Screen({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("worldDock")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "22px", fontWeight: 700 }}>World Familiar</p>
        <button style={{ color: "#7A7468" }}><Settings size={18}/></button>
      </div>

      {/* Device illustration */}
      <div className="mx-5 rounded-3xl relative flex items-center justify-center"
        style={{ height: "200px", background: "#FAF6EF", border: "2px solid rgba(28,25,17,0.12)" }}>
        {/* Hand-drawn device outline */}
        <svg width="180" height="130" viewBox="0 0 180 130">
          {/* Device body */}
          <rect x="20" y="15" width="140" height="100" rx="12"
            fill="#E8E2D9" stroke="#1C1911" strokeWidth="2"/>
          {/* Screen */}
          <rect x="30" y="22" width="80" height="68" rx="6"
            fill="#1C1911" stroke="#1C191180" strokeWidth="1"/>
          {/* Agent on screen */}
          <CameraAgent x={70} y={55} s={0.8} accent="#4A7FA5" animated={true}/>
          {/* Screen glow */}
          <rect x="30" y="22" width="80" height="68" rx="6"
            fill="none" stroke="#4A7FA580" strokeWidth="1"
            style={{ animation: "visitorGlow 3s ease-in-out infinite" }}/>
          {/* Joystick */}
          <circle cx="152" cy="45" r="12" fill="#DDD8CF" stroke="#1C1911" strokeWidth="1.5"/>
          <circle cx="152" cy="45" r="5" fill="#1C1911"/>
          {/* Buttons */}
          <circle cx="148" cy="75" r="5" fill="#E8634A" stroke="#1C1911" strokeWidth="1"/>
          <circle cx="162" cy="75" r="5" fill="#6B9E7A" stroke="#1C1911" strokeWidth="1"/>
          {/* Tail/servo */}
          <path d="M32,95 Q25,100 28,108 Q31,116 38,114"
            fill="none" stroke="#1C1911" strokeWidth="2" strokeLinecap="round"
            style={{ animation: "agentBounce 2s ease-in-out infinite" }}/>
        </svg>
        {/* Status */}
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#6B9E7A" }}/>
          <span style={{ fontSize: "16px", fontFamily: "VT323,monospace", color: "#6B9E7A" }}>Connected</span>
        </div>
        <p className="absolute bottom-3 left-0 right-0 text-center"
          style={{ fontFamily: "Caveat,cursive", fontSize: "16px", color: "#7A7468" }}>
          Shutter is living in this device
        </p>
      </div>

      {/* Agent info */}
      <div className="px-5 mt-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: "#4A7FA518", border: "1.5px solid #4A7FA540" }}>
          <svg width="40" height="40" viewBox="-20 -20 40 40">
            <CameraAgent x={0} y={0} s={0.65} accent="#4A7FA5" animated={false}/>
          </svg>
        </div>
        <div>
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "22px", fontWeight: 700, color: "#1C1911" }}>Shutter</p>
          <p style={{ fontSize: "16px", color: "#4A7FA5", fontFamily: "VT323,monospace" }}>Archivist · Memory Town Familiar</p>
        </div>
      </div>

      {/* World state */}
      <div className="px-5 mt-3">
        <SectionLabel text="Current world state"/>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Location", value: "Near Library", icon: <MapPin size={12}/>, color: "#4A7FA5" },
            { label: "Mood", value: "Curious ✦", icon: <Heart size={12}/>, color: "#E8634A" },
            { label: "Visitor", value: "Camera (Stardom)", icon: <Globe size={12}/>, color: "#E8191A" },
            { label: "Memory", value: "New note left", icon: <BookOpen size={12}/>, color: "#6B9E7A" },
          ].map(s => (
            <PaperCard key={s.label} className="px-3 py-2.5 flex items-start gap-2">
              <div style={{ color: s.color, marginTop: "1px" }}>{s.icon}</div>
              <div>
                <p style={{ fontSize: "16px", fontFamily: "VT323,monospace", color: "#7A7468" }}>{s.label}</p>
                <p style={{ fontSize: "14px", fontFamily: "Caveat,cursive", color: "#1C1911", fontWeight: 600 }}>{s.value}</p>
              </div>
            </PaperCard>
          ))}
        </div>
      </div>

      {/* Hardware controls */}
      <div className="px-5 mt-3">
        <SectionLabel text="Hardware controls"/>
        <div className="flex flex-col gap-1.5">
          {[
            { action: "Tap device", result: "Wake Shutter · he looks around", icon: "👆" },
            { action: "Joystick ←/→", result: "Choose Worldline branch", icon: "🕹️" },
            { action: "Press joystick", result: "Accept visitor · confirm merge", icon: "⏎" },
            { action: "Tilt device", result: "Switch view · put Shutter to sleep", icon: "↗️" },
          ].map(c => (
            <div key={c.action} className="flex items-center gap-3 px-3 py-2 rounded-xl"
              style={{ background: "#FAF6EF", border: "1px solid rgba(28,25,17,0.08)" }}>
              <span style={{ fontSize: "16px" }}>{c.icon}</span>
              <div>
                <p style={{ fontSize: "13px", fontFamily: "Caveat,cursive", color: "#1C1911", fontWeight: 700 }}>{c.action}</p>
                <p style={{ fontSize: "10px", fontFamily: "Press Start 2P,monospace", color: "#7A7468" }}>{c.result}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary: device status */}
      <div className="px-5 mt-3 mb-4">
        <div className="flex gap-4">
          {[
            { label: "Wi-Fi", val: "Connected", icon: <Wifi size={11}/>, ok: true },
            { label: "Battery", val: "74%", icon: <Zap size={11}/>, ok: true },
            { label: "Buzzer", val: "Active", icon: <Volume2 size={11}/>, ok: true },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1"
              style={{ color: s.ok ? "#6B9E7A" : "#E8634A", fontSize: "16px", fontFamily: "VT323,monospace" }}>
              {s.icon} {s.val}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 19. PUBLIC WORLD MIRROR
function PublicMirrorScreen({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("everydayTown")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "22px", fontWeight: 700 }}>Public Mirror</p>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: "#E8634A18", color: "#E8634A", fontFamily: "Caveat,cursive", fontSize: "15px" }}>
          <Share2 size={13}/> Share
        </button>
      </div>

      {/* Privacy overview */}
      <div className="mx-5 rounded-2xl px-4 py-3 mb-3"
        style={{ background: "#4A7FA518", border: "1.5px solid #4A7FA540" }}>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "17px", fontWeight: 700, color: "#4A7FA5", marginBottom: "4px" }}>
          "You do not need to surrender your privacy."
        </p>
        <p style={{ fontSize: "10px", color: "#4A7FA5", fontFamily: "Press Start 2P,monospace" }}>
          Visitors see only what you choose to share. Original photos and private memories are never exposed.
        </p>
      </div>

      {/* World preview (visitor view) */}
      <div className="mx-5 rounded-2xl overflow-hidden relative"
        style={{ height: "180px", border: "2px solid rgba(28,25,17,0.12)" }}>
        <EverydayTownSVG w={350} h={220}/>
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full"
          style={{ background: "rgba(250,246,239,0.92)", border: "1px solid rgba(28,25,17,0.1)" }}>
          <span style={{ fontSize: "16px", fontFamily: "VT323,monospace", color: "#7A7468" }}>Visitor view</span>
        </div>
      </div>

      {/* Visibility controls */}
      <div className="px-5 mt-3">
        <SectionLabel text="What visitors can see"/>
        <div className="flex flex-col gap-2">
          {[
            { label: "City map & buildings", visible: true },
            { label: "Agent names & roles", visible: true },
            { label: "Agent appearance", visible: true },
            { label: "Current agent location", visible: true },
            { label: "Action bubbles", visible: true },
            { label: "Agent personality details", visible: false },
            { label: "Memory logs", visible: false },
            { label: "Original photos", visible: false },
            { label: "Private memories", visible: false },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: "#FAF6EF", border: "1px solid rgba(28,25,17,0.08)" }}>
              <p style={{ fontSize: "11px", color: "#1C1911", fontFamily: "Press Start 2P,monospace" }}>{item.label}</p>
              <div className="flex items-center gap-1.5">
                {item.visible
                  ? <><Eye size={12} color="#6B9E7A"/><span style={{ fontSize: "15px", color: "#6B9E7A", fontFamily: "VT323,monospace" }}>visible</span></>
                  : <><Lock size={12} color="#E8634A"/><span style={{ fontSize: "15px", color: "#E8634A", fontFamily: "VT323,monospace" }}>hidden</span></>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active visitors */}
      <div className="px-5 mt-3 mb-4">
        <SectionLabel text="Active visitors (1)"/>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: "#FAF6EF", border: "1.5px solid #E8191A30" }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#E8191A" }}/>
          <p style={{ fontSize: "11px", color: "#1C1911", fontFamily: "Press Start 2P,monospace" }}>
            <strong>Camera Archivist</strong> · from Stardom District · visitor branch active
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
      label: "Camera Archivist Arrival",
      desc: "Visitor arrived at Station, introduced itself to Lamp Night Guide",
      impact: "New relationship: Shutter ↔ Camera Archivist",
      icon: "🚉",
      color: "#E8191A"
    },
    {
      key: "meeting",
      label: "Library Meeting",
      desc: "Camera Archivist shared Stardom District architecture records with Book Librarian",
      impact: "Book Librarian gains 3 new archive entries",
      icon: "📚",
      color: "#4A7FA5"
    },
    {
      key: "artifact",
      label: "Photograph Artifact Created ★",
      desc: "A photograph of the Library was created — a joint artifact from both worlds",
      impact: "New object: Stardom-Memory Photograph · exists in both worlds",
      icon: "🖼️",
      color: "#D4A800"
    },
  ];

  const allDecided = Object.values(decisions).every(d => d !== null);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#F5F0E8", fontFamily: "Press Start 2P,monospace" }}>
      <PhoneStatusBar/>
      <div className="flex items-center justify-between px-5 py-2">
        <button onClick={() => navigate("worldline")} style={{ color: "#7A7468" }}><ChevronLeft size={20}/></button>
        <p style={{ fontFamily: "Caveat,cursive", fontSize: "22px", fontWeight: 700 }}>Resolve Branch</p>
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
          <p style={{ fontFamily: "Caveat,cursive", fontSize: "18px", fontWeight: 700, color: "#1C1911" }}>
            Camera Archivist · Stardom District
          </p>
          <p style={{ fontSize: "16px", color: "#7A7468", fontFamily: "VT323,monospace" }}>
            3 events · 1 artifact · visitor branch
          </p>
        </div>
      </div>

      {/* Events to resolve */}
      <div className="px-5 flex flex-col gap-3">
        {events.map(ev => (
          <PaperCard key={ev.key} className="p-4">
            <div className="flex items-start gap-3">
              <span style={{ fontSize: "24px", flexShrink: 0 }}>{ev.icon}</span>
              <div className="flex-1">
                <p style={{ fontFamily: "Caveat,cursive", fontSize: "18px", fontWeight: 700, color: "#1C1911", lineHeight: 1.2 }}>
                  {ev.label}
                </p>
                <p style={{ fontSize: "10px", color: "#7A7468", fontFamily: "Press Start 2P,monospace", marginTop: "2px" }}>
                  {ev.desc}
                </p>
                <div className="mt-1.5 px-2.5 py-1 rounded-lg"
                  style={{ background: ev.color + "18", border: `1px solid ${ev.color}40` }}>
                  <p style={{ fontSize: "16px", color: ev.color, fontFamily: "VT323,monospace" }}>
                    Impact: {ev.impact}
                  </p>
                </div>
                {/* Decision buttons */}
                <div className="flex gap-2 mt-2.5">
                  <button onClick={() => setDecision(ev.key, "merge")}
                    className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1"
                    style={{
                      background: decisions[ev.key] === "merge" ? "#6B9E7A" : "#EAE5DA",
                      color: decisions[ev.key] === "merge" ? "white" : "#7A7468",
                      fontFamily: "Caveat,cursive",
                      fontSize: "16px",
                      fontWeight: decisions[ev.key] === "merge" ? 700 : 400
                    }}>
                    <GitMerge size={13}/>
                    Merge into canon
                  </button>
                  <button onClick={() => setDecision(ev.key, "discard")}
                    className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1"
                    style={{
                      background: decisions[ev.key] === "discard" ? "#E8634A" : "#EAE5DA",
                      color: decisions[ev.key] === "discard" ? "white" : "#7A7468",
                      fontFamily: "Caveat,cursive",
                      fontSize: "16px",
                      fontWeight: decisions[ev.key] === "discard" ? 700 : 400
                    }}>
                    <X size={13}/>
                    Discard
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
          <span style={{ fontFamily: "Caveat,cursive", fontSize: "20px", fontWeight: 700 }}>
            {allDecided ? "Apply Resolution" : `Decide all events (${Object.values(decisions).filter(Boolean).length}/3)`}
          </span>
        </button>
        <p className="text-center mt-2" style={{ fontSize: "10px", color: "#7A7468", fontFamily: "Press Start 2P,monospace" }}>
          The visitor branch will be closed. Merged events become canon.
        </p>
      </div>
    </div>
  );
}

// ── TOP SUB-TAB BAR ────────────────────────────────────────────────────────────
function TopSubNav({ tabs, active, onChange, accent = "#E8634A", bg = "#FAF6EF" }: {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  active: string;
  onChange: (id: string) => void;
  accent?: string;
  bg?: string;
}) {
  return (
    <div style={{
      display: "flex", gap: 0,
      background: bg,
      borderBottom: "1px solid rgba(28,25,17,0.08)",
      paddingTop: 2,
    }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              flex: 1, padding: "9px 4px 7px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              background: "transparent", border: "none", cursor: "pointer",
              borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent",
              transition: "border-color 0.15s",
            }}>
            {t.icon && <span style={{ color: isActive ? accent : "#B0A898", fontSize: 14 }}>{t.icon}</span>}
            <span style={{
              fontFamily: "Caveat,cursive",
              fontSize: 13, fontWeight: 700,
              color: isActive ? accent : "#9A9088",
              lineHeight: 1,
            }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── BOTTOM NAV (3 tabs: Home, Capture, Gallery) ────────────────────────────────
type BottomTab = "home" | "capture" | "gallery";

// ── MAIN APP ───────────────────────────────────────────────────────────────────
export default function App() {
  const [bottomTab, setBottomTab] = useState<BottomTab>("home");

  // Home tab sub-state: worldDock + 3 worlds
  const [homeSub, setHomeSub] = useState<"worldDock"|"everyday"|"stardom"|"future">("worldDock");
  // Capture tab sub-state
  const [captureSub, setCaptureSub] = useState<"camera"|"extract"|"lineArt"|"bringToLife">("camera");
  // Gallery tab sub-state: agents + identity + device
  const [gallerySub, setGallerySub] = useState<"agents"|"identity"|"device">("agents");

  const [detailScreen, setDetailScreen] = useState<Screen | null>(null);

  const navigate = (s: Screen) => {
    const worldDeepScreens: Screen[] = ["visitorArrival","visitorBranch","worldline","agentDetail","worldBuilder","branchResolution","publicMirror","placeInWorld","motionPreview"];
    if (s === "worldDock")        { setBottomTab("home");    setHomeSub("worldDock");  setDetailScreen(null); return; }
    if (s === "everydayTown")     { setBottomTab("home");    setHomeSub("everyday");   setDetailScreen(null); return; }
    if (s === "stardomDistrict")  { setBottomTab("home");    setHomeSub("stardom");    setDetailScreen(null); return; }
    if (s === "futureColony")     { setBottomTab("home");    setHomeSub("future");     setDetailScreen(null); return; }
    if (s === "capture")          { setBottomTab("capture"); setCaptureSub("camera");      setDetailScreen(null); return; }
    if (s === "extract")          { setBottomTab("capture"); setCaptureSub("extract");     setDetailScreen(null); return; }
    if (s === "lineArt")          { setBottomTab("capture"); setCaptureSub("lineArt");     setDetailScreen(null); return; }
    if (s === "bringToLife")      { setBottomTab("capture"); setCaptureSub("bringToLife"); setDetailScreen(null); return; }
    if (s === "agentGallery")     { setBottomTab("gallery"); setGallerySub("agents");   setDetailScreen(null); return; }
    if (s === "agentIdentity")    { setBottomTab("gallery"); setGallerySub("identity"); setDetailScreen(null); return; }
    if (s === "esp32")            { setBottomTab("gallery"); setGallerySub("device");   setDetailScreen(null); return; }
    if (worldDeepScreens.includes(s)) { setBottomTab("home"); setDetailScreen(s); return; }
    setDetailScreen(s);
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
      case "placeInWorld":     return <PlaceInWorldScreen navigate={navigate}/>;
      case "motionPreview":    return <MotionPreviewScreen navigate={navigate}/>;
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
              color: "#7A7468", fontFamily: "Caveat,cursive", fontSize: 16,
            }}>
            <ChevronLeft size={16}/> Back
          </button>
          {renderDetail(detailScreen)}
        </div>
      );
    }

    switch (bottomTab) {
      case "home": {
        // Sub-tabs: Dock | Memory Town | Stardom | Colony
        const homeTabs = [
          { id: "worldDock", label: "Dock",    icon: <Home size={12}/> },
          { id: "everyday",  label: "Town",    icon: <Globe size={12}/> },
          { id: "stardom",   label: "Stardom", icon: <Star size={12}/> },
          { id: "future",    label: "Colony",  icon: <Rocket size={12}/> },
        ];
        const homeAccent = homeSub === "everyday" ? "#E8634A" : homeSub === "stardom" ? "#E8191A" : homeSub === "future" ? "#0070F3" : "#E8634A";
        const homeBg     = homeSub === "stardom" ? "#FFF5F8" : homeSub === "future" ? "#EAECF2" : "#F5F0E8";
        return (
          <div className="flex-1 overflow-hidden flex flex-col">
            <TopSubNav tabs={homeTabs} active={homeSub} onChange={id => setHomeSub(id as typeof homeSub)} accent={homeAccent} bg={homeBg}/>
            <div className="flex-1 overflow-hidden flex flex-col">
              {homeSub === "worldDock" && <WorldDockScreen navigate={navigate}/>}
              {homeSub === "everyday"  && <EverydayTownScreen navigate={navigate}/>}
              {homeSub === "stardom"   && <StardomDistrictScreen navigate={navigate}/>}
              {homeSub === "future"    && <FutureColonyScreen navigate={navigate}/>}
            </div>
          </div>
        );
      }

      case "capture": {
        const captureTabs = [
          { id: "camera",      label: "Camera",   icon: <Camera size={12}/> },
          { id: "extract",     label: "Extract",  icon: <Scissors size={12}/> },
          { id: "lineArt",     label: "Line Art", icon: <Brush size={12}/> },
          { id: "bringToLife", label: "Animate",  icon: <Sparkles size={12}/> },
        ];
        return (
          <div className="flex-1 overflow-hidden flex flex-col" style={{ background: "#F5F0E8" }}>
            <TopSubNav tabs={captureTabs} active={captureSub} onChange={id => setCaptureSub(id as typeof captureSub)} accent="#E8634A" bg="#F5F0E8"/>
            <div className="flex-1 overflow-hidden flex flex-col">
              <AnimatePresence mode="wait">
                <motion.div key={captureSub} className="flex-1 overflow-hidden flex flex-col"
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
                  {captureSub === "camera"      && <CaptureScreen navigate={navigate}/>}
                  {captureSub === "extract"     && <ExtractScreen navigate={navigate}/>}
                  {captureSub === "lineArt"     && <LineArtScreen navigate={navigate}/>}
                  {captureSub === "bringToLife" && <BringToLifeScreen navigate={navigate}/>}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        );
      }

      case "gallery": {
        // Sub-tabs: Agents | Identity | Device
        const galleryTabs = [
          { id: "agents",   label: "Agents",   icon: <Package size={12}/> },
          { id: "identity", label: "Identity", icon: <Star size={12}/> },
          { id: "device",   label: "Device",   icon: <Cpu size={12}/> },
        ];
        return (
          <div className="flex-1 overflow-hidden flex flex-col" style={{ background: "#F5F0E8" }}>
            <TopSubNav tabs={galleryTabs} active={gallerySub} onChange={id => setGallerySub(id as typeof gallerySub)} accent="#E8634A" bg="#F5F0E8"/>
            <div className="flex-1 overflow-hidden flex flex-col">
              {gallerySub === "agents"   && <AgentGalleryScreen navigate={navigate}/>}
              {gallerySub === "identity" && <AgentIdentityScreen navigate={navigate}/>}
              {gallerySub === "device"   && <Esp32Screen navigate={navigate}/>}
            </div>
          </div>
        );
      }

      default:
        return <div className="flex-1 overflow-hidden flex flex-col"><WorldDockScreen navigate={navigate}/></div>;
    }
  };

  // Fixed bottom nav — 3 tabs only
  const BOTTOM_TABS = [
    { id: "home"    as BottomTab, icon: <Home size={22}/>,    label: "Home"    },
    { id: "capture" as BottomTab, icon: <Camera size={22}/>,  label: "Capture" },
    { id: "gallery" as BottomTab, icon: <Package size={22}/>, label: "Gallery" },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center"
      style={{ background: "#2A2420", fontFamily: "Press Start 2P,monospace" }}>
      <GlobalStyles/>

      {/* Phone frame */}
      <div className="relative mt-8 mb-8"
        style={{
          width: "390px",
          height: "780px",
          borderRadius: "48px",
          background: "#FAF6EF",
          boxShadow: "0 0 0 10px #1A1612, 0 0 0 14px #2A2420, 0 24px 80px rgba(0,0,0,0.6)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-50"
          style={{ width: "126px", height: "36px", background: "#1A1612", borderRadius: "0 0 20px 20px" }}/>

        {/* Screen content */}
        <div className="flex-1 overflow-hidden flex flex-col" style={{ paddingTop: 4 }}>
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
        <div style={{
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
                onClick={() => { setDetailScreen(null); setBottomTab(t.id); }}
                style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 3, padding: "4px 0 8px",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: isActive ? "#E8634A" : "#7A7468",
                }}>
                {t.icon}
                <span style={{ fontSize: 9, fontFamily: "Caveat,cursive", fontWeight: 700 }}>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Home indicator */}
        <div style={{ display: "flex", justifyContent: "center", paddingBottom: 6 }}>
          <div style={{ width: 112, height: 4, borderRadius: 2, background: "rgba(28,25,17,0.18)" }}/>
        </div>
      </div>

      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "VT323,monospace", marginBottom: 24 }}>
        ForkWorld · tap bottom tabs to navigate
      </p>
    </div>
  );
}
