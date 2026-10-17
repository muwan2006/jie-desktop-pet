param([switch]$Probe,[string]$WavPath='')
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
function Send-Result($value){[Console]::Out.WriteLine(($value|ConvertTo-Json -Compress -Depth 6));[Console]::Out.Flush()}
$recognizer=$null
try {
 Add-Type -AssemblyName System.Speech
 Add-Type -TypeDefinition 'public static class JieInputReader { public static System.Threading.Tasks.Task<string> BeginRead() { return System.Threading.Tasks.Task.Run(() => System.Console.ReadLine()); } }' 
 $installed=@([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers())
 if($Probe){Send-Result @{type='recognizers';languages=@($installed|ForEach-Object {$_.Culture.Name})};exit 0}
 $line=[Console]::In.ReadLine();$config=$line|ConvertFrom-Json
 if($config.language -notin @('zh-CN','en-US','ja-JP')){throw '识别语言无效。'}
 $info=$installed|Where-Object {$_.Culture.Name -eq $config.language}|Select-Object -First 1
 if($null -eq $info){throw ('系统未安装'+$config.language+'语音识别包，请在Windows语言设置安装语音功能。')}
 $recognizer=[System.Speech.Recognition.SpeechRecognitionEngine]::new($info)
 $recognizer.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())
 if($WavPath){$recognizer.SetInputToWaveFile($WavPath)}else{$recognizer.SetInputToDefaultAudioDevice()}
 $recognizer.EndSilenceTimeout=[TimeSpan]::FromMilliseconds(500)
 $recognizer.EndSilenceTimeoutAmbiguous=[TimeSpan]::FromMilliseconds(700)
 Register-ObjectEvent $recognizer SpeechRecognized -SourceIdentifier 'jie-final'|Out-Null
 Register-ObjectEvent $recognizer SpeechHypothesized -SourceIdentifier 'jie-partial'|Out-Null
 Register-ObjectEvent $recognizer AudioLevelUpdated -SourceIdentifier 'jie-level'|Out-Null
 Register-ObjectEvent $recognizer SpeechRecognitionRejected -SourceIdentifier 'jie-rejected'|Out-Null
 Register-ObjectEvent $recognizer RecognizeCompleted -SourceIdentifier 'jie-done'|Out-Null
 $recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
 Send-Result @{type='ready'}
 $lastLevel=[DateTime]::UtcNow;$command=[JieInputReader]::BeginRead();$stopping=$false;$until=[DateTime]::UtcNow.AddSeconds(65)
 while([DateTime]::UtcNow -lt $until){
  if(-not $stopping -and $command.IsCompleted){$value=$command.GetAwaiter().GetResult();if(-not $value -or $value -eq 'cancel'){$recognizer.RecognizeAsyncCancel();Send-Result @{type='canceled'};break};$recognizer.RecognizeAsyncStop();$stopping=$true;$until=[DateTime]::UtcNow.AddSeconds(4)}
  $events=@(Get-Event -ErrorAction SilentlyContinue)
  $finished=$false
  foreach($event in $events){
   if($event.SourceIdentifier -eq 'jie-final'){Send-Result @{type='final';text=$event.SourceEventArgs.Result.Text;confidence=$event.SourceEventArgs.Result.Confidence}}
   elseif($event.SourceIdentifier -eq 'jie-partial'){Send-Result @{type='partial';text=$event.SourceEventArgs.Result.Text}}
   elseif($event.SourceIdentifier -eq 'jie-level'){if(([DateTime]::UtcNow-$lastLevel).TotalMilliseconds -gt 250){Send-Result @{type='level';level=$event.SourceEventArgs.AudioLevel};$lastLevel=[DateTime]::UtcNow}}
   elseif($event.SourceIdentifier -eq 'jie-rejected'){Send-Result @{type='diagnostic';message='Windows 收到了声音但未识别，请切换到本地 Whisper 或检查麦克风音量。'}}
   elseif($event.SourceIdentifier -eq 'jie-done'){if($event.SourceEventArgs.Error){throw $event.SourceEventArgs.Error};Send-Result @{type='done'};$finished=$true}
   Remove-Event -EventIdentifier $event.EventIdentifier -ErrorAction SilentlyContinue
  }
  if($finished){break}
  Start-Sleep -Milliseconds 30
 }
 if(-not $finished){Send-Result @{type='done';limited=$true}}
}catch{Send-Result @{type='error';message=$_.Exception.Message};exit 1}
finally{Unregister-Event -SourceIdentifier 'jie-level' -ErrorAction SilentlyContinue;Unregister-Event -SourceIdentifier 'jie-rejected' -ErrorAction SilentlyContinue;Unregister-Event -SourceIdentifier 'jie-final' -ErrorAction SilentlyContinue;Unregister-Event -SourceIdentifier 'jie-partial' -ErrorAction SilentlyContinue;Unregister-Event -SourceIdentifier 'jie-done' -ErrorAction SilentlyContinue;if($recognizer){$recognizer.Dispose()}}
