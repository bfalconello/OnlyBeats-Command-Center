'use strict';

// OnlyBeats v4.4 Team Profiles.

let teamProfileState={
  selectedTeam:'',
  showFinished:true,
  showUpcoming:true,
  lastViewedAt:null
};

function loadTeamProfileState(){
  try{
    teamProfileState={...teamProfileState,...JSON.parse(localStorage.getItem(TEAM_PROFILE_STATE_KEY)||'{}')};
  }catch{}
}

function saveTeamProfileState(){
  teamProfileState.lastViewedAt=new Date().toISOString();
  localStorage.setItem(TEAM_PROFILE_STATE_KEY,JSON.stringify(teamProfileState));
}

function teamAliases(team){
  return [team?.abbr,team?.name,team?.shortName,team?.school]
    .map(value=>String(value||'').toLowerCase())
    .filter(Boolean);
}

function gameHasTeam(game,team){
  const aliases=teamAliases(team);
  const gameValues=[
    game.away?.abbr,game.away?.name,game.away?.shortName,
    game.home?.abbr,game.home?.name,game.home?.shortName
  ].map(value=>String(value||'').toLowerCase());
  return aliases.some(alias=>gameValues.includes(alias));
}

function buildTeamProfile(teamKey){
  const teams=allKnownTeams();
  const team=teams.find(item=>{
    const values=teamAliases(item);
    return values.includes(String(teamKey||'').toLowerCase());
  })||teams[0]||null;

  if(!team)return null;

  const schedule=games.filter(game=>gameHasTeam(game,team)).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const finished=schedule.filter(game=>game.state==='post');
  const upcoming=schedule.filter(game=>game.state!=='post');

  let wins=0;
  let losses=0;

  finished.forEach(game=>{
    const isHome=teamAliases(team).includes(String(game.home?.abbr||game.home?.name||'').toLowerCase());
    const teamScore=Number(isHome?game.home?.score:game.away?.score)||0;
    const opponentScore=Number(isHome?game.away?.score:game.home?.score)||0;
    if(teamScore>opponentScore)wins+=1;
    else if(teamScore<opponentScore)losses+=1;
  });

  const teamPredictions=predictions
    .filter(prediction=>String(intelligenceSelection(prediction)).toLowerCase()===String(team.abbr).toLowerCase()
      ||String(intelligenceSelection(prediction)).toLowerCase()===String(team.name).toLowerCase()
      ||String(intelligenceSelection(prediction)).toLowerCase()===String(team.shortName).toLowerCase());

  const record=intelligenceRecord(
    teamPredictions.map(prediction=>({status:intelligenceStatus(prediction)}))
      .filter(row=>['correct','incorrect','push'].includes(row.status))
  );

  const rankingRows=window.ONLYBEATS_NORMALIZED_RANKINGS||[];
  const ranking=rankingRows.find(row=>{
    const value=String(row.abbr||row.team||'').toLowerCase();
    return teamAliases(team).includes(value);
  });

  const statsRows=window.ONLYBEATS_NORMALIZED_TEAM_STATS||[];
  const stats=statsRows.find(row=>{
    const value=String(row.abbr||row.team||row.name||'').toLowerCase();
    return teamAliases(team).includes(value);
  })||null;

  return {
    team,
    schedule,
    finished,
    upcoming,
    wins,
    losses,
    predictions:teamPredictions,
    predictionRecord:record,
    ranking,
    stats,
    favorite:favoritesWatchlistsState.favoriteTeams.includes(team.abbr)
  };
}

function teamProfileSchedule(profile){
  const rows=[
    ...(teamProfileState.showFinished?profile.finished:[]),
    ...(teamProfileState.showUpcoming?profile.upcoming:[])
  ].sort((a,b)=>new Date(a.date)-new Date(b.date));

  if(!rows.length)return empty('No visible games','Change the schedule filters or refresh live data.');

  return `<div class="intel-list">${rows.map(game=>{
    const isHome=teamAliases(profile.team).includes(String(game.home?.abbr||game.home?.name||'').toLowerCase());
    const opponent=isHome?game.away:game.home;
    return `<div class="intel-row">
      <span class="intel-icon">${game.state==='post'?'✓':'•'}</span>
      <div>
        <strong>${isHome?'vs':'at'} ${esc(opponent?.shortName||opponent?.name||'Opponent')}</strong>
        <small>${new Date(game.date).toLocaleString()} · ${esc(game.status||'Scheduled')} · ${esc(game.network||'Network unavailable')}</small>
      </div>
      <button class="button" data-team-game="${game.id}">Open</button>
    </div>`;
  }).join('')}</div>`;
}

function teamProfilesPage(){
  setHeading('Team Profiles','TEAM · SCHEDULE · HISTORY');
  const teams=allKnownTeams();
  if(!teamProfileState.selectedTeam&&teams.length)teamProfileState.selectedTeam=teams[0].abbr;
  const profile=buildTeamProfile(teamProfileState.selectedTeam);

  if(!profile){
    return empty('No teams available','Refresh schedules or connect a team-data provider.');
  }

  saveTeamProfileState();

  return `<section class="team-profile-hero">
    <div>
      <p class="eyebrow">${esc(profile.team.conference)}</p>
      <h1>${profile.ranking?.rank?`#${profile.ranking.rank} `:''}${esc(profile.team.name)}</h1>
      <p>${profile.wins}-${profile.losses} loaded-game record · ${profile.predictionRecord.correct}-${profile.predictionRecord.incorrect} prediction record</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="teamProfileFavorite">${profile.favorite?'Remove favorite':'Add favorite'}</button>
      <button class="button" data-page-jump="favoriteshub">Favorites</button>
      <button class="button" data-page-jump="conferences">Conference Dashboard</button>
    </div>
  </section>

  <div class="reports-grid">
    ${card('Choose Team',`<div class="detail-list">
      <label><span>Team</span><select id="teamProfileSelect">${teams.map(team=>`
        <option value="${esc(team.abbr)}" ${profile.team.abbr===team.abbr?'selected':''}>${esc(team.name)}</option>`).join('')}</select></label>
      <label class="toggle-row"><span>Show finished games</span><input id="teamProfileFinished" type="checkbox" ${teamProfileState.showFinished?'checked':''}></label>
      <label class="toggle-row"><span>Show upcoming games</span><input id="teamProfileUpcoming" type="checkbox" ${teamProfileState.showUpcoming?'checked':''}></label>
    </div>`)}

    ${card('Team Snapshot',`<div class="detail-list">
      <div><span>Conference</span><strong>${esc(profile.team.conference)}</strong></div>
      <div><span>Current rank</span><strong>${profile.ranking?.rank||profile.team.rank||'Unranked'}</strong></div>
      <div><span>Loaded record</span><strong>${profile.wins}-${profile.losses}</strong></div>
      <div><span>Prediction accuracy</span><strong>${profile.predictionRecord.sample?`${profile.predictionRecord.rate.toFixed(1)}%`:'No graded sample'}</strong></div>
      <div><span>Saved predictions</span><strong>${profile.predictions.length}</strong></div>
      <div><span>Favorite</span><strong>${profile.favorite?'Yes':'No'}</strong></div>
    </div>`)}

    ${card('Available Team Stats',profile.stats?`<div class="detail-list">${Object.entries(profile.stats)
      .filter(([key,value])=>!['team','name','abbr'].includes(key)&&['string','number'].includes(typeof value))
      .slice(0,16)
      .map(([key,value])=>`<div><span>${esc(key.replace(/([A-Z])/g,' $1'))}</span><strong>${esc(value)}</strong></div>`).join('')}</div>`:
      empty('Team stats unavailable','Stats appear only when a connected provider supplies them.'))}

    ${card('Schedule',teamProfileSchedule(profile),'wide')}

    ${card('Prediction History',profile.predictions.length?`<div class="intel-list">${profile.predictions.slice().reverse().map(prediction=>`
      <div class="intel-row">
        <span class="intel-icon">${intelligenceStatus(prediction)==='correct'?'✓':intelligenceStatus(prediction)==='incorrect'?'×':'•'}</span>
        <div><strong>${esc(intelligenceSelection(prediction))}</strong><small>${esc(intelligenceStatus(prediction))} · ${intelligenceConfidence(prediction)}% confidence</small></div>
      </div>`).join('')}</div>`:empty('No saved predictions','Predictions involving this team will appear here.'),'wide')}
  </div>`;
}

function bindTeamProfiles(){
  if($('teamProfileSelect'))$('teamProfileSelect').onchange=event=>{
    teamProfileState.selectedTeam=event.target.value;
    saveTeamProfileState();
    renderPage();
  };

  if($('teamProfileFinished'))$('teamProfileFinished').onchange=event=>{
    teamProfileState.showFinished=event.target.checked;
    saveTeamProfileState();
    renderPage();
  };

  if($('teamProfileUpcoming'))$('teamProfileUpcoming').onchange=event=>{
    teamProfileState.showUpcoming=event.target.checked;
    saveTeamProfileState();
    renderPage();
  };

  if($('teamProfileFavorite'))$('teamProfileFavorite').onclick=()=>{
    const profile=buildTeamProfile(teamProfileState.selectedTeam);
    if(!profile)return;
    const key=profile.team.abbr;

    if(favoritesWatchlistsState.favoriteTeams.includes(key)){
      favoritesWatchlistsState.favoriteTeams=favoritesWatchlistsState.favoriteTeams.filter(item=>item!==key);
    }else{
      favoritesWatchlistsState.favoriteTeams.push(key);
    }

    saveFavoritesWatchlistsState();
    renderPage();
  };

  document.querySelectorAll('[data-team-game]').forEach(button=>{
    button.onclick=()=>{
      sessionStorage.setItem('onlybeats.selected-game',button.dataset.teamGame);
      navigate('gamehub');
    };
  });
}

function installTeamProfileStyles(){
  if(document.getElementById('onlybeatsTeamProfileStyles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsTeamProfileStyles';
  style.textContent=`
    .team-profile-hero{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:30px;border:1px solid rgba(244,189,69,.24);border-radius:24px;background:radial-gradient(circle at 80% 10%,rgba(244,189,69,.12),transparent 38%),#101822;margin-bottom:18px}
    .team-profile-hero h1{font-size:clamp(2.3rem,5vw,4.4rem);line-height:1;margin:5px 0 12px}
    @media(max-width:760px){.team-profile-hero{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);
}

function initializeTeamProfiles(){
  loadTeamProfileState();
  installTeamProfileStyles();
}
