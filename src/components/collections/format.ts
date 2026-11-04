import { t } from "../../i18n/pt-BR";

export function collectionAccountCount(count: number): string {
  const template = count === 1 ? t.collectionAccountOne : t.collectionAccountMany;
  return template.replace("{n}", String(count));
}
