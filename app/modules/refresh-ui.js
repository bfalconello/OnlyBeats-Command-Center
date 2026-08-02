'use strict';

// Refresh timing, button states, and persistent refresh event routing.

function withTimeout(promise,ms,label='Request'){
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timed out after ${Math.round(ms/1000)} seconds`)),ms))
  ]);
}

async function runVisibleRefresh(buttonId, pendingLabel, idleLabel){
  const button=$(buttonId);
  if(loading){
    toast('A score refresh is already running');
    return;
  }
  if(button){
    button.disabled=true;
    button.textContent=pendingLabel;
    button.setAttribute('aria-busy','true');
  }
  try{
    await syncScores(false);
  }finally{
    const currentButton=$(buttonId);
    if(currentButton){
      currentButton.disabled=false;
      currentButton.textContent=idleLabel;
      currentButton.removeAttribute('aria-busy');
    }
  }
}

function refreshActionFor(target){
  const button=target?.closest?.('#refreshScores,#refreshIntelligence,#refreshNewsFeed,#refreshSchedule,#retrySchedule');
  if(!button)return null;
  if(button.id==='refreshIntelligence')return {buttonId:'refreshIntelligence',pending:'Refreshing intelligence…',idle:'Refresh intelligence'};
  if(button.id==='refreshNewsFeed')return {buttonId:'refreshNewsFeed',pending:'Refreshing feed…',idle:'Refresh feed'};
  if(button.id==='refreshSchedule'||button.id==='retrySchedule')return {buttonId:button.id,pending:'Refreshing schedule…',idle:button.id==='retrySchedule'?'Try again':'Refresh schedule'};
  return {buttonId:'refreshScores',pending:'Refreshing…',idle:'Refresh'};
}

function scheduleRefresh(){clearInterval(refreshTimer);const seconds=Number(settings.refresh||30);if(seconds>0)refreshTimer=setInterval(()=>syncScores(true),seconds*1000)}

document.addEventListener('click',event=>{
  const action=refreshActionFor(event.target);
  if(!action)return;
  event.preventDefault();
  event.stopPropagation();
  runVisibleRefresh(action.buttonId,action.pending,action.idle);
});
