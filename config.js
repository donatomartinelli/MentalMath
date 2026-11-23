// MATH-HUB // CONFIGURAZIONE DELLE SORGENTI ESTERNE
// I dati arrivano dalla CI di math-tex:
//  - data/problems.json, data/catalog.json  -> scritti dal bot in questo repo
//  - library/manifest.json + library/pdf/*.pdf -> PDF completi, copiati qui dalla CI (math-pdf e' privato)
export const PROBLEMS_URL = './data/problems.json';
export const CATALOG_URL = './data/catalog.json';
// Per provare in locale con un'altra cartella di PDF: localStorage.setItem('mathHubPdfBase', 'http://localhost:8131/')
const override = (() => { try { return localStorage.getItem('mathHubPdfBase'); } catch { return null; } })();
export const PDF_BASE_URL = override || new URL('library/', location.href.split('#')[0]).href;
export const GRAPH_LIB_URL = 'https://unpkg.com/3d-force-graph@1.73.4/dist/3d-force-graph.min.js';
