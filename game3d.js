import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

console.log("game3d.js loaded");

// =====================================================
// CONFIGURATION
// =====================================================
const MOVE_SPEED = 0.07;
const GRAVITY = -0.012;
const JUMP_FORCE = 0.22;
const MAX_FALL_SPEED = -0.30;

const SCALE = 0.01;
const LEVEL_HEIGHT = 500;
const PLATFORM_DEPTH = 2.5;

let levelMap = [];

// =====================================================
// AUDIO SYSTEM (Procedural Web Audio API)
// =====================================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let audioInitialized = false;

function initAudio() {
    if (!audioInitialized) {
        audioCtx.resume();
        audioInitialized = true;
    }
}

function playSound(type) {
    if (!audioInitialized) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'land') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'spike') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'enemy') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.setValueAtTime(1600, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'victory') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554, now + 0.1);
        osc.frequency.setValueAtTime(659, now + 0.2);
        osc.frequency.setValueAtTime(880, now + 0.3);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.8);
        osc.start(now); osc.stop(now + 0.8);
    } else if (type === 'fall') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 1.0);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 1.0);
        osc.start(now); osc.stop(now + 1.0);
    }
}


// =====================================================
// SCENE
// =====================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x263746);
scene.fog = new THREE.Fog(0x263746, 12, 32);

// =====================================================
// CAMERA
// =====================================================
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(3.2, 3.4, 9);
camera.lookAt(3.2, 1.3, 0);

let mapPlayerSpawn = { x: 0, y: 0 };

function setPlayerSpawnFromMap() {
    let spawnRow = -1;
    let spawnCol = -1;
    for (let row = 0; row < levelMap.length; row++) {
        const col = levelMap[row].indexOf("P");
        if (col !== -1) {
            spawnRow = row;
            spawnCol = col;
            break;
        }
    }
    if (spawnRow === -1) throw new Error("Player spawn (P) not found in level.txt");

    const spawnX = mapX(spawnCol) + TILE_SIZE / 2;
    const markerY = mapY(spawnRow);

    const supportPlatform = colliders.find(platform => {
        const insidePlatform = spawnX > platform.left && spawnX < platform.right;
        const correctHeight = Math.abs(platform.top - markerY) < 0.05;
        return insidePlatform && correctHeight;
    });
    if (!supportPlatform) throw new Error("No platform found beneath player spawn");

    const bounds = new THREE.Box3().setFromObject(player);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const playerHalfHeight = size.y / 2;

    const spawnY = supportPlatform.top + playerHalfHeight + 0.02;
    mapPlayerSpawn = { x: spawnX, y: spawnY };
    player.position.set(spawnX, spawnY, player.position.z);
    console.log("Player spawn:", mapPlayerSpawn);
}

const TILE_SIZE = 0.4;
const MAP_OFFSET_X = 0;
const MAP_OFFSET_Y = 0;
const MAP_DEPTH = 2.5;

function updateCamera() {
    const cameraOffsetX = 3.2;
    let targetX = player.position.x + cameraOffsetX;
    const minimumCameraX = 3.2;
    if (targetX < minimumCameraX) targetX = minimumCameraX;
    const maximumCameraX = 28.5;
    if (targetX > maximumCameraX) targetX = maximumCameraX;
    camera.position.x += (targetX - camera.position.x) * 0.08;
    const targetY = Math.max(3.4, player.position.y + 1.2);
    camera.position.y += (targetY - camera.position.y) * 0.06;
    camera.lookAt(camera.position.x, camera.position.y - 2.1, 0);
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x9fb4c7, 0.65);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xddeeff, 1.5);
directionalLight.position.set(10, 15, 8);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -25;
directionalLight.shadow.camera.right = 25;
directionalLight.shadow.camera.top = 15;
directionalLight.shadow.camera.bottom = -15;
directionalLight.shadow.bias = -0.001;
scene.add(directionalLight);

async function loadLevelMap() {
    const response = await fetch("level.txt");
    if (!response.ok) throw new Error(`Could not load level.txt: ${response.status}`);
    const text = await response.text();
    const lines = text.split("\n");
    const mapLines = lines.map(line => line.trimEnd()).filter(line => {
        const trimmed = line.trim();
        return (trimmed.length > 0 && !trimmed.startsWith(";"));
    });
    console.log("LEVEL MAP LOADED:");
    console.log(mapLines.join("\n"));
    return mapLines;
}

const spikes = [
    { x: 1080, y: 400, width: 100, height: 30, count: 5 },
    { x: 2290, y: 400, width: 80, height: 30, count: 4 },
    { x: 2600, y: 460, width: 480, height: 40, count: 12 }
];

const enemies = [
    { type: "ground", x: 1240, y: 390, width: 40, height: 40, minX: 1210, maxX: 1340, speed: 0.02, direction: 1 },
    { type: "flying", x: 2070, y: 315, width: 40, height: 40, minX: 2010, maxX: 2200, speed: 0.018, direction: 1 }
];

const coinData = { x: 1840, y: 360, radius: 25 };
let coinCollected = false;
let coinStartY = 0;

const ropeData = {
    x: 1840,
    topY: 205,
    bottomY: 450,
    grabDistance: 32
};
let onRope = false;
const CLIMB_SPEED = 0.04;

const goalData = { x: 3120, y: 260, width: 30, height: 50 };
let levelCompleted = false;

function tryGrabRope() {
    if (onRope) return;
    const ropeX = convertX(ropeData.x);
    const ropeTop = convertY(ropeData.topY);
    const ropeBottom = convertY(ropeData.bottomY);
    const horizontalDistance = Math.abs(player.position.x - ropeX);
    const grabDistance = ropeData.grabDistance * SCALE;
    const insideVerticalArea = player.position.y <= ropeTop && player.position.y >= ropeBottom;

    if (horizontalDistance <= grabDistance && insideVerticalArea) {
        console.log("ROPE GRABBED");
        onRope = true;
        grounded = false;
        velocityY = 0;
        player.position.x = ropeX;
    }
}

function releaseRope() {
    onRope = false;
    velocityY = JUMP_FORCE * 0.75;
    if (keys["KeyD"] || keys["ArrowRight"]) player.position.x += 0.08;
    if (keys["KeyA"] || keys["ArrowLeft"]) player.position.x -= 0.08;
}

function updateCoin() {
    if (coinCollected) return;
    coinData.mesh.rotation.y += 0.03;
    coinData.mesh.position.y = coinStartY + Math.sin(Date.now() * 0.003) * 0.15;
}

function checkCoinCollision() {
    if (coinCollected) return;
    const playerHalfWidth = playerData.width * SCALE / 2;
    const playerHalfHeight = playerData.height * SCALE / 2;
    const coinX = convertX(coinData.x);
    const coinY = convertY(coinData.y);
    const horizontalDistance = Math.abs(player.position.x - coinX);
    const verticalDistance = Math.abs(player.position.y - coinY);
    const coinRadius = coinData.radius * SCALE;

    if (horizontalDistance < playerHalfWidth + coinRadius && verticalDistance < playerHalfHeight + coinRadius) {
        coinCollected = true;
        coinData.mesh.visible = false;
        playSound('coin');
        console.log("Optional coin collected!");
    }
}

const dirtMaterial = new THREE.MeshStandardMaterial({ color: 0x4f5559 });
const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x5a6266 });
const spikeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.1, emissive: 0x555555 });
const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xc1121f });
const enemyEyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const coinMaterial = new THREE.MeshStandardMaterial({ color: 0xffee00, metalness: 1.0, roughness: 0.1, emissive: 0x997700 });
const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 });
const ropeHandleMaterial = new THREE.MeshStandardMaterial({ color: 0xc59a45, metalness: 0.25, roughness: 0.6 });
const goalPoleMaterial = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.5, roughness: 0.4 });
const goalFlagMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc00, side: THREE.DoubleSide });
const mapPlatformMaterial = new THREE.MeshStandardMaterial({ color: 0x5c6368, roughness: 1 });

const caveWallMaterial = new THREE.MeshStandardMaterial({ color: 0x424b50, roughness: 1 });
const farRockMaterial = new THREE.MeshStandardMaterial({ color: 0x343d42, roughness: 1 });
const nearRockMaterial = new THREE.MeshStandardMaterial({ color: 0x596268, roughness: 1 });
const stalactiteMaterial = new THREE.MeshStandardMaterial({ color: 0x4b555a, roughness: 1 });

function createCaveWall() {
    const geometry = new THREE.BoxGeometry(40, 8, 0.8);
    const wall = new THREE.Mesh(geometry, caveWallMaterial);
    wall.position.set(16, 2.2, -6);
    scene.add(wall);
}

function createBackgroundRocks() {
    const rockData = [
        { x: -1, y: 1.4, z: -4.5, sx: 2.5, sy: 3.2, sz: 1.5 },
        { x: 3, y: 1.7, z: -4.7, sx: 2.2, sy: 4, sz: 1.4 },
        { x: 7, y: 1.3, z: -4.2, sx: 2.8, sy: 3, sz: 1.6 },
        { x: 11, y: 1.9, z: -4.8, sx: 2.4, sy: 4.5, sz: 1.5 },
        { x: 15, y: 1.4, z: -4.3, sx: 2.7, sy: 3.4, sz: 1.5 },
        { x: 19, y: 1.8, z: -4.8, sx: 2.3, sy: 4.2, sz: 1.7 },
        { x: 23, y: 1.2, z: -4.4, sx: 2.8, sy: 3.3, sz: 1.5 },
        { x: 27, y: 1.8, z: -4.7, sx: 2.2, sy: 4.3, sz: 1.6 },
        { x: 31, y: 1.5, z: -4.3, sx: 2.6, sy: 3.5, sz: 1.7 },
        { x: 35, y: 1.8, z: -4.8, sx: 2.5, sy: 4, sz: 1.5 }
    ];
    for (let i = 0; i < rockData.length; i++) {
        const data = rockData[i];
        const geometry = new THREE.IcosahedronGeometry(1, 0);
        const material = i % 2 === 0 ? farRockMaterial : nearRockMaterial;
        const rock = new THREE.Mesh(geometry, material);
        rock.position.set(data.x, data.y, data.z);
        rock.scale.set(data.sx, data.sy, data.sz);
        rock.rotation.z = (i % 3 - 1) * 0.15;
        scene.add(rock);
    }
}

function createStalactites() {
    const positions = [1.5, 4.5, 8, 11.5, 15, 18, 21.5, 25, 28, 31];
    positions.forEach((x, index) => {
        const height = 0.8 + (index % 3) * 0.3;
        const geometry = new THREE.ConeGeometry(0.28, height, 6);
        const stalactite = new THREE.Mesh(geometry, stalactiteMaterial);
        stalactite.rotation.z = Math.PI;
        stalactite.position.set(x, 5.1, -3.2);
        scene.add(stalactite);
    });
}

function createMidgroundRocks() {
    const positions = [
        { x: 5, y: 0.6, z: -2.8, scale: 0.8 },
        { x: 10, y: 0.8, z: -3, scale: 1 },
        { x: 16, y: 0.7, z: -2.7, scale: 0.9 },
        { x: 22, y: 0.9, z: -3, scale: 1.1 },
        { x: 28, y: 0.7, z: -2.8, scale: 0.9 }
    ];
    positions.forEach(data => {
        const geometry = new THREE.DodecahedronGeometry(1, 0);
        const rock = new THREE.Mesh(geometry, nearRockMaterial);
        rock.position.set(data.x, data.y, data.z);
        rock.scale.set(data.scale, data.scale * 1.4, data.scale);
        scene.add(rock);
    });
}

function convertX(x) { return x * SCALE; }
function convertY(y) { return (LEVEL_HEIGHT - y) * SCALE; }

let colliders = [];
const spikeColliders = spikes.map(spike => ({
    left: spike.x * SCALE,
    right: (spike.x + spike.width) * SCALE,
    bottom: convertY(spike.y + spike.height),
    top: convertY(spike.y)
}));

function checkSpikeCollision() {
    const halfWidth = playerData.width * SCALE / 2;
    const halfHeight = playerData.height * SCALE / 2;
    const playerLeft = player.position.x - halfWidth;
    const playerRight = player.position.x + halfWidth;
    const playerBottom = player.position.y - halfHeight;
    const playerTop = player.position.y + halfHeight;
    for (const spike of spikeColliders) {
        const collision = playerRight > spike.left && playerLeft < spike.right && playerTop > spike.bottom && playerBottom < spike.top;
        if (collision) {
            playSound('spike');
            resetPlayer();
            return;
        }
    }
}

function createPlatform(data) {
    const width = data.width * SCALE;
    const height = data.height * SCALE;
    const centerX = convertX(data.x + data.width / 2);
    const centerY = convertY(data.y + data.height / 2);

    const geometry = new THREE.BoxGeometry(width, height, PLATFORM_DEPTH);
    const platform = new THREE.Mesh(geometry, dirtMaterial);
    platform.position.set(centerX, centerY, 0);
    platform.castShadow = true;
    platform.receiveShadow = true;
    scene.add(platform);

    const grassHeight = 0.08;
    const grassGeometry = new THREE.BoxGeometry(width, grassHeight, PLATFORM_DEPTH + 0.03);
    const grass = new THREE.Mesh(grassGeometry, grassMaterial);
    const platformTop = convertY(data.y);
    grass.position.set(centerX, platformTop + grassHeight / 2, 0);
    grass.castShadow = true;
    grass.receiveShadow = true;
    scene.add(grass);
}

function createSpikeGroup(data) {
    const group = new THREE.Group();
    const spikeWidth2D = data.width / data.count;
    const spikeWidth3D = spikeWidth2D * SCALE;
    const spikeHeight3D = data.height * SCALE;

    // Tres filas de profundidad en el eje Z para dar volumen
    const zOffsets = [-0.35, 0, 0.35];

    for (let i = 0; i < data.count; i++) {
        const spikeCenterX = data.x + spikeWidth2D * i + spikeWidth2D / 2;
        
        for (const zOffset of zOffsets) {
            const geometry = new THREE.ConeGeometry(spikeWidth3D / 1.4, spikeHeight3D, 8);
            const spike = new THREE.Mesh(geometry, spikeMaterial);
            spike.position.set(convertX(spikeCenterX), convertY(data.y) - spikeHeight3D / 2, zOffset);
            
            // Rotación aleatoria para que se vean más orgánicos
            spike.rotation.y = Math.random() * Math.PI;
            
            spike.castShadow = true;
            spike.receiveShadow = true;
            group.add(spike);
        }
    }
    scene.add(group);
}

function createEnemy(data) {
    const group = new THREE.Group();
    const bodyGeometry = new THREE.BoxGeometry(data.width * SCALE, data.height * SCALE, 0.6);
    const body = new THREE.Mesh(bodyGeometry, enemyMaterial);
    group.add(body);

    const eyeGeometry = new THREE.BoxGeometry(0.07, 0.07, 0.03);
    const leftEye = new THREE.Mesh(eyeGeometry, enemyEyeMaterial);
    leftEye.position.set(-0.10, 0.07, 0.315);
    const rightEye = new THREE.Mesh(eyeGeometry, enemyEyeMaterial);
    rightEye.position.set(0.10, 0.07, 0.315);
    group.add(leftEye);
    group.add(rightEye);

    if (data.type === "flying") {
        const wingMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e0e0 });
        const wingGeometry = new THREE.BoxGeometry(0.22, 0.06, 0.35);
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-0.30, 0.08, 0);
        leftWing.rotation.z = -0.35;
        group.add(leftWing);
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(0.30, 0.08, 0);
        rightWing.rotation.z = 0.35;
        group.add(rightWing);
    }

    group.position.set(convertX(data.x + data.width / 2), convertY(data.y + data.height / 2), 0);
    group.traverse(child => { if(child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    scene.add(group);
    data.mesh = group;
    data.startX = data.x;
    data.startDirection = data.direction;
}

function createCoin() {
    const radius = coinData.radius * SCALE;
    const geometry = new THREE.CylinderGeometry(radius, radius, 0.06, 32);
    const coin = new THREE.Mesh(geometry, coinMaterial);
    coin.rotation.x = Math.PI / 2;
    coin.position.set(convertX(coinData.x), convertY(coinData.y), 0);
    coinData.mesh = coin;
    coinStartY = coin.position.y;
    coin.castShadow = true;
    scene.add(coin);
    
    const coinLight = new THREE.PointLight(0xffee00, 1.5, 3);
    coinLight.position.set(0, 0, 0.2);
    coin.add(coinLight);
}

function createRope() {
    const ropeX = convertX(ropeData.x);
    const topY = convertY(ropeData.topY);
    const bottomY = convertY(ropeData.bottomY);
    const ropeHeight = topY - bottomY;
    const centerY = (topY + bottomY) / 2;

    const ropeGeometry = new THREE.CylinderGeometry(0.025, 0.025, ropeHeight, 12);
    const rope = new THREE.Mesh(ropeGeometry, ropeMaterial);
    rope.position.set(ropeX, centerY, 0);
    scene.add(rope);
    ropeData.mesh = rope;

    const anchorGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16);
    const anchor = new THREE.Mesh(anchorGeometry, ropeHandleMaterial);
    anchor.rotation.x = Math.PI / 2;
    anchor.position.set(ropeX, topY, 0);
    scene.add(anchor);

    const handleGeometry = new THREE.TorusGeometry(0.10, 0.025, 10, 24);
    const handle = new THREE.Mesh(handleGeometry, ropeHandleMaterial);
    handle.position.set(ropeX, bottomY, 0);
    scene.add(handle);
}

function createGoal() {
    const goalX = convertX(goalData.x);
    const goalY = convertY(goalData.y);
    const group = new THREE.Group();

    const ropeHeight = goalData.height * SCALE * 1.5;
    const ropeGeometry = new THREE.CylinderGeometry(0.06, 0.06, ropeHeight, 8);
    const rope = new THREE.Mesh(ropeGeometry, ropeMaterial);
    rope.position.y = ropeHeight / 2;
    rope.castShadow = true;
    rope.receiveShadow = true;
    group.add(rope);

    group.position.set(goalX, goalY, 0);
    scene.add(group);
    goalData.mesh = group;
}

function updateEnemies() {
    for (const enemy of enemies) {
        enemy.x += enemy.speed * enemy.direction / SCALE;
        if (enemy.x >= enemy.maxX) {
            enemy.x = enemy.maxX;
            enemy.direction = -1;
        }
        if (enemy.x <= enemy.minX) {
            enemy.x = enemy.minX;
            enemy.direction = 1;
        }
        enemy.mesh.position.x = convertX(enemy.x + enemy.width / 2);
        
        if (enemy.type === "flying") {
             enemy.mesh.position.y = convertY(enemy.y + enemy.height / 2) + Math.sin(Date.now() * 0.003 + enemy.startX) * 0.2;
        } else {
             enemy.mesh.position.y = convertY(enemy.y + enemy.height / 2);
        }
    }
}

function checkEnemyCollision() {
    const playerHalfWidth = playerData.width * SCALE / 2;
    const playerHalfHeight = playerData.height * SCALE / 2;
    const playerLeft = player.position.x - playerHalfWidth;
    const playerRight = player.position.x + playerHalfWidth;
    const playerBottom = player.position.y - playerHalfHeight;
    const playerTop = player.position.y + playerHalfHeight;

    for (const enemy of enemies) {
        const enemyLeft = enemy.x * SCALE;
        const enemyRight = (enemy.x + enemy.width) * SCALE;
        const enemyTop = convertY(enemy.y);
        const enemyBottom = convertY(enemy.y + enemy.height);
        const collision = playerRight > enemyLeft && playerLeft < enemyRight && playerTop > enemyBottom && playerBottom < enemyTop;
        if (collision) {
            playSound('spike');
            resetPlayer();
            return;
        }
    }
}

function checkGoalCollision() {
    if (levelCompleted) return;
    const halfWidth = playerData.width * SCALE / 2;
    const halfHeight = playerData.height * SCALE / 2;
    const playerLeft = player.position.x - halfWidth;
    const playerRight = player.position.x + halfWidth;
    const playerBottom = player.position.y - halfHeight;
    const playerTop = player.position.y + halfHeight;
    const goalLeft = convertX(goalData.x) - goalData.width * SCALE / 2;
    const goalRight = convertX(goalData.x) + goalData.width * SCALE / 2;
    const goalBottom = convertY(goalData.y);
    const goalTop = goalBottom + goalData.height * SCALE;

    const collision = playerRight > goalLeft && playerLeft < goalRight && playerTop > goalBottom && playerBottom < goalTop;
    if (collision) completeLevel();
}

function completeLevel() {
    levelCompleted = true;
    velocityY = 0;
    grounded = false;
    onRope = false;
    playSound('victory');
    console.log("LEVEL COMPLETE!");
    showVictoryMessage();
}

function showVictoryMessage() {
    const message = document.createElement("div");
    message.id = "victoryMessage";
    message.innerHTML = coinCollected
        ? `LEVEL COMPLETE!<br><br>⭐ Optional Coin Collected<br><br><span style="font-size: 16px; opacity: 0.8;">Press R to play again</span>`
        : `LEVEL COMPLETE!<br><br>Optional Coin: Not Collected<br><br><span style="font-size: 16px; opacity: 0.8;">Press R to play again</span>`;
    Object.assign(message.style, {
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        padding: "30px 50px", background: "rgba(0, 0, 0, 0.8)", color: "white",
        fontFamily: "Arial", fontSize: "28px", textAlign: "center",
        borderRadius: "12px", border: "3px solid white"
    });
    document.body.appendChild(message);
}

spikes.forEach(spikeGroup => createSpikeGroup(spikeGroup));
enemies.forEach(enemy => createEnemy(enemy));
createCoin();
createRope();
createGoal();

createCaveWall();
createBackgroundRocks();
createMidgroundRocks();
createStalactites();

const playerData = { x: 100, y: 385, width: 35, height: 45 };
const playerGeometry = new THREE.BoxGeometry(playerData.width * SCALE, playerData.height * SCALE, 0.5);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x3267e3 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(convertX(playerData.x + playerData.width / 2), convertY(playerData.y + playerData.height / 2), 0);
player.castShadow = true;
player.receiveShadow = true;
scene.add(player);

function resetPlayer() {
    player.position.set(mapPlayerSpawn.x, mapPlayerSpawn.y, 0);
    velocityY = 0;
    grounded = false;
    onRope = false;
    playerMaterial.color.set(0x3267e3);
    keys["KeyA"] = false; keys["KeyD"] = false; keys["KeyW"] = false; keys["KeyS"] = false;
    keys["ArrowLeft"] = false; keys["ArrowRight"] = false; keys["ArrowUp"] = false; keys["ArrowDown"] = false;
    camera.position.x = 3.2;

    for (const enemy of enemies) {
        enemy.x = enemy.startX;
        enemy.direction = enemy.startDirection;
        enemy.mesh.position.x = convertX(enemy.x + enemy.width / 2);
    }
    coinCollected = false;
    coinData.mesh.visible = true;
}

const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
function createEye(xOffset) {
    const geometry = new THREE.BoxGeometry(0.07, 0.07, 0.02);
    const eye = new THREE.Mesh(geometry, eyeMaterial);
    eye.position.set(xOffset, 0.08, 0.26);
    player.add(eye);
}
createEye(-0.09);
createEye(0.09);

const keys = {};
let velocityY = 0;
let grounded = false;
let wasGrounded = false;
let coyoteTimeCounter = 0;
let jumpBufferCounter = 0;
const JUMP_BUFFER_MAX = 8; // frames of forgiveness
const COYOTE_TIME_MAX = 8; // frames of forgiveness

function updatePlayer() {
    if (levelCompleted) return;

    if (onRope) {
        const halfHeight = playerData.height * SCALE / 2;
        const ropeTop = convertY(ropeData.topY);
        const ropeBottom = convertY(ropeData.bottomY);
        if (keys["KeyW"] || keys["ArrowUp"]) player.position.y += CLIMB_SPEED;
        if (keys["KeyS"] || keys["ArrowDown"]) player.position.y -= CLIMB_SPEED;
        player.position.x = convertX(ropeData.x);
        const maximumY = ropeTop - halfHeight;
        const minimumY = ropeBottom + halfHeight;
        if (player.position.y > maximumY) player.position.y = maximumY;
        if (player.position.y < minimumY) player.position.y = minimumY;
        velocityY = 0;
        grounded = false;
        return;
    }
    
    const halfWidth = playerData.width * SCALE / 2;
    const halfHeight = playerData.height * SCALE / 2;
    let movementX = 0;

    if (keys["KeyA"] || keys["ArrowLeft"]) movementX -= MOVE_SPEED;
    if (keys["KeyD"] || keys["ArrowRight"]) movementX += MOVE_SPEED;
    player.position.x += movementX;

    for (const platform of colliders) {
        const playerLeft = player.position.x - halfWidth;
        const playerRight = player.position.x + halfWidth;
        const playerBottom = player.position.y - halfHeight;
        const playerTop = player.position.y + halfHeight;
        const horizontalCollision = playerRight > platform.left && playerLeft < platform.right;
        const verticalCollision = playerTop > platform.bottom && playerBottom < platform.top;

        if (horizontalCollision && verticalCollision) {
            if (movementX > 0) player.position.x = platform.left - halfWidth;
            if (movementX < 0) player.position.x = platform.right + halfWidth;
        }
    }

    const previousBottom = player.position.y - halfHeight;
    const previousTop = player.position.y + halfHeight;
    velocityY += GRAVITY;
    if (velocityY < MAX_FALL_SPEED) velocityY = MAX_FALL_SPEED;
    player.position.y += velocityY;
    
    // Coyote Time logic
    if (grounded) {
        coyoteTimeCounter = COYOTE_TIME_MAX;
    } else {
        coyoteTimeCounter--;
    }
    grounded = false;

    for (const platform of colliders) {
        const playerLeft = player.position.x - halfWidth;
        const playerRight = player.position.x + halfWidth;
        const horizontalOverlap = playerRight > platform.left && playerLeft < platform.right;
        if (!horizontalOverlap) continue;

        const currentBottom = player.position.y - halfHeight;
        const currentTop = player.position.y + halfHeight;

        if (velocityY <= 0 && previousBottom >= platform.top && currentBottom <= platform.top) {
            player.position.y = platform.top + halfHeight;
            velocityY = 0;
            grounded = true;
            continue;
        }

        if (velocityY > 0 && previousTop <= platform.bottom && currentTop >= platform.bottom) {
            player.position.y = platform.bottom - halfHeight;
            velocityY = 0;
        }
    }

    if (player.position.x < halfWidth) player.position.x = halfWidth;
    if (player.position.y < -3) { playSound("fall"); resetPlayer(); }

    // Jump Buffer Logic
    if (jumpBufferCounter > 0) {
        jumpBufferCounter--;
        if (coyoteTimeCounter > 0) {
            velocityY = JUMP_FORCE;
            grounded = false;
            coyoteTimeCounter = 0; // Prevent double jump
            jumpBufferCounter = 0; // Consume the buffered jump
        }
    }

    if (!grounded && !onRope) {
        player.scale.set(0.9, 1.1, 1);
    } else if (Math.abs(movementX) > 0 && grounded) {
        player.scale.set(1 + Math.sin(Date.now() * 0.02) * 0.05, 1 + Math.abs(Math.cos(Date.now() * 0.02)) * 0.1, 1);
    } else {
        player.scale.set(1, 1, 1);
    }
    
    if (grounded && !wasGrounded) {
        playSound('land');
    }
    wasGrounded = grounded;
}

window.addEventListener("keydown", (event) => {
    initAudio();
    keys[event.code] = true;
    if (event.repeat) return;
    if (event.code === "KeyR") { restartLevel(); return; }

    if (event.code === "KeyW" || event.code === "ArrowUp") {
        if (onRope) return;
        if (!grounded) { tryGrabRope(); }
        // Set jump buffer instead of immediate check
        jumpBufferCounter = JUMP_BUFFER_MAX;
    }

    if (event.code === "Space") {
        if (onRope) { releaseRope(); return; }
        // Set jump buffer instead of immediate check
        jumpBufferCounter = JUMP_BUFFER_MAX;
    }
});

window.addEventListener("keyup", (event) => { keys[event.code] = false; });

function restartLevel() {
    const oldMessage = document.getElementById("victoryMessage");
    if (oldMessage) oldMessage.remove();

    levelCompleted = false;
    coinCollected = false;
    onRope = false;
    velocityY = 0;
    grounded = false;

    player.position.set(mapPlayerSpawn.x, mapPlayerSpawn.y, 0);
    coinData.mesh.visible = true;

    for (const enemy of enemies) {
        enemy.x = enemy.startX;
        enemy.direction = enemy.startDirection;
        enemy.mesh.position.x = convertX(enemy.x + enemy.width / 2);
    }

    for (const key in keys) keys[key] = false;
    camera.position.x = 3.2;
}

async function initGame() {
    try {
        levelMap = await loadLevelMap();
        createPlatformsFromTextMap();
        setPlayerSpawnFromMap();
        console.log("Text map ready!");
        animate();
    } catch (error) {
        console.error("Error loading level map:", error);
    }
}

function animate() {
    requestAnimationFrame(animate);
    updatePlayer();
    updateEnemies();
    updateCoin();
    checkSpikeCollision();
    checkEnemyCollision();
    checkCoinCollision();
    checkGoalCollision();
    updateCamera();
    renderer.render(scene, camera);
}

function mapX(col) { return MAP_OFFSET_X + col * TILE_SIZE; }
function mapY(row) { return MAP_OFFSET_Y + (levelMap.length - row - 1) * TILE_SIZE; }

let textMapPlatforms = [];

function createPlatformsFromTextMap() {
    textMapPlatforms = [];
    colliders = textMapPlatforms;

    for (let row = 0; row < levelMap.length; row++) {
        const line = levelMap[row];
        let col = 0;
        while (col < line.length) {
            if (line[col] !== "#") { col++; continue; }
            const startCol = col;
            while (col < line.length && line[col] === "#") col++;
            const endCol = col;
            const tileCount = endCol - startCol;
            createTextPlatform(row, startCol, tileCount);
        }
    }
}

function createTextPlatform(row, startCol, tileCount) {
    const width = tileCount * TILE_SIZE;
    const height = TILE_SIZE;
    const x = mapX(startCol) + width / 2;
    const y = mapY(row) + height / 2;

    const geometry = new THREE.BoxGeometry(width, height, MAP_DEPTH);
    const mesh = new THREE.Mesh(geometry, mapPlatformMaterial);
    mesh.position.set(x, y, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    textMapPlatforms.push({
        mesh,
        left: x - width / 2,
        right: x + width / 2,
        bottom: y - height / 2,
        top: y + height / 2,
        row, startCol, tileCount
    });
}

initGame();

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
