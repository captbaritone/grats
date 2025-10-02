import React from "react";
import LogoSvg from "@site/static/img/logo.svg";

/**
 * A loading animation component that shows the Grats logo with a spinning animation.
 * Used when Monaco editor or worker processes are loading.
 */
export function LoadingFallback() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        width: "100%",
        fontSize: 24,
        color: "var(--ifm-color-primary)",
      }}
    >
      <div
        style={{
          width: 140,
          height: 140,
          position: "relative",
        }}
      >
        <LogoSvg
          style={{
            // Mute the colors a bit
            // filter: "grayscale(60%)",
            animation: "spinPulse 2s linear infinite",
          }}
        />
      </div>
    </div>
  );
}