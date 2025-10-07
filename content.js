// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrapeLineup') {
        const lineup = { starters: {}, bench: {} };
        const positions = ['QB', 'RB', 'WR', 'TE', 'W/R/T', 'DEF', 'K']; // Yahoo uses DEF for DST

        // Scrape starters
        positions.forEach(pos => {
            const selector = `.ysf-player-name a[title="${pos}"]`; // Yahoo uses title attributes
            const matchingPositions = Array.from(document.querySelectorAll('span.pos-label')).filter(el => el.textContent == `${pos}`);
            const players = matchingPositions.map(pos => pos.closest('tr'));
            lineup.starters[pos] = Array.from(players).map(el => {
                const matchup = el.querySelector('span.ysf-game-status').querySelector('a.Inline');

                return {
                    name: el.querySelector('a').textContent.trim(),
                    matchup: !!matchup ? matchup.textContent : 'Bye',
                }
            });
        });

        debugger;
        // Scrape bench (optional for swaps)
        const benchPositions = Array.from(document.querySelectorAll('span.pos-label')).filter(el => el.textContent == 'BN');
        const benchPlayers = Array.from(benchPositions.slice(0, 6).map(pos => pos.closest('tr')));
        lineup.bench = Array.from(benchPlayers).map(el => {
            const positionText = Array.from(el.querySelectorAll('span.Fz-xxs')).at(-1).textContent;
            const regex = /-\s*([A-Za-z]+)/;
            const match = positionText.match(regex);
            const position = match[1];

            const matchup = el.querySelector('span.ysf-game-status').querySelector('a.Inline');

            return {
                name: el.querySelector('a').textContent.trim(),
                position: position,
                matchup: !!matchup ? matchup.textContent : 'Bye',
            }
        });

        // Fallback for errors
        if (Object.keys(lineup.starters).length === 0) {
            lineup.error = 'Could not scrape lineup. Ensure you’re on your Yahoo team page.';
        }

        sendResponse({ lineup });
    }
    return true; // Async response
});