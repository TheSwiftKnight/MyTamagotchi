import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { ArrowRight, Home, Minus, Plus, Radio, Users } from "lucide-react";
import unifiedConcentricTownHdAvif from "../assets/world/plaza/unified-concentric-town@2x.avif";
import unifiedConcentricTownPng from "../assets/world/plaza/unified-concentric-town.png";
import petDachshundPng from "../assets/world/pet-agents/sprites/dachshund.png";
import type { PlazaSkill } from "./plazaSkills";
import "./ConcentricPlazaMap.css";

export type ConcentricPlazaMember = {
  id: string;
  name: string;
  origin: string;
  color: string;
  art: ReactNode;
};

export type FeaturedPlazaHouse = {
  houseId: string;
  label: string;
  worldName: string;
  color: string;
  onOpen: () => void;
};

export type PlazaUserHouse = {
  houseId: string;
  worldName: string;
  color: string;
};

export type PlazaConverseLine = {
  memberId: string;
  name: string;
  text: string;
};

type ConcentricPlazaMapProps = {
  members: ConcentricPlazaMember[];
  skills?: PlazaSkill[];
  onOpenAgent: (agentId: string) => void;
  onOpenSkill?: (skillId: string) => void;
  featuredHouses?: FeaturedPlazaHouse[];
  userHouse?: PlazaUserHouse | null;
  selectingHouse?: boolean;
  onSelectHouse?: (houseId: string) => void;
  onOpenUserWorld?: () => void;
  focusMemberId?: string | null;
  focusRequest?: number;
  /** 对谈进行时的两位参与者；只有此时才在地图上画出连结。 */
  conversePair?: [string, string] | null;
  /** 对谈进行时当前正在说的一句台词。 */
  converseLine?: PlazaConverseLine | null;
};

type MapView = {
  scale: number;
  x: number;
  y: number;
};

type PointerPoint = {
  x: number;
  y: number;
};

type HouseSlot = {
  id: string;
  ringId: number;
  ringName: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const STAGE_WIDTH = 3344;
const STAGE_HEIGHT = 1882;
const MIN_SCALE = 0.22;
const MAX_SCALE = 2.2;
const DEFAULT_PLAZA_SCALE = 0.31;
const PLAZA_CENTER = { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 };
const PLAZA_FOCUS = {
  x: PLAZA_CENTER.x - 470,
  y: PLAZA_CENTER.y - 390,
  width: 940,
  height: 780,
};

const PLAZA_RINGS = [
  { id: 1, name: "一环 · 中央住区", rx: 790, ry: 520, capacity: 36, offset: -85 },
  { id: 2, name: "二环 · 花园住区", rx: 1090, ry: 710, capacity: 44, offset: -85.9 },
  { id: 3, name: "三环 · 田园住区", rx: 1380, ry: 860, capacity: 52, offset: -86.54 },
] as const;

const HOUSE_SLOTS: HouseSlot[] = PLAZA_RINGS.flatMap((ring, ringIndex) => {
  const firstHouseNumber = PLAZA_RINGS
    .slice(0, ringIndex)
    .reduce((total, previousRing) => total + previousRing.capacity, 0) + 1;
  return Array.from({ length: ring.capacity }, (_, slot) => {
    const angle = (ring.offset + slot * 360 / ring.capacity) * Math.PI / 180;
    return {
      id: `H${String(firstHouseNumber + slot).padStart(2, "0")}`,
      ringId: ring.id,
      ringName: ring.name,
      x: Math.round(PLAZA_CENTER.x + Math.cos(angle) * ring.rx),
      y: Math.round(PLAZA_CENTER.y + Math.sin(angle) * ring.ry),
      w: ring.id === 1 ? 118 : 110,
      h: ring.id === 1 ? 94 : 88,
    };
  });
});

const OCCUPIED_HOUSE_INDEXES = [1, 5, 9, 13, 17, 21];
const MEMBER_POSITIONS = [
  { x: 675, y: 442, dx: 16, dy: -10 },
  { x: 728, y: 338, dx: -12, dy: 14 },
  { x: 939, y: 340, dx: 15, dy: 10 },
  { x: 996, y: 442, dx: -15, dy: -10 },
  { x: 934, y: 584, dx: 13, dy: -14 },
  { x: 736, y: 585, dx: -15, dy: -12 },
  { x: 836, y: 644, dx: 18, dy: -8 },
  { x: 836, y: 300, dx: -14, dy: 10 },
].map(position => ({
  ...position,
  x: position.x + PLAZA_CENTER.x - 836,
  y: position.y + PLAZA_CENTER.y - 470,
}));

const PLAZA_TRAINING_LINES = [
  { speaker: "Miko", topic: "动作质量", color: "#E8634A", text: "慢一点下蹲，膝盖和脚尖保持同向。" },
  { speaker: "Atlas", topic: "训练计划", color: "#579447", text: "先建立稳定动作，再逐步增加训练量。" },
  { speaker: "Shutter", topic: "姿态观察", color: "#4A7FA5", text: "我记录到背部更稳定了，下一轮保持呼吸。" },
  { speaker: "Noct", topic: "恢复节奏", color: "#6D6884", text: "疲劳不是失败，恢复也是训练的一部分。" },
  { speaker: "Ansel", topic: "长期习惯", color: "#8A543B", text: "把训练拆成每天都能完成的小步骤。" },
  { speaker: "Ink", topic: "安全边界", color: "#6A6957", text: "出现刺痛就停止，先确认身体发出的信号。" },
];

function getGesture(points: Map<number, PointerPoint>) {
  const values = Array.from(points.values());
  if (values.length === 0) return null;
  if (values.length === 1) {
    return { count: 1, x: values[0].x, y: values[0].y, distance: 0 };
  }
  const first = values[0];
  const second = values[1];
  return {
    count: 2,
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
    distance: Math.hypot(second.x - first.x, second.y - first.y),
  };
}

export function ConcentricPlazaMap({
  members,
  onOpenAgent,
  featuredHouses = [],
  userHouse = null,
  selectingHouse = false,
  onSelectHouse,
  onOpenUserWorld,
  focusMemberId = null,
  focusRequest = 0,
  skills = [],
  onOpenSkill,
  conversePair = null,
  converseLine = null,
}: ConcentricPlazaMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView>({ scale: DEFAULT_PLAZA_SCALE, x: 0, y: 0 });
  const viewportSizeRef = useRef({ width: 0, height: 0 });
  const pointersRef = useRef(new Map<number, PointerPoint>());
  const gestureRef = useRef<ReturnType<typeof getGesture>>(null);
  const [view, setView] = useState(viewRef.current);

  /* 对谈连结用：按成员 id 反查其在地图上的落点（与下方渲染同一套 MEMBER_POSITIONS） */
  const memberPositionById = (memberId: string) => {
    const index = members.findIndex(member => member.id === memberId);
    if (index < 0) return null;
    return MEMBER_POSITIONS[index % MEMBER_POSITIONS.length];
  };
  const conversePositions = conversePair
    ? [memberPositionById(conversePair[0]), memberPositionById(conversePair[1])]
    : [null, null];
  const converseSpeakerPosition = converseLine ? memberPositionById(converseLine.memberId) : null;
  const [dragging, setDragging] = useState(false);
  const [activeHouseId, setActiveHouseId] = useState<string | null>(null);
  const [dialogueIndex, setDialogueIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDialogueIndex(current => (current + 1) % PLAZA_TRAINING_LINES.length);
    }, 2900);
    return () => window.clearInterval(timer);
  }, []);

  const houses = useMemo(() => HOUSE_SLOTS.map((house, index) => {
    const memberIndex = OCCUPIED_HOUSE_INDEXES.indexOf(index);
    return {
      ...house,
      member: memberIndex >= 0 ? members[memberIndex] : undefined,
      featured: featuredHouses.find(item => item.houseId === house.id),
      userWorld: userHouse?.houseId === house.id ? userHouse : undefined,
    };
  }), [featuredHouses, members, userHouse]);
  const activeHouse = houses.find(house => house.id === activeHouseId);
  const activeTrainingLine = PLAZA_TRAINING_LINES[dialogueIndex];
  const responseLine = dialogueIndex % 2 === 0
    ? "收到。先把动作做稳，我们再一起进入下一组。"
    : "很好，把这条经验写进今天的共同训练记录。";

  const constrainView = useCallback((next: MapView) => {
    const { width, height } = viewportSizeRef.current;
    const stageWidth = STAGE_WIDTH * next.scale;
    const stageHeight = STAGE_HEIGHT * next.scale;
    return {
      ...next,
      x: stageWidth <= width
        ? (width - stageWidth) / 2
        : Math.min(0, Math.max(width - stageWidth, next.x)),
      y: stageHeight <= height
        ? (height - stageHeight) / 2
        : Math.min(0, Math.max(height - stageHeight, next.y)),
    };
  }, []);

  const commitView = useCallback((next: MapView) => {
    const constrained = constrainView(next);
    viewRef.current = constrained;
    setView(constrained);
  }, [constrainView]);

  const fitPlaza = useCallback(() => {
    const { width, height } = viewportSizeRef.current;
    if (!width || !height) return;
    viewportRef.current?.scrollTo({ left: 0, top: 0 });
    const fittedScale = Math.max(
      MIN_SCALE,
      Math.min(
        MAX_SCALE,
        Math.min((width - 20) / PLAZA_FOCUS.width, (height - 20) / PLAZA_FOCUS.height),
      ),
    );
    const compactView = width < 900;
    const scale = compactView ? DEFAULT_PLAZA_SCALE : fittedScale;
    commitView({
      scale,
      x: width / 2 - PLAZA_CENTER.x * scale + (compactView ? width * 0.22 : 0),
      y: height / 2 - PLAZA_CENTER.y * scale - (compactView ? height * 0.05 : 0),
    });
  }, [commitView]);

  const zoomAt = useCallback((factor: number, origin?: PointerPoint) => {
    const { width, height } = viewportSizeRef.current;
    const current = viewRef.current;
    const point = origin ?? { x: width / 2, y: height / 2 };
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, current.scale * factor));
    const ratio = scale / current.scale;
    commitView({
      scale,
      x: point.x - (point.x - current.x) * ratio,
      y: point.y - (point.y - current.y) * ratio,
    });
  }, [commitView]);

  const focusOnMember = useCallback(() => {
    if (!focusMemberId || focusRequest === 0) return;
    const memberIndex = members.findIndex(member => member.id === focusMemberId);
    if (memberIndex < 0) return;
    const { width, height } = viewportSizeRef.current;
    if (!width || !height) return;
    const position = MEMBER_POSITIONS[memberIndex % MEMBER_POSITIONS.length];
    const scale = Math.max(viewRef.current.scale, 0.82);
    commitView({
      scale,
      x: width / 2 - position.x * scale,
      y: height / 2 - position.y * scale,
    });
  }, [commitView, focusMemberId, focusRequest, members]);

  useEffect(() => {
    focusOnMember();
  }, [focusOnMember]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const resize = () => {
      viewportSizeRef.current = {
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      };
      if (focusMemberId && focusRequest > 0) focusOnMember();
      else fitPlaza();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitPlaza, focusMemberId, focusOnMember, focusRequest]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * event.currentTarget.clientWidth / bounds.width,
      y: (event.clientY - bounds.top) * event.currentTarget.clientHeight / bounds.height,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, pointFromEvent(event));
    gestureRef.current = getGesture(pointersRef.current);
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const previous = gestureRef.current;
    pointersRef.current.set(event.pointerId, pointFromEvent(event));
    const currentGesture = getGesture(pointersRef.current);
    if (!previous || !currentGesture || previous.count !== currentGesture.count) {
      gestureRef.current = currentGesture;
      return;
    }

    const currentView = viewRef.current;
    if (currentGesture.count === 1) {
      commitView({
        ...currentView,
        x: currentView.x + currentGesture.x - previous.x,
        y: currentView.y + currentGesture.y - previous.y,
      });
    } else if (previous.distance > 0) {
      const scale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, currentView.scale * (currentGesture.distance / previous.distance)),
      );
      const ratio = scale / currentView.scale;
      commitView({
        scale,
        x: currentGesture.x - (previous.x - currentView.x) * ratio,
        y: currentGesture.y - (previous.y - currentView.y) * ratio,
      });
    }
    gestureRef.current = currentGesture;
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    gestureRef.current = getGesture(pointersRef.current);
    if (pointersRef.current.size === 0) setDragging(false);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    zoomAt(event.deltaY > 0 ? 0.9 : 1.1, {
      x: (event.clientX - bounds.left) * event.currentTarget.clientWidth / bounds.width,
      y: (event.clientY - bounds.top) * event.currentTarget.clientHeight / bounds.height,
    });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = viewRef.current;
    const offsets: Record<string, [number, number]> = {
      ArrowLeft: [28, 0],
      ArrowRight: [-28, 0],
      ArrowUp: [0, 28],
      ArrowDown: [0, -28],
    };
    if (offsets[event.key]) {
      event.preventDefault();
      const [x, y] = offsets[event.key];
      commitView({ ...current, x: current.x + x, y: current.y + y });
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomAt(1.15);
    } else if (event.key === "-") {
      event.preventDefault();
      zoomAt(1 / 1.15);
    } else if (event.key === "0" || event.key === "Home") {
      event.preventDefault();
      fitPlaza();
    }
  };

  return (
    <section
      ref={viewportRef}
      className={`concentric-plaza-map ${dragging ? "is-dragging" : ""}`}
      aria-label="ForkWorld 同心广场大地图"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onWheel={handleWheel}
      onDoubleClick={event => {
        if ((event.target as HTMLElement).closest("button")) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        zoomAt(1.28, {
          x: (event.clientX - bounds.left) * event.currentTarget.clientWidth / bounds.width,
          y: (event.clientY - bounds.top) * event.currentTarget.clientHeight / bounds.height,
        });
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="concentric-plaza-map__stage"
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
        }}
      >
        <picture className="concentric-plaza-map__art" aria-hidden="true">
          <source srcSet={unifiedConcentricTownHdAvif} type="image/avif" />
          <img src={unifiedConcentricTownPng} alt="" draggable={false} />
        </picture>
        <div className="concentric-plaza-map__vignette" aria-hidden="true" />

        <div className="concentric-plaza-map__houses">
          {houses.map(house => {
            const selectable = selectingHouse && !house.member && !house.featured && !house.userWorld;
            const houseColor = house.userWorld?.color ?? house.featured?.color ?? house.member?.color ?? "#8d887e";
            return (
              <button
                type="button"
                key={house.id}
                className={[
                  "concentric-plaza-map__house",
                  house.member ? "is-occupied" : "",
                  house.featured ? "is-featured" : "",
                  house.userWorld ? "is-user-world" : "",
                  selectable ? "is-selectable" : "",
                  activeHouseId === house.id ? "is-active" : "",
                ].filter(Boolean).join(" ")}
                style={{
                  left: house.x,
                  top: house.y,
                  width: house.w,
                  height: house.h,
                  "--house-color": houseColor,
                } as CSSProperties}
                aria-label={
                  selectable
                    ? `选择 ${house.id} 创建自己的世界`
                    : house.featured
                      ? `${house.id}，进入${house.featured.worldName}`
                      : house.userWorld
                        ? `${house.id}，你的世界：${house.userWorld.worldName}`
                        : house.member
                          ? `${house.id}，${house.member.name} 的广场住处`
                          : `${house.id}，空房`
                }
                onClick={event => {
                  event.stopPropagation();
                  if (selectable && onSelectHouse) {
                    onSelectHouse(house.id);
                    return;
                  }
                  if (!selectingHouse && house.featured) {
                    house.featured.onOpen();
                    return;
                  }
                  if (!selectingHouse && house.userWorld && onOpenUserWorld) {
                    onOpenUserWorld();
                    return;
                  }
                  setActiveHouseId(house.id);
                }}
              >
                <span>
                  {house.userWorld
                    ? "你的世界"
                    : house.featured
                      ? `${house.id} · ${house.featured.label}`
                      : house.member
                        ? `${house.id} · ${house.member.name}`
                        : selectable
                          ? `${house.id} · 选择这里`
                          : `${house.id} · 空房`}
                </span>
              </button>
            );
          })}
        </div>

        <svg className="concentric-plaza-map__learning-links" viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`} aria-hidden="true">
          {MEMBER_POSITIONS.map((position, index) => (
            <path
              key={index}
              d={`M ${position.x} ${position.y} Q ${(position.x + PLAZA_CENTER.x) / 2} ${
                position.y < PLAZA_CENTER.y ? PLAZA_CENTER.y - 80 : PLAZA_CENTER.y + 80
              } ${PLAZA_CENTER.x} ${PLAZA_CENTER.y}`}
            />
          ))}
        </svg>

        <div className="concentric-plaza-map__learning-scene">
          <button
            type="button"
            className="concentric-plaza-map__dachshund"
            onClick={event => {
              event.stopPropagation();
              onOpenSkill?.(skills.find(skill => skill.id === "fitness-companion")?.id ?? skills[0]?.id ?? "fitness-companion");
            }}
            aria-label="查看腊肠犬 Dotti 正在组织的健身学习"
          >
            <span className="concentric-plaza-map__dachshund-pulse" />
            <img src={petDachshundPng} alt="腊肠犬主智能体 Dotti" draggable={false} />
            <span><strong>Dotti</strong><small>主智能体</small></span>
          </button>
          <div className="concentric-plaza-map__dialogue is-npc" key={`npc-${dialogueIndex}`}>
            <span style={{ color: activeTrainingLine.color }}>{activeTrainingLine.speaker} · {activeTrainingLine.topic}</span>
            <p>{activeTrainingLine.text}</p>
          </div>
          <div className="concentric-plaza-map__dialogue is-dotti" key={`dotti-${dialogueIndex}`}>
            <span>Dotti · 共同训练</span>
            <p>{responseLine}</p>
          </div>
        </div>

        {members.map((member, index) => {
          const position = MEMBER_POSITIONS[index % MEMBER_POSITIONS.length];
          return (
            <button
              type="button"
              className={`concentric-plaza-map__member ${focusMemberId === member.id ? "is-focused" : ""}`}
              key={member.id}
              onClick={event => {
                event.stopPropagation();
                onOpenAgent(member.id);
              }}
              style={{
                left: position.x,
                top: position.y,
                "--member-color": member.color,
                "--member-dx": `${position.dx}px`,
                "--member-dy": `${position.dy}px`,
                "--member-start-x": `${position.dx * -0.55}px`,
                "--member-start-y": `${position.dy * -0.45}px`,
                "--member-middle-x": `${position.dx * 0.28}px`,
                "--member-end-y": `${position.dy * 0.35}px`,
                "--member-delay": `${-index * 0.55}s`,
              } as CSSProperties}
              aria-label={`查看 ${member.name} 的 Agent 档案`}
            >
              <span className="concentric-plaza-map__member-wander">
                <span className="concentric-plaza-map__member-art">{member.art}</span>
                <span className="concentric-plaza-map__member-label">
                  <strong>{member.name}</strong>
                  <small>{member.origin}</small>
                </span>
              </span>
            </button>
          );
        })}

        {conversePositions[0] && conversePositions[1] && (
          <svg className="concentric-plaza-map__learning-links" viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`} aria-hidden="true">
            <path
              d={`M ${conversePositions[0].x} ${conversePositions[0].y} Q ${(conversePositions[0].x + conversePositions[1].x) / 2} ${Math.min(conversePositions[0].y, conversePositions[1].y) - 80} ${conversePositions[1].x} ${conversePositions[1].y}`}
            />
          </svg>
        )}

        {converseLine && converseSpeakerPosition && (
          <div
            className="concentric-plaza-map__converse"
            style={{ left: converseSpeakerPosition.x, top: converseSpeakerPosition.y }}
          >
            <div className="concentric-plaza-map__dialogue is-npc" key={`${converseLine.memberId}-${converseLine.text}`}>
              <span>{converseLine.name}</span>
              <p>{converseLine.text}</p>
            </div>
          </div>
        )}
      </div>

      <header className="concentric-plaza-map__status">
        <span><Radio size={10} /> {selectingHouse ? "SELECT A HOME" : "LIVE PLAZA"}</span>
        <b><Users size={10} /> {members.length + 1} LEARNING · {HOUSE_SLOTS.length} HOUSES</b>
      </header>

      <div className="concentric-plaza-map__zoom">{Math.round(view.scale * 100)}%</div>

      {selectingHouse && (
        <div className="concentric-plaza-map__selection-note">
          <strong>为你的世界选择一栋空房</strong>
          <span>发光的房屋可以入住，点击后会自动返回创建流程。</span>
        </div>
      )}

      {activeHouse && (
        <aside className="concentric-plaza-map__house-card" onPointerDown={event => event.stopPropagation()}>
          <button type="button" aria-label="关闭房屋信息" onClick={() => setActiveHouseId(null)}>×</button>
          <span>
            {activeHouse.ringName} · {activeHouse.id} · {activeHouse.userWorld ? "你的世界" : activeHouse.featured ? "主题入口" : activeHouse.member ? "已入住" : "空房"}
          </span>
          <strong>{activeHouse.userWorld?.worldName ?? activeHouse.featured?.worldName ?? activeHouse.member?.name ?? "等待新的 Agent 世界"}</strong>
          <small>
            {activeHouse.userWorld
              ? "这栋房子已与你创建的世界同步"
              : activeHouse.featured
                ? `点击进入 ${activeHouse.featured.label}`
                : activeHouse.member?.origin ?? "未来可分配给新的智能体"}
          </small>
          {activeHouse.featured && (
            <button type="button" onClick={activeHouse.featured.onOpen}>进入主题世界 <ArrowRight size={12}/></button>
          )}
          {activeHouse.userWorld && onOpenUserWorld && (
            <button type="button" onClick={onOpenUserWorld}>回到我的世界 <ArrowRight size={12}/></button>
          )}
          {activeHouse.member && (
            <button type="button" onClick={() => onOpenAgent(activeHouse.member!.id)}>查看 Agent 档案 →</button>
          )}
        </aside>
      )}

      <nav className="concentric-plaza-map__controls" aria-label="大地图控制" onPointerDown={event => event.stopPropagation()}>
        <button type="button" onClick={() => zoomAt(1 / 1.18)} aria-label="缩小地图"><Minus size={14} /></button>
        <button type="button" onClick={fitPlaza} aria-label="回到中央学习广场"><Home size={14} /></button>
        <button type="button" onClick={() => zoomAt(1.18)} aria-label="放大地图"><Plus size={14} /></button>
      </nav>

      <div className="concentric-plaza-map__hint">拖拽移动 · 滚轮或双指缩放 · 双击放大</div>
    </section>
  );
}
