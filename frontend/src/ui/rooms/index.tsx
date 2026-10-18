import type { Building } from "../../game/buildings";
import { BankRoom } from "./BankRoom";
import { CircleRoom, CouncilRoom, GuildRoom, ReefRoom } from "./CityRooms";
import { TavernRoom } from "./TavernRoom";
import { Room, view, type RoomProps } from "./kit";
import { ExchangeRoom, MarketRoom } from "./TradeRooms";

const CONTENT = {
  bank: BankRoom,
  market: MarketRoom,
  harbor: ExchangeRoom,
  guild_hall: GuildRoom,
  drowned_bell: TavernRoom,
  black_reef: ReefRoom,
  circle: CircleRoom,
  council: CouncilRoom,
} as const;

/** The room for whichever building the player walked into. */
export function BuildingRoom({ building, room, onLeave }: { building: Building; room: RoomProps; onLeave: () => void }) {
  const Content = CONTENT[building.id];
  const free = view(room.run).free_visits;
  const tide =
    building.id === "market"
      ? free?.market
        ? "Your first Market trip this season is free. Later trips cost a tide."
        : "A Market trip costs a tide."
      : building.id === "harbor"
        ? free?.exchange
          ? "Your first Exchange visit this season is free. Later visits cost a tide."
          : "An Exchange visit costs a tide."
        : undefined;
  return (
    <Room building={building} onLeave={onLeave} tide={tide}>
      <Content room={room} />
    </Room>
  );
}
