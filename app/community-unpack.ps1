param([Parameter(Mandatory=$true)][string]$Job)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskConfig=Get-Content -LiteralPath $Job -Encoding UTF8 -Raw | ConvertFrom-Json
$taskRoot=[IO.Path]::GetFullPath($taskConfig.downloadRoot)
$taskStage=[IO.Path]::GetFullPath($taskConfig.stage)
if((Split-Path -Leaf $taskRoot) -ne 'community-downloads' -or (Split-Path -Parent $taskStage) -ne $taskRoot -or (Split-Path -Leaf $taskStage) -notmatch '^stage-[a-f0-9-]{36}$' -or (Test-Path -LiteralPath $taskStage)){throw 'Invalid staging directory'}
function SafeRelative([string]$name){if(-not $name -or $name.Length -gt 320 -or $name.Contains('\') -or $name.Contains(':') -or $name.StartsWith('/') -or $name -match '[\x00-\x1f]' -or @($name.Split('/')|Where-Object {$_ -in @('','..','.')}).Count){throw 'Invalid archive path'}}
function Digest([string]$file){$taskHasher=[Security.Cryptography.SHA256]::Create();$taskInput=[IO.File]::OpenRead($file);try{return ([BitConverter]::ToString($taskHasher.ComputeHash($taskInput))).Replace('-','').ToLowerInvariant()}finally{$taskInput.Dispose();$taskHasher.Dispose()}}
$taskZip=[IO.Compression.ZipFile]::OpenRead($taskConfig.archive)
try{
 $taskSeen=@{};$taskTotal=[long]0;$taskExpected=@{};foreach($taskFile in $taskConfig.files.PSObject.Properties){SafeRelative $taskFile.Name;$taskExpected['files/'+$taskFile.Name]=$taskFile.Value}
 foreach($taskEntry in $taskZip.Entries){SafeRelative $taskEntry.FullName;if($taskSeen.ContainsKey($taskEntry.FullName)){throw 'Duplicate archive entry'};$taskSeen[$taskEntry.FullName]=$true;if($taskEntry.FullName -ne 'COMPONENT.json' -and -not $taskExpected.ContainsKey($taskEntry.FullName)){throw 'Unexpected archive entry'};if(($taskEntry.ExternalAttributes -shr 16 -band 61440) -eq 40960){throw 'Archive contains a link'};$taskTotal+=$taskEntry.Length;if($taskTotal -gt 2147483647 -or $taskZip.Entries.Count -gt 30001){throw 'Archive too large'}}
 if($taskZip.Entries.Count -ne $taskExpected.Count+1 -or -not $taskSeen.ContainsKey('COMPONENT.json')){throw 'Incomplete archive'}
 [IO.Directory]::CreateDirectory($taskStage)|Out-Null
 foreach($taskEntry in $taskZip.Entries){$taskOut=[IO.Path]::GetFullPath((Join-Path $taskStage $taskEntry.FullName));if(-not $taskOut.StartsWith($taskStage+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Archive escaped staging directory'};[IO.Directory]::CreateDirectory((Split-Path -Parent $taskOut))|Out-Null;[IO.Compression.ZipFileExtensions]::ExtractToFile($taskEntry,$taskOut,$false);if($taskExpected.ContainsKey($taskEntry.FullName) -and (Digest $taskOut) -ne $taskExpected[$taskEntry.FullName]){throw 'Extracted hash mismatch'}}
 $taskDescriptor=Get-Content -LiteralPath (Join-Path $taskStage 'COMPONENT.json') -Encoding UTF8 -Raw | ConvertFrom-Json
 if($taskDescriptor.id -ne $taskConfig.id -or $taskDescriptor.version -ne $taskConfig.version){throw 'Descriptor mismatch'}
}finally{$taskZip.Dispose()}
