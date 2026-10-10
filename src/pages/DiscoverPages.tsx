import type { JSX } from "preact";
import { t } from "../i18n/pt-BR";
import { Timeline } from "../components/feed/Timeline";
import { PageShell } from "../components/ui/PageShell";

interface TagProps {
  params: { instance?: string; tag: string };
}

export function HashtagPage({ params }: TagProps): JSX.Element {
  const tag = params.tag;
  return (
    <PageShell title={`#${tag}`} subtitle={t.posts} showBack>
      <Timeline kind={{ type: "tag", tag }} instance={params.instance} emptyTitle={t.empty} />
    </PageShell>
  );
}

interface PublicProps {
  params: { instance?: string; scope?: string };
}

export function PublicPage({ params }: PublicProps): JSX.Element {
  const local = params.scope === "l";
  return (
    <PageShell title={local ? "Local" : "Federação"} showBack>
      <Timeline kind={{ type: "public", local }} instance={params.instance} emptyTitle={t.empty} />
    </PageShell>
  );
}
