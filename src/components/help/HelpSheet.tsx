import type { JSX } from "preact";
import { useSnapshot } from "valtio";
import { t } from "../../i18n/pt-BR";
import { store } from "../../state/store";
import { Sheet } from "../ui/Sheet";

interface HelpSection {
  title: string;
  text: string;
  example?: string;
}

/** Quick platform intro (question-mark icon in the nav). */
export function HelpSheet(): JSX.Element | null {
  const ui = useSnapshot(store).ui;
  if (!ui.helpOpen) return null;
  const sections: HelpSection[] = [
    { title: t.helpTimelinesTitle, text: t.helpTimelinesText },
    { title: t.helpPostTitle, text: t.helpPostText },
    {
      title: t.helpCodeTitle,
      text: t.helpCodeText,
      example: '```python\nprint("hello")\n```',
    },
    { title: t.helpInteractTitle, text: t.helpInteractText },
    { title: t.helpColumnsTitle, text: t.helpColumnsText },
    { title: t.helpDiscoverTitle, text: t.helpDiscoverText },
    { title: t.helpNewsletterTitle, text: t.helpNewsletterText },
    { title: t.helpLibraryTitle, text: t.helpLibraryText },
    { title: t.helpTimerTitle, text: t.helpTimerText },
    { title: t.helpSettingsTitle, text: t.helpSettingsText },
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
      {sections.map((section) => (
        <section key={section.title}>
          <h3>{section.title}</h3>
          <p>{section.text}</p>
          {section.example && (
            <pre class="help-code">
              <code>{section.example}</code>
            </pre>
          )}
        </section>
      ))}
    </Sheet>
  );
}
