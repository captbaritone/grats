import * as express from "express";
import { graphqlHTTP } from "express-graphql";
import { buildASTSchema } from "graphql";
import * as fs from "fs";
import * as path from "path";
import Query from "./Query";
import { extract } from "../extract";

const queryCode = fs.readFileSync(path.join(__dirname, "./Query.ts"), "utf8");

const sdl = extract(queryCode);

// Construct a schema, using GraphQL schema language
var schema = buildASTSchema(sdl);

// The root provides a resolver function for each API endpoint
var root = new Query();

var app = express();
app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
  }),
);
app.listen(4000);
console.log("Running a GraphQL API server at http://localhost:4000/graphql");
