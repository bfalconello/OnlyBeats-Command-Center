'use strict';

// OnlyBeats v1.5 Live Alert Center — Phase 1.
// Creates alerts only from data already available inside OnlyBeats.

const LIVE_ALERT_LIMIT=400;
let liveAlertFilter='all';
let liveAlertSearch='';

function saveLiveAlerts(){
  localStorage.setItem(LIVE_ALERTS_KEY,JSON.stringify(liveAlerts.slice(-LIVE_ALERT_LIMIT)));
}

function saveLiveAlertPreferences(){
  localStorage.setItem(LIVE_ALERT_PREFS_KEY,JSON.stringify(liveAlertPreferences));
}

function liveAlertKey(alert){
  return [
    alert.type||'alert',
    alert.gameId||'',
    alert.teamAbbr||'',
    alert.title||'',
    alert.sourceKey||''
  ].join('|');
}

function addLiveAlert(alert){
  const normalized={
    id:alert.id||`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    time:alert.time||new Date().toISOString(),
    type:alert.type||'system',
    severity:alert.severity||'info',
    title:String(alert.title||'Live alert'),
    detail:String(alert.detail||''),
    gameId:alert.gameId||'',
    teamAbbr:alert.teamAbbr||'',
    sourceKey:alert.sourceKey||'',
    pinned:Boolean(alert.pinned),
    read:Boolean(alert.read)
  };

  const key=liveAlertKey(normalized);
  const duplicate=liveAlerts.slice(-100).some(existing=>
    liveAlertKey(existing)===key&&
    Math.abs(new Date(existing.time)-new Date(normalized.time))<120000
  );
  if(duplicate)return false;

  liveAlerts.push(normalized);
  if(liveAlerts.length>LIVE_ALERT_LIMIT)liveAlerts=liveAlerts.slice(-LIVE_ALERT_LIMIT);
  saveLiveAlerts();
  return true;
}

function priorGameAlert(game,type){
  return liveAlerts.slice().reverse().find(alert=>alert.gameId===game.id&&alert.type===type);
}

function captureLiveAlerts(reason='refresh'){
  const now=new Date().toISOString();

  for(const game of games){
    const scoreKey=`${game.away.score}-${game.home.score}:${game.status}`;
    const previousState=priorGameAlert(game,'game-state');
    const previousScore=previousState?.sourceKey?.split('|')[1]||'';

    if(game.state==='in'){
      if(!previousState||!previousState.sourceKey.startsWith('live|')){
        addLiveAlert({
          type:'game-state',
          severity:'info',
          title:'Game is live',
          detail:`${game.away.shortName} at ${game.home.shortName} · ${game.status}`,
          gameId:game.id,
          sourceKey:`live|${scoreKey}`,
          time:now
        });
      }

      if(previousScore&&previousScore!==scoreKey){
        const awayLeading=game.away.score>game.home.score;
        const homeLeading=game.home.score>game.away.score;
        const tied=game.away.score===game.home.score;
        addLiveAlert({
          type:'score-change',
          severity:tied?'warning':'info',
          title:tied?'Game tied':'Score changed',
          detail:`${game.away.shortName} ${game.away.score} – ${game.home.score} ${game.home.shortName}`,
          gameId:game.id,
          sourceKey:`score|${scoreKey}`,
          time:now
        });

        const priorParts=previousScore.split(':')[0].split('-').map(Number);
        if(priorParts.length===2){
          const priorAway=priorParts[0];
          const priorHome=priorParts[1];
          const priorAwayLeading=priorAway>priorHome;
          const priorHomeLeading=priorHome>priorAway;
          if((awayLeading&&priorHomeLeading)||(homeLeading&&priorAwayLeading)){
            addLiveAlert({
              type:'lead-change',
              severity:'warning',
              title:'Lead change',
              detail:`${game.away.shortName} ${game.away.score} – ${game.home.score} ${game.home.shortName}`,
              gameId:game.id,
              sourceKey:`lead|${scoreKey}`,
              time:now
            });
          }
        }
      }

      const rankedTrailing=
        (game.away.rank&&game.away.score<game.home.score)||
        (game.home.rank&&game.home.score<game.away.score);

      if(rankedTrailing){
        addLiveAlert({
          type:'upset',
          severity:'critical',
          title:'Upset alert',
          detail:`${game.away.shortName} ${game.away.score} – ${game.home.score} ${game.home.shortName} · ${game.status}`,
          gameId:game.id,
          sourceKey:`upset|${scoreKey}`,
          time:now
        });
      }

      if(String(game.status||'').toLowerCase().includes('ot')){
        addLiveAlert({
          type:'overtime',
          severity:'critical',
          title:'Overtime game',
          detail:`${game.away.shortName} ${game.away.score} – ${game.home.score} ${game.home.shortName}`,
          gameId:game.id,
          sourceKey:`overtime|${scoreKey}`,
          time:now
        });
      }

      if(isFavoriteGame(game)){
        addLiveAlert({
          type:'favorite',
          severity:'warning',
          title:'Favorite team live',
          detail:`${game.away.shortName} at ${game.home.shortName} · ${game.status}`,
          gameId:game.id,
          sourceKey:`favorite|${scoreKey}`,
          time:now
        });
      }
    }

    if(game.state==='post'){
      const finalKey=`final|${scoreKey}`;
      if(!liveAlerts.some(alert=>alert.gameId===game.id&&alert.sourceKey===finalKey)){
        addLiveAlert({
          type:'final',
          severity:'info',
          title:'Final score',
          detail:`${game.away.shortName} ${game.away.score} – ${game.home.score} ${game.home.shortName}`,
          gameId:game.id,
          sourceKey:finalKey,
          time:now
        });
      }
    }
  }

  const activeTeamSet=new Set(games.filter(game=>game.state!=='post').flatMap(game=>[game.away.abbr,game.home.abbr]));
  for(const entry of availabilityEntries){
    if(!activeTeamSet.has(entry.team))continue;
    if(!['Questionable','Doubtful','Unavailable','Unknown'].includes(entry.status))continue;
    addLiveAlert({
      type:'availability',
      severity:entry.status==='Unavailable'?'critical':'warning',
      title:'Player availability concern',
      detail:`${entry.player} · ${entry.team} · ${entry.status}${entry.notes?` · ${entry.notes}`:''}`,
      teamAbbr:entry.team,
      sourceKey:`availability|${entry.id}|${entry.updatedAt||entry.createdAt||''}`,
      time:entry.updatedAt||entry.createdAt||now
    });
  }

  if(reason==='score-refresh'){
    addLiveAlert({
      type:'system',
      severity:'info',
      title:'Live alert scan completed',
      detail:`${games.length} games checked`,
      sourceKey:`scan|${new Date().toISOString().slice(0,16)}`,
      time:now
    });
  }

  return liveAlerts;
}

function liveAlertGame(alert){
  return games.find(game=>game.id===alert.gameId)||null;
}

function liveAlertMatchesPreferences(alert){
  const game=liveAlertGame(alert);
  if(liveAlertPreferences.favoritesOnly&&!(game&&isFavoriteGame(game))&&alert.type!=='favorite')return false;
  if(liveAlertPreferences.rankedOnly&&!(game&&isTop25(game))&&alert.type!=='upset')return false;
  return true;
}

function filteredLiveAlerts(){
  const query=liveAlertSearch.trim().toLowerCase();
  return [...liveAlerts]
    .filter(liveAlertMatchesPreferences)
    .filter(alert=>liveAlertFilter==='all'||alert.type===liveAlertFilter||alert.severity===liveAlertFilter)
    .filter(alert=>!query||`${alert.title} ${alert.detail}`.toLowerCase().includes(query))
    .sort((a,b)=>{
      if(a.pinned!==b.pinned)return a.pinned?-1:1;
      return new Date(b.time)-new Date(a.time);
    });
}

function liveAlertIcon(alert){
  return ({
    critical:'!',
    warning:'△',
    info:'•'
  })[alert.severity]||'•';
}

function liveAlertAction(alert){
  if(alert.gameId)return {label:'Open game',action:'game'};
  if(alert.teamAbbr)return {label:'Open team',action:'team'};
  if(alert.type==='availability')return {label:'Availability',action:'availability'};
  return null;
}

function liveAlertRow(alert){
  const action=liveAlertAction(alert);
  return `<div class="intel-row ${alert.read?'':'unread'}">
    <span class="intel-icon">${liveAlertIcon(alert)}</span>
    <div>
      <strong>${alert.pinned?'📌 ':''}${esc(alert.title)}</strong>
      <small>${new Date(alert.time).toLocaleString()} · ${esc(alert.detail)}</small>
    </div>
    <div class="button-row">
      <span class="provider-badge">${esc(alert.severity.toUpperCase())}</span>
      ${action?`<button class="button" data-alert-action="${action.action}" data-alert-id="${alert.id}">${action.label}</button>`:''}
      <button class="button" data-alert-pin="${alert.id}">${alert.pinned?'Unpin':'Pin'}</button>
      <button class="button" data-alert-read="${alert.id}">${alert.read?'Unread':'Read'}</button>
    </div>
  </div>`;
}

function liveAlertSummary(){
  const visible=filteredLiveAlerts();
  return {
    visible:visible.length,
    unread:liveAlerts.filter(alert=>!alert.read).length,
    critical:liveAlerts.filter(alert=>alert.severity==='critical').length,
    warning:liveAlerts.filter(alert=>alert.severity==='warning').length,
    pinned:liveAlerts.filter(alert=>alert.pinned).length,
    games:new Set(liveAlerts.filter(alert=>alert.gameId).map(alert=>alert.gameId)).size
  };
}

function liveAlertCenterPage(){
  setHeading('Live Alert Center','UPSETS · LEAD CHANGES · FAVORITES · FINALS');
  captureLiveAlerts('page-open');
  const rows=filteredLiveAlerts();
  const summary=liveAlertSummary();
  const filters=[
    ['all','All'],
    ['critical','Critical'],
    ['warning','Warnings'],
    ['upset','Upsets'],
    ['lead-change','Lead Changes'],
    ['favorite','Favorites'],
    ['final','Finals'],
    ['availability','Availability']
  ];

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">LIVE ALERT CENTER</p>
      <h2>${liveAlertPreferences.muted?'Alerts are muted.':summary.unread?`${summary.unread} unread alert${summary.unread===1?'':'s'}.`:'You are caught up.'}</h2>
      <p>OnlyBeats watches existing score, ranking, favorite-team, timeline, and availability data for high-priority changes.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="refreshLiveAlerts">${loading?'Refreshing alerts…':'Refresh alerts'}</button>
      <button class="button" id="toggleAlertMute">${liveAlertPreferences.muted?'Unmute':'Mute'} alerts</button>
      <button class="button" id="markAllAlertsRead">Mark all read</button>
      <button class="button" id="clearLiveAlerts">Clear alerts</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Visible Alerts',summary.visible,'Current filters')}
    ${metric('Unread',summary.unread,'Needs review')}
    ${metric('Critical',summary.critical,'High-priority')}
    ${metric('Warnings',summary.warning,'Attention signals')}
    ${metric('Pinned',summary.pinned,'Saved alerts')}
    ${metric('Games Covered',summary.games,'Alert history')}
  </div>

  <section class="card">
    <div class="button-row">
      <input id="liveAlertSearch" placeholder="Search alerts" value="${esc(liveAlertSearch)}">
      <label class="toggle-row"><span>Favorites only</span><input type="checkbox" id="alertsFavoritesOnly" ${liveAlertPreferences.favoritesOnly?'checked':''}></label>
      <label class="toggle-row"><span>Ranked only</span><input type="checkbox" id="alertsRankedOnly" ${liveAlertPreferences.rankedOnly?'checked':''}></label>
    </div>
  </section>

  <div class="wall-toolbar">
    <div class="wall-status-tabs">
      ${filters.map(([id,label])=>`<button class="filter-button ${liveAlertFilter===id?'active':''}" data-alert-filter="${id}">${label}</button>`).join('')}
    </div>
  </div>

  ${card('Alert Feed',rows.length?`<div class="intel-list">${rows.slice(0,250).map(liveAlertRow).join('')}</div>`:empty('No alerts in this view','Refresh the provider or change alert filters.'),'wide')}`;
}

function runLiveAlertAction(action,alertId){
  const alert=liveAlerts.find(row=>row.id===alertId);
  if(!alert)return;

  alert.read=true;
  saveLiveAlerts();

  if(action==='game'&&alert.gameId){
    showGame(alert.gameId);
    return;
  }

  if(action==='team'&&alert.teamAbbr){
    openTeam(alert.teamAbbr);
    return;
  }

  if(action==='availability'){
    navigate('availability');
  }
}

function bindLiveAlertCenter(){
  document.querySelectorAll('[data-alert-filter]').forEach(button=>{
    button.onclick=()=>{
      liveAlertFilter=button.dataset.alertFilter;
      renderPage();
    };
  });

  document.querySelectorAll('[data-alert-action]').forEach(button=>{
    button.onclick=()=>runLiveAlertAction(button.dataset.alertAction,button.dataset.alertId);
  });

  document.querySelectorAll('[data-alert-pin]').forEach(button=>{
    button.onclick=()=>{
      const alert=liveAlerts.find(row=>row.id===button.dataset.alertPin);
      if(!alert)return;
      alert.pinned=!alert.pinned;
      saveLiveAlerts();
      renderPage();
    };
  });

  document.querySelectorAll('[data-alert-read]').forEach(button=>{
    button.onclick=()=>{
      const alert=liveAlerts.find(row=>row.id===button.dataset.alertRead);
      if(!alert)return;
      alert.read=!alert.read;
      saveLiveAlerts();
      renderPage();
    };
  });

  if($('liveAlertSearch'))$('liveAlertSearch').oninput=event=>{
    liveAlertSearch=event.target.value;
    renderPage();
  };

  if($('alertsFavoritesOnly'))$('alertsFavoritesOnly').onchange=event=>{
    liveAlertPreferences.favoritesOnly=event.target.checked;
    saveLiveAlertPreferences();
    renderPage();
  };

  if($('alertsRankedOnly'))$('alertsRankedOnly').onchange=event=>{
    liveAlertPreferences.rankedOnly=event.target.checked;
    saveLiveAlertPreferences();
    renderPage();
  };

  if($('refreshLiveAlerts'))$('refreshLiveAlerts').onclick=async()=>{
    const button=$('refreshLiveAlerts');
    button.disabled=true;
    button.textContent='Refreshing alerts…';
    try{
      await syncScores(false);
      captureLiveAlerts('score-refresh');
      renderPage();
    }finally{
      const active=$('refreshLiveAlerts');
      if(active){
        active.disabled=false;
        active.textContent='Refresh alerts';
      }
    }
  };

  if($('toggleAlertMute'))$('toggleAlertMute').onclick=()=>{
    liveAlertPreferences.muted=!liveAlertPreferences.muted;
    saveLiveAlertPreferences();
    renderPage();
    toast(`Alerts ${liveAlertPreferences.muted?'muted':'unmuted'}`);
  };

  if($('markAllAlertsRead'))$('markAllAlertsRead').onclick=()=>{
    liveAlerts.forEach(alert=>alert.read=true);
    saveLiveAlerts();
    renderPage();
    toast('All alerts marked read');
  };

  if($('clearLiveAlerts'))$('clearLiveAlerts').onclick=()=>{
    if(confirm('Clear the complete local alert history?')){
      liveAlerts=[];
      saveLiveAlerts();
      renderPage();
      toast('Alert history cleared');
    }
  };
}

function initializeLiveAlertCenter(){
  setTimeout(()=>captureLiveAlerts('startup'),1500);
}
