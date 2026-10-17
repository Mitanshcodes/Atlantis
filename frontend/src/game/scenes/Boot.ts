import Phaser from "phaser";
import { FRAMES, GENERATED, SHEETS, TILE, type Rect } from "../assets";
import { drawGlints, drawGround } from "../ground";
import { seededRandom } from "../random";

/** Loads every sheet, names its frames, draws the generated textures, then starts the city. */
export class Boot extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    this.load.spritesheet("terrain", SHEETS.terrain, { frameWidth: TILE, frameHeight: TILE });
    for (const [key, url] of Object.entries(SHEETS)) {
      if (key !== "terrain") this.load.image(key, url);
    }
  }

  create(): void {
    for (const [sheet, frames] of Object.entries(FRAMES)) {
      const texture = this.textures.get(sheet);
      for (const [name, [x, y, w, h]] of Object.entries(frames as Record<string, Rect>)) {
        texture.add(name, 0, x, y, w, h);
      }
    }
    drawPlayer(this);
    drawFish(this);
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

/** Draw a pixel map: one string per row, one palette letter per pixel, "." for transparent. */
function pixelTexture(scene: Phaser.Scene, key: string, rows: string[], palette: Record<string, string>): void {
  const { texture, ctx } = canvas(scene, key, rows[0].length, rows.length);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  texture.refresh();
}

/**
 * Placeholder diver until the character pack arrives: 12 x 20, facing right.
 * Each string is a row; letters index the palette, "." is transparent.
 */
function drawPlayer(scene: Phaser.Scene): void {
  const rows = [
    "....hhhh....",
    "...hhhhhh...",
    "...hssssh...",
    "...sseses...",
    "...ssssss...",
    "....ssss....",
    "...gtttg....",
    "..ttttttt...",
    "..tttgttts..",
    "..stttttts..",
    "..s.ttttt...",
    "....bbbbb...",
    "....ttttt...",
    "....tt.tt...",
    "....tt.tt...",
    "....ll.ll...",
    "....ll.ll...",
    "....ll.ll...",
    "...ooo.ooo..",
    "............",
  ];
  const palette: Record<string, string> = {
    h: "#2a1b14", // hair
    s: "#c98a5a", // skin
    e: "#1a1010", // eyes
    t: "#2bb3c0", // tunic
    g: "#f0b43c", // gold trim
    b: "#8a5a2b", // belt
    l: "#3b2a20", // legs
    o: "#5b3a22", // sandals
  };
  pixelTexture(scene, GENERATED.player, rows, palette);
}

function drawFish(scene: Phaser.Scene): void {
  const schemes: Array<[string, string]> = [
    ["#f0b43c", "#c27d1c"],
    ["#7fe3e0", "#2bb3c0"],
    ["#e8624a", "#b23a2a"],
  ];
  const rows = ["..BBBB..", "TBbbbbB.", "TTbbbbeB", "TBbbbbB.", "..BBBB.."];
  GENERATED.fish.forEach((key, i) => {
    const [body, back] = schemes[i];
    pixelTexture(scene, key, rows, { b: body, B: back, T: back, e: "#10202a" });
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
  g.addColorStop(0, "rgba(14, 40, 140, 0.55)");
  g.addColorStop(0.35, "rgba(20, 70, 170, 0.18)");
  g.addColorStop(0.6, "rgba(20, 90, 170, 0)");
  g.addColorStop(1, "rgba(60, 230, 220, 0.10)");
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
