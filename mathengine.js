export class MathEngine {
    constructor(config = { digits: '2', mult: '11', multType: 'literal' }) {
        this.config = config;
        this.weightsKey = 'mentalMathWeights';
        this.weights = JSON.parse(localStorage.getItem(this.weightsKey)) || {};
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    getWeightKey(a, b) {
        return `${Math.min(a, b)}_${Math.max(a, b)}`;
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
        return arr.length > 0 ? arr : [11]; // Fallback di sicurezza
    }

    generateOperation() {
        const rangeA = this.parseDigits(this.config.digits);
        const isRightDigits = this.config.multType === 'digits';
        
        const rightDigits = isRightDigits ? this.parseDigits(this.config.mult) : null;
        const rightLiterals = !isRightDigits ? this.parseLiteralValues(this.config.mult) : null;
        
        const DEFAULT_WEIGHT = 1000;
        let customPool = [];
        let totalCustomWeight = 0;
        let customCount = 0;

        const matchA = v => (v >= rangeA.min && v <= rangeA.max);
        const matchB = v => isRightDigits ? (v >= rightDigits.min && v <= rightDigits.max) : rightLiterals.includes(v);

        for (const [key, weight] of Object.entries(this.weights)) {
            if (weight === DEFAULT_WEIGHT) continue;
            
            const [strA, strB] = key.split('_');
            const v1 = parseInt(strA, 10);
            const v2 = parseInt(strB, 10);

            const matchNormal = matchA(v1) && matchB(v2);
            const matchSwapped = matchA(v2) && matchB(v1);

            if (matchNormal || matchSwapped) {
                customPool.push({ key, weight, v1, v2, matchNormal, matchSwapped });
                totalCustomWeight += weight;
                customCount++;
            }
        }

        const sizeA = rangeA.max - rangeA.min + 1;
        const sizeB = isRightDigits ? (rightDigits.max - rightDigits.min + 1) : rightLiterals.length;
        const totalCombinations = sizeA * sizeB;
        
        const unexploredCount = Math.max(0, totalCombinations - customCount);
        const totalUnexploredWeight = unexploredCount * DEFAULT_WEIGHT;
        const grandTotalWeight = totalCustomWeight + totalUnexploredWeight;
        
        let rand = Math.random() * grandTotalWeight;
        let multiplicand, multiplier, opKey;

        if (rand < totalCustomWeight && customPool.length > 0) {
            for (const op of customPool) {
                rand -= op.weight;
                if (rand <= 0) {
                    if (op.matchNormal && op.matchSwapped) {
                        const randomSwap = Math.random() > 0.5;
                        multiplicand = randomSwap ? op.v1 : op.v2;
                        multiplier = randomSwap ? op.v2 : op.v1;
                    } else if (op.matchNormal) {
                        multiplicand = op.v1;
                        multiplier = op.v2;
                    } else {
                        multiplicand = op.v2;
                        multiplier = op.v1;
                    }
                    opKey = op.key;
                    break;
                }
            }
        } else {
            let found = false;
            while (!found) {
                multiplicand = Math.floor(Math.random() * sizeA) + rangeA.min;
                multiplier = isRightDigits 
                    ? Math.floor(Math.random() * sizeB) + rightDigits.min 
                    : rightLiterals[Math.floor(Math.random() * rightLiterals.length)];
                
                opKey = this.getWeightKey(multiplicand, multiplier);
                
                if (!this.weights[opKey] || this.weights[opKey] === DEFAULT_WEIGHT) {
                    found = true;
                }
            }
        }

        const target = multiplicand * multiplier;

        return {
            multiplicand,
            multiplier,
            targetStr: target.toString(),
            key: opKey
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

        sessionStats.forEach(stat => {
            const oldWeight = this.weights[stat.key] || 1000;
            const effectiveTime = stat.time + (stat.errors * penaltyPerError);
            this.weights[stat.key] = (alpha * effectiveTime) + ((1 - alpha) * oldWeight);
        });
        
        localStorage.setItem(this.weightsKey, JSON.stringify(this.weights));
    }

    resetWeights() {
        this.weights = {};
        localStorage.removeItem(this.weightsKey);
    }

    getTopWeights(limit = 10) {
        return Object.entries(this.weights)
            .filter(([_, weight]) => weight > 1000)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);
    }
}