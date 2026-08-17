export class MathEngine {
    constructor(config = { digits: '2', mult: '11', multType: 'literal' }) {
        this.config = config;
        this.weightsKey = 'mentalMathGroupWeights'; 
        this.historyKey = 'mentalMathHistory'; 
        this.presetsKey = 'mentalMathPresets';
        
        this.weights = JSON.parse(localStorage.getItem(this.weightsKey)) ?? {};
        this.history = JSON.parse(localStorage.getItem(this.historyKey)) ?? {};
    }

    updateConfig(newConfig) { this.config = { ...this.config, ...newConfig }; }

    getPresets() { return JSON.parse(localStorage.getItem(this.presetsKey)) ?? { "Riscaldamento": { digits: '2', mult: '11,12', multType: 'literal', time: '60', timeType: 's' } }; }
    
    savePreset(name, presetConfig) {
        const presets = this.getPresets();
        presets[name] = presetConfig;
        localStorage.setItem(this.presetsKey, JSON.stringify(presets));
    }

    parseDigits(inputStr) {
        let [min, max] = inputStr.split('-').map(n => parseInt(n.trim(), 10));
        min = min || 1; max = max || min;
        if (min > max) [min, max] = [max, min];
        return { min: 10 ** (min - 1), max: (10 ** max) - 1 };
    }

    parseLiteralValues(inputStr) {
        const values = new Set();
        inputStr.split(',').forEach(part => {
            if (part.includes('-')) {
                let [min, max] = part.split('-').map(n => parseInt(n.trim(), 10));
                if (!isNaN(min) && !isNaN(max)) {
                    if (min > max) [min, max] = [max, min];
                    for (let i = min; i <= max; i++) values.add(i);
                }
            } else {
                const val = parseInt(part.trim(), 10);
                if (!isNaN(val)) values.add(val);
            }
        });
        return values.size ? Array.from(values) : [11];
    }

    generateOperation() {
        const rangeA = this.parseDigits(this.config.digits);
        let multipliers = this.config.multType === 'digits' 
            ? Array.from({length: this.parseDigits(this.config.mult).max - this.parseDigits(this.config.mult).min + 1}, (_, i) => i + this.parseDigits(this.config.mult).min)
            : this.parseLiteralValues(this.config.mult);

        const pool = multipliers.map(m => ({ multiplier: m, weight: this.weights[m] ?? 1000 }));
        let rand = Math.random() * pool.reduce((sum, item) => sum + item.weight, 0);
        
        let selectedMultiplier = pool[pool.length - 1].multiplier;
        for (const { multiplier, weight } of pool) {
            if ((rand -= weight) <= 0) { selectedMultiplier = multiplier; break; }
        }

        const multiplicand = Math.floor(Math.random() * (rangeA.max - rangeA.min + 1)) + rangeA.min;

        return { multiplicand, multiplier: selectedMultiplier, targetStr: (multiplicand * selectedMultiplier).toString(), key: selectedMultiplier, rawMultiplicand: multiplicand };
    }

    validateInput(inputBuffer, targetStr) {
        if (inputBuffer === targetStr) return { status: 'CORRECT' };
        if (inputBuffer.length >= targetStr.length) return { status: 'ERROR' };
        return { status: 'PENDING' };
    }

    updateWeights(sessionStats) {
        const alpha = 0.3; const penaltyPerError = 800; 
        const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
        this.history[today] ??= {};

        sessionStats.forEach(({ key, time, errors, multiplicand }) => {
            const oldWeight = this.weights[key] ?? 1000;
            const normalizedTime = (time + errors * penaltyPerError) / Math.max(1, multiplicand.toString().length / 2);
            this.weights[key] = (alpha * normalizedTime) + ((1 - alpha) * oldWeight);

            this.history[today][key] ??= { sum: 0, count: 0 };
            this.history[today][key].sum += normalizedTime;
            this.history[today][key].count += 1;
        });
        
        localStorage.setItem(this.weightsKey, JSON.stringify(this.weights));
        localStorage.setItem(this.historyKey, JSON.stringify(this.history));
    }

    getMultiplierStats() { return Object.entries(this.weights).sort(([, a], [, b]) => b - a); }

    // --- REGOLE TRACHTENBERG ---
    getRuleForMultiplier(m) {
        const mult = parseInt(m, 10);
        switch(mult) {
            case 11: return "Regola dell'11: Aggiungi ogni cifra al suo vicino di destra.";
            case 12: return "Regola del 12: Raddoppia ogni cifra e aggiungi il suo vicino di destra.";
            case 6: return "Regola del 6: Aggiungi a ogni cifra la metà del vicino di destra. (+5 se la cifra è dispari).";
            case 7: return "Regola del 7: Raddoppia la cifra, poi aggiungi la metà del vicino. (+5 se dispari).";
            case 5: return "Regola del 5: Prendi metà del vicino di destra. (+5 se la cifra è dispari).";
            case 8: return "Regola dell'8: Sottrai la cifra da 9, raddoppia, aggiungi il vicino. (Ultima da 10, prima -2).";
            case 9: return "Regola del 9: Sottrai la cifra da 9, aggiungi il vicino. (Ultima da 10, prima -1).";
            default: return `Regola generica: Scomponi in fattori o moltiplica usando il metodo tradizionale.`;
        }
    }

    getDashboardData() {
        const datesKeys = Object.keys(this.history).sort();
        if (!datesKeys.length) return null;

        const firstDate = new Date(datesKeys[0]);
        const todayDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
        
        // Crea array contiguo di date includendo i "buchi"
        const continuousDates = [];
        for (let d = new Date(firstDate); d <= todayDate; d.setDate(d.getDate() + 1)) {
            continuousDates.push(d.toISOString().split('T')[0]);
        }

        const heatmapData = {};
        const volumeDataArray = [];
        const multipliers = new Set(datesKeys.flatMap(d => Object.keys(this.history[d])));
        const colors = ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40'];

        const latencyDatasets = Array.from(multipliers).map((mult, i) => ({
            label: `[${mult}]`,
            data: continuousDates.map(date => {
                const dayData = this.history[date]?.[mult];
                return dayData && dayData.count > 0 ? (dayData.sum / dayData.count) / 1000 : null;
            }),
            borderColor: colors[i % colors.length],
            backgroundColor: colors[i % colors.length],
            tension: 0.2,
            spanGaps: true 
        }));

        continuousDates.forEach(date => {
            const dailyTotal = this.history[date] ? Object.values(this.history[date]).reduce((sum, d) => sum + d.count, 0) : 0;
            volumeDataArray.push(dailyTotal);
            heatmapData[date] = dailyTotal;
        });

        // Calcolo Media Mobile a 7 giorni per il Volume
        const windowSize = 7;
        const volumeMA = volumeDataArray.map((_, idx, arr) => {
            if (idx < windowSize - 1) return null;
            const slice = arr.slice(idx - windowSize + 1, idx + 1);
            return slice.reduce((a, b) => a + b, 0) / windowSize;
        });

        // Calcolo Streak (Giorni Consecutivi)
        let currentStreak = 0, bestStreak = 0, tempStreak = 0;
        for (let i = 0; i < volumeDataArray.length; i++) {
            if (volumeDataArray[i] > 0) {
                tempStreak++;
                bestStreak = Math.max(bestStreak, tempStreak);
            } else {
                // Se oggi è 0 non rompere la streak finché non passa il giorno
                if (i !== volumeDataArray.length - 1) tempStreak = 0; 
            }
        }
        currentStreak = tempStreak;

        return { 
            labels: continuousDates, 
            latencyDatasets, 
            volumeDataset: { label: 'Calcoli Completati', data: volumeDataArray, backgroundColor: '#26a641', borderRadius: 4, order: 2 },
            volumeMADataset: { label: 'Media Mobile (7gg)', data: volumeMA, type: 'line', borderColor: '#58a6ff', borderWidth: 2, pointRadius: 0, order: 1, spanGaps: true },
            heatmapData,
            streaks: { current: currentStreak, best: bestStreak }
        };
    }
}