"""Shared PDF branding — Myzynca teal-circle shield Z logo + myzynca.com footer.

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
_TEAL    = colors.HexColor("#00CEC8")
_WHITE   = colors.white
_BORDER  = colors.HexColor("#E0D8CF")
_URL_CLR = colors.HexColor("#00CEC8")


def draw_myzynca_branding(canvas, doc):
    """Draw minimalist Myzynca branding footer on every PDF page.

    Renders:
      • Teal circle ring with navy filled shield + white 'Z'
      • 'Myzynca' brand name in midnight blue
      • 'myzynca.com' URL in teal
      • Thin separator line above the footer
    """
    canvas.saveState()
    page_w, _ = doc.pagesize

    # ── Centered anchor point ────────────────────────────────────────────────
    cx = page_w / 2 - 55  # center of the logo icon
    cy = 22               # baseline y

    # ── Teal circle ring ─────────────────────────────────────────────────────
    radius = 9
    canvas.setStrokeColor(_TEAL)
    canvas.setLineWidth(1.5)
    canvas.setFillColor(_WHITE)
    canvas.circle(cx, cy, radius, fill=1, stroke=1)

    # ── Navy filled shield inside the circle ─────────────────────────────────
    # Shield dimensions scaled to fit inside the circle
    sw = 10   # shield width
    sh = 12   # shield height
    s_cx = cx  # shield center x
    s_bottom = cy - sh / 2 + 1
    s_top = cy + sh / 2 + 1

    p = canvas.beginPath()
    p.moveTo(s_cx, s_top)                          # top center point
    p.lineTo(s_cx - sw / 2, s_top - 3)             # top-left shoulder
    p.lineTo(s_cx - sw / 2, s_bottom + sh * 0.40)  # left side
    # curve to bottom point
    p.curveTo(s_cx - sw / 2, s_bottom + 1, s_cx - 1.5, s_bottom, s_cx, s_bottom)
    p.curveTo(s_cx + 1.5, s_bottom, s_cx + sw / 2, s_bottom + 1, s_cx + sw / 2, s_bottom + sh * 0.40)
    p.lineTo(s_cx + sw / 2, s_top - 3)             # right side → top-right
    p.close()

    canvas.setFillColor(_NAVY)
    canvas.setStrokeColor(_NAVY)
    canvas.setLineWidth(0.3)
    canvas.drawPath(p, fill=1, stroke=1)

    # White 'Z' inside the shield
    canvas.setFillColor(_WHITE)
    canvas.setFont("Helvetica-Bold", 7)
    canvas.drawCentredString(cx, cy - 2, "Z")

    # ── Brand name ───────────────────────────────────────────────────────────
    canvas.setFillColor(_NAVY)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(cx + 14, cy - 3, "Myzynca")

    # ── Domain URL ───────────────────────────────────────────────────────────
    canvas.setFillColor(_URL_CLR)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(cx + 64, cy - 3, "myzynca.com")

    # ── Separator line ───────────────────────────────────────────────────────
    canvas.setStrokeColor(_BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, 38, page_w - doc.rightMargin, 38)

    canvas.restoreState()
