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

const cases=[
  ['1.0.0',true,'Production'],
  ['1.2.1',true,'Production'],
  ['2.0.0',true,'Production'],
  ['1.3.0-rc.1',false,'Release Candidate'],
  ['2.0.0-beta',false,'Beta'],
  ['2.0.0-dev',false,'Development'],
  ['invalid',false,'Invalid']
];

for(const [version,stable,channel] of cases){
  const parsed=parseOnlyBeatsVersion(version);
  if(parsed.stable!==stable||parsed.channel!==channel){
    throw new Error(`${version} expected ${stable}/${channel} got ${parsed.stable}/${parsed.channel}`);
  }
}

console.log('semantic version tests passed');
