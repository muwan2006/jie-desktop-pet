﻿$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$jieEntries = New-Object System.Collections.Generic.List[object]
# Register browsers before the bounded generic app list, including user installations.
$jieBrowserRoots = @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA) | Where-Object { $_ }
$jieBrowserLocations = @(
 @{name='Microsoft Edge';relative='Microsoft\Edge\Application\msedge.exe'},
 @{name='Google Chrome';relative='Google\Chrome\Application\chrome.exe'},
 @{name='Firefox';relative='Mozilla Firefox\firefox.exe'},
 @{name='Brave';relative='BraveSoftware\Brave-Browser\Application\brave.exe'}
)
foreach ($jieBrowser in $jieBrowserLocations) {
 foreach ($jieBrowserRoot in $jieBrowserRoots) {
  $jieBrowserPath = Join-Path $jieBrowserRoot $jieBrowser.relative
  if (Test-Path -LiteralPath $jieBrowserPath -PathType Leaf) { $jieEntries.Add(@{name=$jieBrowser.name;target=$jieBrowserPath}) }
 }
}
$jieShortcutReader = $null
try { $jieShortcutReader = New-Object -ComObject WScript.Shell } catch {}
function Add-JieShortcut($jieShortcut) {
 try {
  if ($jieShortcutReader) {
   # CreateShortcut opens an existing shortcut; do not Save or execute it.
   $jieResolved = $jieShortcutReader.CreateShortcut($jieShortcut.FullName).TargetPath
   $jieBrowserName = switch ([IO.Path]::GetFileName($jieResolved).ToLowerInvariant()) { 'chrome.exe' {'Google Chrome'} 'msedge.exe' {'Microsoft Edge'} 'firefox.exe' {'Firefox'} 'brave.exe' {'Brave'} }
   if ($jieBrowserName -and (Test-Path -LiteralPath $jieResolved -PathType Leaf)) { $jieEntries.Add(@{name=$jieBrowserName;target=$jieResolved});return }
  }
 } catch {}
 $jieEntries.Add(@{name=$jieShortcut.BaseName;target=$jieShortcut.FullName})
}
foreach ($jieDesktopRoot in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'))) {
 if ($jieDesktopRoot) { foreach ($jieShortcut in @(Get-ChildItem -LiteralPath $jieDesktopRoot -Filter '*.lnk' -File -ErrorAction SilentlyContinue | Select-Object -First 100)) { Add-JieShortcut $jieShortcut } }
}
try {
 $jieProgId = (Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice' -ErrorAction Stop).ProgId
 $jieBrowserCommand = (Get-Item -LiteralPath ('Registry::HKEY_CLASSES_ROOT\'+$jieProgId+'\shell\open\command') -ErrorAction Stop).GetValue('')
 if ($jieBrowserCommand -match '^\s*"([^"]+\.exe)"(?:\s|$)') { $jieBrowserPath = $Matches[1] }
 elseif ($jieBrowserCommand -match '^\s*([^"\s]+\.exe)(?:\s|$)') { $jieBrowserPath = $Matches[1] }
 if ($jieBrowserPath -and (Test-Path -LiteralPath $jieBrowserPath -PathType Leaf)) { $jieEntries.Add(@{name='Default browser';target=$jieBrowserPath;defaultBrowser=$true}) }
} catch {}
foreach ($jieRegistryRoot in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths','HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths')) {
 foreach ($jieAppKey in @(Get-ChildItem -LiteralPath $jieRegistryRoot -ErrorAction SilentlyContinue | Select-Object -First 180)) {
  try { $jieAppPath = $jieAppKey.GetValue('').Trim('"'); if ((Test-Path -LiteralPath $jieAppPath -PathType Leaf) -and [IO.Path]::GetExtension($jieAppPath) -eq '.exe') { $jieEntries.Add(@{name=[IO.Path]::GetFileNameWithoutExtension($jieAppKey.PSChildName);target=$jieAppPath}) } } catch {}
 }
}
foreach ($jieMenuRoot in @([Environment]::GetFolderPath('StartMenu'),[Environment]::GetFolderPath('CommonStartMenu'))) {
 if ($jieMenuRoot) { foreach ($jieShortcut in @(Get-ChildItem -LiteralPath $jieMenuRoot -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 180)) { Add-JieShortcut $jieShortcut } }
}
$jieExplorer = Join-Path $env:SystemRoot 'explorer.exe'
if (Test-Path -LiteralPath $jieExplorer -PathType Leaf) { $jieEntries.Add(@{name='文件资源管理器';target=$jieExplorer}) }
ConvertTo-Json -InputObject $jieEntries.ToArray() -Depth 4 -Compress
