param([ValidateSet('status','volume','adjust','mute','unmute','pause','play','next','previous','stop','toggle','duck')][string]$Action='status',[ValidateRange(-100,100)][int]$Value=0,[ValidateSet('auto','netease','system')][string]$Target='auto',[int]$ParentPID=0,[ValidatePattern('^(off|(?:(Control|Alt|Shift)\+)*([A-Z0-9]|F([1-9]|1[0-9]|2[0-4])))$')][string]$Shortcut='Control+Alt+P')
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
try {
 Add-Type -Path (Join-Path $PSScriptRoot 'media-audio.cs')
 if($Action -eq 'duck') {
  $taskDuck=$null
  try {
   $taskDuck=New-Object JieMediaAudio+Duck
   @{ducked=($taskDuck.Count -gt 0);sessions=$taskDuck.Count}|ConvertTo-Json -Compress
   while($true){
    $taskRead=[Console]::In.ReadLineAsync()
    while(-not $taskRead.Wait(500)){if($ParentPID -gt 0 -and -not(Get-Process -Id $ParentPID -ErrorAction SilentlyContinue)){return}}
    $taskCommand=$taskRead.Result
    if($null -eq $taskCommand){break}
    if($taskCommand -eq 'restore'){if($null -ne $taskDuck){$taskDuck.Dispose();$taskDuck=$null}}
    elseif($taskCommand -eq 'lower'){if($null -eq $taskDuck){$taskDuck=New-Object JieMediaAudio+Duck}}
    else{break}
    @{ducked=($null -ne $taskDuck -and $taskDuck.Count -gt 0)}|ConvertTo-Json -Compress
   }
  } finally {if($null -ne $taskDuck){$taskDuck.Dispose()}}
  exit 0
 }
 if($Action -in @('status','volume','adjust','mute','unmute')){[JieMediaAudio]::Adjust($Action,$Value,$Target)|ConvertTo-Json -Compress;exit 0}
 Add-Type -AssemblyName System.Runtime.WindowsRuntime
 $null=[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
 function Wait-Media($Operation,[Type]$Type){
  $taskMethod=[System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object{$_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'}|Select-Object -First 1
  $taskAwait=$taskMethod.MakeGenericMethod($Type).Invoke($null,@($Operation));if(-not $taskAwait.Wait(2500)){throw '播放器响应超时。'};return $taskAwait.Result
 }
 $taskManager=Wait-Media ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
 $taskSession=$null
 if($Target -ne 'system'){$taskSession=@($taskManager.GetSessions()|Where-Object{$_.SourceAppUserModelId -match 'cloudmusic|netease|网易'})|Select-Object -First 1}
 $taskNetEase=Get-Process cloudmusic -ErrorAction SilentlyContinue|Where-Object{$_.MainWindowHandle -ne 0}|Select-Object -First 1
 if($null -eq $taskSession -and ($Target -eq 'system' -or ($Target -eq 'auto' -and $null -eq $taskNetEase))){$taskSession=$taskManager.GetCurrentSession()}
 if($null -ne $taskSession){
  $taskOperation=switch($Action){play{$taskSession.TryPlayAsync()}pause{$taskSession.TryPauseAsync()}next{$taskSession.TrySkipNextAsync()}previous{$taskSession.TrySkipPreviousAsync()}stop{$taskSession.TryStopAsync()}toggle{$taskSession.TryTogglePlayPauseAsync()}}
  if(-not(Wait-Media $taskOperation ([bool]))){throw '播放器拒绝了这个操作，请检查播放列表。'}
  $taskStatus=[string]$taskSession.GetPlaybackInfo().PlaybackStatus
  $taskVerified=($Action -eq 'play' -and $taskStatus -eq 'Playing') -or ($Action -eq 'pause' -and $taskStatus -eq 'Paused')
  @{dispatched=$true;verified=$taskVerified;accepted=$true;method='session';player=[string]$taskSession.SourceAppUserModelId;status=$taskStatus}|ConvertTo-Json -Compress;exit 0
 }
 if($Target -eq 'system' -or $null -eq $taskNetEase){throw '没有找到可控制的播放器。请先打开播放器并开始播放。'}
 if($Action -in @('play','pause','toggle')){
  Add-Type -Path (Join-Path $PSScriptRoot 'netease-playback.cs') -ReferencedAssemblies System.Drawing
  $taskView=New-Object JieNetEasePlayback+View($taskNetEase.MainWindowHandle)
  try {
   $taskBeforeState=[JieNetEasePlayback]::Read($taskNetEase.MainWindowHandle)
   if(-not $taskBeforeState.available){throw '暂时无法确认网易云的播放按钮状态，请展开网易云窗口后重试；本次未发送切换键。'}
   $taskWantPlaying=if($Action -eq 'toggle'){-not $taskBeforeState.playing}else{$Action -eq 'play'}
   $taskAlready=$taskBeforeState.playing -eq $taskWantPlaying
   $taskMethod='netease-button'
   if(-not $taskAlready){
    if($Shortcut -eq 'off'){throw '网易云没有提供可用的系统播放接口，请在“音乐与音量”填写网易云已启用的全局播放／暂停快捷键。'}
    [JieMediaAudio]::PlaybackShortcut($Shortcut)
    $taskMethod='netease-shortcut'
    $taskConfirmed=$false
    for($taskAttempt=0;$taskAttempt -lt 10;$taskAttempt++){
     Start-Sleep -Milliseconds 180
     $taskAfterState=[JieNetEasePlayback]::Read($taskNetEase.MainWindowHandle)
     if($taskAfterState.available -and $taskAfterState.playing -eq $taskWantPlaying){$taskConfirmed=$true;break}
    }
    if(-not $taskConfirmed){throw '播放快捷键已发送，但网易云按钮未确认所需状态。请核对“音乐与音量”的快捷键与网易云全局快捷键一致；本次没有自动重复切换。'}
   }
   @{dispatched=(-not $taskAlready);verified=$true;accepted=$true;already=$taskAlready;method=$taskMethod;player='网易云音乐';status=$(if($taskWantPlaying){'Playing'}else{'Paused'});stateSource='netease-button'}|ConvertTo-Json -Compress
  } finally {$taskView.Dispose()}
  exit 0
 }
 $taskBefore=$taskNetEase.MainWindowTitle
 $taskCodes=@{pause=47;play=46;next=11;previous=12;stop=13}
 $taskAccepted=[JieMediaAudio]::Command($taskNetEase.MainWindowHandle,$taskCodes[$Action])
 Start-Sleep -Milliseconds 700
 $taskNetEase.Refresh();$taskChanged=$taskNetEase.MainWindowTitle -ne $taskBefore
 if(-not $taskAccepted -and -not $taskChanged){
  if($Action -in @('play','pause','stop')){throw '网易云没有提供系统播放会话，也未响应播放控制。请在网易云设置中开启全局快捷键或系统媒体控制，再重试。'}
  if($null -ne $taskManager.GetCurrentSession()){throw '网易云未接入系统媒体控制；为避免切到其他播放器，本次未发送全局按键。请开启网易云的全局快捷键或系统媒体控制。'}
  [JieMediaAudio]::MediaKey($(if($Action -eq 'next'){0xB0}else{0xB1}))
  Start-Sleep -Milliseconds 1000
  $taskNetEase.Refresh();$taskChanged=$taskNetEase.MainWindowTitle -ne $taskBefore
 }
 if(-not $taskChanged -and -not $taskAccepted){throw '网易云未响应切歌，请在网易云设置中开启全局快捷键或系统媒体控制，再重试。'}
 @{dispatched=$true;verified=$taskChanged;accepted=$taskAccepted;method='netease-window';player='网易云音乐';title=$taskNetEase.MainWindowTitle}|ConvertTo-Json -Compress
}catch{@{error=$_.Exception.Message}|ConvertTo-Json -Compress;exit 1}
