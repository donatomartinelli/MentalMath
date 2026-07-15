// mathEngine.js

export class MathEngine {
    // Il setup ora accetta direttamente il numero di cifre (es. 2 = da 10 a 99) e il moltiplicatore
    constructor(config = { digits: 2, multiplier: 11 }) {
        this.config = config;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    generateOperation() {
        const { digits, multiplier } = this.config;
        
        // Calcola il range esatto in base al numero di cifre richiesto
        const min = Math.pow(10, digits - 1);
        const max = Math.pow(10, digits) - 1;
        
        // Estrazione brutale e diretta, nessun ciclo di validazione sui riporti
        const a = Math.floor(Math.random() * (max - min + 1)) + min;
        const target = a * multiplier;
        
        return {
            multiplicand: a,
            multiplier: multiplier,
            target: target,
            targetStr: target.toString()
        };
    }
    
    // La logica RTL viene gestita a monte nell'event listener della UI,
    // il motore si limita a validare la stringa di buffer contro il target
    validateInput(inputBuffer, targetStr) {
        if (inputBuffer === targetStr) {
            return { status: 'CORRECT' };
        } else if (inputBuffer.length >= targetStr.length) {
            return { status: 'ERROR' };
        }
        return { status: 'PENDING' };
    }
}