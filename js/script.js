const baseUrl = "https://tkap1.github.io/";
const waveformsContainer = document.getElementById("waveforms");
const rowsContainer = document.getElementById("rows");
const soundnameContainer = document.getElementById("soundname");
const textInput = document.querySelector("#addbar > input");
const result = document.querySelector("#commandResult");
const soundsDatalist = document.querySelector("#sounds");
const volumeSlider = document.querySelector("#volumeSlider");
const dropGhost = document.querySelector("#dropGhost");
const soundboard = document.querySelector("#soundboard");
const soundboardOverlap = document.querySelector("#soundboardOverlapToggle");
const soundboardSearch = document.querySelector("#soundboardSearch");
const tooltipText = document.querySelector("#tooltipText");

const waveforms = [];
var activeWaveform = 0;
var increment = 0;
var isFullPlayback = false;
var isDragging = false;
var dragged = null;
var mouseX = 0;
var mouseY = 0;
var dragStartX = 0;
var dragStartY = 0;

var soundList = [];
var audioPlayer = new Audio();
var soundboardLoaded = false;

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
    if (region.regions.length == 0) {
      FullPlaybackNext();
    }
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

  region.regionsContainer.addEventListener("mouseup", (e) => {
    if (e.button != 1) return; // middle click
    if (region.regions < 1) return;
    region.regions[0].remove();
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
  RegisterTooltip(toggleBackwardsButton, "Play this sound in reverse");

  // sound name label
  var label = document.createElement('h5');
  label.innerText = name;
  label.addEventListener("mousedown", async (e) => {
    SetActiveWaveform(row.getAttribute("waveform_id"));
    isDragging = true;

    await new Promise(r => setTimeout(r, 100));
    if (!isDragging) return;

    dragged = e.target.parentElement;
    DragLoop();
    row.style.display = "none";
    rowsContainer.appendChild(dropGhost);
    dropGhost.style.display = "flex";
  })
  row.appendChild(label);

  // delete sound button
  var deleteButton = document.createElement('button');
  deleteButton.classList.add("delete");
  deleteButton.addEventListener("click", (e) => {
    DeleteWaveform(row.getAttribute("waveform_id"));
  });
  row.appendChild(deleteButton);
  RegisterTooltip(deleteButton, "Delete this sound");

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
  
  if (waveforms.length >= 1) document.getElementById("playButton").classList.remove("inactive");
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

  waveform.wavesurfer.destroy();
  waveform.waveformElement.remove();
  waveform.row.remove();

  // hide tooltip if it was visible
  var mouseLeaveEvent = new Event("mouseleave");
  waveform.row.querySelector(".delete").dispatchEvent(mouseLeaveEvent);

  const position = waveforms.indexOf(waveform);
  waveforms.splice(position, 1);

  UpdateResult();
  if (waveforms.length < 1) {
    document.getElementById("playButton").classList.add("inactive");
    return;
  }
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
    GetWaveform(activeWaveform).wavesurfer.media.pause();
    isFullPlayback = false;
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
  if (waveforms.at(-1).id == activeWaveform) {
    waveforms.at(-1).wavesurfer.media.pause();
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

async function ShowTooltipText(element, text) {
  await new Promise(r => setTimeout(r, 500));
  if (document.elementFromPoint(mouseX, mouseY) != element) return;
  var rect = element.getBoundingClientRect();
  tooltipText.innerText = text;
  tooltipText.style.display = "block";
  var infoRect = tooltipText.getBoundingClientRect();
  var top = rect.top;
  if (top < infoRect.height) top += infoRect.height + rect.height + 20;
  tooltipText.style.top = `${top - 10}px`;
  tooltipText.style.left = `${rect.left}px`;
  tooltipText.style.marginLeft = `${-infoRect.width / 2 + rect.width / 2}px`;
}

function HideTooltipText() {
  tooltipText.style.display = "none";
}

function RegisterTooltip(element, text) {
  element.addEventListener("mouseenter", (e) => {
    ShowTooltipText(element, text);
  });
  element.addEventListener("mouseleave", (e) => {
    HideTooltipText();
  });
}

/* DRAG TO REORDER
--------------------------------------------------------------------------------------------------------------------------------------- */

function DragLoop() {
  if (!isDragging) return;
  requestAnimationFrame(DragLoop);

  var mouseElement = document.elementFromPoint(mouseX, mouseY);
  if (mouseElement == dropGhost) return;

  while (mouseElement.parentElement) {
    if (mouseElement.attributes.waveform_id != undefined && mouseElement.parentElement.id == "rows") break;
    mouseElement = mouseElement.parentElement;
  }

  if (mouseElement.attributes.waveform_id == undefined) return;
  var idPreceding = dropGhost.compareDocumentPosition(mouseElement) == Node.DOCUMENT_POSITION_PRECEDING;
  if (idPreceding) {
    rowsContainer.insertBefore(dropGhost, mouseElement);
  } else {
    rowsContainer.insertBefore(dropGhost, mouseElement.nextSibling);
  }
}

function Move(array, from, to) {
  if (from > to) from -= 1;
  array.splice(to, 0, array.splice(from, 1)[0]);
};

function indexOfElement(element, parent) {
  const children = Array.from(parent.children);
  return children.indexOf(element);
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

/* SOUNDBOARD
--------------------------------------------------------------------------------------------------------------------------------------- */

function LoadSoundboardSounds() {
  var container = soundboard.querySelector("#soundboardSounds");
  soundList.forEach(soundname => {
    var button = document.createElement("button");
    button.innerText = soundname;
    button.addEventListener("click", (e) => {
      SoundboardPlaySound(soundname);
    })
    container.appendChild(button);
  });
}

async function OpenSoundboard() {
  if (!soundboardLoaded) {
    soundboardLoaded = true;
    LoadSoundboardSounds();
  }
  soundboard.style.display = "flex";
  await new Promise(r => setTimeout(r, 1));
  soundboard.style.opacity = 1;
}

async function CloseSoundboard() {
  if (soundboard.style.display != "flex") return;
  soundboard.style.opacity = 0;
  await new Promise(r => setTimeout(r, 200));
  soundboard.style.display = "none";
}

function SoundboardPlaySound(name) {
  if (!audioPlayer.paused && !soundboardOverlap.checked) audioPlayer.pause();
  audioPlayer = new Audio(`${baseUrl}sounds/${name}.mp3`);
  audioPlayer.volume = volumeSlider.value * 0.01;
  audioPlayer.play();
}

function SearchSounds(query) {
  var container = soundboard.querySelector("#soundboardSounds");
  container.innerHTML = "";
  query = query.toLowerCase();
  soundList.forEach(sound => {
    if (sound.search(query) != -1) {
      var button = document.createElement("button");
      button.innerText = sound;
      button.addEventListener("click", (e) => {
        SoundboardPlaySound(sound);
      })
      container.appendChild(button);
    }
  });
}

function UpdateOverlap() {
  localStorage.setItem("sound-overlap", soundboardOverlap.checked);
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
  if (e.code == "Escape") CloseSoundboard();
  if (e.code != "Space") return;
  PlaySoundsInSequence();
})

window.addEventListener("mouseup", (e) => {
  if (isDragging && dragged) {

    var oldIndex = indexOfElement(dragged, rowsContainer);

    rowsContainer.insertBefore(dragged, dropGhost);
    dragged.style.display = "flex";

    var newIndex = indexOfElement(dragged, rowsContainer);
    Move(waveforms, oldIndex, newIndex);

    dropGhost.style.display = "none";
    document.body.appendChild(dropGhost);

    dragged = null;
    UpdateResult();
    e.preventDefault();
  }
  
  isDragging = false;
})

window.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
})

/* ON LOAD
--------------------------------------------------------------------------------------------------------------------------------------- */

UpdateSoundList();
volumeSlider.value = localStorage.getItem("volume");
soundboardOverlap.checked = localStorage.getItem("sound-overlap") == "true";

document.querySelectorAll("[tooltip]").forEach(element => {
  RegisterTooltip(element, element.attributes.tooltip.value);
});