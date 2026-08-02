'use strict';

const TIMELINE_LIMIT=500;
let timelineFilter='all';

function saveTimelineEvents(){
  localStorage.setItem(TIMELINE_KEY,JSON.stringify(timelineEvents.slice(-TIMELINE_LIMIT)));
}

function timelineEventId(event){
  return [event.type||'event',event.gameId||'',event.teamAbbr||'',event.title||'',event.detail||'',event.sourceKey||''].join('|');
}

function addTimelineEvent(event){
  const normalized={
    id:event.id||`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    time:event.time||new Date().toISOString(),
    type:event.type||'system',
    title:String(event.title||'Timeline event'),
    detail:String(event.detail||''),
    gameId:event.gameId||'',
    teamAbbr:event.teamAbbr||'',
    sourceKey:event.sourceKey||''
  };
  const duplicateKey=timelineEventId(normalized);
  const duplicate=timelineEvents.slice(-50).some(existing=>
    timelineEventId(existing)===duplicateKey&&
    Math.abs(new Date(existing.time)-new Date(normalized.time))<60000
  );
  if(duplicate)return false;
  timelineEvents.push(normalized);
  if(timelineEvents.length>TIMELINE_LIMIT)timelineEvents=timelineEvents.slice(-TIMELINE_LIMIT);
  saveTimelineEvents();
  return true;
}

function captureTimelineSnapshot(reason='refresh'){
  const now=new Date().toISOString();
  for(const game of games){
    const sourceKey=`${game.id}:${game.state}:${game.away.score}-${game.home.score}:${game.status}`;
    const previous=timelineEvents.slice().reverse().find(event=>event.gameId===game.id&&event.type==='game-state');
    if(!previous||previous.sourceKey!==sourceKey){
      addTimelineEvent({
        type:'game-state',
        title:game.state==='in'?'Game live':game.state==='post'?'Final score':'Upcoming game',
        detail:`${game.away.shortName} ${game.away.score} – ${game.home.score} ${game.home.shortName} · ${game.status}`,
        gameId:game.id,
        sourceKey,
        time:now
      });
    }
    const rankedTrailing=game.state!=='pre'&&(
      (game.away.rank&&game.away.score<game.home.score)||
      (game.home.rank&&game.home.score<game.away.score)
    );
    if(rankedTrailing){
      addTimelineEvent({
        type:'upset',
        title:'Upset signal',
        detail:`${game.away.shortName} ${game.away.score} – ${game.home.score} ${game.home.shortName}`,
        gameId:game.id,
        sourceKey:`upset:${game.id}:${game.away.score}-${game.home.score}:${game.status}`,
        time:now
      });
    }
    if(isFavoriteGame(game)&&game.state==='in'){
      addTimelineEvent({
        type:'favorite',
        title:'Favorite team live',
        detail:`${game.away.shortName} at ${game.home.shortName} · ${game.status}`,
        gameId:game.id,
        sourceKey:`favorite:${game.id}:${game.status}`,
        time:now
      });
    }
  }
  if(reason==='score-refresh'){
    addTimelineEvent({
      type:'system',
      title:'Scoreboard refreshed',
      detail:`${games.length} games loaded`,
      sourceKey:`refresh:${new Date().toISOString().slice(0,16)}`,
      time:now
    });
  }
  return timelineEvents;
}

function timelineFilteredEvents(){
  const rows=[...timelineEvents].sort((a,b)=>new Date(b.time)-new Date(a.time));
  return timelineFilter==='all'?rows:rows.filter(event=>event.type===timelineFilter);
}

function timelineIcon(type){
  return ({'game-state':'●','upset':'!','favorite':'★','prediction':'✓','availability':'♙','system':'•'})[type]||'•';
}

function timelineLabel(type){
  return ({'game-state':'Game','upset':'Upset','favorite':'Favorite','prediction':'Prediction','availability':'Availability','system':'System'})[type]||'Event';
}

function timelineActionFor(event){
  if(event.gameId){
    if(event.type==='prediction')return {label:'Open Prediction Center',action:'prediction'};
    return {label:'Open game',action:'game'};
  }
  if(event.teamAbbr)return {label:'Open Team Intelligence',action:'team'};
  if(event.type==='availability')return {label:'Open Availability',action:'availability'};
  return null;
}

function timelineRow(event){
  const action=timelineActionFor(event);
  return `<div class="intel-row">
    <span class="intel-icon">${timelineIcon(event.type)}</span>
    <div><strong>${esc(event.title)}</strong><small>${new Date(event.time).toLocaleString()} · ${esc(event.detail)}</small></div>
    <div class="button-row">
      <span class="provider-badge">${timelineLabel(event.type)}</span>
      ${action?`<button class="button" data-timeline-action="${action.action}" data-event-id="${event.id}">${action.label}</button>`:''}
    </div>
  </div>`;
}

function timelineSummary(){
  const rows=timelineFilteredEvents();
  return {
    total:rows.length,
    recent24:rows.filter(event=>Date.now()-new Date(event.time)<86400000).length,
    games:rows.filter(event=>event.type==='game-state').length,
    upsets:rows.filter(event=>event.type==='upset').length,
    predictions:rows.filter(event=>event.type==='prediction').length,
    availability:rows.filter(event=>event.type==='availability').length
  };
}

function liveCommandTimelinePage(){
  setHeading('Live Command Timeline','CHRONOLOGICAL GAMEDAY EVENTS');
  captureTimelineSnapshot('page-open');
  const rows=timelineFilteredEvents();
  const summary=timelineSummary();
  const filters=[['all','All'],['game-state','Games'],['upset','Upsets'],['favorite','Favorites'],['prediction','Predictions'],['availability','Availability'],['system','System']];

  return `<section class="intel-hero">
    <div><p class="eyebrow">LIVE COMMAND TIMELINE</p><h2>${rows.length?`${rows.length} timeline event${rows.length===1?'':'s'} recorded.`:'Your GameDay history starts here.'}</h2><p>Follow score changes, live games, upset signals, favorites, predictions, availability notes, and refresh events in one chronological feed.</p></div>
    <div class="button-row"><button class="button primary" id="refreshTimeline">${loading?'Refreshing timeline…':'Refresh timeline'}</button><button class="button" id="exportTimeline">Export timeline</button><button class="button" id="clearTimeline">Clear timeline</button></div>
  </section>
  <div class="metric-grid">
    ${metric('Visible Events',summary.total,`${summary.recent24} in last 24 hours`)}
    ${metric('Game Updates',summary.games,'Loaded history')}
    ${metric('Upset Signals',summary.upsets,'Ranked teams trailing')}
    ${metric('Prediction Events',summary.predictions,'Local entries')}
    ${metric('Availability Events',summary.availability,'Manual notes')}
    ${metric('Storage Limit',TIMELINE_LIMIT,'Newest retained')}
  </div>
  <div class="wall-toolbar"><div class="wall-status-tabs">${filters.map(([id,label])=>`<button class="filter-button ${timelineFilter===id?'active':''}" data-timeline-filter="${id}">${label}</button>`).join('')}</div></div>
  ${card('GameDay Timeline',rows.length?`<div class="intel-list">${rows.slice(0,250).map(timelineRow).join('')}</div>`:empty('No timeline events yet','Refresh scores, save predictions, or add availability notes to begin the timeline.'),'wide')}`;
}

function runTimelineAction(action,eventId){
  const event=timelineEvents.find(row=>row.id===eventId);
  if(!event)return;
  if(action==='game'&&event.gameId){showGame(event.gameId);return}
  if(action==='prediction'&&event.gameId){predictionDraftGameId=event.gameId;editingPredictionId='';predictionView='games';navigate('predictions');return}
  if(action==='availability'){navigate('availability');return}
  if(action==='team'&&event.teamAbbr)openTeam(event.teamAbbr);
}

function exportTimeline(){
  const payload={generatedAt:new Date().toISOString(),version:VERSION,events:[...timelineEvents].sort((a,b)=>new Date(a.time)-new Date(b.time))};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-timeline-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function bindLiveCommandTimeline(){
  document.querySelectorAll('[data-timeline-filter]').forEach(button=>button.onclick=()=>{timelineFilter=button.dataset.timelineFilter;renderPage()});
  document.querySelectorAll('[data-timeline-action]').forEach(button=>button.onclick=()=>runTimelineAction(button.dataset.timelineAction,button.dataset.eventId));
  if($('refreshTimeline'))$('refreshTimeline').onclick=async()=>{
    const button=$('refreshTimeline');
    button.disabled=true;button.textContent='Refreshing timeline…';
    try{await syncScores(false);captureTimelineSnapshot('score-refresh');renderPage()}
    finally{const active=$('refreshTimeline');if(active){active.disabled=false;active.textContent='Refresh timeline'}}
  };
  if($('exportTimeline'))$('exportTimeline').onclick=()=>exportTimeline();
  if($('clearTimeline'))$('clearTimeline').onclick=()=>{if(confirm('Clear the entire local timeline?')){timelineEvents=[];saveTimelineEvents();renderPage();toast('Timeline cleared')}};
}
