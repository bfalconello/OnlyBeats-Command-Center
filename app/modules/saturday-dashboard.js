'use strict';

// OnlyBeats v3.4 Saturday Dashboard.
// A unified game-day overview built from local predictions, combinations,
// provider game data, rankings, and weather when available.

let saturdayDashboardState={
  autoRefresh:true,
  refreshSeconds:30,
  rankedOnly:false,
  favoritesOnly:false,
  trackedOnly:false,
  showFinals:true,
  showWeather:true,
  showCombos:true,
  compact:false,
  maximumGames:30,
  lastRefreshAt:null
};

let saturdayDashboardTimer=null;

function loadSaturdayDashboardState(){
  try{
    saturdayDashboardState={
      ...saturdayDashboardState,
      ...JSON.parse(localStorage.getItem(SATURDAY_DASHBOARD_KEY)||'{}')
    };
  }catch{}
}

function saveSaturdayDashboardState(){
  localStorage.setItem(SATURDAY_DASHBOARD_KEY,JSON.stringify(saturdayDashboardState));
}

function saturdayPredictionFor(gameId){
  return predictions.find(prediction=>String(prediction.gameId)===String(gameId))||null;
}

function saturdayPredictionSelection(prediction){
  return String(prediction?.team||prediction?.selection||prediction?.pick||'');
}

function saturdayPredictionStatus(game,prediction){
  if(!prediction)return 'none';
  if(typeof liveCommandPredictionStatus==='function'){
    return liveCommandPredictionStatus(game,prediction);
  }

  const status=String(prediction.status||prediction.result||'pending').toLowerCase();
  if(['correct','won','win'].includes(status))return 'correct';
  if(['incorrect','lost','loss'].includes(status))return 'incorrect';
  if(['push','tie'].includes(status))return 'push';
  return 'pending';
}

function saturdayWeatherFor(game){
  if(!saturdayDashboardState.showWeather)return null;
  if(typeof liveCommandWeatherFor==='function')return liveCommandWeatherFor(game);
  const rows=window.ONLYBEATS_NORMALIZED_WEATHER||[];
  return rows.find(row=>String(row.gameId||'')===String(game.id||''))||null;
}

function saturdayKickoff(game){
  const time=new Date(game.date);
  if(!Number.isFinite(time.getTime()))return 'Time unavailable';

  const difference=time.getTime()-Date.now();
  if(game.state==='in')return String(game.status||'Live');
  if(game.state==='post')return 'Final';
  if(difference<=0)return 'Starting soon';

  const minutes=Math.floor(difference/60000);
  if(minutes<60)return `${minutes}m`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours}h ${minutes%60}m`;
  const days=Math.floor(hours/24);
  return `${days}d ${hours%24}h`;
}

function saturdayUpsetModel(game){
  if(typeof liveCommandUpsetScore==='function'){
    return liveCommandUpsetScore(game);
  }
  return {score:0,favorite:'',underdog:''};
}

function saturdayGameMargin(game){
  if(game.state!=='in'&&game.state!=='post')return null;
  return Math.abs((Number(game.away?.score)||0)-(Number(game.home?.score)||0));
}

function saturdayIsRanked(game){
  return Boolean(Number(game.away?.rank)||Number(game.home?.rank));
}

function saturdayIsFavoriteGame(game){
  return Boolean(
    favorites.includes?.(game.away?.abbr)||
    favorites.includes?.(game.home?.abbr)
  );
}

function saturdayTracked(game){
  return Boolean(saturdayPredictionFor(game.id));
}

function saturdayVisibleGames(){
  return games
    .filter(game=>{
      if(!saturdayDashboardState.showFinals&&game.state==='post')return false;
      if(saturdayDashboardState.rankedOnly&&!saturdayIsRanked(game))return false;
      if(saturdayDashboardState.favoritesOnly&&!saturdayIsFavoriteGame(game))return false;
      if(saturdayDashboardState.trackedOnly&&!saturdayTracked(game))return false;
      return true;
    })
    .sort((a,b)=>{
      const stateOrder={in:0,pre:1,post:2};
      const stateDifference=(stateOrder[a.state]??9)-(stateOrder[b.state]??9);
      if(stateDifference!==0)return stateDifference;

      if(a.state==='in'){
        const marginDifference=(saturdayGameMargin(a)??999)-(saturdayGameMargin(b)??999);
        if(marginDifference!==0)return marginDifference;
      }

      return new Date(a.date)-new Date(b.date);
    })
    .slice(0,Math.max(1,Number(saturdayDashboardState.maximumGames)||30));
}

function saturdayPredictionHealth(){
  const tracked=games
    .map(game=>({game,prediction:saturdayPredictionFor(game.id)}))
    .filter(item=>item.prediction);

  const counts={
    winning:0,
    losing:0,
    tied:0,
    pending:0,
    correct:0,
    incorrect:0,
    push:0,
    tracking:0
  };

  tracked.forEach(item=>{
    const status=saturdayPredictionStatus(item.game,item.prediction);
    counts[status]=(counts[status]||0)+1;
  });

  const active=counts.winning+counts.losing+counts.tied+counts.tracking;
  const finished=counts.correct+counts.incorrect+counts.push;
  const health=active
    ?Math.round((counts.winning+counts.tied*.5)/Math.max(1,active)*100)
    :finished
      ?Math.round((counts.correct+counts.push*.5)/Math.max(1,finished)*100)
      :0;

  return {tracked:tracked.length,counts,health};
}

function saturdayComboHealth(){
  const combos=Array.isArray(typeof predictionCombos!=='undefined'?predictionCombos:null)
    ?predictionCombos
    :[];

  return combos
    .filter(combo=>String(combo.status||'pending').toLowerCase()==='pending')
    .map(combo=>{
      const legs=Array.isArray(combo.legs)?combo.legs:[];
      const counts=legs.reduce((result,leg)=>{
        const status=String(leg.status||'pending').toLowerCase();
        result[status]=(result[status]||0)+1;
        return result;
      },{pending:0,correct:0,incorrect:0,push:0});

      const alive=!counts.incorrect;
      const finished=counts.correct+counts.push;
      const progress=legs.length?Math.round(finished/legs.length*100):0;

      return {
        combo,
        legs,
        counts,
        alive,
        progress
      };
    })
    .sort((a,b)=>{
      if(a.alive!==b.alive)return a.alive?-1:1;
      return b.progress-a.progress;
    })
    .slice(0,8);
}

function buildSaturdayDashboardModel(){
  const visible=saturdayVisibleGames();
  const live=visible.filter(game=>game.state==='in');
  const upcoming=visible.filter(game=>game.state==='pre');
  const final=visible.filter(game=>game.state==='post');
  const ranked=visible.filter(saturdayIsRanked);
  const weatherAlerts=visible
    .map(game=>({game,weather:saturdayWeatherFor(game)}))
    .filter(item=>item.weather&&(Number(item.weather.wind)>=20||Number(item.weather.precipitation)>=0.25));

  const closest=live
    .map(game=>({game,margin:saturdayGameMargin(game)}))
    .sort((a,b)=>a.margin-b.margin)
    .slice(0,8);

  const upsets=live
    .map(game=>({game,...saturdayUpsetModel(game)}))
    .filter(item=>item.score>=40)
    .sort((a,b)=>b.score-a.score)
    .slice(0,8);

  const health=saturdayPredictionHealth();
  const combos=saturdayComboHealth();

  saturdayDashboardState.lastRefreshAt=new Date().toISOString();
  saveSaturdayDashboardState();

  return {
    visible,
    live,
    upcoming,
    final,
    ranked,
    weatherAlerts,
    closest,
    upsets,
    health,
    combos
  };
}

function saturdayWeatherText(weather){
  if(!weather)return 'Weather available closer to kickoff';
  const temperature=Number.isFinite(Number(weather.temperature))
    ?`${Number(weather.temperature).toFixed(0)}°`
    :'Temperature unavailable';
  const wind=Number.isFinite(Number(weather.wind))
    ?`Wind ${Number(weather.wind).toFixed(0)} mph`
    :'';
  return [temperature,weather.condition,wind].filter(Boolean).join(' · ');
}

function saturdayGameCard(game){
  const prediction=saturdayPredictionFor(game.id);
  const predictionStatus=saturdayPredictionStatus(game,prediction);
  const weather=saturdayWeatherFor(game);
  const upset=saturdayUpsetModel(game);
  const margin=saturdayGameMargin(game);

  return `<article class="saturday-game-card ${saturdayDashboardState.compact?'compact':''}">
    <div class="saturday-game-card-head">
      <div>
        <span class="provider-badge">${game.state==='in'?'LIVE':game.state==='post'?'FINAL':'UPCOMING'}</span>
        <small>${esc(game.status||'Scheduled')} ${game.network?`· ${esc(game.network)}`:''}</small>
      </div>
      <div class="button-row">
        ${game.state==='pre'?`<span class="provider-badge">${esc(saturdayKickoff(game))}</span>`:''}
        ${margin!==null&&game.state==='in'?`<span class="provider-badge">${margin}-point game</span>`:''}
        ${upset.score>=40?`<span class="provider-badge saturday-upset">UPSET ${upset.score.toFixed(0)}</span>`:''}
      </div>
    </div>

    <div class="saturday-team-row">
      <div>
        <strong>${game.away.rank?`#${game.away.rank} `:''}${esc(game.away.shortName||game.away.name)}</strong>
        <small>${esc(game.away.abbr||'')}</small>
      </div>
      <b>${Number(game.away.score)||0}</b>
    </div>

    <div class="saturday-team-row">
      <div>
        <strong>${game.home.rank?`#${game.home.rank} `:''}${esc(game.home.shortName||game.home.name)}</strong>
        <small>${esc(game.home.abbr||'')}</small>
      </div>
      <b>${Number(game.home.score)||0}</b>
    </div>

    <div class="saturday-card-details">
      <span>${esc(game.venue||'Venue unavailable')}</span>
      <span>${esc(saturdayWeatherText(weather))}</span>
      <span>${prediction?`Prediction: ${esc(saturdayPredictionSelection(prediction))}`:'No saved prediction'}</span>
    </div>

    <div class="button-row">
      ${prediction?`<span class="provider-badge prediction-${predictionStatus}">${esc(predictionStatus.toUpperCase())}</span>`:''}
      <button class="button" data-saturday-open="${game.id}">Open game</button>
      <button class="button" data-saturday-predict="${game.id}">${prediction?'Edit prediction':'Add prediction'}</button>
    </div>
  </article>`;
}

function saturdayGameSection(title,gamesList,emptyMessage){
  return `<section class="card wide saturday-section">
    <div class="card-head">
      <div><p class="eyebrow">${esc(title.toUpperCase())}</p><h3>${gamesList.length} game${gamesList.length===1?'':'s'}</h3></div>
    </div>
    ${gamesList.length
      ?`<div class="saturday-game-grid">${gamesList.map(saturdayGameCard).join('')}</div>`
      :empty(title,emptyMessage)}
  </section>`;
}

function saturdayAlertsPanel(model){
  const items=[];

  model.upsets.forEach(item=>{
    items.push({
      icon:'△',
      title:`${item.underdog} upset watch`,
      detail:`${item.game.away.shortName} at ${item.game.home.shortName} · score ${item.score.toFixed(0)}`
    });
  });

  model.closest.forEach(item=>{
    items.push({
      icon:'•',
      title:`${item.margin}-point game`,
      detail:`${item.game.away.shortName} at ${item.game.home.shortName}`
    });
  });

  model.weatherAlerts.forEach(item=>{
    items.push({
      icon:'☁',
      title:'Weather impact watch',
      detail:`${item.game.away.shortName} at ${item.game.home.shortName} · ${saturdayWeatherText(item.weather)}`
    });
  });

  if(!items.length){
    return empty('No game-day alerts','Upsets, close games, and meaningful weather will appear here.');
  }

  return `<div class="intel-list">${items.slice(0,12).map(item=>`
    <div class="intel-row">
      <span class="intel-icon">${item.icon}</span>
      <div><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></div>
    </div>`).join('')}</div>`;
}

function saturdayComboPanel(combos){
  if(!saturdayDashboardState.showCombos){
    return empty('Combo tracking hidden','Enable combo tracking in dashboard controls.');
  }

  if(!combos.length){
    return empty('No active combos','Saved pending combinations will appear here.');
  }

  return `<div class="saturday-combo-list">${combos.map(item=>`
    <article class="saturday-combo-row">
      <div>
        <strong>${esc(item.combo.name||'Saved combo')}</strong>
        <small>${item.legs.length} legs · ${item.counts.correct||0} correct · ${item.counts.pending||0} pending</small>
      </div>
      <div class="saturday-combo-progress"><span style="width:${item.progress}%"></span></div>
      <span class="provider-badge ${item.alive?'prediction-winning':'prediction-incorrect'}">${item.alive?'ALIVE':'ENDED'}</span>
    </article>`).join('')}</div>`;
}

function saturdayDashboardPage(){
  setHeading('Saturday Dashboard','LIVE · UPCOMING · PREDICTIONS · COMBOS');
  const model=buildSaturdayDashboardModel();

  return `<section class="saturday-dashboard-hero">
    <div>
      <p class="eyebrow">GAME-DAY HOME SCREEN</p>
      <h1>Saturday at a glance.</h1>
      <p>${model.live.length} live · ${model.upcoming.length} upcoming · ${model.final.length} final · ${model.health.tracked} tracked predictions</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="saturdayRefresh">Refresh now</button>
      <button class="button" id="saturdayCommandMode">Open Command Mode</button>
      <button class="button" data-page-jump="liveprovider">Provider setup</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Live Games',model.live.length,'Current')}
    ${metric('Upcoming',model.upcoming.length,'Scheduled')}
    ${metric('Ranked Matchups',model.ranked.length,'Visible slate')}
    ${metric('Prediction Health',`${model.health.health}%`,`${model.health.counts.winning||0} winning · ${model.health.counts.losing||0} losing`)}
    ${metric('Active Combos',model.combos.length,'Pending combinations')}
    ${metric('Last Refresh',new Date(saturdayDashboardState.lastRefreshAt).toLocaleTimeString(),`${saturdayDashboardState.refreshSeconds}s interval`)}
  </div>

  <div class="reports-grid">
    ${card('Dashboard Controls',`<div class="detail-list">
      <label class="toggle-row"><span>Automatic refresh</span><input type="checkbox" id="saturdayAutoRefresh" ${saturdayDashboardState.autoRefresh?'checked':''}></label>
      <label><span>Refresh interval</span>
        <select id="saturdayRefreshSeconds">
          ${[15,30,60,120,300].map(value=>`<option value="${value}" ${Number(saturdayDashboardState.refreshSeconds)===value?'selected':''}>${value} seconds</option>`).join('')}
        </select>
      </label>
      <label class="toggle-row"><span>Ranked games only</span><input type="checkbox" id="saturdayRankedOnly" ${saturdayDashboardState.rankedOnly?'checked':''}></label>
      <label class="toggle-row"><span>Favorite teams only</span><input type="checkbox" id="saturdayFavoritesOnly" ${saturdayDashboardState.favoritesOnly?'checked':''}></label>
      <label class="toggle-row"><span>Tracked predictions only</span><input type="checkbox" id="saturdayTrackedOnly" ${saturdayDashboardState.trackedOnly?'checked':''}></label>
      <label class="toggle-row"><span>Show final games</span><input type="checkbox" id="saturdayShowFinals" ${saturdayDashboardState.showFinals?'checked':''}></label>
      <label class="toggle-row"><span>Show weather</span><input type="checkbox" id="saturdayShowWeather" ${saturdayDashboardState.showWeather?'checked':''}></label>
      <label class="toggle-row"><span>Show active combos</span><input type="checkbox" id="saturdayShowCombos" ${saturdayDashboardState.showCombos?'checked':''}></label>
      <label class="toggle-row"><span>Compact cards</span><input type="checkbox" id="saturdayCompact" ${saturdayDashboardState.compact?'checked':''}></label>
      <label><span>Maximum games</span><input id="saturdayMaximumGames" type="number" min="1" max="100" value="${saturdayDashboardState.maximumGames}"></label>
    </div>`)}

    ${card('Prediction Health',`<div class="saturday-health">
      <div><strong>${model.health.health}%</strong><small>${model.health.tracked} tracked</small></div>
      <div class="saturday-health-bar"><span style="width:${model.health.health}%"></span></div>
      <div class="saturday-health-counts">
        <span>Winning <b>${model.health.counts.winning||0}</b></span>
        <span>Losing <b>${model.health.counts.losing||0}</b></span>
        <span>Pending <b>${model.health.counts.pending||0}</b></span>
        <span>Correct <b>${model.health.counts.correct||0}</b></span>
      </div>
    </div>`)}

    ${card('Game-Day Alerts',saturdayAlertsPanel(model),'wide')}
    ${card('Active Combo Tracker',saturdayComboPanel(model.combos),'wide')}

    ${saturdayGameSection('Live Games',model.live,'Live games will move here automatically when they start.')}
    ${saturdayGameSection('Upcoming Games',model.upcoming,'No upcoming games match the current filters.')}
    ${saturdayGameSection('Final Games',model.final,'Final games will move here automatically after completion.')}
  </div>`;
}

function updateSaturdaySetting(id,key,type='checked'){
  if(!$(id))return;

  $(id).onchange=event=>{
    saturdayDashboardState[key]=type==='number'
      ?Number(event.target.value)
      :event.target.checked;
    saveSaturdayDashboardState();
    startSaturdayDashboardTimer();
    renderPage();
  };
}

function bindSaturdayDashboard(){
  updateSaturdaySetting('saturdayAutoRefresh','autoRefresh');
  updateSaturdaySetting('saturdayRefreshSeconds','refreshSeconds','number');
  updateSaturdaySetting('saturdayRankedOnly','rankedOnly');
  updateSaturdaySetting('saturdayFavoritesOnly','favoritesOnly');
  updateSaturdaySetting('saturdayTrackedOnly','trackedOnly');
  updateSaturdaySetting('saturdayShowFinals','showFinals');
  updateSaturdaySetting('saturdayShowWeather','showWeather');
  updateSaturdaySetting('saturdayShowCombos','showCombos');
  updateSaturdaySetting('saturdayCompact','compact');
  updateSaturdaySetting('saturdayMaximumGames','maximumGames','number');

  if($('saturdayRefresh'))$('saturdayRefresh').onclick=async()=>{
    const button=$('saturdayRefresh');
    button.disabled=true;
    button.textContent='Refreshing…';

    if(typeof runLiveDataCycle==='function'){
      await runLiveDataCycle(['scores','rankings','weather']);
    }

    renderPage();
    toast('Saturday Dashboard refreshed','success');
  };

  if($('saturdayCommandMode'))$('saturdayCommandMode').onclick=()=>{
    navigate('livecommand');
    setTimeout(()=>{
      const button=$('liveCommandFullscreen');
      if(button)button.click();
    },250);
  };

  document.querySelectorAll('[data-saturday-open]').forEach(button=>{
    button.onclick=()=>{
      openUltimateGameHub(button.dataset.saturdayOpen);
    };
  });

  document.querySelectorAll('[data-saturday-predict]').forEach(button=>{
    button.onclick=()=>{
      sessionStorage.setItem('onlybeats.selected-game',button.dataset.saturdayPredict);
      navigate('predictions');
    };
  });
}

function startSaturdayDashboardTimer(){
  clearInterval(saturdayDashboardTimer);
  if(!saturdayDashboardState.autoRefresh)return;

  saturdayDashboardTimer=setInterval(async()=>{
    if(document.hidden||!navigator.onLine)return;

    if(typeof runLiveDataCycle==='function'){
      await runLiveDataCycle(['scores','weather']);
    }

    if(currentPage==='saturday')renderPage();
  },Math.max(15,Number(saturdayDashboardState.refreshSeconds)||30)*1000);
}

function installSaturdayDashboardStyles(){
  if(document.getElementById('onlybeatsSaturdayDashboardStyles'))return;

  const style=document.createElement('style');
  style.id='onlybeatsSaturdayDashboardStyles';
  style.textContent=`
    .saturday-dashboard-hero{display:flex;justify-content:space-between;gap:22px;align-items:center;padding:28px;border:1px solid rgba(244,189,69,.24);border-radius:22px;background:radial-gradient(circle at 80% 10%,rgba(244,189,69,.11),transparent 38%),#101822;margin-bottom:18px}
    .saturday-dashboard-hero h1{font-size:clamp(2.2rem,5vw,4rem);line-height:1;margin:5px 0 10px}
    .saturday-game-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:14px}
    .saturday-game-card{padding:16px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(255,255,255,.025)}
    .saturday-game-card.compact{padding:10px}
    .saturday-game-card-head,.saturday-team-row{display:flex;justify-content:space-between;gap:12px;align-items:center}
    .saturday-game-card-head{margin-bottom:10px}
    .saturday-game-card-head small{display:block;color:#9aabbd;margin-top:5px}
    .saturday-team-row{padding:11px 0;border-top:1px solid rgba(255,255,255,.06)}
    .saturday-team-row b{font-size:1.55rem}
    .saturday-team-row small{display:block;color:#9aabbd}
    .saturday-card-details{display:grid;gap:6px;color:#9aabbd;font-size:.84rem;margin:12px 0}
    .saturday-upset{border-color:#ff8a8a;color:#ff8a8a}
    .saturday-health{display:grid;gap:14px}
    .saturday-health>div:first-child{display:flex;justify-content:space-between;align-items:end}
    .saturday-health>div:first-child strong{font-size:2.2rem}
    .saturday-health-bar{height:12px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
    .saturday-health-bar span{display:block;height:100%;background:#f4bd45;border-radius:99px}
    .saturday-health-counts{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
    .saturday-health-counts span{color:#9aabbd}.saturday-health-counts b{color:#fff;margin-left:5px}
    .saturday-combo-list{display:grid;gap:10px}
    .saturday-combo-row{display:grid;grid-template-columns:minmax(0,1fr) 180px auto;gap:14px;align-items:center;padding:12px;border-radius:12px;background:rgba(255,255,255,.025)}
    .saturday-combo-row small{display:block;color:#9aabbd;margin-top:3px}
    .saturday-combo-progress{height:10px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
    .saturday-combo-progress span{display:block;height:100%;background:#f4bd45;border-radius:99px}
    @media(max-width:900px){
      .saturday-dashboard-hero{align-items:flex-start;flex-direction:column}
      .saturday-combo-row{grid-template-columns:1fr}
    }
    @media(max-width:700px){
      .saturday-game-grid{grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(style);
}

function initializeSaturdayDashboard(){
  loadSaturdayDashboardState();
  installSaturdayDashboardStyles();
  startSaturdayDashboardTimer();
}
