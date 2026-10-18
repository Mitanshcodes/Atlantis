import Phaser from "phaser";
import { AVATAR, LOOKS } from "../profile";
import { CRITTERS, FRAMES, GENERATED, PLAYER, SHEETS, type Rect } from "../assets";
import { CRITTER_ART } from "../critterArt";
import { drawGlints, drawGround } from "../ground";
import { seededRandom } from "../random";

/** Loads every sheet, names its frames, draws the generated textures, then starts the city. */
export class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    for (const [key, url] of Object.entries(SHEETS)) this.load.image(key, url);
    this.load.spritesheet(PLAYER.idle.key, PLAYER.idle.url, { frameWidth: PLAYER.frame, frameHeight: PLAYER.frame });
    // The opening's avatars, so the player looks in the city as they chose.
    for (const look of LOOKS) {
      this.load.spritesheet(AVATAR.key(look), AVATAR.url(look), { frameWidth: AVATAR.w, frameHeight: AVATAR.h });
    }
  }

  create(): void {
    for (const [sheet, frames] of Object.entries(FRAMES)) {
      const texture = this.textures.get(sheet);
      for (const [name, [x, y, w, h]] of Object.entries(frames as Record<string, Rect>)) {
        texture.add(name, 0, x, y, w, h);
      }
    }
    createPlayerAnimations(this);
    drawLamp(this);
    drawKelpBed(this);
    drawFish(this);
    drawCritters(this);
    drawBeam(this);
    drawGlow(this);
    drawCaustics(this);
    drawGround(this);
    drawGlints(this);
    drawDepth(this);
    pixelTexture(this, GENERATED.mote, ["w"], { w: "#ffffff" });
    this.scene.start("City");
  }
}

function canvas(scene: Phaser.Scene, key: string, w: number, h: number) {
  const texture = scene.textures.createCanvas(key, w, h)!;
  return { texture, ctx: texture.getContext() };
}

/** Paint a pixel map at ``ox``: one string per row, one palette letter per pixel, "." for transparent. */
function paintRows(ctx: CanvasRenderingContext2D, rows: string[], palette: Record<string, string>, ox = 0): void {
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(ox + x, y, 1, 1);
    }),
  );
}

function pixelTexture(scene: Phaser.Scene, key: string, rows: string[], palette: Record<string, string>): void {
  const { texture, ctx } = canvas(scene, key, rows[0].length, rows.length);
  paintRows(ctx, rows, palette);
  texture.refresh();
}

/** Each sea creature becomes a strip of frames (named 0, 1, ...) and, if it has a rate, a looping animation. */
function drawCritters(scene: Phaser.Scene): void {
  for (const [name, art] of Object.entries(CRITTER_ART)) {
    const key = CRITTERS[name as keyof typeof CRITTERS];
    const w = art.frames[0][0].length;
    const h = art.frames[0].length;
    const { texture, ctx } = canvas(scene, key, w * art.frames.length, h);
    art.frames.forEach((rows, i) => {
      paintRows(ctx, rows, art.palette, i * w);
      texture.add(i, 0, i * w, 0, w, h);
    });
    texture.refresh();
    if (art.rate) {
      scene.anims.create({
        key,
        frames: art.frames.map((_, i) => ({ key, frame: i })),
        frameRate: art.rate,
        repeat: -1,
      });
    }
  }
}

/** "idle-down", "idle-left" and so on: one looping animation per sheet row. */
function createPlayerAnimations(scene: Phaser.Scene): void {
  const { key, frames } = PLAYER.idle;
  PLAYER.facings.forEach((facing, row) => {
    scene.anims.create({
      key: `idle-${facing}`,
      frames: scene.anims.generateFrameNumbers(key, { start: row * frames, end: row * frames + frames - 1 }),
      frameRate: 6,
      repeat: -1,
    });
  });
}

/** A marble lamp post with a glowing sea-glass lantern, 7 x 24. */
function drawLamp(scene: Phaser.Scene): void {
  const rows = [
    "...o...",
    "..ogo..",
    ".oLLLo.",
    ".oLlLo.",
    ".oLllo.",
    ".oLLLo.",
    "..ogo..",
    "...o...",
    "..omo..",
    "..omo..",
    "..omo..",
    "..omo..",
    "..omo..",
    "..omo..",
    "..omo..",
    "..omo..",
    "..omo..",
    "..omo..",
    "..omo..",
    ".ommmo.",
    "ommmmmo",
    "osssss.",
    "ooooooo",
    "..sss..",
  ];
  const palette: Record<string, string> = {
    o: "#1a2a33", // outline
    g: "#d9a84c", // gold cap
    L: "#5fe8e0", // lantern glass
    l: "#d8fffa", // lantern flame
    m: "#e9dcba", // marble
    s: "#00000055", // shadow
  };
  pixelTexture(scene, GENERATED.lamp, rows, palette);
}

/** One fenced bed of the kelp farm: dark silt in a timber frame, 128 x 12. */
function drawKelpBed(scene: Phaser.Scene): void {
  const w = 128;
  const h = 12;
  const { texture, ctx } = canvas(scene, GENERATED.kelpBed, w, h);
  ctx.fillStyle = "#1a2a33";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#8a5a2b";
  ctx.fillRect(1, 1, w - 2, h - 2);
  ctx.fillStyle = "#b07a3e";
  ctx.fillRect(1, 1, w - 2, 1);
  ctx.fillStyle = "#2f3b2a";
  ctx.fillRect(3, 3, w - 6, h - 6);
  ctx.fillStyle = "#3d4d33";
  for (let x = 4; x < w - 4; x += 3) ctx.fillRect(x, 4 + (x % 2), 1, 1);
  ctx.fillStyle = "#5a3a1e";
  for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 2, h);
  texture.refresh();
}

/** Five kinds of reef fish, facing right: gold, teal, coral, a striped clownfish and a blue tang. */
function drawFish(scene: Phaser.Scene): void {
  // body, back and fins, tail, stripe
  const schemes: Array<[string, string, string, string]> = [
    ["#f0b43c", "#c27d1c", "#c27d1c", "#ffd77a"],
    ["#7fe3e0", "#2b8f9c", "#2bb3c0", "#c4fff6"],
    ["#ff7a5a", "#b23a2a", "#e8573a", "#ffb09a"],
    ["#ff8a2a", "#1a2a33", "#ff8a2a", "#ffffff"],
    ["#3a7bff", "#1d3f9a", "#ffd23a", "#1d3f9a"],
  ];
  const rows = [
    "...BBBB...",
    ".TBbbsbbB.",
    "TTbbbsbbeB",
    "TTbbbsbbbB",
    ".TBbbsbbB.",
    "...BBBB...",
  ];
  GENERATED.fish.forEach((key, i) => {
    const [body, back, tail, stripe] = schemes[i];
    pixelTexture(scene, key, rows, { b: body, B: back, T: tail, s: stripe, e: "#10202a" });
  });
}

/** A soft slanted shaft of light, brightest at the top. */
function drawBeam(scene: Phaser.Scene): void {
  const w = 64;
  const h = 320;
  const { texture, ctx } = canvas(scene, GENERATED.beam, w, h);
  const fall = ctx.createLinearGradient(0, 0, 0, h);
  fall.addColorStop(0, "rgba(255,255,255,0.9)");
  fall.addColorStop(0.6, "rgba(255,255,255,0.35)");
  fall.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = fall;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, 0);
  ctx.lineTo(w * 0.7, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  // Fade the sides so the shaft has no hard edge.
  const sides = ctx.createLinearGradient(0, 0, w, 0);
  sides.addColorStop(0, "rgba(0,0,0,0)");
  sides.addColorStop(0.5, "rgba(0,0,0,1)");
  sides.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = sides;
  ctx.fillRect(0, 0, w, h);
  texture.refresh();
}

/** Looking down into the deep: cobalt at the top of the screen, clear below. */
function drawDepth(scene: Phaser.Scene): void {
  const h = 256;
  const { texture, ctx } = canvas(scene, GENERATED.depth, 4, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(8, 30, 60, 0.32)");
  g.addColorStop(0.25, "rgba(10, 50, 80, 0.08)");
  g.addColorStop(0.5, "rgba(10, 50, 80, 0)");
  g.addColorStop(1, "rgba(4, 18, 28, 0.18)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, h);
  texture.refresh();
}

function drawGlow(scene: Phaser.Scene): void {
  const size = 128;
  const { texture, ctx } = canvas(scene, GENERATED.glow, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  texture.refresh();
}

/**
 * Tileable caustics: the bright web where Voronoi cells meet, wrapped at the edges so the texture
 * repeats seamlessly. Two copies scrolling in different directions make the light dance.
 */
function drawCaustics(scene: Phaser.Scene): void {
  const size = 128;
  const rand = seededRandom(21);
  const points = Array.from({ length: 18 }, () => [rand() * size, rand() * size]);
  const { texture, ctx } = canvas(scene, GENERATED.caustics, size, size);
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let d1 = Infinity;
      let d2 = Infinity;
      for (const [px, py] of points) {
        let dx = Math.abs(x - px);
        let dy = Math.abs(y - py);
        dx = Math.min(dx, size - dx);
        dy = Math.min(dy, size - dy);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
      const edge = Math.exp(-(d2 - d1) / 2.2); // bright thin seams, soft falloff
      const i = (y * size + x) * 4;
      image.data[i] = 255;
      image.data[i + 1] = 255;
      image.data[i + 2] = 255;
      image.data[i + 3] = Math.round(edge * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  texture.refresh();
}
