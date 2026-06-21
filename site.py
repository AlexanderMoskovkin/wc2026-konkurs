# -*- coding: utf-8 -*-
"""Генератор data.json для сайта семейного конкурса прогнозов ЧМ-2026.

Читает лист «Прогнозы» из WC2026_konkurs.xls (только чтение!) и, если есть,
reviews.json рядом с ним. Пишет data.json рядом с этим скриптом.

Зависимость: xlrd (pip install xlrd).
"""
import json
import os
import re
import sys
from datetime import datetime, date, timedelta, timezone

import xlrd

XLS_PATH = r"C:\Users\Alex\Claude\Scheduled\wc2026-family-contest-daily\WC2026_konkurs.xls"
SHEET = "Прогнозы"
PARTICIPANTS = ["Ваня", "Папа", "Алиса", "Бабушка", "Дед", "Оля", "Вова", "ИИ", "Серега"]
TOURS = [(1, "1-й тур", 1, 24), (2, "2-й тур", 25, 48), (3, "3-й тур", 49, 72)]
YEAR = 2026
DAY1 = date(2026, 6, 11)  # 11.06 = день 1
MSK = timezone(timedelta(hours=3))

SCORE_RE = re.compile(r"^\s*(\d+)\s*[:\-]\s*(\d+)\s*$")


def parse_score(value):
    """'2:1' -> (2, 1); пусто/мусор -> None."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    m = SCORE_RE.match(s)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def score_points(pred, actual):
    """Очки за матч. pred/actual — пары (голы1, голы2). Нет прогноза -> None.

    Точный счёт = 5. Иначе: верная разница (вкл. ничью) = 3, иначе верный
    исход = 2, иначе 0; плюс +1, если угадано точное число голов хотя бы
    одной из команд. Максимум без точного счёта = 4.
    """
    if pred is None or actual is None:
        return None
    ph, pa = pred
    ah, aa = actual
    if ph == ah and pa == aa:
        return 5
    if (ph - pa) == (ah - aa):
        base = 3
    elif (ph > pa) == (ah > aa) and (ph < pa) == (ah < aa):
        base = 2
    else:
        base = 0
    bonus = 1 if (ph == ah or pa == aa) else 0
    return base + bonus


def cell_str(sheet, r, c):
    v = sheet.cell_value(r, c)
    if isinstance(v, float):
        if v == int(v):
            return str(int(v))
        return str(v)
    return str(v).strip()


def load_reviews(xls_path):
    path = os.path.join(os.path.dirname(xls_path), "reviews.json")
    if not os.path.exists(path):
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (ValueError, OSError) as e:
        print(f"ПРЕДУПРЕЖДЕНИЕ: reviews.json не прочитан: {e}", file=sys.stderr)
        return {}


def read_matches(xls_path):
    wb = xlrd.open_workbook(xls_path)
    if SHEET not in wb.sheet_names():
        raise SystemExit(f"ОШИБКА: в {xls_path} нет листа «{SHEET}»")
    sh = wb.sheet_by_name(SHEET)
    header = [cell_str(sh, 0, c) for c in range(sh.ncols)]
    expected = ["№", "Дата", "Время МСК", "Этап", "Матч", "Счёт"] + PARTICIPANTS
    if header[: len(expected)] != expected:
        raise SystemExit(
            "ОШИБКА: заголовок листа «Прогнозы» не совпадает с ожидаемым.\n"
            f"  ожидалось: {expected}\n  в файле:   {header[:len(expected)]}"
        )
    reviews = load_reviews(xls_path)
    matches = []
    for r in range(1, sh.nrows):
        num = cell_str(sh, r, 0)
        match_txt = cell_str(sh, r, 4)
        if not num or not match_txt:
            continue
        d, t = cell_str(sh, r, 1), cell_str(sh, r, 2)
        try:
            dd, mm = d.split(".")
            hh, mi = t.split(":")
            kickoff = datetime(YEAR, int(mm), int(dd), int(hh), int(mi), tzinfo=MSK)
        except ValueError:
            print(f"ПРЕДУПРЕЖДЕНИЕ: матч №{num}: непонятные дата/время «{d}» «{t}», пропущен", file=sys.stderr)
            continue
        teams = [x.strip() for x in re.split(r"\s*—\s*", match_txt) if x.strip()]
        if len(teams) != 2:
            print(f"ПРЕДУПРЕЖДЕНИЕ: матч №{num}: не разобрано «{match_txt}», пропущен", file=sys.stderr)
            continue
        score_raw = cell_str(sh, r, 5)
        actual = parse_score(score_raw)
        if score_raw and actual is None:
            print(f"ПРЕДУПРЕЖДЕНИЕ: матч №{num}: непонятный счёт «{score_raw}», считаю несыгранным", file=sys.stderr)
        preds, points = {}, {}
        for i, name in enumerate(PARTICIPANTS):
            raw = cell_str(sh, r, 6 + i)
            p = parse_score(raw)
            if raw and p is None:
                print(f"ПРЕДУПРЕЖДЕНИЕ: матч №{num}, {name}: непонятный прогноз «{raw}», игнорирую", file=sys.stderr)
            preds[name] = f"{p[0]}:{p[1]}" if p else None
            if actual:
                points[name] = score_points(p, actual)
        m = {
            "num": int(float(num)),
            "date": d,
            "day": ((kickoff - timedelta(hours=9)).date() - DAY1).days + 1,
            "time": t,
            "kickoff": kickoff.isoformat(),
            "stage": cell_str(sh, r, 3),
            "team1": teams[0],
            "team2": teams[1],
            "score": f"{actual[0]}:{actual[1]}" if actual else None,
            "preds": preds,
        }
        if actual:
            m["points"] = points
        rv = reviews.get(str(m["num"])) or reviews.get(d, {}).get(str(m["num"]))
        if isinstance(rv, str):
            m["review"] = rv
        elif isinstance(rv, dict):
            if rv.get("review"):
                m["review"] = rv["review"]
            if rv.get("scorers"):
                m["scorers"] = rv["scorers"]
            if rv.get("preds_review"):
                m["preds_review"] = rv["preds_review"]
            if rv.get("highlights"):
                m["highlights"] = rv["highlights"]
        matches.append(m)
    matches.sort(key=lambda m: (m["kickoff"], m["num"]))
    return matches


def build_standings(matches, lo=None, hi=None):
    totals = {n: {"points": 0, "exact": 0} for n in PARTICIPANTS}
    for m in matches:
        if lo is not None and not (lo <= m["num"] <= hi):
            continue
        for n, p in m.get("points", {}).items():
            if p is None:
                continue
            totals[n]["points"] += p
            if p == 5:
                totals[n]["exact"] += 1
    rows = [{"name": n, **totals[n]} for n in PARTICIPANTS]
    rows.sort(key=lambda x: (-x["points"], -x["exact"], x["name"]))
    for i, row in enumerate(rows):
        row["place"] = i + 1
    return rows


def build_tours(matches):
    """Отдельный зачёт по каждому групповому туру с сыгранными матчами."""
    out = []
    for num, label, lo, hi in TOURS:
        played = sum(1 for m in matches if lo <= m["num"] <= hi and m.get("score"))
        if not played:
            continue
        out.append({
            "num": num,
            "label": label,
            "from": lo,
            "to": hi,
            "played": played,
            "total": hi - lo + 1,
            "standings": build_standings(matches, lo, hi),
        })
    return out


def main():
    xls = sys.argv[1] if len(sys.argv) > 1 else XLS_PATH
    if not os.path.exists(xls):
        raise SystemExit(f"ОШИБКА: не найден файл {xls}")
    matches = read_matches(xls)
    if not matches:
        raise SystemExit("ОШИБКА: в листе «Прогнозы» не разобрано ни одного матча")
    now = datetime.now(MSK)
    data = {
        "generated_at": now.isoformat(timespec="seconds"),
        "generated_at_text": now.strftime("%d.%m в %H:%M МСК"),
        "participants": PARTICIPANTS,
        "standings": build_standings(matches),
        "tours": build_tours(matches),
        "table_comment": load_reviews(xls).get("_table"),
        "matches": matches,
    }
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")
    if os.path.exists(out):
        try:
            with open(out, encoding="utf-8") as f:
                old = json.load(f)
            ignore = ("generated_at", "generated_at_text")
            if {k: v for k, v in old.items() if k not in ignore} == \
               {k: v for k, v in data.items() if k not in ignore}:
                print("OK: данные не изменились, data.json не переписан")
                return
        except (ValueError, OSError):
            pass  # старый файл битый — перепишем
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    played = sum(1 for m in matches if m["score"])
    print(f"OK: {len(matches)} matches, {played} played -> data.json")


if __name__ == "__main__":
    main()
