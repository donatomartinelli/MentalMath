import { MathEngine } from './mathEngine.js';

// Inizializza l'istanza del motore
const engine = new MathEngine();
let currentOperation = null;

// --- GESTIONE DELLO STATO DELLA SPA ---
const views = ['view-main', 'view-practice-setup', 'view-game'];

function switchView(targetViewId) {
    views.forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(targetViewId).classList.remove('hidden');
    
    if(targetViewId === 'view-game') {
        document.getElementById('answer-input').focus();
    }
}

// Caching Nodi
const multiplicandDisplay = document.getElementById('multiplicand');
const multiplierDisplay = document.getElementById('multiplier');
const answerInput = document.getElementById('answer-input');

// --- NAVIGAZIONE ---
document.getElementById('nav-to-practice').addEventListener('click', () => switchView('view-practice-setup'));
document.getElementById('btn-back-main').addEventListener('click', () => switchView('view-main'));

// Uscita dal Gioco
document.getElementById('btn-exit-game').addEventListener('click', () => {
    answerInput.value = '';
    switchView('view-main');
});

// --- AVVIO SESSIONE E GESTIONE UI DEL GIOCO ---
document.getElementById('btn-start-session').addEventListener('click', () => {
    const digits = parseInt(document.getElementById('config-digits').value, 10) || 2;
    const multiplier = parseInt(document.getElementById('config-mult').value, 10) || 11;
    
    engine.updateConfig({ digits, multiplier });
    
    switchView('view-game');
    renderNewOperation();
});

function renderNewOperation() {
    currentOperation = engine.generateOperation();
    
    multiplicandDisplay.textContent = currentOperation.multiplicand;
    multiplierDisplay.textContent = ` * ${currentOperation.multiplier}`;
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

// --- LOGICA INPUT RTL PATCHATA ---
answerInput.addEventListener('keydown', (e) => {
    // 1. Lascia passare nativamente tutti i tasti di sistema (incluso NumLock, Tab, Invio)
    if (e.key.length > 1 && e.key !== 'Backspace') {
        return; 
    }

    // 2. Da qui blocchiamo il comportamento nativo per sovrascriverlo (RTL) o segare le lettere
    e.preventDefault(); 

    if (e.key === 'Backspace') {
        answerInput.value = answerInput.value.slice(1);
    } else if (/^\d$/.test(e.key)) {
        answerInput.value = e.key + answerInput.value;
    } else {
        return; // Era una lettera o un simbolo: ignora e interrompi il ciclo di validazione
    }
    
    // Mantieni il cursore a sinistra per l'effetto RTL visivo
    answerInput.setSelectionRange(0, 0);

    // Valida l'input attuale
    if (!currentOperation) return;
    
    const validation = engine.validateInput(answerInput.value, currentOperation.targetStr);
    
    if (validation.status === 'CORRECT') {
        renderNewOperation();
    } else if (validation.status === 'ERROR') {
        handleInvalidInput();
    }
});

// Forza Focus continuo sull'input quando si è in game
document.addEventListener('click', (e) => {
    const gameView = document.getElementById('view-game');
    if (!gameView.classList.contains('hidden') && e.target.tagName !== 'BUTTON') {
        answerInput.focus();
    }
});