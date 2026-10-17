$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$synth=$null
$wave=$null
try {
 $request=[Console]::In.ReadToEnd()|ConvertFrom-Json
 Add-Type -AssemblyName System.Speech
 $synth=[System.Speech.Synthesis.SpeechSynthesizer]::new()
 $voices=@($synth.GetInstalledVoices()|Where-Object {$_.Enabled}|ForEach-Object {[pscustomobject]@{id=$_.VoiceInfo.Name;label=$_.VoiceInfo.Name;language=$_.VoiceInfo.Culture.Name}})
 if($request.operation -eq 'voices') {
  $json=ConvertTo-Json -InputObject $voices -Compress
  [Console]::Out.Write($json)
 } elseif($request.operation -eq 'speak') {
  if(-not ($request.text -is [string]) -or $request.text.Length -gt 2000 -or -not $request.text.Trim()){throw 'Invalid text'}
  if($request.voice) {
   if(-not @($voices|Where-Object {$_.id -eq $request.voice}).Count){throw 'Unknown voice'}
   $synth.SelectVoice([string]$request.voice)
  } else {
   $chinese=@($voices|Where-Object {$_.language -like 'zh-*'})
   if($chinese.Count){$synth.SelectVoice($chinese[0].id)}
  }
  $synth.Rate=[Math]::Max(-10,[Math]::Min(10,[int][Math]::Round((([double]$request.speed)-1)*10)))
  $wave=[IO.MemoryStream]::new()
  $synth.SetOutputToWaveStream($wave)
  $synth.Speak([string]$request.text)
  $synth.SetOutputToNull()
  $bytes=$wave.ToArray()
  $output=[Console]::OpenStandardOutput()
  $output.Write($bytes,0,$bytes.Length)
  $output.Flush()
 } else {throw 'Invalid operation'}
} catch {
 [Console]::Error.WriteLine('Windows system voice could not complete the request.')
 exit 1
} finally {
 if($synth){$synth.Dispose()}
 if($wave){$wave.Dispose()}
}
