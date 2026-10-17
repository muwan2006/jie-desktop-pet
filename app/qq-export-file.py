"""Generate bounded ordinary DOCX/XLSX documents; no macros, formulas or external links."""
import sys,json,io,base64,zipfile
from xml.sax.saxutils import escape
sys.stdin.reconfigure(encoding='utf-8');sys.stdout.reconfigure(encoding='utf-8')
def make(v):
 fmt=v.get('format'); title=str(v.get('title',''))[:100];text=str(v.get('content',''))[:60000]
 rows=[[str(c)[:2000] for c in row[:20]] for row in v.get('rows',[])[:500] if isinstance(row,list)]
 if sum(len(c) for r in rows for c in r)>200000:raise ValueError('表格内容过大')
 def x(s):return escape(''.join(c for c in str(s) if c in '\n\r\t' or ord(c)>=32))
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="'+('word/document.xml' if fmt=='docx' else 'xl/workbook.xml')+'"/></Relationships>')
  if fmt=='docx':
   def p(s):return '<w:p><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="Microsoft YaHei"/></w:rPr><w:t xml:space="preserve">'+x(s)+'</w:t></w:r></w:p>'
   body=p(title)+''.join(p(s) for s in text.splitlines())
   if rows:body+='<w:tbl><w:tblPr><w:tblBorders>'+''.join('<w:'+b+' w:val="single" w:sz="4" w:color="9A987E"/>' for b in ['top','left','bottom','right','insideH','insideV'])+'</w:tblBorders></w:tblPr><w:tblGrid>'+''.join('<w:gridCol w:w="2400"/>' for _ in range(max(len(row) for row in rows)))+'</w:tblGrid>'+ ''.join('<w:tr>'+''.join('<w:tc>'+p(c)+'</w:tc>' for c in r)+'</w:tr>' for r in rows)+'</w:tbl>'
   z.writestr('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>')
   override='<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
  elif fmt=='xlsx':
   if not rows:rows=[[title]]+[[s] for s in text.splitlines()]
   records=[]
   for i,row in enumerate(rows,1):records.append('<row r="'+str(i)+'">'+''.join('<c r="'+chr(65+j)+str(i)+'" t="inlineStr"><is><t xml:space="preserve">'+x(c)+'</t></is></c>' for j,c in enumerate(row))+'</row>')
   z.writestr('xl/worksheets/sheet1.xml','<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols><col min="1" max="20" width="24" customWidth="1"/></cols><sheetData>'+''.join(records)+'</sheetData></worksheet>')
   z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="整理结果" sheetId="1" r:id="rId1"/></sheets></workbook>')
   z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
   override='<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
  else:raise ValueError('格式不支持')
  z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+override+'</Types>')
 return out.getvalue()
if __name__=='__main__':
 try:
  v=json.loads(sys.stdin.read(500000));b=make(v);print(json.dumps({'base64':base64.b64encode(b).decode('ascii')}))
 except Exception as e:print(json.dumps({'error':str(e)[:160]},ensure_ascii=False));sys.exit(1)
