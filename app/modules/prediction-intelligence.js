'use strict';

// v0.15 Prediction Intelligence — Phase 1.
// Reviews the user's own saved prediction journal. It does not generate picks.

let predictionReviewFilter='all';

function predictionContextSnapshot(prediction){
  const game=predictionGame(prediction);
  const result=predictionResult(prediction,game);
  const issues=[];
  const strengths=[];

  if(!game){
    issues.push('Game is no longer available in the loaded scoreboard');
    return {prediction,game,result,issues,strengths,readiness:20,attention:'high'};
  }

  if(!String(prediction.notes||'').trim()){
    issues.push('No journal reasoning saved');
  }else{
    strengths.push('Reasoning note saved');
  }

  if(prediction.type!=='winner'&&!Number.isFinite(Number(prediction.line))){
    issues.push('Line is missing');
  }else if(prediction.type!=='winner'){
    strengths.push('Line recorded');
  }

  if(!Number.isFinite(Number(prediction.confidence))||Number(prediction.confidence)<=0){
    issues.push('Confidence is invalid');
  }else{
    strengths.push('Confidence recorded');
  }

  const availability=gameAvailabilitySnapshot(game);
  if(availability.concerning.length){
    issues.push(`${availability.concerning.length} availability concern${availability.concerning.length===1?'':'s'} to review`);
  }else{
    strengths.push('No saved availability concerns');
  }

  const venueLocation=[game.city,game.stateCode].filter(Boolean).join(', ');
  if(!venueLocation){
    issues.push('Venue weather location unavailable');
  }else{
    strengths.push('Venue weather shortcut available');
  }

  if(!game.network){
    issues.push('Broadcast network not listed');
  }else{
    strengths.push('Broadcast context available');
  }

  if(game.state==='post'){
    strengths.push(`Result graded: ${result.label}`);
  }else if(game.state==='in'){
    strengths.push('Game is live');
  }else{
    strengths.push('Game is upcoming');
  }

  const readiness=Math.max(0,Math.min(100,100-issues.length*15));
  const attention=issues.length>=3?'high':issues.length?'medium':'ready';
  return {prediction,game,result,issues,strengths,readiness,attention};
}

function predictionReviewRows(){
  return predictions.map(predictionContextSnapshot).sort((a,b)=>{
    if(a.attention!==b.attention){
      const order={high:0,medium:1,ready:2};
      return order[a.attention]-order[b.attention];
    }
    return new Date(a.game?.date||a.prediction.createdAt)-new Date(b.game?.date||b.prediction.createdAt);
  });
}

function filteredPredictionReviews(){
  const rows=predictionReviewRows();
  if(predictionReviewFilter==='all')return rows;
  if(predictionReviewFilter==='attention')return rows.filter(row=>row.issues.length);
  if(predictionReviewFilter==='ready')return rows.filter(row=>!row.issues.length);
  if(predictionReviewFilter==='pending')return rows.filter(row=>row.result.status==='pending');
  if(predictionReviewFilter==='graded')return rows.filter(row=>['correct','incorrect','push'].includes(row.result.status));
  return rows;
}

function predictionConsistencySummary(){
  const rows=predictionReviewRows();
  const withNotes=rows.filter(row=>String(row.prediction.notes||'').trim()).length;
  const validConfidence=rows.filter(row=>Number(row.prediction.confidence)>0).length;
  const completeLines=rows.filter(row=>row.prediction.type==='winner'||Number.isFinite(Number(row.prediction.line))).length;
  const averageReadiness=rows.length?rows.reduce((sum,row)=>sum+row.readiness,0)/rows.length:0;
  return {rows,withNotes,validConfidence,completeLines,averageReadiness};
}

function confidenceCalibrationGap(){
  const usable=confidenceBuckets().filter(bucket=>bucket.graded>0);
  if(!usable.length)return [];
  return usable.map(bucket=>{
    const midpoint=bucket.label==='100+'?100:
      bucket.label.includes('–')
        ? bucket.label.split('–').map(Number).reduce((a,b)=>a+b,0)/2
        : 0;
    return {
      ...bucket,
      expected:midpoint,
      gap:bucket.accuracy-midpoint
    };
  });
}

function calibrationGapHtml(){
  const rows=confidenceCalibrationGap();
  if(!rows.length)return empty('Not enough graded predictions','Grade more predictions to compare confidence ranges with actual accuracy.');
  return `<div class="intel-list">${rows.map(row=>`
    <div class="intel-row">
      <span class="intel-icon">${Math.abs(row.gap)<=10?'✓':row.gap>10?'↑':'↓'}</span>
      <div>
        <strong>${esc(row.label)} confidence</strong>
        <small>${row.correct}/${row.graded} correct · Actual accuracy ${row.accuracy.toFixed(1)}%</small>
      </div>
      <b>${row.gap>=0?'+':''}${row.gap.toFixed(1)} pts</b>
    </div>`).join('')}</div>`;
}

function predictionReviewCard(row){
  const prediction=row.prediction;
  const game=row.game;
  const title=game
    ? `${game.away.shortName} at ${game.home.shortName}`
    : prediction.gameName||'Unavailable game';
  return `<article class="card">
    <div class="card-head">
      <div>
        <span class="provider-badge">${row.attention==='ready'?'READY':row.attention==='high'?'REVIEW NOW':'REVIEW'}</span>
        <span class="status-badge state-${game?.state||'pre'}">${esc(row.result.label)}</span>
      </div>
      <strong>${row.readiness}%</strong>
    </div>
    <h3>${esc(title)}</h3>
    <p class="muted">${esc(predictionTypeLabel(prediction))} · ${esc(predictionPickLabel(prediction,game))} · Confidence ${formatNumber(prediction.confidence)}</p>
    <div class="favorite-list">
      ${row.issues.map(issue=>`<span class="favorite-chip">${esc(issue)}</span>`).join('')}
      ${!row.issues.length?'<span class="favorite-chip active">Context complete</span>':''}
    </div>
    <div class="button-row">
      <button class="button primary" data-review-edit="${prediction.id}">Review prediction</button>
      ${game?`<button class="button" data-review-game="${game.id}">Game details</button>`:''}
      ${game&&[game.city,game.stateCode].filter(Boolean).length?`<button class="button" data-review-weather="${game.id}">Venue weather</button>`:''}
    </div>
  </article>`;
}

function predictionIntelligencePage(){
  setHeading('Prediction Intelligence','CALIBRATION · CONTEXT · REVIEW QUEUE');
  const combined=combinedAnalytics();
  const summary=predictionConsistencySummary();
  const reviews=filteredPredictionReviews();
  const attention=summary.rows.filter(row=>row.issues.length);
  const ready=summary.rows.filter(row=>!row.issues.length);
  const pending=summary.rows.filter(row=>row.result.status==='pending');
  const filters=[
    ['all','All'],
    ['attention','Needs Review'],
    ['ready','Ready'],
    ['pending','Pending'],
    ['graded','Graded']
  ];
  const note=localStorage.getItem('onlybeats.yearbook.note.v1')||'';

  return `<section class="prediction-hero">
    <div>
      <p class="eyebrow">PREDICTION INTELLIGENCE</p>
      <h2>${attention.length?`${attention.length} prediction${attention.length===1?'':'s'} could use more context.`:'Your prediction journal is ready.'}</h2>
      <p>Review your own confidence calibration, documentation consistency, matchup context, and resolved results. This page does not create or recommend picks.</p>
    </div>
    <div class="button-row">
      <button class="button primary" data-page-jump="predictions">Open Prediction Center</button>
      <button class="button" id="reportExportPredictions">Export prediction CSV</button>
    </div>
  </section>

  <div class="metric-grid prediction-metrics">
    ${metric('Overall Accuracy',`${combined.accuracy.toFixed(1)}%`,`${combined.correct}/${combined.decisions} correct`)}
    ${metric('Average Readiness',`${summary.averageReadiness.toFixed(1)}%`,'Context completeness')}
    ${metric('Needs Review',attention.length,'Missing context')}
    ${metric('Ready',ready.length,'Context complete')}
    ${metric('Pending',pending.length,'Awaiting results')}
    ${metric('Combined Score',formatNumber(combined.earned),'Games + futures')}
  </div>

  <section class="card command-top-signal">
    <div>
      <p class="eyebrow">JOURNAL CONSISTENCY</p>
      <h3>${summary.withNotes}/${summary.rows.length} predictions include reasoning notes.</h3>
      <p class="muted">${summary.completeLines}/${summary.rows.length} have complete type/line details · ${summary.validConfidence}/${summary.rows.length} have valid confidence values.</p>
    </div>
    <button class="button" data-page-jump="predictions">Add or edit entries</button>
  </section>

  <div class="reports-grid">
    ${card('Confidence Calibration',confidenceCalibrationHtml(),'wide')}
    ${card('Calibration Gap',calibrationGapHtml(),'wide')}
    ${card('Weekly Accuracy Trend',weeklyInsightChart())}
    ${card('Performance by Prediction Type',typeInsightChart())}
  </div>

  <div class="wall-toolbar">
    <div class="wall-status-tabs">
      ${filters.map(([id,label])=>`<button class="filter-button ${predictionReviewFilter===id?'active':''}" data-review-filter="${id}">${label}</button>`).join('')}
    </div>
  </div>

  <section class="command-center-grid">
    ${reviews.length?reviews.map(predictionReviewCard).join(''):empty('No predictions in this view','Change the filter or add predictions in Prediction Center.')}
  </section>

  ${card('Season Reflection',`<textarea id="yearbookNote" class="quick-notes" placeholder="Write a season reflection…">${esc(note)}</textarea><small class="muted">Saved locally as part of your season yearbook.</small>`,'wide')}`;
}

function bindPredictionIntelligence(){
  document.querySelectorAll('[data-review-filter]').forEach(button=>{
    button.onclick=()=>{
      predictionReviewFilter=button.dataset.reviewFilter;
      renderPage();
    };
  });

  document.querySelectorAll('[data-review-edit]').forEach(button=>{
    button.onclick=()=>{
      editingPredictionId=button.dataset.reviewEdit;
      predictionView='games';
      navigate('predictions');
    };
  });

  document.querySelectorAll('[data-review-game]').forEach(button=>{
    button.onclick=()=>showGame(button.dataset.reviewGame);
  });

  document.querySelectorAll('[data-review-weather]').forEach(button=>{
    button.onclick=()=>{
      const game=games.find(candidate=>candidate.id===button.dataset.reviewWeather);
      if(!game)return;
      const location=[game.city,game.stateCode].filter(Boolean).join(', ');
      if(!location){
        toast('Venue weather location is unavailable','error');
        return;
      }
      settings.weatherLocation=location;
      saveSettings(false);
      navigate('weather');
      fetchWeather(location);
    };
  });
}
