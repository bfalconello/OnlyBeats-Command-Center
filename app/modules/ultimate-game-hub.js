'use strict';

// OnlyBeats v4.6.1 Game Transfer Hotfix.
// Consolidates all locally available matchup information into one screen.
// Provider-dependent sections remain explicit when data is unavailable.

let ultimateGameHubState={
  selectedGameId:'',
  autoRefresh:true,
  refreshSeconds:30,
  showWeather:true,
  showTeamStats:true,
  showPredictionContext:true,
  showLiveDetails:true,
  showNotes:true,
  showComboMembership:true,
  compactComparison:false,
  lastViewedAt:null
};

let ultimateGameNotes={};
let ultimateGameHubTimer=null;

function loadUltimateGameHubState(){
  try{
    ultimateGameHubState={
      ...ultimateGameHubState,
      ...JSON.parse(localStorage.getItem(ULTIMATE_GAME_HUB_KEY)||'{}')
    };
  }catch{}

  try{
    const saved=JSON.parse(localStorage.getItem(GAME_NOTES_KEY)||'{}');
    ultimateGameNotes=saved&&typeof saved==='object'?saved:{};
  }catch{
    ultimateGameNotes={};
  }

  const sessionGame=sessionStorage.getItem('onlybeats.selected-game');
  if(sessionGame)ultimateGameHubState.selectedGameId=String(sessionGame);
}

function saveUltimateGameHubState(){
  ultimateGameHubState.lastViewedAt=new Date().toISOString();
  localStorage.setItem(ULTIMATE_GAME_HUB_KEY,JSON.stringify(ultimateGameHubState));
  localStorage.setItem(GAME_NOTES_KEY,JSON.stringify(ultimateGameNotes));
}


function openUltimateGameHub(gameId){
  const id=String(gameId||'');
  if(!id)return false;

  ultimateGameHubState.selectedGameId=id;
  gameHubGameId=id;
  sessionStorage.setItem('onlybeats.selected-game',id);
  saveUltimateGameHubState();
  closeGame?.();
  navigate('gamehub');
  return true;
}

function ultimateGameList(){
  return games.slice().sort((a,b)=>{
    const order={in:0,pre:1,post:2};
    const stateDifference=(order[a.state]??9)-(order[b.state]??9);
    if(stateDifference!==0)return stateDifference;
    return new Date(a.date)-new Date(b.date);
  });
}

function ultimateSelectedGame(){
  const list=ultimateGameList();
  let game=list.find(item=>String(item.id)===String(ultimateGameHubState.selectedGameId));

  if(!game){
    game=list.find(item=>item.state==='in')
      ||list.find(item=>item.state==='pre')
      ||list[0]
      ||null;
  }

  if(game){
    ultimateGameHubState.selectedGameId=String(game.id);
    sessionStorage.setItem('onlybeats.selected-game',String(game.id));
  }

  return game;
}

function ultimatePredictionFor(game){
  return predictions.find(prediction=>String(prediction.gameId)===String(game?.id))||null;
}

function ultimatePredictionStatus(game,prediction){
  if(!prediction)return 'none';
  if(typeof saturdayPredictionStatus==='function')return saturdayPredictionStatus(game,prediction);
  return intelligenceStatus(prediction);
}

function ultimateWeatherFor(game){
  if(!ultimateGameHubState.showWeather||!game)return null;
  if(typeof liveCommandWeatherFor==='function')return liveCommandWeatherFor(game);
  const rows=window.ONLYBEATS_NORMALIZED_WEATHER||[];
  return rows.find(row=>String(row.gameId||'')===String(game.id||''))||null;
}

function ultimateRankingFor(team){
  const rows=window.ONLYBEATS_NORMALIZED_RANKINGS||[];
  const values=[team?.abbr,team?.name,team?.shortName]
    .map(value=>String(value||'').toLowerCase())
    .filter(Boolean);

  return rows.find(row=>{
    const rowValues=[row.abbr,row.team,row.name]
      .map(value=>String(value||'').toLowerCase());
    return rowValues.some(value=>values.includes(value));
  })||null;
}

function ultimateStatsFor(team){
  const rows=window.ONLYBEATS_NORMALIZED_TEAM_STATS||[];
  const values=[team?.abbr,team?.name,team?.shortName]
    .map(value=>String(value||'').toLowerCase())
    .filter(Boolean);

  return rows.find(row=>{
    const rowValues=[row.abbr,row.team,row.name]
      .map(value=>String(value||'').toLowerCase());
    return rowValues.some(value=>values.includes(value));
  })||null;
}

function ultimateTeamHistory(team){
  const values=[team?.abbr,team?.name,team?.shortName]
    .map(value=>String(value||'').toLowerCase());

  const rows=predictions
    .filter(prediction=>values.includes(String(intelligenceSelection(prediction)).toLowerCase()))
    .map(prediction=>({status:intelligenceStatus(prediction)}))
    .filter(row=>['correct','incorrect','push'].includes(row.status));

  return intelligenceRecord(rows);
}

function ultimateComboMembership(game,prediction){
  if(!ultimateGameHubState.showComboMembership)return [];

  const combos=Array.isArray(typeof predictionCombos!=='undefined'?predictionCombos:null)
    ?predictionCombos
    :[];

  return combos.filter(combo=>{
    const legs=Array.isArray(combo.legs)?combo.legs:[];
    return legs.some(leg=>
      String(leg.gameId||'')===String(game?.id||'') ||
      (
        prediction &&
        String(leg.selection||'').toLowerCase()===
        String(intelligenceSelection(prediction)).toLowerCase()
      )
    );
  });
}

function ultimateWatchStatus(game){
  return Boolean(
    typeof favoritesWatchlistsState!=='undefined' &&
    favoritesWatchlistsState.watchedGames?.includes(String(game?.id))
  );
}

function ultimateKickoffText(game){
  if(!game)return 'Unavailable';
  if(typeof saturdayKickoff==='function')return saturdayKickoff(game);

  const date=new Date(game.date);
  if(!Number.isFinite(date.getTime()))return 'Time unavailable';
  if(game.state==='in')return String(game.status||'Live');
  if(game.state==='post')return 'Final';

  const difference=date.getTime()-Date.now();
  if(difference<=0)return 'Starting soon';

  const minutes=Math.floor(difference/60000);
  if(minutes<60)return `${minutes}m`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}h ${minutes%60}m`;
  return `${Math.floor(hours/24)}d ${hours%24}h`;
}

function ultimateLiveDetail(game){
  const details=window.ONLYBEATS_NORMALIZED_LIVE_DETAILS||[];
  return details.find(item=>String(item.gameId||item.id||'')===String(game?.id||''))||null;
}

function ultimateAvailabilityFor(game){
  const rows=window.ONLYBEATS_NORMALIZED_AVAILABILITY||[];
  const values=[
    game?.away?.abbr,game?.away?.name,game?.away?.shortName,
    game?.home?.abbr,game?.home?.name,game?.home?.shortName
  ].map(value=>String(value||'').toLowerCase());

  return rows.filter(row=>{
    const team=String(row.team||row.abbr||row.school||'').toLowerCase();
    return values.includes(team);
  });
}

function ultimateSelectedTeam(game,prediction){
  if(!prediction||!game)return null;
  if(typeof intelligenceSelectedTeam==='function'){
    return intelligenceSelectedTeam(game,intelligenceSelection(prediction));
  }
  return null;
}

function ultimateIntelligenceFor(prediction){
  if(!prediction||typeof scorePredictionIntelligence!=='function')return null;
  try{
    return scorePredictionIntelligence(prediction);
  }catch{
    return null;
  }
}

function ultimateTeamSnapshot(game,side){
  const team=game?.[side]||null;
  if(!team)return null;

  return {
    team,
    ranking:ultimateRankingFor(team),
    stats:ultimateStatsFor(team),
    history:ultimateTeamHistory(team),
    favorite:Boolean(
      typeof favoritesWatchlistsState!=='undefined' &&
      favoritesWatchlistsState.favoriteTeams?.includes(team.abbr)
    )
  };
}

function buildUltimateGameHubModel(){
  const game=ultimateSelectedGame();
  if(!game)return null;

  const prediction=ultimatePredictionFor(game);
  const weather=ultimateWeatherFor(game);
  const intelligence=ultimateIntelligenceFor(prediction);
  const liveDetail=ultimateLiveDetail(game);
  const availability=ultimateAvailabilityFor(game);
  const combos=ultimateComboMembership(game,prediction);
  const away=ultimateTeamSnapshot(game,'away');
  const home=ultimateTeamSnapshot(game,'home');

  ultimateGameHubState.lastViewedAt=new Date().toISOString();
  saveUltimateGameHubState();

  return {
    game,
    prediction,
    predictionStatus:ultimatePredictionStatus(game,prediction),
    selectedTeam:ultimateSelectedTeam(game,prediction),
    weather,
    intelligence,
    liveDetail,
    availability,
    combos,
    away,
    home,
    watched:ultimateWatchStatus(game),
    note:String(ultimateGameNotes[String(game.id)]||'')
  };
}

function ultimateTeamScoreboard(snapshot,score,side){
  const team=snapshot.team;
  const rank=snapshot.ranking?.rank||team.rank||0;

  return `<div class="ultimate-score-team ${side}">
    <div>
      <span class="ultimate-rank">${rank?`#${rank}`:'—'}</span>
      <p>${esc(team.abbr||'')}</p>
      <h2>${esc(team.shortName||team.name||'Team')}</h2>
      <small>${esc(team.name||team.shortName||'')}</small>
    </div>
    <strong>${Number(score)||0}</strong>
  </div>`;
}

function ultimateWeatherPanel(model){
  if(!ultimateGameHubState.showWeather){
    return empty('Weather hidden','Enable weather in Game Hub controls.');
  }

  const weather=model.weather;
  if(!weather){
    return `<div class="ultimate-unavailable">
      <strong>Weather available closer to kickoff</strong>
      <small>The stadium may be resolved, but the game can still be outside the forecast horizon.</small>
    </div>`;
  }

  return `<div class="ultimate-weather-grid">
    <div><span>Temperature</span><strong>${Number(weather.temperature).toFixed(0)}°</strong></div>
    <div><span>Conditions</span><strong>${esc(weather.condition||'Available')}</strong></div>
    <div><span>Wind</span><strong>${Number(weather.wind||0).toFixed(0)} mph</strong></div>
    <div><span>Gusts</span><strong>${Number(weather.gust||0).toFixed(0)} mph</strong></div>
    <div><span>Precipitation</span><strong>${Number(weather.precipitation||0).toFixed(2)} in</strong></div>
    <div><span>Observed</span><strong>${weather.observedAt?new Date(weather.observedAt).toLocaleString():'Current forecast'}</strong></div>
  </div>`;
}

function ultimateStatEntries(stats){
  if(!stats)return [];

  return Object.entries(stats)
    .filter(([key,value])=>
      !['team','name','abbr','school'].includes(key) &&
      ['string','number'].includes(typeof value)
    )
    .slice(0,12);
}

function ultimateTeamComparison(model){
  const awayStats=ultimateStatEntries(model.away.stats);
  const homeStats=ultimateStatEntries(model.home.stats);
  const keys=[...new Set([...awayStats.map(([key])=>key),...homeStats.map(([key])=>key)])].slice(0,10);

  const statValue=(entries,key)=>{
    const match=entries.find(([entryKey])=>entryKey===key);
    return match?match[1]:'—';
  };

  return `<div class="ultimate-comparison ${ultimateGameHubState.compactComparison?'compact':''}">
    <div class="ultimate-comparison-head">
      <strong>${esc(model.away.team.shortName||model.away.team.name)}</strong>
      <span>Comparison</span>
      <strong>${esc(model.home.team.shortName||model.home.team.name)}</strong>
    </div>

    <div class="ultimate-comparison-row">
      <strong>${model.away.ranking?.rank||model.away.team.rank||'—'}</strong>
      <span>National rank</span>
      <strong>${model.home.ranking?.rank||model.home.team.rank||'—'}</strong>
    </div>

    <div class="ultimate-comparison-row">
      <strong>${model.away.history.correct}-${model.away.history.incorrect}</strong>
      <span>Your prediction record</span>
      <strong>${model.home.history.correct}-${model.home.history.incorrect}</strong>
    </div>

    <div class="ultimate-comparison-row">
      <strong>${model.away.history.sample?model.away.history.rate.toFixed(1)+'%':'—'}</strong>
      <span>Your accuracy</span>
      <strong>${model.home.history.sample?model.home.history.rate.toFixed(1)+'%':'—'}</strong>
    </div>

    ${keys.length?keys.map(key=>`
      <div class="ultimate-comparison-row">
        <strong>${esc(statValue(awayStats,key))}</strong>
        <span>${esc(key.replace(/([A-Z])/g,' $1'))}</span>
        <strong>${esc(statValue(homeStats,key))}</strong>
      </div>`).join(''):`<div class="ultimate-unavailable">
        <strong>Team-stat comparison unavailable</strong>
        <small>A normalized team-stat provider has not supplied comparison data.</small>
      </div>`}
  </div>`;
}

function ultimatePredictionPanel(model){
  if(!ultimateGameHubState.showPredictionContext){
    return empty('Prediction context hidden','Enable prediction context in Game Hub controls.');
  }

  if(!model.prediction){
    return `<div class="ultimate-unavailable">
      <strong>No saved prediction</strong>
      <small>Add a prediction for this matchup to unlock confidence, intelligence, and history context.</small>
      <button class="button primary" id="ultimateAddPrediction">Add prediction</button>
    </div>`;
  }

  const selection=intelligenceSelection(model.prediction);
  const confidence=intelligenceConfidence(model.prediction);

  return `<div class="ultimate-prediction-panel">
    <div class="ultimate-prediction-primary">
      <p class="eyebrow">YOUR PREDICTION</p>
      <h2>${esc(selection)}</h2>
      <span class="provider-badge prediction-${model.predictionStatus}">${esc(model.predictionStatus.toUpperCase())}</span>
    </div>

    <div class="ultimate-prediction-grid">
      <div><span>Confidence</span><strong>${confidence}%</strong></div>
      <div><span>Type</span><strong>${esc(analyticsMarket?.(model.prediction)||model.prediction.market||model.prediction.type||'Winner')}</strong></div>
      <div><span>Intelligence score</span><strong>${model.intelligence?model.intelligence.score.toFixed(0):'—'}</strong></div>
      <div><span>Intelligence grade</span><strong>${model.intelligence?esc(model.intelligence.grade.label):'Unavailable'}</strong></div>
    </div>

    ${model.intelligence?.warnings?.length?`<div class="intelligence-warnings">
      ${model.intelligence.warnings.map(warning=>`<span>△ ${esc(warning)}</span>`).join('')}
    </div>`:''}

    <div class="button-row">
      <button class="button primary" id="ultimateEditPrediction">Edit prediction</button>
      <button class="button" data-page-jump="intelligence">Prediction Intelligence</button>
      <button class="button" data-page-jump="analytics">Prediction Analytics</button>
    </div>
  </div>`;
}

function ultimateAvailabilityPanel(model){
  if(!model.availability.length){
    return `<div class="ultimate-unavailable">
      <strong>Player availability unavailable</strong>
      <small>No connected provider or manual entry currently supplies availability data for this matchup.</small>
    </div>`;
  }

  return `<div class="intel-list">${model.availability.map(item=>`
    <div class="intel-row">
      <span class="intel-icon">△</span>
      <div>
        <strong>${esc(item.player||item.name||'Player')} · ${esc(item.status||'Update')}</strong>
        <small>${esc(item.team||'')} ${item.detail?`· ${esc(item.detail)}`:''}</small>
      </div>
    </div>`).join('')}</div>`;
}

function ultimateLivePanel(model){
  if(!ultimateGameHubState.showLiveDetails){
    return empty('Live details hidden','Enable live details in Game Hub controls.');
  }

  if(!model.liveDetail){
    return `<div class="ultimate-unavailable">
      <strong>Detailed live feed unavailable</strong>
      <small>The scoreboard remains available, but drives, possession, scoring plays, or win probability require provider support.</small>
    </div>`;
  }

  const entries=Object.entries(model.liveDetail)
    .filter(([key,value])=>!['gameId','id'].includes(key)&&['string','number','boolean'].includes(typeof value))
    .slice(0,18);

  return `<div class="detail-list">${entries.map(([key,value])=>`
    <div><span>${esc(key.replace(/([A-Z])/g,' $1'))}</span><strong>${esc(value)}</strong></div>
  `).join('')}</div>`;
}

function ultimateComboPanel(model){
  if(!ultimateGameHubState.showComboMembership){
    return empty('Combo membership hidden','Enable combo membership in Game Hub controls.');
  }

  if(!model.combos.length){
    return empty('Not used in a saved combo','Combos containing this game or prediction will appear here.');
  }

  return `<div class="intel-list">${model.combos.map(combo=>`
    <div class="intel-row">
      <span class="intel-icon">◇</span>
      <div>
        <strong>${esc(combo.name||'Saved combo')}</strong>
        <small>${Array.isArray(combo.legs)?combo.legs.length:0} legs · ${esc(combo.status||'pending')}</small>
      </div>
      <button class="button" data-page-jump="predictions">Open</button>
    </div>`).join('')}</div>`;
}

function ultimateNotesPanel(model){
  if(!ultimateGameHubState.showNotes){
    return empty('Notes hidden','Enable notes in Game Hub controls.');
  }

  return `<div class="ultimate-notes">
    <textarea id="ultimateGameNotes" placeholder="Add matchup research, reminders, or game-day observations…">${esc(model.note)}</textarea>
    <div class="button-row">
      <button class="button primary" id="ultimateSaveNotes">Save notes</button>
      <button class="button" id="ultimateClearNotes">Clear</button>
    </div>
  </div>`;
}

function ultimateGameSelector(game){
  const list=ultimateGameList();
  return `<div class="ultimate-game-selector">
    <label>
      <span>Matchup</span>
      <select id="ultimateGameSelect">
        ${list.map(item=>`<option value="${item.id}" ${String(item.id)===String(game.id)?'selected':''}>
          ${esc(item.away.shortName||item.away.name)} at ${esc(item.home.shortName||item.home.name)} · ${item.state==='in'?'LIVE':item.state==='post'?'FINAL':new Date(item.date).toLocaleString()}
        </option>`).join('')}
      </select>
    </label>
  </div>`;
}

function ultimateGameHubPage(){
  setHeading('Ultimate Game Hub','MATCHUP · LIVE · WEATHER · PREDICTION');
  const model=buildUltimateGameHubModel();

  if(!model){
    return empty('No games available','Refresh live data or load a schedule to use Ultimate Game Hub.');
  }

  const game=model.game;

  return `${ultimateGameSelector(game)}

  <section class="ultimate-scoreboard">
    <div class="ultimate-scoreboard-top">
      <div>
        <span class="provider-badge">${game.state==='in'?'LIVE':game.state==='post'?'FINAL':'UPCOMING'}</span>
        <strong>${esc(game.status||'Scheduled')}</strong>
      </div>
      <div>
        <strong>${esc(game.network||'Network unavailable')}</strong>
        <span>${new Date(game.date).toLocaleString()}</span>
      </div>
      <div>
        <strong>${esc(ultimateKickoffText(game))}</strong>
        <span>${esc(game.venue||'Venue unavailable')}</span>
      </div>
    </div>

    <div class="ultimate-scoreboard-teams">
      ${ultimateTeamScoreboard(model.away,game.away.score,'away')}
      <div class="ultimate-score-divider">
        <span>AT</span>
        <button class="button ${model.watched?'primary':''}" id="ultimateWatchGame">${model.watched?'Watching':'Watch game'}</button>
      </div>
      ${ultimateTeamScoreboard(model.home,game.home.score,'home')}
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Game Status',game.state==='in'?'Live':game.state==='post'?'Final':'Upcoming',game.status||'')}
    ${metric('Kickoff',ultimateKickoffText(game),new Date(game.date).toLocaleString())}
    ${metric('Network',game.network||'Unavailable','Broadcast')}
    ${metric('Venue',game.venue||'Unavailable','Stadium')}
    ${metric('Prediction',model.prediction?intelligenceSelection(model.prediction):'Not saved',model.predictionStatus)}
    ${metric('Intelligence',model.intelligence?model.intelligence.score.toFixed(0):'—',model.intelligence?.grade?.label||'Unavailable')}
  </div>

  <div class="reports-grid">
    ${card('Game Hub Controls',`<div class="detail-list">
      <label class="toggle-row"><span>Automatic refresh</span><input id="ultimateAutoRefresh" type="checkbox" ${ultimateGameHubState.autoRefresh?'checked':''}></label>
      <label><span>Refresh interval</span><select id="ultimateRefreshSeconds">${[15,30,60,120,300].map(value=>`<option value="${value}" ${Number(ultimateGameHubState.refreshSeconds)===value?'selected':''}>${value} seconds</option>`).join('')}</select></label>
      <label class="toggle-row"><span>Show weather</span><input id="ultimateShowWeather" type="checkbox" ${ultimateGameHubState.showWeather?'checked':''}></label>
      <label class="toggle-row"><span>Show provider stats</span><input id="ultimateShowStats" type="checkbox" ${ultimateGameHubState.showTeamStats?'checked':''}></label>
      <label class="toggle-row"><span>Show prediction context</span><input id="ultimateShowPrediction" type="checkbox" ${ultimateGameHubState.showPredictionContext?'checked':''}></label>
      <label class="toggle-row"><span>Show live details</span><input id="ultimateShowLive" type="checkbox" ${ultimateGameHubState.showLiveDetails?'checked':''}></label>
      <label class="toggle-row"><span>Show notes</span><input id="ultimateShowNotes" type="checkbox" ${ultimateGameHubState.showNotes?'checked':''}></label>
      <label class="toggle-row"><span>Show combo membership</span><input id="ultimateShowCombos" type="checkbox" ${ultimateGameHubState.showComboMembership?'checked':''}></label>
      <label class="toggle-row"><span>Compact comparison</span><input id="ultimateCompactComparison" type="checkbox" ${ultimateGameHubState.compactComparison?'checked':''}></label>
      <button class="button primary" id="ultimateRefreshNow">Refresh matchup</button>
    </div>`)}

    ${card('Weather',ultimateWeatherPanel(model))}
    ${card('Team Comparison',ultimateGameHubState.showTeamStats?ultimateTeamComparison(model):empty('Team comparison hidden','Enable provider stats in Game Hub controls.'),'wide')}
    ${card('Prediction & Intelligence',ultimatePredictionPanel(model),'wide')}
    ${card('Player Availability',ultimateAvailabilityPanel(model))}
    ${card('Live Game Details',ultimateLivePanel(model))}
    ${card('Saved Combo Membership',ultimateComboPanel(model))}
    ${card('Game Notes',ultimateNotesPanel(model),'wide')}

    ${card('Provider Boundary',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Core matchup data</strong><small>Score, teams, kickoff, network, venue, prediction, and local notes use loaded or saved data.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Team statistics</strong><small>Shown only when a normalized team-stat provider supplies them.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Availability and injuries</strong><small>Shown only when a provider or manual entry supplies them.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Drives and win probability</strong><small>Detailed live information requires provider support and is never invented.</small></div></div>
    </div>`,'wide')}
  </div>`;
}

function bindUltimateGameHub(){
  if($('ultimateGameSelect'))$('ultimateGameSelect').onchange=event=>{
    ultimateGameHubState.selectedGameId=String(event.target.value);
    sessionStorage.setItem('onlybeats.selected-game',ultimateGameHubState.selectedGameId);
    saveUltimateGameHubState();
    renderPage();
  };

  const toggle=(id,key)=>{
    if($(id))$(id).onchange=event=>{
      ultimateGameHubState[key]=event.target.checked;
      saveUltimateGameHubState();
      startUltimateGameHubTimer();
      renderPage();
    };
  };

  toggle('ultimateAutoRefresh','autoRefresh');
  toggle('ultimateShowWeather','showWeather');
  toggle('ultimateShowStats','showTeamStats');
  toggle('ultimateShowPrediction','showPredictionContext');
  toggle('ultimateShowLive','showLiveDetails');
  toggle('ultimateShowNotes','showNotes');
  toggle('ultimateShowCombos','showComboMembership');
  toggle('ultimateCompactComparison','compactComparison');

  if($('ultimateRefreshSeconds'))$('ultimateRefreshSeconds').onchange=event=>{
    ultimateGameHubState.refreshSeconds=Number(event.target.value)||30;
    saveUltimateGameHubState();
    startUltimateGameHubTimer();
  };

  if($('ultimateRefreshNow'))$('ultimateRefreshNow').onclick=async()=>{
    const button=$('ultimateRefreshNow');
    button.disabled=true;
    button.textContent='Refreshing…';

    if(typeof runLiveDataCycle==='function'){
      await runLiveDataCycle(['scores','rankings','weather','availability']);
    }

    renderPage();
    toast('Ultimate Game Hub refreshed','success');
  };

  if($('ultimateWatchGame'))$('ultimateWatchGame').onclick=()=>{
    const model=buildUltimateGameHubModel();
    if(!model||typeof favoritesWatchlistsState==='undefined')return;

    const id=String(model.game.id);
    if(favoritesWatchlistsState.watchedGames.includes(id)){
      favoritesWatchlistsState.watchedGames=favoritesWatchlistsState.watchedGames.filter(item=>item!==id);
    }else{
      favoritesWatchlistsState.watchedGames.push(id);
    }

    saveFavoritesWatchlistsState();
    renderPage();
  };

  if($('ultimateSaveNotes'))$('ultimateSaveNotes').onclick=()=>{
    const model=buildUltimateGameHubModel();
    if(!model)return;

    ultimateGameNotes[String(model.game.id)]=$('ultimateGameNotes')?.value||'';
    saveUltimateGameHubState();
    toast('Game notes saved','success');
  };

  if($('ultimateClearNotes'))$('ultimateClearNotes').onclick=()=>{
    const model=buildUltimateGameHubModel();
    if(!model)return;

    ultimateGameNotes[String(model.game.id)]='';
    saveUltimateGameHubState();
    renderPage();
    toast('Game notes cleared');
  };

  if($('ultimateAddPrediction')||$('ultimateEditPrediction')){
    const button=$('ultimateAddPrediction')||$('ultimateEditPrediction');
    button.onclick=()=>{
      const model=buildUltimateGameHubModel();
      if(!model)return;
      sessionStorage.setItem('onlybeats.selected-game',String(model.game.id));
      navigate('predictions');
    };
  }
}

function startUltimateGameHubTimer(){
  clearInterval(ultimateGameHubTimer);
  if(!ultimateGameHubState.autoRefresh)return;

  ultimateGameHubTimer=setInterval(async()=>{
    if(document.hidden||!navigator.onLine)return;

    if(typeof runLiveDataCycle==='function'){
      await runLiveDataCycle(['scores','weather']);
    }

    if(currentPage==='gamehub')renderPage();
  },Math.max(15,Number(ultimateGameHubState.refreshSeconds)||30)*1000);
}

function installUltimateGameHubStyles(){
  if(document.getElementById('onlybeatsUltimateGameHubStyles'))return;

  const style=document.createElement('style');
  style.id='onlybeatsUltimateGameHubStyles';
  style.textContent=`
    .ultimate-game-selector{margin-bottom:14px}.ultimate-game-selector label{display:grid;gap:7px}
    .ultimate-scoreboard{padding:22px;border:1px solid rgba(244,189,69,.28);border-radius:24px;background:radial-gradient(circle at 50% 0%,rgba(244,189,69,.1),transparent 38%),#101822;margin-bottom:18px}
    .ultimate-scoreboard-top{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding-bottom:18px;border-bottom:1px solid rgba(255,255,255,.08)}
    .ultimate-scoreboard-top>div{display:grid;gap:5px}.ultimate-scoreboard-top span{color:#9aabbd}
    .ultimate-scoreboard-teams{display:grid;grid-template-columns:1fr 110px 1fr;gap:24px;align-items:center;padding-top:24px}
    .ultimate-score-team{display:flex;justify-content:space-between;gap:18px;align-items:center}
    .ultimate-score-team.home{text-align:right;flex-direction:row-reverse}
    .ultimate-score-team h2{font-size:clamp(1.8rem,4vw,3.2rem);line-height:1;margin:4px 0}
    .ultimate-score-team p,.ultimate-score-team small{color:#9aabbd}
    .ultimate-score-team>strong{font-size:clamp(3rem,7vw,6rem);line-height:1}
    .ultimate-rank{color:#f4bd45;font-weight:900}
    .ultimate-score-divider{display:grid;gap:12px;place-items:center;color:#9aabbd}
    .ultimate-weather-grid,.ultimate-prediction-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
    .ultimate-weather-grid>div,.ultimate-prediction-grid>div{padding:13px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}
    .ultimate-weather-grid span,.ultimate-prediction-grid span{display:block;color:#9aabbd;font-size:.8rem}
    .ultimate-weather-grid strong,.ultimate-prediction-grid strong{display:block;margin-top:6px;font-size:1.15rem}
    .ultimate-comparison{display:grid;gap:7px}.ultimate-comparison.compact{font-size:.85rem}
    .ultimate-comparison-head,.ultimate-comparison-row{display:grid;grid-template-columns:1fr minmax(140px,.8fr) 1fr;gap:14px;align-items:center;padding:10px;border-radius:10px}
    .ultimate-comparison-head{color:#f4bd45}.ultimate-comparison-row{background:rgba(255,255,255,.025)}
    .ultimate-comparison-head>:last-child,.ultimate-comparison-row>:last-child{text-align:right}
    .ultimate-comparison-head span,.ultimate-comparison-row span{text-align:center;color:#9aabbd}
    .ultimate-prediction-primary{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}
    .ultimate-prediction-primary h2{font-size:2rem;margin:3px 0}
    .ultimate-unavailable{display:grid;gap:8px;padding:16px;border:1px dashed rgba(255,255,255,.14);border-radius:13px;color:#9aabbd}
    .ultimate-unavailable strong{color:#fff}.ultimate-unavailable .button{justify-self:start;margin-top:5px}
    .ultimate-notes{display:grid;gap:12px}.ultimate-notes textarea{min-height:180px;resize:vertical}
    @media(max-width:900px){
      .ultimate-scoreboard-top{grid-template-columns:1fr}
      .ultimate-scoreboard-teams{grid-template-columns:1fr}
      .ultimate-score-team.home{flex-direction:row;text-align:left}
      .ultimate-score-divider{grid-template-columns:auto 1fr}
    }
    @media(max-width:650px){
      .ultimate-comparison-head,.ultimate-comparison-row{grid-template-columns:1fr}
      .ultimate-comparison-head>*,
      .ultimate-comparison-row>*,
      .ultimate-comparison-head>:last-child,
      .ultimate-comparison-row>:last-child{text-align:left}
    }
  `;
  document.head.appendChild(style);
}

function initializeUltimateGameHub(){
  loadUltimateGameHubState();
  installUltimateGameHubStyles();
  startUltimateGameHubTimer();
}
