import fs from 'node:fs';
const raw=fs.readFileSync('public/data/league.json','utf8');
const data=JSON.parse(raw);
if (!Array.isArray(data.divisions)) {
  throw new Error("Invalid league data: divisions must be an array");
}

if (data.divisions.length === 0) {
  console.log("No standings yet — deploying starter website.");
} else if (
  data.divisions.length !== 6 ||
  !data.divisions.some(d => d.players?.length)
) {
  throw new Error("Standings incomplete; refusing to publish");
}if(!data.eventId||!data.finance||!data.updatedAt)throw Error('Missing export metadata');
const banned=/phone|paypal|email|contact|timestamp/i;
function check(x){if(Array.isArray(x)){x.forEach(check);return;}if(x&&typeof x==='object')for(const [k,v] of Object.entries(x)){if(banned.test(k))throw Error(`Private field detected: ${k}`);check(v)}}
check(data);
console.log('Public data export validated');
