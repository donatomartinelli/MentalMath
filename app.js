import { MathEngine } from './mathEngine.js';

const engine = new MathEngine();
let currentOperation = null;

let timerInterval = null;
let currentScore = 0;
let timeLeft = 0;

let opStartTime = 0;
let currentErrors = 0;
let sessionStats = [];

const multiplicandDisplay = document.getElementById('multiplicand');
const multiplierDisplay = document.getElementById('multiplier');
const answerInput = document.getElementById('answer-input');
const hudTime = document.getElementById('hud-time');
const hudScore = document.getElementById('hud-score');

const viewSetup = document.getElementById('view-practice-setup');
const viewGame = document.getElementById('view-game');
const statsOutput = document.getElementById('stats-output');

function switchView(toGame) {
    if (toGame) {
        viewSetup.classList.add('hidden');
        viewGame.classList.remove('hidden');
        answerInput.focus();
    } else {
        viewGame.classList.add('hidden');
        viewSetup.classList.remove('hidden');
    }
}

document.getElementById('btn-reset-weights').addEventListener('click', () => {
    engine.resetWeights();
    statsOutput.classList.remove('hidden');
    statsOutput.style.color = '#4a4';
    statsOutput.textContent = "Pesi resettati con successo. Tutti i calcoli sono tornati allo stato iniziale (1000ms).";
});

document.getElementById('btn-top-weights').addEventListener('click', () => {
    const top = engine.getTopWeights();
    statsOutput.classList.remove('hidden');
    statsOutput.style.color = '#aaa';
    
    if (top.length === 0) {
        statsOutput.textContent = "Nessun dato alterato trovato.\nTutti i pesi sono allo stato iniziale (1000ms).";
    } else {
        let text = "TOP 10 OPERAZIONI PIÙ LENTE:\n\n";
        top.forEach((item, index) => {
            const [a, b] = item[0].split('_');
            text += `${index + 1}. ${a} * ${b} = ${Math.round(item[1])} ms\n`;
        });
        statsOutput.textContent = text;
    }
});

document.getElementById('btn-exit-game').addEventListener('click', () => {
    clearInterval(timerInterval);
    answerInput.value = '';
    answerInput.disabled = false; 
    switchView(false);
});

document.getElementById('btn-start-session').addEventListener('click', () => {
    const digits = document.getElementById('config-digits').value.trim() || '2';
    const mult = document.getElementById('config-mult').value.trim() || '11';
    const multType = document.getElementById('config-mult-type').value;
    
    const timeValue = parseInt(document.getElementById('config-time').value, 10) || 60;
    const timeType = document.getElementById('config-time-type').value;
    
    timeLeft = timeType === 'm' ? timeValue * 60 : timeValue;
    
    currentScore = 0;
    sessionStats = [];
    statsOutput.classList.add('hidden');
    engine.updateConfig({ digits, mult, multType });
    
    updateHUD();
    answerInput.disabled = false;
    
    clearInterval(timerInterval);
    timerInterval = setInterval(timerTick, 1000);
    
    switchView(true);
    renderNewOperation();
});

function timerTick() {
    timeLeft--;
    updateHUD();
    if (timeLeft <= 0) {
        endSession();
    }
}

function updateHUD() {
    hudTime.textContent = timeLeft;
    hudScore.textContent = currentScore;
}

function endSession() {
    clearInterval(timerInterval);
    answerInput.disabled = true;
    multiplicandDisplay.textContent = "STOP";
    multiplierDisplay.textContent = "";
    answerInput.value = `Punti: ${currentScore}`;
    
    engine.updateWeights(sessionStats);
}

function renderNewOperation() {
    currentOperation = engine.generateOperation();
    multiplicandDisplay.textContent = currentOperation.multiplicand;
    multiplierDisplay.textContent = ` * ${currentOperation.multiplier}`;
    answerInput.value = '';
    
    opStartTime = performance.now();
    currentErrors = 0;
    
    answerInput.focus();
}

function handleInvalidInput() {
    currentErrors++; 
    answerInput.classList.add('error-flash');
    setTimeout(() => {
        answerInput.value = '';
        answerInput.classList.remove('error-flash');
    }, 150);
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
    
    const validation = engine.validateInput(answerInput.value, currentOperation.targetStr);
    
    if (validation.status === 'CORRECT') {
        const timeTaken = performance.now() - opStartTime;
        sessionStats.push({ 
            key: currentOperation.key, 
            time: timeTaken, 
            errors: currentErrors 
        });
        
        currentScore++; 
        updateHUD();    
        renderNewOperation();
    } else if (validation.status === 'ERROR') {
        handleInvalidInput();
    }
});

document.addEventListener('click', (e) => {
    if (!viewGame.classList.contains('hidden') && e.target.tagName !== 'BUTTON' && !answerInput.disabled) {
        answerInput.focus();
    }
});