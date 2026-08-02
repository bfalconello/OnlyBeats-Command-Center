'use strict';

// Team Intelligence page, calculations, directory, and team-profile views.
// Uses shared application state and helpers exposed by the classic-script runtime.

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
