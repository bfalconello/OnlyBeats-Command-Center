'use strict';

// M3.1 Live Game Focus workspace.
// Uses the established shared-state and classic-script architecture.

function focusPredictionPanel(game) {
  const snapshot = gamePredictionSnapshot(game);

  if (!snapshot.rows.length) {
    return `<div class="focus-section">
      <div class="card-head"><h3>Your Predictions</h3><span class="provider-badge">0 ENTRIES</span></div>
      ${empty('No prediction saved', 'Create a winner, spread, or total prediction for this matchup.')}
      <button class="button primary" data-focus-predict="${game.id}">Create prediction</button>
    </div>`;
  }

  return `<div class="focus-section">
    <div class="card-head">
      <h3>Your Predictions</h3>
      <span class="provider-badge">${snapshot.rows.length} ENTR${snapshot.rows.length === 1 ? 'Y' : 'IES'}</span>
    </div>
    <div class="intel-list">
      ${snapshot.rows.map(prediction => `
        <div class="intel-row">
          <span class="intel-icon">${
            prediction.result.status === 'correct' ? '✓' :
            prediction.result.status === 'incorrect' ? '×' :
            prediction.result.status === 'push' ? '—' : '○'
          }</span>
          <div>
            <strong>${esc(predictionTypeLabel(prediction))}: ${esc(predictionPickLabel(prediction, game))}</strong>
            <small>Confidence ${formatNumber(prediction.confidence)}${prediction.odds ? ` · Odds ${esc(prediction.odds)}` : ''} · ${esc(prediction.result.label)}</small>
          </div>
          <b>${prediction.result.score === null ? 'Pending' : formatNumber(prediction.result.score)}</b>
        </div>
      `).join('')}
    </div>
    <button class="button" data-focus-predict="${game.id}">Add prediction</button>
  </div>`;
}

function focusAvailabilityPanel(game) {
  const snapshot = gameAvailabilitySnapshot(game);

  if (!snapshot.entries.length) {
    return `<div class="focus-section">
      <div class="card-head"><h3>Player Availability</h3><span class="provider-badge">MANUAL MODE</span></div>
      ${empty('No availability notes', 'No local notes are saved for either team.')}
      <button class="button" data-focus-availability>Open Player Availability</button>
    </div>`;
  }

  return `<div class="focus-section">
    <div class="card-head">
      <h3>Player Availability</h3>
      <span class="provider-badge">${snapshot.concerning.length} NEED ATTENTION</span>
    </div>
    <div class="intel-list">
      ${snapshot.entries.slice(0, 8).map(entry => `
        <div class="intel-row">
          <span class="intel-icon">♙</span>
          <div>
            <strong>${esc(entry.player)} · ${esc(entry.team)}</strong>
            <small>${esc(entry.status)}${entry.notes ? ` · ${esc(entry.notes)}` : ''}</small>
          </div>
        </div>
      `).join('')}
    </div>
    <button class="button" data-focus-availability>Manage availability notes</button>
  </div>`;
}

function focusTeamPanel(game) {
  return `<div class="focus-section">
    <div class="card-head"><h3>Team Intelligence</h3><span class="provider-badge">CONNECTED</span></div>
    <div class="intel-list">
      ${[game.away, game.home].map(team => {
        const enriched = allTeams().find(candidate => candidate.abbr === team.abbr) || team;
        const snapshot = teamRecordSnapshot(enriched);
        const trend = teamTrend(enriched);
        return `<button class="intel-row" data-focus-team="${esc(team.abbr)}">
          <span class="intel-icon">${team.rank ? `#${team.rank}` : '◈'}</span>
          <div>
            <strong>${esc(team.name)}</strong>
            <small>${esc(team.record || `${snapshot.wins}-${snapshot.losses}`)} · ${esc(enriched.conference || 'FBS')} · ${trend.icon} ${esc(trend.label)}</small>
          </div>
          <b>›</b>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function focusGameContext(game) {
  const favorite = isFavoriteGame(game);
  const ranked = isTop25(game);
  const weatherLocation = [game.city, game.stateCode].filter(Boolean).join(', ');
  const total = game.away.score + game.home.score;
  const leader =
    game.away.score > game.home.score ? game.away :
    game.home.score > game.away.score ? game.home : null;

  return `<div class="focus-section">
    <div class="card-head"><h3>Game Context</h3><span class="provider-badge">${game.state === 'in' ? 'LIVE' : statusLabel(game.state)}</span></div>
    <div class="team-stat-grid">
      <div><span>Broadcast</span><strong>${esc(game.network || 'Not listed')}</strong></div>
      <div><span>Venue</span><strong>${esc(game.venue || 'Not listed')}</strong></div>
      <div><span>Location</span><strong>${esc(weatherLocation || 'Not listed')}</strong></div>
      <div><span>Kickoff</span><strong>${new Date(game.date).toLocaleString()}</strong></div>
      <div><span>Total points</span><strong>${total}</strong></div>
      <div><span>Leader</span><strong>${leader ? esc(leader.shortName) : game.state === 'pre' ? 'Not started' : 'Tied'}</strong></div>
      <div><span>Ranked matchup</span><strong>${ranked ? 'Yes' : 'No'}</strong></div>
      <div><span>Favorite matchup</span><strong>${favorite ? 'Yes' : 'No'}</strong></div>
    </div>
  </div>`;
}

function bindLiveFocusActions(game) {
  document.querySelectorAll('[data-focus-team]').forEach(button => {
    button.onclick = () => {
      closeFocus();
      openTeam(button.dataset.focusTeam);
    };
  });

  document.querySelectorAll('[data-focus-predict]').forEach(button => {
    button.onclick = () => {
      predictionDraftGameId = button.dataset.focusPredict;
      editingPredictionId = '';
      predictionView = 'games';
      closeFocus();
      navigate('predictions');
    };
  });

  document.querySelectorAll('[data-focus-availability]').forEach(button => {
    button.onclick = () => {
      closeFocus();
      navigate('availability');
    };
  });

  const weatherButton = $('focusWeather');
  if (weatherButton) {
    weatherButton.onclick = () => {
      const location = [game.city, game.stateCode].filter(Boolean).join(', ');
      if (!location) {
        toast('Venue weather location is unavailable', 'error');
        return;
      }
      settings.weatherLocation = location;
      saveSettings(false);
      closeFocus();
      navigate('weather');
      fetchWeather(location);
    };
  }

  const scheduleButton = $('focusSchedule');
  if (scheduleButton) {
    scheduleButton.onclick = () => {
      scheduleQuery = `${game.away.abbr} ${game.home.abbr}`;
      scheduleRange = 'all';
      scheduleFilter = 'all';
      closeFocus();
      navigate('schedule');
    };
  }

  const detailsButton = $('focusDetails');
  if (detailsButton) {
    detailsButton.onclick = () => {
      closeFocus();
      showGame(game.id);
    };
  }

  const refreshButton = $('focusRefresh');
  if (refreshButton) {
    refreshButton.onclick = async () => {
      refreshButton.disabled = true;
      refreshButton.textContent = 'Refreshing game…';
      try {
        await syncScores(false);
        const refreshedGame = games.find(candidate => candidate.id === game.id);
        if (refreshedGame) {
          openFocus(refreshedGame.id);
        }
      } finally {
        const activeButton = $('focusRefresh');
        if (activeButton) {
          activeButton.disabled = false;
          activeButton.textContent = 'Refresh game';
        }
      }
    };
  }
}

function openFocus(id) {
  const game = games.find(candidate => candidate.id === id);
  if (!game) return;

  focusedGameId = id;
  const favorite = isFavoriteGame(game);
  const ranked = isTop25(game);

  $('focusBody').innerHTML = `
    <div class="focus-header">
      <p class="eyebrow">LIVE GAME FOCUS${ranked ? ' · TOP 25' : ''}${favorite ? ' · FAVORITE' : ''}</p>
      <h2>${game.away.rank ? `#${game.away.rank} ` : ''}${esc(game.away.shortName)} at ${game.home.rank ? `#${game.home.rank} ` : ''}${esc(game.home.shortName)}</h2>
      <p>${esc(game.status)}${game.network ? ` · ${esc(game.network)}` : ''}</p>
    </div>

    <div class="focus-score">${teamLine(game.away)}${teamLine(game.home)}</div>

    <div class="button-row focus-actions">
      <button class="button primary" id="focusDetails">Open full details</button>
      <button class="button" id="focusRefresh">${loading ? 'Refreshing game…' : 'Refresh game'}</button>
      <button class="button" id="focusSchedule">Open in Schedule</button>
      <button class="button" id="focusWeather">Venue weather</button>
    </div>

    <div class="focus-workspace">
      ${focusGameContext(game)}
      ${focusTeamPanel(game)}
      ${focusPredictionPanel(game)}
      ${focusAvailabilityPanel(game)}
    </div>
  `;

  $('focusBackdrop').classList.remove('hidden');
  bindLiveFocusActions(game);
}

function closeFocus() {
  focusedGameId = null;
  $('focusBackdrop')?.classList.add('hidden');
}
