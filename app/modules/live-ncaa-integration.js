'use strict';

// OnlyBeats v3.2.1 Stadium Weather Hotfix.
// Scores and rankings use a user-configured CollegeFootballData-compatible API.
// Weather uses Open-Meteo and does not require an API key.
// No odds, sportsbook, or wagering feeds are included.

let liveNcaaConfig={
  enabled:true,
  apiBase:'https://api.collegefootballdata.com',
  apiKey:'',
  season:new Date().getFullYear(),
  seasonType:'regular',
  week:1,
  classification:'fbs',
  scoresMode:'scoreboard',
  weatherEnabled:true,
  refreshOnStartup:true,
  lastTestAt:null,
  lastTestResult:'not-tested'
};

let liveNcaaCache={
  gameLocations:{},
  rawScoresAt:null,
  rawRankingsAt:null,
  weatherAt:null
};

let stadiumGeocodeCache={};

function loadLiveNcaaConfig(){
  try{
    liveNcaaConfig={
      ...liveNcaaConfig,
      ...JSON.parse(localStorage.getItem(LIVE_NCAA_CONFIG_KEY)||'{}')
    };
  }catch{}

  try{
    liveNcaaCache={
      ...liveNcaaCache,
      ...JSON.parse(localStorage.getItem(LIVE_NCAA_CACHE_KEY)||'{}')
    };
  }catch{}

  try{
    stadiumGeocodeCache=JSON.parse(localStorage.getItem(STADIUM_GEOCODE_CACHE_KEY)||'{}')||{};
  }catch{
    stadiumGeocodeCache={};
  }
}

function saveLiveNcaaConfig(){
  localStorage.setItem(LIVE_NCAA_CONFIG_KEY,JSON.stringify(liveNcaaConfig));
  localStorage.setItem(LIVE_NCAA_CACHE_KEY,JSON.stringify(liveNcaaCache));
  localStorage.setItem(STADIUM_GEOCODE_CACHE_KEY,JSON.stringify(stadiumGeocodeCache));
}

function liveNcaaConfigured(){
  return Boolean(
    liveNcaaConfig.enabled&&
    liveNcaaConfig.apiBase&&
    liveNcaaConfig.apiKey
  );
}

function liveNcaaHeaders(){
  return {
    Accept:'application/json',
    Authorization:`Bearer ${liveNcaaConfig.apiKey}`
  };
}

function liveNcaaUrl(path,params={}){
  const base=String(liveNcaaConfig.apiBase||'').replace(/\/+$/,'');
  const url=new URL(`${base}${path}`);
  Object.entries(params).forEach(([key,value])=>{
    if(value!==undefined&&value!==null&&value!==''){
      url.searchParams.set(key,String(value));
    }
  });
  return url.toString();
}

async function liveNcaaFetch(path,params={}){
  if(!liveNcaaConfigured()){
    throw new Error('Live NCAA provider is not configured.');
  }

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);

  try{
    const response=await fetch(liveNcaaUrl(path,params),{
      headers:liveNcaaHeaders(),
      signal:controller.signal
    });

    if(!response.ok){
      const text=await response.text().catch(()=> '');
      throw new Error(`Provider returned ${response.status}${text?`: ${text.slice(0,180)}`:''}`);
    }

    return await response.json();
  }finally{
    clearTimeout(timeout);
  }
}

function liveNcaaArray(payload){
  if(Array.isArray(payload))return payload;
  if(Array.isArray(payload?.records))return payload.records;
  if(Array.isArray(payload?.games))return payload.games;
  if(Array.isArray(payload?.data))return payload.data;
  return [];
}

function liveNcaaTeam(raw,prefix){
  const nested=raw?.[prefix]||raw?.[`${prefix}Team`]||{};
  const name=
    nested?.school||
    nested?.name||
    raw?.[`${prefix}Team`]||
    raw?.[`${prefix}School`]||
    `${prefix==='away'?'Away':'Home'} Team`;
  const abbr=
    nested?.abbreviation||
    nested?.abbr||
    raw?.[`${prefix}Abbreviation`]||
    String(name).split(/\s+/).map(part=>part[0]).join('').slice(0,5).toUpperCase();

  return {
    abbr:String(abbr||'TEAM'),
    name:String(name),
    shortName:String(nested?.shortName||nested?.school||name),
    score:Number(
      nested?.points??
      nested?.score??
      raw?.[`${prefix}Points`]??
      raw?.[`${prefix}Score`]??
      0
    )||0,
    rank:Number(
      nested?.rank??
      raw?.[`${prefix}Rank`]??
      0
    )||0
  };
}

function liveNcaaGameState(raw){
  const status=String(raw?.status||raw?.gameStatus||raw?.state||'').toLowerCase();
  const completed=Boolean(raw?.completed||raw?.isCompleted);
  const started=Boolean(raw?.started||raw?.isStarted);

  if(completed||/final|completed|post/.test(status))return 'post';
  if(started||/live|in progress|quarter|halftime|overtime/.test(status))return 'in';
  return 'pre';
}

function liveNcaaVenue(raw){
  const venue=raw?.venue||raw?.site||{};
  const name=
    venue?.name||
    venue?.stadium||
    raw?.venueName||
    raw?.stadium||
    '';
  const city=venue?.city||raw?.venueCity||raw?.city||'';
  const state=venue?.state||raw?.venueState||raw?.stateProvince||'';
  return [name,[city,state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
}

function liveNcaaCoordinates(raw){
  const venue=raw?.venue||raw?.site||{};
  const latitude=Number(
    venue?.latitude??
    venue?.lat??
    raw?.latitude??
    raw?.venueLatitude
  );
  const longitude=Number(
    venue?.longitude??
    venue?.lon??
    venue?.lng??
    raw?.longitude??
    raw?.venueLongitude
  );

  return {
    latitude:Number.isFinite(latitude)?latitude:null,
    longitude:Number.isFinite(longitude)?longitude:null,
    location:[
      venue?.name||raw?.venueName||'',
      venue?.city||raw?.venueCity||'',
      venue?.state||raw?.venueState||''
    ].filter(Boolean).join(', ')
  };
}

function normalizeCfbdGame(raw){
  const id=String(raw?.id||raw?.gameId||raw?.eventId||'');
  if(!id)return null;

  const date=
    raw?.startDate||
    raw?.startTime||
    raw?.date||
    raw?.kickoff||
    new Date().toISOString();
  const coordinates=liveNcaaCoordinates(raw);

  if(coordinates.latitude!==null&&coordinates.longitude!==null){
    liveNcaaCache.gameLocations[id]={
      ...coordinates,
      source:'provider'
    };
  }else if(typeof findBuiltInStadium==='function'){
    const away=liveNcaaTeam(raw,'away');
    const home=liveNcaaTeam(raw,'home');
    const builtIn=findBuiltInStadium([
      raw?.venueName,
      raw?.stadium,
      liveNcaaVenue(raw),
      home.name,
      home.shortName,
      home.abbr,
      away.name,
      away.shortName,
      away.abbr
    ]);

    if(builtIn){
      liveNcaaCache.gameLocations[id]={
        latitude:builtIn.latitude,
        longitude:builtIn.longitude,
        location:`${builtIn.stadium}, ${builtIn.city}, ${builtIn.state}`,
        source:'built-in-stadium-database',
        team:builtIn.team,
        stadium:builtIn.stadium
      };
    }
  }

  return {
    id,
    date:String(date),
    state:liveNcaaGameState(raw),
    status:String(
      raw?.status||
      raw?.detail||
      raw?.clock||
      raw?.period||
      'Scheduled'
    ),
    network:String(
      raw?.tv||
      raw?.network||
      raw?.broadcast||
      ''
    ),
    venue:liveNcaaVenue(raw),
    away:liveNcaaTeam(raw,'away'),
    home:liveNcaaTeam(raw,'home')
  };
}

async function fetchCfbdScores(){
  const params=liveNcaaConfig.scoresMode==='week'
    ?{
        year:liveNcaaConfig.season,
        seasonType:liveNcaaConfig.seasonType,
        week:liveNcaaConfig.week,
        classification:liveNcaaConfig.classification
      }
    :{
        classification:liveNcaaConfig.classification
      };

  const endpoint=liveNcaaConfig.scoresMode==='week'?'/games':'/scoreboard';
  const payload=await liveNcaaFetch(endpoint,params);
  const rows=liveNcaaArray(payload).map(normalizeCfbdGame).filter(Boolean);

  liveNcaaCache.rawScoresAt=new Date().toISOString();
  saveLiveNcaaConfig();
  return rows;
}

function normalizeCfbdRanking(raw){
  const polls=Array.isArray(raw?.polls)?raw.polls:[];
  const preferred=
    polls.find(poll=>/ap top 25/i.test(String(poll?.poll)))||
    polls.find(poll=>/college football playoff/i.test(String(poll?.poll)))||
    polls[0];

  if(preferred){
    return liveNcaaArray(preferred?.ranks||preferred?.rankings).map(row=>({
      rank:Number(row?.rank)||0,
      team:String(row?.school||row?.team||row?.name||''),
      abbr:String(row?.abbreviation||row?.abbr||''),
      record:String(row?.record||''),
      points:Number(row?.points)||0,
      source:String(preferred?.poll||'College Football Data')
    })).filter(row=>row.rank&&row.team);
  }

  if(raw?.rank||raw?.team||raw?.school){
    return [{
      rank:Number(raw?.rank)||0,
      team:String(raw?.team||raw?.school||raw?.name||''),
      abbr:String(raw?.abbreviation||raw?.abbr||''),
      record:String(raw?.record||''),
      points:Number(raw?.points)||0,
      source:String(raw?.poll||raw?.source||'College Football Data')
    }].filter(row=>row.rank&&row.team);
  }

  return [];
}

async function fetchCfbdRankings(){
  const payload=await liveNcaaFetch('/rankings',{
    year:liveNcaaConfig.season,
    seasonType:liveNcaaConfig.seasonType,
    week:liveNcaaConfig.week
  });

  const records=liveNcaaArray(payload).flatMap(normalizeCfbdRanking);
  liveNcaaCache.rawRankingsAt=new Date().toISOString();
  saveLiveNcaaConfig();
  return records;
}

function weatherCodeLabel(code){
  const value=Number(code);
  if(value===0)return 'Clear';
  if([1,2,3].includes(value))return 'Partly cloudy';
  if([45,48].includes(value))return 'Fog';
  if([51,53,55,56,57].includes(value))return 'Drizzle';
  if([61,63,65,66,67].includes(value))return 'Rain';
  if([71,73,75,77].includes(value))return 'Snow';
  if([80,81,82].includes(value))return 'Showers';
  if([85,86].includes(value))return 'Snow showers';
  if([95,96,99].includes(value))return 'Thunderstorms';
  return 'Forecast';
}


async function geocodeStadiumQuery(query){
  const normalized=stadiumNormalize(query);
  if(!normalized)return null;

  if(stadiumGeocodeCache[normalized]){
    return stadiumGeocodeCache[normalized];
  }

  const url=new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name',query);
  url.searchParams.set('count','1');
  url.searchParams.set('language','en');
  url.searchParams.set('format','json');

  try{
    const response=await fetch(url.toString());
    if(!response.ok)return null;
    const payload=await response.json();
    const result=Array.isArray(payload?.results)?payload.results[0]:null;
    if(!result)return null;

    const location={
      latitude:Number(result.latitude),
      longitude:Number(result.longitude),
      location:[result.name,result.admin1,result.country_code].filter(Boolean).join(', '),
      source:'open-meteo-geocoder'
    };

    if(!Number.isFinite(location.latitude)||!Number.isFinite(location.longitude)){
      return null;
    }

    stadiumGeocodeCache[normalized]=location;
    saveLiveNcaaConfig();
    return location;
  }catch{
    return null;
  }
}

async function resolveMissingGameLocations(){
  const missing=games.filter(game=>!liveNcaaCache.gameLocations?.[game.id]).slice(0,12);

  for(const game of missing){
    let location=null;

    if(typeof findBuiltInStadium==='function'){
      const builtIn=findBuiltInStadium([
        game.venue,
        game.home?.name,
        game.home?.shortName,
        game.home?.abbr,
        game.away?.name,
        game.away?.shortName,
        game.away?.abbr
      ]);

      if(builtIn){
        location={
          latitude:builtIn.latitude,
          longitude:builtIn.longitude,
          location:`${builtIn.stadium}, ${builtIn.city}, ${builtIn.state}`,
          source:'built-in-stadium-database',
          team:builtIn.team,
          stadium:builtIn.stadium
        };
      }
    }

    if(!location){
      const query=[
        game.venue,
        game.home?.name,
        'football stadium'
      ].filter(Boolean).join(' ');

      location=await geocodeStadiumQuery(query);
    }

    if(location){
      liveNcaaCache.gameLocations[game.id]=location;
      saveLiveNcaaConfig();
    }
  }
}

async function fetchOpenMeteoWeather(){
  if(!liveNcaaConfig.weatherEnabled)return [];

  await resolveMissingGameLocations();

  const locations=Object.values(liveNcaaCache.gameLocations||{})
    .filter(item=>Number.isFinite(item.latitude)&&Number.isFinite(item.longitude));

  const unique=[];
  const seen=new Set();
  locations.forEach(location=>{
    const key=`${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}`;
    if(!seen.has(key)){
      seen.add(key);
      unique.push(location);
    }
  });

  const selected=unique.slice(0,20);
  const records=[];

  for(const location of selected){
    const url=new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude',String(location.latitude));
    url.searchParams.set('longitude',String(location.longitude));
    url.searchParams.set('current','temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m');
    url.searchParams.set('temperature_unit','fahrenheit');
    url.searchParams.set('wind_speed_unit','mph');
    url.searchParams.set('timezone','auto');

    const response=await fetch(url.toString());
    if(!response.ok)continue;
    const payload=await response.json();
    const current=payload?.current||{};

    records.push({
      location:location.location||`${location.latitude}, ${location.longitude}`,
      temperature:Number(current.temperature_2m),
      wind:Number(current.wind_speed_10m),
      gust:Number(current.wind_gusts_10m),
      precipitation:Number(current.precipitation),
      condition:weatherCodeLabel(current.weather_code),
      observedAt:String(current.time||new Date().toISOString())
    });
  }

  liveNcaaCache.weatherAt=new Date().toISOString();
  saveLiveNcaaConfig();
  return records;
}

function registerLiveNcaaProviders(){
  window.ONLYBEATS_LIVE_DATA_PROVIDERS=
    window.ONLYBEATS_LIVE_DATA_PROVIDERS||{};

  window.ONLYBEATS_LIVE_DATA_PROVIDERS.scores={
    id:'scores',
    name:'College Football Data',
    configured:liveNcaaConfigured(),
    licensed:false,
    intervalSeconds:30,
    fetch:fetchCfbdScores
  };

  window.ONLYBEATS_LIVE_DATA_PROVIDERS.rankings={
    id:'rankings',
    name:'College Football Data',
    configured:liveNcaaConfigured(),
    licensed:false,
    intervalSeconds:900,
    fetch:fetchCfbdRankings
  };

  window.ONLYBEATS_LIVE_DATA_PROVIDERS.weather={
    id:'weather',
    name:'Open-Meteo',
    configured:Boolean(liveNcaaConfig.weatherEnabled),
    licensed:false,
    intervalSeconds:600,
    fetch:fetchOpenMeteoWeather
  };

  window.ONLYBEATS_LIVE_DATA_PROVIDERS.availability={
    id:'availability',
    name:'Manual entries',
    configured:false,
    licensed:false,
    intervalSeconds:300,
    async fetch(){
      return [];
    }
  };
}

async function testLiveNcaaConnection(){
  if(!liveNcaaConfigured()){
    throw new Error('Enter an API key before testing.');
  }

  const started=performance.now();
  const payload=await liveNcaaFetch('/scoreboard',{
    classification:liveNcaaConfig.classification
  });
  const count=liveNcaaArray(payload).length;

  liveNcaaConfig.lastTestAt=new Date().toISOString();
  liveNcaaConfig.lastTestResult=`Connected · ${count} scoreboard records · ${Math.round(performance.now()-started)} ms`;
  saveLiveNcaaConfig();
  registerLiveNcaaProviders();

  return {count,duration:Math.round(performance.now()-started)};
}

function liveNcaaStatusRows(){
  const feeds=[
    ['Scores & schedule','scores','College Football Data API key'],
    ['Rankings','rankings','College Football Data API key'],
    ['Weather','weather','Open-Meteo, no key required'],
    ['Player availability','availability','Manual entries until a provider is connected']
  ];

  return `<div class="release-status-list">${feeds.map(([label,id,detail])=>{
    const adapter=liveDataAdapter(id);
    const state=liveDataProviderState(id);
    return `<div class="release-status-row ${adapter.configured?'quality-pass':'quality-warn'}">
      <span>${adapter.configured?'✓':'△'} ${esc(label)}<small>${esc(adapter.name)} · ${esc(detail)} · ${esc(state.status)}</small></span>
      <strong>${adapter.configured?'READY':'NOT CONNECTED'}</strong>
    </div>`;
  }).join('')}</div>`;
}

function liveNcaaSetupPage(){
  setHeading('Live NCAA Setup','SCORES · RANKINGS · WEATHER');
  const providers=startupProviderSummary();
  const keyDisplay=liveNcaaConfig.apiKey?'Configured':'Not entered';

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">LIVE NCAA INTEGRATION</p>
      <h2>${liveNcaaConfigured()?'College-football provider is configured.':'Connect live scores and rankings.'}</h2>
      <p>OnlyBeats can pull college-football scores and rankings from a configured provider and weather forecasts from Open-Meteo. Provider credentials stay on this computer.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="liveNcaaTest" ${liveNcaaConfig.apiKey?'':'disabled'}>Test connection</button>
      <button class="button" id="liveNcaaRefreshAll">Refresh all feeds</button>
      <button class="button" data-page-jump="platform">Open Data Platform</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Provider Key',keyDisplay,'Stored locally on this computer')}
    ${metric('Configured Feeds',`${providers.configured}/${providers.total}`,'Startup provider check')}
    ${metric('Season',liveNcaaConfig.season,`${liveNcaaConfig.seasonType} · Week ${liveNcaaConfig.week}`)}
    ${metric('Scores Mode',liveNcaaConfig.scoresMode==='scoreboard'?'Live scoreboard':'Season week','Refresh source')}
    ${metric('Weather',liveNcaaConfig.weatherEnabled?'Enabled':'Disabled','Open-Meteo')}
    ${metric('Last Test',liveNcaaConfig.lastTestAt?new Date(liveNcaaConfig.lastTestAt).toLocaleString():'Never',liveNcaaConfig.lastTestResult)}
  </div>

  <div class="reports-grid">
    ${card('Provider Configuration',`<div class="detail-list">
      <label class="toggle-row"><span>Enable Live NCAA provider</span><input type="checkbox" id="liveNcaaEnabled" ${liveNcaaConfig.enabled?'checked':''}></label>
      <label><span>API base URL</span><input id="liveNcaaBase" value="${esc(liveNcaaConfig.apiBase)}"></label>
      <label><span>API key</span><input id="liveNcaaKey" type="password" value="${esc(liveNcaaConfig.apiKey)}" placeholder="Paste provider API key"></label>
      <label><span>Season</span><input id="liveNcaaSeason" type="number" min="2000" max="2100" value="${liveNcaaConfig.season}"></label>
      <label><span>Season type</span>
        <select id="liveNcaaSeasonType">
          <option value="regular" ${liveNcaaConfig.seasonType==='regular'?'selected':''}>Regular season</option>
          <option value="postseason" ${liveNcaaConfig.seasonType==='postseason'?'selected':''}>Postseason</option>
        </select>
      </label>
      <label><span>Week</span><input id="liveNcaaWeek" type="number" min="1" max="30" value="${liveNcaaConfig.week}"></label>
      <label><span>Scores source</span>
        <select id="liveNcaaScoresMode">
          <option value="scoreboard" ${liveNcaaConfig.scoresMode==='scoreboard'?'selected':''}>Current scoreboard</option>
          <option value="week" ${liveNcaaConfig.scoresMode==='week'?'selected':''}>Selected season week</option>
        </select>
      </label>
      <label class="toggle-row"><span>Enable weather forecasts</span><input type="checkbox" id="liveNcaaWeather" ${liveNcaaConfig.weatherEnabled?'checked':''}></label>
      <label class="toggle-row"><span>Refresh feeds during startup</span><input type="checkbox" id="liveNcaaStartupRefresh" ${liveNcaaConfig.refreshOnStartup?'checked':''}></label>
      <button class="button primary" id="liveNcaaSave">Save provider settings</button>
    </div>`)}

    ${card('Feed Readiness',liveNcaaStatusRows())}

    ${card('Latest Data Cache',`<div class="detail-list">
      <div><span>Scoreboard</span><strong>${liveNcaaCache.rawScoresAt?new Date(liveNcaaCache.rawScoresAt).toLocaleString():'Not refreshed'}</strong></div>
      <div><span>Rankings</span><strong>${liveNcaaCache.rawRankingsAt?new Date(liveNcaaCache.rawRankingsAt).toLocaleString():'Not refreshed'}</strong></div>
      <div><span>Weather</span><strong>${liveNcaaCache.weatherAt?new Date(liveNcaaCache.weatherAt).toLocaleString():'Not refreshed'}</strong></div>
      <div><span>Resolved game venues</span><strong>${Object.keys(liveNcaaCache.gameLocations||{}).length}</strong></div>
      <div><span>Built-in stadiums</span><strong>${Array.isArray(window.ONLYBEATS_FBS_STADIUMS)?window.ONLYBEATS_FBS_STADIUMS.length:0}</strong></div>
      <div><span>Geocoder cache</span><strong>${Object.keys(stadiumGeocodeCache||{}).length}</strong></div>
    </div>`)}

    ${card('Data and Privacy Notes',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>No odds or wagering feeds</strong><small>This integration is limited to scores, schedules, rankings, and weather.</small></div></div>
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Built-in stadium weather fallback</strong><small>OnlyBeats includes a bundled FBS stadium coordinate list and a cached geocoder for newer venues.</small></div></div>
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Weather requires no key</strong><small>Open-Meteo forecasts are requested from resolved stadium coordinates.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>API key is stored locally</strong><small>Do not share exported settings files containing a provider key.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Player availability remains manual</strong><small>No injury or roster feed is connected in this release.</small></div></div>
    </div>`,'wide')}
  </div>`;
}

function readLiveNcaaForm(){
  liveNcaaConfig.enabled=$('liveNcaaEnabled')?.checked??liveNcaaConfig.enabled;
  liveNcaaConfig.apiBase=$('liveNcaaBase')?.value.trim()||liveNcaaConfig.apiBase;
  liveNcaaConfig.apiKey=$('liveNcaaKey')?.value.trim()||'';
  liveNcaaConfig.season=Math.max(2000,Math.min(2100,Number($('liveNcaaSeason')?.value)||new Date().getFullYear()));
  liveNcaaConfig.seasonType=$('liveNcaaSeasonType')?.value||'regular';
  liveNcaaConfig.week=Math.max(1,Math.min(30,Number($('liveNcaaWeek')?.value)||1));
  liveNcaaConfig.scoresMode=$('liveNcaaScoresMode')?.value||'scoreboard';
  liveNcaaConfig.weatherEnabled=$('liveNcaaWeather')?.checked??true;
  liveNcaaConfig.refreshOnStartup=$('liveNcaaStartupRefresh')?.checked??true;
}

function bindLiveNcaaSetup(){
  if($('liveNcaaSave'))$('liveNcaaSave').onclick=()=>{
    readLiveNcaaForm();
    saveLiveNcaaConfig();
    registerLiveNcaaProviders();
    startLiveDataScheduler();
    toast('Live NCAA provider settings saved','success');
    renderPage();
  };

  if($('liveNcaaTest'))$('liveNcaaTest').onclick=async()=>{
    readLiveNcaaForm();
    saveLiveNcaaConfig();
    const button=$('liveNcaaTest');
    button.disabled=true;
    button.textContent='Testing…';
    try{
      const result=await testLiveNcaaConnection();
      toast(`Provider connected · ${result.count} records`,'success');
      renderPage();
    }catch(error){
      liveNcaaConfig.lastTestAt=new Date().toISOString();
      liveNcaaConfig.lastTestResult=error?.message||String(error);
      saveLiveNcaaConfig();
      toast(liveNcaaConfig.lastTestResult,'error');
      renderPage();
    }
  };

  if($('liveNcaaRefreshAll'))$('liveNcaaRefreshAll').onclick=async()=>{
    const button=$('liveNcaaRefreshAll');
    button.disabled=true;
    button.textContent='Refreshing…';
    const results=await runLiveDataCycle(['scores','rankings','weather']);
    const success=results.filter(result=>result.ok).length;
    toast(`${success}/3 live feeds refreshed`,success?'success':'error');
    renderPage();
  };
}

function initializeLiveNcaaIntegration(){
  loadLiveNcaaConfig();
  registerLiveNcaaProviders();

  if(liveNcaaConfig.refreshOnStartup&&navigator.onLine){
    setTimeout(()=>{
      const feeds=['weather'];
      if(liveNcaaConfigured())feeds.unshift('scores','rankings');
      runLiveDataCycle(feeds);
    },3200);
  }
}
