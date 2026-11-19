// MATH-HUB // PROBLEM ENGINE (ANKI A VARIANTI INEDITE + SBLOCCO LINEARE)
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
            // Lo stato ora traccia l'aggregato "Corso::Argomento::LivelloDifficoltà"
            topicRecords: {}, // Es: { "Analisi 1::Limiti e Asintotici::3": { status: 'learning'|'passed'|'failed', interval: 1, dueDate: '2026-11-20', usedIds: [] } }
            dailyHistory: {},   
            activeProblemId: null,
            activeMode: 'NUOVO',
            globalEmaMastery: 0.5
        };
    }

    saveState() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    }

    setProblems(problemsArray) {
        // L'array eredita l'ordinamento strutturale del LaTeX e di Python
        this.problems = problemsArray;
    }

    // Identificativo aggregato per lo sblocco e lo spaced repetition
    getGroupKey(p) {
        return `${p.course}::${p.topic}::${p.baseDiff}`;
    }

    getNextProblem(forceRecompute = false) {
        if (!this.problems.length) return null;

        if (!forceRecompute && this.state.activeProblemId) {
            const locked = this.problems.find(p => p.id === this.state.activeProblemId);
            if (locked) return { problem: locked, mode: this.state.activeMode || 'IN CORSO' };
        }

        const today = this.getTodayISO();

        // 1. FASE RIPASSO (ANKI): Cerca gruppi in cui la scadenza è arrivata o passata
        const dueGroups = Object.keys(this.state.topicRecords).filter(key => {
            const rec = this.state.topicRecords[key];
            return rec.dueDate && rec.dueDate <= today && (rec.status === 'passed' || rec.status === 'failed');
        });

        if (dueGroups.length > 0) {
            // Priorità 1: Rese (failed) - Priorità 2: Intervalli più corti (argomenti ostici)
            dueGroups.sort((a, b) => {
                const recA = this.state.topicRecords[a];
                const recB = this.state.topicRecords[b];
                if (recA.status === 'failed' && recB.status !== 'failed') return -1;
                if (recB.status === 'failed' && recA.status !== 'failed') return 1;
                return (recA.interval || 1) - (recB.interval || 1);
            });

            const targetGroupKey = dueGroups[0];
            const rec = this.state.topicRecords[targetGroupKey];
            const groupProbs = this.problems.filter(p => this.getGroupKey(p) === targetGroupKey);
            
            // LA MAGIA: Cerca il primo esercizio di quell'argomento che NON hai mai visto
            let chosen = groupProbs.find(p => !rec.usedIds.includes(p.id));
            
            // Fallback estremo: se hai divorato tutte e 10 le varianti, pesca un rand tra queste
            if (!chosen) chosen = groupProbs[Math.floor(Math.random() * groupProbs.length)];

            this.state.activeProblemId = chosen.id;
            this.state.activeMode = rec.status === 'failed' ? 'RESA' : 'RIPASSO';
            this.saveState();
            return { problem: chosen, mode: this.state.activeMode };
        }

        // 2. FASE NUOVO (PROGRESSIONE A SBLOCCO LINEARE)
        // Estraiamo tutti i gruppi unici mantenendo l'ordine esatto del documento LaTeX
        const uniqueGroups = [...new Set(this.problems.map(p => this.getGroupKey(p)))];
        
        for (const gKey of uniqueGroups) {
            const rec = this.state.topicRecords[gKey];
            // Si ferma al primo argomento che non risulta "passed"
            if (!rec || rec.status !== 'passed') {
                const groupProbs = this.problems.filter(p => this.getGroupKey(p) === gKey);
                const used = rec ? rec.usedIds : [];
                
                // Ti presenta la primissima variante intonsa di quel blocco
                let chosen = groupProbs.find(p => !used.includes(p.id)) || groupProbs[0];

                this.state.activeProblemId = chosen.id;
                this.state.activeMode = 'NUOVO';
                this.saveState();
                return { problem: chosen, mode: 'NUOVO' };
            }
        }

        // 3. FASE CONSOLIDAMENTO: Documento intero sbloccato. 
        // Genera un esercizio rand tra i livelli 3
        const hardProbs = this.problems.filter(p => p.baseDiff >= 3);
        const fallbackPool = hardProbs.length ? hardProbs : this.problems;
        const randomProb = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
        
        this.state.activeProblemId = randomProb.id;
        this.state.activeMode = 'CONSOLIDAMENTO';
        this.saveState();
        return { problem: randomProb, mode: 'CONSOLIDAMENTO' };
    }

    submitEvaluation(problemId, sliderValue) {
        const problem = this.problems.find(p => p.id === problemId);
        if (!problem) return;

        const s = Math.min(1, Math.max(0, parseFloat(sliderValue)));
        const isFailed = (s >= 0.99); // Slider tutto a destra = 1.00
        const gKey = this.getGroupKey(problem);
        
        if (!this.state.topicRecords[gKey]) {
            this.state.topicRecords[gKey] = { status: 'learning', interval: 1, dueDate: null, usedIds: [] };
        }
        
        const rec = this.state.topicRecords[gKey];
        
        // Traccia per bruciare la variante ed evitare di rivederla ai ripassi
        if (!rec.usedIds.includes(problemId)) {
            rec.usedIds.push(problemId);
        }

        // Se dichiari resa, l'intero argomento+difficoltà fallisce e te lo richiede il giorno dopo
        if (isFailed) {
            rec.status = 'failed';
            rec.interval = 1;
        } else {
            // Se fai bene, l'argomento passa a 'passed' e sblocchi il livello successivo nel documento
            rec.status = 'passed';
            const factor = Math.max(1.1, 2.6 - 1.8 * s); // Da 1.1x (ostico) a 2.6x (facile)
            rec.interval = Math.max(1, Math.round((rec.interval || 1) * factor));
        }

        const dueDateObj = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
        dueDateObj.setDate(dueDateObj.getDate() + rec.interval);
        rec.dueDate = dueDateObj.toISOString().split('T')[0];

        const alpha = 0.1;
        const oldEma = this.state.globalEmaMastery ?? 0.50;
        this.state.globalEmaMastery = (alpha * (1 - s)) + ((1 - alpha) * oldEma);

        const today = this.getTodayISO();
        if (!this.state.dailyHistory[today]) {
            this.state.dailyHistory[today] = { count: 0, sumSlider: 0 };
        }
        this.state.dailyHistory[today].count += 1;
        this.state.dailyHistory[today].sumSlider += s;

        this.state.activeProblemId = null; 
        this.saveState();
    }

    getStreakData() {
        const dates = Object.keys(this.state.dailyHistory).sort();
        if (!dates.length) return { current: 0, todayCount: 0 };

        const today = this.getTodayISO();
        const todayCount = this.state.dailyHistory[today]?.count || 0;
        let currentStreak = 0;

        for (let i = dates.length - 1; i >= 0; i--) {
            const d = new Date(dates[i]);
            const diff = (new Date(today) - d) / (1000 * 60 * 60 * 24);
            if (diff > currentStreak + 1) break; 
            if (this.state.dailyHistory[dates[i]].count > 0) currentStreak++;
        }
        return { current: currentStreak, todayCount };
    }

    getCourseProgress(course) {
        // Isola tutti gli esercizi del corso attuale
        const courseProbs = this.problems.filter(p => p.course === course);
        if (!courseProbs.length) return { passed: 0, total: 0, str: "[..........] 0%" };

        // Estrae tutti i gruppi unici (Topic + Difficoltà) mantenendo l'ordine
        const uniqueGroups = [...new Set(courseProbs.map(p => this.getGroupKey(p)))];
        
        let passedCount = 0;
        for (const gKey of uniqueGroups) {
            const rec = this.state.topicRecords[gKey];
            if (rec && rec.status === 'passed') {
                passedCount++;
            } else {
                // Si ferma al primo non superato, calcolando la progressione reale e lineare
                break;
            }
        }

        const total = uniqueGroups.length;
        const pct = Math.round((passedCount / total) * 100);
        
        // Genera la barra brutalista es: [####------]
        const bars = Math.round(pct / 10);
        const barStr = `[${'#'.repeat(bars)}${'-'.repeat(10 - bars)}]`;

        return {
            passed: passedCount,
            total,
            str: `${barStr} ${pct}% (${passedCount}/${total} STEP SUPERATI)`
        };
    }
}
