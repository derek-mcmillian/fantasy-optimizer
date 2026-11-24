// popup.js
const DEFAULT_MODEL = 'grok-4';

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// Models often wrap JSON in ```json fences or add prose; pull out the JSON object.
function parseModelJson(content) {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced ? fenced[1] : content;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Model did not return JSON.');
    return JSON.parse(raw.slice(start, end + 1));
}

function renderAnalysis(analysis) {
    let html = '<h3>Optimized Lineup Advice</h3>';
    (analysis.positions || []).forEach(pos => {
        html += `<h4>${escapeHtml(pos.pos)}</h4><ul>`;
        (pos.players || []).forEach(p => {
            const proj = p.projected != null ? ` — ${escapeHtml(p.projected)} pts` : '';
            const rec = p.recommendation ? ` <strong>[${escapeHtml(p.recommendation)}]</strong>` : '';
            html += `<li>${escapeHtml(p.name)}${p.matchup ? ` (${escapeHtml(p.matchup)})` : ''}${proj}${rec}</li>`;
        });
        html += '</ul>';
        if (pos.advice) html += `<p><em>Advice:</em> ${escapeHtml(pos.advice)}</p>`;
        if (pos.swaps?.length) html += `<p><em>Swaps:</em> ${pos.swaps.map(escapeHtml).join(', ')}</p>`;
    });
    if (analysis.summary) html += `<p><strong>Summary:</strong> ${escapeHtml(analysis.summary)}</p>`;
    return html;
}

document.addEventListener('DOMContentLoaded', () => {
    const optimizeBtn = document.getElementById('optimizeBtn');
    const resultsDiv = document.getElementById('results');
    const loadingIcon = document.getElementById('loadingIcon');
    const showError = msg => { resultsDiv.innerHTML = `<p style="color:red;">${escapeHtml(msg)}</p>`; };

    optimizeBtn.addEventListener('click', async () => {
        optimizeBtn.disabled = true;
        loadingIcon?.classList.add('show');
        resultsDiv.textContent = '';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.url?.includes('football.fantasysports.yahoo.com')) {
                return showError('Open your Yahoo fantasy team page!');
            }

            let response;
            try {
                response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeLineup' });
            } catch {
                return showError('Could not reach the page. Refresh your Yahoo team page and try again.');
            }
            if (!response?.lineup || response.lineup.error) {
                return showError(response?.lineup?.error || 'No lineup returned.');
            }

            const { apiKey, model } = await chrome.storage.sync.get(['apiKey', 'model']);
            if (!apiKey) {
                resultsDiv.innerHTML = '<p>Set your Grok API key in extension settings.</p>';
                return;
            }

            const lineupStr = JSON.stringify(response.lineup, null, 2);
            const prompt = `Analyze this Yahoo fantasy football lineup for the current week in a 0.5 PPR league with 6 points per TD.
Provide sit/start advice by position, projected points, and suggest bench-to-starter swaps to optimize the lineup.
Consider matchups (opponentRank describes how many points the opponent allows), injuries (injuryStatus), and trends.
Note: W/R/T is a flex slot that can hold a WR, RB, or TE.
Lineup: ${lineupStr}
Respond with ONLY a JSON object, no markdown, in this shape:
{"positions":[{"pos":"QB","players":[{"name":"...","matchup":"...","projected":0,"recommendation":"Start|Sit"}],"advice":"...","swaps":["..."]}],"summary":"..."}`;

            const apiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model || DEFAULT_MODEL,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 5000
                })
            });

            if (!apiResponse.ok) {
                const body = await apiResponse.text();
                throw new Error(`API error ${apiResponse.status}: ${body.slice(0, 300)}`);
            }
            const data = await apiResponse.json();
            const analysis = parseModelJson(data.choices?.[0]?.message?.content || '');
            resultsDiv.innerHTML = renderAnalysis(analysis);
        } catch (error) {
            showError(`Error: ${error.message}`);
        } finally {
            optimizeBtn.disabled = false;
            loadingIcon?.classList.remove('show');
        }
    });
});
