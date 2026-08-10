export function EagCoin({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span className={`eag-coin eag-coin-${size} ${className}`} aria-label="EAG play token">
      <span className="eag-dollar" aria-hidden="true">$</span>
    </span>
  );
}
