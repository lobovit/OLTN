import type { ComponentChildren, JSX } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

/** Some browsers expose a dragged file by MIME type or item instead of "Files". */
function isFileDrag(data: DataTransfer | null | undefined): boolean {
  if (!data) return false;
  const types = Array.from(data.types);
  if (
    types.some(
      (type) =>
        type === "Files" ||
        type.startsWith("image/") ||
        type.startsWith("video/") ||
        type.startsWith("audio/"),
    )
  ) {
    return true;
  }
  return Array.from(data.items ?? []).some((item) => item.kind === "file");
}

/** Composer body wrapper: drop files anywhere over the sheet to upload. */
export function ComposeDropZone({
  onFiles,
  children,
}: {
  onFiles: (files: FileList) => void;
  children: ComponentChildren;
}): JSX.Element {
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;

  useLayoutEffect(() => {
    const root = ref.current;
    const sheet = root?.closest<HTMLElement>(".sheet");
    if (!sheet) return;

    const onDragOver = (e: DragEvent): void => {
      if (!isFileDrag(e.dataTransfer)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    };
    const onDragLeave = (e: DragEvent): void => {
      if (!sheet.contains(e.relatedTarget as Node | null)) setDragOver(false);
    };
    const onDrop = (e: DragEvent): void => {
      const files = e.dataTransfer?.files;
      if (!files?.length) return;
      e.preventDefault();
      setDragOver(false);
      onFilesRef.current(files);
    };

    sheet.addEventListener("dragover", onDragOver);
    sheet.addEventListener("dragleave", onDragLeave);
    sheet.addEventListener("drop", onDrop);
    return () => {
      sheet.removeEventListener("dragover", onDragOver);
      sheet.removeEventListener("dragleave", onDragLeave);
      sheet.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div ref={ref} class={`compose ${dragOver ? "drag-over" : ""}`}>
      {children}
    </div>
  );
}
