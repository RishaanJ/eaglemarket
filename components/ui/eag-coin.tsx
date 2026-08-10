import Image from "next/image";

export function EagCoin({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span className={`eag-coin eag-coin-${size} ${className}`} aria-label="EAG play token">
      <Image
        className="eag-coin-image"
        src="/coin.png"
        alt=""
        fill
        sizes={size === "sm" ? "23px" : size === "md" ? "34px" : "46px"}
        aria-hidden="true"
      />
    </span>
  );
}
