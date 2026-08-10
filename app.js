import { startRouter } from "./js/router.js";
import { exportProgress, importProgress, loadProgress, loadSettings, resetProgress, saveProgress, saveSettings } from "./js/storage.js";
import { element, icon, formatStatus } from "./js/utils.js";
import { loadJson, onlyPublished } from "./js/validators.js";
import { mountWritingCanvas } from "./js/writing.js";
import { buildReviewQueue, createStudyItems, getItemProgress, gradeItem, undoGrade } from "./js/study.js";
import { dailyActivity, summarizeProgress } from "./js/analytics.js";

const root = document.querySelector("#app-content");
let canvasController = null;

function header(title, description) {
  return element("header", { className: "view-header", children: [
    element("h2", { text: title }), element("p", { text: description }),
  ] });
}

function metric(value, label) {
  return element("div", { className: "metric", children: [element("strong", { text: value }), element("span", { text: label })] });
}

function renderHome(state) {
  const summary = summarizeProgress(state.progress);
  const queue = buildReviewQueue(state.studyItems, state.progress, state.srsDefaults);
  const view = element("div");
  view.append(
    header("Tu estudio, en bloques claros", "El contenido visible ha pasado la política de publicación del proyecto."),
    element("div", { className: "metric-strip", children: [
      metric(queue.length, "Repasos y nuevos"),
      metric(summary.practiced, "Practicados"),
      metric(summary.accuracy === null ? "—" : `${Math.round(summary.accuracy * 100)}%`, "Precisión"),
    ] }),
  );
  const band = element("section", { className: "section-band", children: [
    element("h3", { text: "Prioridad actual" }),
    element("p", { className: "status-line", text: state.publishedExams.length > 1 ? "La invitación y la presentación oral están disponibles para consultar y practicar." : state.publishedExams.length ? "Hay una evaluación oral disponible para consultar y practicar." : "Aún no hay contenido académico validado para publicar." }),
    element("div", { className: "action-row", children: [
      element("a", { className: "primary-action", attributes: { href: "#/review" }, children: [icon("rotate-ccw"), document.createTextNode(`Iniciar sesión (${Math.min(queue.length, state.progress.reviewGoal ?? 10)})`)] }),
      element("a", { className: "secondary-action", attributes: { href: "#/writing" }, children: [icon("pen-line"), document.createTextNode("Practicar escritura")] }),
    ] }),
  ] });
  view.append(band);
  return view;
}

function renderStudy(state) {
  const view = element("div");
  view.append(header("Estudiar", "Las lecciones aparecen aquí únicamente después de alcanzar estado verified."));
  const band = element("section", { className: "section-band" });
  if (!state.publishedLessons.length) {
    band.append(element("h3", { text: "Contenido en revisión" }), element("p", { className: "status-line", text: `${state.reviewCount} elementos permanecen fuera del estudio hasta completar la revisión de fuentes.` }));
  }
  for (const lesson of state.publishedLessons) {
    const keyPoints = element("ul", { className: "key-point-list" });
    for (const point of lesson.keyPoints) keyPoints.append(element("li", { text: point }));
    const patterns = element("div", { className: "pattern-grid" });
    for (const grammarId of lesson.grammarIds) {
      const grammar = state.publishedGrammar.find((item) => item.id === grammarId);
      if (!grammar) continue;
      patterns.append(element("div", { className: "pattern-item", children: [
        element("strong", { text: grammar.pattern, attributes: { lang: "ja" } }),
        element("small", { className: "romaji", text: grammar.romaji }),
        element("span", { text: grammar.meaning }),
      ] }));
    }
    band.append(element("article", { className: "lesson-block", children: [
      element("p", { className: "lesson-meta", text: `${lesson.level} · Semana ${lesson.weeks.join(", ")}` }),
      element("h3", { text: lesson.title }),
      element("p", { text: lesson.summary }),
      keyPoints,
      element("h4", { text: "Patrones evaluados" }),
      patterns,
      element("div", { className: "action-row", children: [
        element("a", { className: "primary-action", attributes: { href: "#/exam" }, children: [icon("messages-square"), document.createTextNode("Ensayar conversación")] }),
      ] }),
    ] }));
  }
  view.append(band);
  return view;
}

function renderStudySession(state, title, description) {
  const queue = buildReviewQueue(state.studyItems, state.progress, state.srsDefaults);
  const view = element("div", { children: [header(title, description)] });
  if (!queue.length) {
    view.append(element("section", { className: "section-band", children: [element("h3", { text: "Todo al día" }), element("p", { className: "empty-state", text: "No quedan elementos disponibles en esta sesión." })] }));
    return view;
  }
  const item = queue[0];
  const itemState = getItemProgress(state.progress, item.id, state.srsDefaults);
  const answer = element("div", { className: "card-answer", text: item.answer });
  answer.hidden = true;
  const reveal = element("button", { className: "primary-action", attributes: { type: "button" }, text: "Mostrar respuesta" });
  const grades = element("div", { className: "grade-grid", attributes: { "aria-label": "Calificar recuerdo" } });
  grades.hidden = true;
  for (let grade = 0; grade <= 5; grade += 1) {
    const button = element("button", { attributes: { type: "button", title: `Calificación ${grade}` }, text: String(grade) });
    button.addEventListener("click", () => {
      const { previous } = gradeItem(state.progress, item, grade, state.srsDefaults);
      state.lastUndo = { itemId: item.id, previous };
      saveProgress(state.progress);
      state.refresh();
    });
    grades.append(button);
  }
  reveal.addEventListener("click", () => { answer.hidden = false; grades.hidden = false; reveal.hidden = true; });
  const favorite = element("button", { className: "secondary-action", attributes: { type: "button" }, children: [icon("star"), document.createTextNode(itemState.favorite ? "Quitar favorito" : "Favorito")] });
  favorite.addEventListener("click", () => {
    itemState.favorite = !itemState.favorite;
    state.progress.itemProgress[item.id] = itemState;
    state.progress.favorites = itemState.favorite ? [...new Set([...state.progress.favorites, item.id])] : state.progress.favorites.filter((id) => id !== item.id);
    saveProgress(state.progress); state.refresh();
  });
  const suspend = element("button", { className: "secondary-action", attributes: { type: "button" }, children: [icon("pause"), document.createTextNode("Suspender")] });
  suspend.addEventListener("click", () => { itemState.suspended = true; state.progress.itemProgress[item.id] = itemState; saveProgress(state.progress); state.refresh(); });
  const undo = element("button", { className: "secondary-action", attributes: { type: "button" }, children: [icon("undo-2"), document.createTextNode("Deshacer último repaso")] });
  undo.addEventListener("click", () => {
    if (!state.lastUndo) return;
    undoGrade(state.progress, state.lastUndo.itemId, state.lastUndo.previous);
    state.lastUndo = null;
    saveProgress(state.progress); state.refresh();
  });
  undo.disabled = !state.lastUndo;
  view.append(element("section", { className: "section-band", children: [
    element("p", { className: "lesson-meta", text: `${queue.length} elementos en cola · ${itemState.seen ? "Repaso" : "Nuevo"}` }),
    element("article", { className: "flashcard", children: [element("div", { className: "card-prompt", attributes: { lang: "ja" }, text: item.prompt }), element("div", { className: "romaji", text: item.romaji }), answer] }),
    reveal, grades, element("div", { className: "action-row", children: [favorite, suspend, undo] }),
    element("p", { className: "status-line", text: `Fuente trazable: ${item.sourceIds.join(", ")}. Califica 0–5 después de revelar la respuesta.` }),
  ] }));
  return view;
}

function renderCatalog(kind) {
  const label = kind === "kana" ? "Kana" : "Kanji";
  return element("div", { children: [header(label, `Catálogo ${label.toLowerCase()} validado.`), element("section", { className: "section-band", children: [element("h3", { text: "Contenido pendiente" }), element("p", { className: "empty-state", text: `Todavía no hay elementos de ${label} promovidos a verified. El sistema no inventará datos ausentes.` })] })] });
}

function renderGrammar(state) {
  const list = element("section", { className: "section-band" });
  for (const item of state.publishedGrammar) list.append(element("article", { className: "pattern-item", children: [element("strong", { attributes: { lang: "ja" }, text: item.pattern }), element("small", { className: "romaji", text: item.romaji }), element("span", { text: item.meaning }), element("small", { text: item.sourceIds.join(", ") })] }));
  return element("div", { children: [header("Gramática", "Estructuras confirmadas y vinculadas a sus fuentes."), list] });
}

function renderQuiz(state) {
  const view = element("div", { children: [header("Quiz oral", "Autoevaluación guiada: las respuestas son abiertas y no tienen una solución única validada.")] });
  for (const question of state.publishedQuestions) {
    const input = element("input", { className: "form-control", attributes: { type: "text", lang: "ja", placeholder: "Formula tu respuesta en japonés" } });
    const feedback = element("p", { className: "status-line", text: question.explanation }); feedback.hidden = true;
    const check = element("button", { className: "secondary-action", attributes: { type: "button" }, text: "Revisar criterio" });
    check.addEventListener("click", () => { feedback.hidden = false; });
    view.append(element("section", { className: "section-band", children: [element("h3", { attributes: { lang: "ja" }, text: question.prompt }), element("p", { className: "romaji", text: question.romaji }), input, check, feedback] }));
  }
  return view;
}

function renderErrors(state) {
  const failed = state.progress.reviewHistory.filter((event) => event.grade < 3);
  const children = failed.length ? failed.slice().reverse().map((event) => element("p", { text: `${event.itemId} · calificación ${event.grade} · ${new Date(event.reviewedAt).toLocaleDateString("es")}` })) : [element("p", { className: "empty-state", text: "Todavía no hay errores registrados." })];
  return element("div", { children: [header("Mapa de errores", "Intentos que requieren más práctica."), element("section", { className: "section-band", children })] });
}

function renderImport() {
  const file = element("input", { className: "form-control", attributes: { type: "file", accept: ".json,.csv,application/json,text/csv" } });
  const preview = element("pre", { className: "status-line", text: "Selecciona JSON o CSV de hasta 1 MB." });
  file.addEventListener("change", async () => {
    const selected = file.files[0];
    if (!selected || selected.size > 1_000_000) { preview.textContent = "Archivo ausente o mayor de 1 MB."; return; }
    const text = await selected.text();
    try {
      const parsed = selected.name.toLowerCase().endsWith(".json") ? JSON.parse(text) : text.trim().split(/\r?\n/).slice(1);
      const count = Array.isArray(parsed) ? parsed.length : 1;
      preview.textContent = `Vista previa: ${count} registro(s). Estado obligatorio: needs-review. Nada se publica automáticamente.`;
    } catch { preview.textContent = "El archivo no tiene una estructura válida."; }
  });
  return element("div", { children: [header("Importar contenido", "Vista previa local y revisión obligatoria antes de publicar."), element("section", { className: "section-band", children: [file, preview] })] });
}

function downloadJson(name, text) {
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); link.download = name; link.click(); URL.revokeObjectURL(link.href);
}

function renderSettings(state) {
  const backup = element("button", { className: "primary-action", attributes: { type: "button" }, children: [icon("download"), document.createTextNode("Exportar progreso")] });
  backup.addEventListener("click", () => downloadJson("nihon-study-progress.json", exportProgress(state.progress, state.manifest.progressVersion)));
  const restoreInput = element("input", { attributes: { type: "file", accept: "application/json,.json", "aria-label": "Restaurar progreso" } });
  const notice = element("p", { className: "status-line", attributes: { role: "status" }, text: state.progressModel.privacyNotice });
  restoreInput.addEventListener("change", async () => { try { state.progress = importProgress(await restoreInput.files[0].text(), state.manifest.progressVersion); notice.textContent = "Copia restaurada correctamente."; } catch (error) { notice.textContent = error.message; } });
  const reset = element("button", { className: "secondary-action", attributes: { type: "button" }, children: [icon("trash-2"), document.createTextNode("Restablecer progreso")] });
  reset.addEventListener("click", () => { if (confirm("¿Eliminar todo el progreso local? Esta acción no se puede deshacer.")) { state.progress = resetProgress(state.progressModel.initialState); state.refresh(); } });
  return element("div", { children: [header("Configuración", "Privacidad, respaldo y recuperación local."), element("section", { className: "section-band", children: [element("div", { className: "action-row", children: [backup, restoreInput, reset] }), notice] })] });
}

function renderExam(state) {
  const view = element("div");
  view.append(header("Evaluaciones orales", "Consulta el objetivo y los criterios sin convertir la práctica en lectura memorizada."));
  for (const exam of state.publishedExams) {
    const criteria = element("ul", { className: "criteria-list" });
    for (const criterion of exam.criteria ?? []) criteria.append(element("li", { children: [element("span", { text: criterion.name }), element("strong", { text: `${criterion.maxPoints} pts` })] }));
    const requirements = element("ul", { className: "requirement-list" });
    for (const [index, requirement] of (exam.verifiedRequirements ?? []).entries()) {
      const romaji = exam.verifiedRequirementRomaji?.[index];
      requirements.append(element("li", { children: [element("span", { text: requirement, attributes: { lang: /[ぁ-んァ-ン一-龯]/.test(requirement) ? "ja" : "es" } }), romaji ? element("small", { className: "romaji", text: romaji }) : document.createDocumentFragment()] }));
    }
    const rehearsal = element("div", { className: "rehearsal-list" });
    const examQuestions = state.publishedQuestions.filter((question) => exam.lessonIds.includes(question.lessonId));
    for (const question of examQuestions) {
      const checkbox = element("input", { attributes: { type: "checkbox", id: `rehearse-${question.id}` } });
      rehearsal.append(element("label", { className: "rehearsal-item", attributes: { for: `rehearse-${question.id}` }, children: [
        checkbox,
        element("span", { children: [element("strong", { text: question.prompt, attributes: { lang: "ja" } }), element("small", { className: "romaji", text: question.romaji }), element("small", { text: question.explanation })] }),
      ] }));
    }
    view.append(element("section", { className: "section-band", children: [
      element("h3", { text: exam.task }),
      element("p", { text: `Formato: ${exam.format}. Estado: ${formatStatus(exam.validationStatus)}.${exam.maxPoints ? ` Total: ${exam.maxPoints} puntos.` : ""}` }),
      criteria.childElementCount ? criteria : document.createDocumentFragment(),
      requirements.childElementCount ? element("div", { className: "exam-subsection", children: [element("h4", { text: "Contenido verificado" }), requirements] }) : document.createDocumentFragment(),
      rehearsal.childElementCount ? element("div", { className: "exam-subsection", children: [element("h4", { text: "Cinco decisiones para el ensayo" }), rehearsal] }) : document.createDocumentFragment(),
      element("p", { className: "status-line", text: exam.id === "EXAM-N2-ORAL-INVITATION" ? "Practica una conversación natural. Usa el memo como apoyo, no como un guion completo." : "Explica las ideas principales con tus propias palabras. La memorización literal no es el objetivo." }),
    ] }));
  }
  return view;
}

function renderWriting() {
  const canvas = element("canvas", { attributes: { id: "writing-canvas", "aria-label": "Área de práctica de escritura" } });
  const clearButton = element("button", { className: "secondary-action", attributes: { type: "button" }, children: [icon("trash-2"), document.createTextNode("Limpiar")] });
  const undoButton = element("button", { className: "secondary-action", attributes: { type: "button" }, children: [icon("undo-2"), document.createTextNode("Deshacer trazo")] });
  const view = element("div", { children: [
    header("Práctica de escritura", "Práctica visual libre. El orden de trazos no fue validado en los materiales."),
    element("div", { className: "writing-layout", children: [
      element("div", { className: "writing-reference", attributes: { "aria-label": "Carácter de referencia: hi, nichi" }, children: [element("span", { attributes: { lang: "ja" }, text: "日" }), element("small", { className: "romaji", text: "hi / nichi" })] }),
      element("section", { className: "section-band", children: [canvas, element("div", { className: "canvas-tools action-row", children: [undoButton, clearButton] })] }),
    ] }),
  ] });
  requestAnimationFrame(() => {
    canvasController = mountWritingCanvas(canvas);
    clearButton.addEventListener("click", () => canvasController.clear());
    undoButton.addEventListener("click", () => canvasController.undo());
    window.lucide?.createIcons();
  });
  return view;
}

function renderProgress(state) {
  const summary = summarizeProgress(state.progress);
  const activity = dailyActivity(state.progress);
  return element("div", { children: [
    header("Progreso", "El progreso se guarda solo en este navegador."),
    element("div", { className: "metric-strip", children: [metric(summary.practiced, "Practicados"), metric(summary.attempts, "Intentos"), metric(summary.mastered, "Dominados")] }),
    element("section", { className: "section-band", children: [element("h3", { text: "Actividad · 7 días" }), element("div", { className: "heatmap-row", children: activity.map((day) => element("div", { className: "heatmap-day", attributes: { title: `${day.date}: ${day.count}`, "aria-label": `${day.date}: ${day.count} repasos` }, style: `height: ${Math.max(8, day.count * 16)}px` })) })] }),
    element("section", { className: "section-band", children: [element("h3", { text: "Privacidad" }), element("p", { className: "status-line", text: state.progressModel.privacyNotice })] }),
  ] });
}

async function bootstrap() {
  const [manifest, policy, progressModel, lessons, grammar, exams, questions] = await Promise.all([
    loadJson("./data/manifest.json"), loadJson("./data/app-policy.json"), loadJson("./data/progress-model.json"),
    loadJson("./data/lessons.json"), loadJson("./data/grammar.json"), loadJson("./data/exam-blueprints.json"),
    loadJson("./data/questions.json"),
  ]);
  const settings = loadSettings();
  document.documentElement.dataset.theme = settings.theme;
  const state = {
    manifest, policy, progressModel,
    progress: loadProgress(progressModel.initialState),
    publishedLessons: onlyPublished(lessons.lessons, policy),
    publishedGrammar: onlyPublished(grammar.grammar, policy),
    publishedExams: onlyPublished(exams.examBlueprints, policy),
    publishedQuestions: onlyPublished(questions.questions, policy),
    reviewCount: [...lessons.lessons, ...grammar.grammar, ...exams.examBlueprints].filter((item) => item.validationStatus !== "verified").length,
  };
  state.srsDefaults = progressModel.itemState.srsDefaults;
  state.studyItems = createStudyItems(state.publishedGrammar);

  document.querySelector("#theme-toggle").addEventListener("click", () => {
    settings.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = settings.theme;
    saveSettings(settings);
  });

  let currentRoute = "home";
  const renderCurrent = (route = currentRoute) => {
    currentRoute = route;
    canvasController?.destroy();
    canvasController = null;
    const renderers = {
      home: renderHome, study: renderStudy,
      review: (value) => renderStudySession(value, "Repaso de hoy", "Primero lo vencido; después, contenido nuevo dentro de tu meta diaria."),
      flashcards: (value) => renderStudySession(value, "Flashcards", "Revela la respuesta antes de calificar tu recuerdo de 0 a 5."),
      kana: () => renderCatalog("kana"), kanji: () => renderCatalog("kanji"), grammar: renderGrammar,
      quiz: renderQuiz, exam: renderExam, writing: renderWriting, errors: renderErrors,
      progress: renderProgress, import: renderImport, settings: renderSettings,
    };
    root.replaceChildren(renderers[route](state));
    root.focus({ preventScroll: true });
    window.lucide?.createIcons();
  };
  state.refresh = () => renderCurrent();
  startRouter(renderCurrent);
}

bootstrap().catch((error) => {
  root.replaceChildren(element("div", { className: "error-state", attributes: { role: "alert" }, text: `No se pudo iniciar la aplicación. ${error.message}` }));
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").then((registration) => {
    const offerUpdate = (worker) => {
      if (!worker || !confirm("Hay una nueva versión disponible. ¿Actualizar ahora?")) return;
      worker.postMessage("SKIP_WAITING");
    };
    if (registration.waiting) offerUpdate(registration.waiting);
    registration.addEventListener("updatefound", () => registration.installing?.addEventListener("statechange", () => {
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
    }));
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload());
    registration.update();
  }).catch(() => {}));
}