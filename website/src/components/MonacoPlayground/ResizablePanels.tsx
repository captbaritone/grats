import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import styles from "./playground.module.css";

interface ResizablePanelsProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLeftWidth?: number; // Percentage
  minLeftWidth?: number; // Percentage
  maxLeftWidth?: number; // Percentage
}

export function ResizablePanels({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 50,
  minLeftWidth = 20,
  maxLeftWidth = 80,
}: ResizablePanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLeftWidth =
      ((e.clientX - containerRect.left) / containerRect.width) * 100;

    // Constrain between min and max
    const constrainedWidth = Math.min(
      Math.max(newLeftWidth, minLeftWidth),
      maxLeftWidth,
    );
    setLeftWidth(constrainedWidth);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  return (
    <div ref={containerRef} className={styles.panels}>
      <div className={styles.panel} style={{ width: `${leftWidth}%` }}>
        {leftPanel}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className={clsx(styles.divider, isDragging && styles.dividerActive)}
      />
      <div className={styles.panel} style={{ width: `${100 - leftWidth}%` }}>
        {rightPanel}
      </div>
    </div>
  );
}
