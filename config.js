// MATH-HUB // CONFIGURAZIONE DELLE SORGENTI ESTERNE
// I dati arrivano dalla CI di math-tex:
//  - data/problems.json, data/catalog.json  -> scritti dal bot in questo repo
//  - manifest.json + pdf/*.pdf               -> pubblicati nel repo math-pdf (GitHub Pages)
export const PROBLEMS_URL = './data/problems.json';
export const CATALOG_URL = './data/catalog.json';
// Per provare in locale con un altro math-pdf: localStorage.setItem('mathHubPdfBase', 'http://localhost:8131/')
const override = (() => { try { return localStorage.getItem('mathHubPdfBase'); } catch { return null; } })();
export const PDF_BASE_URL = override || 'https://donatomartinelli.github.io/math-pdf/';
export const GRAPH_LIB_URL = 'https://unpkg.com/3d-force-graph@1.73.4/dist/3d-force-graph.min.js';
