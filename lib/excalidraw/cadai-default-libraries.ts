/**
 * Curated Excalidraw libraries for CADAI compliance / residential architecture boards.
 * Sources: https://github.com/excalidraw/excalidraw-libraries (MIT)
 */
export const EXCALIDRAW_LIBRARIES_CDN =
  "https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries";

export type CadaiLibrarySource = {
  id: string;
  path: string;
  label: string;
};

/** Preloaded on new boards when the user has not saved custom library items yet. */
export const CADAI_DEFAULT_LIBRARY_SOURCES: CadaiLibrarySource[] = [
  {
    id: "architecture-floor-plan",
    path: "Arqtangeles/architecture.excalidrawlib",
    label: "Architecture floor plan symbols",
  },
  {
    id: "basic-shapes",
    path: "pgilfernandez/basic-shapes.excalidrawlib",
    label: "Basic shapes",
  },
  {
    id: "sticky-notes",
    path: "ferminrp/post-it.excalidrawlib",
    label: "Sticky Notes",
  },
  {
    id: "bubbles",
    path: "ocapraro/bubbles.excalidrawlib",
    label: "Bubbles",
  },
  {
    id: "decision-flow",
    path: "aretecode/decision-flow-control.excalidrawlib",
    label: "Decision flow control",
  },
  {
    id: "handdrawn-signs",
    path: "kwirke/some-handdrawn-signs.excalidrawlib",
    label: "Hand-drawn check / cross",
  },
  {
    id: "flow-chart",
    path: "finfin/flow-chart-symbols.excalidrawlib",
    label: "Flow chart symbols",
  },
];

export function excalidrawLibraryUrl(sourcePath: string): string {
  return `${EXCALIDRAW_LIBRARIES_CDN}/${sourcePath}`;
}
