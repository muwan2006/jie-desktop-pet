param([ValidateSet('list','check','show')][string]$Action='list')
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$windows=@(Get-CimInstance Win32_Process -Filter "Name='QQ.exe'" | ForEach-Object {
 if(-not $_.ExecutablePath -or [IO.Path]::GetFileName($_.ExecutablePath) -ne 'QQ.exe'){return}
 $native=Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
 if($native.MainWindowHandle -eq 0 -and $Action -eq 'list'){return}
 [pscustomobject]@{pid=$_.ProcessId;creation=$_.CreationDate.ToUniversalTime().ToString('o');executable=$_.ExecutablePath;title=$native.MainWindowTitle;handle=$native.MainWindowHandle.ToInt64()}
})
if($Action -eq 'list'){ConvertTo-Json -InputObject $windows -Compress;exit 0}
[int]$selectedPid=0
if(-not [int]::TryParse($env:JIE_QQ_WINDOW_PID,[ref]$selectedPid) -or $selectedPid -le 0){throw 'Invalid QQ window'}
$selected=$windows|Where-Object pid -eq $selectedPid|Select-Object -First 1
if(-not $selected){throw 'Selected QQ process no longer exists'}
if($Action -eq 'show'){
 if(-not $selected.handle){throw 'Open the QQ window first'}
 Add-Type @'
using System;using System.Runtime.InteropServices;
public class JieSelectedQQ { [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int n); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); }
'@
 [JieSelectedQQ]::ShowWindow([IntPtr]$selected.handle,9)|Out-Null
 [JieSelectedQQ]::SetForegroundWindow([IntPtr]$selected.handle)|Out-Null
}
ConvertTo-Json -InputObject $selected -Compress
