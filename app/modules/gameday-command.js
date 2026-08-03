'use strict';

// OnlyBeats v1.9 GameDay Command Center — Phase 1.
// Uses only provider fields already available in the app.

const GAMEDAY_COMMAND_KEY='onlybeats.gameday-command.v1';

let gameDaySettings={
  preset:'balanced',
  autoFocus:false,
  compactGrid:true,
  closeMargin:8,
  includeFavorites:true
};

let gameDayFilter='all';
let gameDayAutoFocusTimer=null;

function loadGameDaySettings(){
  try{
    gameDaySettings={...gameDaySettings,...JSON.parse(localStorage.getItem(GAMEDAY_COMMAND_KEY)||'{}')};
  }catch{}
}

function saveGameDaySettings(){
  localStorage.setItem(GAMEDAY_COMMAND_KEY,JSON.stringify(gameDaySettings));
}

function gameDayWindow(game){
  const date=new Date(game.date);
  const hour=date.getHours();

  if(hour<15)return 'Noon';
  if(hour<19)return 'Afternoon';
  if(hour<23)return 'Primetime';
  return 'Late Night';
}

function gameDayMargin(game){
  return Math.abs((Number(game.away.score)||0)-(Number(game.home.score)||0));
}

function gameDayClose(game){
  return game.state==='in'&&gameDayMargin(game)<=Number(gameDaySettings.closeMargin||8);
}

function gameDayPredictionAlert(game){
  const active=predictions.filter(prediction=>prediction.gameId===game.id);
  if(!active.length)return null;

  const trailing=active.some(prediction=>{
    if(game.state!=='in'||!prediction.pick)return false;
    if(prediction.pick===game.away.abbr)return game.away.score<game.home.score;
    if(prediction.pick===game.home.abbr)return game.home.score<game.away.score;
    return false;
  });

  const highConfidence=active.some(prediction=>(Number(prediction.confidence)||0)>=80);

  if(trailing)return {level:'critical',label:'Prediction team trailing'};
  if(highConfidence&&game.state==='in')return {level:'warning',label:'High-confidence prediction live'};
  return {level:'info',label:`${active.length} saved prediction${active.length===1?'':'s'}`};
}

function gameDayPriority(game){
  const insight=typeof smartGameInsight==='function'?smartGameInsight(game):null;
  let score=insight?.watchScore||0;

  if(gameDayClose(game))score+=24;
  if(game.state==='in')score+=18;
  if(isTop25(game))score+=12;
  if(isFavoriteGame(game))score+=12;
  if(gameDayPredictionAlert(game)?.level==='critical')score+=24;

  return insightClamp?insightClamp(score):Math.max(0,Math.min(100,score));
}

function gameDayRows(){
  let rows=games.map(game=>({
    game,
    priority:gameDayPriority(game),
    close:gameDayClose(game),
    predictionAlert:gameDayPredictionAlert(game),
    window:gameDayWindow(game)
  }));

  if(gameDayFilter==='live')rows=rows.filter(row=>row.game.state==='in');
  if(gameDayFilter==='close')rows=rows.filter(row=>row.close);
  if(gameDayFilter==='ranked')rows=rows.filter(row=>isTop25(row.game));
  if(gameDayFilter==='favorites')rows=rows.filter(row=>isFavoriteGame(row.game));
  if(gameDayFilter==='predictions')rows=rows.filter(row=>row.predictionAlert);

  return rows.sort((a,b)=>{
    const stateOrder={in:0,pre:1,post:2};
    return (stateOrder[a.game.state]??9)-(stateOrder[b.game.state]??9)
      ||b.priority-a.priority
      ||new Date(a.game.date)-new Date(b.game.date);
  });
}

function gameDayPresetFilter(){
  const preset=gameDaySettings.preset;
  if(preset==='ranked')return 'ranked';
  if(preset==='predictions')return 'predictions';
  if(preset==='favorites')return 'favorites';
  if(preset==='close')return 'close';
  return 'all';
}

function gameDayApplyPreset(preset){
  gameDaySettings.preset=preset;
  gameDayFilter=gameDayPresetFilter();
  saveGameDaySettings();
}

function gameDayScorecard(row){
  const game=row.game;
  const alert=row.predictionAlert;

  return `<article class="card">
    <div class="card-head">
      <div>
        <span class="provider-badge">${esc(game.state==='in'?'LIVE':row.window)}</span>
        <h3>${game.away.rank?`#${game.away.rank} `:''}${esc(game.away.shortName)} at ${game.home.rank?`#${game.home.rank} `:''}${esc(game.home.shortName)}</h3>
      </div>
      <strong>${row.priority.toFixed(0)}</strong>
    </div>

    <div class="scoreboard-score">
      <span>${game.away.score}</span><b>–</b><span>${game.home.score}</span>
    </div>

    <p class="muted">${esc(game.status)}${game.network?` · ${esc(game.network)}`:''}</p>

    <div class="detail-list">
      <div><span>Priority</span><strong>${row.priority.toFixed(0)}</strong></div>
      <div><span>Margin</span><strong>${game.state==='in'?gameDayMargin(game):'—'}</strong></div>
      <div><span>Prediction signal</span><strong>${esc(alert?.label||'None')}</strong></div>
    </div>

    <div class="button-row">
      <button class="button primary" data-gameday-focus="${game.id}">Focus</button>
      <button class="button" data-gameday-game="${game.id}">Game Hub</button>
      <button class="button" data-gameday-popout="${game.id}">Pop out</button>
    </div>
  </article>`;
}

function gameDayWindowSection(label,rows){
  if(!rows.length)return '';
  return `<section class="card wide">
    <div class="card-head">
      <div><p class="eyebrow">${esc(label.toUpperCase())}</p><h3>${rows.length} game${rows.length===1?'':'s'}</h3></div>
    </div>
    <div class="${gameDaySettings.compactGrid?'command-center-grid':'reports-grid'}">
      ${rows.map(gameDayScorecard).join('')}
    </div>
  </section>`;
}

function gameDaySummary(){
  const rows=gameDayRows();
  return {
    rows,
    live:rows.filter(row=>row.game.state==='in').length,
    close:rows.filter(row=>row.close).length,
    ranked:rows.filter(row=>isTop25(row.game)).length,
    favorites:rows.filter(row=>isFavoriteGame(row.game)).length,
    predictions:rows.filter(row=>row.predictionAlert).length,
    top:[...rows].sort((a,b)=>b.priority-a.priority)[0]||null
  };
}

function gameDayCommandPage(){
  setHeading('GameDay Command','LIVE · CLOSE · RANKED · PREDICTIONS');

  const summary=gameDaySummary();
  const groups=['Noon','Afternoon','Primetime','Late Night']
    .map(label=>[label,summary.rows.filter(row=>row.window===label)]);

  return `<section class="hero command-center-hero">
    <div class="hero-copy">
      <p class="eyebrow">ONLYBEATS GAMEDAY COMMAND</p>
      <h2>${summary.top?`Top priority: ${esc(summary.top.game.away.shortName)} at ${esc(summary.top.game.home.shortName)}.`:'GameDay Command is standing by.'}</h2>
      <p>Manage live, close, ranked, favorite, and prediction-related games from a single compact operations view.</p>

      <div class="button-row">
        <button class="button primary" id="refreshGameDay">${loading?'Refreshing GameDay…':'Refresh GameDay'}</button>
        <button class="button" id="toggleGameDayAutoFocus">${gameDaySettings.autoFocus?'Disable':'Enable'} Auto Focus</button>
        <button class="button" id="toggleGameDayGrid">${gameDaySettings.compactGrid?'Expanded':'Compact'} grid</button>
        <button class="button" data-page-jump="mission">Mission Control</button>
      </div>
    </div>
    <img src="assets/onlybeats-icon.png" alt="OnlyBeats logo">
  </section>

  <div class="metric-grid">
    ${metric('Live',summary.live,'Current filtered view')}
    ${metric('Close Games',summary.close,`${gameDaySettings.closeMargin}-point margin or less`)}
    ${metric('Ranked',summary.ranked,'Top-25 context')}
    ${metric('Favorites',summary.favorites,'Favorite-team games')}
    ${metric('Prediction Signals',summary.predictions,'Saved prediction activity')}
    ${metric('Auto Focus',gameDaySettings.autoFocus?'On':'Off','Highest-priority live game')}
  </div>

  <section class="card">
    <div class="card-head">
      <div><p class="eyebrow">LAYOUT PRESETS</p><h3>Choose the games that matter now</h3></div>
    </div>

    <div class="button-row">
      ${[
        ['balanced','Balanced'],
        ['close','Close Games'],
        ['ranked','Ranked Games'],
        ['predictions','Predictions'],
        ['favorites','Favorites']
      ].map(([id,label])=>`<button class="button ${gameDaySettings.preset===id?'primary':''}" data-gameday-preset="${id}">${label}</button>`).join('')}
    </div>
  </section>

  <div class="wall-toolbar">
    <div class="wall-status-tabs">
      ${[
        ['all','All'],
        ['live','Live'],
        ['close','Close'],
        ['ranked','Ranked'],
        ['favorites','Favorites'],
        ['predictions','Predictions']
      ].map(([id,label])=>`<button class="filter-button ${gameDayFilter===id?'active':''}" data-gameday-filter="${id}">${label}</button>`).join('')}
    </div>
  </div>

  ${summary.rows.length
    ? groups.map(([label,rows])=>gameDayWindowSection(label,rows)).join('')
    : empty('No games in this view','Change the preset or refresh the live provider.')}`;
}

function runGameDayAutoFocus(){
  if(!gameDaySettings.autoFocus)return;
  const top=gameDaySummary().rows
    .filter(row=>row.game.state==='in')
    .sort((a,b)=>b.priority-a.priority)[0];

  if(top)openFocus(top.game.id);
}

function startGameDayAutoFocus(){
  clearInterval(gameDayAutoFocusTimer);
  if(!gameDaySettings.autoFocus)return;

  gameDayAutoFocusTimer=setInterval(()=>{
    if(currentPage==='gameday'&&!document.hidden){
      runGameDayAutoFocus();
    }
  },120000);
}

function bindGameDayCommand(){
  document.querySelectorAll('[data-gameday-filter]').forEach(button=>{
    button.onclick=()=>{
      gameDayFilter=button.dataset.gamedayFilter;
      renderPage();
    };
  });

  document.querySelectorAll('[data-gameday-preset]').forEach(button=>{
    button.onclick=()=>{
      gameDayApplyPreset(button.dataset.gamedayPreset);
      renderPage();
    };
  });

  document.querySelectorAll('[data-gameday-focus]').forEach(button=>{
    button.onclick=()=>openFocus(button.dataset.gamedayFocus);
  });

  document.querySelectorAll('[data-gameday-game]').forEach(button=>{
    button.onclick=()=>{
      openUltimateGameHub(button.dataset.gamedayGame);
    };
  });

  document.querySelectorAll('[data-gameday-popout]').forEach(button=>{
    button.onclick=()=>openMissionPopout(button.dataset.gamedayPopout);
  });

  if($('refreshGameDay'))$('refreshGameDay').onclick=async()=>{
    const button=$('refreshGameDay');
    button.disabled=true;
    button.textContent='Refreshing GameDay…';

    try{
      await syncScores(false);
      captureLiveAlerts('score-refresh');
      renderPage();
    }finally{
      const active=$('refreshGameDay');
      if(active){
        active.disabled=false;
        active.textContent='Refresh GameDay';
      }
    }
  };

  if($('toggleGameDayAutoFocus'))$('toggleGameDayAutoFocus').onclick=()=>{
    gameDaySettings.autoFocus=!gameDaySettings.autoFocus;
    saveGameDaySettings();
    startGameDayAutoFocus();
    renderPage();
    toast(`Auto Focus ${gameDaySettings.autoFocus?'enabled':'disabled'}`);
  };

  if($('toggleGameDayGrid'))$('toggleGameDayGrid').onclick=()=>{
    gameDaySettings.compactGrid=!gameDaySettings.compactGrid;
    saveGameDaySettings();
    renderPage();
  };
}

function initializeGameDayCommand(){
  loadGameDaySettings();
  gameDayFilter=gameDayPresetFilter();
  startGameDayAutoFocus();
}
