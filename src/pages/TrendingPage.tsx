import type { JSX } from "preact";
import { t } from "../i18n/pt-BR";
import { TrendingFeed } from "../components/feed/TrendingFeed";
import { PageShell } from "../components/ui/PageShell";
import { currentAccount } from "../state/store";

export function TrendingPage(): JSX.Element {
  const account = currentAccount();
  return (
    <PageShell title={t.trending} showBack>
      <TrendingFeed instance={account?.instance} />
    </PageShell>
  );
}
