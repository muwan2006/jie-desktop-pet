"""SenseVoiceSmall via sherpa-onnx; optional, local-only call recognition."""
import os
import sys
from pathlib import Path

class FastAsr:
    def __init__(self, runtime, language):
        root = Path(runtime) / 'fast'
        sys.path.insert(0, str(root / 'vendor'))
        self.dll_directory = os.add_dll_directory(str(root / 'vendor/sherpa_onnx/lib')) if hasattr(os, 'add_dll_directory') else None
        import sherpa_onnx
        self.model = sherpa_onnx.OfflineRecognizer.from_sense_voice(
            model=str(root / 'model/model.int8.onnx'), tokens=str(root / 'model/tokens.txt'),
            num_threads=4, provider='cpu', language={'zh-CN':'zh','en-US':'en','ja-JP':'ja'}[language],
            use_itn=True)

    def transcribe(self, audio, rate, config, emit):
        import numpy as np
        if len(audio) / rate < .25 or float(np.sqrt(np.mean(audio ** 2))) < .0004:
            emit('diagnostic', message='没有收到足够清晰的说话声，请靠近麦克风再试。')
            return
        emit('processing')
        stream = self.model.create_stream()
        stream.accept_waveform(rate, np.asarray(audio, dtype='float32'))
        self.model.decode_stream(stream)
        text = stream.result.text.strip()
        if config['language'] == 'zh-CN':
            from opencc import OpenCC
            text = OpenCC('t2s').convert(text)
        if text:
            # SenseVoice exposes no calibrated confidence. This is an acceptance
            # flag after explicit VAD segmentation, not a probability of correctness.
            emit('final', text=text, confidence=.8, confidenceKind='vad-segment-accepted', engine='sensevoice')

def available(runtime):
    root = Path(runtime) / 'fast'
    return (root / 'model/model.int8.onnx').is_file() and (root / 'model/tokens.txt').is_file() and (root / 'vendor/sherpa_onnx/lib').is_dir()
