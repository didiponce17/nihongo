/* ===== KANJI MASTER — App Principal ===== */

// ===== ESTADO GLOBAL =====
let kanjiData = [];
let studiedKanji = new Set();
let currentSection = 'dashboard';

// Flashcard state
let fcDeck = [];
let fcIndex = 0;
let fcCorrect = 0;
let fcWrong = 0;
let fcWrongList = [];

// Quiz state
let quizDeck = [];
let quizIndex = 0;
let quizScore = 0;
let quizTotal = 0;
let quizType = 'kanji-significado';
let quizWrongList = [];

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadKanjiData();
    loadStudiedState();
    setupNavigation();
    setupLibrary();
    setupFlashcards();
    setupQuiz();
    setupStrokes();
    renderDashboard();
    showTip();
});

// ===== CARGAR DATOS =====
async function loadKanjiData() {
    try {
        const response = await fetch('data/kanji.json');
        kanjiData = await response.json();
    } catch (e) {
        console.error('Error cargando kanji.json:', e);
        kanjiData = [];
    }
}

// ===== PERSISTENCIA LOCAL =====
function loadStudiedState() {
    try {
        const saved = localStorage.getItem('kanjimaster_studied');
        if (saved) studiedKanji = new Set(JSON.parse(saved));
    } catch (e) { /* ignorar */ }
}

function saveStudiedState() {
    try {
        localStorage.setItem('kanjimaster_studied', JSON.stringify([...studiedKanji]));
    } catch (e) { /* ignorar */ }
}

function markAsStudied(id) {
    studiedKanji.add(id);
    saveStudiedState();
}

// ===== NAVEGACIÓN =====
function setupNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            switchSection(section);
        });
    });
}

function switchSection(section) {
    // Desactivar todo
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // Activar seleccionado
    const screen = document.getElementById(`screen-${section}`);
    const btn = document.querySelector(`[data-section="${section}"]`);
    if (screen) screen.classList.add('active');
    if (btn) btn.classList.add('active');

    currentSection = section;

    // Refresh específico
    if (section === 'dashboard') renderDashboard();
    if (section === 'library') renderLibrary();
    if (section === 'strokes') renderStrokesGrid();

    // Scroll arriba
    window.scrollTo(0, 0);
}

// ===== DASHBOARD =====
function renderDashboard() {
    const total = kanjiData.length;
    const studied = studiedKanji.size;
    const quizKanji = kanjiData.filter(k => k.entra_quiz_actual);
    const n1 = kanjiData.filter(k => k.nivel === 1).length;
    const n2 = kanjiData.filter(k => k.nivel === 2).length;

    // Totales
    document.getElementById('totalKanji').textContent = total;
    document.getElementById('countN1').textContent = n1;
    document.getElementById('countN2').textContent = n2;
    document.getElementById('quizCount').textContent = quizKanji.length;

    // Progreso
    const pct = total > 0 ? Math.round((studied / total) * 100) : 0;
    document.getElementById('progressText').textContent = `${pct}%`;
    document.getElementById('progressDetail').textContent = `${studied} / ${total} kanji estudiados`;

    // Animar anillo
    const ring = document.getElementById('progressRing');
    const circumference = 2 * Math.PI * 52; // r=52
    const offset = circumference - (pct / 100) * circumference;
    ring.style.strokeDasharray = circumference;
    setTimeout(() => {
        ring.style.strokeDashoffset = offset;
    }, 100);
}

function showTip() {
    const tips = [
        'Estudia en bloques de 5-7 kanji. ¡Tu cerebro lo agradecerá! 🧠',
        'Practica pares opuestos juntos: 上/下, 大/小, 東/西. Se memorizan mejor.',
        'Di la lectura en voz alta mientras escribes el kanji. Multi-sensorial = mejor memoria.',
        'Usa las flashcards 3 veces al día en sesiones de 5 minutos.',
        'Los kanji de Nivel 2 (36-49) son los más recientes. ¡Repásalos hoy!',
        'Asocia cada kanji con una imagen mental. Los mnemónicos están en cada ficha.',
        '¿Sabías? 東京 (Tokio) significa "Capital del Este". 東=Este + 京=Capital.',
        'Truco: 食 (comer) y 飲 (beber) comparten el radical de comida. Aprende uno, recuerda ambos.',
        'Los días de la semana usan elementos: 月(luna)→Lunes, 火(fuego)→Martes...',
        'Consejo TDA: Pon el celular en modo avión mientras estudias. Solo 5 minutos.'
    ];
    const tip = tips[Math.floor(Math.random() * tips.length)];
    document.getElementById('tipText').textContent = tip;
}

function startQuizFromDash() {
    switchSection('quiz');
}

// ===== BIBLIOTECA =====
let libraryFilter = 'all';
let searchQuery = '';
let libraryView = 'detail';

function setupLibrary() {
    // Filtros
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            libraryFilter = chip.dataset.filter;
            renderLibrary();
        });
    });

    // Búsqueda
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderLibrary();
    });

    // Vista toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            libraryView = btn.dataset.view;
            renderLibrary();
        });
    });

    // Modal
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('kanjiModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
}

function getFilteredKanji() {
    let filtered = [...kanjiData];

    // Filtrar
    if (libraryFilter === 'quiz') filtered = filtered.filter(k => k.entra_quiz_actual);
    else if (libraryFilter.startsWith('lesson-')) {
        const lessonNum = parseInt(libraryFilter.split('-')[1]);
        filtered = filtered.filter(k => k.lesson === lessonNum);
    }

    // Búsqueda
    if (searchQuery) {
        filtered = filtered.filter(k =>
            k.kanji.includes(searchQuery) ||
            k.significado_es.toLowerCase().includes(searchQuery) ||
            k.romaji.some(r => r.toLowerCase().includes(searchQuery)) ||
            (k.hiragana || []).some(h => h.includes(searchQuery)) ||
            (k.onyomi || []).some(o => o.includes(searchQuery)) ||
            (k.kunyomi || []).some(ku => ku.includes(searchQuery))
        );
    }

    return filtered;
}

function renderLibrary() {
    const filtered = getFilteredKanji();
    const container = document.getElementById('libraryContent');

    // Update subtitle
    const quizCount = filtered.filter(k => k.entra_quiz_actual).length;
    document.getElementById('librarySubtitle').textContent = `${filtered.length} kanji${quizCount > 0 ? ` (${quizCount} del quiz)` : ''}`;

    if (libraryView === 'grid') {
        container.innerHTML = `<div class="kanji-grid">${filtered.map(k => {
            if (k.placeholder) return `
            <div class="kanji-card placeholder-card">
                <div class="kanji-card__char">？</div>
                <div class="kanji-card__meaning">(Sin asignar)</div>
                <div class="kanji-card__id">#${k.id}</div>
            </div>`;
            return `
            <div class="kanji-card ${k.entra_quiz_actual ? 'quiz-priority' : ''} ${studiedKanji.has(k.id) ? 'studied' : ''}"
                 onclick="openKanjiModal(${k.id})" role="button" tabindex="0">
                <div class="kanji-card__char">${k.kanji}</div>
                <div class="kanji-card__meaning">${k.significado_es}</div>
                <div class="kanji-card__id">#${k.id}</div>
            </div>`;
        }).join('')}</div>`;
        return;
    }

    // Detail view: group by lesson
    const lessons = {};
    filtered.forEach(k => {
        const key = k.lesson || 0;
        if (!lessons[key]) lessons[key] = { title: k.lesson_title || 'Extra', kanji: [] };
        lessons[key].kanji.push(k);
    });

    let html = '';
    for (const [lessonNum, lesson] of Object.entries(lessons).sort((a, b) => {
        // Put lesson 0 (Extra) at the end
        if (a[0] == 0) return 1;
        if (b[0] == 0) return -1;
        return a[0] - b[0];
    })) {
        const lessonLabel = lessonNum == 0 ? 'Extra' : `Lesson ${lessonNum}`;
        html += `<div class="lesson-group">
            <div class="lesson-header">
                <span class="lesson-badge">${lessonLabel}</span>
                <span class="lesson-title-text">${lesson.title}</span>
            </div>`;

        lesson.kanji.forEach(k => {
            if (k.placeholder) {
                html += `
                <div class="kanji-detail-card placeholder-card">
                    <div class="kd-left">
                        <span class="kd-number">#${k.id}</span>
                        <div class="kd-kanji">？</div>
                    </div>
                    <div class="kd-right">
                        <div class="kd-meaning" style="opacity:0.4">(Sin asignar en el material)</div>
                    </div>
                </div>`;
                return;
            }
            const isStudied = studiedKanji.has(k.id);
            const onR = (k.onyomi || []).map((o, i) => {
                const r = (k.onyomi_romaji || [])[i];
                return r ? `<span class="on-reading">${o} <span class="romaji-hint">[${r}]</span></span>` : `<span class="on-reading">${o}</span>`;
            }).join('、');
            const kunR = (k.kunyomi || []).map((ku, i) => {
                const r = (k.kunyomi_romaji || [])[i];
                return r ? `<span class="kun-reading">${ku} <span class="romaji-hint">[${r}]</span></span>` : `<span class="kun-reading">${ku}</span>`;
            }).join('、');

            const words = (k.palabras || k.ejemplos || []).map(w => {
                const rPart = w.romaji ? ` <span class="romaji-hint">[${w.romaji}]</span>` : '';
                return `<span class="word-chip">${w.palabra}<span class="word-reading">(${w.lectura})</span>${rPart} = ${w.significado}</span>`;
            }).join(' ');

            html += `
            <div class="kanji-detail-card ${k.entra_quiz_actual ? 'quiz-priority' : ''} ${isStudied ? 'studied' : ''}"
                 onclick="openKanjiModal(${k.id})" role="button" tabindex="0">
                <div class="kd-left">
                    <span class="kd-number">#${k.id}</span>
                    <div class="kd-kanji">${k.kanji}</div>
                    <span class="kd-strokes">${k.trazos || '?'} trazos</span>
                </div>
                <div class="kd-right">
                    <div class="kd-meaning">${k.significado_es}</div>
                    <div class="kd-readings">
                        ${onR ? `<div class="kd-reading-row on-reading"><span class="kd-reading-label">ON:</span> ${onR}</div>` : ''}
                        ${kunR ? `<div class="kd-reading-row kun-reading"><span class="kd-reading-label">KUN:</span> ${kunR}</div>` : ''}
                    </div>
                    <div class="kd-words">${words}</div>
                    ${k.ejemplo_frase ? `
                    <div class="kd-sentence">
                        <span class="kd-sentence-jp">${k.ejemplo_frase}</span>
                        <span class="kd-sentence-romaji">${k.ejemplo_romaji || ''}</span>
                        <span class="kd-sentence-es">${k.ejemplo_traduccion || ''}</span>
                    </div>` : ''}
                </div>
            </div>`;
        });

        html += `</div>`;
    }

    container.innerHTML = html;
}

function openKanjiModal(id) {
    const k = kanjiData.find(x => x.id === id);
    if (!k) return;

    // Marcar como estudiado
    markAsStudied(id);

    // Llenar modal
    document.getElementById('modalKanji').textContent = k.kanji;
    document.getElementById('modalMeaning').textContent = k.significado_es;

    // Badges
    const badges = [];
    badges.push(`<span class="modal-badge">Nivel ${k.nivel}</span>`);
    if (k.lesson) badges.push(`<span class="modal-badge">Lesson ${k.lesson}</span>`);
    if (k.trazos) badges.push(`<span class="modal-badge">${k.trazos} trazos</span>`);
    if (k.entra_quiz_actual) badges.push(`<span class="modal-badge quiz">🔥 Quiz</span>`);
    document.getElementById('modalBadges').innerHTML = badges.join('');

    // Lecturas con romaji
    const readings = [];
    if ((k.onyomi || []).length) {
        const onText = k.onyomi.map((o, i) => { const r = (k.onyomi_romaji || [])[i]; return r ? `<span class="on-reading">${o} <span class="romaji-hint">[${r}]</span></span>` : `<span class="on-reading">${o}</span>`; }).join('、');
        readings.push(`<div class="reading-item on-reading"><span class="reading-label label-on">On'yomi <small>(カタカナ)</small></span>${onText}</div>`);
    }
    if ((k.kunyomi || []).length) {
        const kunText = k.kunyomi.map((ku, i) => { const r = (k.kunyomi_romaji || [])[i]; return r ? `<span class="kun-reading">${ku} <span class="romaji-hint">[${r}]</span></span>` : `<span class="kun-reading">${ku}</span>`; }).join('、');
        readings.push(`<div class="reading-item kun-reading"><span class="reading-label label-kun">Kun'yomi <small>(ひらがな)</small></span>${kunText}</div>`);
    }
    document.getElementById('modalReadings').innerHTML = readings.join('');

    // Palabras (ejemplos)
    const words = (k.palabras || k.ejemplos || []).map(w => {
        const rPart = w.romaji ? ` <span class="romaji-hint">[${w.romaji}]</span>` : '';
        return `
        <div class="example-item">
            <div class="example-word">${w.palabra}</div>
            <div class="example-reading">${w.lectura}${rPart}</div>
            <div class="example-meaning">${w.significado}</div>
        </div>`;
    }).join('');
    document.getElementById('modalExamples').innerHTML = words || '<p style="color:var(--text-muted)">Sin palabras disponibles</p>';

    // Oración de ejemplo
    const sentenceSection = document.getElementById('modalSentenceSection');
    if (k.ejemplo_frase) {
        sentenceSection.classList.remove('hidden');
        document.getElementById('modalSentence').innerHTML = `
            <div class="sentence-jp">${k.ejemplo_frase}</div>
            <div class="sentence-romaji">${k.ejemplo_romaji || ''}</div>
            <div class="sentence-es">${k.ejemplo_traduccion || ''}</div>
        `;
    } else {
        sentenceSection.classList.add('hidden');
    }

    // Mnemónico
    document.getElementById('modalMnemo').textContent = k.mnemonico || 'Sin mnemónico disponible.';

    // Trazos
    const strokesSection = document.getElementById('modalStrokesSection');
    if (k.trazos) {
        strokesSection.classList.remove('hidden');
        const hex = k.kanji.codePointAt(0).toString(16);
        document.getElementById('modalStrokes').innerHTML = `${k.trazos} trazos <img src="https://raw.githubusercontent.com/mistval/kanji_images/master/gifs/${hex}.gif" alt="stroke order" class="modal-stroke-gif" onerror="this.style.display='none'">`;
    } else {
        strokesSection.classList.add('hidden');
    }

    // Notas
    const notesSection = document.getElementById('modalNotesSection');
    if (k.notas) {
        notesSection.classList.remove('hidden');
        document.getElementById('modalNotes').textContent = k.notas;
    } else {
        notesSection.classList.add('hidden');
    }

    document.getElementById('kanjiModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('kanjiModal').classList.remove('show');
    document.body.style.overflow = '';
}

// ===== FLASHCARDS =====
function setupFlashcards() {
    document.getElementById('fcStartBtn').addEventListener('click', startFlashcards);
    document.getElementById('fcCard').addEventListener('click', flipCard);
    document.getElementById('fcCorrect').addEventListener('click', () => fcAnswer(true));
    document.getElementById('fcWrong').addEventListener('click', () => fcAnswer(false));
    document.getElementById('fcExit').addEventListener('click', exitFlashcards);
    document.getElementById('fcRetry').addEventListener('click', retryFlashcards);
    document.getElementById('fcNewSession').addEventListener('click', newFlashcardSession);
}

function startFlashcards() {
    const frontType = document.querySelector('input[name="fcFront"]:checked').value;
    const filter = document.querySelector('input[name="fcFilter"]:checked').value;
    const shuffle = document.getElementById('fcShuffle').checked;

    // Filtrar deck
    fcDeck = filterKanji(filter);
    if (fcDeck.length === 0) return alert('No hay kanji para este filtro.');

    if (shuffle) fcDeck = shuffleArray([...fcDeck]);

    fcIndex = 0;
    fcCorrect = 0;
    fcWrong = 0;
    fcWrongList = [];

    // Guardar tipo de frente
    fcDeck._frontType = frontType;

    document.getElementById('fcConfig').classList.add('hidden');
    document.getElementById('fcArena').classList.remove('hidden');
    document.getElementById('fcSummary').classList.add('hidden');

    renderFlashcard();
}

function renderFlashcard() {
    if (fcIndex >= fcDeck.length) {
        showFlashcardSummary();
        return;
    }

    const k = fcDeck[fcIndex];
    const frontType = fcDeck._frontType || 'kanji';

    // Front content
    let frontText = k.kanji;
    if (frontType === 'significado') frontText = k.significado_es;
    if (frontType === 'romaji') frontText = k.romaji[0] || '?';

    // Back content — structured with labels
    let backRows = [];
    if (frontType !== 'kanji') {
        backRows.push(`<div class="fc-back-row"><span class="fc-back-label">Kanji</span><span class="fc-back-value kanji-big">${k.kanji}</span></div>`);
    }
    if (frontType !== 'significado') {
        backRows.push(`<div class="fc-back-row"><span class="fc-back-label">Significado</span><span class="fc-back-value">${k.significado_es}</span></div>`);
    }
    if ((k.onyomi || []).length) {
        const onDisp = k.onyomi.map((o, i) => { const r = (k.onyomi_romaji || [])[i]; return r ? `${o} <span class="romaji-hint">[${r}]</span>` : o; }).join('・');
        backRows.push(`<div class="fc-back-row"><span class="fc-back-label label-on">On (カタカナ)</span><span class="fc-back-value on-reading">${onDisp}</span></div>`);
    }
    if ((k.kunyomi || []).length) {
        const kunDisp = k.kunyomi.map((ku, i) => { const r = (k.kunyomi_romaji || [])[i]; return r ? `${ku} <span class="romaji-hint">[${r}]</span>` : ku; }).join('・');
        backRows.push(`<div class="fc-back-row"><span class="fc-back-label label-kun">Kun (ひらがな)</span><span class="fc-back-value kun-reading">${kunDisp}</span></div>`);
    }
    if (frontType !== 'romaji' && k.romaji.length) {
        backRows.push(`<div class="fc-back-row"><span class="fc-back-label">Romaji</span><span class="fc-back-value">${k.romaji.join('・')}</span></div>`);
    }

    document.querySelector('#fcFront .fc-card__text').textContent = frontText;
    document.getElementById('fcBackContent').innerHTML = backRows.join('');

    // Reset flip
    document.getElementById('fcCard').classList.remove('flipped');

    // Progress
    document.getElementById('fcCounter').textContent = `${fcIndex + 1} / ${fcDeck.length}`;
    const pct = ((fcIndex + 1) / fcDeck.length) * 100;
    document.getElementById('fcProgressFill').style.width = `${pct}%`;

    // Font size adjustment
    const frontEl = document.querySelector('#fcFront .fc-card__text');
    frontEl.style.fontSize = frontType === 'kanji' ? '4rem' : '1.4rem';
}

function flipCard() {
    document.getElementById('fcCard').classList.toggle('flipped');
}

function fcAnswer(correct) {
    const k = fcDeck[fcIndex];
    if (correct) {
        fcCorrect++;
        markAsStudied(k.id);
    } else {
        fcWrong++;
        fcWrongList.push(k);
    }
    fcIndex++;
    renderFlashcard();
}

function showFlashcardSummary() {
    document.getElementById('fcArena').classList.add('hidden');
    document.getElementById('fcSummary').classList.remove('hidden');
    document.getElementById('fcStatCorrect').textContent = fcCorrect;
    document.getElementById('fcStatWrong').textContent = fcWrong;

    // Actualizar dashboard al salir
    renderDashboard();
}

function retryFlashcards() {
    if (fcWrongList.length === 0) return newFlashcardSession();
    fcDeck = shuffleArray([...fcWrongList]);
    fcDeck._frontType = fcDeck._frontType || 'kanji';
    fcIndex = 0;
    fcCorrect = 0;
    fcWrong = 0;
    fcWrongList = [];

    document.getElementById('fcSummary').classList.add('hidden');
    document.getElementById('fcArena').classList.remove('hidden');
    renderFlashcard();
}

function newFlashcardSession() {
    document.getElementById('fcSummary').classList.add('hidden');
    document.getElementById('fcArena').classList.add('hidden');
    document.getElementById('fcConfig').classList.remove('hidden');
}

function exitFlashcards() {
    document.getElementById('fcArena').classList.add('hidden');
    document.getElementById('fcConfig').classList.remove('hidden');
    renderDashboard();
}

// ===== QUIZ =====
function setupQuiz() {
    // Tipo de quiz
    document.querySelectorAll('.quiz-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.quiz-type-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            quizType = btn.dataset.type;
        });
    });

    // Seleccionar primero por defecto
    document.querySelector('.quiz-type-btn').classList.add('selected');

    // Iniciar quiz al seleccionar tipo
    document.querySelectorAll('.quiz-type-btn').forEach(btn => {
        btn.addEventListener('dblclick', startQuiz);
    });

    // Agregar botón de iniciar quiz
    const startBtn = document.createElement('button');
    startBtn.className = 'btn btn--accent btn--lg';
    startBtn.textContent = 'Comenzar Quiz ▶';
    startBtn.id = 'quizStartBtn';
    startBtn.addEventListener('click', startQuiz);
    document.getElementById('quizConfig').appendChild(startBtn);

    document.getElementById('quizNext').addEventListener('click', nextQuizQuestion);
    document.getElementById('quizExit').addEventListener('click', exitQuiz);
    document.getElementById('quizRetry').addEventListener('click', retryQuiz);
    document.getElementById('quizNewQuiz').addEventListener('click', newQuiz);
}

function startQuiz() {
    const filter = document.querySelector('input[name="quizFilter"]:checked').value;
    const countSetting = document.querySelector('input[name="quizCount"]:checked').value;

    let pool = filterKanji(filter);
    if (pool.length < 4) return alert('Se necesitan al menos 4 kanji para el quiz.');

    pool = shuffleArray([...pool]);

    let count = countSetting === 'all' ? pool.length : parseInt(countSetting);
    count = Math.min(count, pool.length);

    quizDeck = pool.slice(0, count);
    quizIndex = 0;
    quizScore = 0;
    quizTotal = count;
    quizWrongList = [];

    document.getElementById('quizConfig').classList.add('hidden');
    document.getElementById('quizArena').classList.remove('hidden');
    document.getElementById('quizResults').classList.add('hidden');

    renderQuizQuestion();
}

function renderQuizQuestion() {
    if (quizIndex >= quizDeck.length) {
        showQuizResults();
        return;
    }

    const k = quizDeck[quizIndex];
    const feedback = document.getElementById('quizFeedback');
    feedback.classList.add('hidden');
    feedback.classList.remove('correct', 'wrong');

    // Progress
    document.getElementById('quizCounter').textContent = `${quizIndex + 1} / ${quizTotal}`;
    const pct = ((quizIndex + 1) / quizTotal) * 100;
    document.getElementById('quizProgressFill').style.width = `${pct}%`;

    // Generar pregunta y opciones según tipo
    let prompt, instruction, correctAnswer, options;
    const allPool = kanjiData.length >= 4 ? kanjiData : [...kanjiData, ...kanjiData];

    switch (quizType) {
        case 'kanji-significado':
            prompt = k.kanji;
            instruction = '¿Cuál es el significado?';
            correctAnswer = k.significado_es;
            options = generateOptions(k, allPool, x => x.significado_es);
            break;
        case 'significado-kanji':
            prompt = k.significado_es;
            instruction = '¿Cuál es el kanji?';
            correctAnswer = k.kanji;
            options = generateOptions(k, allPool, x => x.kanji);
            break;
        case 'kanji-romaji':
            prompt = k.kanji;
            instruction = '¿Cuál es la lectura en romaji?';
            correctAnswer = k.romaji[0] || '?';
            options = generateOptions(k, allPool, x => x.romaji[0] || '?');
            break;
        case 'kanji-hiragana':
            prompt = k.kanji;
            instruction = '¿Cuál es la lectura en hiragana?';
            correctAnswer = k.hiragana[0] || '?';
            options = generateOptions(k, allPool, x => x.hiragana[0] || '?');
            break;
        default:
            prompt = k.kanji;
            instruction = '¿Cuál es el significado?';
            correctAnswer = k.significado_es;
            options = generateOptions(k, allPool, x => x.significado_es);
    }

    // Ajustar tamaño del prompt
    const promptEl = document.getElementById('quizPrompt');
    promptEl.textContent = prompt;
    promptEl.style.fontSize = prompt.length > 3 ? '2rem' : '4.5rem';

    document.getElementById('quizInstruction').textContent = instruction;

    // Renderizar opciones
    const optionsContainer = document.getElementById('quizOptions');
    optionsContainer.innerHTML = options.map((opt, i) => `
        <button class="quiz-option" data-correct="${opt === correctAnswer}" onclick="selectQuizOption(this, '${escapeAttr(correctAnswer)}')">
            ${opt}
        </button>
    `).join('');
}

function generateOptions(current, pool, extractor) {
    const correct = extractor(current);
    const others = pool
        .filter(x => x.id !== current.id && extractor(x) !== correct)
        .map(x => extractor(x));

    // Obtener 3 opciones incorrectas únicas
    const uniqueOthers = [...new Set(others)];
    const shuffled = shuffleArray(uniqueOthers);
    const wrongOptions = shuffled.slice(0, 3);

    // Combinar y mezclar
    const allOptions = shuffleArray([correct, ...wrongOptions]);
    return allOptions;
}

function selectQuizOption(btn, correctAnswer) {
    // Deshabilitar todas las opciones
    document.querySelectorAll('.quiz-option').forEach(opt => {
        opt.classList.add('disabled');
        if (opt.dataset.correct === 'true') {
            opt.classList.add('correct');
        }
    });

    const k = quizDeck[quizIndex];
    const isCorrect = btn.dataset.correct === 'true';

    if (isCorrect) {
        btn.classList.add('correct');
        quizScore++;
        markAsStudied(k.id);
        showQuizFeedback(true, k);
    } else {
        btn.classList.add('wrong');
        quizWrongList.push(k);
        showQuizFeedback(false, k);
    }
}

function showQuizFeedback(correct, k) {
    const feedback = document.getElementById('quizFeedback');
    feedback.classList.remove('hidden', 'correct', 'wrong');
    feedback.classList.add(correct ? 'correct' : 'wrong');

    let text = correct ? '✅ ¡Correcto!' : '❌ Incorrecto';
    text += ` — ${k.kanji} = ${k.significado_es} (${k.romaji[0]})`;
    document.getElementById('quizFeedbackText').textContent = text;
}

function nextQuizQuestion() {
    quizIndex++;
    renderQuizQuestion();
}

function showQuizResults() {
    document.getElementById('quizArena').classList.add('hidden');
    document.getElementById('quizResults').classList.remove('hidden');

    const pct = Math.round((quizScore / quizTotal) * 100);

    // Ícono y título basados en resultado
    let icon = '🎉';
    let title = '¡Excelente!';
    if (pct < 50) { icon = '📚'; title = '¡Sigue practicando!'; }
    else if (pct < 80) { icon = '👍'; title = '¡Buen trabajo!'; }

    document.getElementById('quizResultIcon').textContent = icon;
    document.getElementById('quizResultTitle').textContent = title;
    document.getElementById('quizScoreText').textContent = `${pct}%`;
    document.getElementById('quizScoreDetail').textContent = `${quizScore} / ${quizTotal} correctas`;

    // Anillo de score
    const ring = document.getElementById('quizScoreRing');
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (pct / 100) * circumference;
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = circumference;

    // Color del anillo según resultado
    if (pct >= 80) ring.style.stroke = 'var(--success)';
    else if (pct >= 50) ring.style.stroke = 'var(--warning)';
    else ring.style.stroke = 'var(--error)';

    setTimeout(() => {
        ring.style.strokeDashoffset = offset;
    }, 100);

    // Lista de errores
    const wrongList = document.getElementById('quizWrongList');
    if (quizWrongList.length > 0) {
        wrongList.innerHTML = '<h4 style="margin-bottom:8px;font-size:0.85rem;">Kanji a repasar:</h4>' +
            quizWrongList.map(k => `
                <div class="quiz-wrong-item">
                    <span class="kanji-text">${k.kanji}</span>
                    <span>${k.significado_es} (${k.romaji[0]})</span>
                </div>
            `).join('');
    } else {
        wrongList.innerHTML = '<p style="color:var(--success);margin:12px 0;">¡Sin errores! 🌟</p>';
    }

    renderDashboard();
}

function retryQuiz() {
    if (quizWrongList.length < 4) {
        // Agregar más kanji del pool para llegar a 4
        const extra = kanjiData.filter(k =>
            k.entra_quiz_actual && !quizWrongList.find(w => w.id === k.id)
        );
        while (quizWrongList.length < 4 && extra.length > 0) {
            quizWrongList.push(extra.shift());
        }
    }
    quizDeck = shuffleArray([...quizWrongList]);
    quizIndex = 0;
    quizScore = 0;
    quizTotal = quizDeck.length;
    quizWrongList = [];

    document.getElementById('quizResults').classList.add('hidden');
    document.getElementById('quizArena').classList.remove('hidden');
    renderQuizQuestion();
}

function newQuiz() {
    document.getElementById('quizResults').classList.add('hidden');
    document.getElementById('quizArena').classList.add('hidden');
    document.getElementById('quizConfig').classList.remove('hidden');
}

function exitQuiz() {
    document.getElementById('quizArena').classList.add('hidden');
    document.getElementById('quizConfig').classList.remove('hidden');
    renderDashboard();
}

// ===== TRAZOS =====
let canvasCtx = null;
let isDrawing = false;

function setupStrokes() {
    document.getElementById('strokeBack').addEventListener('click', () => {
        document.getElementById('strokePractice').classList.add('hidden');
        document.getElementById('strokesGrid').parentElement.querySelector('.strokes-info-card').classList.remove('hidden');
        document.getElementById('strokesGrid').classList.remove('hidden');
    });

    document.getElementById('clearCanvas').addEventListener('click', clearCanvas);

    // Canvas setup
    const canvas = document.getElementById('practiceCanvas');
    canvasCtx = canvas.getContext('2d');

    // Touch events
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);

    // Mouse events
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
}

function renderStrokesGrid() {
    const grid = document.getElementById('strokesGrid');
    grid.innerHTML = kanjiData.map(k => `
        <button class="stroke-kanji-btn" onclick="openStrokePractice(${k.id})">
            ${k.kanji}
        </button>
    `).join('');
}

function openStrokePractice(id) {
    const k = kanjiData.find(x => x.id === id);
    if (!k) return;

    document.getElementById('strokeKanjiDisplay').textContent = k.kanji;
    document.getElementById('strokeMeaning').textContent = k.significado_es;
    document.getElementById('strokeCount').textContent = k.trazos ? `${k.trazos} trazos` : 'No disponible';
    document.getElementById('strokeReading').textContent = k.romaji.join(', ');

    // Cargar animación de orden de trazos
    loadStrokeOrder(k.kanji);

    document.getElementById('strokesGrid').classList.add('hidden');
    document.querySelector('.strokes-info-card').classList.add('hidden');
    document.getElementById('strokePractice').classList.remove('hidden');

    clearCanvas();
    resizeCanvas();
}

function loadStrokeOrder(kanji) {
    const img = document.getElementById('strokeOrderImg');
    const hint = document.getElementById('strokeOrderHint');
    const codePoint = kanji.codePointAt(0).toString(16);

    // GIFs animados de stroke order del repositorio público
    const gifUrl = `https://raw.githubusercontent.com/mistval/kanji_images/master/gifs/${codePoint}.gif`;

    img.style.display = 'none';
    hint.textContent = 'Cargando animación...';
    hint.style.display = 'block';

    img.onload = () => {
        img.style.display = 'block';
        hint.textContent = 'Toca la imagen para repetir la animación';
    };

    img.onerror = () => {
        img.style.display = 'none';
        hint.textContent = 'Animación no disponible para este kanji. Usa el kanji de referencia de arriba.';
    };

    img.src = gifUrl;

    // Click para reiniciar animación GIF
    img.onclick = () => {
        const currentSrc = img.src;
        img.src = '';
        setTimeout(() => { img.src = currentSrc; }, 50);
    };
}

function resizeCanvas() {
    const canvas = document.getElementById('practiceCanvas');
    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth - 20, 300);
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    // Guía central
    canvasCtx.strokeStyle = 'rgba(100, 100, 120, 0.2)';
    canvasCtx.lineWidth = 1;
    canvasCtx.setLineDash([5, 5]);
    canvasCtx.beginPath();
    canvasCtx.moveTo(size / 2, 0);
    canvasCtx.lineTo(size / 2, size);
    canvasCtx.moveTo(0, size / 2);
    canvasCtx.lineTo(size, size / 2);
    canvasCtx.stroke();
    canvasCtx.setLineDash([]);
}

function getCanvasPos(e) {
    const canvas = document.getElementById('practiceCanvas');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches) {
        return {
            x: (e.touches[0].clientX - rect.left) * scaleX,
            y: (e.touches[0].clientY - rect.top) * scaleY
        };
    }
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function startDraw(e) {
    e.preventDefault();
    isDrawing = true;
    const pos = getCanvasPos(e);
    canvasCtx.beginPath();
    canvasCtx.moveTo(pos.x, pos.y);
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    canvasCtx.strokeStyle = '#B388FF';
    canvasCtx.lineWidth = 4;
    canvasCtx.lineCap = 'round';
    canvasCtx.lineJoin = 'round';
    canvasCtx.lineTo(pos.x, pos.y);
    canvasCtx.stroke();
}

function stopDraw() {
    isDrawing = false;
}

function clearCanvas() {
    const canvas = document.getElementById('practiceCanvas');
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    resizeCanvas();
}

// ===== UTILIDADES =====
function filterKanji(filter) {
    const usable = kanjiData.filter(k => !k.placeholder);
    switch (filter) {
        case 'quiz': return usable.filter(k => k.entra_quiz_actual);
        case 'nivel-1': return usable.filter(k => k.nivel === 1);
        case 'nivel-2': return usable.filter(k => k.nivel === 2);
        default:
            if (filter && filter.startsWith('lesson-')) {
                const num = parseInt(filter.split('-')[1]);
                return usable.filter(k => k.lesson === num);
            }
            return usable;
    }
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function escapeAttr(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ===== MATERIA =====
function toggleMateria(btn) {
    const card = btn.closest('.materia-card');
    card.classList.toggle('open');
}

function switchMateriaTab(tab, btn) {
    document.querySelectorAll('.materia-subtab').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.materia-tab').forEach(b => b.classList.remove('active'));
    document.getElementById(`subtab-${tab}`).classList.add('active');
    btn.classList.add('active');
}

function filterVocab() {
    const query = document.getElementById('vocabSearchInput').value.toLowerCase().trim();
    const items = document.querySelectorAll('#vocabContainer .vocab-item');
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? '' : 'none';
    });
    // Show/hide categories that have no visible items
    document.querySelectorAll('#vocabContainer .materia-card').forEach(card => {
        const visibleItems = card.querySelectorAll('.vocab-item:not([style*="display: none"])');
        card.style.display = visibleItems.length > 0 || !query ? '' : 'none';
    });
}
