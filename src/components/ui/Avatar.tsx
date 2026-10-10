import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { initials } from "../../lib/format";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  class?: string;
  onClick?: (e: MouseEvent) => void;
}

export function Avatar({
  src,
  name,
  size = 40,
  class: className,
  onClick,
}: AvatarProps): JSX.Element {
  const [failed, setFailed] = useState(false);
  const style = { width: `${size}px`, height: `${size}px` };
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      class={`avatar ${className ?? ""}`}
      style={style}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span class="fallback" style={{ fontSize: `${size * 0.36}px` }}>
          {initials(name)}
        </span>
      )}
    </Tag>
  );
}
