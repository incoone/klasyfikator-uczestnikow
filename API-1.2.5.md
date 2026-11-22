# API 1.2.5 - T-005, układ listy i rozstrzyganie ról

Dokument opisuje wszystkie trzy etapy wersji 1.2.5. Rozszerza [API 1.2.4](API-1.2.4.md). Dotychczasowe metody `klasyfikujWiersz(tekst)`, `klasyfikujListe(tekst)` i `podsumuj(wyniki)` zachowują swoje sygnatury i format danych. Rozpoznawanie T-005 działa również przy ich użyciu.

## Raport układu listy

Na instancji zwracanej przez `utworzKlasyfikator(imiona, nazwiska?, zdrobnienia?)` dostępna jest metoda `analizujListe(tekst, { kontekstKolejnosci = false } = {})`. Ustawienie `kontekstKolejnosci: true` włącza głosowanie i sprawdzanie nieustalonych ról przy statusie `dominujacy`. Metoda przyjmuje ten sam tekst co `klasyfikujListe` i zwraca `{ wyniki, kontekstListy }`.

```js
const klasyfikator = KlasyfikatorUczestnikow.utworzKlasyfikator(imiona, nazwiska, zdrobnienia);
const { wyniki, kontekstListy } = klasyfikator.analizujListe(tekst, {
  kontekstKolejnosci: true
});

const podsumowanie = KlasyfikatorUczestnikow.podsumuj(wyniki);
```

`wyniki` zawiera rekordy w kolejności wejściowej. Każdy ma dodatkowe pole `kontekstKolejnosci`. Kategoria automatyczna, źródło, sugestia płci i dane urodzenia pochodzą z niezależnej analizy wiersza. Panel wyników korzystający z `klasyfikujListe` otrzymuje dotychczasowy format tablicy.

| Pole `kontekstListy` | Znaczenie |
|---|---|
| `status` | `wylaczony`, `brak_slownikow`, `za_malo_glosow`, `za_male_pokrycie`, `lista_mieszana` albo `dominujacy` |
| `uklad` | `imiona_nazwiska` lub `nazwiska_imiona` przy statusie `dominujacy`. Dla pozostałych statusów ma wartość `null`. |
| `glosy` | Obiekt `{ imiona_nazwiska, nazwiska_imiona }` z liczbą głosów w każdym kierunku |
| `liczbaRekordowPorownywalnych` | Liczba różnych uporządkowanych ciągów jednostek z co najmniej dwiema jednostkami tekstowymi. Jest mianownikiem pokrycia. |
| `udzialDominujacego` | Większa liczba głosów podzielona przez sumę ważnych głosów. Przy remisie i dwóch dodatnich licznikach ma wartość `0.5`. Przy braku głosów ma wartość `null`. |
| `pokrycie` | Suma ważnych głosów podzielona przez `liczbaRekordowPorownywalnych` lub `null` przy zerowym mianowniku |
| `progi` | `{ minGlosow: 12, minUdzial: 0.85, minPokrycie: 0.5 }`. Warunki są włączne. |
| `liczbaZmienionychRekordow` | Liczba wierszy z co najmniej jedną rolą ustaloną z listy. Zmiana dwóch ról w jednym wierszu liczy się raz. |

Przy `wylaczony` i `brak_slownikow` liczniki są zerowe, a proporcje mają wartość `null`. Brak albo pusta zawartość dowolnego słownika opcjonalnego daje `brak_slownikow` po włączeniu głosowania. Przy aktywnym głosowaniu status wskazuje pierwszy niespełniony próg. Najpierw sprawdzana jest liczba głosów, potem pokrycie, a na końcu udział zwycięskiego układu.

## Zasady liczenia

Głosują rekordy z dwoma niepustymi, jednolitymi blokami ról. Każda grupa z łącznikiem jest osobną jednostką. Głos wymaga wysokiej pewności i jednej z podstaw `TYLKO_IMIE`, `TYLKO_NAZWISKO`, `PELNE_IMIE_ZLOZONE`, `PELNE_NAZWISKO_ZLOZONE`, `PRZEWAGA_IMIENIA_30` lub `PRZEWAGA_IMIENIA_50`. Podstawa `PRZEWAGA_NAZWISKA` jest dopuszczalna przy dokładnie dwóch jednostkach. Konflikty imion, zdrobnień lub PESEL-u oraz problemy z danymi urodzenia wyłączają głos. Sama nieustalona płeć może współistnieć z wiarygodnymi rolami.

Klucz deduplikacji składa się z typu i znormalizowanego klucza każdej jednostki w kolejności wejściowej. Pomija daty, PESEL, numerację cyfrową i wielkość liter. Poprawne kopie wnoszą łącznie jeden głos. Kopia niekwalifikująca się do głosu albo z rozbieżnym głosem wyłącza cały klucz z głosowania. Każdy klucz nadal może zwiększyć mianownik pokrycia. Każdy niepusty wiersz zwracany przez zwykłą analizę pozostaje w `wyniki`.

## Drugi przebieg

Układ ustala się raz z wyników analizy niezależnej. Dla pary z dwiema nieustalonymi rolami oba człony muszą być samodzielne i mieć dokładne dopasowania do obu słowników. Dla dłuższego wiersza potrzeba jednego takiego członu, wiarygodnej roli lokalnej w każdym bloku i dokładnie jednej możliwej granicy. Ustalone wcześniej role, całe grupy złożone i kolejność zapisu pozostają jak w analizie niezależnej.

Zmiana zostaje przyjęta, gdy ponowna ocena zachowuje kategorię, źródło i sugestię płci oraz użycie zdrobnień. Wiersze z konfliktami płci lub problemami PESEL-u i daty urodzenia są pomijane. Silne przeciwne wskazanie nazwiska rozważanego w drugim przebiegu blokuje przypisanie roli. Statystyki nazwiska ustalonego z listy są dostępne diagnostycznie z `uwzglednione: false`. Użycie listy nie dostarcza nowych wskazań płci, kontekstu zdrobnienia ani danych do obliczenia wieku. `ustawKlasyfikacjeReczna` nadal umożliwia nadanie kategorii, która ma pierwszeństwo w `pobierzKategorie` i `podsumuj`.

Jeżeli nie zastosowano żadnego przypisania, `kontekstKolejnosci` ma wartość `null`. W przeciwnym razie jest to obiekt `{ uklad, zmiany }`. Każdy wpis `zmiany` ma `{ pozycje, rolaPrzed, rolaPo, podstawaPrzed }`. `pozycje` wskazuje indeksy jednostki w strukturze oryginalnego wiersza. Zmieniona jednostka otrzymuje `podstawaRoli: 'KONTEKST_KOLEJNOSCI_LISTY'` oraz `pewnoscRoli: 'srednia'`. `czlonyTekstowe`, `rozpoznaneNazwiska`, `rozpoznaneZdrobnienia` i oznaczenia aktywnych dopasowań w `rozpoznaneImiona` odzwierciedlają przyjęte role. `pobierzKomunikaty` zwraca jedną uwagę informacyjną `KONTEKST_KOLEJNOSCI_LISTY` o ważności `medium` z pozycjami wszystkich zmian w danym wierszu.

| Wiersz przy dominacji imiona–nazwiska | Efekt drugiego przebiegu |
|---|---|
| `Marek Roman` | Marek jako imię i Roman jako nazwisko, jeśli Marek sam zachowuje klasyfikację |
| `Jan Nowak Witek` | Witek jako nazwisko, jeśli zachowano wskazanie Jana |
| `Anna Marek Nowak` i `Anna Witek Nowak` | Dotychczasowy konflikt. Rola Witka pozostaje nieustalona. |
| `Kowalski Jan` i `Kowalska-Nowak Anna-Maria` | Zachowane lokalne role i odwrotna kolejność |

## T-005

Zdrobnienie bez polskich znaków może otrzymać kontekst od zwartego nazwiska z podstawą `NAZWISKO_ZLOZONE_Z_CZESCI`, jeśli co najmniej jedna część pasuje wyłącznie do nazwisk, bez dopasowania imienia ani zdrobnienia. `Pawelek Witek-Nowak` używa `PAWEŁEK` jako wariantu i uzyskuje wynik ze zdrobnienia, jeśli przejdzie dotychczasową ocenę pełnych form i konfliktów. Zapis ze spacją wewnątrz `Witek - Nowak` nie spełnia nowego warunku zwartości.

Do prezentacji dopasowania służą obecne pola `rozpoznaneZdrobnienia`, `wariantZPolskimiZnakami` i kod uwagi `MOZLIWE_ZDROBNIENIE`. Rozbieżność z poprawnym PESEL-em nadal ma dotychczasową diagnostykę. Statystyki części nazwiska złożonego mają charakter diagnostyczny.

## Uruchomienie

W przeglądarce ładuj kolejno `core/komunikaty.js`, `core/daty.js`, `core/pesel.js`, `core/klasyfikator.js`. W Node.js użyj `require('./core/klasyfikator.js')`. Testy uruchamia `node --test` w katalogu głównym.
