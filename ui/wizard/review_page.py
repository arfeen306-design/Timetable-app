"""Timetable review and export wizard page."""
from __future__ import annotations
import os
from typing import TYPE_CHECKING

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QComboBox, QTabWidget, QMessageBox, QFileDialog, QGroupBox,
    QScrollArea, QFrame,
)
from PySide6.QtCore import Qt

from services.timetable_service import TimetableService
from services.class_service import ClassService
from services.teacher_service import TeacherService
from services.room_service import RoomService
from services.school_service import SchoolService
from services.communication_service import CommunicationService
from ui.widgets.timetable_grid import TimetableGrid
from ui.widgets.searchable_combo import make_searchable
from utils.display_utils import class_display_label, teacher_display_label

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class ReviewPage(QWidget):
    def __init__(self, main_window: MainWindow) -> None:
        super().__init__()
        self.main_window = main_window
        self._build_ui()

    def _build_ui(self) -> None:
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setMinimumWidth(400)
        content = QWidget()
        layout = QVBoxLayout(content)
        layout.setContentsMargins(24, 24, 24, 24)

        title = QLabel("Review & Export Timetable")
        title.setProperty("heading", True)
        layout.addWidget(title)

        # View selector
        view_layout = QHBoxLayout()

        self.tabs = QTabWidget()
        layout.addWidget(self.tabs, 1)

        # Class tab
        class_tab = QWidget()
        class_layout = QVBoxLayout(class_tab)
        class_sel = QHBoxLayout()
        class_sel.addWidget(QLabel("Select Class:"))
        self.class_combo = QComboBox()
        self.class_combo.setMinimumWidth(200)
        make_searchable(self.class_combo)
        self.class_combo.currentIndexChanged.connect(self._on_class_changed)
        class_sel.addWidget(self.class_combo)
        class_sel.addStretch()
        class_layout.addLayout(class_sel)
        self.class_grid = TimetableGrid()
        self.class_grid.entry_lock_toggled.connect(self._on_lock_toggled)
        class_layout.addWidget(self.class_grid)
        self.tabs.addTab(class_tab, "Class Timetable")

        # Teacher tab
        teacher_tab = QWidget()
        teacher_layout = QVBoxLayout(teacher_tab)
        teacher_sel = QHBoxLayout()
        teacher_sel.addWidget(QLabel("Select Teacher:"))
        self.teacher_combo = QComboBox()
        self.teacher_combo.setMinimumWidth(200)
        make_searchable(self.teacher_combo)
        self.teacher_combo.currentIndexChanged.connect(self._on_teacher_changed)
        teacher_sel.addWidget(self.teacher_combo)
        teacher_sel.addStretch()
        teacher_layout.addLayout(teacher_sel)
        self.teacher_grid = TimetableGrid()
        self.teacher_grid.entry_lock_toggled.connect(self._on_lock_toggled)
        teacher_layout.addWidget(self.teacher_grid)
        self.tabs.addTab(teacher_tab, "Teacher Timetable")

        # Room tab
        room_tab = QWidget()
        room_layout = QVBoxLayout(room_tab)
        room_sel = QHBoxLayout()
        room_sel.addWidget(QLabel("Select Room:"))
        self.room_combo = QComboBox()
        self.room_combo.setMinimumWidth(200)
        make_searchable(self.room_combo)
        self.room_combo.currentIndexChanged.connect(self._on_room_changed)
        room_sel.addWidget(self.room_combo)
        room_sel.addStretch()
        room_layout.addLayout(room_sel)
        self.room_grid = TimetableGrid()
        self.room_grid.entry_lock_toggled.connect(self._on_lock_toggled)
        room_layout.addWidget(self.room_grid)
        self.tabs.addTab(room_tab, "Room Timetable")

        # Export buttons
        export_group = QGroupBox("Export")
        export_layout = QHBoxLayout(export_group)

        excel_btn = QPushButton("Export to Excel")
        excel_btn.setProperty("primary", True)
        excel_btn.clicked.connect(self._export_excel)
        export_layout.addWidget(excel_btn)

        csv_btn = QPushButton("Export to CSV")
        csv_btn.clicked.connect(self._export_csv)
        export_layout.addWidget(csv_btn)

        pdf_btn = QPushButton("Export to PDF")
        pdf_btn.clicked.connect(self._export_pdf)
        export_layout.addWidget(pdf_btn)

        pdf_teacher_btn = QPushButton("Export Teacher PDF")
        pdf_teacher_btn.setToolTip("Export one PDF page per teacher with timetable and total weekly workload")
        pdf_teacher_btn.clicked.connect(self._export_teacher_pdf)
        export_layout.addWidget(pdf_teacher_btn)

        export_layout.addStretch()

        save_btn = QPushButton("Save Project")
        save_btn.clicked.connect(self.main_window.save_project)
        export_layout.addWidget(save_btn)

        save_as_btn = QPushButton("Save As...")
        save_as_btn.clicked.connect(self.main_window.save_project_as)
        export_layout.addWidget(save_as_btn)

        layout.addWidget(export_group)

        # Communication (email / WhatsApp ready)
        comm_group = QGroupBox("Communication — email / WhatsApp ready")
        comm_layout = QVBoxLayout(comm_group)
        self.comm_teacher_label = QLabel("Teacher timetables: — teachers. Export one PDF per teacher for email or WhatsApp.")
        self.comm_teacher_label.setWordWrap(True)
        comm_layout.addWidget(self.comm_teacher_label)
        comm_btn_row = QHBoxLayout()
        export_teachers_folder_btn = QPushButton("Export all teacher PDFs to folder…")
        export_teachers_folder_btn.setToolTip("Choose a folder; one PDF per teacher will be created (for email or WhatsApp).")
        export_teachers_folder_btn.clicked.connect(self._export_teacher_pdfs_to_folder)
        comm_btn_row.addWidget(export_teachers_folder_btn)
        comm_btn_row.addStretch()
        comm_layout.addLayout(comm_btn_row)
        self.comm_class_label = QLabel("Class timetables for class teachers: — classes. Export one PDF per class for the class teacher.")
        self.comm_class_label.setWordWrap(True)
        comm_layout.addWidget(self.comm_class_label)
        export_class_teachers_btn = QPushButton("Export class timetables for class teachers to folder…")
        export_class_teachers_btn.setToolTip("Choose a folder; one PDF per class (for class teacher) will be created.")
        export_class_teachers_btn.clicked.connect(self._export_class_teacher_pdfs_to_folder)
        comm_layout.addWidget(export_class_teachers_btn)
        layout.addWidget(comm_group)

        scroll.setWidget(content)
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.addWidget(scroll)

    def on_enter(self) -> None:
        if not self.main_window.db:
            return

        school_svc = SchoolService(self.main_window.db)
        school = school_svc.get_or_create()

        import json
        bell = {}
        if school.bell_schedule_json:
            try:
                bell = json.loads(school.bell_schedule_json or "{}") if isinstance(school.bell_schedule_json, str) else (school.bell_schedule_json or {})
                if not isinstance(bell, dict):
                    bell = {}
            except (TypeError, ValueError):
                pass
        zero_period = bool(bell.get("zero_period", False))
        display_periods = school.periods_per_day + (1 if zero_period else 0)

        from utils.helpers import get_day_short, get_period_label, get_period_label_short, format_time_range, get_day_slot_sequence
        slots_per_day = [
            get_day_slot_sequence(bell, d, display_periods, zero_period)
            for d in range(school.days_per_week)
        ]
        num_slots = max(len(s) for s in slots_per_day) if slots_per_day else display_periods
        vertical_labels = []
        for r in range(num_slots):
            if r < len(slots_per_day[0]):
                slot = slots_per_day[0][r]
                if slot.get("type") == "period":
                    lbl = get_period_label_short(slot["period_index"], zero_period)
                    vertical_labels.append(f"{lbl}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
                else:
                    vertical_labels.append(f"{slot.get('name', 'Break')}\n{format_time_range(slot.get('start', ''), slot.get('end', ''))}")
            else:
                vertical_labels.append("—")

        self._slots_per_day = slots_per_day
        self._vertical_labels = vertical_labels

        # Friday time bar: show Fri-specific times in a row above Friday when Fri has different timing
        friday_time_bar = None
        if school.days_per_week > 4 and isinstance(bell.get("friday"), dict):
            fri_slots = slots_per_day[4] if len(slots_per_day) > 4 else []
            if fri_slots:
                friday_time_bar = [
                    format_time_range(s.get("start", ""), s.get("end", ""))
                    for s in fri_slots
                ]
                while len(friday_time_bar) < num_slots:
                    friday_time_bar.append("")
        self._friday_time_bar = friday_time_bar

        # Update grid dimensions: days vertical (rows), time slots horizontal (columns)
        if self._friday_time_bar and school.days_per_week > 4:
            v_headers = [get_day_short(d) for d in range(4)] + ["Fri times", get_day_short(4)]
            num_rows = school.days_per_week + 1
        else:
            v_headers = [get_day_short(d) for d in range(school.days_per_week)]
            num_rows = school.days_per_week
        for grid in [self.class_grid, self.teacher_grid, self.room_grid]:
            grid.num_days = school.days_per_week
            grid.num_periods = display_periods
            grid.setRowCount(num_rows)
            grid.setColumnCount(num_slots)
            grid.setVerticalHeaderLabels(v_headers)
            grid.setHorizontalHeaderLabels(vertical_labels)

        # Populate combos
        self.class_combo.blockSignals(True)
        self.class_combo.clear()
        class_svc = ClassService(self.main_window.db)
        for c in class_svc.get_all():
            self.class_combo.addItem(class_display_label(c), c.id)
        self.class_combo.blockSignals(False)

        self.teacher_combo.blockSignals(True)
        self.teacher_combo.clear()
        teacher_svc = TeacherService(self.main_window.db)
        for t in teacher_svc.get_all():
            self.teacher_combo.addItem(teacher_display_label(t), t.id)
        self.teacher_combo.blockSignals(False)

        self.room_combo.blockSignals(True)
        self.room_combo.clear()
        room_svc = RoomService(self.main_window.db)
        for r in room_svc.get_all():
            self.room_combo.addItem(r.name, r.id)
        self.room_combo.blockSignals(False)

        # Load first entries
        if self.class_combo.count() > 0:
            self._on_class_changed(0)
        if self.teacher_combo.count() > 0:
            self._on_teacher_changed(0)
        if self.room_combo.count() > 0:
            self._on_room_changed(0)

        # Update communication labels
        comm_svc = CommunicationService(self.main_window.db)
        teachers = comm_svc.get_teacher_timetable_deliverables()
        class_teachers = comm_svc.get_class_teacher_timetable_deliverables()
        self.comm_teacher_label.setText(
            f"Teacher timetables: {len(teachers)} teachers. Export one PDF per teacher for email or WhatsApp."
        )
        self.comm_class_label.setText(
            f"Class timetables for class teachers: {len(class_teachers)} classes. Export one PDF per class for the class teacher."
        )

    def _on_class_changed(self, index: int) -> None:
        if index < 0 or not self.main_window.db:
            return
        cid = self.class_combo.currentData()
        if cid is None:
            return
        svc = TimetableService(self.main_window.db)
        entries = svc.get_class_timetable(cid)
        if getattr(self, "_slots_per_day", None) and getattr(self, "_vertical_labels", None):
            self.class_grid.load_entries_with_slots(
                entries, self._slots_per_day, self._vertical_labels,
                getattr(self, "_friday_time_bar", None),
            )
        else:
            self.class_grid.load_entries(entries)

    def _on_teacher_changed(self, index: int) -> None:
        if index < 0 or not self.main_window.db:
            return
        tid = self.teacher_combo.currentData()
        if tid is None:
            return
        svc = TimetableService(self.main_window.db)
        entries = svc.get_teacher_timetable(tid)
        if getattr(self, "_slots_per_day", None) and getattr(self, "_vertical_labels", None):
            self.teacher_grid.load_entries_with_slots(
                entries, self._slots_per_day, self._vertical_labels,
                getattr(self, "_friday_time_bar", None),
            )
        else:
            self.teacher_grid.load_entries(entries)

    def _on_room_changed(self, index: int) -> None:
        if index < 0 or not self.main_window.db:
            return
        rid = self.room_combo.currentData()
        if rid is None:
            return
        svc = TimetableService(self.main_window.db)
        entries = svc.get_room_timetable(rid)
        if getattr(self, "_slots_per_day", None) and getattr(self, "_vertical_labels", None):
            self.room_grid.load_entries_with_slots(
                entries, self._slots_per_day, self._vertical_labels,
                getattr(self, "_friday_time_bar", None),
            )
        else:
            self.room_grid.load_entries(entries)

    def _on_lock_toggled(self, entry_id: int, lock: bool) -> None:
        if not self.main_window.db:
            return
        svc = TimetableService(self.main_window.db)
        if lock:
            svc.lock_entry(entry_id)
        else:
            svc.unlock_entry(entry_id)
        self.on_enter()

    def _export_excel(self) -> None:
        if not self.main_window.db:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Export Excel", "timetable.xlsx", "Excel Files (*.xlsx)"
        )
        if path:
            try:
                from exports.excel_export import export_excel
                export_excel(self.main_window.db, path)
                QMessageBox.information(self, "Exported", f"Excel file saved to:\n{path}")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Export failed:\n{e}")

    def _export_csv(self) -> None:
        if not self.main_window.db:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Export CSV", "timetable.csv", "CSV Files (*.csv)"
        )
        if path:
            try:
                from exports.csv_export import export_csv
                export_csv(self.main_window.db, path)
                QMessageBox.information(self, "Exported", f"CSV file saved to:\n{path}")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Export failed:\n{e}")

    def _export_pdf(self) -> None:
        if not self.main_window.db:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Export PDF", "timetable.pdf", "PDF Files (*.pdf)"
        )
        if path:
            try:
                from exports.pdf_export import export_pdf
                export_pdf(self.main_window.db, path)
                QMessageBox.information(self, "Exported", f"PDF file saved to:\n{path}")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Export failed:\n{e}")

    def _export_teacher_pdf(self) -> None:
        if not self.main_window.db:
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Export Teacher PDF", "timetable_teachers.pdf", "PDF Files (*.pdf)"
        )
        if path:
            try:
                from exports.pdf_export import export_teacher_pdf
                export_teacher_pdf(self.main_window.db, path)
                QMessageBox.information(self, "Exported", f"Teacher PDF saved to:\n{path}")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Export failed:\n{e}")

    def _export_teacher_pdfs_to_folder(self) -> None:
        if not self.main_window.db:
            return
        folder = QFileDialog.getExistingDirectory(self, "Choose folder for teacher PDFs")
        if not folder:
            return
        from exports.pdf_export import export_single_teacher_pdf, _sanitize_filename
        comm_svc = CommunicationService(self.main_window.db)
        deliverables = comm_svc.get_teacher_timetable_deliverables()
        done, err = 0, None
        for d in deliverables:
            try:
                path = os.path.join(folder, _sanitize_filename(d.teacher_name) + ".pdf")
                export_single_teacher_pdf(self.main_window.db, d.teacher_id, path)
                done += 1
            except Exception as e:
                err = e
        if err and done == 0:
            QMessageBox.critical(self, "Error", f"Export failed:\n{err}")
        else:
            QMessageBox.information(
                self, "Exported",
                f"Exported {done} teacher PDF(s) to:\n{folder}" + (f"\n(One failed: {err})" if err else ""),
            )

    def _export_class_teacher_pdfs_to_folder(self) -> None:
        if not self.main_window.db:
            return
        folder = QFileDialog.getExistingDirectory(self, "Choose folder for class teacher PDFs")
        if not folder:
            return
        from exports.pdf_export import export_single_class_pdf, _sanitize_filename
        comm_svc = CommunicationService(self.main_window.db)
        deliverables = comm_svc.get_class_teacher_timetable_deliverables()
        done, err = 0, None
        for d in deliverables:
            try:
                path = os.path.join(folder, _sanitize_filename(f"Class_{d.class_name}") + ".pdf")
                export_single_class_pdf(self.main_window.db, d.class_id, path)
                done += 1
            except Exception as e:
                err = e
        if err and done == 0:
            QMessageBox.critical(self, "Error", f"Export failed:\n{err}")
        else:
            QMessageBox.information(
                self, "Exported",
                f"Exported {done} class timetable PDF(s) to:\n{folder}" + (f"\n(One failed: {err})" if err else ""),
            )
