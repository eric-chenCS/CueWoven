// Runs in the isolated content-script world. It clones only this video's audio;
// playback remains owned by YouTube and no microphone/tab-capture prompt is used.
(function () {
  let capture = null, opening = null;
  const notify = msg => {try {return chrome.runtime.sendMessage(msg);} catch (error) {return Promise.reject(error);}};
  async function stop(id, notifyEnded = false) {
    if (opening && (!id || opening.id === id)) opening = null;
    if (!capture || id && capture.id !== id) return;
    const old = capture;capture = null;
    old.node.port.onmessage = null;
    for (const track of old.stream.getTracks()) track.stop();
    old.source.disconnect();old.node.disconnect();
    old.video.removeEventListener('ended', old.ended);
    window.removeEventListener('pagehide', old.ended);
    document.removeEventListener('yt-navigate-start', old.ended);
    try {await old.context.close();}
    finally {if (notifyEnded) notify({type: 'speech-page-ended', id: old.id}).catch(() => {});}
  }
  async function start(id, clock) {
    await stop();
    const attempt = {id};opening = attempt;
    const video = document.querySelector('video');
    if (!video || typeof video.captureStream !== 'function' || video.paused) throw new Error('Play the video so Recall can transcribe its audio.');
    const stream = video.captureStream();
    for (const track of stream.getVideoTracks()) {stream.removeTrack(track);track.stop();}
    const context = new AudioContext();
    try {
      if (!stream.getAudioTracks().length) throw new Error('This player does not expose an audio stream.');
      await context.audioWorklet.addModule(chrome.runtime.getURL('content/speech-worklet.js'));
      await Promise.race([context.resume(), new Promise((_, reject) => setTimeout(() => reject(new Error('The browser blocked automatic audio processing for this player.')), 3000))]);
      if (opening !== attempt) throw new Error('Speech-to-text was cancelled.');
      const source = context.createMediaStreamSource(stream), node = new AudioWorkletNode(context, 'recall-pcm');
      source.connect(node);node.connect(context.destination); // The worklet outputs silence; normal video audio is unchanged.
      node.port.onmessage = ({data}) => {
        const bytes = new Uint8Array(data.buffer);
        const pcm = btoa(String.fromCharCode(...bytes));
        notify({type: 'speech-pcm', id, pcm, clock: clock()})
          .then(response => {if (response?.error || response?.ignored) return stop(id, true);})
          .catch(() => stop(id, true).catch(() => {}));
      };
      const ended = () => stop(id, true).catch(() => {});
      capture = {id, video, stream, context, source, node, ended};
      opening = null;
      video.addEventListener('ended', ended);window.addEventListener('pagehide', ended);document.addEventListener('yt-navigate-start', ended);
      return {ok: true};
    } catch (error) {
      if (opening === attempt) opening = null;
      for (const track of stream.getTracks()) track.stop();await context.close();throw error;
    }
  }
  globalThis.__recallPageAudio = {start, stop};
})();
