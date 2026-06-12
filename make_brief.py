# Generates ShuttleLab-Brief.pdf — a short branded brief about the site.
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame,
                                Paragraph, Spacer, Table, TableStyle, HRFlowable)

BG    = HexColor("#0b0e0c")
CARD  = HexColor("#111712")
LINE  = HexColor("#24301f")
BRAND = HexColor("#a4dd2b")
TEXT  = HexColor("#e8efe6")
MUTED = HexColor("#9aa49a")

W, H = A4
OUT = "ShuttleLab-Brief.pdf"

def bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BG)
    canvas.rect(0, 0, W, H, stroke=0, fill=1)
    canvas.setStrokeColor(BRAND); canvas.setLineWidth(3)
    canvas.line(0, H-6, W, H-6)
    canvas.setFillColor(MUTED); canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(W/2, 10*mm, "ShuttleLab  ·  shuttle-lab-mu.vercel.app  ·  Private team platform")
    canvas.restoreState()

doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=18*mm, rightMargin=18*mm,
                      topMargin=16*mm, bottomMargin=18*mm)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=bg)])

S = {
  "logo":  ParagraphStyle("logo",  fontName="Helvetica-Bold", fontSize=34, leading=38, textColor=TEXT, alignment=TA_CENTER),
  "tag":   ParagraphStyle("tag",   fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=BRAND, alignment=TA_CENTER),
  "intro": ParagraphStyle("intro", fontName="Helvetica", fontSize=10.5, leading=16, textColor=TEXT, alignment=TA_CENTER),
  "h":     ParagraphStyle("h",     fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=BRAND, spaceBefore=10, spaceAfter=4),
  "body":  ParagraphStyle("body",  fontName="Helvetica", fontSize=9.8, leading=14.5, textColor=TEXT),
  "ct":    ParagraphStyle("ct",    fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=BRAND),
  "cb":    ParagraphStyle("cb",    fontName="Helvetica", fontSize=9, leading=13, textColor=TEXT),
  "mut":   ParagraphStyle("mut",   fontName="Helvetica", fontSize=9, leading=13, textColor=MUTED, alignment=TA_CENTER),
}

def card(title, text):
    t = Table([[Paragraph(title, S["ct"])], [Paragraph(text, S["cb"])]],
              colWidths=[(doc.width-8*mm)/2])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), CARD),
        ("BOX", (0,0), (-1,-1), 0.75, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 9), ("RIGHTPADDING", (0,0), (-1,-1), 9),
        ("TOPPADDING", (0,0), (-1,0), 8), ("BOTTOMPADDING", (0,1), (-1,1), 9),
        ("TOPPADDING", (0,1), (-1,1), 2), ("BOTTOMPADDING", (0,0), (-1,0), 1),
    ]))
    return t

cards = [
    ("Performance tracking",
     "Players log six fitness tests; the app keeps best and average, draws season "
     "trends, flags new personal bests and measures progress against the coach's goals."),
    ("Season planning",
     "A season target, dated training phases and a tournament calendar per player — "
     "with the 2026 federation schedule built in and editable by the coach."),
    ("Pro 3D Court",
     "A true-scale 3D court for singles, doubles and mixed. The coach builds drills "
     "shot by shot; athletes run, lunge and jump-smash with real contact points, "
     "legal serve boxes and automatic pair rotation. Four TV-style cameras."),
    ("Film room",
     "Match videos upload from any phone to private cloud storage. The coach pins "
     "notes to the exact second — auto-pause, slow-motion, drawings and his own "
     "recorded voice — and players watch it back with everything firing itself."),
    ("Multi-shuttle & squads",
     "Coach-fed multi-shuttle with a placeable feeder and Rapid / Steady / Relaxed "
     "rhythms, plus 3-v-1 and 2-v-1 pressure drills where every player's position "
     "and movement is choreographed."),
    ("Mind Room",
     "A calming space that changes every visit — breathing exercises, a gentle game, "
     "powerful encouragement in the coach's own words, a private mood sky only the "
     "player can see, and a direct private line to the coach."),
]

story = [
    Paragraph('Shuttle<font color="#a4dd2b">Lab</font>', S["logo"]),
    Spacer(1, 3),
    Paragraph("MEASURE  ·  IMPROVE  ·  DOMINATE", S["tag"]),
    Spacer(1, 10),
    HRFlowable(width="100%", thickness=0.75, color=LINE),
    Spacer(1, 10),
    Paragraph("ShuttleLab is the private training platform of our badminton team — one coach, "
              "his players, and everything that happens between matches: testing, planning, "
              "drilling, video analysis and mental support, in a single app that lives on every "
              "player's phone.", S["intro"]),
    Spacer(1, 12),
]

rows = []
for i in range(0, len(cards), 2):
    rows.append([card(*cards[i]), card(*cards[i+1])])
grid = Table(rows, colWidths=[doc.width/2, doc.width/2], hAlign="CENTER")
grid.setStyle(TableStyle([
    ("LEFTPADDING", (0,0), (-1,-1), 2), ("RIGHTPADDING", (0,0), (-1,-1), 2),
    ("TOPPADDING", (0,0), (-1,-1), 3), ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
]))
story.append(grid)

story += [
    Spacer(1, 12),
    Paragraph("Built private", S["h"]),
    Paragraph("Every page sits behind a personal sign-in. Videos live in a private storage bucket "
              "reachable only through short-lived secure links; the database enforces who may write "
              "what; players see team rankings without other players' names; and a player's Mind Room "
              "check-ins are visible to no one else — not even the coach.", S["body"]),
    Spacer(1, 8),
    Paragraph("How it runs", S["h"]),
    Paragraph("A fast, installable web app (no app store needed): open the link, sign in, add to the "
              "home screen. Hosted on Vercel, data on Firebase, video on Cloudflare R2 — updates reach "
              "every device instantly.", S["body"]),
    Spacer(1, 14),
    HRFlowable(width="100%", thickness=0.75, color=LINE),
    Spacer(1, 6),
    Paragraph("Full manual: DOCUMENTATION.md in the project · June 2026", S["mut"]),
]

doc.build(story)
print("OK ->", OUT)
