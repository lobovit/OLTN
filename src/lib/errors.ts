import { t } from "../i18n/pt-BR";

/* Erros tipados + mensagens amigáveis (nunca vaza detalhes internos). */

export class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Extrai o status HTTP de um erro (nosso HttpError ou MastoHttpError). */
export function httpStatusOf(error: unknown): number | null {
  if (error instanceof HttpError) return error.status;
  if (error && typeof error === "object" && "statusCode" in error) {
    const status = (error as { statusCode?: unknown }).statusCode;
    if (typeof status === "number") return status;
  }
  return null;
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /timeout/i.test(error.name);
}

/**
 * Mensagem amigável para o usuário a partir de um erro.
 * `fallback` permite manter o contexto da ação ("não foi possível salvar").
 */
export function userMessageForError(error: unknown, fallback: string = t.errorGeneric): string {
  const status = httpStatusOf(error);
  if (status === 401) return t.loggedOut;
  if (status === 403) return t.errorForbidden;
  if (status === 404) return t.errorNotFound;
  if (status === 429) return t.errorRateLimit;
  if (status != null && status >= 500) return fallback;
  if (isTimeoutError(error) || error instanceof TypeError) return t.errorNetwork;
  return fallback;
}
