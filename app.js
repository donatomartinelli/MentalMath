import { MathEngine } from './mathEngine.js';

const engine = new MathEngine();

const state = {
    currentOperation: null,
    timerInterval: null,
    currentScore: 0,
    timeLeft: 0,
    opStartTime: 0,
    currentErrors: 0,
    sessionStats: [],
    charts: { latency: null, volume: null },
    isShowingSolution: false
};

const DOM = {
    multiplicand: document.getElementById('multiplicand'),
    multiplier: document.getElementById('multiplier'),
    answerInput: document.getElementById('answer-input'),
    views: {
        setup: document.getElementById('view-practice-setup'),
        dashboard: document.getElementById('view-dashboard'),
        game: document.getElementById('view-game')
    },
    configs: {
        digits: document.getElementById('config-digits'),
        mult: document.getElementById('config-mult'),
        multType: document.getElementById('config-mult-type'),
        time: document.getElementById('config-time'),
        timeType: document.getElementById('config-time-type')
    },
    dashboard: {
        presets: document.getElementById('presets-container'),
        heatmap: document.getElementById('heatmap-grid'),
        stats: document.getElementById('stats-text'),
        streakCurrent: document.getElementById('current-streak'),
        streakBest: document.getElementById('best-streak')
    },
    game: {
        btnHint: document.getElementById('btn-hint'),
        btnSol: document.getElementById('btn-solution'),
        hintDisplay: document.getElementById('hint-display')
    },
    modal: {
        overlay: document.getElementById('info-modal'),
        text: document.getElementById('info-modal-text'),
        closeBtn: document.getElementById('btn-close-modal')
    }
};

const switchView = (targetId) => {
    Object.values(DOM.views).forEach(v => v.classList.add('hidden'));
    document.getElementById(targetId).classList.remove('hidden');
    if (targetId === 'view-game') DOM.answerInput.focus();
};

const loadPresetsUI = () => {
    DOM.dashboard.presets.innerHTML = '';
    Object.entries(engine.getPresets()).forEach(([name, config]) => {
        const btn = document.createElement('div');
        btn.className = 'preset-chip';
        btn.textContent = name;
        btn.onclick = () => applyPreset(config);
        DOM.dashboard.presets.appendChild(btn);
    });

    DOM.dashboard.presets.insertAdjacentHTML('beforeend', `
        <div style="display: flex; gap: 5px; align-items: center;">
            <input type="text" id="new-preset-name" class="preset-input" placeholder="Nome...">
            <div id="btn-save-preset" class="preset-chip" style="background: #222; border-color: #555;">Salva</div>
        </div>
    `);

    document.getElementById('btn-save-preset').onclick = () => {
        const name = document.getElementById('new-preset-name').value.trim();
        if (name) {
            engine.savePreset(name, {
                digits: DOM.configs.digits.value,
                mult: DOM.configs.mult.value,
                multType: DOM.configs.multType.value,
                time: DOM.configs.time.value,
                timeType: DOM.configs.timeType.value
            });
            loadPresetsUI();
        }
    };
};

const applyPreset = (config) => {
    Object.keys(config).forEach(key => { if (DOM.configs[key]) DOM.configs[key].value = config[key]; });
};

loadPresetsUI();

// --- GESTIONE MODALE INFO ---
document.querySelectorAll('.info-icon').forEach(icon => {
    icon.addEventListener('click', () => {
        DOM.modal.text.textContent = icon.getAttribute('data-info');
        DOM.modal.overlay.classList.add('active');
    });
});

DOM.modal.closeBtn.onclick = () => DOM.modal.overlay.classList.remove('active');
DOM.modal.overlay.onclick = (e) => {
    if (e.target === DOM.modal.overlay) DOM.modal.overlay.classList.remove('active');
};

// --- DASHBOARD E HEATMAP ---
const renderHeatmap = (data) => {
    DOM.dashboard.heatmap.innerHTML = '';
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    const startDate = new Date("2026-07-05T00:00:00");
    startDate.setDate(startDate.getDate() - startDate.getDay()); 
    
    let html = '';
    for (let current = new Date(startDate); current <= today; current.setDate(current.getDate() + 1)) {
        if (current.getDay() === 0) html += `<div class="heatmap-col">`;
        const dStr = current.toISOString().split('T')[0];
        const count = data[dStr] || 0;
        const level = count >= 100 ? 4 : count >= 50 ? 3 : count >= 20 ? 2 : count > 0 ? 1 : 0;
        
        html += `<div class="heatmap-cell" data-level="${level}" title="${dStr}: ${count} calcoli"></div>`;
        if (current.getDay() === 6) html += `</div>`;
    }
    html += `</div>`; 
    DOM.dashboard.heatmap.innerHTML = html;
    DOM.dashboard.heatmap.scrollLeft = DOM.dashboard.heatmap.scrollWidth;
};

document.getElementById('btn-dashboard').onclick = () => {
    switchView('view-dashboard');
    const stats = engine.getMultiplierStats();
    
    if (!stats.length) {
        DOM.dashboard.stats.textContent = "Nessun dato. Inizia un allenamento.";
        renderHeatmap({});
        return;
    } 
    DOM.dashboard.stats.textContent = stats.map((item, i) => `${i + 1}. [${item[0]}] -> ${(item[1] / 1000).toFixed(2)}s`).join('\n');

    const data = engine.getDashboardData();
    if (!data) return;
    
    renderHeatmap(data.heatmapData);
    
    DOM.dashboard.streakCurrent.textContent = `${data.streaks.current} 🔥`;
    DOM.dashboard.streakBest.textContent = `${data.streaks.best} 🏆`;

    const zoomOptions = {
        pan: { enabled: true, mode: 'x', modifierKey: null }, 
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
    };

    if (typeof Chart !== 'undefined') {
        state.charts.volume?.destroy();
        state.charts.volume = new Chart(document.getElementById('chart-volume'), {
            type: 'bar',
            data: { labels: data.labels, datasets: [data.volumeMADataset, data.volumeDataset] },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                interaction: { mode: 'index', intersect: false },
                scales: { y: { beginAtZero: true, grid: { color: '#30363d' } }, x: { grid: { display: false } } }, 
                plugins: { legend: { labels: { color: '#d4d4d4', font: {family:'monospace'} } }, zoom: zoomOptions } 
            }
        });

        state.charts.latency?.destroy();
        state.charts.latency = new Chart(document.getElementById('chart-latency'), {
            type: 'line',
            data: { labels: data.labels, datasets: data.latencyDatasets },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                scales: { y: { beginAtZero: true, grid: { color: '#30363d' } }, x: { grid: { color: '#30363d' } } }, 
                plugins: { legend: { labels: { color: '#d4d4d4', font: { family: 'monospace' } } }, zoom: zoomOptions } 
            }
        });
    }
};

document.getElementById('btn-back-setup').onclick = () => switchView('view-practice-setup');

// --- LOGICA DI GIOCO ---
const endSession = () => {
    clearInterval(state.timerInterval);
    DOM.answerInput.disabled = true;
    DOM.multiplicand.textContent = "STOP";
    DOM.multiplier.textContent = "";
    DOM.answerInput.value = `Punti: ${state.currentScore}`;
    DOM.game.hintDisplay.classList.add('hidden');
    engine.updateWeights(state.sessionStats);
};

const renderNewOperation = () => {
    state.currentOperation = engine.generateOperation();
    DOM.multiplicand.textContent = state.currentOperation.multiplicand;
    DOM.multiplier.textContent = ` * ${state.currentOperation.multiplier}`;
    DOM.answerInput.value = '';
    DOM.answerInput.disabled = false;
    DOM.game.hintDisplay.classList.add('hidden');
    state.isShowingSolution = false;
    
    state.opStartTime = performance.now();
    state.currentErrors = 0;
    DOM.answerInput.focus();
};

document.getElementById('btn-exit-game').onclick = () => {
    clearInterval(state.timerInterval);
    DOM.answerInput.value = '';
    DOM.answerInput.disabled = false; 
    switchView('view-practice-setup');
};

document.getElementById('btn-start-session').onclick = () => {
    const timeValue = parseInt(DOM.configs.time.value, 10) || 60;
    state.timeLeft = DOM.configs.timeType.value === 'm' ? timeValue * 60 : timeValue;
    state.currentScore = 0;
    state.sessionStats = [];
    
    engine.updateConfig({ digits: DOM.configs.digits.value.trim() || '2', mult: DOM.configs.mult.value.trim() || '11', multType: DOM.configs.multType.value });
    
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => { if (--state.timeLeft <= 0) endSession(); }, 1000);
    
    switchView('view-game');
    renderNewOperation();
};

// Hints & Solutions
DOM.game.btnHint.onclick = () => {
    if (!state.currentOperation || state.isShowingSolution) return;
    DOM.game.hintDisplay.textContent = engine.getRuleForMultiplier(state.currentOperation.multiplier);
    DOM.game.hintDisplay.classList.remove('hidden');
    DOM.answerInput.focus();
};

DOM.game.btnSol.onclick = () => {
    if (!state.currentOperation || state.isShowingSolution) return;
    state.isShowingSolution = true;
    DOM.answerInput.value = state.currentOperation.targetStr;
    DOM.answerInput.style.color = '#888'; 
    DOM.answerInput.disabled = true;
    
    setTimeout(() => {
        DOM.answerInput.style.color = '';
        renderNewOperation();
    }, 1500);
};

DOM.answerInput.addEventListener('keydown', (e) => {
    if (DOM.answerInput.disabled || state.isShowingSolution || (e.key.length > 1 && e.key !== 'Backspace')) return; 
    e.preventDefault(); 

    if (e.key === 'Backspace') DOM.answerInput.value = DOM.answerInput.value.slice(1);
    else if (/^\d$/.test(e.key)) DOM.answerInput.value = e.key + DOM.answerInput.value;
    else return; 
    
    // Ripristino della selezione del cursore a sinistra
    DOM.answerInput.setSelectionRange(0, 0);
    
    if (!state.currentOperation) return;
    
    const validation = engine.validateInput(DOM.answerInput.value, state.currentOperation.targetStr);
    
    if (validation.status === 'CORRECT') {
        state.sessionStats.push({ key: state.currentOperation.key, multiplicand: state.currentOperation.rawMultiplicand, time: performance.now() - state.opStartTime, errors: state.currentErrors });
        state.currentScore++; 
        renderNewOperation();
    } else if (validation.status === 'ERROR') {
        state.currentErrors++; 
        DOM.answerInput.classList.add('error-flash');
        setTimeout(() => {
            DOM.answerInput.value = ''; // Ripristino lo svuotamento del campo
            DOM.answerInput.classList.remove('error-flash');
        }, 150);
    }
});

document.addEventListener('click', (e) => {
    if (!DOM.views.game.classList.contains('hidden') && !e.target.closest('button') && !DOM.answerInput.disabled) DOM.answerInput.focus();
});