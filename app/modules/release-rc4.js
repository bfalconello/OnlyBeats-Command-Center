'use strict';

// OnlyBeats v1.0 RC4 — sidebar usability and corrected smoke checks.

const RC4_SMOKE_KEY='onlybeats.rc4.smoke.v1';
let rc4SmokeReport={time:null,checks:[],passed:0,failed:0};

function installRc4SidebarStyles(){
  if(document.getElementById('onlybeatsRc4Styles'))return;

  const style=document.createElement('style');
  style.id='onlybeatsRc4Styles';
  style.textContent=`
    html,body{height:100%;overflow:hidden}
    .app-shell{height:100vh;min-height:0;overflow:hidden}
    .sidebar{
      height:100vh;min-height:0;overflow:hidden;
      display:flex!important;flex-direction:column!important
    }
    .sidebar .brand{flex:0 0 auto}
    .sidebar nav{
      flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;
      overscroll-behavior:contain;scrollbar-width:thin;
      scrollbar-color:rgba(244,189,69,.55) rgba(255,255,255,.05);
      padding-bottom:12px
    }
    .sidebar nav::-webkit-scrollbar{width:8px}
    .sidebar nav::-webkit-scrollbar-track{background:rgba(255,255,255,.04);border-radius:999px}
    .sidebar nav::-webkit-scrollbar-thumb{background:rgba(244,189,69,.5);border-radius:999px}
    .sidebar nav::-webkit-scrollbar-thumb:hover{background:rgba(244,189,69,.72)}
    .sidebar-footer{flex:0 0 auto;position:relative!important;bottom:auto!important}
    main{height:100vh;min-height:0;overflow-y:auto;overflow-x:hidden}
    .nav-button{scroll-margin-block:16px}
    @media(max-height:760px){
      .brand{padding-top:12px!important;padding-bottom:12px!important}
      .nav-button{min-height:42px;padding-top:9px!important;padding-bottom:9px!important}
      .sidebar-footer{padding-top:10px!important;padding-bottom:10px!important}
    }
  `;
  document.head.appendChild(style);
}

function keepActiveSidebarItemVisible(){
  const nav=document.getElementById('nav');
  const active=nav?.querySelector('.nav-button.active');
  if(!nav||!active)return;

  const navRect=nav.getBoundingClientRect();
  const itemRect=active.getBoundingClientRect();
  if(itemRect.top<navRect.top||itemRect.bottom>navRect.bottom){
    active.scrollIntoView({block:'nearest',behavior:settings?.animations?'smooth':'auto'});
  }
}

function patchRc4Navigation(){
  if(typeof renderNav!=='function'||renderNav.__rc4Wrapped)return;
  const original=renderNav;
  const wrapped=function(){
    original();
    requestAnimationFrame(keepActiveSidebarItemVisible);
  };
  wrapped.__rc4Wrapped=true;
  renderNav=wrapped;
}

function rc4Check(name,ok,detail=''){
  return {name,ok:Boolean(ok),detail:String(detail||'')};
}

function rc4RouteRendererMap(){
  return {
    dashboard:typeof unifiedCommandDashboardPage==='function',
    launch:typeof publicReleaseHubPage==='function',
    startup:typeof startupRecoveryPage==='function',
    liveprovider:typeof liveNcaaSetupPage==='function',
    analytics:typeof predictionAnalyticsPage==='function',
    briefing:typeof smartBriefingPage==='function',
    timeline:typeof liveCommandTimelinePage==='function',
    archive:typeof seasonArchivePage==='function',
    analytics:typeof analyticsCenterPage==='function',
    datahealth:typeof liveDataHealthPage==='function',
    performance:typeof performanceCenterPage==='function',
    alerts:typeof liveAlertCenterPage==='function',
    mission:typeof commandCenterTwoPage==='function',
    about:typeof aboutStoragePage==='function',
    quality:typeof uiQualityPage==='function',
    insights:typeof smartInsightsPage==='function',
    gameday:typeof gameDayCommandPage==='function',
    livecommand:typeof liveCommandCenterPage==='function',
    devices:typeof devicesSyncPage==='function',
    cloud:typeof cloudSyncPage==='function',
    account:typeof accountDevicesPage==='function',
    platform:typeof liveDataPlatformPage==='function',
    release:typeof desktopReleasePage==='function',
    windows:typeof professionalWindowsPage==='function',
    wall:typeof wallPage==='function',
    watch:typeof watchCenterPage==='function',
    gamehub:typeof gameIntelligenceHubPage==='function',
    schedule:typeof schedulePage==='function',
    favorites:typeof favoritesPage==='function',
    teams:typeof teamHubPage==='function',
    rankings:typeof intelligenceEnginePage==='function',
    news:typeof newsPage==='function',
    weather:typeof weatherPage==='function',
    availability:typeof availabilityPage==='function',
    predictions:typeof predictionsPage==='function',
    lab:typeof predictionLabPage==='function',
    reports:typeof predictionIntelligencePage==='function',
    developer:typeof developerPage==='function',
    settings:typeof settingsPage==='function'
  };
}

function rc4RouteChecks(){
  const routeMap=rc4RouteRendererMap();
  return pages.map(([route,,label])=>{
    const rendererReady=routeMap[route]===true;
    return rc4Check(
      `Page route: ${label}`,
      rendererReady,
      rendererReady?`${route} renderer registered`:`No renderer registered for ${route}`
    );
  });
}

function runRc4SmokeChecks(){
  const routeChecks=rc4RouteChecks();
  const currentPageKnown=pages.some(([route])=>route===currentPage);
  const content=document.getElementById('content');
  const nav=document.getElementById('nav');

  const checks=[
    rc4Check('Application version is production',isOnlyBeatsProductionVersion(VERSION),`${VERSION} · ${onlyBeatsVersionChannel(VERSION)}`),
    rc4Check('Current route is registered',currentPageKnown,currentPage),
    rc4Check('Content mount exists',Boolean(content),'#content'),
    rc4Check('Sidebar navigation mount exists',Boolean(nav),'#nav'),
    rc4Check('Sidebar is independently scrollable',Boolean(nav)&&getComputedStyle(nav).overflowY==='auto','Navigation uses its own vertical scroll area'),
    rc4Check('Prediction pick helper loaded',typeof refreshPredictionPickOptions==='function','refreshPredictionPickOptions()'),
    rc4Check('Protected page renderer loaded',typeof renderPage==='function'&&typeof renderPageUnsafe==='function','renderPage() + recovery boundary'),
    rc4Check('Provider retry available',typeof updateReleaseProviderBanner==='function','RC2 provider banner'),
    rc4Check('Diagnostics available',typeof runOnlyBeatsDiagnostics==='function','Runtime diagnostics'),
    rc4Check('Backup and restore available',typeof exportOnlyBeatsBackup==='function'&&typeof chooseAndRestoreOnlyBeatsBackup==='function','RC3 local-data protection'),
    rc4Check('Local storage available',typeof storageIsAvailable==='function'&&storageIsAvailable(),'Read/write test'),
    ...routeChecks
  ];

  rc4SmokeReport={
    time:new Date().toISOString(),
    checks,
    passed:checks.filter(check=>check.ok).length,
    failed:checks.filter(check=>!check.ok).length
  };

  try{
    sessionStorage.setItem(RC4_SMOKE_KEY,JSON.stringify(rc4SmokeReport));
    sessionStorage.removeItem('onlybeats.rc3.smoke.v1');
  }catch{}

  return rc4SmokeReport;
}

// Replace RC3's broken renderCurrentPage-based check with the corrected RC4 check.
function runRc3SmokeChecks(){
  return runRc4SmokeChecks();
}

function getRc3SmokeReport(){
  return runRc4SmokeChecks();
}

function getRc4SmokeReport(){
  return rc4SmokeReport.time?rc4SmokeReport:runRc4SmokeChecks();
}

function exportRc4ReleaseReport(){
  const report=runRc4SmokeChecks();
  const payload={
    generatedAt:new Date().toISOString(),
    version:VERSION,
    smokeChecks:report,
    routeRenderers:rc4RouteRendererMap(),
    releaseReadiness:typeof runReleaseReadinessChecks==='function'?runReleaseReadinessChecks():null,
    diagnostics:typeof getOnlyBeatsDiagnostics==='function'?getOnlyBeatsDiagnostics():null,
    recovery:typeof rc2RecoverySnapshot==='function'?rc2RecoverySnapshot():null
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-v1-production-report-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function rc4SettingsCard(){
  const report=getRc4SmokeReport();
  return `<section class="card settings-card">
    <h3>Production navigation & smoke checks</h3>
    <p class="muted">${report.passed}/${report.checks.length} checks passing. The old false-positive page-render test has been replaced.</p>
    <div class="button-row">
      <button class="button primary" id="runRc4Smoke">Run final smoke checks</button>
      <button class="button" id="exportRc4Report">Export production report</button>
      <button class="button" id="scrollActiveSidebar">Show active sidebar tab</button>
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

function patchRc4SettingsCard(){
  const original=window.releaseReadinessSettingsCard;
  if(typeof original!=='function'||original.__rc4Wrapped)return;
  const wrapped=function(){
    return original()+rc4SettingsCard();
  };
  wrapped.__rc4Wrapped=true;
  window.releaseReadinessSettingsCard=wrapped;
}

function bindRc4Settings(){
  if($('runRc4Smoke'))$('runRc4Smoke').onclick=()=>{
    const report=runRc4SmokeChecks();
    toast(
      report.failed?`${report.failed} final checks need attention`:'All final checks passed',
      report.failed?'error':'success'
    );
    renderPage();
  };

  if($('exportRc4Report'))$('exportRc4Report').onclick=()=>{
    exportRc4ReleaseReport();
    toast('Production report exported');
  };

  if($('scrollActiveSidebar'))$('scrollActiveSidebar').onclick=()=>{
    keepActiveSidebarItemVisible();
    toast('Active sidebar tab is visible');
  };
}

function initializeReleaseCandidateFour(){
  installRc4SidebarStyles();
  patchRc4Navigation();
  patchRc4SettingsCard();

  try{
    sessionStorage.removeItem('onlybeats.rc3.smoke.v1');
    sessionStorage.removeItem(RC4_SMOKE_KEY);
  }catch{}

  requestAnimationFrame(()=>{
    keepActiveSidebarItemVisible();
    runRc4SmokeChecks();
  });
}
