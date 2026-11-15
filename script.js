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
    const przestepny = rok % 4 === 0 && (rok % 100 !== 0 || rok % 400 === 0);
    const dni = [31, przestepny ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    wynik.dataPoprawna = miesiac >= 1 && miesiac <= 12 && dzien >= 1 && dzien <= dni[miesiac - 1];
    if (wynik.dataPoprawna) {
      wynik.dataUrodzenia = `${rok}-${String(miesiac).padStart(2, '0')}-${String(dzien).padStart(2, '0')}`;
    } else wynik.bledy.push('Nieprawidłowa data zakodowana w PESEL.');
    const wagi = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
    const suma = wagi.reduce((s, waga, i) => s + Number(numer[i]) * waga, 0);
    wynik.kontrolnaPoprawna = (10 - suma % 10) % 10 === Number(numer[10]);
    if (!wynik.kontrolnaPoprawna) wynik.bledy.push('Błędna cyfra kontrolna PESEL.');
    wynik.poprawny = wynik.dataPoprawna && wynik.kontrolnaPoprawna;
    // Płeć udostępniamy tylko dla numeru, który przeszedł wszystkie kontrole.
    if (wynik.poprawny) wynik.plec = Number(numer[9]) % 2 === 0 ? K : M;
    return wynik;
  }

  function utworzKlasyfikator(json) {
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
      // 99,98% = 4999/5000. Całkowite mnożenie usuwa problem zaokrąglania progu.
      const suma = BigInt(kobiety) + BigInt(mezczyzni);
      const plec = BigInt(kobiety) * 5000n >= suma * 4999n ? K
        : BigInt(mezczyzni) * 5000n >= suma * 4999n ? M : null;
      slownik.set(klucz, {
        plec,
        sugestia: kobiety === mezczyzni ? null : kobiety > mezczyzni ? K : M,
        brakOpublikowanychWystapien: kobiety === 0 || mezczyzni === 0
      });
    }
    if (slownik.size === 0) throw new TypeError('Słownik imion jest pusty.');

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
      for (const [pozycja, tekst] of czlony.entries()) {
        if (/^\p{Nd}+$/u.test(tekst)) {
          // Tylko samodzielne ciągi 10-12 cyfr traktujemy jako potencjalny PESEL.
          if (!/^\p{Nd}{10,12}$/u.test(tekst)) continue;
          numery.push({ pozycja, ...sprawdzPesel(tekst) });
          continue;
        }
        const klucz = tekst.toUpperCase();
        const imie = slownik.get(klucz);
        if (!imie) { nierozpoznaneCzlony.push({ pozycja, tekst }); continue; }
        wskazania[imie.plec === K ? 'kobieta' : imie.plec === M ? 'mezczyzna' : 'niejednoznaczne']++;
        rozpoznaneImiona.push({ pozycja, tekst, klucz, plec: imie.plec,
          sugestia: imie.plec === null ? imie.sugestia : null });
        if (imie.brakOpublikowanychWystapien && !ostrzezenia.includes('ZERO_W_DANYCH')) ostrzezenia.push('ZERO_W_DANYCH');
      }
      const uzasadnienie = [];
      let kategoria = W, zrodlo = null;
      const poprawnyPesel = numery.length === 1 && numery[0].poprawny ? numery[0] : null;
      const podejrzane = numery.some(n => !n.formatPoprawny);
      const kandydaci = numery.filter(n => n.formatPoprawny);
      if (rozpoznaneImiona.length === 0) ostrzezenia.push('BRAK_ROZPOZNANYCH_IMION');
      if (wskazania.niejednoznaczne) ostrzezenia.push('NIEJEDNOZNACZNE_IMIONA');
      if (wskazania.kobieta && wskazania.mezczyzna) ostrzezenia.push('SPRZECZNE_IMIONA');
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
        }
      } else if (uzasadnienie.length === 0) {
        if (!rozpoznaneImiona.length) uzasadnienie.push('Nie znaleziono żadnego imienia w słowniku.');
        if (wskazania.niejednoznaczne) uzasadnienie.push('Co najmniej jedno dopasowane imię nie osiąga progu 99,98%.');
        if (wskazania.kobieta && wskazania.mezczyzna) uzasadnienie.push('Rozpoznane imiona wskazują różne płcie.');
        if (uzasadnienie.length === 0) {
          kategoria = wskazania.kobieta > 0 ? K : M;
          zrodlo = 'imiona';
          uzasadnienie.push('Wszystkie rozpoznane imiona są jednoznaczne i wskazują tę samą płeć.');
        }
      }
      // Sugestia nie zmienia kategorii. Przy konflikcie nie wybieramy zwycięzcy.
      const sugestie = new Set(rozpoznaneImiona.map(i => i.plec || i.sugestia).filter(Boolean));
      if (poprawnyPesel) sugestie.add(poprawnyPesel.plec);
      return {
        numerWiersza, oryginalnyWiersz, oczyszczonyWiersz, rozpoznaneImiona,
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
  function podsumuj(wyniki) {
    const suma = { kobieta: 0, mezczyzna: 0, doWeryfikacji: 0, razem: wyniki.length };
    for (const wynik of wyniki) {
      const kategoria = pobierzKategorie(wynik);
      suma[kategoria === K ? 'kobieta' : kategoria === M ? 'mezczyzna' : 'doWeryfikacji']++;
    }
    return suma;
  }
  const api = { utworzKlasyfikator, sprawdzPesel, ustawKlasyfikacjeReczna, pobierzKategorie, podsumuj };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KlasyfikatorUczestnikow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
