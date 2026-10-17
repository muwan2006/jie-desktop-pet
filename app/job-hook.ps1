param([Parameter(Mandatory=$true)][string]$Directory,[string]$Payload='')
$ErrorActionPreference='Stop'
[Console]::InputEncoding=New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
try {
 if(-not $Payload){$Payload=[Console]::In.ReadToEnd()}
 if($Payload.Length -gt 1048576){throw 'Oversized hook input'}
 $taskData=$Payload|ConvertFrom-Json
 $taskEvent=if($taskData.hook_event_name){$taskData.hook_event_name}else{$taskData.type}
 $taskMap=@{UserPromptSubmit='working';PermissionRequest='waiting';Stop='done';Interrupt='canceled';'agent-turn-complete'='done'}
 if($taskMap.ContainsKey($taskEvent)){
  $taskSession=if($taskData.session_id){$taskData.session_id}else{$taskData.'thread-id'}
  if(-not $taskSession){$taskSession='codex'}
  if($taskData.turn_id){$taskSession=[string]$taskSession+':'+[string]$taskData.turn_id}
  $taskId='codex:'+([string]$taskSession -replace '[^\w:.-]','_').Substring(0,[Math]::Min(150,([string]$taskSession).Length))
  $taskTitle=if($taskData.cwd){Split-Path -Leaf $taskData.cwd}else{'当前会话'}
  $taskRecord=@{id=$taskId;title=$taskTitle;source='Codex';status=$taskMap[$taskEvent];at=[DateTimeOffset]::Now.ToUnixTimeMilliseconds()}
  New-Item -ItemType Directory -Path $Directory -Force|Out-Null
  $taskHasher=[Security.Cryptography.SHA256]::Create();$taskName=[BitConverter]::ToString($taskHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($taskId))).Replace('-','').ToLower();$taskHasher.Dispose()
  $taskFinal=Join-Path $Directory ($taskName+'.json');$taskTmp=$taskFinal+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
  [IO.File]::WriteAllText($taskTmp,($taskRecord|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
  if(Test-Path -LiteralPath $taskFinal){[IO.File]::Replace($taskTmp,$taskFinal,[NullString]::Value)}else{[IO.File]::Move($taskTmp,$taskFinal)}
 }
  $taskReceipt=@{event=[string]$taskEvent;ok=$true;at=[DateTimeOffset]::Now.ToUnixTimeMilliseconds()}
  [IO.File]::WriteAllText((Join-Path $Directory '.codex-hook-status.json'),($taskReceipt|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
} catch {try{[IO.Directory]::CreateDirectory($Directory)|Out-Null;[IO.File]::WriteAllText((Join-Path $Directory '.codex-hook-status.json'),(@{event=[string]$taskEvent;ok=$false;at=[DateTimeOffset]::Now.ToUnixTimeMilliseconds()}|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))}catch{}}
[Console]::WriteLine('{}')
