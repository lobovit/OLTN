import { useEffect, useState } from "preact/hooks";
import { getInstanceInfo } from "../../api/client";
import { supportsCollections } from "../../lib/instance-features";
import { store } from "../../state/store";

/** Cached support check for the profile's instance (Collections is 4.6+). */
export function useCollectionsSupport(instance: string): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(() =>
    store.instance?.uri === instance ? supportsCollections(store.instance) : null,
  );

  useEffect(() => {
    let cancelled = false;
    if (!instance) {
      setSupported(false);
      return;
    }
    if (store.instance?.uri === instance) {
      setSupported(supportsCollections(store.instance));
      return;
    }
    setSupported(null);
    void getInstanceInfo(instance)
      .then((info) => {
        if (!cancelled) setSupported(supportsCollections(info));
      })
      .catch(() => {
        if (!cancelled) setSupported(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instance]);

  return supported;
}
