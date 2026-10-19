/** Lightweight bus so API mutations can drive a global busy overlay (no React import). */

type Listener = (depth: number) => void;

let depth = 0;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener(depth);
}

export function subscribeMutationBusy(listener: Listener): () => void {
  listeners.add(listener);
  listener(depth);
  return () => {
    listeners.delete(listener);
  };
}

export function getMutationBusyDepth(): number {
  return depth;
}

/** Wrap a mutating request so the global spinner tracks in-flight Create/Edit/Delete. */
export function trackMutation<T>(promise: Promise<T>): Promise<T> {
  depth += 1;
  notify();
  return promise.finally(() => {
    depth = Math.max(0, depth - 1);
    notify();
  });
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Paths that should not show the global mutation spinner. */
const SKIP_BUSY_PREFIXES = ['/auth/login', '/health', '/bootstrap'];

export function shouldTrackMutationBusy(path: string, method: string): boolean {
  const m = method.toUpperCase();
  if (!MUTATING.has(m)) return false;
  const p = path.startsWith('/') ? path : `/${path}`;
  return !SKIP_BUSY_PREFIXES.some((skip) => p === skip || p.startsWith(`${skip}?`));
}
