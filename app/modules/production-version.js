'use strict';

// OnlyBeats stable semantic-version detection.
// Stable production versions contain exactly three numeric parts and no prerelease suffix.

function parseOnlyBeatsVersion(value){
  const text=String(value||'').trim();
  const match=text.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);

  if(!match){
    return {
      valid:false,
      stable:false,
      major:0,
      minor:0,
      patch:0,
      prerelease:'',
      channel:'Invalid'
    };
  }

  const prerelease=match[4]||'';
  let channel='Production';

  if(prerelease){
    const lower=prerelease.toLowerCase();
    if(lower.includes('rc'))channel='Release Candidate';
    else if(lower.includes('beta'))channel='Beta';
    else if(lower.includes('alpha'))channel='Alpha';
    else if(lower.includes('dev'))channel='Development';
    else channel='Pre-release';
  }

  return {
    valid:true,
    stable:prerelease==='',
    major:Number(match[1]),
    minor:Number(match[2]),
    patch:Number(match[3]),
    prerelease,
    channel
  };
}

function isOnlyBeatsProductionVersion(value=VERSION){
  return parseOnlyBeatsVersion(value).stable;
}

function onlyBeatsVersionChannel(value=VERSION){
  return parseOnlyBeatsVersion(value).channel;
}
