import { courseData } from './courses.js';
import { calculateCarries } from './mathEngine.js';

// --- GESTIONE DELLO STATO DELLA SPA ---
const views = ['view-main', 'view-theory-dash', 'view-lesson', 'view-practice-setup', 'view-game'];
let activeLessonId = null; 

// --- RENDERIZZAZIONE DINAMICA DELLA UI ---
function renderTheoryDashboard() {
    const container = document.getElementById('theory-modules-container');
    container.innerHTML = ''; // Svuota il contenitore

    // 1. Raggruppa i dati per Capitolo
    const chapters = {};
    for (const [id, data] of Object.entries(courseData)) {
        if (!chapters[data.chapter]) chapters[data.chapter] = [];
        chapters[data.chapter].push({ id, ...data });
    }

    // 2. Genera i nodi DOM in base al raggruppamento
    for (const [chapterName, modules] of Object.entries(chapters)) {
        const groupDiv = document.createElement('div');
        // Intestazione del capitolo
        groupDiv.innerHTML = `<div style="color: #888; margin: 20px 0 10px 0; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 5px;">${chapterName.toUpperCase()}</div>`;

        // Generazione bottoni moduli
        modules.forEach(mod => {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.style.width = '100%';
            btn.style.marginBottom = '8px';
            btn.textContent = mod.title;
            
            // Assegnazione dell'evento listener diretta (elimina il debito tecnico dell'onclick HTML)
            btn.addEventListener('click', () => loadLesson(mod.id));
            
            groupDiv.appendChild(btn);
        });
        container.appendChild(groupDiv);
    }
}

// Chiama la funzione all'avvio dell'applicazione
renderTheoryDashboard();

// Funzione di routing: spegne tutte le viste e accende quella target
function switchView(targetViewId) {
    views.forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(targetViewId).classList.remove('hidden');
    
    // Auto-focus per la UX se entriamo in game
    if(targetViewId === 'view-game') {
        document.getElementById('answer-input').focus();
    }
}

// Navigazione Menu Principale
document.getElementById('nav-to-theory').addEventListener('click', () => switchView('view-theory-dash'));
document.getElementById('nav-to-practice').addEventListener('click', () => switchView('view-practice-setup'));

// Navigazione Teoria -> Lezione
function loadLesson(lessonId) {
    activeLessonId = lessonId;
    const lesson = courseData[lessonId];
    
    document.getElementById('lesson-content').innerHTML = lesson.html;
    switchView('view-lesson');
}

// --- CONFIGURAZIONE MOTORE E AVVIO ---
let engineConfig = { min: 0, max: 0, multiplier: 0, mode: 'LTR', maxCarries: 0 };
let currentTarget = 0, currentTargetStr = "";

// Caching Nodi Motore
const multiplicandDisplay = document.getElementById('multiplicand');
const multiplierDisplay = document.getElementById('multiplier');
const answerInput = document.getElementById('answer-input');

// Avvio dalla Pratica Libera (Acquisisce i dati dai form)
document.getElementById('btn-start-free-practice').addEventListener('click', () => {
    engineConfig.min = parseInt(document.getElementById('config-min').value, 10) || 10;
    engineConfig.max = parseInt(document.getElementById('config-max').value, 10) || 99;
    engineConfig.multiplier = parseInt(document.getElementById('config-mult').value, 10) || 11;
    engineConfig.mode = document.getElementById('config-mode').value;
    engineConfig.maxCarries = 99; // Pratica libera: no filtri didattici
    
    switchView('view-game');
    generateOperation();
});

// Avvio dalla Lezione (Acquisisce i dati dal JSON locale bypassando il form)
document.getElementById('btn-start-lesson-practice').addEventListener('click', () => {
    if(!activeLessonId) return;
    const preset = courseData[activeLessonId].practicePreset;
    
    // Sovrascrive la config con il preset didattico forzato
    engineConfig = { ...preset }; 
    
    switchView('view-game');
    generateOperation();
});

// Uscita dal Gioco (Torna al menu principale e pulisce il buffer)
document.getElementById('btn-exit-game').addEventListener('click', () => {
    answerInput.value = '';
    switchView('view-main');
});

// --- LOGICA DEL MOTORE DI CALCOLO PATCHATA ---
function calculateCarries11(numStr) {
    let carries = 0;
    for (let i = numStr.length - 1; i > 0; i--) {
        if (parseInt(numStr[i]) + parseInt(numStr[i-1]) >= 10) carries++;
    }
    return carries;
}

function generateOperation() {
    const { min, max, multiplier, maxCarries, engineRule } = engineConfig;
    let a, cCarries, failsafe = 0;

    do {
        a = Math.floor(Math.random() * (max - min + 1)) + min;
        
        // Iniezione diretta: delega al Pattern Strategy in mathEngine.js
        cCarries = calculateCarries(multiplier, a.toString());
        
        failsafe++;
        if (failsafe > 150) {
            console.warn("Timeout generazione: impossibile soddisfare i vincoli imposti sui riporti.");
            break; 
        }
    } while (cCarries > maxCarries && engineRule !== 'DIRECT');
    
    currentTarget = a * multiplier;
    currentTargetStr = currentTarget.toString();
    
    multiplicandDisplay.textContent = a;
    multiplierDisplay.textContent = ` * ${multiplier}`;
    answerInput.value = '';
    answerInput.focus();
}

function handleInvalidInput() {
    answerInput.classList.add('error-flash');
    setTimeout(() => {
        answerInput.value = '';
        answerInput.classList.remove('error-flash');
    }, 150);
}

// Event Loop Tastiera
answerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
        e.preventDefault(); 
        if (engineConfig.mode === 'RTL') {
            answerInput.value = answerInput.value.slice(1);
            answerInput.setSelectionRange(0, 0);
        } else {
            answerInput.value = answerInput.value.slice(0, -1);
        }
        return;
    }

    if (!/^\d$/.test(e.key)) { e.preventDefault(); return; }

    e.preventDefault();
    if (engineConfig.mode === 'RTL') {
        answerInput.value = e.key + answerInput.value;
        answerInput.setSelectionRange(0, 0);
    } else {
        answerInput.value = answerInput.value + e.key;
    }

    const currentBuffer = answerInput.value;
    if (currentBuffer === currentTargetStr) {
        generateOperation();
    } else if (currentBuffer.length >= currentTargetStr.length) {
        handleInvalidInput();
    }
});

// Forza Focus
document.addEventListener('click', (e) => {
    const gameView = document.getElementById('view-game');
    if (!gameView.classList.contains('hidden') && e.target.tagName !== 'BUTTON') {
        answerInput.focus();
    }
});

// --- BRIDGE PER GLI INLINE HANDLER HTML ---
// Forza l'esposizione delle funzioni di routing nello scope globale
window.switchView = switchView;
window.loadLesson = loadLesson;