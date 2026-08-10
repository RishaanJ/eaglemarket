"use client";

import { GrainGradient } from "@paper-design/shaders-react";
import { useEffect, useState } from "react";

export function PortfolioGrainGradient({ className = "" }: { className?: string }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div className={className} aria-hidden="true">
      <GrainGradient
        width="100%"
        height="100%"
        fit="cover"
        colors={["#f8fbff", "#d9f2ff", "#cbd7ff", "#eadcff"]}
        colorBack="#ffffff"
        softness={0.82}
        intensity={0.28}
        noise={0.16}
        shape="corners"
        speed={reducedMotion ? 0 : 0.08}
        scale={1.05}
        rotation={8}
        offsetX={0.18}
        offsetY={0.08}
      />
    </div>
  );
}
