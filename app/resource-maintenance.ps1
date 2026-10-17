param([Parameter(Mandatory=$true)][string]$Job)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$config=Get-Content -LiteralPath $Job -Raw -Encoding UTF8 | ConvertFrom-Json
$root=[IO.Path]::GetFullPath($config.root)
$resources=Split-Path -Parent $root
if((Split-Path -Leaf $root) -ne 'app'){throw '安装目录无效。'}
function Child([string]$Path){$absolute=[IO.Path]::GetFullPath($Path);if(-not $absolute.StartsWith($resources.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw '操作超出 resources 目录。'};return $absolute}
function RelativeFile([string]$Name){if(-not $Name -or $Name.Contains('\') -or $Name.Contains(':') -or $Name.StartsWith('/') -or @($Name.Split('/') | Where-Object {$_ -eq '..' -or $_ -eq '.' -or -not $_}).Count){throw '清单路径无效。'}}
function HashFile([string]$File){$stream=[IO.File]::OpenRead($File);$sha=[Security.Cryptography.SHA256]::Create();try{return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$sha.Dispose()}}
function Verify([string]$Folder,$Manifest){foreach($v in $Manifest.PSObject.Properties){RelativeFile $v.Name;$file=Join-Path $Folder $v.Name;if(-not(Test-Path -LiteralPath $file -PathType Leaf) -or (HashFile $file) -ne $v.Value){throw ('文件校验失败：'+$v.Name)}}}
function CopyTree([string]$Source,[string]$Target){$Target=Child $Target;[IO.Directory]::CreateDirectory($Target)|Out-Null;$prefix=[IO.Path]::GetFullPath($Source).TrimEnd('\')+'\';foreach($item in Get-ChildItem -LiteralPath $Source -Force -Recurse){if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw '不处理链接目录。'};$out=Child (Join-Path $Target $item.FullName.Substring($prefix.Length));if($item.PSIsContainer){[IO.Directory]::CreateDirectory($out)|Out-Null}else{[IO.Directory]::CreateDirectory((Split-Path -Parent $out))|Out-Null;Copy-Item -LiteralPath $item.FullName -Destination $out -Force}}}
$backup=Child (Join-Path $resources ('app-preserved-codex-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,6)))
$stage=Child (Join-Path $resources ('app-maintenance-'+[Guid]::NewGuid().ToString('N')))
$log=Join-Path (Split-Path -Parent $Job) 'jie-maintenance-result.json'
$success=$false
try{
 $exe=Join-Path (Split-Path -Parent $resources) 'Jie.exe'
 for($i=0;$i -lt 150;$i++){if(-not(Get-Process -Id $config.pid -ErrorAction SilentlyContinue)){break};Start-Sleep -Milliseconds 200}
 if(Get-Process -Id $config.pid -ErrorAction SilentlyContinue){throw '桌宠还没有退出，未安装。'}
 if(Get-Process | Where-Object {$_.Path -eq $exe}){throw '另一个桌宠进程还在运行，请全部退出。'}
 Verify $root $config.baseline
 $source=if($config.mode -eq 'update'){Join-Path $config.folder 'app'}else{$config.folder}
 Verify $source $config.files
 CopyTree $root $backup;Verify $backup $config.baseline
 CopyTree $root $stage
 foreach($v in $config.files.PSObject.Properties){$out=Child (Join-Path $stage $v.Name);[IO.Directory]::CreateDirectory((Split-Path -Parent $out))|Out-Null;Copy-Item -LiteralPath (Join-Path $source $v.Name) -Destination $out -Force}
 Verify $stage $config.files
 if($config.mode -eq 'rollback'){
  $keep=@{};foreach($v in $config.files.PSObject.Properties){$keep[$v.Name.Replace('/','\')]=$true}
  $prefix=$stage.TrimEnd('\')+'\'
  foreach($f in Get-ChildItem -LiteralPath $stage -File -Recurse){$name=$f.FullName.Substring($prefix.Length);if(-not $keep.ContainsKey($name) -and -not($name -match '^(asr-runtime|component-preserved-asr|jie-web-profile|local-web-data)\\')){Remove-Item -LiteralPath (Child $f.FullName)}}
 }
 foreach($v in $config.files.PSObject.Properties){$out=Child (Join-Path $root $v.Name);[IO.Directory]::CreateDirectory((Split-Path -Parent $out))|Out-Null;Copy-Item -LiteralPath (Join-Path $stage $v.Name) -Destination $out -Force}
 if($config.mode -eq 'rollback'){foreach($f in Get-ChildItem -LiteralPath $root -File -Recurse){$n=$f.FullName.Substring($root.TrimEnd('\').Length+1);if(-not $keep.ContainsKey($n) -and -not($n -match '^(asr-runtime|component-preserved-asr|jie-web-profile|local-web-data)\\')){Remove-Item -LiteralPath (Child $f.FullName)}}}
 Verify $root $config.files
 $success=$true
 @{ok=$true;version=$config.version;backup=$backup}|ConvertTo-Json|Set-Content -LiteralPath $log -Encoding UTF8
}catch{
 $message=$_.Exception.Message
 if(Test-Path -LiteralPath $backup){try{CopyTree $backup $root;foreach($v in $config.files.PSObject.Properties){if(-not($config.baseline.PSObject.Properties.Name -contains $v.Name)){ $extra=Child (Join-Path $root $v.Name);if(Test-Path -LiteralPath $extra -PathType Leaf){Remove-Item -LiteralPath $extra}}};Verify $root $config.baseline}catch{$message+='；自动恢复失败：'+$_.Exception.Message}}
 @{ok=$false;error=$message;backup=$backup}|ConvertTo-Json|Set-Content -LiteralPath $log -Encoding UTF8
}finally{
 if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath (Child $stage) -Recurse -Force}
 if($success -and -not $config.noLaunch -and (Test-Path -LiteralPath $exe)){Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe) -WindowStyle Hidden}
}
