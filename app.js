// MATH-HUB // MAIN APPLICATION CONTROLLER
import { ProblemEngine } from './problemEngine.js';
import { MathEngine } from './mathEngine.js';
import { GistSync } from './gistSync.js';
import { PROBLEMS_URL, PDF_BASE_URL } from './config.js';

const problemEngine = new ProblemEngine();
const mathEngine = new MathEngine();
const gistSync = new GistSync();

let currentProblemObj = null;
let pdfManifest = null; // { pdfs: [{ slug, title, file, pages, ... }] } da math-pdf

// Stato UI Mental Math
let currentOperation = null, mentalTimerInterval = null, mentalTimeLeft = 0;
let mentalScore = 0, opStartTime = 0, currentErrors = 0, sessionStats = [];
let probTimelineChartInstance = null, mentalLatencyChartInstance = null, mentalVolumeChartInstance = null;

window.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    await loadProblemsDatabase();
    setupProblemSolvingUI();
    setupMentalMathUI();
    setupDashboardUI();
    setupSyncUI();
    updateTopStreakPills();
    loadPdfManifest(); // non bloccante: la libreria è un extra
});

async function loadProblemsDatabase() {
    try {
        const res = await fetch(PROBLEMS_URL, { cache: 'no-store' });
        const data = await res.json();
        problemEngine.setProblems(data);
    } catch (err) {
        console.error('Errore caricamento problems.json:', err);
    }
}

// --- LIBRERIA PDF (math-pdf/manifest.json) ---
async function loadPdfManifest() {
    try {
        const res = await fetch(new URL('manifest.json', PDF_BASE_URL), { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        pdfManifest = await res.json();
    } catch (err) {
        console.warn('Manifest PDF non disponibile:', err);
        pdfManifest = null;
    }
    renderLibrary();
    if (currentProblemObj) renderProblemSource(currentProblemObj);
}

function pdfUrlFor(slug) {
    const item = pdfManifest?.pdfs?.find(p => p.slug === slug);
    return item ? new URL(`pdf/${item.file}`, PDF_BASE_URL).href : null;
}

function renderLibrary() {
    const listEl = document.getElementById('library-list');
    const metaEl = document.getElementById('library-meta');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!pdfManifest?.pdfs?.length) {
        const li = document.createElement('li');
        li.style.color = 'var(--fg-muted)';
        li.textContent = `Nessun PDF disponibile (manifest non raggiungibile: ${PDF_BASE_URL}).`;
        listEl.appendChild(li);
        metaEl.textContent = '';
        return;
    }

    for (const p of pdfManifest.pdfs) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = new URL(`pdf/${p.file}`, PDF_BASE_URL).href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = `[ ${p.title.toUpperCase()} ]`;
        const info = document.createElement('span');
        info.style.color = 'var(--fg-muted)';
        info.textContent = [p.pages ? `${p.pages} PAG` : null, `${Math.round(p.bytes / 1024)} KB`, (p.builtAt || '').slice(0, 10)]
            .filter(Boolean).join(' · ');
        li.append(a, info);
        listEl.appendChild(li);
    }
    const commit = pdfManifest.sourceCommit ? pdfManifest.sourceCommit.slice(0, 7) : '?';
    metaEl.textContent = `// BUILD ${String(pdfManifest.generatedAt || '').slice(0, 16).replace('T', ' ')} · math-tex@${commit}`;
}

function renderProblemSource(p) {
    const el = document.getElementById('prob-source');
    if (!el) return;
    el.innerHTML = '';
    if (!p?.source) return;
    const label = `${p.source.file}:${p.source.line}`;
    const url = pdfUrlFor(p.source.slug);
    if (url) {
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = `// FONTE: ${label} → PDF`;
        el.appendChild(a);
    } else {
        el.textContent = `// FONTE: ${label}`;
    }
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = ['sec-problems', 'sec-mental', 'sec-dashboard', 'sec-library', 'sec-sync', 'sec-docs'];

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            sections.forEach(s => {
                const el = document.getElementById(s);
                if(el) el.classList.add('hidden');
            });
            const targetEl = document.getElementById(target);
            if(targetEl) targetEl.classList.remove('hidden');

            if (target === 'sec-dashboard') refreshDashboard();
            if (target === 'sec-problems') {
                if (problemEngine.state.activeCourse) {
                    renderCurrentProblem(false);
                } else {
                    renderCourseSelection();
                }
            }
            updateTopStreakPills();
        });
    });
}

function updateTopStreakPills() {
    const pStreak = problemEngine.getStreakData();
    const mData = mathEngine.getStreakAndDashboardData();
    document.getElementById('nav-streak-prob').textContent = `PROB: ${pStreak.current}`;
    document.getElementById('nav-streak-calc').textContent = `CALC: ${mData.streaks.current}`;
}

// --- PROBLEM SOLVING & ROUTING DEI CORSI ---
function setupProblemSolvingUI() {
    const btnDone = document.getElementById('btn-done');
    const stageSolve = document.getElementById('stage-solve');
    const stageRate = document.getElementById('stage-rate');
    const btnBack = document.getElementById('btn-back-courses');
    
    // Nuovi bottoni di valutazione
    const btnFail = document.getElementById('btn-fail');
    const btnHard = document.getElementById('btn-hard');
    const btnGood = document.getElementById('btn-good');
    const btnEasy = document.getElementById('btn-easy');

    btnDone.addEventListener('click', () => {
        stageSolve.classList.add('hidden');
        stageRate.classList.remove('hidden');
    });

    const handleRating = (val) => {
        if (!currentProblemObj) return;
        problemEngine.submitEvaluation(currentProblemObj.id, val); 
        updateTopStreakPills();
        renderCurrentProblem(true);
    };

    if(btnFail) btnFail.addEventListener('click', () => handleRating(1.0));
    if(btnHard) btnHard.addEventListener('click', () => handleRating(0.8));
    if(btnGood) btnGood.addEventListener('click', () => handleRating(0.4));
    if(btnEasy) btnEasy.addEventListener('click', () => handleRating(0.1));

    btnBack.addEventListener('click', () => {
        problemEngine.setActiveCourse(null);
        renderCourseSelection();
    });

    if (problemEngine.state.activeCourse) {
        renderCurrentProblem(false);
    } else {
        renderCourseSelection();
    }
}

function renderCourseSelection() {
    document.getElementById('course-selection').classList.remove('hidden');
    document.getElementById('problem-solving-area').classList.add('hidden');
    
    const listEl = document.getElementById('course-list');
    listEl.innerHTML = '';
    
    const courses = problemEngine.getAvailableCourses();
    if (courses.length === 0) {
        listEl.innerHTML = '<p style="color:var(--fg-muted);">Nessun corso trovato nel database.</p>';
        return;
    }

    courses.forEach(course => {
        const prog = problemEngine.getCourseProgress(course);
        const btn = document.createElement('button');
        btn.className = 'btn btn-course';
        btn.innerHTML = `
            <span>[ ${course.toUpperCase()} ]</span>
            <span style="font-size:0.75rem; color:var(--fg-muted); font-family:var(--font-mono);">${prog.str}</span>
        `;
        
        btn.addEventListener('click', () => {
            problemEngine.setActiveCourse(course);
            renderCurrentProblem(true);
        });
        
        listEl.appendChild(btn);
    });
}

function renderCurrentProblem(forceNew = false) {
    document.getElementById('course-selection').classList.add('hidden');
    document.getElementById('problem-solving-area').classList.remove('hidden');

    const next = problemEngine.getNextProblem(forceNew);
    
    document.getElementById('stage-solve').classList.remove('hidden');
    document.getElementById('stage-rate').classList.add('hidden');

    if (!next || !next.problem) {
        document.getElementById('prob-breadcrumb').textContent = '// FINE PERCORSO';
        document.getElementById('prob-progress').textContent = '';
        document.getElementById('prob-statement').textContent = 'Nessun problema rimanente o da ripassare per questo corso.';
        return;
    }

    currentProblemObj = next.problem;
    const p = currentProblemObj;
    
    document.getElementById('prob-breadcrumb').textContent = `[${next.mode}] ${p.course.toUpperCase()} > ${p.topic.toUpperCase()}`;
    const prog = problemEngine.getCourseProgress(p.course);
    document.getElementById('prob-progress').textContent = prog.str;

    const statementEl = document.getElementById('prob-statement');
    statementEl.innerHTML = p.statement;
    if (window.renderMathInElement) {
        window.renderMathInElement(statementEl, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\\[', right: '\\]', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false }
            ],
            throwOnError: false
        });
    }
    renderProblemSource(p);
}

// --- MENTAL MATH ---
function setupMentalMathUI() {
    const multiplicandDisplay = document.getElementById('multiplicand');
    const multiplierDisplay = document.getElementById('multiplier');
    const answerInput = document.getElementById('answer-input');
    const ruleBanner = document.getElementById('trachtenberg-rule-banner');
    const timerDisplay = document.getElementById('mental-timer-display');
    const scoreDisplay = document.getElementById('mental-score-display');
    const setupBox = document.getElementById('mental-setup-box');
    const gameBox = document.getElementById('mental-game-box');

    function readSetup() {
        return {
            digits: document.getElementById('config-digits').value.trim() || '2',
            mult: document.getElementById('config-mult').value.trim() || '11',
            multType: document.getElementById('config-mult-type').value,
            time: document.getElementById('config-time').value || '60',
            timeType: document.getElementById('config-time-type').value
        };
    }

    function loadPresetsUI() {
        const container = document.getElementById('presets-container');
        container.innerHTML = '';
        const presets = mathEngine.getPresets();
        Object.keys(presets).forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.style.padding = '5px 10px';
            btn.style.fontSize = '0.8rem';
            btn.textContent = `[ ${name.toUpperCase()} ]`;
            btn.title = 'Click: applica · Tasto destro: elimina';
            btn.addEventListener('click', () => {
                const c = presets[name];
                document.getElementById('config-digits').value = c.digits;
                document.getElementById('config-mult').value = c.mult;
                document.getElementById('config-mult-type').value = c.multType;
                document.getElementById('config-time').value = c.time;
                document.getElementById('config-time-type').value = c.timeType === 'm' ? 'm' : 's';
                document.getElementById('preset-name').value = name;
            });
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (confirm(`Eliminare il preset "${name}"?`)) {
                    mathEngine.deletePreset(name);
                    loadPresetsUI();
                }
            });
            container.appendChild(btn);
        });
    }

    loadPresetsUI();

    document.getElementById('btn-save-preset').addEventListener('click', () => {
        const nameInput = document.getElementById('preset-name');
        const name = nameInput.value.trim();
        if (!name) { nameInput.focus(); return; }
        mathEngine.savePreset(name, readSetup());
        loadPresetsUI();
    });

    // Durante la sessione ogni click riporta il focus sulla risposta (come nel widget MentalMath)
    document.addEventListener('click', (e) => {
        if (gameBox.classList.contains('hidden') || answerInput.disabled) return;
        if (e.target.closest('button, a, input, select')) return;
        answerInput.focus();
    });

    document.getElementById('btn-start-session').addEventListener('click', () => {
        const { digits, mult, multType, time, timeType } = readSetup();
        const timeNumber = parseInt(time, 10) || 60;
        const timeValue = timeType === 'm' ? timeNumber * 60 : timeNumber;

        mentalTimeLeft = timeValue;
        mentalScore = 0;
        sessionStats = [];

        mathEngine.updateConfig({ digits, mult, multType });
        answerInput.disabled = false;

        setupBox.classList.add('hidden');
        gameBox.classList.remove('hidden');

        clearInterval(mentalTimerInterval);
        timerDisplay.textContent = `TEMPO: ${mentalTimeLeft}s`;
        scoreDisplay.textContent = `PUNTI: 0`;

        mentalTimerInterval = setInterval(() => {
            mentalTimeLeft--;
            timerDisplay.textContent = `TEMPO: ${mentalTimeLeft}s`;
            if (mentalTimeLeft <= 0) endMentalSession();
        }, 1000);

        renderNewOperation();
    });

    document.getElementById('btn-exit-game').addEventListener('click', () => {
        clearInterval(mentalTimerInterval);
        mathEngine.updateWeights(sessionStats);
        updateTopStreakPills();
        gameBox.classList.add('hidden');
        setupBox.classList.remove('hidden');
    });

    function endMentalSession() {
        clearInterval(mentalTimerInterval);
        answerInput.disabled = true;
        multiplicandDisplay.textContent = 'STOP';
        multiplierDisplay.textContent = '';
        answerInput.value = `TOT: ${mentalScore}`;
        mathEngine.updateWeights(sessionStats);
        sessionStats = []; // evita il doppio conteggio quando poi si preme [ END ]
        updateTopStreakPills();
    }

    function renderNewOperation() {
        currentOperation = mathEngine.generateOperation();
        multiplicandDisplay.textContent = currentOperation.multiplicand;
        multiplierDisplay.textContent = `* ${currentOperation.multiplier}`;
        ruleBanner.textContent = `// ` + mathEngine.getRuleForMultiplier(currentOperation.multiplier).toUpperCase();
        answerInput.value = '';
        opStartTime = performance.now();
        currentErrors = 0;
        answerInput.focus();
    }

    answerInput.addEventListener('keydown', (e) => {
        if (answerInput.disabled) return;
        if (e.key.length > 1 && e.key !== 'Backspace') return;
        e.preventDefault();

        if (e.key === 'Backspace') {
            answerInput.value = answerInput.value.slice(1);
        } else if (/^\d$/.test(e.key)) {
            answerInput.value = e.key + answerInput.value;
        } else {
            return;
        }

        answerInput.setSelectionRange(0, 0);
        if (!currentOperation) return;

        const validation = mathEngine.validateInput(answerInput.value, currentOperation.targetStr);
        if (validation.status === 'CORRECT') {
            const timeTaken = performance.now() - opStartTime;
            sessionStats.push({
                key: currentOperation.key,
                multiplicand: currentOperation.rawMultiplicand,
                time: timeTaken,
                errors: currentErrors
            });
            mentalScore++;
            scoreDisplay.textContent = `PUNTI: ${mentalScore}`;
            renderNewOperation();
        } else if (validation.status === 'ERROR') {
            currentErrors++;
            answerInput.style.borderBottomColor = 'var(--bg)';
            setTimeout(() => {
                answerInput.value = '';
                answerInput.style.borderBottomColor = 'var(--fg)';
            }, 150);
        }
    });
}

// --- DASHBOARD ESSENZIALE ---
function setupDashboardUI() {}

// Heatmap stile GitHub (portata dal widget MentalMath): una colonna per settimana, da domenica
function renderHeatmap(data) {
    const container = document.getElementById('heatmap-grid');
    if (!container) return;

    const toISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parte dal primo giorno con dati (o da 26 settimane fa), arretrando fino a domenica
    const dates = Object.keys(data).sort();
    const minStart = new Date(today); minStart.setDate(minStart.getDate() - 7 * 26);
    const first = dates.length ? new Date(`${dates[0]}T00:00:00`) : minStart;
    const start = first < minStart ? first : minStart;
    while (start.getDay() !== 0) start.setDate(start.getDate() - 1);

    const frag = document.createDocumentFragment();
    let col = null;
    for (const cur = new Date(start); cur <= today; cur.setDate(cur.getDate() + 1)) {
        if (cur.getDay() === 0 || !col) {
            col = document.createElement('div');
            col.className = 'heatmap-col';
            frag.appendChild(col);
        }
        const dStr = toISO(cur);
        const count = data[dStr] || 0;
        const level = count >= 100 ? 4 : count >= 50 ? 3 : count >= 20 ? 2 : count > 0 ? 1 : 0;
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.dataset.level = level;
        cell.title = `${dStr}: ${count} calcoli`;
        col.appendChild(cell);
    }
    container.replaceChildren(frag);
    container.scrollLeft = container.scrollWidth; // mostra i giorni più recenti
}

function refreshDashboard() {
    const pStreak = problemEngine.getStreakData();
    const mData = mathEngine.getStreakAndDashboardData();
    
    document.getElementById('kpi-prob-streak').textContent = `${pStreak.current} GG`;
    const masteryPct = problemEngine.state.globalEmaMastery ? Math.round(problemEngine.state.globalEmaMastery * 100) : 50;
    document.getElementById('kpi-global-mastery').textContent = `${masteryPct}%`;

    document.getElementById('kpi-calc-streak').textContent = mData.streaks.current;
    document.getElementById('kpi-calc-best').textContent = mData.streaks.best;
    document.getElementById('kpi-calc-today').textContent = mData.streaks.todayCount;
    renderHeatmap(mData.heatmapData);

    if (typeof Chart === 'undefined') return;

    const ctxVol = document.getElementById('chart-mental-volume');
    if (mentalVolumeChartInstance) mentalVolumeChartInstance.destroy();
    mentalVolumeChartInstance = new Chart(ctxVol, {
        type: 'bar',
        data: { labels: mData.labels, datasets: [{ label: 'Calcoli', data: mData.volumeData, backgroundColor: '#ffffff' }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { display: false }, border: { color: '#ffffff' }, ticks: { color: '#888', font: { family: 'monospace' } } },
                x: { grid: { display: false }, border: { color: '#ffffff' }, ticks: { color: '#888', font: { family: 'monospace' } } }
            },
            plugins: { legend: { display: false } }
        }
    });

    const pHist = problemEngine.state.dailyHistory;
    const pDates = Object.keys(pHist).sort();
    const todayISO = problemEngine.getTodayISO();
    const labelsProb = pDates.length ? pDates : [todayISO];
    const probCounts = labelsProb.map(d => pHist[d]?.count || 0);

    const ctxProb = document.getElementById('chart-prob-timeline');
    if (probTimelineChartInstance) probTimelineChartInstance.destroy();
    probTimelineChartInstance = new Chart(ctxProb, {
        type: 'bar',
        data: {
            labels: labelsProb,
            datasets: [{
                label: 'Problemi Risolti',
                data: probCounts,
                backgroundColor: '#ffffff'
            }]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { display: false }, 
                    border: { color: '#ffffff' }, 
                    ticks: { color: '#888', font: { family: 'monospace' } } 
                },
                x: { 
                    grid: { display: false }, 
                    border: { color: '#ffffff' }, 
                    ticks: { color: '#888', font: { family: 'monospace' } } 
                }
            },
            plugins: { legend: { display: false } }
        }
    });

    const ctxLat = document.getElementById('chart-mental-latency');
    if (mentalLatencyChartInstance) mentalLatencyChartInstance.destroy();
    mentalLatencyChartInstance = new Chart(ctxLat, {
        type: 'line',
        data: {
            labels: mData.labels,
            datasets: mData.latencyDatasets.length ? mData.latencyDatasets : [{
                label: 'Latenza (s)', data: [0], borderColor: '#ffffff', backgroundColor: '#ffffff', borderWidth: 1.5, tension: 0, stepped: true
            }]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { display: false }, 
                    border: { color: '#ffffff' }, 
                    ticks: { color: '#888', font: { family: 'monospace' } } 
                },
                x: { 
                    grid: { display: false }, 
                    border: { color: '#ffffff' }, 
                    ticks: { color: '#888', font: { family: 'monospace' } } 
                }
            },
            plugins: { legend: { labels: { color: '#fff', font: { family: 'monospace' } } } },
            elements: {
                line: {
                    stepped: true
                }
            }
        }
    });
}

// --- SYNC GITHUB GIST ---
function setupSyncUI() {
    const tokenInput = document.getElementById('gist-token');
    const idInput = document.getElementById('gist-id');
    const logEl = document.getElementById('sync-log');

    const cfg = gistSync.getConfig();
    tokenInput.value = cfg.token || '';
    idInput.value = cfg.gistId || '';
    if (cfg.lastSync) logEl.textContent = `// ULTIMO SYNC: ${cfg.lastSync}`;

    document.getElementById('btn-gist-push').addEventListener('click', async () => {
        gistSync.saveConfig(tokenInput.value, idInput.value);
        logEl.textContent = '// PUSH IN CORSO...';
        try {
            const stamp = await gistSync.pushToGist();
            logEl.textContent = `// PUSH OK (${stamp})`;
        } catch (err) { logEl.textContent = `// ERRORE: ${err.message}`; }
    });

    document.getElementById('btn-gist-pull').addEventListener('click', async () => {
        gistSync.saveConfig(tokenInput.value, idInput.value);
        logEl.textContent = '// PULL IN CORSO...';
        try {
            const stamp = await gistSync.pullFromGist();
            problemEngine.state = problemEngine.loadState();
            mathEngine.reloadFromStorage();
            if (problemEngine.state.activeCourse) renderCurrentProblem(false);
            updateTopStreakPills();
            logEl.textContent = `// PULL OK (${stamp})`;
        } catch (err) { logEl.textContent = `// ERRORE: ${err.message}`; }
    });
}
