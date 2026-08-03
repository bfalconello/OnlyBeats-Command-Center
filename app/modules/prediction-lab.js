'use strict';

// OnlyBeats v2.8 Prediction Lab.
// Transparent rule-based analytics using local predictions and game results.

let predictionLabState={
  minConfidence:60,
  maxSuggestions:8,
  upsetThreshold:18,
  includePendingOnly:true,
  comboSize:4,
  lastAnalyzedAt:null
};

function loadPredictionLabState(){
  try{
    predictionLabState={
      ...predictionLabState,
      ...JSON.parse(localStorage.getItem(PREDICTION_LAB_KEY)||'{}')
    };
  }catch{}
}

function savePredictionLabState(){
  localStorage.setItem(PREDICTION_LAB_KEY,JSON.stringify(predictionLabState));
}

function labPredictionGame(prediction){
  return games.find(game=>game.id===prediction.gameId)||null;
}

function labPredictionConfidence(prediction){
  return Math.max(1,Math.min(99,Number(prediction.confidence||prediction.confidenceScore||70)));
}

function labPredictionStatus(prediction){
  return String(prediction.status||prediction.result||'pending').toLowerCase();
}

function labCompletedPredictions(){
  return predictions.filter(prediction=>['correct','incorrect','push','won','lost'].includes(labPredictionStatus(prediction)));
}

function labAccuracy(){
  const completed=labCompletedPredictions().filter(prediction=>!['push'].includes(labPredictionStatus(prediction)));
  const correct=completed.filter(prediction=>['correct','won'].includes(labPredictionStatus(prediction))).length;
  return {
    completed:completed.length,
    correct,
    incorrect:completed.length-correct,
    rate:completed.length?correct/completed.length*100:0
  };
}

function labCalibrationBuckets(){
  const buckets=[
    {label:'50–59%',min:50,max:59,items:[]},
    {label:'60–69%',min:60,max:69,items:[]},
    {label:'70–79%',min:70,max:79,items:[]},
    {label:'80–89%',min:80,max:89,items:[]},
    {label:'90–99%',min:90,max:99,items:[]}
  ];

  labCompletedPredictions().forEach(prediction=>{
    const confidence=labPredictionConfidence(prediction);
    const bucket=buckets.find(item=>confidence>=item.min&&confidence<=item.max);
    if(bucket)bucket.items.push(prediction);
  });

  return buckets.map(bucket=>{
    const graded=bucket.items.filter(item=>!['push'].includes(labPredictionStatus(item)));
    const correct=graded.filter(item=>['correct','won'].includes(labPredictionStatus(item))).length;
    const actual=graded.length?correct/graded.length*100:0;
    const expected=(bucket.min+bucket.max)/2;
    return {
      ...bucket,
      count:graded.length,
      correct,
      actual,
      expected,
      gap:actual-expected
    };
  });
}

function labPredictionScore(prediction){
  const game=labPredictionGame(prediction);
  const confidence=labPredictionConfidence(prediction);
  let score=confidence;

  if(game){
    if(game.state==='pre')score+=4;
    if(game.state==='in')score+=1;
    if(game.away.rank||game.home.rank)score+=3;
    if(favorites.includes?.(game.away.abbr)||favorites.includes?.(game.home.abbr))score+=2;
  }

  const status=labPredictionStatus(prediction);
  if(status==='pending')score+=4;
  if(['incorrect','lost'].includes(status))score-=20;

  return Math.max(0,Math.min(100,score));
}

function labBestPredictions(){
  return predictions
    .filter(prediction=>labPredictionConfidence(prediction)>=predictionLabState.minConfidence)
    .filter(prediction=>!predictionLabState.includePendingOnly||labPredictionStatus(prediction)==='pending')
    .map(prediction=>({
      prediction,
      game:labPredictionGame(prediction),
      score:labPredictionScore(prediction)
    }))
    .sort((a,b)=>b.score-a.score)
    .slice(0,predictionLabState.maxSuggestions);
}

function labUpsetCandidates(){
  return games
    .filter(game=>game.state==='pre'||game.state==='in')
    .map(game=>{
      const awayRank=Number(game.away.rank)||0;
      const homeRank=Number(game.home.rank)||0;
      const awayScore=Number(game.away.score)||0;
      const homeScore=Number(game.home.score)||0;
      let upsetScore=0;
      let underdog='';

      if(awayRank&&homeRank){
        const gap=Math.abs(awayRank-homeRank);
        upsetScore+=Math.min(40,gap*2);
        underdog=awayRank>homeRank?game.away.abbr:game.home.abbr;
      }else if(awayRank||homeRank){
        upsetScore+=24;
        underdog=awayRank?game.home.abbr:game.away.abbr;
      }

      if(game.state==='in'){
        const underdogIsAway=underdog===game.away.abbr;
        const margin=underdogIsAway?awayScore-homeScore:homeScore-awayScore;
        if(margin>0)upsetScore+=Math.min(45,margin*4);
        else if(margin>=-7)upsetScore+=12;
      }

      const matching=predictions.filter(prediction=>prediction.gameId===game.id);
      if(matching.some(prediction=>String(prediction.team||prediction.selection||'')===underdog)){
        upsetScore+=8;
      }

      return {game,underdog,score:Math.max(0,Math.min(100,upsetScore))};
    })
    .filter(item=>item.underdog&&item.score>=predictionLabState.upsetThreshold)
    .sort((a,b)=>b.score-a.score)
    .slice(0,12);
}

function labPredictionLabel(prediction){
  const game=labPredictionGame(prediction);
  const selection=prediction.team||prediction.selection||prediction.pick||'Saved prediction';
  const type=prediction.market||prediction.type||'prediction';
  return game
    ? `${selection} · ${type} · ${game.away.shortName} at ${game.home.shortName}`
    : `${selection} · ${type}`;
}

function labCreateSuggestedCombo(){
  const best=labBestPredictions().slice(0,Math.max(1,Number(predictionLabState.comboSize)||4));
  if(!best.length){
    toast('No eligible predictions are available','error');
    return;
  }

  const legs=best.map(item=>{
    const prediction=item.prediction;
    const game=item.game;
    const market=String(prediction.market||prediction.type||'winner').toLowerCase();
    let normalizedMarket='winner';
    if(market.includes('spread'))normalizedMarket='spread';
    else if(market.includes('total')||market.includes('over')||market.includes('under'))normalizedMarket='total';

    return {
      id:comboLegId(),
      gameId:prediction.gameId||'',
      market:normalizedMarket,
      selection:String(prediction.team||prediction.selection||prediction.pick||''),
      line:prediction.line??prediction.value??'',
      confidence:labPredictionConfidence(prediction),
      status:'pending',
      resultNote:'Suggested by Prediction Lab'
    };
  });

  predictionComboDraft={
    id:'',
    name:`Prediction Lab Combo ${new Date().toLocaleDateString()}`,
    notes:'Built from the highest-ranked saved predictions using transparent local scoring.',
    legs,
    createdAt:null,
    updatedAt:new Date().toISOString()
  };
  predictionComboEditingId='';
  predictionComboView='builder';
  savePredictionCombos();
  navigate('predictions');
  toast('Prediction Lab combo created','success');
}

function predictionLabPage(){
  setHeading('Prediction Lab','CALIBRATION · UPSET WATCH · RANKING');
  const accuracy=labAccuracy();
  const best=labBestPredictions();
  const upsets=labUpsetCandidates();
  const calibration=labCalibrationBuckets();

  predictionLabState.lastAnalyzedAt=new Date().toISOString();
  savePredictionLabState();

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">TRANSPARENT LOCAL ANALYTICS</p>
      <h2>${best.length} ranked prediction${best.length===1?'':'s'} available.</h2>
      <p>Prediction Lab scores your saved predictions using confidence, game state, rankings, favorites, and historical accuracy. It does not use hidden AI or external public percentages.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="labBuildCombo" ${best.length?'':'disabled'}>Build suggested combo</button>
      <button class="button" id="labRefresh">Refresh analysis</button>
      <button class="button" data-page-jump="predictions">Open Prediction Center</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Historical Accuracy',`${accuracy.rate.toFixed(1)}%`,`${accuracy.correct}/${accuracy.completed} graded`)}
    ${metric('Ranked Predictions',best.length,`Minimum ${predictionLabState.minConfidence}% confidence`)}
    ${metric('Upset Watch',upsets.length,`Threshold ${predictionLabState.upsetThreshold}`)}
    ${metric('Saved Combos',predictionCombos.length,'Prediction combinations')}
    ${metric('Pending Predictions',predictions.filter(item=>labPredictionStatus(item)==='pending').length,'Awaiting results')}
    ${metric('Last Analysis',new Date(predictionLabState.lastAnalyzedAt).toLocaleTimeString(),'Local calculation')}
  </div>

  <div class="reports-grid">
    ${card('Lab Controls',`<div class="detail-list">
      <label><span>Minimum confidence</span><input id="labMinConfidence" type="number" min="1" max="99" value="${predictionLabState.minConfidence}"></label>
      <label><span>Maximum ranked results</span><input id="labMaxSuggestions" type="number" min="1" max="50" value="${predictionLabState.maxSuggestions}"></label>
      <label><span>Upset-watch threshold</span><input id="labUpsetThreshold" type="number" min="1" max="100" value="${predictionLabState.upsetThreshold}"></label>
      <label><span>Suggested combo size</span><input id="labComboSize" type="number" min="1" max="100" value="${predictionLabState.comboSize}"></label>
      <label class="toggle-row"><span>Pending predictions only</span><input id="labPendingOnly" type="checkbox" ${predictionLabState.includePendingOnly?'checked':''}></label>
    </div>`)}

    ${card('Confidence Calibration',`<div class="calibration-list">${calibration.map(bucket=>`
      <div class="calibration-row">
        <div><strong>${bucket.label}</strong><small>${bucket.count} graded</small></div>
        <div class="calibration-track"><span style="width:${Math.max(0,Math.min(100,bucket.actual))}%"></span></div>
        <div><strong>${bucket.count?bucket.actual.toFixed(1):'—'}%</strong><small>${bucket.count?`${bucket.gap>=0?'+':''}${bucket.gap.toFixed(1)} pts vs confidence`:'No data'}</small></div>
      </div>`).join('')}</div>`)}

    ${card('Best Saved Predictions',best.length?`<div class="intel-list">${best.map((item,index)=>`
      <div class="intel-row">
        <span class="intel-icon">${index+1}</span>
        <div><strong>${esc(labPredictionLabel(item.prediction))}</strong><small>${labPredictionConfidence(item.prediction)}% confidence · Lab score ${item.score.toFixed(0)}</small></div>
        <span class="provider-badge">${esc(labPredictionStatus(item.prediction).toUpperCase())}</span>
      </div>`).join('')}</div>`:empty('No eligible predictions','Lower the confidence threshold or save pending predictions.'),'wide')}

    ${card('Upset Watch',upsets.length?`<div class="intel-list">${upsets.map(item=>`
      <div class="intel-row">
        <span class="intel-icon">△</span>
        <div><strong>${esc(item.underdog)} upset watch</strong><small>${esc(item.game.away.shortName)} at ${esc(item.game.home.shortName)} · Score ${item.score.toFixed(0)}</small></div>
        <span class="provider-badge">${item.game.state==='in'?'LIVE':'PREGAME'}</span>
      </div>`).join('')}</div>`:empty('No upset-watch games','No current games meet the selected threshold.'),'wide')}

    ${card('How Lab Scores Work',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">1</span><div><strong>Saved confidence</strong><small>The prediction confidence is the starting score.</small></div></div>
      <div class="intel-row"><span class="intel-icon">2</span><div><strong>Game context</strong><small>Pregame status, ranked matchups, and favorite teams can add small transparent adjustments.</small></div></div>
      <div class="intel-row"><span class="intel-icon">3</span><div><strong>Historical calibration</strong><small>Confidence buckets are compared with actual graded accuracy.</small></div></div>
      <div class="intel-row"><span class="intel-icon">4</span><div><strong>No hidden model</strong><small>Every result is derived from local data and documented rules.</small></div></div>
    </div>`,'wide')}
  </div>`;
}

function bindPredictionLab(){
  const saveControl=(id,key,parser=value=>value)=>{
    if($(id))$(id).onchange=event=>{
      predictionLabState[key]=parser(event.target.value,event.target.checked);
      savePredictionLabState();
      renderPage();
    };
  };

  saveControl('labMinConfidence','minConfidence',value=>Math.max(1,Math.min(99,Number(value)||60)));
  saveControl('labMaxSuggestions','maxSuggestions',value=>Math.max(1,Math.min(50,Number(value)||8)));
  saveControl('labUpsetThreshold','upsetThreshold',value=>Math.max(1,Math.min(100,Number(value)||18)));
  saveControl('labComboSize','comboSize',value=>Math.max(1,Math.min(100,Number(value)||4)));

  if($('labPendingOnly'))$('labPendingOnly').onchange=event=>{
    predictionLabState.includePendingOnly=event.target.checked;
    savePredictionLabState();
    renderPage();
  };

  if($('labBuildCombo'))$('labBuildCombo').onclick=labCreateSuggestedCombo;
  if($('labRefresh'))$('labRefresh').onclick=()=>{
    renderPage();
    toast('Prediction Lab refreshed');
  };
}

function installPredictionLabStyles(){
  if(document.getElementById('onlybeatsPredictionLabStyles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsPredictionLabStyles';
  style.textContent=`
    .calibration-list{display:grid;gap:12px}
    .calibration-row{display:grid;grid-template-columns:110px 1fr 150px;gap:14px;align-items:center}
    .calibration-row small{display:block;color:#9aabbd;margin-top:3px}
    .calibration-track{height:10px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
    .calibration-track span{display:block;height:100%;background:#f4bd45;border-radius:99px}
    @media(max-width:700px){.calibration-row{grid-template-columns:1fr}.calibration-track{order:3}}
  `;
  document.head.appendChild(style);
}

function initializePredictionLab(){
  loadPredictionLabState();
  installPredictionLabStyles();
}
