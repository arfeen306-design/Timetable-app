"""Shared PDF engine — DRY reportlab helpers for all Myzynca PDF exports.

All four export modules (Substitutions, Exam Duties, Duty Roster, Committees)
use this engine for consistent branding, styling, and Smart-Fit auto-sizing.

Usage:
    from utils.pdf_engine import PDFEngine

    engine = PDFEngine(db, project)
    story  = engine.header("Daily Substitution Schedule", subtitle="Week 12")
    story += [engine.table(rows, col_widths)]
    story += engine.signature_block()
    story += engine.footer()
    return engine.build(story)                    # → StreamingResponse
    # or:  return engine.build(story, landscape=True)
"""
from __future__ import annotations

import io
import datetime as _dt
from typing import List, Optional, Sequence

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape as _landscape
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from utils.pdf_branding import MyznycaBrandingFlowable


# ── Brand palette (consistent across all PDFs) ──────────────────────────────
INDIGO  = colors.HexColor("#4F46E5")
SLATE_9 = colors.HexColor("#0F172A")
SLATE_6 = colors.HexColor("#475569")
SLATE_4 = colors.HexColor("#94A3B8")
SLATE_2 = colors.HexColor("#E2E8F0")
SLATE_1 = colors.HexColor("#F8FAFC")
LIGHT   = colors.HexColor("#EEF2FF")
DANGER  = colors.HexColor("#DC2626")
WHITE   = colors.white


class PDFEngine:
    """One-shot builder for a professionally formatted A4 PDF."""

    def __init__(self, db: Session, project):
        self.db = db
        self.project = project
        self._school_name: Optional[str] = None
        self._styles = getSampleStyleSheet()

    # ── School name resolution ───────────────────────────────────────────────

    @property
    def school_name(self) -> str:
        if self._school_name is None:
            self._school_name = self._resolve_school_name()
        return self._school_name

    def _resolve_school_name(self) -> str:
        """Resolve school name from School → SchoolMembership → Project chain."""
        try:
            from backend.models.school import School, SchoolMembership
            from backend.models.project import Project
            membership = (
                self.db.query(SchoolMembership)
                .filter(SchoolMembership.user_id == self.project.user_id)
                .first()
            )
            if membership:
                school = self.db.query(School).filter(School.id == membership.school_id).first()
                if school and school.name:
                    return school.name
        except Exception:
            pass
        return self.project.name or "School"

    # ── Styles ───────────────────────────────────────────────────────────────

    @property
    def title_style(self) -> ParagraphStyle:
        return ParagraphStyle(
            "pdf_title", parent=self._styles["Normal"],
            fontSize=16, fontName="Helvetica-Bold",
            textColor=SLATE_9, spaceAfter=2,
        )

    @property
    def subtitle_style(self) -> ParagraphStyle:
        return ParagraphStyle(
            "pdf_subtitle", parent=self._styles["Normal"],
            fontSize=10, fontName="Helvetica-Bold",
            textColor=INDIGO, spaceAfter=2,
        )

    @property
    def meta_style(self) -> ParagraphStyle:
        return ParagraphStyle(
            "pdf_meta", parent=self._styles["Normal"],
            fontSize=8, textColor=SLATE_4, spaceAfter=4,
        )

    @property
    def body_style(self) -> ParagraphStyle:
        return ParagraphStyle(
            "pdf_body", parent=self._styles["Normal"],
            fontSize=9, fontName="Helvetica", textColor=SLATE_9, leading=13,
        )

    @property
    def section_style(self) -> ParagraphStyle:
        return ParagraphStyle(
            "pdf_section", parent=self._styles["Normal"],
            fontSize=11, fontName="Helvetica-Bold",
            textColor=SLATE_9, spaceBefore=8, spaceAfter=3,
        )

    @property
    def small_style(self) -> ParagraphStyle:
        return ParagraphStyle(
            "pdf_small", parent=self._styles["Normal"],
            fontSize=8, textColor=SLATE_6,
        )

    # ── Header ───────────────────────────────────────────────────────────────

    def header(
        self,
        report_title: str,
        subtitle: str = "",
        date_str: str = "",
    ) -> list:
        """Build a standardized PDF header.

        Returns a list of flowables: school name, report title, date/generated.
        """
        now_str = _dt.datetime.now().strftime("%d/%m/%Y %I:%M %p")
        if not date_str:
            date_str = _dt.date.today().strftime("%d %B %Y")

        story: list = [
            Paragraph(f"<b>{self.school_name}</b>", self.title_style),
            Paragraph(report_title, self.subtitle_style),
        ]
        if subtitle:
            story.append(Paragraph(subtitle, self.small_style))

        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(
            f"{date_str} &nbsp;&nbsp;|&nbsp;&nbsp; Generated: {now_str}",
            self.meta_style,
        ))
        story.append(Spacer(1, 5 * mm))
        return story

    # ── Table ────────────────────────────────────────────────────────────────

    def table(
        self,
        rows: List[list],
        col_widths: Optional[List[float]] = None,
        header_bg: colors.Color = INDIGO,
        font_size: int = 9,
        padding: int = 5,
        extra_styles: Optional[List] = None,
    ) -> Table:
        """Build a styled table with Indigo header, zebra rows, and standard grid."""
        tbl = Table(rows, colWidths=col_widths, repeatRows=1)
        style_cmds = [
            ("BACKGROUND",    (0, 0), (-1, 0), header_bg),
            ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
            ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), font_size),
            ("FONTSIZE",      (0, 0), (-1, 0), font_size),
            ("ALIGN",         (0, 0), (-1, -1), "LEFT"),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0), (-1, -1), padding),
            ("BOTTOMPADDING", (0, 0), (-1, -1), padding),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
            ("GRID",          (0, 0), (-1, -1), 0.4, SLATE_2),
            # Zebra rows
            *[("BACKGROUND", (0, r), (-1, r), SLATE_1)
              for r in range(2, len(rows), 2)],
        ]
        if extra_styles:
            style_cmds.extend(extra_styles)
        tbl.setStyle(TableStyle(style_cmds))
        return tbl

    # ── Smart-Fit ────────────────────────────────────────────────────────────

    def smart_fit_table(
        self,
        rows: List[list],
        col_widths: Optional[List[float]] = None,
        max_height: float = 680,  # ~A4 portrait usable height in points
        extra_styles: Optional[List] = None,
    ) -> Table:
        """Auto-shrink font and padding until table fits within max_height."""
        for font_size, padding in [(9, 5), (8, 4), (7, 3), (6.5, 2)]:
            tbl = self.table(rows, col_widths, font_size=int(font_size),
                             padding=padding, extra_styles=extra_styles)
            w, h = tbl.wrap(A4[0] - 40 * mm, max_height)
            if h <= max_height:
                return tbl
        # Fallback: return smallest size even if it doesn't fit
        return tbl

    # ── Signature block ──────────────────────────────────────────────────────

    def signature_block(self) -> list:
        """3-column signature row: Prepared by / Vice Principal / Principal."""
        sig_data = [
            ["", "", ""],
            ["_" * 25, "_" * 25, "_" * 25],
            ["Prepared by", "Vice Principal / HOD", "Principal"],
        ]
        tbl = Table(sig_data, colWidths=[140, 140, 140])
        tbl.setStyle(TableStyle([
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("TEXTCOLOR",     (0, 2), (-1, 2), SLATE_4),
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        return [Spacer(1, 12 * mm), tbl]

    # ── Footer ───────────────────────────────────────────────────────────────

    def footer(self) -> list:
        """Myzynca branding flowable at the bottom."""
        return [
            Spacer(1, 0.4 * cm),
            MyznycaBrandingFlowable(),
        ]

    # ── Build + Return ───────────────────────────────────────────────────────

    def build(
        self,
        story: list,
        filename: str = "report.pdf",
        landscape: bool = False,
    ) -> StreamingResponse:
        """Build the PDF and return a FastAPI StreamingResponse."""
        buf = io.BytesIO()
        page = _landscape(A4) if landscape else A4
        doc = SimpleDocTemplate(
            buf, pagesize=page,
            leftMargin=15 * mm, rightMargin=15 * mm,
            topMargin=15 * mm, bottomMargin=15 * mm,
        )
        doc.build(story)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
