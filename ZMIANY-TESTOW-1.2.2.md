# 1.2.2 - świadome zmiany w dotychczasowych testach

## Poprawki po niezależnej weryfikacji

Paczka przekazana Testerowi przeszła 412 z 412 dotychczasowych testów. Po podstawieniu nowych modułów bez zmiany asercji przeszło 409 z 412. Wszystkie przypadki zachowano, zaktualizowano trzy oczekiwania i dodano 36 prób. Zaktualizowana paczka przechodzi **448 z 448** testów.

| Dotychczasowy test | Przed poprawką | Po poprawce i uzasadnienie |
|---|---|---|
| Macierz 1.2.2 C+G: Agusia Bartek | Kobieta ze źródła `zdrobnienia`. | Do weryfikacji z `KONFLIKT_ZDROBNIENIA`. T-001 uwzględnia przeciwne jednoznaczne wskazanie samodzielnego imienia Bartek. Rola nazwiska przypisana Bartek pozostaje w wyniku. |
| Macierz 1.2.2 C+G: Bartek Agusia | Kobieta ze źródła `zdrobnienia`. | Do weryfikacji z tym samym powodem. T-001 działa symetrycznie. |
| Brak znaku diakrytycznego nie zmienia roli na podstawie podobnego wpisu | „Pawelek Nowak” trafiał do weryfikacji. | Mężczyzna ze źródła `zdrobnienia`. Brak dokładnego wpisu `PAWELEK`, jedyny zgodny wariant `PAWEŁEK` i niezależnie rozpoznane nazwisko spełniają warunki dopasowania. Nazwę testu uaktualniono, zachowując pierwotne wejście. |

Porównanie pełnych wyników dla danych z 412 testów wykazało ponadto zmiany w **47 testach** ograniczone do uzasadnienia i treści `WERYFIKACJA_PLCI`. Dotychczasowe asercje tych testów przechodzą. T-003 rozróżnia:

| Przyczyna weryfikacji | Przykład z testów |
|---|---|
| Brak pełnego odpowiednika w słowniku imion | „Niepelne Nowak” i „Alex Kowalska” |
| Pełna forma poniżej 99,90% | „Slabe Nowak”, „Remisowe Nowak” i syntetyczne sprawdzenia granicy 998/1000 |
| Pełne formy jednego zdrobnienia wskazują różne płcie | „Krycha Nowak” |
| Różne zdrobnienia wskazują przeciwne płcie | „Piotrek Anusia Nowak” i „Pawełek Filipek” |
| Przeciwne wskazanie konkretnego imienia lub nazwiska | „Anna Piotrek”, „Gala Witek”, „Piotrek Kowalska” i „Witek Kowalska” |
| Kontekst nie pozwala wybrać zdrobnienia | „Piotrek Xyz”, „Piotrek Piotruś” i „Witek Mirek” |

Na pełnych słownikach z paczki Testera sprawdzono wszystkie 12 podanych przypadków T-001 w obu kolejnościach oraz oba zapisy „Pawełek” i „Pawelek”. Porównanie przed i po poprawkach obejmowało też **1 338 513 analiz**:

| Obserwowana różnica | Liczba analiz | Zakres |
|---|---:|---|
| Wynik i komunikaty identyczne | 639 905 | Obejmuje warianty kontrolne poza nowymi regułami. |
| Tylko diagnostyka T-003 | 6 662 | Zmiana treści uzasadnienia przy tej samej kategorii i tych samych kodach. |
| T-001 | 688 706 | Każdy rekord wcześniej klasyfikowany ze zdrobnienia trafia do weryfikacji po wykryciu przeciwnego imienia. Porównanie potwierdziło zachowanie ról członów. |
| Dopasowanie bez polskich znaków | 3 240 | W 1 302 analizach weryfikację zastąpiła klasyfikacja ze zdrobnienia. W pozostałych zmieniły się dopasowania lub uwagi przy tej samej kategorii, m.in. gdy rozstrzygnął PESEL. |

To zestaw celowo skupiony na kolizjach. Obejmuje wszystkie pary 684 imiennych zdrobnień z rozstrzygającymi pełnymi formami i 910 członów o niejednoznacznej roli z jednoznacznym samodzielnym imieniem w obu kolejnościach. Liczby opisują ten zestaw kombinacji. Nie określają częstości tych przypadków w rzeczywistych listach uczestników. Próby kontrolne obejmowały inne długości wiersza i brak słowników opcjonalnych. W tych próbach zmieniała się wyłącznie treść diagnostyki. We wszystkich porównaniach wynik analizy daty urodzenia i walidacji PESEL-u był identyczny.

## Korekta 1.2.2 względem zestawu 376 testów

Pierwotna wersja 1.2.2 przeszła 376 z 376 testów. Po podstawieniu skorygowanej logiki z pierwotnymi asercjami przeszło 369 z 376. Zaktualizowano siedem oczekiwań i dodano 36 testów. Końcowy wynik to **412 z 412**. Wszystkie 376 pierwotnych scenariuszy są w zestawie.

| Test | Przed korektą | Po korekcie i uzasadnienie |
|---|---|---|
| 1.2 role i kolejność: Witek Kowalski | Do weryfikacji | Mężczyzna ze źródła `zdrobnienia` w obu kolejnościach. Witek jest jedynym zdrobnieniem w parze nazwisk, a Witold daje zgodne wskazanie. |
| 1.2 role i kolejność: Klimek Witek | Do weryfikacji | Mężczyzna ze źródła `zdrobnienia` w obu kolejnościach. Klimek został rozpoznany jako nazwisko przez przewagę 50×; statystyki samodzielnego imienia Klimek są zgodne. |
| Rola z kontekstu i pozostałe uwagi pozostają informacyjne | Witek Kowalski miał wpis do weryfikacji, uwagę o roli `medium` i uwagę o zdrobnieniu `high`. | Automatyczny wynik oraz jedna uwaga `MOZLIWE_ZDROBNIENIE` (`high`) o Witku. Statystyczna rola pozostaje w API. Licznik weryfikacji wynosi 0. |
| Kontekst dwóch członów ignoruje datę i cyfry, ale nie dodatkowy człon tekstowy | Warianty „Witek Nowak” z datą lub numeracją wymagały weryfikacji bez PESEL-u. | Warianty bez PESEL-u klasyfikują ze zdrobnienia. Z poprawnym PESEL-em źródłem pozostaje `pesel`. Dodatkowy człon tekstowy dalej wyłącza analizę pary. |
| Sugestia nie znosi pozostałych uwag i nie jest prezentowana dla pominiętego imienia | Syntetyczne „Malgorzata Nowak” przy przewadze nazwiska wymagało weryfikacji; brak sugestii. | Kobieta ze zdrobnienia na podstawie pełnej formy przypisanej w danych testowych. Samodzielne imię pozostaje pominięte i nadal nie generuje sugestii. |
| Przypadek brzegowy 1.2.2: Witek Nowak | Do weryfikacji | Mężczyzna ze źródła `zdrobnienia` i uwaga `high`. |
| Przeciwny PESEL blokuje imię samodzielne, a konflikt ze zdrobnieniem jest uwagą | „Nowak Witek” z poprawnym żeńskim PESEL-em dawał wynik Kobieta; zdrobnienie nie miało kontekstu. | Wynik i źródło `pesel` zachowane. Zdrobnienie ma `kontekst: 'para_nazwisk'` oraz `sprzeczneZPeselem: true`. Przypadek konfliktu PESEL-u z aktywnym imieniem nadal trafia do weryfikacji. |

W dwóch dalszych testach pierwotne asercje nadal przechodzą, a porównanie pełnych wyników wykazało zmiany:

| Test | Zmiana |
|---|---|
| PESEL nie zmienia przypisania ról; rzeczywisty konflikt imienia nadal blokuje | „Witek Kowalski” z poprawnym żeńskim PESEL-em nadal daje Kobieta z PESEL-u. Uwaga `high` opisuje przeciwne wskazanie pełnej formy zdrobnienia. |
| Zdrobnienia pobierają liczby dynamicznie, nie dziedziczą płci, brak wpisu nie oznacza zera | „Witek Kowalski” otrzymuje wynik Mężczyzna ze zdrobnienia i uwagę `high`. Liczebności samodzielnej i pełnej formy są odczytywane jak wcześniej. |

Wszystkie 22 próby z 11 przykładów korekty sprawdzono także na pełnych słownikach. Porównanie 64 396 analiz poza parami z oboma słownikami opcjonalnymi dało identyczne wyniki i komunikaty względem 1.2.2 sprzed korekty. Zmiany ról, dat, wieku i walidacji PESEL-u pozostają poza zakresem korekty.

## Wersja 1.2.2 z 412 testami względem zestawu 267 testów z 1.2.1

W 1.2.1 przeszło 267 z 267 przypadków. Po podstawieniu logiki 1.2.2 sprzed poprawek po niezależnej weryfikacji do pierwotnych asercji przeszło 260 z 267. Siedem testów wymagało opisanych niżej aktualizacji. Wszystkie 267 scenariuszy pozostaje w zestawie. Jeden tytuł zmieniono, aby opisywał aktualną regułę, zachowując oba pierwotne wejścia.

| Dotychczasowy test | Oczekiwanie w 1.2.1 | Oczekiwanie w 1.2.2 i uzasadnienie |
|---|---|---|
| 1.2 role i kolejność: Witek Kowalski | Mężczyzna z samodzielnego imienia | Mężczyzna ze zdrobnienia w obu kolejnościach. Witek przekracza 50× jako nazwisko, a zgodna pełna forma pozwala ustalić płeć. |
| 1.2 role i kolejność: Klimek Witek | Mężczyzna z imion | Mężczyzna ze zdrobnienia w obu kolejnościach. Oba człony mają przewagę nazwiska 50×; reguła wykorzystuje pełną formę jedynego zdrobnienia. |
| PESEL nie zmienia przypisania ról; rzeczywisty konflikt imienia nadal blokuje | Żeński PESEL z „Witek Kowalski” trafiał do weryfikacji | Kobieta ze źródła `pesel`. Witek został rozpoznany jako nazwisko i wypada ze wskazań imion. Pełna forma powoduje uwagę informacyjną `high`. Przypadek sprzeczności PESEL-u z aktywnym jednoznacznym imieniem pozostaje w tym teście. |
| Rola z kontekstu i pozostałe uwagi pozostają informacyjne | „Witek Kowalski” miał rolę imienia, uwagę kontekstową low i uwagę o rzadkości | Witek ma statystyczną rolę nazwiska. Wynik opiera się na zdrobnieniu z jedną uwagą `high`. Dodana kontrola „Kasia Kowalska” sprawdza, że uwaga kontekstowa `medium` sama nie zwiększa licznika weryfikacji. |
| Kontekst dwóch członów ignoruje datę i cyfry, ale nie dodatkowy człon tekstowy | Witek był imieniem z kontekstu. Wynik z imienia bez PESEL-u i weryfikacja z żeńskim PESEL-em. | Data i numeracja nie zmieniają statystycznej roli nazwiska Witka. Bez PESEL-u wynik opiera się na zdrobnieniu, z poprawnym PESEL-em wynika z numeru. Dodatkowe człony tekstowe nadal uruchamiają reguły 1.2.1. |
| Sugestia nie znosi pozostałych uwag i nie jest prezentowana dla pominiętego imienia | „Malgorzata Nowak” przy 95 wystąpieniach imienia i 10 000 nazwiska nadal pokazywała sugestię pisowni | Przewaga nazwiska wyłącza samodzielne imię i sugestię. Syntetyczny wpis w słowniku zdrobnień pozwala ustalić płeć z pełnej formy. Wariant z 200 wystąpieniami nazwiska nadal sprawdza współwystępowanie sugestii, uwagi kontekstowej i zdrobnienia, gdy człon pozostaje imieniem. |
| Zdrobnienie obecne w nazwiskach nie otrzymuje nowego kontekstu imienia | W tym zestawie syntetycznym „Piotrek Nowak” dawał weryfikację, bo Piotrek figurował jako nazwisko | Nowak pozwala przypisać Piotrkowi rolę imienia. Wynik to Mężczyzna ze zdrobnienia. Jednoczłonowy przypadek „Piotrek” z żeńskim PESEL-em nadal korzysta z PESEL-u i nie rozwija nazwiska. |

## Zmiany widoczne poza asercjami dotychczasowych testów

Porównano pełne wyniki i komunikaty automatycznej analizy dla danych podawanych do klasyfikatora w starych testach Node.js. Samo dodanie pola `rolaWstepna` nie jest liczone poniżej. Poza siedmioma testami wymagającymi zmian oczekiwań znaleziono 28 testów z różnicą w dodatkowych polach. Dotychczasowe asercje wszystkich 28 nadal przechodzą.

| Dotychczasowy test | Zmienione informacje |
|---|---|
| 1.2 role i kolejność: Piotr Gala | role/podstawa roli, komunikaty |
| 1.2 role i kolejność: Kasia Kowalska | role/podstawa roli, komunikaty |
| 1.2 role i kolejność: Oleńka Kowalska | role/podstawa roli, komunikaty, uzasadnienie |
| Zdrobnienia pobierają liczby dynamicznie, nie dziedziczą płci, brak wpisu nie oznacza zera | role/podstawa roli, komunikaty, kody diagnostyczne, dopasowania imion, dopasowania nazwisk, dopasowania zdrobnień, uzasadnienie, liczniki wskazań, źródło decyzji („Witek Kowalski” pozostaje w kategorii Mężczyzna, ze źródłem `zdrobnienia`) |
| Nowe słowniki nie zmieniają dat, numerów ani ręcznych decyzji | role/podstawa roli, komunikaty |
| Zdrobnienia - decyzja i kolejność: Piotrek Krawczyk | role/podstawa roli, kody diagnostyczne |
| Zdrobnienia - decyzja i kolejność: Kasia Nowak | role/podstawa roli, komunikaty |
| Zdrobnienia - decyzja i kolejność: Bartek Kowalski | role/podstawa roli, komunikaty |
| Zdrobnienia - decyzja i kolejność: Alex Morgan | role/podstawa roli, komunikaty, dopasowania imion, dopasowania nazwisk, liczniki wskazań |
| Zdrobnienia - decyzja i kolejność: Bartuś Nowak | role/podstawa roli, kody diagnostyczne |
| Zdrobnienia - decyzja i kolejność: Anusia Nowak | role/podstawa roli, kody diagnostyczne |
| Zdrobnienia - decyzja i kolejność: Piotrek Xyz | role/podstawa roli, komunikaty, dopasowania zdrobnień, uzasadnienie |
| Zdrobnienia - decyzja i kolejność: Piotrek Jan | role/podstawa roli, dopasowania zdrobnień |
| Zdrobnienia - decyzja i kolejność: Piotrek Kowalska | role/podstawa roli |
| Zdrobnienia - decyzja i kolejność: Piotrek Piotruś Nowak | kody diagnostyczne |
| Zdrobnienia - decyzja i kolejność: Niepelne Nowak | role/podstawa roli, komunikaty, uzasadnienie |
| Zdrobnienia - decyzja i kolejność: Slabe Nowak | role/podstawa roli, komunikaty, uzasadnienie |
| Zdrobnienia - decyzja i kolejność: Remisowe Nowak | role/podstawa roli, komunikaty, uzasadnienie |
| Próg każdej pełnej formy: 999,1 | role/podstawa roli, kody diagnostyczne |
| Próg każdej pełnej formy: 998,2 | role/podstawa roli, komunikaty, uzasadnienie |
| Próg każdej pełnej formy: 1,999 | role/podstawa roli, kody diagnostyczne |
| Próg każdej pełnej formy: 2,998 | role/podstawa roli, komunikaty, uzasadnienie |
| Każda pełna forma musi spełnić próg; nie sumujemy liczebności | role/podstawa roli, komunikaty, uzasadnienie |
| Poprawny PESEL wystarcza jako kontekst, ma pierwszeństwo i scala uwagę o rozbieżności | role/podstawa roli |
| Zdrobnienia nie omijają błędów i wielokrotności PESEL | role/podstawa roli |
| Jedna uwaga o użytym zdrobnieniu zawiera liczby wszystkich pełnych form | kody diagnostyczne |
| Zdrobnienia zachowują wiek, uwagi dat, ręczne decyzje i oryginał | role/podstawa roli, kody diagnostyczne |
| Przeciwne nazwisko nadal daje tylko ostrzeżenie, gdy samodzielne imię i zdrobnienie są zgodne | role/podstawa roli |

Różnice wynikają z zastąpienia podstaw ról pary, pominięcia członów nazwiskowych przy ocenie płci, aktualizacji ważności i treści uwag o rolach, rozpoznawania zdrobnień jako potencjalnych imion i korekty kodu o braku imienia. Uzasadnienie wskazuje teraz brak rozstrzygającego kontekstu lub pełnej formy, gdy zdrobnienie zostało rozpoznane, ale nie pozwala ustalić płci.

Porównanie 64 396 analiz poza zakresem nowej reguły potwierdziło zgodność ze ścieżką 1.2.1 z dwiema instancjami zatwierdzonej korekty kodu `BRAK_ROZPOZNANYCH_IMION` po skutecznej decyzji ze zdrobnienia.
