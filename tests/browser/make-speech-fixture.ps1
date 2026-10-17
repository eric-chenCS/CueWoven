param([Parameter(Mandatory=$true)][string]$OutputPath)
# Generate test audio to a file; this does not use the microphone or play sound.
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voice.SetOutputToWaveFile([System.IO.Path]::GetFullPath($OutputPath))
  $voice.Speak('Battery charging cycles damage the electrodes and reduce energy capacity. Chemical reactions explain why a phone battery stores less charge over time. Recall saves the words you actually hear while watching a video.')
} finally { $voice.Dispose() }
