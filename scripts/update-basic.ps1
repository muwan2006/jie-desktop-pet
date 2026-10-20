param([string]$Root)
$ErrorActionPreference='Stop'
try {
 if(-not $Root){
  Add-Type -AssemblyName System.Windows.Forms
  $taskPicker=New-Object System.Windows.Forms.OpenFileDialog
  $taskPicker.Title='选择要更新的基础版 Jie.exe（请先退出桌宠）'
  $taskPicker.Filter='颉桌宠|Jie.exe'
  if($taskPicker.ShowDialog() -ne [Windows.Forms.DialogResult]::OK){exit 2}
  $Root=Split-Path -Parent $taskPicker.FileName
 }
 $taskBase=[IO.Path]::GetFullPath($Root).TrimEnd('\')
 $taskApp=Join-Path $taskBase 'resources\app'
 $taskPackageFile=Join-Path $taskApp 'package.json'
 $taskPackage=Get-Content -LiteralPath $taskPackageFile -Encoding UTF8 -Raw|ConvertFrom-Json
 if($taskPackage.name -ne 'jie-desktop-pet-community' -or $taskPackage.version -notin @('1.0.0','1.0.1','1.0.2','1.0.3','1.0.4','1.0.5','1.1.0','1.1.1','1.1.2')){throw '这里只能更新公开基础版 1.0.0 至 1.1.2，不能更新完整版。'}
 $taskExe=Join-Path $taskBase 'Jie.exe'
 if(-not(Test-Path -LiteralPath $taskExe -PathType Leaf)){throw '没有找到 Jie.exe。'}
 if(Get-CimInstance Win32_Process -Filter "Name='Jie.exe'"|Where-Object {$_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $taskExe}){throw '基础版仍在运行，请从托盘选择退出桌宠后重试。'}
 $taskManifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'repair-manifest.json') -Encoding UTF8 -Raw|ConvertFrom-Json
 if($taskManifest.version -ne '1.1.2'){throw '修复包版本不正确。'}
 function TaskDigest([string]$File){$taskHasher=[Security.Cryptography.SHA256]::Create();$taskStream=[IO.File]::OpenRead($File);try{return ([BitConverter]::ToString($taskHasher.ComputeHash($taskStream))).Replace('-','').ToLowerInvariant()}finally{$taskStream.Dispose();$taskHasher.Dispose()}}
 function TaskChecked([string]$Base,[string]$Name){
  if(-not $Name -or $Name -match '(^/|\\|:|(^|/)\.\.?(/|$)|[<>"|?*])'){throw '修复包路径不正确。'}
  $taskFull=[IO.Path]::GetFullPath((Join-Path $Base $Name))
  if(-not $taskFull.StartsWith($Base+'\',[StringComparison]::OrdinalIgnoreCase)){throw '文件超出更新目录。'}
  $taskCursor=$taskFull
  while($taskCursor -and $taskCursor.Length -ge $Base.Length){
   if((Test-Path -LiteralPath $taskCursor) -and (Get-Item -LiteralPath $taskCursor -Force).Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)){throw '更新路径包含链接，请在普通目录解压基础版后重试。'}
   $taskCursor=Split-Path -Parent $taskCursor
  }
  return $taskFull
 }
 $taskPayload=Join-Path $PSScriptRoot 'payload'
 foreach($taskFile in $taskManifest.files.PSObject.Properties){
  $taskSource=TaskChecked $taskPayload $taskFile.Name
  $taskTarget=TaskChecked $taskApp $taskFile.Name
  if((TaskDigest $taskSource) -ne $taskFile.Value.sha256){throw ('修复包校验失败：'+$taskFile.Name)}
  if(Test-Path -LiteralPath $taskTarget){
   $taskHash=TaskDigest $taskTarget
   if($taskHash -ne $taskFile.Value.sha256 -and $taskHash -notin @($taskFile.Value.previous)){throw ('程序文件有其他修改，未覆盖：'+$taskFile.Name)}
  }
 }
 $taskBackup=Join-Path $taskBase ('community-update-backups\1.1.2-'+[Guid]::NewGuid().ToString())
 [IO.Directory]::CreateDirectory($taskBackup)|Out-Null
 $taskDone=New-Object System.Collections.Generic.List[object]
 try{
  foreach($taskFile in $taskManifest.files.PSObject.Properties){
   $taskTarget=TaskChecked $taskApp $taskFile.Name
   $taskSaved=TaskChecked $taskBackup $taskFile.Name
   $taskExisted=Test-Path -LiteralPath $taskTarget
   if($taskExisted){[IO.Directory]::CreateDirectory((Split-Path -Parent $taskSaved))|Out-Null;Copy-Item -LiteralPath $taskTarget -Destination $taskSaved}
   $taskDone.Add(@{target=$taskTarget;saved=$taskSaved;existed=$taskExisted})
   [IO.Directory]::CreateDirectory((Split-Path -Parent $taskTarget))|Out-Null
   Copy-Item -LiteralPath (TaskChecked $taskPayload $taskFile.Name) -Destination $taskTarget -Force
   if((TaskDigest $taskTarget) -ne $taskFile.Value.sha256){throw ('更新后校验失败：'+$taskFile.Name)}
  }
 }catch{
  $taskOriginalError=$_.Exception.Message
  $taskRollbackErrors=New-Object System.Collections.Generic.List[string]
  for($taskI=$taskDone.Count-1;$taskI -ge 0;$taskI--){
   $taskItem=$taskDone[$taskI]
   try{
    if($taskItem.existed){
     if(-not(Test-Path -LiteralPath $taskItem.target) -or (TaskDigest $taskItem.target) -ne (TaskDigest $taskItem.saved)){Copy-Item -LiteralPath $taskItem.saved -Destination $taskItem.target -Force}
    }elseif(Test-Path -LiteralPath $taskItem.target){Remove-Item -LiteralPath $taskItem.target -Force}
   }catch{$taskRollbackErrors.Add($taskItem.target)}
  }
  if($taskRollbackErrors.Count){throw ($taskOriginalError+'；部分文件无法恢复，请保留备份：'+$taskBackup)}
  throw ($taskOriginalError+'；已恢复更新前的程序文件。')
 }
 Write-Host '已更新到 1.1.2。请打开原来的 Jie.exe，在功能中心确认已安装数量，再按需勾选安装。'
 Write-Host ('原文件备份：'+$taskBackup)
 exit 0
}catch{
 Write-Host ('更新未完成：'+$_.Exception.Message) -ForegroundColor Red
 exit 1
}
