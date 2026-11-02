import { t } from "../i18n/pt-BR";
import type { PushErrorKind } from "./push";

export function pushErrorMessage(kind: PushErrorKind): string {
  switch (kind) {
    case "permission":
      return t.pushPermissionDenied;
    case "scope":
      return t.pushScopeError;
    case "insecure":
      return t.pushInsecure;
    case "unsupported":
      return t.pushUnsupported;
    case "vapid":
      return t.pushVapidError;
    case "subscription":
      return t.pushSubscriptionError;
    case "server":
      return t.pushServerError;
  }
}
