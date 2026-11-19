// MATH-HUB // MAIN APPLICATION CONTROLLER
import { ProblemEngine } from './problemEngine.js';
import { MathEngine } from './mathEngine.js';
import { GistSync } from './gistSync.js';

const problemEngine = new ProblemEngine();
const mathEngine = new MathEngine();
const gistSync = new GistSync();

let currentProblemObj = null;

// Stato UI Mental Math
let currentOperation = null, mentalTimerInterval = null, mentalTimeLeft = 0;
let mentalScore = 0, opStartTime = 0, currentErrors = 0, sessionStats = [];
let probTimelineChartInstance = null, mentalLatencyChartInstance = null;

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
    const slider = document.getElementById('diff-slider');
    const btnNext = document.getElementById('btn-next');
    const btnBack = document.getElementById('btn-back-courses');

    btnDone.addEventListener('click', () => {
        stageSolve.classList.add('hidden');
        stageRate.classList.remove('hidden');
        slider.value = '0.50'; 
        slider.focus();
    });

    btnNext.addEventListener('click', () => {
        if (!currentProblemObj) return;
        const val = parseFloat(slider.value);
        problemEngine.submitEvaluation(currentProblemObj.id, val); 
        updateTopStreakPills();
        renderCurrentProblem(true);
    });

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
    // IL FIX È QUI: forza l'interfaccia a mostrare l'area di lavoro ed eliminare la tendina dei corsi
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
            btn.addEventListener('click', () => {
                const c = presets[name];
                document.getElementById('config-digits').value = c.digits;
                document.getElementById('config-mult').value = c.mult;
                document.getElementById('config-mult-type').value = c.multType;
                document.getElementById('config-time').value = c.time;
            });
            container.appendChild(btn);
        });
    }

    loadPresetsUI();

    document.getElementById('btn-start-session').addEventListener('click', () => {
        const digits = document.getElementById('config-digits').value.trim() || '2';
        const mult = document.getElementById('config-mult').value.trim() || '11';
        const multType = document.getElementById('config-mult-type').value;
        const timeValue = parseInt(document.getElementById('config-time').value, 10) || 60;

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
function setupDashboardUI() {
    // Inizializzazione della Dashboard (puoi aggiungere listener qui se necessario)
}

function refreshDashboard() {
    const pStreak = problemEngine.getStreakData();
    const mData = mathEngine.getStreakAndDashboardData();
    
    document.getElementById('kpi-prob-streak').textContent = `${pStreak.current} GG`;
    const masteryPct = problemEngine.state.globalEmaMastery ? Math.round(problemEngine.state.globalEmaMastery * 100) : 50;
    document.getElementById('kpi-global-mastery').textContent = `${masteryPct}%`;

    if (typeof Chart === 'undefined') return;

    // Timeline Problemi
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
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#888' } },
                x: { grid: { display: false }, ticks: { color: '#888' } }
            },
            plugins: { legend: { display: false } }
        }
    });

    // Latenza Mental Math
    const ctxLat = document.getElementById('chart-mental-latency');
    if (mentalLatencyChartInstance) mentalLatencyChartInstance.destroy();
    mentalLatencyChartInstance = new Chart(ctxLat, {
        type: 'line',
        data: {
            labels: mData.labels,
            datasets: mData.latencyDatasets.length ? mData.latencyDatasets : [{
                label: 'Latenza (s)', data: [0], borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#888' } },
                x: { grid: { color: '#333' }, ticks: { color: '#888' } }
            },
            plugins: { legend: { labels: { color: '#fff', font: { family: 'monospace' } } } }
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