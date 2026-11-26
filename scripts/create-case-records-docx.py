import json
from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tests" / "artifacts" / "run-case-records.json"
OUTPUT = ROOT / "docs" / "老字号叙事工坊完整运行案例记录.docx"
FONT = "Noto Sans SC"
TITLE_FONT = "Noto Serif SC"
BLACK = "000000"
MUTED = "666666"
LINE = "B7B7B7"
HEADER_FILL = "E7E6E6"
ALT_FILL = "F7F7F7"


def rgb(value):
    return RGBColor.from_string(value)


def set_font(run, size=10, bold=False, color=BLACK, font=FONT):
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = rgb(color)
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), font)
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), font)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), font)


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=80, start=100, bottom=80, end=100):
    tc_pr = cell._tc.get_or_add_tcPr()
    margins = tc_pr.first_child_found_in("w:tcMar")
    if margins is None:
        margins = OxmlElement("w:tcMar")
        tc_pr.append(margins)
    for side, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = margins.find(qn(f"w:{side}"))
        if node is None:
            node = OxmlElement(f"w:{side}")
            margins.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        node = borders.find(qn(f"w:{edge}"))
        if node is None:
            node = OxmlElement(f"w:{edge}")
            borders.append(node)
        node.set(qn("w:val"), "single")
        node.set(qn("w:sz"), "4")
        node.set(qn("w:space"), "0")
        node.set(qn("w:color"), LINE)


def repeat_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    marker = OxmlElement("w:tblHeader")
    marker.set(qn("w:val"), "true")
    tr_pr.append(marker)


def add_page_number(paragraph):
    run = paragraph.add_run("第 ")
    set_font(run, 8.5, color=MUTED)
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
    set_font(tail, 8.5, color=MUTED)


def configure(doc):
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.55)
    section.left_margin = Cm(1.85)
    section.right_margin = Cm(1.85)
    section.header_distance = Cm(0.7)
    section.footer_distance = Cm(0.7)
    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(9.8)
    normal.font.color.rgb = rgb(BLACK)
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    normal.paragraph_format.line_spacing = 1.3
    normal.paragraph_format.space_after = Pt(3)
    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_font(header.add_run("老字号叙事工坊｜完整运行案例记录"), 8.5, color=MUTED)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_page_number(footer)


def add_title(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(10)
    set_font(paragraph.add_run(text), 20, bold=True, font=TITLE_FONT)


def add_h1(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(10)
    paragraph.paragraph_format.space_after = Pt(5)
    paragraph.paragraph_format.keep_with_next = True
    set_font(paragraph.add_run(text), 15, bold=True, font=TITLE_FONT)


def add_h2(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(8)
    paragraph.paragraph_format.space_after = Pt(3)
    paragraph.paragraph_format.keep_with_next = True
    set_font(paragraph.add_run(text), 11.5, bold=True)


def add_h3(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(6)
    paragraph.paragraph_format.space_after = Pt(2)
    paragraph.paragraph_format.keep_with_next = True
    set_font(paragraph.add_run(text), 10.5, bold=True)


def add_body(doc, text, size=9.8):
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    paragraph.paragraph_format.first_line_indent = Cm(0.7)
    paragraph.paragraph_format.line_spacing = 1.3
    set_font(paragraph.add_run(str(text)), size)


def add_number(doc, text):
    paragraph = doc.add_paragraph(style="List Number")
    paragraph.paragraph_format.space_after = Pt(2)
    paragraph.paragraph_format.line_spacing = 1.25
    set_font(paragraph.add_run(str(text)), 9.7)


def add_label_paragraph(doc, label, value):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(0)
    paragraph.paragraph_format.line_spacing = 1.1
    paragraph.paragraph_format.keep_together = True
    set_font(paragraph.add_run(label + "："), 8.9, bold=True)
    lines = str(value if value is not None else "").split("\n")
    for index, line in enumerate(lines):
        run = paragraph.add_run(line)
        set_font(run, 8.9)
        if index < len(lines) - 1:
            run.add_break()


def write_cell(cell, value, bold=False):
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_cell_margins(cell)
    lines = str(value if value is not None else '').split('\n')
    paragraph = cell.paragraphs[0]
    paragraph.paragraph_format.space_after = Pt(0)
    set_font(paragraph.add_run(lines[0]), 8.8, bold=bold)
    for line in lines[1:]:
        p = cell.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        set_font(p.add_run(line), 8.8, bold=bold)


def add_two_col_table(doc, rows, widths=(3.2, 13.4)):
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    repeat_header(table.rows[0])
    for i, text in enumerate(("项目", "记录")):
        cell = table.rows[0].cells[i]
        cell.width = Cm(widths[i])
        set_cell_shading(cell, HEADER_FILL)
        write_cell(cell, text, bold=True)
    for index, (label, value) in enumerate(rows):
        cells = table.add_row().cells
        cells[0].width = Cm(widths[0])
        cells[1].width = Cm(widths[1])
        if index % 2 == 1:
            set_cell_shading(cells[0], ALT_FILL)
            set_cell_shading(cells[1], ALT_FILL)
        write_cell(cells[0], label, bold=True)
        write_cell(cells[1], value)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def add_artifact_content(doc, artifact):
    add_h3(doc, f"{artifact.get('title', artifact.get('id'))}｜{artifact.get('id')}｜{artifact.get('status', 'draft')}")
    add_body(doc, "事实引用：" + ("、".join(artifact.get("factRefs") or []) or "待补充"), size=9.2)
    content = str(artifact.get("content") or "")
    for line in content.split('\n'):
        if not line.strip():
            continue
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.left_indent = Cm(0.25)
        paragraph.paragraph_format.space_after = Pt(1)
        paragraph.paragraph_format.line_spacing = 1.18
        set_font(paragraph.add_run(line), 8.8)


def add_case(doc, case, index):
    if index > 0:
        doc.add_page_break()
    add_h1(doc, f"案例 {index + 1}｜{case['category']}｜{case['title']}")

    add_h2(doc, "一、输入")
    input_data = case.get("input", {})
    rows = []
    for key, label in (
        ("brand", "品牌"), ("sourceFile", "来源文件"), ("sourceHash", "文件 SHA-256"),
        ("materials", "品牌资料"), ("rawText", "边界原文"), ("platform", "发布平台"),
        ("contentType", "内容类型"), ("audience", "目标受众"), ("theme", "传播主题"),
        ("goal", "传播目标"), ("constraints", "限制条件"), ("promotionMethods", "宣传方法"),
        ("requiredTerms", "必须检查的表述"), ("brandRules", "品牌规则"),
    ):
        if key not in input_data:
            continue
        value = input_data[key]
        if key == "brand" and isinstance(value, dict):
            value = "；".join(f"{name}：{value.get(name, '')}" for name in ("name", "type", "tone"))
        elif key == "brandRules" and isinstance(value, dict):
            value = "标准表达：" + "、".join(value.get("preferredTerms", [])) + "；禁用表达：" + "、".join(value.get("bannedTerms", []))
        elif isinstance(value, dict):
            value = json.dumps(value, ensure_ascii=False, indent=2)
        elif isinstance(value, list):
            value = "、".join(str(item) for item in value)
        rows.append((label, value))
    add_two_col_table(doc, rows)

    add_h2(doc, "二、运行过程")
    for step in case.get("process", []):
        add_number(doc, step)

    add_h2(doc, "三、最终输出")
    output = case.get("output", {})
    add_body(doc, output.get("keyResult", ""))
    if output.get("artifactSummary"):
        for artifact in output["artifactSummary"]:
            add_artifact_content(doc, artifact)
    if output.get("analysis"):
        analysis = output["analysis"]
        add_h3(doc, "边界内容分析结果")
        add_label_paragraph(doc, "高风险数量", analysis.get("highRiskCount", 0))
        add_label_paragraph(doc, "分析状态", analysis.get("status", ""))
        add_label_paragraph(doc, "逐句结果", "\n".join(f"{item.get('index')}. {item.get('status')}：{item.get('sentence')}" for item in analysis.get("sentences", [])))
        add_label_paragraph(doc, "识别风险", "\n".join(f"{item.get('level')}｜{item.get('type')}｜{item.get('term')}｜{item.get('reason')}" for item in analysis.get("risks", [])))
        add_label_paragraph(doc, "安全改写参考", analysis.get("safeRewrite", ""))
    if output.get("finalText"):
        add_h3(doc, "人工修订后的最终文本")
        add_body(doc, output["finalText"])

    add_h2(doc, "四、人工修改记录")
    review = case.get("humanReview", {})
    add_label_paragraph(doc, "审核人", review.get("reviewer", ""))
    add_label_paragraph(doc, "审核动作", review.get("action", ""))
    add_label_paragraph(doc, "审核时间", review.get("reviewedAt", ""))
    add_label_paragraph(doc, "修改前", review.get("before", ""))
    add_label_paragraph(doc, "修改后", review.get("after", ""))
    add_label_paragraph(doc, "修改说明", review.get("note", ""))

    add_h2(doc, "五、验证结果")
    verification = case.get("verification", {})
    verification_items = []
    for key, label in (
        ("facts", "事实数量"), ("artifacts", "成果数量"), ("roleReviews", "角色审查数量"),
        ("highRiskBeforeEdit", "修改前高风险"), ("artifactRiskCount", "正文风险数"),
        ("highRiskTerms", "高风险表述"), ("highRiskCount", "高风险数量"), ("blockedClaims", "已阻止声明"),
        ("gateStatus", "证据门禁"), ("beforeGateStatus", "修改前门禁"), ("beforeGateBlockers", "修改前阻断项"),
        ("afterGateStatus", "修改后门禁"), ("afterGateBlockers", "修改后阻断项"),
        ("safeRewriteHighRisk", "安全改写后高风险"), ("factReferencesPresent", "成果是否均含事实引用"),
    ):
        if key not in verification:
            continue
        value = verification[key]
        if isinstance(value, list):
            value = "；".join(item.get("message", str(item)) if isinstance(item, dict) else str(item) for item in value) or "无"
        verification_items.append(f"{label}：{value}")
    add_label_paragraph(doc, "验证指标", "；".join(verification_items))
    add_label_paragraph(doc, "结论", verification.get("consistency", ""))


def build():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    doc = Document()
    configure(doc)
    add_title(doc, data.get("title", "老字号叙事工坊完整运行案例记录"))
    add_body(doc, f"版本：{data.get('version', '')}｜生成时间：{data.get('generatedAt', '')}")
    add_body(doc, data.get("environment", ""))
    add_body(doc, "以下三个案例分别使用“鲁香斋（模拟品牌）”“泉城茶食铺（模拟品牌）”和“沂蒙山果坊（模拟品牌）”三个虚构品牌及原型演示数据，覆盖典型场景、复杂输入和边界输入。每个案例均记录输入、运行过程、最终输出、人工修改记录和验证结果。")
    for index, case in enumerate(data.get("cases", [])):
        add_case(doc, case, index)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
