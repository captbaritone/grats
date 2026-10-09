import React from "react";
import { Side } from "./State";
import { ArrowLeftIcon, PlayIcon } from "./icons";
import styles from "./playground.module.css";

type Props = {
  side: Side;
  setSide: (side: Side) => void;
};

/**
 * Floats in the playground's corner, above both sides, and switches between
 * the server (the code) and the client (GraphiQL).
 */
export default function SwitchSideButton({ side, setSide }: Props) {
  return (
    <button
      className={styles.switchSide}
      onClick={() => setSide(side === "server" ? "client" : "server")}
    >
      {side === "server" ? (
        <>
          <PlayIcon />
          Run a query
        </>
      ) : (
        <>
          <ArrowLeftIcon />
          Edit schema
        </>
      )}
    </button>
  );
}
