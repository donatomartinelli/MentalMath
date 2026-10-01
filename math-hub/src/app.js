import { MathEngine } from './mathEngine.js';

const engine = new MathEngine();
let currentProblem = null;

const DOM = {
    selects: { course: document.getElementById('select-course'), module: document.getElementById('select-module') },
    screens: { idle: document.getElementById('idle-screen'), problem: document.getElementById('problem-screen') },
    problem: { 
        topicLabel: document.getElementById('topic-label'), theory: document.getElementById('theory-container'),
        math: document.getElementById('math-problem'), solutionContainer: document.getElementById('solution-container'),
        solution: document.getElementById('math-solution'), steps: document.getElementById('math-steps')
    },
    btns: { 
        start: document.getElementById('btn-start'), theory: document.getElementById('btn-theory'), 
        showSolution: document.getElementById('btn-show-solution'), closeApp: document.getElementById('btn-close-app')
    }
};

// CHIUSURA UNIVERSALE TAURI (Gestisce sia v1 che v2 senza crashare)
DOM.btns.closeApp.addEventListener('click', () => {
    import('@tauri-apps/api/window').then(module => {
        if (module.getCurrentWindow) module.getCurrentWindow().close(); // Tauri v2
        else if (module.appWindow) module.appWindow.close(); // Tauri v1
    }).catch(err => {
        console.error("Errore import Tauri:", err);
        // Fallback per chiudere l'app in ambienti non standard
        if (window.__TAURI__) window.__TAURI__.process.exit(0);
    });
});

const renderKaTeX = (texString, element, isDisplay = true) => {
    katex.render(texString, element, { throwOnError: false, displayMode: isDisplay });
};

const loadCourses = () => {
    const courses = engine.getCourses();
    DOM.selects.course.innerHTML = courses.map(c => `<option value="${c}">${c}</option>`).join('');
    updateModules();
};

const updateModules = () => {
    const modules = engine.getModulesForCourse(DOM.selects.course.value);
    DOM.selects.module.innerHTML = `<option value="Tutti">/// TUTTI I MODULI</option>` + 
        modules.map(m => `<option value="${m}">- ${m}</option>`).join('');
};

DOM.selects.course.addEventListener('change', updateModules);

const loadNewProblem = () => {
    currentProblem = engine.generateProblem(DOM.selects.course.value, DOM.selects.module.value);
    if (!currentProblem) return alert("ERRORE: Nessun record trovato nel database.");

    DOM.screens.idle.classList.add('hidden');
    DOM.screens.problem.classList.remove('hidden');

    DOM.problem.theory.classList.add('hidden');
    DOM.problem.solutionContainer.classList.add('hidden');
    DOM.btns.showSolution.classList.remove('hidden');
    
    DOM.problem.topicLabel.textContent = `TARGET: ${currentProblem.course} // ${currentProblem.topic}`;
    DOM.problem.theory.textContent = currentProblem.theory_snippet;
    
    renderKaTeX(currentProblem.problem_tex, DOM.problem.math);
    renderKaTeX(currentProblem.solution_tex, DOM.problem.solution);
    
    DOM.problem.steps.innerHTML = '';
    currentProblem.steps_tex.forEach(step => {
        const div = document.createElement('div');
        renderKaTeX(step, div, false);
        DOM.problem.steps.appendChild(div);
    });
};

DOM.btns.start.onclick = loadNewProblem;
DOM.btns.theory.onclick = () => DOM.problem.theory.classList.toggle('hidden');

DOM.btns.showSolution.onclick = () => {
    DOM.problem.solutionContainer.classList.remove('hidden');
    DOM.btns.showSolution.classList.add('hidden'); 
    DOM.problem.solutionContainer.scrollIntoView({ behavior: 'smooth' });
};

document.querySelectorAll('.btn-eval').forEach(btn => {
    btn.onclick = (e) => {
        engine.evaluateProblem(currentProblem.id, e.currentTarget.getAttribute('data-rating'));
        DOM.screens.problem.classList.add('hidden');
        DOM.screens.idle.classList.remove('hidden');
        DOM.screens.idle.textContent = "COMPUTING...";
        
        setTimeout(() => loadNewProblem(), 150); 
    };
});

window.onload = loadCourses;