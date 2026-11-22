(function (root) {
  'use strict';
  const { formatuj } = typeof module !== 'undefined' && module.exports
    ? require('./komunikaty.js')
    : root.KlasyfikatorKomunikaty;

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
      if (!data) uwagi.push({ severity: 'high', kod: 'BLEDNA_DATA', opis: formatuj('BLEDNA_DATA', tekst) });
    }

    const daty = [...new Set(wpisane.map(w => w.data).filter(Boolean))];
    const dataPesel = numery.length === 1 && numery[0].poprawny ? numery[0].dataUrodzenia : null;
    if (numery.some(n => !n.poprawny)) uwagi.push({ severity: 'high', kod: 'BLEDNY_PESEL', opis: formatuj('BLEDNY_PESEL') });
    if (numery.length > 1) uwagi.push({ severity: 'high', kod: 'KILKA_NUMEROW', opis: formatuj('KILKA_NUMEROW') });
    let data = null, zrodlo = null;
    if (daty.length > 1) {
      uwagi.push({ severity: 'high', kod: 'ROZNE_DATY', opis: formatuj('ROZNE_DATY') });
    } else if (daty.length && dataPesel && daty[0] !== dataPesel) {
      uwagi.push({ severity: 'high', kod: 'KONFLIKT_DATY_PESEL', opis: formatuj('KONFLIKT_DATY_PESEL') });
    } else if (daty.length) {
      data = daty[0];
      zrodlo = dataPesel ? 'wiersz_i_pesel' : 'wiersz';
    } else if (dataPesel) {
      data = dataPesel;
      zrodlo = 'pesel';
    }
    if (data) {
      for (const uwaga of uwagi) {
        if (uwaga.kod === 'BLEDNA_DATA') uwaga.severity = 'medium';
      }
    }
    return { data, zrodlo, wpisane, uwagi };
  }

  function sprawdzDateWydarzenia(data) {
    if (data == null || data === '') return null;
    if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
        dataISO(...data.split('-').map(Number)) !== data) {
      throw new RangeError(formatuj('BLAD_DATY_WYDARZENIA'));
    }
    return data;
  }

  function wiekNaDzien(wynik, dzien) {
    const { data } = wynik.urodzenie;
    const uwagi = [...wynik.urodzenie.uwagi];
    let wiek = null;
    if (dzien && data) {
      if (data > dzien) {
        uwagi.push({ severity: 'high', kod: 'URODZENIE_PO_WYDARZENIU', opis: formatuj('URODZENIE_PO_WYDARZENIU') });
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
      throw new TypeError(formatuj('BLAD_PROGOW'));
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

  const api = { dataISO, ustalUrodzenie, obliczWiek, parsujProgi, statystykiWiekowe, PROGI_TURYSTYCZNE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KlasyfikatorDaty = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
