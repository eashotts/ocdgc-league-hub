/** OCDGC public-only exporter. Add as a separate file in the existing bound Apps Script project.
 * Do NOT put this project or a deployment token in a public repository.
 * Web app access: Anyone, Execute as: Me. Protect with EXPORT_TOKEN script property.
 */
function doGet(e) {
  const expected = PropertiesService.getScriptProperties().getProperty('EXPORT_TOKEN');
  if (!expected || !e || !e.parameter || e.parameter.token !== expected) {
    return ContentService.createTextOutput(JSON.stringify({error:'Unauthorized'})).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify(ocdgcPublicExport_())).setMimeType(ContentService.MimeType.JSON);
}
function ocdgcPublicExport_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const standings = ss.getSheetByName('PDGA Standings');
  const payouts = ss.getSheetByName('Payouts');
  if (!standings || !payouts) throw new Error('Missing required tabs');
  const rows = standings.getDataRange().getDisplayValues();
  const pr = payouts.getRange('A1:L25').getDisplayValues();
  const divisions = [];
  let current = null;
  const money = s => Number(String(s || '').replace(/[^0-9.-]/g,'')) || 0;
  for (const row of rows) {
    const first = (row[0] || '').trim();
    if (/^RA[PHDEFG]\s*\(/.test(first)) {
      current = {name:first,pot:row[4] || '$0',paidSpots:row[7] || '0',players:[]};
      divisions.push(current);
    } else if (current && /^\d+$/.test(first) && row[2] && row[2] !== 'Player') {
      // Strict allowlist: never read or export registration contact columns.
      current.players.push({place:first,points:row[1],name:row[2],pdga:row[3],rounds:row[4],qualified:row[5],payout:row[6],highest:row[7],rating:row[8],scores:row.slice(9,19)});
    }
  }
  const get = (r,c) => (pr[r-1]||[])[c-1] || '';
  const weekly = Array.from({length:10},(_,i)=>({week:`Week ${i+1}`,long:money(get(7,i+3)),short:money(get(11,i+3)),ace:money(get(3,i+3))}));
  const divisionPots = Array.from({length:6},(_,i)=>({division:get(19+i,1),amount:money(get(19+i,2))})).filter(d=>d.division);
  return {eventId:(rows[0]||[])[0].match(/EVENT\s+(\d+)/i)?.[1] || '',leagueName:'Ferry Sunday Singles II',updatedAt:new Date().toISOString(),divisions,finance:{acePot:money(get(3,1)),weeklyLayoutTotal:money(get(15,2)),longTotal:money(get(7,2)),shortTotal:money(get(11,2)),divisionTotal:divisionPots.reduce((s,d)=>s+d.amount,0),weekly,divisionPots}};
}
