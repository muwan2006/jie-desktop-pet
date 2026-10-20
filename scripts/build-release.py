"""Build the public Windows edition from explicit, non-personal inputs.

Python 3.10+ and Node.js 22+; no third-party Python packages required.
The signing key stays OUTSIDE the source tree and is never copied to a release.
"""
from pathlib import Path
import argparse, hashlib, json, os, shutil, subprocess, zipfile

ROOT = Path(__file__).resolve().parents[1]
def digest(file):
    h = hashlib.sha256()
    with file.open('rb') as stream:
        for part in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            h.update(part)
    return h.hexdigest()
def write(file, value):
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
def archive(target, files, descriptor=None):
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=3, allowZip64=True) as z:
        if descriptor:
            z.writestr('COMPONENT.json', json.dumps(descriptor, ensure_ascii=False))
        for name, file in sorted(files.items()):
            z.write(file, name)
def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--electron-dir', type=Path)
    p.add_argument('--dependencies', type=Path)
    p.add_argument('--local-runtime', required=True, type=Path)
    p.add_argument('--wake-model', type=Path, help='Verified upstream KWS ONNX files for the speech component.')
    p.add_argument('--signing-key', required=True, type=Path)
    p.add_argument('--out', required=True, type=Path)
    p.add_argument('--catalog-only', action='store_true')
    p.add_argument('--basic-only', action='store_true', help='Keep the existing signed component catalog and build only the basic edition.')
    a = p.parse_args()
    app, packs = ROOT/'app', ROOT/'components'
    build_version=json.loads((app/'package.json').read_text(encoding='utf-8'))['version']
    out, key = a.out.resolve(), a.signing_key.resolve()
    if key.is_relative_to(ROOT) or out.is_relative_to(ROOT):
        p.error('Signing key and build output must be outside the source tree.')
    out.mkdir(parents=True, exist_ok=True)
    key.parent.mkdir(parents=True, exist_ok=True)
    node = shutil.which('node')
    if not node: p.error('Node.js is required for Ed25519 signing.')
    subprocess.run([node, '-e', "const f=require('fs'),c=require('crypto');const [priv,pub]=process.argv.slice(1);if(!f.existsSync(priv)){const k=c.generateKeyPairSync('ed25519');f.writeFileSync(priv,k.privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});}f.writeFileSync(pub,c.createPublicKey(f.readFileSync(priv)).export({type:'spki',format:'pem'}));", str(key), str(app/'community-public-key.pem')], check=True)
    defs = json.loads((ROOT/'component-definitions.json').read_text(encoding='utf-8'))
    components = []
    for id, definition in ([] if a.basic_only else defs.items()):
        print('Building', id, flush=True)
        base = packs/id/'files'
        files = {f.relative_to(base).as_posix(): f for f in base.rglob('*') if f.is_file()}
        if id == 'speech':
            if not a.wake_model: p.error('--wake-model is required for building speech; the basic-only build reuses its signed catalog.')
            provenance = json.loads((app/'wake-model/SOURCE.json').read_text(encoding='utf-8'))
            for name in ('encoder.onnx', 'decoder.onnx', 'joiner.onnx'):
                model = a.wake_model.resolve()/name
                if not model.is_file() or digest(model) != provenance['files'][name]['sha256']:
                    p.error('Missing or altered official wake model: '+name)
                files['wake-model/'+name] = model
        if id == 'local-runtime':
            runtime = a.local_runtime.resolve()
            if not (runtime/'python.exe').is_file() or not (runtime/'model/LICENSE.txt').is_file():
                p.error('Expected the documented Python/Whisper runtime with its model license.')
            files.update({'asr-runtime/'+f.relative_to(runtime).as_posix(): f for f in runtime.rglob('*') if f.is_file() and '__pycache__' not in f.parts and f.suffix != '.pyc'})
        for name, file in files.items():
            if file.is_symlink(): p.error('Symlink in component: '+name)
        asset = f'jie-{id}-{definition["version"]}.zip'
        package = out/asset
        descriptor = {'schema': 1, 'id': id, 'version': definition['version']}
        hashes = {name: digest(file) for name, file in sorted(files.items())}
        # Reuse an unchanged local build, without trusting its content blindly.
        receipt = out/(asset+'.build.json')
        previous = json.loads(receipt.read_text()) if receipt.exists() else {}
        if not package.exists() or previous.get('files') != hashes or previous.get('sha256') != digest(package):
            archive(package, {'files/'+name: file for name, file in files.items()}, descriptor)
            write(receipt, {'files': hashes, 'sha256': digest(package)})
        components.append({k: definition[k] for k in ('name', 'description', 'dependencies', 'version', 'shared', 'large') if k in definition} | {'id': id, 'asset': asset, 'bytes': package.stat().st_size, 'sha256': digest(package), 'files': hashes})
    if a.basic_only:
        subprocess.run([node, '-e', "const f=require('fs');require(process.argv[1]).catalog(JSON.parse(f.readFileSync(process.argv[2],'utf8')),f.readFileSync(process.argv[3],'utf8'));", str(app/'community-components.cjs'), str(app/'community-catalog.json'), str(app/'community-public-key.pem')], check=True)
        components = json.loads((app/'community-catalog.json').read_text(encoding='utf-8'))['payload']['components']
    else:
        payload = {'schema': 1, 'coreVersion': '1.1.1', 'components': components}
        unsigned = out/'payload.build.json'
        write(unsigned, payload)
        subprocess.run([node, '-e', "const f=require('fs'),c=require('crypto');const [src,key,dest]=process.argv.slice(1),payload=JSON.parse(f.readFileSync(src,'utf8'));f.writeFileSync(dest,JSON.stringify({payload,signature:c.sign(null,Buffer.from(JSON.stringify(payload)),f.readFileSync(key)).toString('base64')},null,2));", str(unsigned), str(key), str(app/'community-catalog.json')], check=True)
    shutil.copy2(app/'community-catalog.json', out/'catalog.json')
    core = {f.relative_to(app).as_posix(): digest(f) for f in app.rglob('*') if f.is_file() and not any(x in f.parts for x in ('test', 'node_modules')) and f.name not in ('community-core-manifest.json','community-env.js','community-installed.json')}
    write(app/'community-core-manifest.json', core)
    if a.catalog_only: return
    if not a.electron_dir or not a.dependencies: p.error('--electron-dir and --dependencies are required for the portable release.')
    portable = out/'Jie-Desktop-Pet-Community-Windows-x64'
    if portable.exists(): p.error('Portable output already exists; use a new output directory for a fresh build.')
    portable.mkdir()
    # Only known Electron shell files; no old QA executable, profile, app or backups.
    for f in a.electron_dir.iterdir():
        if f.is_file() and (f.suffix.lower() in ('.exe','.dll','.bin','.dat') or f.name in ('chrome_100_percent.pak','chrome_200_percent.pak','resources.pak','LICENSE','LICENSES.chromium.html','version','vk_swiftshader_icd.json')) and f.name != 'Jie-Test.exe':
            shutil.copy2(f, portable/f.name)
    shutil.copytree(a.electron_dir/'locales', portable/'locales')
    target = portable/'resources/app'
    shutil.copytree(app, target, ignore=shutil.ignore_patterns('test','node_modules','community-installed.json','community-env.js','__pycache__','*.pyc'))
    shutil.copytree(a.dependencies, target/'node_modules')
    shutil.copytree(ROOT/'docs', portable/'docs')
    (portable/'使用说明.md').write_text('# 颉桌宠使用说明\n\n从 [完整使用指南](docs/USER_GUIDE.zh-CN.md) 开始。也可在面板的功能中心打开在线说明。\n',encoding='utf-8')
    shutil.copy2(ROOT/'README.md', portable/'README.md')
    shutil.copy2(ROOT/'THIRD_PARTY_NOTICES.md', portable/'THIRD_PARTY_NOTICES.md')
    (portable/'START-JIE.bat').write_bytes(b'@echo off\r\ncd /d "%~dp0"\r\nstart "" "%~dp0Jie.exe"\r\n')
    write(out/'build-report.json', {'version':build_version,'repository':'muwan2006/jie-desktop-pet','basicExpandedBytes':sum(f.stat().st_size for f in portable.rglob('*') if f.is_file()),'components':[{k:v for k,v in c.items() if k!='files'} for c in components]})
    print('Packing basic edition', flush=True)
    archive(out/f'Jie-Desktop-Pet-Community-{build_version}-Windows-x64.zip', {portable.name+'/'+f.relative_to(portable).as_posix():f for f in portable.rglob('*') if f.is_file()})
    (out/'SHA256SUMS.txt').write_text('\n'.join(digest(f)+'  '+f.name for f in sorted(out.glob('*.zip')))+'\n',encoding='utf-8')
    print('Build complete:', out, flush=True)
if __name__ == '__main__': main()
