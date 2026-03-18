"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export function useSupabaseQuery<T>(
  queryFn: (supabase: SupabaseClient<Database>) => Promise<T>,
  deps: unknown[] = []
): { data: T | null; loading: boolean; error: Error | null; refetch: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestId = useRef(0);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const execute = useCallback(async () => {
    const id = ++requestId.current;
    const supabase = createClient();
    setLoading(true);
    setError(null);
    try {
      const result = await queryFnRef.current(supabase);
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current) setError(err as Error);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: execute };
}
