'use strict';

// OnlyBeats Firebase configuration.
//
// The packaged values are used on first launch. The Electron preload bridge
// stores a persistent copy in the user's application-data folder so future
// installed updates cannot blank an already configured Firebase connection.

const packagedFirebaseConfig={
  apiKey:"AIzaSyBwDiMDht0RYW6hQ77EIVzP1hc3uFkBGdY",
  authDomain:"onlybeats-31bf4.firebaseapp.com",
  projectId:"onlybeats-31bf4",
  storageBucket:"onlybeats-31bf4.firebasestorage.app",
  messagingSenderId:"1069957890022",
  appId:"1:1069957890022:web:d297cffbd955455ce5a027"
};

const persistentFirebaseConfig=window.onlyBeatsDesktop?.firebaseConfig||{};

window.ONLYBEATS_FIREBASE_CONFIG={
  ...packagedFirebaseConfig,
  ...Object.fromEntries(
    Object.entries(persistentFirebaseConfig)
      .filter(([,value])=>typeof value==='string'&&value.trim())
  )
};

if(
  window.onlyBeatsDesktop?.saveFirebaseConfig &&
  window.ONLYBEATS_FIREBASE_CONFIG.apiKey &&
  window.ONLYBEATS_FIREBASE_CONFIG.projectId
){
  window.onlyBeatsDesktop.saveFirebaseConfig(window.ONLYBEATS_FIREBASE_CONFIG).catch(()=>{});
}
