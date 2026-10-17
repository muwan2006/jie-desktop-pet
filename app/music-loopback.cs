// Windows output-only loopback. PCM remains in bounded memory; only spectral
// features and hardware timestamps cross stdout. Never opens an input endpoint.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
public class JieMusicFeature { public double at,low,mid,high,energy,peak; }
public class JieMusicSpectrum {
 const int N=512; readonly double[] ring=new double[N],re=new double[N],im=new double[N],previous=new double[N/2],hann=new double[N];
 readonly double rate; readonly int hop; int pos,count,pending; double peak;
 public JieMusicSpectrum(double sampleRate){rate=sampleRate;hop=Math.Max(1,(int)Math.Round(rate*.01));for(int i=0;i<N;i++)hann[i]=.5-.5*Math.Cos(2*Math.PI*i/(N-1));}
 public void Push(double value,double at,List<JieMusicFeature> output){
  if(double.IsNaN(value)||double.IsInfinity(value))value=0;value=Math.Max(-1,Math.Min(1,value));ring[pos]=value;pos=(pos+1)%N;count=Math.Min(N,count+1);pending++;peak=Math.Max(peak,Math.Abs(value));
  if(count<N||pending<hop)return;pending=0;double energy=0;
  for(int i=0;i<N;i++){double v=ring[(pos+i)%N];energy+=v*v;re[i]=v*hann[i];im[i]=0;}
  FFT(re,im);double low=0,mid=0,high=0;
  for(int i=1;i<N/2;i++){double mag=Math.Sqrt(re[i]*re[i]+im[i]*im[i])/N;double delta=Math.Max(0,mag-previous[i]);previous[i]=mag;double hz=i*rate/N;if(hz>=30&&hz<200)low+=delta;else if(hz<2000)mid+=delta;else if(hz<5500)high+=delta;}
  output.Add(new JieMusicFeature{at=at-(N-1)/2.0/rate*1000,low=low,mid=mid,high=high,energy=Math.Sqrt(energy/N),peak=peak});peak=0;
 }
 static void FFT(double[] r,double[] im){int n=r.Length;for(int i=1,j=0;i<n;i++){int bit=n>>1;for(; (j&bit)!=0;bit>>=1)j^=bit;j^=bit;if(i<j){double t=r[i];r[i]=r[j];r[j]=t;}}
  for(int len=2;len<=n;len<<=1){double a=-2*Math.PI/len,wr0=Math.Cos(a),wi0=Math.Sin(a);for(int start=0;start<n;start+=len){double wr=1,wi=0;for(int j=0;j<len/2;j++){int u=start+j,v=u+len/2;double tr=wr*r[v]-wi*im[v],ti=wr*im[v]+wi*r[v];r[v]=r[u]-tr;im[v]=im[u]-ti;r[u]+=tr;im[u]+=ti;double next=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=next;}}}
 }
 // Same DSP for repeatable mixed-music fixtures; no separate fake feature path.
 public static JieMusicFeature[] Analyze(float[] mono,int rate,double start){var d=new JieMusicSpectrum(rate);var features=new List<JieMusicFeature>();for(int i=0;i<mono.Length;i++)d.Push(mono[i],start+i*1000.0/rate,features);return features.ToArray();}
}
public static class JieMusicLoopback {
 [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class DeviceEnumerator {}
 [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Enumerator {
  [PreserveSig]int EnumAudioEndpoints(int flow,uint state,out IntPtr devices);
  [PreserveSig]int GetDefaultAudioEndpoint(int flow,int role,out Device device);
  [PreserveSig]int GetDevice([MarshalAs(UnmanagedType.LPWStr)]string id,out Device device);
  [PreserveSig]int RegisterEndpointNotificationCallback(IntPtr client);
  [PreserveSig]int UnregisterEndpointNotificationCallback(IntPtr client);
 }
 [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Device {
  [PreserveSig]int Activate(ref Guid iid,uint context,IntPtr param,[MarshalAs(UnmanagedType.IUnknown)]out object result);
  [PreserveSig]int OpenPropertyStore(uint access,out IntPtr store);
  [PreserveSig]int GetId([MarshalAs(UnmanagedType.LPWStr)]out string id);
  [PreserveSig]int GetState(out uint state);
 }
 [ComImport,Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Client {
  [PreserveSig]int Initialize(int mode,uint flags,long duration,long periodicity,IntPtr format,IntPtr session);
  [PreserveSig]int GetBufferSize(out uint frames);
  [PreserveSig]int GetStreamLatency(out long latency);
  [PreserveSig]int GetCurrentPadding(out uint padding);
  [PreserveSig]int IsFormatSupported(int mode,IntPtr format,out IntPtr closest);
  [PreserveSig]int GetMixFormat(out IntPtr format);
  [PreserveSig]int GetDevicePeriod(out long normal,out long minimum);
  [PreserveSig]int Start();[PreserveSig]int Stop();[PreserveSig]int Reset();
  [PreserveSig]int SetEventHandle(IntPtr handle);
  [PreserveSig]int GetService(ref Guid iid,[MarshalAs(UnmanagedType.IUnknown)]out object result);
 }
 [ComImport,Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Capture {
  [PreserveSig]int GetBuffer(out IntPtr data,out uint frames,out uint flags,out ulong position,out ulong qpc);
  [PreserveSig]int ReleaseBuffer(uint frames);[PreserveSig]int GetNextPacketSize(out uint frames);
 }
 static Enumerator enumerator;static Device device;static Client client;static Capture capture;static string deviceId;
 static int rate,channels,bits,align,decimation,decimateCount;static bool floating;static double decimateSum,nextBind;
 static JieMusicSpectrum spectrum;static byte[] bytes=new byte[0];
 public static double SignalStartAt=0;public static string Error=""; public static bool Available {get{return capture!=null;}}
 static double Now {get{return (DateTime.UtcNow-new DateTime(1970,1,1)).TotalMilliseconds;}}
 public static void Close(){if(client!=null)try{client.Stop();}catch{}if(capture!=null){Marshal.ReleaseComObject(capture);capture=null;}if(client!=null){Marshal.ReleaseComObject(client);client=null;}if(device!=null){Marshal.ReleaseComObject(device);device=null;}if(enumerator!=null){Marshal.ReleaseComObject(enumerator);enumerator=null;}Array.Clear(bytes,0,bytes.Length);spectrum=null;decimateCount=0;decimateSum=0;}
 static void Bind(){
  if(enumerator==null)enumerator=(Enumerator)new DeviceEnumerator();Device candidate=null;Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0,1,out candidate));string id;candidate.GetId(out id);
  if(capture!=null&&id==deviceId){Marshal.ReleaseComObject(candidate);return;}
  Close();enumerator=(Enumerator)new DeviceEnumerator();device=candidate;deviceId=id;object obj;var guid=typeof(Client).GUID;Marshal.ThrowExceptionForHR(device.Activate(ref guid,23,IntPtr.Zero,out obj));client=(Client)obj;IntPtr format;Marshal.ThrowExceptionForHR(client.GetMixFormat(out format));
  try{int tag=(ushort)Marshal.ReadInt16(format,0);channels=(ushort)Marshal.ReadInt16(format,2);rate=Marshal.ReadInt32(format,4);align=(ushort)Marshal.ReadInt16(format,12);bits=(ushort)Marshal.ReadInt16(format,14);
   if(tag==65534){tag=Marshal.ReadInt32(format,24);}floating=tag==3;
   if((!floating&&tag!=1)||channels<1||channels>16||rate<8000||rate>192000||(floating&&bits!=32)||(!floating&&bits!=16&&bits!=24&&bits!=32))throw new Exception("Unsupported output mix format");
   Marshal.ThrowExceptionForHR(client.Initialize(0,0x00020000,1000000,0,format,IntPtr.Zero));
  }finally{Marshal.FreeCoTaskMem(format);}
  guid=typeof(Capture).GUID;Marshal.ThrowExceptionForHR(client.GetService(ref guid,out obj));capture=(Capture)obj;decimation=Math.Max(1,rate/12000);spectrum=new JieMusicSpectrum(rate/(double)decimation);SignalStartAt=0;Marshal.ThrowExceptionForHR(client.Start());Error="";
 }
 public static JieMusicFeature[] Read(){var output=new List<JieMusicFeature>();double now=Now;
  try{if(now>=nextBind){nextBind=now+2000;Bind();}if(capture==null)return output.ToArray();uint ready;Marshal.ThrowExceptionForHR(capture.GetNextPacketSize(out ready));int packets=0;
   while(ready>0&&packets++<64){IntPtr data;uint frames,flags;ulong position,qpc;Marshal.ThrowExceptionForHR(capture.GetBuffer(out data,out frames,out flags,out position,out qpc));
    try{double offset=Now-Stopwatch.GetTimestamp()*1000.0/Stopwatch.Frequency;double at=(flags&4)!=0||qpc==0?Now-frames*1000.0/rate:qpc/10000.0+offset;
     if((flags&1)!=0){spectrum=new JieMusicSpectrum(rate/(double)decimation);decimateCount=0;decimateSum=0;}
     int size=checked((int)frames*align);if(size>2000000)throw new Exception("Invalid output packet size");if(bytes.Length<size)bytes=new byte[size];bool silent=(flags&2)!=0;if(!silent)Marshal.Copy(data,bytes,0,size);
     for(int i=0;i<frames;i++){double mono=0;int used=Math.Min(channels,2);if(!silent)for(int c=0;c<used;c++)mono+=Sample(bytes,i*align+c*(bits/8));mono/=used;if(SignalStartAt==0&&Math.Abs(mono)>.00001)SignalStartAt=at+i*1000.0/rate;decimateSum+=mono;decimateCount++;
      if(decimateCount>=decimation){spectrum.Push(decimateSum/decimation,at+i*1000.0/rate,output);decimateCount=0;decimateSum=0;}}
     Array.Clear(bytes,0,size);
    }finally{Marshal.ThrowExceptionForHR(capture.ReleaseBuffer(frames));}
    Marshal.ThrowExceptionForHR(capture.GetNextPacketSize(out ready));
   }
  }catch(Exception e){Error=e.Message;Close();nextBind=now+500;}
  if(output.Count>64)output.RemoveRange(0,output.Count-64);return output.ToArray();
 }
 static double Sample(byte[] data,int i){if(floating)return BitConverter.ToSingle(data,i);if(bits==16)return BitConverter.ToInt16(data,i)/32768.0;if(bits==32)return BitConverter.ToInt32(data,i)/2147483648.0;int v=data[i]|data[i+1]<<8|data[i+2]<<16;if((v&0x800000)!=0)v|=unchecked((int)0xff000000);return v/8388608.0;}
}
