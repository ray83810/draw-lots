/**
 * ConfettiEffect - Self-contained Canvas-based Confetti Particle System.
 */
class ConfettiEffect {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.animationFrameId = null;
    this.active = false;
  }

  resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
  }

  start() {
    this.resize();
    this.active = true;
    this.particles = [];
    
    const colors = ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#ec4899', '#14b8a6', '#a855f7'];
    
    // Create particles
    for (let i = 0; i < 120; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height - this.canvas.height, // Start above screen
        r: Math.random() * 6 + 4,
        d: Math.random() * this.canvas.height,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 5,
        tiltAngleIncremental: Math.random() * 0.07 + 0.02,
        tiltAngle: 0,
        speedY: Math.random() * 3 + 2,
        speedX: Math.random() * 2 - 1
      });
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    this.animate();
  }

  stop() {
    this.active = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  animate() {
    if (!this.active) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    let livingParticles = 0;
    
    this.particles.forEach(p => {
      p.tiltAngle += p.tiltAngleIncremental;
      p.y += p.speedY;
      p.x += p.speedX + Math.sin(p.tiltAngle) * 0.5;
      p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 8;

      if (p.y <= this.canvas.height + 20) {
        livingParticles++;
      }

      this.ctx.beginPath();
      this.ctx.lineWidth = p.r;
      this.ctx.strokeStyle = p.color;
      this.ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      this.ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      this.ctx.stroke();
    });

    if (livingParticles > 0 && this.active) {
      this.animationFrameId = requestAnimationFrame(() => this.animate());
    } else {
      this.stop();
    }
  }
}

/**
 * SlotMachine - Implements rolling slot rows with mechanical bounce-back physics.
 */
class SlotMachine {
  constructor(wrapperId, onComplete) {
    this.wrapper = document.getElementById(wrapperId);
    this.onComplete = onComplete;
    this.reelsCount = 0;
    this.reelsFinished = 0;
    this.isSpinning = false;
  }

  /**
   * Builds and rolls the slot reels.
   * @param {Array} candidates - Active candidates pool.
   * @param {Array} winners - Chosen winners.
   */
  roll(candidates, winners) {
    if (this.isSpinning || candidates.length === 0 || winners.length === 0) return;
    this.isSpinning = true;
    this.reelsCount = winners.length;
    this.reelsFinished = 0;
    this.wrapper.innerHTML = ''; // Clear reels

    winners.forEach((winner, reelIndex) => {
      // Create reel structure
      const reel = document.createElement('div');
      reel.className = 'slots-reel';
      reel.id = `slots-reel-${reelIndex}`;

      const strip = document.createElement('div');
      strip.className = 'reel-strip';
      strip.id = `reel-strip-${reelIndex}`;

      // Populate strip items
      // We repeat the candidates list multiple times to give scrolling depth
      const repetitions = 6;
      const stripItems = [];

      for (let r = 0; r < repetitions; r++) {
        candidates.forEach(c => {
          stripItems.push(c);
        });
      }

      // Append winner at the target ending index (towards the end of the strip)
      // Landing item index should be high (e.g. index inside the last repetition block)
      const targetRepetition = repetitions - 2;
      const baseIndex = targetRepetition * candidates.length;
      
      // Find candidate's relative index in list
      const candidateIndex = candidates.findIndex(c => c.id === winner.id);
      const targetWinnerIndex = baseIndex + (candidateIndex !== -1 ? candidateIndex : 0);
      
      // Ensure target index has the winner
      stripItems[targetWinnerIndex] = winner;

      // Render the DOM items
      stripItems.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'reel-item';
        itemEl.innerText = item.name;
        strip.appendChild(itemEl);
      });

      reel.appendChild(strip);
      this.wrapper.appendChild(reel);

      // Trigger scroll animation
      // Each item is 150px high. Total scroll amount: -targetWinnerIndex * 150px
      const scrollAmount = targetWinnerIndex * 150;
      
      // Stagger completion times (e.g. 3s, 3.5s, 4s...)
      const scrollDuration = 3 + reelIndex * 0.4;

      // We need to wait a frame for DOM rendering before triggering transition
      requestAnimationFrame(() => {
        // Cubic-bezier(0.15, 0.88, 0.3, 1.1) creates a beautiful bounce-back effect at the end
        strip.style.transition = `transform ${scrollDuration}s cubic-bezier(0.15, 0.88, 0.3, 1.1)`;
        strip.style.transform = `translateY(-${scrollAmount}px)`;
      });

      // Bind animation end
      strip.addEventListener('transitionend', () => {
        this.reelsFinished++;
        if (this.reelsFinished === this.reelsCount) {
          this.isSpinning = false;
          if (this.onComplete) {
            this.onComplete();
          }
        }
      });
    });
  }

  reset() {
    this.wrapper.innerHTML = '<div class="slots-reel"><div class="reel-strip"><div class="reel-item">❓ 準備就緒</div></div></div>';
    this.isSpinning = false;
  }
}

// Export for browser
window.ConfettiEffect = ConfettiEffect;
window.SlotMachine = SlotMachine;
