import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { ComposeVisibility } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { Icon } from "../ui/Icon";

interface VisibilityPickerProps {
  value: ComposeVisibility;
  /** Pleroma/Akkoma instances support the "local" visibility. */
  localSupported: boolean;
  onChange: (value: ComposeVisibility) => void;
}

interface VisibilityOption {
  value: ComposeVisibility;
  label: string;
  hint: string;
  icon: string;
}

/** Visibility button + menu (owns its open state and outside-click). */
export function VisibilityPicker({
  value,
  localSupported,
  onChange,
}: VisibilityPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const options: VisibilityOption[] = [
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
    <div class="vis-picker" ref={ref}>
      <button
        type="button"
        class="btn ghost sm vis-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={current.icon} size={15} />
        {current.label}
        <Icon name="dropdown-line" size={12} class="vis-caret" />
      </button>
      {open && (
        <div class="vis-menu" role="listbox" aria-label={t.visibility}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              class={`vis-option ${option.value === value ? "active" : ""}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <Icon name={option.icon} size={16} />
              <span class="vis-text">
                <span class="vis-name">{option.label}</span>
                <span class="vis-hint">{option.hint}</span>
              </span>
              {option.value === value && <Icon name="check-line" size={14} class="vis-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
