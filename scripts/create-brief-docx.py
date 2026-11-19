from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "老字号叙事工坊项目简要说明.docx"
FONT = "Noto Sans SC"


def set_font(run, size, bold=False):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor(0, 0, 0)
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), FONT)


def build():
    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.2)
    section.right_margin = Cm(2.2)

    normal = doc.styles["Normal"]
    normal.font.name = FONT
    normal.font.size = Pt(11)
    normal.font.color.rgb = RGBColor(0, 0, 0)
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    normal.paragraph_format.space_after = Pt(0)

    title = doc.add_paragraph()
    title.paragraph_format.space_after = Pt(14)
    title.alignment = WD_ALIGN_PARAGRAPH.LEFT
    title_run = title.add_run("老字号叙事工坊项目简要说明")
    set_font(title_run, 18, bold=True)

    text = (
        "老字号叙事工坊面向山东老字号企业的品牌、文化与新媒体运营人员，非遗传承人、传统工坊及文创品牌的内容编辑，以及负责事实确认、文化判断和最终发布的品牌负责人与审核人员。"
        "系统嵌入品牌内容生产的资料整理、事实入库、内容生产、发布前检查和人工审核环节：先汇总品牌历史、产品资料、荣誉信息和受访原话，再提取带编号和来源位置的品牌事实，将无来源内容标记为“待核实”；随后按平台生成品牌故事、内容日历、多平台文案和年轻化表达，或导入已有广告语、脚本和历史生成稿进行修改，并在发布前检查医疗功效、虚假荣誉、绝对化宣传、品牌禁用词和事实引用。"
        "价值预期主要体现在三个方面：一是把资料检索、初稿整理、多平台适配和改稿集中到一次任务中，减少重复编辑和人工搬运；二是通过事实引用、风险提示和发布门禁，降低无依据年份、虚假荣誉及医疗功效宣传风险；三是保留 AI 原稿、人工修改稿、模型版本、提示词、内容证明和审核记录，使内容可以回溯，也便于企业持续复用。"
        "核心功能包括可追溯的品牌知识库、生成文稿与修改文稿两条工作线、小红书和抖音及微信公众号等多平台内容生成、逐段修订与广告词候选、事实和风险校验、发布证据门禁、内容护照、多人协作审核以及账号数据导出。"
        "技术路径上，前端使用原生 HTML、CSS 和 JavaScript，无构建依赖，部署于 GitHub Pages；服务端使用 Node.js 提供 HTTP API 和 WebSocket /ws 服务，通过邮箱密码账号、HttpOnly Cookie、CSRF 和 PostgreSQL 保存数据；AI 适配层由后端读取模型密钥并调用远程模型，未配置或调用失败时回退到本地确定性引擎，前端不保存任何 API Key；共享事实、风险、证明和证据门禁模块负责事实与声明校验，服务端在协作审批时再次执行证据检查，最终形成网页端、网关、模型、校验、数据库和人工审核之间的完整链路。"
    )
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    paragraph.paragraph_format.first_line_indent = Cm(0.78)
    paragraph.paragraph_format.line_spacing = 1.65
    run = paragraph.add_run(text)
    set_font(run, 11)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
