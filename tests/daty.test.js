'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const API = require('../core/daty.js');

test('Progi własne i turystyczne', () => {
  assert.deepEqual(API.parsujProgi('10.5, 12;18/10|5 -30 abc 0'), [0,5,10,12,18]);
  assert.deepEqual(API.parsujProgi('10-12'), [10,12]);
  assert.deepEqual(API.parsujProgi([10,1.5,-1,NaN,12,10]), [10,12]);
  assert.deepEqual(API.parsujProgi('brak'), []);
  assert.deepEqual(API.PROGI_TURYSTYCZNE,[10,12,14,16,18,25,60]);
});
test('Każdy znany wiek trafia na jedną stronę każdego progu, nieustalony na żadną', () => {
  const osoby = ['1.6.2014', '2.6.2014', '', '1.1.2030'].map(tekst => ({
    urodzenie: API.ustalUrodzenie(tekst, [])
  }));
  const s = API.statystykiWiekowe(osoby,'2026-06-01','10.12');
  assert.deepEqual(s,{dataWydarzenia:'2026-06-01',razem:4,nieustalony:2,progi:[
    {prog:10,ponizej:0,coNajmniej:2},{prog:12,ponizej:1,coNajmniej:1}]});
  assert.equal(API.statystykiWiekowe(osoby,'2026-06-02',[12]).progi[0].coNajmniej,2);
  const brak = API.statystykiWiekowe(osoby,null);
  assert.equal(brak.nieustalony,4);
  assert.ok(brak.progi.every(p => p.coNajmniej === 0 && p.ponizej === 0));
});
