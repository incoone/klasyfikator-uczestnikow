# Historia zmian

## v1.2.4 - Imiona i nazwiska złożone

### Rozpoznawanie danych

- Dodano rozpoznawanie imion i nazwisk złożonych, z zachowaniem oryginalnego zapisu i kolejności członów.
- Rozróżniono łączniki i separatory, uwzględniając pełne dopasowania słownikowe oraz wymagane warunki rozpoznawania po częściach.
- Rozwiązano problem T-002: części nazwiska złożonego nie są traktowane jako niezależne wskazania imienne.
- Rozwiązano problem T-004: pełne dopasowania złożone wewnątrz dłuższego ciągu mają pierwszeństwo przed rozpoznawaniem po częściach, co pozwala zachować wykrywanie konfliktów imienia z PESEL-em.
- Pełne dopasowanie imienia złożonego wykorzystuje własne statystyki; imię rozpoznane po częściach wykorzystuje odrębne wskazania, bez sumowania ich statystyk.

### API, interfejs i testy

- Rozszerzono API o jednostki tekstowe, grupy złożone, pewność rozpoznania ról i informacje o uwzględnianiu dopasowań w analizie płci.
- Dostosowano prezentację rozpoznanych grup i diagnostyki oraz stronę pomocy. Nowe metadane stanowią podstawę przyszłego porządkowania danych; automatycznego zmieniania kolejności danych jeszcze nie wprowadzono.
- Rozszerzono zestaw testów automatycznych z 465 do 535 przypadków.

### Bez zmian

- Zachowano próg jednoznaczności płci imienia 99,90%, zasady walidacji PESEL-u, dat urodzenia i obliczania wieku.
- Słowniki, dane źródłowe i lokalne przetwarzanie danych uczestników pozostają bez zmian.

## v1.2.3 - Optymalizacja komunikatów

### Zmiany w komunikatach

- Przeniesiono rutynowe rozstrzygnięcia statystyczne, przedział progowy imienia, zgodne słabe wskazania, remis rozstrzygnięty przez PESEL i niewykorzystane zdrobnienia do szczegółów analizy, bez osobnych uwag.
- Dostosowano poziomy ważności uwag dotyczących kontekstowego rozpoznawania ról, rzadkich imion, zdrobnień i błędnych dat.
- Ograniczono uwagi o rzadkości do przypadków, w których rzadkie imię jest jedyną jednoznaczną podstawą wyniku bez niezależnego potwierdzenia.
- Scalono powtarzające się komunikaty o błędach PESEL-u dotyczące płci i wieku, zachowując wszystkie przyczyny wymagające sprawdzenia. API udostępnia opcjonalne pole `powiazane`.

### Interfejs i testy

- Zaktualizowano prezentację uwag, oznaczenia przedziału progowego, szczegóły weryfikacji oraz stronę pomocy i dokumentację API.
- Zestaw testów w repozytorium rozszerzono do 465 przypadków. Niezależna weryfikacja objęła 536 zaliczonych testów oraz 352 042 porównania z wersją 1.2.2, bez wykrytych regresji.
- W niezależnym zbiorze testowym liczba komunikatów zmniejszyła się o 64,6%. Skala redukcji zależy od analizowanych danych.

### Bez zmian

- Zachowano reguły klasyfikacji płci, rozstrzygania ról, walidacji PESEL-u, obliczania wieku i kierowania wpisów do weryfikacji.
- Słowniki, dane źródłowe i lokalne przetwarzanie danych uczestników pozostają bez zmian.

## v1.2.2 - Kontekstowe rozpoznawanie imion i nazwisk

### Zmiany w klasyfikacji

- Wprowadzono dodatkową analizę dokładnie dwóch członów tekstowych, uwzględniającą role wstępne, statystyki oraz kontekst, niezależnie od kolejności danych.
- W analizie pary ujednolicono próg przewagi statystycznej imienia i nazwiska do 50:1, przy minimum 100 wystąpieniach roli dominującej.
- Rozszerzono klasyfikację na podstawie zdrobnień o wybrane przypadki kolizji z nazwiskami, w tym pary dwóch statystycznie rozpoznanych nazwisk.
- Dodano ograniczone rozpoznawanie zdrobnień zapisanych bez polskich znaków, jeżeli dopasowanie jest jednoznaczne i spełnia wymagane warunki kontekstowe.
- Zabezpieczono klasyfikację ze zdrobnień przed pomijaniem przeciwnego jednoznacznego wskazania samodzielnego imienia uznanego kontekstowo za nazwisko.
- Rozbudowano uzasadnienia wyników wymagających weryfikacji oraz uwagi dotyczące kontekstowego rozstrzygania ról i zdrobnień.

### Interfejs i testy

- Dostosowano interfejs i stronę pomocy do nowych reguł, podstaw rozstrzygania ról i komunikatów.
- Zaktualizowano dokumentację API i rozszerzono zestaw do 448 testów automatycznych.

### Bez zmian

- Zachowano próg jednoznaczności płci imienia 99,90%, reguły walidacji PESEL-u, dat urodzenia i obliczania wieku.
- Słowniki, dane źródłowe i lokalny sposób przetwarzania danych uczestników pozostają bez zmian.

## v1.2.1 - Porządkowanie kodu

### Zmiany techniczne

- Podzielono logikę aplikacji na cztery moduły w katalogu `core/`: `klasyfikator.js`, `pesel.js`, `daty.js` i `komunikaty.js`.
- Zastąpiono `script.js` głównym modułem `core/klasyfikator.js` i dostosowano kolejność ładowania skryptów oraz integrację interfejsu.
- Wydzielono testy do katalogu `tests/`, dzieląc je według odpowiedzialności modułów.
- Zaktualizowano dokumentację API, instrukcje integracji i stronę pomocy.
- Zestaw 267 testów automatycznych obejmuje wszystkie 265 wcześniejszych przypadków oraz dwa nowe testy formatowania komunikatów.

### Bez zmian

- Zachowano zasady klasyfikacji, publiczne API, struktury wyników oraz treści komunikatów.
- Słowniki i dane źródłowe pozostają bez zmian.
- Dane uczestników są nadal przetwarzane lokalnie w przeglądarce.

## v1.2

### Nowe funkcje

- Rozszerzono słownik imion z 3 668 do 8 136 pozycji, obniżając minimalną łączną liczbę wystąpień ze 100 do 30.
- Dodano słownik 117 159 nazwisk z podziałem na liczbę wystąpień u kobiet i mężczyzn.
- Dodano analizę kolizji imion i nazwisk oraz rozpoznawanie roli poszczególnych członów na podstawie kontekstu i statystyk, niezależnie od kolejności.
- Umożliwiono klasyfikację wspartą silnym wskazaniem nazwiska przy zgodnych, niejednoznacznych imionach. Samo nazwisko nie przesądza o płci.
- Dodano słownik 1 101 zdrobnień i form potocznych oraz ostrożną automatyczną klasyfikację na podstawie jednoznacznych zdrobnień, gdy spełnione są wymagane warunki kontekstowe.
- Dodano szybkie ręczne przypisywanie płci uczestnika w sekcji weryfikacji.

### Zmiany i usprawnienia

- Rozbudowano szczegóły wyników o statystyki nazwisk, rolę członów i pełne odpowiedniki zdrobnień.
- Rozszerzono uwagi informacyjne o rzadkości imion, kolizjach, zdrobnieniach i możliwej pisowni z polskimi znakami.
- Zaktualizowano interfejs, przykładowe dane i stronę pomocy.
- Dodano skrypt do budowania słownika nazwisk i zaktualizowano generator słownika imion.
- Rozszerzono zestaw testów automatycznych algorytmu do 265 przypadków.

### Bez zmian

- Dane uczestników są przetwarzane wyłącznie lokalnie w przeglądarce.
- Zachowano próg jednoznaczności imion 99,90%, obsługę PESEL, dat urodzenia i statystyk wiekowych.
- Projekt pozostaje dostępny na licencji MIT.

## v1.1

### Nowe funkcje

- Rozpoznawanie i walidacja dat urodzenia zapisanych w różnych formatach.
- Ustalanie wieku uczestnika na wybraną datę wydarzenia, na podstawie wpisanej daty urodzenia lub daty z numeru PESEL, który przeszedł walidację.
- Sprawdzanie zgodności wpisanej daty urodzenia z datą zakodowaną w PESEL oraz wykrywanie sprzecznych dat.
- Statystyki wiekowe dla domyślnych progów turystycznych (10, 12, 14, 16, 18, 25 i 60 lat) lub własnych progów. Osoby o nieustalonym wieku są liczone osobno.
- Szczegółowe statystyki rozpoznanych imion: liczebności, udziały procentowe i informacja o osiągnięciu progu jednoznaczności.
- Uwagi informacyjne z trzema poziomami ważności: niskim, średnim i wysokim, oddzielone od wpisów wymagających ręcznej weryfikacji.

### Zmiany i usprawnienia

- Obniżono próg jednoznaczności imienia z 99,98% do 99,90%. Imiona w przedziale od 99,90% do poniżej 99,98% otrzymują dodatkową uwagę informacyjną.
- Udoskonalono klasyfikację na podstawie wielu imion oraz rozstrzyganie zgodnych i sprzecznych wskazań imion i numerów PESEL.
- Rozszerzono informacje o walidacji numerów PESEL, w tym o błędach formatu, daty i cyfry kontrolnej.
- Rozbudowano interfejs o ustawienia daty wydarzenia, statystyki wiekowe, szczegóły wyników i filtrowanie wpisów wymagających sprawdzenia.
- Zaktualizowano stronę pomocy i przykładowe dane.
- Rozszerzono zestaw testów automatycznych algorytmu do 136 przypadków.

### Bez zmian

- Dane uczestników są przetwarzane lokalnie w przeglądarce.
- Aplikacja nie wymaga backendu ani bazy danych i nie zawiera skryptów analitycznych.
- Projekt pozostaje dostępny na licencji MIT.

## v1.0

- Pierwsze publiczne wydanie aplikacji: klasyfikacja uczestników na podstawie imion i opcjonalnych numerów PESEL, podsumowanie wyników oraz ręczna weryfikacja.
