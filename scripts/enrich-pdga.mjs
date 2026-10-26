import fs from 'node:fs';
import * as cheerio from 'cheerio';

const file = 'public/data/league.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const eventId = String(data.eventId || '107753');
const base = 'https://www.pdga.com';
const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; OCDGCLeagueHub/1.0)', Accept: 'text/html' };
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const digits = s => /^\d+$/.test(clean(s));
const safeUrl = url => {
  try {
    const u = new URL(url, base);
    return u.protocol === 'https:' && /(^|\.)pdga\.com$/.test(u.hostname) ? u.href : '';
  } catch { return ''; }
};
async function html(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(18000) });
  if (!response.ok) throw new Error(`PDGA HTTP ${response.status} for ${url}`);
  return cheerio.load(await response.text());
}
const players = (data.divisions || []).flatMap(d => d.players || []);
const byPdga = new Map(players.filter(p => digits(p.pdga) && Number(p.pdga) > 0).map(p => [clean(p.pdga), p]));
const byName = new Map(players.map(p => [clean(p.name).toLowerCase(), p]));
let ratingsFound = 0;
try {
  const $ = await html(`${base}/tour/event/${encodeURIComponent(eventId)}`);
  $('table').each((_, table) => {
    const head = clean($(table).find('thead').text()).toLowerCase();
    if (!head.includes('rd1') && !head.includes('rd 1')) return;
    $(table).find('tbody tr').each((_, tr) => {
      const cells = $(tr).children('td').toArray().map(td => clean($(td).text()));
      const row = $(tr);
      const link = row.find('a[href*="/player/"]').first();
      const id = (link.attr('href') || '').match(/\/player\/(\d+)/)?.[1];
      const player = (id && byPdga.get(id)) || byName.get(clean(link.text()).toLowerCase()) ||
        byName.get(cells.find(c => byName.has(c.toLowerCase()))?.toLowerCase());
      if (!player) return;
      // The results table stores each round as consecutive score/rating columns.
      // Anchor the pairs after the player's name and PDGA number, skipping
      // place, points and current player rating columns.
      const nameIndex = cells.findIndex(c => c.toLowerCase() === clean(player.name).toLowerCase());
      if (nameIndex < 0) return;
      let start = nameIndex + 1;
      if (digits(player.pdga) && clean(cells[start]) === clean(player.pdga)) start++;
      // A player's current PDGA rating follows the PDGA number when present.
      if (start < cells.length && (digits(cells[start]) || cells[start] === '') && cells.length - start >= 3) start++;
      // Some event tables have a Par column before the round pairs.
      if (/^[+-]\d+$|^E$/.test(cells[start] || '')) start++;
      const ratings = Array(10).fill('');
      for (let week = 0; week < 10; week++) {
        const score = cells[start + week * 2];
        const rating = cells[start + week * 2 + 1];
        if (digits(score) && digits(rating) &&
            Number(score) === Number(player.scores?.[week])) {
          ratings[week] = rating;
          ratingsFound++;
        }
      }
      if (ratings.some(Boolean)) player.roundRatings = ratings;
    });
  });
  console.log(`PDGA event ratings matched: ${ratingsFound}`);
} catch (e) {
  console.warn('PDGA event ratings unavailable; leaving ratings pending:', e.message);
}
let photosFound = 0;
for (const [id, player] of byPdga) {
  try {
    const $ = await html(`${base}/player/${id}`);
    const candidates = $('img').toArray().filter(el => {
      const alt = clean($(el).attr('alt')).toLowerCase();
      return alt.includes('picture') && (alt.includes(clean(player.name).toLowerCase()) || alt.includes(id));
    });
    for (const el of candidates) {
      const url = safeUrl($(el).attr('src') || $(el).attr('data-src') || '');
      if (!url || /default|placeholder|anonymous|silhouette|no[-_]photo/i.test(url)) continue;
      player.photoUrl = url;
      photosFound++;
      break;
    }
  } catch (e) {
    console.warn(`PDGA profile ${id} unavailable: ${e.message}`);
  }
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`PDGA profile photos matched: ${photosFound}`);
