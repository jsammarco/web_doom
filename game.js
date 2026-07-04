const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const minimapCanvas = document.getElementById("minimapCanvas");
const minimapCtx = minimapCanvas.getContext("2d");

const healthValue = document.getElementById("healthValue");
const ammoValue = document.getElementById("ammoValue");
const keyValue = document.getElementById("keyValue");
const enemyValue = document.getElementById("enemyValue");
const scoreValue = document.getElementById("scoreValue");
const musicMuteButton = document.getElementById("musicMuteButton");
const musicVolumeControl = document.getElementById("musicVolumeControl");
const statusText = document.getElementById("statusText");
const startScreen = document.getElementById("startScreen");
const endScreen = document.getElementById("endScreen");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const endTitle = document.getElementById("endTitle");
const endSubtitle = document.getElementById("endSubtitle");

const ASSET_PATHS = {
  wall: "assets/wall.png",
  door: "assets/door.png",
  floor: "assets/floor.png",
  enemy: "assets/enemy.png",
  key: "assets/keycard.png",
  medkit: "assets/medkit.png",
  exit: "assets/exit.png",
  weapon: "assets/weapon_sprites_clean.png",
};

const GUN_SHOT_SRC = "assets/gun_shot.mp3";
const MUSIC_SRC = "assets/music.mp3";
const MUSIC_VOLUME = 0.34;
const MUSIC_FADE_SECONDS = 1;
const MUSIC_END_FADE_DELAY_SECONDS = 1;
const SOUND_FX = {
  complete: { src: "assets/complete.mp3", volume: 0.78 },
  key: { src: "assets/key.mp3", volume: 0.82 },
  monster: { src: "assets/monster.mp3", volume: 0.62 },
  monsterDies: { src: "assets/monster_dies.mp3", volume: 0.78 },
  punch: { src: "assets/punch.mp3", volume: 0.82 },
};
const WEAPON_SHEET = {
  columns: 4,
  rows: 2,
  frames: 8,
  idleFrame: 0,
  animationFrames: [1, 2, 3, 6, 7, 6, 3, 2, 1, 0],
  animationSeconds: 0.44,
};

const LEVEL_ROWS = [
  "###################",
  "#P....#.......#...#",
  "#.##..#.#####.#.#.#",
  "#......K...#..#.#.#",
  "####.#####.#..#...#",
  "#....#...#.#.###.##",
  "#.##.#.E.#.#.....##",
  "#....###.#.#####..#",
  "#.##.....#.....#..#",
  "#..#####.###.#.#..#",
  "#..#M....#...#.#..#",
  "#..#.#####.#.#.#D.#",
  "#E...#.....#...#X##",
  "###################",
];

const FOV = Math.PI / 3;
const MOVE_SPEED = 2.55;
const TURN_SPEED = 2.35;
const PLAYER_RADIUS = 0.24;
const EXTRA_RANDOM_ENEMIES = 2;
const ENEMY_KILL_POINTS = 100;
const ALL_HOSTILES_BONUS = 300;
const DISCOVERY_RAYS = 96;
const DISCOVERY_DISTANCE = 8.5;
const MONSTER_SOUND_MIN_DELAY = 0.7;
const MONSTER_SOUND_MAX_DELAY = 1.9;
const MONSTER_SOUND_MAX_DISTANCE = 8.5;

const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  fire: false,
};

const game = {
  state: "intro",
  viewW: 1,
  viewH: 1,
  dpr: 1,
  zBuffer: [],
  floorPattern: null,
  floorTexture: null,
  floorBuffer: null,
  assets: {},
  weaponFrames: [],
  shotSound: null,
  music: null,
  musicFadeFrame: null,
  musicFadeTimeout: null,
  musicVolume: MUSIC_VOLUME,
  musicMuted: false,
  sounds: {},
  player: {
    x: 1.5,
    y: 1.5,
    angle: 0,
    health: 100,
  },
  entities: [],
  map: [],
  discovered: [],
  totalEnemies: 0,
  hasKey: false,
  ammo: 48,
  score: 0,
  cleanSweepAwarded: false,
  muzzle: 0,
  damageFlash: 0,
  message: "LEVEL ONE",
  messageTimer: 0,
  lastTime: 0,
};

function preloadAssets(paths) {
  const entries = Object.entries(paths);
  return Promise.all(
    entries.map(([name, src]) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve([name, img]);
      img.onerror = () => reject(new Error(`Could not load ${src}`));
      img.src = src;
    })),
  ).then((loaded) => Object.fromEntries(loaded));
}

function prepareWeaponFrames(img) {
  const frames = [];

  for (let frame = 0; frame < WEAPON_SHEET.frames; frame += 1) {
    const col = frame % WEAPON_SHEET.columns;
    const row = Math.floor(frame / WEAPON_SHEET.columns);
    const sx = Math.round((col * img.width) / WEAPON_SHEET.columns);
    const sy = Math.round((row * img.height) / WEAPON_SHEET.rows);
    const sw = Math.round(((col + 1) * img.width) / WEAPON_SHEET.columns) - sx;
    const sh = Math.round(((row + 1) * img.height) / WEAPON_SHEET.rows) - sy;
    const frameCanvas = document.createElement("canvas");
    const frameCtx = frameCanvas.getContext("2d");

    frameCanvas.width = sw;
    frameCanvas.height = sh;
    frameCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    frames.push(frameCanvas);
  }

  return frames;
}

function prepareTextureData(img) {
  const textureCanvas = document.createElement("canvas");
  const textureCtx = textureCanvas.getContext("2d");

  textureCanvas.width = img.width;
  textureCanvas.height = img.height;
  textureCtx.drawImage(img, 0, 0);

  return {
    width: img.width,
    height: img.height,
    data: textureCtx.getImageData(0, 0, img.width, img.height).data,
  };
}

function setupGunshotAudio() {
  game.shotSound = new Audio(GUN_SHOT_SRC);
  game.shotSound.preload = "auto";
  game.shotSound.volume = 0.68;
}

function setupMusicAudio() {
  game.music = new Audio(MUSIC_SRC);
  game.music.loop = true;
  game.music.preload = "auto";
  game.music.volume = 0;
}

function setupSoundFxAudio() {
  game.sounds = Object.fromEntries(
    Object.entries(SOUND_FX).map(([name, config]) => {
      const sound = new Audio(config.src);
      sound.preload = "auto";
      sound.volume = config.volume;
      return [name, sound];
    }),
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function playGunshot() {
  if (!game.shotSound) return;

  const sound = game.shotSound.cloneNode();
  sound.volume = game.shotSound.volume;
  sound.currentTime = 0;

  const playback = sound.play();
  if (playback) {
    playback.catch(() => {});
  }
}

function playSoundFx(name, volumeScale = 1) {
  const baseSound = game.sounds[name];
  if (!baseSound) return null;

  const sound = baseSound.cloneNode();
  sound.volume = clamp(baseSound.volume * volumeScale, 0, 1);
  sound.currentTime = 0;

  const playback = sound.play();
  if (playback) {
    playback.catch(() => {});
  }

  return sound;
}

function cancelMusicFade() {
  if (game.musicFadeFrame !== null) {
    cancelAnimationFrame(game.musicFadeFrame);
    game.musicFadeFrame = null;
  }

  if (game.musicFadeTimeout !== null) {
    clearTimeout(game.musicFadeTimeout);
    game.musicFadeTimeout = null;
  }
}

function fadeMusicTo(targetVolume, seconds, options = {}) {
  if (!game.music) return;

  cancelMusicFade();

  if (options.playFirst) {
    const playback = game.music.play();
    if (playback) {
      playback.catch(() => {});
    }
  }

  const music = game.music;
  const startVolume = music.volume;
  const duration = Math.max(0, seconds * 1000);
  const startTime = performance.now();

  const step = (time) => {
    const progress = duration === 0 ? 1 : clamp((time - startTime) / duration, 0, 1);
    music.volume = startVolume + (targetVolume - startVolume) * progress;

    if (progress < 1) {
      game.musicFadeFrame = requestAnimationFrame(step);
      return;
    }

    music.volume = targetVolume;
    game.musicFadeFrame = null;

    if (options.pauseWhenDone) {
      music.pause();
    }
  };

  game.musicFadeFrame = requestAnimationFrame(step);
}

function effectiveMusicVolume() {
  return game.musicMuted ? 0 : game.musicVolume;
}

function syncMusicControls() {
  musicVolumeControl.value = Math.round(game.musicVolume * 100);
  musicMuteButton.classList.toggle("is-muted", game.musicMuted || game.musicVolume === 0);
  musicMuteButton.setAttribute("aria-label", game.musicMuted ? "Unmute music" : "Mute music");
  musicMuteButton.title = game.musicMuted ? "Unmute music" : "Mute music";
}

function applyMusicSettings() {
  syncMusicControls();

  if (!game.music) return;

  const targetVolume = effectiveMusicVolume();
  if (game.state === "playing" && !game.music.paused) {
    fadeMusicTo(targetVolume, 0.18);
  } else {
    game.music.volume = targetVolume;
  }
}

function playMusic() {
  fadeMusicTo(effectiveMusicVolume(), MUSIC_FADE_SECONDS, { playFirst: true });
}

function fadeOutMusic() {
  cancelMusicFade();
  game.musicFadeTimeout = setTimeout(() => {
    game.musicFadeTimeout = null;
    fadeMusicTo(0, MUSIC_FADE_SECONDS, { pauseWhenDone: true });
  }, MUSIC_END_FADE_DELAY_SECONDS * 1000);
}

function monsterSoundDelay() {
  return MONSTER_SOUND_MIN_DELAY + Math.random() * (MONSTER_SOUND_MAX_DELAY - MONSTER_SOUND_MIN_DELAY);
}

function monsterVolumeScale(enemy) {
  const dist = distance(game.player, enemy);
  return clamp(1 - dist / MONSTER_SOUND_MAX_DISTANCE, 0.08, 1);
}

function playMonsterSound(enemy) {
  const sound = playSoundFx("monster", monsterVolumeScale(enemy));
  if (!sound) return;

  enemy.monsterSound = sound;
  sound.addEventListener("ended", () => {
    if (enemy.monsterSound === sound) {
      enemy.monsterSound = null;
      enemy.monsterSoundDelay = monsterSoundDelay();
    }
  }, { once: true });
}

function stopMonsterSound(enemy) {
  if (!enemy.monsterSound) return;

  enemy.monsterSound.pause();
  enemy.monsterSound.currentTime = 0;
  enemy.monsterSound = null;
}

function stopAllMonsterSounds() {
  game.entities.forEach((entity) => {
    if (entity.type === "enemy") {
      stopMonsterSound(entity);
    }
  });
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  game.dpr = Math.min(window.devicePixelRatio || 1, 2);
  game.viewW = Math.max(1, Math.floor(rect.width));
  game.viewH = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(game.viewW * game.dpr);
  canvas.height = Math.floor(game.viewH * game.dpr);
  ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
  game.floorPattern = game.assets.floor ? ctx.createPattern(game.assets.floor, "repeat") : null;
}

function resizeMinimap() {
  const rect = minimapCanvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  minimapCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
  minimapCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createEnemy(x, y) {
  return {
    type: "enemy",
    x: x + 0.5,
    y: y + 0.5,
    hp: 70,
    alive: true,
    attackTimer: 0,
    hurtTimer: 0,
    monsterAlerted: false,
    monsterSound: null,
    monsterSoundDelay: 0,
  };
}

function shuffleInPlace(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
}

function isItemTile(x, y) {
  return game.entities.some((entity) => (
    entity.type !== "enemy" &&
    Math.floor(entity.x) === x &&
    Math.floor(entity.y) === y
  ));
}

function enemySpawnCells(minPlayerDistance) {
  const cells = [];

  for (let y = 0; y < game.map.length; y += 1) {
    for (let x = 0; x < game.map[y].length; x += 1) {
      if (game.map[y][x] !== ".") continue;
      if (isItemTile(x, y)) continue;

      const dist = Math.hypot(x + 0.5 - game.player.x, y + 0.5 - game.player.y);
      if (dist < minPlayerDistance) continue;

      cells.push({ x, y });
    }
  }

  return cells;
}

function spawnRandomEnemies(count) {
  const primaryCells = enemySpawnCells(3);
  const fallbackCells = enemySpawnCells(1.5);
  const cells = shuffleInPlace(primaryCells.length >= count ? primaryCells : fallbackCells);
  const selected = cells.slice(0, count);

  selected.forEach((cell) => {
    game.entities.push(createEnemy(cell.x, cell.y));
  });

  game.totalEnemies = selected.length;
}

function parseLevel() {
  game.map = LEVEL_ROWS.map((row) => row.split(""));
  game.entities = [];
  let enemyMarkers = 0;

  for (let y = 0; y < game.map.length; y += 1) {
    for (let x = 0; x < game.map[y].length; x += 1) {
      const cell = game.map[y][x];

      if (cell === "P") {
        game.player.x = x + 0.5;
        game.player.y = y + 0.5;
        game.player.angle = 0;
        game.map[y][x] = ".";
      }

      if (cell === "E") {
        enemyMarkers += 1;
        game.map[y][x] = ".";
      }

      if (cell === "K") {
        game.entities.push({ type: "key", x: x + 0.5, y: y + 0.5, picked: false });
        game.map[y][x] = ".";
      }

      if (cell === "M") {
        game.entities.push({ type: "medkit", x: x + 0.5, y: y + 0.5, picked: false });
        game.map[y][x] = ".";
      }

      if (cell === "X") {
        game.entities.push({ type: "exit", x: x + 0.5, y: y + 0.5, picked: false });
        game.map[y][x] = ".";
      }
    }
  }

  spawnRandomEnemies(enemyMarkers + EXTRA_RANDOM_ENEMIES);
  game.discovered = game.map.map((row) => row.map(() => false));
  revealMap();
}

function resetLevel() {
  parseLevel();
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
  game.player.health = 100;
  game.hasKey = false;
  game.ammo = 48;
  game.score = 0;
  game.cleanSweepAwarded = false;
  game.muzzle = 0;
  game.damageFlash = 0;
  game.message = "LEVEL ONE";
  game.messageTimer = 1.7;
}

function startLevel() {
  resetLevel();
  game.state = "playing";
  startScreen.classList.remove("is-active");
  endScreen.classList.remove("is-active");
  playMusic();
}

function finishLevel() {
  const clearedAllHostiles = livingEnemies() === 0;

  if (clearedAllHostiles && !game.cleanSweepAwarded) {
    game.score += ALL_HOSTILES_BONUS;
    game.cleanSweepAwarded = true;
  }

  stopAllMonsterSounds();
  fadeOutMusic();
  playSoundFx("complete");
  game.state = "won";
  endSubtitle.textContent = clearedAllHostiles
    ? `CLEAN SWEEP BONUS - SCORE ${game.score}`
    : `LEVEL ONE COMPLETE - SCORE ${game.score}`;
  endTitle.textContent = "Made By Consulting Joe";
  endScreen.classList.add("is-active");
}

function loseLevel() {
  stopAllMonsterSounds();
  fadeOutMusic();
  game.state = "lost";
  endSubtitle.textContent = "MISSION FAILED";
  endTitle.textContent = "TRY AGAIN";
  endScreen.classList.add("is-active");
}

function setMessage(text, seconds = 1.2) {
  game.message = text;
  game.messageTimer = seconds;
}

function getCell(x, y) {
  if (y < 0 || y >= game.map.length || x < 0 || x >= game.map[0].length) {
    return "#";
  }

  return game.map[y][x];
}

function isBlockingCell(x, y) {
  const cell = getCell(x, y);
  if (cell === "#") return true;
  if (cell === "D") return !game.hasKey;
  return false;
}

function isBlockingAt(x, y) {
  return isBlockingCell(Math.floor(x), Math.floor(y));
}

function canOccupy(x, y, radius = PLAYER_RADIUS) {
  return !(
    isBlockingAt(x - radius, y - radius) ||
    isBlockingAt(x + radius, y - radius) ||
    isBlockingAt(x - radius, y + radius) ||
    isBlockingAt(x + radius, y + radius)
  );
}

function moveActor(actor, dx, dy, radius = PLAYER_RADIUS) {
  if (canOccupy(actor.x + dx, actor.y, radius)) {
    actor.x += dx;
  }

  if (canOccupy(actor.x, actor.y + dy, radius)) {
    actor.y += dy;
  }
}

function angleDiff(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function distance(a, b, x2, y2) {
  const dx = (x2 ?? b.x) - a.x;
  const dy = (y2 ?? b.y) - a.y;
  return Math.hypot(dx, dy);
}

function hasLineOfSight(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist * 18));

  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (isBlockingAt(x1 + dx * t, y1 + dy * t)) {
      return false;
    }
  }

  return true;
}

function isEnemyVisibleToPlayer(enemy) {
  if (!enemy.alive) return false;

  const dx = enemy.x - game.player.x;
  const dy = enemy.y - game.player.y;
  const dist = Math.hypot(dx, dy);
  const targetAngle = Math.atan2(dy, dx);
  const visibleAngle = FOV * 0.58 + Math.min(0.16, 0.28 / Math.max(1, dist));

  return (
    dist <= MONSTER_SOUND_MAX_DISTANCE &&
    Math.abs(angleDiff(targetAngle, game.player.angle)) <= visibleAngle &&
    hasLineOfSight(game.player.x, game.player.y, enemy.x, enemy.y)
  );
}

function updateMonsterSounds(dt) {
  for (const enemy of game.entities) {
    if (enemy.type !== "enemy") continue;

    if (!enemy.alive) {
      stopMonsterSound(enemy);
      continue;
    }

    if (!enemy.monsterAlerted && isEnemyVisibleToPlayer(enemy)) {
      enemy.monsterAlerted = true;
      enemy.monsterSoundDelay = 0;
    }

    if (!enemy.monsterAlerted) continue;

    if (enemy.monsterSound) {
      const baseSound = game.sounds.monster;
      const baseVolume = baseSound ? baseSound.volume : SOUND_FX.monster.volume;
      enemy.monsterSound.volume = clamp(baseVolume * monsterVolumeScale(enemy), 0, 1);
      continue;
    }

    enemy.monsterSoundDelay = Math.max(0, enemy.monsterSoundDelay - dt);
    if (enemy.monsterSoundDelay === 0) {
      playMonsterSound(enemy);
    }
  }
}

function isInBounds(x, y) {
  return y >= 0 && y < game.map.length && x >= 0 && x < game.map[0].length;
}

function markDiscovered(x, y) {
  if (!isInBounds(x, y)) return;
  if (getCell(x, y) === "#") return;
  game.discovered[y][x] = true;
}

function revealMap() {
  if (!game.discovered.length) return;

  markDiscovered(Math.floor(game.player.x), Math.floor(game.player.y));

  for (let i = 0; i < DISCOVERY_RAYS; i += 1) {
    const t = DISCOVERY_RAYS === 1 ? 0.5 : i / (DISCOVERY_RAYS - 1);
    const angle = game.player.angle - FOV * 0.72 + FOV * 1.44 * t;
    const rayX = Math.cos(angle);
    const rayY = Math.sin(angle);

    for (let dist = 0; dist <= DISCOVERY_DISTANCE; dist += 0.09) {
      const x = Math.floor(game.player.x + rayX * dist);
      const y = Math.floor(game.player.y + rayY * dist);

      if (!isInBounds(x, y)) break;
      if (getCell(x, y) === "#") break;

      markDiscovered(x, y);

      if (isBlockingCell(x, y)) break;
    }
  }
}

function livingEnemies() {
  return game.entities.filter((entity) => entity.type === "enemy" && entity.alive).length;
}

function pickupItems() {
  for (const entity of game.entities) {
    if (entity.picked) continue;

    const dist = distance(game.player, entity);
    if (entity.type === "key" && dist < 0.62) {
      entity.picked = true;
      game.hasKey = true;
      playSoundFx("key");
      setMessage("KEY SECURED", 1.5);
    }

    if (entity.type === "medkit" && dist < 0.62 && game.player.health < 100) {
      entity.picked = true;
      game.player.health = Math.min(100, game.player.health + 35);
      setMessage("HEALTH RESTORED", 1.3);
    }

    if (entity.type === "exit" && dist < 0.72) {
      if (game.hasKey) {
        finishLevel();
      } else if (!game.hasKey) {
        setMessage("KEY REQUIRED", 0.7);
      }
    }
  }
}

function fireWeapon() {
  if (game.state !== "playing") return;
  if (game.muzzle > 0.02) return;

  if (game.ammo <= 0) {
    setMessage("EMPTY", 0.75);
    game.muzzle = 0.06;
    return;
  }

  game.ammo -= 1;
  game.muzzle = WEAPON_SHEET.animationSeconds;
  playGunshot();

  let best = null;
  for (const enemy of game.entities) {
    if (enemy.type !== "enemy" || !enemy.alive) continue;

    const dx = enemy.x - game.player.x;
    const dy = enemy.y - game.player.y;
    const dist = Math.hypot(dx, dy);
    const targetAngle = Math.atan2(dy, dx);
    const aim = Math.abs(angleDiff(targetAngle, game.player.angle));
    const hitWindow = Math.max(0.075, 0.22 - dist * 0.014);

    if (dist < 8.5 && aim < hitWindow && hasLineOfSight(game.player.x, game.player.y, enemy.x, enemy.y)) {
      if (!best || dist < best.dist) {
        best = { enemy, dist };
      }
    }
  }

  if (best) {
    best.enemy.hp -= 38;
    best.enemy.hurtTimer = 0.18;
    setMessage("HIT", 0.35);

    if (best.enemy.hp <= 0) {
      best.enemy.alive = false;
      stopMonsterSound(best.enemy);
      playSoundFx("monsterDies");
      game.score += ENEMY_KILL_POINTS;
      setMessage(livingEnemies() === 0 ? "ALL HOSTILES DOWN" : "BONUS +100", 1);
    }
  }
}

function updatePlayer(dt) {
  if (keys.left) game.player.angle -= TURN_SPEED * dt;
  if (keys.right) game.player.angle += TURN_SPEED * dt;

  let move = 0;
  if (keys.forward) move += 1;
  if (keys.backward) move -= 1;

  if (move !== 0) {
    const speed = MOVE_SPEED * dt * move;
    moveActor(
      game.player,
      Math.cos(game.player.angle) * speed,
      Math.sin(game.player.angle) * speed,
      PLAYER_RADIUS,
    );
  }

  if (keys.fire) {
    fireWeapon();
  }
}

function updateEnemies(dt) {
  for (const enemy of game.entities) {
    if (enemy.type !== "enemy" || !enemy.alive) continue;

    enemy.attackTimer = Math.max(0, enemy.attackTimer - dt);
    enemy.hurtTimer = Math.max(0, enemy.hurtTimer - dt);

    const dx = game.player.x - enemy.x;
    const dy = game.player.y - enemy.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 6.5 && hasLineOfSight(enemy.x, enemy.y, game.player.x, game.player.y)) {
      if (dist > 0.82) {
        const speed = (enemy.hurtTimer > 0 ? 0.28 : 0.72) * dt;
        moveActor(enemy, (dx / dist) * speed, (dy / dist) * speed, 0.22);
      } else if (enemy.attackTimer === 0) {
        game.player.health = Math.max(0, game.player.health - 12);
        game.damageFlash = 0.28;
        enemy.attackTimer = 0.82;
        playSoundFx("punch");
        setMessage("DAMAGE", 0.45);

        if (game.player.health <= 0) {
          loseLevel();
        }
      }
    }
  }
}

function update(dt) {
  if (game.state !== "playing") return;

  updatePlayer(dt);
  revealMap();
  updateEnemies(dt);
  updateMonsterSounds(dt);
  pickupItems();

  game.muzzle = Math.max(0, game.muzzle - dt);
  game.damageFlash = Math.max(0, game.damageFlash - dt);
  game.messageTimer = Math.max(0, game.messageTimer - dt);
}

function castRay(rayDirX, rayDirY) {
  let mapX = Math.floor(game.player.x);
  let mapY = Math.floor(game.player.y);

  const deltaDistX = rayDirX === 0 ? Infinity : Math.abs(1 / rayDirX);
  const deltaDistY = rayDirY === 0 ? Infinity : Math.abs(1 / rayDirY);

  let stepX;
  let stepY;
  let sideDistX;
  let sideDistY;

  if (rayDirX < 0) {
    stepX = -1;
    sideDistX = (game.player.x - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1 - game.player.x) * deltaDistX;
  }

  if (rayDirY < 0) {
    stepY = -1;
    sideDistY = (game.player.y - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1 - game.player.y) * deltaDistY;
  }

  let side = 0;
  let hit = false;
  let steps = 0;

  while (!hit && steps < 96) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }

    hit = isBlockingCell(mapX, mapY);
    steps += 1;
  }

  const rawDist = side === 0
    ? (mapX - game.player.x + (1 - stepX) / 2) / rayDirX
    : (mapY - game.player.y + (1 - stepY) / 2) / rayDirY;

  const perpDist = Math.max(0.001, rawDist);
  const wallX = side === 0
    ? game.player.y + perpDist * rayDirY
    : game.player.x + perpDist * rayDirX;

  return {
    dist: perpDist,
    side,
    wallX: wallX - Math.floor(wallX),
    cell: getCell(mapX, mapY),
    rayDirX,
    rayDirY,
  };
}

function floorDrawBuffer(width, height) {
  if (
    !game.floorBuffer ||
    game.floorBuffer.width !== width ||
    game.floorBuffer.height !== height
  ) {
    const bufferCanvas = document.createElement("canvas");
    const bufferCtx = bufferCanvas.getContext("2d");

    bufferCanvas.width = width;
    bufferCanvas.height = height;

    game.floorBuffer = {
      width,
      height,
      canvas: bufferCanvas,
      context: bufferCtx,
      imageData: ctx.createImageData(width, height),
    };
  }

  return game.floorBuffer.imageData;
}

function drawPerspectiveFloor(startY, dirX, dirY, planeX, planeY) {
  if (!game.floorTexture || startY >= game.viewH) return;

  const w = game.viewW;
  const h = game.viewH;
  const floorH = h - startY;
  const buffer = floorDrawBuffer(w, floorH);
  const out = buffer.data;
  const texture = game.floorTexture;
  const texW = texture.width;
  const texH = texture.height;
  const texData = texture.data;
  const rayDirX0 = dirX - planeX;
  const rayDirY0 = dirY - planeY;
  const rayDirX1 = dirX + planeX;
  const rayDirY1 = dirY + planeY;
  const cameraHeight = h * 0.48;
  const projectionCenter = h * 0.5;

  for (let screenY = startY; screenY < h; screenY += 1) {
    const row = screenY - startY;
    const p = Math.max(1, screenY - projectionCenter);
    const rowDistance = cameraHeight / p;
    const stepX = (rowDistance * (rayDirX1 - rayDirX0)) / w;
    const stepY = (rowDistance * (rayDirY1 - rayDirY0)) / w;
    let floorX = game.player.x + rowDistance * rayDirX0;
    let floorY = game.player.y + rowDistance * rayDirY0;
    const shade = Math.max(0.2, 1 - rowDistance / 8.5);

    for (let x = 0; x < w; x += 1) {
      const tx = (Math.floor((floorX - Math.floor(floorX)) * texW) + texW) % texW;
      const ty = (Math.floor((floorY - Math.floor(floorY)) * texH) + texH) % texH;
      const source = (ty * texW + tx) * 4;
      const target = (row * w + x) * 4;

      out[target] = texData[source] * shade;
      out[target + 1] = texData[source + 1] * shade;
      out[target + 2] = texData[source + 2] * shade;
      out[target + 3] = 255;

      floorX += stepX;
      floorY += stepY;
    }
  }

  game.floorBuffer.context.putImageData(buffer, 0, 0);
  ctx.drawImage(game.floorBuffer.canvas, 0, startY, w, floorH);
}

function drawWorld() {
  const w = game.viewW;
  const h = game.viewH;
  const horizon = Math.floor(h * 0.49);
  const dirX = Math.cos(game.player.angle);
  const dirY = Math.sin(game.player.angle);
  const planeScale = Math.tan(FOV / 2);
  const planeX = -dirY * planeScale;
  const planeY = dirX * planeScale;
  const floorStart = Math.max(horizon, Math.floor(h / 2) + 1);

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#171516");
  sky.addColorStop(0.6, "#3a2220");
  sky.addColorStop(1, "#151111");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  ctx.fillStyle = "#22211f";
  ctx.fillRect(0, horizon, w, h - horizon);
  drawPerspectiveFloor(floorStart, dirX, dirY, planeX, planeY);

  const floorShade = ctx.createLinearGradient(0, horizon, 0, h);
  floorShade.addColorStop(0, "rgba(20, 12, 10, 0.18)");
  floorShade.addColorStop(1, "rgba(0, 0, 0, 0.76)");
  ctx.fillStyle = floorShade;
  ctx.fillRect(0, horizon, w, h - horizon);

  const rayStep = Math.max(1, Math.ceil(w / 620));

  game.zBuffer = new Array(w).fill(Infinity);

  for (let x = 0; x < w; x += rayStep) {
    const cameraX = (2 * x) / w - 1;
    const rayDirX = dirX + planeX * cameraX;
    const rayDirY = dirY + planeY * cameraX;
    const hit = castRay(rayDirX, rayDirY);

    const lineHeight = Math.min(h * 2.5, h / hit.dist);
    const drawStart = Math.floor(-lineHeight / 2 + h / 2);
    const drawEnd = Math.floor(lineHeight / 2 + h / 2);
    const tex = hit.cell === "D" ? game.assets.door : game.assets.wall;

    let texX = Math.floor(hit.wallX * tex.width);
    if (hit.side === 0 && hit.rayDirX > 0) texX = tex.width - texX - 1;
    if (hit.side === 1 && hit.rayDirY < 0) texX = tex.width - texX - 1;

    ctx.drawImage(tex, texX, 0, 1, tex.height, x, drawStart, rayStep + 1, lineHeight);

    const shade = Math.min(0.8, hit.dist / 8 + (hit.side ? 0.12 : 0));
    ctx.fillStyle = `rgba(0, 0, 0, ${shade})`;
    ctx.fillRect(x, drawStart, rayStep + 1, lineHeight);

    for (let i = x; i < x + rayStep + 1 && i < w; i += 1) {
      game.zBuffer[i] = hit.dist;
    }
  }
}

function spriteDefinition(entity) {
  if (entity.type === "enemy") {
    return { img: game.assets.enemy, scale: 0.92, yOffset: 0.08, alpha: entity.hurtTimer > 0 ? 0.62 : 1 };
  }

  if (entity.type === "key") {
    return { img: game.assets.key, scale: 0.34, yOffset: 0.26, alpha: 1 };
  }

  if (entity.type === "medkit") {
    return { img: game.assets.medkit, scale: 0.35, yOffset: 0.26, alpha: 1 };
  }

  return { img: game.assets.exit, scale: 0.72 + Math.sin(performance.now() / 180) * 0.03, yOffset: 0.04, alpha: 0.92 };
}

function visibleSprites() {
  return game.entities
    .filter((entity) => {
      if (entity.type === "enemy") return entity.alive;
      if (entity.type === "exit") return true;
      return !entity.picked;
    })
    .map((entity) => ({
      entity,
      dist: Math.hypot(entity.x - game.player.x, entity.y - game.player.y),
    }))
    .sort((a, b) => b.dist - a.dist);
}

function drawSprites() {
  const w = game.viewW;
  const h = game.viewH;
  const dirX = Math.cos(game.player.angle);
  const dirY = Math.sin(game.player.angle);
  const planeScale = Math.tan(FOV / 2);
  const planeX = -dirY * planeScale;
  const planeY = dirX * planeScale;
  const invDet = 1 / (planeX * dirY - dirX * planeY);

  for (const item of visibleSprites()) {
    const entity = item.entity;
    const def = spriteDefinition(entity);
    const spriteX = entity.x - game.player.x;
    const spriteY = entity.y - game.player.y;
    const transformX = invDet * (dirY * spriteX - dirX * spriteY);
    const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

    if (transformY <= 0.05) continue;

    const spriteScreenX = Math.floor((w / 2) * (1 + transformX / transformY));
    const spriteHeight = Math.abs(Math.floor((h / transformY) * def.scale));
    const spriteWidth = Math.floor(spriteHeight * (def.img.width / def.img.height));
    const drawStartY = Math.floor(h / 2 - spriteHeight / 2 + spriteHeight * def.yOffset);
    const drawStartX = Math.floor(spriteScreenX - spriteWidth / 2);
    const drawEndX = drawStartX + spriteWidth;
    const stripeStep = Math.max(1, Math.ceil(spriteWidth / def.img.width));

    ctx.save();
    ctx.globalAlpha = def.alpha;

    for (let stripe = drawStartX; stripe < drawEndX; stripe += stripeStep) {
      if (stripe < 0 || stripe >= w) continue;
      if (transformY >= game.zBuffer[Math.floor(stripe)]) continue;

      const texX = Math.floor(((stripe - drawStartX) / spriteWidth) * def.img.width);
      ctx.drawImage(def.img, texX, 0, 1, def.img.height, stripe, drawStartY, stripeStep, spriteHeight);
    }

    ctx.restore();
  }
}

function drawWeapon() {
  const w = game.viewW;
  const h = game.viewH;
  const progress = game.muzzle > 0 ? 1 - game.muzzle / WEAPON_SHEET.animationSeconds : 0;
  const sequenceIndex = Math.min(
    WEAPON_SHEET.animationFrames.length - 1,
    Math.floor(progress * WEAPON_SHEET.animationFrames.length),
  );
  const frameIndex = game.muzzle > 0
    ? WEAPON_SHEET.animationFrames[sequenceIndex]
    : WEAPON_SHEET.idleFrame;
  const img = game.weaponFrames[frameIndex] || game.assets.weapon;
  const weaponW = Math.min(520, w * 0.85);
  const weaponH = weaponW * (img.height / img.width);
  const x = (w - weaponW) / 2;
  const y = h - weaponH + Math.min(72, h * 0.1);

  ctx.drawImage(img, x, y, weaponW, weaponH);
}

function drawScreenEffects() {
  if (game.damageFlash > 0) {
    ctx.fillStyle = `rgba(224, 24, 22, ${game.damageFlash * 0.72})`;
    ctx.fillRect(0, 0, game.viewW, game.viewH);
  }
}

function defaultStatus() {
  if (!game.hasKey) return "FIND KEY";
  if (livingEnemies() > 0) return "EXIT READY";
  return "ALL CLEAR";
}

function updateHud() {
  healthValue.textContent = Math.round(game.player.health);
  ammoValue.textContent = game.ammo;
  keyValue.textContent = game.hasKey ? "YES" : "NO";
  enemyValue.textContent = `${livingEnemies()}/${game.totalEnemies}`;
  scoreValue.textContent = game.score;
  statusText.textContent = game.messageTimer > 0 ? game.message : defaultStatus();
}

function hasDiscoveredNeighbor(x, y) {
  const offsets = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  return offsets.some(([dx, dy]) => {
    const nx = x + dx;
    const ny = y + dy;
    return isInBounds(nx, ny) && game.discovered[ny][nx];
  });
}

function drawMinimapEntity(entity, x, y, size) {
  if (entity.type === "enemy" && !entity.alive) return;
  if (entity.type !== "enemy" && entity.picked) return;

  const cellX = Math.floor(entity.x);
  const cellY = Math.floor(entity.y);
  if (!isInBounds(cellX, cellY) || !game.discovered[cellY][cellX]) return;

  if (entity.type === "enemy") minimapCtx.fillStyle = "#e04435";
  if (entity.type === "key") minimapCtx.fillStyle = "#f0b44d";
  if (entity.type === "medkit") minimapCtx.fillStyle = "#48e4ce";
  if (entity.type === "exit") minimapCtx.fillStyle = "#f7ead0";

  minimapCtx.beginPath();
  minimapCtx.arc(x + entity.x * size, y + entity.y * size, Math.max(2, size * 0.28), 0, Math.PI * 2);
  minimapCtx.fill();
}

function drawMinimapPlayer(x, y, size) {
  const px = x + game.player.x * size;
  const py = y + game.player.y * size;
  const angle = game.player.angle;
  const radius = Math.max(4, size * 0.55);

  minimapCtx.fillStyle = "#ffffff";
  minimapCtx.beginPath();
  minimapCtx.moveTo(px + Math.cos(angle) * radius, py + Math.sin(angle) * radius);
  minimapCtx.lineTo(px + Math.cos(angle + 2.45) * radius * 0.72, py + Math.sin(angle + 2.45) * radius * 0.72);
  minimapCtx.lineTo(px + Math.cos(angle - 2.45) * radius * 0.72, py + Math.sin(angle - 2.45) * radius * 0.72);
  minimapCtx.closePath();
  minimapCtx.fill();
}

function drawMinimap() {
  const rect = minimapCanvas.getBoundingClientRect();
  const w = Math.max(1, rect.width);
  const h = Math.max(1, rect.height);
  const rows = game.map.length;
  const cols = game.map[0]?.length || 1;
  const padding = 8;
  const size = Math.floor(Math.min((w - padding * 2) / cols, (h - padding * 2) / rows));
  const mapW = cols * size;
  const mapH = rows * size;
  const x = Math.floor((w - mapW) / 2);
  const y = Math.floor((h - mapH) / 2);

  minimapCtx.clearRect(0, 0, w, h);
  minimapCtx.fillStyle = "rgba(5, 6, 6, 0.74)";
  minimapCtx.fillRect(0, 0, w, h);

  if (!size || !game.discovered.length) return;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = getCell(col, row);
      const isDiscovered = game.discovered[row][col];
      const drawX = x + col * size;
      const drawY = y + row * size;

      if (isDiscovered) {
        minimapCtx.fillStyle = cell === "D" ? "rgba(240, 180, 77, 0.8)" : "rgba(72, 228, 206, 0.38)";
        minimapCtx.fillRect(drawX, drawY, Math.max(1, size - 1), Math.max(1, size - 1));
      } else if (cell === "#" && hasDiscoveredNeighbor(col, row)) {
        minimapCtx.fillStyle = "rgba(240, 180, 77, 0.22)";
        minimapCtx.fillRect(drawX, drawY, Math.max(1, size - 1), Math.max(1, size - 1));
      }
    }
  }

  game.entities.forEach((entity) => drawMinimapEntity(entity, x, y, size));
  drawMinimapPlayer(x, y, size);
}

function render() {
  ctx.clearRect(0, 0, game.viewW, game.viewH);
  drawWorld();
  drawSprites();
  drawWeapon();
  drawScreenEffects();
  updateHud();
  drawMinimap();
}

function loop(time) {
  const dt = Math.min(0.05, (time - game.lastTime) / 1000 || 0);
  game.lastTime = time;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function setKeyState(code, pressed) {
  if (code === "KeyW") keys.forward = pressed;
  if (code === "KeyS") keys.backward = pressed;
  if (code === "KeyA") keys.left = pressed;
  if (code === "KeyD") keys.right = pressed;
}

window.addEventListener("keydown", (event) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "Enter"].includes(event.code)) {
    event.preventDefault();
  }

  setKeyState(event.code, true);

  if (event.code === "Space") {
    fireWeapon();
  }

  if (event.code === "Enter" && game.state !== "playing") {
    startLevel();
  }
});

window.addEventListener("keyup", (event) => {
  setKeyState(event.code, false);
});

window.addEventListener("blur", () => {
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
});

canvas.addEventListener("pointerdown", () => {
  if (game.state === "playing") {
    fireWeapon();
  }
});

startButton.addEventListener("click", startLevel);
restartButton.addEventListener("click", startLevel);
musicMuteButton.addEventListener("click", () => {
  game.musicMuted = !game.musicMuted;
  applyMusicSettings();
});

musicVolumeControl.addEventListener("input", () => {
  game.musicVolume = Number(musicVolumeControl.value) / 100;
  if (game.musicVolume > 0) {
    game.musicMuted = false;
  }
  applyMusicSettings();
});

function configureTouchControls() {
  const shouldShow = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 760;
  document.body.classList.toggle("touch-controls", shouldShow);
}

function setupControlButtons() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    const action = button.dataset.action;

    const setPressed = (pressed) => {
      button.classList.toggle("is-pressed", pressed);
      if (action in keys) {
        keys[action] = pressed;
      }
    };

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.setPointerCapture(event.pointerId);
      setPressed(true);
      if (action === "fire") fireWeapon();
    });

    button.addEventListener("pointerup", (event) => {
      event.preventDefault();
      setPressed(false);
    });

    button.addEventListener("pointercancel", () => setPressed(false));
    button.addEventListener("lostpointercapture", () => setPressed(false));
  });
}

window.addEventListener("resize", () => {
  resizeCanvas();
  resizeMinimap();
  configureTouchControls();
});

preloadAssets(ASSET_PATHS)
  .then((assets) => {
    game.assets = assets;
    game.floorTexture = prepareTextureData(assets.floor);
    game.weaponFrames = prepareWeaponFrames(assets.weapon);
    setupGunshotAudio();
    setupMusicAudio();
    setupSoundFxAudio();
    syncMusicControls();
    resetLevel();
    resizeCanvas();
    resizeMinimap();
    configureTouchControls();
    setupControlButtons();
    requestAnimationFrame(loop);
  })
  .catch((error) => {
    statusText.textContent = "ASSET ERROR";
    console.error(error);
  });
