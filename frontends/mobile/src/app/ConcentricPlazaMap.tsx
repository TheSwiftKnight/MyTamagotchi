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
import concentricCommonsMap from "../assets/world/plaza/concentric-commons.png";
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
  onOpenAgent: (agentId: string) => void;
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
  x: number;
  y: number;
  w: number;
  h: number;
};

const STAGE_WIDTH = 1672;
const STAGE_HEIGHT = 941;
const MIN_SCALE = 0.22;
const MAX_SCALE = 2.2;
const PLAZA_FOCUS = { x: 380, y: 80, width: 912, height: 780 };

const HOUSE_SLOTS: HouseSlot[] = [
  { id: "H01", x: 541, y: 105, w: 104, h: 91 },
  { id: "H02", x: 636, y: 78, w: 82, h: 78 },
  { id: "H03", x: 705, y: 75, w: 75, h: 78 },
  { id: "H04", x: 1005, y: 76, w: 106, h: 82 },
  { id: "H05", x: 1117, y: 91, w: 92, h: 82 },
  { id: "H06", x: 1190, y: 108, w: 68, h: 80 },
  { id: "H07", x: 1306, y: 206, w: 105, h: 96 },
  { id: "H08", x: 1381, y: 283, w: 88, h: 91 },
  { id: "H09", x: 1416, y: 384, w: 76, h: 101 },
  { id: "H10", x: 1411, y: 511, w: 78, h: 97 },
  { id: "H11", x: 1381, y: 612, w: 89, h: 99 },
  { id: "H12", x: 1305, y: 693, w: 108, h: 94 },
  { id: "H13", x: 1187, y: 795, w: 92, h: 86 },
  { id: "H14", x: 1104, y: 826, w: 78, h: 80 },
  { id: "H15", x: 1010, y: 844, w: 96, h: 83 },
  { id: "H16", x: 735, y: 847, w: 86, h: 82 },
  { id: "H17", x: 648, y: 842, w: 76, h: 80 },
  { id: "H18", x: 565, y: 826, w: 78, h: 81 },
  { id: "H19", x: 486, y: 796, w: 98, h: 86 },
  { id: "H20", x: 366, y: 692, w: 108, h: 95 },
  { id: "H21", x: 294, y: 604, w: 91, h: 99 },
  { id: "H22", x: 270, y: 509, w: 74, h: 91 },
  { id: "H23", x: 278, y: 383, w: 82, h: 101 },
  { id: "H24", x: 322, y: 281, w: 90, h: 92 },
  { id: "H25", x: 389, y: 205, w: 102, h: 96 },
];

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
  conversePair = null,
  converseLine = null,
}: ConcentricPlazaMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView>({ scale: 0.4, x: 0, y: 0 });
  const viewportSizeRef = useRef({ width: 0, height: 0 });
  const pointersRef = useRef(new Map<number, PointerPoint>());
  const gestureRef = useRef<ReturnType<typeof getGesture>>(null);
  const [view, setView] = useState(viewRef.current);
  const [dragging, setDragging] = useState(false);
  const [activeHouseId, setActiveHouseId] = useState<string | null>(null);

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
  const memberPositionById = (memberId: string) => {
    const index = members.findIndex(member => member.id === memberId);
    if (index < 0) return null;
    return MEMBER_POSITIONS[index % MEMBER_POSITIONS.length];
  };
  const conversePositions = conversePair
    ? [memberPositionById(conversePair[0]), memberPositionById(conversePair[1])]
    : [null, null];
  const converseSpeakerPosition = converseLine ? memberPositionById(converseLine.memberId) : null;

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
    const scale = Math.max(
      MIN_SCALE,
      Math.min(
        MAX_SCALE,
        Math.min((width - 20) / PLAZA_FOCUS.width, (height - 20) / PLAZA_FOCUS.height),
      ),
    );
    commitView({
      scale,
      x: (width - PLAZA_FOCUS.width * scale) / 2 - PLAZA_FOCUS.x * scale,
      y: (height - PLAZA_FOCUS.height * scale) / 2 - PLAZA_FOCUS.y * scale,
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
      const bounds = viewport.getBoundingClientRect();
      viewportSizeRef.current = { width: bounds.width, height: bounds.height };
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
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
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
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
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
        zoomAt(1.28, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="concentric-plaza-map__stage"
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
        }}
      >
        <img
          className="concentric-plaza-map__art"
          src={concentricCommonsMap}
          alt=""
          draggable={false}
        />
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
      </div>

      <header className="concentric-plaza-map__status">
        <span><Radio size={10} /> {selectingHouse ? "SELECT A HOME" : "LIVE PLAZA"}</span>
        <b><Users size={10} /> {members.length} AGENTS · {HOUSE_SLOTS.length} HOUSES</b>
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
            {activeHouse.id} · {activeHouse.userWorld ? "你的世界" : activeHouse.featured ? "主题入口" : activeHouse.member ? "已入住" : "空房"}
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
        <button type="button" onClick={fitPlaza} aria-label="显示完整圆形广场"><Home size={14} /></button>
        <button type="button" onClick={() => zoomAt(1.18)} aria-label="放大地图"><Plus size={14} /></button>
      </nav>

      <div className="concentric-plaza-map__hint">拖拽移动 · 滚轮或双指缩放 · 双击放大</div>
    </section>
  );
}
