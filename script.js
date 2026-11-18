/* Logika bez interfejsu, bibliotek, sieci i zapisu danych.
 * Przeglądarka: KlasyfikatorUczestnikow.utworzKlasyfikator(json).
 * Node: const API = require('./script.js').
 * JSON: { meta: {...}, imiona: { ANNA: [kobiety, mezczyzni] } }.
 */
(function (root) {
  'use strict';
  const K = 'Kobieta', M = 'Mężczyzna', W = 'Do weryfikacji';

  // Weryfikujemy strukturę numeru, nie jego nadanie ani tożsamość osoby.
  // Kodowanie daty i wagi: https://www.gov.pl/web/gov/czym-jest-numer-pesel
  function sprawdzPesel(numer) {
    if (typeof numer !== 'string') throw new TypeError('PESEL musi być tekstem.');
    const wynik = {
      numer, poprawny: false, formatPoprawny: /^[0-9]{11}$/.test(numer),
      dataPoprawna: null, kontrolnaPoprawna: null,
      dataUrodzenia: null, plec: null, bledy: []
    };
    if (!wynik.formatPoprawny) {
      wynik.bledy.push('PESEL musi składać się z dokładnie 11 cyfr 0-9.');
      return wynik;
    }
    const kodMiesiaca = Number(numer.slice(2, 4));
    const stulecia = [1900, 2000, 2100, 2200, 1800];
    const rok = stulecia[Math.floor(kodMiesiaca / 20)] + Number(numer.slice(0, 2));
    const miesiac = kodMiesiaca % 20;
    const dzien = Number(numer.slice(4, 6));
    wynik.dataUrodzenia = dataISO(rok, miesiac, dzien);
    wynik.dataPoprawna = wynik.dataUrodzenia !== null;
    if (!wynik.dataPoprawna) wynik.bledy.push('Nieprawidłowa data zakodowana w PESEL.');
    const wagi = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    const suma = wagi.reduce((s, waga, i) => s + Number(numer[i]) * waga, 0);
    wynik.kontrolnaPoprawna = (10 - suma % 10) % 10 === Number(numer[10]);
    if (!wynik.kontrolnaPoprawna) wynik.bledy.push('Błędna cyfra kontrolna PESEL.');
    wynik.poprawny = wynik.dataPoprawna && wynik.kontrolnaPoprawna;
    // Płeć udostępniamy tylko dla numeru, który przeszedł wszystkie kontrole.
    if (wynik.poprawny) wynik.plec = Number(numer[9]) % 2 === 0 ? K : M;
    return wynik;
  }

  function dataISO(rok, miesiac, dzien) {
    const przestepny = rok % 4 === 0 && (rok % 100 !== 0 || rok % 400 === 0);
    const dni = [31, przestepny ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (rok < 1 || rok > 9999 || miesiac < 1 || miesiac > 12 || dzien < 1 || dzien > dni[miesiac - 1]) return null;
    return [String(rok).padStart(4, '0'), String(miesiac).padStart(2, '0'), String(dzien).padStart(2, '0')].join('-');
  }

  function ustalUrodzenie(wiersz, numery) {
    const wpisane = [], uwagi = [];
    // Szukamy pełnego zapisu z czterocyfrowym rokiem. Zwykła numeracja listy
    // i samodzielne liczby w dalszym ciągu podlegają regułom klasyfikatora.
    const wzor = /(?<![\p{L}\p{M}\p{N}])(?:\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})(?![\p{L}\p{M}\p{N}])/gu;
    for (const [tekst] of wiersz.matchAll(wzor)) {
      const [a, b, c] = tekst.split(/[-./]/);
      const [rok, dzien] = a.length === 4 ? [a, c] : [c, a];
      const separatory = tekst.match(/[-./]/g);
      const data = separatory[0] === separatory[1] ? dataISO(+rok, +b, +dzien) : null;
      wpisane.push({ tekst, data });
      if (!data) uwagi.push({ severity: 'high', kod: 'BLEDNA_DATA', opis: 'Nieprawidłowa data urodzenia: ' + tekst });
    }

    const daty = [...new Set(wpisane.map(w => w.data).filter(Boolean))];
    const dataPesel = numery.length === 1 && numery[0].poprawny ? numery[0].dataUrodzenia : null;
    if (numery.some(n => !n.poprawny)) uwagi.push({ severity: 'high', kod: 'BLEDNY_PESEL', opis: 'Nieprawidłowy PESEL. Szczegóły w wyniku sprawdzenia numeru.' });
    if (numery.length > 1) uwagi.push({ severity: 'high', kod: 'KILKA_NUMEROW', opis: 'Kilka potencjalnych numerów PESEL. Nie wybrano daty z numeru.' });
    let data = null, zrodlo = null;
    if (daty.length > 1) {
      uwagi.push({ severity: 'high', kod: 'ROZNE_DATY', opis: 'Wpisano kilka różnych dat urodzenia.' });
    } else if (daty.length && dataPesel && daty[0] !== dataPesel) {
      uwagi.push({ severity: 'high', kod: 'KONFLIKT_DATY_PESEL', opis: 'Wpisana data różni się od daty z poprawnego PESEL.' });
    } else if (daty.length) {
      data = daty[0];
      zrodlo = dataPesel ? 'wiersz_i_pesel' : 'wiersz';
    } else if (dataPesel) {
      data = dataPesel;
      zrodlo = 'pesel';
    }
    return { data, zrodlo, wpisane, uwagi };
  }

  function sprawdzDateWydarzenia(data) {
    if (data == null || data === '') return null;
    if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
        dataISO(...data.split('-').map(Number)) !== data) {
      throw new RangeError('Data wydarzenia musi być poprawną datą RRRR-MM-DD.');
    }
    return data;
  }

  function wiekNaDzien(wynik, dzien) {
    const { data } = wynik.urodzenie;
    const uwagi = [...wynik.urodzenie.uwagi];
    let wiek = null;
    if (dzien && data) {
      if (data > dzien) {
        uwagi.push({ severity: 'high', kod: 'URODZENIE_PO_WYDARZENIU', opis: 'Data urodzenia jest późniejsza niż data wydarzenia.' });
      } else {
        wiek = Number(dzien.slice(0, 4)) - Number(data.slice(0, 4));
        // Porównanie MM-DD daje także 1 marca dla 29 lutego w roku nieprzestępnym.
        if (dzien.slice(5) < data.slice(5)) wiek--;
      }
    }
    return { wiek, uwagi };
  }

  function obliczWiek(wynik, dataWydarzenia) {
    return wiekNaDzien(wynik, sprawdzDateWydarzenia(dataWydarzenia));
  }

  const PROGI_TURYSTYCZNE = Object.freeze([10, 12, 14, 16, 18, 25, 60]);

  function parsujProgi(wejscie) {
    let liczby;
    if (typeof wejscie === 'string') {
      // Myślnik pomiędzy cyframi to separator; minus na początku wartości to znak.
      liczby = [];
      for (const m of wejscie.matchAll(/[0-9]+/g)) {
        const przed = wejscie.slice(Math.max(0, m.index - 2), m.index);
        if (/[-−]$/.test(przed) && !/[0-9][-−]$/.test(przed)) continue;
        liczby.push(Number(m[0]));
      }
    } else if (Array.isArray(wejscie)) {
      liczby = wejscie;
    } else {
      throw new TypeError('Podaj tekst lub tablicę liczbowych progów.');
    }
    return [...new Set(liczby.filter(n => Number.isSafeInteger(n) && n >= 0))].sort((a, b) => a - b);
  }

  function statystykiWiekowe(wyniki, dataWydarzenia, progi = PROGI_TURYSTYCZNE) {
    const dzien = sprawdzDateWydarzenia(dataWydarzenia);
    const zakresy = parsujProgi(progi).map(prog => ({ prog, ponizej: 0, coNajmniej: 0 }));
    let nieustalony = 0;
    for (const wynik of wyniki) {
      const { wiek } = wiekNaDzien(wynik, dzien);
      if (wiek === null) { nieustalony++; continue; }
      for (const zakres of zakresy) {
        if (wiek < zakres.prog) zakres.ponizej++;
        else zakres.coNajmniej++;
      }
    }
    return { dataWydarzenia: dzien, razem: wyniki.length, nieustalony, progi: zakresy };
  }

  // Kopiujemy i walidujemy dodatkowe słowniki tylko podczas inicjalizacji.
  function przygotujNazwiska(json) {
    const mapa = new Map();
    if (json === null) return mapa;
    if (!json || !json.nazwiska || typeof json.nazwiska !== 'object' || Array.isArray(json.nazwiska)) {
      throw new TypeError('Oczekiwano obiektu JSON z polem nazwiska.');
    }
    for (const [tekst, liczby] of Object.entries(json.nazwiska)) {
      const klucz = tekst.toUpperCase();
      if (!klucz.trim() || mapa.has(klucz) || !Array.isArray(liczby) || liczby.length !== 2 ||
          !liczby.every(n => Number.isSafeInteger(n) && n >= 0) ||
          !Number.isSafeInteger(liczby[0] + liczby[1]) || liczby[0] + liczby[1] === 0) {
        throw new TypeError('Nieprawidłowy wpis nazwiska: ' + tekst);
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
      throw new TypeError('Oczekiwano obiektu JSON z polem zdrobnienia.');
    }
    for (const [tekst, odpowiedniki] of Object.entries(json.zdrobnienia)) {
      const klucz = tekst.toUpperCase();
      if (!klucz.trim() || mapa.has(klucz) || !Array.isArray(odpowiedniki) || !odpowiedniki.length ||
          !odpowiedniki.every(n => typeof n === 'string' && n.trim())) {
        throw new TypeError('Nieprawidłowy wpis zdrobnienia: ' + tekst);
      }
      mapa.set(klucz, Object.freeze([...new Set(odpowiedniki.map(n => n.toUpperCase()))]));
    }
    return mapa;
  }

  // Wyłącznie do wyszukiwania sugestii pisowni. Nie używamy tej normalizacji
  // do dopasowania uczestnika, rozstrzygania roli ani klasyfikacji płci.
  function bezPolskichZnakow(klucz) {
    const zamiana = { Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z' };
    return klucz.replace(/[ĄĆĘŁŃÓŚŹŻ]/g, znak => zamiana[znak]);
  }

  function utworzKlasyfikator(json, jsonNazwiska = null, jsonZdrobnienia = null) {
    if (!json || !json.imiona || typeof json.imiona !== 'object' || Array.isArray(json.imiona)) {
      throw new TypeError('Oczekiwano obiektu JSON z polem imiona.');
    }
    const slownik = new Map();
    for (const [imie, liczby] of Object.entries(json.imiona)) {
      if (!Array.isArray(liczby) || liczby.length !== 2 ||
          !liczby.every(n => Number.isSafeInteger(n) && n >= 0) ||
          !Number.isSafeInteger(liczby[0] + liczby[1]) || liczby[0] + liczby[1] === 0) {
        throw new TypeError(`Nieprawidłowe liczby dla imienia: ${imie}`);
      }
      const klucz = imie.toUpperCase();
      if (slownik.has(klucz)) throw new TypeError(`Powtórzony klucz: ${klucz}`);
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
    if (slownik.size === 0) throw new TypeError('Słownik imion jest pusty.');
    const nazwiska = przygotujNazwiska(jsonNazwiska);
    const zdrobnienia = przygotujZdrobnienia(jsonZdrobnienia);
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
      if (typeof oryginalnyWiersz !== 'string') throw new TypeError('Wiersz musi być tekstem.');
      if (/[\r\n]/.test(oryginalnyWiersz)) throw new TypeError('Przekaż jeden wiersz albo użyj klasyfikujListe.');
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
          if (!/^\p{Nd}{10,12}$/u.test(tekst)) continue;
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
      // Rozstrzygamy role równocześnie, niezależnie od kolejności i od PESEL-u.
      const maOsobneNazwisko = czlonyTekstowe.some(c => c.podstawaRoli === 'TYLKO_NAZWISKO');
      const maInneJednoznaczneImie = czlonyTekstowe.some(c =>
        slownik.get(c.klucz)?.plec && !c.przewagaNazwiska);
      for (const czlon of czlonyTekstowe) {
        if (czlon.przewagaNazwiska && !maOsobneNazwisko && maInneJednoznaczneImie) {
          czlon.rola = 'nazwisko';
          czlon.podstawaRoli = 'PRZEWAGA_NAZWISKA';
        }
      }
      // Najpierw kończymy dotychczasową analizę nazwisk, aby kolejność członów
      // nie wpływała na dostępność kontekstu dla reguły 10x.
      const maRozpoznaneNazwisko = czlonyTekstowe.some(c => c.rola === 'nazwisko');
      const kontekstDwochCzlonow = czlonyTekstowe.length === 2 && maOsobneNazwisko;
      for (const czlon of czlonyTekstowe) {
        if (czlon.rola === 'nierozstrzygnieta' && czlon.dopasowania.imie && czlon.dopasowania.nazwisko) {
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
      const poprawnyPesel = numery.length === 1 && numery[0].poprawny ? numery[0] : null;
      // Samodzielne imię ma pierwszeństwo przed jego redakcyjnym rozwinięciem.
      // Rola zdrobnienia wymaga osobnego nazwiska lub poprawnego pojedynczego PESEL-u.
      for (const wpis of rozpoznaneZdrobnienia) {
        const czlon = czlonyTekstowe.find(c => c.pozycja === wpis.pozycja);
        const mozeBycImieniem = !wpis.statystyki && !czlon.dopasowania.nazwisko;
        wpis.kontekst = mozeBycImieniem && (maRozpoznaneNazwisko || poprawnyPesel)
          ? (maRozpoznaneNazwisko ? (poprawnyPesel ? 'nazwisko_i_pesel' : 'nazwisko') : 'pesel') : null;
        const pelnePlcie = wpis.odpowiedniki.map(p => slownik.get(p.klucz)?.plec ?? null);
        wpis.plecZPelnychForm = !wpis.statystyki && pelnePlcie.every(p => p !== null && p === pelnePlcie[0])
          ? pelnePlcie[0] : null;
        wpis.wykorzystaneDoKlasyfikacji = false;
        wpis.sprzeczneZPeselem = false;
        if (wpis.kontekst) {
          wpis.rola = czlon.rola = 'imie';
          czlon.podstawaRoli = 'KONTEKST_ZDROBNIENIA';
        }
      }
      const zdrobnieniaWKontekscie = rozpoznaneZdrobnienia.filter(z => z.kontekst);
      const jednoznaczneZdrobnienia = zdrobnieniaWKontekscie.filter(z => z.plecZPelnychForm);
      const kierunkiZdrobnien = new Set(jednoznaczneZdrobnienia.map(z => z.plecZPelnychForm));
      const konfliktZdrobnien = kierunkiZdrobnien.size > 1 || jednoznaczneZdrobnienia.some(z =>
        aktywneImiona.some(i => (i.plec || i.sugestia) && (i.plec || i.sugestia) !== z.plecZPelnychForm));
      const konfliktZdrobnieniaZNazwiskiem = !aktywneImiona.length && jednoznaczneZdrobnienia.some(z =>
        silneNazwiska.some(n => n.statystyki.plec !== z.plecZPelnychForm));
      const podejrzane = numery.some(n => !n.formatPoprawny);
      const kandydaci = numery.filter(n => n.formatPoprawny);
      if (aktywneImiona.length === 0) ostrzezenia.push('BRAK_ROZPOZNANYCH_IMION');
      if (wskazania.niejednoznaczne) ostrzezenia.push('NIEJEDNOZNACZNE_IMIONA');
      const kierunki = new Set(aktywneImiona.map(i => i.plec || i.sugestia));
      const remis = kierunki.delete(null);
      if (kierunki.size > 1) ostrzezenia.push('SPRZECZNE_IMIONA');
      if (podejrzane) uzasadnienie.push('Nieprawidłowy format PESEL - wymagane jest dokładnie 11 cyfr 0-9.');
      if (kandydaci.length > 1) uzasadnienie.push('W jednym wierszu znaleziono kilka potencjalnych numerów PESEL.');
      if (kandydaci.some(n => !n.poprawny)) uzasadnienie.push('Potencjalny PESEL nie przeszedł walidacji.');
      if (uzasadnienie.length === 0 && poprawnyPesel) {
        const sprzecznosc = poprawnyPesel.plec === K ? wskazania.mezczyzna > 0 : wskazania.kobieta > 0;
        if (sprzecznosc) {
          uzasadnienie.push('Jednoznaczne imię wskazuje inną płeć niż poprawny PESEL.');
          ostrzezenia.push('KONFLIKT_PESEL_IMIONA');
        } else {
          kategoria = poprawnyPesel.plec;
          zrodlo = 'pesel';
          uzasadnienie.push('Klasyfikacja na podstawie poprawnego PESEL; brak sprzecznych jednoznacznych imion.');
          for (const wpis of jednoznaczneZdrobnienia) wpis.sprzeczneZPeselem = wpis.plecZPelnychForm !== kategoria;
        }
      } else if (uzasadnienie.length === 0) {
        const klasyfikacjaZeZdrobnien = !aktywneImiona.length && zdrobnieniaWKontekscie.length > 0 &&
          jednoznaczneZdrobnienia.length === zdrobnieniaWKontekscie.length;
        if (konfliktZdrobnien || konfliktZdrobnieniaZNazwiskiem) {
          uzasadnienie.push('Pełne formy zdrobnienia wskazują płeć sprzeczną z innym imieniem, zdrobnieniem lub silnym wskazaniem nazwiska.');
          ostrzezenia.push('KONFLIKT_ZDROBNIENIA');
        } else if (klasyfikacjaZeZdrobnien) {
          kategoria = [...kierunkiZdrobnien][0];
          zrodlo = 'zdrobnienia';
          uzasadnienie.push('Płeć ustalono na podstawie zdrobnienia: wszystkie pełne formy są obecne w słowniku, osiągają próg 99,90% i wskazują tę samą płeć.');
          for (const wpis of jednoznaczneZdrobnienia) wpis.wykorzystaneDoKlasyfikacji = true;
        } else {
          const wspomaganie = !wskazania.kobieta && !wskazania.mezczyzna && !remis &&
            kierunki.size === 1 && kierunkiNazwisk.size === 1 && kierunkiNazwisk.has([...kierunki][0]);
          if (!aktywneImiona.length) uzasadnienie.push('Nie znaleziono żadnego imienia uwzględnianego przy klasyfikacji.');
          else if (!wskazania.kobieta && !wskazania.mezczyzna && !wspomaganie) {
            uzasadnienie.push('Żadne rozpoznane imię nie osiąga progu 99,90%, a nazwisko nie dostarcza zgodnego silnego wskazania.');
          }
          if (remis) uzasadnienie.push('Rozpoznano imię o równych liczbach wystąpień u kobiet i mężczyzn.');
          if (kierunki.size > 1) uzasadnienie.push('Rozpoznane imiona wskazują różne płcie.');
          if (uzasadnienie.length === 0) {
            kategoria = [...kierunki][0];
            zrodlo = wspomaganie ? 'imiona_i_nazwisko' : 'imiona';
            uzasadnienie.push(wspomaganie
              ? 'Zgodne wskazania niejednoznacznych imion wsparto nazwiskiem o minimum 100 wystąpieniach i udziale płci co najmniej 99,90%.'
              : 'Co najmniej jedno imię osiąga próg 99,90%, a wszystkie uwzględnione imiona wskazują tę samą płeć.');
          }
        }
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
      if (typeof tekst !== 'string') throw new TypeError('Lista musi być tekstem.');
      return tekst.split(/\r\n|\n|\r/).map((wiersz, i) => klasyfikujWiersz(wiersz, i + 1)).filter(Boolean);
    }
    return { klasyfikujWiersz, klasyfikujListe };
  }

  function ustawKlasyfikacjeReczna(wynik, kategoria) {
    if (![K, M, W, null].includes(kategoria)) throw new TypeError('Nieprawidłowa kategoria.');
    return { ...wynik, klasyfikacjaReczna: kategoria }; // null przywraca automat
  }
  function pobierzKategorie(wynik) {
    return wynik.klasyfikacjaReczna ?? wynik.kategoriaAutomatyczna;
  }
  // Klasyfikacja ręczna i dzień wydarzenia mogą zmienić listę aktywnych uwag.
  function pobierzKomunikaty(wynik, dataWydarzenia) {
    const doWeryfikacji = [], informacyjne = [];
    const aktywneImiona = wynik.rozpoznaneImiona.filter(i => i.uwzglednione !== false);
    if (pobierzKategorie(wynik) === W) {
      const reczna = wynik.klasyfikacjaReczna === W;
      doWeryfikacji.push({ obszar: 'plec', severity: 'high', kod: reczna ? 'RECZNA_WERYFIKACJA' : 'WERYFIKACJA_PLCI',
        opis: reczna ? 'Wpis oznaczono ręcznie do weryfikacji.' : wynik.uzasadnienie.join(' ') });
    }
    const dodaj = (kod, severity, opis) => informacyjne.push({ obszar: 'plec', kod, severity, opis });
    // Jedna uwaga progowa na dany człon słownikowy również przy powtórzeniach.
    const opisane = new Set();
    for (const imie of aktywneImiona) {
      if (imie.statystyki.uwagaProgowa && !opisane.has(imie.klucz)) {
        opisane.add(imie.klucz);
        dodaj('IMIE_W_PRZEDZIALE_PROGOWYM', 'low',
          'Rozpoznane imię: ' + imie.tekst + '. Udział dominującej płci wynosi co najmniej 99,90% i mniej niż 99,98%.');
      }
    }
    if (wynik.zrodlo) {
      const slabe = aktywneImiona.filter(i => !i.plec);
      if (wynik.zrodlo === 'imiona' && slabe.length) {
        dodaj('ZGODNE_SLABE_IMIE', 'low', 'Imię poniżej progu wskazuje tę samą płeć co imię jednoznaczne.');
      }
      if (wynik.zrodlo === 'pesel') {
        if (!aktywneImiona.length && !wynik.rozpoznaneZdrobnienia?.some(z => z.kontekst)) {
          dodaj('PESEL_BEZ_IMIENIA', 'medium', 'Płeć ustalono z PESEL. Nie rozpoznano imienia.');
        }
        if (slabe.some(i => i.sugestia === null)) dodaj('PESEL_REMIS', 'medium', 'Płeć ustalono z PESEL mimo remisu w statystykach imienia.');
        if (slabe.some(i => i.sugestia && i.sugestia !== wynik.kategoriaAutomatyczna)) {
          dodaj('PESEL_PRZECIWNE_IMIE', 'medium', 'Płeć ustalono z PESEL mimo przeciwnego wskazania imienia poniżej progu.');
        }
        if (slabe.some(i => i.sugestia === wynik.kategoriaAutomatyczna)) {
          const maJednoznaczneImie = aktywneImiona.some(i => i.plec);
          dodaj('PESEL_ZGODNE_SLABE_IMIE', maJednoznaczneImie ? 'low' : 'medium', 'Imię poniżej progu jest zgodne z płcią ustaloną z PESEL.');
        }
      }
    }
    // Uwagi o rolach i zdrobnieniach nie są zadaniami ręcznej klasyfikacji płci.
    // Jeden komunikat danego rodzaju na klucz; pozycje wskazują wszystkie powtórzenia.
    const noweUwagi = new Map();
    const dodajSzczegolowa = (kod, severity, obszar, wpis, opis) => {
      const id = kod + ':' + wpis.klucz;
      if (noweUwagi.has(id)) noweUwagi.get(id).pozycje.push(wpis.pozycja);
      else noweUwagi.set(id, { kod, severity, obszar, klucz: wpis.klucz, pozycje: [wpis.pozycja], opis });
    };
    for (const imie of aktywneImiona) {
      const razem = imie.statystyki.kobiety + imie.statystyki.mezczyzni;
      const wariant = imie.wariantZPolskimiZnakami;
      const zgodneJednoznaczne = Boolean(wariant && imie.plec && imie.plec === wariant.plec);
      if (wariant) {
        const razemWariant = wariant.statystyki.kobiety + wariant.statystyki.mezczyzni;
        const zapis = wariant.klucz.charAt(0) + wariant.klucz.slice(1).toLowerCase();
        dodajSzczegolowa('MOZLIWY_BRAK_POLSKICH_ZNAKOW', 'low', 'dane', imie,
          'Możliwa literówka lub zapis bez polskich znaków. Imię „' + imie.tekst +
          '” występuje w rejestrze PESEL (' + razem + ' osób), jednak znacznie popularniejszą formą jest „' +
          zapis + '” (' + razemWariant + ' osób).');
      }
      if (razem >= 30 && razem < 100 && !zgodneJednoznaczne) {
        dodajSzczegolowa('RZADKIE_IMIE', razem < 50 ? 'high' : 'medium', 'plec', imie,
          'Rozpoznane imię: ' + imie.tekst + '. Łączna liczba opublikowanych wystąpień: ' + razem +
          '. Mała liczebność danych nie blokuje automatycznej klasyfikacji.');
      }
    }
    for (const czlon of wynik.czlonyTekstowe ?? []) {
      if (czlon.podstawaRoli === 'KONTEKST_DWOCH_CZLONOW') {
        const nazwisko = wynik.czlonyTekstowe.find(c => c.podstawaRoli === 'TYLKO_NAZWISKO');
        dodajSzczegolowa('ROLA_IMIENIA_Z_KONTEKSTU', 'low', 'dane', czlon,
          '„' + czlon.tekst + '” występuje zarówno w słowniku imion, jak i nazwisk. Ponieważ drugi człon („' +
          nazwisko.tekst + '”) występuje wyłącznie w słowniku nazwisk, „' + czlon.tekst +
          '” potraktowano jako prawdopodobne imię. Sprawdź poprawność przypisania.');
      } else if (czlon.podstawaRoli === 'PRZEWAGA_IMIENIA_10_Z_NAZWISKIEM') {
        dodajSzczegolowa('ROLA_IMIENIA_ZE_STATYSTYK', 'low', 'dane', czlon,
          '„' + czlon.tekst + '” potraktowano jako imię na podstawie co najmniej 10-krotnej przewagi liczebności imienia i obecności rozpoznanego nazwiska. Sprawdź poprawność przypisania.');
      } else if (czlon.podstawaRoli === 'PRZEWAGA_NAZWISKA') {
        dodajSzczegolowa('ROLA_NAZWISKA_ZE_STATYSTYK', 'medium', 'dane', czlon,
          '„' + czlon.tekst + '” potraktowano jako nazwisko na podstawie częstości występowania w słownikach. Sprawdź poprawność przypisania.');
      } else if (czlon.rola === 'nierozstrzygnieta' && czlon.dopasowania.imie && czlon.dopasowania.nazwisko) {
        dodajSzczegolowa('NIEROZSTRZYGNIETA_ROLA', 'high', 'dane', czlon,
          'Nie ustalono jednoznacznie, czy „' + czlon.tekst + '” jest imieniem, czy nazwiskiem. Sprawdź poprawność przypisania.');
      }
    }
    for (const wpis of wynik.rozpoznaneZdrobnienia ?? []) {
      const liczebnosc = stat => stat === null ? 'brak wpisu w słowniku imion (nie oznacza zera)' :
        (stat.kobiety + stat.mezczyzni) + ' osób (kobiety: ' + stat.kobiety + ', mężczyźni: ' + stat.mezczyzni + ')';
      const opis = wpis.wykorzystaneDoKlasyfikacji
        ? 'Płeć ustalono na podstawie zdrobnienia „' + wpis.tekst + '”. Sprawdź zgodność imienia z dokumentem tożsamości.'
        : wpis.sprzeczneZPeselem
        ? 'Płeć ustalono z poprawnego PESEL mimo przeciwnego wskazania pełnych form zdrobnienia „' + wpis.tekst + '”. Sprawdź zgodność imienia z dokumentem tożsamości.'
        : wpis.rola === 'nazwisko'
        ? '„' + wpis.tekst + '” występuje również w słowniku zdrobnień; w tym wierszu został potraktowany jako nazwisko.'
        : '„' + wpis.tekst + '” może być zdrobnieniem lub formą potoczną.' +
          (wpis.statystyki ? ' Występuje również jako samodzielne imię.' : '') +
          ' Sprawdź zgodność imienia z dokumentem tożsamości.';
      const statystyki = wpis.odpowiedniki.map(p => p.klucz + ' - ' + liczebnosc(p.statystyki)).join('; ');
      dodajSzczegolowa('MOZLIWE_ZDROBNIENIE', 'high', 'dane', wpis,
        opis + ' Możliwe pełne odpowiedniki i statystyki imion: ' + statystyki +
        '. Jako samodzielne imię: ' + liczebnosc(wpis.statystyki) + '.');
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
            'Silne wskazanie nazwiska „' + wpis.tekst + '” jest przeciwne do płci ustalonej ' +
            (wynik.zrodlo === 'pesel' ? 'z poprawnego PESEL.' : 'na podstawie imion.') +
            ' Sprawdź poprawność danych.');
        }
      }
    }
    informacyjne.push(...noweUwagi.values());
    const ocena = obliczWiek(wynik, dataWydarzenia);
    for (const uwaga of ocena.uwagi) {
      const wpis = { obszar: 'wiek', ...uwaga };
      if (uwaga.kod === 'URODZENIE_PO_WYDARZENIU' || !wynik.urodzenie.data) {
        doWeryfikacji.push(wpis);
      } else {
        const zPesel = wynik.urodzenie.zrodlo === 'pesel';
        wpis.opis += zPesel ? ' Przyjęto datę urodzenia z poprawnego PESEL.' : ' Przyjęto poprawną datę wpisaną w wierszu.';
        informacyjne.push(wpis);
      }
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
