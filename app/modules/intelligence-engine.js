'use strict';

// v0.12 Intelligence Engine — Phase 1.
// Combines trusted app data into priorities and recommendations.

function gamePriorityBreakdown(game){
  let score=0;
  const reasons=[];

  if(game.state==='in'){
    score+=40;
    reasons.push('Live now');
  }else if(game.state==='pre'){
    const minutes=(new Date(game.date)-new Date())/60000;
    if(minutes>=0&&minutes<=60){
      score+=18;
      reasons.push('Kickoff within 60 minutes');
    }else if(minutes>60&&minutes<=180){
      score+=10;
      reasons.push('Kickoff soon');
    }
  }

  if(isFavoriteGame(game)){
    score+=25;
    reasons.push('Favorite team');
  }

  if(isTop25(game)){
    score+=18;
    reasons.push('Ranked matchup');
  }

  const margin=Math.abs(game.away.score-game.home.score);
  if(game.state==='in'&&margin<=8){
    score+=20;
    reasons.push('Close game');
  }

  const prediction=gamePredictionSnapshot(game);
  if(prediction.rows.length){
    score+=15;
    reasons.push(`${prediction.rows.length} saved prediction${prediction.rows.length===1?'':'s'}`);
  }

  const availability=gameAvailabilitySnapshot(game);
  if(availability.concerning.length){
    score+=Math.min(12,availability.concerning.length*4);
    reasons.push(`${availability.concerning.length} availability concern${availability.concerning.length===1?'':'s'}`);
  }

  const rankedTrailing=game.state!=='pre'&&(
    (game.away.rank&&game.away.score<game.home.score)||
    (game.home.rank&&game.home.score<game.away.score)
  );
  if(rankedTrailing){
    score+=20;
    reasons.push('Upset signal');
  }

  if(game.state==='post'){
    score-=10;
  }

  return {score:Math.max(0,score),reasons};
}

function prioritizedGames(){
  return games.map(game=>({game,...gamePriorityBreakdown(game)}))
    .sort((a,b)=>b.score-a.score||new Date(a.game.date)-new Date(b.game.date));
}

function gameRecommendation(item){
  const game=item.game;
  if(game.state==='in')return {label:'Open Focus Mode',action:'focus'};
  if(gamePredictionSnapshot(game).rows.length)return {label:'Review prediction',action:'prediction'};
  if(gameAvailabilitySnapshot(game).concerning.length)return {label:'Check availability',action:'availability'};
  if(isFavoriteGame(game)||isTop25(game))return {label:'Open game details',action:'details'};
  return {label:'Pin to Watch Center',action:'pin'};
}

function intelligenceSignalRows(){
  return prioritizedGames().filter(item=>item.score>0).slice(0,20);
}

function engineSummary(){
  const rows=intelligenceSignalRows();
  const live=rows.filter(item=>item.game.state==='in');
  const upset=rows.filter(item=>item.reasons.includes('Upset signal'));
  const prediction=rows.filter(item=>item.reasons.some(reason=>reason.includes('saved prediction')));
  const availability=rows.filter(item=>item.reasons.some(reason=>reason.includes('availability concern')));
  return {rows,live,upset,prediction,availability};
}

function priorityBadge(score){
  if(score>=70)return '<span class="provider-badge">CRITICAL</span>';
  if(score>=45)return '<span class="provider-badge">HIGH</span>';
  if(score>=25)return '<span class="provider-badge">MEDIUM</span>';
  return '<span class="provider-badge">LOW</span>';
}

function intelligenceGameCard(item){
  const game=item.game;
  const recommendation=gameRecommendation(item);
  return `<article class="card">
    <div class="card-head">
      <div>
        <span class="status-badge state-${game.state}">${statusLabel(game.state)}</span>
        ${priorityBadge(item.score)}
      </div>
      <strong>${item.score}</strong>
    </div>
    <button class="watch-matchup" data-game="${game.id}">
      <div class="wall-matchup">${teamLine(game.away)}${teamLine(game.home)}</div>
      <div class="wall-card-bottom">
        <span>${esc(game.status)}</span>
        <span>${esc(game.network||game.venue||'Details available')}</span>
      </div>
    </button>
    <div class="favorite-list">${item.reasons.map(reason=>`<span class="favorite-chip">${esc(reason)}</span>`).join('')}</div>
    <div class="button-row">
      <button class="button primary" data-engine-action="${recommendation.action}" data-game-id="${game.id}">${recommendation.label}</button>
      <button class="button" data-game="${game.id}">Details</button>
    </div>
  </article>`;
}

function intelligenceFeedRow(item){
  const game=item.game;
  return `<div class="intel-row">
    <span class="intel-icon">${item.score>=70?'!':game.state==='in'?'●':isFavoriteGame(game)?'★':'◈'}</span>
    <div>
      <strong>${game.away.rank?`#${game.away.rank} `:''}${esc(game.away.shortName)} at ${game.home.rank?`#${game.home.rank} `:''}${esc(game.home.shortName)}</strong>
      <small>Priority ${item.score} · ${esc(item.reasons.join(' · '))}</small>
    </div>
    <button class="button" data-engine-action="focus" data-game-id="${game.id}">Open</button>
  </div>`;
}

function intelligenceEnginePage(){
  setHeading('Intelligence Engine','WHAT MATTERS NOW · PRIORITIZED ACTIONS');
  const summary=engineSummary();
  const top=summary.rows[0]||null;

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">ONLYBEATS INTELLIGENCE ENGINE</p>
      <h2>${top?`Top priority: ${esc(top.game.away.shortName)} at ${esc(top.game.home.shortName)}.`:'No active priorities yet.'}</h2>
      <p>The engine combines live status, favorites, rankings, close scores, saved predictions, and availability notes into one prioritized feed.</p>
    </div>
    <button class="button primary" id="refreshIntelligence">${loading?'Refreshing intelligence…':'Refresh intelligence'}</button>
  </section>

  <div class="metric-grid">
    ${metric('Active Signals',summary.rows.length,'Prioritized games')}
    ${metric('Live Priorities',summary.live.length,'Live games')}
    ${metric('Upset Signals',summary.upset.length,'Ranked teams trailing')}
    ${metric('Prediction Signals',summary.prediction.length,'Saved picks involved')}
    ${metric('Availability Signals',summary.availability.length,'Need attention')}
    ${metric('Top Priority',top?top.score:0,top?`${top.game.away.abbr} at ${top.game.home.abbr}`:'No signal')}
  </div>

  ${syncError?`<div class="provider-notice"><div><strong>Using cached intelligence</strong><p class="muted">${esc(syncError)}</p></div><button class="button" id="refreshIntelligence">Try again</button></div>`:''}

  ${top?`<section class="card command-top-signal">
    <div>
      <p class="eyebrow">RECOMMENDED NEXT ACTION</p>
      <h3>${esc(gameRecommendation(top).label)}</h3>
      <p class="muted">${esc(top.reasons.join(' · '))}</p>
    </div>
    <button class="button primary" data-engine-action="${gameRecommendation(top).action}" data-game-id="${top.game.id}">${esc(gameRecommendation(top).label)}</button>
  </section>`:''}

  <div class="command-center-grid">
    ${summary.rows.slice(0,6).map(intelligenceGameCard).join('')||empty('No intelligence signals','Refresh the scoreboard or wait for games, predictions, favorites, or availability notes to create priorities.')}
  </div>

  ${card('Unified Intelligence Feed',summary.rows.length?`<div class="intel-list">${summary.rows.map(intelligenceFeedRow).join('')}</div>`:empty('No signals yet','The feed will populate automatically as your GameDay data changes.'),'wide')}`;
}

function runEngineAction(action,gameId){
  const game=games.find(candidate=>candidate.id===gameId);
  if(!game)return;

  if(action==='focus'){
    openFocus(gameId);
    return;
  }

  if(action==='prediction'){
    predictionDraftGameId=gameId;
    editingPredictionId='';
    predictionView='games';
    navigate('predictions');
    return;
  }

  if(action==='availability'){
    navigate('availability');
    return;
  }

  if(action==='details'){
    showGame(gameId);
    return;
  }

  if(action==='pin'){
    if(!pinnedGameIds.includes(gameId)){
      pinnedGameIds.push(gameId);
      saveWatchCenter();
      toast('Game pinned to Watch Center');
    }
    navigate('watch');
  }
}

function bindIntelligenceEngine(){
  document.querySelectorAll('[data-engine-action]').forEach(button=>{
    button.onclick=()=>runEngineAction(button.dataset.engineAction,button.dataset.gameId);
  });
}
