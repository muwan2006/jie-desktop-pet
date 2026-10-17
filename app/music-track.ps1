$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
try {
 Add-Type -AssemblyName System.Runtime.WindowsRuntime
 $null=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
 $null=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime]
 function Wait-WinRT($Operation,[Type]$ResultType) {
  $method=[System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object{$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'}|Select-Object -First 1
  $task=$method.MakeGenericMethod($ResultType).Invoke($null,@($Operation))
  if(-not $task.Wait(8000)){throw '播放器信息读取超时。'}
  return $task.Result
 }
 $manager=Wait-WinRT ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
 $session=$manager.GetCurrentSession()
 if($null -eq $session){Write-Output '{"available":true,"track":null}';exit 0}
 $media=Wait-WinRT ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
 $timeline=$session.GetTimelineProperties();$play=$session.GetPlaybackInfo()
 @{available=$true;track=@{title=[string]$media.Title;artist=[string]$media.Artist;source=[string]$session.SourceAppUserModelId;status=[string]$play.PlaybackStatus;position=$timeline.Position.TotalSeconds;duration=$timeline.EndTime.TotalSeconds;updated=$timeline.LastUpdatedTime.ToUnixTimeMilliseconds()}}|ConvertTo-Json -Depth 5 -Compress
}catch{@{available=$false;error=$_.Exception.Message}|ConvertTo-Json -Compress;exit 1}
