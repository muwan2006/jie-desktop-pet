'use strict';
(()=>{const root=document.getElementById('page-qq');if(!root)return;
 const connect=document.getElementById('qq-connect'),status=document.getElementById('qq-status');
 const recovery=document.createElement('p');recovery.id='qq-recovery-status';recovery.hidden=true;status.after(recovery);
 const setup=document.getElementById('qq-bridge-start')?.closest('section');if(setup){const details=document.createElement('details');details.className='qq-compact-details';const summary=document.createElement('summary');summary.textContent='首次授权与高级诊断（通常无需操作）';details.append(summary);for(const child of [...setup.children])if(child.tagName!=='H2')details.append(child);setup.append(details);}
 const help=document.createElement('p');help.textContent='QQ已登录时，只需点一次“连接QQ”。桌宠会自动启动服务、检查账号并连接；只有QQ实际退出登录时才需要扫码。';connect?.parentElement.insertBefore(help,document.getElementById('qq-connection-advanced'));
 const phases=new Set(['starting','warming','checking']);
 function paint(s){const r=s.bridge?.recovery;recovery.textContent=r?.message||'';if(connect){const busy=s.settings?.enabled&&phases.has(r?.phase);connect.disabled=!!busy;connect.textContent=busy?'正在连接QQ…':'连接QQ';}if(s.settings?.enabled&&phases.has(r?.phase)){status.textContent=r.message;document.getElementById('qq-error').textContent='';}}
 window.jie.onQQ(paint);void window.jie.qq('state').then(paint).catch(()=>{});
})();
