import { problemBank } from './problemBank.js';

export class MathEngine {
    constructor() {
        this.weightsKey = 'mathHubWeights';
        this.weights = JSON.parse(localStorage.getItem(this.weightsKey)) || {};
        this.initWeights();
    }

    initWeights() {
        problemBank.forEach(p => {
            if (!this.weights[p.id]) this.weights[p.id] = 100; // Peso base
        });
        this.saveWeights();
    }

    saveWeights() {
        localStorage.setItem(this.weightsKey, JSON.stringify(this.weights));
    }

    getCourses() { return [...new Set(problemBank.map(p => p.course))]; }
    
    getModulesForCourse(course) { return [...new Set(problemBank.filter(p => p.course === course).map(p => p.module))]; }

    generateProblem(course, module) {
        const pool = problemBank.filter(p => p.course === course && (module === 'Tutti' || p.module === module));
        if (pool.length === 0) return null;

        // Estrazione randomica pesata
        const totalWeight = pool.reduce((sum, p) => sum + this.weights[p.id], 0);
        let rand = Math.random() * totalWeight;
        
        for (let p of pool) {
            if (rand < this.weights[p.id]) return p;
            rand -= this.weights[p.id];
        }
        return pool[pool.length - 1];
    }

    evaluateProblem(problemId, rating) {
        let currentWeight = this.weights[problemId];
        switch(rating) {
            case 'wrong': currentWeight *= 1.5; break; // Appare più spesso
            case 'hard': currentWeight *= 1.1; break;
            case 'good': currentWeight *= 0.8; break;
            case 'easy': currentWeight *= 0.5; break;  // Appare meno spesso
        }
        this.weights[problemId] = Math.max(10, Math.min(currentWeight, 1000));
        this.saveWeights();
    }
}