import { isDue, reviewSrsItem } from "./srs.js";

export function createStudyItems(grammar) {
  return grammar.map((item) => ({
    id: item.id,
    kind: "grammar",
    prompt: item.pattern,
    romaji: item.romaji,
    answer: item.meaning,
    sourceIds: item.sourceIds,
  }));
}

export function getItemProgress(progress, itemId, defaults) {
  return structuredClone(progress.itemProgress[itemId] ?? { ...defaults, seen: false, favorite: false });
}

export function gradeItem(progress, item, grade, defaults, reviewedAt = new Date()) {
  const previous = getItemProgress(progress, item.id, defaults);
  const next = reviewSrsItem(previous, grade, reviewedAt);
  next.seen = true;
  next.masteryScore = Math.min(1, Math.max(0, (next.masteryScore ?? 0) + (grade >= 3 ? 0.15 : -0.2)));
  progress.itemProgress[item.id] = next;
  progress.reviewHistory.push({ itemId: item.id, kind: item.kind, grade, reviewedAt: next.lastReviewedAt });
  progress.lastSession = { itemId: item.id, reviewedAt: next.lastReviewedAt };
  return { progress, previous };
}

export function undoGrade(progress, itemId, previous) {
  if (previous) progress.itemProgress[itemId] = previous;
  else delete progress.itemProgress[itemId];
  const index = progress.reviewHistory.findLastIndex((event) => event.itemId === itemId);
  if (index >= 0) progress.reviewHistory.splice(index, 1);
  return progress;
}

export function buildReviewQueue(items, progress, defaults, now = new Date()) {
  return items
    .filter((item) => {
      const state = getItemProgress(progress, item.id, defaults);
      return !state.suspended && (isDue(state, now) || !state.seen);
    })
    .sort((left, right) => {
      const a = getItemProgress(progress, left.id, defaults);
      const b = getItemProgress(progress, right.id, defaults);
      if (a.seen !== b.seen) return a.seen ? -1 : 1;
      return (a.dueDate ?? "9999") .localeCompare(b.dueDate ?? "9999");
    });
}