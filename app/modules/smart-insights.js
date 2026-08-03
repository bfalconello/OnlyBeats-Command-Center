'use strict';

// OnlyBeats v1.8 Smart Insights — Phase 1.
// Transparent, rules-based insights using data already available in OnlyBeats.

let smartInsightsView='board';

function insightClamp(value,min=0,max=100){
  return Math.max(min,Math.min(max,Number(value)||0));
}

function insightAvailabilityForGame(game){
  const teams=new Set([game.away.abbr,game.home.abbr]);
  return availabilityEntries.filter(entry=>
    teams.has(entry.team)&&
    ['Questionable','Doubtful','Unavailable','Unknown'].includes(entry.status)
  );
}

function insightPredictionsForGame(game){
  return predictions.filter(prediction=>prediction.gameId===game.id);
}

function insightWeatherContext(){
  const current=weatherData?.current;
  if(!current)return {score:0,label:'No weather context',reasons:[]};

  let score=0;
  const reasons=[];
  const wind=Number(current.wind_speed_10m)||0;
  const gust=Number(current.wind_gusts_10m)||0;
  const precipitation=Number(current.precipitation)||0;
  const temperature=Number(current.temperature_2m);

  if(wind>=20){score+=22;reasons.push(`Strong wind ${Math.round(wind)} mph`)}
  else if(wind>=12){score+=12;reasons.push(`Moderate wind ${Math.round(wind)} mph`)}

  if(gust>=30){score+=18;reasons.push(`Gusts ${Math.round(gust)} mph`)}
  else if(gust>=20){score+=9;reasons.push(`Gusts ${Math.round(gust)} mph`)}

  if(precipitation>0){score+=14;reasons.push('Active precipitation')}
  if(Number.isFinite(temperature)&&temperature<=32){score+=12;reasons.push(`Cold conditions ${Math.round(temperature)}°F`)}
  if(Number.isFinite(temperature)&&temperature>=90){score+=8;reasons.push(`Hot conditions ${Math.round(temperature)}°F`)}

  return {
    score:insightClamp(score),
    label:reasons.length?'Weather may affect play':'Low current weather impact',
    reasons
  };
}

function smartGameInsight(game){
  const priority=typeof gamePriorityBreakdown==='function'
    ? gamePriorityBreakdown(game)
    : {score:0,reasons:[]};

  const availability=insightAvailabilityForGame(game);
  const saved=insightPredictionsForGame(game);
  const weather=insightWeatherContext();
  const reasons=[...(priority.reasons||[])];

  let watchScore=Number(priority.score)||0;
  let upsetScore=0;
  let riskScore=0;

  if(game.state==='in'){
    watchScore+=20;
    reasons.push('Live game');
  }

  if(isTop25(game)){
    watchScore+=12;
    reasons.push('Ranked-team matchup');
  }

  if(isFavoriteGame(game)){
    watchScore+=15;
    reasons.push('Favorite-team activity');
  }

  if(game.state==='in'){
    const rankedTrailing=
      (game.away.rank&&game.away.score<game.home.score)||
      (game.home.rank&&game.home.score<game.away.score);

    if(rankedTrailing){
      upsetScore+=58;
      watchScore+=24;
      reasons.push('Ranked team currently trailing');
    }

    const margin=Math.abs(game.away.score-game.home.score);
    if(margin<=7){
      watchScore+=15;
      reasons.push('One-score margin');
    }
  }

  if(game.away.rank&&!game.home.rank)upsetScore+=10;
  if(game.home.rank&&!game.away.rank)upsetScore+=10;
  if(game.away.rank&&game.home.rank)upsetScore=Math.max(0,upsetScore-8);

  if(availability.length){
    const unavailable=availability.filter(entry=>entry.status==='Unavailable').length;
    const doubtful=availability.filter(entry=>entry.status==='Doubtful').length;
    const questionable=availability.filter(entry=>entry.status==='Questionable').length;
    const unknown=availability.filter(entry=>entry.status==='Unknown').length;

    riskScore+=unavailable*22+doubtful*15+questionable*9+unknown*6;
    watchScore+=Math.min(18,availability.length*5);
    reasons.push(`${availability.length} availability concern${availability.length===1?'':'s'}`);
  }

  if(saved.length){
    const average=saved.reduce((sum,prediction)=>sum+(Number(prediction.confidence)||0),0)/saved.length;
    const high=saved.filter(prediction=>(Number(prediction.confidence)||0)>=80).length;
    riskScore+=high*8;
    if(average>=80)reasons.push(`High saved confidence ${average.toFixed(0)}`);
    else reasons.push(`${saved.length} saved prediction${saved.length===1?'':'s'}`);
  }

  if(weather.score){
    riskScore+=weather.score*.35;
    reasons.push(...weather.reasons.map(reason=>`Weather context: ${reason}`));
  }

  if(game.state==='pre'){
    const kickoff=new Date(game.date);
    const minutes=(kickoff-Date.now())/60000;
    if(minutes>=0&&minutes<=60){
      watchScore+=18;
      reasons.push('Kickoff within one hour');
    }
  }

  const reviewPriority=insightClamp(
    riskScore+
    saved.reduce((sum,prediction)=>sum+Math.max(0,(Number(prediction.confidence)||0)-70)*.7,0)
  );

  return {
    game,
    watchScore:insightClamp(watchScore),
    upsetScore:insightClamp(upsetScore),
    riskScore:insightClamp(riskScore),
    reviewPriority,
    availability,
    predictions:saved,
    weather,
    reasons:[...new Set(reasons)].slice(0,10)
  };
}

function allSmartGameInsights(){
  return games.map(smartGameInsight);
}

function smartInsightSummary(){
  const rows=allSmartGameInsights();
  const watch=[...rows].sort((a,b)=>b.watchScore-a.watchScore);
  const upset=[...rows].filter(row=>row.upsetScore>0).sort((a,b)=>b.upsetScore-a.upsetScore);
  const risk=[...rows].filter(row=>row.reviewPriority>0).sort((a,b)=>b.reviewPriority-a.reviewPriority);
  const availability=[...rows].filter(row=>row.availability.length).sort((a,b)=>b.availability.length-a.availability.length);

  return {
    rows,
    watch,
    upset,
    risk,
    availability,
    topWatch:watch[0]||null,
    topUpset:upset[0]||null,
    topRisk:risk[0]||null
  };
}

function insightLevel(score){
  if(score>=75)return 'Critical';
  if(score>=50)return 'High';
  if(score>=25)return 'Medium';
  return 'Low';
}

function insightBar(score){
  return `<div class="confidence-track"><span style="width:${insightClamp(score)}%"></span></div>`;
}

function smartInsightGameRow(row,scoreKey,label){
  const score=row[scoreKey];
  const game=row.game;
  return `<div class="intel-row">
    <span class="intel-icon">${score>=75?'!':score>=50?'◆':'•'}</span>
    <div>
      <strong>${esc(game.away.shortName)} at ${esc(game.home.shortName)}</strong>
      <small>${esc(game.status)} · ${esc(row.reasons.slice(0,3).join(' · ')||'No major signals')}</small>
      ${insightBar(score)}
    </div>
    <div class="button-row">
      <span class="provider-badge">${esc(label)} ${score.toFixed(0)}</span>
      <button class="button" data-insight-game="${game.id}">Open</button>
    </div>
  </div>`;
}

function predictionRiskRows(){
  return predictions.map(prediction=>{
    const game=predictionGame(prediction);
    if(!game)return null;
    const insight=smartGameInsight(game);
    const confidence=Number(prediction.confidence)||0;
    let score=insight.riskScore;

    if(confidence>=90)score+=24;
    else if(confidence>=80)score+=16;
    else if(confidence>=70)score+=8;

    if(game.state==='in')score+=10;
    if(game.state==='post')score=0;

    const reasons=[...insight.reasons];
    if(confidence>=80)reasons.unshift(`High confidence ${confidence}`);
    if(game.state==='post')reasons.unshift('Already final');

    return {
      prediction,
      game,
      score:insightClamp(score),
      reasons:[...new Set(reasons)].slice(0,6)
    };
  }).filter(Boolean).sort((a,b)=>b.score-a.score);
}

function smartInsightCard(title,row,scoreKey,description){
  if(!row)return card(title,empty('No signal available',description));
  return card(title,`<div class="detail-list">
    <div><span>Matchup</span><strong>${esc(row.game.away.shortName)} at ${esc(row.game.home.shortName)}</strong></div>
    <div><span>Score</span><strong>${row[scoreKey].toFixed(0)} · ${insightLevel(row[scoreKey])}</strong></div>
    <div><span>Status</span><strong>${esc(row.game.status)}</strong></div>
    <div><span>Signals</span><strong>${esc(row.reasons.slice(0,4).join(' · ')||'No major signals')}</strong></div>
  </div><div class="button-row"><button class="button primary" data-insight-game="${row.game.id}">Open Game Hub</button><button class="button" data-insight-focus="${row.game.id}">Focus Mode</button></div>`);
}

function smartInsightBoard(){
  const summary=smartInsightSummary();
  const predictionRisk=predictionRiskRows();
  const weather=insightWeatherContext();

  return `<div class="metric-grid">
    ${metric('Games Evaluated',summary.rows.length,'Current scoreboard cache')}
    ${metric('Top Watch Score',summary.topWatch?summary.topWatch.watchScore.toFixed(0):'—',summary.topWatch?`${summary.topWatch.game.away.shortName} at ${summary.topWatch.game.home.shortName}`:'No games')}
    ${metric('Upset Signals',summary.upset.filter(row=>row.upsetScore>=25).length,'Rule-based signals')}
    ${metric('Predictions to Review',predictionRisk.filter(row=>row.score>=25).length,'Risk score 25+')}
    ${metric('Availability Games',summary.availability.length,'Manual notes only')}
    ${metric('Weather Context',weather.score.toFixed(0),weather.label)}
  </div>

  <div class="reports-grid">
    ${smartInsightCard('Game to Watch',summary.topWatch,'watchScore','Live, ranked, favorite, and kickoff signals appear here.')}
    ${smartInsightCard('Upset Signal',summary.topUpset,'upsetScore','Upset signals require ranking or live-score context.')}
    ${smartInsightCard('Prediction Review Priority',summary.topRisk,'reviewPriority','High confidence combined with risk signals appears here.')}
    ${card('Current Weather Context',`<div class="detail-list">
      <div><span>Impact score</span><strong>${weather.score.toFixed(0)}</strong></div>
      <div><span>Assessment</span><strong>${esc(weather.label)}</strong></div>
      <div><span>Signals</span><strong>${esc(weather.reasons.join(' · ')||'No weather data loaded')}</strong></div>
      <div><span>Important</span><strong>Applies only to the selected Weather Center location</strong></div>
    </div><button class="button" data-page-jump="weather">Open Weather Center</button>`)}

    ${card('Highest Watch Priorities',summary.watch.length?`<div class="intel-list">${summary.watch.slice(0,10).map(row=>smartInsightGameRow(row,'watchScore','WATCH')).join('')}</div>`:empty('No games available','Refresh the scoreboard to calculate priorities.'),'wide')}

    ${card('Prediction Risk Review',predictionRisk.length?`<div class="intel-list">${predictionRisk.slice(0,10).map(row=>`<div class="intel-row">
      <span class="intel-icon">${row.score>=75?'!':row.score>=50?'◆':'•'}</span>
      <div><strong>${esc(row.prediction.gameName||`${row.game.away.shortName} at ${row.game.home.shortName}`)}</strong><small>${esc(predictionTypeLabel(row.prediction))} · Confidence ${formatNumber(row.prediction.confidence)} · ${esc(row.reasons.slice(0,3).join(' · '))}</small>${insightBar(row.score)}</div>
      <div class="button-row"><span class="provider-badge">RISK ${row.score.toFixed(0)}</span><button class="button" data-insight-prediction="${row.prediction.id}">Review</button></div>
    </div>`).join('')}</div>`:empty('No saved predictions','Save a prediction to create review priorities.'),'wide')}`;
}

function smartUpsetView(){
  const rows=smartInsightSummary().upset;
  return card('Upset Signal Board',rows.length?`<div class="intel-list">${rows.map(row=>smartInsightGameRow(row,'upsetScore','UPSET')).join('')}</div>`:empty('No upset signals','Signals appear when ranked and live-score context supports them.'),'wide');
}

function smartAvailabilityView(){
  const rows=smartInsightSummary().availability;
  return card('Availability Impact Board',rows.length?`<div class="intel-list">${rows.map(row=>`<div class="intel-row">
    <span class="intel-icon">♙</span>
    <div><strong>${esc(row.game.away.shortName)} at ${esc(row.game.home.shortName)}</strong><small>${row.availability.map(entry=>`${entry.player} · ${entry.team} · ${entry.status}`).map(esc).join(' | ')}</small></div>
    <button class="button" data-insight-game="${row.game.id}">Open</button>
  </div>`).join('')}</div>`:empty('No availability concerns','Manual Questionable, Doubtful, Unavailable, or Unknown notes appear here.'),'wide');
}

function smartInsightsPage(){
  setHeading('Smart Insights','TRANSPARENT · RULE-BASED · EXPLAINABLE');
  const tabs=[
    ['board','Insight Board'],
    ['upsets','Upset Signals'],
    ['availability','Availability Impact']
  ];

  const content=
    smartInsightsView==='upsets'?smartUpsetView():
    smartInsightsView==='availability'?smartAvailabilityView():
    smartInsightBoard();

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">ONLYBEATS SMART INSIGHTS</p>
      <h2>Explainable signals from your existing GameDay data.</h2>
      <p>This engine ranks attention and review priorities. It does not generate guaranteed outcomes or replace your judgment.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="refreshSmartInsights">${loading?'Refreshing insights…':'Refresh insights'}</button>
      <button class="button" id="exportSmartInsights">Export insight report</button>
      <button class="button" data-page-jump="mission">Open Mission Control</button>
    </div>
  </section>

  <div class="provider-notice">
    <div>
      <strong>Transparent rules—not a hidden prediction model</strong>
      <p class="muted">Scores are built from rankings, game state, favorites, saved confidence, manual availability notes, current weather context, and existing priority signals.</p>
    </div>
  </div>

  <div class="wall-toolbar">
    <div class="wall-status-tabs">
      ${tabs.map(([id,label])=>`<button class="filter-button ${smartInsightsView===id?'active':''}" data-insights-view="${id}">${label}</button>`).join('')}
    </div>
  </div>

  ${content}`;
}

function exportSmartInsightReport(){
  const payload={
    generatedAt:new Date().toISOString(),
    version:VERSION,
    methodology:'Transparent rules-based scoring using current OnlyBeats data.',
    weatherContext:insightWeatherContext(),
    games:allSmartGameInsights().map(row=>({
      gameId:row.game.id,
      matchup:`${row.game.away.shortName} at ${row.game.home.shortName}`,
      status:row.game.status,
      watchScore:row.watchScore,
      upsetScore:row.upsetScore,
      riskScore:row.riskScore,
      reviewPriority:row.reviewPriority,
      reasons:row.reasons,
      availabilityCount:row.availability.length,
      savedPredictions:row.predictions.length
    })),
    predictionRisk:predictionRiskRows().map(row=>({
      predictionId:row.prediction.id,
      gameId:row.game.id,
      game:row.prediction.gameName,
      confidence:row.prediction.confidence,
      riskScore:row.score,
      reasons:row.reasons
    }))
  };

  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-smart-insights-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function bindSmartInsights(){
  document.querySelectorAll('[data-insights-view]').forEach(button=>{
    button.onclick=()=>{
      smartInsightsView=button.dataset.insightsView;
      renderPage();
    };
  });

  document.querySelectorAll('[data-insight-game]').forEach(button=>{
    button.onclick=()=>{
      gameHubGameId=button.dataset.insightGame;
      navigate('gamehub');
    };
  });

  document.querySelectorAll('[data-insight-focus]').forEach(button=>{
    button.onclick=()=>openFocus(button.dataset.insightFocus);
  });

  document.querySelectorAll('[data-insight-prediction]').forEach(button=>{
    button.onclick=()=>{
      editingPredictionId=button.dataset.insightPrediction;
      predictionView='games';
      navigate('predictions');
    };
  });

  if($('refreshSmartInsights'))$('refreshSmartInsights').onclick=async()=>{
    const button=$('refreshSmartInsights');
    button.disabled=true;
    button.textContent='Refreshing insights…';
    try{
      await syncScores(false);
      renderPage();
    }finally{
      const active=$('refreshSmartInsights');
      if(active){
        active.disabled=false;
        active.textContent='Refresh insights';
      }
    }
  };

  if($('exportSmartInsights'))$('exportSmartInsights').onclick=exportSmartInsightReport;
}

function initializeSmartInsights(){}
