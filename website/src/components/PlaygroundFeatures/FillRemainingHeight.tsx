import { useLayoutEffect, useState } from "react";
// On mount, measures the window height and current vertical offset, and
// renders children into a div that stretches to the bottom of the viewport.
export default function FillRemainingHeight({ children, minHeight }) {
  const [containerRef, setContainerRef] = useState(null);
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    if (containerRef == null) {
      return;
    }

    function updateSize() {
      const verticalOffset = containerRef.getBoundingClientRect().y;
      const available = Math.max(
        window.innerHeight - verticalOffset,
        minHeight,
      );
      setHeight(available);
    }

    updateSize();

    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [containerRef, minHeight]);

  return (
    <div style={{ height }} ref={setContainerRef}>
      {height != null && children}
    </div>
  );
}
