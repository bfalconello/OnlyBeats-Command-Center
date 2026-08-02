'use strict';

// v0.13 Smart Saturday Briefing — Phase 1.
// Summarizes existing trusted app data into a concise GameDay briefing.

function briefingTodayGames(){
  const today=startOfLocalDay();
  const tomorrow=new Date(today);
  tomorrow.setDate(tomorrow.getDate()+1);
  return sortGames(games.filter(game=>{
    const date=new Date(game.date);
    return date>=today&&date<tomorrow;
  }));
}

function briefingMissingPredictions(todayGames){
  const predicted=new Set(predictions.map(prediction=>prediction.gameId));
  return todayGames.filter(game=>game.state!=='post'&&!predicted.has(game.id));
}

function briefingFavoriteGames(todayGames){
  return todayGames.filter(isFavoriteGame);
}

function briefingAvailabilityConcerns(todayGames){
  const teamIds=new Set(todayGames.flatMap(game=>[game.away.abbr,game.home.abbr]));
  return availabilityEntries.filter(entry=>
    teamIds.has(entry.team)&&
    ['Questionable','Doubtful','Unavailable','Unknown'].includes(entry.status)
  );
}

function briefingTopPriorities(){
  return prioritizedGames().filter(item=>item.score>0).slice(0,5);
}

function briefingHeadline(summary){
  if(summary.live.length){
    return `${summary.live.length} live game${summary.live.length===1?'':'s'} need attention now.`;
  }
  if(summary.favoriteGames.length){
    return `${summary.favoriteGames.length} favorite-team game${summary.favoriteGames.length===1?'':'s'} on today’s slate.`;
  }
  if(summary.todayGames.length){
    return `${summary.todayGames.length} game${summary.todayGames.length===1?'':'s'} loaded for today.`;
  }
  return 'Your Saturday briefing is ready when the slate loads.';
}

function briefingSummary(){
  const todayGames=briefingTodayGames();
  const priorities=briefingTopPriorities();
  const live=todayGames.filter(game=>game.state==='in');
  const upcoming=todayGames.filter(game=>game.state==='pre');
  const finals=todayGames.filter(game=>game.state==='post');
  const favoriteGames=briefingFavoriteGames(todayGames);
  const missingPredictions=briefingMissingPredictions(todayGames);
  const concerns=briefingAvailabilityConcerns(todayGames);
  const prediction=combinedAnalytics();
  return {
    todayGames,priorities,live,upcoming,finals,favoriteGames,
    missingPredictions,concerns,prediction
  };
}

function briefingPriorityRow(item){
  const game=item.game;
  const recommendation=gameRecommendation(item);
  return `<div class="intel-row">
    <span class="intel-icon">${item.score>=70?'!':game.state==='in'?'●':isFavoriteGame(game)?'★':'◈'}</span>
    <div>
      <strong>${game.away.rank?`#${game.away.rank} `:''}${esc(game.away.shortName)} at ${game.home.rank?`#${game.home.rank} `:''}${esc(game.home.shortName)}</strong>
      <small>Priority ${item.score} · ${esc(item.reasons.join(' · '))}</small>
    </div>
    <button class="button" data-briefing-action="${recommendation.action}" data-game-id="${game.id}">${esc(recommendation.label)}</button>
  </div>`;
}

function briefingMissingPredictionRow(game){
  return `<div class="intel-row">
    <span class="intel-icon">○</span>
    <div>
      <strong>${esc(game.away.shortName)} at ${esc(game.home.shortName)}</strong>
      <small>${esc(kickoffText(game))}${game.network?` · ${esc(game.network)}`:''}</small>
    </div>
    <button class="button" data-briefing-action="prediction" data-game-id="${game.id}">Add prediction</button>
  </div>`;
}

function briefingConcernRow(entry){
  return `<div class="intel-row">
    <span class="intel-icon">♙</span>
    <div>
      <strong>${esc(entry.player)} · ${esc(entry.team)}</strong>
      <small>${esc(entry.status)}${entry.notes?` · ${esc(entry.notes)}`:''}</small>
    </div>
    <button class="button" data-page-jump="availability">Review</button>
  </div>`;
}

function smartBriefingPage(){
  setHeading('Smart Saturday Briefing','YOUR GAMEDAY SUMMARY · NEXT ACTIONS');
  const summary=briefingSummary();
  const top=summary.priorities[0]||null;

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">SMART SATURDAY BRIEFING</p>
      <h2>${esc(briefingHeadline(summary))}</h2>
      <p>This briefing combines today’s schedule, live priorities, favorites, saved predictions, and manual availability notes into one concise overview.</p>
    </div>
    <button class="button primary" id="refreshScores">${loading?'Refreshing briefing…':'Refresh briefing'}</button>
  </section>

  <div class="metric-grid">
    ${metric('Today’s Games',summary.todayGames.length,`${summary.live.length} live · ${summary.upcoming.length} upcoming`)}
    ${metric('Favorite Games',summary.favoriteGames.length,'Today’s slate')}
    ${metric('Missing Predictions',summary.missingPredictions.length,'Upcoming games')}
    ${metric('Availability Concerns',summary.concerns.length,'Manual notes')}
    ${metric('Season Accuracy',`${summary.prediction.accuracy.toFixed(1)}%`,`${summary.prediction.correct}/${summary.prediction.decisions} correct`)}
    ${metric('Top Priority',top?top.score:0,top?`${top.game.away.abbr} at ${top.game.home.abbr}`:'No signal')}
  </div>

  ${syncError?`<div class="provider-notice"><div><strong>Using cached briefing data</strong><p class="muted">${esc(syncError)}</p></div><button class="button" id="refreshScores">Try again</button></div>`:''}

  ${top?`<section class="card command-top-signal">
    <div>
      <p class="eyebrow">TOP RECOMMENDATION</p>
      <h3>${esc(gameRecommendation(top).label)}</h3>
      <p class="muted">${esc(top.reasons.join(' · '))}</p>
    </div>
    <button class="button primary" data-briefing-action="${gameRecommendation(top).action}" data-game-id="${top.game.id}">${esc(gameRecommendation(top).label)}</button>
  </section>`:''}

  <div class="reports-grid">
    ${card('What Matters Now',summary.priorities.length?`<div class="intel-list">${summary.priorities.map(briefingPriorityRow).join('')}</div>`:empty('No active priorities','Priorities will appear as games, favorites, predictions, and availability notes become relevant.'),'wide')}
    ${card('Predictions to Add',summary.missingPredictions.length?`<div class="intel-list">${summary.missingPredictions.slice(0,10).map(briefingMissingPredictionRow).join('')}</div>`:empty('No missing predictions','Every upcoming game on today’s loaded slate has a saved prediction.'))}
    ${card('Availability to Review',summary.concerns.length?`<div class="intel-list">${summary.concerns.slice(0,10).map(briefingConcernRow).join('')}</div>`:empty('No concerns saved','No manual availability notes need attention for today’s teams.'))}
    ${card('Quick Actions',`<div class="command-quick-links">
      <button class="button" data-page-jump="watch">Open Watch Center</button>
      <button class="button" data-page-jump="wall">Open Saturday Wall</button>
      <button class="button" data-page-jump="predictions">Open Prediction Center</button>
      <button class="button" data-page-jump="rankings">Open Intelligence</button>
      <button class="button" data-page-jump="schedule">Open Schedule</button>
      <button class="button" data-page-jump="weather">Open Weather</button>
    </div>`,'wide')}
  </div>`;
}

function runBriefingAction(action,gameId){
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

function bindSmartBriefing(){
  document.querySelectorAll('[data-briefing-action]').forEach(button=>{
    button.onclick=()=>runBriefingAction(button.dataset.briefingAction,button.dataset.gameId);
  });
}
