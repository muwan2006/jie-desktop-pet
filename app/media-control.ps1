param([ValidateSet('status','volume','adjust','mute','unmute','pause','play','next','previous','stop')][string]$Action='status',[ValidateRange(-100,100)][int]$Value=0)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class JieMedia {
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SendMessageTimeout(IntPtr h,uint msg,IntPtr w,IntPtr l,uint flags,uint timeout,out IntPtr result);
 public static void Media(int code) {IntPtr r;SendMessageTimeout(new IntPtr(0xffff),0x319,IntPtr.Zero,new IntPtr(code<<16),2,1000,out r);}
 [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class Enumerator {}
 [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDeviceEnumerator {
 int EnumAudioEndpoints(int flow,int mask,out IntPtr devices);
 [PreserveSig] int GetDefaultAudioEndpoint(int flow,int role,out IMMDevice device);
 int GetDevice(string id,out IMMDevice d);int RegisterEndpointNotificationCallback(IntPtr p);int UnregisterEndpointNotificationCallback(IntPtr p);
 }
 [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDevice {
 [PreserveSig] int Activate(ref Guid iid,int cls,IntPtr activation,[MarshalAs(UnmanagedType.IUnknown)]out object obj);int OpenPropertyStore(int a,out IntPtr s);int GetId(out IntPtr id);int GetState(out int state);
 }
 [ComImport,Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IAudioEndpointVolume {
 int RegisterControlChangeNotify(IntPtr p);int UnregisterControlChangeNotify(IntPtr p);int GetChannelCount(out uint n);int SetMasterVolumeLevel(float n,ref Guid g);
 [PreserveSig] int SetMasterVolumeLevelScalar(float n,ref Guid g);int GetMasterVolumeLevel(out float n);
 [PreserveSig] int GetMasterVolumeLevelScalar(out float n);int SetChannelVolumeLevel(uint c,float n,ref Guid g);int SetChannelVolumeLevelScalar(uint c,float n,ref Guid g);int GetChannelVolumeLevel(uint c,out float n);int GetChannelVolumeLevelScalar(uint c,out float n);
 [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)]bool n,ref Guid g);[PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)]out bool n);
 int GetVolumeStepInfo(out uint a,out uint b);int VolumeStepUp(ref Guid g);int VolumeStepDown(ref Guid g);int QueryHardwareSupport(out uint n);int GetVolumeRange(out float a,out float b,out float c);
 }
 public static string Volume(string action,int value) {
 object e=new Enumerator();IMMDevice d=null;object obj=null;
 try {Marshal.ThrowExceptionForHR(((IMMDeviceEnumerator)e).GetDefaultAudioEndpoint(0,1,out d));Guid iid=new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");Marshal.ThrowExceptionForHR(d.Activate(ref iid,23,IntPtr.Zero,out obj));var v=(IAudioEndpointVolume)obj;float n;bool muted;Guid empty=Guid.Empty;Marshal.ThrowExceptionForHR(v.GetMasterVolumeLevelScalar(out n));
 if(action=="volume"||action=="adjust")Marshal.ThrowExceptionForHR(v.SetMasterVolumeLevelScalar(Math.Max(0,Math.Min(1,action=="volume"?value/100f:n+value/100f)),ref empty));
 if(action=="mute"||action=="unmute")Marshal.ThrowExceptionForHR(v.SetMute(action=="mute",ref empty));Marshal.ThrowExceptionForHR(v.GetMasterVolumeLevelScalar(out n));Marshal.ThrowExceptionForHR(v.GetMute(out muted));return "{\"volume\":"+Math.Round(n*100)+",\"muted\":"+(muted?"true":"false")+"}";
 } finally {if(obj!=null)Marshal.ReleaseComObject(obj);if(d!=null)Marshal.ReleaseComObject(d);Marshal.ReleaseComObject(e);}
 }
}
'@
$taskMediaCodes=@{pause=47;play=46;next=11;previous=12;stop=13}
if($taskMediaCodes.ContainsKey($Action)){[JieMedia]::Media($taskMediaCodes[$Action]);Write-Output '{"dispatched":true}'}else{Write-Output ([JieMedia]::Volume($Action,$Value))}
