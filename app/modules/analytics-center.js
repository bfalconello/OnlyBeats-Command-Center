'use strict';

// OnlyBeats v1.2 Analytics Center — Phase 1.
// Reviews the user's existing prediction history without generating picks.

let analyticsCenterView='overview';

function analyticsAllRows(){
  return predictions.map(prediction=>{
    const game=predictionGame(prediction);
    const result=predictionResult(prediction,game);
    return {prediction,game,result};
  });
}

function analyticsGradedRows(){
  return analyticsAllRows().filter(row=>['correct','incorrect','push'].includes(row.result.status));
}

function analyticsWeekKey(game,prediction){
  const date=new Date(game?.date||prediction.createdAt||Date.now());
  const start=new Date(date);
  start.setHours(0,0,0,0);
  start.setDate(start.getDate()-start.getDay());
  return start.toISOString().slice(0,10);
}

function analyticsWeeklyRows(){
  const grouped=new Map();

  for(const row of analyticsAllRows()){
    const key=analyticsWeekKey(row.game,row.prediction);
    if(!grouped.has(key)){
      grouped.set(key,{
        key,
        label:new Date(`${key}T12:00:00`).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}),
        total:0,graded:0,decisions:0,correct:0,incorrect:0,pushes:0,pending:0,score:0,confidence:0
      });
    }

    const week=grouped.get(key);
    week.total+=1;
    week.confidence+=Number(row.prediction.confidence)||0;

    if(row.result.status==='pending'){
      week.pending+=1;
    }else{
      week.graded+=1;
      week.score+=Number(row.result.score)||0;
      if(row.result.status==='push'){
        week.pushes+=1;
      }else{
        week.decisions+=1;
        if(row.result.status==='correct')week.correct+=1;
        if(row.result.status==='incorrect')week.incorrect+=1;
      }
    }
  }

  return [...grouped.values()]
    .map(week=>({
      ...week,
      accuracy:week.decisions?week.correct/week.decisions*100:0,
      averageConfidence:week.total?week.confidence/week.total:0
    }))
    .sort((a,b)=>new Date(b.key)-new Date(a.key));
}

function analyticsTypeRows(){
  const labels={winner:'Winner',spread:'Spread',total:'Over / Under'};
  return ['winner','spread','total'].map(type=>{
    const rows=analyticsAllRows().filter(row=>row.prediction.type===type);
    const graded=rows.filter(row=>['correct','incorrect','push'].includes(row.result.status));
    const decisions=graded.filter(row=>row.result.status!=='push');
    const correct=decisions.filter(row=>row.result.status==='correct').length;
    return {
      type,
      label:labels[type],
      total:rows.length,
      graded:graded.length,
      decisions:decisions.length,
      correct,
      pending:rows.filter(row=>row.result.status==='pending').length,
      accuracy:decisions.length?correct/decisions.length*100:0,
      score:graded.reduce((sum,row)=>sum+(Number(row.result.score)||0),0),
      averageConfidence:rows.length?rows.reduce((sum,row)=>sum+(Number(row.prediction.confidence)||0),0)/rows.length:0
    };
  });
}

function analyticsTeamRows(){
  const map=new Map();

  for(const row of analyticsAllRows()){
    const game=row.game;
    if(!game)continue;

    const teamAbbr=row.prediction.pick;
    const team=game.away.abbr===teamAbbr?game.away:game.home.abbr===teamAbbr?game.home:null;
    if(!team)continue;

    if(!map.has(team.abbr)){
      map.set(team.abbr,{
        team:team.name,
        abbr:team.abbr,
        conference:(allTeams().find(item=>item.abbr===team.abbr)||team).conference||'FBS',
        total:0,graded:0,decisions:0,correct:0,pending:0,score:0
      });
    }

    const item=map.get(team.abbr);
    item.total+=1;
    if(row.result.status==='pending'){
      item.pending+=1;
    }else{
      item.graded+=1;
      item.score+=Number(row.result.score)||0;
      if(row.result.status!=='push'){
        item.decisions+=1;
        if(row.result.status==='correct')item.correct+=1;
      }
    }
  }

  return [...map.values()]
    .map(item=>({...item,accuracy:item.decisions?item.correct/item.decisions*100:0}))
    .sort((a,b)=>b.decisions-a.decisions||b.accuracy-a.accuracy||a.team.localeCompare(b.team));
}

function analyticsConferenceRows(){
  const map=new Map();

  for(const team of analyticsTeamRows()){
    const key=team.conference||'FBS';
    if(!map.has(key)){
      map.set(key,{conference:key,total:0,graded:0,decisions:0,correct:0,pending:0,score:0});
    }
    const item=map.get(key);
    item.total+=team.total;
    item.graded+=team.graded;
    item.decisions+=team.decisions;
    item.correct+=team.correct;
    item.pending+=team.pending;
    item.score+=team.score;
  }

  return [...map.values()]
    .map(item=>({...item,accuracy:item.decisions?item.correct/item.decisions*100:0}))
    .sort((a,b)=>b.decisions-a.decisions||b.accuracy-a.accuracy||a.conference.localeCompare(b.conference));
}

function analyticsConfidenceRows(){
  return confidenceBuckets().map(bucket=>({
    ...bucket,
    score:analyticsAllRows()
      .filter(row=>{
        const c=Number(row.prediction.confidence)||0;
        if(bucket.label==='0–49')return c<=49;
        if(bucket.label==='50–59')return c>=50&&c<=59;
        if(bucket.label==='60–69')return c>=60&&c<=69;
        if(bucket.label==='70–79')return c>=70&&c<=79;
        if(bucket.label==='80–89')return c>=80&&c<=89;
        if(bucket.label==='90–99')return c>=90&&c<=99;
        return c>=100;
      })
      .reduce((sum,row)=>sum+(Number(row.result.score)||0),0)
  }));
}

function analyticsScoreTrend(){
  const weeks=[...analyticsWeeklyRows()].reverse();
  let cumulative=0;
  return weeks.map(week=>{
    cumulative+=week.score;
    return {...week,cumulative};
  });
}

function analyticsBestSummary(){
  const types=analyticsTypeRows().filter(row=>row.decisions>0);
  const teams=analyticsTeamRows().filter(row=>row.decisions>0);
  const conferences=analyticsConferenceRows().filter(row=>row.decisions>0);
  const weeks=analyticsWeeklyRows().filter(row=>row.decisions>0);

  const bestType=[...types].sort((a,b)=>b.accuracy-a.accuracy||b.decisions-a.decisions)[0]||null;
  const bestTeam=[...teams].sort((a,b)=>b.accuracy-a.accuracy||b.decisions-a.decisions)[0]||null;
  const bestConference=[...conferences].sort((a,b)=>b.accuracy-a.accuracy||b.decisions-a.decisions)[0]||null;
  const bestWeek=[...weeks].sort((a,b)=>b.score-a.score||b.accuracy-a.accuracy)[0]||null;

  return {bestType,bestTeam,bestConference,bestWeek};
}

function analyticsBar(label,value,max,detail=''){
  const safeMax=Math.max(1,Number(max)||1);
  const width=Math.max(2,Math.min(100,(Number(value)||0)/safeMax*100));
  return `<div class="confidence-row">
    <div><strong>${esc(label)}</strong><small>${esc(detail)}</small></div>
    <div class="confidence-track"><span style="width:${width}%"></span></div>
    <b>${Number(value||0).toFixed(1)}%</b>
  </div>`;
}

function weeklyReportCardsHtml(){
  const rows=analyticsWeeklyRows();
  if(!rows.length)return empty('No weekly analytics yet','Save predictions to create weekly report cards.');

  return `<div class="command-center-grid">${rows.map(week=>`
    <article class="card">
      <div class="card-head">
        <div><span class="provider-badge">WEEK OF</span><h3>${esc(week.label)}</h3></div>
        <strong>${week.accuracy.toFixed(1)}%</strong>
      </div>
      <div class="team-stat-grid">
        <div><span>Entries</span><strong>${week.total}</strong></div>
        <div><span>Correct</span><strong>${week.correct}</strong></div>
        <div><span>Incorrect</span><strong>${week.incorrect}</strong></div>
        <div><span>Pushes</span><strong>${week.pushes}</strong></div>
        <div><span>Score</span><strong>${formatNumber(week.score)}</strong></div>
        <div><span>Avg confidence</span><strong>${week.averageConfidence.toFixed(1)}</strong></div>
      </div>
    </article>`).join('')}</div>`;
}

function typePerformanceHtml(){
  const rows=analyticsTypeRows();
  const max=Math.max(...rows.map(row=>row.accuracy),1);
  return `<div class="confidence-list">${rows.map(row=>
    analyticsBar(row.label,row.accuracy,max,`${row.correct}/${row.decisions} correct · ${formatNumber(row.score)} score · ${row.pending} pending`)
  ).join('')}</div>`;
}

function teamPerformanceHtml(){
  const rows=analyticsTeamRows().slice(0,15);
  if(!rows.length)return empty('No team analytics yet','Team-based winner and spread predictions will appear here.');
  const max=Math.max(...rows.map(row=>row.accuracy),1);
  return `<div class="confidence-list">${rows.map(row=>
    analyticsBar(row.team,row.accuracy,max,`${row.correct}/${row.decisions} correct · ${formatNumber(row.score)} score · ${esc(row.conference)}`)
  ).join('')}</div>`;
}

function conferencePerformanceHtml(){
  const rows=analyticsConferenceRows();
  if(!rows.length)return empty('No conference analytics yet','Conference summaries will appear after team-based predictions are graded.');
  const max=Math.max(...rows.map(row=>row.accuracy),1);
  return `<div class="confidence-list">${rows.map(row=>
    analyticsBar(row.conference,row.accuracy,max,`${row.correct}/${row.decisions} correct · ${formatNumber(row.score)} score · ${row.total} entries`)
  ).join('')}</div>`;
}

function confidenceAnalyticsHtml(){
  const rows=analyticsConfidenceRows();
  if(!rows.some(row=>row.graded))return empty('Not enough graded data','Grade more predictions to evaluate confidence ranges.');
  const max=Math.max(...rows.map(row=>row.accuracy),1);
  return `<div class="confidence-list">${rows.map(row=>
    analyticsBar(row.label,row.accuracy,max,`${row.correct}/${row.graded} correct · ${formatNumber(row.score)} score`)
  ).join('')}</div>`;
}

function scoreTrendHtml(){
  const rows=analyticsScoreTrend();
  if(!rows.length)return empty('No score trend yet','Weekly scores will create a cumulative season trend.');
  const max=Math.max(...rows.map(row=>Math.abs(row.cumulative)),1);
  return `<div class="intel-list">${rows.map(row=>`
    <div class="intel-row">
      <span class="intel-icon">${row.score>=0?'↑':'↓'}</span>
      <div><strong>${esc(row.label)}</strong><small>Weekly score ${formatNumber(row.score)} · Accuracy ${row.accuracy.toFixed(1)}%</small></div>
      <b>${formatNumber(row.cumulative)}</b>
    </div>`).join('')}</div>`;
}

function analyticsOverview(){
  const combined=combinedAnalytics();
  const summary=analyticsBestSummary();
  const weeks=analyticsWeeklyRows();

  return `<div class="metric-grid">
    ${metric('Overall Accuracy',`${combined.accuracy.toFixed(1)}%`,`${combined.correct}/${combined.decisions} correct`)}
    ${metric('Combined Score',formatNumber(combined.earned),`${combined.pending} pending`)}
    ${metric('Weeks Tracked',weeks.length,'Weekly report cards')}
    ${metric('Best Type',summary.bestType?.label||'—',summary.bestType?`${summary.bestType.accuracy.toFixed(1)}% accuracy`:'No graded data')}
    ${metric('Best Team',summary.bestTeam?.abbr||'—',summary.bestTeam?`${summary.bestTeam.accuracy.toFixed(1)}% accuracy`:'No graded data')}
    ${metric('Best Week',summary.bestWeek?.label||'—',summary.bestWeek?`${formatNumber(summary.bestWeek.score)} score`:'No graded data')}
  </div>
  <div class="reports-grid">
    ${card('Performance by Prediction Type',typePerformanceHtml())}
    ${card('Confidence Calibration',confidenceAnalyticsHtml())}
    ${card('Season Score Trend',scoreTrendHtml(),'wide')}
    ${card('Top Team Performance',teamPerformanceHtml())}
    ${card('Conference Performance',conferencePerformanceHtml())}
  </div>`;
}

function analyticsCenterPage(){
  setHeading('Analytics Center','WEEKLY · TEAM · CONFERENCE · CONFIDENCE');
  const tabs=[
    ['overview','Overview'],
    ['weekly','Weekly Report Cards'],
    ['teams','Teams'],
    ['conferences','Conferences'],
    ['confidence','Confidence']
  ];

  const content=
    analyticsCenterView==='weekly'?weeklyReportCardsHtml():
    analyticsCenterView==='teams'?card('Team Performance',teamPerformanceHtml(),'wide'):
    analyticsCenterView==='conferences'?card('Conference Performance',conferencePerformanceHtml(),'wide'):
    analyticsCenterView==='confidence'?card('Confidence Calibration',confidenceAnalyticsHtml(),'wide'):
    analyticsOverview();

  return `<section class="prediction-hero">
    <div>
      <p class="eyebrow">ONLYBEATS ANALYTICS CENTER</p>
      <h2>Understand your performance across the entire season.</h2>
      <p>Review weekly report cards, prediction types, teams, conferences, confidence ranges, and cumulative score trends from your saved journal.</p>
    </div>
    <div class="button-row">
      <button class="button primary" data-page-jump="predictions">Open Prediction Center</button>
      <button class="button" data-page-jump="reports">Open Prediction Intelligence</button>
      <button class="button" id="exportAnalyticsCsv">Export analytics CSV</button>
    </div>
  </section>

  <div class="wall-toolbar">
    <div class="wall-status-tabs">
      ${tabs.map(([id,label])=>`<button class="filter-button ${analyticsCenterView===id?'active':''}" data-analytics-view="${id}">${label}</button>`).join('')}
    </div>
  </div>

  ${content}`;
}

function analyticsCsvRows(){
  return analyticsAllRows().map(row=>({
    Date:row.game?new Date(row.game.date).toISOString():row.prediction.createdAt||'',
    Week:analyticsWeekKey(row.game,row.prediction),
    Game:row.prediction.gameName||'',
    Type:predictionTypeLabel(row.prediction),
    Pick:predictionPickLabel(row.prediction,row.game),
    Confidence:Number(row.prediction.confidence)||0,
    Result:row.result.label,
    Score:row.result.score??'',
    AwayTeam:row.game?.away?.name||'',
    HomeTeam:row.game?.home?.name||''
  }));
}

function exportAnalyticsCsv(){
  const rows=analyticsCsvRows();
  const headers=['Date','Week','Game','Type','Pick','Confidence','Result','Score','AwayTeam','HomeTeam'];
  const csv=[
    headers.join(','),
    ...rows.map(row=>headers.map(header=>`"${String(row[header]??'').replace(/"/g,'""')}"`).join(','))
  ].join('\n');

  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-analytics-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function bindAnalyticsCenter(){
  document.querySelectorAll('[data-analytics-view]').forEach(button=>{
    button.onclick=()=>{
      analyticsCenterView=button.dataset.analyticsView;
      renderPage();
    };
  });

  if($('exportAnalyticsCsv'))$('exportAnalyticsCsv').onclick=()=>exportAnalyticsCsv();
}
