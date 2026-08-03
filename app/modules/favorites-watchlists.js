'use strict';

// OnlyBeats v4.4 Favorites & Watchlists.

let favoritesWatchlistsState={
  favoriteTeams:[],
  favoriteConferences:[],
  watchedGames:[],
  rivalryWatch:[],
  rankedWatch:true,
  autoPinFavorites:true,
  lastUpdatedAt:null
};

function loadFavoritesWatchlistsState(){
  try{
    const saved=JSON.parse(localStorage.getItem(FAVORITES_WATCHLISTS_KEY)||'{}');
    favoritesWatchlistsState={...favoritesWatchlistsState,...saved};
  }catch{}

  if(Array.isArray(favorites)){
    favorites.forEach(team=>{
      if(!favoritesWatchlistsState.favoriteTeams.includes(team)){
        favoritesWatchlistsState.favoriteTeams.push(team);
      }
    });
  }
}

function saveFavoritesWatchlistsState(){
  favoritesWatchlistsState.lastUpdatedAt=new Date().toISOString();
  localStorage.setItem(FAVORITES_WATCHLISTS_KEY,JSON.stringify(favoritesWatchlistsState));

  if(Array.isArray(favorites)){
    favorites.splice(0,favorites.length,...favoritesWatchlistsState.favoriteTeams);
    if(typeof saveFavorites==='function')saveFavorites();
  }
}

function allKnownTeams(){
  const map=new Map();

  games.forEach(game=>{
    [game.away,game.home].forEach(team=>{
      if(!team)return;
      const key=String(team.abbr||team.name||team.shortName||'').toUpperCase();
      if(!key)return;
      map.set(key,{
        abbr:String(team.abbr||key),
        name:String(team.name||team.shortName||key),
        shortName:String(team.shortName||team.name||key),
        rank:Number(team.rank)||0,
        conference:String(team.conference||intelligenceConference?.(team.abbr)||'Unknown')
      });
    });
  });

  if(typeof TEAM_DATABASE!=='undefined'&&Array.isArray(TEAM_DATABASE)){
    TEAM_DATABASE.forEach(team=>{
      const key=String(team.abbr||team.name||team.school||'').toUpperCase();
      if(!key)return;
      map.set(key,{
        abbr:String(team.abbr||key),
        name:String(team.name||team.school||key),
        shortName:String(team.shortName||team.school||team.name||key),
        rank:Number(team.rank)||0,
        conference:String(team.conference||team.conf||'Unknown')
      });
    });
  }

  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}

function allKnownConferences(){
  return [...new Set(
    allKnownTeams()
      .map(team=>team.conference)
      .filter(value=>value&&value!=='Unknown')
  )].sort();
}

function watchedGames(){
  return games.filter(game=>favoritesWatchlistsState.watchedGames.includes(String(game.id)));
}

function favoriteTeamGames(){
  return games.filter(game=>{
    const values=[game.away?.abbr,game.home?.abbr,game.away?.name,game.home?.name].map(String);
    return values.some(value=>favoritesWatchlistsState.favoriteTeams.includes(value));
  });
}

function favoritesWatchlistsPage(){
  setHeading('Favorites & Watchlists','TEAMS · CONFERENCES · GAMES');
  const teams=allKnownTeams();
  const conferences=allKnownConferences();
  const favoriteGames=favoriteTeamGames();
  const watched=watchedGames();

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">PERSONALIZED COLLEGE FOOTBALL</p>
      <h2>${favoritesWatchlistsState.favoriteTeams.length} favorite team${favoritesWatchlistsState.favoriteTeams.length===1?'':'s'}.</h2>
      <p>Pin the teams, conferences, and games you want surfaced across Saturday Dashboard, Command Center, Team Profiles, and Conference Dashboards.</p>
    </div>
    <div class="button-row">
      <button class="button primary" data-page-jump="saturday">Open Saturday Dashboard</button>
      <button class="button" data-page-jump="teamprofiles">Team Profiles</button>
      <button class="button" data-page-jump="conferences">Conference Dashboards</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Favorite Teams',favoritesWatchlistsState.favoriteTeams.length,'Pinned across the app')}
    ${metric('Favorite Conferences',favoritesWatchlistsState.favoriteConferences.length,'Conference filters')}
    ${metric('Watched Games',watched.length,'Pinned matchups')}
    ${metric('Favorite-Team Games',favoriteGames.length,'Current loaded slate')}
    ${metric('Ranked Watch',favoritesWatchlistsState.rankedWatch?'Enabled':'Disabled','Ranked matchups')}
    ${metric('Last Updated',favoritesWatchlistsState.lastUpdatedAt?new Date(favoritesWatchlistsState.lastUpdatedAt).toLocaleString():'Never','Local settings')}
  </div>

  <div class="reports-grid">
    ${card('Favorite Teams',`<div class="watchlist-grid">${teams.map(team=>`
      <label class="watchlist-tile">
        <input type="checkbox" data-favorite-team="${esc(team.abbr)}" ${favoritesWatchlistsState.favoriteTeams.includes(team.abbr)?'checked':''}>
        <span><strong>${team.rank?`#${team.rank} `:''}${esc(team.shortName)}</strong><small>${esc(team.abbr)} · ${esc(team.conference)}</small></span>
      </label>`).join('')}</div>`,'wide')}

    ${card('Favorite Conferences',`<div class="watchlist-grid">${conferences.map(conference=>`
      <label class="watchlist-tile">
        <input type="checkbox" data-favorite-conference="${esc(conference)}" ${favoritesWatchlistsState.favoriteConferences.includes(conference)?'checked':''}>
        <span><strong>${esc(conference)}</strong><small>Conference dashboard</small></span>
      </label>`).join('')}</div>`)}

    ${card('Watchlist Preferences',`<div class="detail-list">
      <label class="toggle-row"><span>Automatically pin favorite-team games</span><input id="watchlistAutoPin" type="checkbox" ${favoritesWatchlistsState.autoPinFavorites?'checked':''}></label>
      <label class="toggle-row"><span>Watch all ranked matchups</span><input id="watchlistRanked" type="checkbox" ${favoritesWatchlistsState.rankedWatch?'checked':''}></label>
      <div><span>Rivalry tracker</span><strong>${favoritesWatchlistsState.rivalryWatch.length} saved</strong></div>
    </div>`)}

    ${card('Watched Games',watched.length?`<div class="intel-list">${watched.map(game=>`
      <div class="intel-row">
        <span class="intel-icon">★</span>
        <div><strong>${esc(game.away.shortName)} at ${esc(game.home.shortName)}</strong><small>${new Date(game.date).toLocaleString()} · ${esc(game.status||'Scheduled')}</small></div>
        <button class="button" data-unwatch-game="${game.id}">Remove</button>
      </div>`).join('')}</div>`:empty('No watched games','Open a game or Saturday Dashboard to add matchups.'))}

    ${card('Favorite-Team Games',favoriteGames.length?`<div class="intel-list">${favoriteGames.slice(0,20).map(game=>`
      <div class="intel-row">
        <span class="intel-icon">★</span>
        <div><strong>${esc(game.away.shortName)} at ${esc(game.home.shortName)}</strong><small>${new Date(game.date).toLocaleString()} · ${esc(game.network||'Network unavailable')}</small></div>
        <button class="button" data-watch-game="${game.id}">${favoritesWatchlistsState.watchedGames.includes(String(game.id))?'Watching':'Watch'}</button>
      </div>`).join('')}</div>`:empty('No favorite-team games','Favorite teams with loaded games will appear here.'),'wide')}
  </div>`;
}

function bindFavoritesWatchlists(){
  document.querySelectorAll('[data-favorite-team]').forEach(input=>{
    input.onchange=()=>{
      const team=input.dataset.favoriteTeam;
      if(input.checked){
        if(!favoritesWatchlistsState.favoriteTeams.includes(team))favoritesWatchlistsState.favoriteTeams.push(team);
      }else{
        favoritesWatchlistsState.favoriteTeams=favoritesWatchlistsState.favoriteTeams.filter(item=>item!==team);
      }
      saveFavoritesWatchlistsState();
      renderPage();
    };
  });

  document.querySelectorAll('[data-favorite-conference]').forEach(input=>{
    input.onchange=()=>{
      const conference=input.dataset.favoriteConference;
      if(input.checked){
        if(!favoritesWatchlistsState.favoriteConferences.includes(conference))favoritesWatchlistsState.favoriteConferences.push(conference);
      }else{
        favoritesWatchlistsState.favoriteConferences=favoritesWatchlistsState.favoriteConferences.filter(item=>item!==conference);
      }
      saveFavoritesWatchlistsState();
      renderPage();
    };
  });

  document.querySelectorAll('[data-watch-game]').forEach(button=>{
    button.onclick=()=>{
      const gameId=String(button.dataset.watchGame);
      if(!favoritesWatchlistsState.watchedGames.includes(gameId)){
        favoritesWatchlistsState.watchedGames.push(gameId);
      }
      saveFavoritesWatchlistsState();
      renderPage();
    };
  });

  document.querySelectorAll('[data-unwatch-game]').forEach(button=>{
    button.onclick=()=>{
      const gameId=String(button.dataset.unwatchGame);
      favoritesWatchlistsState.watchedGames=favoritesWatchlistsState.watchedGames.filter(item=>item!==gameId);
      saveFavoritesWatchlistsState();
      renderPage();
    };
  });

  if($('watchlistAutoPin'))$('watchlistAutoPin').onchange=event=>{
    favoritesWatchlistsState.autoPinFavorites=event.target.checked;
    saveFavoritesWatchlistsState();
  };

  if($('watchlistRanked'))$('watchlistRanked').onchange=event=>{
    favoritesWatchlistsState.rankedWatch=event.target.checked;
    saveFavoritesWatchlistsState();
  };
}

function installFavoritesWatchlistsStyles(){
  if(document.getElementById('onlybeatsFavoritesWatchlistsStyles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsFavoritesWatchlistsStyles';
  style.textContent=`
    .watchlist-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
    .watchlist-tile{display:flex;gap:10px;align-items:center;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}
    .watchlist-tile span,.watchlist-tile small{display:block}.watchlist-tile small{color:#9aabbd;margin-top:3px}
  `;
  document.head.appendChild(style);
}

function initializeFavoritesWatchlists(){
  loadFavoritesWatchlistsState();
  installFavoritesWatchlistsStyles();
}
