'use strict';

// Schedule Center filtering, date grouping, game rows, and page rendering.
// Uses shared application state and helpers exposed by the classic-script runtime.

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
