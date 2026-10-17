/**
 * Everything that makes the city read as underwater: caustic light on the seabed, a blue-green
 * colour grade, slanted light shafts, rising bubbles, drifting marine snow, schools of fish and
 * swaying kelp. All of it is decoration: nothing here affects the game.
 */

import Phaser from "phaser";
import { GENERATED } from "../assets";
import { WORLD_H, WORLD_W } from "../cityMap";
import { WATER_MASK_SCALE } from "../ground";
import { seededRandom } from "../random";

/** Effects scale with the world so density looks the same at any size. */
const AREA = (WORLD_W * WORLD_H) / (1024 * 640);

/**
 * Draw order for the whole city. Objects sort by their foot y on top of DEPTH.objects, so every
 * layer above them must sit above objects + the world's height.
 */
export const DEPTH = {
  ground: 0,
  shimmer: 0.5,
  caustics: 1,
  shadows: 2,
  objects: 10,
  fish: 10_000,
  tint: 10_100,
  glow: 10_105,
  beams: 10_110,
  particles: 10_120,
  plates: 10_200,
  depthFade: 10_300,
} as const;

const isWebGL = (scene: Phaser.Scene) => scene.game.renderer.type === Phaser.WEBGL;

/** Two copies of the caustics web drifting in different directions over the seabed. */
export function addCaustics(scene: Phaser.Scene): (delta: number) => void {
  const layers = [
    { alpha: 0.13, scale: 1.5, vx: 6, vy: 3 },
    { alpha: 0.09, scale: 2.5, vx: -4, vy: 5 },
  ].map((cfg) => ({
    ...cfg,
    sprite: scene.add
      .tileSprite(0, 0, WORLD_W, WORLD_H, GENERATED.caustics)
      .setOrigin(0)
      .setTileScale(cfg.scale)
      .setAlpha(cfg.alpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.caustics),
  }));
  return (delta) => {
    const s = delta / 1000;
    for (const layer of layers) {
      layer.sprite.tilePositionX += layer.vx * s;
      layer.sprite.tilePositionY += layer.vy * s;
    }
  };
}

/**
 * The turquoise wash over the whole city: a light aqua multiply that keeps colours bright, a
 * teal lift so shadows read as water rather than black, and a soft vignette.
 */
export function addColorGrade(scene: Phaser.Scene): void {
  scene.add
    .rectangle(0, 0, WORLD_W, WORLD_H, 0xa6ecf2)
    .setOrigin(0)
    .setBlendMode(Phaser.BlendModes.MULTIPLY)
    .setDepth(DEPTH.tint);
  scene.add
    .rectangle(0, 0, WORLD_W, WORLD_H, 0x0b5f78)
    .setOrigin(0)
    .setAlpha(0.16)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(DEPTH.tint);
  if (isWebGL(scene)) {
    scene.cameras.main.postFX.addVignette(0.5, 0.5, 0.95, 0.22);
  }
}

/** Light dashes drifting along the canals, clipped to the water. WebGL only (bitmap masks). */
export function addWaterShimmer(scene: Phaser.Scene): (delta: number) => void {
  if (!isWebGL(scene)) return () => undefined;
  const maskImage = scene.make
    .image({ x: 0, y: 0, key: GENERATED.waterMask, add: false })
    .setOrigin(0)
    .setScale(WATER_MASK_SCALE);
  const layers = [
    { alpha: 0.55, vx: 9, vy: 2, scale: 1 },
    { alpha: 0.35, vx: -6, vy: -3, scale: 2 },
  ].map((cfg) => {
    const sprite = scene.add
      .tileSprite(0, 0, WORLD_W, WORLD_H, GENERATED.glints)
      .setOrigin(0)
      .setTileScale(cfg.scale)
      .setAlpha(cfg.alpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.shimmer);
    sprite.setMask(maskImage.createBitmapMask());
    return { ...cfg, sprite };
  });
  return (delta) => {
    const s = delta / 1000;
    for (const layer of layers) {
      layer.sprite.tilePositionX += layer.vx * s;
      layer.sprite.tilePositionY += layer.vy * s;
    }
  };
}

/**
 * Cobalt deepening toward the top of the screen, like looking down into the ocean. Fixed to the
 * camera; call the returned function after any zoom or resize so it keeps covering the view.
 */
export function addDepthFade(scene: Phaser.Scene): () => void {
  const fade = scene.add.image(0, 0, GENERATED.depth).setScrollFactor(0).setDepth(DEPTH.depthFade);
  const fit = () => {
    const cam = scene.cameras.main;
    fade
      .setPosition(cam.width / 2, cam.height / 2)
      .setDisplaySize(cam.width / cam.zoom + 2, cam.height / cam.zoom + 2);
  };
  fit();
  return fit;
}

/** Shafts of light slanting down from the surface, slowly breathing. */
export function addLightBeams(scene: Phaser.Scene, seed = 3): void {
  const rand = seededRandom(seed);
  for (let i = 0; i < Math.round(6 * Math.sqrt(AREA)); i++) {
    const beam = scene.add
      .image(60 + rand() * (WORLD_W - 120), -40, GENERATED.beam)
      .setOrigin(0.5, 0)
      .setAngle(18 + rand() * 8)
      .setScale(0.7 + rand() * 1.1, (WORLD_H + 120) / 320)
      .setAlpha(0)
      .setTint(0xbaf6ff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.beams);
    const peak = 0.12 + rand() * 0.1;
    scene.tweens.add({
      targets: beam,
      alpha: { from: peak * 0.3, to: peak },
      x: beam.x + 20 + rand() * 30,
      duration: 4000 + rand() * 4000,
      delay: rand() * 3000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}

/** Bubbles rising from the seabed and from a few vents, plus slow-falling marine snow. */
export function addParticles(scene: Phaser.Scene, vents: Array<{ x: number; y: number }>): void {
  scene.add
    .particles(0, 0, "bubbles", {
      frame: ["tiny", "small", "medium", "large"],
      x: { min: 0, max: WORLD_W },
      y: WORLD_H + 8,
      lifespan: { min: 12000, max: 20000 },
      speedY: { min: -40, max: -20 },
      speedX: { min: -6, max: 6 },
      alpha: { start: 0.8, end: 0 },
      frequency: 320 / AREA,
    })
    .setDepth(DEPTH.particles);

  for (const vent of vents) {
    scene.add
      .particles(vent.x, vent.y, "bubbles", {
        frame: ["tiny", "small", "medium"],
        lifespan: { min: 3000, max: 5000 },
        speedY: { min: -30, max: -16 },
        speedX: { min: -4, max: 4 },
        alpha: { start: 0.9, end: 0 },
        frequency: 900,
        quantity: 2,
      })
      .setDepth(DEPTH.particles);
  }

  scene.add
    .particles(0, 0, GENERATED.mote, {
      x: { min: -40, max: WORLD_W },
      y: { min: -20, max: WORLD_H },
      lifespan: { min: 8000, max: 14000 },
      speedX: { min: 2, max: 8 },
      speedY: { min: 3, max: 9 },
      alpha: { start: 0.45, end: 0 },
      scale: { min: 1, max: 2 },
      frequency: 140 / AREA,
    })
    .setDepth(DEPTH.particles);
}

/** Small schools of fish crossing the city, each fish weaving a little on its own. */
export function addFish(scene: Phaser.Scene, seed = 5): (time: number, delta: number) => void {
  const rand = seededRandom(seed);
  const schools = Array.from({ length: Math.round(5 * AREA) }, () => {
    const dir = rand() < 0.5 ? 1 : -1;
    const texture = GENERATED.fish[Math.floor(rand() * GENERATED.fish.length)];
    const fish = Array.from({ length: 3 + Math.floor(rand() * 5) }, () => ({
      sprite: scene.add.image(0, 0, texture).setDepth(DEPTH.fish).setFlipX(dir < 0),
      dx: (rand() - 0.5) * 36,
      dy: (rand() - 0.5) * 18,
      phase: rand() * Math.PI * 2,
    }));
    return {
      dir,
      fish,
      x: rand() * WORLD_W,
      y: 40 + rand() * (WORLD_H - 80),
      speed: 14 + rand() * 18,
      phase: rand() * Math.PI * 2,
    };
  });

  return (time, delta) => {
    const t = time / 1000;
    for (const school of schools) {
      school.x += school.dir * school.speed * (delta / 1000);
      if (school.x > WORLD_W + 60 || school.x < -60) {
        school.dir = rand() < 0.5 ? 1 : -1;
        school.x = school.dir > 0 ? -50 : WORLD_W + 50;
        school.y = 40 + rand() * (WORLD_H - 80);
        for (const f of school.fish) f.sprite.setFlipX(school.dir < 0);
      }
      const sway = Math.sin(t * 0.7 + school.phase) * 8;
      for (const f of school.fish) {
        f.sprite.setPosition(
          Math.round(school.x + f.dx + Math.sin(t * 2 + f.phase) * 1.5),
          Math.round(school.y + f.dy + sway + Math.sin(t * 3 + f.phase) * 1),
        );
      }
    }
  };
}

/** Kelp and anemones lean back and forth in the current. Origin must be at the foot. */
export function sway(scene: Phaser.Scene, sprite: Phaser.GameObjects.Image, rand: () => number): void {
  const amp = 2 + rand() * 3;
  scene.tweens.add({
    targets: sprite,
    angle: { from: -amp, to: amp },
    duration: 2200 + rand() * 1800,
    delay: rand() * 2000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}

/** A soft pulsing light, drawn over the colour grade so it glows. */
export function addGlow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  size: number,
  strength: number,
): void {
  const glow = scene.add
    .image(x, y, GENERATED.glow)
    .setTint(color)
    .setDisplaySize(size, size)
    .setAlpha(strength)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(DEPTH.glow);
  scene.tweens.add({
    targets: glow,
    alpha: strength * 0.6,
    duration: 2400,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}
