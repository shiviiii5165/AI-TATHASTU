type Env = Record<string, string | undefined>;

export function hostOf(url: string): string | null;
export function isLocalDatabase(url: string): boolean;
export function assertTestIsolation(url: string | undefined, env?: Env): string;
export function assertWriteAllowed(url: string | undefined, env?: Env): string;
