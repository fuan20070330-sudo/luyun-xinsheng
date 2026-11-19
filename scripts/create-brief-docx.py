from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "简要说明文件.docx"
FONT = "Noto Sans SC"


def set_font(run, size, bold=False):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor(0, 0, 0)
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), FONT)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), FONT)


def add_section(doc, heading, text):
    heading_paragraph = doc.add_paragraph()
    heading_paragraph.paragraph_format.space_before = Pt(9)
    heading_paragraph.paragraph_format.space_after = Pt(3)
    heading_paragraph.paragraph_format.keep_with_next = True
    heading_run = heading_paragraph.add_run(heading)
    set_font(heading_run, 12, bold=True)

    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    paragraph.paragraph_format.first_line_indent = Cm(0.74)
    paragraph.paragraph_format.line_spacing = 1.55
    paragraph.paragraph_format.space_after = Pt(2)
    run = paragraph.add_run(text)
    set_font(run, 10.5)


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
    normal.paragraph_format.space_after = Pt(2)

    title = doc.add_paragraph()
    title.paragraph_format.space_after = Pt(12)
    title_run = title.add_run("老字号叙事工坊项目简要说明")
    set_font(title_run, 18, bold=True)

    add_section(
        doc,
        "一、目标用户",
        "本项目主要面向山东老字号企业的品牌、文化与新媒体运营人员，非遗传承人、传统工坊以及文创品牌的内容编辑，也服务于负责事实确认、文化判断和最终发布的品牌负责人和审核人员。这些用户通常需要同时处理分散的历史档案、产品资料、荣誉记录和受访内容，并在有限时间内完成多平台表达和发布前审核。",
    )
    add_section(
        doc,
        "二、嵌入环节",
        "系统嵌入在品牌内容生产的前期整理、内容生产和发布前审核环节中。用户先汇总品牌历史、产品资料、荣誉信息和受访原话，系统提取带编号和来源位置的品牌事实，并将没有来源的内容标记为“待核实”；随后用户可以选择生成新文稿或修改已有文稿，生成品牌故事、内容日历、多平台文案和年轻化表达，或导入广告语、脚本和历史生成稿进行逐段修订；在发布前，系统继续检查医疗功效、虚假荣誉、绝对化宣传、品牌禁用词和事实引用，最后交由品牌方人工确认。",
    )
    add_section(
        doc,
        "三、价值预期",
        "该工具预期减少品牌资料检索、初稿整理、多平台适配和重复修改所需的时间，让内容人员把更多精力放在事实确认和文化判断上。通过事实编号、原文定位、风险提示和发布门禁，可以降低无依据年份、虚假荣誉、无法验证工艺及医疗功效宣传的风险。所有 AI 原稿、人工修改稿、模型版本、提示词、内容证明和审核记录都会被保留，使企业能够回溯每一项对外表达的来源，并逐步形成可复用的品牌内容资产。",
    )
    add_section(
        doc,
        "四、核心功能",
        "系统提供可追溯的品牌知识库，对历史、工艺、人物、产品、荣誉和访谈内容进行分类并关联原文；提供“生成文稿”和“修改文稿”两条工作线，支持多平台内容生成、已有文件导入、历史稿选择和逐段修订；提供逐句声明检查、风险分级、发布证据门禁、内容护照和公开验证；同时支持广告词候选、多人协作、邮箱邀请、角色权限、评论、审批和账号数据导出，覆盖从资料整理到审核留痕的主要工作。",
    )
    add_section(
        doc,
        "五、技术路径",
        "前端采用原生 HTML、CSS 和 JavaScript，无构建依赖，全部静态资源使用相对路径并部署于 GitHub Pages。服务端使用 Node.js 提供 HTTP API 和 WebSocket /ws 服务，通过邮箱密码账号、HttpOnly Cookie、CSRF 校验和 PostgreSQL 管理用户及内容数据。AI 适配层由后端读取模型密钥并调用远程模型，前端不保存 API Key；未配置模型或调用失败时自动回退本地确定性引擎，并明确标注运行模式。共享事实、风险、证明、证据门禁和内容护照模块负责可信校验，服务端在协作审批时再次执行证据检查，最终形成网页端、网关、模型、校验、数据库和人工审核之间的完整链路。",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
