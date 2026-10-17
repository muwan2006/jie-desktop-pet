'use strict';
(()=>{const $=id=>document.getElementById(id);let recognitionKey='';async function operation(op,v){try{const r=await window.jie.assistant(op,v);$('assistant-error').textContent=r?.error||'';return r;}catch{$('assistant-error').textContent='操作没有完成，请重试。';}}
 function render(s){window.JieTaskView.speech(s);window.JieTaskView.render($('task-current'),s.tasks?.current,operation);$('task-plan').disabled=!!s.tasks?.busy||!!s.speech?.active;const key=JSON.stringify(s.recognition);if(key!==recognitionKey){recognitionKey=key;if(s.recognition){$('task-text').value=s.recognition.text;$('assistant-error').textContent=s.recognition.needsReview?'没听清时可再按快捷键说“确认”，或重新说一遍；也可以编辑文字。':'';}}}
 $('desktop-talk').onclick=()=>operation('voice-toggle');$('task-form').onsubmit=async e=>{e.preventDefault();await operation('task-propose',{text:$('task-text').value});};window.jie.onAssistant(render);window.jie.assistant('state').then(render);
})();
