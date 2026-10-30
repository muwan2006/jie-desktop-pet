"""Encode the actual completed cover as a portable MP3, without playback."""
from pathlib import Path
import argparse,json,hashlib,os
import av
parser=argparse.ArgumentParser()
parser.add_argument('--source',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args()
source,output=Path(args.source).resolve(),Path(args.output).resolve()
temp=output.with_suffix('.mp3.part')
try:
    if not source.is_file() or source.stat().st_size>200*1024*1024:
        raise ValueError('翻唱文件不存在或超过处理上限。')
    duration=0
    with av.open(str(source)) as inp, av.open(str(temp),'w',format='mp3') as out:
        stream=out.add_stream('libmp3lame',rate=44100)
        stream.bit_rate=160000
        stream.layout='stereo'
        resample=av.AudioResampler(format='fltp',layout='stereo',rate=44100)
        for frame in inp.decode(audio=0):
            for converted in resample.resample(frame):
                duration+=converted.samples/44100
                if duration>901:raise ValueError('歌曲超过15分钟。')
                for packet in stream.encode(converted):out.mux(packet)
        for frame in resample.resample(None):
            for packet in stream.encode(frame):out.mux(packet)
        for packet in stream.encode(None):out.mux(packet)
    if temp.stat().st_size<1024 or temp.stat().st_size>32*1024*1024:
        raise ValueError('导出的MP3为空或超过32MB。')
    os.replace(temp,output)
    print(json.dumps({'ok':True,'duration':duration,'bytes':output.stat().st_size,
        'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}),flush=True)
finally:
    if temp.exists():temp.unlink()
