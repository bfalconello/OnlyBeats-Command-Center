'use strict';

// OnlyBeats v1.1 Season Archive — Phase 1.
// Saves immutable local snapshots without altering live scores or prediction scoring.

const SEASON_ARCHIVE_FORMAT=1;
let seasonArchiveFilter='all';

function saveSeasonArchives(){
  localStorage.setItem(SEASON_ARCHIVE_KEY,JSON.stringify(seasonArchives));
}

function seasonArchiveClone(value){
  return JSON.parse(JSON.stringify(value));
}

function archiveWeekLabelFromGames(rows){
  if(!rows.length)return `Snapshot ${new Date().toLocaleDateString()}`;
  const dates=rows.map(game=>new Date(game.date)).filter(date=>!Number.isNaN(date.getTime())).sort((a,b)=>a-b);
  if(!dates.length)return `Snapshot ${new Date().toLocaleDateString()}`;
  const first=dates[0];
  const last=dates[dates.length-1];
  const sameDay=first.toDateString()===last.toDateString();
  return sameDay
    ? first.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})
    : `${first.toLocaleDateString([],{month:'short',day:'numeric'})}–${last.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}`;
}

function archiveCurrentSnapshot(label=''){
  const gameIds=new Set(games.map(game=>game.id));
  const teamIds=new Set(games.flatMap(game=>[game.away.abbr,game.home.abbr]));
  const archive={
    id:crypto.randomUUID?.()||`archive-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    format:SEASON_ARCHIVE_FORMAT,
    label:String(label||'').trim()||archiveWeekLabelFromGames(games),
    createdAt:new Date().toISOString(),
    version:VERSION,
    summary:{
      games:games.length,
      live:games.filter(game=>game.state==='in').length,
      final:games.filter(game=>game.state==='post').length,
      upcoming:games.filter(game=>game.state==='pre').length,
      predictions:predictions.filter(item=>gameIds.has(item.gameId)).length,
      futures:futures.length,
      availability:availabilityEntries.filter(item=>teamIds.has(item.team)).length
    },
    games:seasonArchiveClone(games),
    predictions:seasonArchiveClone(predictions.filter(item=>gameIds.has(item.gameId))),
    futures:seasonArchiveClone(futures),
    availability:seasonArchiveClone(availabilityEntries.filter(item=>teamIds.has(item.team))),
    timeline:seasonArchiveClone(timelineEvents.filter(item=>!item.gameId||gameIds.has(item.gameId))),
    favorites:seasonArchiveClone(favorites),
    notes:String(quickNotes||''),
    reflection:String(localStorage.getItem('onlybeats.yearbook.note.v1')||'')
  };
  seasonArchives=[archive,...seasonArchives];
  activeSeasonArchiveId=archive.id;
  saveSeasonArchives();
  addTimelineEvent({
    type:'system',
    title:'Season snapshot archived',
    detail:`${archive.label} · ${archive.summary.games} games`,
    sourceKey:`archive:${archive.id}`
  });
  return archive;
}

function selectedSeasonArchive(){
  return seasonArchives.find(archive=>archive.id===activeSeasonArchiveId)||seasonArchives[0]||null;
}

function filteredSeasonArchives(){
  const rows=[...seasonArchives].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if(seasonArchiveFilter==='all')return rows;
  if(seasonArchiveFilter==='with-predictions')return rows.filter(row=>row.summary?.predictions>0);
  if(seasonArchiveFilter==='completed')return rows.filter(row=>(row.summary?.final||0)>0);
  return rows;
}

function archiveResultSummary(archive){
  const graded=(archive.predictions||[]).map(prediction=>{
    const game=(archive.games||[]).find(item=>item.id===prediction.gameId);
    if(!game)return {status:'pending',score:null};
    try{return predictionResult(prediction,game)}
    catch{return {status:'pending',score:null}}
  });
  const decisions=graded.filter(result=>['correct','incorrect'].includes(result.status));
  const correct=decisions.filter(result=>result.status==='correct').length;
  const score=graded.reduce((sum,result)=>sum+(Number(result.score)||0),0);
  return {
    decisions:decisions.length,
    correct,
    accuracy:decisions.length?correct/decisions.length*100:0,
    score
  };
}

function archiveCard(archive){
  const result=archiveResultSummary(archive);
  return `<article class="card ${archive.id===activeSeasonArchiveId?'active':''}">
    <div class="card-head">
      <div>
        <span class="provider-badge">ARCHIVED</span>
        <h3>${esc(archive.label)}</h3>
      </div>
      <small>${new Date(archive.createdAt).toLocaleString()}</small>
    </div>
    <div class="team-stat-grid">
      <div><span>Games</span><strong>${archive.summary?.games||0}</strong></div>
      <div><span>Finals</span><strong>${archive.summary?.final||0}</strong></div>
      <div><span>Predictions</span><strong>${archive.summary?.predictions||0}</strong></div>
      <div><span>Accuracy</span><strong>${result.accuracy.toFixed(1)}%</strong></div>
      <div><span>Score</span><strong>${formatNumber(result.score)}</strong></div>
      <div><span>Timeline</span><strong>${archive.timeline?.length||0}</strong></div>
    </div>
    <div class="button-row">
      <button class="button primary" data-archive-open="${archive.id}">View snapshot</button>
      <button class="button" data-archive-export="${archive.id}">Export</button>
      <button class="button danger" data-archive-delete="${archive.id}">Delete</button>
    </div>
  </article>`;
}

function archiveGameRow(game){
  return `<div class="intel-row">
    <span class="intel-icon">${game.state==='post'?'✓':game.state==='in'?'●':'◷'}</span>
    <div>
      <strong>${game.away.rank?`#${game.away.rank} `:''}${esc(game.away.shortName)} ${game.away.score} – ${game.home.score} ${game.home.rank?`#${game.home.rank} `:''}${esc(game.home.shortName)}</strong>
      <small>${esc(game.status)}${game.network?` · ${esc(game.network)}`:''}</small>
    </div>
    <span class="provider-badge">${esc(statusLabel(game.state))}</span>
  </div>`;
}

function archivePredictionRow(prediction,archive){
  const game=(archive.games||[]).find(item=>item.id===prediction.gameId);
  let result={status:'pending',label:'Pending',score:null};
  try{if(game)result=predictionResult(prediction,game)}catch{}
  return `<div class="intel-row">
    <span class="intel-icon">${result.status==='correct'?'✓':result.status==='incorrect'?'×':result.status==='push'?'—':'○'}</span>
    <div>
      <strong>${esc(prediction.gameName||'Archived prediction')}</strong>
      <small>${esc(predictionTypeLabel(prediction))} · ${esc(predictionPickLabel(prediction,game))} · Confidence ${formatNumber(prediction.confidence)}</small>
    </div>
    <b>${result.score===null?'Pending':formatNumber(result.score)}</b>
  </div>`;
}

function archiveDetail(archive){
  if(!archive)return card('Snapshot Details',empty('No archive selected','Save or select a season snapshot.'),'wide');
  const result=archiveResultSummary(archive);
  return `<section class="card">
    <div class="card-head">
      <div><p class="eyebrow">ARCHIVED SNAPSHOT</p><h2>${esc(archive.label)}</h2><p class="muted">${new Date(archive.createdAt).toLocaleString()} · Created with OnlyBeats ${esc(archive.version||'unknown')}</p></div>
      <button class="button" data-archive-export="${archive.id}">Export snapshot</button>
    </div>
    <div class="metric-grid">
      ${metric('Games',archive.summary?.games||0,`${archive.summary?.final||0} final`)}
      ${metric('Predictions',archive.summary?.predictions||0,`${result.decisions} graded decisions`)}
      ${metric('Accuracy',`${result.accuracy.toFixed(1)}%`,`${result.correct}/${result.decisions} correct`)}
      ${metric('Score',formatNumber(result.score),'Archived result')}
      ${metric('Availability Notes',archive.summary?.availability||0,'Snapshot notes')}
      ${metric('Timeline Events',archive.timeline?.length||0,'Archived history')}
    </div>
    <div class="reports-grid">
      ${card('Archived Games',(archive.games||[]).length?`<div class="intel-list">${archive.games.map(archiveGameRow).join('')}</div>`:empty('No games','This snapshot contains no games.'),'wide')}
      ${card('Archived Predictions',(archive.predictions||[]).length?`<div class="intel-list">${archive.predictions.map(item=>archivePredictionRow(item,archive)).join('')}</div>`:empty('No predictions','This snapshot contains no predictions.'),'wide')}
      ${card('Archived Notes',`<div class="detail-list"><div><span>Quick notes</span><strong>${esc(archive.notes||'No notes saved')}</strong></div><div><span>Season reflection</span><strong>${esc(archive.reflection||'No reflection saved')}</strong></div><div><span>Futures</span><strong>${archive.futures?.length||0}</strong></div><div><span>Favorites</span><strong>${archive.favorites?.length||0}</strong></div></div>`,'wide')}
    </div>
  </section>`;
}

function downloadSeasonArchive(filename,payload){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportSeasonArchive(archive){
  if(!archive)return;
  downloadSeasonArchive(
    `onlybeats-season-archive-${archive.label.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||archive.id}.json`,
    {format:'OnlyBeats Season Archive',archiveVersion:SEASON_ARCHIVE_FORMAT,exportedAt:new Date().toISOString(),archive}
  );
}

function exportAllSeasonArchives(){
  downloadSeasonArchive(
    `onlybeats-season-archives-${new Date().toISOString().slice(0,10)}.json`,
    {format:'OnlyBeats Season Archive Collection',archiveVersion:SEASON_ARCHIVE_FORMAT,exportedAt:new Date().toISOString(),archives:seasonArchives}
  );
}

function importSeasonArchiveFile(){
  const input=document.createElement('input');
  input.type='file';
  input.accept='application/json,.json';
  input.onchange=async()=>{
    const file=input.files?.[0];
    if(!file)return;
    try{
      const payload=JSON.parse(await file.text());
      let rows=[];
      if(payload?.format==='OnlyBeats Season Archive'&&payload.archive)rows=[payload.archive];
      else if(payload?.format==='OnlyBeats Season Archive Collection'&&Array.isArray(payload.archives))rows=payload.archives;
      else throw new Error('This is not an OnlyBeats season archive file.');
      const valid=rows.filter(row=>row&&row.format===SEASON_ARCHIVE_FORMAT&&row.id&&Array.isArray(row.games));
      if(!valid.length)throw new Error('No valid snapshots were found.');
      const existing=new Set(seasonArchives.map(row=>row.id));
      const imported=valid.filter(row=>!existing.has(row.id));
      seasonArchives=[...imported,...seasonArchives];
      if(imported[0])activeSeasonArchiveId=imported[0].id;
      saveSeasonArchives();
      toast(`${imported.length} archive${imported.length===1?'':'s'} imported`);
      renderPage();
    }catch(error){
      toast(error?.message||'Archive import failed','error');
    }
  };
  input.click();
}

function seasonArchivePage(){
  setHeading('Season Archive','SAVE · REVISIT · EXPORT');
  const rows=filteredSeasonArchives();
  const selected=selectedSeasonArchive();
  const currentResult=combinedAnalytics();

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">ONLYBEATS SEASON ARCHIVE</p>
      <h2>${seasonArchives.length?`${seasonArchives.length} snapshot${seasonArchives.length===1?'':'s'} saved.`:'Create your first season snapshot.'}</h2>
      <p>Preserve the current schedule, scores, predictions, futures, availability notes, timeline events, favorites, and reflections as an immutable local snapshot.</p>
    </div>
    <div class="button-row">
      <input id="archiveLabel" placeholder="Week or snapshot name" value="${esc(archiveWeekLabelFromGames(games))}">
      <button class="button primary" id="saveSeasonSnapshot">Save current snapshot</button>
      <button class="button" id="importSeasonArchive">Import</button>
      <button class="button" id="exportAllSeasonArchives" ${seasonArchives.length?'':'disabled'}>Export all</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Saved Snapshots',seasonArchives.length,'Stored locally')}
    ${metric('Current Games',games.length,`${games.filter(game=>game.state==='post').length} final`)}
    ${metric('Current Predictions',predictions.length,`${currentResult.pending} pending`)}
    ${metric('Current Accuracy',`${currentResult.accuracy.toFixed(1)}%`,`${currentResult.correct}/${currentResult.decisions} correct`)}
    ${metric('Current Futures',futures.length,'Season outcomes')}
    ${metric('Timeline Events',timelineEvents.length,'Available to archive')}
  </div>

  <div class="wall-toolbar">
    <div class="wall-status-tabs">
      ${[['all','All'],['with-predictions','With Predictions'],['completed','With Finals']].map(([id,label])=>`<button class="filter-button ${seasonArchiveFilter===id?'active':''}" data-archive-filter="${id}">${label}</button>`).join('')}
    </div>
  </div>

  <section class="command-center-grid">
    ${rows.length?rows.map(archiveCard).join(''):empty('No season snapshots','Save the current slate to begin your archive.')}
  </section>

  ${archiveDetail(selected)}`;
}

function bindSeasonArchive(){
  if($('saveSeasonSnapshot'))$('saveSeasonSnapshot').onclick=()=>{
    const label=$('archiveLabel')?.value||'';
    const archive=archiveCurrentSnapshot(label);
    toast(`${archive.label} saved to Season Archive`);
    renderPage();
  };

  if($('importSeasonArchive'))$('importSeasonArchive').onclick=()=>importSeasonArchiveFile();
  if($('exportAllSeasonArchives'))$('exportAllSeasonArchives').onclick=()=>exportAllSeasonArchives();

  document.querySelectorAll('[data-archive-filter]').forEach(button=>{
    button.onclick=()=>{
      seasonArchiveFilter=button.dataset.archiveFilter;
      renderPage();
    };
  });

  document.querySelectorAll('[data-archive-open]').forEach(button=>{
    button.onclick=()=>{
      activeSeasonArchiveId=button.dataset.archiveOpen;
      renderPage();
      setTimeout(()=>document.querySelector('.card h2')?.scrollIntoView({behavior:settings.animations?'smooth':'auto',block:'start'}),0);
    };
  });

  document.querySelectorAll('[data-archive-export]').forEach(button=>{
    button.onclick=()=>exportSeasonArchive(seasonArchives.find(row=>row.id===button.dataset.archiveExport));
  });

  document.querySelectorAll('[data-archive-delete]').forEach(button=>{
    button.onclick=()=>{
      const archive=seasonArchives.find(row=>row.id===button.dataset.archiveDelete);
      if(!archive||!confirm(`Delete archived snapshot "${archive.label}"?`))return;
      seasonArchives=seasonArchives.filter(row=>row.id!==archive.id);
      if(activeSeasonArchiveId===archive.id)activeSeasonArchiveId=seasonArchives[0]?.id||'';
      saveSeasonArchives();
      toast('Season snapshot deleted');
      renderPage();
    };
  });
}
