export function applyRecordUpdater(current, updater) {
  if (typeof updater !== "function") {
    return { ...current, ...(updater || {}) };
  }

  const result = updater(current);
  return result && typeof result === "object" ? result : current;
}
