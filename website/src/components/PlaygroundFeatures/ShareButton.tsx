import React from "react";
import { getUrlHash } from "./store";

export default function ShareButton({ store }) {
  return (
    <button
      style={{}}
      onClick={async () => {
        try {
          const urlHash = getUrlHash(store.getState());
          const str =
            window.location.origin + window.location.pathname + urlHash;
          await navigator.clipboard.writeText(str);
          alert("Copied URL to clipboard.");
        } catch (err) {
          alert("Failed to copy URL to clipboard.");
        }
      }}
    >
      Share
    </button>
  );
}
