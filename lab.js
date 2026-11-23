// MATH-HUB // LABORATORIO: campi vettoriali con traiettorie (RK4) e trasformazioni lineari 2x2
import { FlowField, FIELDS, FIELD_NAMES, compileField } from './field.js';

const el = (tag, attrs = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v);
    }
    n.append(...children.filter(c => c !== null && c !== undefined));
    return n;
};
const fmt = (v) => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(2).replace(/\.?0+$/, '') || '0';

// ===================================================================================
// CAMPI
// ===================================================================================
class FieldLab {
    constructor(root) {
        this.root = root;
        this.name = 'pendolo';
        this.paths = [];
        const flow = el('canvas', { class: 'lab-flow' });
        this.over = el('canvas', { class: 'lab-over' });
        this.stage = el('div', { class: 'lab-stage' }, flow, this.over,
            el('span', { class: 'lab-hint dim small', text: 'clic: traiettoria (RK4, avanti e indietro) · il cursore aggiunge un vortice' }));
        this.presets = el('div', { class: 'lab-presets' });
        for (const n of FIELD_NAMES) this.presets.append(el('a', { href: `#/lab/campi?f=${n}`, 'data-f': n, text: n }));

        this.fx = el('input', { type: 'text', spellcheck: 'false', 'aria-label': "x'" });
        this.fy = el('input', { type: 'text', spellcheck: 'false', 'aria-label': "y'" });
        this.err = el('span', { class: 'lab-err small' });
        this.eq = el('div', { class: 'lab-eq dim' });
        this.arrowsBtn = el('button', { class: 'btn', type: 'button', text: '[ frecce ]', onclick: () => this.toggleArrows() });
        this.speed = el('input', { type: 'range', min: '0.2', max: '3', step: '0.1', value: '1', 'aria-label': 'velocita' });
        const form = el('form', { class: 'lab-form', autocomplete: 'off' },
            el('label', {}, el('span', { text: "x' =" }), this.fx),
            el('label', {}, el('span', { text: "y' =" }), this.fy),
            el('button', { class: 'btn', type: 'submit', text: '[ applica ]' }), this.err);
        form.addEventListener('submit', (e) => { e.preventDefault(); this.applyCustom(); });
        [this.fx, this.fy].forEach(i => i.addEventListener('input', () => { this.err.textContent = ''; }));

        root.append(this.presets, form,
            el('div', { class: 'lab-row' },
                el('button', { class: 'btn', type: 'button', text: '[ pulisci ]', onclick: () => this.clearPaths() }),
                this.arrowsBtn,
                el('label', { class: 'lab-range dim small' }, 'velocita ', this.speed)),
            this.stage, this.eq,
            el('p', { class: 'dim small', text: "variabili x, y, t; funzioni sin cos tan exp log sqrt abs atan sinh cosh tanh pow min max; potenze con ^. esempio: x' = y, y' = -x + (1 - x^2)*y" }));

        this.ff = new FlowField(flow, { mouse: this.stage, unit: 0.15, density: 1 / 700, alpha: 0.85, fade: 0.08 });
        this.speed.addEventListener('input', () => { this.ff.o.speed = +this.speed.value; });
        new ResizeObserver(() => this.sizeOverlay()).observe(this.over);
        this.over.addEventListener('click', (e) => {
            const r = this.over.getBoundingClientRect();
            const [x, y] = this.ff.toWorld(e.clientX - r.left, e.clientY - r.top);
            this.paths.push([x, y]);
            this.drawPaths();
        });
    }

    show(query) {
        const f = query.get('f');
        if (f && FIELDS[f] && f !== this.name) this.usePreset(f);
        else if (!this.started) this.usePreset(this.name);
        this.started = true;
        this.ff.resize();
        this.sizeOverlay();
        this.ff.start();
    }
    hide() { this.ff.stop(); }

    usePreset(n) {
        this.name = n;
        const F = FIELDS[n];
        this.ff.set(F.f);
        this.fx.value = F.ex ? F.ex[0] : '';
        this.fy.value = F.ex ? F.ex[1] : '';
        this.fx.placeholder = this.fy.placeholder = F.ex ? '' : 'campo predefinito: scrivine uno tuo';
        this.eq.textContent = `$ field --${n}   ${F.eq}`;
        this.presets.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.f === n));
        this.clearPaths();
    }

    applyCustom() {
        this.err.textContent = '';
        try {
            const f = compileField(this.fx.value, this.fy.value);
            this.name = 'custom';
            this.ff.set(f);
            this.eq.textContent = `$ field --custom   x' = ${this.fx.value.trim()}   y' = ${this.fy.value.trim()}`;
            this.presets.querySelectorAll('a').forEach(a => a.classList.remove('on'));
            this.clearPaths();
        } catch (e) {
            this.err.textContent = e.message;
        }
    }

    toggleArrows() {
        this.ff.o.arrows = !this.ff.o.arrows;
        this.arrowsBtn.classList.toggle('on', this.ff.o.arrows);
    }

    sizeOverlay() {
        const d = Math.min(window.devicePixelRatio || 1, 2), c = this.over;
        if (!c.clientWidth) return;
        c.width = Math.round(c.clientWidth * d); c.height = Math.round(c.clientHeight * d);
        c.getContext('2d').setTransform(d, 0, 0, d, 0, 0);
        this.drawPaths();
    }

    clearPaths() { this.paths = []; this.drawPaths(); }

    drawPaths() {
        const c = this.over, ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
        const line = (pts, style, dash) => {
            if (pts.length < 2) return;
            ctx.strokeStyle = style; ctx.setLineDash(dash); ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
            for (const p of pts) ctx.lineTo(p[0], p[1]);
            ctx.stroke();
        };
        for (const [x, y] of this.paths) {
            const { forward, backward } = this.ff.trajectory(x, y);
            line(backward, 'rgba(255,255,255,0.45)', [4, 4]);
            line(forward, '#fff', []);
            const [sx, sy] = this.ff.toScreen(x, y);
            ctx.setLineDash([]);
            ctx.fillStyle = '#000'; ctx.strokeStyle = '#fff';
            ctx.fillRect(sx - 4, sy - 4, 8, 8); ctx.strokeRect(sx - 4, sy - 4, 8, 8);
            ctx.font = '11px "JetBrains Mono", monospace'; ctx.fillStyle = '#bbb';
            ctx.fillText(`(${fmt(x)}, ${fmt(y)})`, sx + 8, sy - 8);
        }
    }
}

// ===================================================================================
// MATRICE 2x2
// ===================================================================================
const MATRICES = {
    rotazione: [0, -1, 1, 0],
    taglio: [1, 1, 0, 1],
    scala: [1.5, 0, 0, 0.5],
    riflessione: [1, 0, 0, -1],
    sella: [1.2, 0.4, 0.6, -0.8],
    fuoco: [0.3, -1, 1.2, -0.4],
    proiezione: [1, 0, 0, 0],
};

class MatrixLab {
    constructor(root) {
        this.root = root;
        this.A = [...MATRICES.fuoco];
        this.t = 1;
        this.inputs = ['a', 'b', 'c', 'd'].map((n, i) => el('input', { type: 'number', step: '0.1', 'aria-label': n, value: this.A[i] }));
        this.inputs.forEach((inp, i) => inp.addEventListener('input', () => {
            const v = parseFloat(inp.value);
            if (Number.isFinite(v)) { this.A[i] = v; this.update(); }
        }));
        const presets = el('div', { class: 'lab-presets' });
        for (const [n, m] of Object.entries(MATRICES)) presets.append(el('a', { href: '#', text: n, onclick: (e) => { e.preventDefault(); this.setMatrix(m); } }));
        this.slider = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '1', 'aria-label': 't' });
        this.slider.addEventListener('input', () => { this.t = +this.slider.value; this.draw(); });
        this.info = el('div', { class: 'lab-info' });
        this.flowBtn = el('button', { class: 'btn on', type: 'button', text: "[ flusso x' = Ax ]", onclick: () => this.toggleFlow() });

        const flow = el('canvas', { class: 'lab-flow' });
        this.grid = el('canvas', { class: 'lab-over' });
        const stage = el('div', { class: 'lab-stage square' }, flow, this.grid);
        const matrix = el('div', { class: 'lab-matrix' }, el('span', { class: 'bracket', text: 'A =' }),
            el('div', { class: 'cells' }, ...this.inputs));

        root.append(presets,
            el('div', { class: 'lab-split' },
                el('div', { class: 'lab-side' }, matrix,
                    el('label', { class: 'lab-range dim small' }, 't ', this.slider),
                    el('div', { class: 'lab-row' },
                        el('button', { class: 'btn', type: 'button', text: '[ anima ]', onclick: () => this.animate() }),
                        this.flowBtn),
                    this.info,
                    el('p', { class: 'dim small', text: "la griglia mostra (1-t) I + t A applicata al piano: e1 ed e2 vanno nelle colonne di A, l'area si moltiplica per det A. sotto scorre il sistema x' = A x." })),
                stage));

        this.ff = new FlowField(flow, { mouse: null, unit: 0.11, density: 1 / 900, alpha: 0.35, fade: 0.09 });
        this.ff.set((x, y) => [this.A[0] * x + this.A[1] * y, this.A[2] * x + this.A[3] * y]);
        new ResizeObserver(() => this.size()).observe(this.grid);
    }

    show() { this.ff.resize(); this.size(); if (this.flowOn !== false) this.ff.start(); }
    hide() { this.ff.stop(); cancelAnimationFrame(this.anim); }

    setMatrix(m) {
        this.A = [...m];
        this.inputs.forEach((inp, i) => { inp.value = m[i]; });
        this.update();
        this.animate();
    }
    update() { this.ff.clear(); this.draw(); }

    toggleFlow() {
        this.flowOn = this.flowOn === false;
        this.flowBtn.classList.toggle('on', this.flowOn);
        if (this.flowOn) this.ff.start(); else { this.ff.stop(); this.ff.clear(); }
    }

    animate() {
        cancelAnimationFrame(this.anim);
        const t0 = performance.now();
        const step = (now) => {
            const u = Math.min(1, (now - t0) / 1200);
            this.t = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
            this.slider.value = this.t;
            this.draw();
            if (u < 1) this.anim = requestAnimationFrame(step);
        };
        this.anim = requestAnimationFrame(step);
    }

    size() {
        const d = Math.min(window.devicePixelRatio || 1, 2), c = this.grid;
        if (!c.clientWidth) return;
        c.width = Math.round(c.clientWidth * d); c.height = Math.round(c.clientHeight * d);
        c.getContext('2d').setTransform(d, 0, 0, d, 0, 0);
        this.draw();
    }

    draw() {
        const c = this.grid, ctx = c.getContext('2d'), W = c.clientWidth, H = c.clientHeight;
        if (!W) return;
        const S = Math.min(W, H) * 0.11, t = this.t, A = this.A;
        const M = [1 - t + t * A[0], t * A[1], t * A[2], 1 - t + t * A[3]];
        const P = (x, y) => [W / 2 + (M[0] * x + M[1] * y) * S, H / 2 - (M[2] * x + M[3] * y) * S];
        const seg = (a, b) => { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); };
        ctx.clearRect(0, 0, W, H);
        ctx.setLineDash([]);

        // griglia originale (fissa, molto tenue)
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let k = -12; k <= 12; k++) { seg([W / 2 + k * S, 0], [W / 2 + k * S, H]); seg([0, H / 2 - k * S], [W, H / 2 - k * S]); }
        ctx.stroke();
        // griglia trasformata
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath();
        for (let k = -10; k <= 10; k++) { seg(P(k, -10), P(k, 10)); seg(P(-10, k), P(10, k)); }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); seg(P(-10, 0), P(10, 0)); seg(P(0, -10), P(0, 10)); ctx.stroke();

        // quadrato unitario -> parallelogramma
        const q = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(...q[0]); q.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath(); ctx.fill();

        // autovettori (reali) di A, tratteggiati
        const tr = A[0] + A[3], det = A[0] * A[3] - A[1] * A[2], disc = tr * tr - 4 * det;
        const eig = [];
        if (disc >= 0) {
            for (const l of [(tr + Math.sqrt(disc)) / 2, (tr - Math.sqrt(disc)) / 2]) {
                let v = Math.abs(A[1]) > 1e-9 ? [A[1], l - A[0]] : Math.abs(A[2]) > 1e-9 ? [l - A[3], A[2]] : (Math.abs(l - A[0]) < 1e-9 ? [1, 0] : [0, 1]);
                const m = Math.hypot(...v); v = [v[0] / m, v[1] / m];
                eig.push({ l, v });
            }
            ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.setLineDash([6, 5]); ctx.beginPath();
            for (const { v } of eig) seg([W / 2 - v[0] * 20 * S, H / 2 + v[1] * 20 * S], [W / 2 + v[0] * 20 * S, H / 2 - v[1] * 20 * S]);
            ctx.stroke(); ctx.setLineDash([]);
        }

        // immagini di e1 ed e2
        const arrow = (to, name) => {
            const o = P(0, 0), dx = to[0] - o[0], dy = to[1] - o[1], m = Math.hypot(dx, dy) || 1, ux = dx / m, uy = dy / m;
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); seg(o, to);
            seg(to, [to[0] - 9 * ux + 5 * uy, to[1] - 9 * uy - 5 * ux]); seg(to, [to[0] - 9 * ux - 5 * uy, to[1] - 9 * uy + 5 * ux]);
            ctx.stroke(); ctx.lineWidth = 1;
            ctx.font = '13px "JetBrains Mono", monospace'; ctx.fillStyle = '#fff'; ctx.fillText(name, to[0] + 6, to[1] - 6);
        };
        arrow(P(1, 0), 'Ae1'); arrow(P(0, 1), 'Ae2');

        // numeri
        let kind;
        if (Math.abs(det) < 1e-9) kind = 'singolare (il piano collassa su una retta)';
        else if (det < 0) kind = 'sella';
        else if (disc < 0) kind = Math.abs(tr) < 1e-9 ? 'centro (orbite chiuse)' : tr < 0 ? 'fuoco stabile' : 'fuoco instabile';
        else kind = tr < 0 ? 'nodo stabile' : 'nodo instabile';
        const ev = disc >= 0 ? eig.map(e => fmt(e.l)).join(', ')
            : `${fmt(tr / 2)} ± ${fmt(Math.sqrt(-disc) / 2)} i`;
        this.info.replaceChildren(
            ...[['det A', `${fmt(det)}  (area × ${fmt(Math.abs(det))}${det < 0 ? ', orientazione invertita' : ''})`],
                ['tr A', fmt(tr)], ['autovalori', ev], ["x' = Ax", kind]]
                .map(([k, v]) => el('div', {}, el('span', { class: 'dim', text: k }), el('span', { text: v }))));
    }
}

// ===================================================================================
let fieldLab = null, matrixLab = null;
export function renderLab(sub, query) {
    const tab = sub === 'matrice' ? 'matrice' : 'campi';
    const fRoot = document.getElementById('lab-campi'), mRoot = document.getElementById('lab-matrice');
    document.querySelectorAll('[data-lab]').forEach(a => a.classList.toggle('on', a.dataset.lab === tab));
    fRoot.classList.toggle('hidden', tab !== 'campi');
    mRoot.classList.toggle('hidden', tab !== 'matrice');
    if (tab === 'campi') { fieldLab ||= new FieldLab(fRoot); matrixLab?.hide(); fieldLab.show(query); }
    else { matrixLab ||= new MatrixLab(mRoot); fieldLab?.hide(); matrixLab.show(); }
}
export function pauseLab() { fieldLab?.hide(); matrixLab?.hide(); }
