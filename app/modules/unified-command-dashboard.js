'use strict';

// v0.17 Unified Command Dashboard — Phase 1.
// Replaces the home screen with a connected summary of existing trusted app data.

function dashboardTodayRange(){
  const start=startOfLocalDay();
  const end=new Date(start);
  end.setDate(end.getDate()+1);
  return {start,end};
}

function dashboardTodayGames(){
  const {start,end}=dashboardTodayRange();
  return sortGames(games.filter(game=>{
    const date=new Date(game.date);
    return date>=start&&date<end;
  }));
}

function dashboardNextKickoffs(){
  return sortGames(games.filter(game=>game.state==='pre'&&new Date(game.date)>=new Date())).slice(0,6);
}

function dashboardFavoriteActivity(){
  return sortGames(games.filter(game=>isFavoriteGame(game)&&game.state!=='post')).slice(0,6);
}

function dashboardAvailabilityConcerns(){
  const activeTeams=new Set(
    games
      .filter(game=>game.state!=='post')
      .flatMap(game=>[game.away.abbr,game.home.abbr])
  );

  return availabilityEntries
    .filter(entry=>
      activeTeams.has(entry.team)&&
      ['Questionable','Doubtful','Unavailable','Unknown'].includes(entry.status)
    )
    .slice(0,8);
}

function dashboardWeatherReadiness(){
  const upcoming=dashboardNextKickoffs();
  const locations=upcoming.filter(game=>[game.city,game.stateCode].filter(Boolean).length);
  const currentLocation=String(settings.weatherLocation||'').trim();
  return {
    upcoming:upcoming.length,
    withLocation:locations.length,
    activeLocation:currentLocation,
    loaded:Boolean(weatherData&&currentLocation)
  };
}

function dashboardPredictionSnapshot(){
  const combined=combinedAnalytics();
  const today=dashboardTodayGames();
  const todayIds=new Set(today.map(game=>game.id));
  const todayRows=predictions
    .filter(prediction=>todayIds.has(prediction.gameId))
    .map(prediction=>({prediction,result:predictionResult(prediction)}));

  const graded=todayRows.filter(row=>['correct','incorrect','push'].includes(row.result.status));
  const decisions=graded.filter(row=>row.result.status!=='push');
  const correct=decisions.filter(row=>row.result.status==='correct').length;
  const score=graded.reduce((sum,row)=>sum+(Number(row.result.score)||0),0);

  return {
    combined,
    todayRows,
    graded,
    decisions,
    correct,
    accuracy:decisions.length?correct/decisions.length*100:0,
    score
  };
}

function dashboardPriorityRows(){
  return typeof prioritizedGames==='function'
    ? prioritizedGames().filter(item=>item.score>0).slice(0,6)
    : [];
}

function dashboardKickoffRow(game){
  return `<div class="intel-row">
    <span class="intel-icon">◷</span>
    <div>
      <strong>${game.away.rank?`#${game.away.rank} `:''}${esc(game.away.shortName)} at ${game.home.rank?`#${game.home.rank} `:''}${esc(game.home.shortName)}</strong>
      <small>${esc(kickoffText(game))}${game.network?` · ${esc(game.network)}`:''}${game.venue?` · ${esc(game.venue)}`:''}</small>
    </div>
    <button class="button" data-dashboard-game="${game.id}">Open</button>
  </div>`;
}

function dashboardPriorityRow(item){
  const game=item.game;
  return `<div class="intel-row">
    <span class="intel-icon">${item.score>=70?'!':game.state==='in'?'●':isFavoriteGame(game)?'★':'◈'}</span>
    <div>
      <strong>${game.away.rank?`#${game.away.rank} `:''}${esc(game.away.shortName)} at ${game.home.rank?`#${game.home.rank} `:''}${esc(game.home.shortName)}</strong>
      <small>Priority ${item.score} · ${esc(item.reasons.join(' · '))}</small>
    </div>
    <button class="button primary" data-dashboard-focus="${game.id}">Focus</button>
  </div>`;
}

function dashboardFavoriteRow(game){
  return `<div class="intel-row">
    <span class="intel-icon">★</span>
    <div>
      <strong>${esc(game.away.shortName)} at ${esc(game.home.shortName)}</strong>
      <small>${esc(game.status)}${game.network?` · ${esc(game.network)}`:''}</small>
    </div>
    <button class="button" data-dashboard-hub="${game.id}">Game Hub</button>
  </div>`;
}

function dashboardAvailabilityRow(entry){
  return `<div class="intel-row">
    <span class="intel-icon">♙</span>
    <div>
      <strong>${esc(entry.player)} · ${esc(entry.team)}</strong>
      <small>${esc(entry.status)}${entry.notes?` · ${esc(entry.notes)}`:''}</small>
    </div>
    <button class="button" data-page-jump="availability">Review</button>
  </div>`;
}

function unifiedCommandDashboardPage(){
  setHeading('Unified Command Dashboard','YOUR COMPLETE GAMEDAY OVERVIEW');

  const today=dashboardTodayGames();
  const live=today.filter(game=>game.state==='in');
  const upcoming=dashboardNextKickoffs();
  const favorites=dashboardFavoriteActivity();
  const concerns=dashboardAvailabilityConcerns();
  const weather=dashboardWeatherReadiness();
  const prediction=dashboardPredictionSnapshot();
  const priorities=dashboardPriorityRows();
  const top=priorities[0]||null;
  const timelineRecent=[...timelineEvents]
    .sort((a,b)=>new Date(b.time)-new Date(a.time))
    .slice(0,6);

  return `<section class="hero personal-hero command-center-hero">
    <div class="hero-copy">
      <p class="eyebrow">UNIFIED COMMAND DASHBOARD</p>
      <h2>${live.length?`${live.length} game${live.length===1?'':'s'} live right now.`:upcoming.length?`Next kickoff: ${esc(upcoming[0].away.shortName)} at ${esc(upcoming[0].home.shortName)}.`:'Your GameDay system is ready.'}</h2>
      <p>Live priorities, favorite teams, predictions, availability, weather readiness, and recent events are connected in one home screen.</p>
      <div class="button-row">
        <button class="button primary" id="dashboardRefresh">${loading?'Refreshing dashboard…':'Refresh dashboard'}</button>
        <button class="button" data-page-jump="briefing">Open Briefing</button>
        <button class="button" data-page-jump="watch">Open Watch Center</button>
        <button class="button" id="customizeDashboard">Customize widgets</button>
      </div>
    </div>
    <img src="assets/onlybeats-icon.png" alt="OnlyBeats logo">
  </section>

  <div class="metric-grid">
    ${metric('Live Games',live.length,`${today.length} on today’s slate`)}
    ${metric('Top Priority',top?top.score:0,top?`${top.game.away.abbr} at ${top.game.home.abbr}`:'No active signal')}
    ${metric('Today’s Accuracy',`${prediction.accuracy.toFixed(1)}%`,`${prediction.correct}/${prediction.decisions.length} correct`)}
    ${metric('Today’s Score',formatNumber(prediction.score),`${prediction.todayRows.length} entries`)}
    ${metric('Availability Concerns',concerns.length,'Active teams')}
    ${metric('Weather Ready',`${weather.withLocation}/${weather.upcoming}`,'Upcoming venues')}
  </div>

  ${syncError?`<div class="provider-notice"><div><strong>Showing cached dashboard data</strong><p class="muted">${esc(syncError)}</p></div><button class="button" id="dashboardRefresh">Try again</button></div>`:''}

  ${top?`<section class="card command-top-signal">
    <div>
      <p class="eyebrow">TOP PRIORITY</p>
      <h3>${top.game.away.rank?`#${top.game.away.rank} `:''}${esc(top.game.away.shortName)} at ${top.game.home.rank?`#${top.game.home.rank} `:''}${esc(top.game.home.shortName)}</h3>
      <p class="muted">${esc(top.reasons.join(' · '))}</p>
    </div>
    <div class="button-row">
      <button class="button primary" data-dashboard-focus="${top.game.id}">Open Focus Mode</button>
      <button class="button" data-dashboard-hub="${top.game.id}">Open Game Hub</button>
    </div>
  </section>`:''}

  <div class="reports-grid">
    ${card('What Matters Now',priorities.length?`<div class="intel-list">${priorities.map(dashboardPriorityRow).join('')}</div>`:empty('No active priorities','Live games, favorites, predictions, and alerts will appear here.'),'wide')}
    ${card('Next Kickoffs',upcoming.length?`<div class="intel-list">${upcoming.map(dashboardKickoffRow).join('')}</div>`:empty('No upcoming games','Refresh when the next slate is available.'))}
    ${card('Favorite Team Activity',favorites.length?`<div class="intel-list">${favorites.map(dashboardFavoriteRow).join('')}</div>`:empty('No favorite games active','Star teams from Game Details or Team Intelligence.'))}
    ${card('Prediction Performance',`<div class="team-stat-grid">
      <div><span>Today’s entries</span><strong>${prediction.todayRows.length}</strong></div>
      <div><span>Today’s accuracy</span><strong>${prediction.accuracy.toFixed(1)}%</strong></div>
      <div><span>Today’s score</span><strong>${formatNumber(prediction.score)}</strong></div>
      <div><span>Season accuracy</span><strong>${prediction.combined.accuracy.toFixed(1)}%</strong></div>
      <div><span>Season score</span><strong>${formatNumber(prediction.combined.earned)}</strong></div>
      <div><span>Pending</span><strong>${prediction.combined.pending}</strong></div>
    </div><button class="button primary" data-page-jump="reports">Open Prediction Intelligence</button>`)}
    ${card('Availability Watch',concerns.length?`<div class="intel-list">${concerns.map(dashboardAvailabilityRow).join('')}</div>`:empty('No active concerns','No manual availability notes need attention for active teams.'))}
    ${card('Weather Readiness',`<div class="detail-list">
      <div><span>Upcoming games</span><strong>${weather.upcoming}</strong></div>
      <div><span>Venue locations available</span><strong>${weather.withLocation}</strong></div>
      <div><span>Current weather location</span><strong>${esc(weather.activeLocation||'Not selected')}</strong></div>
      <div><span>Weather loaded</span><strong>${weather.loaded?'Yes':'No'}</strong></div>
    </div><button class="button" data-page-jump="weather">Open Weather</button>`)}
    ${card('Recent Timeline',timelineRecent.length?`<div class="intel-list">${timelineRecent.map(event=>`
      <div class="intel-row">
        <span class="intel-icon">${typeof timelineIcon==='function'?timelineIcon(event.type):'•'}</span>
        <div><strong>${esc(event.title)}</strong><small>${new Date(event.time).toLocaleString()} · ${esc(event.detail)}</small></div>
      </div>`).join('')}</div>`:empty('No recent events','Timeline activity will appear here automatically.'),'wide')}
    ${card('Quick Navigation',`<div class="command-quick-links">
      <button class="button" data-page-jump="wall">Saturday Wall</button>
      <button class="button" data-page-jump="gamehub">Game Hub</button>
      <button class="button" data-page-jump="timeline">Timeline</button>
      <button class="button" data-page-jump="predictions">Prediction Center</button>
      <button class="button" data-page-jump="rankings">Intelligence</button>
      <button class="button" data-page-jump="schedule">Schedule</button>
      <button class="button" data-page-jump="teams">Team Intelligence</button>
      <button class="button" data-page-jump="developer">Developer Tools</button>
    </div>`,'wide')}
  </div>

  <section id="dashboardBuilder" class="dashboard-builder hidden">
    <div><strong>Legacy dashboard widgets</strong><p class="muted">Your saved widget layout remains available below the unified dashboard.</p></div>
    <div class="widget-controls">${defaultDashboard.map(id=>`<button class="button ${dashboardLayout.includes(id)?'primary':''}" data-toggle-widget="${id}">${dashboardLayout.includes(id)?'✓ ':''}${id[0].toUpperCase()+id.slice(1)}</button>`).join('')}<button class="button" id="resetDashboard">Reset layout</button></div>
  </section>
  <div id="personalDashboard" class="dashboard-grid personal-dashboard command-legacy-widgets">${dashboardLayout.map(dashboardWidget).join('')}</div>`;
}

function bindUnifiedCommandDashboard(){
  if($('dashboardRefresh')){
    $('dashboardRefresh').onclick=async()=>{
      const button=$('dashboardRefresh');
      button.disabled=true;
      button.textContent='Refreshing dashboard…';
      try{
        await syncScores(false);
        captureTimelineSnapshot('score-refresh');
        renderPage();
      }finally{
        const active=$('dashboardRefresh');
        if(active){
          active.disabled=false;
          active.textContent='Refresh dashboard';
        }
      }
    };
  }

  document.querySelectorAll('[data-dashboard-game]').forEach(button=>{
    button.onclick=()=>showGame(button.dataset.dashboardGame);
  });

  document.querySelectorAll('[data-dashboard-focus]').forEach(button=>{
    button.onclick=()=>openFocus(button.dataset.dashboardFocus);
  });

  document.querySelectorAll('[data-dashboard-hub]').forEach(button=>{
    button.onclick=()=>{
      gameHubGameId=button.dataset.dashboardHub;
      navigate('gamehub');
    };
  });
}
