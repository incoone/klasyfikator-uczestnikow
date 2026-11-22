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

  function rozstrzygnijRolePary(czlony, slownikImion, slownikNazwisk) {
    for (const czlon of czlony) {
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
        if (razem >= 100 && BigInt(razem) >= 50n * BigInt(slownikNazwisk.get(czlon.klucz).razem)) {
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
      if (czlon.rolaWstepna !== 'niejednoznaczna') continue;
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
      if (typeof oryginalnyWiersz !== 'string') throw new TypeError(formatuj('BLAD_TYPU_WIERSZA'));
      if (/[\r\n]/.test(oryginalnyWiersz)) throw new TypeError(formatuj('BLAD_WIELOWIERSZOWY'));
      if (!oryginalnyWiersz.trim()) return null;
      // Znaki inne niż litery, znaki łączące i liczby stają się separatorami.
      // Nie usuwamy polskich znaków, nie sklejamy cyfr i nie poprawiamy pisowni.
      const oczyszczonyWiersz = oryginalnyWiersz.replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
      const czlony = oczyszczonyWiersz ? oczyszczonyWiersz.split(/\s+/u) : [];
      const wskazania = { kobieta: 0, mezczyzna: 0, niejednoznaczne: 0 };
      const rozpoznaneImiona = [], nierozpoznaneCzlony = [], numery = [], ostrzezenia = [];
      const czlonyTekstowe = [], rozpoznaneNazwiska = [], rozpoznaneZdrobnienia = [];
      for (const [pozycja, tekst] of czlony.entries()) {
        if (/^\p{Nd}+$/u.test(tekst)) {
          // Tylko samodzielne ciągi 10-12 cyfr traktujemy jako potencjalny PESEL.
          if (!jestKandydatemNaPesel(tekst)) continue;
          numery.push({ pozycja, ...sprawdzPesel(tekst) });
          continue;
        }
        const klucz = tekst.toUpperCase();
        const imie = slownik.get(klucz);
        const nazwisko = nazwiska.get(klucz);
        const przewagaNazwiska = Boolean(imie && nazwisko && nazwisko.razem >= 100 &&
          BigInt(nazwisko.razem) >= 50n * BigInt(imie.statystyki.kobiety + imie.statystyki.mezczyzni));
        czlonyTekstowe.push({ pozycja, tekst, klucz,
          dopasowania: { imie: Boolean(imie), nazwisko: Boolean(nazwisko), zdrobnienie: zdrobnienia.has(klucz) },
          rola: imie && !nazwisko ? 'imie' : nazwisko && !imie ? 'nazwisko' : 'nierozstrzygnieta',
          podstawaRoli: imie && !nazwisko ? 'TYLKO_IMIE' : nazwisko && !imie ? 'TYLKO_NAZWISKO' : null,
          przewagaNazwiska });
        if (nazwisko) rozpoznaneNazwiska.push({ pozycja, tekst, klucz, statystyki: nazwisko });
        if (zdrobnienia.has(klucz)) rozpoznaneZdrobnienia.push({ pozycja, tekst, klucz,
          statystyki: statystykiImienia(klucz),
          odpowiedniki: zdrobnienia.get(klucz).map(pelne => ({ klucz: pelne, statystyki: statystykiImienia(pelne) })) });
        // Pole historyczne oznacza nadal brak dopasowania do słownika imion.
        if (!imie) nierozpoznaneCzlony.push({ pozycja, tekst });
      }
      const nowaAnalizaPar = czlonyTekstowe.length === 2 && jsonNazwiska !== null && jsonZdrobnienia !== null;
      if (nowaAnalizaPar) {
        rozstrzygnijRolePary(czlonyTekstowe, slownik, nazwiska);
        if (!rozpoznaneZdrobnienia.length && czlonyTekstowe.some(c => c.podstawaRoli === 'TYLKO_NAZWISKO')) {
          const czlon = czlonyTekstowe.find(c => c.rolaWstepna === 'nierozpoznana' && /^[A-Za-z]+$/.test(c.tekst));
          const wariant = czlon && wariantyZdrobnien.get(czlon.klucz);
          if (wariant && !slownik.has(wariant)) {
            const { pozycja, tekst, klucz } = czlon;
            czlon.dopasowania.zdrobnienie = true;
            czlon.rola = 'imie';
            czlon.podstawaRoli = 'KONTEKST_ZDROBNIENIA';
            rozpoznaneZdrobnienia.push({ pozycja, tekst, klucz, statystyki: null, wariantZPolskimiZnakami: wariant,
              odpowiedniki: zdrobnienia.get(wariant).map(pelne => ({ klucz: pelne, statystyki: statystykiImienia(pelne) })) });
          }
        }
      }

      // Dotychczasowa heurystyka obsługuje pozostałe wiersze i niepełne słowniki.
      const maOsobneNazwisko = czlonyTekstowe.some(c => c.podstawaRoli === 'TYLKO_NAZWISKO');
      const maInneJednoznaczneImie = czlonyTekstowe.some(c =>
        slownik.get(c.klucz)?.plec && !c.przewagaNazwiska);
      for (const czlon of czlonyTekstowe) {
        if (!nowaAnalizaPar && czlon.przewagaNazwiska && !maOsobneNazwisko && maInneJednoznaczneImie) {
          czlon.rola = 'nazwisko';
          czlon.podstawaRoli = 'PRZEWAGA_NAZWISKA';
        }
      }
      // Najpierw kończymy dotychczasową analizę nazwisk, aby kolejność członów
      // nie wpływała na dostępność kontekstu dla reguły 10x.
      const maRozpoznaneNazwisko = czlonyTekstowe.some(c => c.rola === 'nazwisko');
      const kontekstDwochCzlonow = czlonyTekstowe.length === 2 && maOsobneNazwisko;
      for (const czlon of czlonyTekstowe) {
        if (!nowaAnalizaPar && czlon.rola === 'nierozstrzygnieta' && czlon.dopasowania.imie && czlon.dopasowania.nazwisko) {
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
        const { pozycja, tekst, klucz } = czlon;
        const imie = slownik.get(klucz);
        if (!imie) continue;
        const uwzglednione = czlon.rola !== 'nazwisko';
        rozpoznaneImiona.push({ pozycja, tekst, klucz, plec: imie.plec,
          statystyki: imie.statystyki, sugestia: imie.plec === null ? imie.sugestia : null,
          uwzglednione, wariantZPolskimiZnakami: uwzglednione ? (sugestiePisowni.get(klucz) ?? null) : null });
        if (!uwzglednione) continue;
        wskazania[imie.plec === K ? 'kobieta' : imie.plec === M ? 'mezczyzna' : 'niejednoznaczne']++;
        if (imie.brakOpublikowanychWystapien && !ostrzezenia.includes('ZERO_W_DANYCH')) ostrzezenia.push('ZERO_W_DANYCH');
      }
      const aktywneImiona = rozpoznaneImiona.filter(i => i.uwzglednione);
      for (const wpis of [...rozpoznaneNazwiska, ...rozpoznaneZdrobnienia]) {
        wpis.rola = czlonyTekstowe.find(c => c.pozycja === wpis.pozycja).rola;
      }
      const silneNazwiska = rozpoznaneNazwiska.filter(n => n.rola === 'nazwisko' && n.statystyki.silneWskazanie);
      const kierunkiNazwisk = new Set(silneNazwiska.map(n => n.statystyki.plec));
      const uzasadnienie = [];
      let kategoria = W, zrodlo = null;
      const poprawnyPesel = wybierzPoprawnyPesel(numery);
      const paraPotencjalnychImion = nowaAnalizaPar && (
        czlonyTekstowe.every(c => c.rola === 'imie') ||
        czlonyTekstowe.every(c => c.rola === 'nierozstrzygnieta' && c.rolaWstepna === 'niejednoznaczna')
      );
      const paraNazwiskZeZdrobnieniem = nowaAnalizaPar && rozpoznaneZdrobnienia.length === 1 &&
        czlonyTekstowe.every(c => c.rolaWstepna === 'nazwisko');
      // W parze nazwisk sprawdzamy pełne formy jako osobną podstawę decyzji.
      // Zachowujemy role członów i dotychczasowe wskazania samodzielnych imion dla PESEL-u.
      for (const wpis of rozpoznaneZdrobnienia) {
        const czlon = czlonyTekstowe.find(c => c.pozycja === wpis.pozycja);
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
      const zdrobnieniaWKontekscie = rozpoznaneZdrobnienia.filter(z => z.kontekst);
      const jednoznaczneZdrobnienia = zdrobnieniaWKontekscie.filter(z => z.plecZPelnychForm);
      const kierunkiZdrobnien = new Set(jednoznaczneZdrobnienia.map(z => z.plecZPelnychForm));
      // W tej parze sprawdzamy też odrzucone dopasowania imion, np. Gala.
      const imionaDoSprawdzeniaZdrobnien = paraNazwiskZeZdrobnieniem ? rozpoznaneImiona : aktywneImiona;
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
          const wspomaganie = !wskazania.kobieta && !wskazania.mezczyzna && !remis &&
            kierunki.size === 1 && kierunkiNazwisk.size === 1 && kierunkiNazwisk.has([...kierunki][0]);
          if (!aktywneImiona.length) {
            uzasadnienie.push(...powodyBrakuDecyzjiZeZdrobnien(rozpoznaneZdrobnienia, paraNazwiskZeZdrobnieniem));
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
      // Sugestia nie zmienia kategorii. Przy konflikcie nie wybieramy zwycięzcy.
      const sugestie = new Set(kierunki);
      if (ostrzezenia.includes('KONFLIKT_ZDROBNIENIA')) sugestie.clear();
      if (poprawnyPesel) sugestie.add(poprawnyPesel.plec);
      return {
        urodzenie: ustalUrodzenie(oryginalnyWiersz, numery),
        numerWiersza, oryginalnyWiersz, oczyszczonyWiersz, rozpoznaneImiona,
        czlonyTekstowe, rozpoznaneNazwiska, rozpoznaneZdrobnienia,
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
    return { klasyfikujWiersz, klasyfikujListe };
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
    if (wynik.zrodlo === 'pesel' &&
        aktywneImiona.some(i => !i.plec && i.sugestia && i.sugestia !== wynik.kategoriaAutomatyczna)) {
      dodaj('PESEL_PRZECIWNE_IMIE', 'medium', formatuj('PESEL_PRZECIWNE_IMIE'));
    }
    // Uwagi o rolach i zdrobnieniach nie są zadaniami ręcznej klasyfikacji płci.
    // Jeden komunikat danego rodzaju na klucz; pozycje wskazują wszystkie powtórzenia.
    const noweUwagi = new Map();
    const dodajSzczegolowa = (kod, severity, obszar, wpis, opis) => {
      const id = kod + ':' + wpis.klucz;
      if (noweUwagi.has(id)) noweUwagi.get(id).pozycje.push(wpis.pozycja);
      else noweUwagi.set(id, { kod, severity, obszar, klucz: wpis.klucz, pozycje: [wpis.pozycja], opis });
    };
    // Powtórzenie tego samego imienia nie stanowi niezależnego potwierdzenia.
    const jednoznaczneImiona = new Set(aktywneImiona.filter(i => i.plec).map(i => i.klucz));
    const niezalezneWskazanie = wynik.rozpoznaneNazwiska?.some(n =>
      n.rola === 'nazwisko' && n.statystyki.silneWskazanie && n.statystyki.plec === wynik.kategoriaAutomatyczna) ||
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
    for (const czlon of wynik.czlonyTekstowe ?? []) {
      if (czlon.podstawaRoli === 'KONTEKST_IMIENIA_DWA_CZLONY' ||
          czlon.podstawaRoli === 'KONTEKST_NAZWISKA_DWA_CZLONY') {
        const nazwisko = czlon.podstawaRoli === 'KONTEKST_NAZWISKA_DWA_CZLONY';
        // T-001 opisuje rolę tego członu w treści samodzielnej weryfikacji.
        if (nazwisko && weryfikacjaAutomatyczna && wynik.ostrzezenia.includes('KONFLIKT_ZDROBNIENIA') &&
            wynik.uzasadnienie.includes(formatuj('POWOD_KONFLIKT_ZDROBNIENIA_IMIE_W_NAZWISKU', czlon.tekst))) continue;
        const drugi = wynik.czlonyTekstowe.find(c => c.pozycja !== czlon.pozycja);
        const kod = nazwisko ? 'ROLA_NAZWISKA_Z_KONTEKSTU' : 'ROLA_IMIENIA_Z_KONTEKSTU';
        const przeciwneImie = nazwisko && wynik.kategoriaAutomatyczna !== W &&
          wynik.rozpoznaneImiona.some(i => i.pozycja === czlon.pozycja && i.plec && i.plec !== wynik.kategoriaAutomatyczna);
        let opis = formatuj('ROLA_Z_KONTEKSTU_PARY', czlon.tekst, drugi.tekst, czlon.rola);
        if (przeciwneImie) opis += formatuj('DOPISEK_PRZECIWNE_IMIE_W_NAZWISKU');
        dodajSzczegolowa(kod, przeciwneImie ? 'medium' : 'low', 'dane', czlon, opis);
      } else if (czlon.podstawaRoli === 'KONTEKST_DWOCH_CZLONOW') {
        const nazwisko = wynik.czlonyTekstowe.find(c => c.podstawaRoli === 'TYLKO_NAZWISKO');
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
        if (wpis.rola === 'nazwisko' && wpis.statystyki.silneWskazanie &&
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
