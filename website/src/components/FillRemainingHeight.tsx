import React, { useLayoutEffect, useState } from "react";

// On mount, measures the window height and current vertical offset, and
// renders children into a div that stretches to the bottom of the viewport.
export default function FillRemainingHeight({
  children,
  minHeight,
}: {
  children: React.ReactNode;
  minHeight: number;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (container == null) {
      return;
    }

    const updateSize = () => {
      const verticalOffset = container.getBoundingClientRect().y;
      const available = Math.max(
        window.innerHeight - verticalOffset,
        minHeight,
      );
      setHeight(available);
    };

    updateSize();

    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [container, minHeight]);

  return (
    <div style={{ height }} ref={setContainer}>
      {height != null && children}
    </div>
  );
}
