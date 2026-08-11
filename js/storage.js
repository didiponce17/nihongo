const SETTINGS_KEY = "nihonStudy.settings.v1";
const PROGRESS_KEY = "nihonStudy.progress.v1";

function read(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed && typeof parsed === "object" ? parsed : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    if (error?.name === "QuotaExceededError") throw new Error("No hay espacio suficiente para guardar el progreso. Exporta una copia de seguridad.");
    throw error;
  }
}

export function loadSettings() {
  return read(SETTINGS_KEY, { theme: "light", reducedMotion: false });
}

export function saveSettings(settings) { return write(SETTINGS_KEY, settings); }
export function loadProgress(initialState) { return read(PROGRESS_KEY, initialState); }
export function saveProgress(progress) { return write(PROGRESS_KEY, progress); }

export function exportProgress(progress, progressVersion) {
  return JSON.stringify({ progressVersion, exportedAt: new Date().toISOString(), progress }, null, 2);
}

export function importProgress(text, expectedVersion) {
  const packageData = JSON.parse(text);
  if (!packageData || typeof packageData !== "object" || Array.isArray(packageData)) throw new Error("La copia no contiene un objeto JSON válido.");
  if (packageData.progressVersion !== expectedVersion) throw new Error(`La copia usa progressVersion ${packageData.progressVersion ?? "desconocida"}; se esperaba ${expectedVersion}.`);
  if (!packageData.progress || typeof packageData.progress !== "object" || Array.isArray(packageData.progress)) throw new Error("La copia no contiene progreso válido.");
  write(PROGRESS_KEY, packageData.progress);
  return packageData.progress;
}

export function resetProgress(initialState) {
  const clean = structuredClone(initialState);
  write(PROGRESS_KEY, clean);
  return clean;
}