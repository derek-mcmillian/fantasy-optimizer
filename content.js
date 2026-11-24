// content.js
// Scrapes the Yahoo Fantasy Football team/lineup page (e.g. /f1/<league>/<team>).
// Roster rows live in table#statTable0 (offense), #statTable1 (K), #statTable2 (DEF).

const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

// Map header titles (e.g. "Projected Points") to column indexes for a table.
function columnIndexes(table) {
    const headerRow = Array.from(table.querySelectorAll('thead tr')).at(-1);
    const map = {};
    if (!headerRow) return map;
    Array.from(headerRow.children).forEach((th, i) => {
        const key = th.getAttribute('title') || text(th);
        if (key && !(key in map)) map[key] = i;
    });
    return map;
}

function parseRow(row, cols) {
    const slot = row.querySelector('span.pos-label');
    const nameLink = row.querySelector('.ysf-player-name a.name');
    if (!slot || !nameLink) return null; // header/empty slot rows

    // "Ten - QB" or "LV - TE" (may contain multiple positions like "WR,RB")
    // (the injury badge also uses span.Fz-xxs, so match on the "Team - Pos" pattern)
    const teamPos = Array.from(row.querySelectorAll('.ysf-player-name span.Fz-xxs'))
        .map(text).find(t => / - /.test(t)) || '';
    const [team, position] = teamPos.split(/\s+-\s+/);

    const gameStatus = row.querySelector('.ysf-game-status');
    const opponentLink = gameStatus?.querySelector('a.Inline');
    const gameText = text(gameStatus); // e.g. "Sun 1:00 pm @ Jax"

    const cells = row.children;
    const cell = title => (cols[title] !== undefined ? text(cells[cols[title]]) : undefined);
    const num = v => (v && !isNaN(parseFloat(v)) ? parseFloat(v) : null);

    return {
        slot: slot.dataset.pos || text(slot),
        name: text(nameLink),
        team: team || null,
        position: position || null,
        injuryStatus: row.querySelector('.ysf-player-status.F-injury')?.getAttribute('title')
            || row.querySelector('.ysf-player-status.F-injury [title]')?.getAttribute('title')
            || null,
        matchup: gameText || 'Bye',
        opponent: opponentLink ? text(opponentLink) : null,
        opponentRank: opponentLink?.getAttribute('title') || null, // "JAX gives up the 6th fewest..."
        projectedPoints: num(cell('Projected Points')),
        percentStarted: cell('Percent Started') || null,
    };
}

function scrapeLineup() {
    const tables = document.querySelectorAll('table[id^="statTable"]');
    const starters = {};
    const bench = [];
    const injuredReserve = [];

    tables.forEach(table => {
        const cols = columnIndexes(table);
        table.querySelectorAll('tbody tr').forEach(row => {
            const player = parseRow(row, cols);
            if (!player) return;
            if (player.slot === 'BN') bench.push(player);
            else if (player.slot.startsWith('IR')) injuredReserve.push(player);
            else (starters[player.slot] ||= []).push(player);
        });
    });

    const lineup = { starters, bench, injuredReserve };
    if (Object.keys(starters).length === 0) {
        lineup.error = 'Could not scrape lineup. Make sure you are on your Yahoo team (lineup) page.';
    }
    return lineup;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scrapeLineup') {
        try {
            sendResponse({ lineup: scrapeLineup() });
        } catch (e) {
            sendResponse({ lineup: { error: `Scrape failed: ${e.message}` } });
        }
    }
});
