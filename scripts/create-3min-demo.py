import bisect
import subprocess
from fractions import Fraction
from pathlib import Path

import av
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r"C:\Users\fuan\Desktop\演示视频10min.mp4")
NARRATION = ROOT / ".video-tools" / "narration-rate-1.wav"
VIDEO_ONLY = ROOT / ".video-tools" / "demo-video-only.mp4"
AUDIO_ONLY = ROOT / ".video-tools" / "demo-narration.m4a"
OUTPUT = ROOT / "docs" / "老字号叙事工坊三分钟演示.mp4"
FFMPEG = ROOT / ".video-tools" / "ffmpeg" / "ffmpeg.exe"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_REGULAR = "C:/Windows/Fonts/msyh.ttc"
FPS = 15
WIDTH = 960
HEIGHT = 544


SEGMENTS = [
    (5, 25, 1.8, "01 打开网址，注册邮箱和密码"),
    (40, 53, 1.8, "02 登录后选择“生成文稿”"),
    (65, 83, 2.2, "03 填写品牌类型、名称和语气"),
    (125, 165, 3.3, "04 粘贴资料与访谈，提取事实"),
    (185, 225, 3.2, "05 填写受众、主题、限制与宣传方法"),
    (265, 285, 2.2, "06 点击生成内容方案"),
    (285, 315, 2.6, "07 查看四份内容成果"),
    (320, 355, 2.7, "08 确认有来源事实，通过发布门禁"),
    (380, 398, 1.3, "09 打开内容护照公开验证页"),
    (420, 455, 2.8, "10 修改文稿：选择历史稿并填写要求"),
    (480, 518, 3.0, "11 排查问题语段，生成修订稿并保存"),
    (520, 548, 2.8, "12 协作审核：邀请成员，评论或审批"),
    (580, 598, 1.7, "13 导出内容日历和完整确认包"),
]


def caption_image(image, step, label):
    canvas = image.convert("RGBA")
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    band_top = HEIGHT - 70
    draw.rectangle((0, band_top, WIDTH, HEIGHT), fill=(20, 23, 21, 218))
    draw.rounded_rectangle((18, band_top + 15, 128, band_top + 55), radius=6, fill=(143, 48, 40, 255))
    step_font = ImageFont.truetype(FONT_BOLD, 18)
    label_font = ImageFont.truetype(FONT_BOLD, 24)
    draw.text((32, band_top + 21), f"步骤 {step:02d}", font=step_font, fill="white")
    draw.text((145, band_top + 18), label, font=label_font, fill="white")
    return Image.alpha_composite(canvas, overlay).convert("RGB")


def card_image(lines, small=None):
    image = Image.new("RGB", (WIDTH, HEIGHT), (28, 35, 31))
    draw = ImageDraw.Draw(image)
    title_font = ImageFont.truetype(FONT_BOLD, 38)
    small_font = ImageFont.truetype(FONT_REGULAR, 21)
    y = 150
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=title_font)
        x = (WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((x, y), line, font=title_font, fill=(247, 240, 226))
        y += 62
    if small:
        bbox = draw.textbbox((0, 0), small, font=small_font)
        x = (WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((x, y + 12), small, font=small_font, fill=(197, 188, 170))
    return image


def encode_card(out, stream, image, seconds, frame_index):
    count = int(seconds * FPS)
    for _ in range(count):
        frame = av.VideoFrame.from_image(image)
        frame.pts = frame_index
        frame.time_base = Fraction(1, FPS)
        for packet in stream.encode(frame):
            out.mux(packet)
        frame_index += 1
    return frame_index


def encode_source_segment(container, video_stream, out, stream, start, end, speed, label, step, frame_index):
    container.seek(int(start / float(video_stream.time_base)), backward=True, any_frame=False, stream=video_stream)
    frames = []
    for frame in container.decode(video_stream):
        timestamp = float(frame.time or 0)
        if timestamp < start - 0.1:
            continue
        if timestamp > end:
            break
        frames.append((timestamp, frame))
    if not frames:
        raise RuntimeError(f"No frames decoded for {start}-{end}")
    times = [item[0] for item in frames]
    output_seconds = (end - start) / speed
    output_count = max(1, int(output_seconds * FPS))
    source_step = speed / FPS
    for index in range(output_count):
        target = start + index * source_step
        position = max(0, bisect.bisect_right(times, target) - 1)
        image = frames[position][1].to_image().resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
        image = caption_image(image, step, label)
        frame = av.VideoFrame.from_image(image)
        frame.pts = frame_index
        frame.time_base = Fraction(1, FPS)
        for packet in stream.encode(frame):
            out.mux(packet)
        frame_index += 1
    return frame_index


def create_video_only():
    output = av.open(str(VIDEO_ONLY), mode="w")
    video_stream = output.add_stream("libx264", rate=FPS)
    video_stream.width = WIDTH
    video_stream.height = HEIGHT
    video_stream.pix_fmt = "yuv420p"
    video_stream.options = {"crf": "22", "preset": "medium", "tune": "stillimage"}
    source = av.open(str(SOURCE))
    source_stream = source.streams.video[0]
    frame_index = 0
    frame_index = encode_card(output, video_stream, card_image(["老字号叙事工坊", "三分钟独立跑通演示"], "输入 → 处理 → 输出"), 3.0, frame_index)
    for step, (start, end, speed, label) in enumerate(SEGMENTS, start=1):
        frame_index = encode_source_segment(source, source_stream, output, video_stream, start, end, speed, label, step, frame_index)
    frame_index = encode_card(output, video_stream, card_image(["访问网址", "fuan20070330-sudo.github.io/luyun-xinsheng"], "评审可按视频步骤独立操作"), 3.0, frame_index)
    for packet in video_stream.encode(None):
        output.mux(packet)
    source.close()
    output.close()
    return frame_index / FPS


def create_audio_only():
    output = av.open(str(AUDIO_ONLY), mode="w")
    stream = output.add_stream("aac", rate=48000)
    stream.layout = "stereo"
    stream.bit_rate = 128000
    source = av.open(str(NARRATION))
    audio_stream = source.streams.audio[0]
    resampler = av.AudioResampler(format="fltp", layout="stereo", rate=48000)
    pts = 0
    for frame in source.decode(audio_stream):
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


def mux():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    command = [
        str(FFMPEG), "-y", "-v", "error",
        "-i", str(VIDEO_ONLY), "-i", str(AUDIO_ONLY),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c", "copy", "-movflags", "+faststart", str(OUTPUT),
    ]
    subprocess.run(command, check=True)


if __name__ == "__main__":
    duration = create_video_only()
    create_audio_only()
    mux()
    print(OUTPUT)
    print("video_seconds", round(duration, 2))
