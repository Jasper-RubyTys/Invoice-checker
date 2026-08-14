"use client";

import { HTMLAttributes, ReactNode, useSyncExternalStore } from "react";
import { isCardCollapsed, setCardCollapsed, subscribeToCardCollapse } from "@/lib/card-collapse";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
  variant?: "default" | "secondary";
  collapsible?: boolean;
  /** Required when collapsible. Identifies this card's remembered state across invoices. */
  storageKey?: string;
}

export function Card({
  title,
  actions,
  variant = "default",
  collapsible = false,
  storageKey,
  className = "",
  children,
  ...props
}: CardProps) {
  const collapsed = useSyncExternalStore(
    subscribeToCardCollapse,
    () => (collapsible && storageKey ? isCardCollapsed(storageKey) : false),
    () => false,
  );

  const toggle = () => {
    if (!storageKey) return;
    setCardCollapsed(storageKey, !collapsed);
  };

  return (
    <div
      className={`card ${variant === "secondary" ? "secondary" : ""} ${className}`.trim()}
      {...props}
    >
      {(title || actions) && (
        <div
          className={`card-h ${collapsible ? "card-h-collapsible" : ""}`.trim()}
          onClick={collapsible ? toggle : undefined}
          role={collapsible ? "button" : undefined}
          tabIndex={collapsible ? 0 : undefined}
          aria-expanded={collapsible ? !collapsed : undefined}
          onKeyDown={
            collapsible
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle();
                  }
                }
              : undefined
          }
        >
          {title && <h3>{title}</h3>}
          <div className="card-h-actions" onClick={(e) => e.stopPropagation()}>
            {actions}
            {collapsible && (
              <button
                type="button"
                className="card-collapse-toggle no-print"
                onClick={toggle}
                aria-expanded={!collapsed}
                aria-label={collapsed ? "Sectie uitklappen" : "Sectie inklappen"}
              >
                <span className={`card-chevron ${collapsed ? "collapsed" : ""}`} aria-hidden="true">
                  ▾
                </span>
              </button>
            )}
          </div>
        </div>
      )}
      <div className={`card-body ${collapsible && collapsed ? "collapsed" : ""}`}>{children}</div>
    </div>
  );
}
