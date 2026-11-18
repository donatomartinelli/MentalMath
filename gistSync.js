// MATH-HUB // GITHUB GIST CLOUD SYNC (CORTEX-COMPATIBLE)
export class GistSync {
    constructor() {
        this.configKey = 'mathHubGistConfig';
        this.fileName = 'math_hub_state.json';
    }

    getConfig() {
        return JSON.parse(localStorage.getItem(this.configKey)) ?? {
            token: '',
            gistId: '',
            lastSync: null
        };
    }

    saveConfig(token, gistId) {
        const current = this.getConfig();
        const updated = { ...current, token: token.trim(), gistId: gistId.trim() };
        localStorage.setItem(this.configKey, JSON.stringify(updated));
        return updated;
    }

    collectLocalPayload() {
        return {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            mathHubProblemState: JSON.parse(localStorage.getItem('mathHubProblemState') || '{}'),
            mentalMathGroupWeights: JSON.parse(localStorage.getItem('mentalMathGroupWeights') || '{}'),
            mentalMathHistory: JSON.parse(localStorage.getItem('mentalMathHistory') || '{}'),
            mentalMathPresets: JSON.parse(localStorage.getItem('mentalMathPresets') || '{}')
        };
    }

    applyRemotePayload(payload) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('Payload JSON non valido.');
        }
        if (payload.mathHubProblemState) {
            localStorage.setItem('mathHubProblemState', JSON.stringify(payload.mathHubProblemState));
        }
        if (payload.mentalMathGroupWeights) {
            localStorage.setItem('mentalMathGroupWeights', JSON.stringify(payload.mentalMathGroupWeights));
        }
        if (payload.mentalMathHistory) {
            localStorage.setItem('mentalMathHistory', JSON.stringify(payload.mentalMathHistory));
        }
        if (payload.mentalMathPresets) {
            localStorage.setItem('mentalMathPresets', JSON.stringify(payload.mentalMathPresets));
        }
    }

    async pushToGist() {
        const { token, gistId } = this.getConfig();
        if (!token || !gistId) {
            throw new Error('Inserisci GitHub Token e Gist ID prima di eseguire il PUSH.');
        }

        const payload = this.collectLocalPayload();
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: 'Math-Hub Personal Competency & Mental Math Sync State',
                files: {
                    [this.fileName]: {
                        content: JSON.stringify(payload, null, 2)
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Errore GitHub API (${response.status}): ${response.statusText}`);
        }

        const now = new Date().toLocaleString('it-IT');
        const cfg = this.getConfig();
        cfg.lastSync = `PUSH: ${now}`;
        localStorage.setItem(this.configKey, JSON.stringify(cfg));
        return cfg.lastSync;
    }

    async pullFromGist() {
        const { token, gistId } = this.getConfig();
        if (!token || !gistId) {
            throw new Error('Inserisci GitHub Token e Gist ID prima di eseguire il PULL.');
        }

        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json'
            }
        });

        if (!response.ok) {
            throw new Error(`Errore GitHub API (${response.status}): ${response.statusText}`);
        }

        const data = await response.json();
        const fileObj = data.files?.[this.fileName] || Object.values(data.files || {})[0];
        if (!fileObj || !fileObj.content) {
            throw new Error(`File ${this.fileName} non trovato nel Gist specificato.`);
        }

        const parsed = JSON.parse(fileObj.content);
        this.applyRemotePayload(parsed);

        const now = new Date().toLocaleString('it-IT');
        const cfg = this.getConfig();
        cfg.lastSync = `PULL: ${now}`;
        localStorage.setItem(this.configKey, JSON.stringify(cfg));
        return cfg.lastSync;
    }
}
