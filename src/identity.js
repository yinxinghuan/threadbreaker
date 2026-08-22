import { callAigramAPI, getTelegramId, isInAigramNow } from "./shared/runtime/bridge.ts";
import { waitForAigramIdentity } from "./shared/runtime/identity-ready.ts";

const params = new URLSearchParams(location.search);
const fallbackAvatar = new URL("./alteru-default-avatar.jpg", document.baseURI).href;

export const playerIdentity = {
  id: getTelegramId() || "",
  name: params.get("user_name")?.trim() || "AlterU",
  avatar: params.get("avatar_url")?.trim() || fallbackAvatar,
  get isInAigram() { return isInAigramNow(); },
  resolved: false,
};

export async function resolvePlayerIdentity() {
  const overrideName = params.get("user_name")?.trim();
  const overrideAvatar = params.get("avatar_url")?.trim();
  if (overrideName || overrideAvatar) {
    Object.assign(playerIdentity, { name: overrideName || "AlterU", avatar: overrideAvatar || fallbackAvatar, resolved: true });
    return playerIdentity;
  }
  const currentTelegramId = await waitForAigramIdentity();
  const currentIsInAigram = Boolean(currentTelegramId);
  playerIdentity.id = currentTelegramId || "";
  if (currentIsInAigram && currentTelegramId) {
    try {
      const response = await callAigramAPI(
        `/note/telegram/user/get/info/by/telegram_id?telegram_id=${encodeURIComponent(currentTelegramId)}`,
        "GET",
      );
      const data = response?.data || {};
      playerIdentity.name = data.name?.trim() || data.user_name?.trim() || "AlterU";
      playerIdentity.avatar = data.head_url?.trim() || fallbackAvatar;
    } catch {
      playerIdentity.name = "AlterU";
      playerIdentity.avatar = fallbackAvatar;
    }
  }
  playerIdentity.resolved = true;
  return playerIdentity;
}

export function renderIdentity(root, identity = playerIdentity) {
  const image = root.querySelector("[data-player-avatar]");
  const name = root.querySelector("[data-player-name]");
  if (image) {
    image.src = identity.avatar || fallbackAvatar;
    image.addEventListener("error", () => { image.src = fallbackAvatar; }, { once: true });
  }
  if (name) name.textContent = identity.name || "AlterU";
}
