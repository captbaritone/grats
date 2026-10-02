# DataLoader

One well-known challenge of GraphQL relative to REST is the "N+1 problem".

The N+1 problem is a performance issue that arises when a GraphQL server resolves a query that includes a list of items. Because GraphQL servers are written in terms of decoupled resolver functions, for each item in the list, the server may need to make a separate call to the database. The overhead of these multiple calls can make the server slow to respond.

In a traditional REST server, where the query shape is hard coded, it is possible to hand-write a query which fetches all the necessary data in a single request. While this degree of optimization is not possible in GraphQL (unless you tightly couple your database and your schema), there is a mitigation strategy which is simple to employ and can solve the N+1 problem in a generalizable fashion: DataLoader.

DataLoader is a simple pattern for batching and caching data which originated inside of Facebook and was later shared with the community as a pattern with a reference implementation written in JavaScript (much like GraphQL itself).

The basic idea is that any time you want to fetch a single record from the database, instead of calling the database directly, you simply add the record's key to a queue. You then wait one turn of the event-loop. Then you batch up all the keys in the queue and fetch all the records at once. This way, you can fetch all the records you need in a single query, and you can avoid the N+1 problem.

```ts
type BatchLoader<K, V> = (keys: readonly K[]) => Promise<readonly V[]>;

type QueueItem<K, V> = {
  key: K;
  resolve: (value: V) => void;
  reject: (error: unknown) => void;
};

class DataLoader<K, V> {
  _batchLoadFn: BatchLoader<K, V>;
  _queue: QueueItem<K, V>[] = [];
  constructor(batchLoadFn: BatchLoader<K, V>) {
    this._batchLoadFn = batchLoadFn;
  }
  load(key: K): Promise<V> {
    if (this._queue.length === 0) {
      process.nextTick(() => this._dispatchQueue());
    }
    return new Promise((resolve, reject) => {
      this._queue.push({ key, resolve, reject });
    });
  }
  async _dispatchQueue(): Promise<void> {
    const queue = this._queue;
    this._queue = [];
    try {
      const values = await this._batchLoadFn(queue.map((item) => item.key));
      queue.forEach((item, i) => item.resolve(values[i]));
    } catch (error) {
      queue.forEach((item) => item.reject(error));
    }
  }
}
```

In practice, you'll likely want to use the [`dataloader`](https://github.com/graphql/dataloader) npm package, which also caches records and handles errors for individual keys. See `ViewerContext.ts` in our [Production App](../05-examples/10-production-app.md) example to see it used with Grats.

For more about the history and design of DataLoader, see [DataLoader v2](https://leebyron.com/dataloader-v2/).
