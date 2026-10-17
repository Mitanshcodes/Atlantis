import Phaser from "phaser";
import { useEffect, useRef } from "react";
import { Boot } from "./scenes/Boot";
import { City } from "./scenes/City";

/** Wait for the pixel font so in-world signs don't render in a fallback face. */
async function fontsReady(timeoutMs = 2000): Promise<void> {
  const load = Promise.all([
    document.fonts.load('8px "Silkscreen"'),
    document.fonts.load('16px "Pixelify Sans"'),
  ]).then(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([load, timeout]);
}

/** Mounts the Phaser game in a div that fills its parent. React UI sits on top of it. */
export function PhaserGame() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: Phaser.Game | undefined;
    let cancelled = false;
    fontsReady().then(() => {
      if (cancelled || !host.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        backgroundColor: "#061a26",
        pixelArt: true,
        roundPixels: true,
        scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
        scene: [Boot, City],
      });
    });
    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, []);

  return <div ref={host} className="phaser-host" />;
}
