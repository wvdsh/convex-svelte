import type { Value } from "convex/values";

// Internal sentinel for "skip" so we don't pass the literal string through everywhere
export const SKIP = Symbol('convex.useQuery.skip');
export type Skip = typeof SKIP;

/**
 *  args can be an object, "skip", or a closure returning either 
 **/
export function parseArgs(
  args: Record<string, Value> | 'skip' | (() => Record<string, Value> | 'skip')
): Record<string, Value> | Skip {
  if (typeof args === 'function') {
    args = args();
  }
  if (args === 'skip') return SKIP;
  return $state.snapshot(args);
}