// MATH-HUB // MAIN APPLICATION CONTROLLER (router a hash + moduli)
import { Library } from './library.js';
import { setBackdrop } from './backdrop.js';

const library = new Library();

window.addEventListener('DOMContentLoaded', async () => {
    startClock();
    const libraryReady = library.load(); // manifest PDF + catalogo
    window.addEventListener('hashchange', route);
    route();
    await libraryReady; // la pagina funziona anche senza
    route();
});

function startClock() {
    const el = document.getElementById('clock');
    const tick = () => { el.textContent = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); };
    tick();
    setInterval(tick, 15000);
}

// --- ROUTER ----------------------------------------------------------------------
// #/                       home
// #/dispense[/slug[/pag]]  elenco PDF o visualizzatore
// #/enunciati[?q=..]       indice di definizioni e teoremi
// #/docs
const ROUTES = ['home', 'dispense', 'enunciati', 'docs'];

function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, query = ''] = raw.split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    const name = ROUTES.includes(parts[0]) ? parts[0] : 'home';
    return { name, args: parts.slice(1), query: new URLSearchParams(query) };
}

function route() {
    const { name, args, query } = parseHash();
    document.querySelectorAll('[data-route]').forEach(sec => sec.classList.toggle('hidden', sec.dataset.route !== name));
    document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
    document.getElementById('prompt-path').textContent = name === 'home' ? '~' : `~/${[name, ...args].join('/')}`;
    document.title = name === 'home' ? 'math-hub' : `${name} · math-hub`;

    if (name === 'home') library.renderHome();
    if (name === 'dispense') library.renderDispense(args[0], args[1]);
    if (name === 'enunciati') library.renderEnunciati(query);
    // lo sfondo e' decorativo: un suo errore non deve mai fermare il resto
    try { setBackdrop(name, args, query); } catch (err) { console.warn('sfondo', err); }
    window.scrollTo(0, 0);
}
