'use strict';

// OnlyBeats v1.0 Release Candidate readiness and product polish.

const RELEASE_CHANNEL='Release Candidate';
const RELEASE_SHORTCUTS=[
  ['Alt + 1','Dashboard','dashboard'],
  ['Alt + 2','Briefing','briefing'],
  ['Alt + 3','Timeline','timeline'],
  ['Alt + 4','Saturday Wall','wall'],
  ['Alt + 5','Watch Center','watch'],
  ['Alt + 6','Game Hub','gamehub'],
  ['Alt + 7','Prediction Center','predictions'],
  ['Alt + 8','Prediction Intelligence','reports'],
  ['Alt + 9','Developer Tools','developer'],
  ['Ctrl + K','Command palette',''],
  ['?','Shortcut guide','']
];

let releaseReadinessReport={time:null,checks:[]};

function installReleasePolishStyles(){
  if(document.getElementById('onlybeatsReleaseStyles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsReleaseStyles';
  style.textContent=`
    :focus-visible{outline:3px solid #f4bd45!important;outline-offset:3px!important}
    body.large-text{font-size:112%}
    body.high-contrast{filter:contrast(1.14)}
    body.high-contrast .muted,body.high-contrast small{opacity:.92}
    body.reduce-motion *,body.reduce-motion *::before,body.reduce-motion *::after{
      animation-duration:.001ms!important;
      animation-iteration-count:1!important;
      scroll-behavior:auto!important;
      transition-duration:.001ms!important
    }
    .release-shortcut-overlay{
      position:fixed;inset:0;z-index:10000;background:rgba(3,7,12,.82);
      display:flex;align-items:center;justify-content:center;padding:24px
    }
    .release-shortcut-overlay.hidden{display:none}
    .release-shortcut-dialog{
      width:min(720px,96vw);max-height:86vh;overflow:auto;background:#10161f;
      border:1px solid rgba(244,189,69,.45);border-radius:18px;padding:24px;
      box-shadow:0 24px 80px rgba(0,0,0,.55)
    }
    .release-shortcut-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:18px}
    .release-shortcut-item{display:flex;justify-content:space-between;gap:14px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:12px}
    .release-shortcut-item kbd{white-space:nowrap}
    .release-status-list{display:grid;gap:8px;margin-top:12px}
    .release-status-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 12px;border:1px solid rgba(255,255,255,.09);border-radius:10px}
  `;
  document.head.appendChild(style);
}

function applyReleasePreferences(){
  document.body.classList.toggle('high-contrast',Boolean(settings.highContrast));
  document.body.classList.toggle('large-text',Boolean(settings.largeText));
}

function ensureShortcutOverlay(){
  let overlay=document.getElementById('releaseShortcutOverlay');
  if(overlay)return overlay;
  overlay=document.createElement('div');
  overlay.id='releaseShortcutOverlay';
  overlay.className='release-shortcut-overlay hidden';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-labelledby','releaseShortcutTitle');
  overlay.innerHTML=`
    <section class="release-shortcut-dialog">
      <div class="card-head">
        <div><p class="eyebrow">ONLYBEATS v1.0 RC1</p><h2 id="releaseShortcutTitle">Keyboard shortcuts</h2></div>
        <button class="icon-button" id="closeShortcutGuide" aria-label="Close shortcut guide">×</button>
      </div>
      <div class="release-shortcut-grid">
        ${RELEASE_SHORTCUTS.map(([keys,label])=>`<div class="release-shortcut-item"><span>${label}</span><kbd>${keys}</kbd></div>`).join('')}
      </div>
    </section>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',event=>{
    if(event.target===overlay)hideKeyboardShortcuts();
  });
  overlay.querySelector('#closeShortcutGuide').onclick=hideKeyboardShortcuts;
  return overlay;
}

function showKeyboardShortcuts(){
  const overlay=ensureShortcutOverlay();
  overlay.classList.remove('hidden');
  overlay.querySelector('#closeShortcutGuide')?.focus();
}

function hideKeyboardShortcuts(){
  document.getElementById('releaseShortcutOverlay')?.classList.add('hidden');
}

function releaseInputActive(target){
  const tag=target?.tagName?.toLowerCase();
  return tag==='input'||tag==='textarea'||tag==='select'||target?.isContentEditable;
}

function handleReleaseKeyboardShortcut(event){
  if(event.key==='Escape'){
    hideKeyboardShortcuts();
    return;
  }

  if(event.key==='?'&&!releaseInputActive(event.target)){
    event.preventDefault();
    showKeyboardShortcuts();
    return;
  }

  if(!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
  const routes={
    '1':'dashboard',
    '2':'briefing',
    '3':'timeline',
    '4':'wall',
    '5':'watch',
    '6':'gamehub',
    '7':'predictions',
    '8':'reports',
    '9':'developer'
  };
  const route=routes[event.key];
  if(route){
    event.preventDefault();
    navigate(route);
  }
}

function releaseCheck(name,ok,detail=''){
  return {name,ok:Boolean(ok),detail:String(detail||'')};
}

function runReleaseReadinessChecks(){
  const diagnostics=typeof runOnlyBeatsDiagnostics==='function'
    ? runOnlyBeatsDiagnostics()
    : {checks:[]};

  const checks=[
    releaseCheck('Version is release candidate',String(VERSION).startsWith('1.0.0-rc'),VERSION),
    releaseCheck('Dashboard module loaded',typeof unifiedCommandDashboardPage==='function','unifiedCommandDashboardPage()'),
    releaseCheck('Prediction helper loaded',typeof refreshPredictionPickOptions==='function','refreshPredictionPickOptions()'),
    releaseCheck('Schedule module loaded',typeof schedulePage==='function','schedulePage()'),
    releaseCheck('Team Intelligence loaded',typeof teamHubPage==='function','teamHubPage()'),
    releaseCheck('Game Hub loaded',typeof gameIntelligenceHubPage==='function','gameIntelligenceHubPage()'),
    releaseCheck('Timeline loaded',typeof liveCommandTimelinePage==='function','liveCommandTimelinePage()'),
    releaseCheck('Diagnostics loaded',typeof runOnlyBeatsDiagnostics==='function','runOnlyBeatsDiagnostics()'),
    releaseCheck('Keyboard navigation active',typeof handleReleaseKeyboardShortcut==='function','Alt + 1 through Alt + 9'),
    releaseCheck('Local storage available',diagnostics.storageAvailable!==false,'Settings and user data'),
    ...((diagnostics.checks||[]).filter(check=>!check.ok).map(check=>
      releaseCheck(`Diagnostic: ${check.name}`,false,check.detail)
    ))
  ];

  releaseReadinessReport={
    time:new Date().toISOString(),
    checks,
    passed:checks.filter(check=>check.ok).length,
    failed:checks.filter(check=>!check.ok).length
  };
  return releaseReadinessReport;
}

function getReleaseReadinessReport(){
  return releaseReadinessReport.time?releaseReadinessReport:runReleaseReadinessChecks();
}

function releaseReadinessSettingsCard(){
  const report=getReleaseReadinessReport();
  return `<section class="card settings-card">
    <h3>v1.0 Release readiness</h3>
    <p class="muted">${RELEASE_CHANNEL} · ${report.passed}/${report.checks.length} checks currently passing.</p>
    <div class="button-row">
      <button class="button primary" id="runReleaseChecks">Run final checks</button>
      <button class="button" id="exportReleaseReport">Export release report</button>
      <button class="button" id="openReleaseShortcuts">Shortcut guide</button>
    </div>
    <div class="release-status-list">
      ${report.checks.slice(0,6).map(check=>`<div class="release-status-row"><span>${check.ok?'✓':'×'} ${esc(check.name)}</span><strong>${check.ok?'PASS':'FAIL'}</strong></div>`).join('')}
    </div>
  </section>`;
}

function exportReleaseReadinessReport(){
  const report=runReleaseReadinessChecks();
  const payload={
    generatedAt:new Date().toISOString(),
    version:VERSION,
    channel:RELEASE_CHANNEL,
    releaseReadiness:report,
    diagnostics:typeof getOnlyBeatsDiagnostics==='function'?getOnlyBeatsDiagnostics():null,
    environment:{
      userAgent:navigator.userAgent,
      online:navigator.onLine,
      language:navigator.language
    }
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-v1-rc1-release-report-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function bindReleaseReadinessSettings(){
  if($('openShortcutGuide'))$('openShortcutGuide').onclick=showKeyboardShortcuts;
  if($('openReleaseShortcuts'))$('openReleaseShortcuts').onclick=showKeyboardShortcuts;
  if($('runReleaseChecks'))$('runReleaseChecks').onclick=()=>{
    const report=runReleaseReadinessChecks();
    toast(report.failed?`${report.failed} release checks need attention`:'All release checks passed',report.failed?'error':'success');
    renderPage();
  };
  if($('exportReleaseReport'))$('exportReleaseReport').onclick=()=>{
    exportReleaseReadinessReport();
    toast('Release report exported');
  };
}

function updateReleaseStartupStatus(message){
  const element=document.getElementById('splashStatus');
  if(element)element.textContent=message;
}

function initializeReleaseCandidate(){
  installReleasePolishStyles();
  applyReleasePreferences();
  ensureShortcutOverlay();
  document.addEventListener('keydown',handleReleaseKeyboardShortcut);
  updateReleaseStartupStatus('Preparing v1.0 Release Candidate…');
  setTimeout(()=>runReleaseReadinessChecks(),350);
}
