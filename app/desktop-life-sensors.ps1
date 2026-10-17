param([uint32]$ParentProcessId=0,[switch]$Once,[int]$Samples=0,[switch]$AudioOnly,[switch]$Music)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class JieLifeSensor {
 public class Window { public string id,label; public int x,y,width,height; }
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 public delegate bool EnumProc(IntPtr handle,IntPtr param);
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback,IntPtr param);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect rect);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h,int attr,out int value,int bytes);
 [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h,int attr,out Rect value,int bytes);
 public static Window[] Windows(uint own) {
  var result=new List<Window>();
  EnumWindows(delegate(IntPtr h,IntPtr _) {
   uint pid; GetWindowThreadProcessId(h,out pid); if(pid==own||!IsWindowVisible(h)||IsIconic(h))return true;
   var title=new StringBuilder(256);GetWindowText(h,title,256);if(title.Length==0)return true;
   var cls=new StringBuilder(100);GetClassName(h,cls,100);if(cls.ToString()=="Progman"||cls.ToString()=="WorkerW"||cls.ToString().Contains("TrayWnd"))return true;
   int cloaked;if(DwmGetWindowAttribute(h,14,out cloaked,4)==0&&cloaked!=0)return true;
   Rect r;if(DwmGetWindowAttribute(h,9,out r,16)!=0&&!GetWindowRect(h,out r))return true;
   if(r.Right-r.Left<140||r.Bottom-r.Top<80)return true;
   result.Add(new Window{id=h.ToInt64().ToString(),label=title.ToString(),x=r.Left,y=r.Top,width=r.Right-r.Left,height=r.Bottom-r.Top});return result.Count<24;
  },IntPtr.Zero);return result.ToArray();
 }
 [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class DeviceEnumerator {}
 [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDeviceEnumerator {
  [PreserveSig] int EnumAudioEndpoints(int flow,uint state,out IntPtr devices);
  [PreserveSig] int GetDefaultAudioEndpoint(int flow,int role,out IMMDevice device);
  [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)]string id,out IMMDevice device);
  [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr client);
  [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr client);
 }
 [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDevice {
  [PreserveSig] int Activate(ref Guid iid,uint context,IntPtr param,[MarshalAs(UnmanagedType.IUnknown)]out object result);
  [PreserveSig] int OpenPropertyStore(uint access,out IntPtr store);
  [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)]out string id);
  [PreserveSig] int GetState(out uint state);
 }
 [ComImport,Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IAudioMeterInformation {
  [PreserveSig] int GetPeakValue(out float peak);
  [PreserveSig] int GetMeteringChannelCount(out uint channels);
  [PreserveSig] int GetChannelsPeakValues(uint count,IntPtr peaks);
  [PreserveSig] int QueryHardwareSupport(out uint mask);
 }
 static IMMDeviceEnumerator enumerator;static IMMDevice device;static object meter;static long nextBind;
 public static void Close() {if(meter!=null){Marshal.ReleaseComObject(meter);meter=null;}if(device!=null){Marshal.ReleaseComObject(device);device=null;}if(enumerator!=null){Marshal.ReleaseComObject(enumerator);enumerator=null;}}
 public static float Peak() {
  long now=DateTime.UtcNow.Ticks/TimeSpan.TicksPerMillisecond;
  try {
   if(now>=nextBind){Close();nextBind=now+2000;enumerator=(IMMDeviceEnumerator)new DeviceEnumerator();Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0,1,out device));var iid=typeof(IAudioMeterInformation).GUID;Marshal.ThrowExceptionForHR(device.Activate(ref iid,23,IntPtr.Zero,out meter));}
   if(meter==null)return -1;float peak;Marshal.ThrowExceptionForHR(((IAudioMeterInformation)meter).GetPeakValue(out peak));return float.IsNaN(peak)?-1:Math.Max(0,Math.Min(1,peak));
  }catch{Close();nextBind=now+500;return -1;}
 }
}
'@
Add-Type -Path (Join-Path $PSScriptRoot 'music-loopback.cs')
[void][JieLifeSensor]::SetProcessDPIAware()
$timer=[Diagnostics.Stopwatch]::StartNew();$nextWindows=0L;$nextParent=0L;$count=0
try {do {
 $elapsed=$timer.ElapsedMilliseconds
 if($elapsed -ge $nextParent){$nextParent=$elapsed+1000;if($ParentProcessId -gt 0 -and !(Get-Process -Id $ParentProcessId -ErrorAction SilentlyContinue)){break}}
 $features=@();if($Music -or $AudioOnly){$features=@([JieMusicLoopback]::Read())};$at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();$peak=0
 foreach($feature in $features){$peak=[Math]::Max($peak,$feature.peak)}
 $packet=@{available=$true;audioAvailable=[JieMusicLoopback]::Available;peak=$peak;sampleAt=$at;audioSource='wasapi-loopback';features=$features}
 if(!$AudioOnly -and $elapsed -ge $nextWindows){$packet.windows=@([JieLifeSensor]::Windows($ParentProcessId));$nextWindows=$elapsed+250}
 [Console]::Out.WriteLine(($packet|ConvertTo-Json -Depth 5 -Compress));[Console]::Out.Flush();$count++
 if(!$Once){Start-Sleep -Milliseconds 10}
}while(!$Once -and ($Samples -le 0 -or $count -lt $Samples))}finally{[JieLifeSensor]::Close();[JieMusicLoopback]::Close()}
