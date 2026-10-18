/**
 * 배드민턴 랠리 클럽 — Google Apps Script (Code.gs) v1.0
 * 설치: 새 Google 스프레드시트 → 확장 프로그램 → Apps Script → 이 코드 붙여넣기 → 저장
 *       → 배포 → 새 배포 → 유형 "웹 앱" / 실행 계정 "나" / 액세스 "모든 사용자" → 배포 → URL 복사
 *       → 앱 ⚙️ 설정 → 웹 앱 URL 붙여넣기 → 설정 저장
 * ※ 탁구 앱 시트와 열 구성이 다르므로 별도 스프레드시트 사용 권장
 */
const SHEET_NAME = 'badminton';
const API_TOKEN = '';            // 사용 시 임의 문자열 입력 → 앱 설정의 API 토큰과 동일하게
const VERSION = '1.0';
const FIELDS = ['id','date','start','minutes','plan_min','target','achieved','attempts','best','total_hits','rallies','mood','memo','updated_at'];

function doGet(e) { return handle_((e && e.parameter) || {}); }
function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'JSON 파싱 실패' }); }
  return handle_(body);
}
function handle_(p) {
  if (API_TOKEN && p.token !== API_TOKEN) return out_({ ok: false, error: 'API 토큰 불일치' });
  try {
    switch (p.action) {
      case 'ping':  { const sh = sheet_(); return out_({ ok: true, version: VERSION, sheet: sh.getName(), count: Math.max(0, sh.getLastRow() - 1) }); }
      case 'state': return out_({ ok: true, rev: rev_() });
      case 'list':  return out_({ ok: true, data: list_(), rev: rev_() });
      case 'batch': return out_(batch_(p.ops || []));
      default:      return out_({ ok: false, error: '알 수 없는 action: ' + p.action });
    }
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, FIELDS.length).setValues([FIELDS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), FIELDS.length).setNumberFormat('@');   // 날짜·시각 자동 변환 방지 (텍스트 저장)
  }
  return sh;
}
function list_() {
  const sh = sheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  return sh.getRange(2, 1, n, head.length).getDisplayValues().filter(r => r[0]).map(r => { const o = {}; head.forEach((h, i) => o[h] = r[i]); return o; });
}
function batch_(ops) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = sheet_(), n = Math.max(0, sh.getLastRow() - 1);
    const ids = n ? sh.getRange(2, 1, n, 1).getDisplayValues().map(r => String(r[0])) : [];
    const idx = new Map(ids.map((id, i) => [id, i + 2]));
    const del = [], skipped = []; let changed = 0;
    ops.forEach(o => {
      if (o.op === 'delete') { const row = idx.get(String(o.id)); if (row) { del.push(row); idx.delete(String(o.id)); changed++; } return; }
      if (o.op === 'upsert' && o.record && o.record.id) {
        const vals = [FIELDS.map(f => o.record[f] == null ? '' : String(o.record[f]))];
        let row = idx.get(String(o.record.id));
        if (!row) { row = sh.getLastRow() + 1; idx.set(String(o.record.id), row); }
        sh.getRange(row, 1, 1, FIELDS.length).setNumberFormat('@').setValues(vals); changed++;
        return;
      }
      skipped.push({ op: o.op, error: '형식 오류' });
    });
    del.sort((a, b) => b - a).forEach(r => sh.deleteRow(r));
    if (changed) PropertiesService.getScriptProperties().setProperty('REV', String(Date.now()));
    return { ok: true, rev: rev_(), skipped };
  } finally { lock.releaseLock(); }
}
function rev_() { return PropertiesService.getScriptProperties().getProperty('REV') || '0'; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
