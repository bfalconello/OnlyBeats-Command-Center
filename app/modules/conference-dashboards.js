'use strict';

// OnlyBeats v4.4 Conference Dashboards.

let conferenceDashboardState={
  selectedConference:'',
  includeUnknown:false,
  showFinals:true,
  showUpcoming:true,
  lastViewedAt:null
};

function loadConferenceDashboardState(){
  try{
    conferenceDashboardState={...conferenceDashboardState,...JSON.parse(localStorage.getItem(CONFERENCE_DASHBOARDS_KEY)||'{}')};
  }catch{}
}

function saveConferenceDashboardState(){
  conferenceDashboardState.lastViewedAt=new Date().toISOString();
  localStorage.setItem(CONFERENCE_DASHBOARDS_KEY,JSON.stringify(conferenceDashboardState));
}

function conferenceTeams(conference){
  return allKnownTeams().filter(team=>team.conference===conference);
}

function gameConference(game){
  const away=intelligenceConference(game.away?.abbr||game.away?.name);
  const home=intelligenceConference(game.home?.abbr||game.home?.name);
  return {away,home};
}

function buildConferenceDashboard(conference){
  const teams=conferenceTeams(conference);
  const teamAliasesSet=new Set(teams.flatMap(team=>teamAliases(team)));

  const schedule=games.filter(game=>{
    const values=[
      game.away?.abbr,game.away?.name,game.away?.shortName,
      game.home?.abbr,game.home?.name,game.home?.shortName
    ].map(value=>String(value||'').toLowerCase());
    return values.some(value=>teamAliasesSet.has(value));
  });

  const live=schedule.filter(game=>game.state==='in');
  const upcoming=schedule.filter(game=>game.state==='pre');
  const final=schedule.filter(game=>game.state==='post');
  const rankedTeams=teams.filter(team=>team.rank);

  const predictionsInConference=predictions.filter(prediction=>{
    const selection=intelligenceSelection(prediction);
    return intelligenceConference(selection)===conference;
  });

  const record=intelligenceRecord(
    predictionsInConference
      .map(prediction=>({status:intelligenceStatus(prediction)}))
      .filter(row=>['correct','incorrect','push'].includes(row.status))
  );

  return {conference,teams,schedule,live,upcoming,final,rankedTeams,predictionsInConference,record};
}

function conferenceScheduleList(gamesList){
  if(!gamesList.length)return empty('No games','No matching games are loaded for this section.');

  return `<div class="intel-list">${gamesList.slice(0,30).map(game=>`
    <div class="intel-row">
      <span class="intel-icon">${game.state==='in'?'●':game.state==='post'?'✓':'•'}</span>
      <div>
        <strong>${esc(game.away.shortName)} at ${esc(game.home.shortName)}</strong>
        <small>${new Date(game.date).toLocaleString()} · ${esc(game.status||'Scheduled')} · ${esc(game.network||'Network unavailable')}</small>
      </div>
      <button class="button" data-conference-game="${game.id}">Open</button>
    </div>`).join('')}</div>`;
}

function conferenceDashboardsPage(){
  setHeading('Conference Dashboards','TEAMS · GAMES · PREDICTION HISTORY');
  const conferences=allKnownConferences();
  if(!conferenceDashboardState.selectedConference&&conferences.length){
    conferenceDashboardState.selectedConference=
      favoritesWatchlistsState.favoriteConferences[0]||
      conferences[0];
  }

  const model=buildConferenceDashboard(conferenceDashboardState.selectedConference);
  saveConferenceDashboardState();

  return `<section class="conference-hero">
    <div>
      <p class="eyebrow">CONFERENCE COMMAND VIEW</p>
      <h1>${esc(model.conference||'Conference')}</h1>
      <p>${model.teams.length} teams · ${model.live.length} live · ${model.upcoming.length} upcoming · ${model.record.rate.toFixed(1)}% prediction accuracy</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="conferenceFavorite">${favoritesWatchlistsState.favoriteConferences.includes(model.conference)?'Remove favorite':'Favorite conference'}</button>
      <button class="button" data-page-jump="favoriteshub">Favorites</button>
      <button class="button" data-page-jump="teamprofiles">Team Profiles</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Teams',model.teams.length,'Known teams')}
    ${metric('Live Games',model.live.length,'Current')}
    ${metric('Upcoming',model.upcoming.length,'Scheduled')}
    ${metric('Final',model.final.length,'Loaded finals')}
    ${metric('Ranked Teams',model.rankedTeams.length,'Current metadata')}
    ${metric('Prediction Record',`${model.record.correct}-${model.record.incorrect}`,`${model.record.rate.toFixed(1)}%`)}
  </div>

  <div class="reports-grid">
    ${card('Conference Controls',`<div class="detail-list">
      <label><span>Conference</span><select id="conferenceSelect">${conferences.map(conference=>`<option value="${esc(conference)}" ${conference===model.conference?'selected':''}>${esc(conference)}</option>`).join('')}</select></label>
      <label class="toggle-row"><span>Show final games</span><input id="conferenceShowFinals" type="checkbox" ${conferenceDashboardState.showFinals?'checked':''}></label>
      <label class="toggle-row"><span>Show upcoming games</span><input id="conferenceShowUpcoming" type="checkbox" ${conferenceDashboardState.showUpcoming?'checked':''}></label>
    </div>`)}

    ${card('Conference Teams',`<div class="watchlist-grid">${model.teams.map(team=>`
      <button class="watchlist-tile button" data-conference-team="${esc(team.abbr)}">
        <span><strong>${team.rank?`#${team.rank} `:''}${esc(team.shortName)}</strong><small>${esc(team.abbr)}</small></span>
      </button>`).join('')}</div>`,'wide')}

    ${card('Live Conference Games',conferenceScheduleList(model.live),'wide')}
    ${conferenceDashboardState.showUpcoming?card('Upcoming Conference Games',conferenceScheduleList(model.upcoming),'wide'):''}
    ${conferenceDashboardState.showFinals?card('Final Conference Games',conferenceScheduleList(model.final),'wide'):''}

    ${card('Prediction History',model.predictionsInConference.length?`<div class="intel-list">${model.predictionsInConference.slice().reverse().map(prediction=>`
      <div class="intel-row">
        <span class="intel-icon">${intelligenceStatus(prediction)==='correct'?'✓':intelligenceStatus(prediction)==='incorrect'?'×':'•'}</span>
        <div><strong>${esc(intelligenceSelection(prediction))}</strong><small>${esc(intelligenceStatus(prediction))} · ${intelligenceConfidence(prediction)}% confidence</small></div>
      </div>`).join('')}</div>`:empty('No prediction history','Predictions involving this conference will appear here.'),'wide')}

    ${card('Provider Boundary',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Schedules and records use loaded game data</strong><small>Only data already available in OnlyBeats is shown.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Official standings require a provider</strong><small>Standings are not invented when no standings feed is connected.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Stat leaders require provider support</strong><small>Conference leaders appear only when normalized provider data exists.</small></div></div>
    </div>`,'wide')}
  </div>`;
}

function bindConferenceDashboards(){
  if($('conferenceSelect'))$('conferenceSelect').onchange=event=>{
    conferenceDashboardState.selectedConference=event.target.value;
    saveConferenceDashboardState();
    renderPage();
  };

  if($('conferenceShowFinals'))$('conferenceShowFinals').onchange=event=>{
    conferenceDashboardState.showFinals=event.target.checked;
    saveConferenceDashboardState();
    renderPage();
  };

  if($('conferenceShowUpcoming'))$('conferenceShowUpcoming').onchange=event=>{
    conferenceDashboardState.showUpcoming=event.target.checked;
    saveConferenceDashboardState();
    renderPage();
  };

  if($('conferenceFavorite'))$('conferenceFavorite').onclick=()=>{
    const conference=conferenceDashboardState.selectedConference;
    if(favoritesWatchlistsState.favoriteConferences.includes(conference)){
      favoritesWatchlistsState.favoriteConferences=favoritesWatchlistsState.favoriteConferences.filter(item=>item!==conference);
    }else{
      favoritesWatchlistsState.favoriteConferences.push(conference);
    }
    saveFavoritesWatchlistsState();
    renderPage();
  };

  document.querySelectorAll('[data-conference-team]').forEach(button=>{
    button.onclick=()=>{
      teamProfileState.selectedTeam=button.dataset.conferenceTeam;
      saveTeamProfileState();
      navigate('teamprofiles');
    };
  });

  document.querySelectorAll('[data-conference-game]').forEach(button=>{
    button.onclick=()=>{
      sessionStorage.setItem('onlybeats.selected-game',button.dataset.conferenceGame);
      navigate('gamehub');
    };
  });
}

function installConferenceDashboardStyles(){
  if(document.getElementById('onlybeatsConferenceDashboardStyles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsConferenceDashboardStyles';
  style.textContent=`
    .conference-hero{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:30px;border:1px solid rgba(244,189,69,.24);border-radius:24px;background:radial-gradient(circle at 80% 10%,rgba(244,189,69,.12),transparent 38%),#101822;margin-bottom:18px}
    .conference-hero h1{font-size:clamp(2.3rem,5vw,4.4rem);line-height:1;margin:5px 0 12px}
    @media(max-width:760px){.conference-hero{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);
}

function initializeConferenceDashboards(){
  loadConferenceDashboardState();
  installConferenceDashboardStyles();
}
