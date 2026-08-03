'use strict';

const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('onlyBeatsDesktop',{
  get version(){return process.versions.electron?require('../package.json').version:''},
  platform:process.platform,
  packaged:false,
  updaterAvailable:false,
  signed:false,
  getInfo:()=>ipcRenderer.invoke('desktop:get-info'),
  openNotificationSettings:()=>ipcRenderer.invoke('desktop:open-notification-settings'),
  showItem:filePath=>ipcRenderer.invoke('desktop:show-item',filePath),
  confirm:options=>ipcRenderer.invoke('desktop:confirm',options)
});
