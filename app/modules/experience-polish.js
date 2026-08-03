'use strict';

const UI_QUALITY_KEY='onlybeats.ui-quality.v1';
let uiQualityState={announceNavigation:true,focusMainContent:true};
let qualityFilter='all';

function loadUiQualityState(){
  try{uiQualityState={...uiQualityState,...JSON.parse(localStorage.getItem(UI_QUALITY_KEY)||'{}')}}catch{}
}
function saveUiQualityState(){try{localStorage.setItem(UI_QUALITY_KEY,JSON.stringify(uiQualityState))}catch{}}

function installExperiencePolishStyles(){
  if(document.getElementById('onlybeatsExperiencePolishStyles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsExperiencePolishStyles';
  style.textContent=`
    .skip-link{position:fixed;left:16px;top:-80px;z-index:20000;background:#f4bd45;color:#10151d;padding:12px 16px;border-radius:10px;font-weight:800;text-decoration:none;transition:top .18s ease}
    .skip-link:focus{top:16px}
    #content:focus{outline:none}
    .quality-status-card{border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:14px}
    .quality-pass{border-color:rgba(84,190,120,.45)}
    .quality-fail{border-color:rgba(220,80,80,.45)}
    .loading-skeleton{min-height:84px;border-radius:14px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.09),rgba(255,255,255,.04));background-size:220% 100%;animation:onlybeatsSkeleton 1.35s linear infinite}
    @keyframes onlybeatsSkeleton{to{background-position:-220% 0}}
    body.reduce-motion .loading-skeleton{animation:none}
  `;
  document.head.appendChild(style);
}

function ensureLiveRegion(){
  let region=document.getElementById('onlybeatsLiveRegion');
  if(region)return region;
  region=document.createElement('div');
  region.id='onlybeatsLiveRegion';
  region.setAttribute('aria-live','polite');
  region.setAttribute('aria-atomic','true');
  Object.assign(region.style,{position:'fixed',width:'1px',height:'1px',overflow:'hidden',clip:'rect(0 0 0 0)'});
  document.body.appendChild(region);
  return region;
}

function announceUi(message){
  if(!uiQualityState.announceNavigation)return;
  const region=ensureLiveRegion();
  region.textContent='';
  setTimeout(()=>region.textContent=String(message||''),20);
}

function restorePageFocus(){
  const content=document.getElementById('content');
  if(!content)return;
  content.setAttribute('tabindex','-1');
  if(uiQualityState.focusMainContent){
    requestAnimationFrame(()=>content.focus({preventScroll:true}));
  }
  const heading=document.querySelector('.topbar h1,.topbar h2,#content h1,#content h2');
  if(heading)announceUi(`${heading.textContent.trim()} page loaded`);
}

function focusSearchOrCommand(){
  const search=document.querySelector('#content input[type="search"],#content input[placeholder*="Search" i],#content input[placeholder*="Find" i]');
  if(search){search.focus();search.select?.();announceUi('Page search focused');return true}
  if(typeof openCommandPalette==='function'){openCommandPalette();announceUi('Command palette opened');return true}
  return false;
}

function polishKeyboardHandler(event){
  const tag=event.target?.tagName?.toLowerCase();
  const editing=tag==='input'||tag==='textarea'||tag==='select'||event.target?.isContentEditable;
  if(event.key==='/'&&!editing){event.preventDefault();focusSearchOrCommand()}
}

function pageQualityChecks(){
  const content=document.getElementById('content');
  const nav=document.getElementById('nav');
  const interactive=[...document.querySelectorAll('button,a,input,select,textarea')];
  const unlabeled=interactive.filter(element=>{
    if(element.tagName==='A')return !element.textContent.trim()&&!element.getAttribute('aria-label');
    if(element.tagName==='BUTTON')return !element.textContent.trim()&&!element.getAttribute('aria-label')&&!element.title;
    if(['INPUT','SELECT','TEXTAREA'].includes(element.tagName))return !element.getAttribute('aria-label')&&!element.id&&!element.closest('label');
    return false;
  });
  const seen=new Set(),duplicateIds=[];
  document.querySelectorAll('[id]').forEach(element=>{if(seen.has(element.id))duplicateIds.push(element.id);seen.add(element.id)});
  return [
    {name:'Main content mount',ok:Boolean(content),detail:'#content'},
    {name:'Sidebar navigation mount',ok:Boolean(nav),detail:'#nav'},
    {name:'Skip-to-content link',ok:Boolean(document.querySelector('.skip-link')),detail:'Keyboard bypass link'},
    {name:'Live announcement region',ok:Boolean(document.getElementById('onlybeatsLiveRegion')),detail:'ARIA live region'},
    {name:'Visible focus styles',ok:Boolean(document.getElementById('onlybeatsReleaseStyles')),detail:'Release focus treatment'},
    {name:'No duplicate element IDs',ok:duplicateIds.length===0,detail:duplicateIds.length?duplicateIds.join(', '):'No duplicates found'},
    {name:'Interactive controls labeled',ok:unlabeled.length===0,detail:unlabeled.length?`${unlabeled.length} unlabeled controls`:'All inspected controls labeled'},
    {name:'Current route registered',ok:pages.some(([route])=>route===currentPage),detail:currentPage},
    {name:'Main content scroll region',ok:Boolean(document.querySelector('main'))&&['auto','scroll'].includes(getComputedStyle(document.querySelector('main')).overflowY),detail:'Main content'},
    {name:'Sidebar scroll region',ok:Boolean(nav)&&['auto','scroll'].includes(getComputedStyle(nav).overflowY),detail:'Navigation'}
  ];
}

function uiQualitySummary(){
  const checks=pageQualityChecks();
  return {checks,passed:checks.filter(x=>x.ok).length,failed:checks.filter(x=>!x.ok).length};
}

function uiQualityPage(){
  setHeading('UI Quality Center','ACCESSIBILITY · NAVIGATION · CONSISTENCY');
  const summary=uiQualitySummary();
  const rows=qualityFilter==='all'?summary.checks:summary.checks.filter(x=>qualityFilter==='pass'?x.ok:!x.ok);
  return `<section class="intel-hero">
    <div><p class="eyebrow">EXPERIENCE POLISH</p><h2>${summary.failed?`${summary.failed} quality check${summary.failed===1?'':'s'} need attention.`:'All inspected quality checks pass.'}</h2><p>Review keyboard navigation, focus behavior, labels, scroll regions, route registration, and accessible announcements.</p></div>
    <div class="button-row"><button class="button primary" id="runUiQualityChecks">Run UI quality checks</button><button class="button" id="focusPageSearch">Focus page search</button><button class="button" id="exportUiQualityReport">Export report</button></div>
  </section>
  <div class="metric-grid">
    ${metric('Checks Passing',`${summary.passed}/${summary.checks.length}`,summary.failed?'Review failures below':'Quality baseline met')}
    ${metric('Current Page',currentPage,'Registered route')}
    ${metric('Keyboard Search','/','Search or command palette')}
    ${metric('Skip Link','Enabled','Tab from window start')}
    ${metric('Focus Recovery',uiQualityState.focusMainContent?'On':'Off','Main content focus')}
    ${metric('Announcements',uiQualityState.announceNavigation?'On':'Off','Page changes')}
  </div>
  <div class="reports-grid">
    ${card('Experience Preferences',`<div class="detail-list">
      <label class="toggle-row"><span>Focus main content after navigation</span><input type="checkbox" id="qualityFocusToggle" ${uiQualityState.focusMainContent?'checked':''}></label>
      <label class="toggle-row"><span>Announce page changes</span><input type="checkbox" id="qualityAnnounceToggle" ${uiQualityState.announceNavigation?'checked':''}></label>
      <div><span>Search shortcut</span><strong>/</strong></div><div><span>Command palette</span><strong>Ctrl + K</strong></div><div><span>Shortcut guide</span><strong>?</strong></div>
    </div>`)}
    ${card('Quality Checklist',`<div class="wall-status-tabs">${[['all','All'],['pass','Passing'],['fail','Needs Attention']].map(([id,label])=>`<button class="filter-button ${qualityFilter===id?'active':''}" data-quality-filter="${id}">${label}</button>`).join('')}</div><div class="release-status-list">${rows.map(check=>`<div class="release-status-row ${check.ok?'quality-pass':'quality-fail'}"><span>${check.ok?'✓':'×'} ${esc(check.name)}<small>${esc(check.detail)}</small></span><strong>${check.ok?'PASS':'FAIL'}</strong></div>`).join('')}</div>`,'wide')}
  </div>`;
}

function exportUiQualityReport(){
  const summary=uiQualitySummary();
  const payload={generatedAt:new Date().toISOString(),version:VERSION,currentPage,preferences:uiQualityState,...summary};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`onlybeats-ui-quality-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

function bindUiQuality(){
  document.querySelectorAll('[data-quality-filter]').forEach(button=>button.onclick=()=>{qualityFilter=button.dataset.qualityFilter;renderPage()});
  if($('runUiQualityChecks'))$('runUiQualityChecks').onclick=()=>{const summary=uiQualitySummary();toast(summary.failed?`${summary.failed} UI quality checks need attention`:'All UI quality checks passed',summary.failed?'error':'success');renderPage()};
  if($('focusPageSearch'))$('focusPageSearch').onclick=focusSearchOrCommand;
  if($('exportUiQualityReport'))$('exportUiQualityReport').onclick=exportUiQualityReport;
  if($('qualityFocusToggle'))$('qualityFocusToggle').onchange=e=>{uiQualityState.focusMainContent=e.target.checked;saveUiQualityState();toast(`Focus recovery ${uiQualityState.focusMainContent?'enabled':'disabled'}`)};
  if($('qualityAnnounceToggle'))$('qualityAnnounceToggle').onchange=e=>{uiQualityState.announceNavigation=e.target.checked;saveUiQualityState();toast(`Page announcements ${uiQualityState.announceNavigation?'enabled':'disabled'}`)};
}

function initializeExperiencePolish(){
  loadUiQualityState();
  installExperiencePolishStyles();
  ensureLiveRegion();
  document.addEventListener('keydown',polishKeyboardHandler);
  setTimeout(restorePageFocus,300);
}
