import type { ErrorBody, FieldErrors } from './types'

/**
 * Any API error. Mirrors the backend error object:
 *   { error: { code, message, details?, requestId } }
 * `message` is safe to show to the user; `requestId` matches the server logs.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | null
  readonly details: Record<string, unknown> | null

  constructor(status: number, body: Partial<ErrorBody>) {
    super(body.message || 'Something went wrong. Please try again.')
    this.name = 'ApiError'
    this.status = status
    this.code = body.code || 'unknown_error'
    this.requestId = body.requestId ?? null
    this.details = body.details ?? null
  }
}

/** 422 with per-field messages, ready to show next to form fields. */
export class ValidationError extends ApiError {
  readonly fields: FieldErrors

  constructor(status: number, body: Partial<ErrorBody>) {
    super(status, body)
    this.name = 'ValidationError'
    const fields = (body.details as { fields?: FieldErrors } | null | undefined)?.fields
    this.fields = fields ?? {}
  }
}

/** Server unreachable (backend not running, offline). */
export class NetworkError extends Error {
  constructor() {
    super("Can't reach the server")
    this.name = 'NetworkError'
  }
}

/** User-facing text for any error, with a reference for unexpected server errors. */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (e instanceof NetworkError) return e.message
  if (e instanceof ApiError) return e.status >= 500 && e.requestId ? `${e.message} (ref ${e.requestId})` : e.message
  return fallback
}

type Query = Record<string, string | number | boolean | string[] | undefined | null>

export function buildQuery(query: Query = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','))
    } else {
      params.set(key, String(value))
    }
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

function toApiError(status: number, data: unknown, statusText: string): ApiError {
  const body: Partial<ErrorBody> =
    data && typeof data === 'object' && 'error' in data ? (data as { error: ErrorBody }).error : { message: statusText }
  return status === 422 ? new ValidationError(status, body) : new ApiError(status, body)
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new NetworkError()
  }

  if (res.status === 204) return undefined as T
  const data: unknown = await res.json().catch(() => null)
  if (res.ok) return data as T
  throw toApiError(res.status, data, res.statusText)
}
