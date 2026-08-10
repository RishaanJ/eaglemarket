"use client";

import { Dithering } from "@paper-design/shaders-react";
import { memo, useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";

const MemoizedDithering = memo(Dithering);

export function DitherCardFrame({ children, icon: Icon, color, className = "" }: { children: ReactNode; icon: ComponentType<SVGProps<SVGSVGElement>>; color: string; className?: string }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div className={`dither-card-frame ${className}`} style={{ color }}>
      <div className="dither-card-art" style={{ color }}>
        <Icon className="dither-category-icon" strokeWidth={1.15} />
        <MemoizedDithering
          colorBack="#ffffff00"
          colorFront={color}
          shape="wave"
          type="4x4"
          size={4}
          speed={reducedMotion ? 0 : 0.08}
          scale={0.72}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      </div>
      <div className="dither-card-content">{children}</div>
    </div>
  );
}
