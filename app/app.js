const VERSION='0.9.3-m2.3';
const STORAGE_KEY='onlybeats.settings.v7';
const LEGACY_STORAGE_KEY='onlybeats.settings.v6';
const FAVORITES_KEY='onlybeats.favorites.v1';
const WALL_KEY='onlybeats.wall.v1';
const DASHBOARD_KEY='onlybeats.dashboard.v1';
const NOTES_KEY='onlybeats.notes.v1';
const PREDICTIONS_KEY='onlybeats.predictions.v1';
const FUTURES_KEY='onlybeats.futures.v1';
const FUTURES_LOCK_KEY='onlybeats.futures.lock.v1';
const SCORE_CACHE_KEY='onlybeats.scoreboard.cache.v1';
const AVAILABILITY_KEY='onlybeats.availability.v1';
const SCORE_REFRESH_TIMEOUT_MS=12000;
const defaultSettings={theme:'midnight',startPage:'dashboard',compact:false,sounds:false,animations:true,refresh:'30',favoriteTeam:'',scoreAlerts:true,favoriteAlerts:true,kickoffAlerts:true,weatherLocation:'',dashboardDensity:'comfortable',pushScoring:'full'};
const defaultWall={status:'all',favoritesOnly:false,top25Only:false,query:''};
const defaultDashboard=['featured','favorites','ranked','predictions','weather','alerts','notes'];
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
const pages=[['dashboard','⌂','Dashboard'],['wall','▦','Saturday Wall'],['schedule','◷','Schedule'],['favorites','★','Favorites'],['teams','◈','Team Hub'],['rankings','♛','Rankings'],['news','▤','News'],['weather','☁','Weather'],['availability','♙','Player Availability'],['predictions','✓','Prediction Center'],['reports','▥','Reports'],['developer','⌘','Developer Tools'],['settings','⚙','Settings']];

function load(k,d){try{const raw=localStorage.getItem(k);if(!raw)return Array.isArray(d)?[...d]:{...d};const parsed=JSON.parse(raw);return Array.isArray(d)?(Array.isArray(parsed)?parsed:[...d]):{...d,...parsed}}catch{return Array.isArray(d)?[...d]:{...d}}}
function loadSettings(){const current=localStorage.getItem(STORAGE_KEY);if(current)return load(STORAGE_KEY,defaultSettings);const legacy=localStorage.getItem(LEGACY_STORAGE_KEY);if(legacy){try{const migrated={...defaultSettings,...JSON.parse(legacy),startPage:'wall'};localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));return migrated}catch{}}return {...defaultSettings}}
function saveSettings(showToast=true){localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));const saved=$('lastSaved');if(saved)saved.textContent='Saved just now';if(showToast)toast('Preferences saved');scheduleRefresh()}
function saveFavorites(){localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites));renderPage()}
function saveWall(){localStorage.setItem(WALL_KEY,JSON.stringify(wallState))}
function $(id){return document.getElementById(id)}
function applyTheme(){const theme=settings.theme==='dark'?'midnight':settings.theme;document.documentElement.dataset.theme=theme;document.body.classList.toggle('compact-mode',Boolean(settings.compact));document.body.classList.toggle('reduce-motion',!settings.animations);document.body.dataset.density=settings.dashboardDensity||'comfortable'}
function toast(message,tone='default'){const e=$('toast');if(!e)return;e.textContent=message;e.dataset.tone=tone;e.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.add('hidden'),2600)}
function renderNav(){$('nav').innerHTML=pages.map(([id,i,l])=>`<button class="nav-button ${id===currentPage?'active':''}" data-page="${id}"><span class="nav-icon">${i}</span>${l}</button>`).join('');document.querySelectorAll('.nav-button').forEach(b=>b.onclick=()=>navigate(b.dataset.page))}
function closeTransientUi(){
  try{$('gameDrawerBackdrop')?.classList.add('hidden')}catch{}
  try{$('gameDrawer')?.classList.remove('open')}catch{}
  try{$('focusBackdrop')?.classList.add('hidden')}catch{}
  try{$('focusModal')?.classList.remove('open')}catch{}
  try{$('notificationPanel')?.classList.add('hidden')}catch{}
  try{$('commandPalette')?.classList.add('hidden')}catch{}
}
function navigate(page){
  if(!pages.some(p=>p[0]===page))return;
  closeTransientUi();
  currentPage=page;
  renderNav();
  renderPage();
}
function setHeading(title,eyebrow='ONLYBEATS COMMAND CENTER'){$('sectionTitle').textContent=title;$('sectionEyebrow').textContent=eyebrow}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function metric(label,value,sub){return `<div class="metric"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`}
function card(title,body,cls=''){return `<article class="card ${cls}"><div class="card-head"><h3>${title}</h3></div>${body}</article>`}
function empty(title,copy){return `<div class="empty-state"><div><strong>${title}</strong><p>${copy}</p></div></div>`}
function normalize(data){return (data.events||[]).map(e=>{const c=e.competitions?.[0]||{},comps=c.competitors||[],home=comps.find(x=>x.homeAway==='home')||comps[0]||{},away=comps.find(x=>x.homeAway==='away')||comps[1]||{},state=e.status?.type?.state||'pre';return {id:e.id,name:e.name||'',date:e.date,status:e.status?.type?.shortDetail||e.status?.type?.detail||'Scheduled',state,clock:e.status?.displayClock||'',period:e.status?.period||0,network:c.broadcasts?.[0]?.names?.[0]||'',venue:c.venue?.fullName||'',city:c.venue?.address?.city||'',stateCode:c.venue?.address?.state||'',neutral:Boolean(c.neutralSite),home:team(home),away:team(away)}})}
function team(c){return {id:c.team?.id||'',name:c.team?.displayName||'TBD',shortName:c.team?.shortDisplayName||c.team?.displayName||'TBD',abbr:c.team?.abbreviation||'',logo:c.team?.logo||'',color:c.team?.color||'',alternateColor:c.team?.alternateColor||'',score:Number(c.score||0),rank:c.curatedRank?.current&&c.curatedRank.current<99?c.curatedRank.current:null,record:c.records?.[0]?.summary||'',winner:Boolean(c.winner)}}
function updateProviderStatus(ok){const status=$('providerStatus'),dot=$('providerDot');if(status)status.textContent=ok?'Score provider online':'Score provider unavailable';if(dot)dot.className=ok?'status-dot':'status-dot error'}
function captureChanges(nextGames){const nextChanged=new Set();for(const g of nextGames){const before=previousScores.get(g.id);const current=`${g.away.score}-${g.home.score}-${g.state}-${g.period}-${g.clock}`;if(before&&before!==current){nextChanged.add(g.id);if(g.away.score+g.home.score>Number(before.split('-')[0])+Number(before.split('-')[1]))announceScoreChange(g)}previousScores.set(g.id,current)}changedGames=nextChanged;if(changedGames.size)setTimeout(()=>{changedGames.clear();document.querySelectorAll('.score-changed').forEach(e=>e.classList.remove('score-changed'))},4200)}
function announceScoreChange(g){const leader=g.away.score>g.home.score?g.away:g.home.score>g.away.score?g.home:null;const message=leader?`${leader.shortName} leads ${Math.max(g.away.score,g.home.score)}–${Math.min(g.away.score,g.home.score)}`:`${g.away.shortName} and ${g.home.shortName} are tied`;showAlert('SCORE UPDATE',message,g)}
function showAlert(title,message,g){if(!settings.scoreAlerts)return;notificationHistory.unshift({title,message,time:new Date().toISOString(),gameId:g?.id||''});notificationHistory=notificationHistory.slice(0,30);localStorage.setItem('onlybeats.notifications.v1',JSON.stringify(notificationHistory));const host=$('alertStack');if(!host)return;const item=document.createElement('button');item.className='game-alert';item.innerHTML=`<span>⚡</span><div><small>${esc(title)}</small><strong>${esc(message)}</strong></div>`;item.onclick=()=>{showGame(g.id);item.remove()};host.prepend(item);setTimeout(()=>item.remove(),6500)}
function withTimeout(promise,ms,label='Request'){
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timed out after ${Math.round(ms/1000)} seconds`)),ms))
  ]);
}
async function syncScores(silent=false){
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
    updateProviderStatus(true);
  }catch(e){
    if(requestId!==refreshRequestId)return;
    syncError=String(e?.message||e);
    updateProviderStatus(false);
    if(!silent)toast('Could not refresh live scores; cached scores remain available','error');
  }finally{
    if(requestId===refreshRequestId){
      loading=false;
      lastRefreshDuration=Math.round(performance.now()-started);
      if(['wall','dashboard','schedule','rankings','news','favorites','teams','developer'].includes(currentPage))renderPage();
      if(activeGameId&&games.some(g=>g.id===activeGameId))showGame(activeGameId,false);
    }
  }
}

async function runVisibleRefresh(buttonId, pendingLabel, idleLabel){
  const button=$(buttonId);
  if(loading){
    toast('A score refresh is already running');
    return;
  }
  if(button){
    button.disabled=true;
    button.textContent=pendingLabel;
    button.setAttribute('aria-busy','true');
  }
  try{
    await syncScores(false);
  }finally{
    const currentButton=$(buttonId);
    if(currentButton){
      currentButton.disabled=false;
      currentButton.textContent=idleLabel;
      currentButton.removeAttribute('aria-busy');
    }
  }
}
function refreshActionFor(target){
  const button=target?.closest?.('#refreshScores,#refreshIntelligence,#refreshNewsFeed,#refreshSchedule,#retrySchedule');
  if(!button)return null;
  if(button.id==='refreshIntelligence')return {buttonId:'refreshIntelligence',pending:'Refreshing intelligence…',idle:'Refresh intelligence'};
  if(button.id==='refreshNewsFeed')return {buttonId:'refreshNewsFeed',pending:'Refreshing feed…',idle:'Refresh feed'};
  if(button.id==='refreshSchedule'||button.id==='retrySchedule')return {buttonId:button.id,pending:'Refreshing schedule…',idle:button.id==='retrySchedule'?'Try again':'Refresh schedule'};
  return {buttonId:'refreshScores',pending:'Refreshing…',idle:'Refresh'};
}

function scheduleRefresh(){clearInterval(refreshTimer);const seconds=Number(settings.refresh||30);if(seconds>0)refreshTimer=setInterval(()=>syncScores(true),seconds*1000)}
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
function dashboard(){setHeading('Personal Command Center','YOUR CUSTOM GAMEDAY WORKSPACE');const live=games.filter(g=>g.state==='in'),up=games.filter(g=>g.state==='pre'),finals=games.filter(g=>g.state==='post');return `<div class="hero personal-hero"><div class="hero-copy"><p class="eyebrow">RELEASE 0.9 PREDICTION INTELLIGENCE</p><h2>Record your read. Measure your season.</h2><p>Build winner, spread, and total predictions with unlimited numeric confidence, automatic grading, a journal, and season analytics.</p><div class="button-row"><button class="button primary" id="customizeDashboard">Customize dashboard</button><button class="button" data-open-wall>Open Saturday Wall</button></div></div><img src="assets/onlybeats-icon.png" alt="OnlyBeats logo"></div><div class="metric-grid">${metric('Live Games',live.length,lastSync?'Updated '+lastSync.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Not synced')}${metric('Upcoming',up.length,'Current slate')}${metric('Final',finals.length,'Current slate')}${metric('Favorites',favorites.length,'Pinned locally')}</div><section id="dashboardBuilder" class="dashboard-builder hidden"><div><strong>Dashboard widgets</strong><p class="muted">Drag cards to reorder or use the arrows. Changes save locally.</p></div><div class="widget-controls">${defaultDashboard.map(id=>`<button class="button ${dashboardLayout.includes(id)?'primary':''}" data-toggle-widget="${id}">${dashboardLayout.includes(id)?'✓ ':''}${id[0].toUpperCase()+id.slice(1)}</button>`).join('')}<button class="button" id="resetDashboard">Reset layout</button></div></section><div id="personalDashboard" class="dashboard-grid personal-dashboard">${dashboardLayout.map(dashboardWidget).join('')}</div>`}
function wallPage(){setHeading('Saturday Wall','GAME-DAY MISSION CONTROL');const list=filteredWallGames();return `<section class="wall-summary"><div><p class="eyebrow">LIVE BOARD</p><h2>${games.filter(g=>g.state==='in').length} live · ${games.filter(g=>g.state==='pre').length} upcoming · ${games.filter(g=>g.state==='post').length} final</h2></div><div class="sync-chip ${syncError?'error':''}"><i class="status-dot ${syncError?'error':''}"></i>${syncError?'Provider unavailable':lastSync?`Updated ${lastSync.toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'})}`:'Waiting for first sync'}</div></section>${wallToolbar()}${syncError?errorBox():''}<div class="wall-grid">${loading&&!games.length?empty('Loading Saturday Wall…','The first scoreboard request can take a few seconds.'):list.map(gameCard).join('')||empty('No games match these filters','Clear one or more filters or search for another team.')}</div>`}
function favoritesPage(){setHeading('Favorites','YOUR TEAMS');const related=sortGames(games.filter(isFavoriteGame));return `<div class="card"><h3>Favorite teams</h3><p class="muted">Favorites are stored locally and automatically pinned on Saturday Wall.</p><div class="favorite-list">${favorites.map(x=>`<button class="favorite-chip removable" data-remove="${esc(x)}">★ ${esc(x)} ×</button>`).join('')||'<span class="muted">No teams saved yet.</span>'}</div></div><div class="wall-grid favorites-wall">${related.map(gameCard).join('')||empty('No favorite-team games on this slate','Add favorites from any game details drawer.')}</div>`}
function errorBox(){return `<div class="error-box"><strong>Live scores unavailable</strong><p>${esc(syncError)}</p><button class="button" onclick="syncScores()">Try again</button></div>`}
function healthPanel(){return `<div class="health-list"><div><span><i id="providerDot" class="status-dot ${syncError?'error':''}"></i><span id="providerStatus">${syncError?'Score provider unavailable':'Score provider online'}</span></span><strong>${lastSync?'Synced':'Ready'}</strong></div><div><span><i class="status-dot"></i>Local settings</span><strong>Ready</strong></div><div><span><i class="status-dot"></i>SQLite schema</span><strong>1</strong></div><div><span><i class="status-dot"></i>Build</span><strong>${VERSION}</strong></div></div>`}
function developerPage(){setHeading('Developer Tools','DIAGNOSTICS');const teams=allTeams(),d=window.OnlyBeatsDataPlatform?window.OnlyBeatsDataPlatform.diagnostics(teams,games):{teamCount:teams.length,gameCount:games.length,enrichedCount:0,conferenceCount:0,stadiumCount:0,timezoneCount:0};return `<div class="settings-layout">${card('System Health',healthPanel())}${card('Data Platform',`<div class="detail-list"><div><span>Teams indexed</span><strong>${d.teamCount}</strong></div><div><span>Teams enriched</span><strong>${d.enrichedCount}</strong></div><div><span>Conferences represented</span><strong>${d.conferenceCount}</strong></div><div><span>Stadiums resolved</span><strong>${d.stadiumCount}</strong></div><div><span>Timezones represented</span><strong>${d.timezoneCount}</strong></div><div><span>Platform schema</span><strong>${window.OnlyBeatsDataPlatform?.version||'Unavailable'}</strong></div></div>`)}${card('Sync Information',`<div class="detail-list"><div><span>Last refresh attempt</span><strong>${lastRefreshAttempt?lastRefreshAttempt.toLocaleString():'Not yet'}</strong></div><div><span>Last successful sync</span><strong>${lastSync?lastSync.toLocaleString():'Not yet'}</strong></div><div><span>Last request duration</span><strong>${lastRefreshDuration===null?'—':lastRefreshDuration+' ms'}</strong></div><div><span>Last provider error</span><strong>${esc(syncError||'None')}</strong></div><div><span>Runtime errors</span><strong>${runtimeErrors.length}</strong></div><div><span>Games cached</span><strong>${games.length}</strong></div><div><span>Live games</span><strong>${games.filter(g=>g.state==='in').length}</strong></div><div><span>Refresh interval</span><strong>${settings.refresh==='0'?'Off':settings.refresh+' seconds'}</strong></div><div><span>Runtime</span><strong>${window.__TAURI__?'Tauri desktop':'Browser preview'}</strong></div></div>`)}${card('Troubleshooting',`<p class="muted">Run the provider test first. If it remains offline, confirm internet access and review TROUBLESHOOTING.md.</p><button class="button primary" onclick="syncScores()">Run provider test</button>`)}${card('Version',`<div class="detail-list"><div><span>Application</span><strong>${VERSION}</strong></div><div><span>Database schema</span><strong>1</strong></div><div><span>Score provider</span><strong>ESPN scoreboard</strong></div><div><span>Data platform</span><strong>Shared metadata v1</strong></div><div><span>Weather provider</span><strong>Open-Meteo</strong></div><div><span>Game predictions</span><strong>${predictions.length}</strong></div><div><span>Futures stored</span><strong>${futures.length}</strong></div></div>`)}</div>`}

function allTeams(){const map=new Map();for(const g of games){for(const t of [g.away,g.home]){if(t.abbr&&!map.has(t.abbr))map.set(t.abbr,{...t,games:[]});map.get(t.abbr)?.games.push(g)}}return [...map.values()].map(t=>window.OnlyBeatsDataPlatform?window.OnlyBeatsDataPlatform.enrichTeam(t,t.games):t).sort((a,b)=>a.name.localeCompare(b.name))}
function selectedTeam(){const teams=allTeams();return teams.find(t=>t.abbr===activeTeamAbbr)||teams.find(t=>favorites.includes(t.abbr))||teams[0]||null}
function openTeam(abbr){activeTeamAbbr=abbr||'';teamTab='overview';currentPage='teams';renderNav();renderPage();closeGame()}
function teamRecordSnapshot(team){
  const related=games.filter(g=>g.home.abbr===team.abbr||g.away.abbr===team.abbr);
  let wins=0,losses=0,pending=0,pf=0,pa=0,finals=0,homeGames=0,awayGames=0;
  for(const g of related){
    const own=g.home.abbr===team.abbr?g.home:g.away;
    const opp=g.home.abbr===team.abbr?g.away:g.home;
    if(g.home.abbr===team.abbr)homeGames++;else awayGames++;
    if(g.state==='post'){
      finals++;pf+=own.score;pa+=opp.score;
      if(own.score>opp.score)wins++;
      else if(own.score<opp.score)losses++;
    }else pending++;
  }
  return {related,wins,losses,pending,pf,pa,finals,homeGames,awayGames,margin:finals?(pf-pa)/finals:0};
}
function teamRecentForm(team){
  return teamRecordSnapshot(team).related
    .filter(g=>g.state==='post')
    .sort((a,b)=>new Date(b.date)-new Date(a.date))
    .slice(0,5)
    .map(g=>{
      const own=g.home.abbr===team.abbr?g.home:g.away;
      const opp=g.home.abbr===team.abbr?g.away:g.home;
      const result=own.score>opp.score?'W':own.score<opp.score?'L':'T';
      return {game:g,own,opp,result,margin:own.score-opp.score};
    });
}
function teamTrend(team){
  const recent=teamRecentForm(team);
  if(!recent.length)return {label:'No recent finals',icon:'—',tone:'neutral'};
  const wins=recent.filter(x=>x.result==='W').length;
  if(wins===recent.length)return {label:`Won ${wins} straight`,icon:'🔥',tone:'positive'};
  if(wins>=Math.ceil(recent.length*.7))return {label:`${wins}-${recent.length-wins} recent form`,icon:'↗',tone:'positive'};
  if(wins<=Math.floor(recent.length*.3))return {label:`${wins}-${recent.length-wins} recent form`,icon:'↘',tone:'negative'};
  return {label:`${wins}-${recent.length-wins} recent form`,icon:'→',tone:'neutral'};
}
function teamPredictionSnapshot(team){
  const rows=predictions
    .map(p=>({prediction:p,game:predictionGame(p),result:predictionResult(p)}))
    .filter(x=>x.game&&(x.game.home.abbr===team.abbr||x.game.away.abbr===team.abbr));
  const graded=rows.filter(x=>['correct','incorrect','push'].includes(x.result.status));
  const decisions=graded.filter(x=>x.result.status!=='push');
  const correct=decisions.filter(x=>x.result.status==='correct').length;
  const score=graded.reduce((sum,x)=>sum+(Number(x.result.score)||0),0);
  return {rows,graded,decisions,correct,score,accuracy:decisions.length?correct/decisions.length*100:0};
}
function teamAvailabilitySnapshot(team){
  const entries=availabilityEntries.filter(x=>x.team===team.abbr);
  const concerning=entries.filter(x=>['Questionable','Doubtful','Unavailable','Unknown'].includes(x.status));
  const unavailable=entries.filter(x=>x.status==='Unavailable');
  return {entries,concerning,unavailable};
}
function teamDirectoryCard(t){
  const snap=teamRecordSnapshot(t),trend=teamTrend(t);
  return `<button class="team-directory-card ${favorites.includes(t.abbr)?'favorite-team':''}" data-team="${esc(t.abbr)}">
    ${logo(t)}
    <div>
      <strong>${t.rank?`#${t.rank} `:''}${esc(t.name)}</strong>
      <span>${esc(t.record||`${snap.wins}-${snap.losses}`)} · ${esc(t.conference||'FBS')}</span>
      <small>${trend.icon} ${esc(trend.label)}</small>
    </div>
    <span class="team-card-arrow">›</span>
  </button>`;
}
function teamHero(team){
  const fav=favorites.includes(team.abbr),snap=teamRecordSnapshot(team),trend=teamTrend(team);
  return `<section class="team-hero" style="--team-primary:${esc(team.primaryColor||'#d4a72c')};--team-alt:${esc(team.alternateColor||'#fff')}">
    ${logo(team)}
    <div class="team-hero-copy">
      <p class="eyebrow">TEAM INTELLIGENCE · ${esc(team.conference||'FBS')}</p>
      <h2>${team.rank?`<small>#${team.rank}</small> `:''}${esc(team.name)}</h2>
      <p>${esc(team.record||`${snap.wins}-${snap.losses}`)} · ${esc(team.stadium||'Stadium not loaded')} · ${esc(team.timezone||'Local time')}</p>
      <span class="provider-badge">${trend.icon} ${esc(trend.label)}</span>
    </div>
    <button class="button ${fav?'primary':''}" id="teamFavoriteButton">${fav?'★ Favorite':'☆ Add favorite'}</button>
  </section>`;
}
function teamTabs(){
  return `<div class="team-tabs">${[['overview','Overview'],['schedule','Schedule'],['stats','Stats'],['roster','Roster']].map(([id,l])=>`<button class="${teamTab===id?'active':''}" data-team-tab="${id}">${l}</button>`).join('')}</div>`;
}
function teamOverview(team){
  const snap=teamRecordSnapshot(team);
  const next=sortGames(snap.related.filter(g=>g.state!=='post'))[0];
  const recent=teamRecentForm(team);
  const last=recent[0];
  const prediction=teamPredictionSnapshot(team);
  const availability=teamAvailabilitySnapshot(team);
  const avgFor=snap.finals?(snap.pf/snap.finals).toFixed(1):'—';
  const avgAgainst=snap.finals?(snap.pa/snap.finals).toFixed(1):'—';
  const form=recent.length?`<div class="favorite-list">${recent.map(x=>`<button class="favorite-chip ${x.result==='W'?'active':''}" data-game="${x.game.id}" title="${esc(x.opp.name)}">${x.result} · ${esc(x.opp.abbr)}</button>`).join('')}</div>`:empty('No recent finals','Recent results from the loaded scoreboard appear here.');
  return `<div class="metric-grid">
    ${metric('Record',team.record||`${snap.wins}-${snap.losses}`,`${snap.finals} final shown`)}
    ${metric('National Rank',team.rank?`#${team.rank}`:'Unranked','Scoreboard ranking')}
    ${metric('Points / Game',avgFor,'Loaded finals')}
    ${metric('Allowed / Game',avgAgainst,'Loaded finals')}
  </div>
  <div class="team-content-grid">
    ${card('Next Game',next?`<button class="hub-game-link" data-game="${next.id}"><strong>${esc(next.away.abbr)} at ${esc(next.home.abbr)}</strong><span>${esc(kickoffText(next))}</span><small>${esc([next.network,next.venue].filter(Boolean).join(' · ')||'Details available')}</small></button>`:empty('No upcoming game found','Refresh when the next slate is available.'))}
    ${card('Recent Form',form)}
    ${card('Your Prediction Performance',prediction.rows.length?`<div class="team-stat-grid"><div><span>Predictions</span><strong>${prediction.rows.length}</strong></div><div><span>Graded</span><strong>${prediction.graded.length}</strong></div><div><span>Accuracy</span><strong>${prediction.accuracy.toFixed(1)}%</strong></div><div><span>Score</span><strong>${formatNumber(prediction.score)}</strong></div></div><button class="button" data-page-jump="predictions">Open Prediction Center</button>`:empty('No predictions involving this team','Create a prediction from a game details drawer.'))}
    ${card('Player Availability',`<div class="team-stat-grid"><div><span>Saved notes</span><strong>${availability.entries.length}</strong></div><div><span>Needs attention</span><strong>${availability.concerning.length}</strong></div><div><span>Unavailable</span><strong>${availability.unavailable.length}</strong></div><div><span>Feed</span><strong>Manual</strong></div></div><button class="button" data-page-jump="availability">Open Availability</button>`)}
    ${card('Latest Result',last?`<button class="hub-game-link" data-game="${last.game.id}"><strong>${last.result} vs ${esc(last.opp.shortName)}</strong><span>${last.own.score}-${last.opp.score} · Margin ${last.margin>0?'+':''}${last.margin}</span><small>${esc(last.game.status)}</small></button>`:empty('No final result found','Final games from the loaded slate appear here.'))}
    ${card('Team Profile',`<div class="team-stat-grid"><div><span>Conference</span><strong>${esc(team.conference||'FBS')}</strong></div><div><span>Stadium</span><strong>${esc(team.stadium||'Not loaded')}</strong></div><div><span>Location</span><strong>${esc([team.city,team.stateCode].filter(Boolean).join(', ')||'Not loaded')}</strong></div><div><span>Timezone</span><strong>${esc(team.timezone||'Local')}</strong></div><div><span>Home games</span><strong>${snap.homeGames}</strong></div><div><span>Away games</span><strong>${snap.awayGames}</strong></div><div><span>Slate games</span><strong>${snap.related.length}</strong></div><div><span>Source</span><strong>${esc(team.metadataSource||'Live scoreboard')}</strong></div></div><div class="team-color-strip"><span style="background:${esc(team.primaryColor||'#d4a72c')}"></span><span style="background:${esc(team.alternateColor||'#fff')}"></span></div>`,'wide')}
  </div>`;
}
function teamSchedule(team){
  const related=sortGames(teamRecordSnapshot(team).related);
  return `<div class="team-schedule-list">${related.map(g=>{
    const own=g.home.abbr===team.abbr?g.home:g.away;
    const opp=g.home.abbr===team.abbr?g.away:g.home;
    const site=g.home.abbr===team.abbr?'vs':'at';
    return `<button class="team-schedule-row" data-game="${g.id}"><span class="status-badge state-${g.state}">${statusLabel(g.state)}</span>${logo(opp)}<div><strong>${site} ${opp.rank?`#${opp.rank} `:''}${esc(opp.name)}</strong><small>${new Date(g.date).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}${g.network?` · ${esc(g.network)}`:''}</small></div><b>${g.state==='pre'?esc(g.venue||'TBD'):`${own.score}-${opp.score}`}</b></button>`;
  }).join('')||empty('No schedule data yet','Refresh scores to load teams from the current slate.')}</div>`;
}
function teamStats(team){
  const s=teamRecordSnapshot(team);
  const avgFor=s.finals?s.pf/s.finals:0,avgAgainst=s.finals?s.pa/s.finals:0;
  const prediction=teamPredictionSnapshot(team),recent=teamRecentForm(team);
  return `<div class="team-content-grid">
    ${card('Loaded-Slate Performance',`<div class="team-stat-grid"><div><span>Wins shown</span><strong>${s.wins}</strong></div><div><span>Losses shown</span><strong>${s.losses}</strong></div><div><span>Points/game</span><strong>${s.finals?avgFor.toFixed(1):'—'}</strong></div><div><span>Allowed/game</span><strong>${s.finals?avgAgainst.toFixed(1):'—'}</strong></div><div><span>Scoring margin</span><strong>${s.finals?`${s.margin>=0?'+':''}${s.margin.toFixed(1)}`:'—'}</strong></div><div><span>Finals analyzed</span><strong>${s.finals}</strong></div></div>`,'wide')}
    ${card('Recent Results',recent.length?`<div class="intel-list">${recent.map(x=>`<button class="intel-row" data-game="${x.game.id}"><span class="intel-icon">${x.result}</span><div><strong>${x.result} ${x.own.score}-${x.opp.score} vs ${esc(x.opp.shortName)}</strong><small>${new Date(x.game.date).toLocaleDateString()} · Margin ${x.margin>0?'+':''}${x.margin}</small></div><b>›</b></button>`).join('')}</div>`:empty('No recent finals','Refresh during the season to populate results.'),'wide')}
    ${card('Prediction Intelligence',`<div class="team-stat-grid"><div><span>Entries</span><strong>${prediction.rows.length}</strong></div><div><span>Correct</span><strong>${prediction.correct}</strong></div><div><span>Accuracy</span><strong>${prediction.accuracy.toFixed(1)}%</strong></div><div><span>Earned score</span><strong>${formatNumber(prediction.score)}</strong></div></div>`)}
    ${card('Coverage Note',`<p class="muted">Team statistics are calculated only from final games currently present in the live or cached scoreboard. Full-season offense, defense, standings, and strength-of-schedule data require a dedicated provider.</p>`)}
  </div>`;
}
function teamRoster(team){
  const availability=teamAvailabilitySnapshot(team);
  return `<div class="team-content-grid">
    ${card('Availability Notes',availability.entries.length?`<div class="intel-list">${availability.entries.map(x=>`<div class="intel-row"><span class="intel-icon">♙</span><div><strong>${esc(x.player)}</strong><small>${esc(x.status)}${x.notes?` · ${esc(x.notes)}`:''}</small></div></div>`).join('')}</div><button class="button" data-page-jump="availability">Manage notes</button>`:empty('No availability notes','Add manual notes in Player Availability.'))}
    ${card(`${esc(team.shortName)} Roster Integration`,`<div class="roster-icon">◈</div><p class="muted">The Team Hub is ready for player name, position, class, number, height, weight, and hometown data. No roster entries are shown until a reliable licensed or official provider is connected.</p><div class="coverage-list"><span><i class="status-dot"></i>Manual availability notes connected</span><span><i class="status-dot"></i>Provider adapter documented</span><span><i class="status-dot pending"></i>Live roster data not connected</span></div>`,'wide')}
  </div>`;
}
function teamHubPage(){
  setHeading('Team Intelligence','TEAM PROFILES · TRENDS · PERSONAL INSIGHTS');
  const teams=allTeams();
  const conferences=[...new Set(teams.map(t=>t.conference).filter(Boolean))].sort();
  const q=teamQuery.toLowerCase().trim();
  const visible=teams.filter(t=>{
    if(teamConferenceFilter!=='all'&&t.conference!==teamConferenceFilter)return false;
    if(teamFavoritesOnly&&!favorites.includes(t.abbr))return false;
    if(q&&!`${t.name} ${t.shortName} ${t.abbr} ${t.conference||''}`.toLowerCase().includes(q))return false;
    return true;
  });
  const team=selectedTeam();
  if(!team)return `<section class="wall-summary"><div><p class="eyebrow">TEAM DIRECTORY</p><h2>Load the live scoreboard to discover teams.</h2></div><button class="button primary" id="refreshScores">Refresh teams</button></section>${syncError?errorBox():empty('No teams loaded yet','Team Intelligence builds its directory from the current scoreboard.')}`;
  if(!activeTeamAbbr)activeTeamAbbr=team.abbr;
  const body=teamTab==='schedule'?teamSchedule(team):teamTab==='stats'?teamStats(team):teamTab==='roster'?teamRoster(team):teamOverview(team);
  return `<div class="team-hub-layout">
    <aside class="team-directory">
      <div class="team-directory-head">
        <div><p class="eyebrow">TEAM DIRECTORY</p><strong>${visible.length} of ${teams.length} teams</strong></div>
        <input id="teamSearch" value="${esc(teamQuery)}" placeholder="Search teams or conferences…">
        <select id="teamConferenceFilter"><option value="all">All conferences</option>${conferences.map(c=>`<option value="${esc(c)}" ${teamConferenceFilter===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
        <div class="button-row"><button class="filter-button ${teamFavoritesOnly?'active':''}" id="teamFavoritesFilter">★ Favorites</button><button class="button" id="clearTeamFilters">Clear</button></div>
      </div>
      <div class="team-directory-list">${visible.map(teamDirectoryCard).join('')||empty('No matching teams','Change the search, conference, or favorites filter.')}</div>
    </aside>
    <section class="team-profile">${teamHero(team)}${teamTabs()}<div class="team-tab-body">${body}</div></section>
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
function openFocus(id){const g=games.find(x=>x.id===id);if(!g)return;focusedGameId=id;$('focusBody').innerHTML=`<div class="focus-header"><p class="eyebrow">GAME FOCUS MODE</p><h2>${esc(g.away.shortName)} at ${esc(g.home.shortName)}</h2><p>${esc(g.status)}${g.network?` · ${esc(g.network)}`:''}</p></div><div class="focus-score">${teamLine(g.away)}${teamLine(g.home)}</div><div class="focus-meta"><span>${esc(g.venue||'Venue TBD')}</span><span>${new Date(g.date).toLocaleString()}</span></div><div class="button-row"><button class="button primary" data-game="${g.id}">Open details</button><button class="button" id="focusWeather">Load venue weather</button></div>`;$('focusBackdrop').classList.remove('hidden');if($('focusWeather'))$('focusWeather').onclick=()=>{settings.weatherLocation=[g.city,g.stateCode].filter(Boolean).join(', ');closeFocus();navigate('weather');fetchWeather(settings.weatherLocation)};$('focusBody').querySelector('[data-game]').onclick=()=>{closeFocus();showGame(g.id)}}
function closeFocus(){focusedGameId=null;$('focusBackdrop').classList.add('hidden')}
function notificationsPage(){const items=notificationHistory.length?notificationHistory.map(n=>`<button class="intel-row" data-alert-game="${esc(n.gameId)}"><span class="intel-icon">⚡</span><div><strong>${esc(n.title)}</strong><small>${esc(n.message)} · ${new Date(n.time).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</small></div></button>`).join(''):empty('No GameDay alerts yet','Score changes and favorite-team activity will appear here while the app is open.');return `<div class="notification-history">${items}</div>`}


function saveDashboard(){localStorage.setItem(DASHBOARD_KEY,JSON.stringify(dashboardLayout));toast('Dashboard layout saved')}
function moveWidget(id,direction){const i=dashboardLayout.indexOf(id),j=i+direction;if(i<0||j<0||j>=dashboardLayout.length)return;[dashboardLayout[i],dashboardLayout[j]]=[dashboardLayout[j],dashboardLayout[i]];saveDashboard();renderPage()}
function bindPersonalization(){
  if($('customizeDashboard'))$('customizeDashboard').onclick=()=>$('dashboardBuilder').classList.toggle('hidden');
  document.querySelectorAll('[data-toggle-widget]').forEach(b=>b.onclick=()=>{const id=b.dataset.toggleWidget;dashboardLayout=dashboardLayout.includes(id)?dashboardLayout.filter(x=>x!==id):[...dashboardLayout,id];saveDashboard();renderPage()});
  if($('resetDashboard'))$('resetDashboard').onclick=()=>{dashboardLayout=[...defaultDashboard];saveDashboard();renderPage()};
  if($('quickNotes'))$('quickNotes').oninput=e=>{quickNotes=e.target.value;localStorage.setItem(NOTES_KEY,quickNotes);const saved=$('lastSaved');if(saved)saved.textContent='Notes saved just now'};
  document.querySelectorAll('[data-page-jump]').forEach(b=>b.onclick=()=>navigate(b.dataset.pageJump));
  const moveWidget=(id,direction)=>{const from=dashboardLayout.indexOf(id);if(from<0)return;const to=direction==='up'?from-1:from+1;if(to<0||to>=dashboardLayout.length)return;[dashboardLayout[from],dashboardLayout[to]]=[dashboardLayout[to],dashboardLayout[from]];saveDashboard();renderPage();toast('Dashboard order saved')};
  document.querySelectorAll('[data-move-widget]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();moveWidget(b.dataset.moveWidget,b.dataset.direction)});
  const host=$('personalDashboard');if(host){let dragged='';host.querySelectorAll('[data-widget]').forEach(w=>{w.ondragstart=e=>{dragged=w.dataset.widget;w.classList.add('dragging');if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragged)}};w.ondragend=()=>{dragged='';w.classList.remove('dragging');host.querySelectorAll('[data-widget]').forEach(x=>x.classList.remove('drag-over'))};w.ondragenter=e=>{e.preventDefault();if(dragged&&dragged!==w.dataset.widget)w.classList.add('drag-over')};w.ondragleave=()=>w.classList.remove('drag-over');w.ondragover=e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move'};w.ondrop=e=>{e.preventDefault();w.classList.remove('drag-over');const source=dragged||(e.dataTransfer?e.dataTransfer.getData('text/plain'):'');const target=w.dataset.widget;if(!source||source===target)return;const from=dashboardLayout.indexOf(source),to=dashboardLayout.indexOf(target);if(from<0||to<0)return;dashboardLayout.splice(from,1);dashboardLayout.splice(to,0,source);saveDashboard();renderPage();toast('Dashboard order saved')}})}
}

function startOfLocalDay(value=new Date()){
  const d=new Date(value);
  d.setHours(0,0,0,0);
  return d;
}
function scheduleRangeMatch(game){
  if(scheduleRange==='all')return true;
  const gameDate=new Date(game.date);
  const today=startOfLocalDay();
  const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  if(scheduleRange==='today')return gameDate>=today&&gameDate<tomorrow;
  if(scheduleRange==='week'){
    const weekEnd=new Date(today);weekEnd.setDate(weekEnd.getDate()+7);
    return gameDate>=today&&gameDate<weekEnd;
  }
  return true;
}
function scheduleFilteredGames(){
  const q=scheduleQuery.trim().toLowerCase();
  return sortGames(games.filter(g=>{
    if(scheduleFilter!=='all'&&g.state!==scheduleFilter)return false;
    if(!scheduleRangeMatch(g))return false;
    if(scheduleFavoritesOnly&&!isFavoriteGame(g))return false;
    if(scheduleTop25Only&&!isTop25(g))return false;
    if(q&&!`${g.name} ${g.home.name} ${g.away.name} ${g.home.abbr} ${g.away.abbr} ${g.network} ${g.venue}`.toLowerCase().includes(q))return false;
    return true;
  }));
}
function scheduleDateLabel(dateValue){
  const d=new Date(dateValue),today=startOfLocalDay(),tomorrow=new Date(today);
  tomorrow.setDate(tomorrow.getDate()+1);
  const day=startOfLocalDay(d);
  if(day.getTime()===today.getTime())return 'Today';
  if(day.getTime()===tomorrow.getTime())return 'Tomorrow';
  return d.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});
}
function scheduleGameRow(g){
  const favorite=isFavoriteGame(g),ranked=isTop25(g);
  const kickoff=new Date(g.date).toLocaleString([],{hour:'numeric',minute:'2-digit'});
  const result=g.state==='pre'
    ? esc(g.network||'Network TBD')
    : `${g.away.score}-${g.home.score}`;
  return `<button class="team-schedule-row ${favorite?'favorite-team':''}" data-game="${g.id}">
    <span class="status-badge state-${g.state}">${statusLabel(g.state)}</span>
    <div class="schedule-logos">${logo(g.away)}${logo(g.home)}</div>
    <div>
      <strong>${g.away.rank?`#${g.away.rank} `:''}${esc(g.away.shortName)} at ${g.home.rank?`#${g.home.rank} `:''}${esc(g.home.shortName)}</strong>
      <small>${kickoff}${g.network?` · ${esc(g.network)}`:''}${g.venue?` · ${esc(g.venue)}`:''}</small>
    </div>
    <b>${result}</b>
    <span class="favorite-mark">${favorite?'★':ranked?'TOP 25':''}</span>
  </button>`;
}
function schedulePage(){
  setHeading('Schedule Center','PLAN THE WEEK · FOLLOW EVERY KICKOFF');
  const statusTabs=[['all','All'],['pre','Upcoming'],['in','Live'],['post','Final']];
  const rangeTabs=[['all','All Dates'],['today','Today'],['week','Next 7 Days']];
  const filtered=scheduleFilteredGames();
  const groups=new Map();
  for(const game of filtered){
    const key=startOfLocalDay(game.date).toISOString();
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(game);
  }
  const grouped=[...groups.entries()].sort((a,b)=>new Date(a[0])-new Date(b[0])).map(([date,list])=>`
    <section class="schedule-day-group">
      <div class="card-head"><h3>${scheduleDateLabel(date)}</h3><span>${list.length} game${list.length===1?'':'s'}</span></div>
      <div class="team-schedule-list">${list.map(scheduleGameRow).join('')}</div>
    </section>`).join('');
  const updated=lastSync?`Updated ${lastSync.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`:'Using cached data';
  return `<section class="intel-hero">
    <div><p class="eyebrow">SCHEDULE CENTER</p><h2>Plan today, this week, or the full loaded slate.</h2><p>Kickoff times display in your computer's local timezone. Select any game for details, weather, teams, and predictions.</p></div>
    <button class="button primary" id="refreshSchedule" ${loading?'disabled aria-busy="true"':''}>${loading?'Refreshing schedule…':'Refresh schedule'}</button>
  </section>
  <div class="metric-grid">
    ${metric('All Games',games.length,updated)}
    ${metric('Today',games.filter(g=>scheduleRangeMatchFor(g,'today')).length,'Local date')}
    ${metric('Top 25',games.filter(isTop25).length,'Loaded slate')}
    ${metric('Favorites',games.filter(isFavoriteGame).length,'Personalized')}
  </div>
  ${syncError?`<div class="provider-notice"><div><strong>Live refresh unavailable</strong><p class="muted">Showing cached schedule data. ${esc(syncError)}</p></div><button class="button" id="retrySchedule">Try again</button></div>`:''}
  <div class="wall-toolbar schedule-toolbar">
    <div class="wall-status-tabs">${statusTabs.map(([id,label])=>`<button class="filter-button ${scheduleFilter===id?'active':''}" data-schedule-filter="${id}">${label}<span>${id==='all'?games.length:games.filter(g=>g.state===id).length}</span></button>`).join('')}</div>
    <div class="wall-status-tabs">${rangeTabs.map(([id,label])=>`<button class="filter-button ${scheduleRange===id?'active':''}" data-schedule-range="${id}">${label}</button>`).join('')}</div>
    <div class="wall-tools">
      <button class="filter-button ${scheduleFavoritesOnly?'active':''}" id="scheduleFavoritesFilter">★ Favorites</button>
      <button class="filter-button ${scheduleTop25Only?'active':''}" id="scheduleTop25Filter">Top 25</button>
      <input id="scheduleSearch" value="${esc(scheduleQuery)}" placeholder="Search team, network, or venue…">
      <button class="button" id="clearScheduleFilters">Clear</button>
    </div>
  </div>
  <div class="schedule-groups">${grouped||empty('No games match these filters','Clear one or more filters or refresh the schedule.')}</div>`;
}
function scheduleRangeMatchFor(game,range){
  const previous=scheduleRange;
  scheduleRange=range;
  const result=scheduleRangeMatch(game);
  scheduleRange=previous;
  return result;
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
function settingsPage(){setHeading('Settings','PERSONAL COMMAND CENTER');return `<div class="settings-layout"><section class="card settings-card"><h3>Appearance</h3><div class="field"><label>Theme</label><select id="themeSelect"><option value="midnight">Midnight Gold</option><option value="stadium">Stadium Green</option><option value="ice">Ice Blue</option><option value="classic">Classic Charcoal</option><option value="light">Light</option></select></div><div class="field"><label>Dashboard density</label><select id="densitySelect"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div>${toggle('compactToggle','Compact game cards',settings.compact)}${toggle('animationToggle','Interface animations',settings.animations)}</section><section class="card settings-card"><h3>GameDay alerts</h3>${toggle('scoreAlertsToggle','Score-change alerts',settings.scoreAlerts)}${toggle('favoriteAlertsToggle','Favorite-team alerts',settings.favoriteAlerts)}${toggle('kickoffAlertsToggle','Kickoff reminders',settings.kickoffAlerts)}</section><section class="card settings-card"><h3>Live scores</h3><div class="field"><label>Automatic refresh</label><select id="refreshSelect"><option value="15">15 seconds</option><option value="30">30 seconds</option><option value="60">60 seconds</option><option value="0">Off</option></select></div><button class="button primary" id="testProvider">Test live-score provider</button></section><section class="card settings-card"><h3>Startup</h3><div class="field"><label>Start page</label><select id="startPageSelect">${pages.map(([id,,l])=>`<option value="${id}">${l}</option>`).join('')}</select></div><p class="muted">Your selected page opens automatically next time.</p></section><section class="card settings-card"><h3>Dashboard</h3><p class="muted">Restore the standard seven-widget Personal Command Center layout.</p><button class="button" id="settingsResetDashboard">Reset dashboard layout</button></section><section class="card settings-card"><h3>Prediction scoring</h3><div class="field"><label>Push score</label><select id="pushScoringSelect"><option value="full">Full confidence</option><option value="half">Half confidence</option><option value="zero">Zero</option></select></div><p class="muted">Correct predictions always earn the exact confidence entered.</p></section><section class="card settings-card"><h3>Data & recovery</h3><div class="button-row"><button id="exportButton" class="button primary">Export settings</button><button id="resetButton" class="button danger">Reset all local data</button></div><p class="muted">App ${VERSION} · Database schema 1</p></section></div>`}

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
function predictionsPage(){setHeading('Prediction Center','YOUR COLLEGE FOOTBALL ANALYTICS JOURNAL');const c=combinedAnalytics(),a=c.games,fa=c.futures;const gameRows=a.rows.filter(x=>predictionFilter==='all'||x.result.status===predictionFilter).sort((x,y)=>new Date(y.createdAt)-new Date(x.createdAt));const futureRows=fa.rows.filter(x=>futureFilter==='all'||x.result.status===futureFilter).sort((x,y)=>new Date(y.createdAt)-new Date(x.createdAt));return `<section class="prediction-hero"><div><p class="eyebrow">PREDICTION INTELLIGENCE</p><h2>Your confidence. Your score. Your season.</h2><p>Game predictions and season-long futures share one non-financial confidence scoring system.</p></div><button class="button" id="exportPredictions">Export CSV</button></section><div class="prediction-tabs"><button class="filter-chip ${predictionView==='games'?'active':''}" data-prediction-view="games">Game Predictions</button><button class="filter-chip ${predictionView==='futures'?'active':''}" data-prediction-view="futures">Futures</button><button class="filter-chip ${predictionView==='analytics'?'active':''}" data-prediction-view="analytics">Analytics</button></div><div class="metric-grid prediction-metrics">${metric('Combined Score',formatNumber(c.earned),`${formatNumber(c.entered)} confidence graded`)}${metric('Overall Accuracy',`${c.accuracy.toFixed(1)}%`,`${c.correct} correct`)}${metric('Efficiency',`${c.efficiency.toFixed(1)}%`,'Score ÷ confidence')}${metric('Game Score',formatNumber(a.earned),`${a.pending} pending`)}${metric('Futures Score',formatNumber(fa.earned),`${fa.pending} pending`)}${metric('Futures Accuracy',`${fa.accuracy.toFixed(1)}%`,`${fa.graded.length} resolved`)}</div>${predictionView==='games'?`<div class="prediction-layout"><div>${predictionForm()}<section class="card prediction-history"><div class="card-head"><h3>Game Prediction Journal</h3><div class="prediction-filters">${['all','pending','correct','incorrect','push'].map(x=>`<button class="filter-chip ${predictionFilter===x?'active':''}" data-prediction-filter="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div></div><div class="prediction-list">${gameRows.map(predictionCard).join('')||empty('No predictions in this view','Save a prediction or choose another result filter.')}</div></section></div><aside class="prediction-sidebar">${card('Confidence Intelligence',confidenceBands(a.rows))}${card('Personal Bests',`<div class="detail-list"><div><span>Highest confidence correct</span><strong>${a.highWin?formatNumber(a.highWin.confidence):'—'}</strong></div><div><span>Highest confidence miss</span><strong>${a.highMiss?formatNumber(a.highMiss.confidence):'—'}</strong></div><div><span>Longest streak</span><strong>${a.longest}</strong></div><div><span>Total game predictions</span><strong>${predictions.length}</strong></div></div>`)}${card('Achievements',achievements(a))}</aside></div>`:predictionView==='futures'?`<div class="futures-toolbar card"><div><strong>Season Futures</strong><p class="muted">Track championship, award, playoff, conference, rivalry, win-total, and custom outcomes.</p></div><button class="button ${futuresLocked?'danger':'primary'}" id="toggleSeasonLock">${futuresLocked?'Unlock season':'Lock preseason futures'}</button></div><div class="prediction-layout"><div>${futureForm()}<section class="card prediction-history"><div class="card-head"><h3>Futures Journal</h3><div class="prediction-filters">${['all','pending','correct','incorrect','void'].map(x=>`<button class="filter-chip ${futureFilter===x?'active':''}" data-future-filter="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div></div><div class="prediction-list">${futureRows.map(futureCard).join('')||empty('No futures in this view','Add a national champion, conference champion, award, playoff, or custom future.')}</div></section></div><aside class="prediction-sidebar">${card('Futures Summary',`<div class="detail-list"><div><span>Pending</span><strong>${fa.pending}</strong></div><div><span>Resolved</span><strong>${fa.graded.length}</strong></div><div><span>Accuracy</span><strong>${fa.accuracy.toFixed(1)}%</strong></div><div><span>Score</span><strong>${formatNumber(fa.earned)}</strong></div></div>`)}${card('Season Lock',`<p class="muted">Locking stamps all pending preseason futures and prevents accidental edits until you explicitly unlock them.</p><strong>${futuresLocked?'Locked':'Open'}</strong>`)}</aside></div>`:`<div class="reports-grid">${card('Game Prediction Accuracy',confidenceBands(a.rows))}${card('Combined Season Totals',`<div class="detail-list"><div><span>Game predictions</span><strong>${predictions.length}</strong></div><div><span>Futures</span><strong>${futures.length}</strong></div><div><span>Combined score</span><strong>${formatNumber(c.earned)}</strong></div><div><span>Combined accuracy</span><strong>${c.accuracy.toFixed(1)}%</strong></div></div>`)}${card('Futures Performance',`<div class="detail-list"><div><span>Correct</span><strong>${fa.correct.length}</strong></div><div><span>Incorrect</span><strong>${fa.graded.length-fa.correct.length}</strong></div><div><span>Pending</span><strong>${fa.pending}</strong></div><div><span>Score</span><strong>${formatNumber(fa.earned)}</strong></div></div>`)}</div>`}`}
function analyticsByType(a){return ['winner','spread','total'].map(type=>{const rows=a.rows.filter(x=>x.type===type&&['correct','incorrect'].includes(x.result.status));const correct=rows.filter(x=>x.result.status==='correct').length;return {type,label:type==='winner'?'Winner':type==='spread'?'Spread':'Over / Under',count:rows.length,accuracy:rows.length?correct/rows.length*100:0,score:rows.reduce((n,x)=>n+(Number(x.result.score)||0),0)}})}
function predictionTeamLeaders(a){const map=new Map();for(const x of a.rows){if(x.type==='total'||!['correct','incorrect'].includes(x.result.status))continue;const key=x.pick;if(!map.has(key))map.set(key,{team:key,total:0,correct:0,score:0});const row=map.get(key);row.total++;row.correct+=x.result.status==='correct'?1:0;row.score+=Number(x.result.score)||0}return [...map.values()].map(x=>({...x,accuracy:x.total?x.correct/x.total*100:0})).sort((a,b)=>b.accuracy-a.accuracy||b.total-a.total)}
function reportsPage(){setHeading('Reports','SEASON REVIEW');const c=combinedAnalytics(),a=c.games,fa=c.futures,types=analyticsByType(a),leaders=predictionTeamLeaders(a);const typeBody=`<div class="report-table">${types.map(x=>`<div><span>${x.label}</span><strong>${x.accuracy.toFixed(1)}%</strong><small>${x.count} graded · ${formatNumber(x.score)} score</small></div>`).join('')}</div>`;const leaderBody=leaders.length?`<div class="report-table">${leaders.slice(0,8).map(x=>`<div><span>${esc(x.team)}</span><strong>${x.accuracy.toFixed(1)}%</strong><small>${x.correct}-${x.total-x.correct} · ${formatNumber(x.score)} score</small></div>`).join('')}</div>`:empty('No team leaders yet','Graded winner or spread predictions will appear here.');const futureBody=fa.rows.length?`<div class="report-table">${fa.rows.slice(0,8).map(x=>`<div><span>${esc(x.title)}</span><strong>${x.result.label}</strong><small>${esc(x.pick)} · ${formatNumber(x.confidence)} confidence${x.odds?` · ${esc(x.odds)}`:''}</small></div>`).join('')}</div>`:empty('No futures yet','Add season-long predictions in Prediction Center.');const note=`<textarea id="yearbookNote" class="quick-notes" placeholder="Write a season reflection…">${esc(localStorage.getItem('onlybeats.yearbook.note.v1')||'')}</textarea><small class="muted">Saved locally as part of your season journal.</small>`;return `<section class="prediction-hero"><div><p class="eyebrow">SEASON YEARBOOK</p><h2>Your complete prediction season.</h2><p>Game predictions, futures, confidence scoring, and journal entries are summarized together.</p></div><button class="button primary" id="reportExportPredictions">Export prediction CSV</button></section><div class="metric-grid prediction-metrics">${metric('Combined Score',formatNumber(c.earned),`${formatNumber(c.entered)} confidence graded`)}${metric('Overall Accuracy',`${c.accuracy.toFixed(1)}%`,`${c.correct} correct`)}${metric('Game Score',formatNumber(a.earned),`${predictions.length} predictions`)}${metric('Futures Score',formatNumber(fa.earned),`${futures.length} futures`)}${metric('Pending',c.pending,'Games and futures')}${metric('Longest Streak',a.longest,'Game predictions')}</div><div class="reports-grid">${card('Performance by Prediction Type',typeBody)}${card('Top Team Reads',leaderBody)}${card('Futures Yearbook',futureBody)}${card('Yearbook Note',note,'wide')}</div>`}
function refreshPredictionPickOptions(existing){const game=games.find(g=>g.id===$('predictionGame')?.value);const type=$('predictionType')?.value||'winner',pick=$('predictionPick');if(!pick)return;const selected=existing?.pick||pick.value;if(type==='total'){pick.innerHTML=`<option value="over">Over</option><option value="under">Under</option>`;$('predictionPickLabel').textContent='Direction';$('predictionLineField').classList.remove('hidden')}else{pick.innerHTML=game?[game.away,game.home].map(t=>`<option value="${esc(t.abbr)}">${esc(t.name)}</option>`).join(''):'';$('predictionPickLabel').textContent=type==='winner'?'Winner':'Team';$('predictionLineField').classList.toggle('hidden',type==='winner')}if([...pick.options].some(o=>o.value===selected))pick.value=selected}
function bindPredictionPage(){
  document.querySelectorAll('[data-prediction-view]').forEach(b=>b.onclick=()=>{predictionView=b.dataset.predictionView;editingPredictionId='';editingFutureId='';renderPage()});
  const existing=predictions.find(p=>p.id===editingPredictionId);
  if($('predictionType')){$('predictionType').value=existing?.type||'winner';$('predictionLine').value=existing?.line??'';refreshPredictionPickOptions(existing);$('predictionType').onchange=()=>refreshPredictionPickOptions();$('predictionGame').onchange=()=>refreshPredictionPickOptions()}
  if($('savePrediction'))$('savePrediction').onclick=()=>{const game=games.find(g=>g.id===$('predictionGame').value),type=$('predictionType').value,pick=$('predictionPick').value,confidence=Number($('predictionConfidence').value),line=$('predictionLine').value===''?null:Number($('predictionLine').value),odds=$('predictionOdds').value.trim(),notes=$('predictionNotes').value.trim(),error=$('predictionFormError');let message='';if(!game)message='Choose an upcoming game.';else if(!Number.isFinite(confidence)||confidence<=0)message='Confidence must be any positive number.';else if((type==='spread'||type==='total')&&!Number.isFinite(line))message='Enter a valid line for spread or total predictions.';else if(!pick)message='Choose a prediction.';if(message){error.textContent=message;error.classList.remove('hidden');return}const prior=predictions.find(p=>p.id===editingPredictionId);const item={id:prior?.id||crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,gameId:game.id,gameName:`${game.away.shortName} at ${game.home.shortName}`,type,pick,line,confidence,odds,notes,createdAt:prior?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};predictions=prior?predictions.map(p=>p.id===prior.id?item:p):[...predictions,item];editingPredictionId='';predictionDraftGameId='';savePredictions();toast(prior?'Prediction updated':'Prediction saved');renderPage()};
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
  $('content').innerHTML=currentPage==='dashboard'?dashboard():currentPage==='wall'?wallPage():currentPage==='schedule'?schedulePage():currentPage==='favorites'?favoritesPage():currentPage==='teams'?teamHubPage():currentPage==='rankings'?rankingsPage():currentPage==='news'?newsPage():currentPage==='weather'?weatherPage():currentPage==='availability'?availabilityPage():currentPage==='predictions'?predictionsPage():currentPage==='reports'?reportsPage():currentPage==='developer'?developerPage():currentPage==='settings'?settingsPage():placeholderPage(currentPage,label);
  bindPage();
}
function renderPage(){
  const content=$('content');
  if(!content)return;
  try{
    renderPageUnsafe();
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
if($('availabilityForm'))$('availabilityForm').onsubmit=e=>{e.preventDefault();const team=$('availabilityTeam').value,player=$('availabilityPlayer').value.trim(),status=$('availabilityStatus').value,notes=$('availabilityNotes').value.trim();if(!team||!player)return;availabilityEntries.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),team,player,status,notes,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});saveAvailability();toast('Availability note saved');renderPage()};document.querySelectorAll('[data-delete-availability]').forEach(b=>b.onclick=()=>{availabilityEntries=availabilityEntries.filter(x=>x.id!==b.dataset.deleteAvailability);saveAvailability();renderPage()});document.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{wallState.status=b.dataset.status;saveWall();renderPage()});if($('favoritesFilter'))$('favoritesFilter').onclick=()=>{wallState.favoritesOnly=!wallState.favoritesOnly;saveWall();renderPage()};if($('top25Filter'))$('top25Filter').onclick=()=>{wallState.top25Only=!wallState.top25Only;saveWall();renderPage()};if($('wallSearch'))$('wallSearch').oninput=e=>{wallState.query=e.target.value;saveWall();const grid=document.querySelector('.wall-grid');if(grid)grid.innerHTML=filteredWallGames().map(gameCard).join('')||empty('No games match these filters','Try another team or clear filters.');document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>showGame(b.dataset.game))};document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{favorites=favorites.filter(x=>x!==b.dataset.remove);saveFavorites()});document.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>{activeTeamAbbr=b.dataset.team;teamTab='overview';renderPage()});document.querySelectorAll('[data-team-tab]').forEach(b=>b.onclick=()=>{teamTab=b.dataset.teamTab;renderPage()});if($('teamSearch'))$('teamSearch').oninput=e=>{teamQuery=e.target.value;renderPage();setTimeout(()=>{const x=$('teamSearch');if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length)}},0)};if($('teamConferenceFilter'))$('teamConferenceFilter').onchange=e=>{teamConferenceFilter=e.target.value;renderPage()};if($('teamFavoritesFilter'))$('teamFavoritesFilter').onclick=()=>{teamFavoritesOnly=!teamFavoritesOnly;renderPage()};if($('clearTeamFilters'))$('clearTeamFilters').onclick=()=>{teamQuery='';teamConferenceFilter='all';teamFavoritesOnly=false;renderPage()};if($('teamFavoriteButton'))$('teamFavoriteButton').onclick=()=>{const t=selectedTeam();if(!t)return;favorites=favorites.includes(t.abbr)?favorites.filter(x=>x!==t.abbr):[...favorites,t.abbr];localStorage.setItem(FAVORITES_KEY,JSON.stringify(favorites));renderPage()};if($('loadWeather'))$('loadWeather').onclick=()=>fetchWeather($('weatherLocation').value.trim());document.querySelectorAll('[data-focus]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();openFocus(b.dataset.focus)});document.querySelectorAll('[data-alert-game]').forEach(b=>b.onclick=()=>{const id=b.dataset.alertGame;if(id)showGame(id)});document.querySelectorAll('[data-page-jump]').forEach(b=>b.onclick=()=>navigate(b.dataset.pageJump));if(currentPage==='predictions')bindPredictionPage();if(currentPage==='reports'){if($('reportExportPredictions'))$('reportExportPredictions').onclick=exportPredictionsCsv;if($('yearbookNote'))$('yearbookNote').oninput=e=>localStorage.setItem('onlybeats.yearbook.note.v1',e.target.value)}document.querySelectorAll('[data-predict-game]').forEach(b=>b.onclick=()=>{predictionDraftGameId=b.dataset.predictGame;editingPredictionId='';predictionView='games';navigate('predictions')});bindPersonalization();if(currentPage==='settings')bindSettings()}
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
}

function closeGame(){activeGameId=null;$('gameDrawer').classList.remove('open');setTimeout(()=>$('gameDrawerBackdrop').classList.add('hidden'),180)}
function bindSettings(){const t=$('themeSelect');t.value=settings.theme==='dark'?'midnight':settings.theme;t.onchange=()=>{settings.theme=t.value;applyTheme();saveSettings()};const d=$('densitySelect');d.value=settings.dashboardDensity||'comfortable';d.onchange=()=>{settings.dashboardDensity=d.value;applyTheme();saveSettings()};const r=$('refreshSelect');r.value=settings.refresh;r.onchange=()=>{settings.refresh=r.value;saveSettings()};const s=$('startPageSelect');s.value=settings.startPage;s.onchange=()=>{settings.startPage=s.value;saveSettings()};const ps=$('pushScoringSelect');if(ps){ps.value=settings.pushScoring||'full';ps.onchange=()=>{settings.pushScoring=ps.value;saveSettings()}};[['compactToggle','compact'],['animationToggle','animations'],['scoreAlertsToggle','scoreAlerts'],['favoriteAlertsToggle','favoriteAlerts'],['kickoffAlertsToggle','kickoffAlerts']].forEach(([id,k])=>$(id).onclick=e=>{settings[k]=!settings[k];e.currentTarget.classList.toggle('on',settings[k]);applyTheme();saveSettings()});$('testProvider').onclick=()=>syncScores();$('settingsResetDashboard').onclick=()=>{dashboardLayout=[...defaultDashboard];saveDashboard()};$('exportButton').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({settings,favorites,wallState,dashboardLayout,quickNotes,predictions,futures,futuresLocked},null,2)],{type:'application/json'}));a.download='OnlyBeats-settings-v0.9.1.json';a.click();toast('Settings export created')};$('resetButton').onclick=()=>{if(confirm('Reset preferences, dashboard, notes, filters, and favorites?')){settings={...defaultSettings};favorites=[];wallState={...defaultWall};dashboardLayout=[...defaultDashboard];quickNotes='';predictions=[];futures=[];futuresLocked=false;localStorage.clear();applyTheme();renderPage()}}}
const palette=$('commandPalette'),input=$('commandInput'),results=$('commandResults');
function openPalette(){palette.classList.remove('hidden');input.value='';renderCommands('');setTimeout(()=>input.focus(),0)}
function closePalette(){palette.classList.add('hidden')}
function renderCommands(q){const pageRows=pages.filter(p=>p[2].toLowerCase().includes(q.toLowerCase())).map(([id,i,l])=>`<button class="command-result" data-page="${id}"><span>${i} ${l}</span><small>Open page</small></button>`);const teamRows=allTeams().filter(t=>q&&`${t.name} ${t.abbr}`.toLowerCase().includes(q.toLowerCase())).slice(0,8).map(t=>`<button class="command-result" data-command-team="${esc(t.abbr)}"><span>◈ ${esc(t.name)}</span><small>Open Team Hub</small></button>`);results.innerHTML=[...pageRows,...teamRows].join('');results.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{navigate(b.dataset.page);closePalette()});results.querySelectorAll('[data-command-team]').forEach(b=>b.onclick=()=>{openTeam(b.dataset.commandTeam);closePalette()})}
$('commandButton').onclick=openPalette;palette.onclick=e=>{if(e.target===palette)closePalette()};input.oninput=()=>renderCommands(input.value);$('closeGameDrawer').onclick=closeGame;$('gameDrawerBackdrop').onclick=e=>{if(e.target.id==='gameDrawerBackdrop')closeGame()};
document.addEventListener('click',event=>{
  const action=refreshActionFor(event.target);
  if(!action)return;
  event.preventDefault();
  event.stopPropagation();
  runVisibleRefresh(action.buttonId,action.pending,action.idle);
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
renderNav();
renderPage();
scheduleRefresh();
const splash=$('splash');
const splashFailSafe=setTimeout(()=>splash?.classList.add('hide'),3500);
const startupMessages=['Loading cached scores…','Loading teams…','Preparing GameDay alerts…','Ready.'];
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
