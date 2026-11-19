// MATH-HUB // PROBLEM ENGINE (CORSI ISOLATI + ANKI INEDITO)
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
            topicRecords: {}, 
            dailyHistory: {},   
            activeProblemId: null,
            activeMode: 'NUOVO',
            activeCourse: null, // TRACCIA IL CORSO ATTUALE
            globalEmaMastery: 0.5
        };
    }

    saveState() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    }

    setProblems(problemsArray) {
        this.problems = problemsArray;
    }

    getGroupKey(p) {
        return `${p.course}::${p.topic}::${p.baseDiff}`;
    }

    // Estrae i nomi dei corsi disponibili dal JSON
    getAvailableCourses() {
        const courses = [];
        for (const p of this.problems) {
            if (!courses.includes(p.course)) courses.push(p.course);
        }
        return courses;
    }

    // Imposta il corso su cui vuoi lavorare
    setActiveCourse(courseName) {
        this.state.activeCourse = courseName;
        this.state.activeProblemId = null; // Forza il calcolo del nuovo problema
        this.saveState();
    }

    getNextProblem(forceRecompute = false) {
        if (!this.problems.length || !this.state.activeCourse) return null;

        // ISOLA I PROBLEMI SOLO DEL CORSO ATTIVO
        const courseProbs = this.problems.filter(p => p.course === this.state.activeCourse);
        if (!courseProbs.length) return null;

        if (!forceRecompute && this.state.activeProblemId) {
            const locked = courseProbs.find(p => p.id === this.state.activeProblemId);
            if (locked) return { problem: locked, mode: this.state.activeMode || 'IN CORSO' };
        }

        const today = this.getTodayISO();
        // uniqueGroups rispetta l'ordine esatto di estrazione dal file LaTeX
        const uniqueGroups = [...new Set(courseProbs.map(p => this.getGroupKey(p)))];

        // 1. FASE RIPASSO (ANKI): Cerca scadenze *solo* nel corso attuale
        const dueGroups = uniqueGroups.filter(key => {
            const rec = this.state.topicRecords[key];
            return rec && rec.dueDate && rec.dueDate <= today && (rec.status === 'passed' || rec.status === 'failed');
        });

        if (dueGroups.length > 0) {
            dueGroups.sort((a, b) => {
                const recA = this.state.topicRecords[a], recB = this.state.topicRecords[b];
                if (recA.status === 'failed' && recB.status !== 'failed') return -1;
                if (recB.status === 'failed' && recA.status !== 'failed') return 1;
                return (recA.interval || 1) - (recB.interval || 1);
            });

            const targetGroupKey = dueGroups[0];
            const rec = this.state.topicRecords[targetGroupKey];
            const groupSubset = courseProbs.filter(p => this.getGroupKey(p) === targetGroupKey);
            
            let chosen = groupSubset.find(p => !rec.usedIds.includes(p.id));
            if (!chosen) chosen = groupSubset[Math.floor(Math.random() * groupSubset.length)];

            this.state.activeProblemId = chosen.id;
            this.state.activeMode = rec.status === 'failed' ? 'RESA' : 'RIPASSO';
            this.saveState();
            return { problem: chosen, mode: this.state.activeMode };
        }

        // 2. FASE NUOVO (PROGRESSIONE LINEARE)
        for (const gKey of uniqueGroups) {
            const rec = this.state.topicRecords[gKey];
            if (!rec || rec.status !== 'passed') {
                const groupSubset = courseProbs.filter(p => this.getGroupKey(p) === gKey);
                const used = rec ? rec.usedIds : [];
                let chosen = groupSubset.find(p => !used.includes(p.id)) || groupSubset[0];

                this.state.activeProblemId = chosen.id;
                this.state.activeMode = 'NUOVO';
                this.saveState();
                return { problem: chosen, mode: 'NUOVO' };
            }
        }

        // 3. FASE CONSOLIDAMENTO
        const hardProbs = courseProbs.filter(p => p.baseDiff >= 3);
        const fallbackPool = hardProbs.length ? hardProbs : courseProbs;
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
        const isFailed = (s >= 0.99); 
        const gKey = this.getGroupKey(problem);
        
        if (!this.state.topicRecords[gKey]) {
            this.state.topicRecords[gKey] = { status: 'learning', interval: 1, dueDate: null, usedIds: [] };
        }
        const rec = this.state.topicRecords[gKey];
        if (!rec.usedIds.includes(problemId)) rec.usedIds.push(problemId);

        if (isFailed) {
            rec.status = 'failed';
            rec.interval = 1;
        } else {
            rec.status = 'passed';
            const factor = Math.max(1.1, 2.6 - 1.8 * s);
            rec.interval = Math.max(1, Math.round((rec.interval || 1) * factor));
        }

        const dueDateObj = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
        dueDateObj.setDate(dueDateObj.getDate() + rec.interval);
        rec.dueDate = dueDateObj.toISOString().split('T')[0];

        const today = this.getTodayISO();
        if (!this.state.dailyHistory[today]) this.state.dailyHistory[today] = { count: 0, sumSlider: 0 };
        this.state.dailyHistory[today].count += 1;
        this.state.dailyHistory[today].sumSlider += s;

        this.state.activeProblemId = null; 
        this.saveState();
    }

    getCourseProgress(course) {
        const courseProbs = this.problems.filter(p => p.course === course);
        if (!courseProbs.length) return { passed: 0, total: 0, str: "[..........] 0%" };

        const uniqueGroups = [...new Set(courseProbs.map(p => this.getGroupKey(p)))];
        let passedCount = 0;
        for (const gKey of uniqueGroups) {
            const rec = this.state.topicRecords[gKey];
            if (rec && rec.status === 'passed') passedCount++;
            else break; // Si ferma alla prima lacuna
        }

        const total = uniqueGroups.length;
        const pct = Math.round((passedCount / total) * 100);
        const bars = Math.round(pct / 10);
        const barStr = `[${'#'.repeat(bars)}${'-'.repeat(10 - bars)}]`;

        return { passed: passedCount, total, str: `${barStr} ${pct}% (${passedCount}/${total})` };
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
}