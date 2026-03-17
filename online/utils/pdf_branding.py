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

    # ── Shield icon ───────────────────────────────────────────────────────────
    icon_w = 14
    icon_h = 17
    sx = cx - icon_w / 2  # shield left
    sy = cy - icon_h / 2 + 1  # shield bottom

    # Draw shield path: pentagon shape
    p = canvas.beginPath()
    # Start at top-center
    top_cx = sx + icon_w / 2
    top_y = sy + icon_h
    p.moveTo(top_cx, top_y)  # top center
    p.lineTo(sx, top_y - 4)  # top-left shoulder
    p.lineTo(sx, sy + icon_h * 0.35)  # bottom-left
    # curve to bottom point
    p.curveTo(sx, sy + 1, top_cx - 2, sy, top_cx, sy)
    p.curveTo(top_cx + 2, sy, sx + icon_w, sy + 1, sx + icon_w, sy + icon_h * 0.35)
    p.lineTo(sx + icon_w, top_y - 4)  # bottom-right → top-right
    p.close()

    canvas.setFillColor(_WHITE)
    canvas.setStrokeColor(_NAVY)
    canvas.setLineWidth(1)
    canvas.drawPath(p, fill=1, stroke=1)

    # White 'Z' inside the shield
    canvas.setFillColor(_NAVY)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawCentredString(cx, cy - 2, "Z")

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
