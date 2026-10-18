/**
 * The little lives of the city's sea creatures. Ground dwellers keep to their homes (see
 * ``CRITTER_HOMES``): crabs scuttle and pause, clams open on their pearls with a puff of bubbles,
 * starfish wobble, seahorses bob in place and octopuses hop. Swimmers roam over everything:
 * jellyfish drift up through the city, pufferfish puff up now and then, and a turtle paddles past.
 * Decoration only: nothing here affects the game.
 */

import Phaser from "phaser";
import { CRITTERS } from "../assets";
import { CRITTER_HOMES, WORLD_H, WORLD_W } from "../cityMap";
import { groundAt, type Point } from "../geometry";
import { seededRandom } from "../random";
import { DEPTH } from "./underwater";

type Rand = () => number;
type Updater = (time: number, delta: number) => void;

const between = (rand: Rand, min: number, max: number) => min + rand() * (max - min);

/** Stand a creature on its foot, sorted among the buildings and plants. */
function grounded(scene: Phaser.Scene, key: string, at: Point): Phaser.GameObjects.Sprite {
  return scene.add.sprite(at.x, at.y, key, 0).setOrigin(0.5, 1).setDepth(DEPTH.objects + at.y);
}

/** Every creature in the city. Returns the per-frame step for the swimmers. */
export function addCritters(scene: Phaser.Scene, seed = 31): Updater {
  const rand = seededRandom(seed);
  const puffs = scene.add
    .particles(0, 0, "bubbles", {
      frame: ["tiny", "small", "medium"],
      emitting: false,
      lifespan: { min: 900, max: 1500 },
      speedY: { min: -40, max: -20 },
      speedX: { min: -6, max: 6 },
      alpha: { start: 0.9, end: 0 },
    })
    .setDepth(DEPTH.particles);

  CRITTER_HOMES.crabs.forEach((home) => addCrab(scene, home, rand));
  CRITTER_HOMES.clams.forEach((home) => addClam(scene, home, rand, puffs));
  CRITTER_HOMES.starfish.forEach((home, i) => addStarfish(scene, home, rand, i % 3 === 0));
  CRITTER_HOMES.seahorses.forEach((home) => addSeahorse(scene, home, rand));
  CRITTER_HOMES.octopuses.forEach((home) => addOctopus(scene, home, rand));

  const swimmers = [
    ...Array.from({ length: 8 }, (_, i) => jellyfish(scene, rand, i % 3 === 0)),
    ...Array.from({ length: 3 }, () => pufferfish(scene, rand)),
    turtle(scene, rand),
  ];
  return (time, delta) => {
    for (const step of swimmers) step(time, delta);
  };
}

// --- On the ground --------------------------------------------------------------------------------

/** Scuttle sideways a little way, rest, and go again; never off the stone or seabed. */
function addCrab(scene: Phaser.Scene, home: Point, rand: Rand): void {
  const crab = grounded(scene, CRITTERS.crab, home);
  const wander = () => {
    const dx = (rand() < 0.5 ? -1 : 1) * between(rand, 8, 28);
    const x = Phaser.Math.Clamp(crab.x + dx, home.x - 40, home.x + 40);
    const ground = groundAt(x, crab.y - 1);
    if (ground !== "stone" && ground !== "sea") {
      scene.time.delayedCall(between(rand, 600, 1600), wander);
      return;
    }
    crab.play(CRITTERS.crab);
    scene.tweens.add({
      targets: crab,
      x,
      duration: Math.abs(x - crab.x) * 45,
      ease: "Sine.easeInOut",
      onComplete: () => {
        crab.stop().setFrame(0);
        // Snap the claws up once, like a little wave.
        scene.tweens.add({ targets: crab, scaleY: 1.15, duration: 90, yoyo: true });
        scene.time.delayedCall(between(rand, 900, 3200), wander);
      },
    });
  };
  scene.time.delayedCall(between(rand, 0, 2000), wander);
}

/** Closed, then ajar, then open on its pearl with a puff of bubbles, then shut again. */
function addClam(
  scene: Phaser.Scene,
  home: Point,
  rand: Rand,
  puffs: Phaser.GameObjects.Particles.ParticleEmitter,
): void {
  const clam = grounded(scene, CRITTERS.clam, home);
  const cycle = () => {
    clam.setFrame(1);
    scene.time.delayedCall(120, () => {
      clam.setFrame(2);
      puffs.explode(3, clam.x, clam.y - 8);
      scene.tweens.add({ targets: clam, scaleX: 1.1, scaleY: 0.92, duration: 100, yoyo: true });
    });
    scene.time.delayedCall(between(rand, 1400, 2400), () => {
      clam.setFrame(1);
      scene.time.delayedCall(120, () => clam.setFrame(0));
      scene.time.delayedCall(between(rand, 2500, 6000), cycle);
    });
  };
  scene.time.delayedCall(between(rand, 0, 5000), cycle);
}

function addStarfish(scene: Phaser.Scene, home: Point, rand: Rand, pink: boolean): void {
  const star = scene.add
    .image(home.x, home.y - 4, pink ? CRITTERS.starfishPink : CRITTERS.starfish, 0)
    .setDepth(DEPTH.objects + home.y - 20)
    .setAngle(between(rand, -30, 30));
  scene.tweens.add({
    targets: star,
    angle: star.angle + between(rand, 8, 14),
    scale: 1.08,
    duration: between(rand, 1800, 3200),
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
    delay: rand() * 2000,
  });
}

/** Bob up and down by the kelp, fin fluttering, turning round now and then. */
function addSeahorse(scene: Phaser.Scene, home: Point, rand: Rand): void {
  const horse = grounded(scene, CRITTERS.seahorse, home).play(CRITTERS.seahorse);
  scene.tweens.add({
    targets: horse,
    y: home.y - 5,
    duration: between(rand, 1400, 2200),
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  scene.time.addEvent({
    delay: between(rand, 3000, 6000),
    loop: true,
    callback: () => horse.setFlipX(!horse.flipX),
  });
}

/** Wiggle in place, and every few seconds hop with a squash on landing. */
function addOctopus(scene: Phaser.Scene, home: Point, rand: Rand): void {
  const octo = grounded(scene, CRITTERS.octopus, home).play(CRITTERS.octopus);
  const hop = () => {
    scene.tweens.chain({
      targets: octo,
      tweens: [
        { scaleX: 1.2, scaleY: 0.8, duration: 120, ease: "Quad.easeOut" },
        { y: home.y - 14, scaleX: 0.9, scaleY: 1.15, duration: 260, ease: "Quad.easeOut" },
        { y: home.y, scaleX: 1, scaleY: 1, duration: 320, ease: "Bounce.easeOut" },
      ],
      onComplete: () => scene.time.delayedCall(between(rand, 2500, 6000), hop),
    });
  };
  scene.time.delayedCall(between(rand, 500, 3000), hop);
}

// --- Swimmers -------------------------------------------------------------------------------------

/** Drift slowly upward with a sway, bell pulsing; start again below the map when gone. */
function jellyfish(scene: Phaser.Scene, rand: Rand, blue: boolean): Updater {
  const key = blue ? CRITTERS.jellyBlue : CRITTERS.jelly;
  const jelly = scene.add.sprite(0, 0, key, 0).setDepth(DEPTH.fish).setAlpha(0.88).play(key);
  jelly.anims.setProgress(rand());
  const state = {
    x: between(rand, 0, WORLD_W),
    y: between(rand, 0, WORLD_H),
    speed: between(rand, 5, 11),
    phase: rand() * Math.PI * 2,
  };
  return (time, delta) => {
    state.y -= (state.speed * delta) / 1000;
    if (state.y < -20) {
      state.y = WORLD_H + 20;
      state.x = between(rand, 0, WORLD_W);
    }
    const t = time / 1000;
    jelly.setPosition(Math.round(state.x + Math.sin(t * 0.6 + state.phase) * 10), Math.round(state.y));
  };
}

/** Cruise across slowly; now and then puff up round and spiky for a moment. */
function pufferfish(scene: Phaser.Scene, rand: Rand): Updater {
  const puffer = scene.add.sprite(0, 0, CRITTERS.puffer, 0).setDepth(DEPTH.fish);
  const state = {
    dir: rand() < 0.5 ? 1 : -1,
    x: between(rand, 0, WORLD_W),
    y: between(rand, 60, WORLD_H - 40),
    speed: between(rand, 8, 14),
    phase: rand() * Math.PI * 2,
    puffed: false,
  };
  puffer.setFlipX(state.dir < 0);
  const puff = () => {
    state.puffed = true;
    puffer.setFrame(1).setScale(0.6);
    scene.tweens.add({ targets: puffer, scale: 1, duration: 260, ease: "Back.easeOut" });
    scene.time.delayedCall(between(rand, 1200, 2000), () => {
      puffer.setFrame(0);
      state.puffed = false;
      scene.tweens.add({ targets: puffer, scaleX: { from: 1.2, to: 1 }, duration: 200 });
    });
    scene.time.delayedCall(between(rand, 4000, 9000), puff);
  };
  scene.time.delayedCall(between(rand, 1000, 6000), puff);
  return (time, delta) => {
    // A puffed-up puffer can barely swim.
    state.x += (state.dir * state.speed * (state.puffed ? 0.2 : 1) * delta) / 1000;
    if (state.x > WORLD_W + 30 || state.x < -30) {
      state.dir = -state.dir;
      state.y = between(rand, 60, WORLD_H - 40);
      puffer.setFlipX(state.dir < 0);
    }
    puffer.setPosition(Math.round(state.x), Math.round(state.y + Math.sin(time / 700 + state.phase) * 4));
  };
}

/** A sea turtle paddling across the city, then a rest out of sight before the next crossing. */
function turtle(scene: Phaser.Scene, rand: Rand): Updater {
  const sprite = scene.add.sprite(-40, 0, CRITTERS.turtle, 0).setDepth(DEPTH.fish).play(CRITTERS.turtle);
  const state = { dir: 1, x: -40, y: 200, waitMs: 1500, phase: 0 };
  const start = () => {
    state.dir = rand() < 0.5 ? 1 : -1;
    state.x = state.dir > 0 ? -30 : WORLD_W + 30;
    state.y = between(rand, 80, WORLD_H - 80);
    sprite.setFlipX(state.dir < 0);
  };
  start();
  return (time, delta) => {
    if (state.waitMs > 0) {
      state.waitMs -= delta;
      return;
    }
    state.x += (state.dir * 16 * delta) / 1000;
    if (state.x > WORLD_W + 40 || state.x < -40) {
      start();
      state.waitMs = between(rand, 4000, 9000);
    }
    sprite.setPosition(Math.round(state.x), Math.round(state.y + Math.sin(time / 900) * 6));
  };
}
