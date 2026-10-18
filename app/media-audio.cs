using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class JieMediaAudio {
 [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class Enumerator {}
 // Preserve the native HRESULT ABI for every COM slot.
 [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Devices {
  [PreserveSig] int EnumAudioEndpoints(int flow,int state,out Collection c);
  [PreserveSig] int GetDefaultAudioEndpoint(int flow,int role,out Device d);
 }
 [ComImport,Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Collection {
  [PreserveSig] int GetCount(out uint count);[PreserveSig] int Item(uint index,out Device d);
 }
 [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Device {
  [PreserveSig] int Activate(ref Guid iid,int context,IntPtr p,[MarshalAs(UnmanagedType.IUnknown)]out object value);
 }
 [ComImport,Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Endpoint {
  [PreserveSig] int RegisterControlChangeNotify(IntPtr p);[PreserveSig] int UnregisterControlChangeNotify(IntPtr p);
  [PreserveSig] int GetChannelCount(out uint n);[PreserveSig] int SetMasterVolumeLevel(float n,ref Guid g);
  [PreserveSig] int SetMasterVolumeLevelScalar(float n,ref Guid g);[PreserveSig] int GetMasterVolumeLevel(out float n);
  [PreserveSig] int GetMasterVolumeLevelScalar(out float n);[PreserveSig] int SetChannelVolumeLevel(uint c,float n,ref Guid g);
  [PreserveSig] int SetChannelVolumeLevelScalar(uint c,float n,ref Guid g);[PreserveSig] int GetChannelVolumeLevel(uint c,out float n);
  [PreserveSig] int GetChannelVolumeLevelScalar(uint c,out float n);[PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)]bool n,ref Guid g);
  [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)]out bool n);
 }
 [ComImport,Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Manager {
  [PreserveSig] int GetAudioSessionControl(ref Guid id,uint flags,out IntPtr c);
  [PreserveSig] int GetSimpleAudioVolume(ref Guid id,uint flags,out IntPtr v);
  [PreserveSig] int GetSessionEnumerator(out Sessions s);
 }
 [ComImport,Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Sessions {
  [PreserveSig] int GetCount(out int count);[PreserveSig] int GetSession(int index,out Control c);
 }
 [ComImport,Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Control {
  [PreserveSig] int GetState(out int state);[PreserveSig] int GetDisplayName(out IntPtr name);
  [PreserveSig] int SetDisplayName(string name,ref Guid g);[PreserveSig] int GetIconPath(out IntPtr name);
  [PreserveSig] int SetIconPath(string name,ref Guid g);[PreserveSig] int GetGroupingParam(out Guid g);
  [PreserveSig] int SetGroupingParam(ref Guid group,ref Guid g);[PreserveSig] int RegisterAudioSessionNotification(IntPtr p);
  [PreserveSig] int UnregisterAudioSessionNotification(IntPtr p);[PreserveSig] int GetSessionIdentifier(out IntPtr name);
  [PreserveSig] int GetSessionInstanceIdentifier(out IntPtr name);[PreserveSig] int GetProcessId(out uint pid);
 }
 [ComImport,Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Volume {
  [PreserveSig] int SetMasterVolume(float n,ref Guid g);[PreserveSig] int GetMasterVolume(out float n);
  [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)]bool n,ref Guid g);[PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)]out bool n);
 }
 public class Result {public int volume;public bool muted;public string scope;public string target;public int sessions;}
 class Sound:IDisposable {public Control control;public Volume volume;public void Dispose(){Release(control);}}
 static void Check(int hr){Marshal.ThrowExceptionForHR(hr);}
 static void Release(object o){if(o!=null&&Marshal.IsComObject(o))Marshal.ReleaseComObject(o);}
 static List<Sound> OpenMusic(){
  var result=new List<Sound>();object e=new Enumerator();Collection c=null;
  try{Check(((Devices)e).EnumAudioEndpoints(0,1,out c));uint count;Check(c.GetCount(out count));
   for(uint i=0;i<count;i++){Device d=null;object manager=null;Sessions sessions=null;
    try{Check(c.Item(i,out d));Guid id=new Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F");Check(d.Activate(ref id,23,IntPtr.Zero,out manager));Check(((Manager)manager).GetSessionEnumerator(out sessions));int size;Check(sessions.GetCount(out size));
     for(int j=0;j<size;j++){Control control=null;try{Check(sessions.GetSession(j,out control));uint pid;int state;Check(control.GetProcessId(out pid));Check(control.GetState(out state));if(pid==0||state==2||Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant()!="cloudmusic")continue;result.Add(new Sound{control=control,volume=(Volume)control});control=null;}catch(ArgumentException){}catch(COMException){}finally{Release(control);}}
    }finally{Release(sessions);Release(manager);Release(d);}
   }
  }catch{foreach(var s in result)s.Dispose();throw;}finally{Release(c);Release(e);}return result;
 }
 public static Result Adjust(string action,int value,string target){
  if(target!="system"){var sessions=OpenMusic();try{if(sessions.Count>0){float sum=0;bool muted=true;Guid g=Guid.Empty;foreach(var s in sessions){float n;bool m;Check(s.volume.GetMasterVolume(out n));if(action=="volume"||action=="adjust")Check(s.volume.SetMasterVolume(Math.Max(0,Math.Min(1,action=="volume"?value/100f:n+value/100f)),ref g));if(action=="mute"||action=="unmute")Check(s.volume.SetMute(action=="mute",ref g));Check(s.volume.GetMasterVolume(out n));Check(s.volume.GetMute(out m));sum+=n;muted &= m;}return new Result{volume=(int)Math.Round(sum/sessions.Count*100),muted=muted,scope="player",target="netease",sessions=sessions.Count};}}finally{foreach(var s in sessions)s.Dispose();}if(target=="netease")throw new InvalidOperationException("网易云尚未建立音频会话，请先播放一首歌。");}
  object e=new Enumerator();Device d=null;object obj=null;
  try{Check(((Devices)e).GetDefaultAudioEndpoint(0,1,out d));Guid id=new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");Check(d.Activate(ref id,23,IntPtr.Zero,out obj));var v=(Endpoint)obj;float n;bool muted;Guid g=Guid.Empty;Check(v.GetMasterVolumeLevelScalar(out n));if(action=="volume"||action=="adjust")Check(v.SetMasterVolumeLevelScalar(Math.Max(0,Math.Min(1,action=="volume"?value/100f:n+value/100f)),ref g));if(action=="mute"||action=="unmute")Check(v.SetMute(action=="mute",ref g));Check(v.GetMasterVolumeLevelScalar(out n));Check(v.GetMute(out muted));return new Result{volume=(int)Math.Round(n*100),muted=muted,scope="system",target="system",sessions=1};}finally{Release(obj);Release(d);Release(e);}
 }
 public sealed class Duck:IDisposable {
  class Entry{public Sound sound;public float original,applied;}
  readonly List<Entry> entries=new List<Entry>();public int Count{get{return entries.Count;}}
  public Duck(){foreach(var s in OpenMusic()){try{float n;Check(s.volume.GetMasterVolume(out n));float lower=n*.15f;Guid g=Guid.Empty;Check(s.volume.SetMasterVolume(lower,ref g));entries.Add(new Entry{sound=s,original=n,applied=lower});}catch{s.Dispose();}}}
  public void Dispose(){foreach(var e in entries){try{float n;Check(e.sound.volume.GetMasterVolume(out n));if(Math.Abs(n-e.applied)<.005f){Guid g=Guid.Empty;Check(e.sound.volume.SetMasterVolume(e.original,ref g));}}catch{}finally{e.sound.Dispose();}}entries.Clear();}
 }
 public static int ActiveMusic(){var sessions=OpenMusic();int active=0;try{foreach(var s in sessions){int state;Check(s.control.GetState(out state));if(state==1)active++;}}finally{foreach(var s in sessions)s.Dispose();}return active;}
 [DllImport("user32.dll",SetLastError=true)]static extern IntPtr SendMessageTimeout(IntPtr h,uint msg,IntPtr w,IntPtr l,uint flags,uint timeout,out IntPtr result);
 public static bool Command(IntPtr window,int code){IntPtr r;return SendMessageTimeout(window,0x319,window,new IntPtr(code<<16),2,500,out r)!=IntPtr.Zero&&r!=IntPtr.Zero;}
 [StructLayout(LayoutKind.Sequential)]struct KEYBDINPUT{public ushort vk,scan;public uint flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Explicit)]struct UNION{[FieldOffset(0)]public KEYBDINPUT key;[FieldOffset(0)]public MOUSEINPUT mouse;}
 [StructLayout(LayoutKind.Sequential)]struct MOUSEINPUT{public int x,y;public uint data,flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Sequential)]struct INPUT{public uint type;public UNION data;}
 [DllImport("user32.dll",SetLastError=true)]static extern uint SendInput(uint count,INPUT[] input,int size);
 public static void MediaKey(ushort key){var a=new[]{new INPUT{type=1,data=new UNION{key=new KEYBDINPUT{vk=key}}},new INPUT{type=1,data=new UNION{key=new KEYBDINPUT{vk=key,flags=2}}}};if(SendInput(2,a,Marshal.SizeOf(typeof(INPUT)))!=2)throw new InvalidOperationException("系统拒绝媒体按键，请检查播放器与桌宠的运行权限是否一致。");}
}
