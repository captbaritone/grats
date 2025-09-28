import React from "react";

export default function ShareButton() {
  return (
    <button
      style={{}}
      onClick={async () => {
        throw new Error("Not implemented");
        // try {
        //   const urlHash = getUrlHash(store.getState());
        //   const str =
        //     window.location.origin + window.location.pathname + urlHash;
        //   await navigator.clipboard.writeText(str);
        //   alert("Copied URL to clipboard.");
        // } catch {
        //   alert("Failed to copy URL to clipboard.");
        // }
      }}
    >
      Share
    </button>
  );
}
