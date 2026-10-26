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
    const headerRows = $(table).find('thead tr').toArray();
    const headers = headerRows.length
      ? $(headerRows[headerRows.length - 1]).children('th,td').toArray().map(el => clean($(el).text()))
      : $(table).find('tr').first().children('th,td').toArray().map(el => clean($(el).text()));
    const nameCol = headers.findIndex(h => /^name$/i.test(h));
    const pdgaCol = headers.findIndex(h => /^pdga#?$/i.test(h));
    const playerRatingCol = headers.findIndex(h => /^rating$/i.test(h));
    const roundCols = headers.map((h, i) => /^rd\s*(\d+)$/i.test(h) ? [i, Number(h.match(/\d+/)[0])] : null).filter(Boolean);
    if (nameCol < 0 || !roundCols.length) return;
    $(table).find('tbody tr').each((_, tr) => {
      const cells = $(tr).children('td').toArray().map(td => clean($(td).text()));
      const anchor = $(tr).find('a[href*="/player/"]').first();
      const id = (anchor.attr('href') || '').match(/\/player\/(\d+)/)?.[1] || (pdgaCol >= 0 ? cells[pdgaCol] : '');
      const name = cells[nameCol]?.toLowerCase();
      const player = byPdga.get(String(id)) || byName.get(name);
      if (!player) return;
      if (playerRatingCol >= 0 && /^\d{3,4}$/.test(cells[playerRatingCol] || '')) {
        player.playerRating = cells[playerRatingCol];
      }
      const ratings = Array.isArray(player.roundRatings) ? [...player.roundRatings] : Array(10).fill('');
      for (const [col, week] of roundCols) {
        if (week < 1 || week > 10) continue;
        const score = cells[col];
        const rating = cells[col + 1];
        if (/^\d+$/.test(score || '') && /^\d{3,4}$/.test(rating || '') &&
            Number(score) === Number(player.scores?.[week - 1])) {
          ratings[week - 1] = rating;
          ratingsFound++;
        }
      }
      if (ratings.some(Boolean)) player.roundRatings = ratings;
    });
  });
  console.log(`PDGA event ratings matched: ${ratingsFound}`);
} catch (e) {
  console.warn('PDGA event ratings unavailable:', e.message);
}
let photosFound = 0;
for (const [id, player] of byPdga) {
  try {
    const $ = await html(`${base}/player/${id}`);
    const candidates = $('img').toArray().filter(el => {
      const alt = clean($(el).attr('alt')).toLowerCase();
      const src = String($(el).attr('src') || $(el).attr('data-src') || '');
      const klass = String($(el).attr('class') || '').toLowerCase();
      return (alt.includes('picture') || klass.includes('user-picture') || src.includes('/pictures/')) &&
        !/default|placeholder|anonymous|silhouette|no[-_]photo/i.test(src);
    });
    for (const el of candidates) {
      const raw = $(el).attr('src') || $(el).attr('data-src') || '';
      let url = '';
      try {
        const parsed = new URL(raw, base);
        if (parsed.protocol === 'https:') url = parsed.href;
      } catch {}
      if (!url) continue;
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
