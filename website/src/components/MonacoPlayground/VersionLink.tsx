import React from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import styles from "./playground.module.css";

/** The commit of Grats the playground runs, linked on GitHub. */
export default function VersionLink() {
  const { gitHash } = useDocusaurusContext().siteConfig.customFields as {
    gitHash?: string;
  };
  if (!gitHash) return null;
  return (
    <span className={styles.version}>
      Version:{" "}
      <a
        href={`https://github.com/captbaritone/grats/tree/${gitHash}`}
        target="_blank"
        rel="noopener noreferrer"
        title="The version of Grats the playground is running"
      >
        {gitHash.slice(0, 7)}
      </a>
    </span>
  );
}
