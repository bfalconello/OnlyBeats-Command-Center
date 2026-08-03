'use strict';

// OnlyBeats v2.7.1 Unlimited Combo Builder.
// Uses prediction language and contains no real-money transaction functions.

let predictionCombos=[];
let predictionComboDraft={
  id:'',
  name:'',
  notes:'',
  legs:[],
  createdAt:null,
  updatedAt:null
};
let predictionComboView='builder';
let predictionComboEditingId='';

function loadPredictionCombos(){
  try{
    const rows=JSON.parse(localStorage.getItem(PREDICTION_COMBOS_KEY)||'[]');
    predictionCombos=Array.isArray(rows)?rows:[];
  }catch{
    predictionCombos=[];
  }

  try{
    const draft=JSON.parse(localStorage.getItem(PREDICTION_COMBO_DRAFT_KEY)||'null');
    if(draft&&Array.isArray(draft.legs)){
      predictionComboDraft={...predictionComboDraft,...draft};
    }
  }catch{}
}

function savePredictionCombos(){
  localStorage.setItem(PREDICTION_COMBOS_KEY,JSON.stringify(predictionCombos));
  localStorage.setItem(PREDICTION_COMBO_DRAFT_KEY,JSON.stringify(predictionComboDraft));
}

function comboId(){
  return `combo-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

function comboLegId(){
  return `leg-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

function blankComboLeg(){
  return {
    id:comboLegId(),
    gameId:'',
    market:'winner',
    selection:'',
    line:'',
    confidence:70,
    status:'pending',
    resultNote:''
  };
}

function predictionComboGame(gameId){
  return games.find(game=>game.id===gameId)||null;
}

function predictionComboSelectionOptions(game,market){
  if(!game)return [];
  if(market==='winner'||market==='spread'){
    return [
      {value:game.away.abbr,label:game.away.shortName||game.away.name},
      {value:game.home.abbr,label:game.home.shortName||game.home.name}
    ];
  }
  if(market==='total'){
    return [
      {value:'over',label:'Over'},
      {value:'under',label:'Under'}
    ];
  }
  return [];
}

function predictionComboLegLabel(leg){
  const game=predictionComboGame(leg.gameId);
  if(!game)return 'Incomplete leg';
  const selection=predictionComboSelectionOptions(game,leg.market)
    .find(option=>option.value===leg.selection)?.label||leg.selection||'No selection';

  if(leg.market==='winner')return `${selection} to win`;
  if(leg.market==='spread')return `${selection} ${leg.line!==''?Number(leg.line)>0?`+${leg.line}`:leg.line:'spread'}`;
  if(leg.market==='total')return `${selection} ${leg.line!==''?leg.line:'total'}`;
  return selection;
}

function predictionComboWarnings(combo=predictionComboDraft){
  const warnings=[];
  const complete=combo.legs.filter(leg=>leg.gameId&&leg.selection);
  const signatures=new Map();

  complete.forEach((leg,index)=>{
    const signature=`${leg.gameId}|${leg.market}|${leg.selection}|${leg.line}`;
    if(signatures.has(signature)){
      warnings.push(`Leg ${index+1} duplicates leg ${signatures.get(signature)+1}.`);
    }else{
      signatures.set(signature,index);
    }
  });

  const byGame={};
  complete.forEach((leg,index)=>{
    byGame[leg.gameId]=byGame[leg.gameId]||[];
    byGame[leg.gameId].push({leg,index});
  });

  Object.values(byGame).forEach(rows=>{
    const winnerSelections=rows.filter(row=>row.leg.market==='winner');
    if(new Set(winnerSelections.map(row=>row.leg.selection)).size>1){
      warnings.push(`Conflicting winner selections appear in the same game.`);
    }

    const spreadSelections=rows.filter(row=>row.leg.market==='spread');
    if(new Set(spreadSelections.map(row=>row.leg.selection)).size>1){
      warnings.push(`Opposing spread selections appear in the same game.`);
    }

    const totals=rows.filter(row=>row.leg.market==='total');
    if(new Set(totals.map(row=>row.leg.selection)).size>1){
      warnings.push(`Both Over and Under appear for the same game.`);
    }
  });

  if(!combo.name.trim())warnings.push('Add a name before saving.');
  if(!complete.length)warnings.push('Add at least one complete leg before saving.');
  if(combo.legs.some(leg=>leg.gameId&&!leg.selection))warnings.push('One or more legs are incomplete.');

  return [...new Set(warnings)];
}

function predictionComboConfidence(combo=predictionComboDraft){
  const complete=combo.legs.filter(leg=>leg.gameId&&leg.selection);
  if(!complete.length)return 0;

  // Geometric mean keeps large combinations from showing an unrealistically high average.
  const product=complete.reduce((value,leg)=>value*Math.max(.01,Math.min(.99,Number(leg.confidence||0)/100)),1);
  return Math.pow(product,1/complete.length)*100;
}

function predictionComboRisk(combo=predictionComboDraft){
  const legs=combo.legs.filter(leg=>leg.gameId&&leg.selection).length;
  const confidence=predictionComboConfidence(combo);

  if(legs>=10||confidence<60)return 'Very High';
  if(legs>=6||confidence<68)return 'High';
  if(legs>=3||confidence<78)return 'Medium';
  return 'Low';
}

function settlePredictionComboLeg(leg){
  const game=predictionComboGame(leg.gameId);
  if(!game||game.state!=='post')return {...leg,status:'pending'};

  const awayScore=Number(game.away.score)||0;
  const homeScore=Number(game.home.score)||0;

  if(leg.market==='winner'){
    if(awayScore===homeScore)return {...leg,status:'push',resultNote:'Game tied'};
    const winner=awayScore>homeScore?game.away.abbr:game.home.abbr;
    return {...leg,status:winner===leg.selection?'correct':'incorrect'};
  }

  if(leg.market==='spread'){
    const line=Number(leg.line);
    if(!Number.isFinite(line))return {...leg,status:'pending'};
    const selectedIsAway=leg.selection===game.away.abbr;
    const selectedScore=selectedIsAway?awayScore:homeScore;
    const opponentScore=selectedIsAway?homeScore:awayScore;
    const adjusted=selectedScore+line-opponentScore;
    return {...leg,status:adjusted===0?'push':adjusted>0?'correct':'incorrect'};
  }

  if(leg.market==='total'){
    const line=Number(leg.line);
    if(!Number.isFinite(line))return {...leg,status:'pending'};
    const total=awayScore+homeScore;
    if(total===line)return {...leg,status:'push'};
    const correct=leg.selection==='over'?total>line:total<line;
    return {...leg,status:correct?'correct':'incorrect'};
  }

  return {...leg,status:'pending'};
}

function settlePredictionCombo(combo){
  const legs=combo.legs.map(settlePredictionComboLeg);
  const statuses=legs.map(leg=>leg.status);
  let status='pending';

  if(statuses.includes('incorrect'))status='incorrect';
  else if(statuses.length&&statuses.every(value=>['correct','push'].includes(value))){
    status=statuses.every(value=>value==='push')?'push':'correct';
  }

  return {
    ...combo,
    legs,
    status,
    updatedAt:new Date().toISOString()
  };
}

function settleAllPredictionCombos(){
  predictionCombos=predictionCombos.map(settlePredictionCombo);
  savePredictionCombos();
}

function predictionComboStatusCounts(combo){
  return combo.legs.reduce((counts,leg)=>{
    counts[leg.status]=(counts[leg.status]||0)+1;
    return counts;
  },{pending:0,correct:0,incorrect:0,push:0});
}

function predictionComboEnhancedPage(baseHtml){
  return `${baseHtml}${predictionComboPanel()}`;
}

function predictionComboPanel(){
  const completeLegs=predictionComboDraft.legs.filter(leg=>leg.gameId&&leg.selection);
  const confidence=predictionComboConfidence();
  const risk=predictionComboRisk();
  const warnings=predictionComboWarnings();

  return `<section class="card wide prediction-combo-shell">
    <div class="card-head">
      <div>
        <p class="eyebrow">UNLIMITED MULTI-PICK BUILDER</p>
        <h3>Prediction Combo Maker</h3>
        <p class="muted">Add as many prediction legs as needed. Performance may depend on the computer when a combination contains hundreds of legs.</p>
      </div>
      <div class="button-row">
        <button class="button ${predictionComboView==='builder'?'primary':''}" data-combo-view="builder">Combo Maker</button>
        <button class="button ${predictionComboView==='saved'?'primary':''}" data-combo-view="saved">Saved Combos (${predictionCombos.length})</button>
      </div>
    </div>

    ${predictionComboView==='builder'?`<div class="reports-grid">
      ${card('Combo Details',`<div class="detail-list">
        <label><span>Combo name</span><input id="predictionComboName" value="${esc(predictionComboDraft.name)}" placeholder="Saturday Combo"></label>
        <label><span>Notes</span><textarea id="predictionComboNotes" placeholder="Optional notes">${esc(predictionComboDraft.notes)}</textarea></label>
        <div><span>Complete legs</span><strong>${completeLegs.length}</strong></div>
        <div><span>Combined confidence</span><strong>${confidence.toFixed(1)}%</strong></div>
        <div><span>Risk rating</span><strong>${risk}</strong></div>
      </div>
      <div class="button-row">
        <button class="button primary" id="savePredictionCombo">${predictionComboEditingId?'Update combo':'Save combo'}</button>
        <button class="button" id="addPredictionComboLeg">Add leg</button>
        <button class="button" id="clearPredictionCombo">Clear draft</button>
      </div>`)}

      ${card('Builder Warnings',warnings.length?`<div class="intel-list">${warnings.map(message=>`
        <div class="intel-row"><span class="intel-icon">△</span><div><strong>${esc(message)}</strong></div></div>`).join('')}</div>`:`<div class="intel-list"><div class="intel-row"><span class="intel-icon">✓</span><div><strong>No conflicts detected</strong><small>The combination is structurally ready to save.</small></div></div></div>`)}

      ${card('Prediction Legs',predictionComboDraft.legs.length?`<div class="combo-leg-list">${predictionComboDraft.legs.map((leg,index)=>predictionComboLegEditor(leg,index)).join('')}</div>`:empty('No legs yet','Use Add leg to begin building the combination.'),'wide')}
    </div>`:predictionComboSavedPanel()}
  </section>`;
}

function predictionComboLegEditor(leg,index){
  const game=predictionComboGame(leg.gameId);
  const options=predictionComboSelectionOptions(game,leg.market);

  return `<article class="combo-leg-card" data-combo-leg="${leg.id}">
    <div class="card-head">
      <div><p class="eyebrow">LEG ${index+1}</p><h4>${esc(predictionComboLegLabel(leg))}</h4></div>
      <div class="button-row">
        <button class="button" data-combo-move-up="${leg.id}" ${index===0?'disabled':''}>↑</button>
        <button class="button" data-combo-move-down="${leg.id}" ${index===predictionComboDraft.legs.length-1?'disabled':''}>↓</button>
        <button class="button" data-combo-remove="${leg.id}">Remove</button>
      </div>
    </div>

    <div class="combo-leg-grid">
      <label><span>Game</span>
        <select data-combo-field="gameId" data-combo-id="${leg.id}">
          <option value="">Choose game</option>
          ${games.map(item=>`<option value="${item.id}" ${item.id===leg.gameId?'selected':''}>${esc(item.away.shortName)} at ${esc(item.home.shortName)} · ${esc(item.status)}</option>`).join('')}
        </select>
      </label>

      <label><span>Prediction type</span>
        <select data-combo-field="market" data-combo-id="${leg.id}">
          <option value="winner" ${leg.market==='winner'?'selected':''}>Winner</option>
          <option value="spread" ${leg.market==='spread'?'selected':''}>Spread</option>
          <option value="total" ${leg.market==='total'?'selected':''}>Total</option>
        </select>
      </label>

      <label><span>Selection</span>
        <select data-combo-field="selection" data-combo-id="${leg.id}">
          <option value="">Choose selection</option>
          ${options.map(option=>`<option value="${esc(option.value)}" ${option.value===leg.selection?'selected':''}>${esc(option.label)}</option>`).join('')}
        </select>
      </label>

      <label><span>${leg.market==='total'?'Total':'Line'}</span>
        <input data-combo-field="line" data-combo-id="${leg.id}" type="number" step="0.5" value="${esc(String(leg.line))}" ${leg.market==='winner'?'disabled':''}>
      </label>

      <label><span>Confidence</span>
        <input data-combo-field="confidence" data-combo-id="${leg.id}" type="number" min="1" max="99" value="${Number(leg.confidence)||70}">
      </label>

      <div class="combo-leg-status"><span>Status</span><strong>${esc(leg.status||'pending')}</strong></div>
    </div>
  </article>`;
}

function predictionComboSavedPanel(){
  if(!predictionCombos.length){
    return empty('No saved combos','Build and save a combination to track it here.');
  }

  return `<div class="combo-saved-list">${predictionCombos.slice().reverse().map(combo=>{
    const counts=predictionComboStatusCounts(combo);
    return `<article class="card">
      <div class="card-head">
        <div>
          <span class="provider-badge">${esc((combo.status||'pending').toUpperCase())}</span>
          <h3>${esc(combo.name)}</h3>
          <p class="muted">${combo.legs.length} legs · ${predictionComboConfidence(combo).toFixed(1)}% combined confidence · ${predictionComboRisk(combo)} risk</p>
        </div>
      </div>
      <div class="detail-list">
        <div><span>Pending</span><strong>${counts.pending||0}</strong></div>
        <div><span>Correct</span><strong>${counts.correct||0}</strong></div>
        <div><span>Incorrect</span><strong>${counts.incorrect||0}</strong></div>
        <div><span>Push</span><strong>${counts.push||0}</strong></div>
      </div>
      <div class="combo-leg-summary">${combo.legs.map((leg,index)=>`
        <div class="combo-summary-row"><span>${index+1}. ${esc(predictionComboLegLabel(leg))}</span><strong>${esc(leg.status||'pending')}</strong></div>`).join('')}</div>
      <div class="button-row">
        <button class="button primary" data-combo-edit="${combo.id}">Edit</button>
        <button class="button" data-combo-duplicate="${combo.id}">Duplicate</button>
        <button class="button" data-combo-settle="${combo.id}">Settle now</button>
        <button class="button" data-combo-delete="${combo.id}">Delete</button>
      </div>
    </article>`;
  }).join('')}</div>`;
}

function comboDraftFromInputs(){
  predictionComboDraft.name=$('predictionComboName')?.value.trim()||predictionComboDraft.name;
  predictionComboDraft.notes=$('predictionComboNotes')?.value.trim()||predictionComboDraft.notes;
  predictionComboDraft.updatedAt=new Date().toISOString();
  savePredictionCombos();
}

function updatePredictionComboLeg(id,field,value){
  const leg=predictionComboDraft.legs.find(item=>item.id===id);
  if(!leg)return;

  if(field==='confidence'){
    leg[field]=Math.max(1,Math.min(99,Number(value)||70));
  }else{
    leg[field]=value;
  }

  if(field==='gameId'||field==='market'){
    leg.selection='';
    if(field==='market'&&value==='winner')leg.line='';
  }

  savePredictionCombos();
  renderPage();
}

function savePredictionCombo(){
  comboDraftFromInputs();
  const warnings=predictionComboWarnings();

  if(!predictionComboDraft.name.trim()){
    toast('Add a combo name before saving','error');
    return;
  }

  if(!predictionComboDraft.legs.some(leg=>leg.gameId&&leg.selection)){
    toast('Add at least one complete leg','error');
    return;
  }

  const saved={
    ...predictionComboDraft,
    id:predictionComboEditingId||predictionComboDraft.id||comboId(),
    legs:predictionComboDraft.legs.map(leg=>({...leg})),
    status:'pending',
    createdAt:predictionComboDraft.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };

  const index=predictionCombos.findIndex(combo=>combo.id===saved.id);
  if(index>=0)predictionCombos.splice(index,1,saved);
  else predictionCombos.push(saved);

  predictionComboEditingId='';
  predictionComboDraft={
    id:'',
    name:'',
    notes:'',
    legs:[blankComboLeg()],
    createdAt:null,
    updatedAt:null
  };
  predictionComboView='saved';
  savePredictionCombos();
  renderPage();
  toast(warnings.length?'Combo saved with warnings':'Combo saved','success');
}

function editPredictionCombo(id){
  const combo=predictionCombos.find(item=>item.id===id);
  if(!combo)return;
  predictionComboEditingId=id;
  predictionComboDraft={
    ...combo,
    legs:combo.legs.map(leg=>({...leg}))
  };
  predictionComboView='builder';
  savePredictionCombos();
  renderPage();
}

function duplicatePredictionCombo(id){
  const combo=predictionCombos.find(item=>item.id===id);
  if(!combo)return;

  predictionCombos.push({
    ...combo,
    id:comboId(),
    name:`${combo.name} Copy`,
    legs:combo.legs.map(leg=>({...leg,id:comboLegId(),status:'pending'})),
    status:'pending',
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  });
  savePredictionCombos();
  renderPage();
  toast('Combo duplicated');
}

function bindPredictionCombos(){
  document.querySelectorAll('[data-combo-view]').forEach(button=>{
    button.onclick=()=>{
      comboDraftFromInputs();
      predictionComboView=button.dataset.comboView;
      renderPage();
    };
  });

  document.querySelectorAll('[data-combo-field]').forEach(input=>{
    input.onchange=()=>updatePredictionComboLeg(
      input.dataset.comboId,
      input.dataset.comboField,
      input.value
    );
  });

  document.querySelectorAll('[data-combo-remove]').forEach(button=>{
    button.onclick=()=>{
      predictionComboDraft.legs=predictionComboDraft.legs.filter(leg=>leg.id!==button.dataset.comboRemove);
      savePredictionCombos();
      renderPage();
    };
  });

  document.querySelectorAll('[data-combo-move-up]').forEach(button=>{
    button.onclick=()=>{
      const index=predictionComboDraft.legs.findIndex(leg=>leg.id===button.dataset.comboMoveUp);
      if(index>0){
        [predictionComboDraft.legs[index-1],predictionComboDraft.legs[index]]=
          [predictionComboDraft.legs[index],predictionComboDraft.legs[index-1]];
        savePredictionCombos();
        renderPage();
      }
    };
  });

  document.querySelectorAll('[data-combo-move-down]').forEach(button=>{
    button.onclick=()=>{
      const index=predictionComboDraft.legs.findIndex(leg=>leg.id===button.dataset.comboMoveDown);
      if(index>=0&&index<predictionComboDraft.legs.length-1){
        [predictionComboDraft.legs[index],predictionComboDraft.legs[index+1]]=
          [predictionComboDraft.legs[index+1],predictionComboDraft.legs[index]];
        savePredictionCombos();
        renderPage();
      }
    };
  });

  if($('addPredictionComboLeg'))$('addPredictionComboLeg').onclick=()=>{
    comboDraftFromInputs();
    predictionComboDraft.legs.push(blankComboLeg());
    savePredictionCombos();
    renderPage();
  };

  if($('savePredictionCombo'))$('savePredictionCombo').onclick=savePredictionCombo;

  if($('clearPredictionCombo'))$('clearPredictionCombo').onclick=()=>{
    predictionComboEditingId='';
    predictionComboDraft={
      id:'',
      name:'',
      notes:'',
      legs:[blankComboLeg()],
      createdAt:null,
      updatedAt:null
    };
    savePredictionCombos();
    renderPage();
  };

  document.querySelectorAll('[data-combo-edit]').forEach(button=>{
    button.onclick=()=>editPredictionCombo(button.dataset.comboEdit);
  });

  document.querySelectorAll('[data-combo-duplicate]').forEach(button=>{
    button.onclick=()=>duplicatePredictionCombo(button.dataset.comboDuplicate);
  });

  document.querySelectorAll('[data-combo-settle]').forEach(button=>{
    button.onclick=()=>{
      const index=predictionCombos.findIndex(combo=>combo.id===button.dataset.comboSettle);
      if(index>=0){
        predictionCombos[index]=settlePredictionCombo(predictionCombos[index]);
        savePredictionCombos();
        renderPage();
        toast('Combo settlement updated');
      }
    };
  });

  document.querySelectorAll('[data-combo-delete]').forEach(button=>{
    button.onclick=()=>{
      const combo=predictionCombos.find(item=>item.id===button.dataset.comboDelete);
      if(!combo)return;
      if(!confirm(`Delete ${combo.name}?`))return;
      predictionCombos=predictionCombos.filter(item=>item.id!==combo.id);
      savePredictionCombos();
      renderPage();
      toast('Combo deleted');
    };
  });
}

function installPredictionComboStyles(){
  if(document.getElementById('onlybeatsComboStyles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsComboStyles';
  style.textContent=`
    .prediction-combo-shell{margin-top:18px}
    .combo-leg-list{display:grid;gap:14px}
    .combo-leg-card{padding:16px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(255,255,255,.02)}
    .combo-leg-grid{display:grid;grid-template-columns:2fr 1fr 1.3fr .8fr .8fr .8fr;gap:12px;align-items:end}
    .combo-leg-grid label span,.combo-leg-status span{display:block;color:#9aabbd;font-size:.78rem;margin-bottom:5px}
    .combo-leg-status{padding:10px 12px;border:1px solid rgba(255,255,255,.09);border-radius:10px}
    .combo-saved-list{display:grid;gap:14px}
    .combo-leg-summary{display:grid;gap:6px;margin:14px 0}
    .combo-summary-row{display:flex;justify-content:space-between;gap:14px;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.025)}
    @media(max-width:1100px){.combo-leg-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:650px){.combo-leg-grid{grid-template-columns:1fr}.combo-summary-row{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);
}

function initializePredictionCombos(){
  loadPredictionCombos();
  installPredictionComboStyles();

  if(!predictionComboDraft.legs.length){
    predictionComboDraft.legs=[blankComboLeg()];
    savePredictionCombos();
  }

  settleAllPredictionCombos();
}
