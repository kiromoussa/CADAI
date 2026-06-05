import { encodeUrn } from '@/lib/aps/modelDerivative'

const OSS_BASE = 'https://developer.api.autodesk.com/oss/v2'

const CAD_EXTENSIONS = ['.dwg', '.rvt', '.ifc', '.nwd', '.nwc', '.dxf'] as const

export function isSupportedCadExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return CAD_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function contentTypeForCad(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.dwg')) return 'application/vnd.autodesk.autocad.dwg'
  if (lower.endsWith('.ifc')) return 'application/x-ifc'
  return 'application/octet-stream'
}

export function bucketKey(): string {
  const id = process.env.APS_CLIENT_ID ?? 'codecomply'
  const normalized = id.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48)
  return `codecomply-${normalized}`
}

/** True when the model was uploaded to this app's OSS bucket (local CAD upload). */
export function isAppOssUrn(encodedUrn: string): boolean {
  try {
    const raw = Buffer.from(encodedUrn, 'base64url').toString('utf8')
    return raw.startsWith(`urn:adsk.objects:os.object:${bucketKey()}/`)
  } catch {
    return false
  }
}

export function objectKeyForUpload(userId: string, fileName: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  // Flat keys only — slashes in object keys break Model Derivative download ("Tr worker fail to download").
  return `${userId}-${Date.now()}-${safe}`
}

function rawObjectUrn(bucket: string, objectKey: string): string {
  return `urn:adsk.objects:os.object:${bucket}/${objectKey}`
}

async function ensureBucket(token: string, key: string): Promise<void> {
  const details = await fetch(`${OSS_BASE}/buckets/${key}/details`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (details.ok) return

  if (details.status !== 404) {
    throw new Error(`Failed to check OSS bucket (${details.status})`)
  }

  const create = await fetch(`${OSS_BASE}/buckets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketKey: key, policyKey: 'transient' }),
  })

  if (!create.ok && create.status !== 409) {
    const text = await create.text()
    throw new Error(`Failed to create OSS bucket (${create.status}): ${text}`)
  }
}

export interface SignedUploadSession {
  bucket: string
  objectKey: string
  uploadKey: string
  urls: string[]
}

export async function prepareSignedUpload(
  token: string,
  objectKey: string
): Promise<SignedUploadSession> {
  const bucket = bucketKey()
  await ensureBucket(token, bucket)

  const signedRes = await fetch(
    `${OSS_BASE}/buckets/${bucket}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!signedRes.ok) {
    const text = await signedRes.text()
    throw new Error(`OSS signed upload failed (${signedRes.status}): ${text}`)
  }

  const signed = (await signedRes.json()) as { uploadKey: string; urls: string[] }
  if (!signed.urls?.length) {
    throw new Error('OSS signed upload returned no URL')
  }

  return {
    bucket,
    objectKey,
    uploadKey: signed.uploadKey,
    urls: signed.urls,
  }
}

export async function completeSignedUpload(
  token: string,
  objectKey: string,
  uploadKey: string
): Promise<{ rawUrn: string; encodedUrn: string }> {
  const bucket = bucketKey()

  const completeRes = await fetch(
    `${OSS_BASE}/buckets/${bucket}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uploadKey }),
    }
  )

  if (!completeRes.ok) {
    const text = await completeRes.text()
    throw new Error(`OSS upload finalize failed (${completeRes.status}): ${text}`)
  }

  const rawUrn = rawObjectUrn(bucket, objectKey)
  return { rawUrn, encodedUrn: encodeUrn(rawUrn) }
}

export async function uploadObjectToOss(
  token: string,
  objectKey: string,
  body: Buffer,
  contentType?: string
): Promise<{ rawUrn: string; encodedUrn: string }> {
  const session = await prepareSignedUpload(token, objectKey)
  const uploadUrl = session.urls[0]

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: contentType ? { 'Content-Type': contentType } : {},
    body: new Uint8Array(body),
  })

  if (!putRes.ok) {
    throw new Error(`OSS file upload failed (${putRes.status})`)
  }

  return completeSignedUpload(token, objectKey, session.uploadKey)
}
