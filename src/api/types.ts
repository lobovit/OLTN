import type { mastodon } from "masto";
import type { InstanceRule } from "../lib/instance-rules";

export type Status = mastodon.v1.Status;
export type StatusEdit = mastodon.v1.StatusEdit;
export type ScheduledStatus = mastodon.v1.ScheduledStatus;
export type Account = mastodon.v1.Account;
export type CredentialAccount = mastodon.v1.CredentialAccount;
export type Notification = mastodon.v1.Notification;
export type MediaAttachment = mastodon.v1.MediaAttachment;
export type Poll = mastodon.v1.Poll;
export type PreviewCard = mastodon.v1.PreviewCard;
export type List = mastodon.v1.List;
export type Context = mastodon.v1.Context;
export type Relationship = mastodon.v1.Relationship;
export type CustomEmoji = mastodon.v1.CustomEmoji;
export type Instance = mastodon.v1.Instance;
export type Tag = mastodon.v1.Tag;
export type TrendLink = mastodon.v1.TrendLink;
export type Conversation = mastodon.v1.Conversation;
export type AccountField = mastodon.v1.AccountField;
export type UpdateCredentialsParams = mastodon.rest.v1.UpdateCredentialsParams;
export type Filter = mastodon.v2.Filter;
export type FilterAction = mastodon.v2.FilterAction;
export type FilterContext = mastodon.v2.FilterContext;
export type Search = mastodon.v2.Search;
export type StatusVisibility = mastodon.v1.StatusVisibility;
/** Compose visibility — includes "local" (Pleroma/Akkoma). */
export type ComposeVisibility = StatusVisibility | "local";
export type NotificationType = mastodon.v1.NotificationType;
export type Translation = mastodon.v1.Translation;
export type ReportCategory = mastodon.v1.ReportCategory;
export type RestClient = mastodon.rest.Client;

export interface InstanceInfo {
  uri: string;
  title: string;
  thumbnail?: string | null;
  streamingApi?: string | null;
  version?: string;
  rules: InstanceRule[];
}

export interface AccountMeta {
  id: string;
  instance: string;
  handle: string;
  displayName: string;
  avatar: string;
  accessToken: string;
  clientId: string;
  clientSecret?: string;
  createdAt: number;
}

export type ThemeSetting = "dark" | "light" | "auto";
export type AccentSetting = "green" | "orange" | "purple" | "blue" | "pink";
export type LanguageSetting = "pt-BR" | "en";

export type ShortcutType =
  | "home"
  | "local"
  | "federated"
  | "notifications"
  | "mentions"
  | "direct"
  | "list"
  | "hashtag"
  | "bookmarks"
  | "favourites"
  | "boosts"
  | "trending";

export interface Shortcut {
  id: string;
  type: ShortcutType;
  label: string;
  value?: string;
}

export interface PomodoroSettings {
  /** Focus minutes (25 by default). */
  focusMinutes: number;
  /** Short break after each focus (5 by default). */
  shortBreakMinutes: number;
  /** Long break after N focus rounds (15 by default). */
  longBreakMinutes: number;
  /** Focus rounds before a long break (4 by default). */
  cycles: number;
  /** Automatically starts the next phase (break/focus). */
  autoContinue: boolean;
}

export interface Settings {
  theme: ThemeSetting;
  accent: AccentSetting;
  language: LanguageSetting;
  textSize: number;
  /** Multi-column deck on the home route (off = single-column home). */
  deckMode: boolean;
  /** Receives posts and notifications in real time. */
  autoStream: boolean;
  /** Animate GIFs in timelines (default: on). */
  autoplayGifs: boolean;
  /** Nav button order (hrefs). */
  navOrder?: readonly string[];
  /** Pomodoro cycle settings. */
  pomodoro: PomodoroSettings;
}

export interface ComposeIntent {
  mode: "new" | "reply" | "quote" | "edit";
  statusId?: string;
  prefill?: string;
}

export interface SavedLayout {
  id: string;
  name: string;
  columns: readonly Shortcut[];
  widths?: Readonly<Record<string, number>>;
}

/** Position and size of a floating panel on the canvas (deck mode off). */
export interface FloatRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A news profile the reader aggregates from the Newsletter page. */
export interface NewsletterSource {
  /** Account id on the reader's instance (always resolvable there). */
  id: string;
  acct: string;
  name: string;
}

export interface ToastItem {
  id: number;
  text: string;
  kind?: "error" | "ok";
}

export interface MediaViewerIntent {
  instance: string;
  attachments: MediaAttachment[];
  index: number;
}
