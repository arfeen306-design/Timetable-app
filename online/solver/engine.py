"""Timetable constraint solver using Google OR-Tools CP-SAT."""
from __future__ import annotations
from typing import TYPE_CHECKING, Union

from ortools.sat.python import cp_model

from models.domain import TimetableEntry

if TYPE_CHECKING:
    from database.connection import DatabaseConnection
    from core.data_provider import TimetableDataProvider

from database.data_provider_sqlite import SqliteDataProvider


class TimetableSolver:
    """Generates a clash-free timetable using CP-SAT constraint programming."""

    def __init__(self, data: Union[DatabaseConnection, TimetableDataProvider]) -> None:
        if hasattr(data, "fetchone"):
            self._provider: TimetableDataProvider = SqliteDataProvider(data)
        else:
            self._provider = data
        self.messages: list[str] = []

    def solve(self, time_limit_seconds: int = 30) -> tuple[bool, list[TimetableEntry], list[str]]:
        """
        Solve the timetable scheduling problem.
        Returns (success, entries, messages).
        """
        self.messages = []
        p = self._provider

        # Load data
        school = p.get_school()
        if not school:
            return False, [], ["No school settings found."]

        num_days = school["days_per_week"]
        num_periods_base = school["periods_per_day"]
        import json
        bell = {}
        try:
            raw = school["bell_schedule_json"]
            if raw:
                parsed = json.loads(raw) if isinstance(raw, str) else raw
                bell = parsed if isinstance(parsed, dict) else {}
        except (KeyError, TypeError, ValueError):
            pass
        zero_period = bool(bell.get("zero_period", False))
        num_periods = num_periods_base + (1 if zero_period else 0)
        total_slots = num_days * num_periods

        lessons = p.get_lessons()
        teachers = p.get_teachers()
        classes = p.get_classes()
        rooms = p.get_rooms()
        subjects = p.get_subjects()

        if not lessons:
            return False, [], ["No lessons to schedule."]

        # Build lookup maps
        teacher_map = {t["id"]: t for t in teachers}
        class_map = {c["id"]: c for c in classes}
        room_map = {r["id"]: r for r in rooms}
        subject_map = {s["id"]: s for s in subjects}

        # Load constraints
        constraints = p.get_constraints()
        teacher_unavailable: dict[int, set[tuple[int, int]]] = {}
        class_unavailable: dict[int, set[tuple[int, int]]] = {}
        room_unavailable: dict[int, set[tuple[int, int]]] = {}

        for c in constraints:
            if c["constraint_type"] == "unavailable" and c["is_hard"]:
                slot = (c["day_index"], c["period_index"])
                if c["entity_type"] == "teacher":
                    teacher_unavailable.setdefault(c["entity_id"], set()).add(slot)
                elif c["entity_type"] == "class":
                    class_unavailable.setdefault(c["entity_id"], set()).add(slot)
                elif c["entity_type"] == "room":
                    room_unavailable.setdefault(c["entity_id"], set()).add(slot)

        # Load locked entries
        locked_entries = p.get_locked_entries()
        locked_map: dict[int, list] = {}
        for le in locked_entries:
            locked_map.setdefault(le["lesson_id"], []).append(le)

        # Load allowed rooms per lesson
        allowed_rooms_data = p.get_lesson_allowed_rooms()
        lesson_allowed_rooms: dict[int, list[int]] = {}
        for ar in allowed_rooms_data:
            lesson_allowed_rooms.setdefault(ar["lesson_id"], []).append(ar["room_id"])

        # ---- Build CP-SAT Model ----
        model = cp_model.CpModel()

        # Expand lessons into individual occurrences
        occurrences = []  # list of (lesson_row, occurrence_index)
        for lesson in lessons:
            for occ in range(lesson["periods_per_week"]):
                occurrences.append((lesson, occ))

        num_occ = len(occurrences)
        room_ids = [r["id"] for r in rooms] if rooms else []
        num_rooms = len(room_ids)
        use_rooms = num_rooms > 0

        self.messages.append(f"Scheduling {num_occ} lesson occurrences into {total_slots} slots.")

        # Compute forbidden slots per occurrence (from unavailability)
        occ_forbidden_slots: list[set[int]] = []
        for i, (lesson, _) in enumerate(occurrences):
            forbidden = set()
            tid = lesson["teacher_id"]
            cid = lesson["class_id"]
            dur = lesson["duration"]
            for day, period in teacher_unavailable.get(tid, set()):
                for p_off in range(dur):
                    sp = period - p_off
                    if 0 <= sp <= num_periods - dur:
                        forbidden.add(day * num_periods + sp)
            for day, period in class_unavailable.get(cid, set()):
                for p_off in range(dur):
                    sp = period - p_off
                    if 0 <= sp <= num_periods - dur:
                        forbidden.add(day * num_periods + sp)
            occ_forbidden_slots.append(forbidden)

        # Decision variables: slot_var = day * num_periods + period
        slot_vars = []
        day_vars = []
        period_vars = []
        room_vars = []

        for i, (lesson, occ_idx) in enumerate(occurrences):
            lid = lesson["id"]
            duration = lesson["duration"]
            max_start_period = num_periods - duration

            # Build allowed slot domain
            all_slots = []
            for d in range(num_days):
                for p in range(max_start_period + 1):
                    s = d * num_periods + p
                    if s not in occ_forbidden_slots[i]:
                        all_slots.append(s)

            if not all_slots:
                all_slots = list(range(total_slots))

            slot_var = model.new_int_var_from_domain(
                cp_model.Domain.from_values(all_slots),
                f"slot_{lid}_{occ_idx}",
            )
            slot_vars.append(slot_var)

            # Derived day and period from slot
            day_var = model.new_int_var(0, num_days - 1, f"day_{lid}_{occ_idx}")
            period_var = model.new_int_var(0, max_start_period, f"period_{lid}_{occ_idx}")
            model.add_division_equality(day_var, slot_var, num_periods)
            model.add_modulo_equality(period_var, slot_var, num_periods)
            day_vars.append(day_var)
            period_vars.append(period_var)

            # Room variable
            if use_rooms:
                allowed = lesson_allowed_rooms.get(lid, [])
                if lesson["preferred_room_id"] and not allowed:
                    allowed = [lesson["preferred_room_id"]]
                if not allowed:
                    allowed = room_ids

                room_domain = [room_ids.index(rid) for rid in allowed if rid in room_ids]
                if not room_domain:
                    room_domain = list(range(num_rooms))

                room_var = model.new_int_var_from_domain(
                    cp_model.Domain.from_values(room_domain),
                    f"room_{lid}_{occ_idx}",
                )
            else:
                room_var = model.new_constant(0)
            room_vars.append(room_var)

        # ---- Hard Constraints ----

        # 1. Locked entries
        for i, (lesson, occ_idx) in enumerate(occurrences):
            lid = lesson["id"]
            if lid in locked_map and occ_idx < len(locked_map[lid]):
                locked = locked_map[lid][occ_idx]
                fixed_slot = locked["day_index"] * num_periods + locked["period_index"]
                model.add(slot_vars[i] == fixed_slot)
                if use_rooms and locked["room_id"] and locked["room_id"] in room_ids:
                    model.add(room_vars[i] == room_ids.index(locked["room_id"]))

        # Group occurrences by teacher and class
        teacher_occs: dict[int, list[int]] = {}
        class_occs: dict[int, list[int]] = {}
        for i, (lesson, _) in enumerate(occurrences):
            teacher_occs.setdefault(lesson["teacher_id"], []).append(i)
            class_occs.setdefault(lesson["class_id"], []).append(i)

        # 2. Teacher no double-booking: all occurrences of a teacher have different slots
        for tid, occ_indices in teacher_occs.items():
            if len(occ_indices) > 1:
                model.add_all_different([slot_vars[i] for i in occ_indices])

        # 3. Class no double-booking: all occurrences of a class have different slots
        for cid, occ_indices in class_occs.items():
            if len(occ_indices) > 1:
                model.add_all_different([slot_vars[i] for i in occ_indices])

        # 4. Room no double-booking (efficient per-room approach)
        if use_rooms:
            # For each room, the occurrences assigned to it must have different slots.
            # We use optional interval variables with NoOverlap.
            # Create a room_slot variable: room * total_slots + slot
            # Then all room_slot values must be different.
            room_slot_vars = []
            for i in range(num_occ):
                rs_var = model.new_int_var(
                    0, num_rooms * total_slots - 1, f"rs_{i}"
                )
                model.add(rs_var == room_vars[i] * total_slots + slot_vars[i])
                room_slot_vars.append(rs_var)
            model.add_all_different(room_slot_vars)

        # 5. Room unavailability
        if use_rooms:
            for rid_val, unavail in room_unavailable.items():
                if rid_val not in room_ids:
                    continue
                ridx = room_ids.index(rid_val)
                for i in range(num_occ):
                    dur = occurrences[i][0]["duration"]
                    for day, period in unavail:
                        for p_off in range(dur):
                            start_p = period - p_off
                            if 0 <= start_p <= num_periods - dur:
                                forbidden_slot = day * num_periods + start_p
                                # If assigned to this room, cannot use this slot
                                b_room = model.new_bool_var(
                                    f"runavail_{i}_{rid_val}_{day}_{start_p}"
                                )
                                model.add(room_vars[i] == ridx).only_enforce_if(b_room)
                                model.add(room_vars[i] != ridx).only_enforce_if(b_room.negated())
                                model.add(slot_vars[i] != forbidden_slot).only_enforce_if(b_room)

        # 6. Subject max per day per class
        for subj in subjects:
            sid = subj["id"]
            max_per_day_val = subj["max_per_day"]
            if max_per_day_val <= 0:
                continue

            subj_occs_by_class: dict[int, list[int]] = {}
            for i, (lesson, _) in enumerate(occurrences):
                if lesson["subject_id"] == sid:
                    subj_occs_by_class.setdefault(lesson["class_id"], []).append(i)

            for cid, occ_indices in subj_occs_by_class.items():
                if len(occ_indices) <= max_per_day_val:
                    continue
                for day in range(num_days):
                    day_bools = []
                    for idx in occ_indices:
                        b = model.new_bool_var(f"smd_{sid}_{cid}_{day}_{idx}")
                        model.add(day_vars[idx] == day).only_enforce_if(b)
                        model.add(day_vars[idx] != day).only_enforce_if(b.negated())
                        day_bools.append(b)
                    model.add(sum(day_bools) <= max_per_day_val)

        # 7. Teacher max periods per day
        for teacher in teachers:
            tid = teacher["id"]
            max_day_val = teacher["max_periods_day"]
            t_occs = teacher_occs.get(tid, [])
            if not t_occs or len(t_occs) <= max_day_val:
                continue
            for day in range(num_days):
                day_bools = []
                for idx in t_occs:
                    b = model.new_bool_var(f"tmd_{tid}_{day}_{idx}")
                    model.add(day_vars[idx] == day).only_enforce_if(b)
                    model.add(day_vars[idx] != day).only_enforce_if(b.negated())
                    day_bools.append(b)
                model.add(sum(day_bools) <= max_day_val)

        # 8. Same lesson's occurrences must be on different slots (already handled
        #    by class AllDifferent, but also enforce different days for spread)
        # (This is a soft constraint below, not hard - lessons CAN share a day)

        # ---- Soft Constraints (Objective) ----
        penalties = []

        # Soft: spread lesson occurrences across different days
        for lid_val, occ_indices in self._group_by_lesson(occurrences):
            if len(occ_indices) <= 1:
                continue
            for a_pos in range(len(occ_indices)):
                for b_pos in range(a_pos + 1, len(occ_indices)):
                    a = occ_indices[a_pos]
                    b = occ_indices[b_pos]
                    same_day = model.new_bool_var(f"sp_{a}_{b}")
                    model.add(day_vars[a] == day_vars[b]).only_enforce_if(same_day)
                    model.add(day_vars[a] != day_vars[b]).only_enforce_if(same_day.negated())
                    penalties.append(same_day * 5)

        # Soft: prefer preferred rooms
        if use_rooms:
            for i, (lesson, _) in enumerate(occurrences):
                pref_rid = lesson["preferred_room_id"]
                if pref_rid and pref_rid in room_ids:
                    pref_idx = room_ids.index(pref_rid)
                    not_pref = model.new_bool_var(f"npr_{i}")
                    model.add(room_vars[i] != pref_idx).only_enforce_if(not_pref)
                    model.add(room_vars[i] == pref_idx).only_enforce_if(not_pref.negated())
                    penalties.append(not_pref * 2)

        # Soft: prefer home rooms for classes
        if use_rooms:
            for i, (lesson, _) in enumerate(occurrences):
                cid = lesson["class_id"]
                cls = class_map.get(cid)
                if cls and cls["home_room_id"] and cls["home_room_id"] in room_ids:
                    home_idx = room_ids.index(cls["home_room_id"])
                    not_home = model.new_bool_var(f"nhr_{i}")
                    model.add(room_vars[i] != home_idx).only_enforce_if(not_home)
                    model.add(room_vars[i] == home_idx).only_enforce_if(not_home.negated())
                    penalties.append(not_home * 1)

        # Soft: avoid last period for core subjects
        for i, (lesson, _) in enumerate(occurrences):
            sid = lesson["subject_id"]
            subj = subject_map.get(sid)
            if subj and subj["category"] == "Core":
                last_p = model.new_bool_var(f"lp_{i}")
                model.add(period_vars[i] == num_periods - 1).only_enforce_if(last_p)
                model.add(period_vars[i] != num_periods - 1).only_enforce_if(last_p.negated())
                penalties.append(last_p * 1)

        # Soft: balance teacher load across days
        for tid, occ_indices in teacher_occs.items():
            if len(occ_indices) <= num_days:
                continue
            ideal = len(occ_indices) // num_days
            for day in range(num_days):
                day_bools = []
                for idx in occ_indices:
                    b = model.new_bool_var(f"bl_{tid}_{day}_{idx}")
                    model.add(day_vars[idx] == day).only_enforce_if(b)
                    model.add(day_vars[idx] != day).only_enforce_if(b.negated())
                    day_bools.append(b)
                day_count = model.new_int_var(0, len(occ_indices), f"bc_{tid}_{day}")
                model.add(day_count == sum(day_bools))
                dev = model.new_int_var(0, len(occ_indices), f"bd_{tid}_{day}")
                diff = model.new_int_var(-len(occ_indices), len(occ_indices), f"bf_{tid}_{day}")
                model.add(diff == day_count - ideal)
                model.add_abs_equality(dev, diff)
                penalties.append(dev)

        if penalties:
            model.minimize(sum(penalties))

        # ---- Solve ----
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit_seconds
        solver.parameters.num_workers = 8

        status = solver.solve(model)

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            entries = []
            for i, (lesson, occ_idx) in enumerate(occurrences):
                day = solver.value(day_vars[i])
                period = solver.value(period_vars[i])
                rid = None
                if use_rooms:
                    room_idx = solver.value(room_vars[i])
                    rid = room_ids[room_idx] if room_idx < len(room_ids) else None

                is_locked = False
                if lesson["id"] in locked_map:
                    for le in locked_map[lesson["id"]]:
                        if le["day_index"] == day and le["period_index"] == period:
                            is_locked = True
                            break

                entry = TimetableEntry(
                    lesson_id=lesson["id"],
                    day_index=day,
                    period_index=period,
                    room_id=rid,
                    locked=is_locked,
                )
                entries.append(entry)

            if status == cp_model.OPTIMAL:
                self.messages.append("Optimal solution found.")
            else:
                self.messages.append("Feasible solution found (may not be optimal).")

            self.messages.append(f"Scheduled {len(entries)} lesson occurrences.")
            return True, entries, self.messages

        elif status == cp_model.INFEASIBLE:
            self.messages.append(
                "No feasible timetable exists with the current constraints. "
                "Try relaxing some constraints or reducing lesson load."
            )
            return False, [], self.messages
        else:
            self.messages.append("Solver timed out. Try increasing the time limit or simplifying constraints.")
            return False, [], self.messages

    def _group_by_lesson(self, occurrences: list) -> list[tuple[int, list[int]]]:
        groups: dict[int, list[int]] = {}
        for i, (lesson, _) in enumerate(occurrences):
            groups.setdefault(lesson["id"], []).append(i)
        return list(groups.items())
