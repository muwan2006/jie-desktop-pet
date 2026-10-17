$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
try {
 Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class JieDropMouse{[DllImport("user32.dll")]public static extern short GetAsyncKeyState(int key);}'
 $lastDown=$false
 while($true){
  $isDown=([JieDropMouse]::GetAsyncKeyState(1) -band 0x8000) -ne 0
  if($isDown -ne $lastDown){$lastDown=$isDown;[Console]::WriteLine((@{down=$isDown}|ConvertTo-Json -Compress))}
  Start-Sleep -Milliseconds 50
 }
} catch {[Console]::WriteLine('{"error":"文件拖入检测未启动，可使用接文件按钮。"}');exit 1}
