const baseUrl = "https://tkap1.github.io/";
const surfersContainer = document.getElementById("surfers");
const rowsContainer = document.getElementById("rows");
const soundnameContainer = document.getElementById("soundname");
const textInput = document.querySelector("#addbar > input");
const result = document.querySelector("#commandResult");
const soundsDatalist = document.querySelector("#sounds");
const surfers = [];

var soundList = [];
var activeSurfer = 0;
var mousedown = -1;
var lastCreatedRegion;
var isFullPlayback = false;

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

function SetActiveSurfer(newActive) {
  if (activeSurfer == newActive) return;
  if (newActive >= surfers.length) return;
  if (!surfers[newActive]) return;
  activeSurfer = parseInt(newActive);

  for (const e of surfersContainer.children) {
    e.style.opacity = "0";
    e.style.zIndex = "0";
  }
  
  var activeDiv = document.querySelector(`#surfers div[surfer_id="${activeSurfer}"]`);
  activeDiv.style.opacity = "1";
  activeDiv.style.zIndex = "100";

  soundnameContainer.innerText = surfers[activeSurfer].options.url.split('/').at(-1).split('.')[0];

  for (const e of rowsContainer.children) e.classList.remove("active");

  activeDiv = document.querySelector(`#rows div[surfer_id="${activeSurfer}"]`);

  if (!activeDiv) return;
  activeDiv.classList.add("active");
}

function SetFirstSurfer() {
  if (rowsContainer.children < 1) return;
  SetActiveSurfer(rowsContainer.children[0]?.attributes.surfer_id.value);
}

function AddSurfer(audioPath = `${baseUrl}sounds/soulbitch.mp3`) {
  var newSurfer = document.createElement('div');
  newSurfer.setAttribute("surfer_id", surfers.length);
  surfers.push(WaveSurfer.create({
    container: newSurfer,
    waveColor: "#1b3857",
    progressColor: "#3975b5",
    plugins: [WaveSurfer.Regions.create()],
    height: 100,
    url: audioPath
  }));
  surfersContainer.appendChild(newSurfer);

  // play on click
  surfers[surfers.length - 1].on('click', () => {
    if (surfers[activeSurfer].media.paused ||
        surfers[activeSurfer].plugins[0].regions.length < 1) {
      if (Date.now() - lastCreatedRegion < 100) return;
      surfers[activeSurfer].play();
    } else {
      surfers[activeSurfer].pause();
    }
  })

  // play sequence
  surfers[surfers.length - 1].media.addEventListener("ended", (e) => {
    FullPlaybackNext();
  })

  // create region press
  newSurfer.addEventListener("mousedown", (e) => {
    mousedown = e.clientX;
  })

  // create region release
  newSurfer.addEventListener("mouseup", (e) => {
    if (mousedown == -1) return;
    if (Math.abs(mousedown - e.clientX) < 10) return;
    var width = 1.0 / surfers[activeSurfer].renderer.canvasWrapper.getBoundingClientRect().width;
    var from = mousedown * width * surfers[activeSurfer].media.duration;
    var to = e.clientX * width * surfers[activeSurfer].media.duration;
    AddRegion(from, to);
    mousedown = -1;
    e.preventDefault();
  })
}

function DeleteSurfer(surfer_id) {
  var surferElement = document.querySelector(`#surfers [surfer_id="${surfer_id}"]`);
  var rowElement = document.querySelector(`#rows [surfer_id="${surfer_id}"]`);
  surfers[surfer_id] = null;
  rowElement.remove();
  surferElement.remove();
  if (surfer_id == activeSurfer) SetFirstSurfer();
}

function AddRegion(start = 0.0, end = 0.1) {

  if (start > end) {
    var temp = start;
    start = end;
    end = temp;
  }

  if (surfers[activeSurfer].options.plugins[0].regions.length > 0) return;
  surfers[activeSurfer].options.plugins[0].addRegion({
    start: start,
    end: end,
    content: "Cut",
    color: "#fff4",
    drag: true,
    resize: true,
  });
  lastCreatedRegion = Date.now();

  surfers[activeSurfer].options.plugins[0].on('region-out', (region) => {
    if (isFullPlayback) {
      if (surfers[activeSurfer].media.currentTime + 0.02 < region.end) {
        return;
      }
      surfers[activeSurfer].media.pause();
      FullPlaybackNext();
      return;
    }
    region.play();
  });

  surfers[activeSurfer].options.plugins[0].on('region-updated', (region) => {
    var start = Math.round(region.start * 1000);
    var end = Math.round(region.end * 1000);
    region.content.innerText = `Cut ${start} - ${end}`;
    surfers[activeSurfer].media.currentTime = region.start;
    UpdateResult();
  });

  var region = surfers[activeSurfer].options.plugins[0].regions[0];
  var start = Math.round(region.start * 1000);
  var end = Math.round(region.end * 1000);
  region.content.innerText = `Cut ${start} - ${end}`;

  UpdateResult();
}

function AddRow(name) {
  var row = document.createElement('div');
  row.setAttribute("surfer_id", surfers.length - 1);
  row.addEventListener("click", (e) => {
    SetActiveSurfer(row.getAttribute("surfer_id"));
  })

  var label = document.createElement('h5');
  label.innerText = name;
  row.appendChild(label);

  var deleteButton = document.createElement('button');
  deleteButton.addEventListener("click", (e) => {
    DeleteSurfer(row.getAttribute("surfer_id"));
  });
  row.appendChild(deleteButton);

  rowsContainer.appendChild(row);
}

function AddSound(name) {
  AddSurfer(`${baseUrl}/sounds/${name}.mp3`);
  AddRow(name);
  SetActiveSurfer(surfers.length - 1);

  UpdateResult();
}

function UpdateResult() {
  var text = "!tts";
  surfers.forEach(s => {
    if (!s) return;
    if (s.plugins[0].regions.length > 0) {
      var region = s.plugins[0].regions[0];
      var start = Math.round(region.start * 1000);
      var end = Math.round(region.end * 1000);
      text += ` -ck${start}:${end}`;
    }
    text += ` -${s.options.url.split('/').at(-1).split('.')[0]}`;
  });
  result.innerText = text;
}

async function CopyCommandToClipboard() {
  navigator.clipboard.writeText(result.innerText);
  var toast = document.querySelector("#commandResultToast");
  toast?.classList.add("visible");
  await new Promise(r => setTimeout(r, 2000));
  toast?.classList.remove("visible");
}

textInput.addEventListener("keydown", (e) => {
  if (e.code != "Enter") return;
  if (!soundList.includes(textInput.value)) return;

  AddSound(textInput.value);
})

window.addEventListener("wheel", (e) => {
  if (surfers.length < 2) return;

  var newActive = activeSurfer;
  var step = e.deltaY >= 0 ? 1 : -1;
  do {
    newActive += step;
    newActive %= surfers.length;
    if (newActive < 0) newActive += surfers.length;
  } while (!surfers[newActive]);
  SetActiveSurfer(newActive);
});

window.addEventListener("keydown", (e) => {
  if (isFullPlayback) {
    isFullPlayback = false;
    surfers[activeSurfer].media.pause();
    return;
  }
  if (e.code != "Space") return;
  SetFirstSurfer();
  if (surfers[activeSurfer].plugins[0].regions.length > 0) {
    surfers[activeSurfer].plugins[0].regions[0].play();
  } else {
    surfers[activeSurfer].media.currentTime = 0;
    surfers[activeSurfer].media.play();
  }
  isFullPlayback = true;
})

function FullPlaybackNext() {
  if (!isFullPlayback) return;
  if (rowsContainer.lastChild.attributes.surfer_id.value == activeSurfer) {
    isFullPlayback = false;
    return;
  }

  var newSurfer = activeSurfer;
  do {
    newSurfer += 1;
  } while (!surfers[newSurfer]);
  SetActiveSurfer(newSurfer);

  if (surfers[activeSurfer].plugins[0].regions.length > 0) {
    surfers[activeSurfer].plugins[0].regions[0].play();
  } else {
    surfers[activeSurfer].media.currentTime = 0;
    surfers[activeSurfer].media.play();
  }
}


UpdateSoundList();