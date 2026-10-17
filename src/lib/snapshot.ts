import type { Snapshot } from "valtio";

/**
 * Valtio snapshots are deeply readonly while consumers only read the value.
 * One documented escape point instead of scattered double assertions; callers
 * name the model type explicitly because `Snapshot<T>` is not invertible.
 */
export function snapshotValue<T>(value: Snapshot<T>): T;
export function snapshotValue<T>(value: Snapshot<T> | null | undefined): T | null | undefined;
export function snapshotValue<T>(value: Snapshot<T> | null | undefined): T | null | undefined {
  return value as unknown as T | null | undefined;
}
