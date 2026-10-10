import type { JSX } from "preact";
import { ICONS } from "./icons";

export type IconName = keyof typeof ICONS | string;

interface IconProps {
  name: IconName;
  size?: number;
  class?: string;
  fill?: boolean;
  title?: string;
}

export function Icon({ name, size = 20, class: className, title }: IconProps): JSX.Element {
  const def = ICONS[name];
  if (!def) return <span class={`icon ${className ?? ""}`} aria-hidden />;
  return (
    <span
      class={`icon ${className ?? ""}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      title={title}
    >
      <svg
        viewBox={`0 0 ${def.width} ${def.height}`}
        width={size}
        height={size}
        dangerouslySetInnerHTML={{ __html: def.body }}
      />
    </span>
  );
}
