'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { utworzKlasyfikator, podsumuj, pobierzKomunikaty, obliczWiek,
  ustawKlasyfikacjeReczna, pobierzKategorie } = require('../core/klasyfikator.js');

// Dane słownikowe i numery PESEL są syntetyczne.
const imiona = { imiona: {
  ANNA: [999, 1], MARIA: [999, 1], 'ANNA-MARIA': [999, 1], JAN: [0, 10000],
  MAREK: [1, 999], ROMAN: [1, 999], WITEK: [0, 47], WITOLD: [0, 1000],
  PAWEŁ: [1, 999], ALA: [600, 400], NIKI: [500, 500], KRUK: [0, 30]
} };
const nazwiskaProbki = Array.from('ABCDEFGHIJKLMNOPQRSTUVWX', znak => 'Testowy' + znak);
const nazwiska = { nazwiska: {
  ...Object.fromEntries(nazwiskaProbki.map(n => [n.toUpperCase(), [100, 100]])),
  NOWAK: [100, 100], NOWICKA: [1000, 0], KOWALSKA: [1000, 0], KOWALSKI: [0, 1000],
  'GĄSIENICA-DANIEL': [100, 100],
  JAN: [30, 30], MAREK: [30, 30], ROMAN: [30, 30], WITEK: [5000, 5000], KRUK: [1000, 1000]
} };
const zdrobnienia = { zdrobnienia: { WITEK: ['WITOLD'], PAWEŁEK: ['PAWEŁ'], PIOTREK: ['PAWEŁ'] } };
const k = utworzKlasyfikator(imiona, nazwiska, zdrobnienia);
const ANALIZA = { kontekstKolejnosci: true };
const IMIONA_NAZWISKA = 'imiona_nazwiska';
const NAZWISKA_IMIONA = 'nazwiska_imiona';
const lista = wiersze => k.analizujListe(wiersze.join('\n'), ANALIZA);
// Każdy z pierwszych n wierszy ma inne nazwisko. Po tej próbce wiersze są odwrócone.
function probka(proste, odwrotne, pozostale = 0) {
  const wiarygodne = nazwiskaProbki.slice(0, proste + odwrotne).map((n, i) =>
    i < proste ? 'Anna ' + n : n + ' Anna');
  const nierozstrzygniete = nazwiskaProbki.slice(0, pozostale).map(n => 'Xyz ' + n);
  return wiarygodne.concat(nierozstrzygniete);
}

for (const [proste, odwrotne, pozostale, status, uklad] of [
  [11,0,0,'za_malo_glosow',null],
  [12,0,0,'dominujacy',IMIONA_NAZWISKA],
  [17,3,20,'dominujacy',IMIONA_NAZWISKA],
  [17,3,21,'za_male_pokrycie',null],
  [16,3,0,'lista_mieszana',null],
  [10,2,0,'lista_mieszana',null],
  [6,6,0,'lista_mieszana',null],
  [3,17,20,'dominujacy',NAZWISKA_IMIONA]
]) test(`Progi układu listy przy ${proste} głosach prostych, ${odwrotne} odwrotnych i ${pozostale} pozostałych`, () => {
  const { wyniki, kontekstListy } = lista(probka(proste,odwrotne,pozostale));
  const wazne = proste + odwrotne;
  assert.equal(wyniki.length,wazne+pozostale);
  assert.deepEqual(kontekstListy,{
    uklad, status, glosy:{ imiona_nazwiska:proste, nazwiska_imiona:odwrotne },
    liczbaRekordowPorownywalnych:wazne+pozostale,
    udzialDominujacego:Math.max(proste,odwrotne)/wazne, pokrycie:wazne/(wazne+pozostale),
    progi:{minGlosow:12,minUdzial:0.85,minPokrycie:0.5}, liczbaZmienionychRekordow:0
  });
});

test('Duplikaty z numeracją, datą, PESEL-em i inną wielkością liter liczą się raz w głosowaniu', () => {
  const wiersze = [...probka(11,0), '2. anNA testowyA 29.02.2004 04222900021', 'ANNA TESTOWYA'];
  const { wyniki,kontekstListy } = lista(wiersze);
  assert.equal(kontekstListy.status,'za_malo_glosow');
  assert.equal(kontekstListy.glosy.imiona_nazwiska,11);
  assert.equal(kontekstListy.liczbaRekordowPorownywalnych,11);
  assert.equal(wyniki.length,13);
  assert.equal(podsumuj(wyniki).razem,13);
  assert.equal(wyniki[11].zrodlo,'pesel');
});

test('Duplikaty z błędem lub przeciwnym PESEL-em wyłączają klucz nawet po poprawnych kopiach', () => {
  const podstawa = probka(12,0);
  for (const kopia of ['Anna TestowyA 12345678901','Anna TestowyA 04222900014','Anna TestowyA 31.02.2004']) {
    const wiersze = [...podstawa,kopia,'1. ANNA TESTOWYA'];
    const { kontekstListy } = lista(wiersze);
    assert.deepEqual(kontekstListy,lista([...wiersze].reverse()).kontekstListy);
    assert.equal(kontekstListy.status,'za_malo_glosow',kopia);
    assert.equal(kontekstListy.glosy.imiona_nazwiska,11);
    assert.equal(kontekstListy.liczbaRekordowPorownywalnych,12);
  }
});

test('Grupy liczą się jako jednostki, a układ wieloczłonowy daje jeden głos', () => {
  const { kontekstListy } = lista([
    'Anna Maria Nowak', 'Anna Nowak Nowicka', 'Anna Nowak Maria', 'Nowak Nowicka Anna Maria',
    'Anna-Maria Gąsienica-Daniel', 'Anna‑Maria Gąsienica‑Daniel', 'Anna Maria Gąsienica-Daniel',
    'Kowalska-Nowak Anna-Maria', 'Nowak-Witek Anna-Maria', 'Anna Maria','Nowak Nowicka',
    'Anna Witek Nowak','Anna Marek Nowak','Pawelek Witek-Nowak', 'Anna', '04222900021', '   '
  ]);
  assert.deepEqual(kontekstListy.glosy,{imiona_nazwiska:4,nazwiska_imiona:1});
  assert.equal(kontekstListy.liczbaRekordowPorownywalnych,13);
});

test('Głosowanie odróżnia lokalną przewagę nazwiska od nadania roli w dłuższym wierszu', () => {
  const wiersze = ['Jan Kruk','Anna Maria Kruk','Roman Nowak','Kruk Jan','Anna Marek'];
  const { wyniki,kontekstListy } = lista(wiersze);
  assert.equal(wyniki[0].jednostkiTekstowe[1].podstawaRoli,'PRZEWAGA_NAZWISKA');
  assert.equal(wyniki[1].jednostkiTekstowe[2].podstawaRoli,'PRZEWAGA_NAZWISKA');
  assert.equal(wyniki[2].jednostkiTekstowe[0].podstawaRoli,'KONTEKST_IMIENIA_DWA_CZLONY');
  assert.deepEqual(kontekstListy.glosy,{imiona_nazwiska:1,nazwiska_imiona:1});
});

test('Wiarygodne role mogą głosować mimo nieustalonej płci, a konflikty wstrzymują głos', () => {
  const { wyniki,kontekstListy } = lista([
    'Niki Nowak','Ala TestowyA 04222900014','Ala TestowyB 04222900021',
    'Anna Jan TestowyC','Anna TestowyD 04222900021 01.03.2004','Anna TestowyE 01.03.2004 02.03.2004'
  ]);
  assert.equal(wyniki[0].kategoriaAutomatyczna,'Do weryfikacji');
  assert.deepEqual(kontekstListy.glosy,{imiona_nazwiska:2,nazwiska_imiona:0});
  assert.equal(kontekstListy.liczbaRekordowPorownywalnych,6);
});

test('Brak lub pusty słownik opcjonalny wyłącza głosowanie i zachowuje wyniki wierszy', () => {
  for (const [n,z] of [[null,zdrobnienia],[nazwiska,null],[null,null],[{nazwiska:{}},zdrobnienia],[nazwiska,{zdrobnienia:{}}]]) {
    const niepelny = utworzKlasyfikator(imiona,n,z);
    const tekst = probka(12,0).join('\n');
    const { wyniki,kontekstListy } = niepelny.analizujListe(tekst,ANALIZA);
    assert.equal(kontekstListy.status,'brak_slownikow');
    assert.equal(kontekstListy.uklad,null);
    assert.equal(kontekstListy.pokrycie,null);
    assert.deepEqual(kontekstListy.glosy,{imiona_nazwiska:0,nazwiska_imiona:0});
    assert.deepEqual(wyniki.map(({kontekstKolejnosci,...w})=>w),niepelny.klasyfikujListe(tekst));
  }
});

test('Raport jest opcjonalny, a puste listy i listy bez głosów mają jawne metadane', () => {
  const tekst = probka(12,0).join('\n');
  const wylaczony = k.analizujListe(tekst);
  assert.equal(wylaczony.kontekstListy.status,'wylaczony');
  assert.equal(wylaczony.kontekstListy.uklad,null);
  assert.equal(wylaczony.kontekstListy.pokrycie,null);
  assert.deepEqual(wylaczony,k.analizujListe(tekst,{kontekstKolejnosci:false}));
  const pusty = lista([' ','','\t']);
  assert.deepEqual(pusty.wyniki,[]);
  assert.equal(pusty.kontekstListy.status,'za_malo_glosow');
  assert.equal(pusty.kontekstListy.pokrycie,null);
  const bezGlosow = lista(['Xyz Qqq','Nowak Witek']);
  assert.equal(bezGlosow.kontekstListy.pokrycie,0);
  assert.equal(bezGlosow.kontekstListy.udzialDominujacego,null);
  assert.throws(()=>k.analizujListe(null,ANALIZA),TypeError);
});

test('Układ zmienia tylko dopuszczalne role i zachowuje klasyfikację oraz kolejność wyników', () => {
  const wiersze = [...probka(18,2), 'Marek Roman', 'Anna Marek Nowak','Anna Witek Nowak',
    'Jan Nowak Witek','Witek Nowak Jan','Kowalska-Nowak Anna-Maria','Kowalski Jan','Pawelek Witek-Nowak',''];
  const tekst = wiersze.join('\r\n');
  const { wyniki,kontekstListy } = k.analizujListe(tekst,ANALIZA);
  assert.equal(kontekstListy.uklad,IMIONA_NAZWISKA);
  const niezalezne = k.klasyfikujListe(tekst);
  assert.equal(kontekstListy.liczbaZmienionychRekordow,2);
  assert.deepEqual(wyniki.filter(w=>w.kontekstKolejnosci).map(w=>w.oryginalnyWiersz),['Marek Roman','Jan Nowak Witek']);
  for (const [i, wynik] of wyniki.entries()) {
    const { kontekstKolejnosci, ...w } = wynik;
    const przed = niezalezne[i];
    if (!kontekstKolejnosci) assert.deepEqual(w,przed);
    assert.deepEqual([w.oryginalnyWiersz,w.numerWiersza,w.kategoriaAutomatyczna,w.zrodlo],
      [przed.oryginalnyWiersz,przed.numerWiersza,przed.kategoriaAutomatyczna,przed.zrodlo]);
  }
  assert.deepEqual(podsumuj(wyniki),podsumuj(niezalezne));
  assert.deepEqual(wyniki.find(w=>w.oryginalnyWiersz==='Kowalski Jan').jednostkiTekstowe.map(j=>j.rola),['nazwisko','imie']);
  assert.equal(niezalezne[0].kontekstKolejnosci,undefined);
});

const KOD_ROLI_Z_LISTY = 'KONTEKST_KOLEJNOSCI_LISTY';
const uwagiZListy = w => pobierzKomunikaty(w).informacyjne.filter(u=>u.kod===KOD_ROLI_Z_LISTY);

test('Drugi przebieg z układem imiona-nazwiska synchronizuje role i diagnostykę dwóch lub więcej jednostek', () => {
  const { wyniki } = lista([...probka(12,0),'Marek Roman','Jan Nowak Witek','Jan Gąsienica-Daniel Witek']);
  const [para, trio, grupa] = wyniki.slice(-3);
  assert.deepEqual(para.kontekstKolejnosci, { uklad:IMIONA_NAZWISKA, zmiany:[
    { pozycje:[0], rolaPrzed:'nierozstrzygnieta', rolaPo:'imie', podstawaPrzed:null },
    { pozycje:[1], rolaPrzed:'nierozstrzygnieta', rolaPo:'nazwisko', podstawaPrzed:null }
  ] });
  for (const [wynik,role,pozycje] of [[para,['imie','nazwisko'],[0,1]], [trio,['imie','nazwisko','nazwisko'],[2]],
      [grupa,['imie','nazwisko','nazwisko'],[3]]]) {
    assert.deepEqual(wynik.jednostkiTekstowe.map(j=>j.rola),role);
    for (const j of wynik.jednostkiTekstowe.filter(x=>pozycje.includes(x.pozycja))) {
      assert.equal(j.podstawaRoli,KOD_ROLI_Z_LISTY);
      assert.equal(j.pewnoscRoli,'srednia');
      const czlon = wynik.czlonyTekstowe.find(c=>c.pozycja===j.pozycja);
      assert.equal(czlon.rola,j.rola);
      assert.equal(czlon.podstawaRoli,KOD_ROLI_Z_LISTY);
      const nazwisko = wynik.rozpoznaneNazwiska.find(n=>n.pozycja===j.pozycja);
      assert.equal(nazwisko.rola,j.rola);
      assert.equal(nazwisko.uwzglednione,false);
      assert.equal(wynik.rozpoznaneImiona.find(w=>w.pozycja===j.pozycja).uwzglednione,j.rola==='imie');
    }
    const uwagi = uwagiZListy(wynik);
    assert.equal(uwagi.length,1);
    assert.equal(uwagi[0].severity,'medium');
    assert.deepEqual(uwagi[0].pozycje,pozycje);
    assert.deepEqual(wynik.wskazania,{kobieta:0,mezczyzna:1,niejednoznaczne:0});
    assert.equal(wynik.kategoriaAutomatyczna,'Mężczyzna');
    assert.equal(wynik.zrodlo,'imiona');
  }
  assert.equal(trio.rozpoznaneZdrobnienia[0].rola,'nazwisko');
  assert.equal(trio.rozpoznaneZdrobnienia[0].kontekst,null);
  assert.deepEqual(grupa.grupyZlozone,k.klasyfikujWiersz(grupa.oryginalnyWiersz).grupyZlozone);
});

test('Drugi przebieg działa dla układu nazwiska-imiona i respektuje lokalne odwrócenie', () => {
  const wiersze = [...probka(0,12),'Marek Roman','Witek Nowak Jan','Jan Nowak Witek','Jan Nowak'];
  const { wyniki,kontekstListy } = lista(wiersze);
  assert.deepEqual(kontekstListy.glosy,{imiona_nazwiska:1,nazwiska_imiona:12});
  assert.equal(kontekstListy.liczbaZmienionychRekordow,2);
  assert.deepEqual(wyniki.at(-4).jednostkiTekstowe.map(j=>j.rola),['nazwisko','imie']);
  assert.deepEqual(wyniki.at(-3).jednostkiTekstowe.map(j=>j.rola),['nazwisko','nazwisko','imie']);
  assert.equal(wyniki.at(-2).kontekstKolejnosci,null);
  assert.equal(wyniki.at(-1).kontekstKolejnosci,null);
  assert.match(uwagiZListy(wyniki.at(-4))[0].opis,/nazwiska przed imionami/);
});

test('Drugi przebieg wymaga wszystkich progów, także przy dokładnie 85% udziału i 50% pokrycia', () => {
  for (const [probki, status] of [
    [probka(11,0),'za_malo_glosow'], [probka(16,3),'lista_mieszana'],
    [probka(17,3,20),'za_male_pokrycie'], [probka(17,3,19),'dominujacy']
  ]) {
    const { wyniki,kontekstListy } = lista([...probki,'Marek Roman']);
    const ostatni = wyniki.at(-1);
    assert.equal(kontekstListy.status,status);
    assert.equal(kontekstListy.liczbaZmienionychRekordow,Number(status==='dominujacy'));
    if (status==='dominujacy') assert.equal(ostatni.kontekstKolejnosci.uklad,IMIONA_NAZWISKA);
    else {
      assert.equal(ostatni.kontekstKolejnosci,null);
      assert.equal(uwagiZListy(ostatni).length,0);
    }
  }
});

test('Drugi przebieg pomija nieznane człony, grupy, kilka granic i słabe role lokalne', () => {
  const przypadki = ['Jan Witek Nowak','Jan Nowak Xyz','Jan Nowak Witek-Nieznany','Marek Xyz',
    'Roman Nowak Witek','Jan Nowak Nieznany Witek', 'Jan Witek Witek Nowak'];
  const { wyniki } = lista([...probka(17,3),...przypadki]);
  for (const w of wyniki.slice(-przypadki.length)) {
    assert.equal(w.kontekstKolejnosci,null,w.oryginalnyWiersz);
    assert.equal(uwagiZListy(w).length,0,w.oryginalnyWiersz);
  }
});

test('Drugi przebieg odrzuca zmianę, jeżeli pozostałe wskazania nie wystarczają albo nazwisko jest przeciwne', () => {
  const alternatywa = utworzKlasyfikator({imiona:{...imiona.imiona, MAREK:[100,900], BARTEK:[0,1000]}},
    {nazwiska:{...nazwiska.nazwiska, BARTEK:[1000,0]}},zdrobnienia);
  const wiersze = [...probka(17,3),'Marek Roman','Roman Bartek'];
  const { wyniki } = alternatywa.analizujListe(wiersze.join('\n'),ANALIZA);
  for (const w of wyniki.slice(-2)) {
    assert.equal(w.kategoriaAutomatyczna,'Mężczyzna',w.oryginalnyWiersz);
    assert.equal(w.zrodlo,'imiona');
    assert.ok(w.jednostkiTekstowe.every(j=>j.rola==='nierozstrzygnieta'));
    assert.equal(w.kontekstKolejnosci,null);
    assert.equal(uwagiZListy(w).length,0);
  }
});

test('Zgodne silne statystyki nazwiska wyznaczonego przez listę służą wyłącznie diagnostyce', () => {
  const alternatywa = utworzKlasyfikator(imiona,{nazwiska:{...nazwiska.nazwiska,ROMAN:[0,1000]}},zdrobnienia);
  const { wyniki } = alternatywa.analizujListe([...probka(12,0),'Marek Roman'].join('\n'),ANALIZA);
  const wynik = wyniki.at(-1);
  const roman = wynik.rozpoznaneNazwiska.find(n=>n.klucz==='ROMAN');
  assert.equal(roman.rola,'nazwisko');
  assert.equal(roman.statystyki.silneWskazanie,true);
  assert.equal(roman.uwzglednione,false);
  assert.equal(wynik.zrodlo,'imiona');
});

test('Drugi przebieg zachowuje konflikty, datę urodzenia, wiek i PESEL', () => {
  const wiersze = [...probka(17,3),'Anna Marek Nowak','Anna Witek Nowak','Marek Roman 04222900021',
    'Marek Roman 04222900014','Jan Nowak Witek 31.02.2004','Jan Nowak Witek 04222900014 01.03.2004',
    'Jan Nowak Witek 29.02.2004','Pawelek Witek-Nowak','Marek Roman 12345678901'];
  const tekst = wiersze.join('\n');
  const { wyniki } = k.analizujListe(tekst,ANALIZA);
  const bezKontekstu = k.analizujListe(tekst,{kontekstKolejnosci:false}).wyniki;
  for (const [i,w] of wyniki.entries()) {
    const przed = bezKontekstu[i];
    assert.deepEqual([w.kategoriaAutomatyczna,w.zrodlo,w.pesel,w.urodzenie],
      [przed.kategoriaAutomatyczna,przed.zrodlo,przed.pesel,przed.urodzenie],w.oryginalnyWiersz);
    assert.deepEqual(obliczWiek(w,'2026-03-03'),obliczWiek(przed,'2026-03-03'));
    if (w.ostrzezenia.some(s=>s.startsWith('KONFLIKT') || s==='SPRZECZNE_IMIONA') || w.urodzenie.uwagi.length)
      assert.deepEqual(w,przed);
  }
  assert.deepEqual(wyniki.filter(w=>w.kontekstKolejnosci).map(w=>w.oryginalnyWiersz),
    ['Marek Roman 04222900014','Jan Nowak Witek 29.02.2004']);
});

test('Ręczne rozstrzygnięcie ma priorytet i zachowuje informację o rolach z listy', () => {
  const automat = lista([...probka(12,0),'Marek Roman']).wyniki.at(-1);
  for (const kategoria of ['Kobieta','Do weryfikacji']) {
    const wynik = ustawKlasyfikacjeReczna(automat,kategoria);
    assert.equal(pobierzKategorie(wynik),kategoria);
    assert.equal(wynik.kategoriaAutomatyczna,'Mężczyzna');
    assert.deepEqual(wynik.kontekstKolejnosci,automat.kontekstKolejnosci);
    assert.equal(uwagiZListy(wynik).length,1);
    assert.equal(pobierzKategorie(ustawKlasyfikacjeReczna(wynik,null)),'Mężczyzna');
  }
});

test('Zmiany z drugiego przebiegu pozostają poza głosowaniem i nie zależą od kolejności ani poprzednich list', () => {
  const wiersze = [...probka(17,3),'Marek Roman','Jan Nowak Witek','Marek Roman','Nowak Anna Maria','Anna Witek Nowak'];
  const prosto = lista(wiersze);
  const odwrotnie = lista([...wiersze].reverse());
  assert.deepEqual(odwrotnie.kontekstListy,prosto.kontekstListy);
  const sprawdz = ({wyniki}) => wyniki.map(({numerWiersza,...w})=>w);
  assert.deepEqual(sprawdz(odwrotnie).reverse(),sprawdz(prosto));
  assert.deepEqual(prosto.kontekstListy.glosy,{imiona_nazwiska:17,nazwiska_imiona:4});
  assert.equal(prosto.kontekstListy.liczbaZmienionychRekordow,0);
  const dominujaca = wiersze.filter(w=>w!=='Nowak Anna Maria');
  assert.equal(lista(dominujaca).kontekstListy.liczbaZmienionychRekordow,3);
  assert.equal(lista(['Marek Roman']).wyniki[0].kontekstKolejnosci,null);
  assert.deepEqual(lista(wiersze),prosto);
});

test('Kontekst jest niezależny od kolejności wierszy i poprzednich analiz', () => {
  const wiersze = [...probka(17,3,10),'  ANNA testowyA', 'TestowyR Anna'];
  const pierwszy = lista(wiersze);
  assert.equal(pierwszy.kontekstListy.uklad,IMIONA_NAZWISKA);
  assert.deepEqual(lista(wiersze.slice(9).concat(wiersze.slice(0,9))).kontekstListy,pierwszy.kontekstListy);
  assert.equal(lista(probka(0,12)).kontekstListy.uklad,NAZWISKA_IMIONA);
  assert.equal(lista(['Anna Nowak']).kontekstListy.uklad,null);
  assert.deepEqual(lista(wiersze),pierwszy);
});
