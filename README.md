# Klasyfikator uczestników

Prosta aplikacja wspomagająca organizatorów wydarzeń w ustalaniu liczby kobiet i mężczyzn na podstawie list uczestników zawierających imiona, nazwiska oraz opcjonalnie numery PESEL.

Projekt powstał z myślą o listach, których dane nie zawsze mają jednolity format i mogą zawierać błędy.

## Jak działa?

- Klasyfikuje uczestników na podstawie rozpoznanych imion oraz numerów PESEL, jeśli zostały podane.
- Dzieli uczestników na trzy kategorie: kobiety, mężczyźni oraz osoby do weryfikacji.
- Umożliwia ręczne rozstrzygnięcie niejednoznacznych przypadków.

Priorytetem jest ograniczenie błędnej automatycznej klasyfikacji, a nie przypisanie każdej osoby do określonej kategorii za wszelką cenę.

Aplikacja została napisana w HTML, CSS i JavaScript. Wszystkie dane uczestników są przetwarzane lokalnie w przeglądarce, bez przesyłania ich na serwer.

## Źródło danych

Słownik imion opiera się na [oficjalnych danych Ministerstwa Cyfryzacji](https://dane.gov.pl/pl/dataset/1667) dotyczących pierwszych imion osób żyjących, według stanu na 20.01.2026 r.

Uwzględnia imiona odnotowane łącznie co najmniej 100 razy. Próg automatycznej klasyfikacji na podstawie imienia wynosi 99,98% opublikowanych wystąpień dla jednej płci.

Repozytorium zawiera również dane źródłowe oraz skrypt pozwalający samodzielnie odtworzyć i aktualizować słownik imion.

Szczegółowe zasady działania i ograniczenia algorytmu opisano w sekcji [Jak działa klasyfikacja uczestników?](https://incoone.github.io/klasyfikator-uczestnikow/pomoc.html).

## Licencja

Kod projektu jest dostępny na licencji [MIT](LICENSE), umożliwiającej swobodne korzystanie, modyfikowanie i rozpowszechnianie.

Dane źródłowe podlegają warunkom udostępniania określonym przez ich wydawcę.
