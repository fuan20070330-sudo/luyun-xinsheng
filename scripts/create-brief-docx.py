from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "老字号叙事工坊项目简要说明.docx"

INK = "2D332F"
MUTED = "6E716B"
CINNABAR = "8F3028"
JADE = "1F6D5C"
PAPER = "FBF7ED"
LINE = "D7CBB7"
WHITE = "FFFFFF"


def rgb(hex_value):
    return RGBColor.from_string(hex_value)


def set_run_font(run, name="Noto Sans SC", size=10.5, bold=False, color=INK):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = rgb(color)
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=90, start=110, bottom=90, end=110):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_table_borders(table, color=LINE, size="4"):
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
        node.set(qn("w:sz"), size)
        node.set(qn("w:space"), "0")
        node.set(qn("w:color"), color)


def add_hyperlink(paragraph, text, url):
    part = paragraph.part
    relation_id = part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), relation_id)
    run = OxmlElement("w:r")
    r_pr = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), JADE)
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    r_pr.extend([color, underline])
    run.append(r_pr)
    content = OxmlElement("w:t")
    content.text = text
    run.append(content)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)


def add_page_number(paragraph):
    run = paragraph.add_run("第 ")
    set_run_font(run, size=8.5, color=MUTED)
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
    set_run_font(tail, size=8.5, color=MUTED)


def add_heading(doc, number, title):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(7)
    paragraph.paragraph_format.space_after = Pt(4)
    number_run = paragraph.add_run(f"{number}  ")
    set_run_font(number_run, name="Noto Serif SC", size=11.5, bold=True, color=CINNABAR)
    title_run = paragraph.add_run(title)
    set_run_font(title_run, name="Noto Serif SC", size=14, bold=True, color=INK)
    return paragraph


def add_body(doc, text, bold_lead=None, size=10.5, color=INK, after=4):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(after)
    paragraph.paragraph_format.line_spacing = 1.25
    if bold_lead and text.startswith(bold_lead):
        lead = paragraph.add_run(bold_lead)
        set_run_font(lead, size=size, bold=True, color=color)
        body = paragraph.add_run(text[len(bold_lead):])
        set_run_font(body, size=size, color=color)
    else:
        run = paragraph.add_run(text)
        set_run_font(run, size=size, color=color)
    return paragraph


def add_bullet(doc, text, color=INK):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.left_indent = Cm(0.35)
    paragraph.paragraph_format.first_line_indent = Cm(-0.25)
    paragraph.paragraph_format.space_after = Pt(3)
    marker = paragraph.add_run("• ")
    set_run_font(marker, size=10.5, bold=True, color=CINNABAR)
    run = paragraph.add_run(text)
    set_run_font(run, size=10.5, color=color)
    return paragraph


def add_info_box(doc, title, lines):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    set_table_borders(table, color="E5D8C3", size="5")
    cell = table.cell(0, 0)
    set_cell_shading(cell, PAPER)
    set_cell_margins(cell, top=110, start=160, bottom=110, end=160)
    paragraph = cell.paragraphs[0]
    paragraph.paragraph_format.space_after = Pt(5)
    run = paragraph.add_run(title)
    set_run_font(run, name="Noto Serif SC", size=11, bold=True, color=CINNABAR)
    for line in lines:
        p = cell.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.25
        r = p.add_run(line)
        set_run_font(r, size=9.8, color=INK)


def add_two_col_table(doc, rows, widths=(4.3, 12.4), header=None, font_size=9.3):
    table = doc.add_table(rows=1 if header else 0, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    if header:
        set_repeat_table_header(table.rows[0])
        for i, text in enumerate(header):
            cell = table.rows[0].cells[i]
            cell.width = Cm(widths[i])
            set_cell_shading(cell, "36413A")
            set_cell_margins(cell)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(text)
            set_run_font(r, size=9.3, bold=True, color=WHITE)
    for idx, (left, right) in enumerate(rows):
        cells = table.add_row().cells
        for i, text in enumerate((left, right)):
            cell = cells[i]
            cell.width = Cm(widths[i])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cell)
            if idx % 2 == 1:
                set_cell_shading(cell, "FAF6EC")
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.2
            r = p.add_run(text)
            set_run_font(r, size=font_size, bold=(i == 0), color=INK if i == 0 else "3E443F")
    return table


def configure_document(doc):
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.2)
    section.bottom_margin = Cm(1.0)
    section.left_margin = Cm(1.5)
    section.right_margin = Cm(1.5)
    section.header_distance = Cm(0.65)
    section.footer_distance = Cm(0.65)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Noto Sans SC"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = rgb(INK)
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Noto Sans SC")
    normal.paragraph_format.space_after = Pt(4)
    normal.paragraph_format.line_spacing = 1.2

    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hr = header.add_run("老字号叙事工坊｜项目简要说明")
    set_run_font(hr, size=8.5, color=MUTED)

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fr = footer.add_run("AI 传播工具创新赛道｜2026 年 11 月｜")
    set_run_font(fr, size=8.5, color=MUTED)
    add_page_number(footer)


def build():
    doc = Document()
    configure_document(doc)

    title = doc.add_paragraph()
    title.paragraph_format.space_before = Pt(7)
    title.paragraph_format.space_after = Pt(4)
    tr = title.add_run("老字号叙事工坊项目简要说明")
    set_run_font(tr, name="Noto Serif SC", size=21, bold=True, color=INK)

    subtitle = doc.add_paragraph()
    subtitle.paragraph_format.space_after = Pt(7)
    sr = subtitle.add_run("面向山东老字号、非遗与文创品牌的内容共创与审核工具")
    set_run_font(sr, size=10.5, color=CINNABAR)

    meta = doc.add_paragraph()
    meta.paragraph_format.space_after = Pt(10)
    mr = meta.add_run("作品形式：响应式网页应用｜版本：v3.8.1｜项目地址：")
    set_run_font(mr, size=9, color=MUTED)
    add_hyperlink(meta, "fuan20070330-sudo.github.io/luyun-xinsheng", "https://fuan20070330-sudo.github.io/luyun-xinsheng/")

    add_info_box(doc, "项目概述", [
        "系统把分散的品牌历史、产品资料和受访记录整理为带编号的可追溯事实，再完成多平台生成、改稿、风险校验与人工审核。AI 只把知识库内容作为确定事实，无来源信息标记“待核实”；“鲁香斋”为虚构模拟品牌，仅用于演示。",
    ])

    add_heading(doc, "01", "目标用户")
    add_bullet(doc, "山东老字号企业的品牌、文化与新媒体运营人员，以及非遗传承人、工坊和文创品牌的内容编辑。")
    add_bullet(doc, "需要确认品牌事实、文化表达与最终发布内容的品牌负责人和审核人。")

    add_heading(doc, "02", "嵌入环节")
    add_two_col_table(doc, [
        ("资料整理", "汇总品牌档案、产品资料、荣誉登记和受访原话；支持文本与文件导入。"),
        ("事实入库", "提取历史、工艺、人物、产品等事实，保留原文、来源位置和文件指纹。"),
        ("内容生产", "按平台生成内容，或导入已有广告语、脚本和历史生成稿进行修改。"),
        ("校验门禁", "执行逐句事实证明、医疗功效、虚假荣誉、绝对化宣传和品牌禁用词检查。"),
        ("审核发布", "由品牌方和审核角色确认、退回或批准，保留版本、评论和审批记录。"),
    ], widths=(3.1, 13.6), font_size=8.8)
    add_body(doc, "工具嵌入企业现有内容生产流程，不替代品牌方审批，而是把资料准备、初稿生产和发布前检查集中在同一账号空间内完成。", size=9.3, color=MUTED, after=2)

    add_heading(doc, "03", "价值预期")
    add_body(doc, "提升效率：把资料检索、初稿整理、多平台适配和改稿集中到一次任务，减少重复编辑与人工搬运。", bold_lead="提升效率：", size=9.7, after=2)
    add_body(doc, "降低风险：用事实引用、证据门禁和逐句风险提示，减少无依据年份、虚假荣誉和医疗功效宣传。", bold_lead="降低风险：", size=9.7, after=2)
    add_body(doc, "沉淀资产：保留 AI 原稿、人工稿、模型版本、提示词、内容护照和审核记录，形成可回溯的品牌内容资产。", bold_lead="沉淀资产：", size=9.7, after=2)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    add_heading(doc, "04", "核心功能")
    add_two_col_table(doc, [
        ("品牌知识库", "事实编号、分类、原文定位、来源哈希、待核实状态与品牌标准/禁用表达。"),
        ("双工作线", "“生成文稿”处理新内容；“修改文稿”支持文件导入、历史稿选择和逐段修订。"),
        ("多平台生成", "输出品牌故事、内容日历、多平台文案和年轻化表达；成果区采用清晰的分区布局。"),
        ("风险与证据", "逐句 Claim Trace、发布门禁、内容证明、HMAC 数字签名和公开验证页。"),
        ("广告词实验室", "从已确认事实生成短广告语，标注角度、事实依据、自然度与套话检查。"),
        ("协作与留痕", "邀请邮箱成员，分配编辑/审核/品牌负责人角色，保存评论、审批和账号数据。"),
    ], widths=(3.3, 13.4), header=("功能模块", "说明"), font_size=9.2)

    add_heading(doc, "05", "技术路径")
    add_body(doc, "前端：原生 HTML、CSS、JavaScript，无构建依赖，全部静态资源使用相对路径，部署于 GitHub Pages。", bold_lead="前端：", size=9.8, after=3)
    add_body(doc, "服务端：Node.js 提供 HTTP API 与真实 WebSocket /ws 服务；邮箱密码账号、HttpOnly Cookie、CSRF、限流和 PostgreSQL 存储。", bold_lead="服务端：", size=9.8, after=3)
    add_body(doc, "AI 适配：通过后端读取模型密钥并调用 OpenAI 或兼容接口；前端不保存 API Key，模型失败或未配置时回退本地确定性引擎并明确提示。", bold_lead="AI 适配：", size=9.8, after=3)
    add_body(doc, "可信层：共享事实、风险、证明、证据门禁和内容护照模块；审批接口在服务端再次执行证据检查，避免只依赖前端状态。", bold_lead="可信层：", size=9.8, after=3)
    add_body(doc, "部署链路：浏览器 → WebSocket/API → 网关 → 模型或本地引擎 → 事实与风险校验 → PostgreSQL → 审核与导出。", bold_lead="部署链路：", size=9.8, after=4)

    add_info_box(doc, "当前上线状态与边界", [
        "正式页面已部署到 GitHub Pages，实时网关运行在 Render，数据库使用 PostgreSQL。未配置 OpenAI API Key 时，系统使用本地确定性引擎，不伪造远程模型调用结果。",
        "官方山东老字号/非遗名录接口尚未配置；当前权威核验由品牌确认、原文证据及公开来源二级核验组成，法律意见和最终发布决策仍由人工完成。",
    ])

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
