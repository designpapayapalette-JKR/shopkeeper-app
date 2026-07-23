import { useCallback, useRef } from "react";

interface OptimisticState<T> {
  data: T;
  prevData: T;
  committed: boolean;
}

// Wraps an async mutation (POST/PUT/PATCH/DELETE) with optimistic UI
// updates: applies the change immediately via `setData`, runs the mutation,
// and rolls back to `prevData` on failure. The rollback is automatic and
// cannot be cancelled — callers should check the returned `error` and show
// a toast/snackbar rather than trying to re-render the previous state
// manually (which rollback already handles).
export function useOptimisticMutation<T>(
  setData: React.Dispatch<React.SetStateAction<T>>
) {
  const stateRef = useRef<OptimisticState<T> | null>(null);

  const mutate = useCallback(
    async <R>(
      optimisticUpdate: (prev: T) => T,
      mutation: () => Promise<R>
    ): Promise<{ data: R | null; error: unknown }> => {
      let prevData: T | null = null;

      setData((current) => {
        prevData = current;
        const optimistic = optimisticUpdate(current);
        stateRef.current = { data: optimistic, prevData, committed: false };
        return optimistic;
      });

      try {
        const result = await mutation();
        if (stateRef.current) {
          stateRef.current.committed = true;
        }
        return { data: result, error: null };
      } catch (error) {
        if (stateRef.current && !stateRef.current.committed) {
          setData(() => stateRef.current!.prevData as T);
        }
        stateRef.current = null;
        return { data: null, error };
      }
    },
    [setData]
  );

  return mutate;
}

// Non-hook version for use outside components (e.g. in context providers).
// Caller manages their own rollback logic.
export async function optimisticMutate<T, R>(
  currentData: T,
  optimisticUpdate: (prev: T) => T,
  mutation: () => Promise<R>,
  rollback: () => void
): Promise<{ data: R | null; error: unknown }> {
  try {
    const result = await mutation();
    return { data: result, error: null };
  } catch (error) {
    rollback();
    return { data: null, error };
  }
}
