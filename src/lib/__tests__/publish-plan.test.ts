import { describe, expect, it } from "vitest";
import type { MediaAttachment } from "../../api/types";
import { buildPublishExecution, planPublish, type ComposeDraft } from "../publish-plan";

const media = (id: string): MediaAttachment =>
  ({ id, description: `alt ${id}` }) as unknown as MediaAttachment;

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

const limits = { charLimit: 500, maxMedia: 4 };

describe("planPublish", () => {
  it("plans code blocks only within the free slots", () => {
    const text = "a\n```js\n1\n```\nb\n```js\n2\n```\nc\n```js\n3\n```";
    const plan = planPublish(draft({ text, media: [media("m1")] }), limits, { mode: "new" });
    expect(plan.blocks).toHaveLength(3);
    const full = planPublish(
      draft({ text, media: [media("m1"), media("m2"), media("m3")] }),
      limits,
      {
        mode: "new",
      },
    );
    expect(full.blocks).toHaveLength(1);
  });

  it("ignores blocks when editing and when there is a poll", () => {
    const text = "```js\n1\n```";
    const poll = { options: ["a"], expiresIn: 300, multiple: false };
    expect(
      planPublish(draft({ text }), limits, { mode: "edit", statusId: "1" }).blocks,
    ).toHaveLength(0);
    expect(planPublish(draft({ text, poll }), limits, { mode: "new" }).blocks).toHaveLength(0);
  });

  it("the plan touches neither DOM nor network: data only", () => {
    const plan = planPublish(
      draft({ text: "  oi  ", showCw: true, spoiler: "cw", replyToId: "r1", quoteId: "q1" }),
      limits,
      { mode: "reply", statusId: undefined },
    );
    expect(plan.text).toBe("oi");
    expect(plan.spoilerText).toBe("cw");
    expect(plan.rootReplyToId).toBe("r1");
    expect(plan.quoteId).toBe("q1");
    expect(plan.editStatusId).toBeUndefined();
  });
});

describe("buildPublishExecution", () => {
  it("create: CW, media, poll, reply and quote only on the first part", () => {
    const plan = planPublish(
      draft({
        text: "x".repeat(600),
        showCw: true,
        spoiler: "cw",
        media: [media("m1")],
        replyToId: "r1",
        quoteId: "q1",
      }),
      limits,
      { mode: "new" },
    );
    const execution = buildPublishExecution(plan, [], []);
    expect(execution.kind).toBe("create");
    expect(execution.parts.length).toBeGreaterThan(1);
    const [first, second] = execution.parts;
    expect(first.spoilerText).toBe("cw");
    expect(first.mediaIds).toEqual(["m1"]);
    expect(first.poll).toBeUndefined();
    expect(first.inReplyToId).toBe("r1");
    expect(first.quotedStatusId).toBe("q1");
    expect(second.spoilerText).toBeNull();
    expect(second.mediaIds).toEqual([]);
    expect(second.inReplyToId).toBeUndefined();
    expect(second.quotedStatusId).toBeUndefined();
  });

  it("poll is dropped when there is media; kept without media", () => {
    const poll = { options: ["a", "b"], expiresIn: 300, multiple: false };
    const withMedia = buildPublishExecution(
      planPublish(draft({ poll, media: [media("m1")] }), limits, { mode: "new" }),
      [],
      [],
    );
    expect(withMedia.parts[0].poll).toBeUndefined();
    const withoutMedia = buildPublishExecution(
      planPublish(draft({ poll }), limits, { mode: "new" }),
      [],
      [],
    );
    expect(withoutMedia.parts[0].poll).toEqual(poll);
  });

  it("schedule: a single part with scheduling and sensitive", () => {
    const plan = planPublish(
      draft({ sensitive: true, scheduledAt: "2026-01-01T10:00:00.000Z", media: [media("m1")] }),
      limits,
      { mode: "new" },
    );
    const execution = buildPublishExecution(plan, [], ["gen1"]);
    expect(execution.kind).toBe("schedule");
    expect(execution.parts).toHaveLength(1);
    expect(execution.scheduledAt).toBe("2026-01-01T10:00:00.000Z");
    expect(execution.sensitive).toBe(true);
    expect(execution.parts[0].mediaIds).toEqual(["m1", "gen1"]);
  });

  it("edit: mediaAttributes with media; poll without media", () => {
    const poll = { options: ["a"], expiresIn: 300, multiple: false };
    const withMedia = buildPublishExecution(
      planPublish(draft({ media: [media("m1")] }), limits, { mode: "edit", statusId: "9" }),
      [],
      [],
    );
    expect(withMedia.kind).toBe("update");
    expect(withMedia.parts[0].mediaIds).toEqual(["m1"]);
    expect(withMedia.parts[0].mediaAttributes).toEqual([{ id: "m1", description: "alt m1" }]);
    const withPoll = buildPublishExecution(
      planPublish(draft({ poll }), limits, { mode: "edit", statusId: "9" }),
      [],
      [],
    );
    expect(withPoll.parts[0].poll).toEqual(poll);
    expect(withPoll.parts[0].mediaAttributes).toBeUndefined();
  });

  it("removes only converted blocks and collapses lines when it removes", () => {
    const text = "antes\n\n```js\n1\n```\n\ndepois";
    const plan = planPublish(draft({ text }), limits, { mode: "new" });
    const [block] = plan.blocks;
    const all = buildPublishExecution(plan, [block], []);
    expect(all.parts[0].status).toBe("antes\n\ndepois");
    const none = buildPublishExecution(plan, [], []);
    expect(none.parts[0].status).toBe(text);
  });

  it("text with only converted code becomes an empty status (media holds the post)", () => {
    const plan = planPublish(draft({ text: "```js\n1\n```" }), limits, { mode: "new" });
    const execution = buildPublishExecution(plan, plan.blocks, ["gen1"]);
    expect(execution.parts[0].status).toBe("");
    expect(execution.parts[0].mediaIds).toEqual(["gen1"]);
  });
});
