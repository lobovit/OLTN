import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaAttachment, RestClient, Status } from "../../api/types";
import { codeBlockToImageFile } from "../code-image";
import { planPublish, type ComposeDraft, type PublishPlan } from "../publish-plan";
import { executePublish, type PublishContext } from "../../state/publish";
import { store } from "../../state/store";

vi.mock("../code-image", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../code-image")>();
  return {
    ...actual,
    codeBlockToImageFile: vi.fn(async () => new File(["png"], "code.png", { type: "image/png" })),
  };
});

function makeStatus(id: string): Status {
  return {
    id,
    uri: `https://mock.instance/users/me/statuses/${id}`,
    account: { id: "1", acct: "me", username: "me", displayName: "Me", avatar: "", emojis: [] },
    content: "<p>x</p>",
    createdAt: new Date().toISOString(),
    mediaAttachments: [],
    mentions: [],
    tags: [],
    emojis: [],
  } as unknown as Status;
}

interface Call {
  op: "media" | "create" | "update";
  id?: string;
  params?: {
    status?: string;
    visibility?: string;
    mediaIds?: string[];
    mediaAttributes?: { id: string; description: string | null }[];
    inReplyToId?: string | null;
    poll?: unknown;
    scheduledAt?: string;
    quoteApprovalPolicy?: string;
  };
  description?: string;
}

function fakeClient(options: { failOnCreate?: number } = {}) {
  const calls: Call[] = [];
  let mediaSeq = 0;
  let statusSeq = 0;
  const client = {
    v1: {
      media: {
        create: async ({ description }: { description?: string | null }) => {
          calls.push({ op: "media", description: description ?? undefined });
          return { id: `m${++mediaSeq}` } as unknown as MediaAttachment;
        },
      },
      statuses: {
        $select: (id: string) => ({
          update: async (params: Call["params"]) => {
            calls.push({ op: "update", id, params });
            return makeStatus(id);
          },
        }),
        create: async (params: Call["params"]) => {
          const index = calls.filter((call) => call.op === "create").length + 1;
          if (options.failOnCreate === index) throw new Error(`falha na parte ${index}`);
          calls.push({ op: "create", params });
          return makeStatus(`s${++statusSeq}`);
        },
      },
    },
  };
  return { client: client as unknown as RestClient, calls };
}

const ctx = (client: RestClient): PublishContext => ({ client, instance: "mock.instance" });

function draft(over: Partial<ComposeDraft> = {}): ComposeDraft {
  return {
    text: "olá mundo",
    spoiler: "",
    showCw: false,
    visibility: "public",
    sensitive: false,
    media: [],
    ...over,
  };
}

function planFrom(over: Partial<ComposeDraft> = {}, mode: "new" | "edit" = "new"): PublishPlan {
  return planPublish(draft(over), { charLimit: 500, maxMedia: 4 }, { mode, statusId: "9" });
}

beforeEach(() => {
  store.statuses = {};
  store.statusSources = {};
  store.ui.toasts = [];
  store.ui.lastPostedKey = null;
  vi.mocked(codeBlockToImageFile).mockReset();
  vi.mocked(codeBlockToImageFile).mockResolvedValue(
    new File(["png"], "code.png", { type: "image/png" }),
  );
});

describe("executePublish", () => {
  it("converts code to an image, attaches it to the first part and publishes", async () => {
    const { client, calls } = fakeClient();
    const plan = planFrom({
      text: "antes\n\n```js\nconst a = 1;\n```\n\ndepois",
      quotePolicy: "public",
    });

    const outcome = await executePublish(ctx(client), plan);

    expect(outcome.ok).toBe(true);
    expect(outcome.kind).toBe("create");
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ op: "media", description: "const a = 1;" });
    expect(calls[1].op).toBe("create");
    expect(calls[1].params?.status).toBe("antes\n\ndepois");
    expect(calls[1].params?.visibility).toBe("public");
    expect(calls[1].params?.mediaIds).toEqual(["m1"]);
    expect(calls[1].params?.quoteApprovalPolicy).toBe("public");
    expect(store.ui.lastPostedKey).toBe("https://mock.instance/users/me/statuses/s1");
  });

  it("encadeia as partes da thread como respostas", async () => {
    const { client, calls } = fakeClient();
    const plan = planFrom({ text: "x".repeat(600) });

    const outcome = await executePublish(ctx(client), plan);

    expect(outcome.ok).toBe(true);
    const creates = calls.filter((call) => call.op === "create");
    expect(creates).toHaveLength(2);
    expect(creates[0].params?.inReplyToId).toBeUndefined();
    expect(creates[1].params?.inReplyToId).toBe("s1");
  });

  it("keeps the block text when conversion fails", async () => {
    vi.mocked(codeBlockToImageFile).mockResolvedValue(null);
    const { client, calls } = fakeClient();
    const plan = planFrom({ text: "antes\n\n```js\n1\n```\n\ndepois" });

    const outcome = await executePublish(ctx(client), plan);

    expect(outcome.ok).toBe(true);
    expect(calls.some((call) => call.op === "media")).toBe(false);
    expect(calls[0].params?.status).toContain("```js");
    expect(store.ui.toasts.some((toast) => toast.kind === "error")).toBe(true);
  });

  it("partial failure returns the remaining parts and does not close as success", async () => {
    const { client } = fakeClient({ failOnCreate: 2 });
    const plan = planFrom({ text: "x".repeat(600) });

    const outcome = await executePublish(ctx(client), plan);

    expect(outcome.ok).toBe(false);
    expect(outcome.posted).toHaveLength(1);
    expect(outcome.remaining).toHaveLength(1);
    expect(outcome.error).toBeInstanceOf(Error);
  });

  it("scheduling publishes once with scheduledAt", async () => {
    const { client, calls } = fakeClient();
    const plan = planFrom({
      scheduledAt: "2026-01-01T10:00:00.000Z",
      media: [],
      quotePolicy: "followers",
    });

    const outcome = await executePublish(ctx(client), plan);

    expect(outcome.ok).toBe(true);
    expect(outcome.kind).toBe("schedule");
    expect(calls.filter((call) => call.op === "create")).toHaveLength(1);
    expect(calls[0].params?.scheduledAt).toBe("2026-01-01T10:00:00.000Z");
    expect(calls[0].params?.quoteApprovalPolicy).toBe("followers");
  });

  it("private/direct posts send the quote policy nobody", async () => {
    const { client, calls } = fakeClient();
    const plan = planFrom({ visibility: "direct", quotePolicy: "public" });

    const outcome = await executePublish(ctx(client), plan);

    expect(outcome.ok).toBe(true);
    const create = calls.find((call) => call.op === "create");
    expect(create?.params?.visibility).toBe("direct");
    expect(create?.params?.quoteApprovalPolicy).toBe("nobody");
  });

  it("editing calls update with mediaAttributes", async () => {
    const { client, calls } = fakeClient();
    const attachments = [{ id: "m1", description: "alt" }] as unknown as MediaAttachment[];
    const plan = planFrom({ media: attachments, quotePolicy: "nobody" }, "edit");

    const outcome = await executePublish(ctx(client), plan);

    expect(outcome.ok).toBe(true);
    expect(outcome.kind).toBe("update");
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe("update");
    expect(calls[0].params?.visibility).toBeUndefined();
    expect(calls[0].params?.mediaAttributes).toEqual([{ id: "m1", description: "alt" }]);
    expect(calls[0].params?.quoteApprovalPolicy).toBe("nobody");
  });
});
