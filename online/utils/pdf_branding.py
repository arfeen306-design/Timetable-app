"""Shared PDF branding — Myzynca teal-circle shield Z logo + myzynca.com.

Two approaches:

1) **Flowable** (preferred) — add `MyznycaBrandingFlowable()` after each table
   in the story list. It renders centered below the table without overlapping.

2) **Page callback** — pass `draw_myzynca_branding` to onFirstPage/onLaterPages.
   This draws at a fixed position at the page bottom (legacy).

Usage (flowable):
    from utils.pdf_branding import MyznycaBrandingFlowable
    elements.append(Spacer(1, 0.6*cm))
    elements.append(MyznycaBrandingFlowable())

Usage (page callback — legacy):
    from utils.pdf_branding import draw_myzynca_branding
    doc.build(elements, onFirstPage=draw_myzynca_branding, onLaterPages=draw_myzynca_branding)
"""
from __future__ import annotations

from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import Flowable


# ── Brand constants ──────────────────────────────────────────────────────────
_NAVY    = colors.HexColor("#1C2E4A")
_TEAL    = colors.HexColor("#00CEC8")
_WHITE   = colors.white
_BORDER  = colors.HexColor("#E0D8CF")
_URL_CLR = colors.HexColor("#00CEC8")


def _draw_shield(canvas, cx, cy, radius=9):
    """Draw the teal-circle + navy-shield + white-Z logo at (cx, cy)."""
    # Teal circle ring with white fill
    canvas.setStrokeColor(_TEAL)
    canvas.setLineWidth(1.5)
    canvas.setFillColor(_WHITE)
    canvas.circle(cx, cy, radius, fill=1, stroke=1)

    # Navy filled shield inside the circle
    sw = radius * 1.1  # shield half-width
    sh = radius * 1.9  # shield height
    s_bottom = cy - sh / 2 + 1
    s_top = cy + sh / 2 + 1

    p = canvas.beginPath()
    p.moveTo(cx, s_top)                     # top center
    p.lineTo(cx - sw, s_top - 3)            # top-left shoulder
    p.lineTo(cx - sw, s_bottom + sh * 0.40) # left side
    p.curveTo(cx - sw, s_bottom + 1, cx - 1.5, s_bottom, cx, s_bottom)
    p.curveTo(cx + 1.5, s_bottom, cx + sw, s_bottom + 1, cx + sw, s_bottom + sh * 0.40)
    p.lineTo(cx + sw, s_top - 3)            # right side
    p.close()

    canvas.setFillColor(_NAVY)
    canvas.setStrokeColor(_NAVY)
    canvas.setLineWidth(0.3)
    canvas.drawPath(p, fill=1, stroke=1)

    # White Z
    canvas.setFillColor(_WHITE)
    canvas.setFont("Helvetica-Bold", max(6, int(radius * 0.78)))
    canvas.drawCentredString(cx, cy - radius * 0.22, "Z")


class MyznycaBrandingFlowable(Flowable):
    """A centered branding block: [line] + [logo] Myzynca  myzynca.com

    Place this flowable right after a table in the story list.
    It respects the document flow and never overlaps with tables.
    """
    _height = 1.2 * cm
    _width  = 0     # auto — uses available width

    def __init__(self, width=None):
        super().__init__()
        self.width = width or 0
        self.height = self._height

    def wrap(self, availWidth, availHeight):
        self.width = availWidth
        return (availWidth, self._height)

    def draw(self):
        c = self.canv
        w = self.width
        mid = w / 2

        # ── Thin separator line ──────────────────────────────────────────────
        line_y = self._height - 4
        c.setStrokeColor(_BORDER)
        c.setLineWidth(0.5)
        c.line(0, line_y, w, line_y)

        # ── Logo + text centered ─────────────────────────────────────────────
        brand_y = line_y / 2  # vertical center of remaining space
        # Calculate total block width: icon(20) + gap(6) + "Myzynca"(~48) + gap(8) + "myzynca.com"(~55) ≈ 137
        block_w = 137
        start_x = mid - block_w / 2

        # Draw shield icon
        icon_cx = start_x + 9
        _draw_shield(c, icon_cx, brand_y, radius=8)

        # Brand name
        c.setFillColor(_NAVY)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(start_x + 22, brand_y - 3, "Myzynca")

        # URL
        c.setFillColor(_URL_CLR)
        c.setFont("Helvetica", 7.5)
        c.drawString(start_x + 72, brand_y - 3, "myzynca.com")


# ── Legacy page callback (kept for backward compatibility) ───────────────────
def draw_myzynca_branding(canvas, doc):
    """Draw branding at fixed page footer position (legacy approach)."""
    canvas.saveState()
    page_w, _ = doc.pagesize
    cx = page_w / 2 - 55
    cy = 22
    _draw_shield(canvas, cx, cy, radius=9)

    canvas.setFillColor(_NAVY)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(cx + 14, cy - 3, "Myzynca")

    canvas.setFillColor(_URL_CLR)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(cx + 64, cy - 3, "myzynca.com")

    canvas.setStrokeColor(_BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, 38, page_w - doc.rightMargin, 38)
    canvas.restoreState()
