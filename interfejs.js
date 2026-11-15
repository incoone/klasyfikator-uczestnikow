/* Warstwa interfejsu. Nie zmienia algorytmu w script.js.
 * Dane uczestników pozostają w pamięci strony (bez localStorage i wysyłania).
 */
(() => {
  'use strict';

  const K = 'Kobieta';
  const M = 'Mężczyzna';
  const W = 'Do weryfikacji';
  const nazwy = { [K]: 'Kobiety', [M]: 'Mężczyźni', [W]: 'Do weryfikacji' };

  // Fikcyjne dane demonstracyjne; wpisanie przykładu nie uruchamia analizy.
  const PRZYKLAD_POPRAWNY = "Patryk Michalski 01810199012\nMagdalena Kaczmarek 18861299028\nDamian Pawlak 35912399050\nKrzysztof Kowalczyk 02840899073\nPaweł Lewandowski 19891999096\nAgnieszka Lewandowska 36820499108\nPrzemysław Piotrowski 03871599132\nAlicja Król 20922699140\nZofia Kamińska 37851199168\nAleksandra Wójcik 04902299188\nJoanna Woźniak 21830799205\nPiotr Kowalski 38881899235\nEwa Dąbrowska 05810399243\nMaria Wiśniewska 22861499265\nSzymon Król 39912599298\nMarta Pawlak 06841099302\nBartosz Krawczyk 23892199331\nWojciech Piotrowski 40820699352\nTomasz Wiśniewski 07871799370\nKarolina Mazur 24920299388\nDominika Michalska 41851399404\nJan Nowicki 08902499432\nBernard Jankowski 25830999450\nMateusz Woźniak 42882099471\nAnna Kowalska 09810599481\nRafał Jankowski 26861699519\nMichał Wójcik 43910199534\nWeronika Krawczyk 10841299549\nMonika Zielińska 27892399562\nAdam Zieliński 44820899590\nJakub Kamiński 11871999616\nMarcin Szymański 28920499632\nKatarzyna Nowak 45851599642\nGrzegorz Kaczmarek 12902699679\nNatalia Szymańska 29831199680\nFilip Mazur 46882299718\nŁukasz Dąbrowski 13810799734\nKamil Grabowski 30861899756\nOliwia Grabowska 47910399765\nJulia Kowalczyk 14841499787";
  const PRZYKLAD_Z_BLEDAMI = "Anna Kowalska\nJan Nowak\nWiśniewska Katarzyna\nPiotr Zieliński\nMaria Magdalena Wójcik\nKrzysztof Paweł Kamiński\n31892599808 Aleksandra Lewandowska\nTomasz 48821099836 Dąbrowski\nJulia Zając 15872199846\n32920699879 Michał Szymański\nAgnieszka Kaczmarek\nMateusz Woźniak\nMonika Anna Mazur\nJakub Adam Król\n49851799880 Ewa Nowicka\nAdam 16900299015 Kowalczyk\nZofia Jankowska 33831399025\n50882499054 Marcin Pawlak\nLukasz Wrobel\nMalgorzata Dabrowska\nNatalia Maria Kubiak\nGrzegorz Piotr Lis\n17810999064 Weronika Sikora\n34862099092 Bartosz Michalski\nAmelia Wysocka\nFilip Sokołowski\n01910599105 Alicja Nowak\n18841699130 Wojciech Kowalski\nOliwia Zielińska 35890199145\n02821299177 Kamil Wiśniewski\nJoanna Kowalczyk 19872399183\n36920899215 Damian Pawłowski\nAlex Morgan\nSasza Nowak\nAndrea Rossi\nDominika Tomaszewska\nPatryk Anna Wiśniewski\nXyz Qwertowski\nKowalski\n12345678901 Jan Malinowski";
  const $ = id => document.getElementById(id);
  const api = window.KlasyfikatorUczestnikow;
  const textarea = $('participants');
  const status = $('status');
  const resultsSection = $('results');
  const list = $('result-list');
  const tabs = [...document.querySelectorAll('[data-tab]')];

  let klasyfikator = null;
  let wyniki = [];
  let wybranaKategoria = W;
  let edytowanyWiersz = null;
  let zmienionyTekst = false;

  function ustawEtykieteAnalizy() {
    $('analyze-button').textContent = wyniki.length ? 'Ponownie analizuj listę' : 'Analizuj listę';
  }

  function resetujWyniki() {
    wyniki = [];
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
    if (wynik.zrodlo === 'pesel') return 'Poprawny PESEL';
    if (wynik.zrodlo === 'imiona') {
      const imiona = wynik.rozpoznaneImiona
        .filter(imie => imie.plec === wynik.kategoriaAutomatyczna)
        .map(imie => imie.tekst);
      return 'Imię: ' + [...new Set(imiona)].join(', ');
    }
    return 'Wymaga sprawdzenia';
  }

  function opisWeryfikacji(wynik) {
    const powody = [...wynik.uzasadnienie];
    for (const nr of wynik.pesel.znalezione) {
      if (nr.bledy.length) powody.push('Dane numeryczne „' + nr.numer + '”: ' + nr.bledy.join(' '));
    }
    if (wynik.klasyfikacjaReczna === W) powody.push('Ręcznie pozostawiono do weryfikacji.');
    return powody.join(' ');
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
    const suma = przelicz();
    tabs.forEach(tab => {
      tab.setAttribute('aria-pressed', String(tab.dataset.tab === wybranaKategoria));
    });
    $('list-title').textContent = nazwy[wybranaKategoria];
    const wybrane = wyniki.filter(wynik => kategoria(wynik) === wybranaKategoria);
    $('list-count').textContent = wybrane.length + ' z ' + suma.razem;
    list.replaceChildren();

    if (wybrane.length === 0) {
      list.append(element('p', 'empty', 'Brak uczestników w tej kategorii.'));
      return;
    }
    if (wybranaKategoria === W) pokazWeryfikacje(wybrane);
    else pokazTabele(wybrane);
  }

  function pokazTabele(wybrane) {
    const wrap = element('div', 'table-wrap');
    const tabela = element('table', 'results-table');
    const naglowek = element('thead');
    const naglowki = element('tr');
    for (const [tekst, klasa] of [['Wiersz', 'col-number'], ['Uczestnik', ''], ['Podstawa', 'col-basis']]) {
      const th = element('th', klasa, tekst);
      th.scope = 'col';
      naglowki.append(th);
    }
    naglowek.append(naglowki);
    const tbody = element('tbody');

    for (const wynik of wybrane) {
      const tr = element('tr', 'entry-row');
      const nr = element('td', 'col-number', wynik.numerWiersza);
      const dane = element('td');
      const otworz = () => przelaczEdycje(wynik.numerWiersza);
      const nazwa = przycisk(wynik.oryginalnyWiersz, 'record-button', otworz);
      nazwa.title = 'Kliknij, aby edytować wpis';
      nazwa.setAttribute('aria-expanded', String(edytowanyWiersz === wynik.numerWiersza));
      dane.append(nazwa);
      tr.append(nr, dane, element('td', 'col-basis', opisPodstawy(wynik)));
      tr.addEventListener('click', e => { if (!e.target.closest('button')) otworz(); });
      tbody.append(tr);

      if (edytowanyWiersz === wynik.numerWiersza) {
        const editorTr = element('tr', 'edit-row');
        const editorTd = element('td');
        editorTd.colSpan = 3;
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
      karta.append(top, element('p', 'reason', opisWeryfikacji(wynik)));
      if (wynik.sugestia) karta.append(element('p', 'suggestion', 'Sugestia: ' + wynik.sugestia));
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
    aktualizujWidok();
    if (edytowanyWiersz !== null) {
      const pole = list.querySelector('.editor input');
      if (pole) pole.focus();
    }
  }

  function utworzEdytor(wynik) {
    const formularz = element('form', 'editor');
    formularz.append(element('div', 'editor-title', 'Edycja wpisu - wiersz ' + wynik.numerWiersza));
    const fields = element('div', 'editor-fields');

    const wpisField = element('div', 'field');
    const idWpis = 'wpis-' + wynik.numerWiersza;
    const wpisLabel = element('label', '', 'Treść wpisu');
    wpisLabel.htmlFor = idWpis;
    const wpis = element('input');
    wpis.id = idWpis;
    wpis.type = 'text';
    wpis.required = true;
    wpis.value = wynik.oryginalnyWiersz;
    wpis.autocomplete = 'off';
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
    plec.value = wynik.klasyfikacjaReczna ?? 'auto';
    let wybranoNowaDecyzje = false;
    plec.addEventListener('change', () => { wybranoNowaDecyzje = true; });
    wpis.addEventListener('input', () => {
      if (wpis.value !== wynik.oryginalnyWiersz && !wybranoNowaDecyzje) plec.value = 'auto';
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
      const nowyTekst = wpis.value.trim();
      if (!nowyTekst || /[\r\n]/.test(nowyTekst)) {
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
      zmienionyTekst = false;
      resultsSection.hidden = false;
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
    aktualizujWidok();
  }));

  wczytajSlownik();
})();
