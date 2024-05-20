# Incremental Migration

For existing applications, a key requirement of adopting any new solution is the ability to adopt it incrementally. Below are two different strategies that can be used to incrementally adopt Grats. Click through to read detailed breakdowns and workflow guides.

- **[Schema Merging](./01-schema-merging.md)** - Incrementally move fields to Grats and run your GraphQL server against a merged schema consisting of your legacy schema with Grats' schema layered on top.
- **[Gradual Annotation](./02-gradual-annotation.md)** - Incrementally add Grats annotations to your code until all types and fields in your existing schema are also seen by Grats. End by switching all requests to use Grats.
