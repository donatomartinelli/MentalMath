// MATH-HUB // MENTAL MATH ENGINE (TRACHTENBERG & EMA LATENCY)
export class MathEngine {
    constructor(config = { digits: '2', mult: '11', multType: 'literal' }) {
        this.config = config;
        this.weightsKey = 'mentalMathGroupWeights';
        this.historyKey = 'mentalMathHistory';
        this.presetsKey = 'mentalMathPresets';

        this.weights = JSON.parse(localStorage.getItem(this.weightsKey)) ?? {};
        this.history = JSON.parse(localStorage.getItem(this.historyKey)) ?? {};
    }

    reloadFromStorage() {
        this.weights = JSON.parse(localStorage.getItem(this.weightsKey)) ?? {};
        this.history = JSON.parse(localStorage.getItem(this.historyKey)) ?? {};
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    getPresets() {
        return JSON.parse(localStorage.getItem(this.presetsKey)) ?? {
            "Riscaldamento 11-12": { digits: '2', mult: '11,12', multType: 'literal', time: '60', timeType: 's' },
            "Trachtenberg 5-9": { digits: '3', mult: '5-9', multType: 'literal', time: '90', timeType: 's' },
            "Sprint 3x1": { digits: '3', mult: '1', multType: 'digits', time: '60', timeType: 's' }
        };
    }

    savePreset(name, presetConfig) {
        const presets = this.getPresets();
        presets[name] = presetConfig;
        localStorage.setItem(this.presetsKey, JSON.stringify(presets));
    }

    deletePreset(name) {
        const presets = this.getPresets();
        delete presets[name];
        localStorage.setItem(this.presetsKey, JSON.stringify(presets));
    }

    parseDigits(inputStr) {
        let [min, max] = inputStr.split('-').map(n => parseInt(n.trim(), 10));
        min = min || 1;
        max = max || min;
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
            ? Array.from({ length: this.parseDigits(this.config.mult).max - this.parseDigits(this.config.mult).min + 1 }, (_, i) => i + this.parseDigits(this.config.mult).min)
            : this.parseLiteralValues(this.config.mult);

        const pool = multipliers.map(m => ({ multiplier: m, weight: this.weights[m] ?? 1000 }));
        let rand = Math.random() * pool.reduce((sum, item) => sum + item.weight, 0);

        let selectedMultiplier = pool[pool.length - 1].multiplier;
        for (const { multiplier, weight } of pool) {
            if ((rand -= weight) <= 0) {
                selectedMultiplier = multiplier;
                break;
            }
        }

        const multiplicand = Math.floor(Math.random() * (rangeA.max - rangeA.min + 1)) + rangeA.min;
        return {
            multiplicand,
            multiplier: selectedMultiplier,
            targetStr: (multiplicand * selectedMultiplier).toString(),
            key: selectedMultiplier,
            rawMultiplicand: multiplicand
        };
    }

    validateInput(inputBuffer, targetStr) {
        if (inputBuffer === targetStr) return { status: 'CORRECT' };
        if (inputBuffer.length >= targetStr.length) return { status: 'ERROR' };
        return { status: 'PENDING' };
    }

    updateWeights(sessionStats) {
        if (!sessionStats.length) return;
        const alpha = 0.3;
        const penaltyPerError = 800;
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

    getMultiplierStats() {
        return Object.entries(this.weights).sort(([, a], [, b]) => b - a);
    }

    getRuleForMultiplier(m) {
        const mult = parseInt(m, 10);
        switch (mult) {
            case 11: return "Regola dell'11: Aggiungi ogni cifra al suo vicino di destra.";
            case 12: return "Regola del 12: Raddoppia ogni cifra e aggiungi il suo vicino di destra.";
            case 6: return "Regola del 6: Aggiungi a ogni cifra metà del vicino di destra (+5 se dispari).";
            case 7: return "Regola del 7: Raddoppia la cifra e aggiungi metà del vicino (+5 se dispari).";
            case 5: return "Regola del 5: Prendi metà del vicino di destra (+5 se la cifra è dispari).";
            case 8: return "Regola dell'8: Sottrai da 9, raddoppia e aggiungi il vicino (ultima da 10, prima -2).";
            case 9: return "Regola del 9: Sottrai da 9 e aggiungi il vicino (ultima da 10, prima -1).";
            default: return "Inserimento da destra a sinistra: calcola unità, decine e riporti progressivamente.";
        }
    }

    getStreakAndDashboardData() {
        const todayISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
        const datesKeys = Object.keys(this.history).sort();
        const todayTotal = this.history[todayISO]
            ? Object.values(this.history[todayISO]).reduce((s, d) => s + d.count, 0)
            : 0;

        if (!datesKeys.length) {
            return {
                labels: [todayISO],
                latencyDatasets: [],
                volumeData: [0],
                heatmapData: {},
                streaks: { current: 0, best: 0, todayCount: 0 }
            };
        }

        const firstDate = new Date(datesKeys[0]);
        const todayDate = new Date(todayISO);
        const continuousDates = [];
        for (let d = new Date(firstDate); d <= todayDate; d.setDate(d.getDate() + 1)) {
            continuousDates.push(d.toISOString().split('T')[0]);
        }

        const heatmapData = {};
        const volumeData = [];
        const multipliers = new Set(datesKeys.flatMap(d => Object.keys(this.history[d])));

        const latencyDatasets = Array.from(multipliers).map((mult) => ({
            label: `[${mult}]`,
            data: continuousDates.map(date => {
                const dayData = this.history[date]?.[mult];
                return dayData && dayData.count > 0 ? Number(((dayData.sum / dayData.count) / 1000).toFixed(2)) : null;
            }),
            borderColor: '#ffffff',
            backgroundColor: '#ffffff',
            borderWidth: 1.5,
            tension: 0.2,
            spanGaps: true
        }));

        continuousDates.forEach(date => {
            const dailyTotal = this.history[date]
                ? Object.values(this.history[date]).reduce((sum, d) => sum + d.count, 0)
                : 0;
            volumeData.push(dailyTotal);
            heatmapData[date] = dailyTotal;
        });

        let currentStreak = 0, bestStreak = 0, tempStreak = 0;
        for (let i = 0; i < volumeData.length; i++) {
            if (volumeData[i] > 0) {
                tempStreak++;
                bestStreak = Math.max(bestStreak, tempStreak);
            } else {
                if (i !== volumeData.length - 1) tempStreak = 0;
            }
        }
        currentStreak = tempStreak;

        return {
            labels: continuousDates,
            latencyDatasets,
            volumeData,
            heatmapData,
            streaks: { current: currentStreak, best: bestStreak, todayCount: todayTotal }
        };
    }
}
