// File: src/data/problemBank.js

// 1. IMPORTA I MODULI (De-commenta man mano che scrivi i file)
import { polinomiali } from './pre-analisi/1_polinomiali.js';
// import { razionali } from './pre-analisi/2_razionali.js';
// import { irrazionali } from './pre-analisi/3_irrazionali.js';
// import { valoreassoluto } from './pre-analisi/4_valoreassoluto.js';
// import { esponenziali } from './pre-analisi/5_esponenziali.js';
// import { logaritmiche } from './pre-analisi/6_logaritmiche.js';
// import { trigonometriche } from './pre-analisi/7_trigonometriche.js';
// import { sistemi } from './pre-analisi/8_sistemi.js';

// 2. ESPORTA IL DATABASE GLOBALE
// L'operatore spread (...) esplode i singoli array all'interno di questo unico grande array
export const problemBank = [
    ...polinomiali,
    // ...razionali,
    // ...irrazionali,
    // ...valoreassoluto,
    // ...esponenziali,
    // ...logaritmiche,
    // ...trigonometriche,
    // ...sistemi
];