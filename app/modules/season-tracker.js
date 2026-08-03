'use strict';

// OnlyBeats v4.4 Season Tracker.

let seasonTrackerState={
  season:'all',
  includePushes:false,
  calendarMode:'week',
  lastCalculatedAt:null
};

function loadSeasonTrackerState(){
  try{
    seasonTrackerState={...seasonTrackerState,...JSON.parse(localStorage.getItem(SEASON_TRACKER_KEY)||'{}')};
  }catch{}
}

function saveSeasonTrackerState(){
  seasonTrackerState.lastCalculatedAt=new Date().toISOString();
  localStorage.setItem(SEASON_TRACKER_KEY,JSON.stringify(seasonTrackerState));
}

function seasonRows(){
  return predictions
    .map(prediction=>({
      prediction,
      status:intelligenceStatus(prediction),
      game:intelligenceGame(prediction),
      selection:intelligenceSelection(prediction),
      confidence:intelligenceConfidence(prediction)
    }))
    .filter(row=>{
      if(seasonTrackerState.season==='all')return true;
      const date=new Date(row.game?.date||row.prediction.createdAt||0);
      return String(date.getFullYear())===String(seasonTrackerState.season);
    });
}

function buildSeasonTracker(){
  const rows=seasonRows();
  const graded=rows.filter(row=>['correct','incorrect','push'].includes(row.status));
  const record=intelligenceRecord(graded);

  const byWeek=analyticsGroup(graded,row=>{
    if(row.game?.week)return `Week ${row.game.week}`;
    const date=new Date(row.game?.date||row.prediction.createdAt||0);
    return Number.isFinite(date.getTime())?date.toLocaleDateString(undefined,{month:'short',day:'numeric'}):'Unknown';
  });

  const byMonth=analyticsGroup(graded,row=>{
    const date=new Date(row.game?.date||row.prediction.createdAt||0);
    return Number.isFinite(date.getTime())?date.toLocaleDateString(undefined,{month:'long',year:'numeric'}):'Unknown';
  });

  const byConference=analyticsGroup(graded,row=>analyticsConferenceForTeam(row.selection));
  const ranked=graded.filter(row=>Boolean(Number(row.game?.away?.rank)||Number(row.game?.home?.rank)));
  const favoriteTeamRows=graded.filter(row=>favoritesWatchlistsState.favoriteTeams.includes(row.selection));

  const streak=analyticsStreak(graded);
  const bestWeek=byWeek.slice().sort((a,b)=>b.record.rate-a.record.rate||b.record.graded-a.record.graded)[0]||null;
  const worstWeek=byWeek.slice().sort((a,b)=>a.record.rate-b.record.rate||b.record.graded-a.record.graded)[0]||null;

  saveSeasonTrackerState();

  return {
    rows,graded,record,byWeek,byMonth,byConference,ranked,favoriteTeamRows,streak,bestWeek,worstWeek
  };
}

function seasonTrackerPage(){
  setHeading('Season Tracker','WEEK · MONTH · CONFERENCE · STREAKS');
  const model=buildSeasonTracker();
  const seasons=[...new Set(predictions.map(prediction=>{
    const game=intelligenceGame(prediction);
    const date=new Date(game?.date||prediction.createdAt||0);
    return Number.isFinite(date.getTime())?String(date.getFullYear()):null;
  }).filter(Boolean))].sort().reverse();

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">SEASON COMMAND VIEW</p>
      <h2>${model.record.correct}-${model.record.incorrect}${model.record.pushes?`-${model.record.pushes}`:''} · ${model.record.rate.toFixed(1)}%</h2>
      <p>Review the season by week, month, conference, ranked matchups, favorite teams, and streaks.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="seasonTrackerExport">Export season report</button>
      <button class="button" data-page-jump="analytics">Prediction Analytics</button>
      <button class="button" data-page-jump="saturday">Saturday Dashboard</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Season Record',`${model.record.correct}-${model.record.incorrect}`,`${model.record.pushes} pushes`)}
    ${metric('Accuracy',`${model.record.rate.toFixed(1)}%`,`${model.record.sample} graded`)}
    ${metric('Best Win Streak',model.streak.bestWin,'Consecutive correct')}
    ${metric('Longest Loss Streak',model.streak.worstLoss,'Consecutive incorrect')}
    ${metric('Ranked Games',intelligenceRecord(model.ranked).rate.toFixed(1)+'%',`${model.ranked.length} graded`)}
    ${metric('Favorite Teams',intelligenceRecord(model.favoriteTeamRows).rate.toFixed(1)+'%',`${model.favoriteTeamRows.length} graded`)}
  </div>

  <div class="reports-grid">
    ${card('Season Controls',`<div class="detail-list">
      <label><span>Season</span><select id="seasonTrackerSeason"><option value="all">All seasons</option>${seasons.map(season=>`<option value="${season}" ${String(seasonTrackerState.season)===String(season)?'selected':''}>${season}</option>`).join('')}</select></label>
      <label class="toggle-row"><span>Include pushes in denominator</span><input id="seasonTrackerPushes" type="checkbox" ${seasonTrackerState.includePushes?'checked':''}></label>
      <div><span>Best week</span><strong>${model.bestWeek?`${esc(model.bestWeek.label)} · ${model.bestWeek.record.rate.toFixed(1)}%`:'No sample'}</strong></div>
      <div><span>Worst week</span><strong>${model.worstWeek?`${esc(model.worstWeek.label)} · ${model.worstWeek.record.rate.toFixed(1)}%`:'No sample'}</strong></div>
    </div>`)}

    ${card('Weekly Record',analyticsTable(model.byWeek,'No weekly history'),'wide')}
    ${card('Monthly Record',analyticsTable(model.byMonth,'No monthly history'))}
    ${card('Conference Record',analyticsTable(model.byConference,'No conference history'))}
    ${card('Weekly Trend',analyticsTrendPanel(model.byWeek),'wide')}
  </div>`;
}

function exportSeasonTracker(){
  const model=buildSeasonTracker();
  const payload={
    generatedAt:new Date().toISOString(),
    version:VERSION,
    season:seasonTrackerState.season,
    overall:model.record,
    streak:model.streak,
    bestWeek:model.bestWeek?{label:model.bestWeek.label,record:model.bestWeek.record}:null,
    worstWeek:model.worstWeek?{label:model.worstWeek.label,record:model.worstWeek.record}:null,
    byWeek:model.byWeek.map(group=>({label:group.label,record:group.record})),
    byMonth:model.byMonth.map(group=>({label:group.label,record:group.record})),
    byConference:model.byConference.map(group=>({label:group.label,record:group.record}))
  };

  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-season-tracker-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function bindSeasonTracker(){
  if($('seasonTrackerSeason'))$('seasonTrackerSeason').onchange=event=>{
    seasonTrackerState.season=event.target.value;
    saveSeasonTrackerState();
    renderPage();
  };

  if($('seasonTrackerPushes'))$('seasonTrackerPushes').onchange=event=>{
    seasonTrackerState.includePushes=event.target.checked;
    saveSeasonTrackerState();
    renderPage();
  };

  if($('seasonTrackerExport'))$('seasonTrackerExport').onclick=()=>{
    exportSeasonTracker();
    toast('Season report exported','success');
  };
}

function initializeSeasonTracker(){
  loadSeasonTrackerState();
}
