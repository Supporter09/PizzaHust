/** Forward client API failures to the host environment (not console). */
export function reportApiError(scope: string, error: unknown): void {
  const err =
    error instanceof Error
      ? error
      : new Error(`${scope}: ${String(error)}`, { cause: error });

  if (typeof globalThis.reportError === "function") {
    globalThis.reportError(err);
  }
}