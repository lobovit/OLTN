import type { JSX } from "preact";
import { t } from "../../i18n/pt-BR";
import { Sheet } from "../ui/Sheet";
import { store } from "../../state/store";

export function ShortcutsHelp(): JSX.Element | null {
  if (!store.ui.shortcutsHelp) return null;
  const groups: { title: string; items: [string, string][] }[] = [
    {
      title: t.navHelp,
      items: [
        ["g h", t.home],
        ["g n", t.notifications],
        ["g m", t.mentions],
        ["g b", t.bookmarks],
        ["g f", t.favourites],
        ["g l", t.lists],
        ["g t", t.trending],
        ["g s", t.settings],
        ["g p", t.yourProfile],
        ["1…6", t.pinnedShortcuts],
      ],
    },
    {
      title: t.posts,
      items: [
        ["c", t.composePost],
        ["j / k", t.nextPrev],
        ["o / Enter", t.openPost],
        ["/", t.search],
      ],
    },
    {
      title: t.generalHelp,
      items: [
        ["?", t.thisHelp],
        ["Esc", t.closePanels],
      ],
    },
  ];
  return (
    <Sheet title={t.shortcutsHelp} onClose={() => (store.ui.shortcutsHelp = false)}>
      <div class="shortcuts-help">
        {groups.map((group) => (
          <section key={group.title}>
            <h3 class="section-title">{group.title}</h3>
            {group.items.map(([keys, label]) => (
              <div class="shortcut-row" key={keys}>
                <kbd>{keys}</kbd>
                <span>{label}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Sheet>
  );
}
