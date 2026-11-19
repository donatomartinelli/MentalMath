// MATH-HUB // MAIN APPLICATION CONTROLLER
import { ProblemEngine } from './problemEngine.js';
import { MathEngine } from './mathEngine.js';
import { GistSync } from './gistSync.js';

const problemEngine = new ProblemEngine();
const mathEngine = new MathEngine();
const gistSync = new GistSync();

let currentProblemObj = null;
let problemTimerInterval = null;

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

// --- PROBLEMI (NO FILTRI, FLUSSO CONTINUO) ---
// Aggiungi queste logiche nel tuo file app.js dentro la funzione setupProblemSolvingUI()

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

    // Tasto ESCI per tornare alla selezione del corso
    btnBack.addEventListener('click', () => {
        problemEngine.setActiveCourse(null);
        renderCourseSelection();
    });

    // Scegli cosa renderizzare all'avvio
    if (problemEngine.state.activeCourse) {
        renderCurrentProblem(false);
    } else {
        renderCourseSelection();
    }
}

// Nuova funzione per disegnare i corsi stile Duolingo
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
        btn.className = 'btn';
        btn.style.textAlign = 'left';
        btn.style.display = 'flex';
        btn.style.flexDirection = 'column';
        btn.style.gap = '5px';
        btn.style.border = '1px solid var(--fg-muted)';
        
        btn.innerHTML = `
            <span>[ ${course.toUpperCase()} ]</span>
            <span style="font-size:0.75rem; color:var(--fg-muted);">${prog.str}</span>
        `;
        
        btn.addEventListener('click', () => {
            problemEngine.setActiveCourse(course);
            document.getElementById('course-selection').classList.add('hidden');
            document.getElementById('problem-solving-area').classList.remove('hidden');
            renderCurrentProblem(true); // Genera il primo problema di quel corso
        });
        
        listEl.appendChild(btn);
    });
}

function renderCurrentProblem(forceNew = false) {
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


// --- MENTAL MATH E ALTRE FUNZIONI INVARIATE (Ma rimosso codice obsoleto) ---
// (Puoi incollare qui le tue funzioni setupMentalMathUI, setupDashboardUI e setupSyncUI mantenendone la logica come ti ho sistemato nell'HTML pulito)

function setupMentalMathUI() { /* Identica logica del tuo file originario */ }
function setupDashboardUI() { /* Identica logica, rimuovi solo riferimenti a tabelle o dropdown inesistenti */ }
function refreshDashboard() { /* Disegna i due chart line/bar */ }
function setupSyncUI() { /* Identica logica Gist */ }