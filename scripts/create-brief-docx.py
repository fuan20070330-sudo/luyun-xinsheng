from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "老字号叙事工坊项目简要说明.docx"
FONT = "Noto Sans SC"


def set_font(run, size=10.5, bold=False):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor(0, 0, 0)
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), FONT)


def add_heading(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(10)
    paragraph.paragraph_format.space_after = Pt(4)
    paragraph.paragraph_format.keep_with_next = True
    run = paragraph.add_run(text)
    set_font(run, size=12, bold=True)
    return paragraph


def add_bullet(doc, text):
    paragraph = doc.add_paragraph(style="List Bullet")
    paragraph.paragraph_format.space_after = Pt(3)
    paragraph.paragraph_format.line_spacing = 1.45
    run = paragraph.add_run(text)
    set_font(run)
    return paragraph


def add_number(doc, text):
    paragraph = doc.add_paragraph(style="List Number")
    paragraph.paragraph_format.space_after = Pt(3)
    paragraph.paragraph_format.line_spacing = 1.45
    run = paragraph.add_run(text)
    set_font(run)
    return paragraph


def build():
    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)
    section.left_margin = Cm(2.0)
    section.right_margin = Cm(2.0)

    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor(0, 0, 0)
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    normal.paragraph_format.line_spacing = 1.45
    normal.paragraph_format.space_after = Pt(3)

    title = doc.add_paragraph()
    title.paragraph_format.space_after = Pt(14)
    title.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = title.add_run("老字号叙事工坊项目简要说明")
    set_font(run, size=18, bold=True)

    add_heading(doc, "一、目标用户")
    add_bullet(doc, "山东老字号企业的品牌、文化与新媒体运营人员。")
    add_bullet(doc, "非遗传承人、传统工坊及文创品牌的内容编辑。")
    add_bullet(doc, "负责事实确认、文化判断和最终发布的品牌负责人、审核人员。")

    add_heading(doc, "二、嵌入环节")
    add_number(doc, "资料整理：汇总品牌历史、产品资料、荣誉信息和受访原话。")
    add_number(doc, "事实入库：提取带编号和历史来源的品牌事实，无法确认的信息标记为“待核实”。")
    add_number(doc, "内容生产：按平台生成内容，或导入已有广告语、脚本和历史生成稿进行修改。")
    add_number(doc, "发布前检查：执行事实证明、医疗功效、虚假荣誉、绝对化宣传和品牌禁用词检查。")
    add_number(doc, "人工审核：由品牌方和审核人员确认、退回或批准，并保存审核记录。")

    add_heading(doc, "三、价值预期")
    add_bullet(doc, "减少品牌资料检索、初稿整理、多平台改写和重复审核的时间。")
    add_bullet(doc, "通过事实引用、风险提示和发布门禁，降低无依据年份、虚假荣誉及医疗功效宣传风险。")
    add_bullet(doc, "保留 AI 原稿、人工修改稿、模型版本、提示词和审核记录，形成可追溯内容资产。")

    add_heading(doc, "四、核心功能")
    add_bullet(doc, "品牌知识库：事实编号、分类、原文定位、来源指纹及品牌标准表达管理。")
    add_bullet(doc, "双工作线：一条生成新文稿，一条修改已有文稿；修改线支持逐段建议和人工编辑。")
    add_bullet(doc, "多平台内容：生成品牌故事、内容日历、多平台文案和年轻化表达。")
    add_bullet(doc, "风险与证据：逐句声明检查、发布门禁、内容证明、数字签名及公开验证。")
    add_bullet(doc, "协作与留痕：支持邮箱邀请、角色权限、评论、审批以及账号数据导出。")

    add_heading(doc, "五、技术路径")
    add_bullet(doc, "前端：原生 HTML、CSS 和 JavaScript，无构建依赖，部署于 GitHub Pages。")
    add_bullet(doc, "服务端：Node.js 提供 HTTP API 与 WebSocket /ws 服务，使用 PostgreSQL 保存数据。")
    add_bullet(doc, "模型适配：后端读取模型密钥并调用远程模型；未配置或调用失败时回退本地确定性引擎。")
    add_bullet(doc, "可信校验：共享事实、风险、证明和证据门禁模块，服务端审批时再次校验。")
    add_bullet(doc, "部署链路：网页端 → WebSocket/API → 网关 → 模型 → 证据校验 → 数据库 → 审核与导出。")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
