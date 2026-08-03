'use strict';

// Copy this file to live-data-providers.js and configure only providers you are authorized to use.
// Do not place private server secrets in a browser file.

window.ONLYBEATS_LIVE_DATA_PROVIDERS={
  scores:{
    name:'Your Scores Provider',
    configured:false,
    licensed:false,
    intervalSeconds:60,
    async fetch(context){
      // Return an array of normalized-compatible game records:
      // [{id,date,state,status,network,venue,away:{abbr,name,shortName,score,rank},home:{...}}]
      return [];
    }
  },

  rankings:{
    name:'Your Rankings Provider',
    configured:false,
    licensed:false,
    intervalSeconds:900,
    async fetch(context){
      // Return: [{rank,team,abbr,record,points,source}]
      return [];
    }
  },

  weather:{
    name:'Your Weather Provider',
    configured:false,
    licensed:false,
    intervalSeconds:600,
    async fetch(context){
      // Return: [{location,temperature,wind,gust,precipitation,condition,observedAt}]
      return [];
    }
  },

  availability:{
    name:'Your Availability Provider',
    configured:false,
    licensed:true,
    intervalSeconds:300,
    async fetch(context){
      // Return only data your agreement allows:
      // [{id,team,player,position,status,notes,source,updatedAt}]
      return [];
    }
  },

  lines:{
    name:'Your Licensed Market Provider',
    configured:false,
    licensed:true,
    intervalSeconds:300,
    async fetch(context){
      // Return only licensed data:
      // [{gameId,market,selection,value,source,observedAt}]
      return [];
    }
  }
};
