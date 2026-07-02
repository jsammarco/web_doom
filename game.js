const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const healthValue = document.getElementById("healthValue");
const ammoValue = document.getElementById("ammoValue");
const keyValue = document.getElementById("keyValue");
const enemyValue = document.getElementById("enemyValue");
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
  assets: {},
  weaponFrames: [],
  shotSound: null,
  player: {
    x: 1.5,
    y: 1.5,
    angle: 0,
    health: 100,
  },
  entities: [],
  map: [],
  hasKey: false,
  ammo: 48,
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

function setupGunshotAudio() {
  game.shotSound = new Audio(GUN_SHOT_SRC);
  game.shotSound.preload = "auto";
  game.shotSound.volume = 0.68;
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

function parseLevel() {
  game.map = LEVEL_ROWS.map((row) => row.split(""));
  game.entities = [];

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
        game.entities.push({
          type: "enemy",
          x: x + 0.5,
          y: y + 0.5,
          hp: 70,
          alive: true,
          attackTimer: 0,
          hurtTimer: 0,
        });
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
}

function resetLevel() {
  parseLevel();
  Object.keys(keys).forEach((key) => {
    keys[key] = false;
  });
  game.player.health = 100;
  game.hasKey = false;
  game.ammo = 48;
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
}

function finishLevel() {
  game.state = "won";
  endSubtitle.textContent = "LEVEL ONE COMPLETE";
  endTitle.textContent = "Made By Consulting Joe";
  endScreen.classList.add("is-active");
}

function loseLevel() {
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
      setMessage("KEY SECURED", 1.5);
    }

    if (entity.type === "medkit" && dist < 0.62 && game.player.health < 100) {
      entity.picked = true;
      game.player.health = Math.min(100, game.player.health + 35);
      setMessage("HEALTH RESTORED", 1.3);
    }

    if (entity.type === "exit" && dist < 0.72) {
      if (game.hasKey && livingEnemies() === 0) {
        finishLevel();
      } else if (!game.hasKey) {
        setMessage("KEY REQUIRED", 0.7);
      } else {
        setMessage("CLEAR HOSTILES", 0.7);
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
      setMessage(livingEnemies() === 0 ? "EXIT OPEN" : "HOSTILE DOWN", 1);
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
  updateEnemies(dt);
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

function drawWorld() {
  const w = game.viewW;
  const h = game.viewH;
  const horizon = Math.floor(h * 0.49);

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#171516");
  sky.addColorStop(0.6, "#3a2220");
  sky.addColorStop(1, "#151111");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  ctx.fillStyle = game.floorPattern || "#22211f";
  ctx.fillRect(0, horizon, w, h - horizon);

  const floorShade = ctx.createLinearGradient(0, horizon, 0, h);
  floorShade.addColorStop(0, "rgba(20, 12, 10, 0.18)");
  floorShade.addColorStop(1, "rgba(0, 0, 0, 0.76)");
  ctx.fillStyle = floorShade;
  ctx.fillRect(0, horizon, w, h - horizon);

  const dirX = Math.cos(game.player.angle);
  const dirY = Math.sin(game.player.angle);
  const planeScale = Math.tan(FOV / 2);
  const planeX = -dirY * planeScale;
  const planeY = dirX * planeScale;
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
  if (livingEnemies() > 0) return "CLEAR HOSTILES";
  return "EXIT OPEN";
}

function updateHud() {
  healthValue.textContent = Math.round(game.player.health);
  ammoValue.textContent = game.ammo;
  keyValue.textContent = game.hasKey ? "YES" : "NO";
  enemyValue.textContent = livingEnemies();
  statusText.textContent = game.messageTimer > 0 ? game.message : defaultStatus();
}

function render() {
  ctx.clearRect(0, 0, game.viewW, game.viewH);
  drawWorld();
  drawSprites();
  drawWeapon();
  drawScreenEffects();
  updateHud();
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
  configureTouchControls();
});

preloadAssets(ASSET_PATHS)
  .then((assets) => {
    game.assets = assets;
    game.weaponFrames = prepareWeaponFrames(assets.weapon);
    setupGunshotAudio();
    resetLevel();
    resizeCanvas();
    configureTouchControls();
    setupControlButtons();
    requestAnimationFrame(loop);
  })
  .catch((error) => {
    statusText.textContent = "ASSET ERROR";
    console.error(error);
  });
