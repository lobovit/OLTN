import type { JSX } from "preact";
import { t } from "../i18n/pt-BR";
import { useRouter } from "../lib/router";
import { PageShell } from "../components/ui/PageShell";
import { SearchCore } from "../components/search/SearchCore";

export function SearchPage(): JSX.Element {
  const route = useRouter();
  const q = route.query.get("q") ?? "";
  return (
    <PageShell title={t.search} showBack>
      <SearchCore initialQuery={q} />
    </PageShell>
  );
}
