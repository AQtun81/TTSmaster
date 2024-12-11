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
  const response = await fetch("audio/list.txt");
  if (response.ok) {
    var text = await response.text();
    if (text.includes('\r\n')) {
      soundList = text.split('\r\n');
    } else {
      soundList = text.split('\n');
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
  var previous = activeSurfer;
  activeSurfer = parseInt(newActive);
  
  var activeDiv = document.querySelector(`#surfers div[surfer_id="${activeSurfer}"]`);
  var previousDiv = document.querySelector(`#surfers div[surfer_id="${previous}"]`);

  activeDiv.style.opacity = "1";
  previousDiv.style.opacity = "0";

  activeDiv.style.zIndex = "100";
  previousDiv.style.zIndex = "0";

  soundnameContainer.innerText = surfers[activeSurfer].options.url.split('/').at(-1).split('.')[0];

  for (const e of rowsContainer.children) e.classList.remove("active");

  activeDiv = document.querySelector(`#rows div[surfer_id="${activeSurfer}"]`);

  if (!activeDiv) return;
  activeDiv.classList.add("active");
}

function AddSurfer(audioPath = "audio/sounds/soulbitch.mp3") {
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

function AddRegion(start = 0.0, end = 0.1) {
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
    UpdateResult();
  });

  UpdateResult();
}

function AddRow(name) {
  var row = document.createElement('div');
  row.innerText = name;
  row.setAttribute("surfer_id", surfers.length - 1);
  row.addEventListener("click", (e) => {
    SetActiveSurfer(row.getAttribute("surfer_id"));
  })
  rowsContainer.appendChild(row);
}

function AddSound(name) {
  AddSurfer(`audio/sounds/${name}.mp3`);
  AddRow(name);
  SetActiveSurfer(surfers.length - 1);

  UpdateResult();
}

function UpdateResult() {
  var text = "!tts";
  surfers.forEach(s => {
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

textInput.addEventListener("keydown", (e) => {
  if (e.code != "Enter") return;
  if (!soundList.includes(textInput.value)) return;

  AddSound(textInput.value);
})

window.addEventListener("wheel", (e) => {
  if (surfers.length < 2) return;

  var newActive = activeSurfer;
  newActive += e.deltaY >= 0 ? 1 : -1;
  if (newActive < 0) newActive += surfers.length;
  newActive %= surfers.length;
  SetActiveSurfer(newActive);
});

window.addEventListener("keydown", (e) => {
  if (isFullPlayback) return;
  if (e.code != "Space") return;
  SetActiveSurfer(0);
  if (surfers[activeSurfer].plugins[0].regions.length > 0) {
    surfers[activeSurfer].plugins[0].regions[0].play();
  } else {
    surfers[activeSurfer].media.currentTime = 0
    surfers[activeSurfer].media.play();
  }
  isFullPlayback = true;
})

function FullPlaybackNext() {
  if (!isFullPlayback) return;
  if (surfers.length - activeSurfer < 2) {
    isFullPlayback = false;
    return;
  }

  SetActiveSurfer(activeSurfer + 1);
  if (surfers[activeSurfer].plugins[0].regions.length > 0) {
    surfers[activeSurfer].plugins[0].regions[0].play();
  } else {
    surfers[activeSurfer].media.currentTime = 0
    surfers[activeSurfer].media.play();
  }
}


UpdateSoundList();