'use strict';
// Uruchomienie: node --test script.test.js
// Słownik ma sztuczne liczebności. Dane nie opisują rzeczywistych uczestników.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const API = require('./script.js');
const K = 'Kobieta', M = 'Mężczyzna', W = 'Do weryfikacji';
const slownik = { meta: {}, imiona: {
  ANNA: [100000, 1], MARIA: [100000, 1], MONIKA: [10000, 0], MAGDA: [10000, 0],
  JAN: [1, 100000], PIOTR: [1, 100000], MACIEJ: [0, 10000], MARCIN: [0, 10000],
  ŁUKASZ: [0, 10000], NUR: [49, 51], KIM: [55, 45], REMIS: [50, 50],
  GRANICAK: [4999, 1], GRANICAM: [1, 4999], PONIZEJ: [4998, 1]
} };
const { klasyfikujWiersz: wiersz, klasyfikujListe: lista } = API.utworzKlasyfikator(slownik);
// Numery syntetyczne; suma wyliczana niezależnie przy użyciu wag dopełniających.
function numer(prefix) {
  const wagi = [9, 7, 3, 1, 9, 7, 3, 1, 9, 7];
  return prefix + wagi.reduce((s, w, i) => s + w * Number(prefix[i]), 0) % 10;
}
const pm = numer('0422290001'), pk = numer('0422290002');
const przypadki = [
  ['Jan Testowy', M], ['Anna Testowa', K], ['Testowy Jan', M],
  ['Jan Piotr Testowy', M], ['Anna Maria Testowa', K],
  ['Jan Maria Testowy', W], ['Testowy Jan Maria', W], ['Magda Marcin', W],
  ['Maciej Marcin', M], ['Monika Marcin', W], ['Monika Nur Marcin', W], ['Nur Marcin', W],
  ['Nur Testowy', W], ['Kim Testowa', W], ['Xyz Testowy', W], ['Xyz Marcin', M],
  ['Monkia Marcin', M], ['Marcin', M], ['Lukasz Testowy', W], ['Łukasz Testowy', M],
  ['  jAn   tESTOWY  ', M], ['Anna-Maria Testowa', K], ['"Jan", Testowy.', M],
  ['Jan;Testowy', M], ['Jan\tTestowy', M], ['Jan Jan Testowy', M],
  ['GRANICAK Testowa', K], ['GRANICAM Testowy', M], ['PONIZEJ Testowa', W],
  [pm + ' Jan Testowy', M], ['Jan ' + pm + ' Testowy', M], ['Testowy Jan ' + pm, M],
  [pk + ' Anna Testowa', K], [pk + ' Nur Testowa', K], [pm + ' Nur Testowy', M],
  [pm + ' Xyz Testowy', M], [pk, K], [pm + ' Anna Testowa', W],
  [pk + ' Anna Jan Testowa', W], [pm + ' Jan Maria Testowy', W],
  [pm.slice(0, 10) + ((Number(pm[10]) + 1) % 10) + ' Jan Testowy', W],
  [numer('0422300001') + ' Jan Testowy', W],
  [pm + ' ' + pk + ' Jan Testowy', W], [pm + ' ' + pm + ' Jan Testowy', W],
  ['123 Jan Testowy', M], ['1234567890 Jan Testowy', W], ['123456789012 Jan Testowy', W],
  ['abc123 Jan Testowy', M], [pm + ' 7 Jan Testowy', M],
  [pm.slice(0, 6) + '-' + pm.slice(6) + ' Jan Testowy', M],
  [pm.slice(0, 6) + ' ' + pm.slice(6) + ' Jan Testowy', M],
  ['"' + pm + '", Jan Testowy', M], ['１２３ Jan Testowy', M], ['---', W],
  ['1. Jan Kowalski', M], ['25. Anna Nowak', K], ['Lp. Jan Kowalski', M],
  ['lp. 1 Jan Kowalski', M], ['Jan A123 Kowalski', M], ['Jan Kowalski 25', M],
  ['Jan 1234567 Kowalski', M], ['Jan Kowalski 12345678', M], ['Jan 123456789 Kowalski', M],
  ['Jan ' + pm + pk, M], ['Jan ' + '9'.repeat(80), M],
  ['1. ' + pm + ' Jan Kowalski', M], ['25. Jan ' + pm + ' Kowalski', M],
  ['Lp. 1 Jan Kowalski ' + pm, M], ['1. Anna ' + pm, W],
  ['1. Jan ' + pm + ' 12345678', M], ['1.', W]
];
przypadki.forEach(([wejscie, kategoria], i) => test(`Klasyfikacja ${i + 1}: ${wejscie}`, () => {
  assert.equal(wiersz(wejscie).kategoriaAutomatyczna, kategoria);
}));
test('9 i 13 cyfr nie zmieniają decyzji, uzasadnienia ani ostrzeżeń', () => {
  for (const dane of ['Jan', 'Nur', pm]) {
    const wzor = wiersz(dane);
    const wynik = wiersz('123456789 ' + dane + ' 1234567890123');
    assert.equal(wynik.kategoriaAutomatyczna, wzor.kategoriaAutomatyczna);
    assert.deepEqual(wynik.ostrzezenia, wzor.ostrzezenia);
    assert.deepEqual(wynik.uzasadnienie, wzor.uzasadnienie);
    assert.deepEqual(wynik.pesel.znalezione.map(p => p.numer), dane === pm ? [pm] : []);
  }
});
test('Krótkie liczby są pomijane, a Lp i A123 przechodzą przez słownik', () => {
  const wynik = wiersz('Lp. 0000001 Jan A123 ' + pm);
  assert.deepEqual(wynik.nierozpoznaneCzlony.map(c => c.tekst), ['Lp', 'A123']);
  assert.deepEqual(wynik.pesel.znalezione.map(p => p.numer), [pm]);
  assert.equal(wynik.zrodlo, 'pesel');
});
for (const [prefix, data, poprawny] of [
  ['0081010001', '1800-01-01', true], ['0001010001', '1900-01-01', true],
  ['0022290001', '2000-02-29', true], ['0041010001', '2100-01-01', true],
  ['0061010001', '2200-01-01', true], ['0002290001', null, false],
  ['0042290001', null, false], ['0062290001', null, false],
  ['0400010001', null, false], ['0413010001', null, false],
  ['0421000001', null, false], ['0424310001', null, false], ['0493010001', null, false]
]) test(`Data PESEL ${prefix}`, () => {
  const wynik = API.sprawdzPesel(numer(prefix));
  assert.equal(wynik.poprawny, poprawny);
  assert.equal(wynik.dataUrodzenia, data);
  assert.equal(wynik.kontrolnaPoprawna, true);
});
test('Cyfra kontrolna zero i zachowane zera początkowe', () => {
  assert.equal(API.sprawdzPesel('00210100400').poprawny, true);
  assert.equal(API.sprawdzPesel('00210100400').plec, K);
});
test('Błędny PESEL nie udostępnia płci jako wyniku', () => {
  assert.equal(API.sprawdzPesel(numer('0400000001')).plec, null);
});
test('Numery przyjmujemy tylko jako tekst', () => assert.throws(() => API.sprawdzPesel(123)));
test('Liczniki uwzględniają tylko dopasowania', () => {
  assert.deepEqual(wiersz('Anna Nur Marcin Testowy').wskazania, { kobieta: 1, mezczyzna: 1, niejednoznaczne: 1 });
  assert.equal(wiersz('Jan Jan').wskazania.mezczyzna, 2);
});
test('Sugestie bez zapisywania udziałów', () => {
  const wynik = wiersz('Nur Testowy');
  assert.equal(wynik.sugestia, M);
  assert.deepEqual(Object.keys(wynik.rozpoznaneImiona[0]), ['pozycja', 'tekst', 'klucz', 'plec', 'sugestia']);
  assert.equal(wiersz('Remis Testowy').sugestia, null);
  assert.equal(wiersz('Monika Marcin').sugestia, null);
});
test('Oryginał, pozycje członów i ostrzeżenie o zerze', () => {
  const wynik = wiersz('  "Monika" Testowa  ');
  assert.equal(wynik.oryginalnyWiersz, '  "Monika" Testowa  ');
  assert.equal(wynik.oczyszczonyWiersz, 'Monika Testowa');
  assert.equal(wynik.nierozpoznaneCzlony[0].pozycja, 1);
  assert.ok(wynik.ostrzezenia.includes('ZERO_W_DANYCH'));
});
test('Puste wiersze pomijamy, numery wierszy zachowujemy', () => {
  const wyniki = lista('\r\nJan Testowy\r\n  \nAnna Testowa\rNur Testowy');
  assert.deepEqual(wyniki.map(w => w.numerWiersza), [2, 4, 5]);
  assert.equal(wiersz('  '), null);
  assert.deepEqual(lista(''), []);
  assert.throws(() => wiersz('Jan\nAnna'));
});
test('Ręczna zmiana nie niszczy automatycznej decyzji', () => {
  const a = wiersz('Jan Testowy');
  const b = API.ustawKlasyfikacjeReczna(a, K);
  assert.equal(API.pobierzKategorie(b), K);
  assert.equal(b.kategoriaAutomatyczna, M);
  assert.equal(a.klasyfikacjaReczna, null);
  assert.equal(API.pobierzKategorie(API.ustawKlasyfikacjeReczna(b, null)), M);
  assert.throws(() => API.ustawKlasyfikacjeReczna(a, 'inna'));
  assert.deepEqual(API.podsumuj([b, wiersz('Nur')]), { kobieta: 1, mezczyzna: 0, doWeryfikacji: 1, razem: 2 });
});
test('Brak automatycznej korekty i osobny wpis LUKASZ', () => {
  const inny = API.utworzKlasyfikator({ imiona: { LUKASZ: [10000, 0], ŁUKASZ: [0, 10000] } });
  assert.equal(inny.klasyfikujWiersz('Lukasz').kategoriaAutomatyczna, K);
  assert.equal(inny.klasyfikujWiersz('Łukasz').kategoriaAutomatyczna, M);
});
test('Błędne słowniki są odrzucane', () => {
  for (const imiona of [{}, { JAN: [0, 0] }, { JAN: [-1, 100] }, { JAN: ['1', 100] },
    { JAN: [1.5, 100] }, { JAN: [1] }, { JAN: [1, 100], jan: [1, 100] }]) {
    assert.throws(() => API.utworzKlasyfikator({ imiona }));
  }
  assert.throws(() => API.utworzKlasyfikator({}));
});
test('Kopia słownika nie zmienia się po zmianie danych wejściowych', () => {
  const dane = { imiona: { JAN: [0, 10000] } };
  const k = API.utworzKlasyfikator(dane);
  dane.imiona.JAN[0] = 1000000;
  assert.equal(k.klasyfikujWiersz('Jan').kategoriaAutomatyczna, M);
});
test('Tryb przeglądarkowy działa bez Node, DOM i sieci', () => {
  const kontekst = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('./script.js'), 'utf8'), kontekst);
  assert.equal(kontekst.KlasyfikatorUczestnikow.utworzKlasyfikator(slownik).klasyfikujWiersz('Jan').kategoriaAutomatyczna, M);
});
