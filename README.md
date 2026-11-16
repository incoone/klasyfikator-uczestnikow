# Klasyfikator uczestników

Aplikacja wspomagająca organizatorów wydarzeń w ustalaniu liczby kobiet i mężczyzn oraz wieku uczestników na podstawie list zawierających imiona, nazwiska, opcjonalne daty urodzenia i numery PESEL.

Projekt powstał z myślą o listach, których dane nie zawsze mają jednolity format i mogą zawierać błędy.

**[Uruchom aplikację](https://incoone.github.io/klasyfikator-uczestnikow/)**

## Jak działa?

- Klasyfikuje uczestników na podstawie rozpoznanych imion i numerów PESEL, jeśli zostały podane.
- Dzieli uczestników na trzy kategorie: kobiety, mężczyźni oraz osoby do weryfikacji. Umożliwia ręczną zmianę klasyfikacji.
- Rozpoznaje i sprawdza daty urodzenia w różnych formatach oraz weryfikuje ich zgodność z datami zakodowanymi w numerach PESEL.
- Oblicza wiek na wybrany dzień wydarzenia, niezależnie od klasyfikacji płci.
- Przedstawia statystyki według typowych dla branży turystycznej lub samodzielnie zdefiniowanych progów wiekowych.
- Wyświetla liczebności i udziały procentowe rozpoznanych imion w danych rejestru PESEL.
- Wskazuje wpisy wymagające weryfikacji oraz prezentuje dodatkowe uwagi informacyjne z trzema poziomami ważności.

Priorytetem jest ograniczenie błędnej automatycznej klasyfikacji, a nie przypisanie każdej osoby do określonej kategorii za wszelką cenę. Statystyki imion nie potwierdzają płci konkretnej osoby, a walidacja PESEL nie potwierdza, że numer został jej nadany.

## Prywatność

Aplikacja została napisana w HTML, CSS i JavaScript. Nie wymaga konta, backendu ani bazy danych. Wszystkie dane uczestników są przetwarzane lokalnie w przeglądarce, bez przesyłania ich na serwer i bez zapisywania ich przez aplikację w trwałej pamięci przeglądarki. Aplikacja nie zawiera skryptów analitycznych.

## Źródło danych

Słownik imion opiera się na [oficjalnych danych Ministerstwa Cyfryzacji](https://dane.gov.pl/pl/dataset/1667) dotyczących pierwszych imion osób żyjących, według stanu na 20.01.2026 r.

Uwzględnia imiona odnotowane łącznie co najmniej 100 razy. Próg jednoznaczności imienia wynosi 99,90% opublikowanych wystąpień dla jednej płci. W przedziale od 99,90% do poniżej 99,98% aplikacja dodatkowo wyświetla uwagę informacyjną. Procenty opisują dane źródłowe, a nie gwarantowaną skuteczność klasyfikacji.

Repozytorium zawiera również dane źródłowe oraz skrypt pozwalający samodzielnie odtworzyć i aktualizować słownik imion.

Szczegółowe zasady działania i ograniczenia algorytmu opisano w sekcji [Jak działa klasyfikacja uczestników?](https://incoone.github.io/klasyfikator-uczestnikow/pomoc.html).

## Historia zmian

Aktualna wersja: 1.1. Zobacz [historię zmian](CHANGELOG.md).

## Licencja

Kod projektu jest dostępny na licencji [MIT](LICENSE), umożliwiającej swobodne korzystanie, modyfikowanie i rozpowszechnianie.

Dane źródłowe podlegają warunkom udostępniania określonym przez ich wydawcę.
