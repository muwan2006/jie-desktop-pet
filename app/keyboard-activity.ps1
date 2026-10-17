$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class JieKeyboardActivity {
 [DllImport("user32.dll")]
 private static extern short GetAsyncKeyState(int key);
 public static void Run() {
  bool[] previous = new bool[256];
  DateTime lastPulse = DateTime.MinValue;
  Console.WriteLine("READY");
  Console.Out.Flush();
  while(true) {
   bool newPress=false, held=false;
   for(int key=8; key<255; key++) {
    // Modifier-only presses do not animate the hands. Output is only activity.
    if(key==16||key==17||key==18||key==91||key==92||(key>=160&&key<=165))continue;
    bool down=GetAsyncKeyState(key)<0;
    if(down&&!previous[key])newPress=true;
    if(down)held=true;
    previous[key]=down;
   }
   DateTime now=DateTime.UtcNow;
   if(newPress||(held&&(now-lastPulse).TotalMilliseconds>=160)) {
    Console.WriteLine("PRESS");Console.Out.Flush();lastPulse=now;
   }
   Thread.Sleep(40);
  }
 }
}
'@
[JieKeyboardActivity]::Run()
