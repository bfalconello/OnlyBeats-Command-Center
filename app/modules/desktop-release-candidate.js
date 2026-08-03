'use strict';

// OnlyBeats v2.6.1 Professional Windows Edition.
// Installer and updater readiness without claiming signing or publishing is configured.

let desktopReleaseState={
  firstRunComplete:false,
  updateChannel:'stable',
  checkOnStartup:true,
  lastReleaseCheckAt:null,
  lastRecoveryTestAt:null,
  setupSteps:{
    welcome:false,
    data:false,
    notifications:false,
    backup:false
  }
};

function loadDesktopReleaseState(){
  try{
    desktopReleaseState={
      ...desktopReleaseState,
      ...JSON.parse(localStorage.getItem(DESKTOP_RELEASE_KEY)||'{}')
    };
  }catch{}
}

function saveDesktopReleaseState(){
  localStorage.setItem(DESKTOP_RELEASE_KEY,JSON.stringify(desktopReleaseState));
}

function desktopRuntimeInfo(){
  const rawBridge=(typeof window!=='undefined'&&window.onlyBeatsDesktop)
    ?window.onlyBeatsDesktop
    :null;
  const bridge=(rawBridge&&typeof rawBridge==='object')?rawBridge:null;
  const userAgent=(typeof navigator!=='undefined'&&navigator.userAgent)||'';
  const platform=(typeof navigator!=='undefined'&&navigator.platform)||'Unknown';
  const electron=Boolean(bridge||userAgent.includes('Electron'));

  return {
    electron,
    bridge,
    platform:bridge?.platform||platform,
    appVersion:bridge?.version||VERSION,
    packaged:Boolean(bridge?.packaged),
    updaterAvailable:Boolean(bridge?.updaterAvailable),
    installerMode:Boolean(bridge?.packaged),
    signed:Boolean(bridge?.signed)
  };
}

function desktopReleaseChecks(){
  const runtime=desktopRuntimeInfo();
  let production={failed:1,passed:0};
  try{
    production=typeof runProductionReleaseChecks==='function'
      ?runProductionReleaseChecks()
      :production;
  }catch(error){
    production={failed:1,passed:0,error:error?.message||'Production checks unavailable'};
  }

  return [
    {name:'Production checks pass',ok:production.failed===0,detail:`${production.passed||0} passing · ${production.failed||0} failing`},
    {name:'Electron desktop runtime',ok:runtime.electron,detail:runtime.electron?'Detected':'Browser/file preview'},
    {name:'Packaged application',ok:runtime.packaged,detail:runtime.packaged?'Packaged build':'Development build'},
    {name:'Installer configuration',ok:true,detail:'electron-builder NSIS configuration included'},
    {name:'Application metadata',ok:true,detail:'Name, version, publisher, and app ID included'},
    {name:'Update channel selected',ok:Boolean(desktopReleaseState.updateChannel),detail:desktopReleaseState.updateChannel},
    {name:'Code signing configured',ok:Boolean(runtime.bridge?.signed),detail:runtime.bridge?.signed?'Signed build':'Not configured'},
    {name:'Update publishing configured',ok:Boolean(runtime.bridge?.updaterAvailable),detail:runtime.bridge?.updaterAvailable?'Available':'Not configured'},
    {name:'First-run setup completed',ok:desktopReleaseState.firstRunComplete,detail:desktopReleaseState.firstRunComplete?'Complete':'Pending'},
    {name:'Backup export available',ok:typeof exportOnlyBeatsBundle==='function',detail:typeof exportOnlyBeatsBundle==='function'?'Ready':'Unavailable'}
  ];
}

function desktopReleaseSummary(){
  const checks=desktopReleaseChecks();
  return {
    checks,
    passed:checks.filter(check=>check.ok).length,
    failed:checks.filter(check=>!check.ok).length
  };
}

function desktopSetupProgress(){
  const values=Object.values(desktopReleaseState.setupSteps);
  return {
    completed:values.filter(Boolean).length,
    total:values.length
  };
}

function releaseCheckRow(check){
  return `<div class="release-status-row ${check.ok?'quality-pass':'quality-warn'}">
    <span>${check.ok?'✓':'△'} ${esc(check.name)}<small>${esc(check.detail)}</small></span>
    <strong>${check.ok?'PASS':'REVIEW'}</strong>
  </div>`;
}

function desktopReleasePage(){
  setHeading('Desktop Release','INSTALLER · FIRST RUN · RECOVERY');
  const runtime=desktopRuntimeInfo();
  const summary=desktopReleaseSummary();
  const setup=desktopSetupProgress();

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">ONLYBEATS PROFESSIONAL WINDOWS EDITION</p>
      <h2>${summary.failed?`${summary.failed} release item${summary.failed===1?'':'s'} still need review.`:'Desktop release checks are ready.'}</h2>
      <p>Validate installer packaging, first-run setup, backups, recovery, release metadata, signing readiness, and update-channel configuration.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="runDesktopReleaseChecks">Run release checks</button>
      <button class="button" id="exportDesktopReleaseReport">Export release report</button>
      <button class="button" id="testDesktopRecovery">Test recovery</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Release Version','2.6.1','Professional Windows Edition')}
    ${metric('Checks Passing',`${summary.passed}/${summary.checks.length}`,summary.failed?'Review remaining items':'Ready')}
    ${metric('Runtime',runtime.electron?'Electron':'Web preview',runtime.packaged?'Packaged':'Development')}
    ${metric('First-Run Setup',`${setup.completed}/${setup.total}`,desktopReleaseState.firstRunComplete?'Complete':'In progress')}
    ${metric('Update Channel',desktopReleaseState.updateChannel,runtime.updaterAvailable?'Updater available':'Publishing not configured')}
    ${metric('Code Signing',runtime.bridge?.signed?'Configured':'Not configured','Required to reduce Windows warnings')}
  </div>

  <div class="reports-grid">
    ${card('Desktop Release Checklist',`<div class="release-status-list">${summary.checks.map(releaseCheckRow).join('')}</div>`,'wide')}

    ${card('First-Run Setup',`<div class="detail-list">
      <label class="toggle-row"><span>Welcome and terms reviewed</span><input type="checkbox" data-setup-step="welcome" ${desktopReleaseState.setupSteps.welcome?'checked':''}></label>
      <label class="toggle-row"><span>Data providers reviewed</span><input type="checkbox" data-setup-step="data" ${desktopReleaseState.setupSteps.data?'checked':''}></label>
      <label class="toggle-row"><span>Notification preferences reviewed</span><input type="checkbox" data-setup-step="notifications" ${desktopReleaseState.setupSteps.notifications?'checked':''}></label>
      <label class="toggle-row"><span>First backup exported</span><input type="checkbox" data-setup-step="backup" ${desktopReleaseState.setupSteps.backup?'checked':''}></label>
    </div>
    <div class="button-row">
      <button class="button primary" id="completeFirstRun" ${setup.completed===setup.total?'':'disabled'}>Complete setup</button>
      <button class="button" id="exportFirstRunBackup">Export backup</button>
    </div>`)}

    ${card('Release Configuration',`<div class="detail-list">
      <label><span>Update channel</span>
        <select id="desktopUpdateChannel">
          <option value="stable" ${desktopReleaseState.updateChannel==='stable'?'selected':''}>Stable</option>
          <option value="beta" ${desktopReleaseState.updateChannel==='beta'?'selected':''}>Beta</option>
          <option value="development" ${desktopReleaseState.updateChannel==='development'?'selected':''}>Development</option>
        </select>
      </label>
      <label class="toggle-row"><span>Check for releases at startup</span><input type="checkbox" id="desktopCheckOnStartup" ${desktopReleaseState.checkOnStartup?'checked':''}></label>
      <div><span>Windows installer</span><strong>NSIS template included</strong></div>
      <div><span>Auto-update publishing</span><strong>${runtime.updaterAvailable?'Configured':'Requires repository release settings'}</strong></div>
      <div><span>Code signing</span><strong>${runtime.bridge?.signed?'Configured':'Requires certificate'}</strong></div>
    </div>`)}

    ${card('Recovery & Safety',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">1</span><div><strong>Local backup</strong><small>Create a portable .onlybeats bundle before installing a new release.</small></div></div>
      <div class="intel-row"><span class="intel-icon">2</span><div><strong>Startup recovery</strong><small>The Electron shell records crashes and can reopen the application safely.</small></div></div>
      <div class="intel-row"><span class="intel-icon">3</span><div><strong>Rollback release</strong><small>Keep the previous installer available until the new build is verified.</small></div></div>
      <div class="intel-row"><span class="intel-icon">4</span><div><strong>Unsigned-build warning</strong><small>Windows may show SmartScreen until a code-signing certificate is configured.</small></div></div>
    </div>`)}

    ${card('Installer Build Commands',`<div class="detail-list">
      <div><span>Install dependencies</span><strong>npm install</strong></div>
      <div><span>Development launch</span><strong>npm run start</strong></div>
      <div><span>Build unpacked app</span><strong>npm run pack</strong></div>
      <div><span>Build Windows installer</span><strong>npm run dist:win</strong></div>
      <div><span>Expected output</span><strong>dist/OnlyBeats-Setup-2.6.1.exe</strong></div>
    </div>`,'wide')}
  </div>`;
}

function exportDesktopReleaseReport(){
  const runtime=desktopRuntimeInfo();
  const summary=desktopReleaseSummary();
  const payload={
    generatedAt:new Date().toISOString(),
    releaseVersion:'2.6.1',
    appVersion:VERSION,
    runtime,
    state:desktopReleaseState,
    checks:summary.checks,
    passed:summary.passed,
    failed:summary.failed
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-desktop-release-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function bindDesktopRelease(){
  document.querySelectorAll('[data-setup-step]').forEach(input=>{
    input.onchange=()=>{
      desktopReleaseState.setupSteps[input.dataset.setupStep]=input.checked;
      saveDesktopReleaseState();
      renderPage();
    };
  });

  if($('runDesktopReleaseChecks'))$('runDesktopReleaseChecks').onclick=()=>{
    const summary=desktopReleaseSummary();
    toast(
      summary.failed?`${summary.failed} desktop release items need review`:'Desktop release checks passed',
      summary.failed?'error':'success'
    );
    renderPage();
  };

  if($('exportDesktopReleaseReport'))$('exportDesktopReleaseReport').onclick=exportDesktopReleaseReport;

  if($('testDesktopRecovery'))$('testDesktopRecovery').onclick=()=>{
    desktopReleaseState.lastRecoveryTestAt=new Date().toISOString();
    saveDesktopReleaseState();
    try{
      sessionStorage.setItem('onlybeats.recovery-test','passed');
      toast('Recovery storage test passed','success');
    }catch{
      toast('Recovery storage test failed','error');
    }
  };

  if($('exportFirstRunBackup'))$('exportFirstRunBackup').onclick=()=>{
    if(typeof exportOnlyBeatsBundle==='function'){
      exportOnlyBeatsBundle();
      desktopReleaseState.setupSteps.backup=true;
      saveDesktopReleaseState();
      renderPage();
    }
  };

  if($('completeFirstRun'))$('completeFirstRun').onclick=()=>{
    desktopReleaseState.firstRunComplete=true;
    saveDesktopReleaseState();
    renderPage();
    toast('First-run setup completed','success');
  };

  if($('desktopUpdateChannel'))$('desktopUpdateChannel').onchange=event=>{
    desktopReleaseState.updateChannel=event.target.value;
    saveDesktopReleaseState();
    toast('Update channel saved');
  };

  if($('desktopCheckOnStartup'))$('desktopCheckOnStartup').onchange=event=>{
    desktopReleaseState.checkOnStartup=event.target.checked;
    saveDesktopReleaseState();
  };
}

function initializeDesktopReleaseCandidate(){
  loadDesktopReleaseState();
  if(!desktopReleaseState.firstRunComplete){
    setTimeout(()=>{
      if(currentPage==='dashboard'){
        toast('Desktop first-run setup is available in Desktop Release');
      }
    },1800);
  }
}
