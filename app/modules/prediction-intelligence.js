'use strict';

// OnlyBeats v3.5 Prediction Intelligence.
// Uses transparent scoring based on the user's saved predictions, confidence,
// historical accuracy, rankings, weather, and game context.
// No odds, wagering feeds, hidden AI, or financial-return claims are used.

let predictionIntelligenceState={
  minimumConfidence:55,
  minimumHistorySample:3,
  maximumRows:15,
  pendingOnly:true,
  useHistoricalTeamPerformance:true,
  useHistoricalConferencePerformance:true,
  useWeatherContext:true,
  useRankingContext:true,
  suggestedComboSize:5,
  lastCalculatedAt:null
};

function loadPredictionIntelligenceState(){
  try{
    predictionIntelligenceState={
      ...predictionIntelligenceState,
      ...JSON.parse(localStorage.getItem(PREDICTION_INTELLIGENCE_KEY)||'{}')
    };
  }catch{}
}

function savePredictionIntelligenceState(){
  localStorage.setItem(PREDICTION_INTELLIGENCE_KEY,JSON.stringify(predictionIntelligenceState));
}

function intelligenceStatus(prediction){
  if(typeof analyticsStatus==='function')return analyticsStatus(prediction);
  const raw=String(prediction?.status||prediction?.result||'pending').toLowerCase();
  if(['correct','won','win'].includes(raw))return 'correct';
  if(['incorrect','lost','loss'].includes(raw))return 'incorrect';
  if(['push','tie'].includes(raw))return 'push';
  return 'pending';
}

function intelligenceConfidence(prediction){
  if(typeof analyticsConfidence==='function')return analyticsConfidence(prediction);
  return Math.max(1,Math.min(99,Number(
    prediction?.confidence??
    prediction?.confidenceScore??
    prediction?.rating??
    70
  )||70));
}

function intelligenceSelection(prediction){
  if(typeof analyticsSelection==='function')return analyticsSelection(prediction);
  return String(prediction?.team||prediction?.selection||prediction?.pick||'Unknown');
}

function intelligenceGame(prediction){
  return games.find(game=>String(game.id)===String(prediction?.gameId))||null;
}

function intelligenceConference(team){
  if(typeof analyticsConferenceForTeam==='function'){
    return analyticsConferenceForTeam(team);
  }
  return 'Unknown';
}

function intelligenceHistoricalRows(){
  return predictions
    .map(prediction=>({
      prediction,
      status:intelligenceStatus(prediction),
      selection:intelligenceSelection(prediction),
      conference:intelligenceConference(intelligenceSelection(prediction))
    }))
    .filter(row=>['correct','incorrect','push'].includes(row.status));
}

function intelligenceRecord(rows){
  const correct=rows.filter(row=>row.status==='correct').length;
  const incorrect=rows.filter(row=>row.status==='incorrect').length;
  const pushes=rows.filter(row=>row.status==='push').length;
  const denominator=correct+incorrect;
  return {
    correct,
    incorrect,
    pushes,
    sample:correct+incorrect+pushes,
    rate:denominator?correct/denominator*100:0
  };
}

function intelligenceHistoryFor(selection,conference){
  const rows=intelligenceHistoricalRows();

  const teamRows=rows.filter(row=>row.selection===selection);
  const conferenceRows=rows.filter(row=>conference!=='Unknown'&&row.conference===conference);

  return {
    team:intelligenceRecord(teamRows),
    conference:intelligenceRecord(conferenceRows)
  };
}

function intelligenceWeather(game){
  if(!game||!predictionIntelligenceState.useWeatherContext)return null;
  if(typeof liveCommandWeatherFor==='function')return liveCommandWeatherFor(game);
  const rows=window.ONLYBEATS_NORMALIZED_WEATHER||[];
  return rows.find(row=>String(row.gameId||'')===String(game.id||''))||null;
}

function intelligenceSelectedTeam(game,selection){
  if(!game)return null;

  const candidates=[
    [game.away, 'away'],
    [game.home, 'home']
  ];

  for(const [team,side] of candidates){
    const values=[team?.abbr,team?.name,team?.shortName]
      .map(value=>String(value||'').toLowerCase());

    if(values.includes(String(selection||'').toLowerCase())){
      return {team,side};
    }
  }

  return null;
}

function intelligenceRankingContext(game,selection){
  if(!game||!predictionIntelligenceState.useRankingContext){
    return {adjustment:0,label:'No ranking adjustment'};
  }

  const selected=intelligenceSelectedTeam(game,selection);
  if(!selected)return {adjustment:0,label:'Selection not matched to game team'};

  const opponent=selected.side==='away'?game.home:game.away;
  const selectedRank=Number(selected.team?.rank)||0;
  const opponentRank=Number(opponent?.rank)||0;

  if(!selectedRank&&!opponentRank){
    return {adjustment:0,label:'Unranked matchup'};
  }

  if(selectedRank&&opponentRank){
    const gap=opponentRank-selectedRank;
    if(gap>=10)return {adjustment:6,label:`Selected team ranked ${gap} places higher`};
    if(gap>0)return {adjustment:3,label:'Selected team ranked higher'};
    if(gap<=-10)return {adjustment:-8,label:`Selected team ranked ${Math.abs(gap)} places lower`};
    if(gap<0)return {adjustment:-4,label:'Selected team ranked lower'};
    return {adjustment:0,label:'Teams equally ranked'};
  }

  if(selectedRank&&!opponentRank){
    return {adjustment:5,label:'Selected team ranked; opponent unranked'};
  }

  if(!selectedRank&&opponentRank){
    return {adjustment:-6,label:'Selected team unranked; opponent ranked'};
  }

  return {adjustment:0,label:'No ranking adjustment'};
}

function intelligenceWeatherContext(weather){
  if(!weather||!predictionIntelligenceState.useWeatherContext){
    return {adjustment:0,label:'No weather adjustment',severity:'none'};
  }

  const wind=Number(weather.wind)||0;
  const gust=Number(weather.gust)||0;
  const precipitation=Number(weather.precipitation)||0;
  const condition=String(weather.condition||'').toLowerCase();

  if(gust>=35||wind>=25||precipitation>=0.5||condition.includes('thunder')){
    return {
      adjustment:-7,
      label:'Severe weather context',
      severity:'high'
    };
  }

  if(gust>=25||wind>=18||precipitation>=0.2||condition.includes('rain')||condition.includes('snow')){
    return {
      adjustment:-3,
      label:'Meaningful weather context',
      severity:'medium'
    };
  }

  return {
    adjustment:1,
    label:'Weather appears manageable',
    severity:'low'
  };
}

function intelligenceHistoryAdjustment(record,label){
  const minimum=Number(predictionIntelligenceState.minimumHistorySample)||3;

  if(record.sample<minimum){
    return {
      adjustment:0,
      label:`${label}: insufficient history`,
      sample:record.sample,
      rate:record.rate
    };
  }

  if(record.rate>=70)return {adjustment:8,label:`${label}: strong history`,sample:record.sample,rate:record.rate};
  if(record.rate>=60)return {adjustment:5,label:`${label}: positive history`,sample:record.sample,rate:record.rate};
  if(record.rate>=52)return {adjustment:2,label:`${label}: slightly positive`,sample:record.sample,rate:record.rate};
  if(record.rate<=35)return {adjustment:-8,label:`${label}: weak history`,sample:record.sample,rate:record.rate};
  if(record.rate<=45)return {adjustment:-5,label:`${label}: below-average history`,sample:record.sample,rate:record.rate};
  return {adjustment:0,label:`${label}: neutral history`,sample:record.sample,rate:record.rate};
}

function intelligenceGrade(score){
  if(score>=88)return {label:'Elite',stars:5};
  if(score>=78)return {label:'Strong',stars:4};
  if(score>=68)return {label:'Solid',stars:3};
  if(score>=58)return {label:'Caution',stars:2};
  return {label:'High Caution',stars:1};
}

function intelligenceWarnings(item){
  const warnings=[];

  if(item.confidence<60){
    warnings.push('Low saved confidence');
  }

  if(item.ranking.adjustment<=-4){
    warnings.push(item.ranking.label);
  }

  if(item.weather.severity==='high'){
    warnings.push('Severe weather may reduce confidence');
  }else if(item.weather.severity==='medium'){
    warnings.push('Weather may materially affect the game');
  }

  if(item.teamHistory.adjustment<=-5){
    warnings.push('Historical results with this team are weak');
  }

  if(item.conferenceHistory.adjustment<=-5){
    warnings.push('Historical results in this conference are weak');
  }

  if(!item.game){
    warnings.push('Game record could not be matched');
  }

  return warnings;
}

function scorePredictionIntelligence(prediction){
  const game=intelligenceGame(prediction);
  const selection=intelligenceSelection(prediction);
  const conference=intelligenceConference(selection);
  const confidence=intelligenceConfidence(prediction);
  const history=intelligenceHistoryFor(selection,conference);
  const weatherRecord=intelligenceWeather(game);

  const teamHistory=predictionIntelligenceState.useHistoricalTeamPerformance
    ?intelligenceHistoryAdjustment(history.team,'Team history')
    :{adjustment:0,label:'Team history disabled',sample:0,rate:0};

  const conferenceHistory=predictionIntelligenceState.useHistoricalConferencePerformance
    ?intelligenceHistoryAdjustment(history.conference,'Conference history')
    :{adjustment:0,label:'Conference history disabled',sample:0,rate:0};

  const ranking=intelligenceRankingContext(game,selection);
  const weather=intelligenceWeatherContext(weatherRecord);

  let score=confidence;
  score+=teamHistory.adjustment;
  score+=conferenceHistory.adjustment;
  score+=ranking.adjustment;
  score+=weather.adjustment;

  if(game?.state==='pre')score+=2;
  if(game?.state==='in')score-=2;
  if(game?.state==='post')score-=25;

  score=Math.max(0,Math.min(100,score));

  const grade=intelligenceGrade(score);

  const item={
    prediction,
    game,
    selection,
    conference,
    confidence,
    score,
    grade,
    weatherRecord,
    teamHistory,
    conferenceHistory,
    ranking,
    weather
  };

  item.warnings=intelligenceWarnings(item);
  return item;
}

function buildPredictionIntelligence(){
  const items=predictions
    .filter(prediction=>{
      const status=intelligenceStatus(prediction);
      if(predictionIntelligenceState.pendingOnly&&status!=='pending')return false;
      return intelligenceConfidence(prediction)>=Number(predictionIntelligenceState.minimumConfidence||55);
    })
    .map(scorePredictionIntelligence)
    .sort((a,b)=>{
      if(b.score!==a.score)return b.score-a.score;
      return b.confidence-a.confidence;
    })
    .slice(0,Math.max(1,Number(predictionIntelligenceState.maximumRows)||15));

  const warnings=items
    .filter(item=>item.warnings.length)
    .sort((a,b)=>b.warnings.length-a.warnings.length);

  const weatherImpacts=items
    .filter(item=>item.weather.severity==='high'||item.weather.severity==='medium');

  const rankingConflicts=items
    .filter(item=>item.ranking.adjustment<=-4);

  const strongestTeams=analyticsGroup(
    analyticsRows().filter(row=>['correct','incorrect','push'].includes(row.status)),
    row=>row.selection
  ).filter(group=>group.record.graded>=Number(predictionIntelligenceState.minimumHistorySample||3))
   .slice(0,8);

  const strongestConferences=analyticsGroup(
    analyticsRows().filter(row=>['correct','incorrect','push'].includes(row.status)),
    row=>analyticsConferenceForTeam(row.selection)
  ).filter(group=>group.record.graded>=Number(predictionIntelligenceState.minimumHistorySample||3))
   .slice(0,8);

  predictionIntelligenceState.lastCalculatedAt=new Date().toISOString();
  savePredictionIntelligenceState();

  return {
    items,
    warnings,
    weatherImpacts,
    rankingConflicts,
    strongestTeams,
    strongestConferences
  };
}

function intelligenceStars(count){
  return `${'★'.repeat(count)}${'☆'.repeat(Math.max(0,5-count))}`;
}

function intelligenceContextRows(item){
  const rows=[
    {
      label:'Saved confidence',
      value:`${item.confidence}%`,
      adjustment:0
    },
    {
      label:item.teamHistory.label,
      value:item.teamHistory.sample?`${item.teamHistory.rate.toFixed(1)}% · ${item.teamHistory.sample} graded`:'No sample',
      adjustment:item.teamHistory.adjustment
    },
    {
      label:item.conferenceHistory.label,
      value:item.conferenceHistory.sample?`${item.conferenceHistory.rate.toFixed(1)}% · ${item.conferenceHistory.sample} graded`:'No sample',
      adjustment:item.conferenceHistory.adjustment
    },
    {
      label:item.ranking.label,
      value:item.ranking.adjustment?`${item.ranking.adjustment>0?'+':''}${item.ranking.adjustment}`:'Neutral',
      adjustment:item.ranking.adjustment
    },
    {
      label:item.weather.label,
      value:item.weather.adjustment?`${item.weather.adjustment>0?'+':''}${item.weather.adjustment}`:'Neutral',
      adjustment:item.weather.adjustment
    }
  ];

  return rows;
}

function intelligenceCard(item,index){
  const gameText=item.game
    ?`${item.game.away.shortName} at ${item.game.home.shortName}`
    :'Game unavailable';

  return `<article class="intelligence-card">
    <div class="intelligence-card-rank">${index+1}</div>
    <div class="intelligence-card-main">
      <div class="intelligence-card-head">
        <div>
          <p class="eyebrow">${esc(item.grade.label.toUpperCase())}</p>
          <h3>${esc(item.selection)}</h3>
          <small>${esc(gameText)}</small>
        </div>
        <div class="intelligence-score">
          <strong>${item.score.toFixed(0)}</strong>
          <span>${intelligenceStars(item.grade.stars)}</span>
        </div>
      </div>

      <div class="intelligence-score-bar">
        <span style="width:${item.score}%"></span>
      </div>

      <div class="intelligence-context-list">
        ${intelligenceContextRows(item).map(row=>`
          <div>
            <span>${esc(row.label)}</span>
            <strong class="${row.adjustment>0?'positive':row.adjustment<0?'negative':''}">${esc(row.value)}</strong>
          </div>`).join('')}
      </div>

      ${item.warnings.length?`<div class="intelligence-warnings">
        ${item.warnings.map(warning=>`<span>△ ${esc(warning)}</span>`).join('')}
      </div>`:''}

      <div class="button-row">
        <button class="button" data-intelligence-game="${item.game?.id||''}" ${item.game?'':'disabled'}>Open game</button>
        <button class="button" data-intelligence-prediction="${item.prediction.id||item.prediction.gameId||''}">Open prediction</button>
      </div>
    </div>
  </article>`;
}

function intelligenceList(items,emptyTitle,emptyDetail){
  if(!items.length)return empty(emptyTitle,emptyDetail);

  return `<div class="intel-list">${items.map(item=>`
    <div class="intel-row">
      <span class="intel-icon">△</span>
      <div>
        <strong>${esc(item.selection)} · ${item.score.toFixed(0)}</strong>
        <small>${esc(item.warnings.join(' · ')||item.grade.label)}</small>
      </div>
      <span class="provider-badge">${item.grade.stars} STAR</span>
    </div>`).join('')}</div>`;
}

function intelligenceHistoryTable(groups){
  if(!groups.length){
    return empty('No qualifying history','Grade more predictions or lower the minimum sample size.');
  }

  return `<div class="analytics-table">
    <div class="analytics-table-head"><span>Category</span><span>Record</span><span>Rate</span></div>
    ${groups.map(group=>`
      <div class="analytics-table-row">
        <strong>${esc(group.label)}</strong>
        <span>${group.record.correct}-${group.record.incorrect}${group.record.pushes?`-${group.record.pushes}`:''}</span>
        <b>${group.record.rate.toFixed(1)}%</b>
      </div>`).join('')}
  </div>`;
}

function createIntelligenceCombo(){
  const model=buildPredictionIntelligence();
  const selected=model.items
    .filter(item=>item.score>=60)
    .slice(0,Math.max(1,Number(predictionIntelligenceState.suggestedComboSize)||5));

  if(!selected.length){
    toast('No eligible saved predictions meet the current intelligence filters','error');
    return;
  }

  const legs=selected.map(item=>{
    const prediction=item.prediction;
    const market=String(prediction.market||prediction.type||'winner').toLowerCase();

    let normalizedMarket='winner';
    if(market.includes('spread'))normalizedMarket='spread';
    if(market.includes('total')||market.includes('over')||market.includes('under'))normalizedMarket='total';

    return {
      id:typeof comboLegId==='function'?comboLegId():`leg-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      gameId:String(prediction.gameId||''),
      market:normalizedMarket,
      selection:item.selection,
      line:prediction.line??prediction.value??'',
      confidence:item.confidence,
      status:'pending',
      resultNote:`Prediction Intelligence score ${item.score.toFixed(0)}`
    };
  });

  predictionComboDraft={
    id:'',
    name:`Prediction Intelligence Combo ${new Date().toLocaleDateString()}`,
    notes:'Built from the highest-ranked saved predictions using transparent local rules.',
    legs,
    createdAt:null,
    updatedAt:new Date().toISOString()
  };

  predictionComboEditingId='';
  predictionComboView='builder';

  if(typeof savePredictionCombos==='function')savePredictionCombos();

  navigate('predictions');
  toast('Prediction Intelligence combo created','success');
}

function predictionIntelligencePage(){
  setHeading('Prediction Intelligence','RANKING · WARNINGS · CONTEXT');
  const model=buildPredictionIntelligence();

  return `<section class="intelligence-hero">
    <div>
      <p class="eyebrow">TRANSPARENT DECISION SUPPORT</p>
      <h1>${model.items.length} ranked prediction${model.items.length===1?'':'s'}.</h1>
      <p>OnlyBeats combines your saved confidence, historical team and conference results, rankings, weather, and game context into a documented local score.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="intelligenceBuildCombo" ${model.items.length?'':'disabled'}>Build suggested combo</button>
      <button class="button" id="intelligenceRecalculate">Recalculate</button>
      <button class="button" data-page-jump="analytics">Open Analytics</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Ranked Predictions',model.items.length,`Minimum ${predictionIntelligenceState.minimumConfidence}% confidence`)}
    ${metric('Strong or Elite',model.items.filter(item=>item.score>=78).length,'Score 78 or higher')}
    ${metric('Warnings',model.warnings.length,'Predictions needing review')}
    ${metric('Weather Impacts',model.weatherImpacts.length,'Meaningful weather context')}
    ${metric('Ranking Conflicts',model.rankingConflicts.length,'Selected team ranked lower')}
    ${metric('Last Calculation',new Date(predictionIntelligenceState.lastCalculatedAt).toLocaleTimeString(),'Local rules')}
  </div>

  <div class="reports-grid">
    ${card('Intelligence Controls',`<div class="detail-list">
      <label><span>Minimum saved confidence</span><input id="intelligenceMinimumConfidence" type="number" min="1" max="99" value="${predictionIntelligenceState.minimumConfidence}"></label>
      <label><span>Minimum history sample</span><input id="intelligenceMinimumSample" type="number" min="1" max="100" value="${predictionIntelligenceState.minimumHistorySample}"></label>
      <label><span>Maximum ranked rows</span><input id="intelligenceMaximumRows" type="number" min="1" max="50" value="${predictionIntelligenceState.maximumRows}"></label>
      <label><span>Suggested combo size</span><input id="intelligenceComboSize" type="number" min="1" max="50" value="${predictionIntelligenceState.suggestedComboSize}"></label>
      <label class="toggle-row"><span>Pending predictions only</span><input id="intelligencePendingOnly" type="checkbox" ${predictionIntelligenceState.pendingOnly?'checked':''}></label>
      <label class="toggle-row"><span>Use team history</span><input id="intelligenceTeamHistory" type="checkbox" ${predictionIntelligenceState.useHistoricalTeamPerformance?'checked':''}></label>
      <label class="toggle-row"><span>Use conference history</span><input id="intelligenceConferenceHistory" type="checkbox" ${predictionIntelligenceState.useHistoricalConferencePerformance?'checked':''}></label>
      <label class="toggle-row"><span>Use ranking context</span><input id="intelligenceRankingContext" type="checkbox" ${predictionIntelligenceState.useRankingContext?'checked':''}></label>
      <label class="toggle-row"><span>Use weather context</span><input id="intelligenceWeatherContext" type="checkbox" ${predictionIntelligenceState.useWeatherContext?'checked':''}></label>
    </div>`)}

    ${card('Review Warnings',intelligenceList(model.warnings,'No warnings','No ranked predictions currently trigger a review warning.'))}

    ${card('Ranked Saved Predictions',model.items.length
      ?`<div class="intelligence-grid">${model.items.map(intelligenceCard).join('')}</div>`
      :empty('No eligible saved predictions','Lower the minimum confidence or save pending predictions.'),'wide')}

    ${card('Strongest Historical Teams',intelligenceHistoryTable(model.strongestTeams))}
    ${card('Strongest Historical Conferences',intelligenceHistoryTable(model.strongestConferences))}

    ${card('How the Score Works',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">1</span><div><strong>Saved confidence</strong><small>Your confidence value is the starting score.</small></div></div>
      <div class="intel-row"><span class="intel-icon">2</span><div><strong>Historical performance</strong><small>Team and conference records can add or subtract points after the minimum sample is met.</small></div></div>
      <div class="intel-row"><span class="intel-icon">3</span><div><strong>Ranking context</strong><small>Ranked-matchup context provides a small transparent adjustment.</small></div></div>
      <div class="intel-row"><span class="intel-icon">4</span><div><strong>Weather context</strong><small>High wind, precipitation, or severe conditions reduce the score.</small></div></div>
      <div class="intel-row"><span class="intel-icon">5</span><div><strong>No hidden model</strong><small>Every adjustment is visible, local, and based on your saved data.</small></div></div>
    </div>`,'wide')}

    ${card('Important Boundary',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Uses your saved predictions</strong><small>No external prediction generator is used.</small></div></div>
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>No odds or wagering feeds</strong><small>The score does not use market prices or sportsbook data.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Historical patterns are not guarantees</strong><small>Small samples and changing teams can make past results unreliable.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Review every suggestion</strong><small>The suggested combo only groups predictions you already saved.</small></div></div>
    </div>`,'wide')}
  </div>`;
}

function bindPredictionIntelligence(){
  const numberSetting=(id,key,min,max,fallback)=>{
    if($(id))$(id).onchange=event=>{
      predictionIntelligenceState[key]=Math.max(min,Math.min(max,Number(event.target.value)||fallback));
      savePredictionIntelligenceState();
      renderPage();
    };
  };

  const toggleSetting=(id,key)=>{
    if($(id))$(id).onchange=event=>{
      predictionIntelligenceState[key]=event.target.checked;
      savePredictionIntelligenceState();
      renderPage();
    };
  };

  numberSetting('intelligenceMinimumConfidence','minimumConfidence',1,99,55);
  numberSetting('intelligenceMinimumSample','minimumHistorySample',1,100,3);
  numberSetting('intelligenceMaximumRows','maximumRows',1,50,15);
  numberSetting('intelligenceComboSize','suggestedComboSize',1,50,5);

  toggleSetting('intelligencePendingOnly','pendingOnly');
  toggleSetting('intelligenceTeamHistory','useHistoricalTeamPerformance');
  toggleSetting('intelligenceConferenceHistory','useHistoricalConferencePerformance');
  toggleSetting('intelligenceRankingContext','useRankingContext');
  toggleSetting('intelligenceWeatherContext','useWeatherContext');

  if($('intelligenceBuildCombo'))$('intelligenceBuildCombo').onclick=createIntelligenceCombo;

  if($('intelligenceRecalculate'))$('intelligenceRecalculate').onclick=()=>{
    renderPage();
    toast('Prediction Intelligence recalculated');
  };

  document.querySelectorAll('[data-intelligence-game]').forEach(button=>{
    button.onclick=()=>{
      if(!button.dataset.intelligenceGame)return;
      sessionStorage.setItem('onlybeats.selected-game',button.dataset.intelligenceGame);
      navigate('gamehub');
    };
  });

  document.querySelectorAll('[data-intelligence-prediction]').forEach(button=>{
    button.onclick=()=>navigate('predictions');
  });
}

function installPredictionIntelligenceStyles(){
  if(document.getElementById('onlybeatsPredictionIntelligenceStyles'))return;

  const style=document.createElement('style');
  style.id='onlybeatsPredictionIntelligenceStyles';
  style.textContent=`
    .intelligence-hero{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:30px;border:1px solid rgba(244,189,69,.26);border-radius:24px;background:radial-gradient(circle at 82% 12%,rgba(244,189,69,.12),transparent 38%),#101822;margin-bottom:18px}
    .intelligence-hero h1{font-size:clamp(2.2rem,5vw,4rem);line-height:1;margin:5px 0 12px}
    .intelligence-grid{display:grid;gap:14px}
    .intelligence-card{display:grid;grid-template-columns:54px 1fr;gap:14px;padding:17px;border:1px solid rgba(255,255,255,.1);border-radius:17px;background:rgba(255,255,255,.025)}
    .intelligence-card-rank{display:grid;place-items:center;width:44px;height:44px;border:1px solid rgba(244,189,69,.35);border-radius:13px;color:#f4bd45;font-size:1.15rem;font-weight:900}
    .intelligence-card-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
    .intelligence-card-head h3{font-size:1.45rem;margin:2px 0 5px}
    .intelligence-card-head small{color:#9aabbd}
    .intelligence-score{text-align:right}
    .intelligence-score strong{display:block;font-size:2rem}
    .intelligence-score span{color:#f4bd45;letter-spacing:.08em}
    .intelligence-score-bar{height:11px;margin:14px 0;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
    .intelligence-score-bar span{display:block;height:100%;background:#f4bd45;border-radius:99px}
    .intelligence-context-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
    .intelligence-context-list>div{padding:10px;border-radius:10px;background:rgba(255,255,255,.025)}
    .intelligence-context-list span,.intelligence-context-list strong{display:block}
    .intelligence-context-list span{font-size:.78rem;color:#9aabbd}
    .intelligence-context-list strong{margin-top:4px}
    .intelligence-context-list strong.positive{color:#72e7a3}
    .intelligence-context-list strong.negative{color:#ff8a8a}
    .intelligence-warnings{display:flex;flex-wrap:wrap;gap:7px;margin:13px 0}
    .intelligence-warnings span{padding:7px 9px;border:1px solid rgba(255,138,138,.25);border-radius:99px;color:#ff9b9b;font-size:.78rem}
    @media(max-width:760px){
      .intelligence-hero{align-items:flex-start;flex-direction:column}
      .intelligence-card{grid-template-columns:1fr}
      .intelligence-card-head{flex-direction:column}
      .intelligence-score{text-align:left}
    }
  `;
  document.head.appendChild(style);
}

function initializePredictionIntelligence(){
  loadPredictionIntelligenceState();
  installPredictionIntelligenceStyles();
}
