import { ButtonHTMLAttributes } from "react";

type Variant = "ruby" | "secondary" | "ghost" | "danger" | "highlight";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "ruby",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`btn ${variant} ${size} ${className}`.trim()}
      {...props}
    />
  );
}
