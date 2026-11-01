import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";
import { act } from "preact/test-utils";
import { ComposeDropZone } from "../../components/compose/ComposeDropZone";

function dragEvent(type: string, dataTransfer: unknown): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  return event;
}

async function mount(host: HTMLElement, onFiles: (files: FileList) => void): Promise<void> {
  const mount = document.createElement("div");
  host.append(mount);
  await act(async () => {
    render(<ComposeDropZone onFiles={onFiles}>body</ComposeDropZone>, mount);
  });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ComposeDropZone", () => {
  it("uploads a dragged video from anywhere inside the sheet", async () => {
    const host = document.createElement("div");
    host.innerHTML = '<div class="sheet"><div class="sheet-footer"></div></div>';
    document.body.append(host);
    const sheet = host.querySelector<HTMLElement>(".sheet")!;
    const onFiles = vi.fn();
    await mount(sheet, onFiles);
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });
    const transfer = {
      types: ["video/mp4"],
      items: [{ kind: "file" }],
      files: [file],
      dropEffect: "none",
    };

    const over = dragEvent("dragover", transfer);
    await act(async () => {
      sheet.querySelector<HTMLElement>(".sheet-footer")!.dispatchEvent(over);
    });
    expect(over.defaultPrevented).toBe(true);
    expect(transfer.dropEffect).toBe("copy");
    expect(sheet.querySelector(".compose")?.classList.contains("drag-over")).toBe(true);

    const drop = dragEvent("drop", transfer);
    await act(async () => {
      sheet.querySelector<HTMLElement>(".sheet-footer")!.dispatchEvent(drop);
    });
    expect(drop.defaultPrevented).toBe(true);
    expect(onFiles).toHaveBeenCalledOnce();
    expect((onFiles.mock.calls[0][0] as unknown as File[])[0].name).toBe("clip.mp4");
    expect(sheet.querySelector(".compose")?.classList.contains("drag-over")).toBe(false);
  });

  it("does not intercept text drags", async () => {
    const host = document.createElement("div");
    host.innerHTML = '<div class="sheet"></div>';
    document.body.append(host);
    const sheet = host.querySelector<HTMLElement>(".sheet")!;
    const onFiles = vi.fn();
    await mount(sheet, onFiles);
    const transfer = { types: ["text/plain"], items: [], files: [] };

    const over = dragEvent("dragover", transfer);
    sheet.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
  });
});
