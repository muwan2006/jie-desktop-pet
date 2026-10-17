"""Explicit optional component download; startup never invokes this script."""
from pathlib import Path
import hashlib,json,tarfile,tempfile,urllib.request,shutil
root=Path(__file__).parent/'wake-model'
source=json.loads((root/'SOURCE.json').read_text(encoding='utf-8'))
def digest(p):
 h=hashlib.sha256()
 with p.open('rb')as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
if all((root/n).is_file()and digest(root/n)==v['sha256']for n,v in source['files'].items()):
 print('Wake component is already installed and verified.');raise SystemExit(0)
members={'encoder.onnx':'encoder-epoch-13-avg-2-chunk-8-left-64.int8.onnx','decoder.onnx':'decoder-epoch-13-avg-2-chunk-8-left-64.onnx','joiner.onnx':'joiner-epoch-13-avg-2-chunk-8-left-64.int8.onnx','tokens.txt':'tokens.txt'}
with tempfile.TemporaryDirectory(prefix='jie-wake-download-')as folder:
 archive=Path(folder)/'model.tar.bz2';urllib.request.urlretrieve(source['source'],archive)
 if digest(archive)!=source['archive_sha256']:raise RuntimeError('Official model archive checksum mismatch')
 with tarfile.open(archive)as t:
  for n,wanted in members.items():
   found=[m for m in t.getmembers()if m.isfile()and Path(m.name).name==wanted]
   if len(found)!=1 or found[0].size!=source['files'][n]['bytes']:raise RuntimeError('Model archive contents mismatch')
   p=Path(folder)/n
   with t.extractfile(found[0])as src,p.open('wb')as dst:shutil.copyfileobj(src,dst)
   if digest(p)!=source['files'][n]['sha256']:raise RuntimeError('Model file checksum mismatch')
  for n in members:shutil.copy2(Path(folder)/n,root/n)
print('Wake component installed. Reopen Jie, then enable wake by name in settings.')
