# Klasyfikator uczestników 1.2.4 - imiona i nazwiska złożone

Dokument uzupełnia API 1.2.3 i obejmuje oba etapy wersji 1.2.4 oraz korektę T-004. `KlasyfikatorUczestnikow.utworzKlasyfikator(imiona, nazwiska?, zdrobnienia?)` przyjmuje dotychczasowe słowniki. Zwraca m.in. metody `klasyfikujWiersz(wiersz)` i `klasyfikujListe(tekst)`. Poniższe pola są dostępne w wyniku każdego uczestnika. Sygnatury publicznych funkcji i kategorie wyników pochodzą z API 1.2.3.

## Kolejność i role

| Pole | Zawartość |
|---|---|
| `jednostkiTekstowe` | Samodzielne człony i grupy z łącznikiem w kolejności wejściowej. `typ` to `czlon` lub `grupa`. Nie zawiera samodzielnych liczb, dat ani PESEL-i. |
| `grupyZlozone` | Grupy z łącznikiem, z pełnym zapisem, rolą i informacją, jak traktowano je przy ocenie płci. Brak grup daje pustą tablicę. |
| `czlonyTekstowe` | Diagnostyka pojedynczych części. `czescGrupy: true` wskazuje przynależność do grupy. Rola i jej podstawa w takim wpisie pochodzą z grupy. Wpływ dopasowania na płeć opisuje `uwzglednione` w odpowiedniej tablicy dopasowań. |
| `oryginalnyWiersz`, `oczyszczonyWiersz` | Zapis źródłowy i tekst zgodny z tokenizacją 1.2.3. Oczyszczony tekst nadal może pokazywać części rozdzielone spacją. |

Każda jednostka ma `tekst`, `klucz`, `pozycja`, `pozycje`, `zakres`, `rola`, `podstawaRoli` i `pewnoscRoli`. `pozycje` to indeksy części w oczyszczonym wierszu, a `pozycja` to pierwszy z nich. Indeksy nadal liczą też elementy numeryczne wykorzystywane w istniejącej diagnostyce, np. PESEL. `zakres` to para indeksów UTF-16 `[początek, koniec)` w oryginalnym wierszu. `oryginalnyWiersz.slice(...zakres)` zwraca dokładnie `tekst` jednostki.

`rola` to `imie`, `nazwisko` lub `nierozstrzygnieta`. `podstawaRoli` wskazuje dotychczasową regułę, regułę grupy albo ma wartość `null`. `pewnoscRoli` przyjmuje jedną z trzech wartości.

- `wysoka` - wyłączne dopasowanie, pełny wpis złożony albo rozstrzygająca przewaga 30× lub 50× według dotychczasowych reguł.
- `srednia` - reguła kontekstowa, zdrobnienie, słabsza przewaga 10× albo rozpoznanie grupy po częściach.
- `nieustalona` - brak rozstrzygającej podstawy do przypisania roli.

Poziom opisuje podstawę roli. Próg 99,90% nadal dotyczy wskazania płci. Do przyszłego porządkowania danych należy odczytywać `jednostkiTekstowe`, z uwzględnieniem nierozstrzygniętych ról. `rozpoznaneImiona` i `rozpoznaneNazwiska` zwracają diagnostykę dopasowań słownikowych i mogą zawierać pozycje nieuwzględnione. Sam fakt znalezienia dopasowania nie wystarcza do przesunięcia części w wierszu.

## Grupy z łącznikiem

Grupa rozszerza dane jednostki o `dopasowania: { imie, nazwisko }` dla pełnego klucza, `statystyki` pełnego dopasowania lub `null` oraz pole `analizaPlci`.

| `podstawaRoli` | `analizaPlci` | Znaczenie |
|---|---|---|
| `PELNE_NAZWISKO_ZLOZONE` | `pelne_statystyki_nazwiska` | Grupa jest w słowniku nazwisk. Jej własne statystyki mogą być silnym wskazaniem przy minimum 100 wystąpieniach i udziale co najmniej 99,90%. Samo nazwisko nie rozstrzyga płci. |
| `NAZWISKO_ZLOZONE_Z_CZESCI` | `pominieta` | Nazwisko rozpoznano po częściach. Grupa może stanowić kontekst dla osobnego imienia lub zdrobnienia. Statystyki części zachowano do wglądu. |
| `PELNE_IMIE_ZLOZONE` | `pelne_statystyki_imienia` | Pełny wpis imienia daje jedno wskazanie, także bez nazwiska. Używa własnych statystyk oraz progu 99,90%. Części są wyłącznie diagnostyczne. |
| `IMIENNE_ROLE_CZESCI` | `statystyki_czesci_imienia` | Każda część ma dopasowanie w słowniku imion, żadna nie ma przewagi nazwiska 50× i występuje niezależnie rozpoznane nazwisko. `statystyki` grupy mają wartość `null`. |
| `null` | `pominieta` | Rola grupy pozostaje nieustalona, np. przy kolizji pełnych wpisów lub braku wymaganych dopasowań. Grupa nie daje wskazania płci. Samodzielne wskazania spoza grupy pozostają dostępne. |

Każda grupa zajmuje jedno miejsce w analizie kontekstu. Przy pełnym dopasowaniu wpis w `rozpoznaneImiona` albo `rozpoznaneNazwiska` ma `pozycje` całej grupy i może współdzielić `pozycja` z jej pierwszą częścią. Przy pełnym imieniu wpis całej grupy ma `uwzglednione: true`. Wpisy jego części mają `uwzglednione: false`. W przypadku `statystyki_czesci_imienia` dopasowania części imiennych mają `uwzglednione: true`, a ich osobne wskazania trafiają do `wskazania`. W `rozpoznaneNazwiska` dopasowania odziedziczone po częściach grupy mają `uwzglednione: false`. Rozpoznane wewnątrz grupy zdrobnienia mają `czescGrupy: true`, `kontekst: null` i `wykorzystaneDoKlasyfikacji: false`.

Niezależne nazwisko może być samodzielnym członem dopasowanym wyłącznie do nazwisk, członem z przewagą nazwiska 50× przy minimum 100 wystąpieniach albo rozpoznaną grupą nazwiskową. Gdy wynik opiera się na częściach imienia, wymaga co najmniej jednego wskazania na poziomie 99,90%, zgodnego kierunku wszystkich części i braku remisu. Udziały dotyczą występowania w słowniku. Algorytm nie sumuje ani nie uśrednia ich na poziomie grupy. Przy pełnym wpisie nadal obowiązują dotychczasowe zasady dotyczące zgodnego wsparcia silnym nazwiskiem. Bez słownika nazwisk nadal działają pełne wpisy imion. Rozpoznanie po częściach wymaga dostępnego kontekstu nazwiskowego.

Przy poprawnym PESEL-u jednoznacznie przeciwne wskazanie imienne nadal kieruje wpis do weryfikacji. Dla pełnego imienia porównanie dotyczy wskazania całej grupy. Dla imienia rozpoznanego po częściach dotyczy uwzględnionych wskazań części. W przypadku rozstrzygnięcia płci z niezależnego źródła diagnostyka pominiętej grupy pozostaje dostępna.

W kluczu grupy łącznik jest sprowadzany do `-`, odstępy wokół niego są pomijane, a litery zapisywane wielkimi znakami z zachowaniem diakrytyki. Typowe łączniki `-`, `‐` i `‑` bez odstępów wyznaczają kandydatów na grupy. Te same łączniki z odstępami oraz znaki U+2013 i U+2014 bez odstępów wymagają potwierdzenia pełnym wpisem lub rozpoznaniem po częściach. Pozostałe separatory zachowują dotychczasową interpretację. W oryginalnym tekście zachowywane są wszystkie znaki i kolejność części. Daty i numery PESEL zachowują dotychczasowe indeksy, formaty i walidację.

### Pierwszeństwo pełnych dopasowań po korekcie T-004

W ciągu połączonym obsługiwanymi łącznikami pełny wpis całej grupy ma najwyższy priorytet. Przy jego braku klasyfikator wydziela pełne wpisy wewnątrz ciągu i stosuje reguły rozpoznawania po częściach do pozostałych fragmentów. Gdy pełne wpisy zachodzą na siebie, pierwszeństwo ma wpis o większej liczbie członów. Przy tej samej liczbie decyduje mniejsza liczba łączników z odstępami lub znaków U+2013 i U+2014, a następnie wcześniejsza pozycja w wierszu.

W `Jean-Pierre - Nowak` pole `jednostkiTekstowe` zawiera grupę `Jean-Pierre` z podstawą `PELNE_IMIE_ZLOZONE` i osobny człon `Nowak`. Grupa imienna daje jedno wskazanie męskie. Z poprawnym żeńskim PESEL-em wynik ma kategorię `Do weryfikacji` i ostrzeżenie `KONFLIKT_PESEL_IMIONA`. W `Jean-Pierre - Kowalska-Nowak` API zwraca dwie grupy w kolejności wejściowej. Interfejs może używać dotychczasowych pól i ustawień.

## Przykład

Dla `Witek-Nowak Anna`:

| Typ jednostki | Tekst | Rola | Podstawa | Pewność |
|---|---|---|---|---|
| `grupa` | Witek-Nowak | `nazwisko` | `NAZWISKO_ZLOZONE_Z_CZESCI` | `srednia` |
| `czlon` | Anna | `imie` | `TYLKO_IMIE` | `wysoka` |

Wynik to Kobieta ze źródła `imiona`. Dopasowania Witek do imion i zdrobnień nadal można sprawdzić w diagnostyce, z oznaczeniem pominięcia. Grupa Witek-Nowak ma `statystyki: null`.

W `Kowalska-Nowak Anna-Maria` `jednostkiTekstowe` zawiera kolejno dwie grupy. `Anna-Maria` ma podstawę `PELNE_IMIE_ZLOZONE`, `analizaPlci: 'pelne_statystyki_imienia'` i stanowi jedno wskazanie żeńskie. W `Nowak Anna-Monika` druga jednostka ma podstawę `IMIENNE_ROLE_CZESCI`. Jej dwa wskazania i ich statystyki można odczytać z `rozpoznaneImiona` po pozycjach `pozycje` grupy.

## Integracja widoku

Do prezentacji nazw i przyszłego porządkowania korzystaj z `jednostkiTekstowe`. Pokazuj `tekst` całej jednostki i zachowuj kolejność części wewnątrz grupy. W diagnostyce tabelę dopasowań można powiązać z jednostkami po `pozycje`, rozróżniając wpis grupy i wpisy z `czescGrupy: true`. Podsumowania wskazań powinny korzystać z `wskazania` albo filtrować dopasowania po `uwzglednione`. Uwagi odnoszące się do całego imienia mogą zwracać wszystkie jego pozycje. `analizaPlci` dla imion zwraca od tego wydania `pelne_statystyki_imienia` albo `statystyki_czesci_imienia`. Tymczasowa wartość `dotychczasowa_analiza_czesci` z etapu 1 została wycofana.

W przeglądarce ładuj kolejno `core/komunikaty.js`, `core/daty.js`, `core/pesel.js`, `core/klasyfikator.js`. Publiczny obiekt to `KlasyfikatorUczestnikow`. W Node.js użyj `require('./core/klasyfikator.js')`. Polecenie `node --test` w katalogu głównym uruchamia cały zestaw.
