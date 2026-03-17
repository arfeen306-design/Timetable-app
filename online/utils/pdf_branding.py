"""Shared PDF branding — Myzynca rounded-square Z logo + myzynca.com footer.

Import and pass `draw_myzynca_branding` as onFirstPage/onLaterPages callback
to any reportlab SimpleDocTemplate.build() call.

Usage:
    from utils.pdf_branding import draw_myzynca_branding
    doc.build(elements, onFirstPage=draw_myzynca_branding, onLaterPages=draw_myzynca_branding)
"""
from __future__ import annotations

from reportlab.lib import colors


# ── Brand constants ──────────────────────────────────────────────────────────
_NAVY    = colors.HexColor("#1C2E4A")
_WHITE   = colors.white
_BORDER  = colors.HexColor("#E0D8CF")
_URL_CLR = colors.HexColor("#52677D")


def draw_myzynca_branding(canvas, doc):
    """Draw minimalist Myzynca branding footer on every PDF page.

    Renders:
      • Rounded-square icon (midnight blue) with white 'Z'
      • 'Myzynca' brand name in midnight blue
      • 'myzynca.com' URL in dusty blue
      • Thin separator line above the footer
    """
    canvas.saveState()
    page_w, _ = doc.pagesize

    # ── Centered anchor point ────────────────────────────────────────────────
    cx = page_w / 2 - 55  # left edge of the logo block
    cy = 22               # baseline y

    # ── Rounded-square icon ──────────────────────────────────────────────────
    icon_size = 14
    icon_x = cx - icon_size / 2
    icon_y = cy - icon_size / 2 + 1
    radius = 3

    canvas.setFillColor(_NAVY)
    canvas.setStrokeColor(_NAVY)
    canvas.setLineWidth(0.5)
    canvas.roundRect(icon_x, icon_y, icon_size, icon_size, radius, fill=1, stroke=1)

    # White 'Z' inside the rounded square
    canvas.setFillColor(_WHITE)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawCentredString(cx, cy - 2.5, "Z")

    # ── Brand name ───────────────────────────────────────────────────────────
    canvas.setFillColor(_NAVY)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(cx + 12, cy - 3, "Myzynca")

    # ── Domain URL ───────────────────────────────────────────────────────────
    canvas.setFillColor(_URL_CLR)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(cx + 62, cy - 3, "myzynca.com")

    # ── Separator line ───────────────────────────────────────────────────────
    canvas.setStrokeColor(_BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, 38, page_w - doc.rightMargin, 38)

    canvas.restoreState()
