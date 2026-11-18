// MATH-HUB // MAIN APPLICATION CONTROLLER
import { ProblemEngine } from './problemEngine.js';
import { MathEngine } from './mathEngine.js';
import { GistSync } from './gistSync.js';

const problemEngine = new ProblemEngine();
const mathEngine = new MathEngine();
const gistSync = new GistSync();

// Stato UI Problem-Solving
let currentProblemObj = null;
let problemTimerInterval = null;
let problemElapsedSeconds = 0;

// Stato UI Mental Math
let currentOperation = null;
let mentalTimerInterval = null;
let mentalTimeLeft = 0;
let mentalScore = 0;
let opStartTime = 0;
let currentErrors = 0;
let sessionStats = [];

// Istanze Chart.js
let radarChartInstance = null;
let probTimelineChartInstance = null;
let mentalLatencyChartInstance = null;

// --- INIZIALIZZAZIONE ---
window.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    await loadProblemsDatabase();
    setupProblemSolvingUI();
    setupMentalMathUI();
    setupDashboardUI();
    setupSyncUI();
    updateTopStreakPills();
});

async function loadProblemsDatabase() {
    try {
        const res = await fetch('./problems.json', { cache: 'no-store' });
        const data = await res.json();
        problemEngine.setProblems(data);
    } catch (err) {
        console.error('Errore caricamento problems.json:', err);
    }
}

// --- NAVIGAZIONE TRA LE 4 VISTE ---
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = ['sec-problems', 'sec-mental', 'sec-dashboard', 'sec-sync'];

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            sections.forEach(s => document.getElementById(s).classList.add('hidden'));
            document.getElementById(target).classList.remove('hidden');

            if (target === 'sec-dashboard') {
                refreshDashboard();
            }
            updateTopStreakPills();
        });
    });
}

function updateTopStreakPills() {
    const pStreak = problemEngine.getStreakData();
    const mData = mathEngine.getStreakAndDashboardData();
    document.getElementById('nav-streak-prob').textContent = `${pStreak.current}g (Oggi: ${pStreak.todayCount})`;
    document.getElementById('nav-streak-calc').textContent = `${mData.streaks.current}g (Oggi: ${mData.streaks.todayCount})`;
}

// --- VISTA 1: PROBLEM-SOLVING ULTRA-ESSENZIALE ---
function setupProblemSolvingUI() {
    const coreSel = document.getElementById('filter-core');
    const courseSel = document.getElementById('filter-course');
    const topicSel = document.getElementById('filter-topic');

    populateFilterDropdowns();

    coreSel.addEventListener('change', () => {
        populateCourseDropdown();
        populateTopicDropdown();
        problemEngine.state.activeProblemId = null;
        renderCurrentProblem(true);
    });

    courseSel.addEventListener('change', () => {
        populateTopicDropdown();
        problemEngine.state.activeProblemId = null;
        renderCurrentProblem(true);
    });

    topicSel.addEventListener('change', () => {
        problemEngine.state.activeProblemId = null;
        renderCurrentProblem(true);
    });

    const btnSolved = document.getElementById('btn-reveal-rating');
    const stageSolve = document.getElementById('stage-solve');
    const stageRate = document.getElementById('stage-rate');
    const slider = document.getElementById('difficulty-slider');
    const sliderValLabel = document.getElementById('slider-val-display');
    const sliderPreview = document.getElementById('slider-action-preview');

    btnSolved.addEventListener('click', () => {
        stopProblemTimer();
        stageSolve.classList.add('hidden');
        stageRate.classList.remove('hidden');
        slider.value = '0.35';
        updateSliderPreview('0.35');
        slider.focus();
    });

    slider.addEventListener('input', (e) => {
        updateSliderPreview(e.target.value);
    });

    function updateSliderPreview(val) {
        sliderValLabel.textContent = parseFloat(val).toFixed(2);
        sliderPreview.textContent = problemEngine.describeSliderImpact(val);
    }

    document.getElementById('btn-confirm-rating').addEventListener('click', () => {
        if (!currentProblemObj) return;
        const val = parseFloat(slider.value);
        problemEngine.submitEvaluation(currentProblemObj.id, val, problemElapsedSeconds);
        updateTopStreakPills();
        renderCurrentProblem(true);
    });

    document.getElementById('btn-surrender').addEventListener('click', () => {
        if (!currentProblemObj) return;
        slider.value = '1.00';
        updateSliderPreview('1.00');
        problemEngine.submitEvaluation(currentProblemObj.id, 1.0, problemElapsedSeconds);
        updateTopStreakPills();
        renderCurrentProblem(true);
    });

    renderCurrentProblem(false);
}

function getActiveFilter() {
    return {
        core: document.getElementById('filter-core').value,
        course: document.getElementById('filter-course').value,
        topic: document.getElementById('filter-topic').value
    };
}

function populateFilterDropdowns() {
    const cores = Array.from(new Set(problemEngine.problems.map(p => p.core)));
    const coreSel = document.getElementById('filter-core');
    coreSel.innerHTML = `<option value="ALL">NUCLEO: TUTTI</option>` +
        cores.map(c => `<option value="${c}">${c.toUpperCase()}</option>`).join('');
    populateCourseDropdown();
    populateTopicDropdown();
}

function populateCourseDropdown() {
    const core = document.getElementById('filter-core').value;
    const filtered = problemEngine.problems.filter(p => core === 'ALL' || p.core === core);
    const courses = Array.from(new Set(filtered.map(p => p.course)));
    const courseSel = document.getElementById('filter-course');
    courseSel.innerHTML = `<option value="ALL">CORSO: TUTTI</option>` +
        courses.map(c => `<option value="${c}">${c.toUpperCase()}</option>`).join('');
}

function populateTopicDropdown() {
    const core = document.getElementById('filter-core').value;
    const course = document.getElementById('filter-course').value;
    const filtered = problemEngine.problems.filter(p =>
        (core === 'ALL' || p.core === core) &&
        (course === 'ALL' || p.course === course)
    );
    const topics = Array.from(new Set(filtered.map(p => p.topic)));
    const topicSel = document.getElementById('filter-topic');
    topicSel.innerHTML = `<option value="ALL">ARGOMENTO: TUTTI</option>` +
        topics.map(t => `<option value="${t}">${t.toUpperCase()}</option>`).join('');
}

function renderCurrentProblem(forceNew = false) {
    const filter = getActiveFilter();
    const next = problemEngine.getNextProblem(filter, forceNew);

    const stageSolve = document.getElementById('stage-solve');
    const stageRate = document.getElementById('stage-rate');
    stageSolve.classList.remove('hidden');
    stageRate.classList.add('hidden');

    if (!next || !next.problem) {
        document.getElementById('prob-breadcrumb').textContent = 'NESSUN PROBLEMA TROVATO NEL FILTRO';
        document.getElementById('prob-statement').textContent = 'Aggiungi esercizi in problems.json o cambia filtro.';
        return;
    }

    currentProblemObj = next.problem;
    const p = currentProblemObj;
    const tKey = problemEngine.getTopicKey(p);
    const tStat = problemEngine.state.topicStats[tKey] || { emaMastery: 0.5, skippedQueue: [] };
    const topicProbs = problemEngine.problems.filter(x => problemEngine.getTopicKey(x) === tKey);
    const solvedInTopic = topicProbs.filter(x => problemEngine.state.problemRecords[x.id]?.status === 'solved').length;

    // Aggiorna telemetria del micro-argomento
    document.getElementById('tele-mastery').textContent = `${Math.round((tStat.emaMastery ?? 0.5) * 100)}%`;
    document.getElementById('tele-coverage').textContent = `${solvedInTopic}/${topicProbs.length}`;
    document.getElementById('tele-skipped').textContent = `${(tStat.skippedQueue || []).length}`;

    // Aggiorna intestazione problema
    document.getElementById('prob-breadcrumb').innerHTML =
        `${p.core} &gt; ${p.course} &gt; <strong>${p.topic}</strong>`;
    document.getElementById('prob-id-badge').textContent = `[${p.id}]`;
    document.getElementById('prob-diff-badge').textContent = `DIFF: ${p.baseDiff}/10`;
    document.getElementById('prob-mode-badge').textContent = next.mode;

    // Renderizza LaTeX con KaTeX auto-render
    const statementEl = document.getElementById('prob-statement');
    statementEl.innerHTML = p.statement;
    if (window.renderMathInElement) {
        window.renderMathInElement(statementEl, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\[', right: '\]', display: true },
                { left: '$', right: '$', display: false },
                { left: '\(', right: '\)', display: false }
            ],
            throwOnError: false
        });
    }

    startProblemTimer();
}

function startProblemTimer() {
    stopProblemTimer();
    problemElapsedSeconds = 0;
    const timerEl = document.getElementById('prob-timer');
    timerEl.textContent = '00:00';
    problemTimerInterval = setInterval(() => {
        problemElapsedSeconds++;
        const mins = String(Math.floor(problemElapsedSeconds / 60)).padStart(2, '0');
        const secs = String(problemElapsedSeconds % 60).padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopProblemTimer() {
    if (problemTimerInterval) {
        clearInterval(problemTimerInterval);
        problemTimerInterval = null;
    }
}

// --- VISTA 2: MENTAL MATH (TRACHTENBERG) ---
function setupMentalMathUI() {
    const multiplicandDisplay = document.getElementById('multiplicand');
    const multiplierDisplay = document.getElementById('multiplier');
    const answerInput = document.getElementById('answer-input');
    const ruleBanner = document.getElementById('trachtenberg-rule-banner');
    const timerDisplay = document.getElementById('mental-timer-display');
    const scoreDisplay = document.getElementById('mental-score-display');

    const setupBox = document.getElementById('mental-setup-box');
    const gameBox = document.getElementById('mental-game-box');

    function loadPresetsUI() {
        const container = document.getElementById('presets-container');
        container.innerHTML = '';
        const presets = mathEngine.getPresets();

        Object.keys(presets).forEach(name => {
            const btn = document.createElement('div');
            btn.className = 'preset-chip';
            btn.textContent = name;
            btn.addEventListener('click', () => {
                const c = presets[name];
                document.getElementById('config-digits').value = c.digits;
                document.getElementById('config-mult').value = c.mult;
                document.getElementById('config-mult-type').value = c.multType;
                document.getElementById('config-time').value = c.time;
                document.getElementById('config-time-type').value = c.timeType;
            });
            container.appendChild(btn);
        });

        const addInput = document.createElement('input');
        addInput.type = 'text';
        addInput.placeholder = 'Nuovo preset...';
        addInput.style.cssText = 'width:115px;padding:5px 8px;background:#0a0a0a;color:#fff;border:1px solid #333;font-family:monospace;font-size:0.8rem;';

        const saveBtn = document.createElement('div');
        saveBtn.className = 'preset-chip';
        saveBtn.style.borderColor = '#fff';
        saveBtn.style.color = '#fff';
        saveBtn.textContent = '+ SALVA';
        saveBtn.addEventListener('click', () => {
            const name = addInput.value.trim();
            if (name) {
                mathEngine.savePreset(name, {
                    digits: document.getElementById('config-digits').value,
                    mult: document.getElementById('config-mult').value,
                    multType: document.getElementById('config-mult-type').value,
                    time: document.getElementById('config-time').value,
                    timeType: document.getElementById('config-time-type').value
                });
                loadPresetsUI();
            }
        });

        container.appendChild(addInput);
        container.appendChild(saveBtn);
    }

    loadPresetsUI();

    document.getElementById('btn-start-session').addEventListener('click', () => {
        const digits = document.getElementById('config-digits').value.trim() || '2';
        const mult = document.getElementById('config-mult').value.trim() || '11';
        const multType = document.getElementById('config-mult-type').value;
        const timeValue = parseInt(document.getElementById('config-time').value, 10) || 60;
        const timeType = document.getElementById('config-time-type').value;

        mentalTimeLeft = timeType === 'm' ? timeValue * 60 : timeValue;
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
        updateTopStreakPills();
    }

    function renderNewOperation() {
        currentOperation = mathEngine.generateOperation();
        multiplicandDisplay.textContent = currentOperation.multiplicand;
        multiplierDisplay.textContent = ` * ${currentOperation.multiplier}`;
        ruleBanner.textContent = mathEngine.getRuleForMultiplier(currentOperation.multiplier);
        answerInput.value = '';
        opStartTime = performance.now();
        currentErrors = 0;
        answerInput.focus();
    }

    answerInput.addEventListener('keydown', (e) => {
        if (answerInput.disabled) return;
        if (e.key.length > 1 && e.key !== 'Backspace') return;
        e.preventDefault();

        // Inserimento da destra a sinistra per il sistema Trachtenberg
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
            answerInput.classList.add('error-flash');
            setTimeout(() => {
                answerInput.value = '';
                answerInput.classList.remove('error-flash');
            }, 150);
        }
    });
}

// --- VISTA 3: SPETTRO DELLE COMPETENZE & DASHBOARD UNIFICATA ---
function setupDashboardUI() {
    document.getElementById('radar-scope-select').addEventListener('change', () => {
        renderSpectrumRadarAndTable();
    });
    document.getElementById('heatmap-mode-select').addEventListener('change', () => {
        renderUnifiedHeatmap();
    });
}

function refreshDashboard() {
    const pStreak = problemEngine.getStreakData();
    const mData = mathEngine.getStreakAndDashboardData();
    const spectrum = problemEngine.getSpectrumAnalytics();

    // 1. KPI Cards (Doppia Streak separata + Padronanza Globale)
    document.getElementById('kpi-prob-streak').textContent = `${pStreak.current} GG`;
    document.getElementById('kpi-prob-sub').textContent =
        `Record: ${pStreak.best} GG | Oggi: ${pStreak.todayCount} risolti (Target >= 1)`;

    document.getElementById('kpi-calc-streak').textContent = `${mData.streaks.current} GG`;
    document.getElementById('kpi-calc-sub').textContent =
        `Record: ${mData.streaks.best} GG | Oggi: ${mData.streaks.todayCount} calcoli`;

    const totalProbs = problemEngine.problems.length;
    const totalSolved = Object.values(problemEngine.state.problemRecords).filter(r => r.status === 'solved').length;
    const totalSkipped = Object.values(problemEngine.state.problemRecords).filter(r => r.status === 'skipped').length;
    const avgMastery = spectrum.topicRows.length
        ? Math.round(spectrum.topicRows.reduce((s, r) => s + r.masteryPct, 0) / spectrum.topicRows.length)
        : 50;

    document.getElementById('kpi-global-mastery').textContent = `${avgMastery}%`;
    document.getElementById('kpi-global-sub').textContent =
        `Copertura: ${totalSolved}/${totalProbs} risolti | Coda saltati: ${totalSkipped}`;

    // 2. Heatmap Unificata e Statistiche Latenza Mental Math
    renderUnifiedHeatmap();
    renderMentalLatencyText();

    // 3. Radar Chart & Tabella Spettro
    renderSpectrumRadarAndTable();

    // 4. Serie Temporali (Problemi & Mental Math)
    renderTimelineCharts(mData);
}

function renderUnifiedHeatmap() {
    const mode = document.getElementById('heatmap-mode-select').value;
    const container = document.getElementById('heatmap-grid');
    container.innerHTML = '';

    const mData = mathEngine.getStreakAndDashboardData();
    const pHist = problemEngine.state.dailyHistory;

    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const today = new Date(Date.now() - tzoffset);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 240); // Ultimi ~8 mesi
    while (startDate.getDay() !== 0) {
        startDate.setDate(startDate.getDate() - 1);
    }

    let html = '';
    let current = new Date(startDate);
    while (current <= today) {
        if (current.getDay() === 0) html += `<div class="heatmap-col">`;
        const dStr = current.toISOString().split('T')[0];

        const pCount = pHist[dStr]?.count || 0;
        const mCount = mData.heatmapData[dStr] || 0;

        let level = 0;
        let tooltip = `${dStr}: ${pCount} problemi, ${mCount} calcoli`;

        if (mode === 'PROBLEMS') {
            if (pCount >= 1) level = 1;
            if (pCount >= 3) level = 2;
            if (pCount >= 6) level = 3;
            if (pCount >= 10) level = 4;
        } else if (mode === 'MENTAL') {
            if (mCount > 0) level = 1;
            if (mCount >= 20) level = 2;
            if (mCount >= 50) level = 3;
            if (mCount >= 100) level = 4;
        } else {
            const score = (pCount * 20) + mCount;
            if (score > 0) level = 1;
            if (score >= 25) level = 2;
            if (score >= 60) level = 3;
            if (score >= 120) level = 4;
        }

        html += `<div class="heatmap-cell" data-level="${level}" title="${tooltip}"></div>`;
        if (current.getDay() === 6) html += `</div>`;
        current.setDate(current.getDate() + 1);
    }
    if (current.getDay() !== 0) html += `</div>`;
    container.innerHTML = html;
    container.scrollLeft = container.scrollWidth;
}

function renderMentalLatencyText() {
    const statsText = document.getElementById('stats-text');
    const stats = mathEngine.getMultiplierStats();
    if (!stats.length) {
        statsText.textContent = 'Nessuna sessione Mental Math registrata.';
        return;
    }
    statsText.textContent = stats
        .map((item, idx) => `${idx + 1}. Moltiplicatore [${item[0]}] -> ${(item[1] / 1000).toFixed(2)} s`)
        .join('
');
}

function renderSpectrumRadarAndTable() {
    const scope = document.getElementById('radar-scope-select').value;
    const { topicRows, coreSummary } = problemEngine.getSpectrumAnalytics();

    // Popola Tabella Granulare dello Spettro
    const tbody = document.getElementById('spectrum-table-body');
    tbody.innerHTML = topicRows.map(r => {
        const statusTag = r.masteryPct >= 70 ? 'FORTE' : (r.masteryPct >= 45 ? 'STABILE' : 'LACUNA');
        return `
            <tr>
                <td><strong>${r.core}</strong> &gt; ${r.course}</td>
                <td>${r.topic}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="width:36px;">${r.masteryPct}%</span>
                        <div class="mastery-bar-bg"><div class="mastery-bar-fill" style="width:${r.masteryPct}%;"></div></div>
                    </div>
                </td>
                <td>${r.solved}/${r.total} (Saltati: ${r.skipped})</td>
                <td>${statusTag}</td>
            </tr>
        `;
    }).join('');

    // Configura dati per Radar Chart
    let labels = [];
    let values = [];

    if (scope === 'CORES') {
        labels = coreSummary.map(c => c.core.toUpperCase());
        values = coreSummary.map(c => c.masteryPct);
    } else if (scope === 'ALL_TOPICS') {
        labels = topicRows.map(t => t.topic);
        values = topicRows.map(t => t.masteryPct);
    } else {
        const filtered = topicRows.filter(t => t.core.toUpperCase() === scope);
        labels = filtered.map(t => `${t.course}: ${t.topic}`);
        values = filtered.map(t => t.masteryPct);
    }

    // Il Radar Chart richiede almeno 3 assi per una geometria chiusa leggibile
    while (labels.length > 0 && labels.length < 3) {
        labels.push('—');
        values.push(50);
    }

    const ctx = document.getElementById('chart-radar');
    if (radarChartInstance) radarChartInstance.destroy();
    if (typeof Chart === 'undefined') return;

    radarChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels,
            datasets: [{
                label: 'Padronanza EMA (%)',
                data: values,
                backgroundColor: 'rgba(255, 255, 255, 0.14)',
                borderColor: '#ffffff',
                pointBackgroundColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    min: 0,
                    max: 100,
                    angleLines: { color: '#333333' },
                    grid: { color: '#262626' },
                    pointLabels: { color: '#cccccc', font: { family: 'monospace', size: 11 } },
                    ticks: { backdropColor: 'transparent', color: '#777777', stepSize: 25 }
                }
            },
            plugins: {
                legend: { labels: { color: '#ffffff', font: { family: 'monospace' } } }
            }
        }
    });
}

function renderTimelineCharts(mData) {
    if (typeof Chart === 'undefined') return;

    // 1. Serie Temporale Problemi (Volume & Difficoltà Media Percepite)
    const pHist = problemEngine.state.dailyHistory;
    const pDates = Object.keys(pHist).sort();
    const todayISO = problemEngine.getTodayISO();
    const labelsProb = pDates.length ? pDates : [todayISO];
    const probCounts = labelsProb.map(d => pHist[d]?.count || 0);
    const probAvgDiff = labelsProb.map(d => {
        const item = pHist[d];
        return item && item.count > 0 ? Number((item.sumSlider / item.count).toFixed(2)) : null;
    });

    const ctxProb = document.getElementById('chart-prob-timeline');
    if (probTimelineChartInstance) probTimelineChartInstance.destroy();
    probTimelineChartInstance = new Chart(ctxProb, {
        type: 'bar',
        data: {
            labels: labelsProb,
            datasets: [
                {
                    type: 'bar',
                    label: 'Problemi Risolti',
                    data: probCounts,
                    backgroundColor: '#ffffff',
                    yAxisID: 'y'
                },
                {
                    type: 'line',
                    label: 'Slider Difficoltà Media [0-1]',
                    data: probAvgDiff,
                    borderColor: '#888888',
                    borderDash: [4, 4],
                    borderWidth: 2,
                    yAxisID: 'y1',
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#222' }, ticks: { color: '#aaa' } },
                y1: { min: 0, max: 1, position: 'right', grid: { display: false }, ticks: { color: '#888' } },
                x: { grid: { display: false }, ticks: { color: '#aaa' } }
            },
            plugins: {
                legend: { labels: { color: '#fff', font: { family: 'monospace' } } }
            }
        }
    });

    // 2. Serie Temporale Mental Math (Latenza EMA)
    const ctxLat = document.getElementById('chart-mental-latency');
    if (mentalLatencyChartInstance) mentalLatencyChartInstance.destroy();
    mentalLatencyChartInstance = new Chart(ctxLat, {
        type: 'line',
        data: {
            labels: mData.labels,
            datasets: mData.latencyDatasets.length ? mData.latencyDatasets : [{
                label: 'Latenza (s)',
                data: [0],
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#222' }, ticks: { color: '#aaa' } },
                x: { grid: { color: '#222' }, ticks: { color: '#aaa' } }
            },
            plugins: {
                legend: { labels: { color: '#fff', font: { family: 'monospace' } } }
            }
        }
    });
}

// --- VISTA 4: GITHUB GIST SYNC & BACKUP LOCALE ---
function setupSyncUI() {
    const tokenInput = document.getElementById('gist-token');
    const idInput = document.getElementById('gist-id');
    const logEl = document.getElementById('sync-log');

    const cfg = gistSync.getConfig();
    tokenInput.value = cfg.token || '';
    idInput.value = cfg.gistId || '';
    if (cfg.lastSync) {
        logEl.textContent = `Ultimo stato registrato: ${cfg.lastSync}`;
    }

    document.getElementById('btn-save-gist-cfg').addEventListener('click', () => {
        gistSync.saveConfig(tokenInput.value, idInput.value);
        logEl.textContent = `[OK] Configurazione Gist salvata in localStorage (${new Date().toLocaleTimeString()}).`;
    });

    document.getElementById('btn-gist-push').addEventListener('click', async () => {
        gistSync.saveConfig(tokenInput.value, idInput.value);
        logEl.textContent = 'PUSH su GitHub Gist in corso...';
        try {
            const stamp = await gistSync.pushToGist();
            logEl.textContent = `[SUCCESSO] Stato sincronizzato sul cloud (${stamp}).`;
        } catch (err) {
            logEl.textContent = `[ERRORE PUSH] ${err.message}`;
        }
    });

    document.getElementById('btn-gist-pull').addEventListener('click', async () => {
        gistSync.saveConfig(tokenInput.value, idInput.value);
        logEl.textContent = 'PULL da GitHub Gist in corso...';
        try {
            const stamp = await gistSync.pullFromGist();
            problemEngine.state = problemEngine.loadState();
            mathEngine.reloadFromStorage();
            renderCurrentProblem(false);
            updateTopStreakPills();
            logEl.textContent = `[SUCCESSO] Dati importati dal Gist (${stamp}).`;
        } catch (err) {
            logEl.textContent = `[ERRORE PULL] ${err.message}`;
        }
    });

    document.getElementById('btn-export-json').addEventListener('click', () => {
        const payload = gistSync.collectLocalPayload();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `math_hub_backup_${problemEngine.getTodayISO()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        logEl.textContent = '[OK] Backup JSON esportato localmente.';
    });

    const fileInput = document.getElementById('import-json-file');
    document.getElementById('btn-import-json').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                gistSync.applyRemotePayload(data);
                problemEngine.state = problemEngine.loadState();
                mathEngine.reloadFromStorage();
                renderCurrentProblem(false);
                updateTopStreakPills();
                logEl.textContent = '[OK] Backup JSON importato con successo.';
            } catch (err) {
                logEl.textContent = `[ERRORE IMPORTAZIONE] ${err.message}`;
            }
        };
        reader.readAsText(file);
    });
}
