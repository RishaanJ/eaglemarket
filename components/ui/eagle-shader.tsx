"use client";

import { MeshGradient } from "@paper-design/shaders-react";
import { useEffect, useState } from "react";
import { EagCoin } from "@/components/ui/eag-coin";

export function EagleShader({ className = "" }: { className?: string }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div className={`eagle-shader ${className}`} aria-hidden="true">
      <MeshGradient
        colors={["#075f9f", "#0d8ac4", "#8ad5f2", "#f7fbff"]}
        distortion={0.55}
        swirl={0.3}
        speed={reducedMotion ? 0 : 0.12}
        grainMixer={0}
        grainOverlay={0}
        style={{ width: "100%", height: "100%" }}
      />
      <EagCoin size="lg" className="shader-coin-mark" />
    </div>
  );
}
