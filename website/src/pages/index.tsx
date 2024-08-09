import React from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";

import HomepageFeatures from "@site/src/components/HomepageFeatures";

import styles from "./index.module.css";
import { GratsLogo } from "./logo";

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <h1 className={clsx("hero__title", styles.titleShadow)}>
          {siteConfig.title}
        </h1>
        <p className={clsx("hero__subtitle", styles.titleShadow)}>
          {siteConfig.tagline}
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "2em" }}>
          <div className={styles.buttons}>
            <Link
              className="button button--secondary button--lg"
              to="/docs/getting-started/quick-start"
            >
              Quick Start
            </Link>
          </div>
          <div className={styles.buttons}>
            <Link
              className="button button--secondary button--lg"
              to="/playground"
            >
              Playground
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Implementation-First GraphQL for TypeScript"
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
