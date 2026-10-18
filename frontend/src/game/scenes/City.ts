import Phaser from "phaser";
import { GENERATED, PLAYER, frameRect, type Facing, type PlacedSprite } from "../assets";
import { BUILDINGS, BUILDINGS_BY_ID, type Building, type BuildingId } from "../buildings";
import {
  BUBBLE_VENTS,
  GENERATED_DECOR,
  LAMP_LIGHTS,
  PLAYER_START,
  WORLD_H,
  WORLD_W,
  buildDecor,
  nearestWalkable,
} from "../cityMap";
import { CURSORS } from "../cursors";
import { EventBus } from "../EventBus";
import { AVATAR, avatarFrame, loadProfile, type AvatarFacing, type Profile } from "../profile";
import { addCritters } from "../fx/critters";
import { NPCS, type NpcId } from "../npcs";
import { NpcWalker } from "../npcWalkers";
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
import { CX, CY, GATE, type Point } from "../geometry";
import { seededRandom } from "../random";

const DRAG_THRESHOLD = 6; // px of pointer travel before a press becomes a pan
const CAMERA_LERP = 0.08; // how quickly the camera catches up with the player
/** The bubble hop, in ms: squash, vanish, the arrival bubble swelling, the spring out of it. */
const HOP = { squash: 60, vanish: 130, swell: 110, spring: 240 } as const;
/** Where the middle of the player is, above their feet: bubbles burst from here. */
const PLAYER_MID = 13;
/** How far to the side of someone the player stands to talk to them. */
const NPC_TALK_GAP = 20;
const ZOOMS = [1, 2, 3, 4] as const; // whole steps keep pixel art crisp
const PLATE_FONT = '"Silkscreen", monospace';
const SHADOW = { x: 4, y: 3, color: 0x0a1a22, alpha: 0.28 } as const;

/** The city: ground, decor, buildings you can walk into, and the player. */
export class City extends Phaser.Scene {
  private player!: Phaser.GameObjects.Container;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private facing: Facing = "down";
  /** The look chosen in the opening; without one, the pack's hooded walker. */
  private profile: Profile | null = loadProfile();
  private hopping = false;
  /** A building asked for mid-hop (e.g. "go to the Bank" while popping out of a door). */
  private queued?: Building;
  private walkers = new Map<NpcId, NpcWalker>();
  private talkingTo: NpcId | null = null;
  private poof!: Phaser.GameObjects.Particles.ParticleEmitter;
  private rise!: Phaser.GameObjects.Particles.ParticleEmitter;
  private inside: BuildingId | null = null;
  private hovered: BuildingId | null = null;
  private lastAnchor = "";
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
    this.createNpcs();

    addColorGrade(this);
    addLightBeams(this);
    const reef = BUILDINGS_BY_ID.black_reef.sprites[0];
    addParticles(this, [
      { x: reef.x, y: reef.y - 90 },
      { x: GATE.x, y: GATE.y }, // the Sea Gate
      { x: 170, y: WORLD_H - 30 }, // the wreck below the wall
      ...BUBBLE_VENTS,
    ]);
    this.updaters.push(addFish(this), addCritters(this));
    for (const [id, color, size, strength] of [
      ["council", 0xffe2a0, 200, 0.12],
      ["bank", 0xbaf6ff, 200, 0.12],
      ["harbor", 0xffc890, 130, 0.1],
      ["black_reef", 0x9b6bff, 170, 0.3],
    ] as const) {
      const s = BUILDINGS_BY_ID[id].sprites[0];
      addGlow(this, s.x, s.y - frameRect(s)[3] * 0.6, color, size, strength);
    }
    for (const light of LAMP_LIGHTS) addGlow(this, light.x, light.y, 0x7ff6ee, 36, 0.35);
    addGlow(this, GATE.x, GATE.y, 0x7ff6ee, 120, 0.3);

    this.fitDepthFade = addDepthFade(this);
    this.setupCamera();
    this.setupInput();

    const offs = [
      EventBus.on("building-left", (id) => this.leaveBuilding(id)),
      EventBus.on("go-to-building", (id) => this.goTo(BUILDINGS_BY_ID[id])),
      EventBus.on("npc-left", (id) => this.leaveConversation(id)),
      EventBus.on("npc-alerts", (alerts) => {
        for (const [id, walker] of this.walkers) walker.setAlert(!!alerts[id]);
      }),
      EventBus.on("profile-changed", (profile) => {
        this.profile = profile;
        this.applyLook();
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));
    EventBus.emit("city-ready");
  }

  update(time: number, delta: number): void {
    for (const step of this.updaters) step(time, delta);
    for (const walker of this.walkers.values()) walker.update(time);
    if (this.hovered) this.emitHover(this.hovered);
    this.player.setDepth(DEPTH.objects + this.player.y);
  }

  // --- World ----------------------------------------------------------------------------------

  /** A sprite stood on its foot. Solid things also cast a hard pixel shadow down and to the right. */
  private placeSprite(placed: PlacedSprite, shadow = true): Phaser.GameObjects.Image {
    if (shadow) {
      this.add
        .image(placed.x + SHADOW.x, placed.y + SHADOW.y, placed.sheet, placed.frame)
        .setOrigin(0.5, 1)
        .setTintFill(SHADOW.color)
        .setAlpha(SHADOW.alpha)
        .setDepth(DEPTH.shadows);
    }
    return this.add
      .image(placed.x, placed.y, placed.sheet, placed.frame)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.objects + placed.y);
  }

  private createDecor(): void {
    const rand = seededRandom(17);
    for (const decor of GENERATED_DECOR) {
      this.add.image(decor.x, decor.y, decor.key).setOrigin(0.5, 1).setDepth(DEPTH.objects + decor.y);
    }
    for (const decor of buildDecor()) {
      const sprite = this.placeSprite(decor, !decor.sway);
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
      .text(main.x, main.y - 4, building.name.toUpperCase(), {
        fontFamily: PLATE_FONT,
        fontSize: "8px",
        color: "#f2e6c8",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.plates + 1);
    const box = this.add.graphics().setDepth(DEPTH.plates);
    this.plates.set(building.id, { box, text });
    this.drawPlate(building.id, false);
  }

  private drawPlate(id: BuildingId, active: boolean): void {
    const { box, text } = this.plates.get(id)!;
    const w = Math.ceil(text.width) + 10;
    const h = 13;
    const x = Math.round(text.x - w / 2);
    const y = Math.round(text.y - h / 2);
    // A navy plaque with a gold rule and a hard drop shadow, like the HUD panels.
    box.clear();
    box.fillStyle(0x07141c, 0.55).fillRect(x + 1, y + 2, w, h);
    box.fillStyle(0x1a2a33, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
    box.fillStyle(active ? 0xd9a84c : 0x10293a, 1).fillRect(x, y, w, h);
    box.lineStyle(1, active ? 0xfff0b0 : 0xb8954a, 1).strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    text.setColor(active ? "#1a2a33" : "#f2e6c8");
  }

  private hover(id: BuildingId | null): void {
    this.hovered = id;
    this.lastAnchor = "";
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
    if (id) this.emitHover(id);
    else EventBus.emit("building-hover", null);
  }

  /** Tell React where the hovered building's top-right corner is on screen, when it moves. */
  private emitHover(id: BuildingId): void {
    const cam = this.cameras.main;
    const sprites = BUILDINGS_BY_ID[id].sprites;
    const right = Math.max(...sprites.map((s) => s.x + frameRect(s)[2] / 2));
    const top = Math.min(...sprites.map((s) => s.y - frameRect(s)[3]));
    const anchor = {
      x: Math.round((right - cam.worldView.x) * cam.zoom),
      y: Math.round((top - cam.worldView.y) * cam.zoom),
    };
    const key = `${id}:${anchor.x},${anchor.y}`;
    if (key === this.lastAnchor) return;
    this.lastAnchor = key;
    EventBus.emit("building-hover", id, anchor);
  }

  // --- Player ---------------------------------------------------------------------------------

  private createPlayer(): void {
    // The sheet's frames carry their own shadow, so the foot is a few pixels above the bottom.
    this.playerSprite = this.add.sprite(0, 0, PLAYER.idle.key);
    this.player = this.add.container(PLAYER_START.x, PLAYER_START.y, [this.playerSprite]);
    this.applyLook();

    // A ring of little bubbles bursting outward, and a few big ones floating up after it.
    this.poof = this.add
      .particles(0, 0, "bubbles", {
        frame: ["tiny", "small", "medium", "large", "ring"],
        emitting: false,
        lifespan: { min: 350, max: 650 },
        speed: { min: 45, max: 110 },
        angle: { min: 0, max: 360 },
        gravityY: -150,
        scale: { start: 1, end: 0.4 },
        alpha: { start: 1, end: 0 },
      })
      .setDepth(DEPTH.particles);
    this.rise = this.add
      .particles(0, 0, "bubbles", {
        frame: ["bubble", "ring", "large"],
        emitting: false,
        lifespan: { min: 700, max: 1100 },
        speedY: { min: -70, max: -35 },
        speedX: { min: -18, max: 18 },
        scale: { start: 0.5, end: 1 },
        alpha: { start: 0.9, end: 0 },
      })
      .setDepth(DEPTH.particles);
  }

  private bubbleBurst(x: number, y: number): void {
    this.poof.explode(14, x, y - PLAYER_MID);
    this.rise.explode(4, x, y - PLAYER_MID);
  }

  /** Turn toward where we're going. */
  private face(dx: number, dy: number): void {
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
    }
    this.showFacing();
  }

  /** Dress the player as their profile says (or as the hooded walker), facing the current way. */
  private applyLook(): void {
    if (this.profile) {
      this.playerSprite.stop().setTexture(AVATAR.key(this.profile.look)).setOrigin(0.5, (AVATAR.footY + 1) / AVATAR.h);
    } else {
      this.playerSprite.setTexture(PLAYER.idle.key).setOrigin(0.5, PLAYER.footY / PLAYER.frame);
    }
    this.showFacing();
  }

  private showFacing(): void {
    if (!this.profile) {
      this.playerSprite.play(`idle-${this.facing}`, true);
      return;
    }
    const facing: Record<Facing, AvatarFacing> = { down: "front", left: "left", up: "back", right: "right" };
    this.playerSprite.setFrame(avatarFrame(this.profile.robe, facing[this.facing]));
  }

  private goTo(building: Building): void {
    if (this.inside || this.talkingTo) return;
    if (this.hopping) {
      this.queued = building;
      return;
    }
    this.hopTo(building.door, () => this.enterBuilding(building.id));
  }

  // --- The cast -------------------------------------------------------------------------------

  private createNpcs(): void {
    NPCS.forEach((npc, i) => {
      const walker = new NpcWalker(this, npc, 101 + i);
      walker.sprite.on(Phaser.Input.Events.POINTER_UP, () => {
        if (!this.dragging) this.approach(walker);
      });
      this.walkers.set(npc.id, walker);
    });
  }

  /** Hop to stand beside them, then they stop and turn, and the conversation opens. */
  private approach(walker: NpcWalker): void {
    if (this.inside || this.talkingTo || this.hopping) return;
    const { x, y } = walker.sprite;
    const side = this.player.x < x ? -1 : 1;
    const spot = nearestWalkable({ x: x + side * NPC_TALK_GAP, y: y + 2 });
    walker.talkTo(spot);
    this.talkingTo = walker.npc.id;
    this.hopTo(spot, () => {
      this.face(x - this.player.x, 0);
      EventBus.emit("npc-talk", walker.npc.id);
    });
  }

  private leaveConversation(id: NpcId): void {
    if (this.talkingTo !== id) return;
    this.talkingTo = null;
    this.walkers.get(id)?.resume();
  }

  /**
   * Vanish in a burst of bubbles and pop up at the destination: squash, stretch up and fade out,
   * then a big bubble swells where we're going with the player tiny inside, and pops.
   */
  private hopTo(target: Point, onArrive?: () => void): void {
    if (this.hopping) return;
    this.hopping = true;
    const dest = nearestWalkable(target);
    // Keep the player in view; dragging the map lets go (see setupInput).
    this.cameras.main.startFollow(this.player, true, CAMERA_LERP, CAMERA_LERP);
    this.face(dest.x - this.player.x, dest.y - this.player.y);
    this.bubbleBurst(this.player.x, this.player.y);
    this.tweens.chain({
      targets: this.playerSprite,
      tweens: [
        { scaleX: 1.3, scaleY: 0.7, duration: HOP.squash, ease: "Quad.easeOut" },
        { scaleX: 0.3, scaleY: 1.5, y: -8, alpha: 0, duration: HOP.vanish, ease: "Quad.easeIn" },
      ],
      onComplete: () => this.popUp(dest, onArrive),
    });
  }

  private popUp(at: Point, onArrive?: () => void): void {
    this.player.setPosition(at.x, at.y).setAlpha(1);
    const bubble = this.add
      .image(at.x, at.y - PLAYER_MID, "bubbles", "huge")
      .setScale(0)
      .setAlpha(0.9)
      .setDepth(DEPTH.particles);
    this.tweens.chain({
      targets: bubble,
      tweens: [
        { scale: 1, duration: HOP.swell, ease: "Back.easeOut" },
        { scale: 1.35, alpha: 0, duration: 90, ease: "Quad.easeOut" },
      ],
      onComplete: () => bubble.destroy(),
    });
    this.playerSprite.setScale(0).setAlpha(1).setY(-6);
    this.tweens.chain({
      targets: this.playerSprite,
      tweens: [
        { scale: 0.55, duration: HOP.swell, ease: "Back.easeOut" },
        {
          scaleX: 1.25,
          scaleY: 0.8,
          y: 0,
          duration: 70,
          ease: "Quad.easeIn",
          onStart: () => this.bubbleBurst(at.x, at.y),
        },
        { scaleX: 1, scaleY: 1, duration: HOP.spring - 70, ease: "Back.easeOut" },
      ],
      onComplete: () => {
        this.hopping = false;
        onArrive?.();
        const next = this.queued;
        this.queued = undefined;
        if (next) this.goTo(next);
      },
    });
  }

  private enterBuilding(id: BuildingId): void {
    this.inside = id;
    this.hover(null);
    this.tweens.add({ targets: this.player, alpha: 0, duration: 200 });
    EventBus.emit("building-entered", id);
  }

  /** Step back out of the door in a pop of bubbles. */
  private leaveBuilding(id: BuildingId): void {
    if (this.inside !== id) return;
    this.inside = null;
    this.hopping = true;
    this.popUp(BUILDINGS_BY_ID[id].door);
  }

  // --- Camera and input -----------------------------------------------------------------------

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H).setRoundPixels(true).setBackgroundColor("#0d2431");
    // ?overview shows the whole map at once (for layout checks; not pixel-perfect).
    const overview = new URLSearchParams(window.location.search).has("overview");
    // The smallest whole zoom whose view still fits inside the city, so no edge ever shows.
    const minZoom = () => Math.ceil(Math.max(this.scale.width / WORLD_W, this.scale.height / WORLD_H));
    const fit = () => {
      if (overview) cam.setBounds(-WORLD_W, -WORLD_H, WORLD_W * 3, WORLD_H * 3);
      const zoom = overview ? Math.min(this.scale.width / WORLD_W, this.scale.height / WORLD_H) : 0;
      cam.setZoom(zoom || Math.max(minZoom(), 2));
      if (overview) cam.centerOn(CX, WORLD_H / 2);
      this.fitDepthFade();
    };
    fit();
    if (!overview) cam.centerOn(CX, CY + 70);
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
      if (!this.dragging) {
        this.input.setDefaultCursor(CURSORS.grab);
        cam.stopFollow();
      }
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
        if (wasDrag || over.length || this.inside || this.talkingTo) return;
        this.hopTo({ x: p.worldX, y: p.worldY });
      },
    );
  }
}
