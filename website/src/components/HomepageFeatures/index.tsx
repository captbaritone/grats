import React from "react";
import styles from "./styles.module.css";
import GratsCode from "../GratsCode";
import HomepageExample from "!!raw-loader!./snippets/homepageExample.out";
import HomepageExampleFP from "!!raw-loader!./snippets/homepageExampleFP.out";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import Link from "@docusaurus/Link";

export default function HomepageFeatures(): JSX.Element {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          <div className="col col--8 col--offset-2">
            <h2 className="text--center margin-bottom--xl">
              The simplest way to build a GraphQL server in TypeScript
            </h2>
          </div>
        </div>
        <div className="row">
          <div className="col">
            <h2>No Duplication</h2>
            <p>
              Your TypeScript resolvers are <i>already annotated</i> with type
              information. Grats uses those <i>existing types</i> to determine
              your GraphQL schema.
            </p>
          </div>
          <div className="col">
            <h2>No Conflicts</h2>
            <p>
              When your implementation <i>is</i> your schema, there's no need
              for clever TypeScript tricks to validate that your code and schema
              match.
            </p>
          </div>
          <div className="col">
            <h2>No Library Code</h2>
            <p>
              Grats extracts your schema at <strong>build time</strong> from
              docblock hints. No Grats code is needed at runtime.
            </p>
          </div>
          <div className="col col--8 margin-top--xl margin-bottom--xl col--offset-2">
            <Tabs>
              <TabItem value="oop" label="Object Oriented">
                <Example out={HomepageExample} />
              </TabItem>
              <TabItem value="fp" label="Functional">
                <Example out={HomepageExampleFP} />
              </TabItem>
            </Tabs>
          </div>
        </div>
        <div className="row">
          <div className="col col--10 text--right margin-bottom--xl">
            <div className={styles.buttons}>
              <Link
                className="button button--primary button--lg"
                href="https://jordaneldredge.com/blog/grats/"
              >
                Read the Blog Post ➔
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Example({ out }) {
  return (
    <>
      <GratsCode mode="ts" out={out} />
      <h3>Schema</h3>
      <GratsCode mode="gql" out={out} />
    </>
  );
}
