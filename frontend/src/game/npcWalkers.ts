/**
 * The cast on the streets. Each walker potters about in front of the building they keep: glide to
 * a nearby spot with a little bob, turn to face where they're going, pause, look about, go again.
 * While the player talks to them they stop and face the player. A gold "!" floats over anyone
 * with something new to say (which React decides from the engine state; see ``ui/npcTalk.ts``).
 */

import Phaser from "phaser";
import { GENERATED } from "./assets";
import { BUILDINGS_BY_ID } from "./buildings";
import { nearestWalkable } from "./cityMap";
import { CURSORS } from "./cursors";
import { DEPTH } from "./fx/underwater";
import { groundAt, type Point } from "./geometry";
import { NPC_VIEW, npcSheetKey, type Npc } from "./npcs";
import { seededRandom } from "./random";

const SPEED = 22; // px per second: a stroll
const ROAM = { x: 34, y: 12 } as const; // how far from their post they wander
const LABEL_FONT = '"Silkscreen", monospace';

export class NpcWalker {
  readonly sprite: Phaser.GameObjects.Sprite;
  private label: Phaser.GameObjects.Text;
  private alert: Phaser.GameObjects.Image;
  private post: Point;
  private rand: () => number;
  private move?: Phaser.Tweens.Tween;
  private next?: Phaser.Time.TimerEvent;
  private talking = false;
  private moving = false;
  private phase: number;

  constructor(
    private scene: Phaser.Scene,
    readonly npc: Npc,
    seed: number,
  ) {
    this.rand = seededRandom(seed);
    this.phase = this.rand() * Math.PI * 2;
    const door = BUILDINGS_BY_ID[npc.home].door;
    this.post = nearestWalkable({ x: door.x + npc.offset, y: door.y + 6 });
    this.sprite = scene.add
      .sprite(this.post.x, this.post.y, npcSheetKey(npc), NPC_VIEW.front)
      .setOrigin(0.5, 1)
      .setInteractive({ pixelPerfect: true, cursor: CURSORS.hover });
    this.label = scene.add
      .text(0, 0, npc.name.toUpperCase(), {
        fontFamily: LABEL_FONT,
        fontSize: "8px",
        color: "#f2e6c8",
        backgroundColor: "#10293a",
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.plates)
      .setVisible(false);
    this.alert = scene.add.image(0, 0, GENERATED.alert).setOrigin(0.5, 1).setDepth(DEPTH.plates).setVisible(false);
    this.sprite.on(Phaser.Input.Events.POINTER_OVER, () => this.label.setVisible(true));
    this.sprite.on(Phaser.Input.Events.POINTER_OUT, () => this.label.setVisible(false));
    this.wait(500 + this.rand() * 2500);
  }

  /** Called every frame: the stepping bob, depth, and the label and "!" riding along. */
  update(time: number): void {
    const bob = this.moving ? Math.abs(Math.sin(time / 110 + this.phase)) * 1.5 : 0;
    const { x, y } = this.sprite;
    this.sprite.setDepth(DEPTH.objects + y);
    this.sprite.setDisplayOrigin(this.sprite.width / 2, this.sprite.height + bob);
    const top = y - this.sprite.height - bob;
    this.label.setPosition(Math.round(x), Math.round(top - 2));
    this.alert.setPosition(Math.round(x), Math.round(top - 2 + Math.sin(time / 260 + this.phase) * 1.5));
  }

  setAlert(on: boolean): void {
    this.alert.setVisible(on && !this.talking);
  }

  /** Stop and turn to face whoever is talking to them. */
  talkTo(from: Point): void {
    this.talking = true;
    this.halt();
    this.alert.setVisible(false);
    this.face(from.x - this.sprite.x, from.y - this.sprite.y);
  }

  resume(): void {
    this.talking = false;
    this.wait(1500 + this.rand() * 1500);
  }

  private halt(): void {
    this.move?.stop();
    this.next?.remove();
    this.moving = false;
  }

  private face(dx: number, dy: number): void {
    const view =
      Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? NPC_VIEW.left : NPC_VIEW.right) : dy < 0 ? NPC_VIEW.back : NPC_VIEW.front;
    this.sprite.setFrame(view);
  }

  private wait(ms: number): void {
    this.next?.remove();
    this.next = this.scene.time.delayedCall(ms, () => this.wander());
  }

  /** Pick a spot near their post on dry, open ground and stroll there; sometimes just look about. */
  private wander(): void {
    if (this.talking) return;
    if (this.rand() < 0.3) {
      this.sprite.setFrame([NPC_VIEW.front, NPC_VIEW.left, NPC_VIEW.right][Math.floor(this.rand() * 3)]);
      this.wait(1200 + this.rand() * 2000);
      return;
    }
    const target = nearestWalkable({
      x: this.post.x + (this.rand() * 2 - 1) * ROAM.x,
      y: this.post.y + (this.rand() * 2 - 1) * ROAM.y,
    });
    const ground = groundAt(target.x, target.y);
    if (ground === "sea" || ground === "cliff" || ground === "gate") {
      this.wait(800);
      return;
    }
    const dx = target.x - this.sprite.x;
    const dy = target.y - this.sprite.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 4) {
      this.wait(800);
      return;
    }
    this.face(dx, dy);
    this.moving = true;
    this.move = this.scene.tweens.add({
      targets: this.sprite,
      x: target.x,
      y: target.y,
      duration: (distance / SPEED) * 1000,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.moving = false;
        if (this.rand() < 0.5) this.sprite.setFrame(NPC_VIEW.front);
        this.wait(1500 + this.rand() * 3500);
      },
    });
  }
}
