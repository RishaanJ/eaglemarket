"use client";

import { motion, useReducedMotion, type MotionProps } from "motion/react";
import type { ReactNode } from "react";

export function MotionReveal({
  children,
  className,
  delay = 0,
  distance = 10,
  ...props
}: MotionProps & {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.32, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
