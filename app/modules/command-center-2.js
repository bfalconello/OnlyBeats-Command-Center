'use strict';

// OnlyBeats v1.6 Command Center 2.0 — Phase 1.

const COMMAND_CENTER_LAYOUTS={
  balanced:['live','priority','favorites','alerts','kickoffs','predictions'],
  live:['live','alerts','priority','favorites','kickoffs','predictions'],
  predictions:['predictions','priority','live','kickoffs','alerts','favorites'],
  favorites:['favorites','live','priority','alerts','kickoffs','predictions']
};

let commandCenterLastNotificationAt=0;

function saveCommandCenterSettings(){
  localStorage.setItem(COMMAND_CENTER_KEY,JSON.stringify(commandCenterSettings));
}

function commandCenterLayoutIds(){
  return COMMAND_CENTER_LAYOUTS[commandCenterSettings.layout]||COMMAND_CENTER_LAYOUTS.balanced;
}

function commandCenterLiveGames(){
  return sortGames(games.filter(game=>game.state==='in')).slice(0,8);
}

function commandCenterPriorityGames(){
  return typeof prioritizedGames==='function'
    ? prioritizedGames().filter(item=>item.score>0).slice(0,8)
    : [];
}

function commandCenterFavoriteGames(){
  return sortGames(games.filter(game=>isFavoriteGame(game)&&game.state!=='post')).slice(0,8);
}

function commandCenterUpcomingGames(){
  return sortGames(games.filter(game=>game.state==='pre'&&new Date(game.date)>=new Date())).slice(0,8);
}

function commandCenterPredictionRows(){
  return predictions
    .map(prediction=>{
      const game=predictionGame(prediction);
      const result=predictionResult(prediction,game);
      return {prediction,game,result};
    })
    .filter(row=>row.result.status==='pending')
    .sort((a,b)=>new Date(a.game?.date||a.prediction.createdAt)-new Date(b.game?.date||b.prediction.createdAt))
    .slice(0,8);
}

function commandCenterAlertRows(){
  return [...liveAlerts]
    .filter(alert=>!alert.read)
    .sort((a,b)=>{
      const severity={critical:0,warning:1,info:2};
      return (severity[a.severity]??9)-(severity[b.severity]??9)||new Date(b.time)-new Date(a.time);
    })
    .slice(0,8);
}

function missionGameRow(game,action='hub'){
  return `<div class="intel-row">
    <span class="intel-icon">${game.state==='in'?'●':isFavoriteGame(game)?'★':'◷'}</span>
    <div>
      <strong>${game.away.rank?`#${game.away.rank} `:''}${esc(game.away.shortName)} ${game.away.score} – ${game.home.score} ${game.home.rank?`#${game.home.rank} `:''}${esc(game.home.shortName)}</strong>
      <small>${esc(game.status)}${game.network?` · ${esc(game.network)}`:''}</small>
    </div>
    <div class="button-row">
      <button class="button" data-mission-game="${game.id}" data-mission-action="${action}">${action==='focus'?'Focus':'Open'}</button>
      <button class="button" data-mission-popout="${game.id}">Pop out</button>
    </div>
  </div>`;
}

function missionPriorityRow(item){
  return `<div class="intel-row">
    <span class="intel-icon">${item.score>=70?'!':'◈'}</span>
    <div>
      <strong>${esc(item.game.away.shortName)} at ${esc(item.game.home.shortName)}</strong>
      <small>Priority ${item.score} · ${esc(item.reasons.join(' · '))}</small>
    </div>
    <div class="button-row">
      <button class="button primary" data-mission-game="${item.game.id}" data-mission-action="focus">Focus</button>
      <button class="button" data-mission-popout="${item.game.id}">Pop out</button>
    </div>
  </div>`;
}

function missionPredictionRow(row){
  return `<div class="intel-row">
    <span class="intel-icon">✓</span>
    <div>
      <strong>${esc(row.prediction.gameName||'Prediction')}</strong>
      <small>${esc(predictionTypeLabel(row.prediction))} · ${esc(predictionPickLabel(row.prediction,row.game))} · Confidence ${formatNumber(row.prediction.confidence)}</small>
    </div>
    <button class="button" data-mission-prediction="${row.prediction.id}">Review</button>
  </div>`;
}

function missionAlertRow(alert){
  return `<div class="intel-row">
    <span class="intel-icon">${alert.severity==='critical'?'!':alert.severity==='warning'?'△':'•'}</span>
    <div>
      <strong>${esc(alert.title)}</strong>
      <small>${new Date(alert.time).toLocaleString()} · ${esc(alert.detail)}</small>
    </div>
    ${alert.gameId?`<button class="button" data-mission-game="${alert.gameId}" data-mission-action="hub">Open</button>`:''}
  </div>`;
}

function missionFavoriteBar(){
  if(!commandCenterSettings.favoriteBar)return '';
  const teams=favorites.slice(0,12);
  return `<section class="card">
    <div class="card-head">
      <div><p class="eyebrow">FAVORITE TEAM COMMAND BAR</p><h3>${teams.length?`${teams.length} favorite team${teams.length===1?'':'s'}`:'No favorite teams yet'}</h3></div>
      <button class="button" data-page-jump="favorites">Manage</button>
    </div>
    <div class="command-quick-links">
      ${teams.map(abbr=>{
        const team=allTeams().find(item=>item.abbr===abbr);
        return `<button class="button" data-mission-team="${esc(abbr)}">${team?esc(team.shortName||team.name):esc(abbr)}</button>`;
      }).join('')}
    </div>
  </section>`;
}

function missionWidget(id){
  const live=commandCenterLiveGames();
  const priorities=commandCenterPriorityGames();
  const favorites=commandCenterFavoriteGames();
  const upcoming=commandCenterUpcomingGames();
  const predictions=commandCenterPredictionRows();
  const alerts=commandCenterAlertRows();

  if(id==='live'){
    return card('Live Games',live.length?`<div class="intel-list">${live.map(game=>missionGameRow(game,'focus')).join('')}</div>`:empty('No live games','Live matchups will appear here automatically.'));
  }

  if(id==='priority'){
    return card('Priority Queue',priorities.length?`<div class="intel-list">${priorities.map(missionPriorityRow).join('')}</div>`:empty('No active priorities','High-priority games will appear here.'));
  }

  if(id==='favorites'){
    return card('Favorite Team Activity',favorites.length?`<div class="intel-list">${favorites.map(game=>missionGameRow(game,'hub')).join('')}</div>`:empty('No favorite games active','Favorite-team games will appear here.'));
  }

  if(id==='alerts'){
    return card('Critical Alerts',alerts.length?`<div class="intel-list">${alerts.map(missionAlertRow).join('')}</div>`:empty('No unread alerts','You are caught up.'));
  }

  if(id==='kickoffs'){
    return card('Next Kickoffs',upcoming.length?`<div class="intel-list">${upcoming.map(game=>missionGameRow(game,'hub')).join('')}</div>`:empty('No upcoming games','Upcoming kickoffs will appear here.'));
  }

  if(id==='predictions'){
    return card('Pending Predictions',predictions.length?`<div class="intel-list">${predictions.map(missionPredictionRow).join('')}</div>`:empty('No pending predictions','Create predictions to track them here.'));
  }

  return '';
}

function commandCenterTwoPage(){
  setHeading('Mission Control','COMMAND CENTER 2.0');
  const live=commandCenterLiveGames();
  const priorities=commandCenterPriorityGames();
  const alerts=commandCenterAlertRows();
  const predictions=commandCenterPredictionRows();
  const upcoming=commandCenterUpcomingGames();
  const ids=commandCenterLayoutIds();

  return `<section class="hero command-center-hero">
    <div class="hero-copy">
      <p class="eyebrow">SATURDAY MISSION CONTROL</p>
      <h2>${live.length?`${live.length} live game${live.length===1?'':'s'} under command.`:upcoming.length?`Next kickoff: ${esc(upcoming[0].away.shortName)} at ${esc(upcoming[0].home.shortName)}.`:'Mission Control is standing by.'}</h2>
      <p>Coordinate live games, priority matchups, favorite teams, alerts, kickoffs, predictions, and pop-out views from one screen.</p>
      <div class="button-row">
        <button class="button primary" id="missionRefresh">${loading?'Refreshing Mission Control…':'Refresh Mission Control'}</button>
        <button class="button" id="missionNotifications">${commandCenterSettings.notifications?'Disable':'Enable'} desktop notifications</button>
        <button class="button" data-page-jump="alerts">Open Alert Center</button>
        <button class="button" data-page-jump="watch">Open Watch Center</button>
      </div>
    </div>
    <img src="assets/onlybeats-icon.png" alt="OnlyBeats logo">
  </section>

  <div class="metric-grid">
    ${metric('Live Games',live.length,'Current slate')}
    ${metric('Priority Games',priorities.length,'Active signals')}
    ${metric('Unread Alerts',alerts.length,'Top eight shown')}
    ${metric('Pending Predictions',predictions.length,'Needs resolution')}
    ${metric('Next Kickoffs',upcoming.length,'Upcoming games')}
    ${metric('Layout',commandCenterSettings.layout,'Saved locally')}
  </div>

  ${missionFavoriteBar()}

  <section class="card">
    <div class="card-head">
      <div><p class="eyebrow">LAYOUT PRESETS</p><h3>Choose your Mission Control emphasis</h3></div>
    </div>
    <div class="button-row">
      ${Object.keys(COMMAND_CENTER_LAYOUTS).map(layout=>`<button class="button ${commandCenterSettings.layout===layout?'primary':''}" data-mission-layout="${layout}">${layout[0].toUpperCase()+layout.slice(1)}</button>`).join('')}
      <button class="button" id="toggleFavoriteCommandBar">${commandCenterSettings.favoriteBar?'Hide':'Show'} favorite command bar</button>
    </div>
  </section>

  <section class="reports-grid">
    ${ids.map(missionWidget).join('')}
  </section>

  ${card('Command Shortcuts',`<div class="command-quick-links">
    <button class="button" data-page-jump="dashboard">Dashboard</button>
    <button class="button" data-page-jump="briefing">Briefing</button>
    <button class="button" data-page-jump="wall">Saturday Wall</button>
    <button class="button" data-page-jump="gamehub">Game Hub</button>
    <button class="button" data-page-jump="timeline">Timeline</button>
    <button class="button" data-page-jump="alerts">Live Alerts</button>
    <button class="button" data-page-jump="predictions">Prediction Center</button>
    <button class="button" data-page-jump="analytics">Analytics</button>
    <button class="button" data-page-jump="datahealth">Data Health</button>
    <button class="button" data-page-jump="performance">Performance</button>
  </div>`,'wide')}`;
}

function missionPopoutHtml(game){
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(game.away.shortName)} at ${esc(game.home.shortName)}</title>
<style>
body{margin:0;background:#080d14;color:#f5f7fb;font:16px system-ui;padding:24px}
.card{border:1px solid #263342;border-radius:18px;padding:22px;background:#111923}
h1{margin:0 0 8px;font-size:26px}
.score{font-size:44px;font-weight:800;margin:18px 0}
.muted{color:#9aabbd}
</style>
</head>
<body>
<div class="card">
<h1>${game.away.rank?`#${game.away.rank} `:''}${esc(game.away.shortName)} at ${game.home.rank?`#${game.home.rank} `:''}${esc(game.home.shortName)}</h1>
<div class="score">${game.away.score} – ${game.home.score}</div>
<p>${esc(game.status)}</p>
<p class="muted">${game.network?esc(game.network):'Network not listed'}${game.venue?` · ${esc(game.venue)}`:''}</p>
</div>
</body>
</html>`;
}

function openMissionPopout(gameId){
  const game=games.find(item=>item.id===gameId);
  if(!game)return;
  const win=window.open('','_blank','width=520,height=420,resizable=yes,scrollbars=yes');
  if(!win){
    toast('Pop-out window was blocked','error');
    return;
  }
  win.document.open();
  win.document.write(missionPopoutHtml(game));
  win.document.close();
}

async function requestMissionNotifications(){
  if(!('Notification' in window)){
    toast('Desktop notifications are unavailable','error');
    return false;
  }

  if(Notification.permission==='granted')return true;
  if(Notification.permission==='denied'){
    toast('Desktop notifications are blocked in system settings','error');
    return false;
  }

  const permission=await Notification.requestPermission();
  return permission==='granted';
}

function sendMissionNotification(title,body){
  if(!commandCenterSettings.notifications||!('Notification' in window)||Notification.permission!=='granted')return;
  if(Date.now()-commandCenterLastNotificationAt<5000)return;
  commandCenterLastNotificationAt=Date.now();
  try{
    new Notification(title,{body,icon:'assets/onlybeats-icon.png'});
  }catch{}
}

function scanMissionNotifications(){
  const alert=commandCenterAlertRows()[0];
  if(alert)sendMissionNotification(alert.title,alert.detail);
}

function bindCommandCenterTwo(){
  if($('missionRefresh'))$('missionRefresh').onclick=async()=>{
    const button=$('missionRefresh');
    button.disabled=true;
    button.textContent='Refreshing Mission Control…';
    try{
      await syncScores(false);
      captureLiveAlerts('score-refresh');
      scanMissionNotifications();
      renderPage();
    }finally{
      const active=$('missionRefresh');
      if(active){
        active.disabled=false;
        active.textContent='Refresh Mission Control';
      }
    }
  };

  document.querySelectorAll('[data-mission-layout]').forEach(button=>{
    button.onclick=()=>{
      commandCenterSettings.layout=button.dataset.missionLayout;
      saveCommandCenterSettings();
      renderPage();
    };
  });

  document.querySelectorAll('[data-mission-game]').forEach(button=>{
    button.onclick=()=>{
      const gameId=button.dataset.missionGame;
      if(button.dataset.missionAction==='focus'){
        openFocus(gameId);
      }else{
        openUltimateGameHub(gameId);
      }
    };
  });

  document.querySelectorAll('[data-mission-popout]').forEach(button=>{
    button.onclick=()=>openMissionPopout(button.dataset.missionPopout);
  });

  document.querySelectorAll('[data-mission-prediction]').forEach(button=>{
    button.onclick=()=>{
      editingPredictionId=button.dataset.missionPrediction;
      predictionView='games';
      navigate('predictions');
    };
  });

  document.querySelectorAll('[data-mission-team]').forEach(button=>{
    button.onclick=()=>openTeam(button.dataset.missionTeam);
  });

  if($('toggleFavoriteCommandBar'))$('toggleFavoriteCommandBar').onclick=()=>{
    commandCenterSettings.favoriteBar=!commandCenterSettings.favoriteBar;
    saveCommandCenterSettings();
    renderPage();
  };

  if($('missionNotifications'))$('missionNotifications').onclick=async()=>{
    if(commandCenterSettings.notifications){
      commandCenterSettings.notifications=false;
      saveCommandCenterSettings();
      renderPage();
      toast('Desktop notifications disabled');
      return;
    }

    const allowed=await requestMissionNotifications();
    if(!allowed)return;
    commandCenterSettings.notifications=true;
    saveCommandCenterSettings();
    sendMissionNotification('OnlyBeats Mission Control','Desktop notifications are enabled.');
    renderPage();
  };
}

function initializeCommandCenterTwo(){
  setTimeout(scanMissionNotifications,2200);
}
