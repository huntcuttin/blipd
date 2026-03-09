import { useState, useEffect, useRef } from "react";
import { createClient } from "../supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export function useSupabaseQuery<T>(
  queryFn: (supabase: SupabaseClient) => Promise<T>,
  deps: unknown[] = []
): { data: T | null; loading: boolean; error: Error | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestId = useRef(0);

  const fetch = () => {
    const id = ++requestId.current;
    const supabase = createClient();
    setLoading(true);
    setError(null);
    queryFn(supabase)
      .then((result) => {
        if (id === requestId.current) setData(result);
      })
      .catch((err) => {
        if (id === requestId.current) setError(err);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: fetch };
}
