import { MathEngine } from './mathEngine.js';

const engine = new MathEngine();
let currentOperation = null;

let timerInterval = null;
let currentScore = 0;
let timeLeft = 0;

let opStartTime = 0;
let currentErrors = 0;
let sessionStats = [];

let latencyChartInstance = null; 
let volumeChartInstance = null;

const multiplicandDisplay = document.getElementById('multiplicand');
const multiplierDisplay = document.getElementById('multiplier');
const answerInput = document.getElementById('answer-input');

const views = ['view-practice-setup', 'view-dashboard', 'view-game'];

function switchView(targetId) {
    views.forEach(v => document.getElementById(v).classList.add('hidden'));
    document.getElementById(targetId).classList.remove('hidden');
    if (targetId === 'view-game') answerInput.focus();
}

// --- GESTIONE PRESETS ---
function loadPresetsUI() {
    const container = document.getElementById('presets-container');
    container.innerHTML = '';
    const presets = engine.getPresets();
    
    // Genera pulsanti dei preset salvati
    Object.keys(presets).forEach(name => {
        const btn = document.createElement('div');
        btn.className = 'preset-chip';
        btn.textContent = name;
        btn.addEventListener('click', () => applyPreset(presets[name]));
        container.appendChild(btn);
    });

    // Costruisce l'input testuale per aggirare il blocco di prompt()
    const addContainer = document.createElement('div');
    addContainer.style.display = 'flex';
    addContainer.style.gap = '5px';
    addContainer.style.alignItems = 'center';

    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = 'Nome...';
    addInput.style.width = '90px';
    addInput.style.padding = '4px 8px';
    addInput.style.background = '#222';
    addInput.style.color = '#fff';
    addInput.style.border = '1px solid #444';
    addInput.style.borderRadius = '4px';
    addInput.style.fontFamily = 'monospace';

    const saveBtn = document.createElement('div');
    saveBtn.className = 'preset-chip';
    saveBtn.style.background = '#006d32';
    saveBtn.style.border = '1px solid #0e4429';
    saveBtn.textContent = 'Salva';
    
    saveBtn.addEventListener('click', () => {
        const name = addInput.value.trim();
        if (name) {
            const config = {
                digits: document.getElementById('config-digits').value,
                mult: document.getElementById('config-mult').value,
                multType: document.getElementById('config-mult-type').value,
                time: document.getElementById('config-time').value,
                timeType: document.getElementById('config-time-type').value
            };
            engine.savePreset(name, config);
            loadPresetsUI();
        }
    });

    addContainer.appendChild(addInput);
    addContainer.appendChild(saveBtn);
    container.appendChild(addContainer);
}

function applyPreset(config) {
    document.getElementById('config-digits').value = config.digits;
    document.getElementById('config-mult').value = config.mult;
    document.getElementById('config-mult-type').value = config.multType;
    document.getElementById('config-time').value = config.time;
    document.getElementById('config-time-type').value = config.timeType;
}

loadPresetsUI();

// --- DASHBOARD E HEATMAP ---
function renderHeatmap(data) {
    const container = document.getElementById('heatmap-grid');
    container.innerHTML = '';
    
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const today = new Date(Date.now() - tzoffset);
    
    // Fissa la data di inizio della mappa
    const startDate = new Date("2026-07-05T00:00:00");
    
    // Arretra fino alla domenica della settimana corrente al 05-07-2026
    while(startDate.getDay() !== 0) {
        startDate.setDate(startDate.getDate() - 1);
    }
    
    let html = '';
    let current = new Date(startDate);
    
    while (current <= today) {
        if (current.getDay() === 0) html += `<div class="heatmap-col">`;
        
        const dStr = current.toISOString().split('T')[0];
        const count = data[dStr] || 0;
        
        let level = 0;
        if (count > 0) level = 1;
        if (count >= 20) level = 2;
        if (count >= 50) level = 3;
        if (count >= 100) level = 4;
        
        html += `<div class="heatmap-cell" data-level="${level}" title="${dStr}: ${count} calcoli"></div>`;
        if (current.getDay() === 6) html += `</div>`;
        
        current.setDate(current.getDate() + 1);
    }
    if (current.getDay() !== 0) html += `</div>`; 
    
    container.innerHTML = html;
    container.scrollLeft = container.scrollWidth; // Auto-scroll ai giorni più recenti
}

document.getElementById('btn-dashboard').addEventListener('click', () => {
    switchView('view-dashboard');
    const statsText = document.getElementById('stats-text');
    
    const stats = engine.getMultiplierStats();
    
    if (stats.length === 0) {
        statsText.textContent = "Nessun dato registrato. Completa un allenamento per popolare la dashboard.";
        renderHeatmap({});
        return;
    } 
    
    let text = "";
    stats.forEach((item, index) => {
        text += `${index + 1}. Gruppo [${item[0]}] -> ${(item[1] / 1000).toFixed(2)} s\n`;
    });
    statsText.textContent = text;

    const data = engine.getDashboardData();
    if (!data) return;

    renderHeatmap(data.heatmapData);

    const zoomOptions = {
        zoom: {
            wheel: { enabled: true, modifierKey: 'ctrl' }, 
            pinch: { enabled: true },
            mode: 'x',
        },
        pan: { enabled: true, mode: 'x' }
    };

    if (typeof Chart !== 'undefined') {
        const ctxVol = document.getElementById('chart-volume');
        if (volumeChartInstance) volumeChartInstance.destroy();
        volumeChartInstance = new Chart(ctxVol, {
            type: 'bar',
            data: { labels: data.labels, datasets: [data.volumeDataset] },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, grid: { color: '#30363d' }, ticks: { color: '#8b949e' } }, x: { grid: { display: false }, ticks: { color: '#8b949e' } } },
                plugins: { legend: { display: false }, zoom: zoomOptions }
            }
        });

        const ctxLat = document.getElementById('chart-latency');
        if (latencyChartInstance) latencyChartInstance.destroy();
        latencyChartInstance = new Chart(ctxLat, {
            type: 'line',
            data: { labels: data.labels, datasets: data.latencyDatasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, grid: { color: '#30363d' }, ticks: { color: '#8b949e' } }, x: { grid: { color: '#30363d' }, ticks: { color: '#8b949e' } } },
                plugins: { legend: { labels: { color: '#d4d4d4', font: { family: 'monospace' }, boxWidth: 12 } }, zoom: zoomOptions }
            }
        });
    }
});

document.getElementById('btn-back-setup').addEventListener('click', () => switchView('view-practice-setup'));

// --- LOGICA DI GIOCO ---
document.getElementById('btn-exit-game').addEventListener('click', () => {
    clearInterval(timerInterval);
    answerInput.value = '';
    answerInput.disabled = false; 
    switchView('view-practice-setup');
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
    
    engine.updateConfig({ digits, mult, multType });
    answerInput.disabled = false;
    
    clearInterval(timerInterval);
    timerInterval = setInterval(timerTick, 1000);
    
    switchView('view-game');
    renderNewOperation();
});

function timerTick() {
    timeLeft--;
    if (timeLeft <= 0) endSession();
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

    if (e.key === 'Backspace') answerInput.value = answerInput.value.slice(1);
    else if (/^\d$/.test(e.key)) answerInput.value = e.key + answerInput.value;
    else return; 
    
    answerInput.setSelectionRange(0, 0);
    if (!currentOperation) return;
    
    const validation = engine.validateInput(answerInput.value, currentOperation.targetStr);
    
    if (validation.status === 'CORRECT') {
        const timeTaken = performance.now() - opStartTime;
        sessionStats.push({ 
            key: currentOperation.key, 
            multiplicand: currentOperation.rawMultiplicand,
            time: timeTaken, 
            errors: currentErrors 
        });
        currentScore++; 
        renderNewOperation();
    } else if (validation.status === 'ERROR') {
        handleInvalidInput();
    }
});

document.addEventListener('click', (e) => {
    if (!document.getElementById('view-game').classList.contains('hidden') && e.target.tagName !== 'BUTTON' && !answerInput.disabled) {
        answerInput.focus();
    }
});