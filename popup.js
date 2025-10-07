// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const optimizeBtn = document.getElementById('optimizeBtn');
    const resultsDiv = document.getElementById('results');

    optimizeBtn.addEventListener('click', async () => {
        // Disable button and show loading icon
        optimizeBtn.disabled = true;
        loadingIcon.classList.add('show');
        resultsDiv.textContent = ''; // Clear previous results

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.url.includes('football.fantasysports.yahoo.com')) {
                resultsDiv.innerHTML = '<p style="color:red;">Open your Yahoo fantasy team page!</p>';
                return;
            }

            // Scrape lineup
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeLineup' });
            if (response.lineup.error) {
                resultsDiv.innerHTML = `<p style="color:red;">${response.lineup.error}</p>`;
                return;
            }

            // Get API key
            const { apiKey } = await chrome.storage.sync.get('apiKey');
            if (!apiKey) {
                resultsDiv.innerHTML = '<p>Set your Grok API key in extension settings.</p>';
                return;
            }

            // Format prompt for 0.5 PPR, 6-point TDs
            const lineupStr = JSON.stringify(response.lineup, null, 2);
            const prompt = `Analyze this Yahoo fantasy football lineup for the current week in a 0.5 PPR league with 6 points per TD. Provide sit/start advice by position, projected points, and suggest bench swaps to optimize the lineup. Consider matchups, injuries, and trends. Lineup: ${lineupStr} Output as JSON: {positions: [{pos: "QB", players: [...], advice: "...", projected: {...}, swaps: [...]}]}`;

            // Call Grok API
            const apiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 5000
                })
            });

            if (!apiResponse.ok) throw new Error(`API error: ${apiResponse.status}`);
            const data = await apiResponse.json();
            const analysis = JSON.parse(data.choices[0].message.content); // Grok returns JSON

            // Render results
            let html = '<h3>Optimized Lineup Advice</h3>';
            analysis.positions.forEach(pos => {
                html += `<h4>${pos.pos}</h4><ul>`;
                pos.players.forEach(player => {
                    html += `<li><strong>${player.name}</strong> vs ${player.matchup}: ${pos.advice}</li>`;
                });
                html += `</ul>`;
                if (pos.advice) {
                    html += `<p><em>Advice:</em> ${pos.advice}</p>`;
                }
                if (pos.swaps?.length) {
                    html += `<p><em>Swaps:</em> ${pos.swaps.join(', ')}</p>`;
                }
                html += `</ul>`;
            });
            resultsDiv.innerHTML = html;
        } catch (error) {
            resultsDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
        }
        finally {
            // Re-enable button and hide loading icon
            optimizeBtn.disabled = false;
            loadingIcon.classList.remove('show');
        }
    });
});