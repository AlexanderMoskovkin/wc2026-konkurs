# -*- coding: utf-8 -*-
"""Тесты подсчёта очков. Запуск: python test_scoring.py"""
import importlib.util
import os

# имя site.py совпадает со стандартным модулем Python — грузим по пути
_spec = importlib.util.spec_from_file_location(
    "wc_site", os.path.join(os.path.dirname(os.path.abspath(__file__)), "site.py")
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
score_points, parse_score = _mod.score_points, _mod.parse_score


CASES = [
    # (прогноз, счёт, ожидаемые очки)
    ("2:0", "2:0", 5),   # точный счёт
    ("2:1", "3:2", 3),   # верная разница
    ("1:1", "2:2", 3),   # угадал ничью
    ("2:1", "2:0", 3),   # исход 2 + бонус 1
    ("1:1", "1:0", 1),   # исход мимо, но голы хозяев угаданы
    ("1:0", "0:1", 0),   # всё мимо
    ("0:3", "2:0", 0),   # всё мимо
    ("5:0", "2:1", 2),   # только исход
    ("0:0", "1:1", 3),   # ничья, но не точная
    ("3:1", "3:1", 5),   # точный счёт
    ("0:2", "1:3", 3),   # верная разница (гости)
    ("0:1", "0:3", 3),   # исход 2 + бонус 1 (0 голов хозяев угадан)
    (None, "2:0", None), # нет прогноза — не считается
]


def run():
    failed = 0
    for pred_s, actual_s, expected in CASES:
        pred = parse_score(pred_s)
        actual = parse_score(actual_s)
        got = score_points(pred, actual)
        status = "ok " if got == expected else "FAIL"
        if got != expected:
            failed += 1
        print(f"[{status}] прогноз {pred_s or '—'} счёт {actual_s} -> {got} (ожидалось {expected})")
    if failed:
        raise SystemExit(f"ПРОВАЛЕНО ТЕСТОВ: {failed}")
    print(f"Все {len(CASES)} тестов пройдены.")


if __name__ == "__main__":
    run()
