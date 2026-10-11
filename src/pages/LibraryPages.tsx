import type { JSX } from "preact";
import { t } from "../i18n/pt-BR";
import { Timeline } from "../components/feed/Timeline";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { currentAccount } from "../state/store";

export function BookmarksPage(): JSX.Element {
  const account = currentAccount();
  return (
    <PageShell title={t.bookmarks} showBack>
      <Timeline
        kind={{ type: "bookmarks" }}
        instance={account?.instance}
        emptyTitle={t.emptyBookmarks}
      />
    </PageShell>
  );
}

export function FavouritesPage(): JSX.Element {
  const account = currentAccount();
  return (
    <PageShell title={t.favourites} showBack>
      <Timeline
        kind={{ type: "favourites" }}
        instance={account?.instance}
        emptyTitle={t.emptyFavourites}
      />
    </PageShell>
  );
}

export function BoostsPage(): JSX.Element {
  const account = currentAccount();
  return (
    <PageShell title={t.boosts} showBack>
      {account ? (
        <Timeline
          kind={{ type: "boosts" }}
          instance={account.instance}
          emptyTitle={t.emptyBoosts}
        />
      ) : (
        <div class="center-state">
          <Icon name="repeat-line" size={28} />
          <h3>{t.loginSubtitle}</h3>
        </div>
      )}
    </PageShell>
  );
}
