// mathEngine.js

/**
 * Motore generico per il calcolo dei riporti (RTL).
 * @param {string} numStr - Il numero da analizzare
 * @param {Function} ruleLogic - La funzione pura che definisce la regola di calcolo per la singola colonna
 */
function genericCarryEngine(numStr, ruleLogic) {
    let carries = 0;
    let currentCarry = 0;

    for (let i = numStr.length - 1; i >= -1; i--) {
        const digit = i >= 0 ? parseInt(numStr[i], 10) : 0;
        const neighbor = (i + 1 < numStr.length) ? parseInt(numStr[i + 1], 10) : 0;
        
        // Esecuzione cieca della regola iniettata
        const stepValue = ruleLogic(digit, neighbor);
        const totalSum = stepValue + currentCarry;

        if (totalSum >= 10) {
            carries++;
            currentCarry = Math.floor(totalSum / 10);
        } else {
            currentCarry = 0;
        }
    }
    return carries;
}

// STRATEGY: Dizionario delle regole di calcolo isolate
export const TrachtenbergRules = {
    // Regola 11: Aggiungi il vicino
    11: (digit, neighbor) => digit + neighbor,
    
    // Regola 12: Raddoppia + vicino
    12: (digit, neighbor) => (digit * 2) + neighbor,
    
    // Regola 6: Aggiungi metà del vicino (+5 se dispari)
    6: (digit, neighbor) => digit + Math.floor(neighbor / 2) + (digit % 2 !== 0 ? 5 : 0),
    
    // Regola 7: Raddoppia + metà vicino (+5 se dispari)
    7: (digit, neighbor) => (digit * 2) + Math.floor(neighbor / 2) + (digit % 2 !== 0 ? 5 : 0),
    
    // Regola 5: Metà vicino (+5 se dispari)
    5: (digit, neighbor) => Math.floor(neighbor / 2) + (digit % 2 !== 0 ? 5 : 0)
};

// Wrapper da esporre al dispatcher
export function calculateCarries(multiplier, numStr) {
    const rule = TrachtenbergRules[multiplier];
    if (!rule) return 0; // Failsafe se la regola non è ancora mappata
    
    return genericCarryEngine(numStr, rule);
}