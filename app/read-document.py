import sys, json, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent/'document-vendor'))
def read(file):
    if file.stat().st_size > 25*1024*1024: raise ValueError('文档最多25 MB。')
    parts=[]; truncated=False
    if file.suffix.lower()=='.docx':
        with zipfile.ZipFile(file) as z:
            info=z.getinfo('word/document.xml')
            if info.file_size>20*1024*1024: raise ValueError('DOCX 正文过大。')
            data=z.read(info)
            if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper(): raise ValueError('不支持含外部实体的文档。')
            root=ET.fromstring(data)
            for p in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                parts.append(''.join(t.text or '' for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t')))
    elif file.suffix.lower()=='.pdf':
        from pypdf import PdfReader
        reader=PdfReader(str(file))
        if reader.is_encrypted: raise ValueError('请先解锁加密 PDF。')
        for i,p in enumerate(reader.pages):
            if i>=200 or sum(map(len,parts))>=100000: truncated=True;break
            stream=p.get_contents()
            if stream and len(stream.get_data())>20*1024*1024: raise ValueError('PDF 页面过大。')
            parts.append(p.extract_text() or '')
    else: raise ValueError('文档格式不支持。')
    text='\n'.join(parts);return dict(text=text[:100000],truncated=truncated or len(text)>100000)
if __name__=='__main__':
    try: print(json.dumps(read(Path(json.loads(sys.stdin.readline())['file'])),ensure_ascii=True))
    except Exception as e: print(json.dumps(dict(error=str(e)[:300]),ensure_ascii=True));sys.exit(1)
