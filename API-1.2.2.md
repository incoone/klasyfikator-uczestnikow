# Klasyfikator uczestników 1.2.2 - API i integracja

## Zakres i integracja

Punkt wejścia `core/klasyfikator.js` udostępnia publiczne API `KlasyfikatorUczestnikow` z tymi samymi funkcjami, argumentami i kategoriami co 1.2.1. Wersja 1.2.2 dodaje informacje o rolach, kontekst `para_nazwisk` i opcjonalny wariant pisowni zdrobnienia. Korekty po niezależnych testach obejmują konflikt T-001, dokładniejsze uzasadnienia T-003 i ograniczone dopasowanie zdrobnień zapisanych bez polskich znaków. Słowniki i dane uczestników przekazuje wywołujący. Logika działa lokalnie w przeglądarce i w Node.js.

| Plik | Odpowiedzialność | Zależności bezpośrednie |
|---|---|---|
| `komunikaty.js` | Katalog treści i formatowanie opisów, uzasadnień oraz błędów | Brak |
| `daty.js` | Wyszukiwanie i sprawdzanie dat, ustalanie daty urodzenia, wiek i statystyki wiekowe | `komunikaty.js` |
| `pesel.js` | Rozpoznawanie kandydatów, walidacja numeru oraz odczyt daty i płci | `komunikaty.js`, `daty.js` |
| `klasyfikator.js` | Słowniki, analiza wiersza, klasyfikacja, ręczne korekty i decyzje o uwagach | Wszystkie trzy moduły |

`daty.js` otrzymuje już zweryfikowane numery. Klasyfikator przekazuje do katalogu komunikatów wybrany klucz i dane do wstawienia. O tym, czy komunikat powstaje, gdzie trafia, jaki ma kod i poziom ważności, decyduje logika klasyfikacji lub dat.

### Struktura katalogów

```text
core/
├── klasyfikator.js
├── pesel.js
├── daty.js
└── komunikaty.js
tests/
├── klasyfikator.test.js
├── pesel.test.js
├── daty.test.js
└── komunikaty.test.js
API-1.2.2.md
```

### Ładowanie w przeglądarce

W głównym pliku HTML użyj poniższych ścieżek względnych, zgodnych z wersją 1.2.1. Załaduj kod interfejsu po tych czterech skryptach.

```html
<script src="core/komunikaty.js"></script>
<script src="core/daty.js"></script>
<script src="core/pesel.js"></script>
<script src="core/klasyfikator.js"></script>
```

Zachowaj tę kolejność. Jeżeli istniejące skrypty korzystają z `defer`, zastosuj go do wszystkich czterech plików oraz skryptu interfejsu umieszczonego po nich. Unikaj `async`, ponieważ pozwala wykonać pliki poza kolejnością.

Po załadowaniu globalnym punktem wejścia jest `globalThis.KlasyfikatorUczestnikow`. Przykładowe wywołanie po wczytaniu słowników:

```js
const api = KlasyfikatorUczestnikow;
const klasyfikator = api.utworzKlasyfikator(imionaJSON, nazwiskaJSON, zdrobnieniaJSON);
const osoby = klasyfikator.klasyfikujListe(tekst);
const komunikaty = api.pobierzKomunikaty(osoby[0], '2026-11-17');
```

`utworzKlasyfikator(imionaJSON, nazwiskaJSON = null, zdrobnieniaJSON = null)` przyjmuje:

- `{ imiona: { ANNA: [kobiety, mezczyzni] }, meta?: ... }` - wymagane, niepuste.
- `{ nazwiska: { KOWALSKA: [kobiety, mezczyzni] }, meta?: ... }` - opcjonalne.
- `{ zdrobnienia: { WITEK: ['WITOLD'] }, meta?: ... }` - opcjonalne.

Pominięcie któregokolwiek słownika opcjonalnego lub przekazanie go jako `null` wybiera reguły 1.2.1. Przekazany pusty słownik jest dostępny do analizy i zawiera zero wpisów. Rzadkość jest oceniana również przy samym słowniku imion. Puste obiekty `nazwiska` i `zdrobnienia` są dozwolone. Niepoprawna struktura, ujemne/ułamkowe liczebności, niebezpieczna suma liczb, zerowa suma, duplikaty kluczy po zmianie wielkości liter powodują `TypeError`. Każdy wpis zdrobnienia wymaga niepustej listy niepustych tekstów. Powtórzone odpowiedniki są usuwane. Dane słownikowe są kopiowane podczas inicjalizacji; późniejsza zmiana wejściowych obiektów nie zmienia klasyfikatora.

Przekaż do powyższej funkcji obiekty z dotychczasowych słowników. W Node.js użyj `const api = require('./core/klasyfikator.js')`. Zależności są wczytywane przez CommonJS.

## Reguły klasyfikacji

### Role w rekordach z dwoma członami

Reguła 1.2.2 działa przy dokładnie dwóch elementach w `czlonyTekstowe` i przy przekazaniu obu słowników opcjonalnych. Samodzielne ciągi cyfr, w tym składniki dat i kandydaci na PESEL, nie są członami tekstowymi. Dodatkowy człon tekstowy, np. `Lp` lub `A123`, zwiększa ich liczbę. Wynik ról jest symetryczny. Pozycje w wyniku nadal odzwierciedlają wpisaną kolejność.

- Rola wstępna `imie` oznacza dokładne dopasowanie imienia lub zdrobnienia bez dopasowania do nazwisk albo przewagę imienia.
- `nazwisko` oznacza dopasowanie tylko do nazwisk albo przewagę nazwiska.
- `niejednoznaczna` oznacza jednoczesne dopasowanie do nazwiska i imienia lub zdrobnienia bez przewagi.
- `nierozpoznana` oznacza brak dopasowań.

Przewagę liczymy z sumy wystąpień **samodzielnego imienia** i nazwiska, gdy oba wpisy istnieją. Wymagane są co najmniej 100 wystąpień roli dominującej i stosunek co najmniej 50:1. Obie granice są włączne. Względem wersji 1.2.1 ta reguła zastępuje progi 10× i 30× oraz dodatkowe warunki przyznawania przewagi nazwisku w analizie dwóch członów.

| Role wstępne, w dowolnej kolejności | Rozstrzygnięcie |
|---|---|
| Imię i niejednoznaczna | Człon niejednoznaczny dostaje rolę nazwiska. |
| Nazwisko i niejednoznaczna | Człon niejednoznaczny dostaje rolę imienia. |
| Każda pozostała para | Zachowujemy role. Role niejednoznaczne i nierozpoznane pozostają nierozstrzygnięte. |

Człon uznany za nazwisko pozostaje poza zwykłą oceną imion i zdrobnień. Wyjątek dotyczący pary nazwisk opisano w sekcji [Zdrobnienie w parze nazwisk](#zdrobnienie-w-parze-nazwisk). Dopasowania słownikowe zostają widoczne w wyniku. Role wstępne, role z kontekstu i wskazania płci to odrębne informacje. Dwa samodzielne imiona bez rozstrzygniętych ról nadal można ocenić według dotychczasowych zasad zgodności. Nierozpoznany człon nie dostarcza wskazania płci.

### Role w pozostałych rekordach

Reguły 1.2.1 pozostają podstawą analizy innych długości wiersza oraz konfiguracji bez któregoś ze słowników opcjonalnych. Formaty komunikatów tej ścieżki są zachowane. Reguła dwóch członów opisana poniżej dotyczy wyłącznie starszej ścieżki.

1. Dopasowanie wyłącznie do imion daje rolę `imie`; wyłącznie do nazwisk daje `nazwisko`.
2. Dopasowanie do obu słowników początkowo ma rolę `nierozstrzygnieta`, ale uczestniczy w analizie imion. Następne reguły mogą rozstrzygnąć jego rolę.
3. Człon obecny w obu słownikach można potraktować jako nazwisko, jeśli łącznie:
   - nazwisko ma minimum 100 opublikowanych wystąpień;
   - nazwisko występuje co najmniej 50 razy częściej niż imię;
   - istnieje inne jednoznaczne imię, które samo nie spełnia powyższego warunku przewagi nazwiska;
   - nie ma osobnego członu występującego wyłącznie w słowniku nazwisk.
4. Po zakończeniu powyższej analizy nazwisk rozstrzygamy pozostałe kolizje jako imiona:
   - minimum 100 wystąpień imienia i co najmniej 30-krotna przewaga nad nazwiskiem: rola `imie`, bez uwagi o kolizji;
   - jeśli wiersz ma dokładnie dwa człony tekstowe, jeden wyłącznie w nazwiskach, drugi w obu słownikach: minimum 100 wystąpień imienia i przewaga co najmniej 10x daje rolę `imie` bez uwagi; w pozostałych przypadkach przyjmujemy prawdopodobne imię na podstawie kontekstu z uwagą `low`;
   - poza tym szczególnym kontekstem: minimum 100 wystąpień imienia i przewaga od 10x do poniżej 30x daje rolę `imie` z uwagą `low`, jeśli istnieje inne rozpoznane nazwisko. Może ono pochodzić z dopasowania wyłącznie do nazwisk albo z dotychczasowej reguły przewagi nazwiska 50x;
   - inaczej rola pozostaje nierozstrzygnięta.
5. Wykluczone z analizy imię pozostaje w szczegółach z `uwzglednione: false`. Nie zwiększa liczników imion i nie tworzy konfliktu z PESEL-em.

Wszystkie granice są włączne; porównania wykonujemy na całkowitych liczebnościach, bez zaokrąglania. Przewaga oznacza stosunek sumy wystąpień imienia do sumy wystąpień nazwiska, nie stosunek liczebności płci. Minimum 100 nie obowiązuje przy przyjęciu prawdopodobnego imienia z kontekstu dwóch członów.

Dokładnie dwa człony tekstowe oznaczają `czlonyTekstowe.length === 2`. Samodzielne liczby, numeracja numeryczna, PESEL i numeryczne fragmenty dat nie zwiększają tej liczby. Dodatkowe teksty, np. `Lp` lub `A123`, zwiększają ją. Nie dodano wyjątków dla takich oznaczeń ani analizy kolejności. W starszej heurystyce wyjątek dwóch członów wymaga jednego dopasowania wyłącznie do nazwisk.

Reguła jest heurystyką, a nie potwierdzeniem danych osobowych. Nie sumujemy statystyk różnych członów. Człony bez dopasowania pozostają nierozstrzygnięte i nie wpływają na płeć. Sama nierozpoznana treść, np. `Lp` czy `A123`, nie generuje nowego ostrzeżenia. Uwaga o nierozstrzygniętej roli dotyczy wykrytej kolizji imię/nazwisko. Rozpoznanie płci nie potwierdza ról.

Role można wyświetlać jako dopasowania lub wnioski z kontekstu. Nie wolno prezentować roli nierozstrzygniętej jako pewnego pola formularza ani automatycznie rozwijać zdrobnień. Oryginalny wiersz jest zachowany.

### Imiona

Próg jednoznaczności: udział dominującej płci co najmniej 99,90%. Przedział od 99,90% do poniżej 99,98% daje dodatkową uwagę `low`. Co najmniej jedno jednoznaczne imię i zgodne kierunki wszystkich uwzględnionych imion pozwalają na klasyfikację. Remis 50/50 albo przeciwne wskazania blokują klasyfikację z imion. Liczby nie są sumowane pomiędzy imionami i nie są zaokrąglane przed decyzją.

Rzadkie uwzględnione imię: 30-49 wystąpień daje `high`, 50-99 daje `medium`, od 100 bez uwagi o rzadkości. Mała liczba sama nie blokuje klasyfikacji. Liczby oznaczają opublikowane statystyki; zero nie dowodzi braku osób danej płci. Testowe słowniki mogą mieć mniej niż 30 wystąpień, ale produkcyjne słowniki zaczynają się od 30; dodatkowy przedział uwag poniżej 30 nie został zdefiniowany.

### Możliwy zapis bez polskich znaków

Dla dokładnie rozpoznanego i uwzględnionego imienia bez polskich znaków wyszukujemy wariant z polskimi znakami. Pomocnicza normalizacja obejmuje wyłącznie Ą/Ć/Ę/Ł/Ń/Ó/Ś/Ź/Ż i ich odpowiedniki A/C/E/L/N/O/S/Z/Z. Wewnętrzne klucze są wielkimi literami. W samodzielnych imionach ta normalizacja służy wyłącznie do tworzenia sugestii pisowni.

Uwaga `MOZLIWY_BRAK_POLSKICH_ZNAKOW` (`low`, obszar `dane`) powstaje, gdy:

- w całym słowniku istnieje dokładnie jeden wariant z polskimi znakami o tym samym uproszczonym zapisie;
- wariant ten ma minimum 10 000 opublikowanych wystąpień;
- jego łączna liczebność jest co najmniej 10 razy większa niż wariantu wejściowego.

Przy kilku odpowiednikach nie wybieramy najpopularniejszego, również gdy tylko jeden spełnia progi. Granice są włączne, stosunek porównywany całkowitoliczbowo. Brak dokładnego dopasowania wejściowego imienia nie uruchamia sugestii. Nie normalizujemy innych znaków narodowych i nie zmieniamy imion już zawierających polskie znaki.

Liczebności komunikatu pochodzą dynamicznie z imiona.json. Jeśli oba warianty osiągają próg jednoznaczności płci 99,90% i wskazują tę samą płeć, pomijamy tylko `RZADKIE_IMIE` dla tego dopasowania. Jeśli którykolwiek jest niejednoznaczny lub wskazania są przeciwne, uwaga o małej liczebności pozostaje. Brak sugestii oznacza brak tego wyjątku. Pozostałe uwagi pozostają bez zmian.

Sugestia nie zmienia oryginału, roli, kierunku płci, źródła decyzji, liczników, statystyk ani obsługi PESEL-u. Nie sumujemy wariantów. Dla dopasowania pominiętego jako nazwisko nie emitujemy sugestii pisowni imienia. Jeden komunikat zbiera pozycje powtórzeń tego samego klucza.

### Nazwiska jako dodatkowa przesłanka

Silne wskazanie nazwiska wymaga co najmniej 100 wystąpień i udziału jednej płci co najmniej 99,90%. Uwzględniamy tylko człony o przyjętej roli `nazwisko`, nie tę samą nierozstrzygniętą pozycję jednocześnie jako imię i nazwisko.

Klasyfikacja wspomagana nazwiskiem jest możliwa, gdy żadne uwzględnione imię nie jest jednoznaczne, ale istnieje co najmniej jedno rozpoznane imię, wszystkie wskazują ten sam kierunek bez remisu, a silne nazwiska wskazują zgodnie ten sam kierunek. Przeciwne silne nazwiska blokują takie wspomaganie. Słabe nazwiska nie rozstrzygają. Samo nazwisko, również przy nierozpoznanym imieniu, nie wystarcza.

Źródło takiej decyzji to `imiona_i_nazwisko`; powstaje uwaga `medium`. Silne nazwisko przeciwne do wyniku ustalonego z jednoznacznych imion lub PESEL-u daje uwagę `high`, ale nie zmienia kategorii. Nie analizujemy końcówek nazwisk.

Uwaga na dane rzeczywiste: KOWALSKI ma około 99,2030% wystąpień męskich, więc nie spełnia progu nazwiska. KOWALSKA ma około 99,9955% wystąpień żeńskich i go spełnia.

### Zdrobnienia

W podstawowej analizie pary zdrobnienie może stanowić podstawę decyzji, gdy nie ma dopasowania do samodzielnego imienia, dostało rolę imienia, drugi człon ma końcową rolę nazwiska i wszystkie pełne formy zgodnie osiągają próg 99,90%. Rolę nazwiska można ustalić także kontekstowo. Przeciwne silne wskazanie nazwiska albo problem z PESEL-em blokuje decyzję ze zdrobnienia.

**T-001.** Gdy decyzja miałaby wynikać ze zdrobnienia, sprawdzamy także samodzielne imię pominięte z powodu podstawy roli `KONTEKST_NAZWISKA_DWA_CZLONY`. Jeżeli udział co najmniej 99,90% wskazuje płeć przeciwną, wynik bez rozstrzygającego PESEL-u to `Do weryfikacji`. Role i `uwzglednione` zachowują pierwotne wartości. Kod `KONFLIKT_ZDROBNIENIA` trafia do surowych ostrzeżeń. `WERYFIKACJA_PLCI` (`high`) wskazuje człon uznany kontekstowo za nazwisko. Przykłady to „Agusia Bartek” i „Magda Piotrek”. Dla „Anna Marek” decyzja wciąż pochodzi z samodzielnego imienia. Pojedynczy poprawny PESEL ma dotychczasowy priorytet i nadal jest porównywany z aktywnymi jednoznacznymi imionami.

Przy dwóch rolach imiennych lub dwóch wstępnie niejednoznacznych i ostatecznie nierozstrzygniętych rolach weryfikujemy też zgodność pełnych form ze wskazaniem aktywnego samodzielnego imienia. Zgodne wskazanie zachowuje źródło `imiona`. Sprzeczne skieruje do weryfikacji, o ile nie rozstrzygnął poprawny PESEL. Jeżeli samodzielne imię nie pozwala ustalić płci na podstawie zachowanych reguł, zgodne zdrobnienie samo go nie zastępuje. Dwa zdrobnienia bez samodzielnego imienia lub nazwiska nie wystarczają do automatycznej decyzji ze zdrobnień. Przykładem jest „Piotrek Piotruś”.

W starszej ścieżce zdrobnienie może rozstrzygnąć płeć, gdy w wierszu brak samodzielnych imion uwzględnionych przy klasyfikacji i spełnione są wszystkie warunki:

- Zdrobnienie jest nieobecne jako samodzielne imię i jako nazwisko.
- Osobny człon jest rozpoznany jako nazwisko. Kolejność członów, obecność dodatkowych członów i daty urodzenia są niezależne od tej reguły.
- Wszystkie pełne formy występują w słowniku imion. Każda osobno osiąga próg 99,90% i wskazuje tę samą płeć.
- Jeśli wiersz zawiera kilka zdrobnień z rozpoznanym kontekstem, każde musi spełniać warunki i wskazywać tę samą płeć.
- Brak błędnego albo wielokrotnego potencjalnego PESEL-u oraz przeciwnych silnych wskazań nazwiska.

Pojedynczy poprawny PESEL zapewnia kontekst dla zdrobnienia nieobecnego w słowniku nazwisk. W 1.2.2 PESEL nie zmienia ról ustalonych dla pary. Płeć nadal ustala PESEL. Przy przeciwnym jednoznacznym wskazaniu pełnych form informacja o rozbieżności trafia do uwagi o zdrobnieniu. Sprzeczność jednoznacznego samodzielnego imienia z PESEL-em nadal wymaga weryfikacji.

Bez PESEL-u zgodne zdrobnienie zachowuje decyzję z samodzielnych imion. Jeśli jednoznaczne pełne formy wskazują w przeciwną stronę niż uwzględnione samodzielne imię albo inne zdrobnienie w kontekście, wynik wymaga weryfikacji. Zdrobnienia nie rozstrzygają dotychczas nierozstrzygniętego dopasowania samodzielnego imienia. Gdy podstawą wyniku są samodzielne imiona, przeciwne silne wskazanie nazwiska zachowuje dotychczasową obsługę jako uwaga.

Oryginalny zapis pozostaje w wyniku. Każda pełna forma ma osobne statystyki. Statystyki form nie są sumowane ani przypisywane zdrobnieniu. Brak wpisu ma wartość `null`. Uwaga `MOZLIWE_ZDROBNIENIE` ma poziom `high` i obejmuje wszystkie pełne formy, liczebności oraz uzasadnienie wykorzystania zdrobnienia lub rozbieżności z PESEL-em, jeśli dotyczy. Powtórzone zdrobnienie daje jedną uwagę z pozycjami wszystkich wystąpień. Dla zdrobnienia będącego samodzielnym imieniem zachowujemy dotychczasową uwagę informacyjną.

**T-003.** Jeżeli zdrobnienie nie rozstrzyga płci, `uzasadnienie` podaje przyczynę, np. brakujące odpowiedniki, pełne formy poniżej 99,90%, różne płcie pełnych form, konkretne sprzeczne wskazanie albo brak odpowiedniego kontekstu. `pobierzKomunikaty` składa te powody w treść dotychczasowego `WERYFIKACJA_PLCI`. Ta poprawka dotyczy opisu decyzji.

#### Zdrobnienie zapisane bez polskich znaków

Używamy tej samej zamiany Ą/Ć/Ę/Ł/Ń/Ó/Ś/Ź/Ż co dla sugestii pisowni. Dopasowanie jest dopuszczone przy dwóch członach tekstowych, z oboma słownikami opcjonalnymi. Jeden człon musi być dokładnie rozpoznany wyłącznie jako nazwisko. Drugi może składać się tylko z liter A-Z bez rozróżniania wielkości i musi pozostać bez dokładnego dopasowania w trzech słownikach.

Uproszczona postać musi prowadzić do jednego klucza zdrobnienia z polskimi znakami. Różne klucze o tej samej uproszczonej postaci w dowolnym z trzech słowników blokują dopasowanie. Ten sam klucz może być też nazwiskiem. Jeżeli pełny wariant zdrobnienia ma wpis jako samodzielne imię, stosujemy wyłącznie dotychczasowe dopasowanie dokładne. Progi pełnych form, kontrola silnego wskazania nazwiska i reguły PESEL-u obowiązują także tutaj.

Dla „Pawelek Nowak” wstępna rola członu `Pawelek` z dopasowania dokładnego to `nierozpoznana`. Rola końcowa to `imie` z podstawą `KONTEKST_ZDROBNIENIA`, a `dopasowania.zdrobnienie` ma wartość `true`. `rozpoznaneZdrobnienia[].wariantZPolskimiZnakami` zawiera `PAWEŁEK`. `tekst`, `klucz`, `oryginalnyWiersz` i historyczna lista brakujących dopasowań do samodzielnych imion zachowują zapis wejściowy. Uwaga `MOZLIWE_ZDROBNIENIE` zawiera oba zapisy.

#### Zdrobnienie w parze nazwisk

Przy dwóch członach tekstowych o roli wstępnej `nazwisko` i obu załadowanych słownikach opcjonalnych sprawdzamy, czy dokładnie jeden człon występuje w słowniku zdrobnień. Drugi może być nazwiskiem z bezpośredniego dopasowania lub przewagi liczebności 50×. Kolejność, data urodzenia i samodzielne liczby nie zmieniają warunku dwóch członów.

1. Każdy pełny odpowiednik musi występować w słowniku, osiągać co najmniej 99,90% i wskazywać tę samą płeć. Warunek obejmuje też zdrobnienia z wpisem samodzielnego imienia.
2. Przeciwna przewaga jednej płci w statystykach któregokolwiek samodzielnego imienia blokuje decyzję ze zdrobnienia. Sprawdzamy również imiona pominięte z powodu roli nazwiska, w tym samodzielny wpis zdrobnienia. Remis nie daje kierunku. Przeciwne silne wskazanie któregokolwiek nazwiska również blokuje decyzję. Wynik bez poprawnego PESEL-u trafia wtedy do weryfikacji z `KONFLIKT_ZDROBNIENIA`.
3. Po spełnieniu warunków źródłem automatycznej decyzji jest `zdrobnienia`, a `wykorzystaneDoKlasyfikacji` ma wartość `true`. Istniejąca uwaga `MOZLIWE_ZDROBNIENIE` (`high`) wyjaśnia kontekst i podaje statystyki. Zastępuje odrębną uwagę o statystycznej roli tego członu.

Reguła dostarcza podstawy do ustalenia płci. Oba człony zachowują swoje statystyczne role, dlatego obecne w nich samodzielne imiona pozostają z `uwzglednione: false` i nie zmieniają liczników. „Klimek Witek” daje wynik Mężczyzna ze zdrobnienia, „Gala Witek” blokuje żeńskie wskazanie imienia Gala, a „Witek Kowalska” blokuje silne wskazanie nazwiska Kowalska. Dwa zdrobnienia, np. „Witek Mirek”, nie uruchamiają tej reguły.

Poprawny pojedynczy PESEL zachowuje pierwszeństwo. Jeżeli zdrobnienie spełnia wszystkie warunki i wskazuje przeciwną płeć, `sprzeczneZPeselem: true` daje uwagę informacyjną `high`. Uwzględnione wcześniej jednoznaczne samodzielne imiona nadal podlegają dotychczasowemu sprawdzeniu konfliktu z PESEL-em. Błędny lub wielokrotny potencjalny PESEL nadal wymaga weryfikacji.

### PESEL, daty i wiek

Dotychczasowe reguły pozostają: tylko samodzielne ciągi 10-12 cyfr są potencjalnymi numerami; pozostałe długości ignorujemy. Nie sklejamy cyfr. Poprawny numer musi mieć 11 cyfr ASCII, prawidłową datę i sumę kontrolną. Dziesiąta cyfra parzysta wskazuje kobietę, nieparzysta mężczyznę. Poprawny pojedynczy PESEL rozstrzyga brak lub niejednoznaczność imion, również remis i przeciwne słabe wskazanie. Sprzeczność z uwzględnionym jednoznacznym imieniem blokuje płeć. Błędny lub wielokrotny potencjalny numer wymaga weryfikacji. Nie poprawiamy numerów.

## Wynik analizy wiersza

`klasyfikujWiersz(tekst, numerWiersza = null)` przyjmuje jeden wiersz i opcjonalny identyfikator jego pozycji. Pusty wiersz daje `null`; tekst zawierający nową linię powoduje `TypeError`. `klasyfikujListe(tekst)` dzieli tekst na wiersze, pomija puste i zwraca tablicę wyników z numerami wierszy od 1. Nie usuwa powtórzonych uczestników.

Zachowane pola:

| Pole | Znaczenie |
|---|---|
| `numerWiersza` | Numer wejściowego wiersza albo przekazana wartość/null |
| `oryginalnyWiersz` | Niezmieniony tekst |
| `oczyszczonyWiersz` | Tekst po zamianie interpunkcji na separatory i uporządkowaniu spacji |
| `rozpoznaneImiona` | Wszystkie dopasowania do słownika imion, także pominięte po rozstrzygnięciu roli |
| `nierozpoznaneCzlony` | Historyczne pole: brak dopasowania do imion; może zawierać rozpoznane nazwisko lub zdrobnienie |
| `wskazania` | `{kobieta, mezczyzna, niejednoznaczne}` - liczby uwzględnionych dopasowań imion, nie uczestników |
| `pesel.znalezione` | Wyniki walidacji potencjalnych numerów wraz z pozycją |
| `kategoriaAutomatyczna` | `Kobieta`, `Mężczyzna` albo `Do weryfikacji` |
| `klasyfikacjaReczna` | Jedna z powyższych kategorii albo `null` |
| `zrodlo` | `imiona`, `pesel`, `imiona_i_nazwisko`, `zdrobnienia` albo `null` |
| `uzasadnienie` | Tablica opisów decyzji |
| `sugestia` | Kierunek dla nierozstrzygniętej płci albo `null`; nie zmienia kategorii |
| `ostrzezenia` | Historyczna tablica kodów; nie służy do liczenia aktywnej weryfikacji |
| `urodzenie` | Wybrana data, źródło, znalezione zapisy i uwagi opisane niżej |

Pozycje `pozycja` są indeksami od zera w oczyszczonym ciągu członów. Nie są offsetami znaków oryginalnego tekstu. Numery i fragmenty dat zajmują pozycje, nawet jeśli krótkie liczby są pomijane. W 1.2 nie zmieniono normalizacji, transliteracji ani obsługi członów rozdzielonych interpunkcją.

### Statystyki imienia

Każdy wpis `rozpoznaneImiona[]`:

```js
{
  pozycja: 0, tekst: 'Witek', klucz: 'WITEK',
  plec: 'Mężczyzna', // jednoznaczna płeć albo null
  sugestia: null,   // przewaga przy niejednoznaczności albo null przy remisie
  uwzglednione: true,
  wariantZPolskimiZnakami: null, // sugestia albo null, struktura poniżej
  statystyki: {
    kobiety: 0, mezczyzni: 47,
    procentKobiet: 0, procentMezczyzn: 100,
    progOsiagniety: true, uwagaProgowa: false
  }
}
```

Procenty to liczby od 0 do 100, nie prawdopodobieństwo płci uczestnika. Dane statystyczne są zamrożone i nie należy ich modyfikować. Dla starszego zapisanego wyniku bez `uwzglednione` helper komunikatów traktuje dopasowanie jako uwzględnione; migracji trwałych danych ta wersja nie wykonuje.

### Szczegóły sugestii pisowni

Nowe pole każdego wpisu `rozpoznaneImiona[]`: `wariantZPolskimiZnakami`, równe `null` lub obiektowi `{klucz, plec, statystyki}`. `statystyki` ma ten sam format co statystyki imienia; `plec` to jednoznaczna płeć wariantu albo `null`. Pole jest wypełnione tylko po spełnieniu wszystkich warunków sugestii i przy `uwzglednione: true`. Nie jest propozycją automatycznej zamiany danych. Obiekt wariantu oraz statystyki są zamrożone. Starsze wyniki bez tego pola są traktowane jako pozbawione sugestii.

Przykładowo dla MALGORZATA pole może wskazywać klucz MAŁGORZATA, jej statystyki i płeć. Statystyki w głównym dopasowaniu nadal opisują wyłącznie MALGORZATA.

### Szczegóły ról

```js
czlonyTekstowe: [{
  pozycja: 1, tekst: 'Klimek', klucz: 'KLIMEK',
  dopasowania: { imie: true, nazwisko: true, zdrobnienie: false },
  rolaWstepna: 'nazwisko', // opcjonalne, tylko dla par w nowej analizie
  rola: 'nazwisko', // 'imie', 'nazwisko', 'nierozstrzygnieta'
  podstawaRoli: 'PRZEWAGA_NAZWISKA', // pełna lista poniżej
  przewagaNazwiska: true // warunek 50 razy i minimum 100 wystąpień nazwiska
}]
```

Pole `rolaWstepna` występuje tylko w analizie pary w wersji 1.2.2. Przyjmuje wartości `imie`, `nazwisko`, `niejednoznaczna` lub `nierozpoznana`. Do pokazania końcowej roli służy `rola`.

Dopuszczalne `podstawaRoli`:

| Wartość | Znaczenie / uwaga dotycząca roli |
|---|---|
| `TYLKO_IMIE` | Dopasowanie wyłącznie do imion |
| `TYLKO_NAZWISKO` | Dopasowanie wyłącznie do nazwisk |
| `PRZEWAGA_NAZWISKA` | Przewaga liczebności nazwiska 50×, uwaga medium |
| `PRZEWAGA_IMIENIA_50` | Przewaga liczebności imienia 50×, uwaga medium w nowej analizie pary |
| `KONTEKST_IMIENIA_DWA_CZLONY` | Prawdopodobne imię przy wstępnie rozpoznanym nazwisku, uwaga medium |
| `KONTEKST_NAZWISKA_DWA_CZLONY` | Prawdopodobne nazwisko przy wstępnie rozpoznanym imieniu, uwaga medium |
| `TYLKO_ZDROBNIENIE` | Dopasowanie wyłącznie do zdrobnień w nowej analizie pary. Sama rola nie wystarcza do decyzji o płci. |
| `PRZEWAGA_IMIENIA_30` | Minimum 100 wystąpień i przewaga co najmniej 30x, bez uwagi |
| `PRZEWAGA_IMIENIA_10_DWA_CZLONY` | Szczególny kontekst dwóch członów, minimum 100 i przewaga 10x do poniżej 30x, bez uwagi |
| `PRZEWAGA_IMIENIA_10_Z_NAZWISKIEM` | Minimum 100 i przewaga 10x do poniżej 30x z innym rozpoznanym nazwiskiem, uwaga low |
| `KONTEKST_DWOCH_CZLONOW` | Prawdopodobne imię przy osobnym nazwisku, uwaga low |
| `KONTEKST_ZDROBNIENIA` | Rola imienia ustalona dla zdrobnienia dzięki osobnemu nazwisku, poprawnemu PESEL-owi lub obu |
| `null` | Rola nierozstrzygnięta |

Nowe reguły zmieniają rolę, nie statystyki ani jednoznaczność płci. Imię 50/50 może mieć rozstrzygniętą rolę i nadal wymagać weryfikacji płci. Kontekst nie otrzymuje procentowego prawdopodobieństwa.

Tablica obejmuje człony tekstowe, bez samodzielnych ciągów cyfr. Rola `imie`/`nazwisko` oznacza wynik zastosowanych reguł, nie potwierdzenie z dokumentu. Obecność wyłącznie w jednym ograniczonym słowniku nie dowodzi, że inna rola jest niemożliwa.

`rozpoznaneNazwiska[]` zawiera `{pozycja, tekst, klucz, rola, statystyki}`. Statystyki:

```js
{
  kobiety: 67308, mezczyzni: 3, razem: 67311,
  procentKobiet: 99.99554307616883, // wartości obliczane, bez zaokrąglania do decyzji
  procentMezczyzn: 0.004456923831171725,
  progOsiagniety: true, // sam udział >= 99,90%
  silneWskazanie: true, // dodatkowo razem >= 100
  plec: 'Kobieta'       // tylko przy silnym wskazaniu, inaczej null
}
```

`rozpoznaneZdrobnienia[]` zawiera dotychczasowe pola `{pozycja, tekst, klucz, rola, statystyki, odpowiedniki}`. `statystyki` opisuje samodzielne imię albo ma wartość `null`. `odpowiedniki` zawiera po jednym obiekcie `{klucz, statystyki}` dla każdej pełnej formy, z wartością `null` w przypadku braku danych.

| Nowe pole | Znaczenie |
|---|---|
| `kontekst` | `nazwisko`, `pesel`, `nazwisko_i_pesel`, `para_potencjalnych_imion`, `para_nazwisk` albo `null`. Konteksty par pozwalają ocenić zgodność wskazań. `para_nazwisk` oznacza, że jedno zdrobnienie z pary nazwisk ma komplet zgodnych pełnych form. Może występować także przy weryfikacji lub decyzji z PESEL-u. |
| `plecZPelnychForm` | `Kobieta`, `Mężczyzna` albo `null`. Zgodne wskazanie pełnych form dla zdrobnienia bez samodzielnego wpisu lub dla zdrobnienia w kontekście `para_nazwisk`. |
| `wykorzystaneDoKlasyfikacji` | `true`, gdy zdrobnienie stanowiło podstawę automatycznej decyzji ze źródłem `zdrobnienia` |
| `sprzeczneZPeselem` | `true`, gdy pełne formy zdrobnienia dopuszczonego do porównania wskazują przeciwną płeć do wyniku ustalonego z PESEL-u |
| `wariantZPolskimiZnakami` | Opcjonalny klucz słownikowy, np. `PAWEŁEK`, obecny tylko przy dopasowaniu zdrobnienia bez polskich znaków. |

Pola `rozpoznaneImiona` i `wskazania` nadal opisują wyłącznie dopasowania do słownika imion. Zdrobnienie bez samodzielnego wpisu może pozostać w historycznym polu `nierozpoznaneCzlony` także przy roli `imie`. Nowy konflikt jest opisany w `uzasadnienie` i przekazywany w komunikacie `WERYFIKACJA_PLCI`. Surowa lista `ostrzezenia` może zawierać kod `KONFLIKT_ZDROBNIENIA`. W 1.2.2 pomijamy kod `BRAK_ROZPOZNANYCH_IMION`, jeśli automatyczny wynik ma źródło `zdrobnienia`. Korekta dotyczy każdej liczby członów.

## Komunikaty i liczniki

`pobierzKomunikaty(wynik, dataWydarzenia?)` zwraca:

```js
{
  doWeryfikacji: [{ obszar: 'plec', kod: 'WERYFIKACJA_PLCI', severity: 'high', opis: '...' }],
  informacyjne: [{
    obszar: 'dane', kod: 'ROLA_NAZWISKA_ZE_STATYSTYK', severity: 'medium',
    klucz: 'KLIMEK', pozycje: [1], opis: '...'
  }]
}
```

Wspólne pola to `obszar` (`plec`, `wiek`, nowe `dane`), `kod`, `severity` (`low`, `medium`, `high`), `opis`. Nowe komunikaty dotyczące konkretnego członu dodatkowo mają `klucz` i `pozycje`. Jeden komunikat danego kodu na klucz zbiera pozycje powtórzeń. Nie należy zakładać obecności tych dodatkowych pól w starszych kodach.

`severity` określa prezentację, nigdy decyzję. Uwagi `high` w `informacyjne` nie zwiększają liczby rekordów do weryfikacji. Nie sortujemy ich w logice; UI odpowiada za sortowanie i kolory.

| Kod informacyjny | Ważność | Znaczenie |
|---|---|---|
| `IMIE_W_PRZEDZIALE_PROGOWYM` | low | Udział 99,90% do poniżej 99,98% |
| `ZGODNE_SLABE_IMIE` | low | Słabe imię zgodne z jednoznacznym |
| `PESEL_BEZ_IMIENIA` | medium | PESEL rozstrzyga bez uwzględnionego samodzielnego imienia ani zdrobnienia o rozpoznanej roli imienia |
| `PESEL_REMIS` | medium | PESEL rozstrzyga remis imienia |
| `PESEL_PRZECIWNE_IMIE` | medium | PESEL rozstrzyga przeciwne słabe wskazanie |
| `PESEL_ZGODNE_SLABE_IMIE` | low lub medium | Low, jeśli istnieje też jednoznaczne imię; inaczej medium |
| `RZADKIE_IMIE` | medium lub high | 50-99 albo 30-49 wystąpień; pomijana przy sugestii polskiej pisowni i zgodnej jednoznacznej płci obu wariantów |
| `MOZLIWY_BRAK_POLSKICH_ZNAKOW` | low | Jedyny odpowiednik z polskimi znakami spełnia progi 10 000 wystąpień i przewagi 10x |
| `ROLA_NAZWISKA_ZE_STATYSTYK` | medium | Przyjęto rolę nazwiska na podstawie przewagi statystycznej |
| `NIEROZSTRZYGNIETA_ROLA` | medium lub high | Przy analizie pary medium dla niejednoznacznego członu bez ustalonej roli. Na starszej ścieżce dotychczasowe high. |
| `ROLA_IMIENIA_ZE_STATYSTYK` | medium lub low | Medium przy przewadze imienia 50× w analizie pary. Na starszej ścieżce low przy regule 10× z rozpoznanym nazwiskiem. |
| `ROLA_IMIENIA_Z_KONTEKSTU` | medium lub low | Prawdopodobne imię z kontekstu pary. W 1.2.2 medium, na starszej ścieżce low. |
| `ROLA_NAZWISKA_Z_KONTEKSTU` | medium | Prawdopodobne nazwisko przy drugim członie rozpoznanym jako imię. |
| `MOZLIWE_ZDROBNIENIE` | high | Zdrobnienie, statystyki pełnych form oraz informacja o podstawie decyzji lub rozbieżności z PESEL-em, jeśli dotyczy |
| `KLASYFIKACJA_WSPARTA_NAZWISKIEM` | medium | Źródło `imiona_i_nazwisko` |
| `NAZWISKO_PRZECIWNE_WYNIKOWI` | high | Silne nazwisko przeciwne do decyzji z imion albo PESEL-u |

Weryfikacja płci ma kod `WERYFIKACJA_PLCI` albo `RECZNA_WERYFIKACJA`, zawsze `high`. Uwagi dat/PESEL-u opisane niżej mają `high`, ale mogą znaleźć się w jednej z dwóch list zależnie od możliwości ustalenia daty.

```js
const oceny = osoby.map(o => api.pobierzKomunikaty(o, dzien));
const liczbaDoWeryfikacji = oceny.filter(o => o.doWeryfikacji.length > 0).length;
const liczbaUwagInformacyjnych = oceny.reduce((s, o) => s + o.informacyjne.length, 0);
```

Jeden rekord może mieć kilka powodów weryfikacji; w liczniku rekordów liczymy go raz. Sekcja „Uwagi informacyjne (X)” może używać liczby komunikatów. `podsumuj` nadal liczy wyłącznie efektywne kategorie płci, nie problemy wieku.

Po ręcznej zmianie kategorii znikają aktywne zadania weryfikacji płci, o ile użytkownik nie wybrał `Do weryfikacji`. Uwagi informacyjne nadal opisują analizę automatyczną, nie są przeliczane według ręcznie wybranej płci. Ręczna zmiana płci nie usuwa konfliktów dat ani informacji o rolach.

## Pozostałe funkcje publiczne

- `sprawdzPesel(numer)` - wymaga tekstu, zwraca `{numer, poprawny, formatPoprawny, dataPoprawna, kontrolnaPoprawna, dataUrodzenia, plec, bledy}`. Przy złym formacie kontrole daty i sumy są `null`; `plec` jest dostępna tylko dla w pełni poprawnego numeru. W `pesel.znalezione[]` dodatkowo znajduje się `pozycja`.
- `ustawKlasyfikacjeReczna(wynik, kategoria)` - zwraca nowy obiekt z ustawioną kategorią; `null` przywraca automat. Nie zmienia wejściowego obiektu ani wyniku automatycznego. Niepoprawna kategoria powoduje `TypeError`.
- `pobierzKategorie(wynik)` - zwraca kategorię ręczną, jeśli ustawiona, inaczej automatyczną.
- `podsumuj(wyniki)` - zwraca `{kobieta, mezczyzna, doWeryfikacji, razem}` dla efektywnych kategorii płci.
- `obliczWiek(wynik, dataWydarzenia)` - zwraca `{wiek, uwagi}`. `wiek` jest liczbą ukończonych lat, w tym poprawne zero, lub `null`. Uwagi zawierają `severity`, `kod`, `opis`.
- `parsujProgi(wejscie)` - przyjmuje tekst lub tablicę liczb; zwraca posortowane unikalne nieujemne bezpieczne liczby całkowite. Tekst: dowolny separator, `10.5` daje `[5,10]`, `10-12` daje `[10,12]`, minus przed samodzielną liczbą ją odrzuca. Tablica: ułamki, teksty, wartości ujemne i NaN są pomijane. Inny typ argumentu powoduje `TypeError`.
- `statystykiWiekowe(wyniki, dataWydarzenia, progi = PROGI_TURYSTYCZNE)` - zwraca `{dataWydarzenia, razem, nieustalony, progi:[{prog, ponizej, coNajmniej}]}`. Nieznany wiek nie jest po żadnej stronie progu. Dla każdego progu suma obu stron i `nieustalony` jest równa `razem`.
- `PROGI_TURYSTYCZNE` - zamrożona tablica `[10,12,14,16,18,25,60]`.

Data wydarzenia musi mieć poprawny format `RRRR-MM-DD`. Brak, `null` lub pusty tekst daje nieustalony wiek bez błędu; niepoprawna niepusta data powoduje `RangeError`, również dla pustej listy uczestników w statystykach. Zmiana dnia wymaga ponownego wywołania funkcji wieku/statystyk/komunikatów, bez ponownej klasyfikacji. Dla 29 lutego urodziny w nieprzestępnym roku przyjmujemy 1 marca. Data urodzenia po wydarzeniu daje wiek `null` i weryfikację wieku.

`urodzenie` ma postać `{data, zrodlo, wpisane:[{tekst,data}], uwagi:[{severity,kod,opis}]}`. Data jest ISO lub `null`; źródło to `wiersz`, `pesel`, `wiersz_i_pesel` lub `null`. Obsługiwane daty: rok na początku lub końcu, cztery cyfry roku, dzień i miesiąc jedno- lub dwucyfrowe, separator `-`, `.` albo `/`. Rok na końcu oznacza dzień-miesiąc-rok. Sprawdzamy rzeczywisty kalendarz, lata 0001-9999. Mieszane separatory w rozpoznanym zapisie są błędem. Identyczne znormalizowane daty nie tworzą konfliktu; różne poprawne daty lub sprzeczność z PESEL-em blokują wiek.

| Kod daty | Znaczenie |
|---|---|
| `BLEDNA_DATA` | Niepoprawny rozpoznany zapis daty |
| `BLEDNY_PESEL` | Niepoprawny potencjalny numer |
| `KILKA_NUMEROW` | Nie wybieramy daty z kilku numerów |
| `ROZNE_DATY` | Kilka różnych poprawnych dat w wierszu |
| `KONFLIKT_DATY_PESEL` | Data wpisana niezgodna z poprawnym numerem |
| `URODZENIE_PO_WYDARZENIU` | Urodzenie późniejsze niż wybrany dzień |

Poprawny PESEL może dostarczyć datę mimo błędnego zapisu obok. Poprawna wpisana data może posłużyć mimo błędnego lub wielokrotnego PESEL-u. Przy ustalonej dacie uwagi o odrzuconym źródle trafiają do informacji z wyjaśnieniem użytego źródła. Przy braku ustalonej daty błędy trafiają do weryfikacji. Brak daty i PESEL-u sam nie jest błędem. Weryfikacja płci oraz wieku są niezależne. UI powinno używać `pobierzKomunikaty`, zamiast łączyć wszystkie surowe tablice uwag i powielać komunikaty.

## Bezpośrednie użycie modułów

Integracja UX/UI używa publicznych metod `KlasyfikatorUczestnikow` opisanych wyżej. Przy bezpośrednim użyciu modułu przeglądarka udostępnia wskazaną nazwę globalną, a w Node.js można zaimportować odpowiedni plik przez `require`, np. `require('./core/pesel.js')` z katalogu głównego.

| Moduł i nazwa globalna | Eksport | Parametry i wynik |
|---|---|---|
| `pesel.js`, `KlasyfikatorPesel` | `sprawdzPesel(numer)` | String z numerem. Zwraca obiekt walidacji opisany w sekcji funkcji publicznych. |
| | `jestKandydatemNaPesel(tekst)` | Pojedynczy człon tekstowy. Zwraca `true` dla ciągu 10–12 cyfr dziesiętnych Unicode, który kwalifikuje się do sprawdzenia. Właściwa walidacja formatu wymaga 11 cyfr ASCII. |
| | `wybierzPoprawnyPesel(numery)` | Tablica wyników walidacji. Zwraca ten sam element, jeśli jest jedyny i poprawny, albo `null`. |
| `daty.js`, `KlasyfikatorDaty` | `dataISO(rok, miesiac, dzien)` | Trzy liczby całkowite. Zwraca `RRRR-MM-DD` dla daty z zakresu 0001–9999 albo `null` dla daty spoza zakresu lub kalendarza. |
| | `ustalUrodzenie(wiersz, numery)` | Tekst wiersza i tablica wyników walidacji PESEL-u, np. `[]`. Zwraca obiekt `urodzenie` opisany w sekcji funkcji publicznych. |
| | `obliczWiek`, `parsujProgi`, `statystykiWiekowe`, `PROGI_TURYSTYCZNE` | Argumenty i format wyników są takie same jak w publicznym API `core/klasyfikator.js`. |
| `komunikaty.js`, `KlasyfikatorKomunikaty` | `formatuj(klucz, ...parametry)` | Klucz katalogu i opcjonalne parametry w podanej niżej kolejności. Zwraca gotowy tekst. Nieznany klucz powoduje `RangeError`. |

### Parametry dynamicznych szablonów komunikatów

| Klucz | Parametry |
|---|---|
| `BLEDNA_DATA` | `tekst` wpisanej daty |
| `BLAD_WPISU_NAZWISKA`, `BLAD_WPISU_ZDROBNIENIA` | `tekst` klucza słownika z niepoprawnymi wartościami |
| `BLAD_LICZB_IMIENIA` | `imie`, klucz słownika |
| `POWTORZONY_KLUCZ` | `klucz` po znormalizowaniu wielkości liter |
| `IMIE_W_PRZEDZIALE_PROGOWYM`, `ROLA_IMIENIA_ZE_STATYSTYK`, `ROLA_NAZWISKA_ZE_STATYSTYK`, `NIEROZSTRZYGNIETA_ROLA` | `tekst` członu |
| `RZADKIE_IMIE` | `tekst` członu, `razem` wystąpień |
| `MOZLIWY_BRAK_POLSKICH_ZNAKOW` | `tekst` członu, `razem` wystąpień, `kluczWariantu`, `razemWariant` |
| `ROLA_IMIENIA_Z_KONTEKSTU` | `tekst` imienia, `nazwisko` jako tekst drugiego członu, szablon starszej ścieżki |
| `ROLA_Z_KONTEKSTU_PARY` | `tekst` członu, `drugi` jako tekst drugiego członu, końcowa `rola` (`imie` lub `nazwisko`). Klucz szablonu wspólny dla dwóch kodów uwag. |
| `ROLA_IMIENIA_ZE_STATYSTYK_50` | `tekst` członu. Szablon dla kodu uwagi `ROLA_IMIENIA_ZE_STATYSTYK` w analizie pary. |
| `MOZLIWE_ZDROBNIENIE` | `wpis` z `rozpoznaneZdrobnienia[]` |
| `NAZWISKO_PRZECIWNE_WYNIKOWI` | `tekst` nazwiska, `zrodlo` decyzji |
| `WERYFIKACJA_PLCI` | `uzasadnienie`, tablica tekstów do połączenia |
| `DOPISEK_ZRODLO_DATY` | `zPesel`, wartość logiczna wskazująca źródło daty |

Pozostałe klucze katalogu mają stałą treść. Przykładowe wywołanie to `formatuj('PESEL_FORMAT')`. Interfejs wyświetla gotowe opisy z `pobierzKomunikaty()`, łącznie z ich kodami i poziomami ważności.

## Dostosowanie interfejsu

Wersja 1.2.2 korzysta z tych samych ścieżek, kolejności ładowania modułów i wywołań API co 1.2.1. Interfejs może korzystać z wartości końcowej `rola` i renderować `opis` oraz `severity` z `pobierzKomunikaty()`.

Jeżeli interfejs ma własną mapę etykiet `podstawaRoli`, uwzględnij `PRZEWAGA_IMIENIA_50`, `KONTEKST_IMIENIA_DWA_CZLONY`, `KONTEKST_NAZWISKA_DWA_CZLONY` i `TYLKO_ZDROBNIENIE`. Dla rozstrzygnięć kontekstowych pokaż „prawdopodobne imię” albo „prawdopodobne nazwisko”. Dostosuj ewentualne dodatkowe formatowanie do nowego kodu `ROLA_NAZWISKA_Z_KONTEKSTU` i zmiennych poziomów w tabeli. Przy kolizjach z udziałem zdrobnienia może brakować wpisu w `rozpoznaneImiona`. Użyj wówczas informacji z `rozpoznaneZdrobnienia` i gotowego opisu z API.

### Prezentacja sugestii pisowni

Obsłuż kod `MOZLIWY_BRAK_POLSKICH_ZNAKOW`, wyświetlając `opis` i `severity` z API w sekcji informacyjnej. Przy uniwersalnym renderowaniu komunikatów nie trzeba dodawać specjalnej logiki. Pole `wariantZPolskimiZnakami` pozwala opcjonalnie pokazać osobno statystyki obu wariantów. Nie poprawiaj imienia automatycznie. Nie odtwarzaj `RZADKIE_IMIE` na podstawie samych liczebności - API może świadomie pominąć tę uwagę. Nie usuwaj innych komunikatów dla rekordu.

### Prezentacja klasyfikacji ze zdrobnień

Jeśli interfejs mapuje źródła decyzji na etykiety, dodaj `zdrobnienia` jako „Na podstawie zdrobnienia”. Jeśli pokazuje podstawę roli, obsłuż `KONTEKST_ZDROBNIENIA` jako „Prawdopodobne imię”. Wyświetlaj jedną uwagę `MOZLIWE_ZDROBNIENIE` z opisem zwróconym przez API. Zachowaj zapis z wejścia także podczas pokazywania pełnych form. Procenty z `odpowiedniki[].statystyki` dotyczą wyłącznie odpowiednich pełnych form.

Przy `kontekst: 'para_nazwisk'` pokazuj źródło decyzji z `zrodlo` i objaśnienie z `MOZLIWE_ZDROBNIENIE`. Użycie zdrobnienia w tej regule nie potwierdza pola imienia ani jego kolejności. Interfejs wyświetlający komunikaty bezpośrednio z API otrzyma rozszerzoną treść w dotychczasowym kodzie i poziomie ważności.

W T-001 i T-003 korzystaj z `opis` tego samego kodu `WERYFIKACJA_PLCI`. Przy dopasowaniu bez polskich znaków `MOZLIWE_ZDROBNIENIE` (`high`) zawiera obie pisownie. Używaj `wariantZPolskimiZnakami` tylko do prezentacji dopasowania.

## Zalecenia prezentacji

- Używaj sformułowania „Rozpoznane imię”, ponieważ dopasowanie może dotyczyć nazwiska.
- Dopasowania z `uwzglednione: false` pokaż jako pominięte przy ocenie płci wraz z powodem, nie jako aktywny konflikt.
- Statystyki imion i nazwisk pokazuj osobno. To częstości w rejestrze, nie prawdopodobieństwo płci konkretnego uczestnika ani pewność roli wyrazu.
- Procenty zaokrąglaj wyłącznie do wyświetlania. Przy szczegółach stosuj np. cztery miejsca dziesiętne; decyzję odczytuj z API.
- Brak statystyk pokaż jako „brak wpisu w słowniku”, nie „0 osób”.
- Komunikaty o przypisaniu ról pozostają uniwersalne, bez wskazywania odbiorcy danych lub konkretnej branży.
- Treść uczestnika i komunikatów wstawiaj jako tekst, np. `textContent`, nie niesprawdzone HTML.
- Sekcja uwag informacyjnych może być domyślnie zwinięta; poziom ważności i obszar są danymi z logiki.

## Walidacja wersji

Uruchom `node --test tests/klasyfikator.test.js tests/pesel.test.js tests/daty.test.js tests/komunikaty.test.js` z katalogu głównego projektu.

Wszystkie 448 testów przechodzi. Zestaw zawiera 412 dotychczasowych przypadków i 36 nowych. Obejmuje macierz 36 par, przykłady obu korekt w obydwu kolejnościach, wartości graniczne, PESEL, diagnostykę i kolizje zapisu bez polskich znaków.

Porównania z zestawami 267, 376 i 412 testów oraz wynik porównania na pełnych słownikach opisuje plik [ZMIANY-TESTOW-1.2.2.md](./ZMIANY-TESTOW-1.2.2.md).
