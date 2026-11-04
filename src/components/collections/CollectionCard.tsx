import type { JSX } from "preact";
import type { Account, Collection } from "../../api/types";
import { t } from "../../i18n/pt-BR";
import { timeAgo } from "../../lib/format";
import { collectionAccountHandle, collectionPreviewAccountIds } from "../../lib/collections";
import { navigate } from "../../lib/router";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { collectionAccountCount } from "./format";

interface CollectionCardProps {
  collection: Collection;
  instance: string;
  accounts: ReadonlyMap<string, Account>;
}

/** Read-only collection summary used by the profile Featured tab. */
export function CollectionCard({
  collection,
  instance,
  accounts,
}: CollectionCardProps): JSX.Element {
  const previewIds = collectionPreviewAccountIds(collection);
  const owner = accounts.get(collection.accountId);
  const ownerHandle = owner ? collectionAccountHandle(owner, instance) : "";

  return (
    <button
      type="button"
      class="collection-card"
      onClick={() => navigate(`/${encodeURIComponent(instance)}/c/${collection.id}`)}
    >
      <span class={`collection-avatar-grid ${collection.sensitive ? "is-sensitive" : ""}`}>
        {previewIds.length ? (
          previewIds.map((id, index) => {
            const account = accounts.get(id);
            return (
              <Avatar
                key={`${id}-${index}`}
                src={account?.avatar}
                name={account?.displayName || account?.username || "?"}
                size={28}
              />
            );
          })
        ) : (
          <span class="collection-avatar-empty">
            <Icon name="group-line" size={22} />
          </span>
        )}
        {collection.sensitive && (
          <span class="collection-sensitive-badge" title={t.collectionSensitive}>
            <Icon name="eye-close-line" size={12} />
          </span>
        )}
      </span>

      <span class="collection-card-main">
        <span class="collection-card-title">{collection.name}</span>
        <span class="collection-card-meta">
          {ownerHandle && <span>@{ownerHandle}</span>}
          <span>{collectionAccountCount(collection.itemCount)}</span>
          {collection.tag && <span class="collection-card-tag">#{collection.tag.name}</span>}
          {collection.updatedAt && (
            <span>
              {t.collectionUpdated} {timeAgo(collection.updatedAt)}
            </span>
          )}
        </span>
      </span>

      <Icon name="arrow-right-line" size={16} />
    </button>
  );
}
