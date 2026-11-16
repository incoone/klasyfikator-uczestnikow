/* Warstwa interfejsu. Nie zmienia algorytmu w script.js.
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
  // API nie eksportuje liczbowego progu. Ta etykieta nie uczestniczy w klasyfikacji.
  const ETYKIETA_PROGU = '99,90%';
  const formatProcentu = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 4 });
  const formatLiczby = new Intl.NumberFormat('pl-PL');

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
Mateusz Woźniak
Monika Anna Mazur 2006-12-01
Jakub Adam Król
49851799880 Ewa Nowicka
Adam 16900299015 Kowalczyk
Zofia Jankowska 33831399025
50882499054 Marcin Pawlak
Lukasz Wrobel
Malgorzata Dabrowska
Natalia Maria Kubiak
Grzegorz Piotr Lis
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

  let klasyfikator = null;
  let wyniki = [];
  let wybranaKategoria = W;
  let edytowanyWiersz = null;
  let zmienionyTekst = false;
  let metryki = new Map();
  let dzien = '';
  let szkicEdycji = null;

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
      komunikat('Nie udało się uruchomić script.js. Sprawdź, czy plik znajduje się obok index.html.', true);
      return;
    }
    if (typeof api.obliczWiek !== 'function' || typeof api.statystykiWiekowe !== 'function' ||
        typeof api.parsujProgi !== 'function' || typeof api.pobierzKomunikaty !== 'function' || !Array.isArray(api.PROGI_TURYSTYCZNE)) {
      komunikat('Interfejs 1.1 wymaga aktualnego script.js z obsługą komunikatów. Zaktualizuj algorytm.', true);
      return;
    }
    $('tourism-thresholds').textContent = api.PROGI_TURYSTYCZNE.join(', ') + ' lat';
    try {
      const odpowiedz = await fetch('./imiona.json', { cache: 'no-store' });
      if (!odpowiedz.ok) throw new Error(`HTTP ${odpowiedz.status}`);
      klasyfikator = api.utworzKlasyfikator(await odpowiedz.json());
      $('analyze-button').disabled = false;
      komunikat('Słownik imion został wczytany. Możesz rozpocząć analizę.');
    } catch (error) {
      komunikat('Nie udało się wczytać imiona.json. Sprawdź nazwę i położenie pliku. Przy otwieraniu z dysku użyj lokalnego serwera HTTP. (' + error.message + ')', true);
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
    if (wynik.zrodlo === 'imiona') {
      const imiona = wynik.rozpoznaneImiona
        .filter(imie => imie.plec === wynik.kategoriaAutomatyczna)
        .map(imie => imie.tekst);
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
    // Nazwy dopasowań pochodzą z API, a kod określa rodzaj komunikatu.
    const imiona = wynik.rozpoznaneImiona;
    const nazwyImion = predykat => [...new Set(imiona.filter(predykat).map(i => i.tekst))].join(', ');
    const slabe = i => !i.statystyki.progOsiagniety;
    const zgodne = i => slabe(i) && i.sugestia === wynik.kategoriaAutomatyczna;
    let opis = doprecyzujPesel(uwaga.opis);
    if (uwaga.kod === 'BLEDNA_DATA') opis = opis.replace(/([^.!?]) Przyjęto /, '$1. Przyjęto ');
    if (uwaga.kod === 'IMIE_W_PRZEDZIALE_PROGOWYM') {
      // API zwraca osobny komunikat z nazwą każdego różnego dopasowanego imienia.
      const imie = imiona.find(i => i.statystyki.uwagaProgowa && uwaga.opis.startsWith('Rozpoznane imię: ' + i.tekst + '.'));
      if (imie) {
        const s = imie.statystyki;
        opis = 'W opublikowanych danych rejestru PESEL imię ' + imie.tekst + ' występuje wśród ' +
          formatLiczby.format(s.kobiety) + (s.kobiety === 1 ? ' kobiety' : ' kobiet') + ' i ' +
          formatLiczby.format(s.mezczyzni) + (s.mezczyzni === 1 ? ' mężczyzny' : ' mężczyzn') +
          ' (' + formatProcentu.format(Math.max(s.procentKobiet, s.procentMezczyzn)) +
          '% wystąpień dotyczy ' + (imie.plec === K ? 'kobiet' : 'mężczyzn') + ').';
        if (wynik.klasyfikacjaReczna === null && wynik.kategoriaAutomatyczna !== W) opis += ' Płeć ustalono automatycznie.';
      }
    } else if (uwaga.kod === 'ZGODNE_SLABE_IMIE') {
      const a = nazwyImion(zgodne);
      const b = nazwyImion(i => i.statystyki.progOsiagniety && i.plec === wynik.kategoriaAutomatyczna);
      if (a && b) opis = 'Imię (' + a + ') poniżej progu wskazuje tę samą płeć co imię jednoznaczne (' + b + ').';
    } else if (uwaga.kod === 'PESEL_REMIS') {
      const a = nazwyImion(i => slabe(i) && i.sugestia === null);
      if (a) opis = opis.replace('statystykach imienia.', 'statystykach imienia (' + a + ').');
    } else if (uwaga.kod === 'PESEL_PRZECIWNE_IMIE' || uwaga.kod === 'PESEL_ZGODNE_SLABE_IMIE') {
      const a = nazwyImion(uwaga.kod === 'PESEL_ZGODNE_SLABE_IMIE' ? zgodne : i => slabe(i) && i.sugestia && i.sugestia !== wynik.kategoriaAutomatyczna);
      if (a) opis = opis.replace(/imienia poniżej progu|Imię poniżej progu/, m => m + ' (' + a + ')');
    } else if (uwaga.kod === 'BLEDNY_PESEL') {
      const bledy = wynik.pesel.znalezione.filter(n => n.bledy.length).map(n => '„' + n.numer + '”: ' + n.bledy.join(' '));
      if (bledy.length) opis = opis.replace('Szczegóły w wyniku sprawdzenia numeru.', bledy.join(' '));
    }
    return opis;
  }

  function przeliczMetryki() {
    metryki = new Map(wyniki.map(w => {
      const wynikWieku = api.obliczWiek(w, dzien);
      return [w.numerWiersza, { wiek: wynikWieku.wiek, ...api.pobierzKomunikaty(w, dzien) }];
    }));
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

  function listaUwag(wynik, uwagi, informacyjne = false) {
    const ul = element('ul', informacyjne ? 'info-messages' : 'record-notes');
    for (const uwaga of uwagi) {
      const obszar = uwaga.obszar === 'plec' ? 'Płeć' : 'Wiek';
      ul.append(element('li', '', obszar + ': ' + opisKomunikatu(wynik, uwaga)));
    }
    return ul;
  }

  function statystykiImion(wynik) {
    const sekcja = element('div', 'name-stats');
    if (!wynik.rozpoznaneImiona.length) {
      sekcja.append(element('p', 'hint', 'Nie rozpoznano żadnego imienia w słowniku.'));
      return sekcja;
    }
    const wrap = element('div', 'table-wrap');
    const tabela = element('table', 'results-table name-stats-table');
    const naglowek = element('thead');
    const tr = element('tr');
    for (const nazwa of ['Rozpoznane imię', 'Kobiety', 'Mężczyźni', 'Próg ' + ETYKIETA_PROGU]) {
      const th = element('th', '', nazwa); th.scope = 'col'; tr.append(th);
    }
    naglowek.append(tr);
    const tbody = element('tbody');
    for (const imie of wynik.rozpoznaneImiona) {
      const s = imie.statystyki;
      const r = element('tr');
      const th = element('th', '', imie.tekst); th.scope = 'row'; r.append(th);
      for (const [procent, liczba, przewaga] of [[s.procentKobiet, s.kobiety, s.kobiety > s.mezczyzni], [s.procentMezczyzn, s.mezczyzni, s.mezczyzni > s.kobiety]]) {
        const td = element('td');
        td.append(element('span', przewaga ? 'name-share dominant' : 'name-share', formatProcentu.format(procent) + '%'),
          element('span', 'name-count', formatLiczby.format(liczba)));
        r.append(td);
      }
      r.append(element('td', '', s.progOsiagniety ? (s.uwagaProgowa ? 'Osiągnięty z uwagą' : 'Osiągnięty') : s.kobiety === s.mezczyzni ? 'Nie (remis)' : 'Nieosiągnięty'));
      tbody.append(r);
    }
    tabela.append(naglowek, tbody); wrap.append(tabela); sekcja.append(wrap,
      element('p', 'hint', 'Procenty i liczebności dotyczą opublikowanych danych rejestru PESEL, nie prawdopodobieństwa płci uczestnika. Zero oznacza brak opublikowanych wystąpień.'));
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
        (wynik.klasyfikacjaReczna !== null ? ' (ręcznie; automat: ' + wynik.kategoriaAutomatyczna + ')' : '');
      karta.append(top, element('div', 'review-meta', opis), listaUwag(wynik, [...uwagi].sort((a, b) => ranga(b) - ranga(a)), true));
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

  function aktualizujWidok() {
    if (resultsSection.hidden || zmienionyTekst) return;
    przeliczMetryki();
    const suma = przelicz();
    $('show-notes').textContent = 'Wpisy wymagające sprawdzenia (' + [...metryki.values()].filter(m => m.doWeryfikacji.length).length + ')';
    $('show-unknown-age').textContent = 'Nieustalony wiek (' + [...metryki.values()].filter(m => m.wiek === null).length + ')';
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
      tr.append(nr, dane);
      if (wybranaKategoria === A) tr.append(element('td', 'col-gender', kategoria(wynik)));
      const urodzenie = element('td', 'col-date', formatujDate(wynik.urodzenie.data));
      const wiek = element('td', 'col-age', m.wiek === null ? '-' : m.wiek);
      if (m.wiek === null) wiek.title = 'Nieustalony wiek';
      const uwagi = element('td', 'col-notes');
      if (m.doWeryfikacji.length) uwagi.append(element('span', 'note-badge', m.doWeryfikacji.length + (m.doWeryfikacji.length === 1 ? ' uwaga' : m.doWeryfikacji.length >= 2 && m.doWeryfikacji.length <= 4 ? ' uwagi' : ' uwag')));
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
      karta.append(top, element('p', 'review-meta', 'Płeć: ' + kategoria(wynik) + ' · ' + opisPodstawy(wynik)), szczegolyWieku(wynik));
      const uwagi = metryki.get(wynik.numerWiersza).doWeryfikacji;
      if (uwagi.length) karta.append(listaUwag(wynik, uwagi));
      if (wynik.sugestia && kategoria(wynik) === W) karta.append(element('p', 'suggestion', 'Sugestia: ' + wynik.sugestia));
      karta.append(statystykiImion(wynik));
      if (edytowanyWiersz === wynik.numerWiersza) {
        karta.append(utworzEdytor(wynik));
      } else {
        karta.append(przycisk('Edytuj / przypisz płeć', 'button button-secondary',
          () => przelaczEdycje(wynik.numerWiersza)));
      }
      kontener.append(karta);
    }
    list.append(kontener);
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
      const uwagi = metryki.get(wynik.numerWiersza).doWeryfikacji;
      if (uwagi.length) formularz.append(listaUwag(wynik, uwagi));
      formularz.append(statystykiImion(wynik));
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
          nowyWynik = klasyfikator.klasyfikujWiersz(nowyTekst, wynik.numerWiersza);
          const linie = textarea.value.split(/\r\n|\n|\r/);
          linie[wynik.numerWiersza - 1] = nowyTekst;
          textarea.value = linie.join('\n');
        }
        // null oznacza brak nadpisania, w tym przywrócenie automatu.
        const kategoriaReczna = plec.value === 'auto' ? null : plec.value;
        nowyWynik = api.ustawKlasyfikacjeReczna(nowyWynik, kategoriaReczna);
        wyniki = wyniki.map(w => w.numerWiersza === wynik.numerWiersza ? nowyWynik : w);
        edytowanyWiersz = null;
        szkicEdycji = null;
        aktualizujWidok();
        komunikat('Zapisano zmianę w wierszu ' + wynik.numerWiersza + '. Aktualna kategoria: ' + kategoria(nowyWynik) + '.');
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
      const nowe = klasyfikator.klasyfikujListe(textarea.value);
      if (!nowe.length) {
        resetujWyniki();
        komunikat('Wpisz przynajmniej jednego uczestnika.', true);
        return;
      }
      wyniki = nowe;
      wybranaKategoria = W;
      edytowanyWiersz = null;
      szkicEdycji = null;
      zmienionyTekst = false;
      resultsSection.hidden = false;
      $('info-notes').open = false;
      ustawEtykieteAnalizy();
      komunikat('Analiza zakończona. Możesz przejrzeć każdą z trzech kategorii.');
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

  $('clear-button').addEventListener('click', () => {
    if ((textarea.value.trim() || wyniki.length) && !window.confirm('Wyczyścić całą listę i wyniki analizy?')) return;
    textarea.value = '';
    resetujWyniki();
    komunikat(klasyfikator ? 'Lista została wyczyszczona.' : 'Oczekiwanie na słownik imion.');
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
  ustawDzisiejszaDate();
  odswiezOpcjeWiekowe();
  wczytajSlownik();
})();
