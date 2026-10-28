import type { JSX } from "preact";
import type { ComposeVisibility } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { PickerMenu, type PickerOption } from "./PickerMenu";

interface VisibilityPickerProps {
  value: ComposeVisibility;
  /** Pleroma/Akkoma instances support the "local" visibility. */
  localSupported: boolean;
  onChange: (value: ComposeVisibility) => void;
  /** Mastodon ignores visibility changes when editing an existing status. */
  disabled?: boolean;
  disabledHint?: string;
}

/** Visibility dropdown for the composer (public/local/quiet/followers/direct). */
export function VisibilityPicker({
  value,
  localSupported,
  onChange,
  disabled,
  disabledHint,
}: VisibilityPickerProps): JSX.Element {
  const options: PickerOption<ComposeVisibility>[] = [
    { value: "public", label: t.visPublic, hint: t.visPublicHint, icon: "globe-line" },
    ...(localSupported
      ? [
          {
            value: "local" as ComposeVisibility,
            label: t.visLocal,
            hint: t.visLocalHint,
            icon: "building-2-line",
          },
        ]
      : []),
    { value: "unlisted", label: t.visUnlisted, hint: t.visUnlistedHint, icon: "eye-line" },
    { value: "private", label: t.visPrivate, hint: t.visPrivateHint, icon: "group-line" },
    { value: "direct", label: t.visDirect, hint: t.visDirectHint, icon: "mail-line" },
  ];
  const current = options.find((option) => option.value === value) ?? options[0];
  return (
    <PickerMenu
      title={t.visibility}
      buttonIcon={current.icon}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
      disabledHint={disabledHint}
    />
  );
}
