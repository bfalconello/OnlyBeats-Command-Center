'use strict';

// M3.3 Multi-Game Watch Center.
// Pinned games are saved locally and remain independent from favorite teams.

function saveWatchCenter(){
  localStorage.setItem(WATCH_KEY,JSON.stringify(pinnedGameIds));
}

function cleanPinnedGames(){
  const available=new Set(games.map(game=>game.id));
  const cleaned=pinnedGameIds.filter(id=>available.has(id));
  if(cleaned.length!==pinnedGameIds.length){
    pinnedGameIds=cleaned;
    saveWatchCenter();
  }
}

function watchPriority(game){
  let score=0;
  if(game.state==='in')score+=1000;
  if(isFavoriteGame(game))score+=300;
  if(isTop25(game))score+=200;
  if(game.state==='pre')score+=100;
  if(game.state==='post')score-=100;
  const margin=Math.abs(game.away.score-game.home.score);
  if(game.state==='in')score+=Math.max(0,50-margin);
  return score;
}

function watchSortedGames(list){
  return [...list].sort((a,b)=>{
    const priority=watchPriority(b)-watchPriority(a);
    if(priority)return priority;
    return new Date(a.date)-new Date(b.date);
  });
}

function watchPredictionSummary(game){
  const snapshot=gamePredictionSnapshot(game);
  if(!snapshot.rows.length)return '<span class="provider-badge">NO PREDICTION</span>';
  const pending=snapshot.rows.filter(row=>row.result.status==='pending').length;
  const correct=snapshot.rows.filter(row=>row.result.status==='correct').length;
  return `<span class="provider-badge">${snapshot.rows.length} PICK${snapshot.rows.length===1?'':'S'} · ${pending} PENDING · ${correct} CORRECT</span>`;
}

function watchAvailabilitySummary(game){
  const snapshot=gameAvailabilitySnapshot(game);
  if(!snapshot.entries.length)return 'No availability notes';
  return `${snapshot.concerning.length} need attention · ${snapshot.entries.length} saved`;
}

function watchGameCard(game){
  const favorite=isFavoriteGame(game);
  const ranked=isTop25(game);
  const margin=Math.abs(game.away.score-game.home.score);
  return `<article class="card watch-game-card state-${game.state}">
    <div class="card-head">
      <div>
        <span class="status-badge state-${game.state}">${statusLabel(game.state)}</span>
        ${favorite?'<span class="provider-badge">★ FAVORITE</span>':''}
        ${ranked?'<span class="provider-badge">TOP 25</span>':''}
      </div>
      <button class="icon-button danger" data-watch-remove="${game.id}" title="Remove from Watch Center">×</button>
    </div>
    <button class="watch-matchup" data-game="${game.id}">
      <div class="wall-matchup">${teamLine(game.away)}${teamLine(game.home)}</div>
      <div class="wall-card-bottom">
        <span>${esc(game.status)}</span>
        <span>${esc(game.network||game.venue||'Details available')}</span>
      </div>
    </button>
    <div class="detail-list">
      <div><span>Prediction</span><strong>${watchPredictionSummary(game)}</strong></div>
      <div><span>Availability</span><strong>${esc(watchAvailabilitySummary(game))}</strong></div>
      <div><span>Game state</span><strong>${game.state==='in'?`${game.clock||''}${game.period?` · Q${game.period}`:''}${margin<=8?' · CLOSE GAME':''}`:kickoffText(game)}</strong></div>
    </div>
    <div class="button-row">
      <button class="button primary" data-watch-focus="${game.id}">Focus</button>
      <button class="button" data-watch-predict="${game.id}">Prediction</button>
      <button class="button" data-game="${game.id}">Details</button>
    </div>
  </article>`;
}

function watchSuggestedGames(){
  const pinned=new Set(pinnedGameIds);
  return watchSortedGames(games.filter(game=>!pinned.has(game.id))).slice(0,12);
}

function watchSuggestionRow(game){
  const reason=game.state==='in'
    ? 'Live now'
    : isFavoriteGame(game)
      ? 'Favorite team'
      : isTop25(game)
        ? 'Ranked matchup'
        : kickoffText(game);
  return `<div class="intel-row">
    <span class="intel-icon">${game.state==='in'?'●':isFavoriteGame(game)?'★':isTop25(game)?'#':'◷'}</span>
    <div>
      <strong>${game.away.rank?`#${game.away.rank} `:''}${esc(game.away.shortName)} at ${game.home.rank?`#${game.home.rank} `:''}${esc(game.home.shortName)}</strong>
      <small>${esc(reason)}${game.network?` · ${esc(game.network)}`:''}</small>
    </div>
    <button class="button" data-watch-add="${game.id}">Pin</button>
  </div>`;
}

function watchCenterPage(){
  setHeading('Multi-Game Watch Center','PINNED GAMES · LIVE-FIRST MONITORING');
  cleanPinnedGames();

  const pinned=watchSortedGames(games.filter(game=>pinnedGameIds.includes(game.id)));
  const suggestions=watchSuggestedGames();
  const live=pinned.filter(game=>game.state==='in');
  const favorites=pinned.filter(isFavoriteGame);
  const ranked=pinned.filter(isTop25);
  const closeGames=live.filter(game=>Math.abs(game.away.score-game.home.score)<=8);

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">MULTI-GAME WATCH CENTER</p>
      <h2>${pinned.length?`${pinned.length} pinned game${pinned.length===1?'':'s'}.`:'Build your personal Saturday watchlist.'}</h2>
      <p>Monitor several games at once. Live games rise to the top, followed by favorites, ranked matchups, and upcoming kickoffs.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="refreshScores">${loading?'Refreshing…':'Refresh watch center'}</button>
      ${pinned.length?'<button class="button" id="clearWatchCenter">Clear pins</button>':''}
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Pinned Games',pinned.length,'Saved locally')}
    ${metric('Live Now',live.length,'Pinned games')}
    ${metric('Favorite Games',favorites.length,'Pinned games')}
    ${metric('Ranked Games',ranked.length,'Pinned games')}
    ${metric('Close Games',closeGames.length,'Within 8 points')}
    ${metric('Available to Pin',Math.max(0,games.length-pinned.length),'Loaded slate')}
  </div>

  ${syncError?`<div class="provider-notice"><div><strong>Showing cached watch data</strong><p class="muted">${esc(syncError)}</p></div><button class="button" id="refreshScores">Try again</button></div>`:''}

  <section class="watch-center-grid">
    ${pinned.length?pinned.map(watchGameCard).join(''):empty('No games pinned yet','Use the recommendations below or pin games from the loaded slate.')}
  </section>

  ${card('Recommended Games to Pin',suggestions.length?`<div class="intel-list">${suggestions.map(watchSuggestionRow).join('')}</div>`:empty('No additional games available','Every loaded game is already pinned.'),'wide')}`;
}

function bindWatchCenter(){
  document.querySelectorAll('[data-watch-add]').forEach(button=>{
    button.onclick=()=>{
      const id=button.dataset.watchAdd;
      if(!pinnedGameIds.includes(id))pinnedGameIds.push(id);
      saveWatchCenter();
      toast('Game pinned to Watch Center');
      renderPage();
    };
  });

  document.querySelectorAll('[data-watch-remove]').forEach(button=>{
    button.onclick=()=>{
      pinnedGameIds=pinnedGameIds.filter(id=>id!==button.dataset.watchRemove);
      saveWatchCenter();
      toast('Game removed from Watch Center');
      renderPage();
    };
  });

  document.querySelectorAll('[data-watch-focus]').forEach(button=>{
    button.onclick=()=>openFocus(button.dataset.watchFocus);
  });

  document.querySelectorAll('[data-watch-predict]').forEach(button=>{
    button.onclick=()=>{
      predictionDraftGameId=button.dataset.watchPredict;
      editingPredictionId='';
      predictionView='games';
      navigate('predictions');
    };
  });

  if($('clearWatchCenter')){
    $('clearWatchCenter').onclick=()=>{
      if(confirm('Remove every pinned game from Watch Center?')){
        pinnedGameIds=[];
        saveWatchCenter();
        renderPage();
      }
    };
  }
}
