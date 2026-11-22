'use strict';
// Uruchomienie z katalogu głównego: node --test tests/klasyfikator.test.js
// Słownik ma sztuczne liczebności. Dane nie opisują rzeczywistych uczestników.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const API = require('../core/klasyfikator.js');
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
function zaladujApiPrzegladarki() {
  const kontekst = vm.createContext({});
  for (const plik of ['komunikaty.js', 'daty.js', 'pesel.js', 'klasyfikator.js']) {
    vm.runInContext(fs.readFileSync(require.resolve('../core/' + plik), 'utf8'), kontekst, { filename: plik });
  }
  return kontekst.KlasyfikatorUczestnikow;
}

test('Tryb przeglądarkowy działa bez Node, DOM i sieci', () => {
  assert.equal(zaladujApiPrzegladarki().utworzKlasyfikator(slownik).klasyfikujWiersz('Jan').kategoriaAutomatyczna, M);
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
  if (kod) assert.deepEqual(kody(komunikaty.informacyjne), kod === 'PESEL_PRZECIWNE_IMIE' ? [kod] : []);
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
  assert.deepEqual(wynik.informacyjne,[]);
  assert.equal(wynik.doWeryfikacji[0].powiazane[0].kod,'BLEDNY_PESEL');
  assert.equal(wynik.doWeryfikacji[0].powiazane[0].wymagaWeryfikacji,false);
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
    assert.deepEqual(komunikaty.informacyjne,[]);
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
    assert.deepEqual(komunikaty.informacyjne,[]);
  }
  const zgodne = k.klasyfikujWiersz('Artem Artem '+pm);
  assert.equal(zgodne.kategoriaAutomatyczna,M);
  assert.equal(API.pobierzKomunikaty(zgodne).informacyjne.length,0);
});
test('Ważność komunikatu i konieczność weryfikacji są niezależne', () => {
  for (const [tekst, poziomy] of [
    ['Nur Marcin', []], [pm+' Jan Nur', []], [pm+' Nur', []],
    [pm+' Remis', []], [pm+' Kim', ['medium']], [pm, []],
    [pm+' Jan 31.02.2004', ['medium']]
  ]) {
    const osoba = wiersz(tekst);
    const komunikaty = API.pobierzKomunikaty(osoba,'2026-11-16');
    assert.deepEqual(komunikaty.informacyjne.map(m => m.severity),poziomy);
    assert.equal(komunikaty.doWeryfikacji.length,0);
    assert.equal(API.podsumuj([osoba]).doWeryfikacji,0);
  }
  const oba = API.pobierzKomunikaty(wiersz('Jan 1234567890 18/11/2008'));
  assert.deepEqual(oba.informacyjne,[]);
  assert.deepEqual(oba.doWeryfikacji[0].powiazane.map(m => [m.kod,m.severity]),[['BLEDNY_PESEL','high']]);
  assert.deepEqual(oba.doWeryfikacji.map(m => m.severity),['high']);
});

// 1.2: przykładowe kombinacje nie opisują rzeczywistych osób.
// Liczebności poniżej są fragmentami dostarczonych słowników PESEL.
const imiona12 = { imiona: { ...slownik.imiona,
  ANNA: [1063756,12], PIOTR: [3,682516], KLIMEK: [0,48], GALA: [43,0],
  KASIA: [211,0], KATARZYNA: [100000,0], SASHA: [122,103], WITEK: [0,47],
  WITOLD: [0,54261], MIREK: [0,56], MIROSŁAW: [0,10000]
} };
const nazwiska12 = { nazwiska: {
  KLIMEK: [10002,9741], GALA: [1283,1250], KASIA: [32,32], WITEK: [7369,7391],
  KOWALSKA: [67308,3], KOWALSKI: [535,66589], NOWAK: [99738,98387],
  MIREK: [2416,2435], PIOTR: [207,215]
} };
const zdrobnienia12 = { zdrobnienia: {
  KASIA: ['KATARZYNA'], WITEK: ['WITOLD'], MIREK: ['MIROSŁAW'],
  SASHA: ['ALEKSANDER','ALEKSANDRA'], OLEŃKA: ['ALEKSANDRA'],
  // Brak pełnego odpowiednika w tym wycinku nie może zostać przedstawiony jako zero.
  ALEX: ['ALEKSANDER','NIEOBECNE']
} };
const klasyfikator12 = API.utworzKlasyfikator(imiona12,nazwiska12,zdrobnienia12);
const w12 = tekst => klasyfikator12.klasyfikujWiersz(tekst);
const info12 = osoba => API.pobierzKomunikaty(osoba).informacyjne;
for (const [tekst, plec, zrodlo] of [
  ['Anna Klimek',K,'imiona'], ['Piotr Gala',M,'imiona'], ['Kasia Kowalska',K,'imiona'],
  ['Sasha Kowalska',K,'imiona_i_nazwisko'], ['Witek Kowalski',M,'zdrobnienia'],
  ['Sasha Nowak',W,null], ['Anna Witek Kowalski',W,null], ['Anna Mirek',K,'imiona'],
  ['Witek',M,'imiona'], ['Klimek Witek',M,'zdrobnienia'], ['Kowalska',W,null],
  ['Xyz Kowalska',W,null], ['Oleńka Kowalska',W,null], ['Remis Kowalska',W,null],
  ['Sasha Nur Kowalska',W,null], ['Nur Kowalska',W,null]
]) test('1.2 role i kolejność: '+tekst, () => {
  for (const wejscie of [tekst,tekst.split(' ').reverse().join(' ')]) {
    const osoba = w12(wejscie);
    assert.equal(osoba.kategoriaAutomatyczna,plec);
    assert.equal(osoba.zrodlo,zrodlo);
    assert.equal(osoba.oryginalnyWiersz,wejscie);
  }
});
test('Pomijane imię pozostaje w szczegółach, ale nie w licznikach ani uwagach o imieniu', () => {
  const osoba = w12('Anna Klimek');
  assert.deepEqual(osoba.wskazania,{kobieta:1,mezczyzna:0,niejednoznaczne:0});
  const klimek = osoba.rozpoznaneImiona.find(i => i.klucz === 'KLIMEK');
  assert.equal(klimek.uwzglednione,false);
  assert.equal(klimek.statystyki.mezczyzni,48);
  assert.equal(osoba.czlonyTekstowe[1].podstawaRoli,'PRZEWAGA_NAZWISKA');
  assert.deepEqual(info12(osoba),[]);
  assert.deepEqual(API.pobierzKomunikaty(osoba).doWeryfikacji,[]);
});
for (const [liczba,oczekiwana] of [[30,'medium'],[49,'medium'],[50,'low'],[99,'low'],[100,null]]) {
  test('Rzadkość - granica '+liczba, () => {
    const osoba = API.utworzKlasyfikator({imiona:{RZADKIE:[0,liczba]}}).klasyfikujWiersz('Rzadkie');
    assert.equal(osoba.kategoriaAutomatyczna,M);
    const uwagi = info12(osoba).filter(u => u.kod === 'RZADKIE_IMIE');
    assert.equal(uwagi.length,oczekiwana ? 1 : 0);
    if (oczekiwana) assert.equal(uwagi[0].severity,oczekiwana);
    assert.equal(API.podsumuj([osoba]).doWeryfikacji,0);
  });
}
for (const [ileImion,ileNazwisk,usun] of [[30,1499,false],[30,1500,true],[30,1501,true],[1,99,false],[2,100,true]]) {
  test('Przewaga nazwiska i minimum: '+ileImion+'/'+ileNazwisk, () => {
    const k = API.utworzKlasyfikator({imiona:{ANNA:[10000,0],KOLIZJA:[0,ileImion]}},
      {nazwiska:{KOLIZJA:[ileNazwisk,0]}});
    const osoba = k.klasyfikujWiersz('Anna Kolizja');
    assert.equal(osoba.rozpoznaneImiona[1].uwzglednione,!usun);
    assert.equal(osoba.kategoriaAutomatyczna,usun ? K : W);
  });
}
for (const [kobiety,mezczyzni,silne] of [[998999,1001,false],[999000,1000,true],
  [999001,999,true],[999800,200,true],[99,0,false],[100,0,true]]) {
  test('Próg nazwiska: '+kobiety+'/'+mezczyzni, () => {
    for (const odwroc of [false,true]) {
      const k = API.utworzKlasyfikator({imiona:{SLABE:odwroc?[40,60]:[60,40]}},
        {nazwiska:{TESTOWE:odwroc?[mezczyzni,kobiety]:[kobiety,mezczyzni]}});
      const osoba = k.klasyfikujWiersz('Slabe Testowe');
      assert.equal(osoba.kategoriaAutomatyczna,silne?(odwroc?M:K):W);
      assert.equal(osoba.rozpoznaneNazwiska[0].statystyki.silneWskazanie,silne);
    }
  });
}
test('Słownik nazwisk nie używa końcówek ani nie łączy statystyk', () => {
  const k = API.utworzKlasyfikator({imiona:{SLABE:[60,40]}},
    {nazwiska:{PIERWSZE:[990,10],DRUGIE:[990,10],SILNE:[10000,0]}});
  assert.equal(k.klasyfikujWiersz('Slabe Pierwsze Drugie').kategoriaAutomatyczna,W);
  assert.equal(k.klasyfikujWiersz('Slabe Nieznana').kategoriaAutomatyczna,W);
  // To samo słabe imię wielokrotnie nie przekroczy progu.
  assert.equal(k.klasyfikujWiersz('Slabe Slabe').kategoriaAutomatyczna,W);
});
test('Sprzeczne silne nazwiska blokują wspomaganie, nie jednoznaczne imię ani PESEL', () => {
  const k = API.utworzKlasyfikator(imiona12,{nazwiska:{ŻEŃSKIE:[10000,0],MĘSKIE:[0,10000]}});
  assert.equal(k.klasyfikujWiersz('Sasha Żeńskie Męskie').kategoriaAutomatyczna,W);
  for (const [tekst,plec] of [['Anna Męskie',K],[pm+' Żeńskie',M]]) {
    const osoba = k.klasyfikujWiersz(tekst);
    assert.equal(osoba.kategoriaAutomatyczna,plec);
    assert.ok(info12(osoba).some(u=>u.kod==='NAZWISKO_PRZECIWNE_WYNIKOWI' && u.severity==='high'));
    assert.equal(API.pobierzKomunikaty(osoba).doWeryfikacji.length,0);
  }
});
test('PESEL nie zmienia przypisania ról; rzeczywisty konflikt imienia nadal blokuje', () => {
  const bez = w12('Anna Klimek');
  for (const p of [pk,pm]) {
    const osoba = w12('Anna Klimek '+p);
    assert.deepEqual(osoba.czlonyTekstowe,bez.czlonyTekstowe);
    assert.equal(osoba.kategoriaAutomatyczna,p===pk?K:W);
  }
  for (const tekst of [pm+' Sasha Kowalska','Sasha '+pm+' Kowalska','Sasha Kowalska '+pm]) {
    const osoba = w12(tekst);
    assert.equal(osoba.kategoriaAutomatyczna,M);
    assert.equal(osoba.zrodlo,'pesel');
    assert.ok(kody(info12(osoba)).includes('PESEL_PRZECIWNE_IMIE'));
    assert.ok(kody(info12(osoba)).includes('NAZWISKO_PRZECIWNE_WYNIKOWI'));
  }
  const witek = w12(pk+' Witek Kowalski');
  assert.equal(witek.kategoriaAutomatyczna,K);
  assert.equal(witek.zrodlo,'pesel');
  assert.ok(!witek.ostrzezenia.includes('KONFLIKT_PESEL_IMIONA'));
  assert.equal(w12(pm+' Remis Kowalska').kategoriaAutomatyczna,M);
});
test('Rola z kontekstu i pozostałe uwagi pozostają informacyjne', () => {
  const witek = w12('Witek Kowalski');
  const komunikatyWitka = API.pobierzKomunikaty(witek);
  assert.deepEqual(komunikatyWitka.informacyjne.map(u => [u.kod, u.severity]), [
    ['MOZLIWE_ZDROBNIENIE','high']
  ]);
  assert.equal(komunikatyWitka.doWeryfikacji.length,0);
  assert.equal(API.podsumuj([witek]).doWeryfikacji,0);
  assert.equal(witek.czlonyTekstowe[0].rola,'nazwisko');

  const kasia = w12('Kasia Kowalska');
  const komunikatyKasi = API.pobierzKomunikaty(kasia);
  assert.deepEqual(komunikatyKasi.informacyjne.map(u => [u.kod,u.severity]),[['ROLA_IMIENIA_Z_KONTEKSTU','low']]);
  assert.equal(kasia.rozpoznaneZdrobnienia[0].odpowiedniki[0].klucz,'KATARZYNA');
  assert.equal(komunikatyKasi.doWeryfikacji.length,0);
  assert.equal(API.podsumuj([kasia]).doWeryfikacji,0);
  assert.equal(kasia.czlonyTekstowe[0].rola,'imie');
});
test('Zdrobnienia pobierają liczby dynamicznie, nie dziedziczą płci, brak wpisu nie oznacza zera', () => {
  const osoba = w12('Witek Kowalski');
  const z = osoba.rozpoznaneZdrobnienia[0];
  assert.equal(z.statystyki.mezczyzni,47);
  assert.equal(z.odpowiedniki[0].statystyki.mezczyzni,54261);
  assert.match(info12(osoba).find(u=>u.kod==='MOZLIWE_ZDROBNIENIE').opis,/54261/);
  const alex = w12('Alex Kowalska');
  assert.equal(alex.kategoriaAutomatyczna,W);
  assert.equal(alex.rozpoznaneZdrobnienia[0].statystyki,null);
  assert.ok(alex.rozpoznaneZdrobnienia[0].odpowiedniki.every(p=>p.statystyki===null));
  assert.ok(!info12(alex).some(u=>u.kod==='MOZLIWE_ZDROBNIENIE'));
  const zmieniony = API.utworzKlasyfikator({imiona:{WITEK:[0,47],WITOLD:[0,777]}},null,zdrobnienia12);
  assert.equal(zmieniony.klasyfikujWiersz('Witek').rozpoznaneZdrobnienia[0].odpowiedniki[0].statystyki.mezczyzni,777);
});
test('Zdrobnienie jako nazwisko nie otrzymuje polecenia rozwinięcia imienia', () => {
  const osoba = w12('Anna Witek');
  assert.equal(osoba.kategoriaAutomatyczna,K);
  assert.equal(osoba.rozpoznaneZdrobnienia[0].rola,'nazwisko');
  assert.equal(osoba.rozpoznaneZdrobnienia[0].wykorzystaneDoKlasyfikacji,false);
  assert.ok(!info12(osoba).some(u=>u.kod==='MOZLIWE_ZDROBNIENIE'));
  assert.ok(!kody(info12(osoba)).includes('RZADKIE_IMIE'));
});
test('Powtórzone dopasowania zachowują pozycje i nie powielają komunikatów', () => {
  const osoba = w12('Witek Witek Kowalski');
  assert.equal(osoba.wskazania.mezczyzna,2);
  assert.deepEqual(osoba.rozpoznaneZdrobnienia.map(z=>z.pozycja),[0,1]);
  assert.ok(!info12(osoba).some(u=>u.kod==='MOZLIWE_ZDROBNIENIE'));
  for (const kod of ['RZADKIE_IMIE','NIEROZSTRZYGNIETA_ROLA']) {
    const znalezione = info12(osoba).filter(u=>u.kod===kod);
    assert.equal(znalezione.length,1);
    assert.deepEqual(znalezione[0].pozycje,[0,1]);
  }
});
test('Nowe słowniki nie zmieniają dat, numerów ani ręcznych decyzji', () => {
  const tekst = '1. Kasia 18/11/2008 Kowalska 123456789';
  const osoba = w12(tekst);
  assert.equal(osoba.oryginalnyWiersz,tekst);
  assert.equal(osoba.urodzenie.data,'2008-11-18');
  assert.equal(API.obliczWiek(osoba,'2026-11-17').wiek,17);
  assert.equal(API.obliczWiek(osoba,'2026-11-18').wiek,18);
  assert.equal(osoba.pesel.znalezione.length,0);
  const reczna = API.ustawKlasyfikacjeReczna(osoba,M);
  assert.equal(API.pobierzKategorie(reczna),M);
  assert.equal(reczna.kategoriaAutomatyczna,K);
  assert.deepEqual(info12(reczna),info12(osoba));
  assert.equal(w12('Kasia Kowalska 1234567890').kategoriaAutomatyczna,W);
  assert.equal(w12('Kasia Kowalska '+pk+' '+pk).kategoriaAutomatyczna,W);
});
test('Opcjonalne słowniki, walidacja i odporność na zmianę wejścia', () => {
  assert.equal(API.utworzKlasyfikator(imiona12).klasyfikujWiersz('Anna Klimek').kategoriaAutomatyczna,W);
  assert.equal(API.utworzKlasyfikator(imiona12,{nazwiska:{}}).klasyfikujWiersz('Anna').kategoriaAutomatyczna,K);
  for (const json of [{},{nazwiska:[]},{nazwiska:{A:[0,0]}},{nazwiska:{A:[1,-1]}},
    {nazwiska:{A:[1,1],a:[1,1]}},{nazwiska:{A:[Number.MAX_SAFE_INTEGER,1]}}]) {
    assert.throws(()=>API.utworzKlasyfikator(imiona12,json),TypeError);
  }
  for (const json of [{},{zdrobnienia:[]},{zdrobnienia:{A:[]}},{zdrobnienia:{A:[null]}},
    {zdrobnienia:{A:['A'],a:['B']}}]) {
    assert.throws(()=>API.utworzKlasyfikator(imiona12,null,json),TypeError);
  }
  const n={nazwiska:{TESTOWE:[100,0]}}, z={zdrobnienia:{SASHA:['ANNA']}};
  const k=API.utworzKlasyfikator(imiona12,n,z);
  n.nazwiska.TESTOWE[0]=0; z.zdrobnienia.SASHA[0]='JAN';
  const osoba=k.klasyfikujWiersz('Sasha Testowe');
  assert.equal(osoba.kategoriaAutomatyczna,K);
  assert.equal(osoba.rozpoznaneZdrobnienia[0].odpowiedniki[0].klucz,'ANNA');
  assert.doesNotThrow(()=>JSON.stringify(osoba));
});
test('Przeglądarka z trzema słownikami działa bez DOM, sieci i zapisu', () => {
  const k = zaladujApiPrzegladarki().utworzKlasyfikator(imiona12, nazwiska12, zdrobnienia12);
  assert.equal(k.klasyfikujWiersz('Sasha Kowalska').zrodlo,'imiona_i_nazwisko');
});

// Aktualizacja 1.2: rola imienia nie jest oceną jednoznaczności płci.
function probaRoli(ileImion, ileNazwisk) {
  return API.utworzKlasyfikator({imiona:{KOLIZJA:[0,ileImion], ANNA:[10000,0]}},
    {nazwiska:{KOLIZJA:[ileNazwisk,0], OSOBNE:[50,50]}});
}
for (const [i,n,rola,podstawa] of [
  [2999,100,'nierozstrzygnieta',null], [3000,100,'imie','PRZEWAGA_IMIENIA_30'],
  [3001,100,'imie','PRZEWAGA_IMIENIA_30'], [99,1,'nierozstrzygnieta',null],
  [100,1,'imie','PRZEWAGA_IMIENIA_30']
]) test(`Rola 30x bez kontekstu: ${i}/${n}`,()=>{
  const o=probaRoli(i,n).klasyfikujWiersz('Kolizja');
  assert.equal(o.czlonyTekstowe[0].rola,rola);
  assert.equal(o.czlonyTekstowe[0].podstawaRoli,podstawa);
  assert.equal(info12(o).some(u=>u.kod==='NIEROZSTRZYGNIETA_ROLA'),rola==='nierozstrzygnieta');
  assert.equal(o.kategoriaAutomatyczna,M);
});
for (const [i,n,podstawa,kod] of [
  [999,100,null,'NIEROZSTRZYGNIETA_ROLA'],
  [1000,100,'PRZEWAGA_IMIENIA_10_Z_NAZWISKIEM','ROLA_IMIENIA_ZE_STATYSTYK'],
  [1001,100,'PRZEWAGA_IMIENIA_10_Z_NAZWISKIEM','ROLA_IMIENIA_ZE_STATYSTYK'],
  [2999,100,'PRZEWAGA_IMIENIA_10_Z_NAZWISKIEM','ROLA_IMIENIA_ZE_STATYSTYK'],
  [3000,100,'PRZEWAGA_IMIENIA_30',null],
  [99,5,null,'NIEROZSTRZYGNIETA_ROLA'],
  [100,5,'PRZEWAGA_IMIENIA_10_Z_NAZWISKIEM','ROLA_IMIENIA_ZE_STATYSTYK']
]) test(`Rola 10x w dłuższym wierszu: ${i}/${n}`,()=>{
  for(const tekst of ['Kolizja Osobne Xyz','Xyz Osobne Kolizja']){
    const o=probaRoli(i,n).klasyfikujWiersz(tekst);
    assert.equal(o.czlonyTekstowe.find(c=>c.klucz==='KOLIZJA').podstawaRoli,podstawa);
    const role=info12(o).filter(u=>u.obszar==='dane');
    assert.deepEqual(role.map(u=>u.kod),kod?[kod]:[]);
    if(kod==='ROLA_IMIENIA_ZE_STATYSTYK') assert.equal(role[0].severity,'low');
  }
});
for(const [i,n,podstawa,uwaga] of [
  [999,100,'KONTEKST_DWOCH_CZLONOW',true],
  [1000,100,'PRZEWAGA_IMIENIA_10_DWA_CZLONY',false],
  [1001,100,'PRZEWAGA_IMIENIA_10_DWA_CZLONY',false],
  [99,1,'KONTEKST_DWOCH_CZLONOW',true],
  [100,10,'PRZEWAGA_IMIENIA_10_DWA_CZLONY',false],
  [47,14760,'KONTEKST_DWOCH_CZLONOW',true],
  [3000,100,'PRZEWAGA_IMIENIA_30',false]
]) test(`Dwa człony: ${i}/${n}`,()=>{
  for(const tekst of ['Kolizja Osobne','Osobne Kolizja']){
    const o=probaRoli(i,n).klasyfikujWiersz(tekst);
    const c=o.czlonyTekstowe.find(c=>c.klucz==='KOLIZJA');
    assert.equal(c.rola,'imie'); assert.equal(c.podstawaRoli,podstawa);
    const role=info12(o).filter(u=>u.obszar==='dane');
    assert.deepEqual(role.map(u=>[u.kod,u.severity]),uwaga?[['ROLA_IMIENIA_Z_KONTEKSTU','low']]:[]);
    assert.equal(API.pobierzKomunikaty(o).doWeryfikacji.length,0);
  }
});
test('Przewaga 10x bez osobnego nazwiska nie rozstrzyga roli',()=>{
  const k=probaRoli(1000,100);
  for(const tekst of ['Kolizja','Kolizja Xyz','Anna Kolizja']){
    const o=k.klasyfikujWiersz(tekst);
    assert.equal(o.czlonyTekstowe.find(c=>c.klucz==='KOLIZJA').rola,'nierozstrzygnieta');
  }
});
test('Dwa człony wymagają dokładnie jednego dopasowania wyłącznie do nazwisk',()=>{
  const k=API.utworzKlasyfikator({imiona:{ALEX:[60,40],MORGAN:[55,45]}},
    {nazwiska:{ALEX:[500,500],MORGAN:[500,500]}});
  const o=k.klasyfikujWiersz('Alex Morgan');
  assert.ok(o.czlonyTekstowe.every(c=>c.rola==='nierozstrzygnieta'));
  assert.equal(o.kategoriaAutomatyczna,W);
});
test('Rola imienia nie usuwa niejednoznaczności lub remisu płci',()=>{
  for(const liczby of [[6000,4000],[5000,5000]]){
    const k=API.utworzKlasyfikator({imiona:{ALEX:liczby}}, {nazwiska:{ALEX:[50,50],NOWAK:[50,50]}});
    const o=k.klasyfikujWiersz('Alex Nowak');
    assert.equal(o.czlonyTekstowe[0].rola,'imie');
    assert.equal(o.kategoriaAutomatyczna,W);
    assert.ok(!kody(info12(o)).includes('NIEROZSTRZYGNIETA_ROLA'));
  }
});
test('Kontekst dwóch członów ignoruje datę i cyfry, ale nie dodatkowy człon tekstowy',()=>{
  for(const [tekst, plec] of [
    ['Witek Nowak 18/11/2008',M], ['1. Nowak 18.11.2008 Witek',M], [pm+' Witek Nowak',M]
  ]){
    const o=w12(tekst);
    assert.equal(o.czlonyTekstowe.find(c=>c.klucz==='WITEK').podstawaRoli,'PRZEWAGA_NAZWISKA');
    assert.equal(o.oryginalnyWiersz,tekst);
    assert.equal(o.kategoriaAutomatyczna,plec);
    assert.equal(o.zrodlo, tekst.includes(pm) ? 'pesel' : 'zdrobnienia');
    assert.ok(!info12(o).some(u=>u.kod==='ROLA_NAZWISKA_ZE_STATYSTYK'));
  }
  for(const tekst of ['Lp. Witek Nowak','Witek A123 Nowak','Anna Witek Nowak']){
    const o=w12(tekst);
    assert.equal(o.czlonyTekstowe.find(c=>c.klucz==='WITEK').rola,'nierozstrzygnieta');
  }
  assert.equal(w12(pk+' Witek Nowak').kategoriaAutomatyczna,K);
});
test('Rola 10x może użyć nazwiska rozstrzygniętego dotychczasową regułą 50x',()=>{
  const k=API.utworzKlasyfikator({imiona:{KOLIZJA:[0,1000],KLIMEK:[0,30]}},
    {nazwiska:{KOLIZJA:[50,50],KLIMEK:[1000,1000]}});
  for(const tekst of ['Kolizja Klimek','Klimek Kolizja']){
    const o=k.klasyfikujWiersz(tekst);
    assert.equal(o.czlonyTekstowe.find(c=>c.klucz==='KOLIZJA').podstawaRoli,'PRZEWAGA_IMIENIA_10_Z_NAZWISKIEM');
    assert.equal(o.czlonyTekstowe.find(c=>c.klucz==='KLIMEK').podstawaRoli,'PRZEWAGA_NAZWISKA');
  }
});

// Sugestia zapisu z polskimi znakami nie uczestniczy w klasyfikacji.
const kodPisowni = 'MOZLIWY_BRAK_POLSKICH_ZNAKOW';
function pisownia(imiona, tekst, nazwiska=null, zdrobnienia=null) {
  return API.utworzKlasyfikator({imiona},nazwiska,zdrobnienia).klasyfikujWiersz(tekst);
}
for(const [pelne,proste,uwaga] of [[9999,95,false],[10000,95,true],[10001,95,true],
  [19999,2000,false],[20000,2000,true],[20001,2000,true]]) {
  test(`Pisownia - granice popularności: ${pelne}/${proste}`,()=>{
    const o=pisownia({MALGORZATA:[proste,0],MAŁGORZATA:[pelne,0]},'Malgorzata');
    assert.equal(kody(info12(o)).includes(kodPisowni),uwaga);
    assert.equal(kody(info12(o)).includes('RZADKIE_IMIE'),proste<100&&!uwaga);
    assert.equal(o.kategoriaAutomatyczna,K);
    assert.equal(o.wariantZPolskimiZnakami,undefined);
    assert.equal(o.rozpoznaneImiona[0].wariantZPolskimiZnakami?.klucz ?? null,uwaga?'MAŁGORZATA':null);
  });
}
for(const [proste,pelne,plec,rzadkie] of [
  [[95,0],[10000,0],K,false], [[0,47],[0,10000],M,false],
  [[95,0],[0,10000],K,true], [[50,45],[10000,0],W,false],
  [[95,0],[9990,10],K,false], [[95,0],[9989,11],K,true],
  [[50,45],[5000,5000],W,false]
]) test(`Pisownia - niezależność płci: ${proste}/${pelne}`,()=>{
  const o=pisownia({MALGORZATA:proste,MAŁGORZATA:pelne},'Malgorzata');
  assert.equal(o.kategoriaAutomatyczna,plec);
  assert.ok(kody(info12(o)).includes(kodPisowni));
  assert.equal(kody(info12(o)).includes('RZADKIE_IMIE'),rzadkie);
  assert.equal(info12(o).find(u=>u.kod===kodPisowni).severity,'low');
  assert.equal(API.pobierzKomunikaty(o).doWeryfikacji.length,plec===W?1:0);
});
for(const [bez,z] of [['A','Ą'],['C','Ć'],['E','Ę'],['L','Ł'],['N','Ń'],['O','Ó'],['S','Ś'],['Z','Ź'],['Z','Ż']]) {
  test(`Sugestie - polski znak ${z}`,()=>{
    const o=pisownia({['TEST'+bez]:[40,0],['TEST'+z]:[10000,0]},'Test'+bez.toLowerCase());
    assert.ok(kody(info12(o)).includes(kodPisowni));
  });
}
test('Kilka polskich odpowiedników wyklucza sugestię, także gdy tylko jeden spełnia progi',()=>{
  for(const drugie of [30,10000]) {
    const o=pisownia({ZANA:[40,0],ŻANA:[10000,0],ŹANA:[drugie,0]},'Zana');
    assert.ok(!kody(info12(o)).includes(kodPisowni));
    assert.ok(kody(info12(o)).includes('RZADKIE_IMIE'));
  }
});
test('Brak dokładnego dopasowania, polskie znaki i obce znaki nie uruchamiają korekty',()=>{
  for(const [imiona,tekst] of [
    [{MAŁGORZATA:[10000,0]},'Malgorzata'],
    [{MAŁGORZATA:[10000,0],MALGORZATA:[95,0]},'Małgorzata'],
    [{ROBERT:[0,100000],RÓBERT:[0,95]},'Robert'],
    [{ANDRE:[40,0],ANDRÉ:[10000,0]},'Andre'],
    [{MAŁGORZATA:[95,0],MĄŁGORZATA:[10000,0]},'Małgorzata']
  ]) {
    const o=pisownia(imiona,tekst);
    assert.ok(!kody(info12(o)).includes(kodPisowni));
  }
  assert.equal(pisownia({ŁUKASZ:[0,100000]},'Lukasz').kategoriaAutomatyczna,W);
});
test('Sugestia nie zmienia oryginału, statystyk, wskazań, PESEL-u ani źródła daty',()=>{
  const imiona={MALGORZATA:[95,0],MAŁGORZATA:[572067,0]};
  const tekst='  malgorzata 18/11/2008 '+pm;
  const o=pisownia(imiona,tekst);
  assert.equal(o.oryginalnyWiersz,tekst);
  assert.equal(o.rozpoznaneImiona[0].tekst,'malgorzata');
  assert.equal(o.rozpoznaneImiona[0].statystyki.kobiety,95);
  assert.deepEqual(o.wskazania,{kobieta:1,mezczyzna:0,niejednoznaczne:0});
  assert.equal(o.kategoriaAutomatyczna,W);
  assert.ok(kody(API.pobierzKomunikaty(o).doWeryfikacji).includes('KONFLIKT_DATY_PESEL'));
  const opis=info12(o).find(u=>u.kod===kodPisowni).opis;
  assert.match(opis,/95 osób/); assert.match(opis,/572067 osób/); assert.match(opis,/Małgorzata/);
});
test('Sugestia nie znosi pozostałych uwag i nie jest prezentowana dla pominiętego imienia',()=>{
  const imiona={MALGORZATA:[95,0],MAŁGORZATA:[572067,0],JAN:[0,10000]};
  const nazwiska={nazwiska:{MALGORZATA:[5000,5000],NOWAK:[50,50]}};
  const zdrobnienia={zdrobnienia:{MALGORZATA:['MAŁGORZATA']}};
  const o=pisownia(imiona,'Malgorzata Nowak',nazwiska,zdrobnienia);
  assert.equal(o.kategoriaAutomatyczna,K);
  assert.equal(o.zrodlo,'zdrobnienia');
  assert.equal(o.rozpoznaneImiona[0].uwzglednione,false);
  assert.ok(info12(o).some(u=>u.kod==='MOZLIWE_ZDROBNIENIE' && u.severity==='high'));
  assert.ok(!kody(info12(o)).includes(kodPisowni));
  const kontekst = pisownia(imiona,'Malgorzata Nowak',
    {nazwiska: {...nazwiska.nazwiska, MALGORZATA:[100,100]}},zdrobnienia);
  const kodyUwag=kody(info12(kontekst));
  for(const kod of [kodPisowni,'ROLA_IMIENIA_Z_KONTEKSTU']) assert.ok(kodyUwag.includes(kod));
  assert.ok(!kodyUwag.includes('MOZLIWE_ZDROBNIENIE'));
  assert.ok(!kodyUwag.includes('RZADKIE_IMIE'));
  const nazwisko=pisownia(imiona,'Jan Malgorzata',nazwiska);
  assert.equal(nazwisko.rozpoznaneImiona[1].uwzglednione,false);
  assert.equal(nazwisko.rozpoznaneImiona[1].wariantZPolskimiZnakami,null);
  assert.ok(!kody(info12(nazwisko)).includes(kodPisowni));
  assert.equal(nazwisko.kategoriaAutomatyczna,M);
});
test('Powtórzenia dają jedną uwagę z pozycjami, dane są dynamiczne i odizolowane od wejścia',()=>{
  const imiona={MALGORZATA:[95,0],MAŁGORZATA:[123456,0]};
  const k=API.utworzKlasyfikator({imiona});
  imiona.MAŁGORZATA[0]=1;
  const o=k.klasyfikujWiersz('Malgorzata MALGORZATA');
  const uwagi=info12(o).filter(u=>u.kod===kodPisowni);
  assert.equal(uwagi.length,1); assert.deepEqual(uwagi[0].pozycje,[0,1]);
  assert.match(uwagi[0].opis,/123456 osób/);
  assert.deepEqual(info12(API.ustawKlasyfikacjeReczna(o,M)),info12(o));
  assert.equal(API.podsumuj([o]).doWeryfikacji,0);
});

// Klasyfikacja ze zdrobnień: dane syntetyczne i fragmenty statystyk słownika.
const zdrobImiona={imiona:{...imiona12.imiona, PIOTR:[3,682516],
  BARTOSZ:[0,205155], BARTŁOMIEJ:[0,126070], BARTEK:[0,706],
  ALEKSANDER:[18,162886], ALEKSANDRA:[390147,3], SASZA:[23,99], ALEX:[158,11985], MORGAN:[58,88]}};
const zdrobNazwiska={nazwiska:{...nazwiska12.nazwiska, KRAWCZYK:[31329,30308],
  MORGAN:[182,115], ALEX:[31,35], BARTEK:[104,108]}};
const zdrobSlownik={zdrobnienia:{...zdrobnienia12.zdrobnienia,
  PIOTREK:['PIOTR'], PIOTRUŚ:['PIOTR'], BARTEK:['BARTOSZ','BARTŁOMIEJ'],
  BARTUŚ:['BARTOSZ','BARTŁOMIEJ'], ANUSIA:['ANNA'], SASZA:['ALEKSANDER','ALEKSANDRA'],
  ALEX:['ALEKSANDER','ALEKSANDRA'], SASZEŃKA:['ALEKSANDER','ALEKSANDRA'],
  NIEPELNE:['PIOTR','NIEOBECNE'], SLABE:['NUR'], REMISOWE:['REMIS']}};
const zdrobK=API.utworzKlasyfikator(zdrobImiona,zdrobNazwiska,zdrobSlownik);
const zdrobW=tekst=>zdrobK.klasyfikujWiersz(tekst);
for(const [tekst,plec,zrodlo] of [
  ['Piotrek Krawczyk',M,'zdrobnienia'], ['Kasia Nowak',K,'imiona'],
  ['Bartek Kowalski',M,'imiona'], ['Sasza Nowak',W,null], ['Alex Morgan',W,null],
  ['Bartuś Nowak',M,'zdrobnienia'], ['Anusia Nowak',K,'zdrobnienia'],
  ['Piotrek',W,null], ['Piotrek Xyz',W,null], ['Piotrek Jan',M,'imiona'],
  ['Piotrek Jan Krawczyk',M,'imiona'], ['Piotrek Anna Krawczyk',W,null],
  ['Piotrek Kowalska',W,null], ['Piotrek Nur Nowak',W,null],
  ['Piotrek Kim Kowalska',W,null], ['Piotrek Remis Nowak',W,null],
  ['Piotrek Piotruś Nowak',M,'zdrobnienia'], ['Piotrek Anusia Nowak',W,null],
  ['Piotrek Saszeńka Nowak',W,null], ['Niepelne Nowak',W,null],
  ['Slabe Nowak',W,null], ['Remisowe Nowak',W,null]
]) test('Zdrobnienia - decyzja i kolejność: '+tekst,()=>{
  for(const wejscie of [tekst,tekst.split(' ').reverse().join(' ')]){
    const o=zdrobW(wejscie);
    assert.equal(o.kategoriaAutomatyczna,plec);
    assert.equal(o.zrodlo,zrodlo);
    assert.equal(o.oryginalnyWiersz,wejscie);
  }
});
test('Rozwinięcie zdrobnienia nie zastępuje dopasowanego samodzielnego imienia',()=>{
  const k=API.utworzKlasyfikator({imiona:{SKROT:[0,30],PELNE:[10000,0],SŁABE:[49,51]}},
    {nazwiska:{NOWAK:[50,50]}},{zdrobnienia:{SKROT:['PELNE'],SŁABE:['PELNE']}});
  const o=k.klasyfikujWiersz('Skrot Nowak');
  assert.equal(o.kategoriaAutomatyczna,M);
  assert.equal(o.zrodlo,'imiona');
  assert.equal(o.rozpoznaneZdrobnienia[0].plecZPelnychForm,null);
  assert.ok(kody(info12(o)).includes('RZADKIE_IMIE'));
  assert.equal(k.klasyfikujWiersz('Słabe Nowak').kategoriaAutomatyczna,W);
});
test('Zdrobnienie obecne w nazwiskach potrzebuje osobnego nazwiska w analizie pary',()=>{
  const k=API.utworzKlasyfikator(zdrobImiona,{nazwiska:{...zdrobNazwiska.nazwiska,PIOTREK:[50,50]}},zdrobSlownik);
  const para = k.klasyfikujWiersz('Piotrek Nowak');
  assert.equal(para.kategoriaAutomatyczna,M);
  assert.equal(para.zrodlo,'zdrobnienia');
  assert.equal(para.rozpoznaneZdrobnienia[0].kontekst,'nazwisko');
  assert.equal(para.rozpoznaneZdrobnienia[0].rola,'imie');
  assert.equal(para.rozpoznaneZdrobnienia[0].wykorzystaneDoKlasyfikacji,true);

  const o = k.klasyfikujWiersz('Piotrek '+pk), z = o.rozpoznaneZdrobnienia[0];
  assert.equal(z.kontekst,null); assert.equal(z.wykorzystaneDoKlasyfikacji,false);
  assert.equal(z.rola,'nazwisko');
  assert.equal(o.kategoriaAutomatyczna,K);
});
for(const [liczby,plec] of [[[999,1],K],[[998,2],W],[[1,999],M],[[2,998],W]]){
  test('Próg każdej pełnej formy: '+liczby,()=>{
    const o=API.utworzKlasyfikator({imiona:{PELNE:liczby}},
      {nazwiska:{NOWAK:[50,50]}},{zdrobnienia:{SKROT:['PELNE']}}).klasyfikujWiersz('Skrot Nowak');
    assert.equal(o.kategoriaAutomatyczna,plec);
  });
}
test('Każda pełna forma musi spełnić próg; nie sumujemy liczebności',()=>{
  const o=API.utworzKlasyfikator({imiona:{PELNE:[0,1000000],DRUGIE:[49,51]}},
    {nazwiska:{NOWAK:[50,50]}},{zdrobnienia:{SKROT:['PELNE','DRUGIE']}}).klasyfikujWiersz('Skrot Nowak');
  assert.equal(o.kategoriaAutomatyczna,W);
  assert.equal(o.rozpoznaneZdrobnienia[0].plecZPelnychForm,null);
});
test('Poprawny PESEL wystarcza jako kontekst, ma pierwszeństwo i scala uwagę o rozbieżności',()=>{
  for(const [p,plec] of [[pm,M],[pk,K]]){
    for(const tekst of [p+' Piotrek','Piotrek '+p,'Piotrek '+p+' Nowak']){
      const o=zdrobW(tekst),z=o.rozpoznaneZdrobnienia[0];
      assert.equal(o.kategoriaAutomatyczna,plec); assert.equal(o.zrodlo,'pesel');
      assert.equal(z.kontekst,tekst.includes('Nowak')?'nazwisko_i_pesel':'pesel');
      assert.equal(z.sprzeczneZPeselem,plec===K);
      assert.equal(z.wykorzystaneDoKlasyfikacji,false);
      const uwagi=info12(o).filter(u=>u.kod==='MOZLIWE_ZDROBNIENIE');
      assert.equal(uwagi.length,plec===K?1:0);
      if(plec===K) {
        assert.equal(uwagi[0].severity,'high');
        assert.match(uwagi[0].opis,/PESEL mimo przeciwnego wskazania/);
      }
      assert.equal(API.pobierzKomunikaty(o).doWeryfikacji.length,0);
    }
  }
  assert.equal(zdrobW(pk+' Piotrek Jan Nowak').kategoriaAutomatyczna,W);
  assert.equal(zdrobW(pm+' Piotrek Anna Nowak').kategoriaAutomatyczna,W);
});
test('Zdrobnienia nie omijają błędów i wielokrotności PESEL',()=>{
  for(const tekst of ['Piotrek 1234567890','Piotrek '+pm+' '+pm,
    'Piotrek Nowak 1234567890','Piotrek Nowak '+pm+' '+pk]){
    const o=zdrobW(tekst);
    assert.equal(o.kategoriaAutomatyczna,W);
    assert.ok(o.rozpoznaneZdrobnienia.every(z=>!z.wykorzystaneDoKlasyfikacji));
    if(!tekst.includes('Nowak')) assert.equal(o.rozpoznaneZdrobnienia[0].kontekst,null);
  }
});
test('Jedna uwaga o użytym zdrobnieniu zawiera liczby wszystkich pełnych form',()=>{
  const o=zdrobW('Bartuś Bartuś Nowak');
  const uwagi=info12(o).filter(u=>u.kod==='MOZLIWE_ZDROBNIENIE');
  assert.equal(uwagi.length,1); assert.deepEqual(uwagi[0].pozycje,[0,1]);
  for(const fragment of ['Płeć ustalono na podstawie zdrobnienia','205155 osób','126070 osób',
    'kobiety: 0, mężczyźni: 205155','Jako samodzielne imię: brak wpisu']) assert.ok(uwagi[0].opis.includes(fragment));
  assert.deepEqual(o.wskazania,{kobieta:0,mezczyzna:0,niejednoznaczne:0});
  assert.deepEqual(o.rozpoznaneImiona,[]);
  assert.equal(o.rozpoznaneZdrobnienia[0].statystyki,null);
  assert.equal(o.rozpoznaneZdrobnienia[0].plecZPelnychForm,M);
  assert.equal(o.rozpoznaneZdrobnienia[0].wykorzystaneDoKlasyfikacji,true);
  assert.equal(o.czlonyTekstowe[0].podstawaRoli,'KONTEKST_ZDROBNIENIA');
  assert.deepEqual(API.podsumuj([o]),{kobieta:0,mezczyzna:1,doWeryfikacji:0,razem:1});
  assert.deepEqual(API.pobierzKomunikaty(o).doWeryfikacji,[]);
});
test('Zdrobnienia zachowują wiek, uwagi dat, ręczne decyzje i oryginał',()=>{
  const tekst='  Piotrek 18/11/2008 Nowak  ';
  const o=zdrobW(tekst);
  assert.equal(o.oryginalnyWiersz,tekst);
  assert.equal(API.obliczWiek(o,'2026-11-18').wiek,18);
  assert.equal(o.kategoriaAutomatyczna,M);
  const reczna=API.ustawKlasyfikacjeReczna(o,K);
  assert.equal(API.pobierzKategorie(reczna),K);
  assert.equal(reczna.kategoriaAutomatyczna,M);
  assert.deepEqual(info12(reczna),info12(o));
  const bledna=zdrobW('Piotrek Nowak 31.02.2008');
  assert.equal(bledna.kategoriaAutomatyczna,M);
  assert.ok(kody(API.pobierzKomunikaty(bledna).doWeryfikacji).includes('BLEDNA_DATA'));
});

test('Przeciwne nazwisko nadal daje tylko ostrzeżenie, gdy samodzielne imię i zdrobnienie są zgodne', () => {
  const o = zdrobW('Piotrek Jan Kowalska');
  assert.equal(o.kategoriaAutomatyczna, M);
  assert.equal(o.zrodlo, 'imiona');
  assert.ok(kody(info12(o)).includes('NAZWISKO_PRZECIWNE_WYNIKOWI'));
  assert.equal(zdrobW('Piotrek Kowalska').sugestia, null);
});

test('PESEL z rozpoznanym zdrobnieniem nie zgłasza braku imienia', () => {
  const o = zdrobW('Piotrek ' + pk);
  assert.equal(o.kategoriaAutomatyczna, K);
  assert.deepEqual(kody(info12(o)), ['MOZLIWE_ZDROBNIENIE']);
});

// Wycinek danych ze słowników 1.2.1: człony z macierzy i pełne formy ich zdrobnień.
const dane122Imiona = { imiona: {
  "ADAM": [7, 400572],
  "AGATA": [184481, 0],
  "AGNIESZKA": [544968, 0],
  "ALEKSANDER": [18, 162886],
  "ALEKSANDRA": [390147, 3],
  "ALEXANDER": [9, 14677],
  "ALEXANDRA": [4618, 2],
  "ALIAKSANDR": [3, 20378],
  "ANIA": [612, 0],
  "ANNA": [1063756, 12],
  "BARTEK": [0, 706],
  "BARTOSZ": [0, 205155],
  "BARTŁOMIEJ": [0, 126070],
  "FILIP": [0, 176647],
  "GALA": [43, 0],
  "JAGODA": [45493, 0],
  "JAKUB": [6, 433692],
  "JAN": [14, 462503],
  "KAMIL": [5, 251233],
  "KASIA": [211, 0],
  "KATARZYNA": [602474, 0],
  "KLIMEK": [0, 48],
  "KRYSTYNA": [383140, 0],
  "KRZYSZTOF": [2, 631898],
  "KUBA": [0, 17658],
  "MAGDA": [18399, 0],
  "MAGDALENA": [434117, 3],
  "MAREK": [2, 369240],
  "MARIA": [566902, 55],
  "MILA": [2776, 0],
  "MILENA": [78513, 0],
  "MIREK": [0, 56],
  "MIROSŁAW": [0, 173239],
  "OLEKSANDR": [35, 125101],
  "OLEKSANDRA": [25802, 8],
  "PAWEŁ": [2, 502076],
  "PIOTR": [3, 682516],
  "ROMAN": [4, 174380],
  "SASHA": [122, 103],
  "URBAN": [0, 175],
  "WITEK": [0, 47],
  "WITOLD": [0, 54261],
  "ZOFIA": [360466, 4],
  "ZOSIA": [351, 0],
} };
const dane122Nazwiska = { nazwiska: {
  "ADAM": [883, 863],
  "BARTEK": [104, 108],
  "CIESIELSKA": [10762, 0],
  "CIESIELSKI": [51, 10709],
  "FILIPEK": [4388, 4390],
  "GALA": [1283, 1250],
  "JAGODA": [1107, 1131],
  "JAN": [54, 64],
  "KASIA": [32, 32],
  "KLIMEK": [10002, 9741],
  "KOWALSKA": [67308, 3],
  "KOWALSKI": [535, 66589],
  "KRYCHA": [20, 23],
  "KUBA": [558, 564],
  "MAGDA": [1162, 1088],
  "MAREK": [8918, 8881],
  "MAŃKA": [2943, 2959],
  "MILA": [430, 426],
  "MIREK": [2416, 2435],
  "NOWAK": [99738, 98387],
  "PAWEŁEK": [1713, 1715],
  "ROMAN": [3459, 3455],
  "URBAN": [9224, 9105],
  "WITEK": [7369, 7391],
} };
const dane122Zdrobnienia = { zdrobnienia: {
  "AGUSIA": ["AGATA", "AGNIESZKA"],
  "ANIA": ["ANNA"],
  "BARTEK": ["BARTOSZ", "BARTŁOMIEJ"],
  "FILIPEK": ["FILIP"],
  "KASIA": ["KATARZYNA"],
  "KRYCHA": ["KRYSTYNA", "KRZYSZTOF"],
  "KUBA": ["JAKUB"],
  "MAGDA": ["MAGDALENA"],
  "MAŃKA": ["MARIA"],
  "MILA": ["MILENA"],
  "MIREK": ["MIROSŁAW"],
  "PAWEŁEK": ["PAWEŁ"],
  "PIOTREK": ["PIOTR"],
  "PIOTRUŚ": ["PIOTR"],
  "SASHA": ["ALEKSANDER", "ALEKSANDRA", "ALEXANDER", "ALEXANDRA", "ALIAKSANDR", "OLEKSANDR", "OLEKSANDRA"],
  "WITEK": ["WITOLD"],
  "ZOSIA": ["ZOFIA"],
} };
const klasyfikator122 = API.utworzKlasyfikator(dane122Imiona, dane122Nazwiska, dane122Zdrobnienia);
const wynik122 = (tekst) => klasyfikator122.klasyfikujWiersz(tekst);
const rola122 = { I: 'imie', N: 'nazwisko', '?': 'nierozstrzygnieta' };
const typ122 = ['H','A','B','D','C','E','F','G'];
for (const [typ, pierwszy, drugi, plec, role, zrodlo] of [
  ['A+A', 'Anna', 'Maria', K, 'II', 'imiona'],
  ['A+B', 'Anna', 'Nowak', K, 'IN', 'imiona'],
  ['A+C', 'Kamil', 'Piotrek', M, 'II', 'imiona'],
  ['A+D', 'Anna', 'Marek', K, 'IN', 'imiona'],
  ['A+E', 'Anna', 'Ania', K, 'II', 'imiona'],
  ['A+F', 'Anna', 'Pawełek', K, 'IN', 'imiona'],
  ['A+G', 'Anna', 'Bartek', K, 'IN', 'imiona'],
  ['A+H', 'Anna', 'Xinjiping', K, 'I?', 'imiona'],
  ['B+B', 'Nowak', 'Kowalski', W, 'NN', null],
  ['B+C', 'Nowak', 'Piotrek', M, 'NI', 'zdrobnienia'],
  ['B+D', 'Nowak', 'Marek', M, 'NI', 'imiona'],
  ['B+E', 'Nowak', 'Ania', K, 'NI', 'imiona'],
  ['B+F', 'Nowak', 'Pawełek', M, 'NI', 'zdrobnienia'],
  ['B+G', 'Nowak', 'Bartek', M, 'NI', 'imiona'],
  ['B+H', 'Nowak', 'Xinjiping', W, 'N?', null],
  ['C+C', 'Piotrek', 'Piotruś', W, 'II', null],
  ['C+D', 'Piotrek', 'Marek', M, 'IN', 'zdrobnienia'],
  ['C+E', 'Agusia', 'Ania', K, 'II', 'imiona'],
  ['C+F', 'Agusia', 'Pawełek', K, 'IN', 'zdrobnienia'],
  ['C+G', 'Agusia', 'Bartek', W, 'IN', null],
  ['C+H', 'Piotrek', 'Xinjiping', W, 'I?', null],
  ['D+D', 'Marek', 'Roman', M, '??', 'imiona'],
  ['D+E', 'Marek', 'Ania', K, 'NI', 'imiona'],
  ['D+F', 'Jan', 'Mańka', M, 'IN', 'imiona'],
  ['D+G', 'Adam', 'Witek', M, 'IN', 'imiona'],
  ['D+H', 'Marek', 'Xinjiping', M, '??', 'imiona'],
  ['E+E', 'Ania', 'Zosia', K, 'II', 'imiona'],
  ['E+F', 'Ania', 'Pawełek', K, 'IN', 'imiona'],
  ['E+G', 'Ania', 'Bartek', K, 'IN', 'imiona'],
  ['E+H', 'Ania', 'Xinjiping', K, 'I?', 'imiona'],
  ['F+F', 'Pawełek', 'Mańka', W, '??', null],
  ['F+G', 'Pawełek', 'Kasia', W, '??', null],
  ['F+H', 'Pawełek', 'Xinjiping', W, '??', null],
  ['G+G', 'Kuba', 'Bartek', M, '??', 'imiona'],
  ['G+H', 'Kasia', 'Xinjiping', K, '??', 'imiona'],
  ['H+H', 'Xinjiping', 'Xqz', W, '??', null],
]) {
  for (const odwroc of [false, true]) {
    const wejscie = (odwroc ? [drugi, pierwszy] : [pierwszy, drugi]).join(' ');
    test(`Macierz 1.2.2 ${typ}: ${wejscie}`, () => {
      const o = wynik122(wejscie);
      const czlony = odwroc ? [...o.czlonyTekstowe].reverse() : o.czlonyTekstowe;
      assert.equal(czlony.map(({dopasowania: d}) =>
        typ122[Number(d.imie) + 2 * Number(d.nazwisko) + 4 * Number(d.zdrobnienie)]).join('+'), typ);
      assert.deepEqual(czlony.map(c => c.rola), [...role].map(r => rola122[r]));
      assert.equal(o.kategoriaAutomatyczna, plec);
      assert.equal(o.zrodlo, zrodlo);
      assert.equal(o.oryginalnyWiersz, wejscie);
      if (zrodlo === 'zdrobnienia') {
        assert.ok(!o.ostrzezenia.includes('BRAK_ROZPOZNANYCH_IMION'));
        assert.ok(info12(o).some(u => u.kod === 'MOZLIWE_ZDROBNIENIE' && u.severity === 'medium'));
      }
    });
  }
}
for (const [tekst, oczekiwany, zrodlo, uwaga] of [
  ['Anna Adam', W, null],
  ['Anna Piotrek', W, null],
  ['Urban Nowak', W, null],
  ['Witek Nowak', M, 'zdrobnienia'],
  ['Klimek Nowak', W, null],
  ['Pawełek Ciesielski', M, 'zdrobnienia'],
  ['Pawełek Ciesielska', W, null],
  ['Paweł Kowalska', M, 'imiona', 'NAZWISKO_PRZECIWNE_WYNIKOWI'],
  ['Sasha Nowak', W, null],
  ['Sasha Kowalska', K, 'imiona_i_nazwisko'],
  ['Sasha Kowalski', W, null],
  ['Krycha Nowak', W, null],
  ['Pawełek Filipek', W, null],
  ['Marek Pawełek', M, 'imiona', 'NIEROZSTRZYGNIETA_ROLA'],
  ['Marek Jagoda', W, null],
  ['Pawełek Nowak 05.01.1987', M, 'zdrobnienia'],
]) test(`Przypadek brzegowy 1.2.2: ${tekst}`, () => {
  const o = wynik122(tekst);
  assert.equal(o.kategoriaAutomatyczna, oczekiwany);
  assert.equal(o.zrodlo, zrodlo);
  if (uwaga) assert.ok(info12(o).some(u => u.kod === uwaga));
});

for (const [imiona, nazwiska, dominujaca, rozstrzygnieta] of [
  [4999,100,'imie',false], [5000,100,'imie',true], [5001,100,'imie',true],
  [100,4999,'nazwisko',false], [100,5000,'nazwisko',true], [100,5001,'nazwisko',true],
  [99,1,'imie',false], [100,1,'imie',true],
  [1,99,'nazwisko',false], [1,100,'nazwisko',true]
]) test(`Przewaga roli 1.2.2: ${imiona}/${nazwiska}`, () => {
  const k = API.utworzKlasyfikator({imiona:{CZLON:[0,imiona]}},
    {nazwiska:{CZLON:[0,nazwiska]}}, {zdrobnienia:{}});
  const o = k.klasyfikujWiersz('Czlon Xyz');
  const czlon = o.czlonyTekstowe[0];
  assert.equal(czlon.rolaWstepna, rozstrzygnieta ? dominujaca : 'niejednoznaczna');
  assert.equal(czlon.rola, rozstrzygnieta ? dominujaca : 'nierozstrzygnieta');
  const uwagi = info12(o).filter(u => u.obszar === 'dane');
  assert.deepEqual(uwagi.map(u=>[u.kod,u.severity]), rozstrzygnieta ? [] : [['NIEROZSTRZYGNIETA_ROLA','medium']]);
});

for (const [liczby, silne] of [
  [[999,1],true], [[998,2],false], [[99,0],false], [[100,0],true]
]) test(`Silne nazwisko przeciw zdrobnieniu: ${liczby}`, () => {
  const k = API.utworzKlasyfikator({imiona:{PIOTR:[0,1000]}},
    {nazwiska:{OSOBNE:liczby, PIOTREK:[0,999999]}}, {zdrobnienia:{PIOTREK:['PIOTR']}});
  const o = k.klasyfikujWiersz('Osobne Piotrek');
  assert.equal(o.czlonyTekstowe[1].rolaWstepna, 'niejednoznaczna');
  assert.equal(o.czlonyTekstowe[1].rola, 'imie');
  assert.equal(o.kategoriaAutomatyczna, silne ? W : M);
  assert.equal(o.ostrzezenia.includes('KONFLIKT_ZDROBNIENIA'), silne);
});

test('Analiza pary wymaga obu słowników opcjonalnych', () => {
  const {imiona} = dane122Imiona;
  const bezZdrobnien = API.utworzKlasyfikator({imiona}, dane122Nazwiska).klasyfikujWiersz('Witek Nowak');
  assert.equal(bezZdrobnien.kategoriaAutomatyczna, M);
  assert.equal(bezZdrobnien.czlonyTekstowe[0].podstawaRoli, 'KONTEKST_DWOCH_CZLONOW');
  const bezNazwisk = API.utworzKlasyfikator({imiona}, null, dane122Zdrobnienia).klasyfikujWiersz('Anna Piotrek');
  assert.equal(bezNazwisk.kategoriaAutomatyczna, K);
  assert.equal(bezNazwisk.rozpoznaneZdrobnienia[0].kontekst, null);
  for (const o of [bezZdrobnien, bezNazwisk]) assert.ok(o.czlonyTekstowe.every(c => !('rolaWstepna' in c)));
});

test('Przeciwny PESEL blokuje imię samodzielne, a konflikt ze zdrobnieniem jest uwagą', () => {
  assert.equal(wynik122(`${pm} Anna Piotrek`).kategoriaAutomatyczna, W);
  const zgodnyZImieniem = wynik122(`Piotrek Anna ${pk}`);
  assert.equal(zgodnyZImieniem.zrodlo, 'pesel');
  assert.equal(zgodnyZImieniem.kategoriaAutomatyczna, K);
  assert.equal(zgodnyZImieniem.rozpoznaneZdrobnienia[0].sprzeczneZPeselem, true);
  const uwagi = info12(zgodnyZImieniem).filter(u => u.kod === 'MOZLIWE_ZDROBNIENIE');
  assert.equal(uwagi.length, 1);
  assert.equal(uwagi[0].severity, 'high');

  const dwaZdrobnienia = wynik122(`Piotrek Piotruś ${pk}`);
  assert.equal(dwaZdrobnienia.kategoriaAutomatyczna, K);
  assert.equal(dwaZdrobnienia.zrodlo, 'pesel');

  const dwieRoleNazwiskowe = wynik122(`Nowak Witek ${pk}`);
  assert.equal(dwieRoleNazwiskowe.kategoriaAutomatyczna, K);
  assert.equal(dwieRoleNazwiskowe.rozpoznaneImiona[0].uwzglednione, false);
  assert.equal(dwieRoleNazwiskowe.rozpoznaneZdrobnienia[0].kontekst, 'para_nazwisk');
  assert.equal(dwieRoleNazwiskowe.rozpoznaneZdrobnienia[0].wykorzystaneDoKlasyfikacji, false);
  assert.equal(dwieRoleNazwiskowe.rozpoznaneZdrobnienia[0].sprzeczneZPeselem, true);
});

for (const [pierwszy, drugi, kategoria, zrodlo, konflikt] of [
  ['Witek', 'Kowalski', M, 'zdrobnienia', false],
  ['Witek', 'Nowak', M, 'zdrobnienia', false],
  ['Mirek', 'Nowak', M, 'zdrobnienia', false],
  ['Klimek', 'Witek', M, 'zdrobnienia', false],
  ['Urban', 'Mirek', M, 'zdrobnienia', false],
  ['Gala', 'Witek', W, null, true],
  ['Witek', 'Mirek', W, null, false],
  ['Klimek', 'Urban', W, null, false],
  ['Klimek', 'Nowak', W, null, false],
  ['Witek', 'Kowalska', W, null, true],
  ['Anna', 'Witek', K, 'imiona', false]
]) {
  for (const tekst of [pierwszy + ' ' + drugi, drugi + ' ' + pierwszy]) {
    test('Zdrobnienie przy dwóch nazwiskach: ' + tekst, () => {
      const o = wynik122(tekst);
      assert.equal(o.kategoriaAutomatyczna, kategoria);
      assert.equal(o.zrodlo, zrodlo);
      assert.equal(o.oryginalnyWiersz, tekst);
      assert.equal(o.ostrzezenia.includes('KONFLIKT_ZDROBNIENIA'), konflikt);
      if (zrodlo === 'zdrobnienia') {
        const [z] = o.rozpoznaneZdrobnienia;
        assert.ok(o.czlonyTekstowe.every(c => c.rolaWstepna === 'nazwisko' && c.rola === 'nazwisko'));
        assert.deepEqual(o.wskazania, {kobieta:0, mezczyzna:0, niejednoznaczne:0});
        assert.ok(o.rozpoznaneImiona.every(i => !i.uwzglednione));
        assert.equal(z.kontekst, 'para_nazwisk');
        assert.equal(z.plecZPelnychForm, kategoria);
        assert.equal(z.wykorzystaneDoKlasyfikacji, true);
        assert.ok(!o.ostrzezenia.includes('BRAK_ROZPOZNANYCH_IMION'));
        const komunikaty = API.pobierzKomunikaty(o);
        assert.equal(komunikaty.doWeryfikacji.length, 0);
        assert.deepEqual(komunikaty.informacyjne.filter(u => u.klucz === z.klucz).map(u => [u.kod, u.severity]),
          [['MOZLIWE_ZDROBNIENIE', 'high']]);
      } else {
        assert.ok(o.rozpoznaneZdrobnienia.every(z => !z.wykorzystaneDoKlasyfikacji));
      }
    });
  }
}

for (const [opis, pelneFormy, imiona, plec] of [
  ['dwie zgodne formy na progu', ['FORMA', 'DRUGA'], {FORMA:[1,999], DRUGA:[2,1998]}, M],
  ['forma poniżej progu', ['FORMA', 'DRUGA'], {FORMA:[1,999], DRUGA:[2,998]}, W],
  ['brak pełnej formy', ['FORMA', 'DRUGA'], {FORMA:[1,999]}, W],
  ['formy o różnych kierunkach', ['FORMA', 'DRUGA'], {FORMA:[1,999], DRUGA:[999,1]}, W]
]) test('Para nazwisk - pełne formy: ' + opis, () => {
  const k = API.utworzKlasyfikator({imiona:{SKROT:[0,30], ...imiona}},
    {nazwiska:{SKROT:[750,750], NAZWISKO:[100,100]}}, {zdrobnienia:{SKROT:pelneFormy}});
  const o = k.klasyfikujWiersz('Skrot Nazwisko');
  assert.equal(o.kategoriaAutomatyczna, plec);
  assert.equal(o.czlonyTekstowe[0].rolaWstepna, 'nazwisko'); // dokładnie 50×
  assert.equal(o.rozpoznaneZdrobnienia[0].wykorzystaneDoKlasyfikacji, plec === M);
});

for (const [opis, imiona, nazwiska, plec] of [
  ['przeciwne własne imię', {SKROT:[30,0]}, {}, W],
  ['przeciwne słabe imię drugiego członu', {NAZWISKO:[16,14]}, {}, W],
  ['remis w imieniu drugiego członu', {NAZWISKO:[15,15]}, {}, M],
  ['przeciwne silne nazwisko na progu', {}, {NAZWISKO:[999,1]}, W],
  ['przeciwne nazwisko poniżej progu', {}, {NAZWISKO:[998,2]}, M],
  ['przeciwne nazwisko poniżej 100 wystąpień', {}, {NAZWISKO:[99,0]}, M],
  ['przeciwne silne nazwisko będące zdrobnieniem', {}, {SKROT:[1499,1]}, W]
]) test('Para nazwisk - zgodność wskazań: ' + opis, () => {
  const k = API.utworzKlasyfikator({imiona:{SKROT:[0,30], FORMA:[1,999], ...imiona}},
    {nazwiska:{SKROT:[750,750], NAZWISKO:[750,750], ...nazwiska}}, {zdrobnienia:{SKROT:['FORMA']}});
  const o = k.klasyfikujWiersz('Nazwisko Skrot');
  assert.equal(o.kategoriaAutomatyczna, plec);
  assert.equal(o.ostrzezenia.includes('KONFLIKT_ZDROBNIENIA'), plec === W);
});

test('Para nazwisk zachowuje priorytet PESEL-u i walidację potencjalnych numerów', () => {
  for (const [numer, oczekiwana, sprzeczne] of [[pm,M,false], [pk,K,true]]) {
    const o = wynik122('Witek ' + numer + ' Kowalski');
    const [z] = o.rozpoznaneZdrobnienia;
    assert.equal(o.kategoriaAutomatyczna, oczekiwana);
    assert.equal(o.zrodlo, 'pesel');
    assert.equal(z.wykorzystaneDoKlasyfikacji, false);
    assert.equal(z.sprzeczneZPeselem, sprzeczne);
    assert.ok(!o.ostrzezenia.includes('KONFLIKT_PESEL_IMIONA'));
  }
  for (const numery of ['1234567890', '12345678901', pm + ' ' + pk]) {
    const o = wynik122('Witek Nowak ' + numery);
    assert.equal(o.kategoriaAutomatyczna, W);
    assert.equal(o.zrodlo, null);
    assert.equal(o.rozpoznaneZdrobnienia[0].wykorzystaneDoKlasyfikacji, false);
  }
  const gala = wynik122('Gala Witek ' + pk);
  assert.equal(gala.kategoriaAutomatyczna, K);
  assert.equal(gala.zrodlo, 'pesel');
  assert.equal(gala.rozpoznaneZdrobnienia[0].sprzeczneZPeselem, false);
});

test('Para nazwisk pomija datę i liczby, a dodatkowy tekst wyłącza nową regułę', () => {
  const o = wynik122('  25. Nowak 18/11/2008 Witek  ');
  assert.equal(o.oryginalnyWiersz, '  25. Nowak 18/11/2008 Witek  ');
  assert.equal(o.urodzenie.data, '2008-11-18');
  assert.equal(o.zrodlo, 'zdrobnienia');
  for (const tekst of ['Witek', 'Witek Nowak Xyz', 'Witek Witek']) {
    assert.ok(wynik122(tekst).rozpoznaneZdrobnienia.every(z => z.kontekst !== 'para_nazwisk'));
  }
});

test('Kontekst z datą i PESEL-em wciąż zależy od dwóch członów tekstowych', () => {
  const tekst = '1. Nowak 05.01.1987 Pawełek';
  const o = wynik122(tekst);
  assert.equal(o.oryginalnyWiersz, tekst);
  assert.equal(o.urodzenie.data, '1987-01-05');
  assert.equal(o.kategoriaAutomatyczna, M);
  assert.equal(o.czlonyTekstowe.length, 2);
  const zBlednymiNumerami = [`Nowak Pawełek 1234567890`, `Nowak ${pk} Pawełek ${pm}`];
  for (const tekst of zBlednymiNumerami) {
    const r = wynik122(tekst);
    assert.equal(r.kategoriaAutomatyczna, W);
    assert.equal(r.czlonyTekstowe.length, 2);
  }
  const trzy = wynik122('Lp. Nowak Pawełek 05.01.1987');
  assert.equal(trzy.kategoriaAutomatyczna, W);
  assert.ok(trzy.czlonyTekstowe.every(c => !('rolaWstepna' in c)));
});

test('Korekta braku imienia obejmuje też udaną klasyfikację zdrobnienia w dłuższym wierszu', () => {
  for (const tekst of ['Piotrek Nowak', 'Piotrek Piotruś Nowak']) {
    const o = wynik122(tekst);
    assert.equal(o.zrodlo, 'zdrobnienia');
    assert.ok(!o.ostrzezenia.includes('BRAK_ROZPOZNANYCH_IMION'));
    const reczna = API.ustawKlasyfikacjeReczna(o, W);
    assert.equal(API.pobierzKomunikaty(reczna).doWeryfikacji[0].kod, 'RECZNA_WERYFIKACJA');
    assert.equal(reczna.czlonyTekstowe, o.czlonyTekstowe);
    assert.equal(API.pobierzKategorie(API.ustawKlasyfikacjeReczna(reczna, null)), M);
  }
  assert.ok(wynik122('Nowak Kowalski').ostrzezenia.includes('BRAK_ROZPOZNANYCH_IMION'));
});

test('Brak znaku diakrytycznego pozwala na dopasowanie zdrobnienia w ograniczonym kontekście', () => {
  const o = wynik122('Pawelek Nowak');
  assert.equal(o.czlonyTekstowe[0].rolaWstepna, 'nierozpoznana');
  assert.equal(o.czlonyTekstowe[0].podstawaRoli, 'KONTEKST_ZDROBNIENIA');
  assert.equal(o.oryginalnyWiersz, 'Pawelek Nowak');
  assert.equal(o.kategoriaAutomatyczna, M);
  assert.equal(o.zrodlo, 'zdrobnienia');
  assert.equal(o.rozpoznaneZdrobnienia[0].wariantZPolskimiZnakami, 'PAWEŁEK');
  assert.match(info12(o).find(u => u.kod === 'MOZLIWE_ZDROBNIENIE').opis, /„Pawelek”.*„Pawełek”/);
});

for (const [pierwszy, drugi, kategoria, zrodlo, sprzeczneImie] of [
  ['Magda', 'Piotrek', W, null, 'Magda'],
  ['Kasia', 'Piotrek', W, null, 'Kasia'],
  ['Mila', 'Piotrek', W, null, 'Mila'],
  ['Kuba', 'Agusia', W, null, 'Kuba'],
  ['Agusia', 'Bartek', W, null, 'Bartek'],
  ['Anna', 'Marek', K, 'imiona'],
  ['Witek', 'Kowalski', M, 'zdrobnienia'],
  ['Klimek', 'Witek', M, 'zdrobnienia'],
  ['Mirek', 'Nowak', M, 'zdrobnienia'],
  ['Gala', 'Witek', W, null],
  ['Pawełek', 'Ciesielski', M, 'zdrobnienia'],
  ['Pawełek', 'Nowak', M, 'zdrobnienia']
]) {
  for (const tekst of [pierwszy + ' ' + drugi, drugi + ' ' + pierwszy]) {
    test('Korekta T-001: ' + tekst, () => {
      const o = wynik122(tekst);
      assert.equal(o.kategoriaAutomatyczna, kategoria);
      assert.equal(o.zrodlo, zrodlo);
      if (zrodlo === 'zdrobnienia') {
        const severity = o.rozpoznaneZdrobnienia.some(z=>z.kontekst==='para_nazwisk')?'high':'medium';
        assert.ok(info12(o).some(u => u.kod === 'MOZLIWE_ZDROBNIENIE' && u.severity === severity));
      }
      if (sprzeczneImie) {
        const czlon = o.czlonyTekstowe.find(c => c.tekst === sprzeczneImie);
        assert.equal(czlon.rola, 'nazwisko');
        assert.equal(czlon.podstawaRoli, 'KONTEKST_NAZWISKA_DWA_CZLONY');
        assert.equal(o.rozpoznaneImiona.find(i => i.pozycja === czlon.pozycja).uwzglednione, false);
        assert.ok(o.ostrzezenia.includes('KONFLIKT_ZDROBNIENIA'));
        assert.ok(o.rozpoznaneZdrobnienia.every(z => !z.wykorzystaneDoKlasyfikacji));
        const uwaga = API.pobierzKomunikaty(o).doWeryfikacji[0];
        assert.equal(uwaga.kod, 'WERYFIKACJA_PLCI');
        assert.equal(uwaga.severity, 'high');
        assert.ok(uwaga.opis.includes(sprzeczneImie));
      }
    });
  }
}

for (const [opis, imie, nazwisko, podstawa, wynik] of [
  ['przeciwne wskazanie na progu', [999,1], [500,500], 'KONTEKST_NAZWISKA_DWA_CZLONY', W],
  ['przeciwne wskazanie poniżej progu', [998,2], [500,500], 'KONTEKST_NAZWISKA_DWA_CZLONY', M],
  ['zgodne wskazanie na progu', [1,999], [500,500], 'KONTEKST_NAZWISKA_DWA_CZLONY', M],
  ['nazwisko rozstrzygnięte przewagą 50×', [999,1], [25000,25000], 'PRZEWAGA_NAZWISKA', M]
]) test('Próg T-001: ' + opis, () => {
  const k = API.utworzKlasyfikator({imiona:{CZLON:imie, FORMA:[1,999]}},
    {nazwiska:{CZLON:nazwisko}}, {zdrobnienia:{SKROT:['FORMA']}});
  const o = k.klasyfikujWiersz('Czlon Skrot');
  assert.equal(o.czlonyTekstowe[0].podstawaRoli, podstawa);
  assert.equal(o.kategoriaAutomatyczna, wynik);
});

test('Korekta T-001 zachowuje priorytet, walidację i konflikty z PESEL-em', () => {
  for (const [numer, kategoria] of [[pm,M], [pk,K]]) {
    const o = wynik122('Magda ' + numer + ' Piotrek');
    assert.equal(o.kategoriaAutomatyczna, kategoria);
    assert.equal(o.zrodlo, 'pesel');
    assert.ok(!o.ostrzezenia.includes('KONFLIKT_ZDROBNIENIA'));
    assert.equal(o.rozpoznaneZdrobnienia.find(z => z.klucz === 'PIOTREK').sprzeczneZPeselem, kategoria === K);
  }
  const bledny = wynik122('Piotrek Magda 12345678901');
  assert.equal(bledny.kategoriaAutomatyczna, W);
  assert.match(bledny.uzasadnienie.join(' '), /walidacji/);
  const konflikt = wynik122('Anna Marek ' + pm);
  assert.equal(konflikt.kategoriaAutomatyczna, W);
  assert.ok(konflikt.ostrzezenia.includes('KONFLIKT_PESEL_IMIONA'));
});

for (const [formy, opis] of [
  [['BRAK'], /w słowniku imion.*BRAK/],
  [['SŁABA'], /poniżej progu 99,90%.*SŁABA/],
  [['MESKA', 'ZENSKA'], /wskazują różne płcie/],
  [['BRAK', 'SŁABA'], /BRAK.*poniżej progu 99,90%.*SŁABA/]
]) test('Diagnostyka T-003 dla pełnych form: ' + formy.join(', '), () => {
  const k = API.utworzKlasyfikator({imiona:{SŁABA:[2,998], MESKA:[1,999], ZENSKA:[999,1]}},
    {nazwiska:{NOWAK:[100,100]}}, {zdrobnienia:{SKROT:formy}});
  const o = k.klasyfikujWiersz('Skrot Nowak');
  assert.equal(o.kategoriaAutomatyczna, W);
  assert.match(API.pobierzKomunikaty(o).doWeryfikacji[0].opis, opis);
});

test('Diagnostyka T-003 rozróżnia brak kontekstu, konflikt nazwiska i kolizję roli', () => {
  for (const [tekst, opis] of [
    ['Piotrek Xyz', /Brak kontekstu/],
    ['Piotrek Piotruś', /brak osobnego nazwiska/],
    ['Witek Kowalska', /silnym wskazaniem nazwiska „Kowalska”/],
    ['Witek Mirek', /członów rozpoznanych jako nazwiska/],
    ['Gala Witek', /samodzielnego imienia „Gala”/]
  ]) {
    const o = wynik122(tekst);
    assert.equal(o.kategoriaAutomatyczna, W, tekst);
    assert.match(o.uzasadnienie.join(' '), opis, tekst);
  }
});

test('Zdrobnienia bez polskich znaków działają symetrycznie i zachowują reguły bezpieczeństwa', () => {
  for (const tekst of ['Nowak Pawelek', 'pAweLek 25.09.2010 Nowak', 'Pawelek Ciesielski']) {
    const o = wynik122(tekst);
    assert.equal(o.kategoriaAutomatyczna, M);
    assert.equal(o.zrodlo, 'zdrobnienia');
    assert.equal(o.oryginalnyWiersz, tekst);
    assert.equal(o.rozpoznaneZdrobnienia[0].wariantZPolskimiZnakami, 'PAWEŁEK');
  }
  const przeciwneNazwisko = wynik122('Pawelek Kowalska');
  assert.equal(przeciwneNazwisko.kategoriaAutomatyczna, W);
  assert.ok(przeciwneNazwisko.ostrzezenia.includes('KONFLIKT_ZDROBNIENIA'));
  const pesel = wynik122('Nowak Pawelek ' + pk);
  assert.equal(pesel.kategoriaAutomatyczna, K);
  assert.equal(pesel.zrodlo, 'pesel');
  for (const tekst of ['Pawelek', 'Pawelek Xyz', 'Pawelek Nowak Inny', 'Pawelek Klimek', 'Pawelek Anna']) {
    assert.equal(wynik122(tekst).rozpoznaneZdrobnienia.length, 0, tekst);
  }
});

test('Kolizje po usunięciu polskich znaków blokują tylko przybliżone dopasowanie', () => {
  const formy = {FORMA:[0,1000]};
  const zdrobnienia = {zdrobnienia:{'ŹELEK':['FORMA']}};
  const nazwiska = {nazwiska:{NOWAK:[100,100], 'ŹELEK':[50,50]}};
  const zWariantami = (i,z,n=nazwiska) => API.utworzKlasyfikator({imiona:{...formy,...i}}, n, z);
  const bezKolizji = zWariantami({},zdrobnienia);
  assert.equal(bezKolizji.klasyfikujWiersz('Zelek Nowak').kategoriaAutomatyczna, M);
  const kolizjaZdrobnien = zWariantami({}, {zdrobnienia:{...zdrobnienia.zdrobnienia, 'ŻELEK':['FORMA']}});
  const kolizjaImienia = zWariantami({'ŻELEK':[999,1]},zdrobnienia);
  const kolizjaNazwiska = zWariantami({},zdrobnienia, {nazwiska:{...nazwiska.nazwiska,'ŻELEK':[100,100]}});
  const wariantJestImieniem = zWariantami({'ŹELEK':[0,30]},zdrobnienia);
  for (const k of [kolizjaZdrobnien, kolizjaImienia, kolizjaNazwiska, wariantJestImieniem]) {
    const o = k.klasyfikujWiersz('Zelek Nowak');
    assert.equal(o.kategoriaAutomatyczna, W);
    assert.equal(o.rozpoznaneZdrobnienia.length, 0);
  }
  const dokladny = kolizjaZdrobnien.klasyfikujWiersz('Źelek Nowak');
  assert.equal(dokladny.kategoriaAutomatyczna, M);
  assert.ok(!('wariantZPolskimiZnakami' in dokladny.rozpoznaneZdrobnienia[0]));
  const dokladneImie = zWariantami({ZELEK:[999,1]},zdrobnienia).klasyfikujWiersz('Zelek Nowak');
  assert.equal(dokladneImie.zrodlo, 'imiona');
  const dokladneNazwisko = zWariantami({},zdrobnienia,
    {nazwiska:{...nazwiska.nazwiska,ZELEK:[100,100]}}).klasyfikujWiersz('Zelek Nowak');
  assert.equal(dokladneNazwisko.rozpoznaneZdrobnienia.length, 0);
});

for (const [liczby, oczekiwany] of [
  [[999,1],'medium'], [[998,2],'low'], [[1,999],'low'], [null,'low']
]) test('Ważność kontekstowego nazwiska przy wskazaniu imienia: ' + liczby, () => {
  const k = API.utworzKlasyfikator({imiona:{
    IMIE:[0,1000], FORMA:[0,1000], ...(liczby && {CZLON:liczby})
  }}, {nazwiska:{CZLON:[500,500]}}, {zdrobnienia:{CZLON:['FORMA']}});
  for (const tekst of ['Imie Czlon', 'Czlon Imie']) {
    const o = k.klasyfikujWiersz(tekst);
    assert.equal(o.kategoriaAutomatyczna,M);
    assert.equal(o.czlonyTekstowe.find(c=>c.klucz==='CZLON').podstawaRoli,'KONTEKST_NAZWISKA_DWA_CZLONY');
    const [uwaga] = info12(o);
    assert.equal(uwaga.kod,'ROLA_NAZWISKA_Z_KONTEKSTU');
    assert.equal(uwaga.severity,oczekiwany);
    assert.equal(/płeć przeciwną/.test(uwaga.opis),oczekiwany==='medium');
  }
});

test('T-001 zachowuje przyczynę i rolę bez powtórzenia w informacjach', () => {
  for (const tekst of ['Magda Piotrek','Piotrek Magda','Agusia Bartek','Bartek Agusia']) {
    const o = wynik122(tekst);
    const {doWeryfikacji, informacyjne} = API.pobierzKomunikaty(o);
    assert.equal(o.kategoriaAutomatyczna,W);
    assert.ok(o.czlonyTekstowe.some(c=>c.podstawaRoli==='KONTEKST_NAZWISKA_DWA_CZLONY'));
    assert.ok(o.ostrzezenia.includes('KONFLIKT_ZDROBNIENIA'));
    assert.deepEqual(doWeryfikacji.map(u=>[u.kod,u.severity]),[['WERYFIKACJA_PLCI','high']]);
    assert.match(doWeryfikacji[0].opis,/rozpoznano|uznano za nazwisko na podstawie kontekstu/);
    assert.deepEqual(informacyjne,[]);
  }
});

test('Rzadkość zgłasza tylko jedyne jednoznaczne imię bez niezależnego potwierdzenia', () => {
  const k = API.utworzKlasyfikator({imiona:{RZADKIE:[0,49], CZESTE:[0,10000], REMIS:[24,24], FORMA:[0,1000]}},
    {nazwiska:{MOCNE:[0,100], SLABE:[0,99], PRZECIWNE:[100,0]}}, {zdrobnienia:{SKROT:['FORMA']}});
  for (const [tekst, kategoria, rzadkosc] of [
    ['Rzadkie', M, true], ['Rzadkie Rzadkie', M, true], ['Rzadkie Slabe', M, true],
    ['Rzadkie Czeste', M, false], ['Rzadkie MOCNE', M, false], ['Rzadkie Skrot', M, false],
    ['Rzadkie '+pm,M,false], ['Rzadkie '+pk,W,false], ['Remis',W,false],
    ['Rzadkie Przeciwne',M,true]
  ]) {
    const o = k.klasyfikujWiersz(tekst);
    assert.equal(o.kategoriaAutomatyczna,kategoria,tekst);
    assert.equal(info12(o).some(u=>u.kod==='RZADKIE_IMIE'),rzadkosc,tekst);
    assert.ok(o.rozpoznaneImiona.some(i=>i.statystyki.kobiety+i.statystyki.mezczyzni<50),tekst);
  }
});

for (const [dopisane, wiek, pozostale, polaczone] of [
  ['1234567890', null, [], [['BLEDNY_PESEL',true]]],
  ['1234567890 2000-01-15', 25, [], [['BLEDNY_PESEL',false]]],
  [pm+' '+pk, null, [], [['KILKA_NUMEROW',true]]],
  ['12345678901 '+pm, null, [], [['BLEDNY_PESEL',true],['KILKA_NUMEROW',true]]],
  ['1234567890 '+pm, null, ['KILKA_NUMEROW'], [['BLEDNY_PESEL',true]]],
  ['1234567890 31.02.2000', null, ['BLEDNA_DATA'], [['BLEDNY_PESEL',true]]],
  ['1234567890 2030-01-01', null, ['URODZENIE_PO_WYDARZENIU'], [['BLEDNY_PESEL',false]]]
]) test('Wspólna weryfikacja PESEL-u: ' + dopisane, () => {
  const o = wiersz('Jan '+dopisane);
  const {doWeryfikacji, informacyjne} = API.pobierzKomunikaty(o,'2025-01-15');
  assert.equal(API.pobierzKategorie(o),W);
  assert.equal(API.obliczWiek(o,'2025-01-15').wiek,wiek);
  assert.deepEqual(kody(doWeryfikacji),['WERYFIKACJA_PLCI',...pozostale]);
  assert.deepEqual(informacyjne,[]);
  const [wspolny] = doWeryfikacji;
  assert.deepEqual(wspolny.powiazane.map(u=>[u.kod,u.wymagaWeryfikacji]),polaczone);
  assert.ok(wspolny.powiazane.every(u=>u.obszar==='wiek' && u.severity==='high'));
  assert.match(wspolny.opis,/PESEL/);
  assert.match(wspolny.opis,o.urodzenie.data?/Przyjęto poprawną datę/:/Nie ustalono daty urodzenia/);
  if (dopisane.includes('12345678901')) assert.match(wspolny.opis,/Nieprawidłowa data zakodowana w PESEL/);
});

test('Ręczna decyzja zachowuje osobną diagnostykę błędnego PESEL-u', () => {
  const o = wiersz('Jan 1234567890');
  for (const [kategoria,kodyUwag] of [[M,['BLEDNY_PESEL']],[W,['RECZNA_WERYFIKACJA','BLEDNY_PESEL']]]) {
    const reczna=API.ustawKlasyfikacjeReczna(o,kategoria);
    const {doWeryfikacji}=API.pobierzKomunikaty(reczna);
    assert.deepEqual(kody(doWeryfikacji),kodyUwag);
    assert.ok(doWeryfikacji.every(u=>u.severity==='high' && !u.powiazane));
  }
});

for (const [dopisane, poziom, lista] of [
  ['', 'high', 'doWeryfikacji'],
  [' 2010-01-01', 'medium', 'informacyjne'],
  [' '+pm, 'medium', 'informacyjne']
]) test('Błędna data zachowuje wymagany poziom na każdym etapie: ' + lista + dopisane, () => {
  const o = wiersz('Jan 31.02.2020'+dopisane);
  assert.equal(o.urodzenie.uwagi[0].severity,poziom);
  assert.equal(API.obliczWiek(o,'2025-01-15').uwagi[0].severity,poziom);
  const [uwaga]=API.pobierzKomunikaty(o,'2025-01-15')[lista];
  assert.equal(uwaga.kod,'BLEDNA_DATA');
  assert.equal(uwaga.severity,poziom);
});
