import { useState } from "preact/hooks";

export interface ComposePanels {
  emojiOpen: boolean;
  gifOpen: boolean;
  transOpen: boolean;
  scheduleOpen: boolean;
  toggleEmoji: () => void;
  toggleGif: () => void;
  toggleTranslation: () => void;
  toggleSchedule: () => void;
  closeEmoji: () => void;
  closeGif: () => void;
  closeTranslation: () => void;
  closeSchedule: () => void;
}

/** Open/close state for the composer popovers (emoji, GIF, translation, schedule). */
export function useComposePanels(): ComposePanels {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [transOpen, setTransOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const closeEmoji = (): void => setEmojiOpen(false);
  const closeGif = (): void => setGifOpen(false);
  const closeTranslation = (): void => setTransOpen(false);
  const closeSchedule = (): void => setScheduleOpen(false);

  const toggleEmoji = (): void => {
    setEmojiOpen((v) => !v);
    closeGif();
    closeTranslation();
  };
  const toggleGif = (): void => {
    setGifOpen((v) => !v);
    closeEmoji();
    closeTranslation();
    closeSchedule();
  };
  const toggleTranslation = (): void => {
    setTransOpen((v) => !v);
    closeEmoji();
  };
  const toggleSchedule = (): void => {
    setScheduleOpen((v) => !v);
    closeEmoji();
    closeTranslation();
  };

  return {
    emojiOpen,
    gifOpen,
    transOpen,
    scheduleOpen,
    toggleEmoji,
    toggleGif,
    toggleTranslation,
    toggleSchedule,
    closeEmoji,
    closeGif,
    closeTranslation,
    closeSchedule,
  };
}
