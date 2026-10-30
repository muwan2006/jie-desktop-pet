"""Offline SoulX-Singer-SVC with the timbre and settings accepted in listening."""
import argparse
import gc
import json
import os
import sys
from pathlib import Path
import numpy as np

ENGINE = 'soulx-svc-v1'


def frame_f0(extractor, wave, device):
    """Match the pilot's RMVPE interpolation, retaining unvoiced intervals."""
    raw = np.asarray(extractor.infer_from_audio(wave, 44100, device=device,
        thred=.03, use_viterbi=False), dtype=np.float32)
    uv = raw <= 0
    filled = raw.copy()
    if (~uv).any():
        filled[uv] = np.interp(np.flatnonzero(uv), np.flatnonzero(~uv), raw[~uv])
    times = np.arange(len(wave)//882 + 1) * .02
    result = np.interp(times, np.arange(len(raw))*.01, filled)
    result[np.interp(times, np.arange(len(raw))*.01, uv.astype(float)) > .5] = 0
    return result.astype(np.float32)


def source_f0(extractor, wave, device):
    # Bound RMVPE memory for whole songs; context is cropped, never stretched.
    if len(wave) <= 30*44100:
        return frame_f0(extractor, wave, device)
    result = np.zeros(len(wave)//882 + 1, dtype=np.float32)
    for start in range(0, len(result), 1000):
        end = min(start+1000, len(result))
        left, right = max(0, start-25), min(len(result), end+25)
        part = wave[left*882:min(len(wave), right*882)]
        f0 = frame_f0(extractor, part, device)
        result[start:end] = f0[start-left:start-left+end-start]
    return result


def main(args):
    root = Path(args.runtime).resolve()
    marker = json.loads((root/'READY.json').read_text(encoding='utf-8-sig'))
    if marker.get('engine') != ENGINE:
        raise ValueError('需要新版 SoulX 歌声组件，旧转换引擎不会作为备用运行。')
    sys.path[:0] = [str(root/'soulx'), str(root/'f0')]
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    os.environ['JIE_SOULX_WHISPER_PATH'] = str(root/'models/whisper-base')
    import torch
    import librosa
    import soundfile as sf
    from rmvpe import RMVPE
    from soulxsinger.models.soulxsinger_svc import SoulXSingerSVC
    from soulxsinger.utils.file_utils import load_config
    from soulxsinger.utils.audio_utils import load_wav
    torch.set_num_threads(4)
    torch.manual_seed(20261024)
    np.random.seed(20261024)
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    source, reference = Path(args.source).resolve(), Path(args.reference).resolve()
    info, ref_info = sf.info(source), sf.info(reference)
    if not 1 <= info.duration <= 900 or not 1 <= ref_info.duration <= 30:
        raise ValueError('歌曲应在1秒到15分钟之间，音色参考应在1到30秒之间。')
    wave, _ = librosa.load(source, sr=44100)
    ref, _ = librosa.load(reference, sr=44100)
    if not np.isfinite(wave).all() or not np.isfinite(ref).all():
        raise ValueError('音源包含无效采样。')
    extractor = RMVPE(str(root/'models/rmvpe/model.pt'), hop_length=160)
    gt_f0, pt_f0 = source_f0(extractor, wave, device), frame_f0(extractor, ref, device)
    if not (gt_f0 > 0).any() or not (pt_f0 > 0).any():
        raise ValueError('没有检测到可转换的演唱或参考人声。')
    del extractor
    gc.collect()
    if device == 'cuda':
        torch.cuda.empty_cache()
    config = load_config(str(root/'soulx/soulxsinger/config/soulxsinger.yaml'))
    model = SoulXSingerSVC(config)
    checkpoint = torch.load(root/'models/soulx-svc/model-svc.pt', map_location='cpu', weights_only=False)
    model.load_state_dict(checkpoint['state_dict'], strict=True)
    del checkpoint
    use_fp16 = device == 'cuda'
    if use_fp16:
        model.half()
        model.mel.float()
    model.to(device).eval()
    pt_wav = load_wav(str(reference), 24000).to(device)
    gt_wav = load_wav(str(source), 24000)  # Keep whole-song buffers off GPU.
    pt_pitch = torch.from_numpy(pt_f0)[None].to(device)
    output = torch.zeros(gt_wav.shape[-1], dtype=torch.float32)
    # Ten-second cores with 300ms context bound GPU memory. All samples keep
    # their original time and key. Crossfades only cover the joins.
    core, context = 10*24000, 7200
    count = (gt_wav.shape[-1]+core-1)//core
    with torch.inference_mode():
        for index, start in enumerate(range(0, gt_wav.shape[-1], core)):
            end = min(start+core, gt_wav.shape[-1])
            left, right = max(0, start-context), min(gt_wav.shape[-1], end+context)
            pitch = torch.from_numpy(gt_f0[left//480:right//480+1])[None].to(device)
            part = gt_wav[:, left:right].to(device)
            if not (pitch > 0).any() and float(part.abs().max()) < .005:
                generated = np.zeros(right-left, dtype=np.float32)
            else:
                audio, shift = model.infer(pt_wav, part, pt_pitch, pitch,
                    auto_shift=False, pitch_shift=0, n_steps=32, cfg=3., use_fp16=use_fp16)
                if shift != 0:
                    raise ValueError('意外的音高调整，未输出歌曲。')
                generated = audio.squeeze().float().cpu().numpy()
            if len(generated) != right-left or not np.isfinite(generated).all():
                raise ValueError('歌声片段长度或采样异常。')
            output[start:end] = torch.from_numpy(generated[start-left:end-left].copy())
            if index:
                fade = min(1200, start-left)
                weight = torch.linspace(0, 1, fade)
                prior = output[start-fade:start].clone()
                current = torch.from_numpy(generated[start-left-fade:start-left].copy())
                output[start-fade:start] = prior*(1-weight)+current*weight
            print(json.dumps({'stage':'converting','completed':index+1,'total':count}), flush=True)
    converted = librosa.resample(output.numpy(), orig_sr=24000, target_sr=44100)
    target_len = round(info.frames/info.samplerate*44100)
    converted = np.pad(converted, (0, max(0,target_len-len(converted))))[:target_len]
    src_rms = float(np.sqrt(np.mean(wave**2)))
    rms = float(np.sqrt(np.mean(converted**2)))
    peak = float(np.abs(converted).max())
    if rms < 1e-6:
        raise ValueError('转换结果没有有效歌声。')
    converted *= min(2., src_rms/rms, .95/max(1e-9,peak))
    destination = Path(args.output).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    sf.write(destination/'voice.wav', converted, 44100, subtype='FLOAT')
    (destination/'conversion.json').write_text(json.dumps({
        'engine':ENGINE,'sampleRate':44100,'duration':len(converted)/44100,
        'pitchShift':0,'autoShift':False,'phoneticTimeWarp':False,
        'chunks':count,'device':device,'reference':str(reference),
        'peakGpuAllocatedMiB':torch.cuda.max_memory_allocated()/2**20 if use_fp16 else 0,
    }, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for key in ['runtime','source','reference','output']:
        parser.add_argument('--'+key, required=True)
    try:
        main(parser.parse_args())
    except Exception as error:
        print(str(error), file=sys.stderr, flush=True)
        sys.exit(1)
