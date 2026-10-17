/**
 * The round cursor: a glowing ring with a dot, a gold ring over things you can enter, and a
 * filled bubble while dragging the map. Phaser uses these strings directly; React reads them
 * from CSS variables set by ``applyCursorStyles``.
 */

const cursor = (body: string, fallback: string) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, ${fallback}`;
};

export const CURSORS = {
  default: cursor(
    `<circle cx='16' cy='16' r='7' fill='rgba(127,227,224,0.18)' stroke='#04121c' stroke-width='4'/>
     <circle cx='16' cy='16' r='7' fill='none' stroke='#e9fffc' stroke-width='2'/>
     <circle cx='16' cy='16' r='1.6' fill='#e9fffc' stroke='#04121c' stroke-width='0.8'/>`,
    "auto",
  ),
  hover: cursor(
    `<circle cx='16' cy='16' r='10' fill='rgba(240,180,60,0.22)' stroke='#04121c' stroke-width='4'/>
     <circle cx='16' cy='16' r='10' fill='none' stroke='#ffd36a' stroke-width='2'/>
     <circle cx='16' cy='16' r='2.2' fill='#ffd36a' stroke='#04121c' stroke-width='0.8'/>`,
    "pointer",
  ),
  grab: cursor(
    `<circle cx='16' cy='16' r='6' fill='rgba(127,227,224,0.55)' stroke='#04121c' stroke-width='3'/>
     <circle cx='16' cy='16' r='6' fill='none' stroke='#e9fffc' stroke-width='1.5'/>`,
    "grabbing",
  ),
} as const;

export function applyCursorStyles(): void {
  const root = document.documentElement.style;
  root.setProperty("--cursor-default", CURSORS.default);
  root.setProperty("--cursor-hover", CURSORS.hover);
}
