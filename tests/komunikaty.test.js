'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatuj } = require('../core/komunikaty.js');

test('Szablon zdrobnienia pokazuje źródło decyzji, liczebności i brak samodzielnego wpisu', () => {
  const opis = formatuj('MOZLIWE_ZDROBNIENIE', {
    tekst: 'Piotrek',
    wykorzystaneDoKlasyfikacji: true,
    statystyki: null,
    odpowiedniki: [{ klucz: 'PIOTR', statystyki: { kobiety: 3, mezczyzni: 682516 } }]
  });

  assert.equal(opis,
    'Płeć ustalono na podstawie zdrobnienia „Piotrek”. Sprawdź zgodność imienia z dokumentem tożsamości. ' +
    'Możliwe pełne odpowiedniki i statystyki imion: PIOTR - 682519 osób (kobiety: 3, mężczyźni: 682516). ' +
    'Jako samodzielne imię: brak wpisu w słowniku imion (nie oznacza zera).');
});

test('Szablon powodu weryfikacji łączy uzasadnienia w kolejności wejściowej', () => {
  assert.equal(formatuj('WERYFIKACJA_PLCI', ['Pierwszy powód.', 'Drugi powód.']), 'Pierwszy powód. Drugi powód.');
});

test('Kontekst pary opisuje wybraną rolę bez twierdzenia o wyłącznej obecności w słowniku', () => {
  const imie = formatuj('ROLA_Z_KONTEKSTU_PARY', 'Pawełek', 'Witek', 'imie');
  assert.match(imie, /„Witek” rozpoznano jako nazwisko/);
  assert.match(imie, /„Pawełek” potraktowano jako prawdopodobne imię/);
  assert.doesNotMatch(imie, /wyłącznie/);
  const nazwisko = formatuj('ROLA_Z_KONTEKSTU_PARY', 'Marek', 'Anna', 'nazwisko');
  assert.match(nazwisko, /„Anna” rozpoznano jako imię/);
  assert.match(nazwisko, /„Marek” potraktowano jako prawdopodobne nazwisko/);
});

test('Komunikat 50× podaje właściwy próg i zachowuje starszą treść dla 10×', () => {
  assert.match(formatuj('ROLA_IMIENIA_ZE_STATYSTYK_50', 'Jan'), /50-krotnej przewagi liczebności imienia/);
  assert.match(formatuj('ROLA_IMIENIA_ZE_STATYSTYK', 'Jan'), /10-krotnej przewagi liczebności imienia/);
});

test('Uwaga o zdrobnieniu z pary nazwisk łączy uzasadnienie i statystyki w jednym opisie', () => {
  const opis = formatuj('MOZLIWE_ZDROBNIENIE', {
    tekst: 'Witek',
    kontekst: 'para_nazwisk',
    wykorzystaneDoKlasyfikacji: true,
    statystyki: {kobiety:0, mezczyzni:47},
    odpowiedniki: [{klucz:'WITOLD', statystyki:{kobiety:0, mezczyzni:54261}}]
  });
  assert.match(opis, /Płeć ustalono na podstawie zdrobnienia „Witek”/);
  assert.match(opis, /Spośród dwóch członów rozpoznanych jako nazwiska tylko ten występuje w słowniku zdrobnień/);
  assert.match(opis, /WITOLD - 54261 osób/);
  assert.match(opis, /Jako samodzielne imię: 47 osób/);
});
