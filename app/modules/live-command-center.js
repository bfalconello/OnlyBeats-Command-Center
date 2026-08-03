'use strict';

// OnlyBeats v2.9.1 Command Center Hotfix.
// Uses live/provider data when configured and clearly marks unavailable feeds.

let liveCommandState={
  refreshSeconds:30,
  autoRefresh:true,
  showFinals:true,
  showUpcoming:true,
  showLive:true,
  favoriteOnly:false,
  compactCards:false,
  alertCloseMargin:8,
  alertFourthQuarter:true,
  alertUpsets:true,
  alertWeather:true,
  lastRefreshAt:null
};

let liveCommandAlerts=[];
let liveCommandTimer=null;

function loadLiveCommandState(){
  try{
    liveCommandState={
      ...liveCommandState,
      ...JSON.parse(localStorage.getItem(LIVE_COMMAND_CENTER_KEY)||'{}')
    };
  }catch{}

  try{
    const rows=JSON.parse(localStorage.getItem(LIVE_COMMAND_ALERTS_KEY)||'[]');
    liveCommandAlerts=Array.isArray(rows)?rows:[];
  }catch{
    liveCommandAlerts=[];
  }
}

function saveLiveCommandState(){
  localStorage.setItem(LIVE_COMMAND_CENTER_KEY,JSON.stringify(liveCommandState));
  localStorage.setItem(LIVE_COMMAND_ALERTS_KEY,JSON.stringify(liveCommandAlerts.slice(-300)));
}

function liveCommandGamePrediction(gameId){
  return predictions.find(prediction=>prediction.gameId===gameId)||null;
}

function liveCommandPredictionSelection(prediction){
  return prediction?.team||prediction?.selection||prediction?.pick||'';
}

function liveCommandPredictionStatus(game,prediction){
  if(!prediction)return 'none';
  if(game.state==='pre')return 'pending';

  const selection=liveCommandPredictionSelection(prediction);
  const away=game.away.abbr;
  const home=game.home.abbr;
  const awayScore=Number(game.away.score)||0;
  const homeScore=Number(game.home.score)||0;

  if(game.state==='in'){
    if(selection===away)return awayScore>homeScore?'winning':awayScore<homeScore?'losing':'tied';
    if(selection===home)return homeScore>awayScore?'winning':homeScore<awayScore?'losing':'tied';
    return 'tracking';
  }

  if(game.state==='post'){
    if(awayScore===homeScore)return 'push';
    const winner=awayScore>homeScore?away:home;
    return selection===winner?'correct':'incorrect';
  }

  return 'pending';
}

function liveCommandFilteredGames(){
  return games
    .filter(game=>{
      if(game.state==='in'&&!liveCommandState.showLive)return false;
      if(game.state==='pre'&&!liveCommandState.showUpcoming)return false;
      if(game.state==='post'&&!liveCommandState.showFinals)return false;

      if(liveCommandState.favoriteOnly){
        const awayFav=favorites.includes?.(game.away.abbr);
        const homeFav=favorites.includes?.(game.home.abbr);
        if(!awayFav&&!homeFav)return false;
      }
      return true;
    })
    .sort((a,b)=>{
      const order={in:0,pre:1,post:2};
      const stateDifference=(order[a.state]??9)-(order[b.state]??9);
      if(stateDifference!==0)return stateDifference;
      return new Date(a.date)-new Date(b.date);
    });
}

function liveCommandWeatherFor(game){
  const rows=window.ONLYBEATS_NORMALIZED_WEATHER||[];

  const direct=rows.find(item=>String(item.gameId||'')===String(game.id||''));
  if(direct)return direct;

  return rows.find(item=>{
    const venue=String(game.venue||'').toLowerCase().trim();
    const location=String(item.location||'').toLowerCase().trim();
    return venue&&location&&(venue.includes(location)||location.includes(venue));
  })||null;
}

function liveCommandRankings(){
  return Array.isArray(window.ONLYBEATS_NORMALIZED_RANKINGS)
    ?window.ONLYBEATS_NORMALIZED_RANKINGS
    :[];
}

function liveCommandUpsetScore(game){
  const awayRank=Number(game.away.rank)||0;
  const homeRank=Number(game.home.rank)||0;
  const awayScore=Number(game.away.score)||0;
  const homeScore=Number(game.home.score)||0;

  let favorite='';
  let underdog='';
  let score=0;

  if(awayRank&&homeRank){
    favorite=awayRank<homeRank?game.away.abbr:game.home.abbr;
    underdog=favorite===game.away.abbr?game.home.abbr:game.away.abbr;
    score+=Math.min(35,Math.abs(awayRank-homeRank)*2);
  }else if(awayRank||homeRank){
    favorite=awayRank?game.away.abbr:game.home.abbr;
    underdog=favorite===game.away.abbr?game.home.abbr:game.away.abbr;
    score+=25;
  }else{
    return {score:0,favorite:'',underdog:''};
  }

  if(game.state==='in'){
    const underdogScore=underdog===game.away.abbr?awayScore:homeScore;
    const favoriteScore=favorite===game.away.abbr?awayScore:homeScore;
    const margin=underdogScore-favoriteScore;
    if(margin>0)score+=Math.min(50,margin*5);
    else if(margin>=-7)score+=15;
  }

  return {score:Math.min(100,score),favorite,underdog};
}

function liveCommandAlertKey(type,game){
  return `${type}|${game.id}`;
}

function addLiveCommandAlert(type,game,message,severity='info'){
  const key=liveCommandAlertKey(type,game);
  const existing=liveCommandAlerts.find(alert=>alert.key===key&&alert.active);
  if(existing){
    existing.updatedAt=new Date().toISOString();
    existing.message=message;
    existing.severity=severity;
    return;
  }

  liveCommandAlerts.push({
    id:`alert-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    key,
    type,
    gameId:game.id,
    message,
    severity,
    active:true,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  });
}

function evaluateLiveCommandAlerts(){
  games.forEach(game=>{
    if(game.state!=='in')return;

    const awayScore=Number(game.away.score)||0;
    const homeScore=Number(game.home.score)||0;
    const margin=Math.abs(awayScore-homeScore);
    const status=String(game.status||'').toLowerCase();

    if(margin<=Number(liveCommandState.alertCloseMargin||8)){
      addLiveCommandAlert(
        'close',
        game,
        `${game.away.abbr} ${awayScore} – ${game.home.abbr} ${homeScore}: close game`,
        margin<=3?'high':'medium'
      );
    }

    if(liveCommandState.alertFourthQuarter&&(/4th|fourth|q4/.test(status))){
      addLiveCommandAlert(
        'fourth',
        game,
        `${game.away.shortName} at ${game.home.shortName} has reached the fourth quarter`,
        'medium'
      );
    }

    if(liveCommandState.alertUpsets){
      const upset=liveCommandUpsetScore(game);
      if(upset.score>=45){
        addLiveCommandAlert(
          'upset',
          game,
          `${upset.underdog} is on upset watch against ${upset.favorite}`,
          upset.score>=70?'high':'medium'
        );
      }
    }

    if(liveCommandState.alertWeather){
      const weather=liveCommandWeatherFor(game);
      if(weather&&(Number(weather.wind)>=20||Number(weather.precipitation)>=50)){
        addLiveCommandAlert(
          'weather',
          game,
          `Weather may affect ${game.away.shortName} at ${game.home.shortName}`,
          'medium'
        );
      }
    }
  });

  saveLiveCommandState();
}

function liveCommandGameCard(game){
  const prediction=liveCommandGamePrediction(game.id);
  const predictionStatus=liveCommandPredictionStatus(game,prediction);
  const weather=liveCommandWeatherFor(game);
  const upset=liveCommandUpsetScore(game);
  const awayFavorite=favorites.includes?.(game.away.abbr);
  const homeFavorite=favorites.includes?.(game.home.abbr);

  return `<article class="live-command-game ${liveCommandState.compactCards?'compact':''}">
    <div class="live-command-game-head">
      <div>
        <span class="provider-badge">${game.state==='in'?'LIVE':game.state==='post'?'FINAL':'UPCOMING'}</span>
        <small>${esc(game.status||'Scheduled')} ${game.network?`· ${esc(game.network)}`:''}</small>
      </div>
      <div class="button-row">
        ${upset.score>=45?`<span class="provider-badge alert">UPSET ${upset.score.toFixed(0)}</span>`:''}
        ${prediction?`<span class="provider-badge prediction-${predictionStatus}">${esc(predictionStatus.toUpperCase())}</span>`:''}
      </div>
    </div>

    <div class="live-command-team-row">
      <div><strong>${awayFavorite?'★ ':''}${game.away.rank?`#${game.away.rank} `:''}${esc(game.away.shortName)}</strong><small>${esc(game.away.abbr)}</small></div>
      <b>${Number(game.away.score)||0}</b>
    </div>
    <div class="live-command-team-row">
      <div><strong>${homeFavorite?'★ ':''}${game.home.rank?`#${game.home.rank} `:''}${esc(game.home.shortName)}</strong><small>${esc(game.home.abbr)}</small></div>
      <b>${Number(game.home.score)||0}</b>
    </div>

    <div class="live-command-meta">
      <span>${game.venue?esc(game.venue):'Venue unavailable'}</span>
      <span>${weather?`${Number(weather.temperature).toFixed(0)}° · ${esc(weather.condition||'Weather')} · Wind ${Number(weather.wind||0).toFixed(0)} mph${Number(weather.precipitation||0)>0?` · Precip ${Number(weather.precipitation).toFixed(2)} in`:''}`:'Weather feed unavailable'}</span>
      <span>${prediction?`Prediction: ${esc(liveCommandPredictionSelection(prediction))}`:'No saved prediction'}</span>
    </div>

    <div class="button-row">
      <button class="button" data-live-game="${game.id}">Open game</button>
      <button class="button" data-live-predict="${game.id}">${prediction?'Edit prediction':'Add prediction'}</button>
    </div>
  </article>`;
}

function liveCommandAlertRows(){
  const active=liveCommandAlerts
    .filter(alert=>alert.active)
    .sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));

  if(!active.length){
    return empty('No active command alerts','Close games, upset watches, fourth quarters, and weather alerts will appear here.');
  }

  return `<div class="intel-list">${active.map(alert=>`
    <div class="intel-row">
      <span class="intel-icon">${alert.severity==='high'?'!':'•'}</span>
      <div><strong>${esc(alert.message)}</strong><small>${new Date(alert.updatedAt).toLocaleTimeString()} · ${esc(alert.type)}</small></div>
      <button class="button" data-dismiss-live-alert="${alert.id}">Dismiss</button>
    </div>`).join('')}</div>`;
}

function liveCommandRankingsPanel(){
  const rankings=liveCommandRankings().slice(0,25);
  if(!rankings.length){
    return empty('Rankings feed unavailable','Connect a rankings provider in Live Data Platform.');
  }

  return `<div class="rankings-command-list">${rankings.map(item=>`
    <div class="rankings-command-row">
      <b>${item.rank}</b>
      <span>${esc(item.team)}</span>
      <small>${esc(item.record||'')}</small>
    </div>`).join('')}</div>`;
}


function liveCommandPredictionHealth(){
  const tracked=games
    .map(game=>({
      game,
      prediction:liveCommandGamePrediction(game.id)
    }))
    .filter(item=>item.prediction);

  const counts={winning:0,losing:0,tied:0,pending:0,correct:0,incorrect:0,push:0,tracking:0};
  tracked.forEach(item=>{
    const status=liveCommandPredictionStatus(item.game,item.prediction);
    counts[status]=(counts[status]||0)+1;
  });

  const active=counts.winning+counts.losing+counts.tied+counts.tracking;
  const health=active
    ?Math.round(((counts.winning+counts.tied*.5)/active)*100)
    :tracked.length
      ?Math.round(((counts.correct+counts.push*.5)/Math.max(1,counts.correct+counts.incorrect+counts.push))*100)
      :0;

  return {tracked:tracked.length,counts,health};
}

function liveCommandTicker(){
  const active=liveCommandAlerts
    .filter(alert=>alert.active)
    .sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt))
    .slice(0,8);

  if(!active.length){
    return `<div class="command-ticker"><strong>ONLYBEATS COMMAND CENTER</strong><span>No active alerts</span></div>`;
  }

  return `<div class="command-ticker">
    <strong>LIVE ALERTS</strong>
    <div class="command-ticker-track">
      ${active.map(alert=>`<span>${esc(alert.message)}</span>`).join('')}
    </div>
  </div>`;
}

function liveCommandHealthPanel(health){
  return `<div class="prediction-health-panel">
    <div>
      <p class="eyebrow">PREDICTION HEALTH</p>
      <h3>${health.health}%</h3>
      <small>${health.tracked} tracked prediction${health.tracked===1?'':'s'}</small>
    </div>
    <div class="prediction-health-bar"><span style="width:${health.health}%"></span></div>
    <div class="prediction-health-counts">
      <span>Winning <strong>${health.counts.winning||0}</strong></span>
      <span>Losing <strong>${health.counts.losing||0}</strong></span>
      <span>Pending <strong>${health.counts.pending||0}</strong></span>
      <span>Correct <strong>${health.counts.correct||0}</strong></span>
    </div>
  </div>`;
}

function liveCommandCenterPage(){
  setHeading('Live Command Center','GAMES · ALERTS · PREDICTIONS · RANKINGS');
  const visibleGames=liveCommandFilteredGames();
  const liveGames=games.filter(game=>game.state==='in');
  const upcomingGames=games.filter(game=>game.state==='pre');
  const finalGames=games.filter(game=>game.state==='post');
  const trackedPredictions=visibleGames.filter(game=>liveCommandGamePrediction(game.id));
  const winningPredictions=visibleGames.filter(game=>liveCommandPredictionStatus(game,liveCommandGamePrediction(game.id))==='winning');
  const predictionHealth=liveCommandPredictionHealth();

  liveCommandState.lastRefreshAt=new Date().toISOString();
  evaluateLiveCommandAlerts();
  saveLiveCommandState();

  return `${liveCommandTicker()}
  <div class="saturday-mode-header">
    <div><p class="eyebrow">SATURDAY MODE</p><h2>OnlyBeats Command Center</h2></div>
    <div class="saturday-clock">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
  </div>
  ${liveCommandHealthPanel(predictionHealth)}
  <section class="intel-hero">
    <div>
      <p class="eyebrow">ONLYBEATS SATURDAY OPERATIONS</p>
      <h2>${liveGames.length} live game${liveGames.length===1?'':'s'} · ${liveCommandAlerts.filter(item=>item.active).length} active alert${liveCommandAlerts.filter(item=>item.active).length===1?'':'s'}.</h2>
      <p>Monitor live games, prediction status, upset watch, rankings, weather, and command alerts from one dashboard.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="liveCommandRefresh">Refresh now</button>
      <button class="button" id="liveCommandFullscreen">Command mode</button>
      <button class="button" data-page-jump="platform">Data providers</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Live Games',liveGames.length,'Current game state')}
    ${metric('Upcoming',upcomingGames.length,'Scheduled')}
    ${metric('Final',finalGames.length,'Completed')}
    ${metric('Tracked Predictions',trackedPredictions.length,`${winningPredictions.length} currently winning`)}
    ${metric('Active Alerts',liveCommandAlerts.filter(item=>item.active).length,'Command feed')}
    ${metric('Last Refresh',new Date(liveCommandState.lastRefreshAt).toLocaleTimeString(),`${liveCommandState.refreshSeconds}s interval`)}
  </div>

  <div class="reports-grid">
    ${card('Command Controls',`<div class="detail-list">
      <label class="toggle-row"><span>Automatic refresh</span><input type="checkbox" id="liveCommandAutoRefresh" ${liveCommandState.autoRefresh?'checked':''}></label>
      <label><span>Refresh interval</span>
        <select id="liveCommandRefreshSeconds">
          ${[15,30,60,120,300].map(value=>`<option value="${value}" ${Number(liveCommandState.refreshSeconds)===value?'selected':''}>${value} seconds</option>`).join('')}
        </select>
      </label>
      <label class="toggle-row"><span>Show live games</span><input type="checkbox" id="liveCommandShowLive" ${liveCommandState.showLive?'checked':''}></label>
      <label class="toggle-row"><span>Show upcoming games</span><input type="checkbox" id="liveCommandShowUpcoming" ${liveCommandState.showUpcoming?'checked':''}></label>
      <label class="toggle-row"><span>Show final games</span><input type="checkbox" id="liveCommandShowFinals" ${liveCommandState.showFinals?'checked':''}></label>
      <label class="toggle-row"><span>Favorite teams only</span><input type="checkbox" id="liveCommandFavoriteOnly" ${liveCommandState.favoriteOnly?'checked':''}></label>
      <label class="toggle-row"><span>Compact cards</span><input type="checkbox" id="liveCommandCompact" ${liveCommandState.compactCards?'checked':''}></label>
    </div>`)}

    ${card('Alert Rules',`<div class="detail-list">
      <label><span>Close-game margin</span><input id="liveCommandCloseMargin" type="number" min="1" max="30" value="${liveCommandState.alertCloseMargin}"></label>
      <label class="toggle-row"><span>Fourth-quarter alerts</span><input type="checkbox" id="liveCommandFourthAlert" ${liveCommandState.alertFourthQuarter?'checked':''}></label>
      <label class="toggle-row"><span>Upset-watch alerts</span><input type="checkbox" id="liveCommandUpsetAlert" ${liveCommandState.alertUpsets?'checked':''}></label>
      <label class="toggle-row"><span>Weather alerts</span><input type="checkbox" id="liveCommandWeatherAlert" ${liveCommandState.alertWeather?'checked':''}></label>
      <button class="button" id="liveCommandClearAlerts">Clear command alerts</button>
    </div>`)}

    ${card('Live Game Wall',visibleGames.length?`<div class="live-command-grid">${visibleGames.map(liveCommandGameCard).join('')}</div>`:empty('No games match the current filters','Change filters or connect the scores provider.'),'wide')}

    ${card('Command Alerts',liveCommandAlertRows(),'wide')}
    ${card('Top 25 Rankings',liveCommandRankingsPanel())}

    ${card('Feed Readiness',`<div class="release-status-list">
      ${[
        ['Scores & schedule',liveDataAdapter?.('scores')?.configured,'Required for real-time games'],
        ['Rankings',liveDataAdapter?.('rankings')?.configured,'Top 25 panel'],
        ['Weather',liveDataAdapter?.('weather')?.configured,'Outdoor game conditions'],
        ['Availability',liveDataAdapter?.('availability')?.configured,'Player availability']
      ].map(([name,ok,detail])=>`<div class="release-status-row ${ok?'quality-pass':'quality-warn'}"><span>${ok?'✓':'△'} ${esc(name)}<small>${esc(detail)}</small></span><strong>${ok?'READY':'NOT CONNECTED'}</strong></div>`).join('')}
    </div>`)}
  </div>`;
}

function updateLiveCommandSetting(id,key,type='checked'){
  if(!$(id))return;
  $(id).onchange=event=>{
    liveCommandState[key]=type==='number'?Number(event.target.value):type==='value'?event.target.value:event.target.checked;
    saveLiveCommandState();
    startLiveCommandTimer();
    renderPage();
  };
}

function bindLiveCommandCenter(){
  updateLiveCommandSetting('liveCommandAutoRefresh','autoRefresh');
  updateLiveCommandSetting('liveCommandRefreshSeconds','refreshSeconds','number');
  updateLiveCommandSetting('liveCommandShowLive','showLive');
  updateLiveCommandSetting('liveCommandShowUpcoming','showUpcoming');
  updateLiveCommandSetting('liveCommandShowFinals','showFinals');
  updateLiveCommandSetting('liveCommandFavoriteOnly','favoriteOnly');
  updateLiveCommandSetting('liveCommandCompact','compactCards');
  updateLiveCommandSetting('liveCommandCloseMargin','alertCloseMargin','number');
  updateLiveCommandSetting('liveCommandFourthAlert','alertFourthQuarter');
  updateLiveCommandSetting('liveCommandUpsetAlert','alertUpsets');
  updateLiveCommandSetting('liveCommandWeatherAlert','alertWeather');

  if($('liveCommandRefresh'))$('liveCommandRefresh').onclick=async()=>{
    if(typeof runLiveDataCycle==='function')await runLiveDataCycle();
    evaluateLiveCommandAlerts();
    renderPage();
    toast('Live Command Center refreshed');
  };

  if($('liveCommandFullscreen'))$('liveCommandFullscreen').onclick=async()=>{
    try{
      if(!document.fullscreenElement){
        await document.documentElement.requestFullscreen?.();
        document.documentElement.classList.add('live-command-root');
        document.body.classList.add('live-command-fullscreen');
        document.documentElement.style.height='100%';
        document.body.style.height='100%';
      }else{
        await document.exitFullscreen?.();
      }
      window.dispatchEvent(new Event('resize'));
      setTimeout(()=>window.dispatchEvent(new Event('resize')),120);
    }catch(error){
      toast(error?.message||'Could not enter Command Mode','error');
    }
  };

  document.onfullscreenchange=()=>{
    if(!document.fullscreenElement){
      document.documentElement.classList.remove('live-command-root');
      document.body.classList.remove('live-command-fullscreen');
      document.documentElement.style.height='';
      document.body.style.height='';
      window.dispatchEvent(new Event('resize'));
    }
  };

  if($('liveCommandClearAlerts'))$('liveCommandClearAlerts').onclick=()=>{
    liveCommandAlerts=[];
    saveLiveCommandState();
    renderPage();
    toast('Command alerts cleared');
  };

  document.querySelectorAll('[data-dismiss-live-alert]').forEach(button=>{
    button.onclick=()=>{
      const alert=liveCommandAlerts.find(item=>item.id===button.dataset.dismissLiveAlert);
      if(alert)alert.active=false;
      saveLiveCommandState();
      renderPage();
    };
  });

  document.querySelectorAll('[data-live-game]').forEach(button=>{
    button.onclick=()=>{
      openUltimateGameHub(button.dataset.liveGame);
    };
  });

  document.querySelectorAll('[data-live-predict]').forEach(button=>{
    sessionStorage.setItem('onlybeats.selected-game',button.dataset.livePredict);
    button.onclick=()=>navigate('predictions');
  });
}

function startLiveCommandTimer(){
  clearInterval(liveCommandTimer);
  if(!liveCommandState.autoRefresh)return;

  liveCommandTimer=setInterval(async()=>{
    if(document.hidden||!navigator.onLine)return;
    if(typeof runLiveDataCycle==='function')await runLiveDataCycle(['scores','weather','rankings']);
    evaluateLiveCommandAlerts();
    if(currentPage==='livecommand')renderPage();
  },Math.max(15,Number(liveCommandState.refreshSeconds)||30)*1000);
}

function installLiveCommandStyles(){
  if(document.getElementById('onlybeatsLiveCommandStyles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsLiveCommandStyles';
  style.textContent=`
    .live-command-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
    .live-command-game{padding:16px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(255,255,255,.025)}
    .live-command-game.compact{padding:10px}
    .live-command-game-head,.live-command-team-row,.live-command-meta{display:flex;justify-content:space-between;gap:12px}
    .live-command-game-head{align-items:center;margin-bottom:12px}
    .live-command-game-head small{display:block;color:#9aabbd;margin-top:5px}
    .live-command-team-row{align-items:center;padding:10px 0;border-top:1px solid rgba(255,255,255,.06)}
    .live-command-team-row b{font-size:1.45rem}
    .live-command-team-row small{display:block;color:#9aabbd}
    .live-command-meta{flex-direction:column;color:#9aabbd;font-size:.82rem;margin:10px 0}
    .rankings-command-list{display:grid;gap:7px}
    .rankings-command-row{display:grid;grid-template-columns:36px 1fr auto;gap:10px;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.025)}
    .provider-badge.alert,.prediction-losing,.prediction-incorrect{border-color:#ff6b6b;color:#ff8a8a}
    .prediction-winning,.prediction-correct{border-color:#54d38a;color:#72e7a3}
    .prediction-tied,.prediction-push{border-color:#f4bd45;color:#f4bd45}
    .command-ticker{position:sticky;top:0;z-index:80;display:flex;gap:18px;align-items:center;min-height:42px;padding:9px 14px;background:#0b1119;border:1px solid rgba(255,255,255,.08);border-radius:12px;margin-bottom:12px;overflow:hidden}
    .command-ticker strong{white-space:nowrap;color:#f4bd45}
    .command-ticker-track{display:flex;gap:30px;min-width:max-content;animation:onlybeatsTicker 28s linear infinite}
    .command-ticker-track span{white-space:nowrap;color:#d9e2ec}
    @keyframes onlybeatsTicker{from{transform:translateX(0)}to{transform:translateX(-45%)}}
    .saturday-mode-header{display:none;align-items:center;justify-content:space-between;padding:10px 4px 16px}
    .saturday-mode-header h2{margin:2px 0 0}
    .saturday-clock{font-size:1.8rem;font-weight:800;color:#f4bd45}
    .prediction-health-panel{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.025);margin-bottom:14px}
    .prediction-health-panel h3{font-size:2rem;margin:2px 0}
    .prediction-health-bar{height:12px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
    .prediction-health-bar span{display:block;height:100%;background:#f4bd45;border-radius:99px}
    .prediction-health-counts{display:grid;grid-template-columns:repeat(2,auto);gap:8px 16px}
    .prediction-health-counts span{color:#9aabbd}.prediction-health-counts strong{color:#fff;margin-left:5px}
    .live-command-root,.live-command-root body{width:100%;height:100%;min-height:100%;overflow:hidden}
    .live-command-fullscreen{margin:0!important;padding:0!important;overflow:hidden!important;background:#080d14}
    .live-command-fullscreen .sidebar,
    .live-command-fullscreen header,
    .live-command-fullscreen .topbar,
    .live-command-fullscreen .statusbar,
    .live-command-fullscreen .mobile-bottom-nav{display:none!important}
    .live-command-fullscreen .app-shell{display:block!important;width:100vw!important;height:100vh!important;min-height:100vh!important;max-height:100vh!important;overflow:hidden!important}
    .live-command-fullscreen main{display:block!important;width:100vw!important;height:100vh!important;min-height:100vh!important;max-width:none!important;overflow-y:auto!important;overflow-x:hidden!important;padding:18px!important;box-sizing:border-box!important}
    .live-command-fullscreen .content{width:100%!important;max-width:none!important;min-height:100%!important;padding:0!important}
    .live-command-fullscreen .saturday-mode-header{display:flex}
    .live-command-fullscreen .intel-hero{display:none}
    .live-command-fullscreen .metric-grid{grid-template-columns:repeat(6,minmax(120px,1fr))}
    .live-command-fullscreen .reports-grid{grid-template-columns:320px minmax(0,1fr) 340px;align-items:start}
    .live-command-fullscreen .card.wide{grid-column:2}
    .live-command-fullscreen .live-command-grid{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
    .live-command-fullscreen .command-ticker{top:0;border-radius:0;margin:-18px -18px 14px}
    @media(max-width:1400px){
      .live-command-fullscreen .reports-grid{grid-template-columns:280px minmax(0,1fr)}
      .live-command-fullscreen .card.wide{grid-column:auto}
      .live-command-fullscreen .metric-grid{grid-template-columns:repeat(3,minmax(140px,1fr))}
    }
    @media(max-width:900px){
      .prediction-health-panel{grid-template-columns:1fr}
      .prediction-health-counts{grid-template-columns:repeat(4,1fr)}
      .live-command-fullscreen .reports-grid{grid-template-columns:1fr}
      .live-command-fullscreen .metric-grid{grid-template-columns:repeat(2,minmax(120px,1fr))}
    }
    @media(max-width:700px){
      .live-command-grid{grid-template-columns:1fr}
      .prediction-health-counts{grid-template-columns:repeat(2,1fr)}
      .live-command-fullscreen main{padding:10px!important}
    }
  `;
  document.head.appendChild(style);
}

function initializeLiveCommandCenter(){
  loadLiveCommandState();
  installLiveCommandStyles();
  evaluateLiveCommandAlerts();
  startLiveCommandTimer();

  window.addEventListener('online',()=>{
    if(liveCommandState.autoRefresh&&typeof runLiveDataCycle==='function'){
      runLiveDataCycle(['scores','weather','rankings']);
    }
  });
}
