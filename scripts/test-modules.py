"""Run the application checks in an isolated assembly of all optional source modules.

Use --runtime PATH (or JIE_TEST_RUNTIME) for the extracted official local-runtime
component. Nothing is installed into the source tree or a real user profile.
"""
from pathlib import Path
import argparse, os, shutil, subprocess, tempfile

project=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--runtime',type=Path,default=os.environ.get('JIE_TEST_RUNTIME'))
p.add_argument('--node',default=shutil.which('node'))
a=p.parse_args()
if not a.node:p.error('Node.js is required')
runtime=(Path(a.runtime) if a.runtime else project/'app/asr-runtime').resolve()
if not(runtime/'python.exe').is_file():p.error('Provide the extracted local-runtime component using --runtime or JIE_TEST_RUNTIME; document integration checks require it.')
with tempfile.TemporaryDirectory(prefix='jie-community-tests-',dir=runtime.parent) as temporary:
    stage=Path(temporary)/'app'
    shutil.copytree(project/'app',stage,ignore=shutil.ignore_patterns('node_modules','__pycache__','asr-runtime'))
    for component in (project/'components').iterdir():
        if(component/'files').is_dir():shutil.copytree(component/'files',stage,dirs_exist_ok=True)
    deps=project/'app/node_modules/jose'
    if not deps.is_dir():p.error('Run npm ci in app first; jose is required.')
    shutil.copytree(deps,stage/'node_modules/jose')
    # Large verified runtime files are linked in the temporary test assembly only.
    shutil.copytree(runtime,stage/'asr-runtime',copy_function=os.link,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    completed=subprocess.run([a.node,'--test','--test-reporter=tap',*map(str,sorted((stage/'test').glob('*.test.cjs')))],cwd=stage)
    raise SystemExit(completed.returncode)
