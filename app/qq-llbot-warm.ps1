param()
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$taskBinding=$env:JIE_QQ_WARM_BINDING|ConvertFrom-Json
if(-not $taskBinding.pid -or -not $taskBinding.creation -or -not $taskBinding.executable){throw 'Missing verified window binding'}
$taskProcess=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$taskBinding.pid)
if(-not $taskProcess -or $taskProcess.ExecutablePath -ne $taskBinding.executable -or $taskProcess.CreationDate.ToUniversalTime() -ne [datetime]::Parse($taskBinding.creation).ToUniversalTime()){throw 'Selected QQ process changed'}
Add-Type @'
using System;using System.Runtime.InteropServices;
public class JieQQWarm {
 public delegate bool EnumProc(IntPtr h,IntPtr l);
 [StructLayout(LayoutKind.Sequential)] public struct RECT {public int Left,Top,Right,Bottom;}
 [StructLayout(LayoutKind.Sequential)] public struct POINT {public int X,Y;}
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p,IntPtr l);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,System.Text.StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int n);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,System.Text.StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
}
'@
[JieQQWarm]::SetProcessDPIAware()|Out-Null
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$taskWindows=[Collections.Generic.List[IntPtr]]::new()
[JieQQWarm]::EnumWindows({param($taskWindow,$unused)
 [uint32]$taskWindowPid=0;[JieQQWarm]::GetWindowThreadProcessId($taskWindow,[ref]$taskWindowPid)|Out-Null
 if($taskWindowPid -eq [uint32]$taskBinding.pid){$taskClass=[Text.StringBuilder]::new(200);[JieQQWarm]::GetClassName($taskWindow,$taskClass,200)|Out-Null;if($taskClass.ToString() -eq 'Chrome_WidgetWin_1'){$taskWindows.Add($taskWindow)}}
 return $true
},[IntPtr]::Zero)|Out-Null
$taskInitiallyVisible=@($taskWindows|Where-Object {[JieQQWarm]::IsWindowVisible($_)})
$taskHandle=(Get-Process -Id $taskBinding.pid).MainWindowHandle
$taskContactCondition=New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::NameProperty),'联系人'
foreach($taskCandidate in $taskWindows){
 $taskCandidateRoot=[System.Windows.Automation.AutomationElement]::FromHandle($taskCandidate)
 if($taskCandidateRoot.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$taskContactCondition)){$taskHandle=$taskCandidate;break}
}
if(-not $taskHandle){
 $taskLargest=0
 foreach($taskCandidate in $taskWindows){$taskRect=New-Object JieQQWarm+RECT;[JieQQWarm]::GetWindowRect($taskCandidate,[ref]$taskRect)|Out-Null;$taskArea=($taskRect.Right-$taskRect.Left)*($taskRect.Bottom-$taskRect.Top);if($taskArea -gt $taskLargest){$taskLargest=$taskArea;$taskHandle=$taskCandidate}}
}
if(-not $taskHandle){throw 'QQ window is unavailable; open the dedicated QQ contacts page'}
$taskForeground=[JieQQWarm]::GetForegroundWindow();$taskVisible=[JieQQWarm]::IsWindowVisible($taskHandle);$taskMinimized=[JieQQWarm]::IsIconic($taskHandle)
$taskCursor=New-Object JieQQWarm+POINT;[JieQQWarm]::GetCursorPos([ref]$taskCursor)|Out-Null
$taskClicked=$false
try {
 # Restore a minimized Chromium window before asking for its accessible controls.
 # SW_SHOWNOACTIVATE alone can leave a minimized QQ with a stale 1px client area.
 if($taskMinimized -or -not $taskVisible){[JieQQWarm]::ShowWindow($taskHandle,9)|Out-Null}
 Add-Type -AssemblyName UIAutomationClient
 Add-Type -AssemblyName UIAutomationTypes
 function TaskFind([string]$Name){
  $taskRootElement=[System.Windows.Automation.AutomationElement]::FromHandle($taskHandle)
  $taskCondition=New-Object System.Windows.Automation.PropertyCondition ([System.Windows.Automation.AutomationElement]::NameProperty),$Name
  return $taskRootElement.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$taskCondition)
 }
 $taskContacts=$null
 for($taskAttempt=0;$taskAttempt -lt 6;$taskAttempt++){
  $taskContacts=TaskFind '联系人';if($taskContacts){break}
  if($taskAttempt -eq 2){[JieQQWarm]::SetForegroundWindow($taskHandle)|Out-Null}
  Start-Sleep -Milliseconds 250
 }
 if(-not $taskContacts){throw 'QQ联系人控件尚未出现；未执行坐标点击'}
 $taskToggle=$taskContacts.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
 if($taskToggle.Current.ToggleState -ne [System.Windows.Automation.ToggleState]::On){$taskToggle.Toggle()}
 $taskClicked=$true
 $taskManagerName='好友管理器';$taskManager=$null
 for($taskAttempt=0;$taskAttempt -lt 10;$taskAttempt++){
  Start-Sleep -Milliseconds 150;$taskManager=TaskFind $taskManagerName;if($taskManager){break}
 }
 if(-not $taskManager){throw 'QQ好友管理器控件尚未出现；联系人初始化未确认'}
 $taskManager.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
 Start-Sleep -Milliseconds 1400
 [JieQQWarm]::EnumWindows({param($taskWindow,$unused)
  [uint32]$taskWindowPid=0;[JieQQWarm]::GetWindowThreadProcessId($taskWindow,[ref]$taskWindowPid)|Out-Null
  if($taskWindowPid -eq [uint32]$taskBinding.pid -and $taskWindow -notin $taskInitiallyVisible){$taskTitle=[Text.StringBuilder]::new(500);[JieQQWarm]::GetWindowText($taskWindow,$taskTitle,500)|Out-Null;if($taskTitle.ToString().Contains($taskManagerName)){[JieQQWarm]::PostMessage($taskWindow,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)|Out-Null}}
  return $true
 },[IntPtr]::Zero)|Out-Null
 Start-Sleep -Milliseconds 150
} finally {
 $taskAfter=New-Object JieQQWarm+POINT;[JieQQWarm]::GetCursorPos([ref]$taskAfter)|Out-Null
 if($taskMinimized){[JieQQWarm]::ShowWindow($taskHandle,7)|Out-Null}elseif(-not $taskVisible){[JieQQWarm]::ShowWindow($taskHandle,0)|Out-Null}
 [uint32]$taskForegroundPid=0;[JieQQWarm]::GetWindowThreadProcessId([JieQQWarm]::GetForegroundWindow(),[ref]$taskForegroundPid)|Out-Null
 if($taskForegroundPid -eq [uint32]$taskBinding.pid -and $taskForeground -and [JieQQWarm]::GetForegroundWindow() -ne $taskForeground){[JieQQWarm]::SetForegroundWindow($taskForeground)|Out-Null}
}
[pscustomobject]@{ok=$true;action='refreshed-contact-manager';messagesSent=$false;background=$true;foregroundUnchanged=([JieQQWarm]::GetForegroundWindow() -eq $taskForeground);cursorUnchanged=($taskAfter.X -eq $taskCursor.X -and $taskAfter.Y -eq $taskCursor.Y)}|ConvertTo-Json -Compress
