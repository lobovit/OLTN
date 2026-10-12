import type { ComponentChildren, JSX } from "preact";
import { useState } from "preact/hooks";

/** Composer body wrapper: drop files anywhere over it to upload. */
export function ComposeDropZone({
  onFiles,
  children,
}: {
  onFiles: (files: FileList) => void;
  children: ComponentChildren;
}): JSX.Element {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      class={`compose ${dragOver ? "drag-over" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer?.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = e.dataTransfer?.files;
        if (files?.length) onFiles(files);
      }}
    >
      {children}
    </div>
  );
}
