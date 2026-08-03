'use strict';

// OnlyBeats v3.0 Public Release Candidate.
// Product-quality onboarding and release diagnostics without claiming signing,
// hosted downloads, or automatic update publishing are active.

const PUBLIC_RELEASE_NOTES=[
  'Live Command Center with full-screen Saturday Mode.',
  'Prediction Lab and unlimited multi-pick Combo Maker.',
  'Professional Windows installer and branded application icon.',
  'Account, device, cloud-adapter, and automatic-backup foundations.',
  'Prediction analytics, archives, reports, alerts, and performance diagnostics.',
  'Release Hub with onboarding, readiness checks, and support-report export.'
];

let publicReleaseState={
  onboardingComplete:false,
  favoriteSetupComplete:false,
  backupVerified:false,
  commandModeVerified:false,
  installerVerified:false,
  releaseChannel:'stable',
  checkForUpdates:true,
  lastReadinessRunAt:null,
  lastSupportExportAt:null
};

function loadPublicReleaseState(){
  try{
    publicReleaseState={
      ...publicReleaseState,
      ...JSON.parse(localStorage.getItem(PUBLIC_RELEASE_KEY)||'{}')
    };
  }catch{}
}

function savePublicReleaseState(){
  localStorage.setItem(PUBLIC_RELEASE_KEY,JSON.stringify(publicReleaseState));
}

function publicReleaseRuntime(){
  const rawDesktop=(typeof window!=='undefined'&&window.onlyBeatsDesktop)
    ?window.onlyBeatsDesktop
    :null;
  const desktopBridge=(rawDesktop&&typeof rawDesktop==='object')?rawDesktop:null;
  const userAgent=(typeof navigator!=='undefined'&&navigator.userAgent)||'';
  const platform=(typeof navigator!=='undefined'&&navigator.platform)||'Unknown';
  const online=(typeof navigator!=='undefined')?navigator.onLine:false;

  return {
    desktop:Boolean(desktopBridge||userAgent.includes('Electron')),
    bridge:desktopBridge,
    packaged:Boolean(desktopBridge?.packaged),
    version:desktopBridge?.version||VERSION,
    platform:desktopBridge?.platform||platform,
    signed:Boolean(desktopBridge?.signed),
    updaterAvailable:Boolean(desktopBridge?.updaterAvailable),
    online
  };
}

function publicReleaseChecks(){
  const runtime=publicReleaseRuntime();
  let production={passed:0,failed:1};
  try{
    production=typeof runProductionReleaseChecks==='function'
      ?runProductionReleaseChecks()
      :production;
  }catch(error){
    production={
      passed:0,
      failed:1,
      error:error?.message||'Production checks unavailable'
    };
  }

  let providerConfigured=false;
  try{
    providerConfigured=
      typeof LIVE_DATA_FEEDS!=='undefined'&&
      typeof liveDataAdapter==='function'&&
      LIVE_DATA_FEEDS.some(feed=>Boolean(liveDataAdapter(feed.id)?.configured));
  }catch{
    providerConfigured=false;
  }

  return [
    {name:'Production checks',ok:production.failed===0,detail:`${production.passed||0} passing · ${production.failed||0} failing`,required:true},
    {name:'Electron desktop runtime',ok:runtime.desktop,detail:runtime.desktop?'Detected':'Browser preview',required:true},
    {name:'Packaged installer build',ok:runtime.packaged||publicReleaseState.installerVerified,detail:runtime.packaged?'Installed build':publicReleaseState.installerVerified?'Manually verified':'Development build',required:true},
    {name:'First-run onboarding',ok:publicReleaseState.onboardingComplete,detail:publicReleaseState.onboardingComplete?'Complete':'Pending',required:true},
    {name:'Backup workflow verified',ok:publicReleaseState.backupVerified,detail:publicReleaseState.backupVerified?'Verified':'Create and restore a test backup',required:true},
    {name:'Command Mode verified',ok:publicReleaseState.commandModeVerified,detail:publicReleaseState.commandModeVerified?'Verified':'Run Saturday Mode smoke test',required:true},
    {name:'Data provider connected',ok:providerConfigured,detail:providerConfigured?'At least one feed configured':'Feeds remain local/unavailable',required:false},
    {name:'Code signing',ok:runtime.signed,detail:runtime.signed?'Configured':'Unsigned publisher',required:false},
    {name:'Automatic update publishing',ok:runtime.updaterAvailable,detail:runtime.updaterAvailable?'Configured':'Not connected',required:false},
    {name:'Hosted download page',ok:false,detail:'Not published yet',required:false}
  ];
}

function publicReleaseSummary(){
  const checks=publicReleaseChecks();
  const required=checks.filter(check=>check.required);
  return {
    checks,
    required,
    requiredPassing:required.filter(check=>check.ok).length,
    requiredFailing:required.filter(check=>!check.ok).length,
    totalPassing:checks.filter(check=>check.ok).length
  };
}

function publicReleaseCheckRow(check){
  return `<div class="release-status-row ${check.ok?'quality-pass':'quality-warn'}">
    <span>${check.ok?'✓':'△'} ${esc(check.name)}
      <small>${esc(check.detail)}${check.required?' · required':' · optional'}</small>
    </span>
    <strong>${check.ok?'READY':check.required?'REVIEW':'LATER'}</strong>
  </div>`;
}

function publicReleaseNotesPanel(){
  return `<div class="intel-list">${PUBLIC_RELEASE_NOTES.map((note,index)=>`
    <div class="intel-row">
      <span class="intel-icon">${index+1}</span>
      <div><strong>${esc(note)}</strong></div>
    </div>`).join('')}</div>`;
}

function publicReleaseHubPage(){
  try{
    setHeading('Release Hub','V3.0.1 · RUNTIME HOTFIX · READINESS');
  const runtime=publicReleaseRuntime();
  const summary=publicReleaseSummary();

  publicReleaseState.lastReadinessRunAt=new Date().toISOString();
  savePublicReleaseState();

  return `<section class="release-hero-v3">
    <div class="release-hero-copy">
      <p class="eyebrow">ONLYBEATS v3.0.1</p>
      <h1>Public Release Candidate</h1>
      <p>Prepare, verify, and package the first shareable Windows edition of OnlyBeats.</p>
      <div class="button-row">
        <button class="button primary" id="releaseRunChecks">Run readiness checks</button>
        <button class="button" id="releaseExportSupport">Export support report</button>
        <button class="button" id="releaseOpenNotes">Review release notes</button>
      </div>
    </div>
    <img src="assets/onlybeats-icon.png" alt="OnlyBeats">
  </section>

  <div class="metric-grid">
    ${metric('Version','3.0.1','Release Hub Runtime Hotfix')}
    ${metric('Required Checks',`${summary.requiredPassing}/${summary.required.length}`,summary.requiredFailing?'Review required items':'Release-ready')}
    ${metric('Runtime',runtime.desktop?'Windows Desktop':'Web Preview',runtime.packaged?'Installed build':'Development')}
    ${metric('Installer',publicReleaseState.installerVerified||runtime.packaged?'Verified':'Pending','OnlyBeats-Setup-3.0.1.exe')}
    ${metric('Signing',runtime.signed?'Configured':'Unsigned','Optional for RC testing')}
    ${metric('Update Publishing',runtime.updaterAvailable?'Connected':'Not connected','Manual installer updates')}
  </div>

  <div class="reports-grid">
    ${card('Release Readiness',`<div class="release-status-list">${summary.checks.map(publicReleaseCheckRow).join('')}</div>`,'wide')}

    ${card('Release Verification',`<div class="detail-list">
      <label class="toggle-row"><span>First-run onboarding completed</span><input type="checkbox" data-public-check="onboardingComplete" ${publicReleaseState.onboardingComplete?'checked':''}></label>
      <label class="toggle-row"><span>Favorite-team setup reviewed</span><input type="checkbox" data-public-check="favoriteSetupComplete" ${publicReleaseState.favoriteSetupComplete?'checked':''}></label>
      <label class="toggle-row"><span>Backup and restore tested</span><input type="checkbox" data-public-check="backupVerified" ${publicReleaseState.backupVerified?'checked':''}></label>
      <label class="toggle-row"><span>Saturday Command Mode tested</span><input type="checkbox" data-public-check="commandModeVerified" ${publicReleaseState.commandModeVerified?'checked':''}></label>
      <label class="toggle-row"><span>Windows installer installed successfully</span><input type="checkbox" data-public-check="installerVerified" ${publicReleaseState.installerVerified?'checked':''}></label>
      <label><span>Release channel</span>
        <select id="publicReleaseChannel">
          <option value="stable" ${publicReleaseState.releaseChannel==='stable'?'selected':''}>Stable</option>
          <option value="beta" ${publicReleaseState.releaseChannel==='beta'?'selected':''}>Beta</option>
          <option value="development" ${publicReleaseState.releaseChannel==='development'?'selected':''}>Development</option>
        </select>
      </label>
      <label class="toggle-row"><span>Check for updates on startup</span><input type="checkbox" id="publicReleaseUpdateCheck" ${publicReleaseState.checkForUpdates?'checked':''}></label>
    </div>`)}

    ${card('v3.0 Release Notes',publicReleaseNotesPanel())}

    ${card('First Launch Checklist',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">1</span><div><strong>Choose favorite teams</strong><small>Personalize dashboards, alerts, and filters.</small></div><button class="button" data-page-jump="favorites">Open</button></div>
      <div class="intel-row"><span class="intel-icon">2</span><div><strong>Create a backup</strong><small>Verify portable data recovery before sharing the installer.</small></div><button class="button" data-page-jump="windows">Open</button></div>
      <div class="intel-row"><span class="intel-icon">3</span><div><strong>Test Saturday Mode</strong><small>Enter and exit full-screen Command Mode twice.</small></div><button class="button" data-page-jump="livecommand">Open</button></div>
      <div class="intel-row"><span class="intel-icon">4</span><div><strong>Review data providers</strong><small>Unavailable feeds should remain clearly labeled.</small></div><button class="button" data-page-jump="platform">Open</button></div>
    </div>`,'wide')}

    ${card('Distribution Boundary',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Installer-ready package</strong><small>GitHub Actions and local NSIS builds are supported.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Unsigned publisher</strong><small>Windows may show a SmartScreen warning until code signing is configured.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Manual updates</strong><small>Automatic downloads remain disabled until a release provider is connected.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>No hosted download page</strong><small>The installer can be shared as a GitHub artifact or release asset after testing.</small></div></div>
    </div>`,'wide')}
  </div>`;
  }catch(error){
    console.error('Release Hub render failed',error);
    setHeading('Release Hub','SAFE MODE');
    return `<section class="card wide">
      <p class="eyebrow">RELEASE HUB SAFE MODE</p>
      <h2>The Release Hub encountered a recoverable error.</h2>
      <p>${esc(error?.message||'Unknown runtime error')}</p>
      <div class="button-row">
        <button class="button primary" onclick="location.reload()">Reload application</button>
        <button class="button" data-page-jump="dashboard">Open dashboard</button>
      </div>
    </section>`;
  }
}

function exportPublicSupportReport(){
  const runtime=publicReleaseRuntime();
  const summary=publicReleaseSummary();
  const payload={
    generatedAt:new Date().toISOString(),
    version:VERSION,
    runtime,
    publicReleaseState,
    readiness:summary.checks,
    production:typeof runProductionReleaseChecks==='function'?runProductionReleaseChecks():null,
    storage:{
      predictions:Array.isArray(typeof predictions!=='undefined'?predictions:null)?predictions.length:0,
      combos:Array.isArray(typeof predictionCombos!=='undefined'?predictionCombos:null)?predictionCombos.length:0,
      favorites:Array.isArray(typeof favorites!=='undefined'?favorites:null)?favorites.length:0,
      archives:Array.isArray(typeof seasonArchives!=='undefined'?seasonArchives:null)?seasonArchives.length:0,
      cloudQueue:Array.isArray(typeof cloudQueue!=='undefined'?cloudQueue:null)?cloudQueue.length:0
    }
  };

  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-support-v${VERSION}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  publicReleaseState.lastSupportExportAt=new Date().toISOString();
  savePublicReleaseState();
}

function showPublicReleaseWelcome(){
  if(publicReleaseState.onboardingComplete)return;
  if(document.getElementById('publicReleaseWelcome'))return;

  const overlay=document.createElement('div');
  overlay.id='publicReleaseWelcome';
  overlay.className='public-release-welcome';
  overlay.innerHTML=`<div class="public-release-welcome-card">
    <img src="assets/onlybeats-icon.png" alt="OnlyBeats">
    <p class="eyebrow">WELCOME TO ONLYBEATS</p>
    <h1>Saturday starts here.</h1>
    <p>Track predictions, build combos, follow live games, monitor alerts, and run your college-football Command Center.</p>
    <div class="public-release-feature-grid">
      <span>Live Command Center</span>
      <span>Prediction Lab</span>
      <span>Unlimited Combos</span>
      <span>Automatic Backups</span>
    </div>
    <div class="button-row">
      <button class="button primary" id="publicWelcomeStart">Start OnlyBeats</button>
      <button class="button" id="publicWelcomeLater">Review later</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  document.getElementById('publicWelcomeStart').onclick=()=>{
    publicReleaseState.onboardingComplete=true;
    savePublicReleaseState();
    overlay.remove();
    navigate('launch');
  };

  document.getElementById('publicWelcomeLater').onclick=()=>overlay.remove();
}

function bindPublicReleaseHub(){
  document.querySelectorAll('[data-public-check]').forEach(input=>{
    input.onchange=()=>{
      publicReleaseState[input.dataset.publicCheck]=input.checked;
      savePublicReleaseState();
      renderPage();
    };
  });

  if($('releaseRunChecks'))$('releaseRunChecks').onclick=()=>{
    const summary=publicReleaseSummary();
    toast(
      summary.requiredFailing
        ?`${summary.requiredFailing} required release item${summary.requiredFailing===1?'':'s'} need review`
        :'Required release checks are ready',
      summary.requiredFailing?'error':'success'
    );
    renderPage();
  };

  if($('releaseExportSupport'))$('releaseExportSupport').onclick=()=>{
    exportPublicSupportReport();
    toast('Support report exported','success');
  };

  if($('releaseOpenNotes'))$('releaseOpenNotes').onclick=()=>{
    localStorage.setItem(RELEASE_NOTES_SEEN_KEY,VERSION);
    toast('v3.0 release notes reviewed');
    document.querySelector('.reports-grid')?.scrollIntoView({behavior:'smooth'});
  };

  if($('publicReleaseChannel'))$('publicReleaseChannel').onchange=event=>{
    publicReleaseState.releaseChannel=event.target.value;
    savePublicReleaseState();
  };

  if($('publicReleaseUpdateCheck'))$('publicReleaseUpdateCheck').onchange=event=>{
    publicReleaseState.checkForUpdates=event.target.checked;
    savePublicReleaseState();
  };
}

function installPublicReleaseStyles(){
  if(document.getElementById('onlybeatsPublicReleaseStyles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsPublicReleaseStyles';
  style.textContent=`
    .release-hero-v3{display:grid;grid-template-columns:1fr 180px;gap:28px;align-items:center;padding:32px;border:1px solid rgba(244,189,69,.24);border-radius:24px;background:radial-gradient(circle at 80% 10%,rgba(244,189,69,.12),transparent 38%),#101822;margin-bottom:18px}
    .release-hero-v3 h1{font-size:clamp(2.2rem,5vw,4.4rem);line-height:.98;margin:6px 0 15px}
    .release-hero-v3 p{max-width:720px}
    .release-hero-v3 img{width:180px;height:180px;object-fit:contain;border-radius:36px;box-shadow:0 24px 70px rgba(0,0,0,.38)}
    .public-release-welcome{position:fixed;inset:0;z-index:40000;display:grid;place-items:center;padding:24px;background:rgba(3,7,12,.94)}
    .public-release-welcome-card{width:min(650px,100%);padding:38px;text-align:center;border:1px solid rgba(244,189,69,.35);border-radius:28px;background:#101822;box-shadow:0 30px 100px rgba(0,0,0,.58)}
    .public-release-welcome-card img{width:140px;height:140px;object-fit:contain;border-radius:30px}
    .public-release-welcome-card h1{font-size:clamp(2rem,5vw,3.5rem);margin:8px 0 12px}
    .public-release-feature-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:24px 0}
    .public-release-feature-grid span{padding:12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07)}
    .public-release-welcome-card .button-row{justify-content:center}
    @media(max-width:700px){.release-hero-v3{grid-template-columns:1fr}.release-hero-v3 img{width:120px;height:120px}.public-release-feature-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function initializePublicRelease(){
  loadPublicReleaseState();
  installPublicReleaseStyles();
  setTimeout(showPublicReleaseWelcome,800);
}
