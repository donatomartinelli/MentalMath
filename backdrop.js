// MATH-HUB // SFONDO: un campo vettoriale ai lati della colonna centrale, diverso per scheda e per materia
import { FlowField, FIELDS } from './field.js';

// materia -> campo (slug dei PDF di math-tex)
const BY_COURSE = {
    analisi: 'van-der-pol', algebra: 'lineare', geometria: 'sella',
    fisica: 'pendolo', 'meccanica-razionale': 'kepler', 'calcolo-scientifico': 'newton',
};
// scheda -> campo
const BY_ROUTE = { home: 'pendolo', dispense: 'spirale', enunciati: 'onde', docs: 'vortici' };

let ff = null, label = null, current = null;

function init() {
    const canvas = document.createElement('canvas');
    canvas.className = 'bg-field';
    canvas.setAttribute('aria-hidden', 'true');
    label = document.createElement('span');
    label.className = 'bg-field-label';
    document.body.prepend(canvas);
    document.body.append(label);
    const narrow = !matchMedia('(min-width: 1280px)').matches;
    ff = new FlowField(canvas, { mouse: document, density: narrow ? 1 / 2600 : 1 / 1400, maxParticles: 1100, unit: 0.16, alpha: 0.75, fade: 0.06, vortex: 1.6 });
}

export function setBackdrop(route, args = [], query = new URLSearchParams()) {
    if (!ff) init();
    const course = (route === 'dispense' && args[0]) || query.get('corso') || '';
    const name = BY_COURSE[course] || BY_ROUTE[route] || 'pendolo';
    if (name !== current) {
        current = name;
        ff.set(name);
        label.textContent = `$ field --${name}   ${FIELDS[name].eq}`;
    }
    // su schermi stretti non ci sono lati liberi: il campo passa dietro al contenuto, molto tenue (vedi style.css)
    ff.start();
}
