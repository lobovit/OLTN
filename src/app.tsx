import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { useSnapshot } from "valtio";
import { Routed } from "./app/shell";
import { ComposeSheet } from "./components/compose/ComposeSheet";
import { MediaViewer } from "./components/media/MediaViewer";
import { SearchSheet } from "./components/search/SearchSheet";
import { PushPrompt } from "./components/settings/PushPrompt";
import { ShortcutsHelp } from "./components/help/ShortcutsHelp";
import { HelpSheet } from "./components/help/HelpSheet";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { Toasts } from "./components/ui/Toasts";
import { t } from "./i18n/pt-BR";
import { navigate, RouterProvider } from "./lib/router";
import { boot } from "./state/boot";
import { store } from "./state/store";
import "./styles/pages.css";

export function App(): JSX.Element {
  const state = useSnapshot(store);

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent): void => {
      const data = event.data as { type?: string; path?: string } | null;
      if (data?.type === "oltn:navigate" && data.path) navigate(data.path);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  if (!state.booted) {
    return (
      <div class="center-state boot-screen">
        <div class="spinner" />
        <p>{t.loading}</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <RouterProvider>
        <Routed />
        <Toasts />
        <PushPrompt />
        <ComposeSheet />
        <MediaViewer />
        <ShortcutsHelp />
        <HelpSheet />
        <SearchSheet />
      </RouterProvider>
    </ErrorBoundary>
  );
}
