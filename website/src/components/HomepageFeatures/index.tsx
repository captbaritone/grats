import React from "react";
import styles from "./styles.module.css";
import GratsCode from "../GratsCode";
import HomepageExample from "!!raw-loader!./snippets/homepageExample.out";
import HomepageExampleFP from "!!raw-loader!./snippets/homepageExampleFP.out";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";

export default function HomepageFeatures(): JSX.Element {
  if (true) {
    // While we are in development, we don't want to show the homepage
    return null;
  }
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          <div>
            <h2>Implementation-First</h2>
            <p>
              Grats is a tool for statically infering GraphQL schema from your
              vanilla TypeScript code.
            </p>
            <p>
              Just write your types and resolvers as regular TypeScript and
              annotate your types and fields with simple JSDoc tags. From there,
              Grats can extract your GraphQL schema automatically by statically
              analyzing your code and its types. No convoluted directive APIs to
              remember. No need to define your Schema at runtime with verbose
              builder APIs.
            </p>

            <p>
              By making your TypeScript implementation the source of truth, you
              entirely remove the question of mismatches between your
              implementation and your GraphQL schema definition. Your
              implementation _is_ the schema definition!
            </p>

            <h2> Examples</h2>

            <p>
              Grats is flexible enough to work with both class-based and
              functional approaches to authoring GraphQL types and resolvers.
            </p>
          </div>
          <div>
            <Tabs>
              <TabItem value="oop" label="Classes" default>
                <GratsCode out={HomepageExample} mode="ts" />
              </TabItem>
              <TabItem value="fp" label="Functional">
                <GratsCode out={HomepageExampleFP} mode="ts" />
              </TabItem>
            </Tabs>
          </div>
          <div>
            <GratsCode out={HomepageExample} mode="gql" />
          </div>
        </div>
      </div>
    </section>
  );
}
