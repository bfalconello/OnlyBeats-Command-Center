'use strict';

const {contextBridge,ipcRenderer}=require('electron');

let persistentFirebaseConfig={};
try{
  persistentFirebaseConfig=ipcRenderer.sendSync('desktop:get-firebase-config-sync')||{};
}catch{}

const desktopBridge={
  version:'',
  platform:process.platform,
  packaged:false,
  updaterAvailable:false,
  signed:false,
  productName:'OnlyBeats',
  releaseChannel:'stable',
  firebaseConfig:persistentFirebaseConfig,

  getInfo:()=>ipcRenderer.invoke('desktop:get-info'),
  getBridgeHealth:()=>ipcRenderer.invoke('desktop:bridge-health'),
  saveFirebaseConfig:config=>ipcRenderer.invoke('desktop:save-firebase-config',config),

  update:{
    getState:()=>ipcRenderer.invoke('desktop:update-get-state'),
    check:()=>ipcRenderer.invoke('desktop:update-check'),
    download:()=>ipcRenderer.invoke('desktop:update-download'),
    install:()=>ipcRenderer.invoke('desktop:update-install'),
    openReleases:()=>ipcRenderer.invoke('desktop:update-open-releases'),
    showLog:()=>ipcRenderer.invoke('desktop:update-show-log'),
    onState:callback=>{
      if(typeof callback!=='function')return()=>{};
      const listener=(_event,state)=>callback(state);
      ipcRenderer.on('desktop:update-state',listener);
      return()=>ipcRenderer.removeListener('desktop:update-state',listener);
    }
  },

  openNotificationSettings:()=>ipcRenderer.invoke('desktop:open-notification-settings'),
  showItem:filePath=>ipcRenderer.invoke('desktop:show-item',filePath),
  confirm:options=>ipcRenderer.invoke('desktop:confirm',options)
};

contextBridge.exposeInMainWorld('onlyBeatsDesktop',desktopBridge);

// Hydrate non-critical runtime metadata asynchronously after the bridge exists.
ipcRenderer.invoke('desktop:get-info')
  .then(info=>{
    if(!info||typeof info!=='object')return;
    Object.assign(desktopBridge,{
      version:String(info.version||''),
      platform:String(info.platform||process.platform),
      packaged:Boolean(info.packaged),
      updaterAvailable:Boolean(info.updaterAvailable),
      signed:Boolean(info.signed),
      productName:String(info.productName||'OnlyBeats'),
      releaseChannel:String(info.releaseChannel||'stable')
    });
  })
  .catch(()=>{});
