'use strict';

// OnlyBeats v1.4 Polish & Performance — Phase 1.

const PERFORMANCE_LONG_TASK_LIMIT=100;
const PERFORMANCE_RENDER_BUDGET=50;
const PERFORMANCE_EVENTS_KEY='onlybeats.performance-events.v1';

let performanceEvents=[];
let performanceObserver=null;
let performanceFilter='all';

function loadPerformanceEvents(){
  try{
    const rows=JSON.parse(sessionStorage.getItem(PERFORMANCE_EVENTS_KEY)||'[]');
    performanceEvents=Array.isArray(rows)?rows:[];
  }catch{
    performanceEvents=[];
  }
}

function savePerformanceEvents(){
  try{
    sessionStorage.setItem(PERFORMANCE_EVENTS_KEY,JSON.stringify(performanceEvents.slice(-200)));
  }catch{}
}

function recordPerformanceEvent(type,duration,detail=''){
  performanceEvents.push({
    id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    time:new Date().toISOString(),
    type:String(type||'event'),
    duration:Number(duration||0),
    detail:String(detail||'')
  });
  if(performanceEvents.length>200)performanceEvents=performanceEvents.slice(-200);
  savePerformanceEvents();
}

function applyPerformancePreferences(){
  const enabled=Boolean(settings.performanceMode);
  document.body.classList.toggle('performance-mode',enabled);

  if(enabled){
    document.body.classList.add('reduce-motion');
  }else if(settings.animations){
    document.body.classList.remove('reduce-motion');
  }
}

function installPerformanceStyles(){
  if(document.getElementById('onlybeatsPerformanceStyles'))return;

  const style=document.createElement('style');
  style.id='onlybeatsPerformanceStyles';
  style.textContent=`
    .performance-mode *{
      backdrop-filter:none!important;
      box-shadow:none!important;
    }
    .performance-mode .hero img,
    .performance-mode .command-center-hero img{
      display:none!important;
    }
    .performance-mode .card,
    .performance-mode .intel-hero,
    .performance-mode .prediction-hero,
    .performance-mode .hero{
      background-image:none!important;
    }
    .performance-mode .provider-badge,
    .performance-mode .status-badge{
      animation:none!important;
    }
    @media(max-width:1180px){
      .reports-grid,.command-center-grid{grid-template-columns:1fr!important}
      .metric-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      .intel-hero,.prediction-hero,.hero{align-items:flex-start!important}
    }
    @media(max-width:760px){
      .metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .button-row{flex-wrap:wrap!important}
      .intel-row{align-items:flex-start!important}
      .intel-row>.button-row{width:100%!important}
      .topbar{gap:8px!important}
      .top-actions{flex-wrap:wrap!important}
    }
    @media(max-width:520px){
      .metric-grid{grid-template-columns:1fr!important}
      .intel-hero,.prediction-hero,.hero{padding:18px!important}
      .card{padding:16px!important}
    }
  `;
  document.head.appendChild(style);
}

function observeLongTasks(){
  if(performanceObserver||typeof PerformanceObserver!=='function')return;
  try{
    performanceObserver=new PerformanceObserver(list=>{
      for(const entry of list.getEntries()){
        if(entry.duration>=PERFORMANCE_LONG_TASK_LIMIT){
          recordPerformanceEvent('long-task',entry.duration,`Main thread blocked for ${entry.duration.toFixed(1)} ms`);
        }
      }
    });
    performanceObserver.observe({entryTypes:['longtask']});
  }catch{}
}

function performanceRenderRows(){
  const rows=typeof getPageRenderMetrics==='function'?getPageRenderMetrics():[];
  return rows.map(row=>({
    time:row.time,
    type:'render',
    duration:Number(row.duration||0),
    detail:`${row.page} page render`
  }));
}

function allPerformanceRows(){
  return [...performanceEvents,...performanceRenderRows()]
    .sort((a,b)=>new Date(b.time)-new Date(a.time));
}

function filteredPerformanceRows(){
  const rows=allPerformanceRows();
  if(performanceFilter==='all')return rows;
  if(performanceFilter==='slow')return rows.filter(row=>row.duration>PERFORMANCE_RENDER_BUDGET);
  return rows.filter(row=>row.type===performanceFilter);
}

function performanceSummary(){
  const renders=performanceRenderRows();
  const longTasks=performanceEvents.filter(row=>row.type==='long-task');
  const average=renders.length?renders.reduce((sum,row)=>sum+row.duration,0)/renders.length:0;
  const max=renders.length?Math.max(...renders.map(row=>row.duration)):0;
  const overBudget=renders.filter(row=>row.duration>PERFORMANCE_RENDER_BUDGET).length;
  const startup=typeof getRc2StartupMetric==='function'?getRc2StartupMetric():null;

  return {
    renders:renders.length,
    average,
    max,
    overBudget,
    longTasks:longTasks.length,
    startup:startup?.duration||0
  };
}

function performanceStatus(summary){
  if(summary.longTasks>3||summary.overBudget>5)return 'Needs attention';
  if(summary.longTasks||summary.overBudget)return 'Good';
  return 'Excellent';
}

function performanceEventRow(row){
  const over=row.duration>PERFORMANCE_RENDER_BUDGET;
  return `<div class="intel-row">
    <span class="intel-icon">${over?'!':'✓'}</span>
    <div>
      <strong>${esc(row.type==='long-task'?'Long task':'Page render')}</strong>
      <small>${new Date(row.time).toLocaleString()} · ${esc(row.detail)}</small>
    </div>
    <b>${row.duration.toFixed(1)} ms</b>
  </div>`;
}

function performanceCenterPage(){
  setHeading('Performance Center','STARTUP · RENDERING · RESPONSIVENESS');
  const summary=performanceSummary();
  const status=performanceStatus(summary);
  const rows=filteredPerformanceRows();

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">ONLYBEATS PERFORMANCE</p>
      <h2>Performance status: ${esc(status)}.</h2>
      <p>Track startup duration, page-render timing, long main-thread tasks, responsive layout behavior, and Performance Mode.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="togglePerformanceMode">${settings.performanceMode?'Disable':'Enable'} Performance Mode</button>
      <button class="button" id="clearPerformanceHistory">Clear session history</button>
      <button class="button" id="exportPerformanceReport">Export report</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Startup Time',summary.startup?`${summary.startup.toFixed(0)} ms`:'Pending','Current session')}
    ${metric('Average Render',`${summary.average.toFixed(1)} ms`,`${summary.renders} measured renders`)}
    ${metric('Slowest Render',`${summary.max.toFixed(1)} ms`,`${PERFORMANCE_RENDER_BUDGET} ms target`)}
    ${metric('Over Budget',summary.overBudget,'Page renders')}
    ${metric('Long Tasks',summary.longTasks,`${PERFORMANCE_LONG_TASK_LIMIT} ms threshold`)}
    ${metric('Performance Mode',settings.performanceMode?'On':'Off',settings.performanceMode?'Reduced visual effects':'Full visual experience')}
  </div>

  <div class="reports-grid">
    ${card('Performance Guidance',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">1</span><div><strong>Use Performance Mode</strong><small>Disables expensive visual effects and forces reduced motion.</small></div></div>
      <div class="intel-row"><span class="intel-icon">2</span><div><strong>Watch slow renders</strong><small>Pages above ${PERFORMANCE_RENDER_BUDGET} ms are flagged for review.</small></div></div>
      <div class="intel-row"><span class="intel-icon">3</span><div><strong>Review Data Health</strong><small>Provider delays can feel like application slowness.</small></div><button class="button" data-page-jump="datahealth">Open</button></div>
      <div class="intel-row"><span class="intel-icon">4</span><div><strong>Review diagnostics</strong><small>Runtime errors may cause repeated rerenders.</small></div><button class="button" data-page-jump="developer">Open</button></div>
    </div>`)}

    ${card('Responsive Layout',`<div class="detail-list">
      <div><span>Desktop</span><strong>Multi-column dashboard</strong></div>
      <div><span>Medium windows</span><strong>Single-column content</strong></div>
      <div><span>Small windows</span><strong>Two-column metrics</strong></div>
      <div><span>Phone-width preview</span><strong>Single-column metrics</strong></div>
      <div><span>Sidebar</span><strong>Independent scrolling</strong></div>
      <div><span>Motion</span><strong>${settings.performanceMode||!settings.animations?'Reduced':'Enabled'}</strong></div>
    </div>`)}

    ${card('Session Performance History',`<div class="wall-status-tabs">
      ${[['all','All'],['render','Renders'],['long-task','Long Tasks'],['slow','Over Budget']].map(([id,label])=>`<button class="filter-button ${performanceFilter===id?'active':''}" data-performance-filter="${id}">${label}</button>`).join('')}
    </div>${rows.length?`<div class="intel-list">${rows.slice(0,100).map(performanceEventRow).join('')}</div>`:empty('No performance events yet','Navigate between pages to collect render metrics.')}`,'wide')}
  </div>`;
}

function exportPerformanceReport(){
  const payload={
    generatedAt:new Date().toISOString(),
    version:VERSION,
    settings:{performanceMode:Boolean(settings.performanceMode),animations:Boolean(settings.animations),compact:Boolean(settings.compact)},
    summary:performanceSummary(),
    events:allPerformanceRows()
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-performance-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function bindPerformanceCenter(){
  document.querySelectorAll('[data-performance-filter]').forEach(button=>{
    button.onclick=()=>{
      performanceFilter=button.dataset.performanceFilter;
      renderPage();
    };
  });

  if($('togglePerformanceMode'))$('togglePerformanceMode').onclick=()=>{
    settings.performanceMode=!settings.performanceMode;
    saveSettings(false);
    applyTheme();
    renderPage();
    toast(`Performance Mode ${settings.performanceMode?'enabled':'disabled'}`);
  };

  if($('clearPerformanceHistory'))$('clearPerformanceHistory').onclick=()=>{
    performanceEvents=[];
    try{
      sessionStorage.removeItem(PERFORMANCE_EVENTS_KEY);
      sessionStorage.removeItem('onlybeats.rc2.render.metrics.v1');
    }catch{}
    renderPage();
    toast('Performance history cleared');
  };

  if($('exportPerformanceReport'))$('exportPerformanceReport').onclick=exportPerformanceReport;
}

function initializePerformancePolish(){
  loadPerformanceEvents();
  installPerformanceStyles();
  applyPerformancePreferences();
  observeLongTasks();
}
