(function (root) {
  'use strict';

  function zapisImienia(klucz) {
    return klucz.charAt(0) + klucz.slice(1).toLowerCase();
  }

  function formatujZdrobnienie(wpis) {
    const liczebnosc = stat => stat === null ? 'brak wpisu w słowniku imion (nie oznacza zera)' :
      (stat.kobiety + stat.mezczyzni) + ' osób (kobiety: ' + stat.kobiety + ', mężczyźni: ' + stat.mezczyzni + ')';
    const opisKontekstu = wpis.kontekst === 'para_nazwisk'
      ? ' Spośród dwóch członów rozpoznanych jako nazwiska tylko ten występuje w słowniku zdrobnień.' : '';
    const opis = wpis.wykorzystaneDoKlasyfikacji
      ? 'Płeć ustalono na podstawie zdrobnienia „' + wpis.tekst + '”.' + opisKontekstu +
        ' Sprawdź zgodność imienia z dokumentem tożsamości.'
      : wpis.sprzeczneZPeselem
      ? 'Płeć ustalono z poprawnego PESEL mimo przeciwnego wskazania pełnych form zdrobnienia „' + wpis.tekst + '”. Sprawdź zgodność imienia z dokumentem tożsamości.'
      : wpis.rola === 'nazwisko'
      ? '„' + wpis.tekst + '” występuje również w słowniku zdrobnień; w tym wierszu został potraktowany jako nazwisko.'
      : '„' + wpis.tekst + '” może być zdrobnieniem lub formą potoczną.' +
        (wpis.statystyki ? ' Występuje również jako samodzielne imię.' : '') +
        ' Sprawdź zgodność imienia z dokumentem tożsamości.';
    const statystyki = wpis.odpowiedniki.map(p => p.klucz + ' - ' + liczebnosc(p.statystyki)).join('; ');
    const opisPisowni = wpis.wariantZPolskimiZnakami
      ? ' Zapis „' + wpis.tekst + '” dopasowano do zdrobnienia „' + zapisImienia(wpis.wariantZPolskimiZnakami) + '”.' : '';
    return opis + opisPisowni + ' Możliwe pełne odpowiedniki i statystyki imion: ' + statystyki +
      '. Jako samodzielne imię: ' + liczebnosc(wpis.statystyki) + '.';
  }

  const teksty = {
    BLAD_TYPU_PESEL: 'PESEL musi być tekstem.',
    BLAD_DATY_WYDARZENIA: 'Data wydarzenia musi być poprawną datą RRRR-MM-DD.',
    BLAD_PROGOW: 'Podaj tekst lub tablicę liczbowych progów.',
    BLAD_SLOWNIKA_NAZWISK: 'Oczekiwano obiektu JSON z polem nazwiska.',
    BLAD_SLOWNIKA_ZDROBNIEN: 'Oczekiwano obiektu JSON z polem zdrobnienia.',
    BLAD_SLOWNIKA_IMION: 'Oczekiwano obiektu JSON z polem imiona.',
    PUSTY_SLOWNIK_IMION: 'Słownik imion jest pusty.',
    BLAD_TYPU_WIERSZA: 'Wiersz musi być tekstem.',
    BLAD_WIELOWIERSZOWY: 'Przekaż jeden wiersz albo użyj klasyfikujListe.',
    BLAD_TYPU_LISTY: 'Lista musi być tekstem.',
    BLAD_KATEGORII: 'Nieprawidłowa kategoria.',
    PESEL_FORMAT: 'PESEL musi składać się z dokładnie 11 cyfr 0-9.',
    PESEL_DATA: 'Nieprawidłowa data zakodowana w PESEL.',
    PESEL_CYFRA_KONTROLNA: 'Błędna cyfra kontrolna PESEL.',
    BLEDNY_PESEL: 'Nieprawidłowy PESEL. Szczegóły w wyniku sprawdzenia numeru.',
    KILKA_NUMEROW: 'Kilka potencjalnych numerów PESEL. Nie wybrano daty z numeru.',
    ROZNE_DATY: 'Wpisano kilka różnych dat urodzenia.',
    KONFLIKT_DATY_PESEL: 'Wpisana data różni się od daty z poprawnego PESEL.',
    URODZENIE_PO_WYDARZENIU: 'Data urodzenia jest późniejsza niż data wydarzenia.',
    POWOD_FORMAT_PESEL: 'Nieprawidłowy format PESEL - wymagane jest dokładnie 11 cyfr 0-9.',
    POWOD_KILKA_PESEL: 'W jednym wierszu znaleziono kilka potencjalnych numerów PESEL.',
    POWOD_WALIDACJA_PESEL: 'Potencjalny PESEL nie przeszedł walidacji.',
    POWOD_KONFLIKT_PESEL: 'Jednoznaczne imię wskazuje inną płeć niż poprawny PESEL.',
    POWOD_PLEC_Z_PESEL: 'Klasyfikacja na podstawie poprawnego PESEL; brak sprzecznych jednoznacznych imion.',
    POWOD_KONFLIKT_ZDROBNIENIA: 'Pełne formy zdrobnienia wskazują płeć sprzeczną z innym imieniem, zdrobnieniem lub silnym wskazaniem nazwiska.',
    POWOD_KONFLIKT_ZDROBNIEN_POMIEDZY: 'Pełne formy różnych rozpoznanych zdrobnień wskazują przeciwne płcie.',
    POWOD_PLEC_ZE_ZDROBNIEN: 'Płeć ustalono na podstawie zdrobnienia: wszystkie pełne formy są obecne w słowniku, osiągają próg 99,90% i wskazują tę samą płeć.',
    POWOD_BRAK_IMIENIA: 'Nie znaleziono żadnego imienia uwzględnianego przy klasyfikacji.',
    POWOD_ZDROBNIENIE_NIEROZSTRZYGA: 'Rozpoznano zdrobnienie, ale jego pełne formy lub kontekst wiersza nie pozwalają ustalić płci.',
    POWOD_ZDROBNIENIA_ROLA_NAZWISKA: 'Dopasowania ze słownika zdrobnień dotyczą członów rozpoznanych jako nazwiska. Nie da się wskazać jednego zdrobnienia, na którym można oprzeć decyzję.',
    POWOD_ZDROBNIENIA_BEZ_NAZWISKA: 'Rozpoznano zdrobnienia, ale brak osobnego nazwiska pozwalającego ustalić płeć na ich podstawie.',
    POWOD_IMIONA_PONIZEJ_PROGU: 'Żadne rozpoznane imię nie osiąga progu 99,90%, a nazwisko nie dostarcza zgodnego silnego wskazania.',
    POWOD_REMIS_IMIENIA: 'Rozpoznano imię o równych liczbach wystąpień u kobiet i mężczyzn.',
    POWOD_SPRZECZNE_IMIONA: 'Rozpoznane imiona wskazują różne płcie.',
    ZGODNE_SLABE_IMIE: 'Imię poniżej progu wskazuje tę samą płeć co imię jednoznaczne.',
    PESEL_BEZ_IMIENIA: 'Płeć ustalono z PESEL. Nie rozpoznano imienia.',
    PESEL_REMIS: 'Płeć ustalono z PESEL mimo remisu w statystykach imienia.',
    PESEL_PRZECIWNE_IMIE: 'Płeć ustalono z PESEL mimo przeciwnego wskazania imienia poniżej progu.',
    PESEL_ZGODNE_SLABE_IMIE: 'Imię poniżej progu jest zgodne z płcią ustaloną z PESEL.',
    DOPISEK_PRZECIWNE_IMIE_W_NAZWISKU: ' Jako samodzielne imię ten człon jednoznacznie wskazuje płeć przeciwną do wyniku automatycznego.',
    DOPISEK_BRAK_DATY_Z_PESEL: ' Nie ustalono daty urodzenia. Sprawdź dane potrzebne do obliczenia wieku.',
    RECZNA_WERYFIKACJA: 'Wpis oznaczono ręcznie do weryfikacji.',
    POWOD_PLEC_Z_IMION_I_NAZWISKA: 'Zgodne wskazania niejednoznacznych imion wsparto nazwiskiem o minimum 100 wystąpieniach i udziale płci co najmniej 99,90%.',
    POWOD_PLEC_Z_IMION: 'Co najmniej jedno imię osiąga próg 99,90%, a wszystkie uwzględnione imiona wskazują tę samą płeć.'
  };

  const szablony = {
    BLEDNA_DATA: (tekst) => 'Nieprawidłowa data urodzenia: ' + tekst,
    BLAD_WPISU_NAZWISKA: (tekst) => 'Nieprawidłowy wpis nazwiska: ' + tekst,
    BLAD_WPISU_ZDROBNIENIA: (tekst) => 'Nieprawidłowy wpis zdrobnienia: ' + tekst,
    BLAD_LICZB_IMIENIA: (imie) => `Nieprawidłowe liczby dla imienia: ${imie}`,
    POWTORZONY_KLUCZ: (klucz) => `Powtórzony klucz: ${klucz}`,
    POWOD_KONFLIKT_ZDROBNIENIA_IMIE: (tekst) => 'Pełne formy zdrobnienia wskazują płeć sprzeczną ze statystykami samodzielnego imienia „' + tekst + '”.',
    POWOD_KONFLIKT_ZDROBNIENIA_NAZWISKO: (tekst) => 'Pełne formy zdrobnienia wskazują płeć sprzeczną z silnym wskazaniem nazwiska „' + tekst + '”.',
    POWOD_KONFLIKT_ZDROBNIENIA_IMIE_W_NAZWISKU: (tekst) => 'Pełne formy zdrobnienia wskazują płeć sprzeczną ze statystykami jednoznacznego imienia „' +
      tekst + '”. Ten człon uznano za nazwisko na podstawie kontekstu.',
    POWOD_ZDROBNIENIE_BRAK_FORMY: (tekst, formy) => 'Brak pełnych odpowiedników zdrobnienia „' + tekst + '” w słowniku imion dla: ' + formy.join(', ') + '.',
    POWOD_ZDROBNIENIE_PROG: (tekst, formy) => 'Pełne odpowiedniki zdrobnienia „' + tekst + '” poniżej progu 99,90%: ' + formy.join(', ') + '.',
    POWOD_ZDROBNIENIE_ROZNE_PLCIE: (tekst) => 'Pełne odpowiedniki zdrobnienia „' + tekst + '” wskazują różne płcie.',
    POWOD_ZDROBNIENIE_KONTEKST: (tekst) => 'Brak kontekstu pozwalającego uznać „' + tekst + '” za imię do klasyfikacji ze zdrobnienia.',
    IMIE_W_PRZEDZIALE_PROGOWYM: (tekst) => 'Rozpoznane imię: ' + tekst + '. Udział dominującej płci wynosi co najmniej 99,90% i mniej niż 99,98%.',
    MOZLIWY_BRAK_POLSKICH_ZNAKOW: (tekst, razem, kluczWariantu, razemWariant) => 'Możliwa literówka lub zapis bez polskich znaków. Imię „' + tekst +
      '” występuje w rejestrze PESEL (' + razem + ' osób), jednak znacznie popularniejszą formą jest „' +
      zapisImienia(kluczWariantu) + '” (' + razemWariant + ' osób).',
    RZADKIE_IMIE: (tekst, razem) => 'Rozpoznane imię: ' + tekst + '. Łączna liczba opublikowanych wystąpień: ' + razem +
      '. Mała liczebność danych nie blokuje automatycznej klasyfikacji.',
    ROLA_IMIENIA_Z_KONTEKSTU: (tekst, nazwisko) => '„' + tekst + '” występuje zarówno w słowniku imion, jak i nazwisk. Ponieważ drugi człon („' +
      nazwisko + '”) występuje wyłącznie w słowniku nazwisk, „' + tekst +
      '” potraktowano jako prawdopodobne imię. Sprawdź poprawność przypisania.',
    ROLA_IMIENIA_ZE_STATYSTYK: (tekst) => '„' + tekst + '” potraktowano jako imię na podstawie co najmniej 10-krotnej przewagi liczebności imienia i obecności rozpoznanego nazwiska. Sprawdź poprawność przypisania.',
    ROLA_IMIENIA_ZE_STATYSTYK_50: (tekst) => '„' + tekst + '” potraktowano jako imię na podstawie co najmniej 50-krotnej przewagi liczebności imienia nad nazwiskiem. Sprawdź poprawność przypisania.',
    ROLA_Z_KONTEKSTU_PARY: (tekst, drugi, rola) => '„' + tekst + '” ma niejednoznaczną rolę. Człon „' +
      drugi + '” rozpoznano jako ' + (rola === 'imie' ? 'nazwisko' : 'imię') + ', więc „' + tekst +
      '” potraktowano jako ' + (rola === 'imie' ? 'prawdopodobne imię' : 'prawdopodobne nazwisko') +
      '. Sprawdź poprawność przypisania.',
    ROLA_NAZWISKA_ZE_STATYSTYK: (tekst) => '„' + tekst + '” potraktowano jako nazwisko na podstawie częstości występowania w słownikach. Sprawdź poprawność przypisania.',
    NIEROZSTRZYGNIETA_ROLA: (tekst) => 'Nie ustalono jednoznacznie, czy „' + tekst + '” jest imieniem, czy nazwiskiem. Sprawdź poprawność przypisania.',
    NAZWISKO_PRZECIWNE_WYNIKOWI: (tekst, zrodlo) => 'Silne wskazanie nazwiska „' + tekst + '” jest przeciwne do płci ustalonej ' +
        (zrodlo === 'pesel' ? 'z poprawnego PESEL.' : 'na podstawie imion.') +
        ' Sprawdź poprawność danych.',
    DOPISEK_ZRODLO_DATY: (zPesel) => zPesel ? ' Przyjęto datę urodzenia z poprawnego PESEL.' : ' Przyjęto poprawną datę wpisaną w wierszu.',
    WERYFIKACJA_PLCI: (uzasadnienie) => uzasadnienie.join(' '),
    MOZLIWE_ZDROBNIENIE: formatujZdrobnienie
  };

  // Kod szablonu wybiera wywołujący wraz z parametrami treści.
  function formatuj(klucz, ...parametry) {
    if (Object.prototype.hasOwnProperty.call(szablony, klucz)) return szablony[klucz](...parametry);
    if (Object.prototype.hasOwnProperty.call(teksty, klucz)) return teksty[klucz];
    throw new RangeError('Nieznany klucz komunikatu: ' + klucz);
  }

  const api = { formatuj };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KlasyfikatorKomunikaty = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
