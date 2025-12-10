-----------------
INPUT
----------------- 
/** @gqlSubscriptionField */
export function foo(): string {
  return "Hello";
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/top_level_fields/rootSubscriptionFieldNotAsyncIterable.invalid.ts:2:24 - error: Expected fields on `Subscription` to return an `AsyncIterable`. Fields on `Subscription` model a subscription, which is a stream of events. Grats expects fields on `Subscription` to return an `AsyncIterable` which can be used to model this stream.

2 export function foo(): string {
                         ~~~~~~
