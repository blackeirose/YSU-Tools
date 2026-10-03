/** Same owner command and verified place yields the same Item ID on every device. */
import type { Item } from "./model";
import type { AssistantAction } from "./server/gemini";

/** Check the current record, not a transient browser timer, before writing an action. */
export function assistantActionAlreadyApplied(item: Item, action: AssistantAction): boolean {
  if (action.kind === "move") return !!action.day && item.day === action.day && item.status !== "candidate";
  if (action.kind === "candidate") return item.status === "candidate";
  if (action.kind === "edit_time") return !!action.time && item.timeMode === "flexible" && item.time === action.time &&
    (!action.period || item.period === action.period);
  return false;
}

export async function assistantItemId(fingerprint: string, latitude: number, longitude: number): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(`travel-planner-assistant-v1:${fingerprint}:${latitude}:${longitude}`)));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes.slice(0, 16), (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
