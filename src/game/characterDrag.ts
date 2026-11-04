import type { DragEvent } from "react";
import { CHARACTER_DATA } from "./characters";
const format = "application/x-dummy-character";
export function startCharacterDrag(event: DragEvent, name: string) {
  event.dataTransfer.setData(format, name);
  event.dataTransfer.setData("text/plain", name);
  event.dataTransfer.effectAllowed = "copyMove";
}
export function readCharacterDrop(event: DragEvent): string | null {
  const name = event.dataTransfer.getData(format) || event.dataTransfer.getData("text/plain");
  return Object.hasOwn(CHARACTER_DATA, name) ? name : null;
}
