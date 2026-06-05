const VOYAGE_EMBEDDING_MODEL =
  process.env.VOYAGE_EMBEDDING_MODEL ?? 'voyage-code-3'

export async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY is not configured')
  }

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: [text],
      model: VOYAGE_EMBEDDING_MODEL,
      input_type: 'query',
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Voyage embedding failed (${response.status}): ${body}`)
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>
  }

  return data.data[0].embedding
}
