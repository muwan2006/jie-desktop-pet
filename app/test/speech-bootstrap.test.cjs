'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),python=path.join(root,'asr-runtime','python.exe');
test('isolated embedded Python imports speech workers without the app on sys.path',{skip:!fs.existsSync(python)},()=>{
 const script=`import importlib.util,sys\nfrom pathlib import Path\nroot=Path(sys.argv[1])\nfor name in ['speech-local.py','speech-call.py','speech-wake.py']:\n spec=importlib.util.spec_from_file_location('test_'+name.replace('-','_'),root/name)\n module=importlib.util.module_from_spec(spec)\n spec.loader.exec_module(module)\nprint('workers-imported')\n`;
 const result=spawnSync(python,['-B','-c',script,root],{encoding:'utf8',windowsHide:true,timeout:20000});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/workers-imported/);
});
