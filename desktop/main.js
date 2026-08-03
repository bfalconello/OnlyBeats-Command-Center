'use strict';

const {app,BrowserWindow,ipcMain,shell,dialog}=require('electron');
const path=require('path');
const fs=require('fs');

let mainWindow=null;
const stateFile=()=>path.join(app.getPath('userData'),'window-state.json');
const crashFile=()=>path.join(app.getPath('userData'),'last-crash.json');

function readJson(file,fallback){
  try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}
}

function writeJson(file,value){
  try{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2))}catch{}
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

app.whenReady().then(()=>{
  createWindow();
  app.on('activate',()=>{
    if(BrowserWindow.getAllWindows().length===0)createWindow();
  });
});

app.on('window-all-closed',()=>{
  if(process.platform!=='darwin')app.quit();
});

ipcMain.handle('desktop:get-info',()=>({
  version:app.getVersion(),
  platform:process.platform,
  packaged:app.isPackaged,
  updaterAvailable:false,
  signed:false
}));

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
