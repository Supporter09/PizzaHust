import type { paths } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

type PathForMethod<M extends HttpMethod> = {
  [P in keyof paths]: M extends keyof paths[P] ? (paths[P][M] extends never ? never : P) : never;
}[keyof paths] & string;

type Operation<M extends HttpMethod, P extends PathForMethod<M>> = NonNullable<paths[P][M]>;

type SuccessResponse<Op> = Op extends { responses: infer R }
  ? {
      [K in keyof R]: `${Extract<K, string | number>}` extends `2${string}` ? R[K] : never;
    }[keyof R]
  : never;

type JsonOf<T> = T extends { content: { "application/json": infer C } } ? C : never;

type ResponseData<Op> = JsonOf<SuccessResponse<Op>>;

type RequestJson<Op> = Op extends { requestBody: { content: { "application/json": infer B } } } ? B : never;

type QueryParams<Op> = Op extends { parameters: { query?: infer Q } } ? Q : never;

type EmptyObject = Record<string, never>;

type PathTokenKeys<S extends string> = S extends `${string}{${infer Param}}${infer Rest}` ? Param | PathTokenKeys<Rest> : never;

type PathParams<P extends string> = [PathTokenKeys<P>] extends [never] ? EmptyObject : Record<PathTokenKeys<P>, string | number>;

type RequestOptions<M extends HttpMethod, P extends PathForMethod<M>, Op extends Operation<M, P>> = {
  headers?: HeadersInit;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
  pathParams?: PathParams<P>;
} & (QueryParams<Op> extends never ? { query?: never } : { query?: QueryParams<Op> }) &
  (RequestJson<Op> extends never ? { body?: never } : { body?: RequestJson<Op> });

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`API ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function buildPathWithParams<P extends string>(template: P, params: PathParams<P> | undefined): string {
  if (!params) return template;

  return template.replace(/\{([^}]+)\}/g, (_, token: string) => {
    const value = params[token as keyof typeof params];
    if (value === undefined || value === null) {
      throw new Error(`Missing path param: ${token}`);
    }
    return encodeURIComponent(String(value));
  });
}

function withQuery(url: URL, query: Record<string, unknown> | undefined): void {
  if (!query) return;

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
      continue;
    }
    url.searchParams.append(key, String(value));
  }
}

function resolveUrl(path: string): URL {
  if (typeof window === "undefined") {
    return new URL(`${BASE}${path}`, "http://localhost");
  }
  return new URL(`${BASE}${path}`, window.location.origin);
}

export async function apiRequest<M extends HttpMethod, P extends PathForMethod<M>>(
  method: M,
  path: P,
  options?: RequestOptions<M, P, Operation<M, P>>,
): Promise<ResponseData<Operation<M, P>>> {
  const resolvedPath = buildPathWithParams(path, options?.pathParams as PathParams<P> | undefined);
  const url = resolveUrl(resolvedPath);
  withQuery(url, options?.query as Record<string, unknown> | undefined);

  const res = await fetch(url.toString(), {
    method: method.toUpperCase(),
    credentials: options?.credentials ?? "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options?.signal,
  });

  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      payload = await res.text();
    }
    throw new ApiError(res.status, payload);
  }

  if (res.status === 204) {
    return undefined as ResponseData<Operation<M, P>>;
  }

  return (await res.json()) as ResponseData<Operation<M, P>>;
}

export function apiGet<P extends PathForMethod<"get">>(
  path: P,
  options?: RequestOptions<"get", P, Operation<"get", P>>,
): Promise<ResponseData<Operation<"get", P>>> {
  return apiRequest("get", path, options);
}

export function apiPost<P extends PathForMethod<"post">>(
  path: P,
  options?: RequestOptions<"post", P, Operation<"post", P>>,
): Promise<ResponseData<Operation<"post", P>>> {
  return apiRequest("post", path, options);
}

export function apiPut<P extends PathForMethod<"put">>(
  path: P,
  options?: RequestOptions<"put", P, Operation<"put", P>>,
): Promise<ResponseData<Operation<"put", P>>> {
  return apiRequest("put", path, options);
}

export function apiPatch<P extends PathForMethod<"patch">>(
  path: P,
  options?: RequestOptions<"patch", P, Operation<"patch", P>>,
): Promise<ResponseData<Operation<"patch", P>>> {
  return apiRequest("patch", path, options);
}

export function apiDelete<P extends PathForMethod<"delete">>(
  path: P,
  options?: RequestOptions<"delete", P, Operation<"delete", P>>,
): Promise<ResponseData<Operation<"delete", P>>> {
  return apiRequest("delete", path, options);
}
