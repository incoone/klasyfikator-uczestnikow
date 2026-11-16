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
  ['Maciej Marcin', M], ['Monika Marcin', W], ['Monika Nur Marcin', W], ['Nur Marcin', M],
  ['Nur Testowy', W], ['Kim Testowa', W], ['Xyz Testowy', W], ['Xyz Marcin', M],
  ['Monkia Marcin', M], ['Marcin', M], ['Lukasz Testowy', W], ['Łukasz Testowy', M],
  ['  jAn   tESTOWY  ', M], ['Anna-Maria Testowa', K], ['"Jan", Testowy.', M],
  ['Jan;Testowy', M], ['Jan\tTestowy', M], ['Jan Jan Testowy', M],
  ['GRANICAK Testowa', K], ['GRANICAM Testowy', M], ['PONIZEJ Testowa', K],
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
test('Sugestia dla imienia poniżej progu', () => {
  const wynik = wiersz('Nur Testowy');
  assert.equal(wynik.sugestia, M);
  assert.equal(wynik.rozpoznaneImiona[0].statystyki.progOsiagniety, false);
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

// Wersja 1.1: testy przechodzą przez publiczne API używane przez interfejs.
for (const tekst of ['2005-06-05', '05-06-2005', '5.6.2005', '5/6/2005', '2005/6/5', '2005.6.5']) {
  test('Rozpoznanie daty: ' + tekst, () => {
    for (const wpis of [tekst + ' Jan Testowy', 'Jan (' + tekst + ') Testowy', 'Jan Testowy ' + tekst]) {
      const wynik = wiersz(wpis);
      assert.equal(wynik.oryginalnyWiersz, wpis);
      assert.equal(wynik.kategoriaAutomatyczna, M);
      assert.deepEqual(wynik.urodzenie, { data: '2005-06-05', zrodlo: 'wiersz',
        wpisane: [{ tekst, data: '2005-06-05' }], uwagi: [] });
    }
  });
}
const kody = uwagi => uwagi.map(u => u.kod);
test('Błędne daty, rok czterocyfrowy i brak daty', () => {
  for (const tekst of ['31.04.2005','00.12.2005','29.02.1900','2005-13-01','2005.6/5','0000-01-01']) {
    assert.deepEqual(kody(wiersz(tekst).urodzenie.uwagi), ['BLEDNA_DATA']);
  }
  for (const tekst of ['Jan','Jan 5.6.05','ABC2005-06-05XYZ','123456789']) {
    assert.deepEqual(wiersz(tekst).urodzenie, { data: null, zrodlo: null, wpisane: [], uwagi: [] });
  }
  assert.equal(wiersz('29.02.2000').urodzenie.data, '2000-02-29');
});
test('Zgodne daty, konflikt z PESEL i różne wpisane daty', () => {
  const zgodne = wiersz(pm + ' Jan 2004/2/29 29.02.2004');
  assert.equal(zgodne.urodzenie.zrodlo, 'wiersz_i_pesel');
  assert.equal(zgodne.urodzenie.wpisane.length, 2);
  for (const [wpis,kod] of [[pm+' Jan 28.02.2004','KONFLIKT_DATY_PESEL'],
    [pm+' Jan 28.02.2004 29.02.2004','ROZNE_DATY']]) {
    const wynik = wiersz(wpis);
    assert.equal(wynik.kategoriaAutomatyczna, M);
    assert.deepEqual(API.obliczWiek(wynik,'2020-03-01').wiek,null);
    assert.ok(kody(wynik.urodzenie.uwagi).includes(kod));
  }
});
test('Poprawne źródło zastępcze i diagnostyka uczestnika', () => {
  const wynik = wiersz('Jan 31.02.2004 '+pm);
  const ocena = API.obliczWiek(wynik,'2022-03-01');
  assert.equal(ocena.wiek, 18);
  assert.equal(wynik.urodzenie.zrodlo,'pesel');
  assert.deepEqual(kody(ocena.uwagi), ['BLEDNA_DATA']);
  const zlyNumer = pm.slice(0,10) + (Number(pm[10])+1)%10;
  const drugi = wiersz(zlyNumer+' 5/6/2005');
  assert.equal(drugi.kategoriaAutomatyczna, W);
  assert.equal(drugi.urodzenie.zrodlo,'wiersz');
  assert.equal(API.obliczWiek(drugi,'2023-06-05').wiek,18);
  assert.deepEqual(kody(drugi.urodzenie.uwagi), ['BLEDNY_PESEL']);
  assert.deepEqual(kody(wiersz('31.02.2005 '+zlyNumer).urodzenie.uwagi), ['BLEDNA_DATA','BLEDNY_PESEL']);
  assert.equal(wiersz(pm+' '+pk).urodzenie.data,null);
});
test('Wiek przed urodzinami, w urodziny i przy zmianie daty wyjazdu', () => {
  const wynik = API.ustawKlasyfikacjeReczna(wiersz('Nur 2008-02-29'),K);
  for (const [dzien,wiek] of [[null,null],['2008-02-28',null],['2008-02-29',0],
    ['2024-02-28',15],['2024-02-29',16],['2026-02-28',17],['2026-03-01',18]]) {
    const ocena = API.obliczWiek(wynik,dzien);
    assert.equal(ocena.wiek,wiek);
    assert.deepEqual(kody(ocena.uwagi),dzien === '2008-02-28' ? ['URODZENIE_PO_WYDARZENIU'] : []);
  }
  assert.equal(API.pobierzKategorie(wynik),K);
  assert.throws(()=>API.obliczWiek(wynik,'2026-02-29'),RangeError);
});
test('Progi własne i turystyczne', () => {
  assert.deepEqual(API.parsujProgi('10.5, 12;18/10|5 -30 abc 0'), [0,5,10,12,18]);
  assert.deepEqual(API.parsujProgi('10-12'), [10,12]);
  assert.deepEqual(API.parsujProgi([10,1.5,-1,NaN,12,10]), [10,12]);
  assert.deepEqual(API.parsujProgi('brak'), []);
  assert.deepEqual(API.PROGI_TURYSTYCZNE,[10,12,14,16,18,25,60]);
});
test('Każdy znany wiek trafia na jedną stronę każdego progu, nieustalony na żadną', () => {
  const osoby = lista('Nur 1.6.2014\nJan 2.6.2014\nAnna\nJan 1.1.2030');
  const s = API.statystykiWiekowe(osoby,'2026-06-01','10.12');
  assert.deepEqual(s,{dataWydarzenia:'2026-06-01',razem:4,nieustalony:2,progi:[
    {prog:10,ponizej:0,coNajmniej:2},{prog:12,ponizej:1,coNajmniej:1}]});
  assert.equal(API.statystykiWiekowe(osoby,'2026-06-02',[12]).progi[0].coNajmniej,2);
  const brak = API.statystykiWiekowe(osoby,null);
  assert.equal(brak.nieustalony,4);
  assert.ok(brak.progi.every(p => p.coNajmniej === 0 && p.ponizej === 0));
});
const probka = API.utworzKlasyfikator({imiona:{
  ...slownik.imiona, PATRYK:[17,999983], BARAN:[331,9669], EWA:[7800,2200]
}});
for (const [tekst, oczekiwany, kod] of [
  ['Patryk 18/11/2008 Baran',M,'ZGODNE_SLABE_IMIE'], ['Baran Patryk',M,'ZGODNE_SLABE_IMIE'],
  ['Anna Ewa',K,'ZGODNE_SLABE_IMIE'], ['Patryk Kim',W], ['Anna Nur',W],
  ['Jan Jan Jan Kim',W], ['Jan Remis',W], ['Nur Baran',W], ['Jan Anna',W],
  [pm+' Patryk Kim',M,'PESEL_PRZECIWNE_IMIE'], [pm+' Jan Remis',M,'PESEL_REMIS'],
  [pm+' Nur Baran',M,'PESEL_ZGODNE_SLABE_IMIE'], [pm+' Jan Anna',W]
]) test('Kierunki i komunikaty: '+tekst, () => {
  const osoba = probka.klasyfikujWiersz(tekst);
  const komunikaty = API.pobierzKomunikaty(osoba);
  assert.equal(osoba.kategoriaAutomatyczna,oczekiwany);
  assert.equal(komunikaty.doWeryfikacji.length > 0, oczekiwany === W);
  if (kod) assert.ok(kody(komunikaty.informacyjne).includes(kod));
});
test('Statystyki każdego dopasowania i dokładny próg', () => {
  const osoba = probka.klasyfikujWiersz('Patryk 18/11/2008 Baran');
  const [a,b] = osoba.rozpoznaneImiona;
  assert.equal(a.statystyki.procentMezczyzn.toFixed(4),'99.9983');
  assert.equal(b.statystyki.kobiety,331);
  assert.equal(b.statystyki.mezczyzni,9669);
  assert.equal(b.statystyki.procentKobiet.toFixed(2),'3.31');
  assert.equal(b.statystyki.procentMezczyzn.toFixed(2),'96.69');
  assert.equal(b.statystyki.progOsiagniety,false);
  assert.deepEqual(osoba.wskazania,{kobieta:0,mezczyzna:1,niejednoznaczne:1});
  assert.equal(osoba.urodzenie.data,'2008-11-18');
  const granica = wiersz('PONIZEJ').rozpoznaneImiona[0].statystyki;
  assert.equal(granica.procentKobiet.toFixed(2),'99.98');
  assert.equal(granica.progOsiagniety,true);
  assert.equal(granica.uwagaProgowa,true);
});
test('Weryfikacja płci i uwaga wieku mogą dotyczyć tej samej osoby', () => {
  const osoba = wiersz('Jan 1234567890 2000-01-15');
  const wynik = API.pobierzKomunikaty(osoba,'2025-01-15');
  assert.deepEqual(wynik.doWeryfikacji.map(m=>m.obszar),['plec']);
  assert.deepEqual(kody(wynik.informacyjne),['BLEDNY_PESEL']);
  assert.equal(API.obliczWiek(osoba,'2025-01-15').wiek,25);
  assert.equal(API.pobierzKomunikaty(API.ustawKlasyfikacjeReczna(osoba,M)).doWeryfikacji.length,0);
});
test('Poprawny PESEL rozstrzyga wiek mimo błędnej wpisanej daty', () => {
  const osoba = wiersz('Jan 31.02.2004 '+pm);
  const wynik = API.pobierzKomunikaty(osoba,'2026-03-01');
  assert.deepEqual(kody(wynik.informacyjne),['BLEDNA_DATA']);
  assert.match(wynik.informacyjne[0].opis,/z poprawnego PESEL/);
  assert.deepEqual(wynik.doWeryfikacji,[]);
  assert.deepEqual(kody(API.pobierzKomunikaty(osoba,'2000-01-01').doWeryfikacji),['URODZENIE_PO_WYDARZENIU']);
});
test('Brak daty jest dozwolony, konflikt dat wymaga decyzji także po korekcie płci', () => {
  assert.deepEqual(API.pobierzKomunikaty(wiersz('Jan')), {doWeryfikacji:[],informacyjne:[]});
  const osoba = API.ustawKlasyfikacjeReczna(wiersz(pm+' Anna 2000-01-01'),K);
  assert.deepEqual(kody(API.pobierzKomunikaty(osoba).doWeryfikacji),['KONFLIKT_DATY_PESEL']);
});

for (const [dominujace, jednoznaczne, uwaga] of [
  [998999, false, false], [999000, true, true], [999001, true, true],
  [999494, true, true], [999799, true, true], [999800, true, false], [999801, true, false]
]) test('Dokładne progi dla obu płci: ' + dominujace + '/1000000', () => {
  for (const plec of [M, K]) {
    const liczby = [1000000 - dominujace, dominujace];
    if (plec === K) liczby.reverse();
    const osoba = API.utworzKlasyfikator({ imiona: { ARTEM: liczby } }).klasyfikujWiersz('Artem');
    assert.equal(osoba.kategoriaAutomatyczna, jednoznaczne ? plec : W);
    const stat = osoba.rozpoznaneImiona[0].statystyki;
    assert.equal(stat.progOsiagniety, jednoznaczne);
    assert.equal(stat.uwagaProgowa, uwaga);
    const komunikaty = API.pobierzKomunikaty(osoba);
    assert.deepEqual(komunikaty.informacyjne.map(m => [m.kod, m.severity]),
      uwaga ? [['IMIE_W_PRZEDZIALE_PROGOWYM', 'low']] : []);
    assert.equal(komunikaty.doWeryfikacji.length, jednoznaczne ? 0 : 1);
  }
});
test('Nowe jednoznaczne imię uczestniczy w konfliktach z PESEL i słabszym imieniem', () => {
  const k = API.utworzKlasyfikator({ imiona: {...slownik.imiona, ARTEM: [506,999494]} });
  for (const tekst of ['Artem '+pk, 'Artem Kim', 'Artem Remis']) {
    const osoba = k.klasyfikujWiersz(tekst);
    assert.equal(osoba.kategoriaAutomatyczna,W);
    const komunikaty = API.pobierzKomunikaty(osoba);
    assert.equal(komunikaty.doWeryfikacji[0].severity,'high');
    assert.equal(komunikaty.informacyjne[0].severity,'low');
  }
  const zgodne = k.klasyfikujWiersz('Artem Artem '+pm);
  assert.equal(zgodne.kategoriaAutomatyczna,M);
  assert.equal(API.pobierzKomunikaty(zgodne).informacyjne.length,1);
});
test('Ważność komunikatu i konieczność weryfikacji są niezależne', () => {
  for (const [tekst, poziomy] of [
    ['Nur Marcin', ['low']], [pm+' Jan Nur', ['low']], [pm+' Nur', ['medium']],
    [pm+' Remis', ['medium']], [pm+' Kim', ['medium']], [pm, ['medium']],
    [pm+' Jan 31.02.2004', ['high']]
  ]) {
    const osoba = wiersz(tekst);
    const komunikaty = API.pobierzKomunikaty(osoba,'2026-11-16');
    assert.deepEqual(komunikaty.informacyjne.map(m => m.severity),poziomy);
    assert.equal(komunikaty.doWeryfikacji.length,0);
    assert.equal(API.podsumuj([osoba]).doWeryfikacji,0);
  }
  const oba = API.pobierzKomunikaty(wiersz('Jan 1234567890 18/11/2008'));
  assert.deepEqual(oba.informacyjne.map(m => [m.kod,m.severity]),[['BLEDNY_PESEL','high']]);
  assert.deepEqual(oba.doWeryfikacji.map(m => m.severity),['high']);
});
