import bisect
import subprocess
import textwrap
from fractions import Fraction
from pathlib import Path

import av
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
CLEAN_3MIN = ROOT / ".video-tools" / "head-original-3min.mp4"
NARRATION = ROOT / ".video-tools" / "narration-1_5x.wav"
TIMINGS = ROOT / ".video-tools" / "subtitle-timings-new.txt"
VIDEO_ONLY = ROOT / ".video-tools" / "demo-final-video.mp4"
AUDIO_ONLY = ROOT / ".video-tools" / "demo-final-audio.m4a"
OUTPUT = ROOT / "docs" / "老字号叙事工坊三分钟演示.mp4"
SRT_OUTPUT = ROOT / "docs" / "老字号叙事工坊三分钟演示.srt"
FFMPEG = ROOT / ".video-tools" / "ffmpeg" / "ffmpeg.exe"

FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_BODY = "C:/Windows/Fonts/msyh.ttc"
FONT_KAI = "C:/Windows/Fonts/simkai.ttf"

FPS = 15
WIDTH = 960
HEIGHT = 544
DEMO_HEIGHT = 474

INK = (31, 37, 32)
INK_SOFT = (72, 78, 71)
PAPER = (244, 239, 228)
PAPER_LIGHT = (250, 247, 239)
RED = (151, 45, 37)
RED_DARK = (112, 31, 27)
GREEN = (45, 88, 73)
GOLD = (170, 135, 74)
WHITE = (255, 255, 255)


# 0-32 秒是新增片头；36.6 秒后对应 13 个操作镜头。
SHOTS = [
    (3.000, 14.067, 1, "01 注册并打开工作台"),
    (14.067, 21.267, 2, "02 选择生成文稿"),
    (21.267, 29.400, 3, "03 填写品牌基本信息"),
    (29.400, 41.467, 4, "04 提取可追溯事实"),
    (41.467, 63.000, 5, "05 填写任务并生成内容"),
    (63.000, 74.533, 6, "06 查看内容成果"),
    (74.533, 81.800, 7, "07 核对风险与事实"),
    (81.800, 87.467, 8, "08 通过发布门禁"),
    (87.467, 101.267, 9, "09 公开验证内容护照"),
    (101.267, 113.733, 10, "10 选择历史稿并发起修改"),
    (113.733, 126.400, 11, "11 排查语段并保存修订"),
    (126.400, 136.400, 12, "12 协作审核"),
    (136.400, 146.933, 13, "13 导出交付材料"),
]


def load_cues():
    cues = []
    for line in TIMINGS.read_text(encoding="utf-8").splitlines():
        index, start, end, text = line.split("\t", 3)
        cues.append((int(index), float(start), float(end), text))
    return cues


def active_cue(cues, current):
    for cue in cues:
        if cue[1] <= current < cue[2]:
            return cue
    previous = cues[0]
    for cue in cues:
        if cue[1] <= current:
            previous = cue
        else:
            break
    return previous


def font(path, size):
    return ImageFont.truetype(path, size)


def centered(draw, text, y, text_font, fill, max_width=None):
    if max_width:
        lines = textwrap.wrap(text, width=max_width, break_long_words=True, replace_whitespace=False)
    else:
        lines = [text]
    for line in lines:
        box = draw.textbbox((0, 0), line, font=text_font)
        x = (WIDTH - (box[2] - box[0])) // 2
        draw.text((x, y), line, font=text_font, fill=fill)
        y += int((box[3] - box[1]) * 1.55)
    return y


def draw_brand_header(image):
    draw = ImageDraw.Draw(image)
    draw.rectangle((58, 36, 98, 76), fill=RED)
    seal_font = font(FONT_BOLD, 22)
    box = draw.textbbox((0, 0), "鲁", font=seal_font)
    draw.text((78 - (box[2] - box[0]) / 2, 52 - (box[3] - box[1]) / 2 - 2), "鲁", font=seal_font, fill=PAPER_LIGHT)
    draw.text((112, 33), "鲁韵新声", font=font(FONT_BOLD, 26), fill=INK)
    draw.text((112, 66), "山东老字号品牌叙事与多平台内容共创助手", font=font(FONT_BODY, 14), fill=INK_SOFT)
    draw.line((58, 102, WIDTH - 58, 102), fill=(210, 199, 180), width=1)
    draw.line((58, 106, 184, 106), fill=RED, width=3)


def draw_footer_tag(draw):
    text = "仅用于产品原型演示"
    label_font = font(FONT_BODY, 13)
    box = draw.textbbox((0, 0), text, font=label_font)
    x = WIDTH - 58 - (box[2] - box[0])
    draw.text((x, 116), text, font=label_font, fill=(126, 116, 100))


def draw_chip(draw, x, y, text, width, fill=(233, 227, 214), text_fill=INK):
    draw.rounded_rectangle((x, y, x + width, y + 38), radius=8, fill=fill, outline=(205, 195, 177), width=1)
    chip_font = font(FONT_BOLD, 16)
    box = draw.textbbox((0, 0), text, font=chip_font)
    draw.text((x + (width - (box[2] - box[0])) / 2, y + 10), text, font=chip_font, fill=text_fill)


def intro_frame(cue_number):
    image = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(image)
    draw_brand_header(image)
    draw_footer_tag(draw)

    label_font = font(FONT_BODY, 15)
    title_font = font(FONT_KAI, 39)
    title_bold = font(FONT_BOLD, 34)
    body_font = font(FONT_BODY, 18)
    small_font = font(FONT_BODY, 16)

    if cue_number <= 1:
        draw.text((80, 158), "评 审 演 示", font=label_font, fill=RED_DARK)
        draw.text((80, 190), "三分钟运行演示", font=title_font, fill=INK)
        draw.text((82, 257), "从注册开始，独立跑通生成、修改、审核与导出", font=body_font, fill=INK_SOFT)
        draw.line((80, 310, 360, 310), fill=GOLD, width=2)
        draw.text((80, 329), "让老字号故事有据可循，也有年轻表达", font=font(FONT_BOLD, 20), fill=GREEN)
    elif cue_number == 2:
        draw.text((80, 148), "项 目 背 景", font=label_font, fill=RED_DARK)
        draw.text((80, 180), "宣传内容制作，卡在检索与核对", font=title_bold, fill=INK)
        draw_chip(draw, 80, 252, "人工检索", 185)
        draw_chip(draw, 283, 252, "事实核对", 185)
        draw_chip(draw, 486, 252, "多平台改写", 205)
        draw.text((80, 315), "研发“山东老字号品牌叙事与多平台内容共创助手”", font=body_font, fill=INK_SOFT)
    elif cue_number == 3:
        draw.text((80, 148), "传 播 理 念", font=label_font, fill=RED_DARK)
        draw.text((80, 180), "传承老字号文化，讲好本土品牌故事", font=title_bold, fill=INK)
        chips = [("事实提取", 150), ("文稿生成与润色", 210), ("风险校验", 150), ("审核留痕", 150)]
        x = 80
        for text, width in chips:
            draw_chip(draw, x, 264, text, width, fill=(235, 230, 218))
            x += width + 16
    elif cue_number == 4:
        draw.text((80, 148), "模 型 配 置", font=label_font, fill=RED_DARK)
        draw.text((80, 190), "GPT‑4.1 mini", font=font(FONT_BOLD, 46), fill=GREEN)
        draw.text((82, 260), "采用 GPT‑4.1 mini 大模型", font=body_font, fill=INK_SOFT)
        draw.line((82, 304, 548, 304), fill=GOLD, width=2)
        draw.text((82, 321), "远程模型不可用时，系统自动回退本地演示引擎", font=small_font, fill=INK_SOFT)
    elif cue_number == 5:
        draw.text((80, 148), "创 新 点", font=label_font, fill=RED_DARK)
        points = [
            ("01", "文稿内容生成精准"),
            ("02", "事实自动提取与确认"),
            ("03", "修改与审核过程留存"),
        ]
        y = 192
        for number, text in points:
            draw.rounded_rectangle((80, y, 126, y + 40), radius=7, fill=RED)
            draw.text((93, y + 9), number, font=font(FONT_BOLD, 16), fill=WHITE)
            draw.text((144, y + 6), text, font=font(FONT_BOLD, 22), fill=INK)
            y += 55
    else:
        draw.text((80, 148), "操 作 演 示", font=label_font, fill=RED_DARK)
        draw.text((80, 184), "三分钟独立跑通", font=title_font, fill=INK)
        draw.text((82, 247), "注册登录 → 生成文稿 → 修改文稿 → 审核与导出", font=body_font, fill=INK_SOFT)
        draw.rounded_rectangle((80, 300, 880, 352), radius=8, fill=(232, 226, 213), outline=(203, 192, 173), width=1)
        draw.text((98, 315), "fuan20070330-sudo.github.io/luyun-xinsheng", font=font(FONT_BOLD, 18), fill=GREEN)

    return image


def draw_subtitle(image, text):
    if not text:
        return image
    canvas = image.convert("RGBA")
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    top, bottom = HEIGHT - 158, HEIGHT - 76
    draw.rounded_rectangle((14, top, WIDTH - 14, bottom), radius=7, fill=(14, 16, 15, 232))
    subtitle_font = font(FONT_BOLD, 18)
    lines = textwrap.wrap(text, width=39, break_long_words=True, replace_whitespace=False)[:2]
    y = top + 8
    for line in lines:
        box = draw.textbbox((0, 0), line, font=subtitle_font)
        x = (WIDTH - (box[2] - box[0])) // 2
        draw.text((x, y), line, font=subtitle_font, fill=PAPER_LIGHT)
        y += 27
    return Image.alpha_composite(canvas, overlay).convert("RGB")


def draw_step_band(image, label):
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, DEMO_HEIGHT, WIDTH, HEIGHT), fill=(24, 29, 26))
    number, title = label.split(" ", 1)
    draw.rounded_rectangle((18, 489, 62, 529), radius=6, fill=RED)
    number_font = font(FONT_BOLD, 16)
    box = draw.textbbox((0, 0), number, font=number_font)
    draw.text((40 - (box[2] - box[0]) / 2, 501), number, font=number_font, fill=WHITE)
    draw.text((79, 490), title, font=font(FONT_BOLD, 22), fill=PAPER_LIGHT)
    return image


def demo_frame(source_image, label):
    image = Image.new("RGB", (WIDTH, HEIGHT), INK)
    cropped = source_image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS).crop((0, 0, WIDTH, DEMO_HEIGHT))
    image.paste(cropped, (0, 0))
    return draw_step_band(image, label)


def decode_range(container, stream, start, end):
    container.seek(int(start / float(stream.time_base)), backward=True, any_frame=False, stream=stream)
    frames = []
    for frame in container.decode(stream):
        timestamp = float(frame.time or 0)
        if timestamp < start - 0.1:
            continue
        if timestamp > end + 0.1:
            break
        frames.append((timestamp, frame.to_image().resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)))
    if not frames:
        raise RuntimeError(f"No frames decoded for {start}-{end}")
    return frames


def encode_still_range(output, stream, image, start, end, count, frame_index, cues):
    for offset in range(count):
        current = start + offset / FPS
        cue = active_cue(cues, current)
        frame_image = draw_subtitle(image, cue[3] if cue[1] <= current < cue[2] else "")
        frame = av.VideoFrame.from_image(frame_image)
        frame.pts = frame_index
        frame.time_base = Fraction(1, FPS)
        for packet in stream.encode(frame):
            output.mux(packet)
        frame_index += 1
    return frame_index


def encode_source_range(container, source_stream, output, stream, source_start, source_end, output_start, output_end, count, label, frame_index, cues):
    frames = decode_range(container, source_stream, source_start, source_end)
    times = [item[0] for item in frames]
    for offset in range(count):
        ratio = offset / max(1, count - 1)
        source_time = source_start + ratio * (source_end - source_start)
        position = max(0, bisect.bisect_right(times, source_time) - 1)
        image = demo_frame(frames[position][1], label)
        current = output_start + offset / FPS
        cue = active_cue(cues, current)
        image = draw_subtitle(image, cue[3] if cue[1] <= current < cue[2] else "")
        frame = av.VideoFrame.from_image(image)
        frame.pts = frame_index
        frame.time_base = Fraction(1, FPS)
        for packet in stream.encode(frame):
            output.mux(packet)
        frame_index += 1
    return frame_index


def create_video(cues):
    output = av.open(str(VIDEO_ONLY), mode="w")
    stream = output.add_stream("libx264", rate=FPS)
    stream.width = WIDTH
    stream.height = HEIGHT
    stream.pix_fmt = "yuv420p"
    stream.options = {"crf": "21", "preset": "medium", "tune": "stillimage"}
    frame_index = 0

    # 片头与过渡段：按字幕时间卡逐段切换，避免旧录屏画面提前出现。
    boundaries = [cue[1] for cue in cues[:6]] + [cues[6][1]]
    frame_boundaries = [round(value * FPS) for value in boundaries]
    for index in range(6):
        start = boundaries[index]
        end = boundaries[index + 1]
        count = frame_boundaries[index + 1] - frame_boundaries[index]
        image = intro_frame(index + 1)
        frame_index = encode_still_range(output, stream, image, start, end, count, frame_index, cues)

    source = av.open(str(CLEAN_3MIN))
    source_stream = source.streams.video[0]
    demo_cues = cues[6:]
    demo_boundaries = [cue[1] for cue in demo_cues] + [cues[-1][2]]
    demo_frames = [round(value * FPS) for value in demo_boundaries]
    for index, (source_start, source_end, step, label) in enumerate(SHOTS):
        output_start = demo_boundaries[index]
        output_end = demo_boundaries[index + 1]
        count = demo_frames[index + 1] - demo_frames[index]
        frame_index = encode_source_range(
            source, source_stream, output, stream,
            source_start, source_end, output_start, output_end, count,
            label, frame_index, cues,
        )

    for packet in stream.encode(None):
        output.mux(packet)
    source.close()
    output.close()
    return frame_index / FPS


def create_audio():
    source = av.open(str(NARRATION))
    input_stream = source.streams.audio[0]
    output = av.open(str(AUDIO_ONLY), mode="w")
    stream = output.add_stream("aac", rate=48000)
    stream.layout = "stereo"
    stream.bit_rate = 128000
    resampler = av.AudioResampler(format="fltp", layout="stereo", rate=48000)
    pts = 0
    for frame in source.decode(input_stream):
        for resampled in resampler.resample(frame):
            resampled.pts = pts
            resampled.time_base = Fraction(1, 48000)
            pts += resampled.samples
            for packet in stream.encode(resampled):
                output.mux(packet)
    for resampled in resampler.resample(None):
        resampled.pts = pts
        resampled.time_base = Fraction(1, 48000)
        pts += resampled.samples
        for packet in stream.encode(resampled):
            output.mux(packet)
    for packet in stream.encode(None):
        output.mux(packet)
    source.close()
    output.close()


def write_srt(cues):
    def stamp(value):
        milliseconds = round(value * 1000)
        hours, milliseconds = divmod(milliseconds, 3600000)
        minutes, milliseconds = divmod(milliseconds, 60000)
        seconds, milliseconds = divmod(milliseconds, 1000)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"

    blocks = []
    for index, start, end, text in cues:
        blocks.append(f"{index}\n{stamp(start)} --> {stamp(end)}\n{text}\n")
    SRT_OUTPUT.write_text("\n".join(blocks), encoding="utf-8")


def mux():
    subprocess.run([
        str(FFMPEG), "-y", "-v", "error",
        "-i", str(VIDEO_ONLY), "-i", str(AUDIO_ONLY),
        "-map", "0:v:0", "-map", "1:a:0", "-c", "copy",
        "-movflags", "+faststart", str(OUTPUT),
    ], check=True)


if __name__ == "__main__":
    if not CLEAN_3MIN.exists():
        raise SystemExit(f"Missing clean source: {CLEAN_3MIN}")
    cue_list = load_cues()
    duration = create_video(cue_list)
    create_audio()
    write_srt(cue_list)
    mux()
    print(OUTPUT)
    print("video_seconds", round(duration, 3))
