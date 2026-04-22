/**
 * Short label for collapsed board rail (e.g. "study_routine" → "SR", "ab" → "AB").
 */
export function boardNameToAcronym(name: string, maxLen = 2): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  const parts = trimmed.split(/[\s_\-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts
      .slice(0, maxLen)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, maxLen);
  }

  const word = parts[0] ?? trimmed;
  if (word.length <= maxLen) return word.toUpperCase();
  return word.slice(0, maxLen).toUpperCase();
}
