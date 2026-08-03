'use strict';

if (
  typeof VERSION === 'undefined' ||
  typeof loadSettings !== 'function' ||
  typeof $ !== 'function' ||
  typeof navigate !== 'function' ||
  typeof refreshActionFor !== 'function' ||
  typeof teamHubPage !== 'function' ||
  typeof schedulePage !== 'function' ||
  typeof openFocus !== 'function' ||
  typeof watchCenterPage !== 'function' ||
  typeof intelligenceEnginePage !== 'function' ||
  typeof smartBriefingPage !== 'function' ||
  typeof runOnlyBeatsDiagnostics !== 'function' ||
  typeof liveCommandTimelinePage !== 'function' ||
  typeof predictionIntelligencePage !== 'function' ||
  typeof gameIntelligenceHubPage !== 'function' ||
  typeof unifiedCommandDashboardPage !== 'function' ||
  typeof initializeReleaseCandidate !== 'function' ||
  typeof initializeReleaseCandidateTwo !== 'function' ||
  typeof initializeReleaseCandidateThree !== 'function' ||
  typeof initializeReleaseCandidateFour !== 'function' ||
  typeof initializeProductionRelease !== 'function' ||
  typeof seasonArchivePage !== 'function' ||
  typeof analyticsCenterPage !== 'function' ||
  typeof isOnlyBeatsProductionVersion !== 'function' ||
  typeof liveDataHealthPage !== 'function' ||
  typeof performanceCenterPage !== 'function' ||
  typeof liveAlertCenterPage !== 'function' ||
  typeof commandCenterTwoPage !== 'function' ||
  typeof aboutStoragePage !== 'function' ||
  typeof uiQualityPage !== 'function' ||
  typeof smartInsightsPage !== 'function'
) {
  throw new Error('OnlyBeats core modules did not load. Verify index.html script order.');
}

let settings=loadSettings();
let favorites=load(FAVORITES_KEY,[]);
let wallState=load(WALL_KEY,defaultWall);
let dashboardLayout=load(DASHBOARD_KEY,defaultDashboard);
if(!dashboardLayout.includes('predictions'))dashboardLayout.splice(Math.min(3,dashboardLayout.length),0,'predictions');
let quickNotes=localStorage.getItem(NOTES_KEY)||'';
let predictions=load(PREDICTIONS_KEY,[]);
let futures=load(FUTURES_KEY,[]);
let futuresLocked=Boolean(load(FUTURES_LOCK_KEY,{locked:false}).locked);
let predictionFilter='all';
let futureFilter='all';
let predictionView='games';
let scheduleFilter='all';
let scheduleRange='all';
let scheduleQuery='';
let scheduleFavoritesOnly=false;
let scheduleTop25Only=false;
let availabilityEntries=load(AVAILABILITY_KEY,[]);
let pinnedGameIds=load(WATCH_KEY,[]);
let timelineEvents=load(TIMELINE_KEY,[]);
let gameHubGameId='';
let seasonArchives=load(SEASON_ARCHIVE_KEY,[]);
let activeSeasonArchiveId='';
let refreshHistory=load(REFRESH_HISTORY_KEY,[]);
let liveAlerts=load(LIVE_ALERTS_KEY,[]);
let liveAlertPreferences=load(LIVE_ALERT_PREFS_KEY,{favoritesOnly:false,rankedOnly:false,muted:false});
let commandCenterSettings=load(COMMAND_CENTER_KEY,{layout:'balanced',favoriteBar:true,notifications:false});
let editingPredictionId='';
let editingFutureId='';
let predictionDraftGameId='';
let currentPage=settings.startPage||'wall';
let games=load(SCORE_CACHE_KEY,[]);
let loading=false;
let lastSync=null;
let syncError='';
let refreshTimer;
let previousScores=new Map();
let changedGames=new Set();
let activeGameId=null;
let activeTeamAbbr='';
let teamTab='overview';
let teamQuery='';
let teamConferenceFilter='all';
let teamFavoritesOnly=false;
let weatherData=null;
let weatherLoading=false;
let weatherError='';
let notificationHistory=[];
let focusedGameId=null;
let refreshRequestId=0;
let lastRefreshAttempt=null;
let lastRefreshDuration=null;
let runtimeErrors=[];

function saveSettings(showToast=true){localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));const saved=$('lastSaved');if(saved)saved.textContent='Saved just now';if(showToast)toast('Preferences saved');scheduleRefresh()}
function saveFavorites(){localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites));renderPage()}
function saveWall(){localStorage.setItem(WALL_KEY,JSON.stringify(wallState))}
function applyTheme(){const theme=settings.theme==='dark'?'midnight':settings.theme;document.documentElement.dataset.theme=theme;document.body.classList.toggle('compact-mode',Boolean(settings.compact));document.body.classList.toggle('reduce-motion',!settings.animations);document.body.dataset.density=settings.dashboardDensity||'comfortable';if(typeof applyReleasePreferences==='function')applyReleasePreferences();if(typeof applyPerformancePreferences==='function')applyPerformancePreferences()}
function toast(message,tone='default'){const e=$('toast');if(!e)return;e.textContent=message;e.dataset.tone=tone;e.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.add('hidden'),2600)}
function normalize(data){return (data.events||[]).map(e=>{const c=e.competitions?.[0]||{},comps=c.competitors||[],home=comps.find(x=>x.homeAway==='home')||comps[0]||{},away=comps.find(x=>x.homeAway==='away')||comps[1]||{},state=e.status?.type?.state||'pre';return {id:e.id,name:e.name||'',date:e.date,status:e.status?.type?.shortDetail||e.status?.type?.detail||'Scheduled',state,clock:e.status?.displayClock||'',period:e.status?.period||0,network:c.broadcasts?.[0]?.names?.[0]||'',venue:c.venue?.fullName||'',city:c.venue?.address?.city||'',stateCode:c.venue?.address?.state||'',neutral:Boolean(c.neutralSite),home:team(home),away:team(away)}})}
function team(c){return {id:c.team?.id||'',name:c.team?.displayName||'TBD',shortName:c.team?.shortDisplayName||c.team?.displayName||'TBD',abbr:c.team?.abbreviation||'',logo:c.team?.logo||'',color:c.team?.color||'',alternateColor:c.team?.alternateColor||'',score:Number(c.score||0),rank:c.curatedRank?.current&&c.curatedRank.current<99?c.curatedRank.current:null,record:c.records?.[0]?.summary||'',winner:Boolean(c.winner)}}
function updateProviderStatus(ok){const status=$('providerStatus'),dot=$('providerDot');if(status)status.textContent=ok?'Score provider online':'Score provider unavailable';if(dot)dot.className=ok?'status-dot':'status-dot error'}
function captureChanges(nextGames){const nextChanged=new Set();for(const g of nextGames){const before=previousScores.get(g.id);const current=`${g.away.score}-${g.home.score}-${g.state}-${g.period}-${g.clock}`;if(before&&before!==current){nextChanged.add(g.id);if(g.away.score+g.home.score>Number(before.split('-')[0])+Number(before.split('-')[1]))announceScoreChange(g)}previousScores.set(g.id,current)}changedGames=nextChanged;if(changedGames.size)setTimeout(()=>{changedGames.clear();document.querySelectorAll('.score-changed').forEach(e=>e.classList.remove('score-changed'))},4200)}
function announceScoreChange(g){const leader=g.away.score>g.home.score?g.away:g.home.score>g.away.score?g.home:null;const message=leader?`${leader.shortName} leads ${Math.max(g.away.score,g.home.score)}–${Math.min(g.away.score,g.home.score)}`:`${g.away.shortName} and ${g.home.shortName} are tied`;showAlert('SCORE UPDATE',message,g)}
function showAlert(title,message,g){if(!settings.scoreAlerts)return;notificationHistory.unshift({title,message,time:new Date().toISOString(),gameId:g?.id||''});notificationHistory=notificationHistory.slice(0,30);localStorage.setItem('onlybeats.notifications.v1',JSON.stringify(notificationHistory));const host=$('alertStack');if(!host)return;const item=document.createElement('button');item.className='game-alert';item.innerHTML=`<span>⚡</span><div><small>${esc(title)}</small><strong>${esc(message)}</strong></div>`;item.onclick=()=>{showGame(g.id);item.remove()};host.prepend(item);setTimeout(()=>item.remove(),6500)}
async function syncScores(silent=false){if(typeof recordRefreshAttempt==='function')recordRefreshAttempt('scores','started');
  if(loading)return;
  const requestId=++refreshRequestId;
  const started=performance.now();
  lastRefreshAttempt=new Date();
  loading=true;
  syncError='';
  if(!silent&&currentPage==='wall')renderPage();
  try{
    let request;
    if(window.__TAURI__?.core?.invoke){
      request=window.__TAURI__.core.invoke('fetch_scoreboard');
    }else{
      request=fetch('https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?limit=200')
        .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()});
    }
    const data=await withTimeout(request,SCORE_REFRESH_TIMEOUT_MS,'Live score refresh');
    if(requestId!==refreshRequestId)return;
    const next=normalize(data);
    if(!Array.isArray(next))throw new Error('Score provider returned an invalid payload');
    captureChanges(next);
    games=next;
    localStorage.setItem(SCORE_CACHE_KEY,JSON.stringify(games));
    lastSync=new Date();
    if(typeof recordRefreshAttempt==='function')recordRefreshAttempt('scores','success',{duration:performance.now()-started,games:games.length});
    if(typeof captureLiveAlerts==='function')captureLiveAlerts('score-refresh');
    captureTimelineSnapshot('score-refresh');
    updateProviderStatus(true);
  }catch(e){
    if(requestId!==refreshRequestId)return;
    if(typeof recordRefreshAttempt==='function')recordRefreshAttempt('scores','failure',{duration:performance.now()-started,error:String(e?.message||e)});
    syncError=String(e?.message||e);
    updateProviderStatus(false);
    if(!silent)toast('Could not refresh live scores; cached scores remain available','error');
  }finally{
    if(requestId===refreshRequestId){
      loading=false;
      lastRefreshDuration=Math.round(performance.now()-started);
      if(['wall','dashboard','briefing','timeline','watch','gamehub','schedule','rankings','news','favorites','teams','developer','datahealth'].includes(currentPage))renderPage();
      if(activeGameId&&games.some(g=>g.id===activeGameId))showGame(activeGameId,false);
    }
  }
}


function isFavoriteGame(g){return favorites.includes(g.home.abbr)||favorites.includes(g.away.abbr)}
function isTop25(g){return Boolean(g.home.rank||g.away.rank)}
function sortGames(list){return [...list].sort((a,b)=>{const fav=Number(isFavoriteGame(b))-Number(isFavoriteGame(a));if(fav)return fav;const live=Number(b.state==='in')-Number(a.state==='in');if(live)return live;const ranked=Number(isTop25(b))-Number(isTop25(a));if(ranked)return ranked;return new Date(a.date)-new Date(b.date)})}
function filteredWallGames(){const q=(wallState.query||'').toLowerCase().trim();return sortGames(games.filter(g=>{if(wallState.status!=='all'&&g.state!==wallState.status)return false;if(wallState.favoritesOnly&&!isFavoriteGame(g))return false;if(wallState.top25Only&&!isTop25(g))return false;if(q&&!`${g.name} ${g.home.name} ${g.away.name} ${g.home.abbr} ${g.away.abbr}`.toLowerCase().includes(q))return false;return true}))}
function statusLabel(state){return state==='in'?'LIVE':state==='post'?'FINAL':'UPCOMING'}
function kickoffText(g){const d=new Date(g.date);return g.state==='pre'?d.toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}):g.status}
function logo(team){return team.logo?`<img src="${esc(team.logo)}" alt="${esc(team.name)} logo" loading="lazy">`:'<span class="team-fallback">🏈</span>'}
function teamLine(t){return `<div class="wall-team ${t.winner?'winner':''}">${logo(t)}<div class="wall-team-name"><strong>${t.rank?`<small>#${t.rank}</small> `:''}${esc(t.shortName)}</strong><span>${esc(t.record||t.abbr)}</span></div><b>${t.score}</b></div>`}
function gameCard(g){const fav=isFavoriteGame(g),changed=changedGames.has(g.id);return `<button class="wall-game-card state-${g.state} ${fav?'favorite-matchup':''} ${changed?'score-changed':''}" data-game="${g.id}"><div class="wall-card-top"><span class="status-badge state-${g.state}">${statusLabel(g.state)}</span><span>${esc(g.network||kickoffText(g))}</span><span class="favorite-mark">${fav?'★':''}</span></div><div class="wall-matchup">${teamLine(g.away)}${teamLine(g.home)}</div><div class="wall-card-bottom"><span>${esc(kickoffText(g))}</span><span>${esc(g.venue||'Venue TBD')}</span></div><span class="focus-link" data-focus="${g.id}">Focus</span></button>`}
function wallToolbar(){const buttons=[['all','All Games'],['in','Live'],['pre','Upcoming'],['post','Final']];return `<div class="wall-toolbar"><div class="wall-status-tabs">${buttons.map(([id,label])=>`<button class="filter-button ${wallState.status===id?'active':''}" data-status="${id}">${label}<span>${id==='all'?games.length:games.filter(g=>g.state===id).length}</span></button>`).join('')}</div><div class="wall-tools"><button class="filter-button ${wallState.favoritesOnly?'active':''}" id="favoritesFilter">★ Favorites</button><button class="filter-button ${wallState.top25Only?'active':''}" id="top25Filter">Top 25</button><input id="wallSearch" value="${esc(wallState.query)}" placeholder="Search teams…"><button class="button primary" id="refreshScores">${loading?'Refreshing…':'Refresh'}</button></div></div>`}
function dashboardWidget(id){const live=games.filter(g=>g.state==='in'),up=games.filter(g=>g.state==='pre'),featured=sortGames(games).slice(0,4),ranked=allTeams().filter(t=>t.rank).sort((a,b)=>a.rank-b.rank).slice(0,8);const widgets={featured:card('Featured Matchups',loading?empty('Refreshing scores…','Connecting to the live scoreboard.'):syncError?errorBox():featured.length?`<div class="mini-wall">${featured.map(gameCard).join('')}</div>`:empty('No games on the current slate','The provider returned no current games.'),'wide'),favorites:card('Favorite Teams',favorites.length?`<div class="favorite-list">${favorites.map(x=>`<button class="favorite-chip" data-team="${esc(x)}">★ ${esc(x)}</button>`).join('')}</div>`:empty('No favorites yet','Open a game and star a team.')),ranked:card('Ranked Teams',ranked.length?`<div class="ranking-list">${ranked.map(t=>`<button class="ranking-row" data-team="${esc(t.abbr)}"><span>${t.rank}</span>${logo(t)}<div><strong>${esc(t.shortName)}</strong><small>${esc(t.record||t.abbr)}</small></div><b>›</b></button>`).join('')}</div>`:empty('No rankings on this slate','Ranked teams appear when supplied by the scoreboard.')),predictions:card('Prediction Center',predictionDashboardWidget()),weather:card('Weather Shortcut',`<p class="muted">${settings.weatherLocation?`Saved location: ${esc(settings.weatherLocation)}`:'Choose a stadium city in Weather Center.'}</p><button class="button primary" data-page-jump="weather">Open Weather Center</button>`),alerts:card('Latest Alerts',notificationHistory.length?notificationHistory.slice(0,4).map(n=>`<button class="intel-row" data-alert-game="${esc(n.gameId)}"><span class="intel-icon">⚡</span><div><strong>${esc(n.title)}</strong><small>${esc(n.message)}</small></div></button>`).join(''):empty('No alerts yet','Live score changes will appear here.')),notes:card('Quick Notes',`<textarea id="quickNotes" class="quick-notes" placeholder="Write game-day notes…">${esc(quickNotes)}</textarea><small class="muted">Saved automatically on this computer.</small>`)};return `<div class="dashboard-widget" draggable="true" data-widget="${id}"><div class="widget-tools"><button class="widget-move" data-move-widget="${id}" data-direction="up" title="Move widget earlier" aria-label="Move widget earlier">↑</button><span class="widget-grip" title="Drag to reorder">⋮⋮</span><button class="widget-move" data-move-widget="${id}" data-direction="down" title="Move widget later" aria-label="Move widget later">↓</button></div>${widgets[id]||''}</div>`}

function saturdayCommandSnapshot(){
  const live=sortGames(games.filter(g=>g.state==='in'));
  const upcoming=sortGames(games.filter(g=>g.state==='pre'));
  const finals=sortGames(games.filter(g=>g.state==='post'));
  const favoritesLive=live.filter(isFavoriteGame);
  const rankedLive=live.filter(isTop25);
  const rankedUpcoming=upcoming.filter(isTop25);
  const upsetSignals=upsetWatchGames();
  const prediction=combinedAnalytics();
  const today=startOfLocalDay();
  const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  const todayGames=sortGames(games.filter(g=>{
    const date=new Date(g.date);
    return date>=today&&date<tomorrow;
  }));
  const todayPredictionRows=predictions.filter(p=>{
    const game=predictionGame(p);
    if(!game)return false;
    const date=new Date(game.date);
    return date>=today&&date<tomorrow;
  }).map(p=>({...p,result:predictionResult(p)}));
  const todayGraded=todayPredictionRows.filter(p=>['correct','incorrect','push'].includes(p.result.status));
  const todayDecisions=todayGraded.filter(p=>p.result.status!=='push');
  const todayCorrect=todayDecisions.filter(p=>p.result.status==='correct').length;
  const todayScore=todayGraded.reduce((sum,p)=>sum+(Number(p.result.score)||0),0);
  const availabilityConcern=availabilityEntries.filter(x=>['Questionable','Doubtful','Unavailable','Unknown'].includes(x.status));
  return {
    live,upcoming,finals,favoritesLive,rankedLive,rankedUpcoming,upsetSignals,
    todayGames,todayPredictionRows,todayGraded,todayDecisions,todayCorrect,todayScore,
    prediction,availabilityConcern
  };
}
function commandGameList(title,list,emptyTitle,emptyCopy){
  return card(title,list.length?`<div class="intel-list">${list.slice(0,8).map(g=>intelRow(
    g.state==='in'?'●':g.state==='post'?'✓':'◷',
    `${g.away.rank?`#${g.away.rank} `:''}${g.away.shortName} ${g.state==='pre'?'at':g.away.score+' – '+g.home.score} ${g.home.rank?`#${g.home.rank} `:''}${g.home.shortName}`,
    g.state==='pre'?`${new Date(g.date).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}${g.network?` · ${g.network}`:''}`:g.status,
    g
  )).join('')}</div>`:empty(emptyTitle,emptyCopy));
}
function commandQuickLinks(){
  const links=[
    ['wall','▦','Saturday Wall'],
    ['schedule','◷','Schedule'],
    ['teams','◈','Team Intelligence'],
    ['predictions','✓','Prediction Center'],
    ['weather','☁','Weather'],
    ['availability','♙','Availability'],
    ['news','▤','Game Signals'],
    ['reports','▥','Reports']
  ];
  return `<div class="command-quick-links">${links.map(([page,icon,label])=>`<button class="button" data-page-jump="${page}"><span>${icon}</span>${label}</button>`).join('')}</div>`;
}
function commandProviderSummary(){
  return `<div class="detail-list">
    <div><span>Scores</span><strong>${syncError?'Cached / Offline':lastSync?'Connected':'Ready'}</strong></div>
    <div><span>Last score sync</span><strong>${lastSync?lastSync.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Not yet'}</strong></div>
    <div><span>Weather</span><strong>${weatherData?'Loaded':settings.weatherLocation?'Location saved':'Not loaded'}</strong></div>
    <div><span>Availability</span><strong>${availabilityEntries.length} local notes</strong></div>
    <div><span>Prediction data</span><strong>${predictions.length+futures.length} entries</strong></div>
  </div>`;
}

function dashboard(){
  setHeading('Saturday Command Center','LIVE MISSION CONTROL');
  const s=saturdayCommandSnapshot();
  const topSignal=s.upsetSignals[0]||s.favoritesLive[0]||s.rankedLive[0]||s.rankedUpcoming[0]||s.upcoming[0]||null;
  const todayAccuracy=s.todayDecisions.length?s.todayCorrect/s.todayDecisions.length*100:0;
  const favoriteUpcoming=s.upcoming.filter(isFavoriteGame);
  return `<section class="hero personal-hero command-center-hero">
    <div class="hero-copy">
      <p class="eyebrow">ONLYBEATS SATURDAY COMMAND CENTER</p>
      <h2>${s.live.length?`${s.live.length} games live right now.`:'Your GameDay cockpit is ready.'}</h2>
      <p>${s.live.length?'Track live scores, favorite teams, ranked games, prediction results, and game signals from one screen.':'The dashboard will automatically fill with live games, rankings, alerts, weather, and prediction results as the slate begins.'}</p>
      <div class="button-row">
        <button class="button primary" data-open-wall>Open Saturday Wall</button>
        <button class="button" id="refreshScores">${loading?'Refreshing…':'Refresh command center'}</button>
        <button class="button" id="customizeDashboard">Customize widgets</button>
      </div>
    </div>
    <img src="assets/onlybeats-icon.png" alt="OnlyBeats logo">
  </section>

  <div class="metric-grid command-metrics">
    ${metric('Live Games',s.live.length,`${s.favoritesLive.length} favorite · ${s.rankedLive.length} ranked`)}
    ${metric('Today’s Games',s.todayGames.length,`${s.rankedUpcoming.length+s.rankedLive.length} ranked on slate`)}
    ${metric('Prediction Score',formatNumber(s.todayScore),`${todayAccuracy.toFixed(1)}% today`)}
    ${metric('Upset Signals',s.upsetSignals.length,'Live or final')}
    ${metric('Availability Notes',s.availabilityConcern.length,'Need attention')}
    ${metric('Season Accuracy',`${s.prediction.accuracy.toFixed(1)}%`,`${s.prediction.correct}/${s.prediction.decisions} correct`)}
  </div>

  ${syncError?`<div class="provider-notice"><div><strong>Live provider unavailable</strong><p class="muted">The Command Center is showing cached data. ${esc(syncError)}</p></div><button class="button" id="refreshScores">Try again</button></div>`:''}

  ${topSignal?`<section class="card command-top-signal">
    <div>
      <p class="eyebrow">${topSignal.state==='in'?'TOP LIVE SIGNAL':topSignal.state==='post'?'LATEST FINAL':'NEXT FEATURED GAME'}</p>
      <h3>${topSignal.away.rank?`#${topSignal.away.rank} `:''}${esc(topSignal.away.shortName)} at ${topSignal.home.rank?`#${topSignal.home.rank} `:''}${esc(topSignal.home.shortName)}</h3>
      <p class="muted">${esc(topSignal.status)}${topSignal.network?` · ${esc(topSignal.network)}`:''}${topSignal.venue?` · ${esc(topSignal.venue)}`:''}</p>
    </div>
    <button class="button primary" data-game="${topSignal.id}">Open game</button>
  </section>`:''}

  <div class="command-center-grid">
    ${commandGameList('Live Now',s.live,'No games live','Live games will appear here automatically.')}
    ${commandGameList('Favorite Teams',s.favoritesLive.length?s.favoritesLive:favoriteUpcoming,'No favorite games','Star teams from any game or Team Intelligence page.')}
    ${commandGameList('Ranked Matchups',[...s.rankedLive,...s.rankedUpcoming],'No ranked games','Top 25 matchups from the loaded slate will appear here.')}
    ${card('Prediction Scorecard',`<div class="team-stat-grid">
      <div><span>Today’s entries</span><strong>${s.todayPredictionRows.length}</strong></div>
      <div><span>Correct</span><strong>${s.todayCorrect}</strong></div>
      <div><span>Accuracy</span><strong>${todayAccuracy.toFixed(1)}%</strong></div>
      <div><span>Score</span><strong>${formatNumber(s.todayScore)}</strong></div>
      <div><span>Season score</span><strong>${formatNumber(s.prediction.earned)}</strong></div>
      <div><span>Pending</span><strong>${s.prediction.pending}</strong></div>
    </div><button class="button primary" data-page-jump="predictions">Open Prediction Center</button>`)}
    ${card('GameDay Readiness',commandProviderSummary())}
    ${card('Quick Navigation',commandQuickLinks(),'wide')}
    ${card('Quick Notes',`<textarea id="quickNotes" class="quick-notes" placeholder="Write game-day notes…">${esc(quickNotes)}</textarea><small class="muted">Saved automatically on this computer.</small>`,'wide')}
  </div>

  <section id="dashboardBuilder" class="dashboard-builder hidden">
    <div><strong>Legacy dashboard widgets</strong><p class="muted">Your personalized widget layout remains available below the Command Center.</p></div>
    <div class="widget-controls">${defaultDashboard.map(id=>`<button class="button ${dashboardLayout.includes(id)?'primary':''}" data-toggle-widget="${id}">${dashboardLayout.includes(id)?'✓ ':''}${id[0].toUpperCase()+id.slice(1)}</button>`).join('')}<button class="button" id="resetDashboard">Reset layout</button></div>
  </section>
  <div id="personalDashboard" class="dashboard-grid personal-dashboard command-legacy-widgets">${dashboardLayout.map(dashboardWidget).join('')}</div>`;
}
function wallPage(){setHeading('Saturday Wall','GAME-DAY MISSION CONTROL');const list=filteredWallGames();return `<section class="wall-summary"><div><p class="eyebrow">LIVE BOARD</p><h2>${games.filter(g=>g.state==='in').length} live · ${games.filter(g=>g.state==='pre').length} upcoming · ${games.filter(g=>g.state==='post').length} final</h2></div><div class="sync-chip ${syncError?'error':''}"><i class="status-dot ${syncError?'error':''}"></i>${syncError?'Provider unavailable':lastSync?`Updated ${lastSync.toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'})}`:'Waiting for first sync'}</div></section>${wallToolbar()}${syncError?errorBox():''}<div class="wall-grid">${loading&&!games.length?empty('Loading Saturday Wall…','The first scoreboard request can take a few seconds.'):list.map(gameCard).join('')||empty('No games match these filters','Clear one or more filters or search for another team.')}</div>`}
function favoritesPage(){setHeading('Favorites','YOUR TEAMS');const related=sortGames(games.filter(isFavoriteGame));return `<div class="card"><h3>Favorite teams</h3><p class="muted">Favorites are stored locally and automatically pinned on Saturday Wall.</p><div class="favorite-list">${favorites.map(x=>`<button class="favorite-chip removable" data-remove="${esc(x)}">★ ${esc(x)} ×</button>`).join('')||'<span class="muted">No teams saved yet.</span>'}</div></div><div class="wall-grid favorites-wall">${related.map(gameCard).join('')||empty('No favorite-team games on this slate','Add favorites from any game details drawer.')}</div>`}
function errorBox(){return `<div class="error-box"><strong>Live scores unavailable</strong><p>${esc(syncError)}</p><button class="button" onclick="syncScores()">Try again</button></div>`}
function healthPanel(){return `<div class="health-list"><div><span><i id="providerDot" class="status-dot ${syncError?'error':''}"></i><span id="providerStatus">${syncError?'Score provider unavailable':'Score provider online'}</span></span><strong>${lastSync?'Synced':'Ready'}</strong></div><div><span><i class="status-dot"></i>Local settings</span><strong>Ready</strong></div><div><span><i class="status-dot"></i>SQLite schema</span><strong>1</strong></div><div><span><i class="status-dot"></i>Build</span><strong>${VERSION}</strong></div></div>`}
function developerPage(){
  setHeading('Developer Tools','DIAGNOSTICS · HEALTH · LOGS');
  const report=getOnlyBeatsDiagnostics();
  const checks=report.checks||[];
  const healthy=checks.filter(check=>check.ok).length;
  const failed=checks.length-healthy;
  const recent=getOnlyBeatsRuntimeLog().slice(-20).reverse();

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">DEVELOPER TOOLING</p>
      <h2>${failed?`${failed} runtime check${failed===1?'':'s'} need attention.`:'All runtime checks passed.'}</h2>
      <p>Validate critical pages, required functions, refresh state, storage, and recent errors before shipping another build.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="runRuntimeDiagnostics">Run diagnostics</button>
      <button class="button" id="runPageSmokeTests">Run page smoke tests</button>
      <button class="button" id="exportDiagnostics">Export diagnostics</button>
      <button class="button" id="clearRuntimeLog">Clear log</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Checks Passed',healthy,`${checks.length} total`)}
    ${metric('Checks Failed',failed,failed?'Review below':'Healthy')}
    ${metric('Runtime Errors',getOnlyBeatsRuntimeLog().filter(entry=>entry.level==='error').length,'Current session')}
    ${metric('Current Page',currentPage,'Active route')}
    ${metric('Loaded Games',games.length,'Live or cached')}
    ${metric('Version',VERSION,'Desktop build')}
  </div>

  <div class="reports-grid">
    ${card('Runtime Health',`<div class="intel-list">${checks.map(check=>`<div class="intel-row">
      <span class="intel-icon">${check.ok?'✓':'×'}</span>
      <div><strong>${esc(check.name)}</strong><small>${esc(check.detail||'')}</small></div>
      <b>${check.ok?'PASS':'FAIL'}</b>
    </div>`).join('')||empty('No diagnostics run','Click Run diagnostics to evaluate the application.')}</div>`,'wide')}

    ${card('Recent Runtime Log',recent.length?`<div class="intel-list">${recent.map(entry=>`<div class="intel-row">
      <span class="intel-icon">${entry.level==='error'?'!':entry.level==='warn'?'△':'•'}</span>
      <div><strong>${esc(entry.message)}</strong><small>${new Date(entry.time).toLocaleTimeString()} · ${esc(entry.context||'app')}</small></div>
      <b>${esc(entry.level.toUpperCase())}</b>
    </div>`).join('')}</div>`:empty('No runtime events','Errors, warnings, and diagnostic runs will appear here.'),'wide')}

    ${card('Provider State',`<div class="detail-list">
      <div><span>Scores</span><strong>${syncError?'Cached / Error':lastSync?'Connected':'Ready'}</strong></div>
      <div><span>Last sync</span><strong>${lastSync?lastSync.toLocaleTimeString():'Not yet'}</strong></div>
      <div><span>Refresh active</span><strong>${loading?'Yes':'No'}</strong></div>
      <div><span>Weather</span><strong>${weatherData?'Loaded':'Not loaded'}</strong></div>
      <div><span>Predictions</span><strong>${predictions.length}</strong></div>
      <div><span>Futures</span><strong>${futures.length}</strong></div>
    </div>`)}

    ${card('Release Checklist',`<div class="coverage-list">
      <span><i class="status-dot"></i> App launches</span>
      <span><i class="status-dot"></i> Navigation module loaded</span>
      <span><i class="status-dot"></i> Refresh module loaded</span>
      <span><i class="status-dot"></i> Prediction helper present</span>
      <span><i class="status-dot"></i> Schedule and Team modules loaded</span>
      <span><i class="status-dot"></i> Intelligence and Briefing loaded</span>
    </div>`)}

    ${card('Build Information',`<div class="detail-list">
      <div><span>Version</span><strong>${esc(VERSION)}</strong></div>
      <div><span>Schema</span><strong>1</strong></div>
      <div><span>User agent</span><strong>${esc(navigator.userAgent)}</strong></div>
      <div><span>Online</span><strong>${navigator.onLine?'Yes':'No'}</strong></div>
      <div><span>Storage available</span><strong>${report.storageAvailable?'Yes':'No'}</strong></div>
    </div>`,'wide')}
  </div>`;
}

function rankedTeams(){return allTeams().filter(t=>t.rank).sort((a,b)=>a.rank-b.rank)}
function upsetWatchGames(){return sortGames(games.filter(g=>{if(g.state==='pre')return false;const ranked=g.away.rank?g.away:g.home.rank?g.home:null,other=ranked===g.away?g.home:g.away;if(!ranked)return false;return other.score>ranked.score||Boolean(other.winner)}))}
function favoriteIntel(){return sortGames(games.filter(isFavoriteGame)).map(g=>{const names=[g.away,g.home].filter(t=>favorites.includes(t.abbr)).map(t=>t.shortName).join(' & ');return {game:g,title:names||`${g.away.shortName} at ${g.home.shortName}`,copy:g.state==='in'?`${g.status} · ${g.away.score}-${g.home.score}`:g.state==='post'?`Final · ${g.away.score}-${g.home.score}`:`Kickoff ${new Date(g.date).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'})}`}})}
function intelRow(icon,title,copy,g){return `<button class="intel-row" ${g?`data-game="${g.id}"`:''}><span class="intel-icon">${icon}</span><div><strong>${esc(title)}</strong><small>${esc(copy)}</small></div><b>›</b></button>`}
function rankingsPage(){setHeading('Intelligence Center','RANKINGS · ALERTS · GAME SIGNALS');const ranked=rankedTeams(),upsets=upsetWatchGames(),fav=favoriteIntel(),rankedGames=sortGames(games.filter(isTop25));return `<section class="intel-hero"><div><p class="eyebrow">CURRENT-SLATE INTELLIGENCE</p><h2>Know what matters before the next snap.</h2><p>Rankings shown here come directly from teams present on the loaded scoreboard. Full national polls and conference tables remain provider-ready until a licensed or reliable source is connected.</p></div><button class="button primary" id="refreshIntelligence" ${loading?'disabled aria-busy="true"':''}>${loading?'Refreshing intelligence…':'Refresh intelligence'}</button></section><div class="metric-grid">${metric('Ranked Teams',ranked.length,'On current slate')}${metric('Ranked Games',rankedGames.length,'Current scoreboard')}${metric('Upset Watch',upsets.length,'Live or final')}${metric('Favorite Alerts',fav.length,'Current slate')}</div>${syncError?errorBox():''}<div class="intelligence-grid">${card('Current-Slate Rankings',ranked.length?`<div class="ranking-list">${ranked.map(t=>`<button class="ranking-row" data-team="${esc(t.abbr)}"><span>${t.rank}</span>${logo(t)}<div><strong>${esc(t.shortName)}</strong><small>${esc(t.record||t.abbr)}</small></div><b>›</b></button>`).join('')}</div>`:empty('No ranked teams loaded','Refresh during an active college-football slate.'),'tall')}${card('Upset Watch',upsets.length?`<div class="intel-list">${upsets.map(g=>intelRow('⚠',`${g.away.shortName} ${g.away.score} · ${g.home.shortName} ${g.home.score}`,g.status,g)).join('')}</div>`:empty('No upset signals right now','Ranked teams are not currently trailing or losing.'),'tall')}${card('Favorite-Team Alerts',fav.length?`<div class="intel-list">${fav.map(x=>intelRow('★',x.title,x.copy,x.game)).join('')}</div>`:empty('No favorite alerts','Star teams from Saturday Wall or Team Hub.'),'tall')}${card('Ranked Matchups',rankedGames.length?`<div class="mini-wall">${rankedGames.slice(0,6).map(gameCard).join('')}</div>`:empty('No ranked matchups','The current scoreboard has no Top 25 teams.'),'wide')}${card('Provider Coverage',`<div class="provider-grid"><div><span class="status-dot"></span><strong>Live scores</strong><small>Connected</small></div><div><span class="status-dot"></span><strong>Scoreboard rankings</strong><small>Connected</small></div><div><span class="status-dot pending"></span><strong>Full polls</strong><small>Provider-ready</small></div><div><span class="status-dot pending"></span><strong>Conference standings</strong><small>Provider-ready</small></div><div><span class="status-dot pending"></span><strong>Editorial news</strong><small>Provider-ready</small></div><div><span class="status-dot pending"></span><strong>Player availability</strong><small>Licensed feed required</small></div></div>`,'wide')}</div>`}
function newsPage(){setHeading('Game Signals','LIVE INTELLIGENCE FEED');const live=sortGames(games.filter(g=>g.state==='in')),finals=sortGames(games.filter(g=>g.state==='post')).slice(0,10),upcoming=sortGames(games.filter(g=>g.state==='pre')).slice(0,10);return `<section class="intel-hero"><div><p class="eyebrow">SIGNAL FEED</p><h2>A factual feed built from the live scoreboard.</h2><p>This release does not fabricate headlines. It surfaces live state changes, finals, ranked matchups, and favorite-team activity while the editorial-news provider remains unconnected.</p></div><button class="button primary" id="refreshNewsFeed" ${loading?'disabled aria-busy="true"':''}>${loading?'Refreshing feed…':'Refresh feed'}</button></section><div class="signal-columns">${card('Live Now',live.length?`<div class="intel-list">${live.map(g=>intelRow('●',`${g.away.shortName} ${g.away.score} – ${g.home.score} ${g.home.shortName}`,g.status,g)).join('')}</div>`:empty('No live games','Live games will appear automatically.'))}${card('Recent Finals',finals.length?`<div class="intel-list">${finals.map(g=>intelRow('✓',`${g.away.shortName} ${g.away.score} – ${g.home.score} ${g.home.shortName}`,g.status,g)).join('')}</div>`:empty('No finals loaded','Completed games will appear here.'))}${card('Next Kickoffs',upcoming.length?`<div class="intel-list">${upcoming.map(g=>intelRow('◷',`${g.away.shortName} at ${g.home.shortName}`,new Date(g.date).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'})+(g.network?` · ${g.network}`:''),g)).join('')}</div>`:empty('No upcoming games','Upcoming games will appear here.'))}</div><div class="card provider-notice"><div><p class="eyebrow">EDITORIAL NEWS</p><h3>News provider not connected yet</h3><p class="muted">The interface is ready for a licensed or approved news source. Until then, OnlyBeats shows verified scoreboard-derived signals instead of invented stories.</p></div><span class="provider-badge">PROVIDER-READY</span></div>`}

function weatherCodeLabel(code){const map={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Freezing fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Showers',82:'Heavy showers',95:'Thunderstorms',96:'Storms with hail',99:'Severe storms'};return map[Number(code)]||'Conditions unavailable'}
function weatherIcon(code){code=Number(code);if(code===0)return '☀';if([1,2].includes(code))return '⛅';if([3,45,48].includes(code))return '☁';if([71,73,75].includes(code))return '❄';if(code>=95)return '⛈';return '🌧'}
async function fetchWeather(location){if(weatherLoading)return;weatherLoading=true;weatherError='';renderPage();try{if(!location)throw new Error('Enter a stadium city or location');let data;if(window.__TAURI__?.core?.invoke)data=await window.__TAURI__.core.invoke('fetch_weather',{input:{location}});else{const geo=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`).then(r=>r.json());const hit=geo.results?.[0];if(!hit)throw new Error('No weather location match found');data=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&forecast_days=7&timezone=auto`).then(r=>r.json());data.resolved_location={name:hit.name,admin1:hit.admin1,country:hit.country}}weatherData=data;settings.weatherLocation=location;saveSettings(false);toast('Weather updated')}catch(e){weatherError=String(e?.message||e);toast('Weather unavailable','error')}finally{weatherLoading=false;renderPage()}}
function weatherPage(){setHeading('Weather Center','GAMEDAY CONDITIONS');const c=weatherData?.current,loc=weatherData?.resolved_location;const place=loc?[loc.name,loc.admin1].filter(Boolean).join(', '):settings.weatherLocation||'No location selected';const now=c?`<div class="weather-current"><span>${weatherIcon(c.weather_code)}</span><div><strong>${Math.round(c.temperature_2m)}°F</strong><p>${weatherCodeLabel(c.weather_code)}</p></div></div><div class="weather-metrics">${metric('Feels Like',`${Math.round(c.apparent_temperature)}°F`,'Current')}${metric('Wind',`${Math.round(c.wind_speed_10m)} mph`,'Sustained')}${metric('Gusts',`${Math.round(c.wind_gusts_10m)} mph`,'Current')}${metric('Precipitation',`${c.precipitation||0} in`,'Current hour')}</div>`:empty('Choose a stadium location','Enter a city and state to load current conditions and a seven-day hourly forecast.');return `<section class="intel-hero"><div><p class="eyebrow">OPEN-METEO WEATHER</p><h2>GameDay Weather Center</h2><p>Current conditions and stadium-area forecasts without invented data.</p></div><div class="weather-search"><input id="weatherLocation" value="${esc(settings.weatherLocation||'')}" placeholder="Stadium city, state"><button class="button primary" id="loadWeather">${weatherLoading?'Loading…':'Load weather'}</button></div></section>${weatherError?`<div class="error-banner">${esc(weatherError)}</div>`:''}<section class="card weather-card"><div class="card-head"><h3>${esc(place)}</h3><span class="provider-badge">LIVE PROVIDER</span></div>${now}</section>`}
function notificationsPage(){const items=notificationHistory.length?notificationHistory.map(n=>`<button class="intel-row" data-alert-game="${esc(n.gameId)}"><span class="intel-icon">⚡</span><div><strong>${esc(n.title)}</strong><small>${esc(n.message)} · ${new Date(n.time).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</small></div></button>`).join(''):empty('No GameDay alerts yet','Score changes and favorite-team activity will appear here while the app is open.');return `<div class="notification-history">${items}</div>`}


function saveDashboard(){localStorage.setItem(DASHBOARD_KEY,JSON.stringify(dashboardLayout));toast('Dashboard layout saved')}
function moveWidget(id,direction){const i=dashboardLayout.indexOf(id),j=i+direction;if(i<0||j<0||j>=dashboardLayout.length)return;[dashboardLayout[i],dashboardLayout[j]]=[dashboardLayout[j],dashboardLayout[i]];saveDashboard();renderPage()}
function bindPersonalization(){
  
  document.querySelectorAll('[data-toggle-widget]').forEach(b=>b.onclick=()=>{const id=b.dataset.toggleWidget;dashboardLayout=dashboardLayout.includes(id)?dashboardLayout.filter(x=>x!==id):[...dashboardLayout,id];saveDashboard();renderPage()});
  if($('resetDashboard'))$('resetDashboard').onclick=()=>{dashboardLayout=[...defaultDashboard];saveDashboard();renderPage()};
  if($('quickNotes'))$('quickNotes').oninput=e=>{quickNotes=e.target.value;localStorage.setItem(NOTES_KEY,quickNotes);const saved=$('lastSaved');if(saved)saved.textContent='Notes saved just now'};
  document.querySelectorAll('[data-page-jump]').forEach(b=>b.onclick=()=>navigate(b.dataset.pageJump));
  const moveWidget=(id,direction)=>{const from=dashboardLayout.indexOf(id);if(from<0)return;const to=direction==='up'?from-1:from+1;if(to<0||to>=dashboardLayout.length)return;[dashboardLayout[from],dashboardLayout[to]]=[dashboardLayout[to],dashboardLayout[from]];saveDashboard();renderPage();toast('Dashboard order saved')};
  document.querySelectorAll('[data-move-widget]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();moveWidget(b.dataset.moveWidget,b.dataset.direction)});
  const host=$('personalDashboard');if(host){let dragged='';host.querySelectorAll('[data-widget]').forEach(w=>{w.ondragstart=e=>{dragged=w.dataset.widget;w.classList.add('dragging');if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragged)}};w.ondragend=()=>{dragged='';w.classList.remove('dragging');host.querySelectorAll('[data-widget]').forEach(x=>x.classList.remove('drag-over'))};w.ondragenter=e=>{e.preventDefault();if(dragged&&dragged!==w.dataset.widget)w.classList.add('drag-over')};w.ondragleave=()=>w.classList.remove('drag-over');w.ondragover=e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move'};w.ondrop=e=>{e.preventDefault();w.classList.remove('drag-over');const source=dragged||(e.dataTransfer?e.dataTransfer.getData('text/plain'):'');const target=w.dataset.widget;if(!source||source===target)return;const from=dashboardLayout.indexOf(source),to=dashboardLayout.indexOf(target);if(from<0||to<0)return;dashboardLayout.splice(from,1);dashboardLayout.splice(to,0,source);saveDashboard();renderPage();toast('Dashboard order saved')}})}
}


function saveAvailability(){localStorage.setItem(AVAILABILITY_KEY,JSON.stringify(availabilityEntries))}
function availabilityPage(){
  setHeading('Player Availability','MANUAL NOTES · PROVIDER-READY');
  const entries=[...availabilityEntries].sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
  const teams=allTeams();
  return `<section class="intel-hero"><div><p class="eyebrow">PLAYER AVAILABILITY</p><h2>Track the availability notes you care about.</h2><p>No licensed player-availability feed is connected. Manual entries remain local to this computer and are never presented as verified medical reporting.</p></div><span class="provider-badge">MANUAL MODE</span></section>
  <div class="settings-layout">${card('Add Availability Note',`<form id="availabilityForm" class="prediction-form"><label>Team<select id="availabilityTeam" required><option value="">Choose team</option>${teams.map(t=>`<option value="${esc(t.abbr)}">${esc(t.name)}</option>`).join('')}</select></label><label>Player<input id="availabilityPlayer" placeholder="Player name" required></label><label>Status<select id="availabilityStatus"><option>Available</option><option>Questionable</option><option>Doubtful</option><option>Unavailable</option><option>Unknown</option></select></label><label class="wide-field">Notes<textarea id="availabilityNotes" placeholder="Source, context, or reminder"></textarea></label><button class="button primary" type="submit">Save note</button></form>`)}${card('Provider Status',`<div class="coverage-list"><span><i class="status-dot pending"></i>Licensed feed not connected</span><span><i class="status-dot"></i>Manual local notes available</span><span><i class="status-dot"></i>Team list from current scoreboard cache</span></div>`)}</div>
  ${card('Saved Availability Notes',entries.length?`<div class="intel-list">${entries.map(x=>`<div class="intel-row availability-entry"><span class="intel-icon">♙</span><div><strong>${esc(x.player)} · ${esc(x.team)}</strong><small>${esc(x.status)}${x.notes?` · ${esc(x.notes)}`:''}</small></div><button class="button" data-delete-availability="${esc(x.id)}">Delete</button></div>`).join('')}</div>`:empty('No availability notes yet','Add a manual entry above.'))}`;
}
function placeholderPage(id,label){setHeading(label,'COMING IN A PLANNED RELEASE');return `<div class="hero"><div class="hero-copy"><p class="eyebrow">ROADMAP MODULE</p><h2>${label}</h2><p>This route is prepared and will receive its full module in a future release.</p></div><img src="assets/onlybeats-icon.png"></div>`}
function toggle(id,label,on){return `<div class="toggle-row"><div><strong>${label}</strong></div><button id="${id}" class="toggle ${on?'on':''}"></button></div>`}
function settingsPage(){
  setHeading('Settings','PRODUCTION RELEASE · PERSONAL COMMAND CENTER');
  return `<div class="settings-layout">
    <section class="card settings-card">
      <h3>Appearance & accessibility</h3>
      <div class="field"><label>Theme</label><select id="themeSelect"><option value="midnight">Midnight Gold</option><option value="stadium">Stadium Green</option><option value="ice">Ice Blue</option><option value="classic">Classic Charcoal</option><option value="light">Light</option></select></div>
      <div class="field"><label>Dashboard density</label><select id="densitySelect"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div>
      ${toggle('compactToggle','Compact game cards',settings.compact)}
      ${toggle('animationToggle','Interface animations',settings.animations)}
      ${toggle('highContrastToggle','High-contrast interface',settings.highContrast)}
      ${toggle('largeTextToggle','Larger interface text',settings.largeText)}
      ${toggle('performanceModeToggle','Performance mode',settings.performanceMode)}
    </section>
    <section class="card settings-card"><h3>GameDay alerts</h3>${toggle('scoreAlertsToggle','Score-change alerts',settings.scoreAlerts)}${toggle('favoriteAlertsToggle','Favorite-team alerts',settings.favoriteAlerts)}${toggle('kickoffAlertsToggle','Kickoff reminders',settings.kickoffAlerts)}</section>
    <section class="card settings-card"><h3>Live scores</h3><div class="field"><label>Automatic refresh</label><select id="refreshSelect"><option value="15">15 seconds</option><option value="30">30 seconds</option><option value="60">60 seconds</option><option value="0">Off</option></select></div><button class="button primary" id="testProvider">Test live-score provider</button></section>
    <section class="card settings-card"><h3>Startup</h3><div class="field"><label>Start page</label><select id="startPageSelect">${pages.map(([id,,label])=>`<option value="${id}">${label}</option>`).join('')}</select></div><p class="muted">Your selected page opens automatically next time.</p></section>
    <section class="card settings-card"><h3>Keyboard shortcuts</h3><p class="muted">Navigate major pages without leaving the keyboard.</p><button class="button" id="openShortcutGuide">View shortcut guide</button></section>
    <section class="card settings-card"><h3>Dashboard</h3><p class="muted">Restore the standard seven-widget Personal Command Center layout.</p><button class="button" id="settingsResetDashboard">Reset dashboard layout</button></section>
    <section class="card settings-card"><h3>Prediction scoring</h3><div class="field"><label>Push score</label><select id="pushScoringSelect"><option value="full">Full confidence</option><option value="half">Half confidence</option><option value="zero">Zero</option></select></div><p class="muted">Correct predictions always earn the exact confidence entered.</p></section>
    ${releaseReadinessSettingsCard()}
    <section class="card settings-card"><h3>Data & recovery</h3><div class="button-row"><button id="exportButton" class="button primary">Export settings</button><button id="resetButton" class="button danger">Reset all local data</button></div><p class="muted">OnlyBeats ${VERSION} · Database schema 1</p></section>
  </div>`;
}

function savePredictions(){localStorage.setItem(PREDICTIONS_KEY,JSON.stringify(predictions))}
function saveFutures(){localStorage.setItem(FUTURES_KEY,JSON.stringify(futures));localStorage.setItem(FUTURES_LOCK_KEY,JSON.stringify({locked:futuresLocked}))}
function predictionGame(p){return games.find(g=>g.id===p.gameId)||null}
function predictionResult(p,g=predictionGame(p)){
  if(!g||g.state!=='post')return {status:'pending',score:null,label:'Pending'};
  const confidence=Number(p.confidence)||0;
  let correct=false,push=false;
  if(p.type==='winner'){
    const selected=p.pick;
    const selectedScore=g.home.abbr===selected?g.home.score:g.away.abbr===selected?g.away.score:null;
    const otherScore=g.home.abbr===selected?g.away.score:g.away.abbr===selected?g.home.score:null;
    if(selectedScore===null)return {status:'invalid',score:0,label:'Team unavailable'};
    push=selectedScore===otherScore;correct=selectedScore>otherScore;
  }else if(p.type==='spread'){
    const selected=p.pick,line=Number(p.line);
    const selectedScore=g.home.abbr===selected?g.home.score:g.away.abbr===selected?g.away.score:null;
    const otherScore=g.home.abbr===selected?g.away.score:g.away.abbr===selected?g.home.score:null;
    if(selectedScore===null||!Number.isFinite(line))return {status:'invalid',score:0,label:'Line unavailable'};
    const adjusted=selectedScore+line;push=adjusted===otherScore;correct=adjusted>otherScore;
  }else if(p.type==='total'){
    const line=Number(p.line),total=g.home.score+g.away.score;
    if(!Number.isFinite(line))return {status:'invalid',score:0,label:'Total unavailable'};
    push=total===line;correct=p.pick==='over'?total>line:total<line;
  }
  if(push){const mode=settings.pushScoring||'full';const score=mode==='zero'?0:mode==='half'?confidence/2:confidence;return {status:'push',score,label:'Push'}}
  return correct?{status:'correct',score:confidence,label:'Correct'}:{status:'incorrect',score:0,label:'Incorrect'};
}
function futureResult(f){const confidence=Number(f.confidence)||0;if(f.status==='correct')return {status:'correct',score:confidence,label:'Correct'};if(f.status==='incorrect')return {status:'incorrect',score:0,label:'Incorrect'};if(f.status==='void')return {status:'void',score:0,label:'Void'};return {status:'pending',score:null,label:'Pending'}}
function predictionAnalytics(){
  const rows=predictions.map(p=>({...p,result:predictionResult(p)}));
  const graded=rows.filter(x=>['correct','incorrect','push'].includes(x.result.status));
  const decisions=graded.filter(x=>x.result.status!=='push');
  const correct=decisions.filter(x=>x.result.status==='correct');
  const earned=graded.reduce((n,x)=>n+(Number(x.result.score)||0),0);
  const entered=graded.reduce((n,x)=>n+(Number(x.confidence)||0),0);
  const avg=predictions.length?predictions.reduce((n,x)=>n+(Number(x.confidence)||0),0)/predictions.length:0;
  let current=0,longest=0;
  for(const x of [...graded].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))){if(x.result.status==='correct'){current++;longest=Math.max(longest,current)}else if(x.result.status==='incorrect')current=0}
  const highWin=[...correct].sort((a,b)=>Number(b.confidence)-Number(a.confidence))[0];
  const highMiss=decisions.filter(x=>x.result.status==='incorrect').sort((a,b)=>Number(b.confidence)-Number(a.confidence))[0];
  return {rows,graded,decisions,correct,earned,entered,avg,current,longest,highWin,highMiss,accuracy:decisions.length?correct.length/decisions.length*100:0,efficiency:entered?earned/entered*100:0,pending:rows.filter(x=>x.result.status==='pending').length};
}
function futuresAnalytics(){const rows=futures.map(f=>({...f,result:futureResult(f)}));const graded=rows.filter(x=>['correct','incorrect'].includes(x.result.status));const correct=graded.filter(x=>x.result.status==='correct');const earned=graded.reduce((n,x)=>n+(Number(x.result.score)||0),0);const entered=graded.reduce((n,x)=>n+(Number(x.confidence)||0),0);return {rows,graded,correct,earned,entered,accuracy:graded.length?correct.length/graded.length*100:0,pending:rows.filter(x=>x.result.status==='pending').length}}
function combinedAnalytics(){const g=predictionAnalytics(),f=futuresAnalytics();const decisions=g.decisions.length+f.graded.length,correct=g.correct.length+f.correct.length,earned=g.earned+f.earned,entered=g.entered+f.entered;return {games:g,futures:f,decisions,correct,earned,entered,accuracy:decisions?correct/decisions*100:0,efficiency:entered?earned/entered*100:0,pending:g.pending+f.pending}}

function predictionWeekKey(p){
  const g=predictionGame(p);
  const d=new Date(g?.date||p.createdAt||Date.now());
  const start=new Date(d.getFullYear(),0,1);
  const day=Math.floor((d-start)/86400000);
  return `Week ${Math.floor((day+start.getDay())/7)+1}`;
}
function predictionByWeek(){
  const groups=new Map();
  for(const p of predictions){
    const key=predictionWeekKey(p);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(p);
  }
  return [...groups.entries()].map(([week,rows])=>{
    const graded=rows.map(p=>predictionResult(p)).filter(r=>['correct','incorrect','push'].includes(r.status));
    const decisions=graded.filter(r=>r.status!=='push');
    const correct=decisions.filter(r=>r.status==='correct').length;
    return {week,total:rows.length,graded:graded.length,correct,accuracy:decisions.length?correct/decisions.length*100:0,score:graded.reduce((s,r)=>s+(Number(r.score)||0),0)};
  }).sort((a,b)=>Number(a.week.replace(/\D/g,''))-Number(b.week.replace(/\D/g,'')));
}
function confidenceBuckets(){
  const defs=[
    {label:'0–24',min:0,max:24.999999},
    {label:'25–49',min:25,max:49.999999},
    {label:'50–74',min:50,max:74.999999},
    {label:'75–99',min:75,max:99.999999},
    {label:'100+',min:100,max:Infinity}
  ];
  return defs.map(def=>{
    const rows=predictions.filter(p=>Number(p.confidence)>=def.min&&Number(p.confidence)<=def.max).map(p=>predictionResult(p));
    const decisions=rows.filter(r=>['correct','incorrect'].includes(r.status));
    const correct=decisions.filter(r=>r.status==='correct').length;
    return {...def,total:rows.length,graded:decisions.length,correct,accuracy:decisions.length?correct/decisions.length*100:0};
  });
}
function predictionTimeline(){
  return predictions.map(p=>{
    const g=predictionGame(p),result=predictionResult(p,g);
    return {p,g,result,date:new Date(g?.date||p.createdAt||Date.now())};
  }).sort((a,b)=>b.date-a.date);
}
function confidenceCalibrationHtml(){
  return `<div class="confidence-list">${confidenceBuckets().map(b=>`<div class="confidence-row"><div><strong>${b.label}</strong><small>${b.graded} graded · ${b.correct} correct</small></div><div class="confidence-track"><span style="width:${Math.max(4,Math.min(100,b.accuracy))}%"></span></div><b>${b.accuracy.toFixed(1)}%</b></div>`).join('')}</div>`;
}

function predictionDashboardWidget(){const a=combinedAnalytics();return `<div class="prediction-widget"><div><span>Season score</span><strong>${formatNumber(a.earned)}</strong></div><div><span>Accuracy</span><strong>${a.accuracy.toFixed(1)}%</strong></div><div><span>Pending</span><strong>${a.pending}</strong></div><button class="button primary" data-page-jump="predictions">Open Prediction Center</button></div>`}
function formatNumber(n){return Number(n||0).toLocaleString(undefined,{maximumFractionDigits:12})}
function predictionTypeLabel(p){return p.type==='winner'?'Winner':p.type==='spread'?'Spread':'Over / Under'}
function predictionPickLabel(p,g=predictionGame(p)){if(p.type==='total')return `${p.pick==='over'?'Over':'Under'} ${formatNumber(p.line)}`;const t=g?[g.home,g.away].find(x=>x.abbr===p.pick):null;return `${t?.shortName||p.pick}${p.type==='spread'&&Number.isFinite(Number(p.line))?` ${Number(p.line)>0?'+':''}${formatNumber(p.line)}`:''}`}
function predictionForm(){const pre=sortGames(games.filter(g=>g.state!=='post'));const existing=predictions.find(p=>p.id===editingPredictionId);const existingGame=existing?predictionGame(existing):(predictionDraftGameId?games.find(g=>g.id===predictionDraftGameId):null);const selectable=existingGame&&!pre.some(g=>g.id===existingGame.id)?[existingGame,...pre]:pre;const game=existingGame||pre[0];return `<section class="card prediction-entry"><div class="card-head"><h3>${existing?'Edit prediction':'New game prediction'}</h3><span class="provider-badge">LOCAL JOURNAL</span></div><div class="prediction-form-grid"><div class="field wide"><label>Game</label><select id="predictionGame">${selectable.map(g=>`<option value="${g.id}" ${game?.id===g.id?'selected':''}>${esc(g.away.shortName)} at ${esc(g.home.shortName)} · ${esc(kickoffText(g))}</option>`).join('')||'<option value="">No upcoming games loaded</option>'}</select></div><div class="field"><label>Prediction type</label><select id="predictionType"><option value="winner">Winner</option><option value="spread">Spread</option><option value="total">Over / Under</option></select></div><div class="field"><label id="predictionPickLabel">Pick</label><select id="predictionPick"></select></div><div class="field" id="predictionLineField"><label>Line</label><input id="predictionLine" type="number" step="any" placeholder="Example: -3.5 or 52.5"></div><div class="field"><label>Confidence</label><input id="predictionConfidence" type="number" step="any" min="0.0000001" placeholder="Any positive number" value="${existing?esc(existing.confidence):''}"><small>Correct score equals this exact value.</small></div><div class="field"><label>Odds (optional)</label><input id="predictionOdds" type="text" maxlength="40" placeholder="Example: -110, +145, EVEN" value="${existing?esc(existing.odds||''):''}"><small>Stored as reference text only.</small></div><div class="field wide"><label>Journal notes</label><textarea id="predictionNotes" placeholder="Record your reasoning, matchups, weather notes, or questions…">${existing?esc(existing.notes||''):''}</textarea></div></div><div class="button-row"><button class="button primary" id="savePrediction">${existing?'Update prediction':'Save prediction'}</button>${existing?'<button class="button" id="cancelPredictionEdit">Cancel</button>':''}</div><div id="predictionFormError" class="form-error hidden"></div></section>`}
function predictionCard(p){const g=predictionGame(p),r=predictionResult(p);const gameName=g?`${g.away.shortName} at ${g.home.shortName}`:p.gameName||'Game unavailable';return `<article class="prediction-row result-${r.status}"><div class="prediction-result-icon">${r.status==='correct'?'✓':r.status==='incorrect'?'×':r.status==='push'?'—':'○'}</div><div class="prediction-main"><small>${esc(predictionTypeLabel(p))} · ${esc(g?kickoffText(g):'Saved game')}</small><strong>${esc(gameName)}</strong><span>${esc(predictionPickLabel(p,g))}</span>${p.odds?`<span class="odds-reference">Odds: ${esc(p.odds)}</span>`:''}${p.notes?`<p>${esc(p.notes)}</p>`:''}</div><div class="prediction-values"><div><span>Confidence</span><strong>${formatNumber(p.confidence)}</strong></div><div><span>Score</span><strong>${r.score===null?'Pending':formatNumber(r.score)}</strong></div><div><span>Result</span><strong>${r.label}</strong></div></div><div class="prediction-actions"><button class="icon-button" data-edit-prediction="${p.id}" title="Edit">✎</button><button class="icon-button danger" data-delete-prediction="${p.id}" title="Delete">×</button></div></article>`}
function futureForm(){const existing=futures.find(f=>f.id===editingFutureId);const locked=futuresLocked&&!existing;return `<section class="card prediction-entry"><div class="card-head"><h3>${existing?'Edit future':'New futures prediction'}</h3><span class="provider-badge">${futuresLocked?'SEASON LOCKED':'SEASON JOURNAL'}</span></div>${locked?`<div class="warning-box"><strong>Preseason futures are locked.</strong><p>You can unlock the season in the Futures toolbar, or keep the original entries preserved and create new dated entries after unlocking.</p></div>`:''}<div class="prediction-form-grid"><div class="field"><label>Category</label><select id="futureCategory"><option>National Champion</option><option>Conference Champion</option><option>CFP Participant</option><option>Heisman Trophy</option><option>Coach of the Year</option><option>Team Win Total</option><option>Bowl Prediction</option><option>Rivalry Winner</option><option>Custom</option></select></div><div class="field"><label>Season</label><input id="futureSeason" type="number" min="2000" max="2100" value="${existing?esc(existing.season):new Date().getFullYear()}"></div><div class="field wide"><label>Prediction title</label><input id="futureTitle" type="text" maxlength="120" placeholder="Example: 2026 National Champion" value="${existing?esc(existing.title):''}"></div><div class="field wide"><label>Your prediction</label><input id="futurePick" type="text" maxlength="120" placeholder="Example: Ohio State" value="${existing?esc(existing.pick):''}"></div><div class="field"><label>Confidence</label><input id="futureConfidence" type="number" step="any" min="0.0000001" placeholder="Any positive number" value="${existing?esc(existing.confidence):''}"></div><div class="field"><label>Odds (optional)</label><input id="futureOdds" type="text" maxlength="40" placeholder="Example: +650" value="${existing?esc(existing.odds||''):''}"></div><div class="field"><label>Resolution date</label><input id="futureResolutionDate" type="date" value="${existing?esc(existing.resolutionDate||''):''}"></div><div class="field"><label>Status</label><select id="futureStatus"><option value="pending">Pending</option><option value="correct">Correct</option><option value="incorrect">Incorrect</option><option value="void">Void</option></select></div><div class="field wide"><label>Journal notes</label><textarea id="futureNotes" placeholder="Why do you believe this outcome will happen?">${existing?esc(existing.notes||''):''}</textarea></div></div><div class="button-row"><button class="button primary" id="saveFuture" ${locked?'disabled':''}>${existing?'Update future':'Save future'}</button>${existing?'<button class="button" id="cancelFutureEdit">Cancel</button>':''}</div><div id="futureFormError" class="form-error hidden"></div></section>`}
function futureCard(f){const r=futureResult(f);return `<article class="prediction-row result-${r.status}"><div class="prediction-result-icon">${r.status==='correct'?'✓':r.status==='incorrect'?'×':r.status==='void'?'—':'○'}</div><div class="prediction-main"><small>${esc(f.category)} · ${esc(f.season||'')}</small><strong>${esc(f.title)}</strong><span>${esc(f.pick)}</span>${f.odds?`<span class="odds-reference">Odds: ${esc(f.odds)}</span>`:''}${f.resolutionDate?`<small>Resolve by ${esc(f.resolutionDate)}</small>`:''}${f.notes?`<p>${esc(f.notes)}</p>`:''}${f.lockedAt?'<span class="lock-badge">🔒 Preseason locked</span>':''}</div><div class="prediction-values"><div><span>Confidence</span><strong>${formatNumber(f.confidence)}</strong></div><div><span>Score</span><strong>${r.score===null?'Pending':formatNumber(r.score)}</strong></div><div><span>Result</span><strong>${r.label}</strong></div></div><div class="prediction-actions future-actions">${f.status==='pending'?`<button class="icon-button resolve-correct" data-resolve-future="${f.id}" data-future-status="correct" title="Mark correct">✓</button><button class="icon-button danger" data-resolve-future="${f.id}" data-future-status="incorrect" title="Mark incorrect">×</button><button class="icon-button" data-resolve-future="${f.id}" data-future-status="void" title="Mark void">—</button>`:''}<button class="icon-button" data-edit-future="${f.id}" title="Edit" ${f.lockedAt?'disabled':''}>✎</button><button class="icon-button danger" data-delete-future="${f.id}" title="Delete" ${f.lockedAt?'disabled':''}>×</button></div></article>`}
function confidenceBands(rows){const bands=[[0,25,'0–25'],[25,50,'25–50'],[50,100,'50–100'],[100,250,'100–250'],[250,Infinity,'250+']];return bands.map(([min,max,label])=>{const group=rows.filter(x=>Number(x.confidence)>min&&Number(x.confidence)<=max&&['correct','incorrect'].includes(x.result.status));const wins=group.filter(x=>x.result.status==='correct').length;const pct=group.length?wins/group.length*100:0;return `<div class="confidence-band"><div><strong>${label}</strong><span>${group.length} graded</span></div><div class="confidence-track"><i style="width:${pct}%"></i></div><b>${pct.toFixed(0)}%</b></div>`}).join('')}
function achievements(a){const items=[['First Read',predictions.length+futures.length>=1],['Five Correct',a.correct.length>=5],['Ten Straight',a.longest>=10],['70% Club',a.decisions.length>=10&&a.accuracy>=70],['1,000 Score',a.earned>=1000],['High Conviction',Boolean(a.highWin&&Number(a.highWin.confidence)>=100)]];return `<div class="achievement-grid">${items.map(([label,ok])=>`<div class="achievement ${ok?'unlocked':''}"><span>${ok?'★':'☆'}</span><strong>${label}</strong></div>`).join('')}</div>`}
function predictionsPage(){setHeading('Prediction Center','YOUR COLLEGE FOOTBALL ANALYTICS JOURNAL');const c=combinedAnalytics(),a=c.games,fa=c.futures;const gameRows=a.rows.filter(x=>predictionFilter==='all'||x.result.status===predictionFilter).sort((x,y)=>new Date(y.createdAt)-new Date(x.createdAt));const futureRows=fa.rows.filter(x=>futureFilter==='all'||x.result.status===futureFilter).sort((x,y)=>new Date(y.createdAt)-new Date(x.createdAt));return `<section class="prediction-hero"><div><p class="eyebrow">PREDICTION INTELLIGENCE</p><h2>Your confidence. Your score. Your season.</h2><p>Game predictions and season-long futures share one non-financial confidence scoring system.</p></div><button class="button" id="exportPredictions">Export CSV</button></section><div class="prediction-tabs"><button class="filter-chip ${predictionView==='games'?'active':''}" data-prediction-view="games">Game Predictions</button><button class="filter-chip ${predictionView==='futures'?'active':''}" data-prediction-view="futures">Futures</button><button class="filter-chip ${predictionView==='analytics'?'active':''}" data-prediction-view="analytics">Analytics</button><button class="filter-chip" data-page-jump="reports">Timeline & Reports</button></div><div class="metric-grid prediction-metrics">${metric('Combined Score',formatNumber(c.earned),`${formatNumber(c.entered)} confidence graded`)}${metric('Overall Accuracy',`${c.accuracy.toFixed(1)}%`,`${c.correct} correct`)}${metric('Efficiency',`${c.efficiency.toFixed(1)}%`,'Score ÷ confidence')}${metric('Game Score',formatNumber(a.earned),`${a.pending} pending`)}${metric('Futures Score',formatNumber(fa.earned),`${fa.pending} pending`)}${metric('Futures Accuracy',`${fa.accuracy.toFixed(1)}%`,`${fa.graded.length} resolved`)}</div>${predictionView==='games'?`<div class="prediction-layout"><div>${predictionForm()}<section class="card prediction-history"><div class="card-head"><h3>Game Prediction Journal</h3><div class="prediction-filters">${['all','pending','correct','incorrect','push'].map(x=>`<button class="filter-chip ${predictionFilter===x?'active':''}" data-prediction-filter="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div></div><div class="prediction-list">${gameRows.map(predictionCard).join('')||empty('No predictions in this view','Save a prediction or choose another result filter.')}</div></section></div><aside class="prediction-sidebar">${card('Confidence Intelligence',confidenceBands(a.rows))}${card('Personal Bests',`<div class="detail-list"><div><span>Highest confidence correct</span><strong>${a.highWin?formatNumber(a.highWin.confidence):'—'}</strong></div><div><span>Highest confidence miss</span><strong>${a.highMiss?formatNumber(a.highMiss.confidence):'—'}</strong></div><div><span>Longest streak</span><strong>${a.longest}</strong></div><div><span>Total game predictions</span><strong>${predictions.length}</strong></div></div>`)}${card('Achievements',achievements(a))}</aside></div>`:predictionView==='futures'?`<div class="futures-toolbar card"><div><strong>Season Futures</strong><p class="muted">Track championship, award, playoff, conference, rivalry, win-total, and custom outcomes.</p></div><button class="button ${futuresLocked?'danger':'primary'}" id="toggleSeasonLock">${futuresLocked?'Unlock season':'Lock preseason futures'}</button></div><div class="prediction-layout"><div>${futureForm()}<section class="card prediction-history"><div class="card-head"><h3>Futures Journal</h3><div class="prediction-filters">${['all','pending','correct','incorrect','void'].map(x=>`<button class="filter-chip ${futureFilter===x?'active':''}" data-future-filter="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div></div><div class="prediction-list">${futureRows.map(futureCard).join('')||empty('No futures in this view','Add a national champion, conference champion, award, playoff, or custom future.')}</div></section></div><aside class="prediction-sidebar">${card('Futures Summary',`<div class="detail-list"><div><span>Pending</span><strong>${fa.pending}</strong></div><div><span>Resolved</span><strong>${fa.graded.length}</strong></div><div><span>Accuracy</span><strong>${fa.accuracy.toFixed(1)}%</strong></div><div><span>Score</span><strong>${formatNumber(fa.earned)}</strong></div></div>`)}${card('Season Lock',`<p class="muted">Locking stamps all pending preseason futures and prevents accidental edits until you explicitly unlock them.</p><strong>${futuresLocked?'Locked':'Open'}</strong>`)}</aside></div>`:`<div class="reports-grid">${card('Confidence Calibration',confidenceCalibrationHtml())}${card('Weekly Performance',predictionByWeek().length?`<div class="report-table">${predictionByWeek().map(w=>`<div><span>${esc(w.week)}</span><strong>${w.accuracy.toFixed(1)}%</strong><small>${w.correct}/${w.graded} correct · ${formatNumber(w.score)} score</small></div>`).join('')}</div>`:empty('No weekly data yet','Graded predictions will build a weekly history.'))}${card('Combined Season Totals',`<div class="detail-list"><div><span>Game predictions</span><strong>${predictions.length}</strong></div><div><span>Futures</span><strong>${futures.length}</strong></div><div><span>Combined score</span><strong>${formatNumber(c.earned)}</strong></div><div><span>Combined accuracy</span><strong>${c.accuracy.toFixed(1)}%</strong></div></div>`)}${card('Futures Performance',`<div class="detail-list"><div><span>Correct</span><strong>${fa.correct.length}</strong></div><div><span>Incorrect</span><strong>${fa.graded.length-fa.correct.length}</strong></div><div><span>Pending</span><strong>${fa.pending}</strong></div><div><span>Score</span><strong>${formatNumber(fa.earned)}</strong></div></div>`)}</div>`}`}
function analyticsByType(a){return ['winner','spread','total'].map(type=>{const rows=a.rows.filter(x=>x.type===type&&['correct','incorrect'].includes(x.result.status));const correct=rows.filter(x=>x.result.status==='correct').length;return {type,label:type==='winner'?'Winner':type==='spread'?'Spread':'Over / Under',count:rows.length,accuracy:rows.length?correct/rows.length*100:0,score:rows.reduce((n,x)=>n+(Number(x.result.score)||0),0)}})}
function predictionTeamLeaders(a){const map=new Map();for(const x of a.rows){if(x.type==='total'||!['correct','incorrect'].includes(x.result.status))continue;const key=x.pick;if(!map.has(key))map.set(key,{team:key,total:0,correct:0,score:0});const row=map.get(key);row.total++;row.correct+=x.result.status==='correct'?1:0;row.score+=Number(x.result.score)||0}return [...map.values()].map(x=>({...x,accuracy:x.total?x.correct/x.total*100:0})).sort((a,b)=>b.accuracy-a.accuracy||b.total-a.total)}

function insightBar(label,value,max,detail=''){
  const safeMax=Math.max(1,Number(max)||1);
  const width=Math.max(2,Math.min(100,(Number(value)||0)/safeMax*100));
  return `<div class="confidence-row"><div><strong>${esc(label)}</strong><small>${esc(detail)}</small></div><div class="confidence-track"><span style="width:${width}%"></span></div><b>${Number(value||0).toFixed(1)}%</b></div>`;
}
function predictionTypeInsights(){
  const types=[
    {id:'winner',label:'Winner'},
    {id:'spread',label:'Spread'},
    {id:'total',label:'Over / Under'}
  ];
  return types.map(type=>{
    const rows=predictions.filter(p=>p.type===type.id).map(p=>predictionResult(p));
    const decisions=rows.filter(r=>['correct','incorrect'].includes(r.status));
    const correct=decisions.filter(r=>r.status==='correct').length;
    const score=rows.reduce((sum,r)=>sum+(Number(r.score)||0),0);
    return {label:type.label,total:predictions.filter(p=>p.type===type.id).length,graded:decisions.length,correct,accuracy:decisions.length?correct/decisions.length*100:0,score};
  });
}
function teamInsightRows(){
  const teams=predictionTeamLeaders(predictionAnalytics());
  return teams.map(team=>({
    ...team,
    accuracy:Number(team.accuracy)||0,
    score:Number(team.score)||0
  }));
}
function weeklyInsightChart(){
  const weeks=predictionByWeek();
  if(!weeks.length)return empty('No weekly trend yet','Graded predictions will create a weekly performance history.');
  const max=Math.max(...weeks.map(w=>w.accuracy),1);
  return `<div class="confidence-list">${weeks.map(w=>insightBar(w.week,w.accuracy,max,`${w.correct}/${w.graded} correct · ${formatNumber(w.score)} score`)).join('')}</div>`;
}
function typeInsightChart(){
  const types=predictionTypeInsights();
  const max=Math.max(...types.map(t=>t.accuracy),1);
  return `<div class="confidence-list">${types.map(t=>insightBar(t.label,t.accuracy,max,`${t.correct}/${t.graded} correct · ${formatNumber(t.score)} score`)).join('')}</div>`;
}
function teamInsightChart(){
  const teams=teamInsightRows().slice(0,10);
  if(!teams.length)return empty('No team insights yet','Predictions tied to teams will appear here.');
  const max=Math.max(...teams.map(t=>t.accuracy),1);
  return `<div class="confidence-list">${teams.map(t=>insightBar(t.team,t.accuracy,max,`${t.correct}/${t.total} correct · ${formatNumber(t.score)} score`)).join('')}</div>`;
}
function calibrationSummary(){
  const buckets=confidenceBuckets();
  const usable=buckets.filter(b=>b.graded>0);
  if(!usable.length)return {label:'Not enough graded data',detail:'Grade more predictions to evaluate confidence calibration.'};
  const best=[...usable].sort((a,b)=>b.accuracy-a.accuracy||b.graded-a.graded)[0];
  const weakest=[...usable].sort((a,b)=>a.accuracy-b.accuracy||b.graded-a.graded)[0];
  return {
    label:`Best confidence range: ${best.label}`,
    detail:`${best.accuracy.toFixed(1)}% accuracy · Weakest: ${weakest.label} at ${weakest.accuracy.toFixed(1)}%`
  };
}

function reportsPage(){
  setHeading('Prediction Insights','VISUAL ANALYTICS · SEASON YEARBOOK');
  const combined=combinedAnalytics();
  const game=combined.games;
  const future=combined.futures;
  const summary=calibrationSummary();
  const timeline=predictionTimeline();
  const note=localStorage.getItem('onlybeats.yearbook.note.v1')||'';

  return `<section class="prediction-hero">
    <div>
      <p class="eyebrow">PREDICTION INSIGHTS</p>
      <h2>Understand where your predictions are strongest.</h2>
      <p>Review confidence calibration, weekly trends, prediction types, team performance, and the full season timeline.</p>
    </div>
    <button class="button primary" id="reportExportPredictions">Export prediction CSV</button>
  </section>

  <div class="metric-grid prediction-metrics">
    ${metric('Combined Score',formatNumber(combined.earned),`${formatNumber(combined.entered)} confidence graded`)}
    ${metric('Overall Accuracy',`${combined.accuracy.toFixed(1)}%`,`${combined.correct}/${combined.decisions} correct`)}
    ${metric('Game Score',formatNumber(game.earned),`${predictions.length} game predictions`)}
    ${metric('Futures Score',formatNumber(future.earned),`${futures.length} futures`)}
    ${metric('Longest Streak',game.longest,'Game predictions')}
    ${metric('Pending',combined.pending,'Games and futures')}
  </div>

  <section class="card command-top-signal">
    <div>
      <p class="eyebrow">CALIBRATION SUMMARY</p>
      <h3>${esc(summary.label)}</h3>
      <p class="muted">${esc(summary.detail)}</p>
    </div>
    <button class="button" data-page-jump="predictions">Open Prediction Center</button>
  </section>

  <div class="reports-grid">
    ${card('Confidence Calibration',confidenceCalibrationHtml(),'wide')}
    ${card('Weekly Accuracy Trend',weeklyInsightChart(),'wide')}
    ${card('Performance by Prediction Type',typeInsightChart())}
    ${card('Top Team Reads',teamInsightChart())}
    ${card('Prediction Timeline',timeline.length?`<div class="intel-list prediction-timeline">${timeline.slice(0,50).map(item=>`<div class="intel-row"><span class="intel-icon">${item.result.status==='correct'?'✓':item.result.status==='incorrect'?'×':item.result.status==='push'?'—':'○'}</span><div><strong>${esc(item.g?`${item.g.away.shortName} at ${item.g.home.shortName}`:item.p.gameName||'Saved prediction')}</strong><small>${item.date.toLocaleDateString()} · ${esc(predictionTypeLabel(item.p))} · Confidence ${formatNumber(item.p.confidence)}</small></div><b>${item.result.score===null?'Pending':formatNumber(item.result.score)}</b></div>`).join('')}</div>`:empty('No timeline yet','Saved predictions will appear chronologically here.'),'wide')}
    ${card('Season Reflection',`<textarea id="yearbookNote" class="quick-notes" placeholder="Write a season reflection…">${esc(note)}</textarea><small class="muted">Saved locally as part of your season yearbook.</small>`,'wide')}
  </div>`;
}

function refreshPredictionPickOptions(existing){
  const game=games.find(g=>g.id===$('predictionGame')?.value);
  const type=$('predictionType')?.value||'winner';
  const pick=$('predictionPick');
  if(!pick)return;

  const selected=existing?.pick||pick.value;

  if(type==='total'){
    pick.innerHTML='<option value="over">Over</option><option value="under">Under</option>';
    if($('predictionPickLabel'))$('predictionPickLabel').textContent='Direction';
    if($('predictionLineField'))$('predictionLineField').classList.remove('hidden');
  }else{
    pick.innerHTML=game
      ? [game.away,game.home].map(team=>`<option value="${esc(team.abbr)}">${esc(team.name)}</option>`).join('')
      : '';
    if($('predictionPickLabel'))$('predictionPickLabel').textContent=type==='winner'?'Winner':'Team';
    if($('predictionLineField'))$('predictionLineField').classList.toggle('hidden',type==='winner');
  }

  if([...pick.options].some(option=>option.value===selected)){
    pick.value=selected;
  }
}

function bindPredictionPage(){
  document.querySelectorAll('[data-prediction-view]').forEach(b=>b.onclick=()=>{predictionView=b.dataset.predictionView;editingPredictionId='';editingFutureId='';renderPage()});
  const existing=predictions.find(p=>p.id===editingPredictionId);
  if($('predictionType')){$('predictionType').value=existing?.type||'winner';$('predictionLine').value=existing?.line??'';refreshPredictionPickOptions(existing);$('predictionType').onchange=()=>refreshPredictionPickOptions();$('predictionGame').onchange=()=>refreshPredictionPickOptions()}
  if($('savePrediction'))$('savePrediction').onclick=()=>{const game=games.find(g=>g.id===$('predictionGame').value),type=$('predictionType').value,pick=$('predictionPick').value,confidence=Number($('predictionConfidence').value),line=$('predictionLine').value===''?null:Number($('predictionLine').value),odds=$('predictionOdds').value.trim(),notes=$('predictionNotes').value.trim(),error=$('predictionFormError');let message='';if(!game)message='Choose an upcoming game.';else if(!Number.isFinite(confidence)||confidence<=0)message='Confidence must be any positive number.';else if((type==='spread'||type==='total')&&!Number.isFinite(line))message='Enter a valid line for spread or total predictions.';else if(!pick)message='Choose a prediction.';if(message){error.textContent=message;error.classList.remove('hidden');return}const prior=predictions.find(p=>p.id===editingPredictionId);const item={id:prior?.id||crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,gameId:game.id,gameName:`${game.away.shortName} at ${game.home.shortName}`,type,pick,line,confidence,odds,notes,createdAt:prior?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};predictions=prior?predictions.map(p=>p.id===prior.id?item:p):[...predictions,item];editingPredictionId='';predictionDraftGameId='';savePredictions();addTimelineEvent({type:'prediction',title:prior?'Prediction updated':'Prediction saved',detail:`${predictionTypeLabel(item)} · ${predictionPickLabel(item,game)}`,gameId:game.id});toast(prior?'Prediction updated':'Prediction saved');renderPage()};
  if($('cancelPredictionEdit'))$('cancelPredictionEdit').onclick=()=>{editingPredictionId='';renderPage()};
  document.querySelectorAll('[data-edit-prediction]').forEach(b=>b.onclick=()=>{editingPredictionId=b.dataset.editPrediction;predictionView='games';renderPage();window.scrollTo({top:0,behavior:'smooth'})});
  document.querySelectorAll('[data-delete-prediction]').forEach(b=>b.onclick=()=>{if(confirm('Delete this prediction?')){predictions=predictions.filter(p=>p.id!==b.dataset.deletePrediction);savePredictions();renderPage()}});
  document.querySelectorAll('[data-prediction-filter]').forEach(b=>b.onclick=()=>{predictionFilter=b.dataset.predictionFilter;renderPage()});
  const existingFuture=futures.find(f=>f.id===editingFutureId);if(existingFuture&&$('futureCategory')){$('futureCategory').value=existingFuture.category;$('futureStatus').value=existingFuture.status||'pending'}
  if($('saveFuture'))$('saveFuture').onclick=()=>{const category=$('futureCategory').value,title=$('futureTitle').value.trim(),pick=$('futurePick').value.trim(),season=Number($('futureSeason').value),confidence=Number($('futureConfidence').value),odds=$('futureOdds').value.trim(),resolutionDate=$('futureResolutionDate').value,status=$('futureStatus').value,notes=$('futureNotes').value.trim(),error=$('futureFormError');let message='';if(!title)message='Enter a prediction title.';else if(!pick)message='Enter your predicted outcome.';else if(!Number.isInteger(season)||season<2000)message='Enter a valid season.';else if(!Number.isFinite(confidence)||confidence<=0)message='Confidence must be any positive number.';if(message){error.textContent=message;error.classList.remove('hidden');return}const prior=futures.find(f=>f.id===editingFutureId);const item={id:prior?.id||crypto.randomUUID?.()||`future-${Date.now()}-${Math.random()}`,category,title,pick,season,confidence,odds,resolutionDate,status,notes,createdAt:prior?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),lockedAt:prior?.lockedAt||null};futures=prior?futures.map(f=>f.id===prior.id?item:f):[...futures,item];editingFutureId='';saveFutures();toast(prior?'Future updated':'Future saved');renderPage()};
  if($('cancelFutureEdit'))$('cancelFutureEdit').onclick=()=>{editingFutureId='';renderPage()};
  document.querySelectorAll('[data-edit-future]').forEach(b=>b.onclick=()=>{editingFutureId=b.dataset.editFuture;predictionView='futures';renderPage();window.scrollTo({top:0,behavior:'smooth'})});
  document.querySelectorAll('[data-resolve-future]').forEach(b=>b.onclick=()=>{const id=b.dataset.resolveFuture,status=b.dataset.futureStatus;futures=futures.map(f=>f.id===id?{...f,status,updatedAt:new Date().toISOString()}:f);saveFutures();toast(`Future marked ${status}`);renderPage()});
  document.querySelectorAll('[data-delete-future]').forEach(b=>b.onclick=()=>{if(confirm('Delete this future?')){futures=futures.filter(f=>f.id!==b.dataset.deleteFuture);saveFutures();renderPage()}});
  document.querySelectorAll('[data-future-filter]').forEach(b=>b.onclick=()=>{futureFilter=b.dataset.futureFilter;renderPage()});
  if($('toggleSeasonLock'))$('toggleSeasonLock').onclick=()=>{if(futuresLocked){if(confirm('Unlock futures so entries can be edited again?')){futuresLocked=false;futures=futures.map(f=>({...f,lockedAt:null}));saveFutures();renderPage()}}else if(confirm('Lock all current pending futures as preseason predictions?')){const now=new Date().toISOString();futuresLocked=true;futures=futures.map(f=>f.status==='pending'?{...f,lockedAt:now}:f);saveFutures();renderPage()}};
  if($('exportPredictions'))$('exportPredictions').onclick=exportPredictionsCsv;
}
function exportPredictionsCsv(){const rows=[['Record Type','Game / Title','Category / Prediction Type','Pick','Line','Confidence','Odds','Result','Score','Notes','Season','Resolution Date','Created']];for(const p of predictions){const r=predictionResult(p);rows.push(['Game',p.gameName,predictionTypeLabel(p),predictionPickLabel(p),p.line??'',p.confidence,p.odds||'',r.label,r.score??'',p.notes||'','','',p.createdAt])}for(const f of futures){const r=futureResult(f);rows.push(['Future',f.title,f.category,f.pick,'',f.confidence,f.odds||'',r.label,r.score??'',f.notes||'',f.season||'',f.resolutionDate||'',f.createdAt])}const csv=rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`OnlyBeats-Prediction-Center-${new Date().toISOString().slice(0,10)}.csv`;a.click();toast('Prediction Center CSV created')}

function renderPageUnsafe(){
  const label=pages.find(p=>p[0]===currentPage)?.[2]||'Module';
  $('content').innerHTML=currentPage==='dashboard'?unifiedCommandDashboardPage():currentPage==='briefing'?smartBriefingPage():currentPage==='timeline'?liveCommandTimelinePage():currentPage==='archive'?seasonArchivePage():currentPage==='analytics'?analyticsCenterPage():currentPage==='datahealth'?liveDataHealthPage():currentPage==='performance'?performanceCenterPage():currentPage==='alerts'?liveAlertCenterPage():currentPage==='mission'?commandCenterTwoPage():currentPage==='about'?aboutStoragePage():currentPage==='quality'?uiQualityPage():currentPage==='insights'?smartInsightsPage():currentPage==='wall'?wallPage():currentPage==='watch'?watchCenterPage():currentPage==='gamehub'?gameIntelligenceHubPage():currentPage==='schedule'?schedulePage():currentPage==='favorites'?favoritesPage():currentPage==='teams'?teamHubPage():currentPage==='rankings'?intelligenceEnginePage():currentPage==='news'?newsPage():currentPage==='weather'?weatherPage():currentPage==='availability'?availabilityPage():currentPage==='predictions'?predictionsPage():currentPage==='reports'?predictionIntelligencePage():currentPage==='developer'?developerPage():currentPage==='settings'?settingsPage():placeholderPage(currentPage,label);
  bindPage();
  if(typeof restorePageFocus==='function')restorePageFocus();
}
function renderPage(){
  const content=$('content');
  if(!content)return;
  try{
    const __renderStarted=performance.now();
    renderPageUnsafe();
    if(typeof recordPageRenderMetric==='function')recordPageRenderMetric(currentPage,performance.now()-__renderStarted);
  }catch(error){
    const message=String(error?.message||error);
    runtimeErrors.unshift({page:currentPage,message,time:new Date().toISOString()});
    runtimeErrors=runtimeErrors.slice(0,20);
    console.error('OnlyBeats page render failed',currentPage,error);
    setHeading('Page recovery','ONLYBEATS COMMAND CENTER');
    content.innerHTML=`<div class="error-box"><strong>${esc((pages.find(p=>p[0]===currentPage)?.[2]||'This page'))} could not load</strong><p>${esc(message)}</p><button class="button primary" id="retryPageRender">Try this page again</button><button class="button" id="openDeveloperTools">Open Developer Tools</button></div>`;
    $('retryPageRender')?.addEventListener('click',renderPage);
    $('openDeveloperTools')?.addEventListener('click',()=>navigate('developer'));
  }
}
function bindPage(){document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>showGame(b.dataset.game));document.querySelectorAll('[data-open-wall]').forEach(b=>b.onclick=()=>navigate('wall'));document.querySelectorAll('[data-schedule-filter]').forEach(b=>b.onclick=()=>{scheduleFilter=b.dataset.scheduleFilter;renderPage()});
document.querySelectorAll('[data-schedule-range]').forEach(b=>b.onclick=()=>{scheduleRange=b.dataset.scheduleRange;renderPage()});
if($('scheduleFavoritesFilter'))$('scheduleFavoritesFilter').onclick=()=>{scheduleFavoritesOnly=!scheduleFavoritesOnly;renderPage()};
if($('scheduleTop25Filter'))$('scheduleTop25Filter').onclick=()=>{scheduleTop25Only=!scheduleTop25Only;renderPage()};
if($('scheduleSearch'))$('scheduleSearch').oninput=e=>{scheduleQuery=e.target.value;renderPage();const input=$('scheduleSearch');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length)}};
if($('clearScheduleFilters'))$('clearScheduleFilters').onclick=()=>{scheduleFilter='all';scheduleRange='all';scheduleQuery='';scheduleFavoritesOnly=false;scheduleTop25Only=false;renderPage()};
if($('availabilityForm'))$('availabilityForm').onsubmit=e=>{e.preventDefault();const team=$('availabilityTeam').value,player=$('availabilityPlayer').value.trim(),status=$('availabilityStatus').value,notes=$('availabilityNotes').value.trim();if(!team||!player)return;const timelineAvailabilityEntry={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),team,player,status,notes,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};availabilityEntries.unshift(timelineAvailabilityEntry);saveAvailability();addTimelineEvent({type:'availability',title:'Availability note added',detail:`${player} · ${team} · ${status}`,teamAbbr:team});toast('Availability note saved');renderPage()};document.querySelectorAll('[data-delete-availability]').forEach(b=>b.onclick=()=>{availabilityEntries=availabilityEntries.filter(x=>x.id!==b.dataset.deleteAvailability);saveAvailability();renderPage()});document.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{wallState.status=b.dataset.status;saveWall();renderPage()});if($('favoritesFilter'))$('favoritesFilter').onclick=()=>{wallState.favoritesOnly=!wallState.favoritesOnly;saveWall();renderPage()};if($('top25Filter'))$('top25Filter').onclick=()=>{wallState.top25Only=!wallState.top25Only;saveWall();renderPage()};if($('wallSearch'))$('wallSearch').oninput=e=>{wallState.query=e.target.value;saveWall();const grid=document.querySelector('.wall-grid');if(grid)grid.innerHTML=filteredWallGames().map(gameCard).join('')||empty('No games match these filters','Try another team or clear filters.');document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>showGame(b.dataset.game))};document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{favorites=favorites.filter(x=>x!==b.dataset.remove);saveFavorites()});document.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>{activeTeamAbbr=b.dataset.team;teamTab='overview';renderPage()});document.querySelectorAll('[data-team-tab]').forEach(b=>b.onclick=()=>{teamTab=b.dataset.teamTab;renderPage()});if($('teamSearch'))$('teamSearch').oninput=e=>{teamQuery=e.target.value;renderPage();setTimeout(()=>{const x=$('teamSearch');if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length)}},0)};if($('teamConferenceFilter'))$('teamConferenceFilter').onchange=e=>{teamConferenceFilter=e.target.value;renderPage()};if($('teamFavoritesFilter'))$('teamFavoritesFilter').onclick=()=>{teamFavoritesOnly=!teamFavoritesOnly;renderPage()};if($('clearTeamFilters'))$('clearTeamFilters').onclick=()=>{teamQuery='';teamConferenceFilter='all';teamFavoritesOnly=false;renderPage()};if($('teamFavoriteButton'))$('teamFavoriteButton').onclick=()=>{const t=selectedTeam();if(!t)return;favorites=favorites.includes(t.abbr)?favorites.filter(x=>x!==t.abbr):[...favorites,t.abbr];localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites));renderPage()};if($('loadWeather'))$('loadWeather').onclick=()=>fetchWeather($('weatherLocation').value.trim());document.querySelectorAll('[data-focus]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();openFocus(b.dataset.focus)});document.querySelectorAll('[data-alert-game]').forEach(b=>b.onclick=()=>{const id=b.dataset.alertGame;if(id)showGame(id)});document.querySelectorAll('[data-page-jump]').forEach(b=>b.onclick=()=>navigate(b.dataset.pageJump));if(currentPage==='developer'){
    if($('runRuntimeDiagnostics'))$('runRuntimeDiagnostics').onclick=()=>{runOnlyBeatsDiagnostics();renderPage();toast('Diagnostics completed')};
    if($('runPageSmokeTests'))$('runPageSmokeTests').onclick=async()=>{await runOnlyBeatsPageSmokeTests();renderPage();toast('Page smoke tests completed')};
    if($('exportDiagnostics'))$('exportDiagnostics').onclick=()=>exportOnlyBeatsDiagnostics();
    if($('clearRuntimeLog'))$('clearRuntimeLog').onclick=()=>{clearOnlyBeatsRuntimeLog();renderPage();toast('Runtime log cleared')};
  }if(currentPage==='dashboard')bindUnifiedCommandDashboard();if(currentPage==='gamehub')bindGameIntelligenceHub();if(currentPage==='insights')bindSmartInsights();if(currentPage==='quality')bindUiQuality();if(currentPage==='about')bindAboutStorage();if(currentPage==='mission')bindCommandCenterTwo();if(currentPage==='alerts')bindLiveAlertCenter();if(currentPage==='performance')bindPerformanceCenter();if(currentPage==='datahealth')bindLiveDataHealth();if(currentPage==='analytics')bindAnalyticsCenter();if(currentPage==='archive')bindSeasonArchive();if(currentPage==='timeline')bindLiveCommandTimeline();if(currentPage==='briefing')bindSmartBriefing();if(currentPage==='watch')bindWatchCenter();if(currentPage==='rankings')bindIntelligenceEngine();if(currentPage==='predictions')bindPredictionPage();if(currentPage==='reports'){bindPredictionIntelligence();if($('reportExportPredictions'))$('reportExportPredictions').onclick=exportPredictionsCsv;if($('yearbookNote'))$('yearbookNote').oninput=e=>localStorage.setItem('onlybeats.yearbook.note.v1',e.target.value)}document.querySelectorAll('[data-predict-game]').forEach(b=>b.onclick=()=>{predictionDraftGameId=b.dataset.predictGame;editingPredictionId='';predictionView='games';navigate('predictions')});bindPersonalization();if(currentPage==='settings')bindSettings()}
function gamePredictionSnapshot(game){
  const rows=predictions
    .filter(p=>p.gameId===game.id)
    .map(p=>({...p,result:predictionResult(p,game)}));
  const graded=rows.filter(x=>['correct','incorrect','push'].includes(x.result.status));
  return {
    rows,
    graded,
    earned:graded.reduce((sum,x)=>sum+(Number(x.result.score)||0),0),
    pending:rows.filter(x=>x.result.status==='pending').length
  };
}
function gameAvailabilitySnapshot(game){
  const teams=[game.away.abbr,game.home.abbr];
  const entries=availabilityEntries.filter(x=>teams.includes(x.team));
  return {
    entries,
    away:entries.filter(x=>x.team===game.away.abbr),
    home:entries.filter(x=>x.team===game.home.abbr),
    concerning:entries.filter(x=>['Questionable','Doubtful','Unavailable','Unknown'].includes(x.status))
  };
}
function gameTeamSummary(team){
  const enriched=allTeams().find(t=>t.abbr===team.abbr)||team;
  const snapshot=teamRecordSnapshot(enriched);
  const availability=teamAvailabilitySnapshot(enriched);
  return `<button class="intel-row" data-open-team="${esc(team.abbr)}">
    <span class="intel-icon">${team.rank?`#${team.rank}`:'◈'}</span>
    <div>
      <strong>${esc(team.name)}</strong>
      <small>${esc(team.record||`${snapshot.wins}-${snapshot.losses}`)} · ${esc(enriched.conference||'FBS')} · ${availability.concerning.length} availability note${availability.concerning.length===1?'':'s'}</small>
    </div>
    <b>›</b>
  </button>`;
}
function gamePredictionSummary(game){
  const snapshot=gamePredictionSnapshot(game);
  if(!snapshot.rows.length){
    return `<p class="muted">No saved prediction for this matchup.</p><button class="button primary" data-predict-game="${game.id}">Create prediction</button>`;
  }
  return `<div class="intel-list">${snapshot.rows.map(p=>{
    const result=p.result;
    return `<div class="intel-row">
      <span class="intel-icon">${result.status==='correct'?'✓':result.status==='incorrect'?'×':result.status==='push'?'—':'○'}</span>
      <div><strong>${esc(predictionTypeLabel(p))}: ${esc(predictionPickLabel(p,game))}</strong><small>Confidence ${formatNumber(p.confidence)}${p.odds?` · Odds ${esc(p.odds)}`:''} · ${esc(result.label)}</small></div>
      <b>${result.score===null?'Pending':formatNumber(result.score)}</b>
    </div>`;
  }).join('')}</div><button class="button" data-predict-game="${game.id}">Add another prediction</button>`;
}
function gameAvailabilitySummary(game){
  const snapshot=gameAvailabilitySnapshot(game);
  if(!snapshot.entries.length){
    return `<p class="muted">No manual availability notes for either team.</p><button class="button" data-open-availability="${game.id}">Open Player Availability</button>`;
  }
  return `<div class="intel-list">${snapshot.entries.slice(0,6).map(x=>`<div class="intel-row">
    <span class="intel-icon">♙</span>
    <div><strong>${esc(x.player)} · ${esc(x.team)}</strong><small>${esc(x.status)}${x.notes?` · ${esc(x.notes)}`:''}</small></div>
  </div>`).join('')}</div><button class="button" data-open-availability="${game.id}">Manage availability notes</button>`;
}
function showGame(id,open=true){
  const g=games.find(x=>x.id===id);
  if(!g)return;
  activeGameId=id;
  const choices=[g.away,g.home];
  const weatherLocation=[g.city,g.stateCode].filter(Boolean).join(', ');
  const favorite=isFavoriteGame(g);
  const ranked=isTop25(g);
  $('gameDrawerBody').innerHTML=`
    <div class="drawer-hero">
      <p class="eyebrow">${esc(statusLabel(g.state))}${ranked?' · TOP 25':''}${favorite?' · FAVORITE MATCHUP':''}</p>
      <h2>${g.away.rank?`#${g.away.rank} `:''}${esc(g.away.shortName)} at ${g.home.rank?`#${g.home.rank} `:''}${esc(g.home.shortName)}</h2>
      <p>${esc(g.status)}${g.network?` · ${esc(g.network)}`:''}</p>
    </div>
    <div class="drawer-score">${teamLine(g.away)}${teamLine(g.home)}</div>
    <div class="drawer-details">
      <div><span>Broadcast</span><strong>${esc(g.network||'Not listed')}</strong></div>
      <div><span>Venue</span><strong>${esc(g.venue||'Not listed')}</strong></div>
      <div><span>Location</span><strong>${esc(weatherLocation||'Not listed')}</strong></div>
      <div><span>Kickoff</span><strong>${new Date(g.date).toLocaleString()}</strong></div>
    </div>

    <div class="drawer-section">
      <h3>Team Intelligence</h3>
      <div class="intel-list">${choices.map(gameTeamSummary).join('')}</div>
    </div>

    <div class="drawer-section">
      <h3>Your Prediction</h3>
      ${gamePredictionSummary(g)}
    </div>

    <div class="drawer-section">
      <h3>Player Availability</h3>
      ${gameAvailabilitySummary(g)}
    </div>

    <div class="drawer-section">
      <h3>GameDay Tools</h3>
      <div class="button-row">
        <button class="button" data-open-schedule-game="${g.id}">Open in Schedule</button>
        <button class="button" data-game-weather="${g.id}" ${weatherLocation?'':'disabled'}>${weatherLocation?'Load venue weather':'Weather location unavailable'}</button>
        <button class="button" data-focus-game="${g.id}">Focus Mode</button>
        <button class="button primary" data-open-game-hub="${g.id}">Open Game Hub</button>
      </div>
    </div>

    <div class="drawer-section">
      <h3>Favorite teams</h3>
      <div class="button-row">${choices.map(t=>`<button class="button ${favorites.includes(t.abbr)?'primary':''}" data-favorite="${esc(t.abbr)}">${favorites.includes(t.abbr)?'★ Remove':'☆ Add'} ${esc(t.shortName)}</button>`).join('')}</div>
    </div>

    <div class="drawer-section future-panel">
      <span>Data coverage</span>
      <p>Scores, rankings, team metadata, saved predictions, manual availability notes, schedule links, and venue weather shortcuts are connected. Play-by-play remains a future provider integration.</p>
    </div>`;

  if(open){
    $('gameDrawerBackdrop').classList.remove('hidden');
    $('gameDrawer').classList.add('open');
  }

  document.querySelectorAll('[data-favorite]').forEach(b=>b.onclick=()=>{
    const a=b.dataset.favorite;
    favorites=favorites.includes(a)?favorites.filter(x=>x!==a):[...favorites,a];
    localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites));
    showGame(id,false);
    renderPage();
  });
  document.querySelectorAll('[data-open-team]').forEach(b=>b.onclick=()=>openTeam(b.dataset.openTeam));
  document.querySelectorAll('[data-predict-game]').forEach(b=>b.onclick=()=>{
    predictionDraftGameId=b.dataset.predictGame;
    editingPredictionId='';
    predictionView='games';
    closeGame();
    navigate('predictions');
  });
  document.querySelectorAll('[data-open-availability]').forEach(b=>b.onclick=()=>{
    closeGame();
    navigate('availability');
  });
  document.querySelectorAll('[data-open-schedule-game]').forEach(b=>b.onclick=()=>{
    scheduleQuery=`${g.away.abbr} ${g.home.abbr}`;
    scheduleRange='all';
    scheduleFilter='all';
    closeGame();
    navigate('schedule');
  });
  document.querySelectorAll('[data-game-weather]').forEach(b=>b.onclick=()=>{
    settings.weatherLocation=weatherLocation;
    saveSettings(false);
    closeGame();
    navigate('weather');
    fetchWeather(weatherLocation);
  });
  document.querySelectorAll('[data-focus-game]').forEach(b=>b.onclick=()=>{
    closeGame();
    openFocus(b.dataset.focusGame);
  });
  document.querySelectorAll('[data-open-game-hub]').forEach(b=>b.onclick=()=>{
    gameHubGameId=b.dataset.openGameHub;
    closeGame();
    navigate('gamehub');
  });
}

function closeGame(){activeGameId=null;$('gameDrawer').classList.remove('open');setTimeout(()=>$('gameDrawerBackdrop').classList.add('hidden'),180)}
function bindSettings(){const t=$('themeSelect');t.value=settings.theme==='dark'?'midnight':settings.theme;t.onchange=()=>{settings.theme=t.value;applyTheme();saveSettings()};const d=$('densitySelect');d.value=settings.dashboardDensity||'comfortable';d.onchange=()=>{settings.dashboardDensity=d.value;applyTheme();saveSettings()};const r=$('refreshSelect');r.value=settings.refresh;r.onchange=()=>{settings.refresh=r.value;saveSettings()};const s=$('startPageSelect');s.value=settings.startPage;s.onchange=()=>{settings.startPage=s.value;saveSettings()};const ps=$('pushScoringSelect');if(ps){ps.value=settings.pushScoring||'full';ps.onchange=()=>{settings.pushScoring=ps.value;saveSettings()}};[['compactToggle','compact'],['animationToggle','animations'],['highContrastToggle','highContrast'],['largeTextToggle','largeText'],['performanceModeToggle','performanceMode'],['scoreAlertsToggle','scoreAlerts'],['favoriteAlertsToggle','favoriteAlerts'],['kickoffAlertsToggle','kickoffAlerts']].forEach(([id,k])=>$(id).onclick=e=>{settings[k]=!settings[k];e.currentTarget.classList.toggle('on',settings[k]);applyTheme();saveSettings()});$('testProvider').onclick=()=>syncScores();$('settingsResetDashboard').onclick=()=>{dashboardLayout=[...defaultDashboard];saveDashboard()};$('exportButton').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({settings,favorites,wallState,dashboardLayout,quickNotes,predictions,futures,futuresLocked},null,2)],{type:'application/json'}));a.download='OnlyBeats-settings-v0.9.1.json';a.click();toast('Settings export created')};$('resetButton').onclick=()=>{if(confirm('Reset preferences, dashboard, notes, filters, and favorites?')){settings={...defaultSettings};favorites=[];wallState={...defaultWall};dashboardLayout=[...defaultDashboard];quickNotes='';predictions=[];futures=[];futuresLocked=false;localStorage.clear();applyTheme();renderPage()}};bindReleaseReadinessSettings();bindRc3Settings();bindRc4Settings()}
const palette=$('commandPalette'),input=$('commandInput'),results=$('commandResults');
function openPalette(){palette.classList.remove('hidden');input.value='';renderCommands('');setTimeout(()=>input.focus(),0)}
function closePalette(){palette.classList.add('hidden')}
function renderCommands(q){const pageRows=pages.filter(p=>p[2].toLowerCase().includes(q.toLowerCase())).map(([id,i,l])=>`<button class="command-result" data-page="${id}"><span>${i} ${l}</span><small>Open page</small></button>`);const teamRows=allTeams().filter(t=>q&&`${t.name} ${t.abbr}`.toLowerCase().includes(q.toLowerCase())).slice(0,8).map(t=>`<button class="command-result" data-command-team="${esc(t.abbr)}"><span>◈ ${esc(t.name)}</span><small>Open Team Hub</small></button>`);results.innerHTML=[...pageRows,...teamRows].join('');results.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{navigate(b.dataset.page);closePalette()});results.querySelectorAll('[data-command-team]').forEach(b=>b.onclick=()=>{openTeam(b.dataset.commandTeam);closePalette()})}
$('commandButton').onclick=openPalette;palette.onclick=e=>{if(e.target===palette)closePalette()};input.oninput=()=>renderCommands(input.value);$('closeGameDrawer').onclick=closeGame;$('gameDrawerBackdrop').onclick=e=>{if(e.target.id==='gameDrawerBackdrop')closeGame()};

document.addEventListener('click',event=>{
  const button=event.target?.closest?.('#customizeDashboard');
  if(!button)return;
  const builder=$('dashboardBuilder');
  if(!builder)return;
  event.preventDefault();
  const willOpen=builder.classList.contains('hidden');
  builder.classList.toggle('hidden');
  button.textContent=willOpen?'Hide widgets':'Customize widgets';
  button.setAttribute('aria-expanded',String(willOpen));
  if(willOpen)setTimeout(()=>builder.scrollIntoView({behavior:'smooth',block:'start'}),0);
});

document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette()}if(e.key==='Escape'){closePalette();closeGame()}});$('themeButton').onclick=()=>{settings.theme=settings.theme==='dark'?'light':'dark';applyTheme();saveSettings()};notificationHistory=load('onlybeats.notifications.v1',[]);$('notificationButton').onclick=()=>{const panel=$('notificationPanel');$('notificationList').innerHTML=notificationsPage();panel.classList.toggle('hidden')};$('closeNotifications').onclick=()=>$('notificationPanel').classList.add('hidden');$('closeFocus').onclick=closeFocus;$('focusBackdrop').onclick=e=>{if(e.target.id==='focusBackdrop')closeFocus()};setInterval(()=>{const c=$('clock');if(c)c.textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})},1000);
window.addEventListener('error',event=>{
  runtimeErrors.unshift({page:currentPage,message:String(event.message||'Unknown runtime error'),time:new Date().toISOString()});
  runtimeErrors=runtimeErrors.slice(0,20);
});
window.addEventListener('unhandledrejection',event=>{
  runtimeErrors.unshift({page:currentPage,message:String(event.reason?.message||event.reason||'Unhandled promise rejection'),time:new Date().toISOString()});
  runtimeErrors=runtimeErrors.slice(0,20);
});
applyTheme();
initializeReleaseCandidate();
initializeReleaseCandidateTwo();
initializeReleaseCandidateThree();
initializeReleaseCandidateFour();
initializeProductionRelease();
initializePerformancePolish();
initializeLiveAlertCenter();
initializeCommandCenterTwo();
initializeDesktopExperience();
initializeExperiencePolish();
initializeSmartInsights();
renderNav();
setTimeout(()=>runOnlyBeatsDiagnostics(),250);
setTimeout(()=>captureTimelineSnapshot('startup'),500);
renderPage();
scheduleRefresh();
const splash=$('splash');
const splashFailSafe=setTimeout(()=>splash?.classList.add('hide'),3500);
const startupMessages=['Loading production configuration…','Checking local storage…','Preparing GameDay services…','Running final health check…','OnlyBeats v1.0 is ready.'];
let startupIndex=0;
const startupTimer=setInterval(()=>{
  const el=$('splashStatus');
  if(el)el.textContent=startupMessages[startupIndex]||'Ready.';
  startupIndex++;
  if(startupIndex>=startupMessages.length){
    clearInterval(startupTimer);
    clearTimeout(splashFailSafe);
    setTimeout(()=>splash?.classList.add('hide'),300);
  }
},380);
syncScores(true);
