'use strict';
(function(){
  const V='12.2.1';
  let api=null,app=null,auth=null,db=null,unsub=null;
  const cfg=()=>window.ONLYBEATS_FIREBASE_CONFIG||{};
  const configured=()=>Boolean(cfg().apiKey&&cfg().authDomain&&cfg().projectId&&cfg().appId);
  async function init(){
    if(!configured())throw new Error('Firebase configuration is incomplete.');
    if(api)return api;
    const [a,u,f]=await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
    ]);
    api={...a,...u,...f};
    app=api.getApps().length?api.getApp():api.initializeApp(cfg());
    auth=api.getAuth(app);db=api.getFirestore(app);
    return api;
  }
  const ref=(uid)=>api.doc(db,'users',uid,'onlybeats','snapshot');
  window.ONLYBEATS_CLOUD_ADAPTER={
    name:'Firebase Auth + Firestore',
    get configured(){return configured()},
    async connect({credentials={}}={}){
      await init();
      const email=String(credentials.email||'').trim(),password=String(credentials.password||'');
      if(!email||!password)throw new Error('Enter an email and password.');
      const result=credentials.mode==='create'
        ?await api.createUserWithEmailAndPassword(auth,email,password)
        :await api.signInWithEmailAndPassword(auth,email,password);
      return{uid:result.user.uid,email:result.user.email||''};
    },
    async disconnect(){await init();if(unsub){unsub();unsub=null}await api.signOut(auth)},
    async resetPassword(email){await init();if(!email)throw new Error('Enter your email first.');await api.sendPasswordResetEmail(auth,email)},
    async push({snapshot}={}){await init();if(!auth.currentUser)throw new Error('Sign in before syncing.');await api.setDoc(ref(auth.currentUser.uid),{ownerUid:auth.currentUser.uid,...snapshot,updatedAt:api.serverTimestamp()})},
    async pull(){await init();if(!auth.currentUser)throw new Error('Sign in before syncing.');const snap=await api.getDoc(ref(auth.currentUser.uid));return snap.exists()?snap.data():{schemaVersion:2,records:{}}},
    onAuthStateChanged(observer){init().then(()=>api.onAuthStateChanged(auth,user=>observer(user?{uid:user.uid,email:user.email||''}:null))).catch(()=>observer(null))}
  };
})();
