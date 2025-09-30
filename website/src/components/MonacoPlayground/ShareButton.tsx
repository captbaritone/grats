import React from "react";
import { SANDBOX } from "./Sandbox";

export default function ShareButton() {
  return (
    <button
      style={{}}
      onClick={async () => {
        try {
          const urlHash = SANDBOX.getUrlHash();
          const str =
            window.location.origin + window.location.pathname + urlHash;
          await navigator.clipboard.writeText(str);
          alert("Copied URL to clipboard.");
        } catch {
          alert("Failed to copy URL to clipboard.");
        }
      }}
    >
      Share
    </button>
  );
}
