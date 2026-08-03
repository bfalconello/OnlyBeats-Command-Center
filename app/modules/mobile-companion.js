'use strict';
let mobileCompanionState={compactNavigation:true,defaultPage:'saturday'};
let mobileInstallPrompt=null;
function loadMobileCompanionState(){try{mobileCompanionState={...mobileCompanionState,...JSON.parse(localStorage.getItem(MOBILE_COMPANION_KEY)||'{}')}}catch{}}
function saveMobileCompanionState(){localStorage.setItem(MOBILE_COMPANION_KEY,JSON.stringify(mobileCompanionState))}
function mobileInstalled(){return Boolean(matchMedia?.('(display-mode: standalone)').matches||navigator.standalone)}
function mobileCompanionPage(){
  setHeading('Mobile Companion','INSTALL · SYNC · PRIVATE BETA');
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<section class="mobile-beta-hero"><div><p class="eyebrow">INSTALLABLE PRIVATE BETA</p><h1>${mobileInstalled()?'OnlyBeats is installed.':'Use OnlyBeats on your phone.'}</h1><p>Install the hosted web app and sign in with the same cloud account used by the Windows application.</p></div><div class="button-row"><button class="button primary" id="mobileInstall" ${mobileInstallPrompt&&!mobileInstalled()?'':'disabled'}>Install OnlyBeats</button><button class="button" data-page-jump="cloud">Cloud Sync Setup</button><button class="button" data-page-jump="saturday">Saturday Dashboard</button></div></section>
  <div class="metric-grid">${metric('Install',mobileInstalled()?'Installed':ios?'Add to Home Screen':'Browser mode','PWA')}${metric('Cloud',cloudSyncState.connected?'Connected':'Not connected',cloudSyncState.accountEmail||'')}${metric('Queue',cloudQueue.length,'Pending sync')}${metric('Online',navigator.onLine?'Yes':'No','Local-first')}${metric('Version',VERSION,'Private beta')}</div>
  <div class="reports-grid">${card('Mobile Setup',`<div class="intel-list"><div class="intel-row"><span class="intel-icon">1</span><div><strong>Deploy the app over HTTPS</strong><small>Firebase Hosting configuration is included.</small></div></div><div class="intel-row"><span class="intel-icon">2</span><div><strong>Open the site on your phone</strong><small>Sign in with the same account as Windows.</small></div></div><div class="intel-row"><span class="intel-icon">3</span><div><strong>Install to your home screen</strong><small>${ios?'Safari: Share → Add to Home Screen.':'Use the browser Install app option.'}</small></div></div><div class="intel-row"><span class="intel-icon">4</span><div><strong>Test both directions</strong><small>Create and edit records on each device while keeping local backups.</small></div></div></div>`)}
  ${card('Mobile Pages',`<div class="mobile-beta-grid">${[['saturday','Saturday Dashboard'],['gamehub','Ultimate Game Hub'],['predictions','Prediction Center'],['favoriteshub','Favorites & Watchlists'],['analytics','Prediction Analytics'],['cloud','Cloud Sync Beta']].map(([id,label])=>`<button class="mobile-beta-card" data-page-jump="${id}"><strong>${label}</strong><small>Open</small></button>`).join('')}</div>`,'wide')}
  ${card('Private Beta Tests',`<div class="intel-list"><div class="intel-row"><span class="intel-icon">✓</span><div><strong>Windows create → mobile verify</strong><small>Test predictions, favorites, notes, and watchlists.</small></div></div><div class="intel-row"><span class="intel-icon">✓</span><div><strong>Mobile edit → Windows verify</strong><small>Confirm the change syncs back.</small></div></div><div class="intel-row"><span class="intel-icon">✓</span><div><strong>Offline and conflicting edits</strong><small>Review the queue and conflict log after reconnecting.</small></div></div></div>`,'wide')}</div>`;
}
function bindMobileCompanion(){
  if($('mobileInstall'))$('mobileInstall').onclick=async()=>{await mobileInstallPrompt?.prompt();mobileInstallPrompt=null;renderPage()};
}
function installMobileStyles(){
  if(document.getElementById('onlybeatsMobileBetaStyles'))return;
  const s=document.createElement('style');s.id='onlybeatsMobileBetaStyles';s.textContent=`
  .mobile-beta-hero{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:30px;margin-bottom:18px;border:1px solid rgba(244,189,69,.26);border-radius:24px;background:#101822}
  .mobile-beta-hero h1{font-size:clamp(2.2rem,5vw,4rem);line-height:1;margin:5px 0 12px}
  .mobile-beta-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
  .mobile-beta-card{display:grid;gap:6px;padding:15px;text-align:left;color:inherit;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:rgba(255,255,255,.025)}
  .mobile-beta-card small{color:#9aabbd}
  @media(max-width:760px){.mobile-beta-hero{align-items:flex-start;flex-direction:column;padding:22px}.reports-grid,.metric-grid{grid-template-columns:1fr}.card.wide{grid-column:auto}.content{padding:14px}.button-row{width:100%;flex-wrap:wrap}.button-row .button{flex:1 1 140px}#nav{overflow-x:auto}.ultimate-scoreboard-teams{grid-template-columns:1fr!important}}
  `;document.head.appendChild(s);
}
function initializeMobileCompanion(){
  loadMobileCompanionState();installMobileStyles();
  addEventListener('beforeinstallprompt',event=>{event.preventDefault();mobileInstallPrompt=event;if(currentPage==='mobile')renderPage()});
}
