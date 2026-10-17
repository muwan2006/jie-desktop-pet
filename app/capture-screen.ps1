$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
try {
 Add-Type -AssemblyName System.Drawing
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CaptureDpi {
 [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
}
'@
 [CaptureDpi]::SetProcessDpiAwarenessContext([IntPtr](-4))|Out-Null
 [CaptureDpi]::SetThreadDpiAwarenessContext([IntPtr](-4))|Out-Null
 $captureRects=@([Console]::In.ReadToEnd()|ConvertFrom-Json)
 if($captureRects.Count -lt 1 -or $captureRects.Count -gt 16){throw 'Invalid displays'}
 $captureResults=@()
 foreach($captureRect in $captureRects){
  foreach($captureField in @('x','y','width','height')){if($captureRect.$captureField -isnot [int]){throw 'Invalid dimensions'}}
  if($captureRect.width -le 0 -or $captureRect.height -le 0 -or [long]$captureRect.width*$captureRect.height -gt 50000000){throw 'Oversized display'}
  $captureBitmap=New-Object System.Drawing.Bitmap($captureRect.width,$captureRect.height,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $captureGraphics=$null;$captureStream=$null
  try{
   $captureGraphics=[System.Drawing.Graphics]::FromImage($captureBitmap)
   $captureSize=New-Object System.Drawing.Size($captureRect.width,$captureRect.height)
   $captureGraphics.CopyFromScreen($captureRect.x,$captureRect.y,0,0,$captureSize,[System.Drawing.CopyPixelOperation]::SourceCopy)
   $captureStream=New-Object System.IO.MemoryStream
   $captureBitmap.Save($captureStream,[System.Drawing.Imaging.ImageFormat]::Png)
   $captureResults+=@{id=[string]$captureRect.id;png=[Convert]::ToBase64String($captureStream.ToArray())}
  }finally{if($captureStream){$captureStream.Dispose()};if($captureGraphics){$captureGraphics.Dispose()};$captureBitmap.Dispose()}
 }
 [Console]::Out.Write((ConvertTo-Json -InputObject $captureResults -Compress -Depth 3))
}catch{[Console]::Error.WriteLine('Screen capture failed.');exit 1}
