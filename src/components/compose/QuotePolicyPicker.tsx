import type { JSX } from "preact";
import { t } from "../../i18n/pt-BR";
import type { QuotePolicy } from "../../lib/publish-plan";
import { PickerMenu, type PickerOption } from "./PickerMenu";

/** "Who can quote" picker (Mastodon 4.5+; older servers ignore the policy). */
export function QuotePolicyPicker({
  value,
  onChange,
  disabled,
  disabledHint,
}: {
  value: QuotePolicy;
  onChange: (value: QuotePolicy) => void;
  /** Mastodon always uses "nobody" for private/direct posts. */
  disabled?: boolean;
  disabledHint?: string;
}): JSX.Element {
  const options: PickerOption<QuotePolicy>[] = [
    {
      value: "public",
      label: t.quotePolicyPublic,
      hint: t.quotePolicyPublicHint,
      icon: "globe-line",
    },
    {
      value: "followers",
      label: t.quotePolicyFollowers,
      hint: t.quotePolicyFollowersHint,
      icon: "group-line",
    },
    {
      value: "nobody",
      label: t.quotePolicyNobody,
      hint: t.quotePolicyNobodyHint,
      icon: "user-3-line",
    },
  ];
  return (
    <PickerMenu
      title={t.quotePolicy}
      buttonIcon="share-forward-line"
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
      disabledHint={disabledHint}
    />
  );
}
