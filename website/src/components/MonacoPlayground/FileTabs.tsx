import React from "react";
import clsx from "clsx";
import { FlaskIcon } from "./icons";
import styles from "./playground.module.css";

const EXPERIMENTAL =
  "Experimental: this file may change, or go away, in future versions of Grats.";

export type FileTab<Id extends string> = {
  id: Id;
  name: string;
  icon: React.ReactNode;
  /** Shown on hover. */
  description: string;
  experimental?: boolean;
};

type Props<Id extends string> = {
  tabs: FileTab<Id>[];
  active: Id;
  onSelect: (id: Id) => void;
  /** Shown at the end of the tab bar. */
  actions?: React.ReactNode;
};

/** A pane's tab bar, with a tab for each of its files. */
export default function FileTabs<Id extends string>({
  tabs,
  active,
  onSelect,
  actions,
}: Props<Id>) {
  return (
    <div className={styles.tabBar}>
      <div className={styles.tabs} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === active}
            title={
              tab.experimental
                ? `${tab.description}\n\n${EXPERIMENTAL}`
                : tab.description
            }
            className={clsx(styles.tab, tab.id === active && styles.tabActive)}
            onClick={() => onSelect(tab.id)}
          >
            {tab.icon}
            {tab.name}
            {tab.experimental && (
              <span
                className={styles.experimental}
                role="img"
                aria-label="Experimental"
                title={EXPERIMENTAL}
              >
                <FlaskIcon size={14} />
              </span>
            )}
          </button>
        ))}
      </div>
      {actions && <div className={styles.tabActions}>{actions}</div>}
    </div>
  );
}
