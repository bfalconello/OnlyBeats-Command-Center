'use strict';

const CLOUD_SYNCABLE_PREFIXES=[
  'onlybeats.predictions','onlybeats.futures','onlybeats.favorites','onlybeats.settings',
  'onlybeats.availability','onlybeats.season-archive','onlybeats.timeline',
  'onlybeats.live-alerts','onlybeats.command-center','onlybeats.gameday-command',
  'onlybeats.ui-quality','onlybeats.desktop-state','onlybeats.prediction-combos',
  'onlybeats.prediction-lab','onlybeats.prediction-analytics',
  'onlybeats.prediction-intelligence','onlybeats.saturday-dashboard',
  'onlybeats.favorites-watchlists','onlybeats.team-profile-state',
  'onlybeats.season-tracker','onlybeats.conference-dashboards',
  'onlybeats.ultimate-game-hub','onlybeats.game-notes','onlybeats.mobile-companion'
];

let cloudSyncState={
  provider:'none',connected:false,accountEmail:'',accountId:'',
  lastSyncAt:null,lastPullAt:null,lastPushAt:null,
  conflictPolicy:'newest-wins',autoSync:true,status:'Not connected',error:''
};
let cloudQueue=[],cloudActivity=[],cloudConflicts=[],cloudSyncInFlight=false;
let cloudObserverSuppressed=false,cloudAutoTimer=null;

function loadCloudSyncState(){
  try{cloudSyncState={...cloudSyncState,...JSON.parse(localStorage.getItem(CLOUD_SYNC_KEY)||'{}')}}catch{}
  try{const v=JSON.parse(localStorage.getItem(CLOUD_QUEUE_KEY)||'[]');cloudQueue=Array.isArray(v)?v:[]}catch{}
  try{const v=JSON.parse(localStorage.getItem(CLOUD_ACTIVITY_KEY)||'[]');cloudActivity=Array.isArray(v)?v:[]}catch{}
  try{const v=JSON.parse(localStorage.getItem(CLOUD_CONFLICT_LOG_KEY)||'[]');cloudConflicts=Array.isArray(v)?v:[]}catch{}
}
function saveCloudSyncState(){
  cloudObserverSuppressed=true;
  try{
    localStorage.setItem(CLOUD_SYNC_KEY,JSON.stringify(cloudSyncState));
    localStorage.setItem(CLOUD_QUEUE_KEY,JSON.stringify(cloudQueue.slice(-1000)));
    localStorage.setItem(CLOUD_ACTIVITY_KEY,JSON.stringify(cloudActivity.slice(-500)));
    localStorage.setItem(CLOUD_CONFLICT_LOG_KEY,JSON.stringify(cloudConflicts.slice(-300)));
  }finally{cloudObserverSuppressed=false}
}
function cloudRecordActivity(type,message,detail=''){
  cloudActivity.push({id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,time:new Date().toISOString(),type,message,detail});
  saveCloudSyncState();
}
function cloudConfigPresent(){
  const c=window.ONLYBEATS_FIREBASE_CONFIG||{};
  return Boolean(c.apiKey&&c.authDomain&&c.projectId&&c.appId);
}
function createCloudAdapter(){
  return window.ONLYBEATS_CLOUD_ADAPTER||{
    name:'No backend',configured:false,
    async connect(){throw new Error('Firebase is not configured.')},
    async push(){throw new Error('Cloud upload unavailable.')},
    async pull(){throw new Error('Cloud download unavailable.')},
    async disconnect(){return true}
  };
}
function cloudSyncableKeys(){
  const keys=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key&&CLOUD_SYNCABLE_PREFIXES.some(prefix=>key.startsWith(prefix)))keys.push(key);
  }
  return keys.sort();
}
function cloudLocalSnapshot(){
  const records={};
  const now=new Date().toISOString();
  for(const key of cloudSyncableKeys()){
    const queued=cloudQueue.find(item=>item.key===key);
    records[key]={
      value:localStorage.getItem(key),
      updatedAt:queued?.updatedAt||now,
      revision:Number(queued?.revision)||1,
      deviceId:crossDeviceState?.deviceId||'unknown-device'
    };
  }
  return{schemaVersion:2,appVersion:VERSION,generatedAt:now,deviceId:crossDeviceState?.deviceId||'unknown-device',records};
}
function cloudQueueChange(key,value,operation='set'){
  const previous=cloudQueue.find(item=>item.key===key);
  const item={
    id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    key,value,operation,updatedAt:new Date().toISOString(),
    revision:(Number(previous?.revision)||0)+1,
    deviceId:crossDeviceState?.deviceId||'unknown-device',attempts:0
  };
  cloudQueue=cloudQueue.filter(entry=>entry.key!==key);
  cloudQueue.push(item);
  saveCloudSyncState();
  scheduleCloudAutoSync();
}
function installCloudStorageObserver(){
  if(Storage.prototype.__onlybeatsCloudWrapped)return;
  const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
  Storage.prototype.setItem=function(key,value){
    const result=set.call(this,key,value);
    if(!cloudObserverSuppressed&&this===localStorage&&CLOUD_SYNCABLE_PREFIXES.some(p=>String(key).startsWith(p))){
      cloudQueueChange(String(key),String(value),'set');
    }
    return result;
  };
  Storage.prototype.removeItem=function(key){
    const result=remove.call(this,key);
    if(!cloudObserverSuppressed&&this===localStorage&&CLOUD_SYNCABLE_PREFIXES.some(p=>String(key).startsWith(p))){
      cloudQueueChange(String(key),null,'remove');
    }
    return result;
  };
  Storage.prototype.__onlybeatsCloudWrapped=true;
}
function cloudConflictDecision(local,remote){
  if(cloudSyncState.conflictPolicy==='local-wins')return'local';
  if(cloudSyncState.conflictPolicy==='remote-wins')return'remote';
  const lr=Number(local?.revision)||0,rr=Number(remote?.revision)||0;
  if(lr!==rr)return rr>lr?'remote':'local';
  return new Date(remote?.updatedAt||0)>new Date(local?.updatedAt||0)?'remote':'local';
}
function cloudApplyRemoteSnapshot(snapshot){
  if(!snapshot||typeof snapshot.records!=='object')throw new Error('Invalid cloud snapshot.');
  let applied=0,skipped=0,conflicts=0;
  cloudObserverSuppressed=true;
  try{
    for(const [key,remote] of Object.entries(snapshot.records)){
      if(!CLOUD_SYNCABLE_PREFIXES.some(p=>key.startsWith(p)))continue;
      const localValue=localStorage.getItem(key);
      const localQueue=cloudQueue.find(item=>item.key===key);
      const decision=localValue===null?'remote':cloudConflictDecision(
        {value:localValue,revision:localQueue?.revision||0,updatedAt:localQueue?.updatedAt||cloudSyncState.lastPushAt||0},
        remote
      );
      if(localValue!==null&&String(localValue)!==String(remote?.value)){
        conflicts++;
        cloudConflicts.push({time:new Date().toISOString(),key,decision});
      }
      if(decision==='remote'){
        remote?.value==null?localStorage.removeItem(key):localStorage.setItem(key,String(remote.value));
        cloudQueue=cloudQueue.filter(item=>item.key!==key);
        applied++;
      }else skipped++;
    }
  }finally{cloudObserverSuppressed=false}
  saveCloudSyncState();
  return{applied,skipped,conflicts};
}
async function cloudConnect(credentials={}){
  cloudSyncInFlight=true;cloudSyncState.error='';
  try{
    const adapter=createCloudAdapter();
    const account=await adapter.connect({credentials,config:window.ONLYBEATS_FIREBASE_CONFIG||{}});
    cloudSyncState={...cloudSyncState,provider:adapter.name||'Firebase',connected:true,
      accountEmail:account?.email||'',accountId:account?.uid||account?.id||'',status:'Connected'};
    cloudRecordActivity('connect','Cloud account connected',cloudSyncState.accountEmail);
    await cloudPullNow();
    await cloudPushNow();
    return true;
  }catch(error){
    cloudSyncState.connected=false;cloudSyncState.status='Connection failed';
    cloudSyncState.error=error?.message||String(error);
    cloudRecordActivity('error','Cloud connection failed',cloudSyncState.error);
    return false;
  }finally{cloudSyncInFlight=false;saveCloudSyncState()}
}
async function cloudPushNow(){
  if(!cloudSyncState.connected)throw new Error('Sign in before syncing.');
  cloudSyncInFlight=true;
  try{
    const snapshot=cloudLocalSnapshot();
    await createCloudAdapter().push({snapshot,accountId:cloudSyncState.accountId});
    cloudQueue=[];cloudSyncState.lastPushAt=cloudSyncState.lastSyncAt=new Date().toISOString();
    cloudSyncState.status='Synced';cloudSyncState.error='';
    cloudRecordActivity('push','Cloud upload completed',`${Object.keys(snapshot.records).length} records`);
    return true;
  }catch(error){
    cloudSyncState.error=error?.message||String(error);cloudSyncState.status='Upload failed';
    cloudQueue=cloudQueue.map(item=>({...item,attempts:(item.attempts||0)+1}));
    cloudRecordActivity('error','Cloud upload failed',cloudSyncState.error);return false;
  }finally{cloudSyncInFlight=false;saveCloudSyncState()}
}
async function cloudPullNow(){
  if(!cloudSyncState.connected)throw new Error('Sign in before syncing.');
  cloudSyncInFlight=true;
  try{
    const snapshot=await createCloudAdapter().pull({accountId:cloudSyncState.accountId});
    const result=cloudApplyRemoteSnapshot(snapshot||{records:{}});
    cloudSyncState.lastPullAt=cloudSyncState.lastSyncAt=new Date().toISOString();
    cloudSyncState.status='Synced';cloudSyncState.error='';
    cloudRecordActivity('pull','Cloud download completed',`${result.applied} applied · ${result.conflicts} conflicts`);
    return result;
  }catch(error){
    cloudSyncState.error=error?.message||String(error);cloudSyncState.status='Download failed';
    cloudRecordActivity('error','Cloud download failed',cloudSyncState.error);return false;
  }finally{cloudSyncInFlight=false;saveCloudSyncState()}
}
async function cloudDisconnect(){
  try{await createCloudAdapter().disconnect()}catch{}
  cloudSyncState.connected=false;cloudSyncState.accountEmail='';cloudSyncState.accountId='';
  cloudSyncState.status='Signed out';saveCloudSyncState();
}
function scheduleCloudAutoSync(){
  clearTimeout(cloudAutoTimer);
  if(!cloudSyncState.autoSync||!cloudSyncState.connected||!navigator.onLine)return;
  cloudAutoTimer=setTimeout(()=>cloudPushNow(),1500);
}
function cloudQueueSummary(){
  return{total:cloudQueue.length,sets:cloudQueue.filter(x=>x.operation==='set').length,
    removals:cloudQueue.filter(x=>x.operation==='remove').length};
}
function cloudActivityRow(item){
  return `<div class="intel-row"><span class="intel-icon">•</span><div><strong>${esc(item.message)}</strong><small>${new Date(item.time).toLocaleString()}${item.detail?` · ${esc(item.detail)}`:''}</small></div></div>`;
}
function cloudSyncPage(){
  setHeading('Cloud Sync Beta','ACCOUNT · OFFLINE QUEUE · CONFLICTS');
  const provider=createCloudAdapter(),queue=cloudQueueSummary(),configured=cloudConfigPresent()&&provider.configured;
  return `<section class="intel-hero"><div><p class="eyebrow">PRIVATE BETA</p><h2>${cloudSyncState.connected?'Cloud sync connected.':configured?'Firebase ready for sign-in.':'Firebase setup required.'}</h2><p>OnlyBeats stays local-first. Changes save immediately, queue while offline, and synchronize across your Windows and mobile devices.</p></div><div class="button-row"><button class="button primary" id="cloudPush" ${cloudSyncState.connected?'':'disabled'}>Sync up</button><button class="button" id="cloudPull" ${cloudSyncState.connected?'':'disabled'}>Sync down</button><button class="button" id="cloudDisconnect" ${cloudSyncState.connected?'':'disabled'}>Sign out</button></div></section>
  <div class="metric-grid">${metric('Status',cloudSyncState.connected?'Connected':configured?'Configured':'Setup required',cloudSyncState.status)}${metric('Account',cloudSyncState.accountEmail||'Not signed in',cloudSyncState.accountId||'Private beta')}${metric('Pending Queue',queue.total,`${queue.sets} updates · ${queue.removals} removals`)}${metric('Conflicts',cloudConflicts.length,cloudSyncState.conflictPolicy)}${metric('Last Sync',cloudSyncState.lastSyncAt?new Date(cloudSyncState.lastSyncAt).toLocaleString():'Never','Current account')}${metric('Online',navigator.onLine?'Yes':'No','Local-first')}</div>
  ${cloudSyncState.error?`<div class="provider-notice"><strong>${esc(cloudSyncState.error)}</strong></div>`:''}
  <div class="reports-grid">
  ${card('Account',cloudSyncState.connected?`<div class="detail-list"><div><span>Signed in</span><strong>${esc(cloudSyncState.accountEmail)}</strong></div><div><span>Provider</span><strong>${esc(provider.name)}</strong></div></div>`:configured?`<div class="detail-list"><label><span>Email</span><input id="cloudEmail" type="email"></label><label><span>Password</span><input id="cloudPassword" type="password"></label><div class="button-row"><button class="button primary" id="cloudSignIn">Sign in</button><button class="button" id="cloudCreate">Create account</button><button class="button" id="cloudReset">Reset password</button></div></div>`:empty('Firebase configuration missing','Complete app/firebase-config.js using your Firebase web-app settings.'))}
  ${card('Sync Preferences',`<div class="detail-list"><label class="toggle-row"><span>Automatic sync</span><input id="cloudAutoSync" type="checkbox" ${cloudSyncState.autoSync?'checked':''}></label><label><span>Conflict policy</span><select id="cloudConflictPolicy"><option value="newest-wins" ${cloudSyncState.conflictPolicy==='newest-wins'?'selected':''}>Newest revision wins</option><option value="local-wins" ${cloudSyncState.conflictPolicy==='local-wins'?'selected':''}>Keep this device</option><option value="remote-wins" ${cloudSyncState.conflictPolicy==='remote-wins'?'selected':''}>Keep cloud version</option></select></label></div>`)}
  ${card('Offline Queue',cloudQueue.length?`<div class="intel-list">${cloudQueue.slice().reverse().slice(0,100).map(item=>`<div class="intel-row"><span class="intel-icon">${item.operation==='remove'?'−':'+'}</span><div><strong>${esc(item.key)}</strong><small>Revision ${item.revision} · attempts ${item.attempts||0}</small></div></div>`).join('')}</div>`:empty('No queued changes','Offline or unsynchronized updates appear here.'),'wide')}
  ${card('Conflict History',cloudConflicts.length?`<div class="intel-list">${cloudConflicts.slice().reverse().map(item=>`<div class="intel-row"><span class="intel-icon">△</span><div><strong>${esc(item.key)}</strong><small>${new Date(item.time).toLocaleString()} · ${esc(item.decision)} kept</small></div></div>`).join('')}</div>`:empty('No conflicts recorded','Conflicting edits across devices will be recorded here.'),'wide')}
  ${card('Activity',cloudActivity.length?`<div class="intel-list">${cloudActivity.slice().reverse().map(cloudActivityRow).join('')}</div>`:empty('No cloud activity','Sign-in and sync events appear here.'),'wide')}
  ${card('Setup Steps',`<div class="intel-list"><div class="intel-row"><span class="intel-icon">1</span><div><strong>Create a Firebase project</strong><small>Enable Email/Password Authentication and Cloud Firestore.</small></div></div><div class="intel-row"><span class="intel-icon">2</span><div><strong>Configure firebase-config.js</strong><small>Paste only the public Firebase web-app configuration.</small></div></div><div class="intel-row"><span class="intel-icon">3</span><div><strong>Deploy the included Firestore rules</strong><small>Each user is restricted to their own cloud path.</small></div></div><div class="intel-row"><span class="intel-icon">4</span><div><strong>Keep local exports during beta testing</strong><small>Test offline edits and conflicts deliberately.</small></div></div></div>`,'wide')}
  </div>`;
}
function bindCloudSync(){
  const credentials=()=>({email:$('cloudEmail')?.value.trim()||'',password:$('cloudPassword')?.value||''});
  if($('cloudSignIn'))$('cloudSignIn').onclick=async()=>{const ok=await cloudConnect({...credentials(),mode:'sign-in'});toast(ok?'Signed in':'Sign-in failed',ok?'success':'error');renderPage()};
  if($('cloudCreate'))$('cloudCreate').onclick=async()=>{const ok=await cloudConnect({...credentials(),mode:'create'});toast(ok?'Account created':'Account creation failed',ok?'success':'error');renderPage()};
  if($('cloudReset'))$('cloudReset').onclick=async()=>{try{await createCloudAdapter().resetPassword(credentials().email);toast('Password reset email sent','success')}catch(e){toast(e?.message||'Reset failed','error')}};
  if($('cloudPush'))$('cloudPush').onclick=async()=>{const ok=await cloudPushNow();toast(ok?'Sync up complete':'Sync failed',ok?'success':'error');renderPage()};
  if($('cloudPull'))$('cloudPull').onclick=async()=>{const result=await cloudPullNow();toast(result?'Sync down complete':'Sync failed',result?'success':'error');if(result)setTimeout(()=>location.reload(),250);else renderPage()};
  if($('cloudDisconnect'))$('cloudDisconnect').onclick=async()=>{await cloudDisconnect();renderPage()};
  if($('cloudAutoSync'))$('cloudAutoSync').onchange=e=>{cloudSyncState.autoSync=e.target.checked;saveCloudSyncState();scheduleCloudAutoSync()};
  if($('cloudConflictPolicy'))$('cloudConflictPolicy').onchange=e=>{cloudSyncState.conflictPolicy=e.target.value;saveCloudSyncState()};
}
function initializeCloudSyncFoundation(){
  loadCloudSyncState();installCloudStorageObserver();
  window.addEventListener('online',()=>{cloudRecordActivity('online','Network restored');if(cloudSyncState.connected){cloudPullNow().then(()=>cloudPushNow())}});
  window.addEventListener('offline',()=>cloudRecordActivity('offline','Network lost','Changes remain queued locally'));
  const adapter=createCloudAdapter();
  adapter.onAuthStateChanged?.(account=>{
    if(account){
      cloudSyncState.connected=true;cloudSyncState.provider=adapter.name;
      cloudSyncState.accountEmail=account.email||'';cloudSyncState.accountId=account.uid||account.id||'';
      cloudSyncState.status='Connected';saveCloudSyncState();
    }
  });
}
