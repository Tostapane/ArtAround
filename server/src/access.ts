/**
 * Applica ai documenti la regola condivisa di lettura prima di inviare i testi. I
 * metadati restano pubblici; un testo negato e' locked per distinguerlo da uno non
 * richiesto.
 */
import { UserModel } from "./models/user";
import { isReadable as regolaDiLettura } from "../../shared/access";

export async function purchasedBy(username: string): Promise<Set<string>> {
  const owned = new Set<string>();
  if (!username) return owned;
  const accounts = await UserModel.find({ username });
  for (const a of accounts) {
    for (const id of a.collezione || []) owned.add(id);
  }
  return owned;
}

export function isReadable(
  item: any,
  username: string,
  owned: Set<string>,
): boolean {
  if (!item) return false;
  return regolaDiLettura(item, username, owned.has(item["@id"]));
}

export function withoutText(item: any): any {
  let plain = item;
  if (item && typeof item.toObject === "function") plain = item.toObject();
  return { ...plain, text: "", locked: true };
}

export function readableItems(
  items: any[],
  username: string,
  owned: Set<string>,
): any[] {
  const out: any[] = [];
  for (const it of items) {
    if (isReadable(it, username, owned)) out.push(it);
    else out.push(withoutText(it));
  }
  return out;
}
