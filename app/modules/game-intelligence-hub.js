'use strict';

// v0.16 Game Intelligence Hub — Phase 1.
// Unifies trusted game, team, prediction, timeline, weather, and availability context.

function gameHubSelectedGame(){
  const selected=games.find(game=>game.id===gameHubGameId);
  if(selected)return selected;

  const priority=typeof prioritizedGames==='function'
    ? prioritizedGames().find(item=>item.game)
    : null;
  const fallback=priority?.game||sortGames(games)[0]||null;

  if(fallback)gameHubGameId=fallback.id;
  return fallback;
}

function gameHubTimelineEvents(game){
  if(!game)return [];
  return [...timelineEvents]
    .filter(event=>event.gameId===game.id)
    .sort((a,b)=>new Date(b.time)-new Date(a.time))
    .slice(0,12);
}

function gameHubWeatherStatus(game){
  const location=[game.city,game.stateCode].filter(Boolean).join(', ');
  const activeLocation=String(settings.weatherLocation||'').trim();
  const matches=location&&activeLocation.toLowerCase()===location.toLowerCase();
  return {
    location,
    loaded:Boolean(weatherData&&matches),
    label:location?(matches&&weatherData?'Venue weather loaded':'Venue weather available'):'Venue location unavailable'
  };
}

function gameHubTeamCard(team){
  const enriched=allTeams().find(candidate=>candidate.abbr===team.abbr)||team;
  const snapshot=teamRecordSnapshot(enriched);
  const trend=teamTrend(enriched);
  const availability=teamAvailabilitySnapshot(enriched);

  return `<article class="card">
    <div class="card-head">
      <div class="button-row">${logo(team)}<div><h3>${team.rank?`#${team.rank} `:''}${esc(team.name)}</h3><p class="muted">${esc(team.record||`${snapshot.wins}-${snapshot.losses}`)} · ${esc(enriched.conference||'FBS')}</p></div></div>
      <span class="provider-badge">${trend.icon} ${esc(trend.label)}</span>
    </div>
    <div class="team-stat-grid">
      <div><span>Loaded finals</span><strong>${snapshot.finals}</strong></div>
      <div><span>Points/game</span><strong>${snapshot.finals?(snapshot.pf/snapshot.finals).toFixed(1):'—'}</strong></div>
      <div><span>Allowed/game</span><strong>${snapshot.finals?(snapshot.pa/snapshot.finals).toFixed(1):'—'}</strong></div>
      <div><span>Availability</span><strong>${availability.concerning.length}</strong></div>
    </div>
    <button class="button" data-hub-team="${esc(team.abbr)}">Open Team Intelligence</button>
  </article>`;
}

function gameHubPredictionPanel(game){
  const snapshot=gamePredictionSnapshot(game);

  if(!snapshot.rows.length){
    return empty('No saved prediction','Create a prediction for this matchup from the Hub.');
  }

  return `<div class="intel-list">${snapshot.rows.map(prediction=>`
    <div class="intel-row">
      <span class="intel-icon">${
        prediction.result.status==='correct'?'✓':
        prediction.result.status==='incorrect'?'×':
        prediction.result.status==='push'?'—':'○'
      }</span>
      <div>
        <strong>${esc(predictionTypeLabel(prediction))}: ${esc(predictionPickLabel(prediction,game))}</strong>
        <small>Confidence ${formatNumber(prediction.confidence)}${prediction.odds?` · Odds ${esc(prediction.odds)}`:''} · ${esc(prediction.result.label)}</small>
      </div>
      <b>${prediction.result.score===null?'Pending':formatNumber(prediction.result.score)}</b>
    </div>`).join('')}</div>`;
}

function gameHubAvailabilityPanel(game){
  const snapshot=gameAvailabilitySnapshot(game);

  if(!snapshot.entries.length){
    return empty('No availability notes','No manual player notes are saved for either team.');
  }

  return `<div class="intel-list">${snapshot.entries.map(entry=>`
    <div class="intel-row">
      <span class="intel-icon">♙</span>
      <div>
        <strong>${esc(entry.player)} · ${esc(entry.team)}</strong>
        <small>${esc(entry.status)}${entry.notes?` · ${esc(entry.notes)}`:''}</small>
      </div>
    </div>`).join('')}</div>`;
}

function gameHubTimelinePanel(game){
  const rows=gameHubTimelineEvents(game);

  if(!rows.length){
    return empty('No timeline events','Score changes, predictions, and availability updates will appear here.');
  }

  return `<div class="intel-list">${rows.map(event=>`
    <div class="intel-row">
      <span class="intel-icon">${typeof timelineIcon==='function'?timelineIcon(event.type):'•'}</span>
      <div>
        <strong>${esc(event.title)}</strong>
        <small>${new Date(event.time).toLocaleString()} · ${esc(event.detail)}</small>
      </div>
      <span class="provider-badge">${typeof timelineLabel==='function'?timelineLabel(event.type):'Event'}</span>
    </div>`).join('')}</div>`;
}

function gameHubSelector(){
  const sorted=sortGames(games);
  return `<select id="gameHubSelector">
    ${sorted.map(game=>`<option value="${game.id}" ${game.id===gameHubGameId?'selected':''}>${esc(game.away.shortName)} at ${esc(game.home.shortName)} · ${esc(statusLabel(game.state))}</option>`).join('')}
  </select>`;
}

function gameIntelligenceHubPage(){
  setHeading('Game Intelligence Hub','ONE MATCHUP · COMPLETE CONTEXT');
  const game=gameHubSelectedGame();

  if(!game){
    return `<section class="intel-hero">
      <div><p class="eyebrow">GAME INTELLIGENCE HUB</p><h2>No matchup loaded yet.</h2><p>Refresh the scoreboard to load games into the Hub.</p></div>
      <button class="button primary" id="refreshScores">Refresh games</button>
    </section>`;
  }

  const weather=gameHubWeatherStatus(game);
  const prediction=gamePredictionSnapshot(game);
  const availability=gameAvailabilitySnapshot(game);
  const priority=typeof gamePriorityBreakdown==='function'?gamePriorityBreakdown(game):{score:0,reasons:[]};
  const favorite=isFavoriteGame(game);
  const ranked=isTop25(game);

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">GAME INTELLIGENCE HUB${ranked?' · TOP 25':''}${favorite?' · FAVORITE':''}</p>
      <h2>${game.away.rank?`#${game.away.rank} `:''}${esc(game.away.shortName)} at ${game.home.rank?`#${game.home.rank} `:''}${esc(game.home.shortName)}</h2>
      <p>${esc(game.status)}${game.network?` · ${esc(game.network)}`:''}${game.venue?` · ${esc(game.venue)}`:''}</p>
    </div>
    <div class="button-row">
      ${gameHubSelector()}
      <button class="button primary" id="gameHubRefresh">${loading?'Refreshing hub…':'Refresh hub'}</button>
    </div>
  </section>

  <div class="drawer-score">${teamLine(game.away)}${teamLine(game.home)}</div>

  <div class="metric-grid">
    ${metric('Priority Score',priority.score,priority.reasons.slice(0,2).join(' · ')||'No active signal')}
    ${metric('Saved Predictions',prediction.rows.length,`${prediction.pending} pending`)}
    ${metric('Availability Notes',availability.entries.length,`${availability.concerning.length} need attention`)}
    ${metric('Timeline Events',gameHubTimelineEvents(game).length,'Latest 12 shown')}
    ${metric('Weather',weather.loaded?'Loaded':'Ready',weather.label)}
    ${metric('Kickoff',new Date(game.date).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}),game.network||'Network not listed')}
  </div>

  <div class="button-row">
    <button class="button primary" data-hub-focus="${game.id}">Open Focus Mode</button>
    <button class="button" data-hub-predict="${game.id}">${prediction.rows.length?'Add prediction':'Create prediction'}</button>
    <button class="button" id="gameHubWeather" ${weather.location?'':'disabled'}>Venue weather</button>
    <button class="button" id="gameHubSchedule">Open in Schedule</button>
    <button class="button" id="gameHubDetails">Full game details</button>
    <button class="button" id="gameHubWatch">${pinnedGameIds.includes(game.id)?'Open Watch Center':'Pin to Watch Center'}</button>
  </div>

  <div class="command-center-grid">
    ${gameHubTeamCard(game.away)}
    ${gameHubTeamCard(game.home)}
    ${card('Your Prediction',gameHubPredictionPanel(game),'wide')}
    ${card('Player Availability',gameHubAvailabilityPanel(game),'wide')}
    ${card('Game Timeline',gameHubTimelinePanel(game),'wide')}
    ${card('Data Coverage',`<div class="detail-list">
      <div><span>Scores</span><strong>${syncError?'Cached / Error':'Connected'}</strong></div>
      <div><span>Rankings</span><strong>${ranked?'Loaded':'No ranked team'}</strong></div>
      <div><span>Weather shortcut</span><strong>${esc(weather.label)}</strong></div>
      <div><span>Predictions</span><strong>${prediction.rows.length}</strong></div>
      <div><span>Availability source</span><strong>Manual local notes</strong></div>
      <div><span>Timeline</span><strong>${gameHubTimelineEvents(game).length} events</strong></div>
    </div>`,'wide')}
  </div>`;
}

function bindGameIntelligenceHub(){
  const game=gameHubSelectedGame();
  if(!game)return;

  if($('gameHubSelector')){
    $('gameHubSelector').onchange=event=>{
      gameHubGameId=event.target.value;
      renderPage();
    };
  }

  if($('gameHubRefresh')){
    $('gameHubRefresh').onclick=async()=>{
      const button=$('gameHubRefresh');
      button.disabled=true;
      button.textContent='Refreshing hub…';
      try{
        await syncScores(false);
        captureTimelineSnapshot('score-refresh');
        renderPage();
      }finally{
        const active=$('gameHubRefresh');
        if(active){
          active.disabled=false;
          active.textContent='Refresh hub';
        }
      }
    };
  }

  document.querySelectorAll('[data-hub-team]').forEach(button=>{
    button.onclick=()=>openTeam(button.dataset.hubTeam);
  });

  document.querySelectorAll('[data-hub-focus]').forEach(button=>{
    button.onclick=()=>openFocus(button.dataset.hubFocus);
  });

  document.querySelectorAll('[data-hub-predict]').forEach(button=>{
    button.onclick=()=>{
      predictionDraftGameId=button.dataset.hubPredict;
      editingPredictionId='';
      predictionView='games';
      navigate('predictions');
    };
  });

  if($('gameHubWeather')){
    $('gameHubWeather').onclick=()=>{
      const location=[game.city,game.stateCode].filter(Boolean).join(', ');
      if(!location){
        toast('Venue weather location is unavailable','error');
        return;
      }
      settings.weatherLocation=location;
      saveSettings(false);
      navigate('weather');
      fetchWeather(location);
    };
  }

  if($('gameHubSchedule')){
    $('gameHubSchedule').onclick=()=>{
      scheduleQuery=`${game.away.abbr} ${game.home.abbr}`;
      scheduleRange='all';
      scheduleFilter='all';
      navigate('schedule');
    };
  }

  if($('gameHubDetails'))$('gameHubDetails').onclick=()=>showGame(game.id);

  if($('gameHubWatch')){
    $('gameHubWatch').onclick=()=>{
      if(!pinnedGameIds.includes(game.id)){
        pinnedGameIds.push(game.id);
        saveWatchCenter();
        toast('Game pinned to Watch Center');
      }
      navigate('watch');
    };
  }
}
