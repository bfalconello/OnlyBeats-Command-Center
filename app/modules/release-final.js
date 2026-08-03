'use strict';

// OnlyBeats v1.0 Final production release marker and final validation layer.

const PRODUCTION_RELEASE_NAME='OnlyBeats Command Center';
const PRODUCTION_RELEASE_VERSION=VERSION;

let productionReleaseReport={time:null,checks:[],passed:0,failed:0};

function productionCheck(name,ok,detail=''){
  return {name,ok:Boolean(ok),detail:String(detail||'')};
}

function runProductionReleaseChecks(){
  const smoke=typeof runRc4SmokeChecks==='function'
    ? runRc4SmokeChecks()
    : {checks:[]};

  const checks=[
    productionCheck('Production version',isOnlyBeatsProductionVersion(VERSION),`${VERSION} · ${onlyBeatsVersionChannel(VERSION)}`),
    productionCheck('Unified Dashboard',typeof unifiedCommandDashboardPage==='function','Dashboard renderer'),
    productionCheck('Prediction Center',typeof predictionsPage==='function','Prediction workflow'),
    productionCheck('Prediction pick controls',typeof refreshPredictionPickOptions==='function','Winner, Spread, and Total choices'),
    productionCheck('Schedule Center',typeof schedulePage==='function','Schedule renderer'),
    productionCheck('Team Intelligence',typeof teamHubPage==='function','Team renderer'),
    productionCheck('Game Intelligence Hub',typeof gameIntelligenceHubPage==='function','Game Hub renderer'),
    productionCheck('Live Command Timeline',typeof liveCommandTimelinePage==='function','Timeline renderer'),
    productionCheck('Season Archive',typeof seasonArchivePage==='function','Archive renderer'),
    productionCheck('Analytics Center',typeof analyticsCenterPage==='function','Analytics renderer'),
    productionCheck('Smart Briefing',typeof smartBriefingPage==='function','Briefing renderer'),
    productionCheck('Watch Center',typeof watchCenterPage==='function','Watch renderer'),
    productionCheck('Runtime diagnostics',typeof runOnlyBeatsDiagnostics==='function','Diagnostics runtime'),
    productionCheck('Backup and restore',typeof exportOnlyBeatsBackup==='function'&&typeof chooseAndRestoreOnlyBeatsBackup==='function','Local-data protection'),
    productionCheck('Provider recovery',typeof updateReleaseProviderBanner==='function','Online, cached, and offline states'),
    productionCheck('Scrollable sidebar',typeof keepActiveSidebarItemVisible==='function','Independent navigation scroll'),
    ...((smoke.checks||[]).filter(check=>!check.ok).map(check=>
      productionCheck(`Smoke: ${check.name}`,false,check.detail)
    ))
  ];

  productionReleaseReport={
    time:new Date().toISOString(),
    checks,
    passed:checks.filter(check=>check.ok).length,
    failed:checks.filter(check=>!check.ok).length
  };

  return productionReleaseReport;
}

function installProductionBadge(){
  if(document.getElementById('productionReleaseBadge'))return;
  const badge=document.createElement('span');
  badge.id='productionReleaseBadge';
  badge.className='provider-badge';
  badge.textContent='v1.0 PRODUCTION';
  badge.title='OnlyBeats Command Center v1.0.0';
  const topActions=document.querySelector('.top-actions');
  if(topActions)topActions.prepend(badge);
}

function updateProductionDocumentMetadata(){
  document.title='OnlyBeats Command Center';
  document.documentElement.dataset.release='production';
  document.body.dataset.version=VERSION;
}

function exportProductionReleaseReport(){
  const report=runProductionReleaseChecks();
  const payload={
    product:PRODUCTION_RELEASE_NAME,
    version:VERSION,
    channel:'Production',
    generatedAt:new Date().toISOString(),
    productionChecks:report,
    smokeChecks:typeof runRc4SmokeChecks==='function'?runRc4SmokeChecks():null,
    diagnostics:typeof getOnlyBeatsDiagnostics==='function'?getOnlyBeatsDiagnostics():null,
    recovery:typeof rc2RecoverySnapshot==='function'?rc2RecoverySnapshot():null
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-v1.0.0-production-report-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function productionSettingsCard(){
  const report=runProductionReleaseChecks();
  return `<section class="card settings-card">
    <h3>OnlyBeats v1.0 Production</h3>
    <p class="muted">${report.passed}/${report.checks.length} final production checks passing.</p>
    <div class="button-row">
      <button class="button primary" id="runProductionChecks">Run production checks</button>
      <button class="button" id="exportProductionReport">Export production report</button>
    </div>
    <div class="release-status-list">
      ${report.checks.slice(0,10).map(check=>`
        <div class="release-status-row">
          <span>${check.ok?'✓':'×'} ${esc(check.name)}</span>
          <strong>${check.ok?'PASS':'FAIL'}</strong>
        </div>`).join('')}
    </div>
  </section>`;
}

function patchProductionSettings(){
  const original=window.releaseReadinessSettingsCard;
  if(typeof original!=='function'||original.__productionWrapped)return;
  const wrapped=function(){
    return productionSettingsCard()+original();
  };
  wrapped.__productionWrapped=true;
  window.releaseReadinessSettingsCard=wrapped;

  const originalBind=window.bindReleaseReadinessSettings;
  if(typeof originalBind==='function'&&!originalBind.__productionWrapped){
    const wrappedBind=function(){
      originalBind();
      if($('runProductionChecks'))$('runProductionChecks').onclick=()=>{
        const report=runProductionReleaseChecks();
        toast(
          report.failed?`${report.failed} production checks need attention`:'All production checks passed',
          report.failed?'error':'success'
        );
        renderPage();
      };
      if($('exportProductionReport'))$('exportProductionReport').onclick=()=>{
        exportProductionReleaseReport();
        toast('Production report exported');
      };
    };
    wrappedBind.__productionWrapped=true;
    window.bindReleaseReadinessSettings=wrappedBind;
  }
}

function initializeProductionRelease(){
  updateProductionDocumentMetadata();
  installProductionBadge();
  patchProductionSettings();
  setTimeout(()=>runProductionReleaseChecks(),1800);
}
