import type { ComponentChildren, JSX } from "preact";
import type { IconName } from "../ui/Icon";
import { Icon } from "../ui/Icon";

export type ComposeToggle = "emoji" | "gif" | "translate" | "schedule";

/** Toolbar icon button with the shared active/expanded/toggle wiring. */
export function ToolButton({
  icon,
  title,
  label,
  active,
  expanded,
  disabled,
  toggle,
  onClick,
  children,
}: {
  icon?: IconName;
  title: string;
  label: string;
  active?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  toggle?: ComposeToggle;
  onClick: () => void;
  children?: ComponentChildren;
}): JSX.Element {
  const toggleAttr = toggle ? { [`data-${toggle}-toggle`]: true } : undefined;
  return (
    <button
      type="button"
      class={`icon-btn ${active ? "active" : ""}`}
      title={title}
      aria-label={label}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
      {...toggleAttr}
    >
      {children ?? (icon ? <Icon name={icon} size={20} /> : null)}
    </button>
  );
}
