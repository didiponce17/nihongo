export function summarizeProgress(progress) {
  const states = Object.values(progress.itemProgress ?? {});
  const events = progress.reviewHistory ?? [];
  const correct = events.filter((event) => event.grade >= 3).length;
  return {
    practiced: states.filter((state) => state.seen).length,
    due: states.filter((state) => state.dueDate && !state.suspended).length,
    mastered: states.filter((state) => (state.masteryScore ?? 0) >= 0.8).length,
    attempts: events.length,
    accuracy: events.length ? correct / events.length : null,
    lapses: states.reduce((sum, state) => sum + (state.lapses ?? 0), 0),
  };
}

export function dailyActivity(progress, days = 7, now = new Date()) {
  const localKey = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.valueOf())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const result = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const key = localKey(date);
    result.push({ date: key, count: (progress.reviewHistory ?? []).filter((event) => localKey(event.reviewedAt) === key).length });
  }
  return result;
}