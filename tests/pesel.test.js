'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sprawdzPesel } = require('../core/pesel.js');

// Numery syntetyczne; suma wyliczana niezależnie przy użyciu wag dopełniających.
function numer(prefix) {
  const wagi = [9, 7, 3, 1, 9, 7, 3, 1, 9, 7];
  return prefix + wagi.reduce((s, w, i) => s + w * Number(prefix[i]), 0) % 10;
}

for (const [prefix, data, poprawny] of [
  ['0081010001', '1800-01-01', true], ['0001010001', '1900-01-01', true],
  ['0022290001', '2000-02-29', true], ['0041010001', '2100-01-01', true],
  ['0061010001', '2200-01-01', true], ['0002290001', null, false],
  ['0042290001', null, false], ['0062290001', null, false],
  ['0400010001', null, false], ['0413010001', null, false],
  ['0421000001', null, false], ['0424310001', null, false], ['0493010001', null, false]
]) test(`Data PESEL ${prefix}`, () => {
  const wynik = sprawdzPesel(numer(prefix));
  assert.equal(wynik.poprawny, poprawny);
  assert.equal(wynik.dataUrodzenia, data);
  assert.equal(wynik.kontrolnaPoprawna, true);
});
test('Cyfra kontrolna zero i zachowane zera początkowe', () => {
  assert.equal(sprawdzPesel('00210100400').poprawny, true);
  assert.equal(sprawdzPesel('00210100400').plec, 'Kobieta');
});
test('Błędny PESEL nie udostępnia płci jako wyniku', () => {
  assert.equal(sprawdzPesel(numer('0400000001')).plec, null);
});
test('Numery przyjmujemy tylko jako tekst', () => assert.throws(() => sprawdzPesel(123)));
