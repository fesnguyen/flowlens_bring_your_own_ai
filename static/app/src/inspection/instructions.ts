export type CustomInstruction = { id: string; name: string; text: string };
export type InstructionPreferences = { custom: CustomInstruction[]; selectedId: string };

export const defaultInstructions: InstructionPreferences = { custom: [], selectedId: '' };
export const maxInstructionBytes = 32 * 1024;
const maxNameLength = 80;

export function activeInstruction(preferences: InstructionPreferences) {
  return preferences.custom.find(({ id }) => id === preferences.selectedId);
}

/** Use the same validation for pasted, imported, and previously saved instructions. */
export function createInstruction(id: string, name: string, text: string): CustomInstruction {
  const trimmedName = name.trim();
  const trimmedText = text.trim();
  if (!trimmedName || trimmedName.length > maxNameLength) {
    throw new Error(`Enter an instruction name of 1–${maxNameLength} characters.`);
  }
  if (!trimmedText || text.includes('\0') || new TextEncoder().encode(text).byteLength > maxInstructionBytes) {
    throw new Error('Enter plain text or Markdown of up to 32 KiB.');
  }
  return { id, name: trimmedName, text: trimmedText };
}

/** The foundation lives outside the custom list and cannot be deleted. */
export function removeInstruction(preferences: InstructionPreferences, id: string): InstructionPreferences {
  return {
    custom: preferences.custom.filter(item => item.id !== id),
    selectedId: preferences.selectedId === id ? '' : preferences.selectedId,
  };
}

/** Browser storage is optional in embedded panels. Discard unusable saved preferences. */
export function loadInstructions(storage: Pick<Storage, 'getItem'>, key: string): InstructionPreferences {
  try {
    const raw = JSON.parse(storage.getItem(key) ?? 'null') as Partial<InstructionPreferences> | null;
    if (!Array.isArray(raw?.custom)) return defaultInstructions;
    const custom: CustomInstruction[] = [];
    for (const item of raw.custom) {
      if (typeof item?.id !== 'string' || !item.id || typeof item.name !== 'string' || typeof item.text !== 'string' ||
        custom.some(({ id }) => id === item.id)) continue;
      try {
        custom.push(createInstruction(item.id, item.name, item.text));
      } catch {
        // An invalid saved entry should not hide other usable instructions.
      }
    }
    const selectedId = custom.find(({ id }) => id === raw.selectedId)?.id ?? '';
    return { custom, selectedId };
  } catch {
    return defaultInstructions;
  }
}
