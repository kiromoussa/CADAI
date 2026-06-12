"use client";

import {
  CADAI_DEFAULT_LIBRARY_SOURCES,
  excalidrawLibraryUrl,
} from "@/lib/excalidraw/cadai-default-libraries";
import { buildCadaiComplianceLibrary } from "@/lib/excalidraw/cadai-compliance-library";

let remoteLibrariesPromise: Promise<readonly unknown[]> | null = null;

async function fetchLibraryBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch library (${response.status}): ${url}`);
  }
  return response.blob();
}

/** Stable signature for deduping library change callbacks. */
export function librarySignature(items: readonly unknown[] | undefined): string {
  if (!items?.length) return "";
  return items
    .map((item) => {
      const lib = item as { id?: string; elements?: unknown[] };
      return `${lib.id ?? ""}:${lib.elements?.length ?? 0}`;
    })
    .join("|");
}

/** Merge library items by id — compliance items win on collision. */
export function mergeLibraryById(
  primary: readonly unknown[],
  secondary: readonly unknown[] | undefined,
): readonly unknown[] {
  if (!secondary?.length) return primary;
  const seen = new Set(
    primary.map((item) => (item as { id?: string }).id).filter(Boolean),
  );
  const merged = [...primary];
  for (const item of secondary) {
    const id = (item as { id?: string }).id;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    merged.push(item);
  }
  return merged;
}

/** Synchronous baseline: first-party compliance shapes (+ any saved items). */
export function getInitialLibraryItems(
  savedItems: readonly unknown[] | undefined,
): readonly unknown[] {
  return mergeLibraryById(buildCadaiComplianceLibrary(), savedItems);
}

/**
 * Fetches curated public libraries from GitHub (no compliance set — add separately).
 * Result is cached for the session.
 */
export async function loadRemoteDefaultLibraries(): Promise<readonly unknown[]> {
  if (remoteLibrariesPromise) {
    return remoteLibrariesPromise;
  }

  remoteLibrariesPromise = (async () => {
    const { loadLibraryFromBlob, mergeLibraryItems } = await import(
      "@excalidraw/excalidraw"
    );
    type LibraryItems = Awaited<ReturnType<typeof loadLibraryFromBlob>>;

    let merged = [] as unknown as LibraryItems;

    for (const source of CADAI_DEFAULT_LIBRARY_SOURCES) {
      try {
        const blob = await fetchLibraryBlob(excalidrawLibraryUrl(source.path));
        const items = await loadLibraryFromBlob(blob);
        merged = mergeLibraryItems(merged, items) as LibraryItems;
      } catch (error) {
        console.warn(`CADAI: skipped library "${source.label}"`, error);
      }
    }

    return merged as readonly unknown[];
  })();

  return remoteLibrariesPromise;
}

/** Compliance + remote public libraries. */
export async function loadCadaiDefaultLibraries(): Promise<readonly unknown[]> {
  const remote = await loadRemoteDefaultLibraries();
  return mergeLibraryById(buildCadaiComplianceLibrary(), remote);
}
