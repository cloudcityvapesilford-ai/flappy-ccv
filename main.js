const W = 360;  // base width (scales to screen)
const H = 640;  // base height

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a2234',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H
  },
  physics: { default: 'arcade', arcade: { gravity: { y: 900 }, debug: false } },
  scene: { preload, create, update }
};

let bird, pipes, scoreText, bestText, gameOverText, tapToStartText;
let started = false, gameOver = false, score = 0, best = 0;

new Phaser.Game(config);

function preload() {
  // Create simple textures at runtime (no image files)
  // Bird (circle)
  const g1 = this.make.graphics({ x: 0, y: 0, add: false });
  g1.fillStyle(0xffd166, 1).fillCircle(16, 16, 16);
  g1.fillStyle(0x2d3142, 1).fillCircle(10, 14, 3); // eye
  g1.fillStyle(0xe76f51, 1).fillTriangle(20,16, 34,12, 34,20); // beak
  g1.generateTexture('bird', 36, 32);

  // Pipe segment
  const g2 = this.make.graphics({ x: 0, y: 0, add: false });
  g2.fillStyle(0x2a9d8f, 1).fillRect(0, 0, 52, 400);
  g2.lineStyle(4, 0x1f776e, 1).strokeRect(0, 0, 52, 400);
  g2.generateTexture('pipe', 52, 400);

  // Pipe cap
  const g3 = this.make.graphics({ x: 0, y: 0, add: false });
  g3.fillStyle(0x2a9d8f, 1).fillRect(0, 0, 70, 26);
  g3.lineStyle(4, 0x1f776e, 1).strokeRect(0, 0, 70, 26);
  g3.generateTexture('cap', 70, 26);

  // Ground
  const g4 = this.make.graphics({ x: 0, y: 0, add: false });
  g4.fillStyle(0x0f1422, 1).fillRect(0, 0, W, 40);
  g4.generateTexture('ground', W, 40);

  // Load best score
  best = parseInt(localStorage.getItem('flappy_best') || '0', 10);
}

function create() {
  // Parallax-ish background bars
  this.add.rectangle(W/2, H/2, W, H, 0x14203a).setAlpha(0.6);
  this.add.rectangle(W/2, H/2, W, H, 0x10182c).setAlpha(0.4);

  // Ground collider
  const ground = this.physics.add.staticImage(W/2, H - 20, 'ground').setOrigin(0.5, 0.5);

  // Bird
  bird = this.physics.add.sprite(100, H/2, 'bird');
  bird.setCircle(16, 0, 0);
  bird.setCollideWorldBounds(true);
  bird.setGravityY(0); // enable only when started
  bird.body.allowRotation = true;

  // Pipes group
  pipes = this.physics.add.group({ allowGravity: false, immovable: true });

  // UI
  scoreText = this.add.text(W/2, 30, '0', { fontFamily: 'system-ui, sans-serif', fontSize: '42px', color: '#ffffff' }).setOrigin(0.5, 0.5);
  bestText  = this.add.text(W/2, 70, `Best: ${best}`, { fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#a8b3c7' }).setOrigin(0.5);
  gameOverText = this.add.text(W/2, H/2 - 30, 'Game Over', { fontFamily: 'system-ui, sans-serif', fontSize: '40px', color: '#ff7272' }).setOrigin(0.5).setVisible(false);
  tapToStartText = this.add.text(W/2, H/2 + 16, 'Tap to Start', { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#d1d7e0' }).setOrigin(0.5);

  // Collisions
  this.physics.add.collider(bird, ground, () => endGame(this));

  this.input.on('pointerdown', () => flap(this));
  this.input.keyboard.on('keydown-SPACE', () => flap(this));

  // Pipe spawner timer (paused until start)
  this.pipeTimer = this.time.addEvent({
    delay: 1300,
    callback: () => spawnPipePair(this),
    callbackScope: this,
    loop: true,
    paused: true
  });
}

function startGame(scene) {
  if (started) return;
  started = true;
  tapToStartText.setVisible(false);
  bird.setVelocity(0, 0);
  bird.setGravityY(900);
  scene.pipeTimer.paused = false;
}

function flap(scene) {
  if (!started && !gameOver) startGame(scene);
  if (gameOver) { scene.scene.restart(); resetState(); return; }
  bird.setVelocityY(-280);
  bird.setAngle(-18);
  scene.tweens.add({ targets: bird, angle: 24, duration: 400, ease: 'Quad.easeOut' });
}

function spawnPipePair(scene) {
  const gap = 140;                // opening size
  const topMargin = 70;
  const bottomMargin = 150;
  const maxY = H - bottomMargin - gap;
  const minY = topMargin;
  const y = Phaser.Math.Between(minY, maxY);

  const speedX = -170;

  // Top pipe (flipped)
  const topPipe = scene.physics.add.image(W + 40, y - gap/2 - 200, 'pipe').setOrigin(0.5, 1);
  topPipe.flipY = true;
  const topCap  = scene.physics.add.image(topPipe.x, topPipe.y - topPipe.displayHeight, 'cap').setOrigin(0.5, 1);
  [topPipe, topCap].forEach(p => { p.body.allowGravity = false; p.setImmovable(true); p.setVelocityX(speedX); pipes.add(p); });

  // Bottom pipe
  const bottomPipe = scene.physics.add.image(W + 40, y + gap/2 + 200, 'pipe').setOrigin(0.5, 0);
  const bottomCap  = scene.physics.add.image(bottomPipe.x, bottomPipe.y + bottomPipe.displayHeight, 'cap').setOrigin(0.5, 0);
  [bottomPipe, bottomCap].forEach(p => { p.body.allowGravity = false; p.setImmovable(true); p.setVelocityX(speedX); pipes.add(p); });

  // Score sensor (invisible)
  const sensor = scene.add.rectangle(W + 40, y, 10, gap, 0xffffff, 0);
  scene.physics.add.existing(sensor, true);
  sensor.body.setVelocityX(speedX);
  pipes.add(sensor);

  // Collisions
  scene.physics.add.overlap(bird, sensor, () => {
    if (!sensor.passed) {
      sensor.passed = true;
      score += 1;
      scoreText.setText(String(score));
      if (score > best) {
        best = score;
        localStorage.setItem('flappy_best', String(best));
        bestText.setText(`Best: ${best}`);
      }
    }
  }, null, scene);

  [topPipe, topCap, bottomPipe, bottomCap].forEach(pipe =>
    scene.physics.add.collider(bird, pipe, () => endGame(scene))
  );

  // Clean up off-screen
  scene.time.delayedCall(10000, () => {
    [topPipe, topCap, bottomPipe, bottomCap, sensor].forEach(o => o.destroy());
  });
}

function endGame(scene) {
  if (gameOver) return;
  gameOver = true;
  bird.setTint(0xff7272);
  scene.physics.world.pause();
  scene.pipeTimer.paused = true;
  gameOverText.setVisible(true);
  tapToStartText.setText('Tap to Restart').setVisible(true);
}

function resetState() {
  started = false;
  gameOver = false;
  score = 0;
}
function update() {
  // Prevent bird from rotating upside down forever
  if (bird && bird.angle > 60) bird.setAngle(60);
}
