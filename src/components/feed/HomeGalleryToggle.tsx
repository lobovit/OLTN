import type { JSX } from "preact";
import { useSnapshot } from "valtio";
import { t } from "../../i18n/pt-BR";
import { store } from "../../state/store";
import { Icon } from "../ui/Icon";

/** Toggles the Home timeline between posts and its image gallery. */
export function HomeGalleryToggle(): JSX.Element {
  const open = useSnapshot(store).ui.homeGallery;
  const label = open ? t.showHomeTimeline : t.showHomeImages;
  return (
    <button
      type="button"
      class={`icon-btn home-gallery-toggle ${open ? "active" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={open}
      onClick={() => {
        store.ui.homeGallery = !store.ui.homeGallery;
      }}
    >
      <Icon name="photo-album-line" size={15} />
    </button>
  );
}
