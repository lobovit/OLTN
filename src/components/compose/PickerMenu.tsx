import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { Icon, type IconName } from "../ui/Icon";

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  hint: string;
  icon: IconName;
}

/** Ghost button + dropdown menu with icons/hints, used by the composer pickers. */
export function PickerMenu<T extends string>({
  title,
  buttonIcon,
  value,
  options,
  onChange,
  disabled = false,
  disabledHint,
}: {
  title: string;
  buttonIcon: IconName;
  value: T;
  options: readonly PickerOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  disabledHint?: string;
}): JSX.Element {
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

  const current = options.find((option) => option.value === value) ?? options[0];

  return (
    <div class="vis-picker" ref={ref}>
      <button
        type="button"
        class="btn ghost sm vis-btn"
        title={disabled ? (disabledHint ?? title) : title}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        <Icon name={buttonIcon} size={15} />
        {current.label}
        <Icon name="dropdown-line" size={12} class="vis-caret" />
      </button>
      {open && (
        <div class="vis-menu" role="listbox" aria-label={title}>
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
