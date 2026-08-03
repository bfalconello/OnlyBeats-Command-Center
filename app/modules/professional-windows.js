'use strict';

// OnlyBeats v2.6.1 Professional Windows Edition.

const WINDOWS_RELEASE_NOTES=[
  'Custom OnlyBeats application, taskbar, and installer branding.',
  'Professional first-launch welcome experience.',
  'Backup Manager with local export history.',
  'Release Notes and Windows system-information panels.',
  'Native notification-settings shortcut when supported.',
  'Installer upgrade path that preserves user data.',
  'Stable v2.6.1 desktop packaging metadata.'
];

let windowsExperienceState={
  welcomeComplete:false,
  splashEnabled:true,
  launchPage:'dashboard',
  releaseNotesSeen:'',
  startupBackupReminder:true
};
let backupHistory=[];

function loadWindowsExperience(){
  try{
    windowsExperienceState={
      ...windowsExperienceState,
      ...JSON.parse(localStorage.getItem(WINDOWS_EXPERIENCE_KEY)||'{}')
    };
  }catch{}
  try{
    const rows=JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY)||'[]');
    backupHistory=Array.isArray(rows)?rows:[];
  }catch{
    backupHistory=[];
  }
}

function saveWindowsExperience(){
  localStorage.setItem(WINDOWS_EXPERIENCE_KEY,JSON.stringify(windowsExperienceState));
  localStorage.setItem(BACKUP_HISTORY_KEY,JSON.stringify(backupHistory.slice(-100)));
}

function windowsDesktopBridge(){
  return window.onlyBeatsDesktop||null;
}

function windowsSystemInfo(){
  const bridge=windowsDesktopBridge();
  return {
    runtime:bridge?'Electron Desktop':'Browser Preview',
    version:bridge?.version||VERSION,
    platform:bridge?.platform||navigator.platform||'Unknown',
    packaged:Boolean(bridge?.packaged),
    signed:Boolean(bridge?.signed),
    updater:Boolean(bridge?.updaterAvailable),
    language:navigator.language||'Unknown',
    online:navigator.onLine
  };
}

function recordWindowsBackup(filename='OnlyBeats backup'){
  backupHistory.push({
    id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    filename,
    time:new Date().toISOString(),
    version:VERSION,
    predictions:predictions.length,
    favorites:favorites.length,
    archives:seasonArchives.length
  });
  saveWindowsExperience();
}

function exportWindowsBackup(){
  if(typeof exportOnlyBeatsBundle!=='function'){
    toast('Backup export is unavailable','error');
    return;
  }
  exportOnlyBeatsBundle();
  recordWindowsBackup(`OnlyBeats-${VERSION}.onlybeats`);
  toast('Professional backup created','success');
  if(currentPage==='windows')renderPage();
}

function windowsReleaseNotesHtml(){
  return `<div class="intel-list">${WINDOWS_RELEASE_NOTES.map((note,index)=>`
    <div class="intel-row">
      <span class="intel-icon">${index+1}</span>
      <div><strong>${esc(note)}</strong></div>
    </div>`).join('')}</div>`;
}

function windowsBackupHistoryHtml(){
  if(!backupHistory.length){
    return empty('No backup history','Create a backup before installing future releases.');
  }
  return `<div class="intel-list">${backupHistory.slice().reverse().map(item=>`
    <div class="intel-row">
      <span class="intel-icon">✓</span>
      <div>
        <strong>${esc(item.filename)}</strong>
        <small>${new Date(item.time).toLocaleString()} · v${esc(item.version)} · ${item.predictions} predictions · ${item.archives} archives</small>
      </div>
    </div>`).join('')}</div>`;
}

function professionalWindowsPage(){
  setHeading('Windows Experience','BRANDING · BACKUP · RELEASE NOTES');
  const info=windowsSystemInfo();

  return `<section class="intel-hero windows-brand-hero">
    <div>
      <p class="eyebrow">ONLYBEATS PROFESSIONAL WINDOWS EDITION</p>
      <h2>OnlyBeats v${esc(VERSION)} is installer-ready.</h2>
      <p>Manage Windows branding, first-launch preferences, backups, release notes, native settings, and desktop build readiness.</p>
    </div>
    <img src="assets/onlybeats-icon.png" alt="OnlyBeats logo">
    <div class="button-row">
      <button class="button primary" id="windowsCreateBackup">Create backup</button>
      <button class="button" id="windowsOpenReleaseNotes">Mark release notes read</button>
      <button class="button" id="windowsNotificationSettings" ${windowsDesktopBridge()?'':'disabled'}>Windows notification settings</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Edition','Professional Windows','v2.6.1')}
    ${metric('Runtime',info.runtime,info.packaged?'Installed build':'Development or preview')}
    ${metric('Signing',info.signed?'Configured':'Unsigned',info.signed?'Trusted publisher':'SmartScreen warning possible')}
    ${metric('Updater',info.updater?'Configured':'Not published','Framework ready')}
    ${metric('Backups',backupHistory.length,'Recorded exports')}
    ${metric('Welcome Setup',windowsExperienceState.welcomeComplete?'Complete':'Pending','First-launch experience')}
  </div>

  <div class="reports-grid">
    ${card('Windows Preferences',`<div class="detail-list">
      <label class="toggle-row"><span>Show branded startup experience</span><input type="checkbox" id="windowsSplashToggle" ${windowsExperienceState.splashEnabled?'checked':''}></label>
      <label class="toggle-row"><span>Remind me to back up before updates</span><input type="checkbox" id="windowsBackupReminder" ${windowsExperienceState.startupBackupReminder?'checked':''}></label>
      <label><span>Default launch page</span>
        <select id="windowsLaunchPage">
          ${[
            ['dashboard','Dashboard'],
            ['gameday','GameDay Command'],
            ['mission','Mission Control'],
            ['predictions','Prediction Center']
          ].map(([id,label])=>`<option value="${id}" ${windowsExperienceState.launchPage===id?'selected':''}>${label}</option>`).join('')}
        </select>
      </label>
      <div><span>App icon</span><strong>OnlyBeats branded</strong></div>
      <div><span>Installer graphics</span><strong>Included</strong></div>
      <div><span>User data on upgrade</span><strong>Preserved</strong></div>
    </div>`)}

    ${card('System Information',`<div class="detail-list">
      <div><span>Application version</span><strong>${esc(info.version)}</strong></div>
      <div><span>Platform</span><strong>${esc(info.platform)}</strong></div>
      <div><span>Runtime</span><strong>${esc(info.runtime)}</strong></div>
      <div><span>Packaged</span><strong>${info.packaged?'Yes':'No'}</strong></div>
      <div><span>Language</span><strong>${esc(info.language)}</strong></div>
      <div><span>Network</span><strong>${info.online?'Online':'Offline'}</strong></div>
    </div>`)}

    ${card('Release Notes',windowsReleaseNotesHtml(),'wide')}
    ${card('Backup Manager',`${windowsBackupHistoryHtml()}<div class="button-row"><button class="button primary" id="windowsCreateBackupSecondary">Create backup now</button><button class="button" data-page-jump="about">Open restore tools</button></div>`,'wide')}

    ${card('Installer Experience',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Branded executable</strong><small>OnlyBeats icon and Windows metadata are configured.</small></div></div>
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Custom installer graphics</strong><small>Header and sidebar artwork are included.</small></div></div>
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Upgrade-safe installation</strong><small>Local user data is preserved during upgrades and uninstall by default.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Code signing</strong><small>A certificate is still required to remove unknown-publisher warnings.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Automatic updates</strong><small>Publishing must be connected before updater downloads are enabled.</small></div></div>
    </div>`,'wide')}
  </div>`;
}

function showWindowsWelcome(){
  if(windowsExperienceState.welcomeComplete)return;
  const overlay=document.createElement('div');
  overlay.id='windowsWelcomeOverlay';
  overlay.className='windows-welcome-overlay';
  overlay.innerHTML=`<div class="windows-welcome-card">
    <img src="assets/onlybeats-icon.png" alt="OnlyBeats logo">
    <p class="eyebrow">WELCOME TO</p>
    <h1>OnlyBeats</h1>
    <p>Your college-football command center is ready. Review favorites, notifications, backups, and your preferred launch page.</p>
    <div class="button-row">
      <button class="button primary" id="windowsWelcomeContinue">Start setup</button>
      <button class="button" id="windowsWelcomeLater">Later</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  document.getElementById('windowsWelcomeContinue').onclick=()=>{
    windowsExperienceState.welcomeComplete=true;
    saveWindowsExperience();
    overlay.remove();
    navigate('windows');
  };
  document.getElementById('windowsWelcomeLater').onclick=()=>overlay.remove();
}

function bindProfessionalWindows(){
  document.querySelectorAll('#windowsCreateBackup,#windowsCreateBackupSecondary').forEach(button=>{
    button.onclick=exportWindowsBackup;
  });

  if($('windowsOpenReleaseNotes'))$('windowsOpenReleaseNotes').onclick=()=>{
    windowsExperienceState.releaseNotesSeen=VERSION;
    saveWindowsExperience();
    toast('Release notes marked as read');
    renderPage();
  };

  if($('windowsNotificationSettings'))$('windowsNotificationSettings').onclick=async()=>{
    try{
      const opened=await windowsDesktopBridge()?.openNotificationSettings?.();
      toast(opened?'Windows notification settings opened':'Native settings are unavailable');
    }catch{
      toast('Could not open Windows notification settings','error');
    }
  };

  if($('windowsSplashToggle'))$('windowsSplashToggle').onchange=event=>{
    windowsExperienceState.splashEnabled=event.target.checked;
    saveWindowsExperience();
  };

  if($('windowsBackupReminder'))$('windowsBackupReminder').onchange=event=>{
    windowsExperienceState.startupBackupReminder=event.target.checked;
    saveWindowsExperience();
  };

  if($('windowsLaunchPage'))$('windowsLaunchPage').onchange=event=>{
    windowsExperienceState.launchPage=event.target.value;
    settings.startPage=event.target.value;
    saveSettings(false);
    saveWindowsExperience();
    toast('Default launch page updated');
  };
}

function installProfessionalWindowsStyles(){
  if(document.getElementById('onlybeatsWindowsStyles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsWindowsStyles';
  style.textContent=`
    .windows-brand-hero img{width:112px;height:112px;object-fit:contain;border-radius:24px}
    .windows-welcome-overlay{position:fixed;inset:0;z-index:30000;background:rgba(3,7,12,.92);display:grid;place-items:center;padding:24px}
    .windows-welcome-card{width:min(520px,100%);background:#101822;border:1px solid rgba(244,189,69,.35);border-radius:24px;padding:34px;text-align:center;box-shadow:0 24px 90px rgba(0,0,0,.55)}
    .windows-welcome-card img{width:132px;height:132px;object-fit:contain;border-radius:28px;margin-bottom:14px}
    .windows-welcome-card h1{font-size:2.4rem;margin:4px 0 12px}
    .windows-welcome-card .button-row{justify-content:center;margin-top:24px}
  `;
  document.head.appendChild(style);
}

function initializeProfessionalWindows(){
  loadWindowsExperience();
  installProfessionalWindowsStyles();
  if(!windowsExperienceState.welcomeComplete){
    setTimeout(showWindowsWelcome,900);
  }
}
