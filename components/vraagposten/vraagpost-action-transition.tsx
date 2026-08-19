"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import { ReactNode } from "react";

interface VraagpostActionTransitionProps {
  /** Which action is animating — determines slide direction, icon, and overlay color. */
  variant: "confirm" | "reopen";
  /** Plays the icon-then-slide-away animation while true. */
  active: boolean;
  /** Fires once the slide-away animation has finished. */
  onComplete: () => void;
  children: ReactNode;
}

const SLIDE_DISTANCE = 480;
const TOTAL_DURATION = 1.3;
/** Fraction of TOTAL_DURATION the card holds still with the icon shown before sliding away. */
const HOLD_FRACTION = 0.45;

const VARIANT_CONFIG = {
  confirm: { icon: Check, slideDistance: SLIDE_DISTANCE, overlayClassName: "vraagpost-confirm-check" },
  reopen: { icon: ArrowLeft, slideDistance: -SLIDE_DISTANCE, overlayClassName: "vraagpost-reopen-check" },
};

export function VraagpostActionTransition({ variant, active, onComplete, children }: VraagpostActionTransitionProps) {
  const { icon: Icon, slideDistance, overlayClassName } = VARIANT_CONFIG[variant];

  return (
    <motion.div
      className="relative"
      animate={active ? { x: [0, 0, slideDistance], opacity: [1, 1, 0] } : { x: 0, opacity: 1 }}
      transition={
        active
          ? { duration: TOTAL_DURATION, times: [0, HOLD_FRACTION, 1], ease: ["linear", "easeInOut"] }
          : { duration: 0 }
      }
      onAnimationComplete={() => {
        if (active) onComplete();
      }}
    >
      {children}
      {active && (
        <motion.div
          className={overlayClassName}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          aria-hidden="true"
        >
          <Icon size={40} strokeWidth={3} />
        </motion.div>
      )}
    </motion.div>
  );
}
