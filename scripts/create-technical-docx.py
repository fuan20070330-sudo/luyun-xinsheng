from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "老字号叙事工坊技术说明.docx"
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
    normal.font.size = Pt(10)
    normal.font.color.rgb = rgb(BLACK)
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    normal.paragraph_format.line_spacing = 1.35
    normal.paragraph_format.space_after = Pt(4)
    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_font(header.add_run("老字号叙事工坊｜技术说明"), 8.5, color=MUTED)
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_page_number(footer)


def add_title(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(14)
    set_font(paragraph.add_run(text), 20, bold=True, font=TITLE_FONT)


def add_h1(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(14)
    paragraph.paragraph_format.space_after = Pt(5)
    paragraph.paragraph_format.keep_with_next = True
    set_font(paragraph.add_run(text), 14, bold=True, font=TITLE_FONT)


def add_h2(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(9)
    paragraph.paragraph_format.space_after = Pt(3)
    paragraph.paragraph_format.keep_with_next = True
    set_font(paragraph.add_run(text), 11.5, bold=True)


def add_body(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    paragraph.paragraph_format.first_line_indent = Cm(0.74)
    paragraph.paragraph_format.line_spacing = 1.35
    set_font(paragraph.add_run(text), 10)


def add_bullet(doc, text):
    paragraph = doc.add_paragraph(style="List Bullet")
    paragraph.paragraph_format.space_after = Pt(2)
    paragraph.paragraph_format.line_spacing = 1.3
    set_font(paragraph.add_run(text), 10)


def add_number(doc, text):
    paragraph = doc.add_paragraph(style="List Number")
    paragraph.paragraph_format.space_after = Pt(2)
    paragraph.paragraph_format.line_spacing = 1.3
    set_font(paragraph.add_run(text), 10)


def add_table(doc, headers, rows, widths, font_size=8.7):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    repeat_header(table.rows[0])
    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.width = Cm(widths[i])
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        set_cell_shading(cell, HEADER_FILL)
        set_cell_margins(cell)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        set_font(p.add_run(header), font_size, bold=True)
    for index, values in enumerate(rows):
        cells = table.add_row().cells
        for i, value in enumerate(values):
            cell = cells[i]
            cell.width = Cm(widths[i])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cell)
            if index % 2 == 1:
                set_cell_shading(cell, ALT_FILL)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.2
            set_font(p.add_run(str(value)), font_size, bold=(i == 0))
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def build():
    doc = Document()
    configure(doc)
    add_title(doc, "老字号叙事工坊技术说明")
    add_body(doc, "本文件说明老字号叙事工坊的 API 调用逻辑与提示词工程策略、本土业务场景向功能模块的转化方法、人机协作流程和业务价值，并附关键提示词版本迭代记录。")

    add_h1(doc, "一、API 调用逻辑与提示词工程策略")
    add_h2(doc, "1.1 总体调用链路")
    add_body(doc, "系统采用静态前端、WebSocket 网关、HTTP API、AI 适配层和 PostgreSQL 分离的结构。浏览器只负责交互与结果展示，不保存模型 API Key。品牌资料入库、内容生成、内容改稿和审核事件通过 WebSocket 发送到网关；账号、历史、文件解析、权威核验和护照签名通过 HTTP API 完成。")
    add_table(doc, ["调用层", "主要职责", "接口或事件", "失败处理"], [
        ("浏览器前端", "采集品牌资料、创作要求和审核动作，显示任务状态与成果。", "WebSocket、HTTP、localStorage", "网关不可用时切换到浏览器本地确定性引擎。"),
        ("WebSocket 网关", "维护实时连接，编排资料入库、内容生成、改稿和审核。", "brand.ingest、content.generate、content.revise、review.update", "服务端模型异常时在网关内回退本地处理；网关不可达时前端回退。"),
        ("HTTP API", "提供账号、历史、文件、核验、协作和护照接口。", "/api/auth/*、/api/history、/api/documents/extract、/api/collaboration/*", "返回结构化错误，由界面提示重试或继续人工处理。"),
        ("AI 适配层", "后端读取模型密钥并调用 Responses API 或兼容 Chat Completions 接口。", "OPENAI_API_KEY、OPENAI_MODEL、AI_API_URL、AI_TIMEOUT_MS", "超时、非 JSON、空输出或网络异常时使用本地引擎。"),
        ("校验与存储", "执行事实、风险、证据门禁和护照签名，保存任务与审核记录。", "shared/*.js、/api/passport/sign、PostgreSQL records", "门禁阻断时禁止批准；模块不可用时阻止批准并要求刷新。"),
    ], widths=(3.0, 5.0, 5.5, 3.6))
    add_body(doc, "当前线上如果未配置 OPENAI_API_KEY，系统会明确使用本地确定性引擎，不伪造远程模型调用结果。配置后，模型密钥只存在于服务端环境变量中，前端只接收生成结果、模型名称和提示词版本。")
    add_h2(doc, "1.2 API 安全与可靠性")
    add_bullet(doc, "密钥隔离：浏览器源码、配置文件、localStorage 和静态资源中均不保存 API Key。")
    add_bullet(doc, "账号安全：生产环境使用 HttpOnly Cookie、CSRF 校验、登录限流和账号锁定；Bearer Token 仅保留用于兼容测试。")
    add_bullet(doc, "结构化返回：生成接口要求 JSON schema；服务端检查字段、长度和 JSON 合法性，不完整时回退本地引擎。")
    add_bullet(doc, "降级机制：模型、网关或网络异常时自动切换本地处理，并在页面显示当前运行模式。")
    add_bullet(doc, "可追溯性：保存模型、提示词版本、事实引用、风险、AI 原稿、人工稿、审核记录；内容护照使用 SHA-256 摘要和 HMAC-SHA256 签名。")
    add_h2(doc, "1.3 提示词工程策略")
    add_body(doc, "提示词采用分层结构：第一层明确编辑角色与任务；第二层限定事实边界，只允许使用 facts 中的确定事实；第三层描述平台、受众、语气和结构；第四层注入风险、文化 DNA、保护词和品牌规则；第五层规定 JSON schema、长度、事实引用与输出格式。")
    add_number(doc, "事实优先：先提取 Fxxx 事实编号并过滤待核实事实。无来源信息只能写“待核实”，禁止补写年份、荣誉、非遗身份、人物、销量、工艺细节或健康功效。")
    add_number(doc, "结构约束：内容生成使用 story、calendar、copy、youth 四字段 schema；改稿使用 text 单字段 schema；广告词规则单独注入，避免生成与审查任务互相干扰。")
    add_number(doc, "风险注入：先由风险引擎识别医疗功效、绝对化宣传、虚假荣誉、无依据年份和无法验证工艺，再传给模型；blockedClaims 必须隔离，pendingClaims 只能以待核实方式出现。")
    add_number(doc, "文化与品牌约束：cultureDna.protectedTerms、tabooTerms、brandRules.preferredTerms 和 bannedTerms 进入提示词。平台表达可以调整，品牌核心事实和文化含义不能被改写。")
    add_number(doc, "风格控制：要求具体名词、动作和场景，避免赋能、打造闭环、匠心独运、焕新升级、不仅而且等模板；广告词另行执行一句一卖点、30 字内和多角度规则。")
    add_number(doc, "生成与验证分离：模型只负责候选初稿；事实绑定、逐句 Claim、证据门禁、内容护照和人工审核由独立模块完成，模型不能自行决定审核通过。")
    add_number(doc, "版本可追踪：每条成果保存模型与提示词版本；提示词升级必须同步更新评测用例、端到端测试和版本记录。")

    add_h1(doc, "二、本土场景向功能模块转化的设计思路")
    add_body(doc, "设计不从“增加一个 AI 功能”出发，而从山东老字号、非遗工坊和文创品牌的内容约束出发。品牌资料通常分散在档案、证书、口述和产品包装中，历史身份、工艺顺序、荣誉称号和地方文化含义都可能被模型改写；同一主题还要适配小红书、抖音、公众号和线下物料。系统把这些问题逐项转化为数据结构和可执行模块。")
    add_table(doc, ["本土业务问题", "设计判断", "对应功能模块", "产出"], [
        ("资料散落在档案、证书、访谈和产品资料中", "先建立可回读的事实库，再进行生成。", "品牌知识库、文件导入、事实提取、来源定位和文件指纹。", "带 Fxxx 编号、原文和证据状态的事实。"),
        ("历史、荣誉和工艺容易被写成没有出处的故事", "把生成前合规转化为声明分类和证明义务。", "Claim 分类、证明编译器、文化 DNA、风险规则。", "已证明、待证明、已阻止和创作表达逐句可见。"),
        ("同一主题要适配多平台，人工改写成本高", "把平台差异变成结构检查，而不是只换语气。", "多平台生成、字数与结构检查、内容日历。", "故事、日历、多平台文案和年轻化表达。"),
        ("已有广告语和脚本可能混入虚假荣誉或医疗功效", "建立与生成线并列的改稿线。", "文件导入、逐句 Claim 分析、修订建议、接受/忽略/手动编辑。", "保留原文、人工修订稿和修改说明。"),
        ("品牌方担心 AI 改掉地方文化内涵", "将文化保护词与禁忌词变为提示词和检查规则。", "文化 DNA、品牌标准/禁用表达、文化保真检查。", "可解释的文化保护和风险提示。"),
        ("审批动作缺少证据依据", "把事实确认和审批放进同一门禁，并由服务端复核。", "发布证据门禁、协作空间、评论和角色审批。", "可回溯的事实确认、评论和审批记录。"),
        ("需要证明内容的模型、事实和签发身份", "把内容视为可证明对象。", "内容护照、SHA-256、HMAC 签名和公开验证页。", "可校验的内容指纹与签发信息。"),
    ], widths=(4.2, 4.3, 5.2, 3.6), font_size=8.4)
    add_body(doc, "本土化不是在外观上叠加传统纹样，而是把地方品牌的证据边界、工艺顺序、荣誉使用条件、文化禁忌和节令场景写进数据结构、风险规则和审核门禁。原型中的“鲁香斋”使用虚构模拟数据，只展示流程，不代表真实品牌事实。")

    add_h1(doc, "三、人机协作流程设计")
    add_body(doc, "系统把 AI 定位为资料整理、候选初稿和风险初筛工具，把事实确认、文化判断、文字取舍和最终发布权交给品牌方。人机协作不是一次“生成即完成”，而是按资料入库、生成或改稿、校验、审核、导出和回流的顺序推进。")
    add_table(doc, ["阶段", "AI 或系统职责", "人工职责", "留痕"], [
        ("资料准备", "解析文本，记录文件名、大小和哈希，提取候选事实。", "确认资料是否可用于本次任务，补充来源类型。", "文件元数据、导入时间和来源类型。"),
        ("事实入库", "分类并生成 Fxxx 编号，标记来源与核验状态。", "逐条确认真实性；无来源内容保持待核实或补证。", "原文摘录、位置、核验状态、确认人。"),
        ("内容生成", "根据事实和平台要求生成故事、日历、文案、脚本或广告词。", "判断品牌语气、文化含义和是否适合对外表达。", "模型、提示词版本、AI 原稿和生成任务。"),
        ("改稿与检查", "逐句识别声明、风险和套话，给出修订候选。", "逐条接受、忽略或手动编辑。", "修改要求、AI 原稿、人工稿和修改说明。"),
        ("发布门禁", "检查事实确认、来源、引用、高风险和禁用词。", "补证、再次确认或退回修改。", "门禁状态、阻断项和服务端校验结果。"),
        ("协作审批", "校验角色和工作空间权限，批准时重新执行门禁。", "编辑、审核人和品牌负责人评论、退回或批准。", "评论、审批动作、角色、时间和内容快照。"),
        ("导出与回流", "生成护照和导出文件，保存版本。", "记录发布渠道、链接、互动和人工复盘。", "护照、审核次数、效果和版本历史。"),
    ], widths=(2.8, 5.4, 5.2, 3.8), font_size=8.6)
    add_body(doc, "人工审核具有最终优先权。高风险内容、未绑定事实和证据门禁阻断项不能因为模型生成流畅就被视为可发布；审批接口会在服务端再次执行证据检查，避免只依赖前端状态。")

    add_h1(doc, "四、业务价值说明")
    add_table(doc, ["价值维度", "具体说明", "可观察指标"], [
        ("效率价值", "把资料检索、事实整理、多平台初稿、改稿和审核准备集中到一个工作台。", "首次初稿时间、单次任务编辑时长、跨平台改写次数。"),
        ("风险价值", "识别医疗功效、虚假荣誉、绝对化、无依据年份和工艺描述，门禁阻止有阻断项的内容批准。", "高风险数量、门禁阻断率、发布前问题修复率。"),
        ("追溯价值", "成果关联事实、原文、文件指纹、模型、提示词、人工稿和审核；护照支持签名验证。", "事实引用覆盖率、护照生成率、审核记录完整率。"),
        ("协作价值", "通过邀请邮箱、角色、评论、退回和批准，把编辑与审核放在同一内容快照。", "审核链完成率、退回次数、成员响应时间。"),
        ("资产价值", "生成结果、改稿版本、品牌规则和效果数据可复用，形成品牌内容知识资产。", "历史任务复用率、版本回滚次数、品牌规则命中率。"),
    ], widths=(3.2, 9.7, 4.2), font_size=8.8)
    add_body(doc, "业务价值的前提是人工确认。工具用于资料整理、候选初稿、风险初筛和审核支撑，不构成法律意见，也不替代品牌方对历史事实、资质证书、文化内涵、检测报告和最终发布决策的审核。")

    add_h1(doc, "五、关键提示词版本迭代记录")
    add_table(doc, ["版本标识", "适用模块", "主要变更", "状态"], [
        ("brand-safe-narrative-v1.0", "基础生成", "品牌资料提取、单平台生成、AI 原稿与人工稿留痕。", "历史版本"),
        ("brand-safe-narrative-v1.2", "生成与风险", "加入 [Fxxx] 引用、医疗功效/绝对化/荣誉/年份/工艺风险和失败回退。", "历史版本"),
        ("brand-safe-narrative-v2.0", "品牌叙事包", "增加历史、产品和受访输入；输出故事、日历、多平台文案和年轻化表达；强化非遗与宫廷身份边界。", "历史版本"),
        ("brand-safe-narrative-v3.0", "当前生成引擎", "进一步约束事实、文化 DNA、证据缺口、宣传方法和平台结构。", "当前"),
        ("draft-revision-safe-v1.0", "本地改稿", "加入双工作线、文件导入、历史稿、修改要求、问题语段和原文/修订稿留痕。", "历史版本"),
        ("draft-revision-safe-v2.0", "改稿与门禁", "加入风险安全改写、逐段建议、平台检查、证据门禁和指定事实保留。", "当前本地改稿"),
        ("draft-revision-ai-v1.0", "远程改稿", "由网关模型执行改稿，失败时回退本地引擎，返回模型和提示词信息。", "已接入，需配置模型密钥"),
        ("ad-copy-craft-v1.0", "广告词实验室", "从事实起笔、一句一卖点、30 字限制、反套话和事实依据标注。", "当前"),
    ], widths=(4.2, 3.8, 7.7, 2.5), font_size=8.4)
    add_h2(doc, "版本管理要求")
    add_bullet(doc, "每次提示词调整必须保留版本标识、变更说明和适用模块，不直接覆盖历史记录。")
    add_bullet(doc, "生成结果、历史记录和内容护照同时保存模型名称和提示词版本，便于回看和比较。")
    add_bullet(doc, "涉及事实、风险或合规规则的变更，需要先通过本地测试、浏览器端到端测试和边界案例验证，再部署线上。")
    add_bullet(doc, "没有配置远程模型时，系统必须显示本地引擎和明确回退原因，不能把本地结果标记为远程模型输出。")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()
