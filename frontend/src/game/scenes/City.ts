import Phaser from "phaser";
import { GENERATED, frameRect, type PlacedSprite } from "../assets";
import { BUILDINGS, BUILDINGS_BY_ID, type Building, type BuildingId } from "../buildings";
import { PLAYER_START, WORLD_H, WORLD_W, buildDecor, route } from "../cityMap";
import { CURSORS } from "../cursors";
import { EventBus } from "../EventBus";
import {
  DEPTH,
  addCaustics,
  addColorGrade,
  addDepthFade,
  addFish,
  addGlow,
  addLightBeams,
  addParticles,
  addWaterShimmer,
  sway,
} from "../fx/underwater";
import { CX, CY, polar, type Point } from "../geometry";
import { seededRandom } from "../random";

const WALK_SPEED = 140; // px per second
const DRAG_THRESHOLD = 6; // px of pointer travel before a press becomes a pan
const ZOOMS = [1, 2, 3] as const; // whole steps keep pixel art crisp
const PLATE_FONT = '"Silkscreen", monospace';

/** The city: ground, decor, buildings you can walk into, and the player. */
export class City extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private playerSprite!: Phaser.GameObjects.Image;
  private walk?: Phaser.Tweens.TweenChain;
  private inside: BuildingId | null = null;
  private buildingSprites = new Map<BuildingId, Phaser.GameObjects.Image[]>();
  private plates = new Map<BuildingId, { box: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text }>();
  private press?: { x: number; y: number; scrollX: number; scrollY: number };
  private dragging = false;
  private fitDepthFade: () => void = () => undefined;
  private updaters: Array<(time: number, delta: number) => void> = [];

  constructor() {
    super("City");
  }

  create(): void {
    this.add.image(0, 0, GENERATED.ground).setOrigin(0).setDepth(DEPTH.ground);
    const shimmer = addWaterShimmer(this);
    const caustics = addCaustics(this);
    this.updaters.push((_, delta) => {
      shimmer(delta);
      caustics(delta);
    });
    this.createDecor();
    this.createBuildings();
    this.createPlayer();

    addColorGrade(this);
    addLightBeams(this);
    addParticles(this, [
      { x: BUILDINGS_BY_ID.black_reef.door.x, y: BUILDINGS_BY_ID.black_reef.door.y - 110 },
      polar(1300, 135), // the wreck in the south-west wilds
      { x: CX - 120, y: CY + 130 }, // the rostrum
      ...[45, 135, -45, -135].map((deg) => polar(283, deg)), // the inner canal
    ]);
    this.updaters.push(addFish(this));
    for (const [id, color, size, strength] of [
      ["council", 0xffe2a0, 260, 0.2],
      ["bank", 0xbaf6ff, 260, 0.18],
      ["harbor", 0xffc890, 160, 0.12],
      ["black_reef", 0x9b6bff, 180, 0.18],
    ] as const) {
      const s = BUILDINGS_BY_ID[id].sprites[0];
      addGlow(this, s.x, s.y - frameRect(s)[3] * 0.6, color, size, strength);
    }

    this.fitDepthFade = addDepthFade(this);
    this.setupCamera();
    this.setupInput();

    const offLeft = EventBus.on("building-left", (id) => this.leaveBuilding(id));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offLeft);
    EventBus.emit("city-ready");
  }

  update(time: number, delta: number): void {
    for (const step of this.updaters) step(time, delta);
    this.player.setDepth(DEPTH.objects + this.player.y);
    const walking = this.walk?.isPlaying() ?? false;
    this.playerSprite.y = walking ? -Math.abs(Math.sin(time / 90)) * 1.5 : 0;
  }

  // --- World ----------------------------------------------------------------------------------

  private placeSprite(placed: PlacedSprite): Phaser.GameObjects.Image {
    return this.add
      .image(placed.x, placed.y, placed.sheet, placed.frame)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.objects + placed.y);
  }

  private createDecor(): void {
    const rand = seededRandom(17);
    for (const decor of buildDecor()) {
      const sprite = this.placeSprite(decor);
      if (decor.sway) sway(this, sprite, rand);
    }
  }

  private createBuildings(): void {
    for (const building of BUILDINGS) {
      const sprites = building.sprites.map((placed) => {
        const sprite = this.placeSprite(placed);
        sprite.setInteractive({ pixelPerfect: true, cursor: CURSORS.hover });
        sprite.on(Phaser.Input.Events.POINTER_OVER, () => this.hover(building.id));
        sprite.on(Phaser.Input.Events.POINTER_OUT, () => this.hover(null));
        sprite.on(Phaser.Input.Events.POINTER_UP, () => {
          if (!this.dragging) this.goTo(building);
        });
        return sprite;
      });
      this.buildingSprites.set(building.id, sprites);
      this.createPlate(building);
    }
  }

  /** A small sign at each building's base with its name. Highlights on hover. */
  private createPlate(building: Building): void {
    const main = building.sprites.reduce((a, b) => (frameRect(b)[3] > frameRect(a)[3] ? b : a));
    const text = this.add
      .text(main.x, main.y - 8, building.name.toUpperCase(), {
        fontFamily: PLATE_FONT,
        fontSize: "8px",
        color: "#f5e6c4",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.plates + 1);
    const box = this.add.graphics().setDepth(DEPTH.plates);
    this.plates.set(building.id, { box, text });
    this.drawPlate(building.id, false);
  }

  private drawPlate(id: BuildingId, active: boolean): void {
    const { box, text } = this.plates.get(id)!;
    const w = Math.ceil(text.width) + 8;
    const h = 12;
    const x = Math.round(text.x - w / 2);
    const y = Math.round(text.y - h / 2);
    box.clear();
    box.fillStyle(active ? 0x3a2a10 : 0x06283a, 0.92).fillRect(x, y, w, h);
    box.lineStyle(1, active ? 0xf0b43c : 0x6fd8d8, 1).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    text.setColor(active ? "#ffe6a0" : "#eafffb");
  }

  private hover(id: BuildingId | null): void {
    for (const [bid, sprites] of this.buildingSprites) {
      const active = bid === id;
      this.drawPlate(bid, active);
      for (const sprite of sprites) {
        if (!sprite.preFX) continue;
        sprite.preFX.clear();
        if (active) {
          sprite.preFX.setPadding(4);
          sprite.preFX.addGlow(0xffd77a, 3, 0, false, 0.1, 10);
        }
      }
    }
    EventBus.emit("building-hover", id);
  }

  // --- Player ---------------------------------------------------------------------------------

  private createPlayer(): void {
    const shadow = this.add.ellipse(0, 0, 12, 4, 0x000000, 0.25);
    this.playerSprite = this.add.image(0, 0, GENERATED.player).setOrigin(0.5, 1);
    this.player = this.add.container(PLAYER_START.x, PLAYER_START.y, [shadow, this.playerSprite]);
  }

  private goTo(building: Building): void {
    if (this.inside) return;
    this.walkTo(building.door, () => this.enterBuilding(building.id));
  }

  private walkTo(dest: Point, onArrive?: () => void): void {
    this.walk?.stop();
    let from: Point = { x: this.player.x, y: this.player.y };
    const legs = route(from, dest).map((point) => {
      const leg = {
        x: point.x,
        y: point.y,
        duration: (Phaser.Math.Distance.BetweenPoints(from, point) / WALK_SPEED) * 1000,
        ease: "Linear",
        onStart: () => {
          if (Math.abs(point.x - this.player.x) > 1) this.playerSprite.setFlipX(point.x < this.player.x);
        },
      };
      from = point;
      return leg;
    });
    if (!legs.length) {
      onArrive?.();
      return;
    }
    this.walk = this.tweens.chain({ targets: this.player, tweens: legs, onComplete: () => onArrive?.() });
  }

  private enterBuilding(id: BuildingId): void {
    this.inside = id;
    this.hover(null);
    this.tweens.add({ targets: this.player, alpha: 0, duration: 200 });
    EventBus.emit("building-entered", id);
  }

  private leaveBuilding(id: BuildingId): void {
    if (this.inside !== id) return;
    this.inside = null;
    const door = BUILDINGS_BY_ID[id].door;
    this.player.setPosition(door.x, door.y);
    this.tweens.add({ targets: this.player, alpha: 1, duration: 250 });
  }

  // --- Camera and input -----------------------------------------------------------------------

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H).setRoundPixels(true).setBackgroundColor("#0a2a6a");
    // ?overview shows the whole map at once (for layout checks; not pixel-perfect).
    const overview = new URLSearchParams(window.location.search).has("overview");
    const minZoom = () => Math.ceil(Math.max(this.scale.width, this.scale.height) / WORLD_W);
    const fit = () => {
      if (overview) cam.setBounds(-WORLD_W, -WORLD_H, WORLD_W * 3, WORLD_H * 3);
      const zoom = overview ? Math.min(this.scale.width, this.scale.height) / WORLD_W : 0;
      cam.setZoom(zoom || Math.max(minZoom(), this.scale.width >= 900 ? 2 : 1));
      if (overview) cam.centerOn(CX, CY);
      this.fitDepthFade();
    };
    fit();
    cam.centerOn(CX, CY + 40);
    this.scale.on(Phaser.Scale.Events.RESIZE, fit);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, fit));

    // The wheel zooms in whole steps, keeping the point under the cursor still.
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
        const i = ZOOMS.indexOf(cam.zoom as (typeof ZOOMS)[number]);
        const next = ZOOMS[Phaser.Math.Clamp((i < 0 ? 1 : i) + (dy > 0 ? -1 : 1), 0, ZOOMS.length - 1)];
        if (next === cam.zoom || next < minZoom()) return;
        const halfW = cam.width / 2;
        const halfH = cam.height / 2;
        const worldX = (p.x - halfW) / cam.zoom + cam.scrollX + halfW;
        const worldY = (p.y - halfH) / cam.zoom + cam.scrollY + halfH;
        cam.setZoom(next);
        cam.setScroll(worldX - (p.x - halfW) / next - halfW, worldY - (p.y - halfH) / next - halfH);
        this.fitDepthFade();
      },
    );
  }

  private setupInput(): void {
    const cam = this.cameras.main;
    this.input.setDefaultCursor(CURSORS.default);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.press = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY };
      this.dragging = false;
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (!p.isDown || !this.press) return;
      const dx = p.x - this.press.x;
      const dy = p.y - this.press.y;
      if (!this.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!this.dragging) this.input.setDefaultCursor(CURSORS.grab);
      this.dragging = true;
      cam.setScroll(this.press.scrollX - dx / cam.zoom, this.press.scrollY - dy / cam.zoom);
    });
    this.input.on(
      Phaser.Input.Events.POINTER_UP,
      (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        const wasDrag = this.dragging;
        this.press = undefined;
        this.input.setDefaultCursor(CURSORS.default);
        // Let building handlers see the drag flag first, then reset it.
        this.time.delayedCall(0, () => (this.dragging = false));
        if (wasDrag || over.length || this.inside) return;
        this.walkTo({ x: p.worldX, y: p.worldY });
      },
    );
  }
}
