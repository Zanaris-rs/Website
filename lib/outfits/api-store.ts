import type { Look } from "@/lib/chathead/look";
import type { OutfitStore, SavedOutfits } from "@/lib/chathead/outfit-store";

/**
 * The outfit editor's store on the real site: the four `/api/outfits` routes.
 * Every write answers with the outfits as they now are. A refusal becomes an
 * Error whose message is a sentence the editor shows as it is.
 */

const MESSAGES: Record<string, string> = {
  banned: "Your account is banned, so your outfits cannot change.",
  empty: "There is no outfit in that slot.",
  bad_slot: "That is not an outfit slot.",
  bad_name: "Give the outfit a name of 1 to 32 characters.",
  bad_look: "The game would not allow that outfit.",
  no_look:
    "The game has not recorded your look yet. Log in, then log out, and try again.",
  session_expired: "You have been signed out. Log in again to save.",
  origin: "That request came from another site, so it was refused.",
  unavailable: "Outfits are unavailable right now. Try again in a moment.",
};

async function call(input: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new Error(MESSAGES.unavailable);
  }

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  if (!response.ok) {
    const code = body?.error ?? "unavailable";
    throw new Error(
      MESSAGES[code] ??
        (response.status === 400 ? code : MESSAGES.unavailable),
    );
  }
  return body;
}

export function apiStore(): OutfitStore {
  return {
    async save(slot, outfit) {
      return (await call(`/api/outfits/${slot}`, {
        method: "POST",
        body: JSON.stringify(outfit),
      })) as SavedOutfits;
    },
    async remove(slot) {
      return (await call(`/api/outfits/${slot}`, {
        method: "DELETE",
      })) as SavedOutfits;
    },
    async setDefault(slot) {
      return (await call(`/api/outfits/${slot}/default`, {
        method: "POST",
      })) as SavedOutfits;
    },
    async importLook() {
      try {
        const body = (await call("/api/outfits/import", { method: "GET" })) as {
          look: Look;
        };
        return body.look;
      } catch (error) {
        // "not recorded yet" is an answer, not a failure: the editor has its
        // own sentence for it
        if (error instanceof Error && error.message === MESSAGES.no_look) {
          return null;
        }
        throw error;
      }
    },
  };
}
