import {
  ConcentricPlazaMap,
  type ConcentricPlazaMember,
  type FeaturedPlazaHouse,
  type PlazaConverseLine,
  type PlazaUserHouse,
} from "./ConcentricPlazaMap";

export type WebPlazaMember = ConcentricPlazaMember;

type WebPlazaSceneProps = {
  members: WebPlazaMember[];
  onOpenAgent: (agentId: string) => void;
  featuredHouses?: FeaturedPlazaHouse[];
  userHouse?: PlazaUserHouse | null;
  selectingHouse?: boolean;
  onSelectHouse?: (houseId: string) => void;
  onOpenUserWorld?: () => void;
  focusMemberId?: string | null;
  focusRequest?: number;
  conversePair?: [string, string] | null;
  converseLine?: PlazaConverseLine | null;
};

export function WebPlazaScene(props: WebPlazaSceneProps) {
  return <ConcentricPlazaMap {...props} />;
}
