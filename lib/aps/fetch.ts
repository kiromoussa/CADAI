const RETRYABLE_ERRNO = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'])

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffMs(attempt: number) {
  return Math.min(1000 * 2 ** attempt, 8000)
}

export function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const cause = (err as Error & { cause?: unknown }).cause
  if (cause && typeof cause === 'object' && cause !== null && 'code' in cause) {
    const code = (cause as { code?: string }).code
    if (code && RETRYABLE_ERRNO.has(code)) return true
  }
  if (err.message === 'fetch failed') return true
  return false
}

/** Fetch with retries for transient Autodesk/network failures. */
export async function apsFetch(
  url: string,
  init?: RequestInit,
  retries = 3
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, init)
      const retryableStatus = response.status === 429 || response.status === 502 || response.status === 503
      if (retryableStatus && attempt < retries) {
        await delay(backoffMs(attempt))
        continue
      }
      return response
    } catch (err) {
      lastError = err
      if (!isRetryableNetworkError(err) || attempt === retries) throw err
      await delay(backoffMs(attempt))
    }
  }

  throw lastError
}
