"use client";

import { ColorPanels } from "@paper-design/shaders-react";
import { memo, useEffect, useState } from "react";

const MemoizedColorPanels = memo(ColorPanels);

export function HeroColorPanelVisual() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <MemoizedColorPanels
      colors={["#087fbd", "#6dd8ee", "#d9f5fb", "#7d70da"]}
      colorBack="#ffff"
      density={4.4}
      angle1={0.62}
      angle2={0.24}
      length={1.08}
      edges
      blur={0.18}
      fadeIn={0.78}
      fadeOut={0.36}
      gradient={0.48}
      speed={reducedMotion ? 0 : 0.55}
      scale={0.92}
      rotation={180}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
