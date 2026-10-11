import type { ComponentType } from "preact";
import { LoginPage } from "../pages/LoginPage";
import { HomePage } from "../pages/HomePage";
import { NotificationsPage } from "../pages/NotificationsPage";
import { StatusPage } from "../pages/StatusPage";
import { AccountPage } from "../pages/AccountPage";
import { SearchPage } from "../pages/SearchPage";
import { HashtagPage, PublicPage } from "../pages/DiscoverPages";
import { BookmarksPage, BoostsPage, FavouritesPage } from "../pages/LibraryPages";
import { ListsPage, ListPage } from "../pages/ListsPage";
import { FiltersPage } from "../pages/FiltersPage";
import { ScheduledPage } from "../pages/ScheduledPage";
import { TrendingPage } from "../pages/TrendingPage";
import { SettingsPage } from "../pages/SettingsPage";
import { LayoutsPage } from "../pages/LayoutsPage";
import { MessagesPage } from "../pages/MessagesPage";
import { AccountsPage } from "../pages/AccountsPage";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AppRoute {
  pattern: string;
  page: ComponentType<any>;
  auth?: boolean;
  /** Coluna centralizada na tela (views de leitura, ex.: thread do toot). */
  centered?: boolean;
}

export const routes: AppRoute[] = [
  { pattern: "/login", page: LoginPage },
  { pattern: "/", page: HomePage, auth: true },
  { pattern: "/notifications", page: NotificationsPage, auth: true },
  { pattern: "/mentions", page: MentionsRoute, auth: true },
  { pattern: "/messages", page: MessagesPage, auth: true },
  { pattern: "/b", page: BookmarksPage, auth: true },
  { pattern: "/f", page: FavouritesPage, auth: true },
  { pattern: "/boosts", page: BoostsPage, auth: true },
  { pattern: "/scheduled", page: ScheduledPage, auth: true },
  { pattern: "/l", page: ListsPage, auth: true },
  { pattern: "/l/:id", page: ListPage, auth: true },
  { pattern: "/ft", page: FiltersPage, auth: true },
  { pattern: "/trending", page: TrendingPage },
  { pattern: "/settings", page: SettingsPage, auth: true },
  { pattern: "/layouts", page: LayoutsPage, auth: true },
  { pattern: "/accounts", page: AccountsPage },
  { pattern: "/search", page: SearchPage },
  { pattern: "/:instance?/s/:id", page: StatusPage, centered: true },
  { pattern: "/:instance?/a/:id", page: AccountPage },
  { pattern: "/:instance?/t/:tag", page: HashtagPage },
  { pattern: "/:instance?/p/:scope", page: PublicPage },
  { pattern: "/:instance?/p", page: PublicPage },
  { pattern: "/:instance?/search", page: SearchPage },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MentionsRoute(props: any) {
  return <NotificationsPage {...props} mode="mentions" />;
}
