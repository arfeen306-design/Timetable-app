"""Import preview dialog: show validation summary and confirm before writing to DB."""
from __future__ import annotations
from typing import TYPE_CHECKING, Callable

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTextEdit, QMessageBox,
)
from PySide6.QtCore import Qt

from imports.excel_import import ImportResult, RowError

if TYPE_CHECKING:
    from database.connection import DatabaseConnection


def run_import_preview(
    parent: QDialog,
    db: "DatabaseConnection",
    path: str,
    import_fn: Callable[..., ImportResult],
    entity_name: str,
    on_success: Callable[[], None] | None = None,
) -> None:
    """
    Run a dry-run import, show preview dialog, then on confirm run real import.
    import_fn must accept (db, path, *, dry_run: bool = False) and return ImportResult.
    """
    try:
        preview = import_fn(db, path, dry_run=True)
    except Exception as e:
        QMessageBox.critical(parent, "Preview Failed", str(e))
        return

    dlg = ImportPreviewDialog(parent, path, preview, entity_name)
    if dlg.exec() == QDialog.DialogCode.Accepted and getattr(dlg, "user_confirmed_import", False):
        _do_import(parent, db, path, import_fn, entity_name, on_success)


def _do_import(parent, db, path, import_fn, entity_name, on_success) -> None:
    try:
        result = import_fn(db, path, dry_run=False)
        if result.errors:
            msg = (
                f"Imported {result.success_count} {entity_name}.\n\n"
                f"Row-level errors ({len(result.errors)}):\n"
            )
            for e in result.errors[:25]:
                msg += f"  Row {e.row}: {e.message}\n"
            if len(result.errors) > 25:
                msg += f"  ... and {len(result.errors) - 25} more."
            QMessageBox.warning(parent, "Import with Errors", msg)
        else:
            QMessageBox.information(
                parent, "Import Complete",
                f"Successfully imported {result.success_count} {entity_name}.",
            )
        if on_success:
            on_success()
    except Exception as e:
        QMessageBox.critical(parent, "Import Failed", str(e))


class ImportPreviewDialog(QDialog):
    """Shows total/valid/invalid counts and row errors; Confirm runs real import."""
    def __init__(
        self,
        parent: QDialog,
        path: str,
        preview: ImportResult,
        entity_name: str,
    ) -> None:
        super().__init__(parent)
        self.preview = preview
        self.path = path
        self.entity_name = entity_name
        self.user_confirmed_import = False
        self._build_ui()

    def _build_ui(self) -> None:
        self.setWindowTitle(f"Import preview — {self.entity_name}")
        layout = QVBoxLayout(self)
        layout.setSpacing(12)

        layout.addWidget(QLabel(f"File: {self.path}"))
        layout.addWidget(QLabel("Validation summary (no data has been written yet):"))

        total = self.preview.total_rows
        valid = self.preview.success_count
        invalid = self.preview.invalid_count
        skipped = max(0, total - valid - invalid)  # blank/skipped rows

        summary = (
            f"Total data rows: {total}  |  Valid (to import): {valid}  |  "
            f"Invalid/duplicate: {invalid}"
        )
        if skipped:
            summary += f"  |  Skipped (empty): {skipped}"
        layout.addWidget(QLabel(summary))

        if self.preview.errors:
            err_label = QLabel("Row-level errors:")
            layout.addWidget(err_label)
            self.text = QTextEdit()
            self.text.setReadOnly(True)
            self.text.setMaximumHeight(220)
            lines = []
            for e in self.preview.errors[:100]:
                lines.append(f"Row {e.row}: {e.message}")
            if len(self.preview.errors) > 100:
                lines.append(f"... and {len(self.preview.errors) - 100} more.")
            self.text.setText("\n".join(lines))
            layout.addWidget(self.text)

        btn_layout = QHBoxLayout()
        if valid > 0:
            import_btn = QPushButton("Import valid rows")
            import_btn.setProperty("primary", True)
            import_btn.clicked.connect(self._confirm)
            btn_layout.addWidget(import_btn)
        btn_layout.addStretch()
        cancel_btn = QPushButton("Cancel")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)
        layout.addLayout(btn_layout)

    def _confirm(self) -> None:
        self.user_confirmed_import = True
        self.accept()
