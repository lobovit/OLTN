import type { mastodon } from "masto";

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
export type Conversation = mastodon.v1.Conversation;
export type AccountField = mastodon.v1.AccountField;
export type UpdateCredentialsParams = mastodon.rest.v1.UpdateCredentialsParams;
export type FilterV1 = mastodon.v1.Filter;
export type Filter = mastodon.v2.Filter;
export type FilterAction = mastodon.v2.FilterAction;
export type FilterContext = mastodon.v2.FilterContext;
export type Search = mastodon.v2.Search;
export type StatusVisibility = mastodon.v1.StatusVisibility;
/** Visibilidade de composição — inclui "local" (Pleroma/Akkoma). */
export type ComposeVisibility = StatusVisibility | "local";
export type NotificationType = mastodon.v1.NotificationType;
export type Translation = mastodon.v1.Translation;
export type RestClient = mastodon.rest.Client;
export type StreamingClient = mastodon.streaming.Client;

export interface InstanceInfo {
  uri: string;
  title: string;
  thumbnail?: string | null;
  streamingApi?: string | null;
  version?: string;
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

export interface Settings {
  theme: ThemeSetting;
  accent: AccentSetting;
  language: LanguageSetting;
  textSize: number;
  /** Rail lateral expandido (padrão: compacto, só ícones). */
  railExpanded: boolean;
  /** Recebe posts e notificações em tempo real. */
  autoStream: boolean;
  /** Ordem dos botões do nav (hrefs). */
  navOrder?: readonly string[];
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
