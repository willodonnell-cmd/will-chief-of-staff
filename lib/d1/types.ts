export type D1Value = null | string | number | boolean | ArrayBuffer | Uint8Array;

export type D1Result<T = unknown> = {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: unknown;
};

export type D1PreparedStatement = {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
};

export type D1Database = {
  prepare(query: string): D1PreparedStatement;
};

export function assertD1Success(result: D1Result, action: string) {
  if (!result.success) {
    throw new Error(result.error || `${action} failed.`);
  }
}
