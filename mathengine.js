export class MathEngine {
    constructor(config = { digits: '2', mult: '11', multType: 'literal' }) {
        this.config = config;
        this.weightsKey = 'mentalMathGroupWeights'; 
        this.historyKey = 'mentalMathHistory'; // Chiave per il tracking giornaliero
        
        this.weights = JSON.parse(localStorage.getItem(this.weightsKey)) || {};
        this.history = JSON.parse(localStorage.getItem(this.historyKey)) || {};
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    parseDigits(inputStr) {
        let min, max;
        if (inputStr.includes('-')) {
            const parts = inputStr.split('-');
            min = parseInt(parts[0].trim(), 10) || 1;
            max = parseInt(parts[1].trim(), 10) || min;
        } else {
            min = parseInt(inputStr.trim(), 10) || 1;
            max = min;
        }

        if (min > max) [min, max] = [max, min];

        return {
            min: Math.pow(10, min - 1),
            max: Math.pow(10, max) - 1
        };
    }

    parseLiteralValues(inputStr) {
        const values = new Set();
        const parts = inputStr.split(',');
        
        for (const part of parts) {
            if (part.includes('-')) {
                const [minStr, maxStr] = part.split('-');
                let min = parseInt(minStr.trim(), 10);
                let max = parseInt(maxStr.trim(), 10);
                if (!isNaN(min) && !isNaN(max)) {
                    if (min > max) [min, max] = [max, min];
                    for (let i = min; i <= max; i++) values.add(i);
                }
            } else {
                const val = parseInt(part.trim(), 10);
                if (!isNaN(val)) values.add(val);
            }
        }
        
        const arr = Array.from(values);
        return arr.length > 0 ? arr : [11]; 
    }

    generateOperation() {
        const rangeA = this.parseDigits(this.config.digits);
        const isRightDigits = this.config.multType === 'digits';
        
        let validMultipliers = [];
        if (isRightDigits) {
            const rightRange = this.parseDigits(this.config.mult);
            for (let i = rightRange.min; i <= rightRange.max; i++) {
                validMultipliers.push(i);
            }
        } else {
            validMultipliers = this.parseLiteralValues(this.config.mult);
        }
        
        const DEFAULT_WEIGHT = 1000;
        let pool = [];
        let totalWeight = 0;

        for (const mult of validMultipliers) {
            const weight = this.weights[mult] || DEFAULT_WEIGHT;
            pool.push({ multiplier: mult, weight });
            totalWeight += weight;
        }

        let rand = Math.random() * totalWeight;
        let selectedMultiplier = pool[pool.length - 1].multiplier;

        for (const item of pool) {
            rand -= item.weight;
            if (rand <= 0) {
                selectedMultiplier = item.multiplier;
                break;
            }
        }

        const sizeA = rangeA.max - rangeA.min + 1;
        const multiplicand = Math.floor(Math.random() * sizeA) + rangeA.min;
        const target = multiplicand * selectedMultiplier;

        return {
            multiplicand: multiplicand,
            multiplier: selectedMultiplier,
            targetStr: target.toString(),
            key: selectedMultiplier,
            rawMultiplicand: multiplicand 
        };
    }

    validateInput(inputBuffer, targetStr) {
        if (inputBuffer === targetStr) {
            return { status: 'CORRECT' };
        } else if (inputBuffer.length >= targetStr.length) {
            return { status: 'ERROR' };
        }
        return { status: 'PENDING' };
    }

    updateWeights(sessionStats) {
        const alpha = 0.3; 
        const penaltyPerError = 800; 
        const today = new Date().toISOString().split('T')[0]; // Isolamento data YYYY-MM-DD

        if (!this.history[today]) {
            this.history[today] = {};
        }

        sessionStats.forEach(stat => {
            const oldWeight = this.weights[stat.key] || 1000;
            
            const rawEffectiveTime = stat.time + (stat.errors * penaltyPerError);
            const digits = stat.multiplicand.toString().length;
            const normalizationFactor = Math.max(1, digits / 2); 
            const normalizedTime = rawEffectiveTime / normalizationFactor;

            // Aggiornamento EMA (per estrazione)
            this.weights[stat.key] = (alpha * normalizedTime) + ((1 - alpha) * oldWeight);

            // Accumulatore media giornaliera (per il grafico)
            if (!this.history[today][stat.key]) {
                this.history[today][stat.key] = { sum: 0, count: 0 };
            }
            this.history[today][stat.key].sum += normalizedTime;
            this.history[today][stat.key].count += 1;
        });
        
        localStorage.setItem(this.weightsKey, JSON.stringify(this.weights));
        localStorage.setItem(this.historyKey, JSON.stringify(this.history));
    }

    resetWeights() {
        this.weights = {};
        this.history = {};
        localStorage.removeItem(this.weightsKey);
        localStorage.removeItem(this.historyKey);
    }

    getMultiplierStats() {
        return Object.entries(this.weights)
            .sort((a, b) => b[1] - a[1]);
    }

    // Metodo per estrarre e strutturare i dati temporali per Chart.js
    getChartData() {
        const dates = Object.keys(this.history).sort();
        if (dates.length === 0) return null;

        const multipliers = new Set();
        dates.forEach(date => {
            Object.keys(this.history[date]).forEach(m => multipliers.add(m));
        });

        const datasets = [];
        const colors = ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40'];
        let colorIdx = 0;

        multipliers.forEach(mult => {
            const data = dates.map(date => {
                const dayData = this.history[date][mult];
                if (dayData && dayData.count > 0) {
                    return (dayData.sum / dayData.count) / 1000; // Converte in secondi
                }
                return null; // I buchi vengono gestiti dalla libreria tramite spanGaps
            });

            datasets.push({
                label: `Moltiplicatore [${mult}]`,
                data: data,
                borderColor: colors[colorIdx % colors.length],
                backgroundColor: colors[colorIdx % colors.length],
                tension: 0.2, // Curvatura leggera per leggibilità
                spanGaps: true // Ignora i giorni in cui non ti sei allenato su quel numero
            });
            colorIdx++;
        });

        return { labels: dates, datasets };
    }
}