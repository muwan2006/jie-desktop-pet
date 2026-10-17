param([ValidateSet('watch','selection')][string]$Operation='watch',[uint32]$ParentProcessId=0)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class JieDesktopContext {
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [StructLayout(LayoutKind.Sequential)] public struct MonitorInfo { public int Size; public Rect Monitor,Work; public uint Flags; }
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint process);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect rect);
 [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h,uint flags);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern bool GetMonitorInfo(IntPtr h,ref MonitorInfo info);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder name,int length);
}
'@
[void][JieDesktopContext]::SetProcessDPIAware()
if($Operation -eq 'selection') {
 Add-Type -AssemblyName UIAutomationClient
 Add-Type -AssemblyName UIAutomationTypes
 $element=[Windows.Automation.AutomationElement]::FocusedElement
 if($element.Current.IsPassword){[Console]::Out.Write('{"text":""}');exit 0}
 $pattern=$null
 $found=$element.TryGetCurrentPattern([Windows.Automation.TextPattern]::Pattern,[ref]$pattern)
 if(-not $found){$root=[Windows.Automation.AutomationElement]::FromHandle([JieDesktopContext]::GetForegroundWindow());$condition=[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::IsTextPatternAvailableProperty,$true);$candidates=$root.FindAll([Windows.Automation.TreeScope]::Descendants,$condition);foreach($candidate in $candidates){if($candidate.Current.IsPassword){continue};$p=$candidate.GetCurrentPattern([Windows.Automation.TextPattern]::Pattern);$ranges=$p.GetSelection();$selected=@($ranges|ForEach-Object {$_.GetText(12000)}) -join "`n";if($selected.Trim()){$pattern=$p;break}}}
 $value=''
 if($pattern){$value=@($pattern.GetSelection()|ForEach-Object {$_.GetText(12000)}) -join "`n"}
 [Console]::Out.Write((ConvertTo-Json -InputObject @{text=$value} -Compress));exit 0
}
[Console]::Out.WriteLine('{"process":"","fullscreen":false}')
[Console]::Out.Flush()
while($true) {
 if($ParentProcessId -and -not (Get-Process -Id $ParentProcessId -ErrorAction SilentlyContinue)){break}
 try {
  $window=[JieDesktopContext]::GetForegroundWindow();$processId=[uint32]0;[void][JieDesktopContext]::GetWindowThreadProcessId($window,[ref]$processId)
  $name=(Get-Process -Id $processId -ErrorAction Stop).ProcessName
  if($name -ne 'Jie') {
   $class=[Text.StringBuilder]::new(256);[void][JieDesktopContext]::GetClassName($window,$class,256)
   $rect=[JieDesktopContext+Rect]::new();[void][JieDesktopContext]::GetWindowRect($window,[ref]$rect)
   $monitor=[JieDesktopContext+MonitorInfo]::new();$monitor.Size=[Runtime.InteropServices.Marshal]::SizeOf($monitor)
   [void][JieDesktopContext]::GetMonitorInfo([JieDesktopContext]::MonitorFromWindow($window,2),[ref]$monitor)
   $full=$class.ToString() -notin @('Progman','WorkerW','Shell_TrayWnd') -and $rect.Left -le $monitor.Monitor.Left -and $rect.Top -le $monitor.Monitor.Top -and $rect.Right -ge $monitor.Monitor.Right -and $rect.Bottom -ge $monitor.Monitor.Bottom
   [Console]::Out.WriteLine((ConvertTo-Json -InputObject @{process=$name;fullscreen=[bool]$full} -Compress));[Console]::Out.Flush()
  }
 } catch {}
 Start-Sleep -Milliseconds 2000
}
