// MATH-HUB // PROBLEM ENGINE (ADAPTIVE QUEUE, SKIPPED POOL, ANKI SRS & EMA MASTERY)
export class ProblemEngine {
    constructor() {
        this.storageKey = 'mathHubProblemState';
        this.problems = [];
        this.state = this.loadState();
    }

    getTodayISO() {
        return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    }

    loadState() {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
            try { return JSON.parse(raw); } catch (e) { console.error(e); }
        }
        return {
            topicStats: {},     // { [topicKey]: { emaMastery: 0.5, pointer: 0, skippedQueue: [], stepCounter: 0 } }
            problemRecords: {}, // { [id]: { status: 'solved'|'failed'|'skipped', lastSlider: 0.3, interval: 1, dueDate: 'YYYY-MM-DD', attempts: 0, lastTimeSec: 0 } }
            dailyHistory: {},   // { 'YYYY-MM-DD': { count: 0, sumSlider: 0, sumTimeSec: 0 } }
            activeProblemId: null,
            activeMode: 'NUOVO'
        };
    }

    saveState() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    }

    setProblems(problemsArray) {
        // Ordina sempre per difficoltà crescente all'interno di ciascun micro-argomento
        this.problems = [...problemsArray].sort((a, b) => {
            if (a.core !== b.core) return a.core.localeCompare(b.core);
            if (a.course !== b.course) return a.course.localeCompare(b.course);
            if (a.topic !== b.topic) return a.topic.localeCompare(b.topic);
            return a.baseDiff - b.baseDiff || a.id.localeCompare(b.id);
        });

        // Inizializza la struttura statistica per ogni micro-argomento presente nel JSON
        this.problems.forEach(p => {
            const tKey = this.getTopicKey(p);
            if (!this.state.topicStats[tKey]) {
                this.state.topicStats[tKey] = {
                    core: p.core,
                    course: p.course,
                    topic: p.topic,
                    emaMastery: 0.50,
                    pointer: 0,
                    skippedQueue: [],
                    stepCounter: 0
                };
            }
        });
        this.saveState();
    }

    getTopicKey(p) {
        return `${p.core}::${p.course}::${p.topic}`;
    }

    getFilteredProblems(filter = {}) {
        return this.problems.filter(p => {
            if (filter.core && filter.core !== 'ALL' && p.core !== filter.core) return false;
            if (filter.course && filter.course !== 'ALL' && p.course !== filter.course) return false;
            if (filter.topic && filter.topic !== 'ALL' && p.topic !== filter.topic) return false;
            return true;
        });
    }

    // Seleziona il prossimo problema rispettando:
    // 1. Blocco sul problema attivo finché non viene risolto o dichiarata resa
    // 2. Ripassi Anki scaduti (dueDate <= oggi)
    // 3. Coda di recupero degli esercizi saltati (1 ogni 4 problemi nuovi)
    // 4. Puntatore adattivo sul micro-argomento
    getNextProblem(filter = {}, forceRecompute = false) {
        const pool = this.getFilteredProblems(filter);
        if (!pool.length) return null;

        if (!forceRecompute && this.state.activeProblemId) {
            const locked = pool.find(p => p.id === this.state.activeProblemId);
            if (locked) return { problem: locked, mode: this.state.activeMode || 'IN CORSO' };
        }

        const today = this.getTodayISO();

        // 1. Controlla se ci sono esercizi scaduti (Spaced Repetition / Rese del giorno prima)
        const dueProblems = pool.filter(p => {
            const rec = this.state.problemRecords[p.id];
            return rec && (rec.status === 'solved' || rec.status === 'failed') && rec.dueDate && rec.dueDate <= today;
        });

        if (dueProblems.length > 0) {
            // Priorità a quelli falliti (resa = 1.0) o con slider più alto
            dueProblems.sort((a, b) => (this.state.problemRecords[b.id].lastSlider || 0) - (this.state.problemRecords[a.id].lastSlider || 0));
            const chosen = dueProblems[0];
            this.state.activeProblemId = chosen.id;
            this.state.activeMode = this.state.problemRecords[chosen.id].status === 'failed' ? 'RECUPERO RESA' : 'RIPASSO ANKI';
            this.saveState();
            return { problem: chosen, mode: this.state.activeMode };
        }

        // Raggruppa il pool per micro-argomento
        const topicsInPool = Array.from(new Set(pool.map(p => this.getTopicKey(p))));
        for (const tKey of topicsInPool) {
            const tStat = this.state.topicStats[tKey];
            const topicProblems = pool.filter(p => this.getTopicKey(p) === tKey);

            // Rimuovi dalla skippedQueue eventuali ID già risolti
            tStat.skippedQueue = (tStat.skippedQueue || []).filter(id => {
                const r = this.state.problemRecords[id];
                return !r || r.status === 'skipped';
            });

            // 2. Ogni 4 passi nel topic, pesca 1 esercizio dalla coda saltati così appaiono tutti
            if (tStat.skippedQueue.length > 0 && tStat.stepCounter > 0 && tStat.stepCounter % 4 === 0) {
                const skippedId = tStat.skippedQueue[0];
                const skippedProb = topicProblems.find(p => p.id === skippedId);
                if (skippedProb) {
                    this.state.activeProblemId = skippedProb.id;
                    this.state.activeMode = 'RECUPERO SALTATO';
                    this.saveState();
                    return { problem: skippedProb, mode: 'RECUPERO SALTATO' };
                }
            }

            // 3. Cerca dal puntatore corrente in avanti il primo esercizio inedito
            const clampedPtr = Math.min(Math.max(0, tStat.pointer || 0), topicProblems.length - 1);
            for (let i = clampedPtr; i < topicProblems.length; i++) {
                const candidate = topicProblems[i];
                const rec = this.state.problemRecords[candidate.id];
                if (!rec) {
                    tStat.pointer = i;
                    this.state.activeProblemId = candidate.id;
                    this.state.activeMode = 'NUOVO';
                    this.saveState();
                    return { problem: candidate, mode: 'NUOVO' };
                }
            }

            // 4. Se dal puntatore in poi sono finiti, svuota la skippedQueue o gli inediti antecedenti
            if (tStat.skippedQueue.length > 0) {
                const skippedId = tStat.skippedQueue[0];
                const skippedProb = topicProblems.find(p => p.id === skippedId);
                if (skippedProb) {
                    this.state.activeProblemId = skippedProb.id;
                    this.state.activeMode = 'RECUPERO SALTATO';
                    this.saveState();
                    return { problem: skippedProb, mode: 'RECUPERO SALTATO' };
                }
            }

            for (let i = 0; i < topicProblems.length; i++) {
                const candidate = topicProblems[i];
                if (!this.state.problemRecords[candidate.id]) {
                    tStat.pointer = i;
                    this.state.activeProblemId = candidate.id;
                    this.state.activeMode = 'NUOVO';
                    this.saveState();
                    return { problem: candidate, mode: 'NUOVO' };
                }
            }
        }

        // 5. Se tutti gli esercizi del filtro sono già stati svolti, proponi consolidamento su quello con slider più alto
        const sortedByDifficulty = [...pool].sort((a, b) => {
            const ra = this.state.problemRecords[a.id]?.lastSlider ?? 0.5;
            const rb = this.state.problemRecords[b.id]?.lastSlider ?? 0.5;
            return rb - ra;
        });
        this.state.activeProblemId = sortedByDifficulty[0].id;
        this.state.activeMode = 'CONSOLIDAMENTO';
        this.saveState();
        return { problem: sortedByDifficulty[0], mode: 'CONSOLIDAMENTO' };
    }

    // Preview testuale in tempo reale mentre l'utente muove lo slider [0, 1]
    describeSliderImpact(sliderVal) {
        const s = parseFloat(sliderVal);
        if (s >= 0.99) {
            return "1.00 [DICHIARAZIONE DI RESA] -> Registra lacuna, riprogramma a domani e arretra di 1 livello propedeutico.";
        }
        if (s < 0.20) {
            const jump = Math.floor(1 + 4 * ((0.20 - s) / 0.20));
            return `${s.toFixed(2)} [FACILISSIMO] -> Salto adattivo in avanti (+${jump + 1} posizioni). I ${jump} esercizi saltati entrano nella Coda di Recupero.`;
        }
        if (s <= 0.65) {
            const mult = (2.6 - 1.8 * s).toFixed(1);
            return `${s.toFixed(2)} [SOLIDO] -> Avanzamento progressivo (+1). Ripasso schedulato con moltiplicatore Anki x${mult}.`;
        }
        return `${s.toFixed(2)} [OSTICO] -> Consolidamento sulla fascia attuale senza salto di difficoltà. Ripasso ravvicinato.`;
    }

    // Registra la valutazione dello slider s in [0, 1] e calcola EMA, salto o passo indietro
    submitEvaluation(problemId, sliderValue, elapsedSeconds = 0) {
        const problem = this.problems.find(p => p.id === problemId);
        if (!problem) return null;

        const s = Math.min(1, Math.max(0, parseFloat(sliderValue)));
        const tKey = this.getTopicKey(problem);
        const tStat = this.state.topicStats[tKey];
        const topicProblems = this.problems.filter(p => this.getTopicKey(p) === tKey);
        const currentIndex = topicProblems.findIndex(p => p.id === problemId);

        // 1. Aggiorna Padronanza EMA del micro-argomento (invariante rispetto all'aggiunta di nuovi problemi)
        const alpha = 0.25;
        const oldEma = tStat.emaMastery ?? 0.50;
        tStat.emaMastery = (alpha * (1 - s)) + ((1 - alpha) * oldEma);
        tStat.stepCounter = (tStat.stepCounter || 0) + 1;

        // Rimuovi dalla coda saltati se era lì
        tStat.skippedQueue = (tStat.skippedQueue || []).filter(id => id !== problemId);

        // 2. Calcola nuovo intervallo Spaced Repetition (stile Anki)
        const today = this.getTodayISO();
        const prevRec = this.state.problemRecords[problemId] || { interval: 1, attempts: 0 };
        let nextInterval = 1;
        let status = 'solved';

        if (s >= 0.99) {
            // Dichiarazione di resa: riprova domani
            status = 'failed';
            nextInterval = 1;
        } else {
            const factor = Math.max(1.1, 2.6 - 1.8 * s);
            nextInterval = Math.max(1, Math.round((prevRec.interval || 1) * factor));
        }

        const dueDateObj = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
        dueDateObj.setDate(dueDateObj.getDate() + nextInterval);
        const dueDateStr = dueDateObj.toISOString().split('T')[0];

        this.state.problemRecords[problemId] = {
            status,
            lastSlider: s,
            interval: nextInterval,
            dueDate: dueDateStr,
            attempts: (prevRec.attempts || 0) + 1,
            lastTimeSec: Math.round(elapsedSeconds),
            updatedAt: today
        };

        // 3. Muovi il puntatore del topic: Salto in avanti (< 0.20), Standard (0.20 - 0.98), Passo indietro (1.00)
        if (s >= 0.99) {
            // Passo indietro su un esercizio propedeutico
            tStat.pointer = Math.max(0, currentIndex - 1);
        } else if (s < 0.20) {
            const jumpCount = Math.floor(1 + 4 * ((0.20 - s) / 0.20)); // da 1 a 5 esercizi saltati
            for (let j = 1; j <= jumpCount; j++) {
                const skippedIdx = currentIndex + j;
                if (skippedIdx < topicProblems.length) {
                    const skippedProb = topicProblems[skippedIdx];
                    if (!this.state.problemRecords[skippedProb.id]) {
                        this.state.problemRecords[skippedProb.id] = { status: 'skipped', lastSlider: null, interval: 0, dueDate: null, attempts: 0 };
                        if (!tStat.skippedQueue.includes(skippedProb.id)) {
                            tStat.skippedQueue.push(skippedProb.id);
                        }
                    }
                }
            }
            tStat.pointer = Math.min(topicProblems.length - 1, currentIndex + jumpCount + 1);
        } else {
            tStat.pointer = Math.min(topicProblems.length - 1, currentIndex + 1);
        }

        // 4. Aggiorna storico giornaliero per Streak e Serie Temporali
        if (!this.state.dailyHistory[today]) {
            this.state.dailyHistory[today] = { count: 0, sumSlider: 0, sumTimeSec: 0 };
        }
        if (status === 'solved') {
            this.state.dailyHistory[today].count += 1;
            this.state.dailyHistory[today].sumSlider += s;
            this.state.dailyHistory[today].sumTimeSec += Math.round(elapsedSeconds);
        }

        // Sblocca il problema corrente per passare al prossimo
        this.state.activeProblemId = null;
        this.saveState();

        return {
            newMastery: tStat.emaMastery,
            nextInterval,
            status
        };
    }

    // Calcola la Streak giornaliera dei Problemi (>= 1 problema risolto al giorno)
    getStreakData() {
        const dates = Object.keys(this.state.dailyHistory).sort();
        if (!dates.length) return { current: 0, best: 0, todayCount: 0 };

        const today = this.getTodayISO();
        const todayCount = this.state.dailyHistory[today]?.count || 0;

        const firstDate = new Date(dates[0]);
        const todayDate = new Date(today);
        let currentStreak = 0, bestStreak = 0, tempStreak = 0;

        for (let d = new Date(firstDate); d <= todayDate; d.setDate(d.getDate() + 1)) {
            const iso = d.toISOString().split('T')[0];
            const c = this.state.dailyHistory[iso]?.count || 0;
            if (c > 0) {
                tempStreak++;
                bestStreak = Math.max(bestStreak, tempStreak);
            } else {
                if (iso !== today) tempStreak = 0;
            }
        }
        currentStreak = tempStreak;
        return { current: currentStreak, best: bestStreak, todayCount };
    }

    // Restituisce tutte le metriche per lo Spettro delle Competenze (Radar Chart + Tabella Granulare)
    getSpectrumAnalytics() {
        const topicRows = [];
        const coreMap = {};

        Object.values(this.state.topicStats).forEach(tStat => {
            const topicProblems = this.problems.filter(
                p => p.core === tStat.core && p.course === tStat.course && p.topic === tStat.topic
            );
            const total = topicProblems.length;
            let solved = 0;
            let skipped = 0;

            topicProblems.forEach(p => {
                const r = this.state.problemRecords[p.id];
                if (r?.status === 'solved') solved++;
                else if (r?.status === 'skipped') skipped++;
            });

            const masteryPct = Math.round((tStat.emaMastery ?? 0.5) * 100);
            topicRows.push({
                core: tStat.core,
                course: tStat.course,
                topic: tStat.topic,
                masteryPct,
                solved,
                skipped,
                total
            });

            if (!coreMap[tStat.core]) coreMap[tStat.core] = { sum: 0, count: 0, solved: 0, total: 0 };
            coreMap[tStat.core].sum += masteryPct;
            coreMap[tStat.core].count += 1;
            coreMap[tStat.core].solved += solved;
            coreMap[tStat.core].total += total;
        });

        const coreSummary = Object.entries(coreMap).map(([core, d]) => ({
            core,
            masteryPct: d.count ? Math.round(d.sum / d.count) : 50,
            solved: d.solved,
            total: d.total
        }));

        return { topicRows, coreSummary };
    }
}
