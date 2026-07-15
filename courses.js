// courses.js
export const courseData = {
    // --- MULTIPLICATION -> BASIC MULTIPLICATIONS ---
    trach_11: {
        title: "Il Metodo dell'11",
        category: "Multiplication",
        chapter: "Basic Multiplications",
        html: `
            <h2>Moltiplicare per 11</h2>
            <p>Regola fondamentale: <strong>Aggiungi il vicino</strong>.</p>
            <p>Procedendo da destra a sinistra (RTL):</p>
            <ol>
                <li>Scrivi l'ultima cifra del moltiplicando come cifra iniziale del risultato.</li>
                <li>Somma ogni cifra successiva al suo vicino immediato di destra.</li>
                <li>La cifra più a sinistra del moltiplicando diventa la cifra finale del risultato (più eventuali riporti).</li>
            </ol>
            <div class="example-box">
                <strong>Esempio: 423 * 11</strong><br>
                • Unità: 3 (nessun vicino a destra) -> 3<br>
                • Decine: 2 + vicino (3) = 5 -> 53<br>
                • Centinaia: 4 + vicino (2) = 6 -> 653<br>
                • Migliaia: 0 + vicino (4) = 4 -> 4653
            </div>
        `,
        practicePreset: { min: 10, max: 999, multiplier: 11, mode: 'RTL', engineRule: 'TRACH_11' }
    },
    trach_12: {
        title: "Il Metodo del 12",
        category: "Multiplication",
        chapter: "Basic Multiplications",
        html: `
            <h2>Moltiplicare per 12</h2>
            <p>Regola fondamentale: <strong>Raddoppia la cifra e aggiungi il vicino</strong>.</p>
            <p>Procedendo da destra a sinistra (RTL):</p>
            <ol>
                <li>Raddoppia l'ultima cifra del moltiplicando.</li>
                <li>Per ogni cifra successiva, raddoppiala e somma il suo vicino di destra.</li>
                <li>La cifra più a sinistra del moltiplicando (considerata con vicino a destra) determina la chiusura del calcolo.</li>
            </ol>
            <div class="example-box">
                <strong>Esempio: 312 * 12</strong><br>
                • Cifra 2: raddoppia (2*2) + nessun vicino = 4 -> 4<br>
                • Cifra 1: raddoppia (1*2) + vicino (2) = 4 -> 44<br>
                • Cifra 3: raddoppia (3*2) + vicino (1) = 7 -> 744<br>
                • Chiusura: 0 raddoppiato + vicino (3) = 3 -> 3744
            </div>
        `,
        practicePreset: { min: 10, max: 999, multiplier: 12, mode: 'RTL', engineRule: 'TRACH_12' }
    },
    trach_6: {
        title: "Il Metodo del 6",
        category: "Multiplication",
        chapter: "Basic Multiplications",
        html: `
            <h2>Moltiplicare per 6</h2>
            <p>Regola fondamentale: <strong>Aggiungi la metà del vicino. Se la cifra è dispari, aggiungi anche 5</strong>.</p>
            <p>Nota: Per "metà del vicino" si intende sempre la divisione intera per difetto (es. la metà di 5 è 2).</p>
            <div class="example-box">
                <strong>Esempio: 432 * 6</strong><br>
                • Cifra 2 (pari): 2 + metà vicino (0) = 2 -> 2<br>
                • Cifra 3 (dispari): 3 + metà vicino (1) + 5 = 9 -> 92<br>
                • Cifra 4 (pari): 4 + metà vicino (1) = 5 -> 592<br>
                • Chiusura: 0 + metà vicino (2) = 2 -> 2592
            </div>
        `,
        practicePreset: { min: 10, max: 999, multiplier: 6, mode: 'RTL', engineRule: 'TRACH_6' }
    },
    trach_7: {
        title: "Il Metodo del 7",
        category: "Multiplication",
        chapter: "Basic Multiplications",
        html: `
            <h2>Moltiplicare per 7</h2>
            <p>Regola fondamentale: <strong>Raddoppia la cifra e aggiungi la metà del vicino. Se la cifra è dispari, aggiungi anche 5</strong>.</p>
            <div class="example-box">
                <strong>Esempio: 242 * 7</strong><br>
                • Cifra 2 (pari): (2*2) + metà vicino (0) = 4 -> 4<br>
                • Cifra 4 (pari): (4*2) + metà vicino (1) = 9 -> 94<br>
                • Cifra 2 (pari): (2*2) + metà vicino (2) = 6 -> 694<br>
                • Chiusura: (0*2) + metà vicino (1) = 1 -> 1694
            </div>
        `,
        practicePreset: { min: 10, max: 999, multiplier: 7, mode: 'RTL', engineRule: 'TRACH_7' }
    },
    trach_5: {
        title: "Il Metodo del 5",
        category: "Multiplication",
        chapter: "Basic Multiplications",
        html: `
            <h2>Moltiplicare per 5</h2>
            <p>Regola fondamentale: <strong>Prendi la metà del vicino. Se la cifra corrente è dispari, aggiungi 5</strong>.</p>
            <p>In questo metodo il valore della cifra corrente non viene sommato direttamente, serve solo a determinare il bonus di 5.</p>
            <div class="example-box">
                <strong>Esempio: 436 * 5</strong><br>
                • Cifra 6 (pari): metà vicino (0) = 0 -> 0<br>
                • Cifra 3 (dispari): metà vicino (3) + 5 = 8 -> 80<br>
                • Cifra 4 (pari): metà vicino (1) = 1 -> 180<br>
                • Chiusura: metà vicino (2) = 2 -> 2180
            </div>
        `,
        practicePreset: { min: 10, max: 999, multiplier: 5, mode: 'RTL', engineRule: 'TRACH_5' }
    },
    trach_9: {
        title: "Il Metodo del 9",
        category: "Multiplication",
        chapter: "Basic Multiplications",
        html: `
            <h2>Moltiplicare per 9</h2>
            <p>Regola fondamentale basata sui complementi:</p>
            <ol>
                <li><strong>Prima cifra (unità):</strong> Sottrai da 10.</li>
                <li><strong>Cifre intermedie:</strong> Sottrai da 9 e aggiungi il vicino.</li>
                <li><strong>Chiusura (cifra finale a sinistra):</strong> Sottrai 1 dalla prima cifra del moltiplicando.</li>
            </ol>
            <div class="example-box">
                <strong>Esempio: 874 * 9</strong><br>
                • Cifra 4: Sottrai da 10 = 6 -> 6<br>
                • Cifra 7: Sottrai da 9 (2) + vicino (4) = 6 -> 66<br>
                • Cifra 8: Sottrai da 9 (1) + vicino (7) = 8 -> 866<br>
                • Chiusura: Moltiplicando iniziale 8 - 1 = 7 -> 7866
            </div>
        `,
        practicePreset: { min: 10, max: 999, multiplier: 9, mode: 'RTL', engineRule: 'TRACH_9' }
    },
    trach_8: {
        title: "Il Metodo dell'8",
        category: "Multiplication",
        chapter: "Basic Multiplications",
        html: `
            <h2>Moltiplicare per 8</h2>
            <p>Regola fondamentale:</p>
            <ol>
                <li><strong>Prima cifra (unità):</strong> Sottrai da 10 e raddoppia il risultato.</li>
                <li><strong>Cifre intermedie:</strong> Sottrai da 9, raddoppia il risultato e aggiungi il vicino.</li>
                <li><strong>Chiusura:</strong> Sottrai 2 dalla cifra più a sinistra del moltiplicando.</li>
            </ol>
            <div class="example-box">
                <strong>Esempio: 324 * 8</strong><br>
                • Cifra 4: (10 - 4) * 2 = 12 -> 2 (riporto 1)<br>
                • Cifra 2: ((9 - 2) * 2) + vicino (4) + riporto (1) = 19 -> 9 (riporto 1)<br>
                • Cifra 3: ((9 - 3) * 2) + vicino (2) + riporto (1) = 15 -> 5 (riporto 1)<br>
                • Chiusura: Cifra sinistra 3 - 2 + riporto (1) = 2 -> 2592
            </div>
        `,
        practicePreset: { min: 10, max: 999, multiplier: 8, mode: 'RTL', engineRule: 'TRACH_8' }
    },
    trach_4: {
        title: "Il Metodo del 4",
        category: "Multiplication",
        chapter: "Basic Multiplications",
        html: `
            <h2>Moltiplicare per 4</h2>
            <p>Regola fondamentale:</p>
            <ol>
                <li><strong>Prima cifra (unità):</strong> Sottrai da 10. Se la cifra è dispari, aggiungi 5.</li>
                <li><strong>Cifre intermedie:</strong> Sottrai da 9 e aggiungi la metà del vicino. Se la cifra è dispari, aggiungi 5.</li>
                <li><strong>Chiusura:</strong> Prendi la metà della cifra più a sinistra del moltiplicando e sottrai 1.</li>
            </ol>
            <div class="example-box">
                <strong>Esempio: 265 * 4</strong><br>
                • Cifra 5 (dispari): (10 - 5) + 5 = 10 -> 0 (riporto 1)<br>
                • Cifra 6 (pari): (9 - 6) + metà vicino (2) + riporto (1) = 6 -> 60<br>
                • Cifra 2 (pari): (9 - 2) + metà vicino (3) = 10 -> 0 (riporto 1)<br>
                • Chiusura: metà cifra sinistra (1) - 1 + riporto (1) = 1 -> 1060
            </div>
        `,
        practicePreset: { min: 10, max: 999, multiplier: 4, mode: 'RTL', engineRule: 'TRACH_4' }
    },

    // --- STRUTTURE VUOTE PER GLI ALTRI LIVELLI (DA SVILUPPARE) ---
    trach_direct: {
        title: "Direct Method (Metodo Diretto)",
        category: "Multiplication",
        chapter: "Direct Method",
        html: `<h2>Direct Method</h2><p>Contenuto teorico per la moltiplicazione a due dita senza passaggi intermedi...</p>`,
        practicePreset: { min: 10, max: 99, multiplier: 23, mode: 'RTL', engineRule: 'DIRECT' }
    }
};