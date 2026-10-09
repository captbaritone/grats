import React, { useEffect, useState } from "react";
import { SANDBOX } from "./Sandbox";
import { CheckIcon, LinkIcon } from "./icons";
import styles from "./playground.module.css";

type Status = "idle" | "copied" | "failed";

export default function ShareButton() {
  const [status, setStatus] = useState<Status>("idle");
  useEffect(() => {
    if (status === "idle") return;
    const timeout = setTimeout(() => setStatus("idle"), 1600);
    return () => clearTimeout(timeout);
  }, [status]);
  return (
    <button
      className={styles.button}
      title={
        status === "copied"
          ? "Link copied"
          : status === "failed"
            ? "Couldn't copy the link"
            : "Copy a link to this playground"
      }
      aria-label="Copy a link to this playground"
      onClick={async () => {
        try {
          const urlHash = SANDBOX.getUrlHash();
          const str =
            window.location.origin + window.location.pathname + urlHash;
          await navigator.clipboard.writeText(str);
          setStatus("copied");
        } catch {
          setStatus("failed");
        }
      }}
    >
      {status === "copied" ? <CheckIcon /> : <LinkIcon />}
    </button>
  );
}
