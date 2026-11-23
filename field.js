// MATH-HUB // CAMPI VETTORIALI ANIMATI (canvas, nessuna dipendenza)
// Lo stesso motore disegna lo sfondo ai lati delle schede, il laboratorio (#/lab) e la home del sito.
// Coordinate "mondo" con y verso l'alto; le particelle seguono il campo con passi RK2 e lasciano una scia.

const { sin, cos, hypot } = Math;

// campo complesso del metodo di Newton per p(z) = z^3 - 1:  z' = -p(z)/p'(z)
const newton = (x, y) => {
    const x2 = x * x - y * y, y2 = 2 * x * y;              // z^2
    const px = x2 * x - y2 * y - 1, py = x2 * y + y2 * x;   // z^3 - 1
    const qx = 3 * x2, qy = 3 * y2;                         // 3 z^2
    const d = qx * qx + qy * qy + 1e-9;
    return [-(px * qx + py * qy) / d, -(py * qx - px * qy) / d];
};

const vortex = (x, y, a, b, s) => { const dx = x - a, dy = y - b, r = dx * dx + dy * dy + 0.08; return [-s * dy / r, s * dx / r]; };

export const FIELDS = {
    pendolo:      { ex: ['y', '-sin(1.4*x) - 0.15*y'], eq: "x' = y   y' = -sin x - 0.15 y",        f: (x, y) => [y, -sin(x * 1.4) - 0.15 * y] },
    'van-der-pol':{ ex: ['y', '(1 - x^2)*y - x'], eq: "x' = y   y' = (1 - x²) y - x",          f: (x, y) => [y, (1 - x * x) * y - x] },
    dipolo:       { eq: 'E = q r₊/|r₊|³ - q r₋/|r₋|³',          f: (x, y) => {
        const g = (a, s) => { const dx = x - a, dy = y, r = Math.pow(dx * dx + dy * dy + 0.03, 1.5); return [s * dx / r, s * dy / r]; };
        const p = g(-0.9, 1), m = g(0.9, -1); return [p[0] + m[0], p[1] + m[1]];
    } },
    sella:        { ex: ['x', '-y'], eq: "x' = x   y' = -y",                     f: (x, y) => [x, -y] },
    spirale:      { ex: ['-0.2*x - y', 'x - 0.2*y'], eq: "x' = -0.2x - y   y' = x - 0.2y",       f: (x, y) => [-0.2 * x - y, x - 0.2 * y] },
    lineare:      { ex: ['0.3*x - y', '1.2*x - 0.4*y'], eq: "x' = A x,  A = [[0.3, -1], [1.2, -0.4]]", f: (x, y) => [0.3 * x - y, 1.2 * x - 0.4 * y] },
    kepler:       { ex: ['-y/(x^2+y^2+0.05)^0.75 - 0.08*x', 'x/(x^2+y^2+0.05)^0.75 - 0.08*y'], eq: "r'' = -r/|r|³  (campo centrale)",      f: (x, y) => { const r = Math.pow(x * x + y * y + 0.05, 0.75); return [-y / r - 0.08 * x, x / r - 0.08 * y]; } },
    newton:       { eq: "z' = -p(z)/p'(z),  p(z) = z³ - 1",      f: newton },
    vortici:      { eq: 'tre vortici puntiformi',               f: (x, y) => {
        const a = vortex(x, y, -1.2, 0.4, 0.8), b = vortex(x, y, 1.1, -0.3, -0.9), c = vortex(x, y, 0, 1.1, 0.6);
        return [a[0] + b[0] + c[0] + 0.15, a[1] + b[1] + c[1]];
    } },
    onde:         { ex: ['sin(y + 0.6*t)', 'cos(x - 0.4*t)'], eq: "x' = sin(y + t)   y' = cos(x - t)",     f: (x, y, t) => [sin(y + t * 0.6), cos(x - t * 0.4)] },
};
export const FIELD_NAMES = Object.keys(FIELDS);

// --- espressioni scritte a mano: x' = ..., y' = ... (solo numeri, x, y, t e funzioni matematiche) ---
const ALLOWED = new Set(['x', 'y', 't', 'sin', 'cos', 'tan', 'exp', 'log', 'sqrt', 'abs', 'atan', 'atan2', 'sinh', 'cosh', 'tanh',
    'pow', 'min', 'max', 'sign', 'floor', 'pi', 'e']);
export function compileField(fx, fy) {
    const prep = (s) => {
        const src = String(s).trim();
        if (!src) throw new Error('espressione vuota');
        if (!/^[0-9a-z+\-*/^().,\s]*$/i.test(src)) throw new Error(`carattere non ammesso in "${src}"`);
        for (const id of src.match(/[a-z_]+/gi) || []) if (!ALLOWED.has(id.toLowerCase())) throw new Error(`"${id}" non riconosciuto`);
        return src.toLowerCase().replace(/\^/g, '**');
    };
    const body = `const {sin,cos,tan,exp,log,sqrt,abs,atan,atan2,sinh,cosh,tanh,pow,min,max,sign,floor}=Math;const pi=Math.PI,e=Math.E;` +
        `return [(${prep(fx)}),(${prep(fy)})];`;
    const f = new Function('x', 'y', 't', body);
    const probe = f(0.3, -0.7, 0);
    if (!probe.every(Number.isFinite)) throw new Error('il campo non e\' finito in (0.3, -0.7)');
    return f;
}

// --- motore -------------------------------------------------------------------------------
export class FlowField {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.o = {
            density: 1 / 900,      // particelle per px²
            maxParticles: 1600,
            unit: 0.17,            // px per unita' = min(W, H) * unit
            speed: 1,
            fade: 0.07,            // quanto velocemente svaniscono le scie
            color: '255,255,255',
            alpha: 0.9,
            arrows: false,         // griglia di frecce sotto le particelle
            mouse: null,           // elemento da cui leggere il cursore (vortice), null = nessuno
            vortex: 2.2,
            ...opts,
        };
        this.field = FIELDS.pendolo.f;
        this.t = 0;
        this.running = false;
        this.pointer = null;
        this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.resize = this.resize.bind(this);
        this.frame = this.frame.bind(this);
        new ResizeObserver(this.resize).observe(canvas);
        if (this.o.mouse) {
            const tgt = this.o.mouse;
            tgt.addEventListener('pointermove', e => {
                const r = canvas.getBoundingClientRect();
                const px = e.clientX - r.left, py = e.clientY - r.top;
                this.pointer = px < 0 || py < 0 || px > r.width || py > r.height ? null : this.toWorld(px, py);
            }, { passive: true });
            tgt.addEventListener('pointerleave', () => { this.pointer = null; });
        }
        document.addEventListener('visibilitychange', () => { if (!document.hidden && this.running) requestAnimationFrame(this.frame); });
        this.resize();
    }

    set(f) {
        this.field = typeof f === 'function' ? f : (FIELDS[f] || FIELDS.pendolo).f;
        this.clear();
        this.particles.forEach(p => this.respawn(p));
        if (this.reduced || !this.running) this.drawStatic();
    }

    resize() {
        const d = Math.min(window.devicePixelRatio || 1, 2);
        const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
        if (!W || !H) return;
        this.W = W; this.H = H;
        this.canvas.width = Math.round(W * d); this.canvas.height = Math.round(H * d);
        this.ctx.setTransform(d, 0, 0, d, 0, 0);
        this.S = Math.min(W, H) * this.o.unit;
        const n = Math.min(this.o.maxParticles, Math.round(W * H * this.o.density));
        this.particles = Array.from({ length: n }, () => this.respawn({}));
        this.clear();
        if (this.reduced || !this.running) this.drawStatic();
    }

    toWorld(px, py) { return [(px - this.W / 2) / this.S, -(py - this.H / 2) / this.S]; }
    toScreen(x, y) { return [this.W / 2 + x * this.S, this.H / 2 - y * this.S]; }

    // campo + eventuale vortice sotto il cursore
    F(x, y) {
        const v = this.field(x, y, this.t);
        if (this.pointer) {
            const dx = x - this.pointer[0], dy = y - this.pointer[1], r = dx * dx + dy * dy + 0.06;
            v[0] -= this.o.vortex * dy / r; v[1] += this.o.vortex * dx / r;
        }
        return v;
    }

    respawn(p) {
        p.x = (Math.random() - 0.5) * this.W / this.S;
        p.y = (Math.random() - 0.5) * this.H / this.S;
        p.life = 40 + Math.random() * 160;
        return p;
    }

    clear() {
        if (!this.W) return;
        this.ctx.clearRect(0, 0, this.W, this.H);
    }

    start() {
        if (this.running) return;
        this.running = true;
        if (this.reduced) { this.drawStatic(); return; }
        this.last = performance.now();
        requestAnimationFrame(this.frame);
    }
    stop() { this.running = false; }

    frame(now) {
        if (!this.running || document.hidden) return;
        const dtReal = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.t += dtReal;
        const { ctx, W, H, S } = this;
        // dissolvenza delle scie: si toglie un po' di opacita' a tutto il canvas
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0,0,0,${this.o.fade})`;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        if (this.o.arrows) this.drawArrows(0.16);

        const h = 0.6 * dtReal * this.o.speed;
        ctx.strokeStyle = `rgba(${this.o.color},${this.o.alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const p of this.particles) {
            const v1 = this.F(p.x, p.y);
            let m = hypot(v1[0], v1[1]);
            // passo limitato: i campi singolari (dipolo, vortici) non sparano le particelle via
            const k = m > 4 ? 4 / m : 1;
            const mx = p.x + 0.5 * h * v1[0] * k, my = p.y + 0.5 * h * v1[1] * k;
            const v2 = this.F(mx, my);
            m = hypot(v2[0], v2[1]);
            const k2 = m > 4 ? 4 / m : 1;
            const nx = p.x + h * v2[0] * k2, ny = p.y + h * v2[1] * k2;
            const sx = W / 2 + p.x * S, sy = H / 2 - p.y * S;
            const ex = W / 2 + nx * S, ey = H / 2 - ny * S;
            ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
            p.x = nx; p.y = ny;
            if (--p.life < 0 || ex < -10 || ex > W + 10 || ey < -10 || ey > H + 10 || !Number.isFinite(nx) || !Number.isFinite(ny)) this.respawn(p);
        }
        ctx.stroke();
        requestAnimationFrame(this.frame);
    }

    drawArrows(alpha) {
        const { ctx, W, H } = this;
        const step = 30;
        ctx.strokeStyle = `rgba(${this.o.color},${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = step / 2; i < W; i += step) for (let j = step / 2; j < H; j += step) {
            const [x, y] = this.toWorld(i, j);
            const v = this.F(x, y), m = hypot(v[0], v[1]);
            if (!m || !Number.isFinite(m)) continue;
            const l = 6 + 4 * Math.tanh(m), ux = v[0] / m, uy = -v[1] / m;
            ctx.moveTo(i - ux * l / 2, j - uy * l / 2);
            ctx.lineTo(i + ux * l / 2, j + uy * l / 2);
            ctx.lineTo(i + ux * l / 2 - (ux * 3 - uy * 2), j + uy * l / 2 - (uy * 3 + ux * 2));
        }
        ctx.stroke();
    }

    // con "riduci animazioni" attivo: solo la griglia di frecce, ferma
    drawStatic() {
        if (!this.W) return;
        this.clear();
        this.drawArrows(0.35);
    }

    // traiettoria con RK4 da (x0, y0): avanti e indietro nel tempo, in coordinate schermo
    trajectory(x0, y0, steps = 1400, h = 0.01) {
        const run = (dir) => {
            const pts = [];
            let x = x0, y = y0;
            for (let i = 0; i < steps; i++) {
                const f = (a, b) => this.field(a, b, this.t);
                const k1 = f(x, y), k2 = f(x + h / 2 * k1[0] * dir, y + h / 2 * k1[1] * dir);
                const k3 = f(x + h / 2 * k2[0] * dir, y + h / 2 * k2[1] * dir), k4 = f(x + h * k3[0] * dir, y + h * k3[1] * dir);
                x += dir * h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
                y += dir * h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
                if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 50 || Math.abs(y) > 50) break;
                pts.push(this.toScreen(x, y));
            }
            return pts;
        };
        return { forward: run(1), backward: run(-1) };
    }
}

export const randomField = () => FIELD_NAMES[Math.floor(Math.random() * FIELD_NAMES.length)];
