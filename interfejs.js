/* Warstwa interfejsu. Nie zmienia algorytmu w modułach core/.
 * Dane uczestników pozostają w pamięci strony (bez localStorage i wysyłania).
 */
(() => {
  'use strict';

  const K = 'Kobieta';
  const M = 'Mężczyzna';
  const W = 'Do weryfikacji';
  const U = 'uwagi', A = 'wiek';
  const nazwy = { [K]: 'Kobiety', [M]: 'Mężczyźni', [W]: 'Płeć do weryfikacji', [U]: 'Wpisy wymagające sprawdzenia', [A]: 'Nieustalony wiek' };

  // API ustala ważność; interfejs mapuje ją wyłącznie na kolejność i wygląd.
  const KOLEJNOSC_WAZNOSCI = Object.freeze({ low: 1, medium: 2, high: 3 });
  const ETYKIETY_WAZNOSCI = { 0: 'Nieokreślona ważność', 1: 'Niska ważność', 2: 'Średnia ważność', 3: 'Wysoka ważność' };
  // API nie eksportuje wartości liczbowych progów. Etykiety opisują przedziały
  // z dokumentacji; status zawsze pochodzi z flag progOsiagniety i uwagaProgowa.
  const ETYKIETA_PROGU = '99,90%';
  const ETYKIETA_PRZEDZIALU_PROGOWEGO = 'Osiągnięty (' + ETYKIETA_PROGU + ' do poniżej 99,98%)';
  const formatProcentu = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 4 });
  const formatLiczby = new Intl.NumberFormat('pl-PL', { useGrouping: 'always' });
  const ROLE_CZLONOW = { imie: 'Imię', nazwisko: 'Nazwisko', nierozstrzygnieta: 'Nierozstrzygnięta' };
  const PODSTAWY_ROLI = Object.freeze({
    TYLKO_IMIE: 'Imię (dopasowanie do słownika imion)',
    TYLKO_NAZWISKO: 'Nazwisko (dopasowanie wyłącznie do słownika nazwisk)',
    PRZEWAGA_NAZWISKA: 'Nazwisko (co najmniej 50-krotna przewaga w statystykach)',
    PRZEWAGA_IMIENIA_50: 'Imię (co najmniej 50-krotna przewaga w statystykach)',
    KONTEKST_IMIENIA_DWA_CZLONY: 'Prawdopodobne imię (kontekst dwóch członów)',
    KONTEKST_NAZWISKA_DWA_CZLONY: 'Prawdopodobne nazwisko (kontekst dwóch członów)',
    TYLKO_ZDROBNIENIE: 'Prawdopodobne imię (dopasowanie wyłącznie do zdrobnień)',
    PRZEWAGA_IMIENIA_30: 'Imię (co najmniej 30-krotna przewaga w statystykach)',
    PRZEWAGA_IMIENIA_10_DWA_CZLONY: 'Imię (przewaga w statystykach i kontekst dwóch członów)',
    PRZEWAGA_IMIENIA_10_Z_NAZWISKIEM: 'Imię (przewaga w statystykach i rozpoznane nazwisko)',
    KONTEKST_DWOCH_CZLONOW: 'Prawdopodobne imię (kontekst dwóch członów)',
    KONTEKST_ZDROBNIENIA: 'Prawdopodobne imię',
    PELNE_IMIE_ZLOZONE: 'Imię złożone (pełne dopasowanie do słownika imion)',
    PELNE_NAZWISKO_ZLOZONE: 'Nazwisko złożone (pełne dopasowanie do słownika nazwisk)',
    NAZWISKO_ZLOZONE_Z_CZESCI: 'Nazwisko złożone (rozpoznanie po częściach)',
    IMIENNE_ROLE_CZESCI: 'Imię złożone (rozpoznanie po częściach)'
  });
  const PEWNOSC_ROLI = Object.freeze({ wysoka: 'wysoka', srednia: 'średnia', nieustalona: 'nieustalona' });
  const ANALIZA_GRUPY = Object.freeze({
    pelne_statystyki_imienia: 'Jedno wskazanie na podstawie statystyk całego imienia.',
    pelne_statystyki_nazwiska: 'Statystyki całego nazwiska mogą wspierać klasyfikację płci.',
    statystyki_czesci_imienia: 'Wskazania uwzględnionych części imienia oceniane osobno, bez łączenia statystyk.',
    pominieta: 'Statystyki grupy i jej części nie są wskazaniami płci.'
  });
  const OBSZARY_UWAG = { plec: 'Płeć', wiek: 'Wiek', dane: 'Dane' };
  const UKLADY_LISTY = Object.freeze({ imiona_nazwiska: 'Imiona - nazwiska', nazwiska_imiona: 'Nazwiska - imiona' });
  const KOMUNIKAT_ANALIZY = 'Analiza zakończona. Możesz przejrzeć wyniki w każdej z trzech kategorii. Zmiana daty wydarzenia lub ustawień progów wiekowych automatycznie aktualizuje wyniki. Ponowna analiza jest potrzebna po zmianie listy uczestników w głównym polu lub ustawienia kontekstu kolejności listy.';

  // Fikcyjne dane demonstracyjne; wpisanie przykładu nie uruchamia analizy.
  const PRZYKLAD_POPRAWNY = `Patryk Michalski 01810199012
Magdalena Kaczmarek 2019-02-02
Damian Pawlak 2017-03-03
Krzysztof Kowalczyk 2016-04-04
Paweł Lewandowski 2015-05-05
Agnieszka Lewandowska 36820499108
Przemysław Piotrowski 2014-07-07
Alicja Król 2013-08-08
Zofia Kamińska 2012-09-09
Aleksandra Wójcik 2011-01-10
Joanna Woźniak 21830799205
Piotr Kowalski 2010-03-12
Ewa Dąbrowska 2009-04-13
Maria Wiśniewska 2008-05-14
Szymon Król 2007-06-15
Marta Pawlak 06841099302
Bartosz Krawczyk 2005-08-17
Wojciech Piotrowski 2002-09-18
Tomasz Wiśniewski 2001-01-19
Karolina Mazur 1996-02-20
Dominika Michalska 41851399404
Jan Nowicki 1987-04-22
Bernard Jankowski 1981-05-23
Mateusz Woźniak 1967-06-24
Anna Kowalska 1966-07-25
Rafał Jankowski 26861699519
Michał Wójcik 1961-09-27
Weronika Krawczyk 1956-01-01
Monika Zielińska 2018-02-02
Adam Zieliński 2014-03-03
Jakub Kamiński 11871999616
Marcin Szymański 2012-05-05
Katarzyna Nowak 2009-06-06
Grzegorz Kaczmarek 2008-07-07
Natalia Szymańska 2002-08-08
Filip Mazur 46882299718
Łukasz Dąbrowski 2001-01-10
Kamil Grabowski 1986-02-11
Oliwia Grabowska 1964-03-12
Julia Kowalczyk 1957-04-13`;
  const PRZYKLAD_Z_BLEDAMI = `Anna Kowalska 12.05.2008
Jan Nowak 31.02.2014
Wiśniewska Katarzyna 2016-06-01
Piotr Zieliński 12/04/2010 13/04/2010
Maria Magdalena Wójcik 4.5.2012
Krzysztof Paweł Kamiński 2020-03-01
31892599808 Aleksandra Lewandowska 01.01.2000
Tomasz 48821099836 Dąbrowski 31.02.1848
Julia Zając 15872199846 21.07.1815
32920699879 Michał Szymański
Agnieszka Kaczmarek 2035-01-01
Witek Nowak
Monika Anna Mazur 2006-12-01
Patryk Klimek
49851799880 Ewa Nowicka
Adam 16900299015 Kowalczyk
Zofia Jankowska 33831399025
50882499054 Marcin Pawlak
Lukasz Wrobel
Malgorzata Dabrowska
Nikola Kowalska
Jan Kowalska
17810999064 Weronika Sikora
34862099092 Bartosz Michalski
Amelia Wysocka
Filip Sokołowski
01910599105 Alicja Nowak
18841699130 Wojciech Kowalski
Oliwia Zielińska 35890199145
02821299177 Kamil Wiśniewski
Joanna Kowalczyk 19872399183
36920899215 Damian Pawłowski
Alex Morgan 2009-03-21
Sasza Nowak
Andrea Rossi
Dominika Tomaszewska
Patryk Anna Wiśniewski
Xyz Qwertowski
Kowalski
12345678901 Jan Malinowski 2010-10-12`;
  const $ = id => document.getElementById(id);
  const api = window.KlasyfikatorUczestnikow;
  const textarea = $('participants');
  const status = $('status');
  const resultsSection = $('results');
  const list = $('result-list');
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const dataWydarzenia = $('event-date');
  const statystykiWlaczone = $('age-enabled');
  const progiWlasne = $('custom-thresholds');
  const kontekstWlaczony = $('list-context');

  let klasyfikator = null;
  let wyniki = [];
  let wybranaKategoria = W;
  let edytowanyWiersz = null;
  let zmienionyTekst = false;
  let metryki = new Map();
  let dzien = '';
  let szkicEdycji = null;
  let kontekstListy = null;

  function ustawDzisiejszaDate() {
    const teraz = new Date();
    dataWydarzenia.value = [teraz.getFullYear(), String(teraz.getMonth() + 1).padStart(2, '0'), String(teraz.getDate()).padStart(2, '0')].join('-');
    dzien = dataWydarzenia.value;
  }

  function formatujDate(iso) {
    return iso ? iso.split('-').reverse().join('.') : '-';
  }

  function progi() {
    return document.querySelector('input[name="age-mode"]:checked').value === 'custom'
      ? api.parsujProgi(progiWlasne.value) : api.PROGI_TURYSTYCZNE;
  }

  function odswiezOpcjeWiekowe() {
    $('age-options').hidden = !statystykiWlaczone.checked;
    const wlasne = document.querySelector('input[name="age-mode"]:checked').value === 'custom';
    $('custom-options').hidden = !wlasne;
    progiWlasne.disabled = !statystykiWlaczone.checked || !wlasne;
    if (api && typeof api.parsujProgi === 'function' && wlasne) {
      const lista = api.parsujProgi(progiWlasne.value);
      $('threshold-preview').textContent = lista.length ? 'Uwzględnione progi: ' + lista.join(', ') : 'Wpisz co najmniej jeden próg.';
    }
    if (klasyfikator && !resultsSection.hidden && !zmienionyTekst) pokazStatystyki();
  }

  function ustawEtykieteAnalizy() {
    $('analyze-button').textContent = wyniki.length ? 'Ponownie analizuj listę' : 'Analizuj listę';
  }

  function resetujWyniki() {
    wyniki = [];
    kontekstListy = null;
    $('list-context-report').hidden = true;
    metryki.clear();
    list.replaceChildren();
    $('age-stats-rows').replaceChildren();
    $('info-notes-list').replaceChildren();
    $('info-notes').open = false;
    $('info-notes').hidden = true;
    szkicEdycji = null;
    edytowanyWiersz = null;
    zmienionyTekst = false;
    wybranaKategoria = W;
    resultsSection.hidden = true;
    ustawEtykieteAnalizy();
  }

  function wstawPrzyklad(tekst, rodzaj) {
    if ((textarea.value.trim() || wyniki.length) &&
        !window.confirm('Wstawić dane przykładowe? Obecna lista, wyniki i ręczne przypisania płci zostaną zastąpione.')) return;
    textarea.value = tekst;
    resetujWyniki();
    komunikat('Wstawiono przykład: ' + rodzaj + ' (40 uczestników). Kliknij „Analizuj listę”, aby zobaczyć wyniki.');
    textarea.focus();
  }

  function komunikat(tekst, blad = false) {
    status.textContent = tekst;
    status.classList.toggle('error', blad);
  }

  async function wczytajSlownik() {
    if (!api) {
      komunikat('Nie udało się uruchomić klasyfikatora. Sprawdź kompletność modułów w katalogu core/.', true);
      return;
    }
    if (typeof api.obliczWiek !== 'function' || typeof api.statystykiWiekowe !== 'function' ||
        typeof api.parsujProgi !== 'function' || typeof api.pobierzKomunikaty !== 'function' || !Array.isArray(api.PROGI_TURYSTYCZNE)) {
      komunikat('Interfejs 1.2.5 wymaga aktualnych modułów klasyfikatora w katalogu core/.', true);
      return;
    }
    $('tourism-thresholds').textContent = api.PROGI_TURYSTYCZNE.join(', ') + ' lat';
    try {
      const slowniki = await Promise.all(['imiona', 'nazwiska', 'zdrobnienia'].map(async nazwa => {
        try {
          const odpowiedz = await fetch('./' + nazwa + '.json', { cache: 'no-store' });
          if (!odpowiedz.ok) throw new Error('HTTP ' + odpowiedz.status);
          const json = await odpowiedz.json();
          if (!json || !json[nazwa] || typeof json[nazwa] !== 'object' || Array.isArray(json[nazwa])) {
            throw new Error('Nieprawidłowa struktura słownika.');
          }
          return json;
        } catch (error) {
          throw new Error(nazwa + '.json: ' + error.message);
        }
      }));
      const nowy = api.utworzKlasyfikator(...slowniki);
      if (typeof nowy.analizujListe !== 'function') throw new Error('Wymagana jest logika klasyfikatora w wersji 1.2.5.');
      // Sprawdź zgodność struktury wyniku z aktualnym API.
      const kontrola = nowy.klasyfikujWiersz('Test Test 1234567890');
      const kontrolaKomunikatow = api.pobierzKomunikaty(kontrola, null);
      const kontrolaListy = nowy.analizujListe('Test Test');
      if (!Array.isArray(kontrola.czlonyTekstowe) || !Array.isArray(kontrola.rozpoznaneNazwiska) ||
          !Array.isArray(kontrola.rozpoznaneZdrobnienia) || !kontrola.czlonyTekstowe.every(c => 'rolaWstepna' in c) ||
          !Array.isArray(kontrola.grupyZlozone) || !Array.isArray(kontrola.jednostkiTekstowe) ||
          !kontrola.jednostkiTekstowe.every(u => Array.isArray(u.pozycje) && 'pewnoscRoli' in u) ||
          kontrolaListy.kontekstListy?.status !== 'wylaczony' || !kontrolaListy.kontekstListy.progi ||
          !Array.isArray(kontrolaListy.wyniki) || kontrolaListy.wyniki[0]?.kontekstKolejnosci !== null ||
          !kontrolaKomunikatow.doWeryfikacji.some(u => u.powiazane?.some(p => p.obszar === 'wiek' && p.wymagaWeryfikacji === true)))
        throw new Error('Wymagana jest logika klasyfikatora w wersji 1.2.5.');
      klasyfikator = nowy;
      $('analyze-button').disabled = false;
      komunikat('Wczytano słowniki: ' + ['imiona', 'nazwiska', 'zdrobnienia'].map((nazwa, i) =>
        nazwa + ' - ' + formatLiczby.format(Object.keys(slowniki[i][nazwa]).length)).join(', ') + '. Możesz rozpocząć analizę.');
    } catch (error) {
      komunikat('Nie udało się uruchomić klasyfikatora. Sprawdź trzy słowniki oraz moduły w katalogu core/. Przy otwieraniu z dysku użyj lokalnego serwera HTTP. (' + error.message + ')', true);
    }
  }

  function element(tag, className, tekst) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (tekst !== undefined) el.textContent = String(tekst);
    return el;
  }

  function przycisk(tekst, klasa, akcja) {
    const el = element('button', klasa, tekst);
    el.type = 'button';
    el.addEventListener('click', akcja);
    return el;
  }

  function kategoria(wynik) {
    return api.pobierzKategorie(wynik);
  }

  function opisPodstawy(wynik) {
    if (wynik.klasyfikacjaReczna !== null) return 'Decyzja ręczna';
    if (wynik.zrodlo === 'pesel') return 'PESEL po walidacji';
    if (wynik.zrodlo === 'imiona_i_nazwisko') return 'Imię i nazwisko';
    if (wynik.zrodlo === 'zdrobnienia') return 'Na podstawie zdrobnienia';
    if (wynik.zrodlo === 'imiona') {
      const wskazujace = wynik.rozpoznaneImiona
        .filter(imie => imie.uwzglednione !== false && imie.plec === wynik.kategoriaAutomatyczna);
      const imiona = wynik.jednostkiTekstowe
        .filter(u => wskazujace.some(i => u.pozycje.includes(i.pozycja)))
        .map(u => u.tekst);
      return 'Imię: ' + [...new Set(imiona)].join(', ');
    }
    return 'Wymaga sprawdzenia';
  }

  function doprecyzujPesel(tekst) {
    return tekst.replace(/z poprawnego PESEL/g, 'z numeru PESEL, który przeszedł walidację')
      .replace(/na podstawie poprawnego PESEL/g, 'na podstawie numeru PESEL, który przeszedł walidację')
      .replace(/niż poprawny PESEL/g, 'niż numer PESEL, który przeszedł walidację')
      .replace(/Płeć ustalono z PESEL/g, 'Płeć ustalono na podstawie numeru PESEL, który przeszedł walidację')
      .replace(/płcią ustaloną z PESEL\./g, 'płcią ustaloną z numeru PESEL, który przeszedł walidację.');
  }

  function opisKomunikatu(wynik, uwaga) {
    // API przekazuje kompletne statystyki i uzasadnienie wykorzystania zdrobnienia.
    if (uwaga.kod === 'MOZLIWE_ZDROBNIENIE') {
      const znacznik = ' Możliwe pełne odpowiedniki i statystyki imion: ';
      const pozycja = uwaga.opis.indexOf(znacznik);
      if (pozycja === -1) return uwaga.opis;
      const poczatek = pozycja + znacznik.length;
      // Formatujemy tylko część statystyczną, bez zmiany uzasadnienia, imienia
      // wpisanego przez użytkownika ani informacji o braku danych.
      return uwaga.opis.slice(0, poczatek) + uwaga.opis.slice(poczatek)
        .replace(/(^|; )([\p{L}\p{M}'’ -]+) - /gu, (_, separator, imie) => separator + ladnaNazwa(imie) + ' - ')
        .replace(/\b\d{4,}\b/g, liczba => formatLiczby.format(Number(liczba)));
    }
    // Nazwy dopasowań pochodzą z API, a kod określa rodzaj komunikatu.
    const imiona = wynik.rozpoznaneImiona.filter(i => i.uwzglednione !== false);
    const nazwyImion = predykat => [...new Set(imiona.filter(predykat).map(i => i.tekst))].join(', ');
    const slabe = i => !i.statystyki.progOsiagniety;
    let opis = doprecyzujPesel(uwaga.opis);
    if (uwaga.kod === 'BLEDNA_DATA') opis = opis.replace(/([^.!?]) Przyjęto /, '$1. Przyjęto ');
    if (uwaga.kod === 'PESEL_PRZECIWNE_IMIE') {
      const a = nazwyImion(i => slabe(i) && i.sugestia && i.sugestia !== wynik.kategoriaAutomatyczna);
      if (a) opis = opis.replace(/imienia poniżej progu|Imię poniżej progu/, m => m + ' (' + a + ')');
    } else if (uwaga.kod === 'BLEDNY_PESEL') {
      const bledy = wynik.pesel.znalezione.filter(n => n.bledy.length).map(n => '„' + n.numer + '”: ' + n.bledy.join(' '));
      if (bledy.length) opis = opis.replace('Szczegóły w wyniku sprawdzenia numeru.', bledy.join(' '));
    } else if (['ROLA_IMIENIA_ZE_STATYSTYK', 'ROLA_IMIENIA_Z_KONTEKSTU',
      'ROLA_NAZWISKA_Z_KONTEKSTU', 'NIEROZSTRZYGNIETA_ROLA'].includes(uwaga.kod)) {
      const dopasowanie = x => !x.czescGrupy && x.klucz === uwaga.klucz &&
        (!uwaga.pozycje || uwaga.pozycje.includes(x.pozycja));
      const i = wynik.rozpoznaneImiona.find(dopasowanie);
      const n = wynik.rozpoznaneNazwiska.find(dopasowanie);
      const z = wynik.rozpoznaneZdrobnienia.find(dopasowanie);
      if (i && n) opis += ' W słownikach: imię - ' + liczebnosc(i.statystyki) +
        '; nazwisko - ' + liczebnosc(n.statystyki) + '.';
      else if (z && n) opis += ' W słownikach: brak wpisu samodzielnego imienia; nazwisko - ' + liczebnosc(n.statystyki) +
        '; zdrobnienie - możliwe pełne formy: ' + z.odpowiedniki.map(o => ladnaNazwa(o.klucz)).join(', ') + '.';
    } else if (uwaga.kod === 'KLASYFIKACJA_WSPARTA_NAZWISKIEM') {
      const nazwiska = wynik.rozpoznaneNazwiska.filter(n => n.uwzglednione !== false && n.rola === 'nazwisko' && n.statystyki.silneWskazanie);
      opis += ' Rozpoznane imiona: ' + imiona.map(i => i.tekst + ' - ' + liczebnosc(i.statystyki)).join('; ') +
        '. Nazwiska o silnym wskazaniu: ' + nazwiska.map(n => n.tekst + ' - ' + liczebnosc(n.statystyki)).join('; ') + '.';
    } else if (uwaga.kod === 'NAZWISKO_PRZECIWNE_WYNIKOWI') {
      const n = wynik.rozpoznaneNazwiska.find(n => n.uwzglednione !== false && n.rola === 'nazwisko' &&
        n.klucz === uwaga.klucz && (!uwaga.pozycje || uwaga.pozycje.includes(n.pozycja)));
      if (n) opis += ' Wystąpienia nazwiska: ' + liczebnosc(n.statystyki) + '.';
    }
    return opis;
  }

  function ladnaNazwa(klucz) {
    return klucz.charAt(0).toLocaleUpperCase('pl-PL') + klucz.slice(1).toLocaleLowerCase('pl-PL');
  }

  function liczebnosc(s) {
    return s == null ? 'brak wpisu w słowniku' : formatLiczby.format(s.kobiety + s.mezczyzni) +
      ' (kobiety: ' + formatLiczby.format(s.kobiety) + ', mężczyźni: ' + formatLiczby.format(s.mezczyzni) + ')';
  }

  function przeliczMetryki() {
    metryki = new Map(wyniki.map(w => {
      const wynikWieku = api.obliczWiek(w, dzien);
      return [w.numerWiersza, { wiek: wynikWieku.wiek, ...api.pobierzKomunikaty(w, dzien) }];
    }));
  }

  // Powiązane powody są częścią jednego komunikatu. Liczymy tylko te, które
  // nadal wymagają decyzji; nie tworzymy z nich dodatkowych kart ani uwag.
  function aktywnePrzyczyny(uwaga) {
    return [uwaga, ...(uwaga.powiazane ?? []).filter(p => p.wymagaWeryfikacji === true)];
  }

  function pokazStatystyki() {
    $('age-stats').hidden = !statystykiWlaczone.checked;
    if (!statystykiWlaczone.checked) return;
    const stat = api.statystykiWiekowe(wyniki, dzien, progi());
    $('age-stats-date').textContent = stat.dataWydarzenia ? 'Stan na dzień: ' + formatujDate(stat.dataWydarzenia) : 'Nie podano daty wydarzenia.';
    $('age-stats-empty').hidden = stat.progi.length > 0;
    $('age-table-wrap').hidden = !stat.progi.length;
    $('age-stats-rows').replaceChildren(...stat.progi.map(p => {
      const tr = element('tr');
      const th = element('th', '', p.prog + ' lat');
      th.scope = 'row';
      tr.append(th, element('td', '', p.ponizej), element('td', '', p.coNajmniej));
      return tr;
    }));
    $('age-stats-unknown').textContent = 'Nieustalony wiek: ' + stat.nieustalony + ' z ' + stat.razem + ' uczestników.';
  }

  function listaUwag(wynik, uwagi, informacyjne = false, rozneWaznosci = informacyjne && new Set(uwagi.map(u => u.severity)).size > 1) {
    const ul = element('ul', (informacyjne ? 'info-messages' : 'record-notes') +
      (uwagi.some(u => u.severity === 'high') ? ' priority-notes' : ''));
    for (const uwaga of uwagi) {
      const obszar = [...new Set(aktywnePrzyczyny(uwaga).map(p => OBSZARY_UWAG[p.obszar] ?? p.obszar))].join(' i ').replace(' i Wiek', ' i wiek');
      const wysoka = uwaga.severity === 'high';
      const li = element('li', wysoka ? 'high-warning' : '', obszar + ': ' + opisKomunikatu(wynik, uwaga));
      if (wysoka) {
        const ikona = element('span', 'high-warning-icon', '⚠︎');
        ikona.setAttribute('aria-hidden', 'true');
        li.append(ikona);
      }
      if (rozneWaznosci || wysoka) {
        const ranga = KOLEJNOSC_WAZNOSCI[uwaga.severity] ?? 0;
        li.append(element('span', 'info-message-level info-level-' + ranga, ETYKIETY_WAZNOSCI[ranga]));
      }
      if (wysoka) li.append(element('span', 'high-warning-kind', informacyjne ? 'Uwaga informacyjna' : 'Wymaga sprawdzenia'));
      ul.append(li);
    }
    return ul;
  }

  function pokazPilneUwagi(kontener, wynik, { doWeryfikacji, informacyjne }) {
    const pilne = doWeryfikacji.filter(u => u.severity === 'high');
    const pilneInformacyjne = informacyjne.filter(u => u.severity === 'high');
    if (pilne.length) kontener.append(listaUwag(wynik, pilne));
    if (pilneInformacyjne.length) kontener.append(listaUwag(wynik, pilneInformacyjne, true));
  }

  function opisRoli(czlon) {
    if (czlon?.podstawaRoli === 'KONTEKST_KOLEJNOSCI_LISTY') {
      return ROLE_CZLONOW[czlon.rola] + ' (kontekst całej listy)';
    }
    return PODSTAWY_ROLI[czlon?.podstawaRoli] ?? ROLE_CZLONOW[czlon?.rola] ?? '-';
  }

  // Pełny wpis grupy i jej pierwsza część mogą mieć ten sam indeks.
  // Wpisy części są wskazaniami tylko wtedy, gdy API tak je oznacza.
  function jednostkaDopasowania(wynik, wpis) {
    return wynik.jednostkiTekstowe.find(u => u.pozycje.includes(wpis.pozycja));
  }

  function pominieteDopasowanie(wpis, nazwiska) {
    return wpis.uwzglednione === false || (nazwiska && wpis.rola !== 'nazwisko');
  }

  function szczegolyJednostek(wynik) {
    const sekcja = element('div', 'text-units');
    sekcja.append(element('h4', 'stats-heading', 'Rozpoznane jednostki tekstowe'));
    const ul = element('ul', 'unit-list');
    for (const u of wynik.jednostkiTekstowe) {
      const zmiana = wynik.kontekstKolejnosci?.zmiany.find(z => z.pozycje.length === u.pozycje.length &&
        z.pozycje.every((p, i) => p === u.pozycje[i]));
      const li = element('li', 'text-unit' + (zmiana ? ' contextual-unit' : ''));
      li.append(element('strong', '', u.tekst),
        element('span', 'unit-meta', opisRoli(u) + ' - pewność roli: ' + (PEWNOSC_ROLI[u.pewnoscRoli] ?? '-')));
      if (zmiana) {
        li.append(element('span', 'unit-meta', 'Przed analizą listy: ' +
          (ROLE_CZLONOW[zmiana.rolaPrzed] ?? '-') + '. Układ: ' +
          (UKLADY_LISTY[wynik.kontekstKolejnosci.uklad] ?? '-')));
      }
      if (u.typ === 'grupa') {
        const grupa = wynik.grupyZlozone.find(g => g.pozycja === u.pozycja);
        if (grupa) {
          const dopasowaniaGrupy = Object.entries({ imie: 'imię', nazwisko: 'nazwisko' })
            .filter(([klucz]) => grupa.dopasowania[klucz]).map(([, etykieta]) => etykieta);
          li.append(element('span', 'unit-meta', 'Dopasowanie całej grupy: ' +
            (dopasowaniaGrupy.length ? dopasowaniaGrupy.join(', ') : 'brak wpisu w słownikach imion i nazwisk')));
          const kontekst = grupa.analizaPlci === 'pominieta' && grupa.rola === 'nazwisko'
            ? ' Grupa może stanowić kontekst nazwiska.' : '';
          li.append(element('span', 'unit-meta', (ANALIZA_GRUPY[grupa.analizaPlci] ?? '') + kontekst));
          const czesci = wynik.czlonyTekstowe.filter(c => c.czescGrupy && grupa.pozycje.includes(c.pozycja));
          const details = element('details', 'unit-parts');
          details.append(element('summary', '', 'Dopasowania poszczególnych części'));
          const lista = element('ul');
          for (const c of czesci) {
            const dopasowania = Object.entries({ imie: 'imię', nazwisko: 'nazwisko', zdrobnienie: 'zdrobnienie' })
              .filter(([klucz]) => c.dopasowania[klucz]).map(([, etykieta]) => etykieta);
            lista.append(element('li', '', c.tekst + ' - ' + (dopasowania.length ? dopasowania.join(', ') : 'brak dopasowań słownikowych')));
          }
          details.append(lista);
          li.append(details);
        }
      }
      ul.append(li);
    }
    sekcja.append(wynik.jednostkiTekstowe.length ? ul : element('p', 'hint', 'Brak jednostek tekstowych.'));
    return sekcja;
  }

  function tabelaStatystyk(wpisy, wynik, nazwiska = false) {
    const wrap = element('div', 'table-wrap');
    const tabela = element('table', 'results-table name-stats-table');
    tabela.setAttribute('aria-label', nazwiska ? 'Statystyki rozpoznanych nazwisk' : 'Statystyki rozpoznanych imion');
    const naglowek = element('thead');
    const tr = element('tr');
    for (const nazwa of [nazwiska ? 'Rozpoznane nazwisko' : 'Rozpoznane imię', 'Kobiety', 'Mężczyźni',
      nazwiska ? 'Silne wskazanie' : 'Próg ' + ETYKIETA_PROGU, 'Rola w analizie']) {
      const th = element('th', '', nazwa); th.scope = 'col'; tr.append(th);
    }
    naglowek.append(tr);
    const tbody = element('tbody');
    for (const wpis of wpisy) {
      const s = wpis.statystyki;
      const pominiete = pominieteDopasowanie(wpis, nazwiska);
      const r = element('tr');
      const th = element('th', '', wpis.tekst); th.scope = 'row'; r.append(th);
      const jednostka = jednostkaDopasowania(wynik, wpis);
      if (wpis.czescGrupy) th.append(element('span', 'name-count', 'Część grupy: ' + jednostka.tekst));
      else if (jednostka?.typ === 'grupa') th.append(element('span', 'name-count', 'Pełne dopasowanie słownikowe'));
      for (const [procent, liczba, przewaga] of [[s.procentKobiet, s.kobiety, s.kobiety > s.mezczyzni], [s.procentMezczyzn, s.mezczyzni, s.mezczyzni > s.kobiety]]) {
        const td = element('td');
        td.append(element('span', przewaga && !pominiete ? 'name-share dominant' : 'name-share', formatProcentu.format(procent) + '%'),
          element('span', 'name-count', formatLiczby.format(liczba)));
        r.append(td);
      }
      const statusProgu = nazwiska
        ? (s.silneWskazanie ? s.plec : 'Nie')
        : (s.progOsiagniety ? (s.uwagaProgowa ? ETYKIETA_PRZEDZIALU_PROGOWEGO : 'Osiągnięty') : s.kobiety === s.mezczyzni ? 'Nie (remis)' : 'Nieosiągnięty');
      r.append(element('td', '', pominiete ? 'Statystyka nieużyta: ' + statusProgu : statusProgu));
      const etykietaRoli = opisRoli(jednostka);
      const rola = nazwiska ? etykietaRoli +
        (pominiete ? (jednostka?.podstawaRoli === 'KONTEKST_KOLEJNOSCI_LISTY'
          ? ' - statystyki nazwiska nie wpływają na płeć' : ' - nie użyto jako nazwiska') : '') :
        (pominiete ? etykietaRoli + ' - pominięte jako imię' :
          etykietaRoli + ' - uwzględnione jako imię');
      r.append(element('td', '', rola + (pominiete ? ' (tylko diagnostyka)' : '')));
      tbody.append(r);
    }
    tabela.append(naglowek, tbody); wrap.append(tabela);
    return wrap;
  }

  function statystykiRozpoznanych(wynik) {
    const sekcja = element('div', 'name-stats');
    sekcja.append(szczegolyJednostek(wynik));
    for (const [wpisy, naglowek, rodzaj, nazwiska] of [
      [wynik.rozpoznaneImiona, 'Rozpoznane imiona', 'imion', false],
      [wynik.rozpoznaneNazwiska, 'Rozpoznane nazwiska', 'nazwisk', true]
    ]) {
      const glowne = wpisy.filter(w => !w.czescGrupy || !pominieteDopasowanie(w, nazwiska));
      const diagnostyczne = wpisy.filter(w => w.czescGrupy && pominieteDopasowanie(w, nazwiska));
      sekcja.append(element('h4', 'stats-heading', naglowek),
        glowne.length ? tabelaStatystyk(glowne, wynik, nazwiska) : element('p', 'hint', diagnostyczne.length
          ? 'Brak odrębnych wskazań ze słownika ' + rodzaj + '. Dopasowania części dostępne poniżej.'
          : 'Brak dopasowań w słowniku ' + rodzaj + '.'));
      if (diagnostyczne.length) {
        const details = element('details', 'unit-diagnostics');
        details.append(element('summary', '', 'Dopasowania części - tylko diagnostyka (' + diagnostyczne.length + ')'),
          tabelaStatystyk(diagnostyczne, wynik, nazwiska));
        sekcja.append(details);
      }
    }
    if (wynik.rozpoznaneZdrobnienia.length) {
      sekcja.append(element('h4', 'stats-heading', 'Możliwe zdrobnienia i formy potoczne'));
      const ul = element('ul', 'record-notes');
      for (const z of wynik.rozpoznaneZdrobnienia) {
        const czlon = jednostkaDopasowania(wynik, z);
        ul.append(element('li', '', z.tekst +
          (z.wariantZPolskimiZnakami ? ' (dopasowanie do zdrobnienia: ' + ladnaNazwa(z.wariantZPolskimiZnakami) + ')' : '') +
          (z.czescGrupy ? ' (część grupy: ' + czlon.tekst + '; tylko diagnostyka, niewykorzystane do klasyfikacji)' : '') +
          ' - rola: ' + opisRoli(czlon) + ' - jako samodzielne imię: ' +
          liczebnosc(z.statystyki) + '. Możliwe pełne formy: ' +
          z.odpowiedniki.map(o => ladnaNazwa(o.klucz) + ': ' + liczebnosc(o.statystyki)).join('; ') + '.' +
          (z.wykorzystaneDoKlasyfikacji ? ' Na podstawie zdrobnienia ustalono płeć automatycznie: ' + wynik.kategoriaAutomatyczna + '.' : '') +
          (z.kontekst === 'para_nazwisk' ? ' Rozpoznano kontekst pary nazwisk. Wykorzystanie zdrobnienia nie zmienia roli członu ani nie potwierdza pola imienia.' : '') +
          (z.sprzeczneZPeselem ? ' Pełne formy wskazują płeć przeciwną do wyniku z PESEL-u.' : '')));
      }
      sekcja.append(ul);
    }
    sekcja.append(element('p', 'hint', 'Procenty i liczebności dotyczą opublikowanych danych rejestru PESEL, nie prawdopodobieństwa płci uczestnika ani pewności roli członu. Zero oznacza brak opublikowanych wystąpień.'));
    return sekcja;
  }

  function pokazInformacyjne() {
    const ranga = u => KOLEJNOSC_WAZNOSCI[u.severity] ?? 0;
    const rekordy = wyniki.map(w => ({ wynik: w, uwagi: metryki.get(w.numerWiersza).informacyjne }))
      .filter(r => r.uwagi.length)
      .map(r => ({ ...r, waznosc: Math.max(...r.uwagi.map(ranga)) }))
      .sort((a, b) => b.waznosc - a.waznosc || a.wynik.numerWiersza - b.wynik.numerWiersza);
    const liczba = rekordy.reduce((n, r) => n + r.uwagi.length, 0);
    const sekcja = $('info-notes');
    sekcja.hidden = !liczba;
    if (!liczba) sekcja.open = false;
    $('info-notes-title').textContent = 'Uwagi informacyjne (' + liczba + ')';
    $('info-notes-list').replaceChildren(...rekordy.map(({ wynik, uwagi, waznosc }) => {
      const karta = element('article', 'info-item info-level-' + waznosc);
      const top = element('div', 'review-top');
      top.append(element('span', 'review-name', wynik.oryginalnyWiersz), element('span', 'info-level-label', ETYKIETY_WAZNOSCI[waznosc]));
      const opis = 'Wiersz ' + wynik.numerWiersza + ' · Płeć: ' + kategoria(wynik) +
        (wynik.klasyfikacjaReczna !== null
          ? ' (ręcznie; automat: ' + wynik.kategoriaAutomatyczna + (wynik.zrodlo === 'zdrobnienia' ? ', na podstawie zdrobnienia' : '') + ')'
          : wynik.zrodlo === 'zdrobnienia' ? ' · Na podstawie zdrobnienia' : '');
      const posortowane = [...uwagi].sort((a, b) => ranga(b) - ranga(a));
      const pilne = posortowane.filter(u => u.severity === 'high');
      const pozostale = posortowane.filter(u => u.severity !== 'high');
      const rozneWaznosci = new Set(uwagi.map(u => u.severity)).size > 1;
      karta.append(top);
      if (pilne.length) karta.append(listaUwag(wynik, pilne, true, rozneWaznosci));
      karta.append(element('div', 'review-meta', opis));
      if (pozostale.length) karta.append(listaUwag(wynik, pozostale, true, rozneWaznosci));
      return karta;
    }));
  }

  function szczegolyWieku(wynik) {
    const m = metryki.get(wynik.numerWiersza);
    const zrodla = { wiersz: 'wpisana data', pesel: 'PESEL', wiersz_i_pesel: 'wpisana data i PESEL' };
    const opis = element('div', 'age-details');
    opis.append(element('p', '', 'Data urodzenia: ' + formatujDate(wynik.urodzenie.data) +
      (wynik.urodzenie.zrodlo ? ' (' + zrodla[wynik.urodzenie.zrodlo] + ')' : '') +
      ' · Wiek: ' + (m.wiek === null ? 'nieustalony' : m.wiek)));
    const wpisane = wynik.urodzenie.wpisane.map(d => d.tekst + (d.data ? '' : ' (niepoprawna)'));
    if (wpisane.length) opis.append(element('p', '', 'Wpisane daty: ' + wpisane.join(', ')));
    const datyPesel = wynik.pesel.znalezione.filter(n => n.poprawny).map(n => formatujDate(n.dataUrodzenia));
    if (datyPesel.length) opis.append(element('p', '', 'Data z PESEL-u po walidacji: ' + datyPesel.join(', ')));
    return opis;
  }

  function przelicz() {
    const suma = api.podsumuj(wyniki);
    $('count-women').textContent = suma.kobieta;
    $('count-men').textContent = suma.mezczyzna;
    $('count-review').textContent = suma.doWeryfikacji;
    $('total').textContent = 'Łącznie uczestników: ' + suma.razem;
    return suma;
  }

  function pokazKontekstListy() {
    const raport = kontekstListy;
    $('list-context-report').hidden = !raport || raport.status === 'wylaczony';
    if (!raport || raport.status === 'wylaczony') return;
    const procent = liczba => liczba == null ? 'Brak danych' : formatProcentu.format(liczba * 100) + '%';
    const glosy = raport.glosy.imiona_nazwiska + raport.glosy.nazwiska_imiona;
    const powod = {
      brak_slownikow: 'Brakuje danych słownikowych wymaganych do oceny kolejności.',
      za_malo_glosow: 'Za mało wiarygodnych głosów.',
      za_male_pokrycie: 'Zbyt mała część porównywalnych rekordów oddała wiarygodny głos.',
      lista_mieszana: 'Lista ma mieszany układ - zgodność jest zbyt niska.'
    };
    $('list-context-status').textContent = raport.status === 'dominujacy'
      ? 'Dominujący układ: ' + UKLADY_LISTY[raport.uklad] + (raport.liczbaZmienionychRekordow === 0
        ? '. Nie ustalono dodatkowych ról.' : '.')
      : 'Kontekst niewykorzystany. ' + (powod[raport.status] ?? 'Nie ustalono dominującego układu.');
    $('context-votes').textContent = formatLiczby.format(glosy) + ' / ' + formatLiczby.format(raport.liczbaRekordowPorownywalnych);
    $('context-agreement').textContent = procent(raport.udzialDominujacego);
    $('context-coverage').textContent = procent(raport.pokrycie);
    $('context-changed').textContent = formatLiczby.format(raport.liczbaZmienionychRekordow);
    $('list-context-thresholds').textContent = 'Wymagane minimum: ' + formatLiczby.format(raport.progi.minGlosow) +
      ' głosów, ' + procent(raport.progi.minUdzial) + ' zgodności, ' + procent(raport.progi.minPokrycie) + ' pokrycia.';
  }

  function aktualizujWidok() {
    if (resultsSection.hidden || zmienionyTekst) return;
    przeliczMetryki();
    const suma = przelicz();
    $('show-notes').textContent = 'Wpisy wymagające sprawdzenia (' + [...metryki.values()].filter(m => m.doWeryfikacji.length).length + ')';
    $('show-unknown-age').textContent = 'Nieustalony wiek (' + [...metryki.values()].filter(m => m.wiek === null).length + ')';
    pokazKontekstListy();
    pokazStatystyki();
    pokazInformacyjne();
    tabs.forEach(tab => {
      tab.setAttribute('aria-pressed', String(tab.dataset.tab === wybranaKategoria));
    });
    $('list-title').textContent = nazwy[wybranaKategoria];
    const wybrane = wyniki.filter(wynik => {
      const m = metryki.get(wynik.numerWiersza);
      if (wybranaKategoria === U) return m.doWeryfikacji.length > 0;
      if (wybranaKategoria === A) return m.wiek === null;
      return kategoria(wynik) === wybranaKategoria;
    });
    $('list-count').textContent = wybrane.length + ' z ' + suma.razem;
    list.replaceChildren();

    if (wybrane.length === 0) {
      list.append(element('p', 'empty', 'Brak uczestników w tej kategorii.'));
      return;
    }
    if (wybranaKategoria === W || wybranaKategoria === U) pokazWeryfikacje(wybrane);
    else pokazTabele(wybrane);
  }

  function pokazTabele(wybrane) {
    const wrap = element('div', 'table-wrap');
    const tabela = element('table', 'results-table participants-table');
    const naglowek = element('thead');
    const naglowki = element('tr');
    const kolumny = [['Wiersz', 'col-number'], ['Uczestnik', ''], ['Data urodzenia', 'col-date'], ['Wiek', 'col-age'], ['Podstawa', 'col-basis'], ['Do sprawdzenia', 'col-notes']];
    if (wybranaKategoria === A) kolumny.splice(2, 0, ['Płeć', 'col-gender']);
    for (const [tekst, klasa] of kolumny) {
      const th = element('th', klasa, tekst);
      th.scope = 'col';
      naglowki.append(th);
    }
    naglowek.append(naglowki);
    const tbody = element('tbody');

    for (const wynik of wybrane) {
      const m = metryki.get(wynik.numerWiersza);
      const tr = element('tr', 'entry-row');
      const nr = element('td', 'col-number', wynik.numerWiersza);
      const dane = element('td');
      const otworz = () => przelaczEdycje(wynik.numerWiersza);
      const nazwa = przycisk(wynik.oryginalnyWiersz, 'record-button', otworz);
      nazwa.title = 'Kliknij, aby edytować wpis';
      nazwa.setAttribute('aria-expanded', String(edytowanyWiersz === wynik.numerWiersza));
      dane.append(nazwa);
      pokazPilneUwagi(dane, wynik, m);
      tr.append(nr, dane);
      if (wybranaKategoria === A) tr.append(element('td', 'col-gender', kategoria(wynik)));
      const urodzenie = element('td', 'col-date', formatujDate(wynik.urodzenie.data));
      const wiek = element('td', 'col-age', m.wiek === null ? '-' : m.wiek);
      if (m.wiek === null) wiek.title = 'Nieustalony wiek';
      const uwagi = element('td', 'col-notes');
      const przyczyny = m.doWeryfikacji.flatMap(aktywnePrzyczyny);
      if (przyczyny.length) {
        const liczba = przyczyny.length;
        const badge = element('span', 'note-badge', liczba + (liczba === 1 ? ' przyczyna' : liczba >= 2 && liczba <= 4 ? ' przyczyny' : ' przyczyn'));
        badge.title = Object.entries(OBSZARY_UWAG).map(([obszar, etykieta]) => {
          const n = przyczyny.filter(p => p.obszar === obszar).length;
          return n ? etykieta + ': ' + n : '';
        }).filter(Boolean).join('; ');
        uwagi.append(badge);
      }
      tr.append(urodzenie, wiek, element('td', 'col-basis', opisPodstawy(wynik)), uwagi);
      tr.addEventListener('click', e => { if (!e.target.closest('button')) otworz(); });
      tbody.append(tr);

      if (edytowanyWiersz === wynik.numerWiersza) {
        const editorTr = element('tr', 'edit-row');
        const editorTd = element('td');
        editorTd.colSpan = kolumny.length;
        editorTd.append(utworzEdytor(wynik));
        editorTr.append(editorTd);
        tbody.append(editorTr);
      }
    }
    tabela.append(naglowek, tbody);
    wrap.append(tabela);
    list.append(wrap);
  }

  function pokazWeryfikacje(wybrane) {
    const kontener = element('div', 'review-list');
    for (const wynik of wybrane) {
      const karta = element('article', 'review-item');
      const top = element('div', 'review-top');
      top.append(element('span', 'review-name', wynik.oryginalnyWiersz),
        element('span', 'review-meta', 'Wiersz ' + wynik.numerWiersza));
      karta.append(top);
      const m = metryki.get(wynik.numerWiersza);
      pokazPilneUwagi(karta, wynik, m);
      karta.append(element('p', 'review-meta', 'Płeć: ' + kategoria(wynik) + ' · ' + opisPodstawy(wynik)), szczegolyWieku(wynik));
      const uwagi = m.doWeryfikacji.filter(u => u.severity !== 'high');
      if (uwagi.length) karta.append(listaUwag(wynik, uwagi));
      if (wynik.sugestia && kategoria(wynik) === W) karta.append(element('p', 'suggestion', 'Sugestia: ' + wynik.sugestia));
      if (edytowanyWiersz !== wynik.numerWiersza) {
        karta.append(utworzAkcjeWeryfikacji(wynik, wybranaKategoria === W));
      }
      karta.append(statystykiRozpoznanych(wynik));
      if (edytowanyWiersz === wynik.numerWiersza) {
        karta.append(utworzEdytor(wynik));
      }
      kontener.append(karta);
    }
    list.append(kontener);
  }

  function utworzAkcjeWeryfikacji(wynik, szybkiePrzypisanie) {
    const grupa = element('div', 'review-actions');
    grupa.id = 'review-actions-' + wynik.numerWiersza;
    grupa.setAttribute('role', 'group');
    grupa.setAttribute('aria-label', 'Działania dotyczące uczestnika - wiersz ' + wynik.numerWiersza);
    for (const plec of szybkiePrzypisanie ? [K, M] : []) {
      const sugerowana = wynik.sugestia === plec;
      const przyciskPlci = przycisk('Przypisz: ' + plec,
        'button ' + (sugerowana ? 'button-primary' : 'button-secondary'),
        () => szybkoPrzypiszPlec(wynik.numerWiersza, plec));
      if (sugerowana) przyciskPlci.setAttribute('aria-label', 'Przypisz: ' + plec + ' (sugestia algorytmu)');
      grupa.append(przyciskPlci);
    }
    grupa.append(przycisk('Edytuj pełne dane uczestnika', 'button button-secondary',
      () => przelaczEdycje(wynik.numerWiersza)));
    return grupa;
  }

  function zapiszDecyzje(wynik, kategoriaReczna) {
    const nowyWynik = api.ustawKlasyfikacjeReczna(wynik, kategoriaReczna);
    wyniki = wyniki.map(w => w.numerWiersza === wynik.numerWiersza ? nowyWynik : w);
    if (edytowanyWiersz === wynik.numerWiersza) {
      edytowanyWiersz = null;
      szkicEdycji = null;
    }
    aktualizujWidok();
    komunikat('Zapisano zmianę w wierszu ' + wynik.numerWiersza + '. Aktualna kategoria: ' + kategoria(nowyWynik) + '.');
  }

  function szybkoPrzypiszPlec(numerWiersza, plec) {
    const wynik = wyniki.find(w => w.numerWiersza === numerWiersza);
    if (!wynik || kategoria(wynik) !== W || edytowanyWiersz === numerWiersza) return;
    try {
      zapiszDecyzje(wynik, plec);
      // Pozostań w aktualnej kategorii, aby można było sprawdzić kolejny wpis.
      const pozostale = wyniki.filter(w => kategoria(w) === W && w.numerWiersza !== edytowanyWiersz);
      const nastepny = pozostale.find(w => w.numerWiersza > numerWiersza) ?? pozostale[pozostale.length - 1];
      const cel = nastepny && $('review-actions-' + nastepny.numerWiersza)?.querySelector('button');
      (cel || tabs.find(tab => tab.dataset.tab === W))?.focus();
    } catch (err) {
      komunikat('Nie udało się zapisać zmiany: ' + err.message, true);
    }
  }

  function przelaczEdycje(numerWiersza) {
    edytowanyWiersz = edytowanyWiersz === numerWiersza ? null : numerWiersza;
    szkicEdycji = null;
    aktualizujWidok();
    if (edytowanyWiersz !== null) {
      const pole = list.querySelector('.editor input');
      if (pole) pole.focus();
    }
  }

  function utworzEdytor(wynik) {
    const formularz = element('form', 'editor');
    formularz.append(element('div', 'editor-title', 'Edycja wpisu - wiersz ' + wynik.numerWiersza));
    if (wybranaKategoria !== W && wybranaKategoria !== U) {
      formularz.append(szczegolyWieku(wynik));
      const uwagi = metryki.get(wynik.numerWiersza).doWeryfikacji.filter(u => u.severity !== 'high');
      if (uwagi.length) formularz.append(listaUwag(wynik, uwagi));
      formularz.append(statystykiRozpoznanych(wynik));
    }
    formularz.append(element('p', 'editor-basis', 'Wynik automatyczny: ' + wynik.kategoriaAutomatyczna + '. ' + doprecyzujPesel(wynik.uzasadnienie.join(' '))));
    if (!szkicEdycji || szkicEdycji.numer !== wynik.numerWiersza) {
      szkicEdycji = { numer: wynik.numerWiersza, wpis: wynik.oryginalnyWiersz, plec: wynik.klasyfikacjaReczna ?? 'auto', nowaDecyzja: false };
    }
    const szkic = szkicEdycji;
    const fields = element('div', 'editor-fields');

    const wpisField = element('div', 'field');
    const idWpis = 'wpis-' + wynik.numerWiersza;
    const wpisLabel = element('label', '', 'Treść wpisu');
    wpisLabel.htmlFor = idWpis;
    const wpis = element('input');
    wpis.id = idWpis;
    wpis.type = 'text';
    wpis.required = true;
    wpis.value = szkic.wpis;
    wpis.autocomplete = 'off';
    wpis.spellcheck = false;
    wpisField.append(wpisLabel, wpis);

    const plecField = element('div', 'field');
    const idPlec = 'plec-' + wynik.numerWiersza;
    const plecLabel = element('label', '', 'Przypisanie płci');
    plecLabel.htmlFor = idPlec;
    const plec = element('select');
    plec.id = idPlec;
    for (const [value, text] of [['auto', 'Automatycznie'], [K, 'Kobieta'], [M, 'Mężczyzna'], [W, 'Do weryfikacji']]) {
      const option = element('option', '', text);
      option.value = value;
      plec.append(option);
    }
    plec.value = szkic.plec;
    plec.addEventListener('change', () => { szkic.nowaDecyzja = true; szkic.plec = plec.value; });
    wpis.addEventListener('input', () => {
      if (wpis.value !== wynik.oryginalnyWiersz && !szkic.nowaDecyzja) plec.value = 'auto';
      szkic.wpis = wpis.value;
      szkic.plec = plec.value;
    });
    plecField.append(plecLabel, plec);
    fields.append(wpisField, plecField);
    formularz.append(fields,
      element('p', 'editor-note', 'Zmiana treści uruchomi ponowną klasyfikację i anuluje poprzednią decyzję ręczną. Nową decyzję możesz wybrać z listy.'));

    const error = element('p', 'editor-error');
    error.setAttribute('role', 'alert');
    error.hidden = true;
    const akcje = element('div', 'actions');
    const zapisz = element('button', 'button button-primary', 'Zapisz zmianę');
    zapisz.type = 'submit';
    akcje.append(zapisz, przycisk('Anuluj', 'button button-secondary', () => przelaczEdycje(wynik.numerWiersza)));
    formularz.append(error, akcje);
    formularz.addEventListener('submit', e => {
      e.preventDefault();
      const nowyTekst = wpis.value;
      if (!nowyTekst.trim() || /[\r\n]/.test(nowyTekst)) {
        error.hidden = false;
        error.textContent = 'Wpis musi zawierać dokładnie jeden niepusty wiersz.';
        return;
      }
      try {
        let nowyWynik = wynik;
        if (nowyTekst !== wynik.oryginalnyWiersz) {
          // Zachowujemy separatory i pozostałe wiersze dokładnie jak w polu tekstowym.
          const linie = textarea.value.split(/(\r\n|\n|\r)/);
          linie[(wynik.numerWiersza - 1) * 2] = nowyTekst;
          const tekstListy = linie.join('');
          if (kontekstWlaczony.checked) {
            const analiza = klasyfikator.analizujListe(tekstListy, { kontekstKolejnosci: true });
            const poprzednie = new Map(wyniki.map(w => [w.numerWiersza, w.klasyfikacjaReczna]));
            const noweWyniki = analiza.wyniki.map(w => w.numerWiersza === wynik.numerWiersza ? w :
              api.ustawKlasyfikacjeReczna(w, poprzednie.get(w.numerWiersza) ?? null));
            nowyWynik = noweWyniki.find(w => w.numerWiersza === wynik.numerWiersza);
            wyniki = noweWyniki;
            kontekstListy = analiza.kontekstListy;
          } else {
            nowyWynik = klasyfikator.klasyfikujWiersz(nowyTekst, wynik.numerWiersza);
          }
          textarea.value = tekstListy;
        }
        // null oznacza brak nadpisania, w tym przywrócenie automatu.
        const kategoriaReczna = plec.value === 'auto' ? null : plec.value;
        zapiszDecyzje(nowyWynik, kategoriaReczna);
      } catch (err) {
        error.hidden = false;
        error.textContent = 'Nie udało się zapisać zmiany: ' + err.message;
      }
    });
    return formularz;
  }

  $('analysis-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!klasyfikator) return;
    if (wyniki.some(w => w.klasyfikacjaReczna !== null) &&
        !window.confirm('Ponowna analiza usunie wszystkie ręcznie przypisane klasyfikacje. Kontynuować?')) return;
    try {
      const { wyniki: nowe, kontekstListy: raport } = klasyfikator.analizujListe(textarea.value, {
        kontekstKolejnosci: kontekstWlaczony.checked
      });
      if (!nowe.length) {
        resetujWyniki();
        komunikat('Wpisz przynajmniej jednego uczestnika.', true);
        return;
      }
      wyniki = nowe;
      kontekstListy = raport;
      wybranaKategoria = W;
      edytowanyWiersz = null;
      szkicEdycji = null;
      zmienionyTekst = false;
      resultsSection.hidden = false;
      $('info-notes').open = false;
      ustawEtykieteAnalizy();
      komunikat(KOMUNIKAT_ANALIZY);
      aktualizujWidok();
    } catch (err) {
      komunikat('Błąd analizy: ' + err.message, true);
    }
  });

  textarea.addEventListener('input', () => {
    if (resultsSection.hidden) return;
    zmienionyTekst = true;
    resultsSection.hidden = true;
    edytowanyWiersz = null;
    szkicEdycji = null;
    list.replaceChildren();
    komunikat('Lista została zmieniona. Kliknij „Ponownie analizuj listę”, aby odświeżyć wyniki.');
  });

  kontekstWlaczony.addEventListener('change', () => {
    if (wyniki.length) {
      zmienionyTekst = true;
      resultsSection.hidden = true;
      edytowanyWiersz = null;
      szkicEdycji = null;
      list.replaceChildren();
      komunikat('Zmieniono ustawienie kontekstu kolejności listy. Kliknij „Ponownie analizuj listę”, aby odświeżyć wyniki.');
    }
  });

  $('clear-button').addEventListener('click', () => {
    if ((textarea.value.trim() || wyniki.length) && !window.confirm('Wyczyścić całą listę i wyniki analizy?')) return;
    textarea.value = '';
    resetujWyniki();
    if (klasyfikator) komunikat('Lista została wyczyszczona.');
    textarea.focus();
  });

  $('sample-valid').addEventListener('click', () => wstawPrzyklad(PRZYKLAD_POPRAWNY, 'poprawne dane'));
  $('sample-errors').addEventListener('click', () => wstawPrzyklad(PRZYKLAD_Z_BLEDAMI, 'dane z błędami'));

  tabs.forEach(tab => tab.addEventListener('click', () => {
    wybranaKategoria = tab.dataset.tab;
    edytowanyWiersz = null;
    szkicEdycji = null;
    aktualizujWidok();
  }));

  function zmienDateWydarzenia() {
    const poprawna = dataWydarzenia.validity.valid;
    $('event-error').hidden = poprawna;
    $('event-error').textContent = poprawna ? '' : 'Wprowadź prawidłową datę wydarzenia.';
    const nowyDzien = poprawna ? dataWydarzenia.value : '';
    if (nowyDzien === dzien) return;
    dzien = nowyDzien;
    aktualizujWidok();
  }

  dataWydarzenia.addEventListener('input', zmienDateWydarzenia);
  dataWydarzenia.addEventListener('change', zmienDateWydarzenia);
  statystykiWlaczone.addEventListener('change', odswiezOpcjeWiekowe);
  document.querySelectorAll('input[name="age-mode"]').forEach(radio => radio.addEventListener('change', odswiezOpcjeWiekowe));
  progiWlasne.addEventListener('input', odswiezOpcjeWiekowe);
  kontekstWlaczony.checked = false;
  ustawDzisiejszaDate();
  odswiezOpcjeWiekowe();
  wczytajSlownik();
})();
