import index from "./index.json" with { type: "json" };
import layoutTooltips from './constraints.js'

window.addEventListener('resize', render);

const imageScaleMultiplier = 4;
const maxLives = 3;

const GameState = Object.freeze({
  Level: Symbol("level"),
  Intermission: Symbol("intermission"),
  GameOver: Symbol("game-over"),
})

const state = {
  score: 0,
  lives: maxLives,
  levels: [...index.levels].splice(0, 1),
  currLevelIndex: 0,
  currGuesses: [],
  submittedGuesses: {},
  currLevel: function() { return this.levels[this.currLevelIndex] },
  type: function() {
    if (this.lives == 0 || this.currLevelIndex >= this.levels.length) return GameState.GameOver;
    if (this.submittedGuesses[this.currLevel().id]) return GameState.Intermission;
    return GameState.Level;
  },
};

const ctx = elCanvas.getContext("2d");
elCanvas.addEventListener('mousedown', onCanvasTouch);
elCanvas.addEventListener('touchend', onCanvasTouch);

const levelDataCache = {};
async function loadLevel(id) {
  const cached = levelDataCache[id];
  if (cached) return cached;

  const rawSvg = await fetch(`images/${id}_mask.svg`).then((r) => r.text())
  const svg = new DOMParser().parseFromString(rawSvg, 'image/svg+xml').querySelector('svg');
  const width = svg.getAttribute('width') * imageScaleMultiplier
  const height = svg.getAttribute('height') * imageScaleMultiplier
  const ellipses = Array.from(svg.querySelectorAll('ellipse'))

  const img = new Image(width, height);
  img.src = `images/${id}.png`;

  const level = {
    img: img,
    ellipses: ellipses.map((e) => ({
      cx: e.cx.baseVal.value * imageScaleMultiplier,
      cy: e.cy.baseVal.value * imageScaleMultiplier,
      rx: e.rx.baseVal.value * imageScaleMultiplier,
      ry: e.ry.baseVal.value * imageScaleMultiplier,
    }))
  }

  if (!img.complete) {
    await new Promise((resolve) => img.onload = resolve);
  }


  return levelDataCache[id] = level
}


function onCanvasTouch(touch) {
  if (state.type() != GameState.Level) return;

  touch.preventDefault()
  const rect = elCanvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  state.currGuesses.push({ x: x, y: y, originWidth: rect.width });
  if (state.currGuesses.length > state.currLevel().deformations.length) {
    state.currGuesses.splice(0, 1);
  }
  render();
}

async function onSubmit() {
  const level = state.currLevel();
  if (state.submittedGuesses[level.id]) return;

  const levelData = await loadLevel(level.id);
  const submitted = new Array(levelData.ellipses.length).fill(null);
  let correctGuessesCount = 0;

  for (let iGuess = 0; iGuess < state.currGuesses.length; ++iGuess) {
    const guess = state.currGuesses[iGuess];
    const scale = levelData.img.width / elCanvas.width;
    const x = guess.x * scale;
    const y = guess.y * scale;

    for (let i = 0; i < levelData.ellipses.length; ++i) {
      const { cx, cy, rx, ry } = levelData.ellipses[i];
      const dx = x - cx;
      const dy = y - cy;
      const correct = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;

      if (correct) {
        submitted[i] = iGuess;
        ++correctGuessesCount;
        break;
      }
    }
  }

  state.submittedGuesses[level.id] = submitted;
  if (correctGuessesCount < levelData.ellipses.length) {
    --state.lives;
  } else {
    ++state.score;
  }

  render();
}

async function goNext() {
  state.currLevelIndex++;
  render();
}

async function render() {
  const gameStateType = state.type();

  if (gameStateType == GameState.GameOver) {
    elLvlContainer.style.display = "none";
    elGameOverContainer.style.display = "flex";
    if (state.lives == 0) {
      elGameOverTitle.innerText = "Game Over!"
    } else {
      elGameOverTitle.innerText = "Congratulations!"
    }
    elGameOverDescription.innerText = `You scored ${state.score} points.`
  } else {
    const level = state.levels[state.currLevelIndex]
    const levelData = await loadLevel(level.id)
    const img = levelData.img

    elCanvas.height = window.innerHeight * .8;
    elCanvas.width = elCanvas.height * (img.width / img.height);
    ctx.drawImage(img, 0, 0, elCanvas.width, elCanvas.height);

    for (let i = 0; i < state.currGuesses.length; ++i) {
      const guess = state.currGuesses[i];
      const scale = elCanvas.width / guess.originWidth

      ctx.beginPath();
      ctx.arc(guess.x * scale, guess.y * scale, 20 * scale, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

    }

    if (gameStateType == GameState.Intermission) {
      const submittedGuesses = state.submittedGuesses[level.id];
      const scaledEllipses = [];

      for (let i = 0; i < levelData.ellipses.length; ++i) {
        const scale = elCanvas.width / img.width
        const ellipse = levelData.ellipses[i]
        const scaled = {
          cx: ellipse.cx * scale,
          cy: ellipse.cy * scale,
          rx: ellipse.rx * scale,
          ry: ellipse.ry * scale,
          rectWidth: 150,
          rectHeight: 100
        }
        ctx.beginPath();
        ctx.ellipse(scaled.cx, scaled.cy, scaled.rx, scaled.ry, 0, 0, Math.PI * 2);
        ctx.lineWidth = 8;
        ctx.strokeStyle = submittedGuesses[i] != null ? "#00ff00" : "#ff0000";
        ctx.stroke();
        scaledEllipses.push(scaled);
      }

      const labelRects = layoutTooltips(scaledEllipses, elCanvas.width, elCanvas.height)
      for (let i = 0; i < labelRects.length; ++i) {
        const rect = labelRects[i];
        ctx.beginPath();
        ctx.rect(rect.l, rect.t, rect.w, rect.h);
        ctx.fillStyle = "#F0F0FF";
        ctx.fill();
        ctx.fillText("Some text buddy", rect.l, rect.t, rect.w);
      }
      console.log(labelRects);
      elSubmit.innerText = state.currLevelIndex < state.levels.length - 1 ? "Next" : "Finish";
      elSubmit.addEventListener('click', goNext);
    } else {
      const buttonEnabled = state.currGuesses.length == level.deformations.length;
      elSubmit.addEventListener('click', onSubmit)
      elSubmit.innerText = buttonEnabled ? "Submit" : `${state.currGuesses.length}/${level.deformations.length} Guesses`;
      elSubmit.disabled = !buttonEnabled;
    }

    elHeader.style.width = elCanvas.width + "px";
    elProgress.value = state.currLevelIndex;
    elProgress.max = state.levels.length;
    elLives.innerText = `Lives: ${state.lives}/${maxLives}`;
    elLvlDescription.innerText = `There are ${level.deformations.length} things wrong with this image`;
  }
}

render();

