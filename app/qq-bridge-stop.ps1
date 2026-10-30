param([switch]$PreviewOnly,[switch]$OrphansOnly,[switch]$WorkerOnly)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath($env:JIE_BRIDGE_ROOT)
if($env:JIE_BRIDGE_EXE -notin @('NapCatWinBootMain.exe','LuckyLillia.exe')){throw 'Unsupported launcher'}
$taskLauncher=[IO.Path]::GetFullPath((Join-Path $taskRoot $env:JIE_BRIDGE_EXE))
$taskProcesses=@(Get-CimInstance Win32_Process)
$taskSelectedWorker=[IO.Path]::GetFullPath((Join-Path $taskRoot 'bin/pmhq/pmhq.exe'))
$taskSelectedConfig=[IO.Path]::GetFullPath((Join-Path $taskRoot 'jie-selected-pmhq.json'))
$taskRoots=@($taskProcesses | Where-Object { $_.ExecutablePath -and ([IO.Path]::GetFullPath($_.ExecutablePath) -eq $taskLauncher -or $env:JIE_BRIDGE_EXE -eq 'LuckyLillia.exe' -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $taskSelectedWorker -and $_.CommandLine -and $_.CommandLine.Replace('/','\').Contains($taskSelectedConfig)) })
if($WorkerOnly){$taskRoots=@()}
if($OrphansOnly -and $taskRoots.Count){exit 0}
if(($WorkerOnly -or -not $OrphansOnly -or -not $taskRoots.Count) -and $env:JIE_BRIDGE_EXE -eq 'LuckyLillia.exe' -and (Test-Path -LiteralPath $taskSelectedConfig)){
 $taskLLNode=[IO.Path]::GetFullPath((Join-Path $taskRoot 'bin/llbot/node.exe'))
 $taskRoots+=@($taskProcesses|Where-Object {$_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $taskLLNode -and $_.CommandLine -match 'llbot\.js' -and $_.CommandLine -match '--pmhq-port(?:=|\s+)13000(?:\s|$)'})
}
if(-not $taskRoots.Count){exit 0}
$taskTargets=@($taskRoots.ProcessId)
do {
 $taskChildren=@($taskProcesses | Where-Object { $_.ParentProcessId -in $taskTargets -and $_.ProcessId -notin $taskTargets })
 $taskTargets+=@($taskChildren.ProcessId)
}while($taskChildren.Count)
if($PreviewOnly){@($taskProcesses|Where-Object {$_.ProcessId -in $taskTargets -and $_.Name -ne 'QQ.exe' -and $_.CommandLine -notmatch 'dr-janitor'}|Select-Object Name,ProcessId)|ConvertTo-Json -Compress;exit 0}
foreach($taskPid in @($taskTargets | Sort-Object -Descending)){
 $taskOriginal=$taskProcesses | Where-Object ProcessId -eq $taskPid | Select-Object -First 1
 $taskCurrent=Get-CimInstance Win32_Process -Filter "ProcessId=$taskPid" -ErrorAction SilentlyContinue
 if($taskOriginal.Name -eq 'QQ.exe' -or $taskOriginal.CommandLine -match 'dr-janitor'){continue}
 if($taskCurrent -and $taskCurrent.CreationDate -eq $taskOriginal.CreationDate -and $taskCurrent.ExecutablePath -eq $taskOriginal.ExecutablePath){Stop-Process -Id $taskPid -ErrorAction Stop}
}
exit 0
