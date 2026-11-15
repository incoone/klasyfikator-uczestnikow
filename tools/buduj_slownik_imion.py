#!python3
# -*- coding: utf-8 -*-
# Autor: ChatGPT (model GPT-6), 2026 r.
# Skrypt może być publikowany razem z aplikacją w repozytorium GitHub.
r"""
Tworzy imiona.json z dwóch plików CSV Ministerstwa Cyfryzacji.

Źródło: https://dane.gov.pl/pl/dataset/1667 (pierwsze imiona osób żyjących).
Skrypt przygotowano na podstawie wykazów z 20.01.2026 r., ale nie zależy
od ich daty, liczby rekordów ani sum kontrolnych. Można używać nowszych lat,
jeżeli Ministerstwo zachowa tę samą strukturę kolumn:

    IMIĘ_PIERWSZE,PŁEĆ,LICZBA_WYSTĄPIEŃ
    ANNA,KOBIETA,1063756

Pliki muszą być CSV rozdzielonym przecinkami, w kodowaniu UTF-8.
Wykazy pierwszych imion kobiet i mężczyzn przekazujemy osobno.
Nie należy ich wcześniej filtrować, ponieważ liczymy sumy obu płci.

Uruchomienie z katalogu projektu (Windows, Python 3.8+):
    py tools\generuj_imiona.py

Bez argumentów skrypt sam znajdzie dwa CSV w folderze zrodla_imion/ obok tools/,
rozpozna płeć z kolumny PŁEĆ i zapisze imiona.json w katalogu projektu.
Można też podać ścieżki ręcznie:
    py tools\generuj_imiona.py "zrodla_imion\kobiety.csv" "zrodla_imion\mezczyzni.csv"

Przy ręcznym wskazywaniu plików domyślny wynik powstaje w bieżącym
katalogu terminala. Opcja -o pozwala wskazać inną lokalizację.
Pola daty i adresów konkretnych zasobów pozostają puste do ręcznej edycji.
"""

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import tempfile
import unicodedata
from pathlib import Path


MINIMUM = 100
HEADER = ("IMIĘ_PIERWSZE", "PŁEĆ", "LICZBA_WYSTĄPIEŃ")
EXPECTED_GENDER = {"kobiety": "KOBIETA", "mezczyzni": "MĘŻCZYZNA"}
SAMPLE_NAMES = ("ANNA", "MARIA", "MARTA", "PIOTR", "JAN", "NUR", "KIM", "AALIYAH", "AARON")

# Polski porządek liter. Dodajemy Q, V i X ze względu na imiona obcego pochodzenia.
ALPHABET = "AĄBCĆDEĘFGHIJKLŁMNŃOÓPQRSŚTUVWXYZŹŻ"
LETTER_POS = {letter: position for position, letter in enumerate(ALPHABET)}


class InputError(Exception):
    """Błąd, którego przyczynę można pokazać bezpośrednio użytkownikowi."""


def alphabetical_key(name):
    """Ustala polski porządek liter (A, Ą, B...), nie zmieniając pisowni imion."""
    result = []
    for char in name.upper():
        if char in LETTER_POS:
            result.append((LETTER_POS[char], 0, char))
            continue
        simple = "".join(
            c for c in unicodedata.normalize("NFKD", char)
            if not unicodedata.combining(c)
        )
        if len(simple) == 1 and simple in LETTER_POS:
            result.append((LETTER_POS[simple], 1, char))
        else:
            result.append((len(ALPHABET), ord(char), char))
    return (tuple(result), name)


def calculate_sha256(path):
    """Oblicza 'odcisk palca' CSV; nie porównuje go z żadnym rocznikiem."""
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_csv(path, role):
    """Czyta CSV, sprawdzając kolejno nagłówek, każdy wiersz i zakres liczb.

    Brak imion z liczbą wystąpień <=100 traktujemy jako błąd: takie dane
    mogły zostać wstępnie odfiltrowane osobno dla każdej płci, co zaburza
    późniejsze wyliczanie proporcji. Zmiana kolejności rekordów to tylko
    ostrzeżenie, ponieważ w przyszłości sposób sortowania może się zmienić.
    Samo występowanie małych liczb nie dowodzi jednak pełnej kompletności CSV.
    """
    if not path.is_file():
        raise InputError(f"Nie znaleziono pliku {role}: {path}")

    names = {}
    normalized_names = set()
    count = 0
    has_small_numbers = False
    order_violations = 0
    previous_number = None
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.reader(stream, delimiter=",", strict=True)
            try:
                header = next(reader)
            except StopIteration:
                raise InputError(f"{path.name}: plik jest pusty.") from None
            if tuple(header) != HEADER:
                raise InputError(
                    f"{path.name}: nieprawidłowy nagłówek CSV. "
                    f"Oczekiwano: {', '.join(HEADER)}. "
                    "Sprawdź, czy pobrano wykaz pierwszych imion w formacie CSV."
                )

            for record in reader:
                line = reader.line_num
                if len(record) != 3:
                    raise InputError(
                        f"{path.name}, wiersz {line}: wymagane 3 pola, otrzymano {len(record)}."
                    )
                name, gender, number = record
                if not name or name != name.strip() or any(ord(c) < 32 for c in name):
                    raise InputError(f"{path.name}, wiersz {line}: puste lub nieprawidłowe imię.")
                if gender != EXPECTED_GENDER[role]:
                    raise InputError(
                        f"{path.name}, wiersz {line}: nieprawidłowa płeć dla {name}: {gender!r}."
                    )
                if re.fullmatch(r"[0-9]+", number) is None:
                    raise InputError(
                        f"{path.name}, wiersz {line}: nieprawidłowa liczba dla {name}: {number!r}."
                    )
                if len(number) > 12:
                    raise InputError(
                        f"{path.name}, wiersz {line}: zbyt duża liczba dla {name}."
                    )
                occurrences = int(number)
                if occurrences < 1:
                    raise InputError(
                        f"{path.name}, wiersz {line}: liczba wystąpień musi być dodatnia ({name})."
                    )
                key = unicodedata.normalize("NFC", name).upper()
                if name in names or key in normalized_names:
                    raise InputError(f"{path.name}, wiersz {line}: duplikat imienia {name!r}.")
                names[name] = occurrences
                normalized_names.add(key)
                if occurrences <= MINIMUM:
                    has_small_numbers = True
                if previous_number is not None and occurrences > previous_number:
                    order_violations += 1
                previous_number = occurrences
                count += 1
    except (UnicodeError, csv.Error) as exc:
        raise InputError(f"{path.name}: uszkodzony CSV lub złe kodowanie UTF-8: {exc}") from exc
    except OSError as exc:
        raise InputError(f"Nie można odczytać {path}: {exc}") from exc

    if not has_small_numbers:
        raise InputError(
            f"{path.name}: brak imion o liczbie wystąpień mniejszej lub równej {MINIMUM}. "
            "Możliwe, że CSV wstępnie odfiltrowano. Pobierz pełny wykaz - "
            "bez niego proporcje płci mogą być błędne. JSON nie został zapisany."
        )

    try:
        digest = calculate_sha256(path)
    except OSError as exc:
        raise InputError(f"Nie można obliczyć SHA-256 dla {path}: {exc}") from exc
    return names, {
        "records": count,
        "sha256": digest,
        "order_violations": order_violations,
    }


def generate(female, male, female_sha256, male_sha256):
    """Łączy wystąpienia obu płci, a próg 100 stosuje dopiero do ich sumy."""
    combined = {name: [count, 0] for name, count in female.items()}
    for name, count in male.items():
        combined.setdefault(name, [0, 0])[1] = count

    filtered = {
        name: combined[name]
        for name in sorted(combined, key=alphabetical_key)
        if sum(combined[name]) >= MINIMUM
    }
    payload = {
        "meta": {
            "zrodlo": "Ministerstwo Cyfryzacji - dane.gov.pl, zbior 1667 (osoby zyjace)",
            "stan_na": "",
            "minimum_wystapien": MINIMUM,
            "kolejnosc_liczb": ["kobiety", "mezczyzni"],
            "zasoby": {"kobiety": "", "mezczyzni": ""},
            "sha256": {"kobiety": female_sha256, "mezczyzni": male_sha256},
            "uwaga": (
                "0 oznacza brak opublikowanego wpisu, niekoniecznie brak osób. "
                "Wykazy z 2026 roku pomijały pojedyncze wystąpienia."
            ),
        },
        "imiona": filtered,
    }
    return payload, combined


def validate_payload(payload, combined):
    """Porównuje wynik z połączonymi CSV i upewnia się, że filtr nic nie zgubił."""
    items = payload["imiona"]
    expected = {
        name: pair for name, pair in combined.items() if sum(pair) >= MINIMUM
    }
    if items != expected:
        raise InputError("Kontrola JSON nie powiodła się: niezgodność danych ze źródłami.")
    if list(items) != sorted(items, key=alphabetical_key):
        raise InputError("Kontrola JSON nie powiodła się: błędna kolejność imion.")
    if any(
        not isinstance(pair, list)
        or len(pair) != 2
        or not all(isinstance(value, int) and value >= 0 for value in pair)
        or sum(pair) < MINIMUM
        for pair in items.values()
    ):
        raise InputError("Kontrola JSON nie powiodła się: błędne liczby lub próg wystąpień.")


def save_validated_json(output, payload, combined, source_paths):
    """Zapisuje bezpiecznie: dopiero po kontroli zastępuje istniejący plik.

    Jeśli wystąpi błąd, stary imiona.json nie zostaje nadpisany częściowym
    wynikiem. Plik tymczasowy powstaje w tym samym katalogu co wynik.
    """
    for source in source_paths:
        if output.resolve() == source.resolve():
            raise InputError("Ścieżka wynikowa jest taka sama jak wejściowy CSV.")
    if not output.parent.is_dir():
        raise InputError(f"Katalog wynikowy nie istnieje: {output.parent}")
    validate_payload(payload, combined)
    content = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", dir=output.parent, prefix=".imiona-", suffix=".tmp", delete=False
        ) as stream:
            temporary_path = Path(stream.name)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())

        with temporary_path.open("r", encoding="utf-8") as stream:
            check = json.load(stream)
        if check != payload:
            raise InputError("Kontrola po zapisie nie powiodła się: różne dane JSON.")
        validate_payload(check, combined)
        os.replace(temporary_path, output)
        temporary_path = None
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise InputError(f"Nie można zapisać lub sprawdzić JSON: {exc}") from exc
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
    return len(content)


def prompted_path(value, question):
    """Przyjmuje ścieżkę z terminala albo pyta o nią, gdy brak argumentu."""
    if value:
        return Path(value)
    if not sys.stdin.isatty():
        raise InputError("Podaj obie ścieżki CSV jako argumenty (zobacz --help).")
    try:
        entered = input(question).strip()
    except EOFError:
        raise InputError("Nie podano ścieżki do pliku CSV.") from None
    if len(entered) >= 2 and entered[0] == entered[-1] and entered[0] in "\"'":
        entered = entered[1:-1]
    if not entered:
        raise InputError("Nie podano ścieżki do pliku CSV.")
    return Path(entered)


def detect_csv_role(path):
    """Rozpoznaje płeć po pierwszym rekordzie, nie po nazwie pliku.

    To tylko wstępne rozpoznanie. Funkcja read_csv sprawdzi później
    wszystkie pozostałe rekordy i upewni się, że mają właściwą płeć.
    """
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.reader(stream, delimiter=",", strict=True)
            header = next(reader, None)
            first = next(reader, None)
    except (OSError, UnicodeError, csv.Error) as exc:
        raise InputError(f"Nie można rozpoznać pliku {path.name}: {exc}") from exc
    if tuple(header or ()) != HEADER or not first or len(first) != 3:
        raise InputError(f"{path.name}: nie można rozpoznać struktury CSV.")
    for role, expected in EXPECTED_GENDER.items():
        if first[1] == expected:
            return role
    raise InputError(f"{path.name}: nieznana wartość w kolumnie PŁEĆ: {first[1]!r}.")


def find_csv_in_source_directory():
    """Szuka dwóch CSV w zrodla_imion/ względem skryptu, niezależnie od terminala.

    Skrypt może leżeć w katalogu tools/ lub bezpośrednio w katalogu projektu.
    Gdy plików jest więcej niż dwa, nie zgadujemy, który rocznik wybrać.
    """
    script_dir = Path(__file__).resolve().parent
    project_dir = script_dir.parent if script_dir.name.lower() == "tools" else script_dir
    data_dir = project_dir / "zrodla_imion"
    if not data_dir.is_dir():
        return None

    files = sorted(
        path for path in data_dir.iterdir()
        if path.is_file() and path.suffix.lower() == ".csv"
    )
    if len(files) != 2:
        raise InputError(
            f"W katalogu {data_dir} znaleziono {len(files)} plików CSV. "
            "Powinny być dokładnie dwa (żeńskie i męskie). "
            "Przy większej liczbie plików podaj ich ścieżki ręcznie."
        )

    paths = {}
    for path in files:
        role = detect_csv_role(path)
        if role in paths:
            raise InputError(
                f"W katalogu {data_dir} są dwa wykazy tej samej płci. "
                "Potrzebny jest jeden żeński i jeden męski."
            )
        paths[role] = path
    if set(paths) != set(EXPECTED_GENDER):
        raise InputError("Nie znaleziono obu wykazów: żeńskiego i męskiego.")
    return paths, project_dir


def print_report(output_path, female, male, female_info, male_info, combined, payload, size):
    """Pokazuje podsumowanie, ostrzeżenia i przykładowe rekordy do sprawdzenia."""
    print(f"Gotowe: {output_path.resolve()}")
    print(f"CSV kobiet: {female_info['records']:,} rekordów")
    print(f"CSV mężczyzn: {male_info['records']:,} rekordów")
    print(f"SHA-256 kobiet: {female_info['sha256']}")
    print(f"SHA-256 mężczyzn: {male_info['sha256']}")
    print(f"Unikalnych imion przed filtrowaniem: {len(combined):,}")
    print(f"Imion po filtrowaniu (suma >= {MINIMUM}): {len(payload['imiona']):,}")
    print(f"Imion w obu wykazach przed filtrowaniem: {len(female.keys() & male.keys()):,}")
    print(
        "Imion w obu wykazach po filtrowaniu: "
        f"{sum(1 for women, men in payload['imiona'].values() if women and men):,}"
    )
    print(f"Rozmiar JSON: {size:,} bajtów ({size / 1024:.1f} KiB)")
    print("Kontrola poprawności: OK (CSV, liczby, duplikaty, próg, zgodność JSON)")

    for role, info in (("kobiet", female_info), ("mężczyzn", male_info)):
        if info["order_violations"]:
            print(
                f"OSTRZEŻENIE: CSV {role} ma {info['order_violations']} miejsc, "
                "w których liczba wystąpień rośnie. Zapis jest poprawny, "
                "ale kolejność różni się od wykazów z 2026 roku."
            )

    print("\nPrzykładowe imiona (K=kobiety, M=mężczyźni):")
    for name in SAMPLE_NAMES:
        pair = payload["imiona"].get(name)
        if pair is None:
            raw = combined.get(name)
            note = f"poniżej progu: {raw}" if raw else "brak w obu źródłach"
            print(f"  {name}: brak w JSON ({note})")
        else:
            print(f"  {name}: K={pair[0]}, M={pair[1]}, razem={sum(pair)}")
    print(
        "\nPrzed publikacją uzupełnij ręcznie w JSON: "
        "meta.stan_na oraz meta.zasoby.kobiety i meta.zasoby.mezczyzni."
    )


def main(argv=None):
    """Łączy wszystkie etapy: argumenty, odczyt, generowanie, zapis i raport."""
    parser = argparse.ArgumentParser(
        description="Pierwsze imiona PESEL (zbiór 1667, różne roczniki) -> imiona.json"
    )
    parser.add_argument("kobiety", nargs="?", help="CSV pierwszych imion kobiet")
    parser.add_argument("mezczyzni", nargs="?", help="CSV pierwszych imion mężczyzn")
    parser.add_argument(
        "-o", "--output", default=None,
        help="Ścieżka wynikowa (domyślnie imiona.json w katalogu projektu)",
    )
    args = parser.parse_args(argv)

    automatic = find_csv_in_source_directory() if not args.kobiety and not args.mezczyzni else None
    if automatic is not None:
        paths, project_dir = automatic
        female_path, male_path = paths["kobiety"], paths["mezczyzni"]
        output_path = Path(args.output) if args.output else project_dir / "imiona.json"
        print(f"Automatycznie znaleziono CSV w: {project_dir / 'zrodla_imion'}")
        print(f"  Kobiety: {female_path.name}")
        print(f"  Mężczyźni: {male_path.name}")
    else:
        female_path = prompted_path(args.kobiety, "Ścieżka do CSV kobiet: ")
        male_path = prompted_path(args.mezczyzni, "Ścieżka do CSV mężczyzn: ")
        output_path = Path(args.output or "imiona.json")

    if female_path.resolve() == male_path.resolve():
        raise InputError("Wskazano ten sam plik dla kobiet i mężczyzn.")

    female, female_info = read_csv(female_path, "kobiety")
    male, male_info = read_csv(male_path, "mezczyzni")
    payload, combined = generate(
        female, male, female_info["sha256"], male_info["sha256"]
    )
    size = save_validated_json(
        output_path, payload, combined, (female_path, male_path)
    )
    print_report(output_path, female, male, female_info, male_info, combined, payload, size)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (InputError, KeyboardInterrupt) as error:
        print(f"BŁĄD: {error or 'Przerwano przez użytkownika.'}", file=sys.stderr)
        sys.exit(1)
