#!python3
# -*- coding: utf-8 -*-
"""Buduje nazwiska.json z wykazów nazwisk osób żyjących (rejestr PESEL).

Źródło: https://dane.gov.pl/pl/dataset/1681
Nagłówek CSV: Nazwisko aktualne,Liczba

Przykład (Windows, Python 3.8+):
    py buduj_slownik_nazwisk.py --kobiety kobiety.csv --mezczyzni mezczyzni.csv
    py buduj_slownik_nazwisk.py --kobiety kobiety.csv --mezczyzni mezczyzni.csv --prog 50

Pliki CSV muszą być pełnymi wykazami, a nie listami przefiltrowanymi według
płci. Domyślny próg to 30 wystąpień łącznie. Wynik: [kobiety, mezczyzni].
Zero oznacza brak opublikowanego wpisu, niekoniecznie brak osób.
"""

import argparse
import csv
import hashlib
import json
import os
import re
import tempfile
import unicodedata
from pathlib import Path

MINIMUM = 30
THRESHOLDS = (10, 20, 30, 50, 100)


def normalize(name):
    return unicodedata.normalize("NFC", name.strip().upper())


def load_csv(path):
    data = {}
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.reader(stream, strict=True)
        if next(reader, None) != ["Nazwisko aktualne", "Liczba"]:
            raise ValueError(f"{path.name}: nieprawidłowy nagłówek CSV.")
        for row in reader:
            if len(row) != 2:
                raise ValueError(f"{path.name}:{reader.line_num}: oczekiwano 2 kolumn.")
            name, number = row
            key = normalize(name)
            if not key or any(ord(c) < 32 for c in key):
                raise ValueError(f"{path.name}:{reader.line_num}: nieprawidłowe nazwisko.")
            if key in data:
                raise ValueError(f"{path.name}:{reader.line_num}: duplikat {key!r}.")
            if not re.fullmatch(r"[0-9]+", number) or int(number) < 1:
                raise ValueError(f"{path.name}:{reader.line_num}: błędna liczba wystąpień.")
            data[key] = int(number)
    if not data or min(data.values()) > 2:
        raise ValueError(f"{path.name}: brak rzadkich nazwisk (1-2 wystąpienia). Podaj pełny wykaz.")
    return data


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def serialize(meta, records):
    return json.dumps({"meta": meta, "nazwiska": records},
                      ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kobiety", required=True, type=Path, help="CSV nazwisk kobiet")
    parser.add_argument("--mezczyzni", required=True, type=Path, help="CSV nazwisk mężczyzn")
    parser.add_argument("--prog", "--minimum", type=int, default=MINIMUM)
    parser.add_argument("-o", "--output", type=Path, default=Path("nazwiska.json"))
    parser.add_argument("--stan-na", default="", help="Data danych, np. 2026-01-20")
    parser.add_argument("--imiona", type=Path, help="Opcjonalne imiona.json do analizy kolizji")
    args = parser.parse_args()
    if args.prog < 1:
        parser.error("Próg musi być liczbą dodatnią.")
    if args.kobiety.resolve() == args.mezczyzni.resolve():
        parser.error("Podaj dwa różne pliki źródłowe.")
    if args.output.resolve() in {args.kobiety.resolve(), args.mezczyzni.resolve()} or (
            args.imiona and args.output.resolve() == args.imiona.resolve()):
        parser.error("Plik wyjściowy nie może nadpisać pliku wejściowego.")
    try:
        women = load_csv(args.kobiety)
        men = load_csv(args.mezczyzni)
        hashes = {"kobiety": sha256(args.kobiety), "mezczyzni": sha256(args.mezczyzni)}
        if hashes["kobiety"] == hashes["mezczyzni"]:
            raise ValueError("Identyczna zawartość obu plików źródłowych.")
        all_names = sorted(women.keys() | men.keys())
        data = {n: [women.get(n, 0), men.get(n, 0)] for n in all_names}
        total = sum(women.values()) + sum(men.values())
        assert sum(map(sum, data.values())) == total
        meta = {
            "zrodlo": "Ministerstwo Cyfryzacji - dane.gov.pl, zbior 1681 (osoby zyjace)",
            "stan_na": args.stan_na,
            "minimum_wystapien": args.prog,
            "kolejnosc_liczb": ["kobiety", "mezczyzni"],
            "zasoby": {"kobiety": args.kobiety.name, "mezczyzni": args.mezczyzni.name},
            "sha256": hashes,
            "uwaga": "0 oznacza brak opublikowanego wpisu, niekoniecznie brak osób. "
                     "Wykazy mogą pomijać pojedyncze wystąpienia."
        }
        given = None
        if args.imiona:
            with args.imiona.open(encoding="utf-8") as stream:
                given = json.load(stream)["imiona"]
            given = {normalize(n) for n in given}
        print(f"Źródło: {len(data):,} nazwisk, {total:,} opublikowanych wystąpień.")
        print("Próg | Nazwiska | Wystąpienia | Pokrycie | KiB | Kolizje z imionami")
        for threshold in sorted(set(THRESHOLDS) | {args.prog}):
            records = {n: v for n, v in data.items() if sum(v) >= threshold}
            count = sum(map(sum, records.values()))
            comparison_meta = dict(meta, minimum_wystapien=threshold)
            size = len(serialize(comparison_meta, records)) / 1024
            collisions = len(records.keys() & given) if given is not None else "-"
            print(f"{threshold:4} | {len(records):8,} | {count:12,} | "
                  f"{100*count/total:7.3f}% | {size:8.1f} | {collisions}")
        selected = {n: v for n, v in data.items() if sum(v) >= args.prog}
        if not selected:
            raise ValueError("Próg odrzuca wszystkie nazwiska.")
        result = serialize(meta, selected)
        output = args.output.resolve()
        # Zapis atomowy, po ponownym odczycie i sprawdzeniu całej struktury.
        tmp = None
        try:
            with tempfile.NamedTemporaryFile(dir=output.parent, delete=False) as stream:
                tmp = Path(stream.name)
                stream.write(result)
            with tmp.open(encoding="utf-8") as stream:
                checked = json.load(stream)
            if checked != {"meta": meta, "nazwiska": selected}:
                raise ValueError("Weryfikacja zapisanego JSON nie powiodła się.")
            os.replace(tmp, output)
        finally:
            if tmp is not None and tmp.exists():
                tmp.unlink()
        print(f"Zapisano {output} ({len(selected):,} nazwisk, {len(result):,} bajtów).")
    except (OSError, ValueError, KeyError, csv.Error) as exc:
        parser.exit(1, f"Błąd: {exc}\n")


if __name__ == "__main__":
    main()
