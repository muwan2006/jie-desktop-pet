param([Parameter(Mandatory=$true)][string]$Job)
$ErrorActionPreference='Stop'
$taskJob=[IO.Path]::GetFullPath($Job)
$taskConfig=Get-Content -LiteralPath $taskJob -Encoding UTF8 -Raw|ConvertFrom-Json
if([IO.Path]::GetFullPath($taskConfig.root) -ne $PSScriptRoot){throw 'Wrong installation root'}
$taskArguments=@('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"'+(Join-Path $PSScriptRoot 'community-maintenance.ps1')+'"'),'-Job',('"'+$taskJob+'"'))
$taskProcess=Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $taskArguments -WindowStyle Hidden -PassThru
$taskDeadline=[DateTime]::UtcNow.AddSeconds(12)
while([DateTime]::UtcNow -lt $taskDeadline){
 if(Test-Path -LiteralPath $taskConfig.readyPath){exit 0}
 $taskProcess.Refresh();if($taskProcess.HasExited){throw ('Installer exited before taking over: '+$taskProcess.ExitCode)}
 Start-Sleep -Milliseconds 100
}
throw 'Installer did not confirm readiness; parent app was kept running'
