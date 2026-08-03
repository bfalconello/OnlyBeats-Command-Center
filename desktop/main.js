'use strict';

const {app,BrowserWindow,ipcMain,shell,dialog}=require('electron');
const path=require('path');
const fs=require('fs');
const {autoUpdater}=require('electron-updater');

let mainWindow=null;
let updateCheckTimer=null;
let updateState={
  supported:false,
  packaged:false,
  status:'development',
  currentVersion:'',
  availableVersion:'',
  downloadedVersion:'',
  percent:0,
  bytesPerSecond:0,
  transferred:0,
  total:0,
  releaseName:'',
  releaseNotes:'',
  error:'',
  checkedAt:null,
  downloadedAt:null
};

const stateFile=()=>path.join(app.getPath('userData'),'window-state.json');
const crashFile=()=>path.join(app.getPath('userData'),'last-crash.json');
const firebaseConfigFile=()=>path.join(app.getPath('userData'),'firebase-config.json');
const updaterLogFile=()=>path.join(app.getPath('userData'),'updater-log.jsonl');

function readJson(file,fallback){
  try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}
}

function writeJson(file,value){
  try{
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,JSON.stringify(value,null,2));
    return true;
  }catch{
    return false;
  }
}

function appendUpdaterLog(type,detail={}){
  try{
    fs.mkdirSync(path.dirname(updaterLogFile()),{recursive:true});
    fs.appendFileSync(
      updaterLogFile(),
      JSON.stringify({time:new Date().toISOString(),type,...detail})+'\n'
    );
  }catch{}
}

function safeReleaseNotes(notes){
  if(Array.isArray(notes)){
    return notes.map(item=>typeof item==='string'?item:item?.note||'').filter(Boolean).join('\n');
  }
  return typeof notes==='string'?notes:'';
}

function sendUpdateState(){
  if(mainWindow&&!mainWindow.isDestroyed()){
    mainWindow.webContents.send('desktop:update-state',{...updateState});
  }
}

function setUpdateState(patch){
  updateState={...updateState,...patch};
  appendUpdaterLog('state',patch);
  sendUpdateState();
}

function configureUpdater(){
  updateState.currentVersion=app.getVersion();
  updateState.packaged=app.isPackaged;
  updateState.supported=app.isPackaged&&process.platform==='win32';
  updateState.status=updateState.supported?'idle':'development';

  if(!updateState.supported){
    appendUpdaterLog('disabled',{
      packaged:app.isPackaged,
      platform:process.platform,
      version:app.getVersion()
    });
    return;
  }

  autoUpdater.autoDownload=false;
  autoUpdater.autoInstallOnAppQuit=true;
  autoUpdater.allowPrerelease=false;

  autoUpdater.on('checking-for-update',()=>{
    setUpdateState({
      status:'checking',
      error:'',
      checkedAt:new Date().toISOString(),
      percent:0
    });
  });

  autoUpdater.on('update-available',info=>{
    setUpdateState({
      status:'available',
      availableVersion:String(info?.version||''),
      releaseName:String(info?.releaseName||''),
      releaseNotes:safeReleaseNotes(info?.releaseNotes),
      error:'',
      checkedAt:new Date().toISOString()
    });
  });

  autoUpdater.on('update-not-available',info=>{
    setUpdateState({
      status:'current',
      availableVersion:String(info?.version||app.getVersion()),
      releaseName:String(info?.releaseName||''),
      releaseNotes:safeReleaseNotes(info?.releaseNotes),
      error:'',
      checkedAt:new Date().toISOString(),
      percent:0
    });
  });

  autoUpdater.on('download-progress',progress=>{
    setUpdateState({
      status:'downloading',
      percent:Number(progress?.percent)||0,
      bytesPerSecond:Number(progress?.bytesPerSecond)||0,
      transferred:Number(progress?.transferred)||0,
      total:Number(progress?.total)||0,
      error:''
    });
  });

  autoUpdater.on('update-downloaded',info=>{
    setUpdateState({
      status:'downloaded',
      downloadedVersion:String(info?.version||updateState.availableVersion||''),
      releaseName:String(info?.releaseName||updateState.releaseName||''),
      releaseNotes:safeReleaseNotes(info?.releaseNotes)||updateState.releaseNotes,
      downloadedAt:new Date().toISOString(),
      percent:100,
      error:''
    });
  });

  autoUpdater.on('error',error=>{
    setUpdateState({
      status:'error',
      error:String(error?.message||error||'Unknown update error')
    });
  });
}

async function checkForUpdates(){
  if(!updateState.supported){
    setUpdateState({
      status:'development',
      error:'Automatic updates can only be tested from the installed Windows application.'
    });
    return {...updateState};
  }

  try{
    await autoUpdater.checkForUpdates();
  }catch(error){
    setUpdateState({
      status:'error',
      error:String(error?.message||error)
    });
  }
  return {...updateState};
}

async function downloadUpdate(){
  if(!updateState.supported)throw new Error('Automatic updates are unavailable in development mode.');
  if(!['available','error'].includes(updateState.status)){
    throw new Error('No downloadable update is currently available.');
  }

  setUpdateState({status:'downloading',error:'',percent:0});
  await autoUpdater.downloadUpdate();
  return {...updateState};
}

function installDownloadedUpdate(){
  if(!updateState.supported)throw new Error('Automatic updates are unavailable in development mode.');
  if(updateState.status!=='downloaded')throw new Error('No downloaded update is ready to install.');

  appendUpdaterLog('quit-and-install',{version:updateState.downloadedVersion});
  setImmediate(()=>autoUpdater.quitAndInstall(false,true));
  return true;
}

function scheduleAutomaticUpdateChecks(){
  clearInterval(updateCheckTimer);
  if(!updateState.supported)return;

  setTimeout(()=>checkForUpdates(),12000);
  updateCheckTimer=setInterval(()=>checkForUpdates(),6*60*60*1000);
}

function createWindow(){
  const state=readJson(stateFile(),{width:1440,height:900,maximized:false});
  mainWindow=new BrowserWindow({
    width:Math.max(1024,state.width||1440),
    height:Math.max(700,state.height||900),
    minWidth:900,
    minHeight:620,
    show:false,
    backgroundColor:'#080d14',
    icon:path.join(__dirname,'..','build','icon.ico'),
    autoHideMenuBar:true,
    webPreferences:{
      preload:path.join(__dirname,'preload.js'),
      contextIsolation:true,
      nodeIntegration:false,
      sandbox:true
    }
  });

  mainWindow.loadFile(path.join(__dirname,'..','app','index.html'));

  mainWindow.once('ready-to-show',()=>{
    mainWindow.show();
    if(state.maximized)mainWindow.maximize();
    sendUpdateState();
  });

  mainWindow.webContents.setWindowOpenHandler(({url})=>{
    if(/^https?:/i.test(url))shell.openExternal(url);
    return {action:'deny'};
  });

  mainWindow.on('close',()=>{
    const bounds=mainWindow.getBounds();
    writeJson(stateFile(),{
      width:bounds.width,
      height:bounds.height,
      maximized:mainWindow.isMaximized()
    });
  });

  mainWindow.webContents.on('render-process-gone',(_event,details)=>{
    writeJson(crashFile(),{
      time:new Date().toISOString(),
      reason:details.reason,
      exitCode:details.exitCode
    });
  });
}

configureUpdater();

app.whenReady().then(()=>{
  createWindow();
  scheduleAutomaticUpdateChecks();

  app.on('activate',()=>{
    if(BrowserWindow.getAllWindows().length===0)createWindow();
  });
});

app.on('window-all-closed',()=>{
  if(process.platform!=='darwin')app.quit();
});

ipcMain.handle('desktop:bridge-health',()=>({
  ok:true,
  preload:true,
  updaterBridge:true,
  firebaseBridge:true,
  packaged:app.isPackaged,
  version:app.getVersion()
}));

ipcMain.handle('desktop:get-info',()=>({
  version:app.getVersion(),
  platform:process.platform,
  packaged:app.isPackaged,
  updaterAvailable:updateState.supported,
  signed:false,
  productName:'OnlyBeats',
  releaseChannel:'stable'
}));

ipcMain.handle('desktop:update-get-state',()=>({...updateState}));
ipcMain.handle('desktop:update-check',()=>checkForUpdates());
ipcMain.handle('desktop:update-download',()=>downloadUpdate());
ipcMain.handle('desktop:update-install',()=>installDownloadedUpdate());
ipcMain.handle('desktop:update-open-releases',async()=>{
  await shell.openExternal('https://github.com/bfalconello/OnlyBeats-Command-Center/releases');
  return true;
});
ipcMain.handle('desktop:update-show-log',async()=>{
  if(fs.existsSync(updaterLogFile()))shell.showItemInFolder(updaterLogFile());
  return updaterLogFile();
});

ipcMain.on('desktop:get-firebase-config-sync',event=>{
  event.returnValue=readJson(firebaseConfigFile(),{});
});

ipcMain.handle('desktop:save-firebase-config',(_event,config)=>{
  const allowed=['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'];
  const clean={};
  for(const key of allowed){
    clean[key]=typeof config?.[key]==='string'?config[key].trim():'';
  }
  return writeJson(firebaseConfigFile(),clean);
});

ipcMain.handle('desktop:open-notification-settings',async()=>{
  if(process.platform==='win32'){
    await shell.openExternal('ms-settings:notifications');
    return true;
  }
  return false;
});

ipcMain.handle('desktop:show-item',async(_event,filePath)=>{
  if(filePath)shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('desktop:confirm',async(_event,options)=>{
  const result=await dialog.showMessageBox(mainWindow,{
    type:'question',
    buttons:['Cancel','Continue'],
    defaultId:1,
    cancelId:0,
    title:options?.title||'OnlyBeats',
    message:options?.message||'Continue?'
  });
  return result.response===1;
});
