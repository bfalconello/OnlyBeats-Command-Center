'use strict';

// OnlyBeats v1.0 RC3 — final regression safety, backup/restore, and release checklist.

const RC3_BACKUP_VERSION=1;
const RC3_SMOKE_KEY='onlybeats.rc3.smoke.v1';

let rc3SmokeReport={time:null,checks:[],passed:0,failed:0};

function rc3SafeJsonParse(value,fallback){
  try{return JSON.parse(value)}catch{return fallback}
}

function rc3CollectLocalData(){
  const storage={};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(!key)continue;
    storage[key]=localStorage.getItem(key);
  }
  return storage;
}

function rc3CreateBackupPayload(){
  return {
    format:'OnlyBeats Local Backup',
    backupVersion:RC3_BACKUP_VERSION,
    generatedAt:new Date().toISOString(),
    appVersion:VERSION,
    storage:rc3CollectLocalData()
  };
}

function rc3DownloadJson(filename,payload){
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

function exportOnlyBeatsBackup(){
  rc3DownloadJson(
    `onlybeats-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,
    rc3CreateBackupPayload()
  );
}

function validateOnlyBeatsBackup(payload){
  if(!payload||payload.format!=='OnlyBeats Local Backup'){
    throw new Error('This is not an OnlyBeats backup file.');
  }
  if(payload.backupVersion!==RC3_BACKUP_VERSION){
    throw new Error(`Unsupported backup version: ${payload.backupVersion}`);
  }
  if(!payload.storage||typeof payload.storage!=='object'||Array.isArray(payload.storage)){
    throw new Error('Backup storage data is missing or invalid.');
  }
  return true;
}

function restoreOnlyBeatsBackup(payload){
  validateOnlyBeatsBackup(payload);
  const entries=Object.entries(payload.storage);
  if(!entries.length)throw new Error('The backup contains no local data.');

  for(const [key,value] of entries){
    if(typeof key!=='string')continue;
    if(value===null||value===undefined)continue;
    localStorage.setItem(key,String(value));
  }
  sessionStorage.clear();
  return entries.length;
}

function chooseAndRestoreOnlyBeatsBackup(){
  const input=document.createElement('input');
  input.type='file';
  input.accept='application/json,.json';
  input.onchange=async()=>{
    const file=input.files?.[0];
    if(!file)return;
    try{
      const text=await file.text();
      const payload=JSON.parse(text);
      const count=restoreOnlyBeatsBackup(payload);
      alert(`Restored ${count} local data entries. OnlyBeats will reload now.`);
      location.reload();
    }catch(error){
      alert(`Backup restore failed: ${error?.message||error}`);
      if(typeof writeOnlyBeatsRuntimeLog==='function'){
        writeOnlyBeatsRuntimeLog('error',error?.message||String(error),'backup-restore',error?.stack||'');
      }
    }
  };
  input.click();
}

function rc3Check(name,ok,detail=''){
  return {name,ok:Boolean(ok),detail:String(detail||'')};
}

function rc3PageRenderCheck(route){
  const original=currentPage;
  try{
    currentPage=route;
    const html=renderCurrentPage();
    return rc3Check(`Page: ${route}`,typeof html==='string'&&html.length>0,html?.length?`${html.length} characters rendered`:'No HTML returned');
  }catch(error){
    return rc3Check(`Page: ${route}`,false,error?.message||'Render failed');
  }finally{
    currentPage=original;
  }
}

function runRc3SmokeChecks(){
  const routes=[
    'dashboard','briefing','timeline','wall','watch','gamehub','schedule',
    'favorites','teams','rankings','news','weather','availability',
    'predictions','reports','developer','settings'
  ];

  const checks=[
    rc3Check('Application version is production',VERSION==='1.0.0',VERSION),
    rc3Check('Prediction pick helper loaded',typeof refreshPredictionPickOptions==='function','refreshPredictionPickOptions()'),
    rc3Check('Dashboard module loaded',typeof unifiedCommandDashboardPage==='function','unifiedCommandDashboardPage()'),
    rc3Check('Backup export available',typeof exportOnlyBeatsBackup==='function','JSON local-data backup'),
    rc3Check('Backup restore available',typeof chooseAndRestoreOnlyBeatsBackup==='function','Validated JSON restore'),
    rc3Check('Provider retry available',typeof updateReleaseProviderBanner==='function','RC2 provider banner'),
    rc3Check('Diagnostics available',typeof runOnlyBeatsDiagnostics==='function','Runtime diagnostics'),
    rc3Check('Local storage available',storageIsAvailable(),'Read/write test'),
    ...routes.map(rc3PageRenderCheck)
  ];

  rc3SmokeReport={
    time:new Date().toISOString(),
    checks,
    passed:checks.filter(check=>check.ok).length,
    failed:checks.filter(check=>!check.ok).length
  };

  try{
    sessionStorage.setItem(RC3_SMOKE_KEY,JSON.stringify(rc3SmokeReport));
  }catch{}

  if(typeof writeOnlyBeatsRuntimeLog==='function'){
    writeOnlyBeatsRuntimeLog(
      rc3SmokeReport.failed?'warn':'info',
      rc3SmokeReport.failed?`${rc3SmokeReport.failed} RC3 smoke checks failed`:'All regression checks passed',
      'rc3-smoke'
    );
  }

  return rc3SmokeReport;
}

function getRc3SmokeReport(){
  if(rc3SmokeReport.time)return rc3SmokeReport;
  const cached=rc3SafeJsonParse(sessionStorage.getItem(RC3_SMOKE_KEY)||'null',null);
  if(cached?.time)return cached;
  return runRc3SmokeChecks();
}

function exportRc3ReleaseReport(){
  const report=runRc3SmokeChecks();
  rc3DownloadJson(
    `onlybeats-v1-regression-report-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,
    {
      generatedAt:new Date().toISOString(),
      version:VERSION,
      smokeChecks:report,
      releaseReadiness:typeof runReleaseReadinessChecks==='function'?runReleaseReadinessChecks():null,
      rc2Recovery:typeof rc2RecoverySnapshot==='function'?rc2RecoverySnapshot():null,
      diagnostics:typeof getOnlyBeatsDiagnostics==='function'?getOnlyBeatsDiagnostics():null
    }
  );
}

function rc3SettingsCard(){
  const report=getRc3SmokeReport();
  const backup=rc3CreateBackupPayload();
  const savedKeys=Object.keys(backup.storage).length;
  return `<section class="card settings-card">
    <h3>Backup & regression checks</h3>
    <p class="muted">${report.passed}/${report.checks.length} smoke checks passing · ${savedKeys} local data entries available to back up.</p>
    <div class="button-row">
      <button class="button primary" id="runRc3Smoke">Run regression checks</button>
      <button class="button" id="exportRc3Report">Export final release report</button>
      <button class="button" id="exportOnlyBeatsBackup">Back up local data</button>
      <button class="button" id="restoreOnlyBeatsBackup">Restore local data</button>
    </div>
    <div class="release-status-list">
      ${report.checks.slice(0,8).map(check=>`
        <div class="release-status-row">
          <span>${check.ok?'✓':'×'} ${esc(check.name)}</span>
          <strong>${check.ok?'PASS':'FAIL'}</strong>
        </div>`).join('')}
    </div>
  </section>`;
}

function patchRc3SettingsCard(){
  const original=window.releaseReadinessSettingsCard;
  if(typeof original!=='function'||original.__rc3Wrapped)return;
  const wrapped=function(){
    return original()+rc3SettingsCard();
  };
  wrapped.__rc3Wrapped=true;
  window.releaseReadinessSettingsCard=wrapped;
}

function bindRc3Settings(){
  if($('runRc3Smoke'))$('runRc3Smoke').onclick=()=>{
    const report=runRc3SmokeChecks();
    toast(
      report.failed?`${report.failed} regression checks need attention`:'All regression checks passed',
      report.failed?'error':'success'
    );
    renderPage();
  };
  if($('exportRc3Report'))$('exportRc3Report').onclick=()=>{
    exportRc3ReleaseReport();
    toast('Final release report exported');
  };
  if($('exportOnlyBeatsBackup'))$('exportOnlyBeatsBackup').onclick=()=>{
    exportOnlyBeatsBackup();
    toast('Local data backup exported');
  };
  if($('restoreOnlyBeatsBackup'))$('restoreOnlyBeatsBackup').onclick=()=>{
    if(confirm('Restore local data from an OnlyBeats backup file? Existing matching keys will be replaced.')){
      chooseAndRestoreOnlyBeatsBackup();
    }
  };
}

function initializeReleaseCandidateThree(){
  patchRc3SettingsCard();
  setTimeout(()=>runRc3SmokeChecks(),1600);
}
