import type { JSX } from "preact";
import { useSnapshot } from "valtio";
import { t } from "../../i18n/pt-BR";
import { Sheet } from "../ui/Sheet";
import { SearchCore } from "./SearchCore";
import { store } from "../../state/store";

export function SearchSheet(): JSX.Element | null {
  const open = useSnapshot(store).ui.searchOpen;
  if (!open) return null;
  return (
    <Sheet
      title={t.search}
      onClose={() => (store.ui.searchOpen = false)}
      draggable
      positionKey="search"
      class="search-sheet"
    >
      <SearchCore
        onNavigate={() => {
          store.ui.searchOpen = false;
        }}
      />
    </Sheet>
  );
}
