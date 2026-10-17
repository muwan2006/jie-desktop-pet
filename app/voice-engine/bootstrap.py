"""Start the installed upstream GPT-SoVITS API with a small-GPU configuration."""
import argparse
import json
import os
from pathlib import Path
import sys
import subprocess


def run_api(root, port, config_path):
    # Windows execv releases the waiting launcher and can hide child failures.
    # Use an argument list (including paths with spaces) and wait in this console.
    return subprocess.run(
        [sys.executable, '-u', str(root / 'api_v2.py'), '-a', '127.0.0.1',
         '-p', str(port), '-c', str(config_path)],
        cwd=str(root), check=False,
    ).returncode


def model_config(root, device):
    root = Path(root).resolve()
    relative = {
        't2s_weights_path': 'GPT_SoVITS/pretrained_models/s1v3.ckpt',
        'vits_weights_path': 'GPT_SoVITS/pretrained_models/v2Pro/s2Gv2Pro.pth',
        'cnhuhbert_base_path': 'GPT_SoVITS/pretrained_models/chinese-hubert-base',
        'bert_base_path': 'GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large',
    }
    record = root / 'jie-trained-models.json'
    if record.exists():
        selected = json.loads(record.read_text(encoding='utf-8-sig'))
        for key, extension in [('t2s_weights_path', '.ckpt'), ('vits_weights_path', '.pth')]:
            value = selected.get(key)
            if not isinstance(value, str) or not value.strip():
                raise RuntimeError('Invalid trained model record: ' + key)
            path = Path(value)
            if not path.is_absolute():
                path = root / path
            if path.suffix.lower() != extension or not path.is_file():
                raise RuntimeError('Trained model missing or wrong type: ' + str(path))
            relative[key] = str(path.resolve())
    missing = [name for name in relative.values() if not (root / name).exists()]
    sv = root / 'GPT_SoVITS/pretrained_models/sv/pretrained_eres2netv2w24s4ep4.ckpt'
    if not sv.exists():
        missing.append(str(sv.relative_to(root)))
    if missing:
        raise RuntimeError('Missing model files: ' + ', '.join(missing))
    return {'custom': {'device': device, 'is_half': device == 'cuda', 'version': 'v2Pro',
                       **{key: str(root / value).replace('\\', '/') for key, value in relative.items()}}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--port', type=int, default=9880)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    root = Path(args.root).resolve()
    if not (root / 'api_v2.py').is_file():
        raise RuntimeError('Cannot find the installed api_v2.py. Run SETUP-JIE-VOICE.bat again.')
    if not 1024 <= args.port <= 65535:
        raise RuntimeError('Invalid port.')
    os.chdir(root)
    os.environ['PATH'] = str(root) + os.pathsep + str(root / 'runtime') + os.pathsep + os.environ.get('PATH', '')
    cache = root / 'jie-runtime-cache'
    os.environ['HF_HOME'] = str(cache / 'huggingface')
    os.environ['TORCH_HOME'] = str(cache / 'torch')
    os.environ['XDG_CACHE_HOME'] = str(cache)
    import torch
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print('PyTorch:', torch.__version__, flush=True)
    if device == 'cuda':
        props = torch.cuda.get_device_properties(0)
        print('GPU:', props.name, '| VRAM:', round(props.total_memory / 1024**3, 2), 'GB', flush=True)
    else:
        print('CUDA not available. CPU mode will be used; first response may take longer.', flush=True)
    config = model_config(root, device)
    target = root / 'GPT_SoVITS/configs/jie_voice_infer.yaml'
    target.parent.mkdir(parents=True, exist_ok=True)
    # JSON is valid YAML, avoids another parser dependency in this launcher.
    target.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Model: v2Pro | Half precision:', device == 'cuda', flush=True)
    print('GPT weights:', config['custom']['t2s_weights_path'], flush=True)
    print('SoVITS weights:', config['custom']['vits_weights_path'], flush=True)
    print('Local endpoint: http://127.0.0.1:' + str(args.port), flush=True)
    print('When Uvicorn reports ready, open the pet Sounds page and test a line.', flush=True)
    print('Press Ctrl+C here to stop the service and release model memory.', flush=True)
    if args.check:
        return
    os.chdir(root)
    os.environ['PATH'] = str(root) + os.pathsep + str(root / 'runtime') + os.pathsep + os.environ.get('PATH', '')
    print('Starting API; model loading messages will appear below.', flush=True)
    returncode = run_api(root, args.port, target)
    if returncode != 0:
        print('API exited with code:', returncode, file=sys.stderr, flush=True)
    sys.exit(returncode)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Voice service stopped.', flush=True)
        sys.exit(0)
    except Exception as exc:
        print('Voice startup failed:', exc, file=sys.stderr, flush=True)
        sys.exit(1)
