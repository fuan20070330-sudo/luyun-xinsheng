import subprocess
import textwrap
from fractions import Fraction
from pathlib import Path

import av
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "老字号叙事工坊三分钟演示.mp4"
VIDEO_ONLY = ROOT / ".video-tools" / "demo-subtitled-video.mp4"
AUDIO_ONLY = ROOT / ".video-tools" / "demo-subtitled-audio.m4a"
NARRATION = ROOT / ".video-tools" / "narration-subtitled.wav"
TIMINGS = ROOT / ".video-tools" / "subtitle-timings.txt"
OUTPUT = ROOT / ".video-tools" / "demo-subtitled-output.mp4"
FFMPEG = ROOT / ".video-tools" / "ffmpeg" / "ffmpeg.exe"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FPS = 15
WIDTH = 960
HEIGHT = 544


def load_cues():
    cues = []
    for line in TIMINGS.read_text(encoding="utf-8").splitlines():
        index, start, end, text = line.split("\t", 3)
        cues.append((float(start), float(end), text))
    return cues


def subtitle_for_time(cues, current):
    for start, end, text in cues:
        if start <= current < end:
            return text
    return ""


def overlay_subtitle(image, text):
    canvas = image.convert("RGBA")
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    top, bottom = HEIGHT - 158, HEIGHT - 76
    draw.rounded_rectangle((14, top, WIDTH - 14, bottom), radius=7, fill=(14, 16, 15, 218))
    font = ImageFont.truetype(FONT_BOLD, 18)
    wrapped = textwrap.wrap(text, width=39, break_long_words=True, replace_whitespace=False)[:2]
    y = top + 8
    for line in wrapped:
        bbox = draw.textbbox((0, 0), line, font=font)
        x = (WIDTH - (bbox[2] - bbox[0])) // 2
        draw.text((x, y), line, font=font, fill=(250, 247, 239))
        y += 27
    return Image.alpha_composite(canvas, overlay).convert("RGB")


def create_subtitled_video():
    cues = load_cues()
    source = av.open(str(SOURCE))
    in_stream = source.streams.video[0]
    output = av.open(str(VIDEO_ONLY), mode="w")
    out_stream = output.add_stream("libx264", rate=FPS)
    out_stream.width = WIDTH
    out_stream.height = HEIGHT
    out_stream.pix_fmt = "yuv420p"
    out_stream.options = {"crf": "22", "preset": "medium", "tune": "stillimage"}
    index = 0
    for frame in source.decode(in_stream):
        current = float(frame.time or 0)
        image = frame.to_image().resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
        text = subtitle_for_time(cues, current)
        if text:
            image = overlay_subtitle(image, text)
        out_frame = av.VideoFrame.from_image(image)
        out_frame.pts = index
        out_frame.time_base = Fraction(1, FPS)
        index += 1
        for packet in out_stream.encode(out_frame):
            output.mux(packet)
    for packet in out_stream.encode(None):
        output.mux(packet)
    source.close()
    output.close()


def create_audio():
    source = av.open(str(NARRATION))
    in_stream = source.streams.audio[0]
    output = av.open(str(AUDIO_ONLY), mode="w")
    out_stream = output.add_stream("aac", rate=48000)
    out_stream.layout = "stereo"
    out_stream.bit_rate = 128000
    resampler = av.AudioResampler(format="fltp", layout="stereo", rate=48000)
    pts = 0
    for frame in source.decode(in_stream):
        for resampled in resampler.resample(frame):
            resampled.pts = pts
            resampled.time_base = Fraction(1, 48000)
            pts += resampled.samples
            for packet in out_stream.encode(resampled):
                output.mux(packet)
    for resampled in resampler.resample(None):
        resampled.pts = pts
        resampled.time_base = Fraction(1, 48000)
        pts += resampled.samples
        for packet in out_stream.encode(resampled):
            output.mux(packet)
    for packet in out_stream.encode(None):
        output.mux(packet)
    source.close()
    output.close()


def mux():
    subprocess.run([
        str(FFMPEG), "-y", "-v", "error",
        "-i", str(VIDEO_ONLY), "-i", str(AUDIO_ONLY),
        "-map", "0:v:0", "-map", "1:a:0", "-c", "copy",
        "-movflags", "+faststart", str(OUTPUT),
    ], check=True)
    OUTPUT.replace(SOURCE)


if __name__ == "__main__":
    create_subtitled_video()
    create_audio()
    mux()
    print(SOURCE)
