import type { JSX } from "preact";
import { useSnapshot } from "valtio";
import { t } from "../../i18n/pt-BR";
import { store } from "../../state/store";
import { Icon } from "../ui/Icon";
import { Sheet } from "../ui/Sheet";

interface HelpTopic {
  icon: string;
  title: string;
  text: string;
  example?: string;
}

function Paragraphs({ text }: { text: string }): JSX.Element {
  return (
    <>
      {text.split("\n\n").map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </>
  );
}

function HelpTopicCard({ topic }: { topic: HelpTopic }): JSX.Element {
  return (
    <article class="help-topic">
      <h4 class="help-topic-title">
        <span class="help-topic-icon">
          <Icon name={topic.icon} size={16} />
        </span>
        {topic.title}
      </h4>
      <Paragraphs text={topic.text} />
      {topic.example && (
        <pre class="help-code">
          <code>{topic.example}</code>
        </pre>
      )}
    </article>
  );
}

function jumpTo(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Full guide opened by the question-mark icon in the navigation. */
export function HelpSheet(): JSX.Element | null {
  const ui = useSnapshot(store).ui;
  if (!ui.helpOpen) return null;
  const quickSteps = [
    { title: t.helpQuickRead, text: t.helpQuickReadText },
    { title: t.helpQuickPost, text: t.helpQuickPostText },
    { title: t.helpQuickFind, text: t.helpQuickFindText },
  ];
  const menuTopics: HelpTopic[] = [
    { icon: "home-3-line", title: t.home, text: t.helpHomeText },
    { icon: "history-line", title: t.timeseries, text: t.helpTimeseriesText },
    { icon: "globe-line", title: t.local, text: t.helpLocalText },
    { icon: "notification-line", title: t.notifications, text: t.helpNotificationsText },
    { icon: "at-line", title: t.mentions, text: t.helpMentionsText },
    { icon: "mail-line", title: t.messages, text: t.helpMessagesText },
    { icon: "search-2-line", title: t.search, text: t.helpSearchText },
    { icon: "trending-up-line", title: t.trending, text: t.helpTrendingText },
    { icon: "news-line", title: t.newsletter, text: t.helpNewsletterText },
    { icon: "repeat-line", title: t.boosts, text: t.helpBoostsText },
    { icon: "planet-line", title: t.fediverseApps, text: t.helpAppsText },
    { icon: "list-check-line", title: t.lists, text: t.helpListsText },
    { icon: "bookmark-line", title: t.bookmarks, text: t.helpBookmarksText },
    { icon: "calendar-line", title: t.scheduledPosts, text: t.helpScheduledText },
    { icon: "user-3-line", title: t.yourProfile, text: t.helpProfileText },
    { icon: "settings-3-line", title: t.settings, text: t.helpSettingsText },
    { icon: "question-line", title: t.help, text: t.helpHelpText },
    { icon: "pencil-fill", title: t.compose, text: t.helpPostText },
  ];
  const everydayTopics: HelpTopic[] = [
    { icon: "more-1-line", title: t.helpActionsTitle, text: t.helpActionsText },
    { icon: "menu-line", title: t.helpLayoutTitle, text: t.helpLayoutText },
    {
      icon: "code-line",
      title: t.helpCodeTitle,
      text: t.helpCodeText,
      example: '```python\nprint("hello")\n```',
    },
  ];
  return (
    <Sheet
      title={t.helpTitle}
      onClose={() => (store.ui.helpOpen = false)}
      class="help-sheet"
      footer={
        <>
          <div class="spacer" />
          <button
            type="button"
            class="btn ghost"
            onClick={() => {
              store.ui.shortcutsHelp = true;
              store.ui.helpOpen = false;
            }}
          >
            {t.shortcutsHelp}
          </button>
        </>
      }
    >
      <p class="help-intro">{t.helpIntro}</p>
      <nav class="help-contents" aria-label={t.helpContents}>
        <span class="help-contents-label">{t.helpContents}</span>
        <button type="button" class="help-contents-link" onClick={() => jumpTo("help-fediverse")}>
          {t.helpContentsFediverse}
        </button>
        <button type="button" class="help-contents-link" onClick={() => jumpTo("help-menu")}>
          {t.helpContentsMenu}
        </button>
        <button type="button" class="help-contents-link" onClick={() => jumpTo("help-everyday")}>
          {t.helpContentsEveryday}
        </button>
      </nav>
      <section class="help-quick">
        <h3>{t.helpQuickTitle}</h3>
        <ol class="help-steps">
          {quickSteps.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      </section>
      <section id="help-fediverse" class="help-chapter">
        <h3>{t.helpFediverseTitle}</h3>
        <Paragraphs text={t.helpFediverseText} />
        <p class="help-callout">{t.helpFediverseSummary}</p>
      </section>
      <section id="help-menu" class="help-chapter">
        <h3>{t.helpMenuTitle}</h3>
        <p>{t.helpMenuIntro}</p>
        <div class="help-topics">
          {menuTopics.map((topic) => (
            <HelpTopicCard key={topic.title} topic={topic} />
          ))}
        </div>
      </section>
      <section id="help-everyday" class="help-chapter">
        <h3>{t.helpEverydayTitle}</h3>
        <p>{t.helpEverydayIntro}</p>
        <div class="help-topics">
          {everydayTopics.map((topic) => (
            <HelpTopicCard key={topic.title} topic={topic} />
          ))}
        </div>
      </section>
    </Sheet>
  );
}
