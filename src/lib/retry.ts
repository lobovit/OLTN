import { httpStatusOf, isTimeoutError } from "./errors";

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryIf?: (error: unknown) => boolean;
  /** Injetável para testes. */
  sleep?: (ms: number) => Promise<void>;
}

/** Reexecuta `fn` com backoff exponencial + jitter; só repete erros elegíveis. */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 10_000,
    retryIf = () => true,
    sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms)),
  } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !retryIf(error)) throw error;
      const jitter = Math.random() * baseDelayMs;
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1) + jitter, maxDelayMs);
      await sleep(delay);
    }
  }
  throw lastError;
}

/** Repetível = 5xx, timeout ou falha de rede (TypeError). 4xx nunca. */
export function isRetriable(error: unknown): boolean {
  const status = httpStatusOf(error);
  if (status != null) return status >= 500;
  return isTimeoutError(error) || error instanceof TypeError;
}
