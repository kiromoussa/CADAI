const TRANSLATION_MAX_WAIT_MS = 20 * 60 * 1000

async function putFileToSignedUrls(
  file: File,
  urls: string[],
  contentType: string
): Promise<void> {
  if (urls.length === 1) {
    const putRes = await fetch(urls[0], {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    })
    if (!putRes.ok) {
      throw new Error(`Direct upload failed (${putRes.status})`)
    }
    return
  }

  const partSize = Math.ceil(file.size / urls.length)
  for (let i = 0; i < urls.length; i++) {
    const start = i * partSize
    const end = Math.min(start + partSize, file.size)
    const chunk = file.slice(start, end)
    const putRes = await fetch(urls[i], {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: chunk,
    })
    if (!putRes.ok) {
      throw new Error(`Direct upload part ${i + 1} failed (${putRes.status})`)
    }
  }
}

export async function uploadCadDirectToOss(
  file: File,
  projectId: string
): Promise<{ urn: string; status: string }> {
  const prepareRes = await fetch('/api/aps/upload/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: file.name }),
  })
  const prepareData = (await prepareRes.json()) as {
    object_key?: string
    upload_key?: string
    upload_urls?: string[]
    content_type?: string
    error?: string
  }
  if (!prepareRes.ok || !prepareData.object_key || !prepareData.upload_key) {
    throw new Error(prepareData.error ?? 'Failed to prepare CAD upload')
  }

  const urls = prepareData.upload_urls ?? []
  if (!urls.length) throw new Error('No upload URL returned from Autodesk')

  await putFileToSignedUrls(file, urls, prepareData.content_type ?? 'application/octet-stream')

  const completeRes = await fetch('/api/aps/upload/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      object_key: prepareData.object_key,
      upload_key: prepareData.upload_key,
      file_name: file.name,
    }),
  })
  const completeData = (await completeRes.json()) as {
    urn?: string
    status?: string
    error?: string
  }
  if (!completeRes.ok || !completeData.urn) {
    throw new Error(completeData.error ?? 'Failed to finalize CAD upload')
  }

  return {
    urn: completeData.urn,
    status: completeData.status ?? 'processing',
  }
}

type TranslationPollPayload = {
  status?: string
  message?: string
  progress?: string
  error?: string
  retryable?: boolean
}

async function parseTranslationPollResponse(res: Response): Promise<{
  data: TranslationPollPayload
  parseFailed: boolean
}> {
  const text = await res.text()
  if (!text.trim()) {
    return { data: {}, parseFailed: true }
  }
  try {
    return { data: JSON.parse(text) as TranslationPollPayload, parseFailed: false }
  } catch {
    return { data: {}, parseFailed: true }
  }
}

function isRetryableTranslationPoll(
  res: Response,
  data: TranslationPollPayload,
  parseFailed: boolean
): boolean {
  return (
    parseFailed ||
    res.status === 404 ||
    res.status === 503 ||
    res.status >= 502 ||
    data.retryable === true
  )
}

export async function waitForCadTranslation(
  urn: string,
  projectId: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const started = Date.now()
  let networkRetries = 0

  while (Date.now() - started < TRANSLATION_MAX_WAIT_MS) {
    const params = new URLSearchParams()
    params.set('urn', urn)
    params.set('project_id', projectId)
    const res = await fetch(`/api/aps/translation?${params}`)
    const { data, parseFailed } = await parseTranslationPollResponse(res)

    if (res.status === 401) {
      throw new Error('Session expired — sign in again.')
    }

    if (isRetryableTranslationPoll(res, data, parseFailed)) {
      if (networkRetries < 20) {
        networkRetries += 1
        onProgress?.(data.message ?? 'Waiting for translation service…')
        await new Promise((resolve) => setTimeout(resolve, 2000))
        continue
      }
      throw new Error(data.error ?? 'Translation status check failed')
    }

    if (!res.ok) {
      throw new Error(data.error ?? 'Translation status check failed')
    }

    networkRetries = 0
    onProgress?.(data.message ?? 'Translating model…')

    if (data.status === 'complete') return
    if (data.status === 'failed') {
      throw new Error(data.error ?? data.message ?? 'Translation failed')
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error('Translation timed out')
}
