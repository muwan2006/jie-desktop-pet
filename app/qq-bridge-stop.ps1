$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath($env:JIE_BRIDGE_ROOT)
if($env:JIE_BRIDGE_EXE -notin @('NapCatWinBootMain.exe','LuckyLillia.exe')){throw 'Unsupported launcher'}
$taskLauncher=[IO.Path]::GetFullPath((Join-Path $taskRoot $env:JIE_BRIDGE_EXE))
$taskProcesses=@(Get-CimInstance Win32_Process)
$taskRoots=@($taskProcesses | Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $taskLauncher })
if(-not $taskRoots.Count){exit 1}
$taskTargets=@($taskRoots.ProcessId)
do {
 $taskChildren=@($taskProcesses | Where-Object { $_.ParentProcessId -in $taskTargets -and $_.ProcessId -notin $taskTargets })
 $taskTargets+=@($taskChildren.ProcessId)
}while($taskChildren.Count)
foreach($taskPid in @($taskTargets | Sort-Object -Descending)){
 $taskOriginal=$taskProcesses | Where-Object ProcessId -eq $taskPid | Select-Object -First 1
 $taskCurrent=Get-CimInstance Win32_Process -Filter "ProcessId=$taskPid" -ErrorAction SilentlyContinue
 if($taskCurrent -and $taskCurrent.CreationDate -eq $taskOriginal.CreationDate -and $taskCurrent.ExecutablePath -eq $taskOriginal.ExecutablePath){Stop-Process -Id $taskPid -ErrorAction Stop}
}
exit 0
