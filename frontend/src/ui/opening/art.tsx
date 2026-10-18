/**
 * Pixel art for the opening: the player's avatar (from the opening's atlases), a class's workplace
 * scene with the avatar standing in it, and Chelo, the turtle who tells the story (drawn in code,
 * since no pack has her). Everything scales by whole pixels with image-rendering: pixelated.
 */

import { useEffect, useRef, useState } from "react";
import { AVATAR, avatarFrame, type AvatarFacing, type Look, type Robe } from "../../game/profile";

export function Avatar({
  look,
  robe,
  facing = "front",
  scale = 4,
  className = "",
}: {
  look: Look;
  robe: Robe;
  facing?: AvatarFacing;
  scale?: number;
  className?: string;
}) {
  const frame = avatarFrame(robe, facing);
  return (
    <span
      className={`pixel avatar ${className}`}
      role="img"
      aria-label={`${look} in a ${robe} robe`}
      style={{
        width: AVATAR.w * scale,
        height: AVATAR.h * scale,
        backgroundImage: `url(${AVATAR.url(look)})`,
        backgroundSize: `${AVATAR.w * 4 * scale}px ${AVATAR.h * 4 * scale}px`,
        backgroundPosition: `-${(frame % 4) * AVATAR.w * scale}px -${Math.floor(frame / 4) * AVATAR.h * scale}px`,
      }}
    />
  );
}

/** A 64 x 56 workplace scene with the avatar on its empty floor (scene feet row 47). */
export const SCENE = { w: 64, h: 56, footY: 47 } as const;

export function ClassScene({ scene, look, robe, scale }: { scene: string; look: Look; robe: Robe; scale: number }) {
  return (
    <span className="pixel class-scene" style={{ width: SCENE.w * scale, height: SCENE.h * scale }}>
      <img src={`assets/opening/scenes/${scene}.png`} alt="" width={SCENE.w * scale} height={SCENE.h * scale} />
      <span
        className="class-scene__avatar"
        style={{ left: ((SCENE.w - AVATAR.w) / 2) * scale, top: (SCENE.footY - AVATAR.footY) * scale }}
      >
        <Avatar look={look} robe={robe} scale={scale} />
      </span>
    </span>
  );
}

// --- Chelo --------------------------------------------------------------------------------------

const CHELO_W = 40;
const CHELO_H = 27;
const PALETTE = {
  outline: "#173226",
  shellLight: "#c9d36a",
  shell: "#9db04a",
  shellDark: "#6f8a34",
  seam: "#4c6a2a",
  rim: "#e3d48a",
  belly: "#efe4b0",
  skinLight: "#a8e8c4",
  skin: "#78c9a0",
  skinDark: "#4f9c7c",
  eye: "#f08a2a",
  white: "#ffffff",
  cheek: "#f4a0a8",
  crown: "#f2c84a",
} as const;
type Ink = keyof typeof PALETTE;

function inside(px: number, py: number, poly: Array<[number, number]>): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Chelo as a grid of inks, paddling: frame 0 flipper down, frame 1 flipper up. */
function cheloGrid(frame: 0 | 1): (Ink | null)[][] {
  const g: (Ink | null)[][] = Array.from({ length: CHELO_H }, () => Array(CHELO_W).fill(null));
  const set = (x: number, y: number, ink: Ink) => {
    if (x >= 0 && y >= 0 && x < CHELO_W && y < CHELO_H) g[y][x] = ink;
  };
  const front: Array<[number, number]> =
    frame === 0 ? [[19, 14], [25, 14], [31, 23], [27, 24]] : [[19, 14], [25, 13], [34, 17], [32, 20]];
  const back: Array<[number, number]> = frame === 0 ? [[5, 14], [10, 14], [4, 20], [1, 19]] : [[5, 14], [10, 14], [2, 17], [1, 15]];
  for (let y = 0; y < CHELO_H; y++) {
    for (let x = 0; x < CHELO_W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (inside(px, py, front) || inside(px, py, back)) set(x, y, py > 18 ? "skinDark" : "skin");
    }
  }
  // Neck and head.
  for (let y = 0; y < CHELO_H; y++) {
    for (let x = 0; x < CHELO_W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const head = ((px - 31) / 5.6) ** 2 + ((py - 8.5) / 4.8) ** 2 <= 1;
      const neck = px > 24 && px < 30 && py > 9 && py < 14;
      if (head || neck) set(x, y, py < 7 && px < 31 ? "skinLight" : py > 11 ? "skinDark" : "skin");
    }
  }
  // Shell: a dome with a highlight, hex seams and a pale rim; the belly under it.
  const cx = 15;
  const cy = 12;
  for (let y = 0; y < CHELO_H; y++) {
    for (let x = 0; x < CHELO_W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = ((px - cx) / 12.5) ** 2 + ((py - cy) / 8.5) ** 2;
      if (d > 1) continue;
      if (py > cy + 3) {
        if (py < cy + 4.5) set(x, y, "belly");
        continue;
      }
      if (py > cy + 1.5) {
        set(x, y, "rim");
        continue;
      }
      const seam = py > cy - 4.5 && py < cy - 3.5 ? true : (Math.abs(px - cx) < 0.6 || Math.abs(px - (cx - 6.5)) < 0.6 || Math.abs(px - (cx + 6.5)) < 0.6) && py > cy - 7;
      const light = px - cx + (py - cy) * 1.4 < -9;
      set(x, y, seam ? "seam" : light ? "shellLight" : d > 0.72 ? "shellDark" : "shell");
    }
  }
  // Face: eye with a glint, a pink cheek, a small smile, and a crown of three gold beads.
  set(32, 7, "eye");
  set(33, 7, "eye");
  set(32, 8, "eye");
  set(33, 8, "white");
  set(34, 10, "cheek");
  set(35, 10, "cheek");
  set(35, 11, "skinDark");
  set(36, 11, "skinDark");
  for (const x of [28, 31, 34]) set(x, 3, "crown");
  // Outline every edge.
  const filled = g.map((row) => row.map((c) => c !== null));
  for (let y = 0; y < CHELO_H; y++) {
    for (let x = 0; x < CHELO_W; x++) {
      if (filled[y][x]) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled[y + dy]?.[x + dx]);
      if (near) g[y][x] = "outline";
    }
  }
  return g;
}

const CHELO_FRAMES = [cheloGrid(0), cheloGrid(1)];

/** Chelo, scaled by whole pixels, gently paddling. ``flip`` faces her left. */
export function Chelo({ scale = 4, flip = false, className = "" }: { scale?: number; flip?: boolean; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState<0 | 1>(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f ? 0 : 1)), 520);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CHELO_W, CHELO_H);
    CHELO_FRAMES[frame].forEach((row, y) =>
      row.forEach((ink, x) => {
        if (!ink) return;
        ctx.fillStyle = PALETTE[ink];
        ctx.fillRect(x, y, 1, 1);
      }),
    );
  }, [frame]);
  return (
    <canvas
      ref={canvas}
      className={`pixel chelo ${className}`}
      width={CHELO_W}
      height={CHELO_H}
      style={{ width: CHELO_W * scale, height: CHELO_H * scale, transform: flip ? "scaleX(-1)" : undefined }}
      role="img"
      aria-label="Chelo the turtle"
    />
  );
}

/** Text that types itself out, like Chelo talking. Click to finish the line at once. */
export function Typewriter({ text, speed = 22 }: { text: string; speed?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    const timer = setInterval(() => setShown((n) => (n >= text.length ? (clearInterval(timer), n) : n + 1)), speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return (
    <span onClick={() => setShown(text.length)} aria-label={text}>
      <span aria-hidden="true">{text.slice(0, shown)}</span>
      <span aria-hidden="true" className="typewriter__rest">
        {text.slice(shown)}
      </span>
    </span>
  );
}

export function CheloSays({ text, label = "Chelo" }: { text: string; label?: string }) {
  return (
    <div className="chelo-says">
      <p className="chelo-says__name">{label}</p>
      <p className="chelo-says__text">
        <Typewriter text={text} />
      </p>
    </div>
  );
}
