'use strict';

// OnlyBeats v3.3 Prediction Analytics.
// Uses locally saved and graded prediction history. It does not claim
// external intelligence, market performance, or financial returns.

let predictionAnalyticsState={
  season:'all',
  statusFilter:'graded',
  minimumSample:1,
  confidenceBuckets:true,
  includePushes:false,
  topRows:12,
  lastCalculatedAt:null
};

function loadPredictionAnalyticsState(){
  try{
    predictionAnalyticsState={
      ...predictionAnalyticsState,
      ...JSON.parse(localStorage.getItem(PREDICTION_ANALYTICS_KEY)||'{}')
    };
  }catch{}
}

function savePredictionAnalyticsState(){
  localStorage.setItem(PREDICTION_ANALYTICS_KEY,JSON.stringify(predictionAnalyticsState));
}

function analyticsStatus(prediction){
  const raw=String(prediction?.status||prediction?.result||'pending').toLowerCase();
  if(['won','win','correct'].includes(raw))return 'correct';
  if(['lost','loss','incorrect'].includes(raw))return 'incorrect';
  if(['push','tie'].includes(raw))return 'push';
  return 'pending';
}

function analyticsConfidence(prediction){
  return Math.max(1,Math.min(99,Number(
    prediction?.confidence??
    prediction?.confidenceScore??
    prediction?.rating??
    70
  )||70));
}

function analyticsMarket(prediction){
  const raw=String(prediction?.market||prediction?.type||prediction?.predictionType||'winner').toLowerCase();
  if(raw.includes('spread'))return 'Spread';
  if(raw.includes('total')||raw.includes('over')||raw.includes('under'))return 'Total';
  if(raw.includes('future'))return 'Future';
  return 'Winner';
}

function analyticsSelection(prediction){
  return String(
    prediction?.team||
    prediction?.selection||
    prediction?.pick||
    'Unknown'
  );
}

function analyticsGame(prediction){
  return games.find(game=>String(game.id)===String(prediction?.gameId))||null;
}

function analyticsSeason(prediction){
  const game=analyticsGame(prediction);
  const date=game?.date||prediction?.date||prediction?.createdAt||'';
  const parsed=new Date(date);
  return Number.isFinite(parsed.getTime())?String(parsed.getFullYear()):'Unknown';
}

function analyticsConferenceForTeam(team){
  const normalized=String(team||'').toLowerCase();
  const teamRecord=typeof TEAM_DATABASE!=='undefined'&&Array.isArray(TEAM_DATABASE)
    ?TEAM_DATABASE.find(item=>{
        const values=[item.name,item.shortName,item.abbr,item.school]
          .map(value=>String(value||'').toLowerCase());
        return values.includes(normalized);
      })
    :null;
  return String(teamRecord?.conference||teamRecord?.conf||'Unknown');
}

function analyticsRows(){
  return predictions
    .map(prediction=>({
      prediction,
      status:analyticsStatus(prediction),
      confidence:analyticsConfidence(prediction),
      market:analyticsMarket(prediction),
      selection:analyticsSelection(prediction),
      game:analyticsGame(prediction),
      season:analyticsSeason(prediction)
    }))
    .filter(row=>{
      if(predictionAnalyticsState.season!=='all'&&row.season!==predictionAnalyticsState.season)return false;
      if(predictionAnalyticsState.statusFilter==='graded'&&!['correct','incorrect','push'].includes(row.status))return false;
      if(predictionAnalyticsState.statusFilter==='pending'&&row.status!=='pending')return false;
      return true;
    });
}

function analyticsRecord(rows){
  const correct=rows.filter(row=>row.status==='correct').length;
  const incorrect=rows.filter(row=>row.status==='incorrect').length;
  const pushes=rows.filter(row=>row.status==='push').length;
  const pending=rows.filter(row=>row.status==='pending').length;
  const denominator=predictionAnalyticsState.includePushes
    ?correct+incorrect+pushes
    :correct+incorrect;
  return {
    correct,
    incorrect,
    pushes,
    pending,
    graded:correct+incorrect+pushes,
    rate:denominator?correct/denominator*100:0
  };
}

function analyticsGroup(rows,keyFn){
  const groups=new Map();

  rows.forEach(row=>{
    const key=String(keyFn(row)||'Unknown');
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(row);
  });

  return [...groups.entries()]
    .map(([label,items])=>({
      label,
      items,
      record:analyticsRecord(items)
    }))
    .filter(group=>group.record.graded>=Number(predictionAnalyticsState.minimumSample||1))
    .sort((a,b)=>{
      if(b.record.rate!==a.record.rate)return b.record.rate-a.record.rate;
      return b.record.graded-a.record.graded;
    });
}

function analyticsConfidenceGroups(rows){
  const buckets=[
    {label:'50–59%',min:50,max:59},
    {label:'60–69%',min:60,max:69},
    {label:'70–79%',min:70,max:79},
    {label:'80–89%',min:80,max:89},
    {label:'90–99%',min:90,max:99}
  ];

  return buckets.map(bucket=>{
    const items=rows.filter(row=>row.confidence>=bucket.min&&row.confidence<=bucket.max);
    const record=analyticsRecord(items);
    const expected=(bucket.min+bucket.max)/2;
    return {
      ...bucket,
      items,
      record,
      expected,
      calibrationGap:record.rate-expected
    };
  });
}

function analyticsStreak(rows){
  const graded=rows
    .filter(row=>['correct','incorrect'].includes(row.status))
    .sort((a,b)=>{
      const dateA=new Date(a.game?.date||a.prediction?.createdAt||0).getTime();
      const dateB=new Date(b.game?.date||b.prediction?.createdAt||0).getTime();
      return dateA-dateB;
    });

  let currentType='';
  let currentLength=0;
  let bestWin=0;
  let worstLoss=0;

  graded.forEach(row=>{
    if(row.status===currentType){
      currentLength+=1;
    }else{
      currentType=row.status;
      currentLength=1;
    }

    if(currentType==='correct')bestWin=Math.max(bestWin,currentLength);
    if(currentType==='incorrect')worstLoss=Math.max(worstLoss,currentLength);
  });

  return {
    currentType,
    currentLength,
    bestWin,
    worstLoss
  };
}

function analyticsHomeAway(rows){
  const home=[];
  const away=[];
  const unknown=[];

  rows.forEach(row=>{
    const game=row.game;
    if(!game){
      unknown.push(row);
      return;
    }

    if(row.selection===game.home?.abbr||row.selection===game.home?.name||row.selection===game.home?.shortName){
      home.push(row);
    }else if(row.selection===game.away?.abbr||row.selection===game.away?.name||row.selection===game.away?.shortName){
      away.push(row);
    }else{
      unknown.push(row);
    }
  });

  return {
    home:analyticsRecord(home),
    away:analyticsRecord(away),
    unknown:analyticsRecord(unknown)
  };
}

function analyticsComboSummary(){
  const combos=Array.isArray(typeof predictionCombos!=='undefined'?predictionCombos:null)
    ?predictionCombos
    :[];
  const settled=combos.filter(combo=>['correct','incorrect','push'].includes(String(combo.status||'').toLowerCase()));
  const correct=settled.filter(combo=>String(combo.status).toLowerCase()==='correct').length;
  const incorrect=settled.filter(combo=>String(combo.status).toLowerCase()==='incorrect').length;
  const pushes=settled.filter(combo=>String(combo.status).toLowerCase()==='push').length;
  const rate=correct+incorrect?correct/(correct+incorrect)*100:0;
  const averageLegs=combos.length
    ?combos.reduce((sum,combo)=>sum+(Array.isArray(combo.legs)?combo.legs.length:0),0)/combos.length
    :0;

  return {
    total:combos.length,
    settled:settled.length,
    correct,
    incorrect,
    pushes,
    rate,
    averageLegs
  };
}

function buildPredictionAnalytics(){
  const rows=analyticsRows();
  const record=analyticsRecord(rows);
  const byTeam=analyticsGroup(rows,row=>row.selection);
  const byConference=analyticsGroup(rows,row=>analyticsConferenceForTeam(row.selection));
  const byMarket=analyticsGroup(rows,row=>row.market);
  const byWeek=analyticsGroup(rows,row=>{
    const game=row.game;
    if(game?.week)return `Week ${game.week}`;
    const date=new Date(game?.date||row.prediction?.createdAt||0);
    return Number.isFinite(date.getTime())
      ?date.toLocaleDateString(undefined,{month:'short',day:'numeric'})
      :'Unknown';
  });
  const confidence=analyticsConfidenceGroups(rows);
  const streak=analyticsStreak(rows);
  const homeAway=analyticsHomeAway(rows);
  const combos=analyticsComboSummary();

  predictionAnalyticsState.lastCalculatedAt=new Date().toISOString();
  savePredictionAnalyticsState();

  return {
    rows,
    record,
    byTeam,
    byConference,
    byMarket,
    byWeek,
    confidence,
    streak,
    homeAway,
    combos
  };
}

function analyticsTable(groups,emptyTitle){
  const visible=groups.slice(0,Number(predictionAnalyticsState.topRows)||12);
  if(!visible.length){
    return empty(emptyTitle,'Grade more predictions or lower the minimum sample size.');
  }

  return `<div class="analytics-table">
    <div class="analytics-table-head"><span>Category</span><span>Record</span><span>Rate</span></div>
    ${visible.map(group=>`
      <div class="analytics-table-row">
        <strong>${esc(group.label)}</strong>
        <span>${group.record.correct}-${group.record.incorrect}${group.record.pushes?`-${group.record.pushes}`:''}</span>
        <b>${group.record.rate.toFixed(1)}%</b>
      </div>`).join('')}
  </div>`;
}

function analyticsConfidencePanel(groups){
  return `<div class="analytics-confidence-list">${groups.map(group=>`
    <div class="analytics-confidence-row">
      <div><strong>${group.label}</strong><small>${group.record.graded} graded</small></div>
      <div class="analytics-confidence-track"><span style="width:${Math.max(0,Math.min(100,group.record.rate))}%"></span></div>
      <div><strong>${group.record.graded?group.record.rate.toFixed(1):'—'}%</strong><small>${group.record.graded?`${group.calibrationGap>=0?'+':''}${group.calibrationGap.toFixed(1)} pts vs confidence`:'No data'}</small></div>
    </div>`).join('')}</div>`;
}

function analyticsTrendPanel(groups){
  if(!groups.length)return empty('No trend data','Grade predictions to build the season trend.');

  const max=Math.max(...groups.map(group=>group.record.graded),1);
  return `<div class="analytics-trend">${groups.slice(-14).map(group=>{
    const height=Math.max(8,Math.round(group.record.graded/max*100));
    return `<div class="analytics-trend-column">
      <div class="analytics-trend-bar" title="${esc(group.label)}: ${group.record.rate.toFixed(1)}%" style="height:${height}%">
        <span>${group.record.rate.toFixed(0)}%</span>
      </div>
      <small>${esc(group.label.replace('Week ',''))}</small>
    </div>`;
  }).join('')}</div>`;
}

function predictionAnalyticsPage(){
  setHeading('Prediction Analytics','RECORDS · CALIBRATION · TRENDS');
  const analytics=buildPredictionAnalytics();
  const seasons=[...new Set(predictions.map(analyticsSeason).filter(value=>value!=='Unknown'))].sort().reverse();

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">SEASON PERFORMANCE</p>
      <h2>${analytics.record.correct}-${analytics.record.incorrect}${analytics.record.pushes?`-${analytics.record.pushes}`:''} · ${analytics.record.rate.toFixed(1)}%</h2>
      <p>Analyze your locally saved prediction history by team, conference, type, confidence level, date, and combination performance.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="analyticsExport">Export analytics</button>
      <button class="button" id="analyticsRefresh">Recalculate</button>
      <button class="button" data-page-jump="predictions">Open Prediction Center</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Overall Record',`${analytics.record.correct}-${analytics.record.incorrect}`,`${analytics.record.pushes} pushes`)}
    ${metric('Accuracy',`${analytics.record.rate.toFixed(1)}%`,`${analytics.record.graded} graded`)}
    ${metric('Best Win Streak',analytics.streak.bestWin,'Consecutive correct')}
    ${metric('Longest Loss Streak',analytics.streak.worstLoss,'Consecutive incorrect')}
    ${metric('Saved Combos',analytics.combos.total,`${analytics.combos.rate.toFixed(1)}% settled accuracy`)}
    ${metric('Average Combo Size',analytics.combos.averageLegs.toFixed(1),'Legs per combo')}
  </div>

  <div class="reports-grid">
    ${card('Analytics Controls',`<div class="detail-list">
      <label><span>Season</span>
        <select id="analyticsSeason">
          <option value="all" ${predictionAnalyticsState.season==='all'?'selected':''}>All seasons</option>
          ${seasons.map(season=>`<option value="${season}" ${predictionAnalyticsState.season===season?'selected':''}>${season}</option>`).join('')}
        </select>
      </label>
      <label><span>Status</span>
        <select id="analyticsStatusFilter">
          <option value="graded" ${predictionAnalyticsState.statusFilter==='graded'?'selected':''}>Graded only</option>
          <option value="pending" ${predictionAnalyticsState.statusFilter==='pending'?'selected':''}>Pending only</option>
          <option value="all" ${predictionAnalyticsState.statusFilter==='all'?'selected':''}>All predictions</option>
        </select>
      </label>
      <label><span>Minimum sample size</span><input id="analyticsMinimumSample" type="number" min="1" max="100" value="${predictionAnalyticsState.minimumSample}"></label>
      <label><span>Rows per section</span><input id="analyticsTopRows" type="number" min="3" max="50" value="${predictionAnalyticsState.topRows}"></label>
      <label class="toggle-row"><span>Include pushes in accuracy denominator</span><input type="checkbox" id="analyticsIncludePushes" ${predictionAnalyticsState.includePushes?'checked':''}></label>
      <div><span>Last calculation</span><strong>${new Date(predictionAnalyticsState.lastCalculatedAt).toLocaleString()}</strong></div>
    </div>`)}

    ${card('Home vs Away',`<div class="analytics-split-grid">
      <div><span>Home selections</span><strong>${analytics.homeAway.home.rate.toFixed(1)}%</strong><small>${analytics.homeAway.home.correct}-${analytics.homeAway.home.incorrect}</small></div>
      <div><span>Away selections</span><strong>${analytics.homeAway.away.rate.toFixed(1)}%</strong><small>${analytics.homeAway.away.correct}-${analytics.homeAway.away.incorrect}</small></div>
      <div><span>Unclassified</span><strong>${analytics.homeAway.unknown.rate.toFixed(1)}%</strong><small>${analytics.homeAway.unknown.correct}-${analytics.homeAway.unknown.incorrect}</small></div>
    </div>`)}

    ${card('Confidence Calibration',analyticsConfidencePanel(analytics.confidence),'wide')}
    ${card('Performance Trend',analyticsTrendPanel(analytics.byWeek),'wide')}
    ${card('By Prediction Type',analyticsTable(analytics.byMarket,'No prediction-type history'))}
    ${card('By Conference',analyticsTable(analytics.byConference,'No conference history'))}
    ${card('Best Teams',analyticsTable(analytics.byTeam,'No team history'),'wide')}

    ${card('Combo Performance',`<div class="detail-list">
      <div><span>Total saved</span><strong>${analytics.combos.total}</strong></div>
      <div><span>Settled</span><strong>${analytics.combos.settled}</strong></div>
      <div><span>Correct</span><strong>${analytics.combos.correct}</strong></div>
      <div><span>Incorrect</span><strong>${analytics.combos.incorrect}</strong></div>
      <div><span>Pushes</span><strong>${analytics.combos.pushes}</strong></div>
      <div><span>Accuracy</span><strong>${analytics.combos.rate.toFixed(1)}%</strong></div>
    </div>`)}

    ${card('Analytics Boundary',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Based on your saved results</strong><small>Only locally stored and graded prediction history is analyzed.</small></div></div>
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>No financial-return claims</strong><small>OnlyBeats reports prediction accuracy and record trends, not investment returns.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Small samples can mislead</strong><small>Use the minimum sample control before drawing conclusions.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Conference matching depends on team metadata</strong><small>Unrecognized teams may appear under Unknown.</small></div></div>
    </div>`,'wide')}
  </div>`;
}

function exportPredictionAnalytics(){
  const analytics=buildPredictionAnalytics();
  const payload={
    generatedAt:new Date().toISOString(),
    version:VERSION,
    filters:predictionAnalyticsState,
    overall:analytics.record,
    streak:analytics.streak,
    homeAway:analytics.homeAway,
    combos:analytics.combos,
    confidence:analytics.confidence.map(group=>({
      label:group.label,
      record:group.record,
      expected:group.expected,
      calibrationGap:group.calibrationGap
    })),
    byTeam:analytics.byTeam.map(group=>({label:group.label,record:group.record})),
    byConference:analytics.byConference.map(group=>({label:group.label,record:group.record})),
    byMarket:analytics.byMarket.map(group=>({label:group.label,record:group.record})),
    byWeek:analytics.byWeek.map(group=>({label:group.label,record:group.record}))
  };

  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-prediction-analytics-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function bindPredictionAnalytics(){
  const update=(id,key,parser=value=>value)=>{
    if($(id))$(id).onchange=event=>{
      predictionAnalyticsState[key]=parser(event.target.value,event.target.checked);
      savePredictionAnalyticsState();
      renderPage();
    };
  };

  update('analyticsSeason','season');
  update('analyticsStatusFilter','statusFilter');
  update('analyticsMinimumSample','minimumSample',value=>Math.max(1,Math.min(100,Number(value)||1)));
  update('analyticsTopRows','topRows',value=>Math.max(3,Math.min(50,Number(value)||12)));

  if($('analyticsIncludePushes'))$('analyticsIncludePushes').onchange=event=>{
    predictionAnalyticsState.includePushes=event.target.checked;
    savePredictionAnalyticsState();
    renderPage();
  };

  if($('analyticsExport'))$('analyticsExport').onclick=()=>{
    exportPredictionAnalytics();
    toast('Prediction analytics exported','success');
  };

  if($('analyticsRefresh'))$('analyticsRefresh').onclick=()=>{
    renderPage();
    toast('Prediction analytics recalculated');
  };
}

function installPredictionAnalyticsStyles(){
  if(document.getElementById('onlybeatsPredictionAnalyticsStyles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsPredictionAnalyticsStyles';
  style.textContent=`
    .analytics-table{display:grid;gap:6px}
    .analytics-table-head,.analytics-table-row{display:grid;grid-template-columns:minmax(0,1fr) 110px 80px;gap:12px;align-items:center;padding:9px 10px;border-radius:9px}
    .analytics-table-head{font-size:.78rem;color:#9aabbd;text-transform:uppercase;letter-spacing:.08em}
    .analytics-table-row{background:rgba(255,255,255,.025)}
    .analytics-table-row b{text-align:right;color:#f4bd45}
    .analytics-confidence-list{display:grid;gap:12px}
    .analytics-confidence-row{display:grid;grid-template-columns:110px 1fr 180px;gap:14px;align-items:center}
    .analytics-confidence-row small{display:block;color:#9aabbd;margin-top:3px}
    .analytics-confidence-track{height:11px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
    .analytics-confidence-track span{display:block;height:100%;background:#f4bd45;border-radius:99px}
    .analytics-split-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .analytics-split-grid>div{padding:15px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.025)}
    .analytics-split-grid span,.analytics-split-grid small{display:block;color:#9aabbd}
    .analytics-split-grid strong{display:block;font-size:1.7rem;margin:7px 0}
    .analytics-trend{display:flex;align-items:flex-end;gap:8px;height:220px;padding-top:24px;overflow-x:auto}
    .analytics-trend-column{display:grid;grid-template-rows:1fr auto;gap:7px;min-width:48px;height:100%;text-align:center}
    .analytics-trend-bar{display:flex;align-items:flex-start;justify-content:center;min-height:8px;margin-top:auto;padding-top:5px;border-radius:8px 8px 3px 3px;background:#f4bd45;color:#08101a;font-size:.72rem;font-weight:800}
    .analytics-trend-column small{color:#9aabbd}
    @media(max-width:760px){
      .analytics-confidence-row{grid-template-columns:1fr}
      .analytics-split-grid{grid-template-columns:1fr}
      .analytics-table-head,.analytics-table-row{grid-template-columns:minmax(0,1fr) 90px 70px}
    }
  `;
  document.head.appendChild(style);
}

function initializePredictionAnalytics(){
  loadPredictionAnalyticsState();
  installPredictionAnalyticsStyles();
}
