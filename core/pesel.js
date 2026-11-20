(function (root) {
  'use strict';
  const { formatuj } = typeof module !== 'undefined' && module.exports
    ? require('./komunikaty.js')
    : root.KlasyfikatorKomunikaty;
  const { dataISO } = typeof module !== 'undefined' && module.exports
    ? require('./daty.js')
    : root.KlasyfikatorDaty;

  // Weryfikujemy strukturę numeru, nie jego nadanie ani tożsamość osoby.
  // Kodowanie daty i wagi: https://www.gov.pl/web/gov/czym-jest-numer-pesel
  function sprawdzPesel(numer) {
    if (typeof numer !== 'string') throw new TypeError(formatuj('BLAD_TYPU_PESEL'));
    const wynik = {
      numer, poprawny: false, formatPoprawny: /^[0-9]{11}$/.test(numer),
      dataPoprawna: null, kontrolnaPoprawna: null,
      dataUrodzenia: null, plec: null, bledy: []
    };
    if (!wynik.formatPoprawny) {
      wynik.bledy.push(formatuj('PESEL_FORMAT'));
      return wynik;
    }
    const kodMiesiaca = Number(numer.slice(2, 4));
    const stulecia = [1900, 2000, 2100, 2200, 1800];
    const rok = stulecia[Math.floor(kodMiesiaca / 20)] + Number(numer.slice(0, 2));
    const miesiac = kodMiesiaca % 20;
    const dzien = Number(numer.slice(4, 6));
    wynik.dataUrodzenia = dataISO(rok, miesiac, dzien);
    wynik.dataPoprawna = wynik.dataUrodzenia !== null;
    if (!wynik.dataPoprawna) wynik.bledy.push(formatuj('PESEL_DATA'));
    const wagi = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    const suma = wagi.reduce((s, waga, i) => s + Number(numer[i]) * waga, 0);
    wynik.kontrolnaPoprawna = (10 - suma % 10) % 10 === Number(numer[10]);
    if (!wynik.kontrolnaPoprawna) wynik.bledy.push(formatuj('PESEL_CYFRA_KONTROLNA'));
    wynik.poprawny = wynik.dataPoprawna && wynik.kontrolnaPoprawna;
    // Płeć udostępniamy tylko dla numeru, który przeszedł wszystkie kontrole.
    if (wynik.poprawny) wynik.plec = Number(numer[9]) % 2 === 0 ? 'Kobieta' : 'Mężczyzna';
    return wynik;
  }

  function jestKandydatemNaPesel(tekst) {
    return /^\p{Nd}{10,12}$/u.test(tekst);
  }

  function wybierzPoprawnyPesel(numery) {
    return numery.length === 1 && numery[0].poprawny ? numery[0] : null;
  }

  const api = { sprawdzPesel, jestKandydatemNaPesel, wybierzPoprawnyPesel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KlasyfikatorPesel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
