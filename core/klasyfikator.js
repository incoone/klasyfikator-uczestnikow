/* Logika bez interfejsu, bibliotek, sieci i zapisu danych.
 * Przeglądarka: załaduj z core/ kolejno komunikaty.js, daty.js, pesel.js i klasyfikator.js.
 * Node: const API = require('./core/klasyfikator.js').
 * JSON: { meta: {...}, imiona: { ANNA: [kobiety, mezczyzni] } }.
 */
(function (root) {
  'use strict';
  const { formatuj } = typeof module !== 'undefined' && module.exports
    ? require('./komunikaty.js')
    : root.KlasyfikatorKomunikaty;
  const { ustalUrodzenie, obliczWiek, parsujProgi, statystykiWiekowe, PROGI_TURYSTYCZNE } = typeof module !== 'undefined' && module.exports
    ? require('./daty.js')
    : root.KlasyfikatorDaty;
  const { sprawdzPesel, jestKandydatemNaPesel, wybierzPoprawnyPesel } = typeof module !== 'undefined' && module.exports
    ? require('./pesel.js')
    : root.KlasyfikatorPesel;

  const K = 'Kobieta', M = 'Mężczyzna', W = 'Do weryfikacji';
  const PROGI_UKLADU_LISTY = Object.freeze({ minGlosow: 12, minUdzial: 0.85, minPokrycie: 0.50 });
  const ROLA_Z_LISTY = 'KONTEKST_KOLEJNOSCI_LISTY';
  const PODSTAWY_GLOSU = new Set(['TYLKO_IMIE', 'TYLKO_NAZWISKO', 'PELNE_IMIE_ZLOZONE',
    'PELNE_NAZWISKO_ZLOZONE', 'PRZEWAGA_IMIENIA_30', 'PRZEWAGA_IMIENIA_50']);
  const KONFLIKTY_GLOSU = new Set(['SPRZECZNE_IMIONA', 'KONFLIKT_PESEL_IMIONA', 'KONFLIKT_ZDROBNIENIA']);

  function maPrzewageRoli(liczba, drugaLiczba) {
    return liczba >= 100 && BigInt(liczba) >= 50n * BigInt(drugaLiczba);
  }

  function znajdzGrupyZlozone(wiersz, wyrazy, imiona, nazwiska, zdrobnienia, maksCzesciZlozenia) {
    const grupy = [];
    const literowy = /^\p{L}[\p{L}\p{M}]*$/u;
    function ocenGrupe(poczatek, koniec, wymagaPotwierdzenia) {
      if (poczatek === koniec) return null;
      const klucze = wyrazy.slice(poczatek, koniec + 1).map(([tekst]) => tekst.toUpperCase());
      const klucz = klucze.join('-');
      const imie = imiona.get(klucz);
      const nazwisko = nazwiska.get(klucz);
      let rola = 'nierozstrzygnieta', podstawaRoli = null, statystyki = null;
      let imienneCzesci = false;
      let kontekstWariantuZdrobnienia = false;
      let analizaPlci = 'pominieta';
      if (nazwisko && !imie) {
        rola = 'nazwisko';
        podstawaRoli = 'PELNE_NAZWISKO_ZLOZONE';
        statystyki = nazwisko;
        analizaPlci = 'pelne_statystyki_nazwiska';
      } else if (imie && !nazwisko) {
        rola = 'imie';
        podstawaRoli = 'PELNE_IMIE_ZLOZONE';
        statystyki = imie.statystyki;
        analizaPlci = 'pelne_statystyki_imienia';
      } else if (!nazwisko && !imie) {
        const czesci = klucze.map(k => {
          const stat = imiona.get(k)?.statystyki;
          const razemNazwisk = nazwiska.get(k)?.razem;
          const razemImion = stat ? stat.kobiety + stat.mezczyzni : 0;
          const oba = razemImion > 0 && razemNazwisk !== undefined;
          return { imie: Boolean(stat), nazwisko: razemNazwisk !== undefined,
            tylkoNazwisko: razemNazwisk !== undefined && !stat && !zdrobnienia.has(k),
            przewagaImienia: oba && maPrzewageRoli(razemImion, razemNazwisk),
            przewagaNazwiska: oba && maPrzewageRoli(razemNazwisk, razemImion) };
        });
        if (czesci.every(c => c.nazwisko && !c.przewagaImienia) &&
            czesci.some(c => c.tylkoNazwisko || c.przewagaNazwiska)) {
          rola = 'nazwisko';
          podstawaRoli = 'NAZWISKO_ZLOZONE_Z_CZESCI';
          // T-005 wymaga zwartego zapisu i przynajmniej jednej części wyłącznie nazwiskowej.
          kontekstWariantuZdrobnienia = !wymagaPotwierdzenia && czesci.some(c => c.tylkoNazwisko);
        } else {
          imienneCzesci = czesci.every(c => c.imie && !c.przewagaNazwiska);
        }
      }
      if (wymagaPotwierdzenia && rola === 'nierozstrzygnieta' && !imienneCzesci && !(imie && nazwisko)) return null;
      const zakres = [wyrazy[poczatek].index, wyrazy[koniec].index + wyrazy[koniec][0].length];
      return { tekst: wiersz.slice(...zakres), klucz, zakres, pozycja: poczatek,
        pozycje: klucze.map((_, j) => poczatek + j), rola, podstawaRoli, statystyki,
        dopasowania: { imie: Boolean(imie), nazwisko: Boolean(nazwisko) },
        imienneCzesci, wymagaPotwierdzenia, kontekstWariantuZdrobnienia, analizaPlci };
    }
    function dodajGrupyPoCzesciach(poczatek, koniec, luzneLaczniki) {
      if (poczatek >= koniec) return;
      const granice = [];
      for (let p = poczatek; p < koniec; p++) {
        if (luzneLaczniki.has(p)) granice.push(p);
      }
      const grupa = ocenGrupe(poczatek, koniec, granice.length > 0);
      const fragmenty = [];
      if (granice.length && (!grupa || grupa.rola === 'nierozstrzygnieta')) {
        // Kreska może pełnić funkcję separatora obok zwartej grupy.
        let od = poczatek;
        for (const doPozycji of [...granice, koniec]) {
          const fragment = ocenGrupe(od, doPozycji, false);
          if (fragment) fragmenty.push(fragment);
          od = doPozycji + 1;
        }
      }
      if (!grupa || fragmenty.some(f => f.rola === 'nazwisko')) {
        for (const fragment of fragmenty) grupy.push(fragment);
      } else {
        grupy.push(grupa);
      }
    }

    for (let i = 0; i < wyrazy.length - 1; i++) {
      if (!literowy.test(wyrazy[i][0])) continue;
      const poczatek = i, luzneLaczniki = new Set();
      while (i + 1 < wyrazy.length && literowy.test(wyrazy[i + 1][0])) {
        const lacznik = wiersz.slice(wyrazy[i].index + wyrazy[i][0].length, wyrazy[i + 1].index);
        // Dłuższe kreski ze spacjami i inne separatory zachowują dotychczasową funkcję.
        if (!/^[\p{Zs}\t]*[-\u2010\u2011][\p{Zs}\t]*$/u.test(lacznik) && !/^[\u2013\u2014]$/u.test(lacznik)) break;
        if (!/^[-\u2010\u2011]$/u.test(lacznik)) luzneLaczniki.add(i);
        i++;
      }
      if (i === poczatek) continue;

      // Zabezpiecz pełne wpisy, zanim analiza części połączy je z sąsiednimi członami.
      const dopasowania = [];
      for (let od = poczatek; od < i; od++) {
        let klucz = wyrazy[od][0].toUpperCase(), liczbaLuznychLacznikow = 0;
        for (let doPozycji = od + 1; doPozycji <= i && doPozycji - od < maksCzesciZlozenia; doPozycji++) {
          klucz += '-' + wyrazy[doPozycji][0].toUpperCase();
          if (luzneLaczniki.has(doPozycji - 1)) liczbaLuznychLacznikow++;
          if (imiona.has(klucz) || nazwiska.has(klucz)) dopasowania.push({ od, doPozycji, liczbaLuznychLacznikow });
        }
      }
      // Cały wpis wygrywa długością. Przy remisie pierwszeństwo ma bardziej zwarty zapis.
      dopasowania.sort((a, b) => (b.doPozycji - b.od) - (a.doPozycji - a.od) ||
        a.liczbaLuznychLacznikow - b.liczbaLuznychLacznikow || a.od - b.od);
      const zajete = new Set(), pelneGrupy = [];
      for (const { od, doPozycji } of dopasowania) {
        const grupa = ocenGrupe(od, doPozycji, false);
        if (grupa.pozycje.some(p => zajete.has(p))) continue;
        pelneGrupy.push(grupa);
        for (const p of grupa.pozycje) zajete.add(p);
      }
      let od = poczatek;
      for (const grupa of pelneGrupy.sort((a, b) => a.pozycja - b.pozycja)) {
        dodajGrupyPoCzesciach(od, grupa.pozycja - 1, luzneLaczniki);
        grupy.push(grupa);
        od = grupa.pozycja + grupa.pozycje.length;
      }
      dodajGrupyPoCzesciach(od, i, luzneLaczniki);
    }
    if (!grupy.some(g => g.imienneCzesci)) return grupy;

    // Nazwiska nie wyprowadzamy z części tej samej ani innej nierozstrzygniętej grupy.
    const pozycjeGrup = new Set(grupy.flatMap(g => g.pozycje));
    const maNiezalezneNazwisko = grupy.some(g => g.rola === 'nazwisko') ||
      wyrazy.some(([tekst], pozycja) => {
        if (pozycjeGrup.has(pozycja)) return false;
        const klucz = tekst.toUpperCase(), nazwisko = nazwiska.get(klucz), imie = imiona.get(klucz);
        return nazwisko && (imie
          ? maPrzewageRoli(nazwisko.razem, imie.statystyki.kobiety + imie.statystyki.mezczyzni)
          : !zdrobnienia.has(klucz));
      });
    for (const grupa of grupy) {
      if (!grupa.imienneCzesci || !maNiezalezneNazwisko) continue;
      grupa.rola = 'imie';
      grupa.podstawaRoli = 'IMIENNE_ROLE_CZESCI';
      grupa.analizaPlci = 'statystyki_czesci_imienia';
    }
    return grupy.filter(g => !g.wymagaPotwierdzenia || !g.imienneCzesci || g.rola === 'imie');
  }

  function pewnoscRoli(rola, podstawa) {
    if (rola === 'nierozstrzygnieta') return 'nieustalona';
    return ['TYLKO_IMIE', 'TYLKO_NAZWISKO', 'PRZEWAGA_IMIENIA_50', 'PRZEWAGA_NAZWISKA',
      'PRZEWAGA_IMIENIA_30', 'PELNE_NAZWISKO_ZLOZONE', 'PELNE_IMIE_ZLOZONE'].includes(podstawa) ? 'wysoka' : 'srednia';
  }

  function czyPeselPrzeciwnyImieniu(wynik) {
    return wynik.zrodlo === 'pesel' && wynik.rozpoznaneImiona.some(i =>
      i.uwzglednione !== false && !i.plec && i.sugestia && i.sugestia !== wynik.kategoriaAutomatyczna);
  }

  function maKonfliktDanych(wynik) {
    return wynik.urodzenie.uwagi.length > 0 || wynik.ostrzezenia.some(kod => KONFLIKTY_GLOSU.has(kod)) ||
      czyPeselPrzeciwnyImieniu(wynik) || wynik.rozpoznaneZdrobnienia.some(z => z.sprzeczneZPeselem);
  }

  function wiarygodnaRola(jednostka, liczbaJednostek) {
    return jednostka.pewnoscRoli === 'wysoka' && (PODSTAWY_GLOSU.has(jednostka.podstawaRoli) ||
      (liczbaJednostek === 2 && jednostka.podstawaRoli === 'PRZEWAGA_NAZWISKA'));
  }

  function glosKolejnosci(wynik) {
    const jednostki = wynik.jednostkiTekstowe;
    if (maKonfliktDanych(wynik) || !jednostki.every(j => wiarygodnaRola(j, jednostki.length))) return null;

    const pierwszaRola = jednostki[0].rola;
    const granica = jednostki.findIndex(j => j.rola !== pierwszaRola);
    if (granica < 0 || jednostki.some((j, i) => i > granica && j.rola === pierwszaRola)) return null;
    return pierwszaRola === 'imie' ? 'imiona_nazwiska' : 'nazwiska_imiona';
  }

  function ustalKontekstListy(wyniki, wlaczony, kompletSlownikow) {
    const glosy = { imiona_nazwiska: 0, nazwiska_imiona: 0 };
    const kontekst = { uklad: null, status: 'wylaczony', glosy, liczbaRekordowPorownywalnych: 0,
      udzialDominujacego: null, pokrycie: null, progi: PROGI_UKLADU_LISTY, liczbaZmienionychRekordow: 0 };
    if (!wlaczony) return kontekst;
    if (!kompletSlownikow) return { ...kontekst, status: 'brak_slownikow' };

    const glosyRekordow = new Map();
    for (const wynik of wyniki) {
      if (wynik.jednostkiTekstowe.length < 2) continue;
      const klucz = JSON.stringify(wynik.jednostkiTekstowe.map(j => [j.typ, j.klucz]));
      const glos = glosKolejnosci(wynik);
      // Rozbieżna lub błędna kopia wyłącza cały klucz z głosowania, niezależnie od kolejności wierszy.
      if (!glosyRekordow.has(klucz)) glosyRekordow.set(klucz, glos);
      else if (glosyRekordow.get(klucz) !== glos) glosyRekordow.set(klucz, null);
    }
    for (const glos of glosyRekordow.values()) {
      if (glos) glosy[glos]++;
    }

    const razem = glosy.imiona_nazwiska + glosy.nazwiska_imiona;
    const zwyciezca = glosy.imiona_nazwiska >= glosy.nazwiska_imiona ? 'imiona_nazwiska' : 'nazwiska_imiona';
    const porownywalne = glosyRekordow.size;
    kontekst.liczbaRekordowPorownywalnych = porownywalne;
    kontekst.udzialDominujacego = razem ? glosy[zwyciezca] / razem : null;
    kontekst.pokrycie = porownywalne ? razem / porownywalne : null;
    if (razem < PROGI_UKLADU_LISTY.minGlosow) kontekst.status = 'za_malo_glosow';
    else if (razem * 100 < porownywalne * (PROGI_UKLADU_LISTY.minPokrycie * 100)) kontekst.status = 'za_male_pokrycie';
    else if (glosy[zwyciezca] * 100 < razem * (PROGI_UKLADU_LISTY.minUdzial * 100)) kontekst.status = 'lista_mieszana';
    else {
      kontekst.status = 'dominujacy';
      kontekst.uklad = zwyciezca;
    }
    return kontekst;
  }

  function proponujRoleZListy(wynik, uklad) {
    const jednostki = wynik.jednostkiTekstowe;
    if (jednostki.length < 2) return [];
    const nieustalone = jednostki.filter(j => j.rola === 'nierozstrzygnieta');
    const para = jednostki.length === 2;
    if (nieustalone.length !== (para ? 2 : 1) || maKonfliktDanych(wynik)) return [];
    const dwuznacznePozycje = new Set(wynik.czlonyTekstowe.filter(c =>
      !c.czescGrupy && c.dopasowania.imie && c.dopasowania.nazwisko).map(c => c.pozycja));
    if (!nieustalone.every(j => j.typ === 'czlon' && dwuznacznePozycje.has(j.pozycja))) return [];

    const [pierwsza, druga] = uklad === 'imiona_nazwiska' ? ['imie', 'nazwisko'] : ['nazwisko', 'imie'];
    if (!para && ![pierwsza, druga].every(rola =>
      jednostki.some(j => j.rola === rola && wiarygodnaRola(j, jednostki.length)))) return [];

    // Przedział możliwych granic wynika z lokalnie rozpoznanych ról.
    let od = 1, doPozycji = jednostki.length - 1;
    for (const [i, j] of jednostki.entries()) {
      if (j.rola === pierwsza) od = Math.max(od, i + 1);
      if (j.rola === druga) doPozycji = Math.min(doPozycji, i);
    }
    if (od !== doPozycji) return [];
    const pozycjaGranicy = jednostki[od].pozycja;
    return nieustalone.map(j => ({ pozycje: j.pozycje, rolaPrzed: j.rola,
      rolaPo: j.pozycja < pozycjaGranicy ? pierwsza : druga, podstawaPrzed: j.podstawaRoli }));
  }

  function zachowanoKlasyfikacje(wynik, proba) {
    if (proba.kategoriaAutomatyczna !== wynik.kategoriaAutomatyczna || proba.zrodlo !== wynik.zrodlo ||
        proba.sugestia !== wynik.sugestia || maKonfliktDanych(proba)) return false;
    // T-001 i T-005. Przypisanie roli z listy nie zmienia użycia zdrobnień w klasyfikacji.
    return proba.rozpoznaneZdrobnienia.length === wynik.rozpoznaneZdrobnienia.length &&
      proba.rozpoznaneZdrobnienia.every((z, i) => {
        const przed = wynik.rozpoznaneZdrobnienia[i];
        return z.pozycja === przed.pozycja && z.klucz === przed.klucz && z.kontekst === przed.kontekst &&
          z.plecZPelnychForm === przed.plecZPelnychForm && z.wykorzystaneDoKlasyfikacji === przed.wykorzystaneDoKlasyfikacji &&
          z.sprzeczneZPeselem === przed.sprzeczneZPeselem;
      });
  }

  function rozstrzygnijRolePary(czlony, slownikImion, slownikNazwisk) {
    for (const czlon of czlony) {
      if (czlon.grupa) continue;
      const { imie, nazwisko, zdrobnienie } = czlon.dopasowania;
      const maZnaczenieImienne = imie || zdrobnienie;
      if (!nazwisko) {
        czlon.rolaWstepna = maZnaczenieImienne ? 'imie' : 'nierozpoznana';
        if (!imie && zdrobnienie) czlon.podstawaRoli = 'TYLKO_ZDROBNIENIE';
      } else if (!maZnaczenieImienne || czlon.przewagaNazwiska) {
        czlon.rolaWstepna = 'nazwisko';
        if (czlon.przewagaNazwiska) czlon.podstawaRoli = 'PRZEWAGA_NAZWISKA';
      } else {
        const stat = slownikImion.get(czlon.klucz)?.statystyki;
        const razem = stat ? stat.kobiety + stat.mezczyzni : 0;
        // Brak danych samodzielnego imienia wyklucza porównanie liczebności.
        if (maPrzewageRoli(razem, slownikNazwisk.get(czlon.klucz).razem)) {
          czlon.rolaWstepna = 'imie';
          czlon.podstawaRoli = 'PRZEWAGA_IMIENIA_50';
        } else {
          czlon.rolaWstepna = 'niejednoznaczna';
          czlon.podstawaRoli = null;
        }
      }
      czlon.rola = czlon.rolaWstepna === 'imie' || czlon.rolaWstepna === 'nazwisko'
        ? czlon.rolaWstepna : 'nierozstrzygnieta';
    }

    // Obie role wstępne są już znane. Kolejność wejściowa nie ma wpływu na wynik.
    for (const [pozycja, czlon] of czlony.entries()) {
      if (czlon.grupa || czlon.rolaWstepna !== 'niejednoznaczna') continue;
      const drugaRola = czlony[1 - pozycja].rolaWstepna;
      if (drugaRola === 'imie') {
        czlon.rola = 'nazwisko';
        czlon.podstawaRoli = 'KONTEKST_NAZWISKA_DWA_CZLONY';
      } else if (drugaRola === 'nazwisko') {
        czlon.rola = 'imie';
        czlon.podstawaRoli = 'KONTEKST_IMIENIA_DWA_CZLONY';
      }
    }
  }

  // Kopiujemy i walidujemy dodatkowe słowniki tylko podczas inicjalizacji.
  function przygotujNazwiska(json) {
    const mapa = new Map();
    if (json === null) return mapa;
    if (!json || !json.nazwiska || typeof json.nazwiska !== 'object' || Array.isArray(json.nazwiska)) {
      throw new TypeError(formatuj('BLAD_SLOWNIKA_NAZWISK'));
    }
    for (const [tekst, liczby] of Object.entries(json.nazwiska)) {
      const klucz = tekst.toUpperCase();
      if (!klucz.trim() || mapa.has(klucz) || !Array.isArray(liczby) || liczby.length !== 2 ||
          !liczby.every(n => Number.isSafeInteger(n) && n >= 0) ||
          !Number.isSafeInteger(liczby[0] + liczby[1]) || liczby[0] + liczby[1] === 0) {
        throw new TypeError(formatuj('BLAD_WPISU_NAZWISKA', tekst));
      }
      const [kobiety, mezczyzni] = liczby, razem = kobiety + mezczyzni;
      const progOsiagniety = BigInt(Math.max(...liczby)) * 1000n >= BigInt(razem) * 999n;
      const silneWskazanie = razem >= 100 && progOsiagniety;
      mapa.set(klucz, Object.freeze({ kobiety, mezczyzni, razem,
        procentKobiet: 100 * (kobiety / razem), procentMezczyzn: 100 * (mezczyzni / razem),
        progOsiagniety, silneWskazanie,
        plec: silneWskazanie ? (kobiety > mezczyzni ? K : M) : null }));
    }
    return mapa;
  }

  function przygotujZdrobnienia(json) {
    const mapa = new Map();
    if (json === null) return mapa;
    if (!json || !json.zdrobnienia || typeof json.zdrobnienia !== 'object' || Array.isArray(json.zdrobnienia)) {
      throw new TypeError(formatuj('BLAD_SLOWNIKA_ZDROBNIEN'));
    }
    for (const [tekst, odpowiedniki] of Object.entries(json.zdrobnienia)) {
      const klucz = tekst.toUpperCase();
      if (!klucz.trim() || mapa.has(klucz) || !Array.isArray(odpowiedniki) || !odpowiedniki.length ||
          !odpowiedniki.every(n => typeof n === 'string' && n.trim())) {
        throw new TypeError(formatuj('BLAD_WPISU_ZDROBNIENIA', tekst));
      }
      mapa.set(klucz, Object.freeze([...new Set(odpowiedniki.map(n => n.toUpperCase()))]));
    }
    return mapa;
  }

  // Służy do sugestii pisowni i ograniczonego dopasowania zdrobnień.
  function bezPolskichZnakow(klucz) {
    const zamiana = { Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z' };
    return klucz.replace(/[ĄĆĘŁŃÓŚŹŻ]/g, znak => zamiana[znak]);
  }

  function przygotujWariantyZdrobnien(zdrobnienia, imiona, nazwiska) {
    const warianty = new Map();
    for (const klucz of zdrobnienia.keys()) {
      const uproszczony = bezPolskichZnakow(klucz);
      if (uproszczony === klucz || !/^[A-Z]+$/.test(uproszczony)) continue;
      warianty.set(uproszczony, warianty.has(uproszczony) ? null : klucz);
    }
    if (!warianty.size) return warianty;
    // Ten sam klucz może oznaczać też nazwisko. Inna pisownia blokuje dopasowanie.
    for (const slownik of [imiona, nazwiska]) {
      for (const klucz of slownik.keys()) {
        const uproszczony = bezPolskichZnakow(klucz);
        if (warianty.has(uproszczony) && warianty.get(uproszczony) !== klucz) warianty.set(uproszczony, null);
      }
    }
    return warianty;
  }

  function powodyBrakuDecyzjiZeZdrobnien(wpisy, paraNazwiskZeZdrobnieniem) {
    if (!wpisy.length) return [formatuj('POWOD_BRAK_IMIENIA')];
    const kandydaci = wpisy.filter(z => paraNazwiskZeZdrobnieniem || (!z.statystyki && z.rola !== 'nazwisko'));
    if (!kandydaci.length) return [formatuj('POWOD_ZDROBNIENIA_ROLA_NAZWISKA')];

    const powody = [];
    for (const { tekst, odpowiedniki, kontekst } of kandydaci) {
      const brakujace = [], ponizejProgu = [], kierunki = new Set();
      for (const { klucz, statystyki } of odpowiedniki) {
        if (!statystyki) brakujace.push(klucz);
        else if (!statystyki.progOsiagniety) ponizejProgu.push(klucz);
        else kierunki.add(statystyki.kobiety > statystyki.mezczyzni ? K : M);
      }
      if (brakujace.length) powody.push(formatuj('POWOD_ZDROBNIENIE_BRAK_FORMY', tekst, brakujace));
      if (ponizejProgu.length) powody.push(formatuj('POWOD_ZDROBNIENIE_PROG', tekst, ponizejProgu));
      if (kierunki.size > 1) powody.push(formatuj('POWOD_ZDROBNIENIE_ROZNE_PLCIE', tekst));
      if (!kontekst && brakujace.length === 0 && ponizejProgu.length === 0 && kierunki.size === 1) {
        powody.push(formatuj('POWOD_ZDROBNIENIE_KONTEKST', tekst));
      }
    }
    return powody.length ? powody : [formatuj('POWOD_ZDROBNIENIA_BEZ_NAZWISKA')];
  }

  function utworzKlasyfikator(json, jsonNazwiska = null, jsonZdrobnienia = null) {
    if (!json || !json.imiona || typeof json.imiona !== 'object' || Array.isArray(json.imiona)) {
      throw new TypeError(formatuj('BLAD_SLOWNIKA_IMION'));
    }
    const slownik = new Map();
    for (const [imie, liczby] of Object.entries(json.imiona)) {
      if (!Array.isArray(liczby) || liczby.length !== 2 ||
          !liczby.every(n => Number.isSafeInteger(n) && n >= 0) ||
          !Number.isSafeInteger(liczby[0] + liczby[1]) || liczby[0] + liczby[1] === 0) {
        throw new TypeError(formatuj('BLAD_LICZB_IMIENIA', imie));
      }
      const klucz = imie.toUpperCase();
      if (slownik.has(klucz)) throw new TypeError(formatuj('POWTORZONY_KLUCZ', klucz));
      const [kobiety, mezczyzni] = liczby;
      // Porównania całkowite: 99,90% = 999/1000, 99,98% = 4999/5000.
      const suma = BigInt(kobiety) + BigInt(mezczyzni);
      const przewaga = BigInt(Math.max(kobiety, mezczyzni));
      const progOsiagniety = przewaga * 1000n >= suma * 999n;
      const plec = progOsiagniety ? (kobiety > mezczyzni ? K : M) : null;
      slownik.set(klucz, {
        plec,
        sugestia: kobiety === mezczyzni ? null : kobiety > mezczyzni ? K : M,
        statystyki: Object.freeze({
          kobiety, mezczyzni,
          procentKobiet: 100 * (kobiety / (kobiety + mezczyzni)),
          procentMezczyzn: 100 * (mezczyzni / (kobiety + mezczyzni)),
          progOsiagniety,
          uwagaProgowa: progOsiagniety && przewaga * 5000n < suma * 4999n
        }),
        brakOpublikowanychWystapien: kobiety === 0 || mezczyzni === 0
      });
    }
    if (slownik.size === 0) throw new TypeError(formatuj('PUSTY_SLOWNIK_IMION'));
    const nazwiska = przygotujNazwiska(jsonNazwiska);
    let maksCzesciZlozenia = 1;
    for (const mapa of [slownik, nazwiska]) {
      for (const klucz of mapa.keys()) {
        if (klucz.includes('-')) maksCzesciZlozenia = Math.max(maksCzesciZlozenia, klucz.split('-').length);
      }
    }
    const zdrobnienia = przygotujZdrobnienia(jsonZdrobnienia);
    const wariantyZdrobnien = jsonNazwiska !== null && jsonZdrobnienia !== null
      ? przygotujWariantyZdrobnien(zdrobnienia, slownik, nazwiska) : new Map();
    const statystykiImienia = klucz => slownik.get(klucz)?.statystyki ?? null;
    const polskieWarianty = new Map();
    for (const klucz of slownik.keys()) {
      const uproszczony = bezPolskichZnakow(klucz);
      if (uproszczony === klucz) continue;
      // null oznacza wiele odpowiedników, również gdy tylko jeden jest popularny.
      polskieWarianty.set(uproszczony, polskieWarianty.has(uproszczony) ? null : klucz);
    }
    const sugestiePisowni = new Map();
    for (const [klucz, imie] of slownik) {
      if (bezPolskichZnakow(klucz) !== klucz) continue;
      const odpowiednik = polskieWarianty.get(klucz);
      if (!odpowiednik) continue;
      const pelne = slownik.get(odpowiednik);
      const razem = imie.statystyki.kobiety + imie.statystyki.mezczyzni;
      const razemPelne = pelne.statystyki.kobiety + pelne.statystyki.mezczyzni;
      if (razemPelne >= 10000 && BigInt(razemPelne) >= 10n * BigInt(razem)) {
        sugestiePisowni.set(klucz, Object.freeze({ klucz: odpowiednik,
          plec: pelne.plec, statystyki: pelne.statystyki }));
      }
    }

    function klasyfikujWiersz(oryginalnyWiersz, numerWiersza = null) {
      return analizujWiersz(oryginalnyWiersz, numerWiersza);
    }

    function analizujWiersz(oryginalnyWiersz, numerWiersza, roleZListy) {
      if (typeof oryginalnyWiersz !== 'string') throw new TypeError(formatuj('BLAD_TYPU_WIERSZA'));
      if (/[\r\n]/.test(oryginalnyWiersz)) throw new TypeError(formatuj('BLAD_WIELOWIERSZOWY'));
      if (!oryginalnyWiersz.trim()) return null;
      // Znaki inne niż litery, znaki łączące i liczby stają się separatorami.
      // Nie usuwamy polskich znaków, nie sklejamy cyfr i nie poprawiamy pisowni.
      const wyrazy = [...oryginalnyWiersz.matchAll(/[\p{L}\p{M}\p{N}]+/gu)];
      const oczyszczonyWiersz = wyrazy.map(([tekst]) => tekst).join(' ');
      const grupy = znajdzGrupyZlozone(oryginalnyWiersz, wyrazy, slownik, nazwiska, zdrobnienia, maksCzesciZlozenia);
      const grupaNaPozycji = new Map(grupy.flatMap(g => g.pozycje.map(p => [p, g])));
      const wskazania = { kobieta: 0, mezczyzna: 0, niejednoznaczne: 0 };
      const rozpoznaneImiona = [], nierozpoznaneCzlony = [], numery = [], ostrzezenia = [];
      const czlonyTekstowe = [], czlonyAnalizy = [], rozpoznaneNazwiska = [], rozpoznaneZdrobnienia = [];
      for (const [pozycja, [tekst]] of wyrazy.entries()) {
        if (/^\p{Nd}+$/u.test(tekst)) {
          // Tylko samodzielne ciągi 10-12 cyfr traktujemy jako potencjalny PESEL.
          if (!jestKandydatemNaPesel(tekst)) continue;
          numery.push({ pozycja, ...sprawdzPesel(tekst) });
          continue;
        }
        const klucz = tekst.toUpperCase();
        const imie = slownik.get(klucz);
        const nazwisko = nazwiska.get(klucz);
        const grupa = grupaNaPozycji.get(pozycja);
        const przewagaNazwiska = Boolean(imie && nazwisko &&
          maPrzewageRoli(nazwisko.razem, imie.statystyki.kobiety + imie.statystyki.mezczyzni));
        const czlon = { pozycja, tekst, klucz,
          dopasowania: { imie: Boolean(imie), nazwisko: Boolean(nazwisko), zdrobnienie: zdrobnienia.has(klucz) },
          rola: imie && !nazwisko ? 'imie' : nazwisko && !imie ? 'nazwisko' : 'nierozstrzygnieta',
          podstawaRoli: imie && !nazwisko ? 'TYLKO_IMIE' : nazwisko && !imie ? 'TYLKO_NAZWISKO' : null,
          przewagaNazwiska };
        czlonyTekstowe.push(czlon);
        if (grupa) {
          czlon.rola = grupa.rola;
          czlon.podstawaRoli = grupa.podstawaRoli;
          czlon.czescGrupy = true;
          if (grupa.pozycja === pozycja) {
            czlonyAnalizy.push({ ...grupa, grupa: true,
              rolaWstepna: grupa.rola === 'nierozstrzygnieta' ? 'nierozpoznana' : grupa.rola });
            if (grupa.rola === 'nazwisko' && grupa.statystyki) {
              rozpoznaneNazwiska.push({ pozycja, tekst: grupa.tekst, klucz: grupa.klucz,
                pozycje: grupa.pozycje, statystyki: grupa.statystyki, rola: 'nazwisko' });
            }
          }
        } else {
          czlonyAnalizy.push(czlon);
        }
        if (nazwisko) rozpoznaneNazwiska.push({ pozycja, tekst, klucz, statystyki: nazwisko,
          ...(grupa && { uwzglednione: false, czescGrupy: true }) });
        if (zdrobnienia.has(klucz)) rozpoznaneZdrobnienia.push({ pozycja, tekst, klucz,
          ...(grupa && { czescGrupy: true }),
          statystyki: statystykiImienia(klucz),
          odpowiedniki: zdrobnienia.get(klucz).map(pelne => ({ klucz: pelne, statystyki: statystykiImienia(pelne) })) });
        // Pole historyczne oznacza nadal brak dopasowania do słownika imion.
        if (!imie) nierozpoznaneCzlony.push({ pozycja, tekst });
      }
      const zdrobnieniaDoAnalizy = rozpoznaneZdrobnienia.filter(z => !z.czescGrupy);
      const nowaAnalizaPar = czlonyAnalizy.length === 2 && jsonNazwiska !== null && jsonZdrobnienia !== null;
      if (nowaAnalizaPar) {
        rozstrzygnijRolePary(czlonyAnalizy, slownik, nazwiska);
        if (!zdrobnieniaDoAnalizy.length && czlonyAnalizy.some(c => c.podstawaRoli === 'TYLKO_NAZWISKO' ||
            c.podstawaRoli === 'PELNE_NAZWISKO_ZLOZONE' || c.kontekstWariantuZdrobnienia)) {
          const czlon = czlonyAnalizy.find(c => !c.grupa && c.rolaWstepna === 'nierozpoznana' && /^[A-Za-z]+$/.test(c.tekst));
          const wariant = czlon && wariantyZdrobnien.get(czlon.klucz);
          if (wariant && !slownik.has(wariant)) {
            const { pozycja, tekst, klucz } = czlon;
            czlon.dopasowania.zdrobnienie = true;
            czlon.rola = 'imie';
            czlon.podstawaRoli = 'KONTEKST_ZDROBNIENIA';
            const wpis = { pozycja, tekst, klucz, statystyki: null, wariantZPolskimiZnakami: wariant,
              odpowiedniki: zdrobnienia.get(wariant).map(pelne => ({ klucz: pelne, statystyki: statystykiImienia(pelne) })) };
            rozpoznaneZdrobnienia.push(wpis);
            zdrobnieniaDoAnalizy.push(wpis);
          }
        }
      }

      // Dotychczasowa heurystyka obsługuje pozostałe wiersze i niepełne słowniki.
      const maOsobneNazwisko = czlonyAnalizy.some(c => c.podstawaRoli === 'TYLKO_NAZWISKO' || (c.grupa && c.rola === 'nazwisko'));
      const maInneJednoznaczneImie = czlonyAnalizy.some(c => {
        if (c.przewagaNazwiska) return false;
        if (c.analizaPlci === 'statystyki_czesci_imienia') {
          return c.pozycje.some(p => slownik.get(wyrazy[p][0].toUpperCase())?.plec);
        }
        return (!c.grupa || c.analizaPlci === 'pelne_statystyki_imienia') && slownik.get(c.klucz)?.plec;
      });
      for (const czlon of czlonyAnalizy) {
        if (!nowaAnalizaPar && czlon.przewagaNazwiska && !maOsobneNazwisko && maInneJednoznaczneImie) {
          czlon.rola = 'nazwisko';
          czlon.podstawaRoli = 'PRZEWAGA_NAZWISKA';
        }
      }
      // Najpierw kończymy dotychczasową analizę nazwisk, aby kolejność członów
      // nie wpływała na dostępność kontekstu dla reguły 10x.
      const maRozpoznaneNazwisko = czlonyAnalizy.some(c => c.rola === 'nazwisko');
      const kontekstDwochCzlonow = czlonyAnalizy.length === 2 && maOsobneNazwisko;
      function dodajImie({ pozycja, tekst, klucz, pozycje, czescGrupy }, uwzglednione) {
        const imie = slownik.get(klucz);
        if (!imie) return;
        rozpoznaneImiona.push({ pozycja, tekst, klucz, plec: imie.plec,
          statystyki: imie.statystyki, sugestia: imie.plec === null ? imie.sugestia : null,
          uwzglednione, ...(pozycje && { pozycje }), ...(czescGrupy && { czescGrupy: true }),
          wariantZPolskimiZnakami: uwzglednione ? (sugestiePisowni.get(klucz) ?? null) : null });
        if (!uwzglednione) return;
        wskazania[imie.plec === K ? 'kobieta' : imie.plec === M ? 'mezczyzna' : 'niejednoznaczne']++;
        if (imie.brakOpublikowanychWystapien && !ostrzezenia.includes('ZERO_W_DANYCH')) ostrzezenia.push('ZERO_W_DANYCH');
      }
      for (const czlon of czlonyTekstowe) {
        const grupa = grupaNaPozycji.get(czlon.pozycja);
        if (grupa) {
          if (grupa.pozycja === czlon.pozycja && grupa.analizaPlci === 'pelne_statystyki_imienia') dodajImie(grupa, true);
          dodajImie(czlon, grupa.analizaPlci === 'statystyki_czesci_imienia');
          continue;
        }
        if (!nowaAnalizaPar && czlon.rola === 'nierozstrzygnieta' &&
            czlon.dopasowania.imie && czlon.dopasowania.nazwisko) {
          const stat = slownik.get(czlon.klucz).statystyki;
          const liczbaImion = BigInt(stat.kobiety + stat.mezczyzni);
          const liczbaNazwisk = BigInt(nazwiska.get(czlon.klucz).razem);
          const przewaga30 = liczbaImion >= 100n && liczbaImion >= 30n * liczbaNazwisk;
          const przewaga10 = liczbaImion >= 100n && liczbaImion >= 10n * liczbaNazwisk;
          if (przewaga30) {
            czlon.rola = 'imie';
            czlon.podstawaRoli = 'PRZEWAGA_IMIENIA_30';
          } else if (kontekstDwochCzlonow) {
            czlon.rola = 'imie';
            czlon.podstawaRoli = przewaga10 ? 'PRZEWAGA_IMIENIA_10_DWA_CZLONY' : 'KONTEKST_DWOCH_CZLONOW';
          } else if (przewaga10 && maRozpoznaneNazwisko) {
            czlon.rola = 'imie';
            czlon.podstawaRoli = 'PRZEWAGA_IMIENIA_10_Z_NAZWISKIEM';
          }
        }
        const rolaZListy = roleZListy?.get(czlon.pozycja);
        if (rolaZListy && czlon.rola === 'nierozstrzygnieta') {
          czlon.rola = rolaZListy;
          czlon.podstawaRoli = ROLA_Z_LISTY;
        }
        dodajImie(czlon, czlon.rola !== 'nazwisko');
      }
      const aktywneImiona = rozpoznaneImiona.filter(i => i.uwzglednione);
      for (const wpis of [...rozpoznaneNazwiska, ...rozpoznaneZdrobnienia]) {
        wpis.rola = czlonyTekstowe.find(c => c.pozycja === wpis.pozycja).rola;
      }
      // Role z listy zachowują statystyki nazwiska wyłącznie w diagnostyce.
      if (roleZListy) {
        for (const wpis of rozpoznaneNazwiska) {
          if (roleZListy.has(wpis.pozycja)) wpis.uwzglednione = false;
        }
      }
      const silneNazwiska = rozpoznaneNazwiska.filter(n =>
        n.uwzglednione !== false && n.rola === 'nazwisko' && n.statystyki.silneWskazanie);
      const kierunkiNazwisk = new Set(silneNazwiska.map(n => n.statystyki.plec));
      const uzasadnienie = [];
      let kategoria = W, zrodlo = null;
      const poprawnyPesel = wybierzPoprawnyPesel(numery);
      const paraPotencjalnychImion = nowaAnalizaPar && (
        czlonyAnalizy.every(c => c.rola === 'imie') ||
        czlonyAnalizy.every(c => c.rola === 'nierozstrzygnieta' && c.rolaWstepna === 'niejednoznaczna')
      );
      const paraNazwiskZeZdrobnieniem = nowaAnalizaPar && zdrobnieniaDoAnalizy.length === 1 &&
        czlonyAnalizy.every(c => c.rolaWstepna === 'nazwisko');
      // W parze nazwisk sprawdzamy pełne formy jako osobną podstawę decyzji.
      // Zachowujemy role członów i dotychczasowe wskazania samodzielnych imion dla PESEL-u.
      for (const wpis of rozpoznaneZdrobnienia) {
        const czlon = czlonyTekstowe.find(c => c.pozycja === wpis.pozycja);
        if (wpis.czescGrupy) {
          wpis.kontekst = wpis.plecZPelnychForm = null;
          wpis.wykorzystaneDoKlasyfikacji = wpis.sprzeczneZPeselem = false;
          continue;
        }
        const maKontekstNazwiska = maRozpoznaneNazwisko && (nowaAnalizaPar
          ? czlon.rola === 'imie' : !czlon.dopasowania.nazwisko);
        const maKontekstPesel = poprawnyPesel && !czlon.dopasowania.nazwisko;
        wpis.kontekst = null;
        if (!wpis.statystyki && (!nowaAnalizaPar || czlon.rola !== 'nazwisko')) {
          if (maKontekstNazwiska) wpis.kontekst = poprawnyPesel ? 'nazwisko_i_pesel' : 'nazwisko';
          else if (maKontekstPesel) wpis.kontekst = 'pesel';
          else if (paraPotencjalnychImion) wpis.kontekst = 'para_potencjalnych_imion';
        }
        const pelnePlcie = wpis.odpowiedniki.map(p => slownik.get(p.klucz)?.plec ?? null);
        wpis.plecZPelnychForm = (!wpis.statystyki || paraNazwiskZeZdrobnieniem) &&
          pelnePlcie.every(p => p !== null && p === pelnePlcie[0])
          ? pelnePlcie[0] : null;
        if (paraNazwiskZeZdrobnieniem && wpis.plecZPelnychForm) wpis.kontekst = 'para_nazwisk';
        wpis.wykorzystaneDoKlasyfikacji = false;
        wpis.sprzeczneZPeselem = false;
        if (!nowaAnalizaPar && wpis.kontekst) {
          wpis.rola = czlon.rola = 'imie';
          czlon.podstawaRoli = 'KONTEKST_ZDROBNIENIA';
        }
      }
      const zdrobnieniaWKontekscie = zdrobnieniaDoAnalizy.filter(z => z.kontekst);
      const jednoznaczneZdrobnienia = zdrobnieniaWKontekscie.filter(z => z.plecZPelnychForm);
      const kierunkiZdrobnien = new Set(jednoznaczneZdrobnienia.map(z => z.plecZPelnychForm));
      // W tej parze sprawdzamy też odrzucone dopasowania imion, np. Gala.
      const imionaDoSprawdzeniaZdrobnien = paraNazwiskZeZdrobnieniem
        ? rozpoznaneImiona.filter(i => !i.czescGrupy)
        : aktywneImiona;
      const przeciwneImie = imionaDoSprawdzeniaZdrobnien.find(i =>
        (i.plec || i.sugestia) && jednoznaczneZdrobnienia.some(z => (i.plec || i.sugestia) !== z.plecZPelnychForm));
      const konfliktMiedzyZdrobnieniami = kierunkiZdrobnien.size > 1;
      const przeciwneNazwisko = !aktywneImiona.length && silneNazwiska.find(n =>
        jednoznaczneZdrobnienia.some(z => n.statystyki.plec !== z.plecZPelnychForm));
      const podejrzane = numery.some(n => !n.formatPoprawny);
      const kandydaci = numery.filter(n => n.formatPoprawny);
      if (wskazania.niejednoznaczne) ostrzezenia.push('NIEJEDNOZNACZNE_IMIONA');
      const kierunki = new Set(aktywneImiona.map(i => i.plec || i.sugestia));
      const remis = kierunki.delete(null);
      if (kierunki.size > 1) ostrzezenia.push('SPRZECZNE_IMIONA');
      if (podejrzane) uzasadnienie.push(formatuj('POWOD_FORMAT_PESEL'));
      if (kandydaci.length > 1) uzasadnienie.push(formatuj('POWOD_KILKA_PESEL'));
      if (kandydaci.some(n => !n.poprawny)) uzasadnienie.push(formatuj('POWOD_WALIDACJA_PESEL'));
      if (uzasadnienie.length === 0 && poprawnyPesel) {
        const sprzecznosc = poprawnyPesel.plec === K ? wskazania.mezczyzna > 0 : wskazania.kobieta > 0;
        if (sprzecznosc) {
          uzasadnienie.push(formatuj('POWOD_KONFLIKT_PESEL'));
          ostrzezenia.push('KONFLIKT_PESEL_IMIONA');
        } else {
          kategoria = poprawnyPesel.plec;
          zrodlo = 'pesel';
          uzasadnienie.push(formatuj('POWOD_PLEC_Z_PESEL'));
          if (!paraNazwiskZeZdrobnieniem || (!konfliktMiedzyZdrobnieniami && !przeciwneImie && !przeciwneNazwisko)) {
            for (const wpis of jednoznaczneZdrobnienia) wpis.sprzeczneZPeselem = wpis.plecZPelnychForm !== kategoria;
          }
        }
      } else if (uzasadnienie.length === 0) {
        const klasyfikacjaZeZdrobnien = !aktywneImiona.length && zdrobnieniaWKontekscie.length > 0 &&
          jednoznaczneZdrobnienia.length === zdrobnieniaWKontekscie.length &&
          (!nowaAnalizaPar || maRozpoznaneNazwisko);
        const przeciwneImieWKontekstowymNazwisku = klasyfikacjaZeZdrobnien && nowaAnalizaPar &&
          rozpoznaneImiona.find(i => i.plec && !kierunkiZdrobnien.has(i.plec) &&
            czlonyTekstowe.some(c => c.pozycja === i.pozycja && c.podstawaRoli === 'KONTEKST_NAZWISKA_DWA_CZLONY'));
        if (konfliktMiedzyZdrobnieniami || przeciwneImie || przeciwneNazwisko || przeciwneImieWKontekstowymNazwisku) {
          if (konfliktMiedzyZdrobnieniami) uzasadnienie.push(formatuj('POWOD_KONFLIKT_ZDROBNIEN_POMIEDZY'));
          if (przeciwneImie) uzasadnienie.push(formatuj('POWOD_KONFLIKT_ZDROBNIENIA_IMIE', przeciwneImie.tekst));
          if (przeciwneNazwisko) uzasadnienie.push(formatuj('POWOD_KONFLIKT_ZDROBNIENIA_NAZWISKO', przeciwneNazwisko.tekst));
          if (przeciwneImieWKontekstowymNazwisku) {
            uzasadnienie.push(formatuj('POWOD_KONFLIKT_ZDROBNIENIA_IMIE_W_NAZWISKU', przeciwneImieWKontekstowymNazwisku.tekst));
          }
          ostrzezenia.push('KONFLIKT_ZDROBNIENIA');
        } else if (klasyfikacjaZeZdrobnien) {
          kategoria = [...kierunkiZdrobnien][0];
          zrodlo = 'zdrobnienia';
          uzasadnienie.push(formatuj('POWOD_PLEC_ZE_ZDROBNIEN'));
          for (const wpis of jednoznaczneZdrobnienia) wpis.wykorzystaneDoKlasyfikacji = true;
        } else {
          // Same części imienia bez pełnego wpisu wymagają przynajmniej jednego silnego wskazania.
          const wspomaganie = !wskazania.kobieta && !wskazania.mezczyzna && !remis &&
            aktywneImiona.some(i => !i.czescGrupy) &&
            kierunki.size === 1 && kierunkiNazwisk.size === 1 && kierunkiNazwisk.has([...kierunki][0]);
          if (!aktywneImiona.length) {
            uzasadnienie.push(...powodyBrakuDecyzjiZeZdrobnien(zdrobnieniaDoAnalizy, paraNazwiskZeZdrobnieniem));
          }
          else if (!wskazania.kobieta && !wskazania.mezczyzna && !wspomaganie) {
            uzasadnienie.push(formatuj('POWOD_IMIONA_PONIZEJ_PROGU'));
          }
          if (remis) uzasadnienie.push(formatuj('POWOD_REMIS_IMIENIA'));
          if (kierunki.size > 1) uzasadnienie.push(formatuj('POWOD_SPRZECZNE_IMIONA'));
          if (uzasadnienie.length === 0) {
            kategoria = [...kierunki][0];
            zrodlo = wspomaganie ? 'imiona_i_nazwisko' : 'imiona';
            uzasadnienie.push(wspomaganie
              ? formatuj('POWOD_PLEC_Z_IMION_I_NAZWISKA')
              : formatuj('POWOD_PLEC_Z_IMION'));
          }
        }
      }
      if (aktywneImiona.length === 0 && zrodlo !== 'zdrobnienia') {
        ostrzezenia.unshift('BRAK_ROZPOZNANYCH_IMION');
      }
      if (kategoria === W) {
        for (const grupa of grupy) {
          if (grupa.rola === 'nierozstrzygnieta') {
            uzasadnienie.push(formatuj('NIEROZSTRZYGNIETA_ROLA', grupa.tekst));
          }
        }
      }
      // Sugestia nie zmienia kategorii. Przy konflikcie nie wybieramy zwycięzcy.
      const sugestie = new Set(kierunki);
      if (ostrzezenia.includes('KONFLIKT_ZDROBNIENIA')) sugestie.clear();
      if (poprawnyPesel) sugestie.add(poprawnyPesel.plec);
      const grupyZlozone = grupy.map(({ imienneCzesci, wymagaPotwierdzenia, kontekstWariantuZdrobnienia, ...g }) =>
        ({ ...g, pewnoscRoli: pewnoscRoli(g.rola, g.podstawaRoli) }));
      const grupaNaPoczatku = new Map(grupyZlozone.map(g => [g.pozycja, g]));
      const jednostkiTekstowe = [];
      for (const czlon of czlonyTekstowe) {
        const grupa = grupaNaPoczatku.get(czlon.pozycja);
        if (grupa) {
          jednostkiTekstowe.push({ typ: 'grupa', ...grupa });
        } else if (!grupaNaPozycji.has(czlon.pozycja)) {
          const { pozycja, tekst, klucz, rola, podstawaRoli } = czlon;
          const poczatek = wyrazy[pozycja].index;
          jednostkiTekstowe.push({ typ: 'czlon', pozycja, pozycje: [pozycja], tekst, klucz, rola, podstawaRoli,
            zakres: [poczatek, poczatek + tekst.length], pewnoscRoli: pewnoscRoli(rola, podstawaRoli) });
        }
      }
      return {
        urodzenie: ustalUrodzenie(oryginalnyWiersz, numery),
        numerWiersza, oryginalnyWiersz, oczyszczonyWiersz, rozpoznaneImiona,
        czlonyTekstowe, rozpoznaneNazwiska, rozpoznaneZdrobnienia, grupyZlozone, jednostkiTekstowe,
        nierozpoznaneCzlony, wskazania, pesel: { znalezione: numery },
        kategoriaAutomatyczna: kategoria, klasyfikacjaReczna: null, zrodlo,
        uzasadnienie, sugestia: kategoria === W && sugestie.size === 1 ? [...sugestie][0] : null,
        ostrzezenia
      };
    }

    function klasyfikujListe(tekst) {
      if (typeof tekst !== 'string') throw new TypeError(formatuj('BLAD_TYPU_LISTY'));
      return tekst.split(/\r\n|\n|\r/).map((wiersz, i) => klasyfikujWiersz(wiersz, i + 1)).filter(Boolean);
    }
    function analizujListe(tekst, { kontekstKolejnosci = false } = {}) {
      const wyniki = klasyfikujListe(tekst);
      const kontekstListy = ustalKontekstListy(wyniki, kontekstKolejnosci === true,
        nazwiska.size > 0 && zdrobnienia.size > 0);
      const uklad = kontekstListy.uklad;
      const wynikListy = wyniki.map(wynik => {
        const bezZmian = { ...wynik, kontekstKolejnosci: null };
        if (!uklad) return bezZmian;
        const zmiany = proponujRoleZListy(wynik, uklad);
        if (!zmiany.length) return bezZmian;
        const roleZListy = new Map(zmiany.map(z => [z.pozycje[0], z.rolaPo]));
        if (wynik.kategoriaAutomatyczna !== W && wynik.rozpoznaneNazwiska.some(n =>
          roleZListy.get(n.pozycja) === 'nazwisko' && n.statystyki.silneWskazanie &&
          n.statystyki.plec !== wynik.kategoriaAutomatyczna)) return bezZmian;
        const proba = analizujWiersz(wynik.oryginalnyWiersz, wynik.numerWiersza, roleZListy);
        if (!zachowanoKlasyfikacje(wynik, proba) || !zmiany.every(z => proba.jednostkiTekstowe.some(j =>
          j.pozycja === z.pozycje[0] && j.rola === z.rolaPo && j.podstawaRoli === ROLA_Z_LISTY))) return bezZmian;
        kontekstListy.liczbaZmienionychRekordow++;
        return { ...proba, klasyfikacjaReczna: wynik.klasyfikacjaReczna, kontekstKolejnosci: { uklad, zmiany } };
      });
      return { wyniki: wynikListy, kontekstListy };
    }
    return { klasyfikujWiersz, klasyfikujListe, analizujListe };
  }

  function ustawKlasyfikacjeReczna(wynik, kategoria) {
    if (![K, M, W, null].includes(kategoria)) throw new TypeError(formatuj('BLAD_KATEGORII'));
    return { ...wynik, klasyfikacjaReczna: kategoria }; // null przywraca automat
  }
  function pobierzKategorie(wynik) {
    return wynik.klasyfikacjaReczna ?? wynik.kategoriaAutomatyczna;
  }
  // Klasyfikacja ręczna i dzień wydarzenia mogą zmienić listę aktywnych uwag.
  function pobierzKomunikaty(wynik, dataWydarzenia) {
    const doWeryfikacji = [], informacyjne = [];
    const aktywneImiona = wynik.rozpoznaneImiona.filter(i => i.uwzglednione !== false);
    let weryfikacjaAutomatyczna = null;
    if (pobierzKategorie(wynik) === W) {
      const reczna = wynik.klasyfikacjaReczna === W;
      const wpis = { obszar: 'plec', severity: 'high', kod: reczna ? 'RECZNA_WERYFIKACJA' : 'WERYFIKACJA_PLCI',
        opis: reczna ? formatuj('RECZNA_WERYFIKACJA') : formatuj('WERYFIKACJA_PLCI', wynik.uzasadnienie) };
      doWeryfikacji.push(wpis);
      if (!reczna) weryfikacjaAutomatyczna = wpis;
    }
    const dodaj = (kod, severity, opis) => informacyjne.push({ obszar: 'plec', kod, severity, opis });
    if (wynik.kontekstKolejnosci?.zmiany.length) {
      informacyjne.push({ obszar: 'dane', kod: ROLA_Z_LISTY, severity: 'medium',
        pozycje: wynik.kontekstKolejnosci.zmiany.flatMap(z => z.pozycje),
        opis: formatuj(ROLA_Z_LISTY, wynik.kontekstKolejnosci.uklad) });
    }
    if (czyPeselPrzeciwnyImieniu(wynik)) {
      dodaj('PESEL_PRZECIWNE_IMIE', 'medium', formatuj('PESEL_PRZECIWNE_IMIE'));
    }
    // Uwagi o rolach i zdrobnieniach nie są zadaniami ręcznej klasyfikacji płci.
    // Jeden komunikat danego rodzaju na klucz; pozycje wskazują wszystkie powtórzenia.
    const noweUwagi = new Map();
    const dodajSzczegolowa = (kod, severity, obszar, wpis, opis) => {
      const id = kod + ':' + wpis.klucz;
      const pozycje = wpis.pozycje ?? [wpis.pozycja];
      if (noweUwagi.has(id)) noweUwagi.get(id).pozycje.push(...pozycje);
      else noweUwagi.set(id, { kod, severity, obszar, klucz: wpis.klucz, pozycje: [...pozycje], opis });
    };
    // Powtórzenie tego samego imienia nie stanowi niezależnego potwierdzenia.
    const jednoznaczneImiona = new Set(aktywneImiona.filter(i => i.plec).map(i => i.klucz));
    const niezalezneWskazanie = wynik.rozpoznaneNazwiska?.some(n =>
      n.uwzglednione !== false && n.rola === 'nazwisko' && n.statystyki.silneWskazanie && n.statystyki.plec === wynik.kategoriaAutomatyczna) ||
      wynik.rozpoznaneZdrobnienia?.some(z => z.kontekst && z.plecZPelnychForm === wynik.kategoriaAutomatyczna);
    const uwagaORzadkosci = wynik.zrodlo === 'imiona' && jednoznaczneImiona.size === 1 && !niezalezneWskazanie;
    for (const imie of aktywneImiona) {
      const razem = imie.statystyki.kobiety + imie.statystyki.mezczyzni;
      const wariant = imie.wariantZPolskimiZnakami;
      const zgodneJednoznaczne = Boolean(wariant && imie.plec && imie.plec === wariant.plec);
      if (wariant) {
        const razemWariant = wariant.statystyki.kobiety + wariant.statystyki.mezczyzni;
        dodajSzczegolowa('MOZLIWY_BRAK_POLSKICH_ZNAKOW', 'low', 'dane', imie,
          formatuj('MOZLIWY_BRAK_POLSKICH_ZNAKOW', imie.tekst, razem, wariant.klucz, razemWariant));
      }
      if (uwagaORzadkosci && imie.plec && razem >= 30 && razem < 100 && !zgodneJednoznaczne) {
        dodajSzczegolowa('RZADKIE_IMIE', razem < 50 ? 'medium' : 'low', 'plec', imie,
          formatuj('RZADKIE_IMIE', imie.tekst, razem));
      }
    }
    const grupy = wynik.grupyZlozone ?? [];
    const czlony = wynik.czlonyTekstowe ?? [];
    const samodzielneCzlony = czlony.filter(c => !c.czescGrupy);
    const czlonyKontekstu = [...samodzielneCzlony, ...grupy];
    for (const czlon of samodzielneCzlony) {
      if (czlon.podstawaRoli === 'KONTEKST_IMIENIA_DWA_CZLONY' ||
          czlon.podstawaRoli === 'KONTEKST_NAZWISKA_DWA_CZLONY') {
        const nazwisko = czlon.podstawaRoli === 'KONTEKST_NAZWISKA_DWA_CZLONY';
        // T-001 opisuje rolę tego członu w treści samodzielnej weryfikacji.
        if (nazwisko && weryfikacjaAutomatyczna && wynik.ostrzezenia.includes('KONFLIKT_ZDROBNIENIA') &&
            wynik.uzasadnienie.includes(formatuj('POWOD_KONFLIKT_ZDROBNIENIA_IMIE_W_NAZWISKU', czlon.tekst))) continue;
        const drugi = czlonyKontekstu.find(c => c.pozycja !== czlon.pozycja);
        const kod = nazwisko ? 'ROLA_NAZWISKA_Z_KONTEKSTU' : 'ROLA_IMIENIA_Z_KONTEKSTU';
        const przeciwneImie = nazwisko && wynik.kategoriaAutomatyczna !== W &&
          wynik.rozpoznaneImiona.some(i => i.pozycja === czlon.pozycja && i.plec && i.plec !== wynik.kategoriaAutomatyczna);
        let opis = formatuj('ROLA_Z_KONTEKSTU_PARY', czlon.tekst, drugi.tekst, czlon.rola);
        if (przeciwneImie) opis += formatuj('DOPISEK_PRZECIWNE_IMIE_W_NAZWISKU');
        dodajSzczegolowa(kod, przeciwneImie ? 'medium' : 'low', 'dane', czlon, opis);
      } else if (czlon.podstawaRoli === 'KONTEKST_DWOCH_CZLONOW') {
        const nazwisko = czlonyKontekstu.find(c => c.podstawaRoli === 'TYLKO_NAZWISKO' ||
          c.podstawaRoli === 'PELNE_NAZWISKO_ZLOZONE' || c.podstawaRoli === 'NAZWISKO_ZLOZONE_Z_CZESCI');
        dodajSzczegolowa('ROLA_IMIENIA_Z_KONTEKSTU', 'low', 'dane', czlon,
          formatuj('ROLA_IMIENIA_Z_KONTEKSTU', czlon.tekst, nazwisko.tekst));
      } else if (czlon.podstawaRoli === 'PRZEWAGA_IMIENIA_10_Z_NAZWISKIEM') {
        dodajSzczegolowa('ROLA_IMIENIA_ZE_STATYSTYK', 'low', 'dane', czlon,
          formatuj('ROLA_IMIENIA_ZE_STATYSTYK', czlon.tekst));
      } else if (czlon.rola === 'nierozstrzygnieta' && (czlon.rolaWstepna === 'niejednoznaczna' ||
          (czlon.dopasowania.imie && czlon.dopasowania.nazwisko))) {
        dodajSzczegolowa('NIEROZSTRZYGNIETA_ROLA', 'medium', 'dane', czlon,
          formatuj('NIEROZSTRZYGNIETA_ROLA', czlon.tekst));
      }
    }
    for (const grupa of grupy) {
      if (wynik.zrodlo && grupa.rola === 'nierozstrzygnieta' && grupa.analizaPlci === 'pominieta') {
        dodajSzczegolowa('NIEROZSTRZYGNIETA_ROLA', 'medium', 'dane', grupa,
          formatuj('NIEROZSTRZYGNIETA_ROLA', grupa.tekst));
      }
    }
    for (const wpis of wynik.rozpoznaneZdrobnienia ?? []) {
      if (!wpis.wykorzystaneDoKlasyfikacji && !wpis.sprzeczneZPeselem) continue;
      const severity = wpis.sprzeczneZPeselem || wpis.kontekst === 'para_nazwisk' ? 'high' : 'medium';
      dodajSzczegolowa('MOZLIWE_ZDROBNIENIE', severity, 'dane', wpis,
        formatuj('MOZLIWE_ZDROBNIENIE', wpis));
    }
    if (wynik.zrodlo === 'imiona_i_nazwisko') {
      dodaj('KLASYFIKACJA_WSPARTA_NAZWISKIEM', 'medium',
        'Płeć ustalono na podstawie zgodnych wskazań niejednoznacznych imion i silnego wskazania nazwiska.');
    }
    if (wynik.zrodlo) {
      for (const wpis of wynik.rozpoznaneNazwiska ?? []) {
        if (wpis.uwzglednione !== false && wpis.rola === 'nazwisko' && wpis.statystyki.silneWskazanie &&
            wpis.statystyki.plec !== wynik.kategoriaAutomatyczna) {
          dodajSzczegolowa('NAZWISKO_PRZECIWNE_WYNIKOWI', 'high', 'plec', wpis,
            formatuj('NAZWISKO_PRZECIWNE_WYNIKOWI', wpis.tekst, wynik.zrodlo));
        }
      }
    }
    informacyjne.push(...noweUwagi.values());
    const ocena = obliczWiek(wynik, dataWydarzenia);
    const zPesel = wynik.urodzenie.zrodlo === 'pesel';
    const wspolneProblemyPesel = new Set();
    if (weryfikacjaAutomatyczna) {
      if (wynik.uzasadnienie.includes(formatuj('POWOD_FORMAT_PESEL')) ||
          wynik.uzasadnienie.includes(formatuj('POWOD_WALIDACJA_PESEL'))) wspolneProblemyPesel.add('BLEDNY_PESEL');
      if (wynik.uzasadnienie.includes(formatuj('POWOD_KILKA_PESEL'))) wspolneProblemyPesel.add('KILKA_NUMEROW');
    }
    for (const uwaga of ocena.uwagi) {
      const wpis = { obszar: 'wiek', ...uwaga };
      const wymagaWeryfikacji = uwaga.kod === 'URODZENIE_PO_WYDARZENIU' || !wynik.urodzenie.data;
      if (!wymagaWeryfikacji) wpis.opis += formatuj('DOPISEK_ZRODLO_DATY', zPesel);
      if (wspolneProblemyPesel.has(uwaga.kod)) {
        (weryfikacjaAutomatyczna.powiazane ??= []).push({ ...wpis, wymagaWeryfikacji });
      } else {
        (wymagaWeryfikacji ? doWeryfikacji : informacyjne).push(wpis);
      }
    }
    if (weryfikacjaAutomatyczna?.powiazane) {
      const bledyPesel = wynik.pesel.znalezione.filter(n => n.formatPoprawny).flatMap(n => n.bledy);
      if (bledyPesel.length) weryfikacjaAutomatyczna.opis += ' ' + [...new Set(bledyPesel)].join(' ');
      weryfikacjaAutomatyczna.opis += wynik.urodzenie.data
        ? formatuj('DOPISEK_ZRODLO_DATY', zPesel)
        : formatuj('DOPISEK_BRAK_DATY_Z_PESEL');
    }
    return { doWeryfikacji, informacyjne };
  }
  function podsumuj(wyniki) {
    const suma = { kobieta: 0, mezczyzna: 0, doWeryfikacji: 0, razem: wyniki.length };
    for (const wynik of wyniki) {
      const kategoria = pobierzKategorie(wynik);
      suma[kategoria === K ? 'kobieta' : kategoria === M ? 'mezczyzna' : 'doWeryfikacji']++;
    }
    return suma;
  }

  const api = { utworzKlasyfikator, sprawdzPesel, ustawKlasyfikacjeReczna, pobierzKategorie, podsumuj,
    obliczWiek, parsujProgi, statystykiWiekowe, PROGI_TURYSTYCZNE, pobierzKomunikaty };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KlasyfikatorUczestnikow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
