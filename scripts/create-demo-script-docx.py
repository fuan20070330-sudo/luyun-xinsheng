import re
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "DEMO-VIDEO-SCRIPT.md"
OUTPUT = ROOT / "docs" / "作品运行录屏脚本与演示流程.docx"
FONT = "Noto Sans SC"


def clean_markdown(text):
    text = text.strip()
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"`(.*?)`", r"\1", text)
    return text


def set_font(run, size=10.5, bold=False, color="000000"):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), FONT)


def add_page_number(paragraph):
    run = paragraph.add_run("第 ")
    set_font(run, 8.5, color="666666")
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    value = OxmlElement("w:t")
    value.text = "1"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, separate, value, end])
    tail = paragraph.add_run(" 页")
    set_font(tail, 8.5, color="666666")


def configure(doc):
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.8)
    section.left_margin = Cm(1.9)
    section.right_margin = Cm(1.9)
    section.footer_distance = Cm(0.8)

    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor(0, 0, 0)
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    normal.paragraph_format.line_spacing = 1.35
    normal.paragraph_format.space_after = Pt(4)

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_page_number(footer)


def add_title(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(12)
    run = paragraph.add_run(clean_markdown(text))
    set_font(run, 18, bold=True)


def add_heading(doc, text, level=1):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(12 if level == 1 else 9)
    paragraph.paragraph_format.space_after = Pt(4)
    paragraph.paragraph_format.keep_with_next = True
    run = paragraph.add_run(clean_markdown(text))
    set_font(run, 13 if level == 1 else 11.5, bold=True)


def add_body(doc, text, bullet=False, numbered=False):
    style = "List Bullet" if bullet else "List Number" if numbered else None
    paragraph = doc.add_paragraph(style=style) if style else doc.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(4)
    paragraph.paragraph_format.line_spacing = 1.35
    run = paragraph.add_run(clean_markdown(text))
    set_font(run, 10.5)


def add_storyboard_row(doc, index, cells):
    time_value, stage, visual, voiceover, acceptance = cells[:5]
    heading = doc.add_paragraph()
    heading.paragraph_format.space_before = Pt(10)
    heading.paragraph_format.space_after = Pt(4)
    heading.paragraph_format.keep_with_next = True
    run = heading.add_run(f"镜头 {index:02d}｜{clean_markdown(time_value)}｜{clean_markdown(stage)}")
    set_font(run, 11.5, bold=True)
    for label, value in (("画面操作：", visual), ("口播：", voiceover), ("画面验收点：", acceptance)):
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.left_indent = Cm(0.35)
        paragraph.paragraph_format.space_after = Pt(3)
        lead = paragraph.add_run(label)
        set_font(lead, 10, bold=True)
        content = paragraph.add_run(clean_markdown(value))
        set_font(content, 10)


def parse_storyboard_rows(lines):
    rows = []
    for line in lines:
        if not line.strip().startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if not cells or cells[0] in ("时间", "---") or cells[0].startswith("---"):
            continue
        if len(cells) >= 5:
            rows.append(cells)
    return rows


def build():
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    doc = Document()
    configure(doc)

    section = ""
    storyboard_rows = parse_storyboard_rows(lines)
    storyboard_index = 0
    skip_storyboard_table = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("# "):
            add_title(doc, stripped[2:])
            continue
        if stripped.startswith("## "):
            if section == "五、分镜与口播脚本" and storyboard_rows:
                for cells in storyboard_rows:
                    storyboard_index += 1
                    add_storyboard_row(doc, storyboard_index, cells)
                storyboard_rows = []
            section = stripped[3:]
            add_heading(doc, section, level=1)
            skip_storyboard_table = section == "五、分镜与口播脚本"
            continue
        if skip_storyboard_table and stripped.startswith("|"):
            continue
        if section == "五、分镜与口播脚本":
            continue
        if re.match(r"^\d+\.\s+", stripped):
            add_body(doc, re.sub(r"^\d+\.\s+", "", stripped), numbered=True)
            continue
        if stripped.startswith("- "):
            add_body(doc, stripped[2:], bullet=True)
            continue
        add_body(doc, stripped)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
