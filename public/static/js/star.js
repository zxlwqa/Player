class StarrySky {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.meteors = [];
        this.stars = [];
        this.init();
    }

    init() {
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '2';
        this.canvas.style.background = 'transparent';
        this.canvas.style.mixBlendMode = 'screen';
        
        document.body.insertBefore(this.canvas, document.body.firstChild);
        this.resize();
        
        this.createStars();
        this.createMeteors();
        
        this.animate();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    createStars() {
        const starCount = 200;
        const playerHeight = 200;  // 播放器区域高度
        const playerTop = 50;      // 播放器顶部位置

        for (let i = 0; i < starCount; i++) {
            let x = Math.random() * this.width;
            let y = Math.random() * (this.height * 0.7);
            
            while (y > playerTop && y < (playerTop + playerHeight)) {
                y = Math.random() * (this.height * 0.7);
            }

            this.stars.push({
                x: x,
                y: y,
                size: Math.random() * 1.5 + 0.5,
                blinkSpeed: Math.random() * 0.025 + 0.015,
                brightness: Math.random(),
                maxBrightness: Math.random() * 0.4 + 0.6
            });
        }
    }

    createMeteors() {
        const meteorCount = 5;
        for (let i = 0; i < meteorCount; i++) {
            this.meteors.push(this.createNewMeteor());
        }
    }

    createNewMeteor() {
        const startX = this.width * 0.5 + Math.random() * (this.width * 0.5);
        return {
            x: startX,
            y: -50,
            length: Math.random() * 150 + 100,
            originalLength: Math.random() * 150 + 100,
            speed: Math.random() * 6 + 4,
            opacity: 1,
            delay: Math.random() * 2000
        };
    }

    drawStars() {
        this.stars.forEach(star => {
            star.brightness += star.blinkSpeed;
            
            if (star.brightness > star.maxBrightness || star.brightness < 0) {
                star.blinkSpeed = -star.blinkSpeed;
            }
            
            this.ctx.beginPath();
            this.ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawMeteor(meteor) {
        const progress = meteor.y / (this.height * 0.5);
        const currentLength = meteor.originalLength * (1 - progress);
        const currentOpacity = meteor.opacity * (1 - progress);

        const gradient = this.ctx.createLinearGradient(
            meteor.x, 
            meteor.y, 
            meteor.x - currentLength,
            meteor.y + currentLength * 0.4
        );
        
        gradient.addColorStop(0, `rgba(255, 255, 255, ${currentOpacity})`);
        gradient.addColorStop(0.1, `rgba(255, 240, 200, ${currentOpacity * 0.9})`);
        gradient.addColorStop(0.3, `rgba(255, 220, 150, ${currentOpacity * 0.7})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = 2;
        this.ctx.moveTo(meteor.x, meteor.y);
        this.ctx.lineTo(
            meteor.x - currentLength,
            meteor.y + currentLength * 0.4
        );
        this.ctx.stroke();
    }

    animate() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        this.drawStars();
        
        this.meteors.forEach((meteor, index) => {
            if (meteor.delay > 0) {
                meteor.delay--;
                return;
            }
            
            this.drawMeteor(meteor);
            
            meteor.x -= meteor.speed * 1.5;
            meteor.y += meteor.speed * 0.4;
            
            if (meteor.y > this.height * 0.5 || meteor.x < 0) {
                this.meteors[index] = this.createNewMeteor();
            }
        });
        
        requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StarrySky();
});