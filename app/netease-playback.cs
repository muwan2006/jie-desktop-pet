using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

// NetEase 3.x may expose neither SMTC nor accessibility for its CEF controls.
// Inspect only its own rendered play button, in bounded memory. Never save a
// window image, read another app, infer state from loudness, or click a position.
public static class JieNetEasePlayback {
 public class State {public bool available,playing;public string source="netease-button";}
 [StructLayout(LayoutKind.Sequential)]struct Rect {public int left,top,right,bottom;}
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr window,out Rect rect);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 [DllImport("user32.dll")]static extern bool PrintWindow(IntPtr window,IntPtr dc,uint flags);
 [DllImport("user32.dll")]static extern bool IsIconic(IntPtr window);
 [DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr window);
 [DllImport("user32.dll")]static extern bool ShowWindow(IntPtr window,int command);
 [DllImport("user32.dll")]static extern bool SetProcessDPIAware();
 public sealed class View:IDisposable {
  readonly IntPtr window;readonly bool minimized,visible;bool disposed;
  public View(IntPtr h){Check(h);window=h;minimized=IsIconic(h);visible=IsWindowVisible(h);if(minimized||!visible){ShowWindow(h,4);System.Threading.Thread.Sleep(180);}}
  public void Dispose(){if(disposed)return;disposed=true;if(minimized)ShowWindow(window,7);else if(!visible)ShowWindow(window,0);}
 }
 static void Check(IntPtr window){uint pid;GetWindowThreadProcessId(window,out pid);if(window==IntPtr.Zero||pid==0||System.Diagnostics.Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant()!="cloudmusic")throw new InvalidOperationException("网易云窗口已关闭或变化，请重试。");}
 public static State Read(IntPtr window){Check(window);SetProcessDPIAware();Rect r;if(!GetWindowRect(window,out r))return new State();int width=r.right-r.left,height=r.bottom-r.top;if(width<200||height<120||width>6000||height>4000)return new State();using(var b=new Bitmap(width,height,PixelFormat.Format32bppArgb)){using(var g=Graphics.FromImage(b)){IntPtr dc=g.GetHdc();bool ok;try{ok=PrintWindow(window,dc,2);}finally{g.ReleaseHdc(dc);}if(!ok)return new State();}return Analyze(b);}}
 class Blob {public int x0=int.MaxValue,y0=int.MaxValue,x1,y1,count;public void Add(int x,int y){x0=Math.Min(x0,x);y0=Math.Min(y0,y);x1=Math.Max(x1,x);y1=Math.Max(y1,y);count++;}public int Width{get{return x1-x0+1;}}public int Height{get{return y1-y0+1;}}}
 static List<Blob> Blobs(bool[] mask,int width,int height){var found=new List<Blob>();var queue=new Queue<int>();for(int i=0;i<mask.Length;i++){if(!mask[i])continue;mask[i]=false;queue.Enqueue(i);var b=new Blob();while(queue.Count>0){int p=queue.Dequeue(),x=p%width,y=p/width;b.Add(x,y);for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++){int nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;int q=ny*width+nx;if(mask[q]){mask[q]=false;queue.Enqueue(q);}}}found.Add(b);}return found;}
 // Analyze is shared by the live reader and native fixture checks.
 public static State Analyze(Bitmap bitmap){int w=bitmap.Width,h=bitmap.Height;if(w<200||h<120)return new State();int x0=(int)(w*.32),x1=(int)(w*.68),y0=(int)(h*.78),cw=x1-x0,ch=h-y0;var d=bitmap.LockBits(new Rectangle(0,0,w,h),ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);byte[] pixels=new byte[Math.Abs(d.Stride)*h];try{Marshal.Copy(d.Scan0,pixels,0,pixels.Length);}finally{bitmap.UnlockBits(d);}int stride=Math.Abs(d.Stride);var red=new bool[cw*ch];for(int y=0;y<ch;y++)for(int x=0;x<cw;x++){int p=(y+y0)*stride+(x+x0)*4;int b=pixels[p],g=pixels[p+1],r=pixels[p+2];red[y*cw+x]=r>=180&&r-g>=55&&r-b>=20&&g<190;}
  State result=null;foreach(var circle in Blobs(red,cw,ch)){int diameter=Math.Max(circle.Width,circle.Height);if(diameter<18||diameter>200||circle.Width<circle.Height*.85||circle.Width>circle.Height*1.18||circle.count<circle.Width*circle.Height*.48)continue;double cx=(circle.x0+circle.x1)/2.0,cy=(circle.y0+circle.y1)/2.0,radius=diameter*.34;var white=new bool[diameter*diameter];int[] columns=new int[diameter];for(int y=0;y<diameter;y++)for(int x=0;x<diameter;x++){int px=circle.x0+x,py=circle.y0+y;if(px>=cw||py>=ch||(px-cx)*(px-cx)+(py-cy)*(py-cy)>radius*radius)continue;int p=(py+y0)*stride+(px+x0)*4;if(pixels[p]>210&&pixels[p+1]>210&&pixels[p+2]>210){white[y*diameter+x]=true;columns[x]++;}}
   var glyphs=Blobs(white,diameter,diameter).FindAll(b=>b.count>=Math.Max(4,diameter*diameter*.004));bool playing=false,known=false;
   if(glyphs.Count==2){var a=glyphs[0];var b=glyphs[1];known=a.Height>diameter*.20&&b.Height>diameter*.20&&a.Height>a.Width*1.7&&b.Height>b.Width*1.7&&Math.Abs(a.Height-b.Height)<diameter*.08&&Math.Abs(a.y0-b.y0)<diameter*.07;playing=known;}
   else if(glyphs.Count==1){var a=glyphs[0];int left=0,right=0,mid=(a.x0+a.x1)/2;for(int x=a.x0;x<=a.x1;x++)if(x<=mid)left+=columns[x];else right+=columns[x];known=a.Height>diameter*.20&&a.Width>diameter*.16&&a.Width<a.Height*1.2&&left>right*1.25&&right>0;}
   if(!known)continue;if(result!=null)return new State();result=new State{available=true,playing=playing};
  }return result??new State();
 }
}
