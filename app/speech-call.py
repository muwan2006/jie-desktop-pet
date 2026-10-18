"""Explicit voice call. One ASR model per call; no recording files or idle timeout."""
import argparse
import importlib.util
import json
import queue
import sys
import threading
import time
from collections import deque
from pathlib import Path
from speech_audio import choose_device, MusicDucking

sys.stdout.reconfigure(encoding='utf-8')
sys.stdin.reconfigure(encoding='utf-8')
spec = importlib.util.spec_from_file_location('jie_speech', Path(__file__).with_name('speech-local.py'))
speech = importlib.util.module_from_spec(spec)
spec.loader.exec_module(speech)
emit = speech.emit

class Endpoint:
    def __init__(self, silence=.75):
        self.silence = silence
        self.seen = 0
        self.last = 0
        self.started = False

    def update(self, probability, now):
        if probability >= .5:
            self.seen += 1
            self.last = now
        began = not self.started and self.seen >= 2
        if began:
            self.started = True
        return began, self.started and now - self.last >= self.silence

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--test-wav', action='append', default=[])
    args = parser.parse_args()
    import numpy as np
    import sounddevice as sd
    from faster_whisper.vad import get_vad_model
    config = json.loads(sys.stdin.readline())
    runtime = Path(__file__).parent / 'asr-runtime'
    if config.get('language') not in ('zh-CN', 'en-US', 'ja-JP'):
        raise ValueError('识别语言无效。')
    available = speech.devices(sd)
    chosen = choose_device(available, config.get('device', ''))
    if config.get('device') and chosen is None:
        raise RuntimeError('选中的麦克风已断开，请重新选择收音设备。')
    index = chosen['index'] if chosen else None
    info = sd.query_devices(index, 'input')
    rate = int(info['default_samplerate'])
    commands = queue.Queue()
    def read_commands():
        for line in sys.stdin:
            commands.put(line.strip())
        commands.put('cancel')
    threading.Thread(target=read_commands, daemon=True).start()
    emit('loading', message='正在准备常驻语音识别……')
    fast_spec = importlib.util.spec_from_file_location('jie_fast_asr', Path(__file__).with_name('speech-fast.py'))
    fast = importlib.util.module_from_spec(fast_spec)
    fast_spec.loader.exec_module(fast)
    use_fast = config.get('callSpeed') != 'accurate' and fast.available(runtime)
    if use_fast:
        model = fast.FastAsr(runtime, config['language'])
        def transcribe(audio, rate):
            model.transcribe(audio, rate, config, emit)
    else:
        from faster_whisper import WhisperModel
        model = WhisperModel(str(runtime / 'model'), device='cpu', compute_type='int8',
                             cpu_threads=4, local_files_only=True)
        def transcribe(audio, rate):
            speech.transcribe(audio, rate, config, runtime, model=model, fast=config.get('callSpeed') != 'accurate')
    emit('model_ready', engine='sensevoice' if use_fast else 'whisper')
    if args.test_wav:
        import wave
        for filename in args.test_wav[:3]:
            with wave.open(filename, 'rb') as source:
                if source.getnchannels() != 1 or source.getsampwidth() != 2:
                    raise ValueError('测试音频须为PCM16单声道。')
                samples = np.frombuffer(source.readframes(source.getnframes()), dtype='<i2').astype('float32') / 32768
                started = time.monotonic()
                transcribe(samples, source.getframerate())
                emit('test_turn', seconds=time.monotonic()-started, file=Path(filename).name)
        emit('done')
        return
    with MusicDucking(config, emit) as music_duck:
        vad = get_vad_model()
        listen = True
        while True:
            if not listen:
                command = commands.get()
                if command == 'listen':
                    listen = True
                elif command == 'pause':
                    emit('paused')
                    continue
                else:
                    emit('canceled')
                    return
            blocks = queue.Queue(maxsize=30)
            def on_audio(indata, frames, timing, status):
                try:
                    blocks.put_nowait(indata[:, 0].copy())
                except queue.Full:
                    pass
            pre = deque(maxlen=5)
            vad_window = deque(maxlen=8)
            parts = []
            endpoint = Endpoint()
            last_meter = 0
            paused = False
            music_duck.lower()
            with sd.InputStream(device=index, samplerate=rate, channels=1, dtype='float32',
                                blocksize=int(rate / 10), callback=on_audio):
                emit('ready', engine='local', device=info['name'])
                while True:
                    try:
                        command = commands.get_nowait()
                        if command == 'listen':
                            continue
                        if command == 'pause':
                            paused = True
                            break
                        emit('canceled')
                        return
                    except queue.Empty:
                        pass
                    try:
                        block = blocks.get(timeout=.1)
                    except queue.Empty:
                        continue
                    now = time.monotonic()
                    rms = float(np.sqrt(np.mean(block ** 2)))
                    pre.append(block)
                    vad_window.append(block)
                    raw = np.concatenate(vad_window)
                    sampled = np.interp(np.arange(0, len(raw), rate / 16000),
                                        np.arange(len(raw)), raw).astype('float32')
                    padding = (-len(sampled)) % 512
                    probability = float(np.mean(vad(np.pad(sampled, (0, padding)))[-3:])) if rms > .0004 else 0
                    began, ended = endpoint.update(probability, now)
                    if began:
                        parts.extend(pre)
                        emit('speech', at=int(time.time() * 1000))
                    elif endpoint.started:
                        parts.append(block)
                    if now - last_meter > .25:
                        last_meter = now
                        emit('level', level=min(100, int(rms * 1500)), speaking=endpoint.started)
                    if ended or endpoint.started and sum(len(p) for p in parts) / rate >= 30:
                        break
            music_duck.restore()
            listen = False
            if paused:
                emit('paused')
                continue
            ended_at = int(time.time() * 1000 - max(0, time.monotonic() - endpoint.last) * 1000)
            emit('utterance', at=ended_at)
            transcribe(np.concatenate(parts), rate)
            emit('turn_done', at=ended_at)

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        emit('error', message='本机语音通话：' + str(exc)[:400])
        sys.exit(1)
