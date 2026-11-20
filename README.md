# Klasyfikator uczestników

Aplikacja wspomagająca organizatorów wydarzeń w ustalaniu liczby kobiet i mężczyzn oraz wieku uczestników na podstawie list zawierających imiona, nazwiska, opcjonalne daty urodzenia i numery PESEL.

Projekt powstał z myślą o listach, których dane nie zawsze mają jednolity format i mogą zawierać błędy.

**[Uruchom aplikację](https://incoone.github.io/klasyfikator-uczestnikow/)**

## Jak działa?

- Klasyfikuje uczestników na podstawie rozpoznanych imion i numerów PESEL, jeśli zostały podane. W określonych przypadkach wykorzystuje także statystyki nazwisk i jednoznaczne zdrobnienia.
- Rozpoznaje człony występujące zarówno jako imiona, jak i nazwiska, i analizuje ich rolę na podstawie kontekstu oraz statystyk, bez zakładania kolejności danych. W przypadku dokładnie dwóch członów stosuje dodatkowe reguły rozstrzygania ich ról.
- Rozpoznaje zdrobnienia także w określonych przypadkach kolizji z nazwiskami lub zapisu bez polskich znaków. Nie zmienia oryginalnych danych uczestnika i kieruje sprzeczne wskazania do weryfikacji zgodnie z regułami algorytmu.
- Dzieli uczestników na trzy kategorie: kobiety, mężczyźni oraz osoby do weryfikacji. Umożliwia szybkie ręczne przypisanie płci i edycję danych uczestnika.
- Rozpoznaje i sprawdza daty urodzenia w różnych formatach oraz weryfikuje ich zgodność z datami zakodowanymi w numerach PESEL.
- Oblicza wiek na wybrany dzień wydarzenia, niezależnie od klasyfikacji płci.
- Przedstawia statystyki według typowych dla branży turystycznej lub samodzielnie zdefiniowanych progów wiekowych.
- Wyświetla liczebności i udziały procentowe rozpoznanych imion i nazwisk w danych rejestru PESEL oraz możliwe pełne odpowiedniki zdrobnień.
- Wskazuje wpisy wymagające weryfikacji oraz prezentuje dodatkowe uwagi informacyjne z trzema poziomami ważności.

Priorytetem jest ograniczenie błędnej automatycznej klasyfikacji, a nie przypisanie każdej osoby do określonej kategorii za wszelką cenę. Statystyki imion nie potwierdzają płci konkretnej osoby, a walidacja PESEL nie potwierdza, że numer został jej nadany.

## Prywatność

Aplikacja została napisana w HTML, CSS i JavaScript. Nie wymaga konta, backendu ani bazy danych. Wszystkie dane uczestników są przetwarzane lokalnie w przeglądarce, bez przesyłania ich na serwer i bez zapisywania ich przez aplikację w trwałej pamięci przeglądarki. Aplikacja nie zawiera skryptów analitycznych.

## Źródła danych

Słowniki imion i nazwisk opierają się na oficjalnych danych Ministerstwa Cyfryzacji dotyczących osób żyjących, według stanu na 20.01.2026 r.:

- [Imiona występujące w rejestrze PESEL](https://dane.gov.pl/pl/dataset/1667) - 8 136 imion.
- [Nazwiska występujące w rejestrze PESEL](https://dane.gov.pl/pl/dataset/1681) - 117 159 nazwisk.
- Redakcyjnie opracowany słownik zdrobnień i form potocznych - 1 101 pozycji. Nie jest to urzędowy wykaz statystyczny.

Słowniki imion i nazwisk uwzględniają pozycje odnotowane łącznie co najmniej 30 razy. Próg jednoznaczności imienia wynosi 99,90% opublikowanych wystąpień dla jednej płci. W przedziale od 99,90% do poniżej 99,98% aplikacja dodatkowo wyświetla uwagę informacyjną. Procenty opisują dane źródłowe, a nie gwarantowaną skuteczność klasyfikacji. Samo nazwisko nie wystarcza do ustalenia płci.

Repozytorium zawiera również dane źródłowe oraz skrypty pozwalające samodzielnie odtworzyć i aktualizować słowniki imion i nazwisk.

Szczegółowe zasady działania i ograniczenia algorytmu opisano w sekcji [Jak działa klasyfikacja uczestników?](https://incoone.github.io/klasyfikator-uczestnikow/pomoc.html).

## Historia zmian

Aktualna wersja: 1.2.2. Zobacz [historię zmian](CHANGELOG.md).

## Dokumentacja techniczna i testy

Logika aplikacji znajduje się w katalogu `core/`. Głównym punktem wejścia jest `core/klasyfikator.js`. Szczegóły integracji, publicznego API i kolejności ładowania modułów opisano w [dokumentacji API 1.2.2](API-1.2.2.md).

Zestaw obejmuje 448 testów automatycznych. Można je uruchomić w Node.js z katalogu głównego projektu:

```sh
node --test tests/*.test.js
```

## Licencja

Kod projektu jest dostępny na licencji [MIT](LICENSE), umożliwiającej swobodne korzystanie, modyfikowanie i rozpowszechnianie.

Dane źródłowe podlegają warunkom udostępniania określonym przez ich wydawcę.
