type Query = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

export const PENDING_SQL: string;
export const ENQUEUE_SQL: string;
export function enqueueIntelligence(
  query: Query,
  options?: { apply?: boolean; batch?: string },
): Promise<{ pending: number; queued: number; alreadyInBatch?: number; wouldQueue?: number }>;
export function keyFor(id: string, batch: string): string;
