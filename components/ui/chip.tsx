import { HTMLAttributes } from "react";

type Tone = "gray" | "green" | "yellow" | "orange" | "red" | "teal" | "blue" | "ruby";

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Chip({ tone = "gray", className = "", ...props }: ChipProps) {
  return <span className={`chip ${tone} ${className}`.trim()} {...props} />;
}
