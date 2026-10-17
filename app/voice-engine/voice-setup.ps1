param([ValidateSet('Install','Start')][string]$Action='Install')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$KitRoot = $PSScriptRoot
$RecordDirectory = Join-Path $env:LOCALAPPDATA 'JieDesktopPet'
$RecordFile = Join-Path $RecordDirectory 'voice-install.json'
$ArchiveName = 'GPT-SoVITS-v2pro-20250604.7z'
$ArchiveUrl = 'https://huggingface.co/lj1995/GPT-SoVITS-windows-package/resolve/fb387b7a65a5441e5e3985f4ab9b721a9d455363/' + $ArchiveName
$ArchiveHash = 'bd60d0796553ff05d8568136e199c13e0dc22ebe2ed24273134e34ed6f215cd6'
$ExtractorUrl = 'https://github.com/ip7z/7zip/releases/download/26.03/7zr.exe'
$ExtractorHash = 'ad4c82fadcbdf93c03b4fc440f300509c7d60c5c2f4d183e35d9d70d6957037d'
function Download-Verified([string]$Url,[string]$Target,[string]$Hash) {
 if ((Test-Path -LiteralPath $Target) -and (Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash.ToLowerInvariant() -eq $Hash) { return }
 $part = $Target + '.part'
 $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
 if ($curl) {
  & $curl.Source --location --fail --retry 4 --retry-delay 3 --connect-timeout 30 --continue-at - --output $part $Url
  if ($LASTEXITCODE -ne 0) { throw '下载未完成。保留了下载进度；重新运行安装可以继续。也可按说明手动下载整合包。' }
 } else {
  Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $part -TimeoutSec 86400
 }
 Write-Host '正在校验下载文件，可能需要几分钟……'
 if ((Get-FileHash -LiteralPath $part -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Hash) { throw ('下载校验失败。请删除不完整文件后重试：' + $part) }
 Move-Item -LiteralPath $part -Destination $Target -Force
}
function Find-Engine([string]$Folder) {
 $candidates = @()
 if (Test-Path -LiteralPath (Join-Path $Folder 'api_v2.py')) { $candidates += (Join-Path $Folder 'api_v2.py') }
 $candidates += @(Get-ChildItem -LiteralPath $Folder -Filter 'api_v2.py' -Recurse -File | Select-Object -ExpandProperty FullName)
 foreach ($file in $candidates) {
  $root = Split-Path -Parent $file
  foreach ($relative in @('runtime\python.exe','python.exe')) {
   $python = Join-Path $root $relative
   if (Test-Path -LiteralPath $python) { return @{root=$root;python=$python} }
  }
 }
 throw '解压后找不到 API 和内置 Python。请将整个整合包解压，勿单独移动文件。'
}
try {
 if ($Action -eq 'Install') {
  Add-Type -AssemblyName System.Windows.Forms
  $picker = New-Object System.Windows.Forms.FolderBrowserDialog
  $picker.Description = '选择语音引擎存放位置，建议 D 盘；首次下载约 8.2 GB，建议至少剩余 40 GB'
  $picker.ShowNewFolderButton = $true
  if (Test-Path 'D:\') { $picker.SelectedPath = 'D:\' }
  if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 0 }
  $destination = Join-Path $picker.SelectedPath 'JieVoice'
  $cache = Join-Path $destination 'downloads'
  $engineFolder = Join-Path $destination 'GPT-SoVITS-v2pro-20250604'
  New-Item -ItemType Directory -Path $cache -Force | Out-Null
  $driveRoot = [System.IO.Path]::GetPathRoot($destination)
  $drive = [System.IO.DriveInfo]::new($driveRoot)
  if ($drive.AvailableFreeSpace -lt 40GB -and -not (Test-Path -LiteralPath $engineFolder)) { throw '建议至少预留 40 GB 空间用于下载、解压和临时文件，请换一个空间更充足的位置。' }
  Write-Host '将使用官方 GPT-SoVITS v2Pro 整合包。首次下载约 8.2 GB，可中断后重新运行继续。' -ForegroundColor Cyan
  $archive = Join-Path $cache $ArchiveName
  if (-not (Test-Path -LiteralPath (Join-Path $engineFolder 'jie-install-complete.txt'))) {
   Download-Verified $ArchiveUrl $archive $ArchiveHash
   $seven = Join-Path $cache '7zr-26.03.exe'
   Download-Verified $ExtractorUrl $seven $ExtractorHash
   New-Item -ItemType Directory -Path $engineFolder -Force | Out-Null
   Write-Host '下载已校验，开始解压，请勿关闭此窗口。'
   & $seven x $archive ('-o' + $engineFolder) '-y'
   if ($LASTEXITCODE -ne 0) { throw '解压失败。请确认空间充足后重新运行。' }
  }
  $engine = Find-Engine $engineFolder
  # Store paths in JSON, never construct executable command strings from paths.
  New-Item -ItemType Directory -Path $RecordDirectory -Force | Out-Null
  @{root=$engine.root;python=$engine.python;port=9880;archive_sha256=$ArchiveHash} | ConvertTo-Json | Set-Content -LiteralPath $RecordFile -Encoding UTF8
  & $engine.python (Join-Path $KitRoot 'bootstrap.py') --root $engine.root --port 9880 --check
  if ($LASTEXITCODE -ne 0) { throw '模型环境检查失败。请截图此窗口，勿继续启动。' }
  Set-Content -LiteralPath (Join-Path $engineFolder 'jie-install-complete.txt') -Value $ArchiveHash -Encoding ASCII
  Write-Host '安装完成。后续直接运行 START-JIE-VOICE.bat 即可。' -ForegroundColor Green
  Write-Host '服务窗口保持开启；按 Ctrl+C 停止服务。准备启动……'
 }
 if (-not (Test-Path -LiteralPath $RecordFile)) { throw '请先运行 SETUP-JIE-VOICE.bat 完成安装。' }
 $record = Get-Content -LiteralPath $RecordFile -Raw -Encoding UTF8 | ConvertFrom-Json
 if (-not (Test-Path -LiteralPath $record.python)) { throw '原安装位置已改变。请重新运行安装脚本选择原来的位置。' }
 $listener = [System.Net.Sockets.TcpClient]::new()
 try { $listener.Connect('127.0.0.1',[int]$record.port); throw '9880 端口已经在使用。若语音服务已启动，直接回桌宠检查连接；否则先关闭占用此端口的程序。' }
 catch [System.Net.Sockets.SocketException] { }
 finally { $listener.Dispose() }
 & $record.python (Join-Path $KitRoot 'bootstrap.py') --root $record.root --port $record.port
 if ($LASTEXITCODE -ne 0) { throw '语音服务启动失败，请截图上方错误信息。' }
} catch {
 Write-Host $_.Exception.Message -ForegroundColor Red
 Read-Host '按 Enter 关闭；需要帮助时请截图此窗口'
 exit 1
}
