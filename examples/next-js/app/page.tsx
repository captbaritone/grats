'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const data = useQuery(/* GraphQL */ `
    query MyQuery {
      greetings
    }
  `);

  return (
    <>
      <h1>GraphQL Data:</h1>
      <pre>{data == null ? 'Loading...' : JSON.stringify(data, null, 2)}</pre>
    </>
  );
}

function useQuery<T>(query: string, variables?: Record<string, any>) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let unmounted = false;
    fetchQuery(query, variables).then((data) => {
      if (!unmounted) {
        setData(data);
      }
    });
    return () => {
      unmounted = true;
    };
  }, [query, variables]);
  return data;
}

// Fetch a GraphQL query
async function fetchQuery(
  query: string,
  variables?: Record<string, any>,
): Promise<any> {
  const url = '/api/graphql';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const { data, errors } = await response.json();
  if (errors) {
    throw new Error(errors[0].message);
  }
  return data;
}
