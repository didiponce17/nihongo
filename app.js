import { startRouter } from "./js/router.js";
import { exportProgress, importProgress, loadProgress, loadSettings, resetProgress, saveProgress, saveSettings } from "./js/storage.js";
import { element, icon } from "./js/utils.js";
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
    header("Tu estudio, en bloques claros", "Elige una actividad, practica unos minutos y vuelve a Repaso para reforzar lo aprendido."),
    element("div", { className: "metric-strip", children: [
      metric(queue.length, "Repasos y nuevos"),
      metric(summary.practiced, "Practicados"),
      metric(summary.accuracy === null ? "—" : `${Math.round(summary.accuracy * 100)}%`, "Precisión"),
    ] }),
  );
  const band = element("section", { className: "section-band", children: [
    element("h3", { text: "Prioridad actual" }),
    element("p", { className: "status-line", text: "Empieza con diez tarjetas de Repaso o practica la presentación oral por secciones. No necesitas completar todo en una sola sesión." }),
    element("div", { className: "action-row", children: [
      element("a", { className: "primary-action", attributes: { href: "#/review" }, children: [icon("rotate-ccw"), document.createTextNode(`Iniciar sesión (${Math.min(queue.length, state.progress.reviewGoal ?? 10)})`)] }),
      element("a", { className: "secondary-action", attributes: { href: "#/writing" }, children: [icon("pen-line"), document.createTextNode("Practicar escritura")] }),
    ] }),
  ] });
  const coverage = element("section", { className: "section-band", children: [
    element("h3", { text: "Biblioteca por nivel" }),
    element("div", { className: "level-grid", children: [
      element("a", { className: "level-panel", attributes: { href: "#/kana" }, children: [element("span", { text: "Nivel Intro" }), element("strong", { text: `${state.publishedKana.length} kana` }), element("small", { text: "Hiragana y katakana" })] }),
      element("a", { className: "level-panel", attributes: { href: "#/kanji" }, children: [element("span", { text: "Nivel 1" }), element("strong", { text: `${state.publishedKanji.filter((item) => item.level === "Nivel 1").length} kanji` }), element("small", { text: "Lecturas, palabras y ejemplos" })] }),
      element("a", { className: "level-panel", attributes: { href: "#/listening" }, children: [element("span", { text: "Nivel 2" }), element("strong", { text: `${state.publishedKanji.filter((item) => item.level === "Nivel 2").length} kanji · 98 audios` }), element("small", { text: "Unidades, escucha y práctica oral" })] }),
    ] }),
    element("div", { className: "action-row", children: [element("a", { className: "secondary-action", attributes: { href: "#/vocabulary" }, children: [icon("book-a"), document.createTextNode(`Abrir ${state.publishedVocabulary.length} palabras`)] }), element("a", { className: "secondary-action", attributes: { href: "#/grammar" }, children: [icon("braces"), document.createTextNode("Ver gramática")] })] }),
  ] });
  view.append(band, coverage);
  return view;
}

function renderStudy(state) {
  const view = element("div");
  view.append(header("Lecciones", "Lee el objetivo, revisa los patrones y realiza la práctica guiada antes de ensayar sin ayudas."));
  const band = element("section", { className: "section-band" });
  if (!state.publishedLessons.length) band.append(element("h3", { text: "Próximas lecciones" }), element("p", { className: "status-line", text: "Mientras se agregan nuevas lecciones, puedes practicar Kana, Kanji, Vocabulario, Gramática y Escucha desde el menú." }));
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
  const countByKind = (kind) => state.studyItems.filter((item) => item.kind === kind).length;
  const reviewCategories = [
    ["all", `Todo (${state.studyItems.length})`], ["grammar", `Gramática (${countByKind("grammar")})`], ["vocabulary", `Vocabulario (${countByKind("vocabulary")})`], ["hiragana", `Hiragana · todas las formas (${countByKind("hiragana")})`], ["katakana", `Katakana · todas las formas (${countByKind("katakana")})`], ["kanji", `Kanji vistos (${countByKind("kanji")})`],
  ];
  const selectedCategory = state.reviewCategory ?? "all";
  const categorySelect = element("select", { className: "form-select review-category", attributes: { "aria-label": "Elegir categoría de repaso" }, children: reviewCategories.map(([value, label]) => element("option", { attributes: { value, ...(value === selectedCategory ? { selected: "" } : {}) }, text: label })) });
  categorySelect.addEventListener("change", () => { state.reviewCategory = categorySelect.value; state.refresh(); });
  const categoryItems = selectedCategory === "all" ? state.studyItems : state.studyItems.filter((item) => item.kind === selectedCategory);
  const queue = buildReviewQueue(categoryItems, state.progress, state.srsDefaults);
  const view = element("div", { children: [header(title, description)] });
  view.append(element("section", { className: "review-category-bar", children: [element("label", { attributes: { for: "review-category" }, text: "¿Qué quieres practicar hoy?" }), categorySelect] }));
  categorySelect.id = "review-category";
  if (!queue.length) {
    view.append(element("section", { className: "section-band", children: [element("h3", { text: "Todo al día en esta categoría" }), element("p", { className: "empty-state", text: "No quedan elementos disponibles aquí. Elige otra categoría para continuar." })] }));
    return view;
  }
  const item = queue[0];
  const itemState = getItemProgress(state.progress, item.id, state.srsDefaults);
  const itemGuides = {
    grammar: ["Gramática", "Recuerda para qué se usa este patrón."],
    hiragana: ["Hiragana", "Lee este kana en voz alta."],
    katakana: ["Katakana", "Lee este kana en voz alta."],
    kanji: ["Kanji", "Recuerda su significado y una lectura."],
    vocabulary: ["Vocabulario", "Recuerda el significado de esta palabra."],
  };
  const [itemType, recallPrompt] = itemGuides[item.kind] ?? ["Contenido", "Intenta recordar la respuesta."];
  const answerChildren = [element("h3", { text: "Respuesta" }), element("p", { text: item.answer })];
  if (item.kind === "grammar") {
    answerChildren.push(element("div", { className: "review-explanation", children: [element("strong", { text: "Cómo se usa" }), element("p", { text: item.formation })] }));
    if (item.id === "GRAM-N2-011") answerChildren.push(element("div", { className: "adjective-identification", children: [
      element("p", { children: [element("strong", { attributes: { lang: "ja" }, text: "楽しい (tanoshii)" }), document.createTextNode(" es un adjetivo い: se quita い y se añade かったです → 楽しかったです.")] }),
      element("p", { children: [element("strong", { attributes: { lang: "ja" }, text: "賑やか (nigiyaka)" }), document.createTextNode(" es un adjetivo な: se conserva la palabra y se añade でした → 賑やかでした.")] }),
    ] }));
    for (const example of item.examples ?? []) answerChildren.push(element("div", { className: "review-example", children: [element("strong", { attributes: { lang: "ja" }, text: example.japanese }), element("span", { className: "romaji", text: example.romaji }), element("span", { text: example.translation })] }));
  } else if (item.example) {
    const translation = item.example.spanish ?? item.example.translation;
    answerChildren.push(element("div", { className: "review-example", children: [element("strong", { attributes: { lang: "ja" }, text: item.example.japanese }), element("span", { className: "romaji", text: item.example.romaji }), element("span", { text: translation })] }));
    if (item.example.grammar) answerChildren.push(element("div", { className: "review-explanation", children: [element("strong", { text: "Estructura" }), element("p", { text: item.example.grammar })] }));
  }
  const answer = element("div", { className: "card-answer", children: answerChildren });
  answer.hidden = true;
  const reveal = element("button", { className: "primary-action", attributes: { type: "button" }, text: "Mostrar respuesta" });
  const grades = element("div", { className: "grade-grid", attributes: { "aria-label": "Calificar recuerdo" } });
  grades.hidden = true;
  const gradeLabels = ["No recordé", "Muy difícil", "Difícil", "Con ayuda", "Bien", "Fácil"];
  for (let grade = 0; grade <= 5; grade += 1) {
    const button = element("button", { attributes: { type: "button", title: `Calificación ${grade}: ${gradeLabels[grade]}` }, children: [element("strong", { text: String(grade) }), element("span", { text: gradeLabels[grade] })] });
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
    element("p", { className: "lesson-meta", text: `${itemType} · ${queue.length} elementos en cola · ${itemState.seen ? "Repaso" : "Nuevo"}` }),
    element("p", { text: recallPrompt }),
    element("ol", { className: "review-steps", children: ["Mira el patrón o la palabra e intenta explicar qué significa.", "Piensa en una oración propia antes de revelar la respuesta.", "Pulsa Mostrar respuesta, compara y elige cuánto apoyo necesitaste."].map((text) => element("li", { text })) }),
    element("article", { className: "flashcard", children: [element("div", { className: "card-prompt", attributes: { lang: "ja" }, text: item.prompt }), element("div", { className: "romaji", text: item.romaji }), answer] }),
    reveal, grades, element("div", { className: "action-row", children: [favorite, suspend, undo] }),
    element("div", { className: "review-help", children: [
      element("strong", { text: "Cómo practicar" }),
      element("p", { text: "Usa 0 si no lo recordaste, 3 si lo lograste con ayuda y 5 si pudiste explicarlo y crear un ejemplo sin ayuda." }),
    ] }),
  ] }));
  return view;
}

function renderKana(state) {
  const view = element("div", { children: [header("Kana · Nivel introductorio", "Hiragana y katakana: sonidos básicos, tenten, maru y combinaciones, siempre con romaji.")] });
  const scriptControls = element("div", { className: "segmented-control", attributes: { role: "group", "aria-label": "Silabario" } });
  const groupControls = element("div", { className: "segmented-control", attributes: { role: "group", "aria-label": "Tipo de sonido" } });
  const grid = element("div", { className: "kana-grid" });
  let selectedScript = "hiragana";
  let selectedGroup = "basic";
  const draw = () => {
    grid.replaceChildren(...state.publishedKana.filter((item) => item.script === selectedScript && item.group === selectedGroup).map((item) => element("article", { className: "kana-tile", children: [element("strong", { attributes: { lang: "ja" }, text: item.character }), element("span", { className: "romaji", text: item.romaji })] })));
  };
  for (const [script, label] of [["hiragana", "Hiragana"], ["katakana", "Katakana"]]) {
    const button = element("button", { attributes: { type: "button" }, text: label });
    button.addEventListener("click", () => { selectedScript = script; draw(); }); scriptControls.append(button);
  }
  for (const [group, label] of [["basic", "Básicos"], ["voiced", "Tenten y maru"], ["combinations", "Combinaciones"]]) {
    const button = element("button", { attributes: { type: "button" }, text: label });
    button.addEventListener("click", () => { selectedGroup = group; draw(); }); groupControls.append(button);
  }
  draw();
  view.append(element("section", { className: "section-band", children: [scriptControls, groupControls, element("p", { className: "status-line", text: "Tenten (゛) y maru (゜) cambian el sonido. En combinaciones, ゃ・ゅ・ょ se escriben pequeños y forman una sola sílaba, por ejemplo みょ (myo)." }), grid] }));
  return view;
}

function renderKanji(state) {
  const view = element("div", { children: [header("Kanji · Nivel 1 y Nivel 2", `${state.publishedKanji.length} kanji con lecturas, ejemplos, trazos y mnemónicos.`)] });
  const level = element("select", { className: "form-select", attributes: { "aria-label": "Filtrar por nivel" }, children: [element("option", { attributes: { value: "all" }, text: "Todos los niveles" }), element("option", { attributes: { value: "Nivel 1" }, text: "Nivel 1" }), element("option", { attributes: { value: "Nivel 2" }, text: "Nivel 2" })] });
  const search = element("input", { className: "form-control", attributes: { type: "search", placeholder: "Buscar kanji, significado o lectura", "aria-label": "Buscar kanji" } });
  const grid = element("div", { className: "kanji-grid" });
  const draw = () => {
    const query = search.value.trim().toLowerCase();
    const items = state.publishedKanji.filter((item) => (level.value === "all" || item.level === level.value) && [item.character, item.meaning, ...item.romaji].join(" ").toLowerCase().includes(query));
    grid.replaceChildren(...items.map((item) => element("article", { className: "kanji-card", children: [
      element("div", { className: "kanji-character", attributes: { lang: "ja" }, text: item.character }),
      element("div", { children: [element("h3", { text: item.meaning }), element("p", { className: "romaji", text: item.romaji.join(" · ") }), element("p", { text: `On: ${item.onyomi.map((reading) => `${reading.reading} (${reading.romaji})`).join(", ") || "—"}` }), element("p", { text: `Kun: ${item.kunyomi.map((reading) => `${reading.reading} (${reading.romaji})`).join(", ") || "—"}` }), element("p", { text: `${item.strokeCount} trazos · ${item.mnemonic}` }), element("p", { attributes: { lang: "ja" }, text: item.example.japanese }), element("small", { className: "romaji", text: item.example.romaji }), element("small", { text: item.example.translation })] }),
    ] })));
  };
  level.addEventListener("change", draw); search.addEventListener("input", draw); draw();
  view.append(element("section", { className: "section-band", children: [element("div", { className: "filter-row", children: [level, search] }), grid] }));
  return view;
}

function renderVocabulary(state) {
  const view = element("div", { children: [header("Vocabulario por temas", "Elige una categoría, aprende la palabra y abre su ejemplo para ver cómo se usa con la gramática de Nivel 2.")] });
  const categories = [...new Set(state.publishedVocabulary.map((item) => item.category))].sort((left, right) => left.localeCompare(right, "es"));
  const category = element("select", { className: "form-select", attributes: { "aria-label": "Filtrar por categoría" }, children: [element("option", { attributes: { value: "all" }, text: "Todas las categorías" }), ...categories.map((name) => element("option", { attributes: { value: name }, text: name }))] });
  const search = element("input", { className: "form-control", attributes: { type: "search", placeholder: "Buscar palabra, romaji o significado", "aria-label": "Buscar vocabulario" } });
  const list = element("div", { className: "vocabulary-list" });
  const resultCount = element("p", { className: "lesson-meta" });
  const draw = () => {
    const query = search.value.trim().toLowerCase();
    const items = state.publishedVocabulary.filter((item) => (category.value === "all" || item.category === category.value) && [item.japanese, item.reading, item.romaji, item.meaning].join(" ").toLowerCase().includes(query));
    resultCount.textContent = `${items.length} palabras · ${category.value === "all" ? "todos los temas" : category.value}`;
    list.replaceChildren(...items.map((item) => element("article", { className: "vocabulary-row", children: [
      element("div", { className: "vocabulary-main", children: [element("strong", { attributes: { lang: "ja" }, text: item.japanese }), element("span", { attributes: { lang: "ja" }, text: item.reading }), element("span", { className: "romaji", text: item.romaji }), element("span", { text: item.meaning }), element("small", { text: `${item.category} · ${item.level}` })] }),
      element("details", { className: "vocabulary-example", children: [
        element("summary", { text: "Ver oración y gramática" }),
        element("div", { children: [element("strong", { attributes: { lang: "ja" }, text: item.example.japanese }), element("span", { className: "romaji", text: item.example.romaji }), element("p", { text: item.example.spanish }), element("p", { className: "grammar-note", children: [element("strong", { text: "Estructura: " }), document.createTextNode(item.example.grammar)] })] }),
      ] }),
    ] })));
  };
  category.addEventListener("change", draw); search.addEventListener("input", draw); draw();
  view.append(element("section", { className: "section-band", children: [element("p", { className: "status-line", text: "Práctica sugerida: mira el japonés, di la lectura y el significado sin mirar; después comprueba el romaji y el español." }), element("div", { className: "filter-row", children: [category, search] }), resultCount, list] }));
  return view;
}

function renderListening(state) {
  const selectedLesson = state.listeningLesson ?? 1;
  const lessonSelector = element("select", { className: "form-select listening-lesson-select", attributes: { "aria-label": "Elegir lección de escucha" }, children: Array.from({ length: 6 }, (_, index) => {
    const lesson = index + 1;
    const trackCount = state.media.filter((item) => item.type === "audio" && item.lesson === lesson).length;
    return element("option", { attributes: { value: String(lesson), ...(lesson === selectedLesson ? { selected: "" } : {}) }, text: `Lección ${lesson} · ${trackCount} pistas` });
  }) });
  lessonSelector.addEventListener("change", () => { state.listeningLesson = Number(lessonSelector.value); state.refresh(); });
  const view = element("div", { children: [header("Escucha · Nivel 2", "Estudia primero la gramática y el vocabulario de una lección; después escucha sus pistas y repite cada intervención.")] });
  view.append(element("section", { className: "listening-lesson-bar", children: [element("label", { attributes: { for: "listening-lesson" }, text: "Lección para estudiar" }), lessonSelector] }));
  lessonSelector.id = "listening-lesson";
  view.append(element("section", { className: "section-band", children: [element("h3", { text: "Cómo practicar" }), element("ol", { className: "requirement-list", children: ["Escucha una vez sin leer.", "Abre la transcripción y localiza las expresiones principales.", "Escucha de nuevo siguiendo japonés y romaji.", "Repite en voz alta y confirma el sentido en español."].map((text) => element("li", { text })) })] }));
  const guide = state.listeningGuides.find((item) => item.lesson === selectedLesson);
  if (guide) {
    const grammarCards = guide.grammarIds.map((grammarId) => state.publishedGrammar.find((item) => item.id === grammarId)).filter(Boolean).map((item) => element("article", { className: "listening-study-card", children: [
      element("h4", { text: item.name }), element("strong", { attributes: { lang: "ja" }, text: item.pattern }), element("span", { className: "romaji", text: item.romaji }), element("p", { text: item.meaning }),
      element("p", { className: "listening-formation", children: [element("strong", { text: "Cómo se forma: " }), document.createTextNode(item.formation)] }),
      ...(item.examples ?? []).slice(0, 2).map((example) => element("div", { className: "listening-example", children: [element("strong", { attributes: { lang: "ja" }, text: example.japanese }), element("span", { className: "romaji", text: example.romaji }), element("small", { text: example.translation })] })),
    ] }));
    const vocabularyCards = guide.vocabulary.map((item) => element("article", { className: "listening-study-card", children: [element("h4", { text: item.theme }), element("strong", { attributes: { lang: "ja" }, text: item.japanese }), element("span", { className: "romaji", text: item.romaji }), element("p", { text: item.spanish }), element("p", { className: "listening-use", children: [element("strong", { text: "Cómo usarlo: " }), document.createTextNode(item.use)] })] }));
    const ruleCards = guide.rules.map((item) => element("article", { className: "listening-study-card", children: [element("h4", { text: item.name }), element("p", { text: item.explanation }), element("strong", { attributes: { lang: "ja" }, text: item.japanese }), element("span", { className: "romaji", text: item.romaji }), element("small", { text: item.spanish })] }));
    view.append(element("section", { className: "listening-guide", children: [
      element("div", { className: "listening-guide-heading", children: [element("p", { className: "lesson-meta", text: `Lección ${guide.lesson}` }), element("h2", { text: guide.title }), element("p", { text: guide.objective })] }),
      element("details", { className: "listening-guide-section", attributes: { open: "" }, children: [element("summary", { text: `Gramática de la lección · ${grammarCards.length} puntos` }), element("div", { className: "listening-study-grid", children: grammarCards })] }),
      element("details", { className: "listening-guide-section", attributes: { open: "" }, children: [element("summary", { text: `Vocabulario en contexto · ${vocabularyCards.length} temas` }), element("div", { className: "listening-study-grid", children: vocabularyCards })] }),
      element("details", { className: "listening-guide-section", children: [element("summary", { text: `Reglas adicionales · ${ruleCards.length}` }), element("div", { className: "listening-study-grid", children: ruleCards })] }),
    ] }));
  }
  const tracks = state.media.filter((item) => item.type === "audio" && item.lesson === selectedLesson);
  const lessonTranscripts = state.transcripts.filter((item) => item.lesson === selectedLesson);
  const topics = [...new Map(lessonTranscripts.map((item) => [item.topic.title, item.topic])).values()];
  view.append(element("section", { className: "section-band listening-topics", children: [element("h3", { text: "Temas que escucharás" }), element("div", { className: "listening-topic-grid", children: topics.map((topic) => element("article", { children: [element("h4", { text: topic.title }), element("p", { text: topic.explanation })] })) })] }));
  const body = element("div", { className: "audio-list" });
  for (const track of tracks) {
    const transcript = state.transcripts.find((item) => item.audioId === track.id);
    const trackHeader = element("div", { className: "audio-heading", children: [element("strong", { text: `Pista ${track.track ?? transcript?.track ?? ""}` })] });
    const audioPlayer = track.playable && track.publicPath ? element("audio", { attributes: { controls: "", preload: "none", src: track.publicPath } }) : null;
    if (audioPlayer) trackHeader.append(audioPlayer);
    const article = element("article", { className: "audio-row", children: [trackHeader] });
    if (transcript) {
      const focus = element("div", { className: "language-focus", children: transcript.topic.focus.map((item) => element("div", { children: [element("strong", { attributes: { lang: "ja" }, text: item.japanese }), element("span", { className: "romaji", text: item.romaji }), element("small", { text: item.meaning })] })) });
      const dialogue = element("div", { className: "transcript-dialogue" });
      for (const line of transcript.dialogue) {
        const cue = Number.isFinite(line.start) ? element("button", { className: "transcript-cue", attributes: { type: "button", title: "Escuchar desde este punto" }, text: `${Math.floor(line.start / 60)}:${String(Math.floor(line.start % 60)).padStart(2, "0")}` }) : null;
        if (cue && audioPlayer) cue.addEventListener("click", () => { audioPlayer.currentTime = line.start; audioPlayer.play().catch(() => {}); });
        dialogue.append(element("div", { className: "transcript-line", children: [cue, line.speaker ? element("strong", { className: "speaker", text: line.speaker }) : null, element("span", { className: "japanese-line", attributes: { lang: "ja" }, text: line.japanese }), element("span", { className: "romaji", text: line.romaji }), element("span", { className: "translation", text: line.spanish })].filter(Boolean) }));
      }
      article.append(element("details", { className: "transcript-details", children: [element("summary", { text: "Ver transcripción y explicación" }), element("div", { className: "topic-explanation", children: [element("h4", { text: transcript.topic.title }), element("p", { text: transcript.topic.explanation }), focus] }), dialogue] }));
    }
    body.append(article);
  }
  view.append(element("section", { className: "section-band", children: [element("h3", { text: `Pistas de la Lección ${selectedLesson} · ${tracks.length}` }), body] }));
  return view;
}

function renderGrammar(state) {
  const study = state.grammarStudy;
  const activeView = state.grammarView ?? "review";
  const view = element("div", { children: [header("Taller de gramática", "Repasa por nivel, compara formas, consulta palabras y comprueba lo aprendido con ejercicios explicados.")] });
  const tabs = [["review", "Repaso por nivel"], ["forms", "Formas verbales"], ["words", "Banco de palabras"], ["exercises", "Ejercicios"]];
  view.append(element("nav", { className: "grammar-tabs", attributes: { "aria-label": "Secciones de gramática" }, children: tabs.map(([id, label]) => {
    const button = element("button", { className: id === activeView ? "is-active" : "", attributes: { type: "button", "aria-pressed": String(id === activeView) }, text: label });
    button.addEventListener("click", () => { state.grammarView = id; state.refresh(); });
    return button;
  }) }));

  if (activeView === "review") {
    const activeLevel = state.grammarLevel ?? study.levels[0].id;
    const level = study.levels.find((item) => item.id === activeLevel) ?? study.levels[0];
    const selector = element("select", { className: "form-select", attributes: { "aria-label": "Elegir nivel de gramática" }, children: study.levels.map((item) => element("option", { attributes: { value: item.id, ...(item.id === level.id ? { selected: "" } : {}) }, text: `${item.name} · ${item.units.length} repasos` })) });
    selector.addEventListener("change", () => { state.grammarLevel = selector.value; state.refresh(); });
    const units = level.units.map((unit, unitIndex) => {
      const grammarItems = (unit.grammarIds ?? []).map((id) => state.publishedGrammar.find((item) => item.id === id)).filter(Boolean);
      const examples = unit.example ? [unit.example] : grammarItems.flatMap((item) => (item.examples ?? []).slice(0, 1).map((example) => ({ ...example, spanish: example.translation, explanation: item.formation })));
      return element("details", { className: "grammar-unit", attributes: { ...(unitIndex === 0 ? { open: "" } : {}) }, children: [
        element("summary", { children: [element("strong", { text: unit.title }), element("span", { text: `${unit.points.length} temas` })] }),
        element("div", { className: "grammar-unit-body", children: [
          element("ul", { className: "grammar-point-list", children: unit.points.map((point) => element("li", { text: point })) }),
          ...grammarItems.map((item) => element("article", { className: "grammar-pattern-card", children: [element("h4", { text: item.name }), element("strong", { attributes: { lang: "ja" }, text: item.pattern }), element("span", { className: "romaji", text: item.romaji }), element("p", { text: item.meaning }), element("p", { className: "simple-explanation", children: [element("strong", { text: "En palabras simples: " }), document.createTextNode(item.formation)] })] })),
          ...examples.map((example) => element("div", { className: "explained-example", children: [element("strong", { attributes: { lang: "ja" }, text: example.japanese }), element("span", { className: "romaji", text: example.romaji }), element("span", { text: example.spanish }), element("p", { children: [element("strong", { text: "¿Por qué? " }), document.createTextNode(example.explanation)] })] })),
        ] }),
      ] });
    });
    view.append(element("section", { className: "grammar-level-heading", children: [element("div", { children: [element("p", { className: "lesson-meta", text: "Ruta de estudio" }), element("h2", { text: level.name }), element("p", { text: level.description })] }), selector] }), element("div", { className: "grammar-unit-list", children: units }));
  }

  if (activeView === "forms") {
    const activeVerb = state.grammarVerb ?? study.conjugations[0].verb;
    const verb = study.conjugations.find((item) => item.verb === activeVerb) ?? study.conjugations[0];
    const selector = element("select", { className: "form-select", attributes: { "aria-label": "Elegir verbo para conjugar" }, children: study.conjugations.map((item) => element("option", { attributes: { value: item.verb, ...(item.verb === verb.verb ? { selected: "" } : {}) }, text: `${item.verb} · ${item.romaji} · ${item.spanish}` })) });
    selector.addEventListener("change", () => { state.grammarVerb = selector.value; state.refresh(); });
    const rows = verb.forms.map(([label, japanese, romaji, spanish]) => element("div", { className: "conjugation-row", children: [element("strong", { text: label }), element("span", { attributes: { lang: "ja" }, text: japanese }), element("span", { className: "romaji", text: romaji }), element("span", { text: spanish })] }));
    const adjectiveRows = [["い · presente +", "暑いです", "atsui desu", "hace calor"], ["い · presente −", "暑くないです", "atsukunai desu", "no hace calor"], ["い · pasado +", "暑かったです", "atsukatta desu", "hizo calor"], ["い · pasado −", "暑くなかったです", "atsukunakatta desu", "no hizo calor"], ["な · presente +", "静かです", "shizuka desu", "es tranquilo"], ["な · presente −", "静かではありません", "shizuka dewa arimasen", "no es tranquilo"], ["な · pasado +", "静かでした", "shizuka deshita", "fue tranquilo"], ["な · pasado −", "静かではありませんでした", "shizuka dewa arimasen deshita", "no fue tranquilo"]];
    view.append(element("section", { className: "section-band", children: [element("div", { className: "grammar-tool-heading", children: [element("div", { children: [element("h2", { text: "Verbos en afirmativo y negativo" }), element("p", { text: "El presente cortés también expresa futuro; palabras como hoy, mañana o ayer aclaran el tiempo." })] }), selector] }), element("div", { className: "conjugation-board", children: rows }), element("div", { className: "simple-explanation", children: [element("strong", { text: "Regla rápida: " }), document.createTextNode("ます afirma; ません niega; ました marca pasado afirmativo; ませんでした marca pasado negativo.")] })] }), element("section", { className: "section-band", children: [element("h2", { text: "Adjetivos en los cuatro tiempos" }), element("p", { text: "Los adjetivos い cambian su terminación. Los adjetivos な conservan la palabra y cambian la forma de です." }), element("div", { className: "conjugation-board", children: adjectiveRows.map(([label, japanese, romaji, spanish]) => element("div", { className: "conjugation-row", children: [element("strong", { text: label }), element("span", { attributes: { lang: "ja" }, text: japanese }), element("span", { className: "romaji", text: romaji }), element("span", { text: spanish })] })) })] }));
  }

  if (activeView === "words") {
    const type = state.grammarWordType ?? "verbs";
    const labels = { verbs: "Verbos", nouns: "Sustantivos", adjectives: "Adjetivos" };
    const result = element("div", { className: "word-bank-grid" });
    const search = element("input", { className: "form-control", attributes: { type: "search", placeholder: "Buscar japonés, romaji o español", "aria-label": "Buscar en el banco de palabras" } });
    const count = element("p", { className: "lesson-meta" });
    const draw = () => {
      const query = search.value.trim().toLowerCase();
      const items = study.words[type].filter((item) => [item.japanese, item.reading, item.romaji, item.spanish, item.subtype].join(" ").toLowerCase().includes(query));
      count.textContent = `${items.length} ${labels[type].toLowerCase()}`;
      result.replaceChildren(...items.map((item) => element("article", { className: "word-bank-card", children: [element("span", { className: "word-type", text: item.subtype }), element("strong", { attributes: { lang: "ja" }, text: item.japanese }), element("span", { attributes: { lang: "ja" }, text: item.reading }), element("span", { className: "romaji", text: item.romaji }), element("span", { text: item.spanish })] })));
    };
    search.addEventListener("input", draw);
    const controls = Object.entries(labels).map(([id, label]) => {
      const button = element("button", { className: id === type ? "is-active" : "", attributes: { type: "button", "aria-pressed": String(id === type) }, text: `${label} (${study.words[id].length})` });
      button.addEventListener("click", () => { state.grammarWordType = id; state.refresh(); });
      return button;
    });
    draw();
    view.append(element("section", { className: "section-band", children: [element("h2", { text: "Banco de palabras" }), element("p", { text: "Compara la lectura, el romaji, el significado y el tipo antes de usarlos en una oración." }), element("div", { className: "word-type-tabs", children: controls }), search, count, result] }));
  }

  if (activeView === "exercises") {
    const index = Math.min(state.grammarExerciseIndex ?? 0, study.exercises.length - 1);
    const exercise = study.exercises[index];
    const feedback = element("div", { className: "exercise-feedback", attributes: { role: "status", "aria-live": "polite" } });
    const options = exercise.options.map((option, optionIndex) => {
      const button = element("button", { attributes: { type: "button" }, children: [element("span", { text: String.fromCharCode(65 + optionIndex) }), element("strong", { attributes: { lang: "ja" }, text: option })] });
      button.addEventListener("click", () => {
        options.forEach((candidate, candidateIndex) => { candidate.disabled = true; candidate.classList.toggle("is-correct", candidateIndex === exercise.answer); });
        button.classList.toggle("is-incorrect", optionIndex !== exercise.answer);
        feedback.className = `exercise-feedback ${optionIndex === exercise.answer ? "is-correct" : "is-incorrect"}`;
        feedback.replaceChildren(element("strong", { text: optionIndex === exercise.answer ? "Correcto" : "Revisa la forma" }), element("p", { text: exercise.explanation }));
      });
      return button;
    });
    const previous = element("button", { className: "secondary-action", attributes: { type: "button", ...(index === 0 ? { disabled: "" } : {}) }, text: "Anterior" });
    const next = element("button", { className: "primary-action", attributes: { type: "button", ...(index === study.exercises.length - 1 ? { disabled: "" } : {}) }, text: "Siguiente" });
    previous.addEventListener("click", () => { state.grammarExerciseIndex = index - 1; state.refresh(); });
    next.addEventListener("click", () => { state.grammarExerciseIndex = index + 1; state.refresh(); });
    view.append(element("section", { className: "grammar-exercise", children: [element("p", { className: "lesson-meta", text: `Ejercicio ${index + 1} de ${study.exercises.length}` }), element("h2", { text: "Escoge la forma correcta" }), element("p", { className: "exercise-prompt", attributes: { lang: "ja" }, text: exercise.prompt }), element("span", { className: "romaji", text: exercise.romaji }), element("p", { text: exercise.spanish }), element("div", { className: "exercise-options", children: options }), feedback, element("div", { className: "exercise-navigation", children: [previous, next] })] }));
  }
  return view;
}

function renderQuiz(state) {
  const view = element("div", { children: [header("Quiz oral", "Lee la pregunta en voz alta, responde en japonés y después revisa qué información debe contener tu respuesta.")] });
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
  const kindLabels = { grammar: "Gramática", hiragana: "Hiragana", katakana: "Katakana", kanji: "Kanji", vocabulary: "Vocabulario" };
  const children = failed.length ? failed.slice().reverse().map((event) => {
    const item = state.studyItems.find((candidate) => candidate.id === event.itemId);
    return element("article", { className: "error-item", children: [element("strong", { attributes: { lang: "ja" }, text: item?.prompt ?? "Contenido de repaso" }), element("span", { text: `${kindLabels[event.kind] ?? "Práctica"} · ${new Date(event.reviewedAt).toLocaleDateString("es")}` }), element("small", { text: "Vuelve a estudiarlo y trata de recordarlo antes de mostrar la respuesta." })] });
  }) : [element("p", { className: "empty-state", text: "Aquí aparecerán las tarjetas que califiques de 0 a 2. Por ahora no tienes elementos pendientes de refuerzo." })];
  return element("div", { children: [header("Temas para reforzar", "Usa esta lista para volver a practicar lo que todavía cuesta recordar."), element("section", { className: "section-band", children })] });
}

function downloadJson(name, text) {
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); link.download = name; link.click(); URL.revokeObjectURL(link.href);
}

function renderSettings(state) {
  const backup = element("button", { className: "primary-action", attributes: { type: "button" }, children: [icon("download"), document.createTextNode("Exportar progreso")] });
  backup.addEventListener("click", () => downloadJson("nihon-study-progress.json", exportProgress(state.progress, state.manifest.progressVersion)));
  const restoreInput = element("input", { attributes: { type: "file", accept: "application/json,.json", "aria-label": "Restaurar progreso" } });
  const notice = element("p", { className: "status-line", attributes: { role: "status" }, text: "Descarga una copia de tu avance para poder recuperarlo si cambias de equipo o restableces la aplicación." });
  restoreInput.addEventListener("change", async () => { try { state.progress = importProgress(await restoreInput.files[0].text(), state.manifest.progressVersion); notice.textContent = "Copia restaurada correctamente."; } catch (error) { notice.textContent = error.message; } });
  const reset = element("button", { className: "secondary-action", attributes: { type: "button" }, children: [icon("trash-2"), document.createTextNode("Restablecer progreso")] });
  reset.addEventListener("click", () => { if (confirm("¿Eliminar todo el progreso local? Esta acción no se puede deshacer.")) { state.progress = resetProgress(state.progressModel.initialState); state.refresh(); } });
  return element("div", { children: [header("Configuración", "Guarda una copia de tu avance, recupera una copia anterior o comienza de nuevo."), element("section", { className: "section-band", children: [element("h3", { text: "Tu progreso" }), notice, element("div", { className: "action-row", children: [backup, restoreInput, reset] })] })] });
}

function renderOralModel(presentation) {
  const sections = presentation.sections.map((section) => {
    const checklist = section.checklist?.length ? element("ul", { className: "oral-checklist", children: section.checklist.map((text) => element("li", { text })) }) : document.createDocumentFragment();
    const lines = element("div", { className: "oral-lines", children: section.lines.map((line) => element("article", { className: "oral-line", children: [
      element("div", { children: [element("strong", { text: "日本語" }), element("p", { attributes: { lang: "ja" }, text: line.japanese })] }),
      element("div", { children: [element("strong", { text: "Romaji" }), element("p", { className: "romaji", text: line.romaji })] }),
      element("div", { children: [element("strong", { text: "Español" }), element("p", { text: line.spanish })] }),
    ] })) });
    return element("section", { className: "section-band oral-section", children: [element("p", { className: "oral-number", text: section.number }), element("h3", { text: section.title }), element("p", { className: "status-line", text: section.guide }), checklist, lines] });
  });
  return element("div", { className: "oral-model", children: [
    element("section", { className: "section-band", children: [element("p", { className: "lesson-meta", text: presentation.level }), element("h3", { text: presentation.title }), element("p", { text: presentation.purpose }), element("h4", { text: "Cómo usar el modelo" }), element("ol", { className: "requirement-list", children: presentation.practiceSteps.map((text) => element("li", { text })) })] }),
    ...sections,
  ] });
}

function renderConversationLab(lab) {
  let turnIndex = 0;
  const conversation = element("div", { className: "conversation-thread" });
  const activity = element("div", { className: "conversation-activity" });
  const progress = element("p", { className: "lesson-meta" });

  const appendLine = (line) => conversation.append(element("article", { className: `conversation-bubble speaker-${line.speaker.toLowerCase()}`, children: [
    element("span", { className: "conversation-speaker", text: `Persona ${line.speaker}` }),
    element("strong", { attributes: { lang: "ja" }, text: line.japanese }),
    element("span", { className: "romaji", text: line.romaji }),
    element("span", { text: line.spanish }),
  ] }));

  const drawTurn = () => {
    activity.replaceChildren();
    if (turnIndex >= lab.turns.length) {
      appendLine(lab.modelClosing);
      progress.textContent = "Conversación completa";
      const personalDraft = element("textarea", { className: "form-control conversation-draft", attributes: { rows: "4", lang: "ja", placeholder: lab.id === "invite" ? "Escribe tu invitación: actividad, día, hora y lugar." : "Describe tu barrio: ambiente, un lugar y una recomendación.", "aria-label": "Escribe tu versión personal en japonés" } });
      const reset = element("button", { className: "secondary-action", attributes: { type: "button" }, children: [icon("rotate-ccw"), document.createTextNode("Practicar de nuevo")] });
      reset.addEventListener("click", () => {
        turnIndex = 0;
        conversation.replaceChildren();
        appendLine(lab.opening);
        drawTurn();
      });
      activity.append(
        element("div", { className: "conversation-complete", children: [element("strong", { text: "Ahora hazla tuya" }), element("p", { text: "Cambia los datos del modelo y léelo en voz alta sin ocultar el romaji hasta sentirte seguro/a." }), personalDraft, reset] }),
      );
      return;
    }

    const turn = lab.turns[turnIndex];
    progress.textContent = `Turno ${turnIndex + 1} de ${lab.turns.length}`;
    const feedback = element("div", { className: "conversation-feedback", attributes: { role: "status", "aria-live": "polite" } });
    const nextLabel = document.createTextNode("Selecciona una respuesta");
    const next = element("button", { className: "primary-action", attributes: { type: "button", disabled: "", "aria-describedby": "conversation-feedback" }, children: [nextLabel, icon("arrow-right")] });
    const choices = turn.choices.map((choice) => {
      const button = element("button", { className: "conversation-choice", attributes: { type: "button" }, children: [element("strong", { attributes: { lang: "ja" }, text: choice.japanese }), element("span", { className: "romaji", text: choice.romaji }), element("span", { text: choice.spanish })] });
      button.addEventListener("click", () => {
        choices.forEach((candidate) => candidate.classList.remove("is-correct", "is-incorrect"));
        button.classList.add(choice.correct ? "is-correct" : "is-incorrect");
        feedback.className = `conversation-feedback ${choice.correct ? "is-correct" : "is-incorrect"}`;
        feedback.replaceChildren(element("strong", { text: choice.correct ? "Respuesta adecuada" : "Prueba otra opción" }), element("p", { text: choice.feedback }));
        next.disabled = !choice.correct;
        nextLabel.textContent = choice.correct ? "Continuar" : "Elige otra opción";
        if (choice.correct) next.dataset.choiceIndex = String(turn.choices.indexOf(choice));
      });
      return button;
    });
    next.addEventListener("click", () => {
      const selected = turn.choices[Number(next.dataset.choiceIndex)];
      appendLine({ speaker: turn.speaker, ...selected });
      turnIndex += 1;
      drawTurn();
    });
    feedback.id = "conversation-feedback";
    activity.append(element("h4", { text: turn.instruction }), element("div", { className: "conversation-choices", children: choices }), feedback, next);
  };

  appendLine(lab.opening);
  drawTurn();
  return element("section", { className: "section-band conversation-lab", children: [
    element("p", { className: "lesson-meta", text: "Práctica interactiva" }),
    element("h3", { text: lab.title }),
    element("p", { text: lab.goal }),
    element("p", { className: "status-line", children: [element("strong", { text: "Situación: " }), document.createTextNode(lab.situation)] }),
    progress,
    conversation,
    activity,
  ] });
}

function renderConversationLabs(labs) {
  if (!labs?.length) return document.createDocumentFragment();
  const panel = element("div");
  const tabs = element("div", { className: "conversation-tabs", attributes: { role: "tablist", "aria-label": "Elegir conversación oral" } });
  const draw = (activeId) => {
    tabs.querySelectorAll("button").forEach((button) => {
      const active = button.dataset.labId === activeId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    panel.replaceChildren(renderConversationLab(labs.find((lab) => lab.id === activeId) ?? labs[0]));
  };
  for (const lab of labs) {
    const button = element("button", { attributes: { type: "button", role: "tab", "aria-selected": "false" }, text: lab.title });
    button.dataset.labId = lab.id;
    button.addEventListener("click", () => draw(lab.id));
    tabs.append(button);
  }
  const view = element("div", { className: "conversation-workshop", children: [element("section", { className: "section-band conversation-intro", children: [element("p", { className: "lesson-meta", text: "Conversaciones guiadas" }), element("h3", { text: "Elige qué quieres practicar" }), element("p", { text: "Construye la conversación turno por turno. Cada opción incluye japonés, romaji, español y una explicación de la gramática que estás usando." }), tabs] }), panel] });
  draw(labs[0].id);
  return view;
}

function renderExam(state) {
  const view = element("div");
  view.append(header("Práctica oral", "Construye conversaciones, revisa modelos por partes y ensaya en voz alta sin depender de oraciones memorizadas."));
  view.append(renderConversationLabs(state.oralPresentation.conversationLabs));
  view.append(renderOralModel(state.oralPresentation));
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
    const rehearsalStatus = element("p", { className: "rehearsal-status", attributes: { role: "status", "aria-live": "polite" } });
    const updateRehearsalStatus = () => {
      const completed = rehearsal.querySelectorAll('input[type="checkbox"]:checked').length;
      rehearsalStatus.textContent = completed === examQuestions.length
        ? "¡Plan completo! Ya puedes ensayar la conversación usando estas cinco respuestas como apoyo."
        : `${completed} de ${examQuestions.length} decisiones preparadas. Escribe cada respuesta y márcala cuando puedas decirla en voz alta.`;
    };
    for (const question of examQuestions) {
      const checkbox = element("input", { attributes: { type: "checkbox", id: `rehearse-${question.id}` } });
      const answer = element("input", { className: "form-control rehearsal-answer", attributes: { type: "text", lang: "ja", placeholder: "Escribe una respuesta breve en japonés", "aria-label": `Respuesta para ${question.prompt}` } });
      const item = element("article", { className: "rehearsal-item", children: [
        element("div", { className: "rehearsal-question", children: [
          checkbox,
          element("label", { attributes: { for: `rehearse-${question.id}` }, children: [element("strong", { text: question.prompt, attributes: { lang: "ja" } }), element("small", { className: "romaji", text: question.romaji }), element("small", { text: question.explanation })] }),
        ] }),
        answer,
      ] });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked && !answer.value.trim()) {
          checkbox.checked = false;
          rehearsalStatus.textContent = "Primero escribe tu respuesta en japonés; después marca la decisión como preparada.";
          answer.focus();
          return;
        }
        item.classList.toggle("is-complete", checkbox.checked);
        updateRehearsalStatus();
      });
      answer.addEventListener("input", () => {
        if (!answer.value.trim() && checkbox.checked) {
          checkbox.checked = false;
          item.classList.remove("is-complete");
          updateRehearsalStatus();
        }
      });
      rehearsal.append(item);
    }
    updateRehearsalStatus();
    view.append(element("section", { className: "section-band", children: [
      element("h3", { text: exam.task }),
      element("p", { text: `Formato: ${exam.format}.${exam.maxPoints ? ` Total: ${exam.maxPoints} puntos.` : ""}` }),
      criteria.childElementCount ? criteria : document.createDocumentFragment(),
      requirements.childElementCount ? element("div", { className: "exam-subsection", children: [element("h4", { text: "Expresiones que debes practicar" }), requirements] }) : document.createDocumentFragment(),
      rehearsal.childElementCount ? element("div", { className: "exam-subsection", children: [element("h4", { text: "Cinco decisiones para el ensayo" }), element("p", { text: "Responde cada pregunta en japonés. Cuando puedas decir la respuesta en voz alta sin leer una oración completa, marca la casilla." }), rehearsal, rehearsalStatus] }) : document.createDocumentFragment(),
      element("p", { className: "status-line", text: exam.id === "EXAM-N2-ORAL-INVITATION" ? "Practica una conversación natural. Usa el memo como apoyo, no como un guion completo." : "Explica las ideas principales con tus propias palabras. La memorización literal no es el objetivo." }),
    ] }));
  }
  return view;
}

function renderWriting(state) {
  const canvas = element("canvas", { attributes: { id: "writing-canvas", "aria-label": "Área de práctica de escritura" } });
  const clearButton = element("button", { className: "secondary-action", attributes: { type: "button" }, children: [icon("trash-2"), document.createTextNode("Limpiar")] });
  const undoButton = element("button", { className: "secondary-action", attributes: { type: "button" }, children: [icon("undo-2"), document.createTextNode("Deshacer trazo")] });
  const typeSelector = element("select", { className: "form-select", attributes: { "aria-label": "Elegir tipo de escritura" }, children: [
    element("option", { attributes: { value: "hiragana" }, text: "Hiragana" }),
    element("option", { attributes: { value: "katakana" }, text: "Katakana" }),
    element("option", { attributes: { value: "kanji" }, text: "Kanji" }),
  ] });
  const characterSelector = element("select", { className: "form-select", attributes: { "aria-label": "Elegir carácter para practicar" } });
  const referenceCharacter = element("span", { attributes: { lang: "ja" } });
  const referenceRomaji = element("small", { className: "romaji" });
  const referenceDetail = element("small", { className: "writing-detail" });
  const strokeGuide = element("div", { className: "stroke-guide", attributes: { "aria-live": "polite" } });
  const itemsForType = (type) => type === "kanji" ? state.publishedKanji : state.publishedKana.filter((item) => item.script === type);
  const updateReference = () => {
    const item = itemsForType(typeSelector.value).find((entry) => entry.id === characterSelector.value);
    if (!item) return;
    referenceCharacter.textContent = item.character;
    referenceRomaji.textContent = Array.isArray(item.romaji) ? item.romaji.join(" / ") : item.romaji;
    referenceDetail.textContent = typeSelector.value === "kanji" ? item.meaning : `Grupo: ${item.group}`;
    strokeGuide.replaceChildren(...[...item.character].map((character) => {
      const fileName = `${character.codePointAt(0).toString(16).padStart(5, "0")}.svg`;
      return element("figure", { children: [
        element("img", { attributes: { src: `./assets/stroke-order/${fileName}`, alt: `Orden de trazos de ${character}`, loading: "eager" } }),
        element("figcaption", { attributes: { lang: "ja" }, text: character }),
      ] });
    }));
  };
  const updateCharacterOptions = () => {
    const items = itemsForType(typeSelector.value);
    characterSelector.replaceChildren(...items.map((item) => element("option", { attributes: { value: item.id }, text: typeSelector.value === "kanji" ? `${item.character} · ${item.meaning}` : `${item.character} · ${item.romaji}` })));
    updateReference();
  };
  typeSelector.addEventListener("change", updateCharacterOptions);
  characterSelector.addEventListener("change", updateReference);
  updateCharacterOptions();
  const view = element("div", { children: [
    header("Práctica de escritura", "Elige hiragana, katakana o kanji. Sigue los números del orden de trazos y después reproduce el carácter en el lienzo."),
    element("div", { className: "writing-layout", children: [
      element("div", { className: "writing-guide-panel", children: [
        element("div", { className: "writing-selectors", children: [typeSelector, characterSelector] }),
        element("div", { className: "writing-reference", attributes: { "aria-label": "Carácter de referencia" }, children: [referenceCharacter, referenceRomaji, referenceDetail] }),
        element("section", { className: "stroke-order-panel", children: [element("h3", { text: "Orden de trazos" }), element("p", { text: "Empieza por el número 1 y sigue las flechas. En caracteres combinados, practica cada cuadro de izquierda a derecha." }), strokeGuide] }),
      ] }),
      element("section", { className: "section-band writing-canvas-panel", children: [element("h3", { text: "Tu práctica" }), canvas, element("div", { className: "canvas-tools action-row", children: [undoButton, clearButton] })] }),
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
    header("Progreso", "Observa cuánto has practicado y usa los resultados para elegir tu próxima actividad."),
    element("div", { className: "metric-strip", children: [metric(summary.practiced, "Practicados"), metric(summary.attempts, "Intentos"), metric(summary.mastered, "Dominados")] }),
    element("section", { className: "section-band", children: [element("h3", { text: "Actividad · 7 días" }), element("div", { className: "heatmap-row", children: activity.map((day) => element("div", { className: "heatmap-day", attributes: { title: `${day.date}: ${day.count}`, "aria-label": `${day.date}: ${day.count} repasos` }, style: `height: ${Math.max(8, day.count * 16)}px` })) })] }),
    element("section", { className: "section-band", children: [element("h3", { text: "Cómo interpretar los datos" }), element("p", { className: "status-line", text: "Practicados cuenta tarjetas distintas; Intentos cuenta todas tus respuestas; Dominados muestra lo que recuerdas con mayor constancia." })] }),
  ] });
}

async function bootstrap() {
  const [manifest, policy, progressModel, lessons, grammar, grammarStudy, exams, questions, kana, kanji, vocabulary, media, transcripts, oralPresentation] = await Promise.all([
    loadJson("./data/manifest.json"), loadJson("./data/app-policy.json"), loadJson("./data/progress-model.json"),
    loadJson("./data/lessons.json"), loadJson("./data/grammar.json"), loadJson("./data/grammar-study.json"), loadJson("./data/exam-blueprints.json"),
    loadJson("./data/questions.json"), loadJson("./data/kana.json"), loadJson("./data/kanji.json"),
    loadJson("./data/vocabulary.json"), loadJson("./data/media.json"), loadJson("./data/audio-transcripts.json"), loadJson("./data/oral-presentation.json"),
  ]);
  const settings = loadSettings();
  document.documentElement.dataset.theme = settings.theme;
  const state = {
    manifest, policy, progressModel, grammarStudy,
    progress: loadProgress(progressModel.initialState),
    publishedLessons: onlyPublished(lessons.lessons, policy),
    publishedGrammar: onlyPublished(grammar.grammar, policy),
    publishedExams: onlyPublished(exams.examBlueprints, policy),
    publishedQuestions: onlyPublished(questions.questions, policy),
    publishedKana: onlyPublished(kana.kana, policy),
    publishedKanji: onlyPublished(kanji.kanji, policy),
    publishedVocabulary: onlyPublished(vocabulary.vocabulary, policy),
    media: media.media,
    transcripts: transcripts.transcripts,
    listeningGuides: transcripts.lessonGuides ?? [],
    oralPresentation: oralPresentation.presentation,
    reviewCount: [...lessons.lessons, ...grammar.grammar, ...exams.examBlueprints].filter((item) => item.validationStatus !== "verified").length,
  };
  state.srsDefaults = progressModel.itemState.srsDefaults;
  state.studyItems = createStudyItems(state.publishedGrammar, state.publishedKana, state.publishedKanji, state.publishedVocabulary);

  document.querySelector("#theme-toggle").addEventListener("click", () => {
    settings.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = settings.theme;
    saveSettings(settings);
  });

  const menu = document.querySelector("#more-menu");
  document.querySelector("#menu-toggle").addEventListener("click", () => menu.showModal());
  document.querySelector("#menu-close").addEventListener("click", () => menu.close());
  menu.addEventListener("click", (event) => {
    if (event.target === menu) menu.close();
  });
  menu.querySelectorAll("a[href^='#/']").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    menu.close();
    location.hash = link.getAttribute("href");
  }));

  let currentRoute = "home";
  const renderCurrent = (route = currentRoute) => {
    currentRoute = route;
    canvasController?.destroy();
    canvasController = null;
    const renderers = {
      home: renderHome, study: renderStudy,
      review: (value) => renderStudySession(value, "Repaso de hoy", "Primero lo vencido; después, contenido nuevo dentro de tu meta diaria."),
      flashcards: (value) => renderStudySession(value, "Flashcards", "Revela la respuesta antes de calificar tu recuerdo de 0 a 5."),
      kana: renderKana, kanji: renderKanji, vocabulary: renderVocabulary, grammar: renderGrammar, listening: renderListening,
      quiz: renderQuiz, exam: renderExam, writing: renderWriting, errors: renderErrors,
      progress: renderProgress, settings: renderSettings,
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