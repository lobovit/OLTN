import { useSnapshot } from "valtio";
import { store } from "../../state/store";
import { Icon } from "./Icon";

export function Toasts() {
  const { toasts } = useSnapshot(store.ui);
  if (!toasts.length) return null;
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} class={`toast ${toast.kind ?? ""}`}>
          {toast.kind === "error" && <Icon name="close-circle-fill" size={16} />}
          {toast.kind === "ok" && <Icon name="check-circle-fill" size={16} />}
          <span class="ellipsis">{toast.text}</span>
        </div>
      ))}
    </div>
  );
}
