import type { JSX } from "preact";
import { t } from "../i18n/pt-BR";
import { CollectionsTab } from "../components/collections/CollectionsTab";
import { useCollectionsSupport } from "../components/collections/useCollectionsSupport";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import { currentAccount } from "../state/store";
import { useAppState } from "../state/hooks";

/** Personal collections destination, linked from the main navigation. */
export function CollectionsPage(): JSX.Element {
  const appState = useAppState();
  const account = currentAccount();
  const instance = account?.instance ?? "";
  const supported = useCollectionsSupport(instance);

  if (!account || !appState.me) {
    return (
      <PageShell title={t.collections}>
        <div class="center-state">
          <Icon name="group-line" size={28} />
          <h3>{t.loginSubtitle}</h3>
        </div>
      </PageShell>
    );
  }

  if (supported === null) {
    return (
      <PageShell title={t.collections}>
        <div class="center-state">
          <span class="spinner" />
        </div>
      </PageShell>
    );
  }

  if (!supported) {
    return (
      <PageShell title={t.collections}>
        <div class="center-state">
          <Icon name="group-line" size={28} />
          <h3>{t.collectionsUnavailable}</h3>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={t.collections} subtitle={t.collectionFormHint}>
      <CollectionsTab account={appState.me} instance={instance} isSelf />
    </PageShell>
  );
}
