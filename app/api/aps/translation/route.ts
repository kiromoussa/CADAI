import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTokenForUrn } from '@/lib/aps/auth'
import {
  checkTranslationStatus,
  fileExtensionFromName,
  translateModel,
} from '@/lib/aps/modelDerivative'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const urn = searchParams.get('urn')
  const projectId = searchParams.get('project_id')

  if (!urn) {
    return NextResponse.json({ error: 'urn is required' }, { status: 400 })
  }

  try {
    const token = await getTokenForUrn(user.id, urn)

    let project:
      | {
          translation_started_at: string | null
          original_file_name: string | null
          translation_force_retried: boolean
          translation_force_retried_at: string | null
        }
      | null = null

    if (projectId) {
      const { data } = await supabase
        .from('projects')
        .select(
          'translation_started_at, original_file_name, translation_force_retried, translation_force_retried_at'
        )
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single()
      project = data
    }

    let result = await checkTranslationStatus(urn, token, {
      translationStartedAt: project?.translation_started_at,
      forceRetried: project?.translation_force_retried ?? false,
      forceRetriedAt: project?.translation_force_retried_at,
    })

    let retrying = false

    if (
      result.stalled &&
      result.status === 'processing' &&
      projectId &&
      project &&
      !project.translation_force_retried
    ) {
      const fileExtension = project.original_file_name
        ? fileExtensionFromName(project.original_file_name)
        : undefined
      await translateModel(urn, token, { force: true, fileExtension })
      const retriedAt = new Date().toISOString()
      await supabase
        .from('projects')
        .update({
          translation_force_retried: true,
          translation_force_retried_at: retriedAt,
        })
        .eq('id', projectId)
        .eq('user_id', user.id)

      retrying = true
      result = await checkTranslationStatus(urn, token, {
        translationStartedAt: project.translation_started_at,
        forceRetried: true,
        forceRetriedAt: retriedAt,
      })
    }

    const status = result.status
    let message: string

    if (status === 'complete') {
      message = 'Model translation complete'
    } else if (status === 'failed') {
      message =
        result.detail ??
        result.child_errors?.[0] ??
        'Model translation failed'
    } else if (status === 'pending') {
      message = 'Waiting for translation to start…'
    } else if (retrying) {
      message =
        'Translation appears stuck — retrying with DWG-optimized sheet export settings…'
    } else if (result.stalled) {
      message =
        'Translation appears stuck — retrying with DWG sheet export settings…'
    } else {
      message =
        result.progress && result.progress.includes('%')
          ? `Translating model (${result.progress})…`
          : 'Translating model for viewer…'
    }

    if (projectId) {
      await supabase
        .from('projects')
        .update({
          translation_status:
            status === 'complete'
              ? 'complete'
              : status === 'failed'
                ? 'failed'
                : 'processing',
        })
        .eq('id', projectId)
        .eq('user_id', user.id)
    }

    return NextResponse.json({
      status,
      message,
      progress: result.progress,
      stalled: result.stalled ?? false,
      retrying,
      child_errors: result.child_errors,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Translation status check failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
