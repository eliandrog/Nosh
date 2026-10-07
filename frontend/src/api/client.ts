import type { ValidationErrors } from './types'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** 422 response with per-field messages, ready to show next to form fields. */
export class ValidationError extends ApiError {
  readonly errors: ValidationErrors
  constructor(errors: ValidationErrors) {
    super(422, 'Validation failed')
    this.name = 'ValidationError'
    this.errors = errors
  }
}

/** Server unreachable (backend not running, offline). */
export class NetworkError extends Error {
  constructor() {
    super("Can't reach the server")
    this.name = 'NetworkError'
  }
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
  const data = await res.json().catch(() => null)

  if (res.ok) return data as T
  // ASSUMPTION (2): 422 body is { errors: { field: message } }.
  if (res.status === 422 && data && typeof data.errors === 'object') {
    throw new ValidationError(data.errors as ValidationErrors)
  }
  throw new ApiError(res.status, (data && (data.detail || data.message)) || res.statusText)
}
