import type { JSX } from "preact";
import { t } from "../i18n/pt-BR";
import { PageShell } from "../components/ui/PageShell";
import { ConversationsFeed } from "../components/feed/ConversationsFeed";
import { currentAccount } from "../state/store";

export function MessagesPage(): JSX.Element {
  const account = currentAccount();
  return (
    <PageShell title={t.messages} showBack>
      <ConversationsFeed instance={account?.instance} />
    </PageShell>
  );
}
