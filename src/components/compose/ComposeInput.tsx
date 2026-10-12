import type { JSX, RefObject } from "preact";
import { t } from "../../i18n/pt-BR";
import { MentionMenu } from "./MentionMenu";
import type { MentionMenuState } from "./useMentionMenu";

/** Composer textarea with mention autocomplete and upload/submit shortcuts. */
export function ComposeInput({
  text,
  textRef,
  mentions,
  reply,
  onText,
  onResetTranslation,
  onUpload,
  onSubmit,
}: {
  text: string;
  textRef: RefObject<HTMLTextAreaElement | null>;
  mentions: MentionMenuState;
  reply: boolean;
  onText: (value: string) => void;
  onResetTranslation: () => void;
  onUpload: (files: FileList) => void;
  onSubmit: () => void;
}): JSX.Element {
  return (
    <>
      <textarea
        ref={textRef}
        class="field compose-text"
        rows={6}
        placeholder={reply ? t.composeReplyPlaceholder : t.composePlaceholder}
        value={text}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          onText(target.value);
          onResetTranslation();
          mentions.sync(target);
        }}
        onClick={(e) => mentions.sync(e.currentTarget as HTMLTextAreaElement)}
        onKeyUp={(e) => {
          if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
            mentions.sync(e.currentTarget as HTMLTextAreaElement);
          }
        }}
        onPaste={(e) => {
          const files = e.clipboardData?.files;
          if (files?.length) {
            e.preventDefault();
            onUpload(files);
          }
        }}
        onBlur={mentions.clear}
        onKeyDown={(e) => {
          if (mentions.handleKey(e)) return;
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSubmit();
        }}
      />
      <MentionMenu
        items={mentions.items}
        index={mentions.index}
        onIndex={mentions.setIndex}
        onPick={mentions.pick}
      />
    </>
  );
}
