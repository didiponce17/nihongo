const MINIMUM_EASE_FACTOR = 1.3;

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addLocalDays(date, days) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + Math.max(0, days));
  return result;
}

export function reviewSrsItem(item, grade, reviewedAt = new Date()) {
  if (!Number.isInteger(grade) || grade < 0 || grade > 5) throw new RangeError("grade debe ser un entero entre 0 y 5.");
  if (!(reviewedAt instanceof Date) || Number.isNaN(reviewedAt.valueOf())) throw new TypeError("reviewedAt debe ser una fecha válida.");
  if (item.suspended) return structuredClone(item);

  const next = structuredClone(item);
  const previousRepetitions = Number.isFinite(next.repetitions) ? next.repetitions : 0;
  const previousInterval = Number.isFinite(next.intervalDays) ? Math.max(0, next.intervalDays) : 0;
  const previousEase = Number.isFinite(next.easeFactor) ? next.easeFactor : 2.5;

  if (grade < 3) {
    next.repetitions = 0;
    next.intervalDays = 1;
    next.lapses = (Number.isFinite(next.lapses) ? next.lapses : 0) + 1;
  } else {
    next.repetitions = previousRepetitions + 1;
    if (next.repetitions === 1) next.intervalDays = 1;
    else if (next.repetitions === 2) next.intervalDays = 6;
    else next.intervalDays = Math.max(1, Math.round(previousInterval * previousEase));
  }

  const easeDelta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
  next.easeFactor = Math.max(MINIMUM_EASE_FACTOR, previousEase + easeDelta);
  next.lastGrade = grade;
  next.lastReviewedAt = reviewedAt.toISOString();
  next.dueDate = localDateKey(addLocalDays(reviewedAt, next.intervalDays));
  next.reviewHistory = [...(Array.isArray(next.reviewHistory) ? next.reviewHistory : []), {
    reviewedAt: next.lastReviewedAt,
    grade,
    intervalDays: next.intervalDays,
    easeFactor: next.easeFactor,
  }];
  return next;
}

export function isDue(item, now = new Date()) {
  if (item.suspended || !item.dueDate) return false;
  return item.dueDate <= localDateKey(now);
}