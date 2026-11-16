# Historia zmian

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
