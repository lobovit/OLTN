import type { JSX } from "preact";
import { useEffect } from "preact/hooks";
import { useSnapshot } from "valtio";
import { Routed } from "./app/shell";
import { ComposeSheet } from "./components/compose/ComposeSheet";
import { MediaViewer } from "./components/media/MediaViewer";
import { SearchSheet } from "./components/search/SearchSheet";
import { ShortcutsHelp } from "./components/help/ShortcutsHelp";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { Toasts } from "./components/ui/Toasts";
import { RouterProvider } from "./lib/router";
import { boot } from "./state/boot";
import { store } from "./state/store";
import "./styles/pages.css";

export function App(): JSX.Element {
  const state = useSnapshot(store);

  useEffect(() => {
    void boot();
  }, []);

  if (!state.booted) {
    return (
      <div class="center-state boot-screen">
        <div class="spinner" />
        <p>carregando…</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <RouterProvider>
        <Routed />
        <Toasts />
        <ComposeSheet />
        <MediaViewer />
        <ShortcutsHelp />
        <SearchSheet />
      </RouterProvider>
    </ErrorBoundary>
  );
}
