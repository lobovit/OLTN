import { describe, expect, it } from "vitest";
import { render } from "preact";
import { QuotePolicyPicker } from "../../components/compose/QuotePolicyPicker";
import { t } from "../../i18n/pt-BR";

describe("QuotePolicyPicker", () => {
  it("locks to nobody for private posts", () => {
    const host = document.createElement("div");
    render(
      <QuotePolicyPicker
        value="nobody"
        onChange={() => {}}
        disabled
        disabledHint="private posts can't be quoted"
      />,
      host,
    );
    const button = host.querySelector<HTMLButtonElement>(".vis-btn");
    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toContain(t.quotePolicyNobody);
    expect(button?.title).toBe("private posts can't be quoted");
  });
});
