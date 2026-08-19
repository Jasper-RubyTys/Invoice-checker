"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualTableProps<T> {
  items: T[];
  head: ReactNode;
  colSpan: number;
  renderRow: (item: T, index: number) => ReactNode;
  rowHeight?: number;
  maxHeight?: number;
}

/**
 * A `<table>` that only mounts the rows near the viewport, so a file with
 * tens of thousands of invoice lines doesn't freeze the tab building (and
 * later reflowing) one `<tr>` per line. Falls back to rendering every row
 * during window.print() — the print stylesheet expects the full table to be
 * in the DOM (it un-collapses sections and removes scroll clipping), and a
 * virtualized table would otherwise print only whatever page happened to be
 * scrolled into view.
 */
export function VirtualTable<T>({
  items,
  head,
  colSpan,
  renderRow,
  rowHeight = 34,
  maxHeight = 480,
}: VirtualTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  let rows: ReactNode;
  if (isPrinting) {
    rows = items.map((item, index) => renderRow(item, index));
  } else {
    const virtualRows = virtualizer.getVirtualItems();
    const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
    const paddingBottom =
      virtualRows.length > 0 ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

    rows = (
      <>
        {paddingTop > 0 && (
          <tr aria-hidden="true">
            <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: "none" }} />
          </tr>
        )}
        {virtualRows.map((virtualRow) => renderRow(items[virtualRow.index], virtualRow.index))}
        {paddingBottom > 0 && (
          <tr aria-hidden="true">
            <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: "none" }} />
          </tr>
        )}
      </>
    );
  }

  return (
    <div ref={scrollRef} className="virtual-table-scroll" style={isPrinting ? undefined : { maxHeight }}>
      <table className="breakdown-table">
        <thead>{head}</thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}
