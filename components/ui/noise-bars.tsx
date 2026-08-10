"use client";

import { useEffect, useRef } from "react";

/** Column heights as a fraction of the canvas height — a bell curve across the full width. */
const COLUMNS = [0.3, 0.5, 0.64, 0.88, 0.64, 0.5, 0.3];

/**
 * Colour of a lit pixel as the dither density climbs from the top of a column to the bottom.
 * Pixels are drawn with alpha ≈ density, so the page's white shows through up top and the
 * columns deepen into brand blue at the baseline.
 */
const RAMP: Array<[stop: number, r: number, g: number, b: number]> = [
  [0, 168, 216, 240],
  [0.25, 110, 194, 232],
  [0.48, 46, 158, 214],
  [0.66, 20, 130, 189],
  [0.8, 13, 100, 152],
  [0.9, 10, 76, 120],
  [1, 8, 56, 92],
];

/** Colour of the dotted column rules, which read as a tint against the white base. */
const RULE = "22, 60, 104";

/** Seeded PRNG so the grain is identical on every paint instead of shimmering on resize. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleRamp(value: number) {
  const clamped = Math.min(1, Math.max(0, value));
  let i = 1;
  while (i < RAMP.length - 1 && clamped > RAMP[i][0]) i++;
  const [from, fr, fg, fb] = RAMP[i - 1];
  const [to, tr, tg, tb] = RAMP[i];
  const k = (clamped - from) / (to - from);
  return [fr + (tr - fr) * k, fg + (tg - fg) * k, fb + (tb - fb) * k];
}

/** How lit a column is at a given row: black at the top, solid at the baseline. */
function densityAt(y: number, top: number, height: number) {
  return Math.min(1, Math.max(0, (y - top) / (height - top)) ** 1.15);
}

/** Grain amount — widest through the transition band, closing to nothing at both ends. Raise for more visible dither. */
const GRAIN = 1.5;

function spreadAt(density: number) {
  return GRAIN * density * (1 - density);
}

export function NoiseBars({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let pending = 0;
    let timer = 0;
    let painted = "";

    const paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(canvas.clientWidth * dpr);
      const height = Math.round(canvas.clientHeight * dpr);
      const size = `${width}x${height}`;
      if (!width || !height || size === painted) return;
      painted = size;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const image = ctx.createImageData(width, height);
      const pixels = image.data;
      const random = mulberry32(0x5eed1a);
      const columnWidth = width / COLUMNS.length;

      COLUMNS.forEach((share, index) => {
        const left = Math.round(index * columnWidth);
        const right = Math.round((index + 1) * columnWidth);
        const top = height - share * height;
        for (let y = Math.max(0, Math.ceil(top)); y < height; y++) {
          const density = densityAt(y, top, height);
          const spread = spreadAt(density);
          const [r, g, b] = sampleRamp(0.13 + 0.87 * density);
          let offset = (y * width + left) * 4;
          for (let x = left; x < right; x++, offset += 4) {
            const alpha = density + (random() - 0.5) * spread;
            if (alpha <= 0) continue;
            pixels[offset] = r;
            pixels[offset + 1] = g;
            pixels[offset + 2] = b;
            pixels[offset + 3] = Math.min(1, alpha) * 255;
          }
        }
      });
      ctx.putImageData(image, 0, 0);

      // Dotted rule on every column edge, dropping in from whichever neighbour is taller.
      const dot = Math.max(1, Math.round(dpr));
      const stride = Math.round(7 * dpr);
      for (let edge = 0; edge <= COLUMNS.length; edge++) {
        const top = height - Math.max(COLUMNS[edge - 1] ?? 0, COLUMNS[edge] ?? 0) * height;
        const x = Math.min(width - dot, Math.round(edge * columnWidth));
        for (let y = Math.max(0, Math.ceil(top)); y < height; y += stride) {
          ctx.fillStyle = `rgba(${RULE},${(0.34 * (1 - densityAt(y, top, height))).toFixed(3)})`;
          ctx.fillRect(x, y, dot, dot * 2);
        }
      }
    };

    // Repainting every pixel is too heavy to run on each resize tick, so let a drag settle first.
    const schedule = (delay: number) => {
      clearTimeout(timer);
      cancelAnimationFrame(pending);
      timer = window.setTimeout(() => { pending = requestAnimationFrame(paint); }, delay);
    };

    schedule(0);
    const observer = new ResizeObserver(() => schedule(150));
    observer.observe(canvas);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(pending);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
