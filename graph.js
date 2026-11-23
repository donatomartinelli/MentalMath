// MATH-HUB // GRAFO DELLE DIPENDENZE (ex MAPH)
// Nodi: enunciati con \label. Archi: \ref dall'enunciato (o dalla sua dimostrazione) verso un altro enunciato.
// Luminosita' del nodo proporzionale al grado, come in MAPH.
import { GRAPH_LIB_URL } from './config.js';
import { texToHtml, renderMath } from './texlite.js';

let libPromise = null;
let graph = null;
let currentKey = null;

function loadLib() {
    if (window.ForceGraph3D) return Promise.resolve();
    libPromise ??= new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = GRAPH_LIB_URL;
        s.onload = resolve;
        s.onerror = () => { libPromise = null; reject(new Error('3d-force-graph non caricato')); };
        document.head.appendChild(s);
    });
    return libPromise;
}

function buildData(entries, course) {
    const nodesSrc = entries.filter(e => e.label && (!course || e.course === course));
    const ids = new Set(nodesSrc.map(e => e.label));
    const links = [];
    for (const e of nodesSrc) {
        for (const r of e.refs || []) if (ids.has(r)) links.push({ source: r, target: e.label });
    }
    const degree = Object.fromEntries(nodesSrc.map(e => [e.label, 0]));
    for (const l of links) { degree[l.source]++; degree[l.target]++; }
    const maxDeg = Math.max(1, ...Object.values(degree));
    const nodes = nodesSrc.map(e => ({
        id: e.label, name: e.title || e.label.replace(/_/g, ' '), type: e.type, entry: e,
        degree: degree[e.label], maxDeg
    }));
    return { nodes, links };
}

function nodeColor(n) {
    if (n.degree === 0) return '#262626';
    if (n.maxDeg <= 1) return '#ffffff';
    const L = 30 + ((n.degree - 1) / (n.maxDeg - 1)) * 70;
    return `hsl(0, 0%, ${L}%)`;
}

export async function renderGraph(library, course, focusLabel = new URLSearchParams(location.hash.split('?')[1] || '').get('nodo')) {
    const box = document.getElementById('graph-canvas');
    const panel = document.getElementById('graph-panel');
    const status = document.getElementById('graph-status');
    const select = document.getElementById('graph-course');

    if (!select.dataset.ready && library.catalog) {
        select.dataset.ready = '1';
        for (const c of library.courses()) {
            const o = document.createElement('option'); o.value = c.slug; o.textContent = c.title; select.append(o);
        }
        select.addEventListener('change', () => {
            location.hash = select.value ? `#/grafo?corso=${select.value}` : '#/grafo';
        });
    }
    select.value = course || '';

    if (!library.catalog) { status.replaceChildren(library.missing()); return; }
    const data = buildData(library.entries(), course);
    status.textContent = `${data.nodes.length} nodi · ${data.links.length} archi${data.links.length ? '' : ' (aggiungi \\ref tra enunciati per vedere le dipendenze)'}`;

    try { await loadLib(); } catch (err) { status.textContent = err.message; return; }

    const showNode = (n) => {
        const e = n.entry;
        panel.classList.remove('hidden');
        panel.innerHTML = '';
        const h = document.createElement('div');
        h.className = 'stmt-type';
        h.textContent = `${e.type.toUpperCase()}${e.number ? ' ' + e.number : ''} · ${library.courseTitle(e.course)}`;
        const t = document.createElement('div'); t.className = 'stmt-title'; t.textContent = n.name;
        const b = document.createElement('div'); b.className = 'stmt-body'; b.innerHTML = texToHtml(e.body || '');
        const links = document.createElement('div'); links.className = 'stmt-links';
        if (library.hasPdf(e.course)) {
            const a = document.createElement('a');
            a.href = `#/dispense/${e.course}${e.page ? '/' + e.page : ''}`;
            a.textContent = `[ pdf${e.page ? ' p.' + e.page : ''} ]`;
            links.append(a);
        }
        const close = document.createElement('a'); close.href = 'javascript:void 0'; close.textContent = '[ x ]';
        close.addEventListener('click', () => panel.classList.add('hidden'));
        links.append(close);
        panel.append(h, t, b, links);
        renderMath(b);
    };

    const key = course || '*';
    graph?.resumeAnimation();
    if (!graph) {
        graph = window.ForceGraph3D()(box)
            .backgroundColor('#000000')
            .nodeLabel('name')
            .nodeRelSize(3)
            .nodeColor(nodeColor)
            .linkColor(() => '#ffffff')
            .linkOpacity(0.6)
            .linkWidth(0.6)
            .linkDirectionalArrowLength(3.5)
            .linkDirectionalArrowRelPos(1)
            .onBackgroundClick(() => panel.classList.add('hidden'));
        const resize = () => graph.width(box.clientWidth).height(box.clientHeight);
        new ResizeObserver(resize).observe(box);
        resize();
        graph.controls().autoRotate = true;
        graph.controls().autoRotateSpeed = 0.4;
    }
    graph.onNodeClick(n => {
        showNode(n);
        const r = 1 + 80 / Math.hypot(n.x || 1, n.y || 1, n.z || 1);
        graph.cameraPosition({ x: n.x * r, y: n.y * r, z: n.z * r }, n, 1500);
    });
    if (currentKey !== key) {
        currentKey = key;
        graph.graphData(data);
    }
    if (focusLabel) {
        const n = graph.graphData().nodes.find(x => x.id === focusLabel);
        if (n) setTimeout(() => { showNode(n); const r = 1 + 80 / Math.hypot(n.x || 1, n.y || 1, n.z || 1); graph.cameraPosition({ x: n.x * r, y: n.y * r, z: n.z * r }, n, 1500); }, 800);
    }
}

// Fuori dalla pagina del grafo il rendering WebGL si ferma (risparmia CPU/batteria)
export function pauseGraph() { graph?.pauseAnimation(); }
export function resumeGraph() { graph?.resumeAnimation(); }
