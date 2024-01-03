import { getSchema } from "./../schema";
import { DocumentNode, execute } from "graphql";
const schema = getSchema();
const doc: DocumentNode = {
    kind: "Document",
    definitions: [
        {
            kind: "OperationDefinition",
            operation: "query",
            name: {
                kind: "Name",
                value: "MyQuery"
            },
            variableDefinitions: [],
            directives: [],
            selectionSet: {
                kind: "SelectionSet",
                selections: [
                    {
                        kind: "Field",
                        alias: undefined,
                        name: {
                            kind: "Name",
                            value: "me"
                        },
                        arguments: [],
                        directives: [],
                        selectionSet: {
                            kind: "SelectionSet",
                            selections: [
                                {
                                    kind: "Field",
                                    alias: undefined,
                                    name: {
                                        kind: "Name",
                                        value: "groups"
                                    },
                                    arguments: [],
                                    directives: [],
                                    selectionSet: {
                                        kind: "SelectionSet",
                                        selections: [
                                            {
                                                kind: "Field",
                                                alias: undefined,
                                                name: {
                                                    kind: "Name",
                                                    value: "name"
                                                },
                                                arguments: [],
                                                directives: [],
                                                selectionSet: {
                                                    kind: "SelectionSet",
                                                    selections: [
                                                        {
                                                            kind: "Field",
                                                            alias: undefined,
                                                            name: {
                                                                kind: "Name",
                                                                value: "description"
                                                            },
                                                            arguments: [],
                                                            directives: [],
                                                            selectionSet: undefined
                                                        },
                                                        {
                                                            kind: "Field",
                                                            alias: undefined,
                                                            name: {
                                                                kind: "Name",
                                                                value: "members"
                                                            },
                                                            arguments: [],
                                                            directives: [],
                                                            selectionSet: {
                                                                kind: "SelectionSet",
                                                                selections: [
                                                                    {
                                                                        kind: "Field",
                                                                        alias: undefined,
                                                                        name: {
                                                                            kind: "Name",
                                                                            value: "name"
                                                                        },
                                                                        arguments: [],
                                                                        directives: [],
                                                                        selectionSet: undefined
                                                                    }
                                                                ]
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        }
    ]
} as DocumentNode;
export function executeOperation() {
    return execute({ schema: schema, document: doc });
}
