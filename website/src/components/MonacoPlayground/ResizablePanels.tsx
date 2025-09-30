import React, { useEffect, useRef, useState } from "react";

interface ResizablePanelsProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLeftWidth?: number; // Percentage
  minLeftWidth?: number; // Percentage
  maxLeftWidth?: number; // Percentage
  onResize?: (leftWidth: number) => void;
}

export function ResizablePanels({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 50,
  minLeftWidth = 20,
  maxLeftWidth = 80,
  onResize,
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
    onResize?.(constrainedWidth);
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
  }, [isDragging, minLeftWidth, maxLeftWidth, onResize]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${leftWidth}%`,
          overflow: "hidden",
          paddingTop: 10,
        }}
      >
        {leftPanel}
      </div>
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: 4,
          backgroundColor: "var(--ifm-color-emphasis-300)",
          flexShrink: 0,
          cursor: "col-resize",
          zIndex: 1,
          position: "relative",
        }}
      />
      <div
        style={{
          width: `${100 - leftWidth}%`,
          overflow: "hidden",
          paddingTop: 10,
        }}
      >
        {rightPanel}
      </div>
    </div>
  );
}
