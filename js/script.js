const baseUrl = "https://tkap1.github.io/";
const waveformsContainer = document.getElementById("waveforms");
const rowsContainer = document.getElementById("rows");
const soundnameContainer = document.getElementById("soundname");
const textInput = document.querySelector("#addbar > input");
const result = document.querySelector("#commandResult");
const soundsDatalist = document.querySelector("#sounds");
const volumeSlider = document.querySelector("#volumeSlider");

const waveforms = [];
var activeWaveform = 0;
var increment = 0;
var isFullPlayback = false;

var soundList = [];

/* WAVEFORM FUNCTIONS
--------------------------------------------------------------------------------------------------------------------------------------- */

function GetWaveform(index) {
  for (const w of waveforms) {
    if (w.id == index) {
      return w;
    }
  }
  return null;
}

function AddWaveform(name = "soulbitch") {

  audioPath = `${baseUrl}sounds/${name}.mp3`

  /* Create Waveform
  --------------------------------------------------------- */
  var newWaveformElement = document.createElement('div');
  var region = WaveSurfer.Regions.create();
  newWaveformElement.setAttribute("waveform_id", waveforms.length);
  var newWaveform = WaveSurfer.create({
    container: newWaveformElement,
    waveColor: "#1b3857",
    progressColor: "#3975b5",
    plugins: [region],
    height: 100,
    backend: "WebAudio",
    url: audioPath
  });
  waveformsContainer.appendChild(newWaveformElement);

  // waveform - play on click
  newWaveform.on('click', () => {
    if (newWaveform.media.paused ||
      newWaveform.plugins[0].regions.length < 1) {
      newWaveform.play();
    } else {
      newWaveform.pause();
    }
  })

  // waveform - play in sequence
  newWaveform.media.addEventListener("ended", (e) => {
    FullPlaybackNext();
  })

  // rehion settings and events
  region.enableDragSelection({
    color: 'rgba(255, 0, 0, 0.1)',
  })

  region.on('region-created', (r) => {
    if (region.regions.length > 1) {
      region.regions[0].remove();
    }
    UpdateResult();
  });

  region.on('region-out', (r) => {
    if (isFullPlayback) {
      if (newWaveform.media.currentTime + 0.02 < r.end) {
        return;
      }
      newWaveform.media.pause();
      FullPlaybackNext();
      return;
    }
    r.play();
  });

  region.on('region-updated', (r) => {
    UpdateResult();
  });

  /* Create Row
  --------------------------------------------------------- */
  var row = document.createElement('div');
  row.setAttribute("waveform_id", increment);

  // backwards toggle button
  var toggleBackwardsButton = document.createElement('button');
  toggleBackwardsButton.classList.add("toggleBackwards");
  toggleBackwardsButton.addEventListener("click", (e) => {
    var state = toggleBackwardsButton.classList.contains("active");
    if (state) {
      toggleBackwardsButton.classList.remove("active");
    } else {
      toggleBackwardsButton.classList.add("active");
    }
    var index = toggleBackwardsButton.parentNode.attributes.waveform_id.value;
    GetWaveform(index).backwards = !state;
    ReverseWaveform(index);
    UpdateResult();
    toggleBackwardsButton.blur();
  });
  row.appendChild(toggleBackwardsButton);

  // sound name label
  var label = document.createElement('h5');
  label.innerText = name;
  label.addEventListener("click", (e) => {
    SetActiveWaveform(row.getAttribute("waveform_id"));
  })
  row.appendChild(label);

  // delete sound button
  var deleteButton = document.createElement('button');
  deleteButton.classList.add("delete");
  deleteButton.addEventListener("click", (e) => {
    DeleteWaveform(row.getAttribute("waveform_id"));
  });
  row.appendChild(deleteButton);

  rowsContainer.appendChild(row);

  // append to array
  waveforms.push({
    'id': increment,
    'name': name,
    'waveformElement': newWaveformElement,
    'wavesurfer': newWaveform,
    'region': region,
    'row': row,
    'backwards': false,
    'canvasWrapper': newWaveform.renderer.wrapper,
    'progressCanvasWrapper': newWaveform.renderer.progressWrapper,
  });

  newWaveform.media.volume = volumeSlider.value * 0.01;
  SetActiveWaveform(increment);
  increment++;
  UpdateResult();
}

function SetActiveWaveform(index) {
  if (activeWaveform == index) return;
  waveform = GetWaveform(index);
  if (!waveform) return;

  oldWaveform = GetWaveform(activeWaveform);
  if (oldWaveform && !oldWaveform.wavesurfer.media.paused) oldWaveform.wavesurfer.media.pause();

  activeWaveform = index;

  for (const w of waveforms) {
    w.waveformElement.style.opacity = "0";
    w.waveformElement.style.zIndex = "0";
    w.row.classList.remove("active");
  }
  waveform.waveformElement.style.opacity = "1";
  waveform.waveformElement.style.zIndex = "100";
  waveform.row.classList.add("active");
  soundnameContainer.innerText = waveform.name;
}

function DeleteWaveform(index) {
  var waveform = GetWaveform(index);
  if (!waveform) return;

  waveform.waveformElement.remove();
  waveform.row.remove();

  const position = waveforms.indexOf(waveform);
  waveforms.splice(position, 1);

  UpdateResult();
  if (waveforms.length < 1) return;
  SetActiveWaveform(waveforms[0].id);
}

function ReverseWaveform(index) {
  var waveform = GetWaveform(index);
  if (!waveform) return;

  // create a new buffer with reversed audio data
  var sampleRate = waveform.wavesurfer.media.buffer.sampleRate;
  var audioData = waveform.wavesurfer.media.getChannelData(0)[0].reverse();
  var audioCtx = waveform.wavesurfer.media.audioContext;
  var audioBuffer = audioCtx.createBuffer(1, audioData.length, sampleRate);
  audioBuffer.copyToChannel(audioData, 0);

  // flip the canvas
  var transformValue = waveform.backwards ? "scale(-1)" : "scale(1)";
  waveform.canvasWrapper.getElementsByTagName("canvas")[0].style.transform = transformValue;
  waveform.progressCanvasWrapper.getElementsByTagName("canvas")[0].style.transform = transformValue;

  // replace old buffer with a new one
  waveform.wavesurfer.media.buffer = audioBuffer;
}

/* SEQUENCIAL PLAYBACK
--------------------------------------------------------------------------------------------------------------------------------------- */

function PlaySoundsInSequence() {
  if (rowsContainer.children.length < 1) return;
  if (isFullPlayback) {
    isFullPlayback = false;
    GetWaveform(activeWaveform).wavesurfer.media.pause();
    return;
  }
  SetActiveWaveform(waveforms[0].id);
  if (waveforms[0].region.regions.length > 0) {
    waveforms[0].region.regions[0].play();
  } else {
    waveforms[0].wavesurfer.media.currentTime = 0;
    waveforms[0].wavesurfer.media.play();
  }
  isFullPlayback = true;
}

function FullPlaybackNext() {
  if (!isFullPlayback) return;
  if (rowsContainer.lastChild.attributes.waveform_id.value == activeWaveform) {
    isFullPlayback = false;
    return;
  }

  var active = GetWaveform(activeWaveform);
  index = waveforms.indexOf(active) + 1;
  index %= waveforms.length;
  SetActiveWaveform(waveforms[index].id);

  active = GetWaveform(activeWaveform);

  if (active.region.regions.length > 0) {
    active.region.regions[0].play();
  } else {
    active.wavesurfer.media.currentTime = 0;
    active.wavesurfer.media.play();
  }
}

/* GENERATED TTS COMMAND
--------------------------------------------------------------------------------------------------------------------------------------- */

function UpdateResult() {
  var state_backwards = false;
  var text = "!tts";
  for (let i = 0; i < waveforms.length; i++) {
    const w = waveforms[i];
    if (w.backwards != state_backwards) {
      text += ` -b`;
      state_backwards = !state_backwards;
    }
    if (w.region.regions.length > 0) {
      var region = w.region.regions[0];
      var start = Math.round(region.start * 1000);
      var end = Math.round(region.end * 1000);
      if (w.backwards) {
        var total = Math.round(waveforms[0].wavesurfer.media.duration * 1000);
        var temp = end;
        end = total - start;
        start = total - temp;
      }
      text += ` -ck${start}:${end}`;
    }
    text += ` -${w.wavesurfer.options.url.split('/').at(-1).split('.')[0]}`;
  }
  result.innerText = text;
}

async function CopyCommandToClipboard() {
  navigator.clipboard.writeText(result.innerText);
  var toast = document.querySelector("#commandResultToast");
  toast?.classList.add("visible");
  await new Promise(r => setTimeout(r, 2000));
  toast?.classList.remove("visible");
}

/* UI FUNCTIONS
--------------------------------------------------------------------------------------------------------------------------------------- */

function AddSoundTextInput() {
  if (!soundList.includes(textInput.value)) return;
  AddWaveform(textInput.value);
}

function UpdateVolume() {
  localStorage.setItem("volume", volumeSlider.value);
  var newVolume = volumeSlider.value * 0.01;
  waveforms.forEach(w => {
    w.wavesurfer.media.volume = newVolume;
  });
}

/* SOUND LIST
--------------------------------------------------------------------------------------------------------------------------------------- */

async function UpdateSoundList() {
  const response = await fetch(`${baseUrl}list.txt`);
  if (response.ok) {
    var text = await response.text();
    if (text.includes('\r\n')) {
      soundList = text.split('\r\n');
    } else {
      soundList = text.split('\n');
    }

    // remove all empty strings
    var index = soundList.findIndex((e) => e == '');
    while (index > -1) {
      soundList.splice(index, 1);
      index = soundList.findIndex((e) => e == '');
    }
    
    soundList.forEach(e => {
      var newOption = document.createElement("option");
      newOption.value = e;
      newOption.innerText = e;
      soundsDatalist.appendChild(newOption);
    });
  }
}

/* EVENTS
--------------------------------------------------------------------------------------------------------------------------------------- */

textInput.addEventListener("keydown", (e) => {
  if (e.code == "Space") e.preventDefault();
  if (e.code != "Enter") return;
  AddSoundTextInput();
})

window.addEventListener("wheel", (e) => {
  if (waveforms.length < 2) return;
  var step = e.deltaY >= 0 ? 1 : -1;
  var active = GetWaveform(activeWaveform);
  index = waveforms.indexOf(active);
  index += step;
  index %= waveforms.length;
  if (index < 0) index += waveforms.length;
  SetActiveWaveform(waveforms[index].id);
});

window.addEventListener("keydown", (e) => {
  if (e.code != "Space") return;
  PlaySoundsInSequence();
})

/* ON LOAD
--------------------------------------------------------------------------------------------------------------------------------------- */

UpdateSoundList();
volumeSlider.value = localStorage.getItem("volume");