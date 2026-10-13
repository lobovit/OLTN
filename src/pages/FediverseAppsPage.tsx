import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { useSnapshot } from "valtio";
import { t } from "../i18n/pt-BR";
import type { TKey } from "../i18n/pt-BR";
import { FEDIVERSE_APPS, FEDIVERSE_CATEGORIES } from "../lib/fediverse-apps";
import { store } from "../state/store";
import { Icon } from "../components/ui/Icon";
import { PageShell } from "../components/ui/PageShell";
import "./apps.css";

const CATEGORY_KEYS: Record<string, TKey> = {
  Microblogging: "fediverseCatMicroblogging",
  Video: "fediverseCatVideo",
  "Image Sharing": "fediverseCatImage",
  Audio: "fediverseCatAudio",
  Blogging: "fediverseCatBlogging",
  Events: "fediverseCatEvents",
  Forums: "fediverseCatForums",
  Git: "fediverseCatGit",
  Messaging: "fediverseCatMessaging",
  Other: "fediverseCatOther",
};

function categoryLabel(category: string): string {
  const key = CATEGORY_KEYS[category];
  return key ? t[key] : category;
}

/** Fediverse platforms that interoperate with Mastodon (ActivityPub). */
export function FediverseAppsPage(): JSX.Element {
  const language = useSnapshot(store).settings.language;
  const [category, setCategory] = useState<string | null>(null);
  const apps = category
    ? FEDIVERSE_APPS.filter((app) => app.category === category)
    : FEDIVERSE_APPS;

  return (
    <PageShell title={t.fediverseApps} showBack>
      <div class="fediverse-apps">
        <p class="muted">{t.fediverseAppsHint}</p>

        <div class="fediverse-chips">
          <button
            type="button"
            class={`fediverse-chip ${category === null ? "active" : ""}`}
            onClick={() => setCategory(null)}
          >
            {t.fediverseAppsAll}
          </button>
          {FEDIVERSE_CATEGORIES.map((name) => (
            <button
              key={name}
              type="button"
              class={`fediverse-chip ${category === name ? "active" : ""}`}
              onClick={() => setCategory(name)}
            >
              {categoryLabel(name)}
            </button>
          ))}
        </div>

        <div class="fediverse-grid">
          {apps.map((app) => (
            <article class="fediverse-card" key={app.name}>
              <div class="fediverse-card-head">
                <h3>{app.name}</h3>
                <span class="fediverse-cat">{categoryLabel(app.category)}</span>
              </div>
              <p>{language === "pt-BR" ? app.descriptionPt || app.description : app.description}</p>
              <a href={app.website} target="_blank" rel="noopener noreferrer">
                <Icon name="external-link-line" size={14} />
                {t.fediverseAppsVisit}
              </a>
            </article>
          ))}
        </div>

        <p class="fediverse-source">
          <a href="https://fediverse.info/apps" target="_blank" rel="noopener noreferrer">
            {t.fediverseAppsSource}
          </a>
        </p>
      </div>
    </PageShell>
  );
}
