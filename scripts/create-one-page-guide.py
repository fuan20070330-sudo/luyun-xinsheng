from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "老字号叙事工坊一页式使用说明.docx"
FONT = "Noto Sans SC"
BLACK = "000000"
LINE = "B7B7B7"
HEADER_FILL = "E7E6E6"


def set_font(run, size=8.7, bold=False):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor(0, 0, 0)
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), FONT)


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=55, start=75, bottom=55, end=75):
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


def configure(doc):
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.15)
    section.bottom_margin = Cm(1.0)
    section.left_margin = Cm(1.35)
    section.right_margin = Cm(1.35)
    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(8.7)
    normal.font.color.rgb = RGBColor(0, 0, 0)
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    normal.paragraph_format.line_spacing = 1.12
    normal.paragraph_format.space_after = Pt(1)


def add_heading(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(4)
    paragraph.paragraph_format.space_after = Pt(2)
    paragraph.paragraph_format.keep_with_next = True
    set_font(paragraph.add_run(text), 10.2, bold=True)


def add_step(doc, text):
    paragraph = doc.add_paragraph(style="List Number")
    paragraph.paragraph_format.space_after = Pt(1)
    paragraph.paragraph_format.line_spacing = 1.12
    set_font(paragraph.add_run(text), 8.5)


def add_bullet(doc, text):
    paragraph = doc.add_paragraph(style="List Bullet")
    paragraph.paragraph_format.space_after = Pt(1)
    paragraph.paragraph_format.line_spacing = 1.12
    set_font(paragraph.add_run(text), 8.4)


def add_table(doc):
    rows = [
        ("品牌类型 / 名称 / 语气", "山东传统糕点老字号 / 鲁香斋（模拟品牌） / 真诚、考究、克制"),
        ("品牌资料（可直接粘贴）", "品牌档案：鲁香斋始创于1918年。\n传统枣泥酥包含选枣、蒸制、炒馅、包制和烘烤五道主要工序。\n品牌资料登记为山东老字号。\n产品包括低糖枣泥酥、山楂锅盔、桂花酥和节令礼盒。\n品牌强调保留传统口感并优化含糖量。"),
        ("受访内容", "品牌传承人表示，年轻化不能改变关键工序，要让年轻人知道每一步为什么这样做。"),
        ("创作要求", "受众：25-35岁关注地方文化的城市消费者；主题：一块枣泥酥里的山东老味道；目标：建立品牌记忆点并形成内容日历；限制：不承诺功效，年份只使用档案原文，非遗身份待核实。"),
        ("品牌规则 / 宣传方法", "标准表达：鲁香斋、枣泥酥；禁用表达：宫廷御用、国家级非遗、降血糖、最正宗。选择品牌故事线、文化知识科普、场景化种草。"),
    ]
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    headers = ("填写位置", "可直接使用的演示内容")
    for i, text in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.width = Cm(4.0 if i == 0 else 13.7)
        set_cell_shading(cell, HEADER_FILL)
        set_cell_margins(cell)
        set_font(cell.paragraphs[0].add_run(text), 8.6, bold=True)
    for label, value in rows:
        cells = table.add_row().cells
        for i, text in enumerate((label, value)):
            cell = cells[i]
            cell.width = Cm(4.0 if i == 0 else 13.7)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cell)
            lines = text.split("\n")
            paragraph = cell.paragraphs[0]
            paragraph.paragraph_format.space_after = Pt(0)
            paragraph.paragraph_format.line_spacing = 1.05
            set_font(paragraph.add_run(lines[0]), 8.0, bold=(i == 0))
            for line in lines[1:]:
                p = cell.add_paragraph()
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.05
                set_font(p.add_run(line), 8.0)


def build():
    doc = Document()
    configure(doc)
    title = doc.add_paragraph()
    title.paragraph_format.space_after = Pt(2)
    set_font(title.add_run("老字号叙事工坊一页式使用说明"), 17, bold=True)
    url = doc.add_paragraph()
    url.paragraph_format.space_after = Pt(5)
    set_font(url.add_run("访问：https://fuan20070330-sudo.github.io/luyun-xinsheng/    评审可按以下步骤独立跑通，无需额外资料。"), 8.5, bold=True)

    add_heading(doc, "一、生成文稿（约 3 分钟）")
    add_step(doc, "打开网址，点击“注册新账号”，使用任意邮箱（如 review01@example.com）和至少 8 位密码；不发送验证码，注册后自动进入。")
    add_step(doc, "选择“生成文稿”。在基本信息页填写品牌类型、名称和语气，点击“下一步：录入品牌资料”。")
    add_step(doc, "在品牌资料页粘贴下方“品牌资料”，点击“下一步：填写访谈记录”。")
    add_step(doc, "在访谈页粘贴“受访内容”，点击“提取事实并进入下一步”。看到 Fxxx 编号事实后继续。")
    add_step(doc, "在创作要求页选择“小红书”和“完整叙事包”，填写下方的受众、主题、目标、限制条件、品牌规则，并勾选三种宣传方法。")
    add_step(doc, "点击“生成内容方案”。等待页面生成四份成果，右上角应显示“已连接”。")
    add_step(doc, "在“04｜事实证据与内容证明”中点击“确认所有有来源事实”。若出现风险提示，先修改或退回；证据门禁无阻断项后再进行品牌确认。")
    add_step(doc, "检查四份大卡片中的品牌故事、内容日历、多平台文案和年轻化表达；点击“导出内容日历”或“导出完整确认包”，再点击底部“进入人工审核”查看留痕。")

    add_heading(doc, "二、验证修改文稿（约 2 分钟）")
    add_step(doc, "点击顶部“工作台”，进入“修改文稿”；从历史生成稿中选择一篇，或导入 TXT/Markdown/JSON/CSV 文件。")
    add_step(doc, "填写修改要求，例如“压缩到 260 字以内，保留 1918 年和五道工序，语气自然，不新增资料外事实”，点击“先排查问题语段”。")
    add_step(doc, "点击“按要求生成修订稿”，在“逐段修订建议”中接受、忽略或手动编辑一条建议，再点击“保存改稿记录”。")

    add_heading(doc, "三、可直接使用的演示内容")
    add_table(doc)

    add_heading(doc, "四、评审时看什么")
    add_bullet(doc, "四项结果是否齐全：品牌故事、内容日历、多平台文案、年轻化表达。")
    add_bullet(doc, "每条事实是否有 Fxxx 编号、来源位置和证据状态；公开验证页是否显示“数字签名有效”。")
    add_bullet(doc, "修改前后是否有记录；协作审核是否包含成员角色、评论或审批动作。")

    add_heading(doc, "五、常见问题")
    add_bullet(doc, "右上角“已断开”：稿件仍可生成，系统自动使用本地处理模式；重新连接后刷新页面即可。")
    add_bullet(doc, "无法点击“品牌确认”：先到“04｜事实证据与内容证明”确认有来源事实，并处理高风险或禁用表达。")
    add_bullet(doc, "看不到公开验证：在“内容护照”中等待“已签名”，再点击“公开验证内容护照”。")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
