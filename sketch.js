// Permission to Play - Complete HTML5 Canvas Drawing Tool
console.log("🎨 Permission to Play - Initializing Complete Drawing Tool...");

// =============================================================================
// GLOBAL VARIABLES
// =============================================================================

// Canvas and drawing
let canvas;
let ctx;
let canvasContainer;

// Colors
const paperColor = '#FCFAF0';
const lineColor = '#B4C8DC40';
const marginColor = '#FFB4B440';
const inkColor = '#3C5078';
const hand1Color = '#FF6B35'; // Orange
const hand2Color = '#4ECDC4'; // Teal

// Hand tracking
let hands = null;
let camera = null;
let videoElement = null;
let activeHands = [];
let handActive = [false, false];
let handPositions = [{}, {}];
let handVelocities = [0, 0];

// Drawing state
let userStrokes = [];
let currentStrokes = [[], []];
let isDrawing = [false, false];
let lastPos = [null, null];

// Environment
let ruledLines = [];
let marginDoodles = [];
let particles = [];
let lastActivityTime = 0;
let notebookAge = 0;
let distractionLevel = 0;
let creativityLevel = 0;
let someoneDrawing = false;

// Game system
let gameMode = "freeplay";
let availableGames = ["tracing", "continuous_line", "blind_portraits"];
let completedGames = [];
let currentGameType = null;
let gameTimer = 0;
let gameStartTime = 0;
let currentPlayer = 0;
let gamePhase = "";

// Wave detection
let waveTimer = 0;
let lastWaveTime = 0;
let waveVelocityThreshold = 7;
let wavePauseTolerance = 700;
let waveDetectionDuration = 3000;
let showCollabPrompt = false;
let collabPromptTimer = 0;

// Ghost pencil
let ghostPencil = {
    x: 0, y: 0, targetX: 0, targetY: 0,
    angle: 0, visible: false, animation: 0
};

// Game-specific data
let tracingImage = null;
let tracingStrokes = [[], []];
let continuousLineStrokes = [];
let continuousLineBroken = false;
let lastContinuousPoint = null;
let portraitStrokes = [[], []];
let posingPlayer = 0;

// High five and replay
let highFiveDetected = false;
let bothHandsCloseFrames = 0;
let minHighFiveFrames = 15;
let highFiveDistance = 150;
let replayStrokes = [];
let replayStartTime = 0;
let replaySpeed = 3;
let replayIndex = 0;
let currentReplayStrokes = [];

// UI state
let showPencilVisualization = true;
let presentationMode = false;
let showControls = true;

// =============================================================================
// INITIALIZATION
// =============================================================================

async function init() {
    console.log("🚀 Initializing drawing tool...");
    
    // Setup canvas
    setupCanvas();
    
    // Generate notebook environment
    generateNotebookEnvironment();
    
    // Initialize game system
    initializeGame();
    
    // Setup MediaPipe hand tracking
    await setupHandTracking();
    
    // Start animation loop
    animate();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log("✅ Drawing tool ready!");
}

function setupCanvas() {
    canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) {
        canvasContainer = document.createElement('div');
        canvasContainer.id = 'canvas-container';
        document.body.appendChild(canvasContainer);
    }
    
    canvas = document.createElement('canvas');
    canvas.id = 'main-canvas';
    canvas.width = 800;
    canvas.height = 600;
    canvas.style.border = '2px solid #333';
    canvas.style.background = paperColor;
    
    ctx = canvas.getContext('2d');
    canvasContainer.appendChild(canvas);
    
    console.log("📱 Canvas created:", canvas.width, "x", canvas.height);
}

async function setupHandTracking() {
    console.log("👋 Setting up hand tracking...");
    
    try {
        // Get camera access
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        
        // Setup video element
        videoElement = document.getElementById('camera');
        if (!videoElement) {
            videoElement = document.createElement('video');
            videoElement.id = 'camera';
            videoElement.autoplay = true;
            videoElement.muted = true;
            videoElement.playsInline = true;
            videoElement.style.position = 'absolute';
            videoElement.style.top = '20px';
            videoElement.style.right = '20px';
            videoElement.style.width = '320px';
            videoElement.style.height = '240px';
            videoElement.style.border = '2px solid #333';
            videoElement.style.borderRadius = '8px';
            document.body.appendChild(videoElement);
        }
        
        videoElement.srcObject = stream;
        
        await new Promise(resolve => {
            videoElement.onloadeddata = resolve;
        });
        
        console.log("📹 Camera connected");
        
        // Setup MediaPipe Hands
        if (typeof Hands !== 'undefined') {
            hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });
            
            hands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });
            
            hands.onResults(onHandResults);
            
            camera = new Camera(videoElement, {
                onFrame: async () => {
                    if (hands && videoElement.readyState === 4) {
                        await hands.send({image: videoElement});
                    }
                },
                width: 640,
                height: 480
            });
            
            await camera.start();
            console.log("✅ Hand tracking active");
        } else {
            console.log("⚠️ MediaPipe not available, using mouse input");
        }
        
    } catch (error) {
        console.error("❌ Hand tracking setup failed:", error);
        console.log("🖱️ Falling back to mouse input");
    }
}

// =============================================================================
// HAND TRACKING
// =============================================================================

function onHandResults(results) {
    const detectedHands = results.multiHandLandmarks || [];
    activeHands = processDetectedHands(detectedHands);
    
    // Update hand states
    handActive = [false, false];
    handPositions = [{}, {}];
    handVelocities = [0, 0];
    
    activeHands.forEach(hand => {
        let index = hand.playerIndex;
        if (index < 2) {
            handActive[index] = true;
            handPositions[index] = {
                x: hand.x, y: hand.y,
                landmarks: hand.landmarks,
                isWritingPose: hand.isWritingPose,
                isWaving: hand.isWaving
            };
            handVelocities[index] = hand.velocity;
            
            handleHandDrawing(hand, index);
        }
    });
    
    // Clean up inactive hands
    for (let i = 0; i < 2; i++) {
        if (!handActive[i] && currentStrokes[i].length > 0) {
            finishStroke(i);
        }
    }
    
    // Update UI
    updateHandTracking();
}

function processDetectedHands(detectedHands) {
    let processedHands = [];
    
    detectedHands.forEach((landmarks, index) => {
        if (index >= 2) return;
        
        const hand = {
            playerIndex: index,
            landmarks: landmarks,
            ...calculateHandProperties(landmarks),
            color: index === 0 ? hand1Color : hand2Color
        };
        
        processedHands.push(hand);
    });
    
    return processedHands;
}

function calculateHandProperties(landmarks) {
    // Get index finger tip (landmark 8)
    const indexTip = landmarks[8];
    const indexMCP = landmarks[5];
    const thumbTip = landmarks[4];
    const middleTip = landmarks[12];
    
    // Convert to canvas coordinates (flip X for mirror effect)
    const x = (1 - indexTip.x) * canvas.width;
    const y = indexTip.y * canvas.height;
    
    // Calculate velocity (simplified)
    const velocity = Math.random() * 5; // Placeholder - would need previous positions
    
    // Detect writing pose
    const isWritingPose = detectWritingPose(landmarks);
    
    // Detect waving
    const isWaving = velocity > waveVelocityThreshold && !isWritingPose;
    
    return { x, y, velocity, isWritingPose, isWaving };
}

function detectWritingPose(landmarks) {
    const indexTip = landmarks[8];
    const indexMCP = landmarks[5];
    const thumbTip = landmarks[4];
    const middleTip = landmarks[12];
    
    // Index finger extended
    const indexExtended = indexTip.y < indexMCP.y;
    
    // Thumb near index or middle finger (grip)
    const thumbIndexDistance = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) + 
        Math.pow(thumbTip.y - indexTip.y, 2)
    );
    
    const thumbMiddleDistance = Math.sqrt(
        Math.pow(thumbTip.x - middleTip.x, 2) + 
        Math.pow(thumbTip.y - middleTip.y, 2)
    );
    
    const hasGrip = thumbIndexDistance < 0.15 || thumbMiddleDistance < 0.2;
    
    return indexExtended && hasGrip;
}

function handleHandDrawing(hand, index) {
    // Check if this hand can draw based on game mode
    let canDraw = true;
    
    if (gameMode === "tracing") {
        canDraw = (gamePhase === "player1" && index === 0) || 
                 (gamePhase === "player2" && index === 1);
    } else if (gameMode === "continuous_line") {
        canDraw = (gamePhase === "playing" && index === currentPlayer);
    } else if (gameMode === "blind_portraits") {
        canDraw = (gamePhase === "round1" && index === 0) || 
                 (gamePhase === "round2" && index === 1);
    }
    
    if (canDraw && hand.isWritingPose && hand.velocity > 3) {
        if (!isDrawing[index]) {
            // Start new stroke
            isDrawing[index] = true;
            currentStrokes[index] = [{ x: hand.x, y: hand.y }];
            lastPos[index] = { x: hand.x, y: hand.y };
        } else {
            // Continue stroke
            currentStrokes[index].push({ x: hand.x, y: hand.y });
            lastPos[index] = { x: hand.x, y: hand.y };
        }
        
        // Update activity
        lastActivityTime = Date.now();
        someoneDrawing = true;
        
        // Add particles
        addParticle(hand.x, hand.y, "pencil");
        
    } else if (isDrawing[index]) {
        // Finish stroke
        finishStroke(index);
        isDrawing[index] = false;
    }
}

function finishStroke(index) {
    if (currentStrokes[index].length > 2) {
        const stroke = new DrawingStroke(
            [...currentStrokes[index]], 
            index === 0 ? hand1Color : hand2Color
        );
        
        if (gameMode === "freeplay") {
            userStrokes.push(stroke);
        } else {
            // Store for game-specific handling
            storeGameStroke(stroke, index);
        }
        
        creativityLevel = Math.min(creativityLevel + 0.006, 1.0);
        checkDoodleEmergence();
    }
    currentStrokes[index] = [];
}

function storeGameStroke(stroke, playerIndex) {
    replayStrokes.push({
        stroke: stroke,
        timestamp: Date.now() - gameStartTime,
        player: playerIndex,
        game: currentGameType
    });
}

// =============================================================================
// DRAWING FUNCTIONS
// =============================================================================

function drawFrame() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw paper background
    drawPaperBackground();
    
    // Draw notebook environment
    drawRuledLines();
    drawMargins();
    drawMarginDoodles();
    
    // Draw game-specific content
    if (gameMode === "tracing") {
        drawTracingGame();
    } else if (gameMode === "continuous_line") {
        drawContinuousLineGame();
    } else if (gameMode === "blind_portraits") {
        drawBlindPortraitsGame();
    } else if (gameMode === "replay") {
        drawReplay();
    } else {
        drawUserStrokes();
    }
    
    // Draw current strokes
    drawCurrentStrokes();
    
    // Draw hand visualization
    drawHandVisualization();
    
    // Draw particles
    drawParticles();
    
    // Draw ghost pencil
    drawGhostPencil();
    
    // Draw UI
    drawUI();
}

function drawPaperBackground() {
    ctx.fillStyle = paperColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add paper texture
    for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(${200 + Math.random() * 20}, ${180 + Math.random() * 20}, ${140 + Math.random() * 20}, 0.1)`;
        ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
    }
}

function drawRuledLines() {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    
    for (let y = 80; y < canvas.height - 80; y += 25) {
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(canvas.width - 50, y);
        ctx.stroke();
    }
}

function drawMargins() {
    ctx.strokeStyle = marginColor;
    ctx.lineWidth = 2;
    
    const marginX = 80 + Math.sin(Date.now() * 0.001) * distractionLevel * 5;
    ctx.beginPath();
    ctx.moveTo(marginX, 50);
    ctx.lineTo(marginX, canvas.height - 50);
    ctx.stroke();
    
    // Add margin holes
    if (distractionLevel > 0.3) {
        ctx.fillStyle = paperColor;
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        
        [150, canvas.height/2, canvas.height - 150].forEach(y => {
            ctx.beginPath();
            ctx.arc(marginX - 30, y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    }
}

function drawMarginDoodles() {
    marginDoodles.forEach(doodle => {
        const adjustedThreshold = doodle.emergenceThreshold * 0.3;
        if (creativityLevel >= adjustedThreshold) {
            const visibility = Math.min((creativityLevel - adjustedThreshold) * 10, 1.0);
            doodle.display(ctx, distractionLevel, visibility);
        }
    });
}

function drawUserStrokes() {
    userStrokes.forEach(stroke => {
        stroke.display(ctx);
    });
}

function drawCurrentStrokes() {
    currentStrokes.forEach((stroke, index) => {
        if (stroke.length > 1) {
            const color = index === 0 ? hand1Color : hand2Color;
            
            // Velocity-based brush size
            let brushSize = 3;
            if (activeHands[index]) {
                brushSize = Math.max(1, Math.min(8, activeHands[index].velocity));
            }
            
            ctx.strokeStyle = color;
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            stroke.forEach((point, i) => {
                if (i === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            ctx.stroke();
        }
    });
}

function drawHandVisualization() {
    if (!showPencilVisualization) return;
    
    activeHands.forEach(hand => {
        // Draw hand indicator
        ctx.fillStyle = hand.color;
        ctx.beginPath();
        ctx.arc(hand.x, hand.y, hand.isWritingPose ? 8 : 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw writing indicator
        if (hand.isWritingPose && hand.velocity > 3) {
            ctx.strokeStyle = hand.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(hand.x, hand.y, 20, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Draw wave indicator
        if (hand.isWaving) {
            ctx.strokeStyle = hand.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            const waveSize = 30 + Math.sin(Date.now() * 0.01) * 10;
            ctx.arc(hand.x, hand.y, waveSize, 0, Math.PI * 2);
            ctx.stroke();
        }
    });
}

// =============================================================================
// GAME MODES
// =============================================================================

function initializeGame() {
    gameMode = "freeplay";
    completedGames = [];
    waveTimer = 0;
    showCollabPrompt = false;
    console.log("🎮 Game initialized - Free play mode");
}

function updateGameMode() {
    switch (gameMode) {
        case "freeplay":
            updateFreePlay();
            break;
        case "game_selection":
            updateGameSelection();
            break;
        case "tracing":
            updateTracingGame();
            break;
        case "continuous_line":
            updateContinuousLineGame();
            break;
        case "blind_portraits":
            updateBlindPortraitsGame();
            break;
        case "waiting_for_highfive":
            checkForHighFive();
            break;
        case "replay":
            updateReplay();
            break;
    }
}

function updateFreePlay() {
    updateWaveDetection();
    updateCollaborationPrompt();
}

function updateWaveDetection() {
    const bothWaving = activeHands.length >= 2 && 
                      activeHands.every(hand => hand.isWaving);
    
    const currentTime = Date.now();
    
    if (bothWaving) {
        waveTimer += 16;
        lastWaveTime = currentTime;
    } else if (currentTime - lastWaveTime < wavePauseTolerance) {
        waveTimer += 16;
    } else {
        waveTimer = 0;
    }
    
    if (waveTimer >= waveDetectionDuration) {
        startGameSelection();
        waveTimer = 0;
    }
}

function startGameSelection() {
    console.log("👋 Wave detected! Starting game selection...");
    gameMode = "game_selection";
    gameStartTime = Date.now();
    
    // Select next available game
    let availableGamesList = availableGames.filter(game => !completedGames.includes(game));
    if (availableGamesList.length === 0) {
        completedGames = [];
        availableGamesList = [...availableGames];
    }
    
    currentGameType = availableGamesList[Math.floor(Math.random() * availableGamesList.length)];
    console.log(`🎮 Selected game: ${currentGameType}`);
    
    setTimeout(() => {
        startSelectedGame(currentGameType);
    }, 3000);
}

function startSelectedGame(gameType) {
    completedGames.push(gameType);
    gameMode = gameType;
    gameStartTime = Date.now();
    gamePhase = "prep";
    currentPlayer = 0;
    
    currentStrokes = [[], []];
    
    switch (gameType) {
        case "tracing":
            initializeTracingGame();
            break;
        case "continuous_line":
            initializeContinuousLineGame();
            break;
        case "blind_portraits":
            initializeBlindPortraitsGame();
            break;
    }
}

// Placeholder game functions
function initializeTracingGame() {
    tracingStrokes = [[], []];
    replayStrokes = [];
    console.log("🏛️ Tracing game started");
}

function updateTracingGame() {
    // Game timing logic would go here
}

function drawTracingGame() {
    // Draw tracing image and game-specific content
}

function initializeContinuousLineGame() {
    continuousLineStrokes = [];
    console.log("➰ Continuous line game started");
}

function updateContinuousLineGame() {
    // Game timing logic would go here
}

function drawContinuousLineGame() {
    // Draw continuous line content
}

function initializeBlindPortraitsGame() {
    portraitStrokes = [[], []];
    console.log("👤 Blind portraits game started");
}

function updateBlindPortraitsGame() {
    // Game timing logic would go here
}

function drawBlindPortraitsGame() {
    // Draw portrait game content
}

function checkForHighFive() {
    // High five detection logic
}

function updateReplay() {
    // Replay logic
}

function drawReplay() {
    // Draw replay content
}

// =============================================================================
// NOTEBOOK ENVIRONMENT
// =============================================================================

function generateNotebookEnvironment() {
    ruledLines = [];
    marginDoodles = [];
    
    // Generate ruled lines
    for (let y = 80; y < canvas.height - 80; y += 25) {
        ruledLines.push(new NotebookLine(y));
    }
    
    // Generate margin doodles
    marginDoodles.push(new Doodle(20, 150, "bored_face", 1.0, 0.3));
    marginDoodles.push(new Doodle(15, 200, "arrow", 0.8, 0.6));
    marginDoodles.push(new Doodle(30, 280, "eye", 1.5, 0.9));
    marginDoodles.push(new Doodle(25, 400, "infinity", 1.2, 1.2));
    marginDoodles.push(new Doodle(18, 480, "cube", 1.8, 1.5));
    marginDoodles.push(new Doodle(22, 580, "lightning", 0.9, 1.8));
    
    console.log("📓 Notebook environment generated");
}

function checkDoodleEmergence() {
    marginDoodles.forEach(doodle => {
        const prevLevel = creativityLevel - 0.006;
        if (prevLevel < doodle.emergenceThreshold && creativityLevel >= doodle.emergenceThreshold) {
            console.log("New doodle emerged:", doodle.type);
            // Add emergence particles
            for (let i = 0; i < 40; i++) {
                addParticle(
                    doodle.x + (Math.random() - 0.5) * 80,
                    doodle.y + (Math.random() - 0.5) * 80,
                    "sparkle"
                );
            }
        }
    });
}

// =============================================================================
// CLASSES
// =============================================================================

class DrawingStroke {
    constructor(points, strokeColor = inkColor) {
        this.points = [...points];
        this.strokeColor = strokeColor;
    }
    
    display(ctx) {
        if (this.points.length < 2) return;
        
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        this.points.forEach((point, i) => {
            if (i === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.stroke();
    }
}

class NotebookLine {
    constructor(y) {
        this.baseY = y;
        this.points = [];
        
        for (let x = 50; x <= canvas.width - 50; x += 10) {
            const yOffset = (Math.random() - 0.5) * 2;
            this.points.push({ x: x, y: y + yOffset });
        }
    }
}

class Doodle {
    constructor(x, y, type, scale, threshold) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.scale = scale;
        this.emergenceThreshold = threshold;
        this.animation = 0;
    }
    
    display(ctx, distraction, visibility) {
        this.animation += 0.02;
        
        const alpha = (100 + distraction * 100) * visibility;
        ctx.strokeStyle = `rgba(60, 80, 120, ${alpha / 255})`;
        ctx.lineWidth = (1 + distraction) * this.scale * 0.8 * visibility;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale * (0.3 + 0.7 * visibility), this.scale * (0.3 + 0.7 * visibility));
        
        const wiggle = Math.sin(this.animation) * distraction * 2;
        ctx.translate(wiggle, wiggle);
        
        // Draw simple doodle shapes
        switch(this.type) {
            case "bored_face":
                ctx.beginPath();
                ctx.arc(0, 0, 8, 0, Math.PI * 2);
                ctx.stroke();
                // Eyes
                ctx.fillRect(-3, -2, 2, 1);
                ctx.fillRect(1, -2, 2, 1);
                // Mouth
                ctx.beginPath();
                ctx.arc(0, 3, 3, 0, Math.PI);
                ctx.stroke();
                break;
                
            case "arrow":
                ctx.beginPath();
                ctx.moveTo(-6, 0);
                ctx.lineTo(6, 0);
                ctx.moveTo(2, -3);
                ctx.lineTo(6, 0);
                ctx.lineTo(2, 3);
                ctx.stroke();
                break;
                
            // Add other doodle types as needed
        }
        
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.life = 60;
        this.maxLife = 60;
        this.size = Math.random() * 4 + 1;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.life--;
    }
    
    display(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = `rgba(255, 255, 180, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    isDead() {
        return this.life <= 0;
    }
}

// =============================================================================
// PARTICLES AND EFFECTS
// =============================================================================

function addParticle(x, y, type) {
    particles.push(new Particle(x, y, type));
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].isDead()) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    particles.forEach(particle => {
        particle.display(ctx);
    });
}

// =============================================================================
// GHOST PENCIL
// =============================================================================

function updateGhostPencil() {
    // Show ghost pencil when only one hand detected
    if (activeHands.length === 1 && showPencilVisualization && gameMode === "freeplay") {
        ghostPencil.visible = true;
        
        ghostPencil.animation += 0.02;
        ghostPencil.targetX = canvas.width/2 + Math.cos(ghostPencil.animation) * 100;
        ghostPencil.targetY = canvas.height/2 + Math.sin(ghostPencil.animation * 0.7) * 60;
        
        // Smooth movement
        ghostPencil.x += (ghostPencil.targetX - ghostPencil.x) * 0.02;
        ghostPencil.y += (ghostPencil.targetY - ghostPencil.y) * 0.02;
        
    } else {
        ghostPencil.visible = false;
    }
}

function drawGhostPencil() {
    if (!ghostPencil.visible) return;
    
    ctx.save();
    ctx.translate(ghostPencil.x, ghostPencil.y);
    
    // Semi-transparent pencil
    ctx.strokeStyle = 'rgba(78, 205, 196, 0.4)'; // Teal with transparency
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    
    // Pencil body
    ctx.beginPath();
    ctx.moveTo(-60, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();
    
    // Pencil tip
    ctx.fillStyle = 'rgba(47, 47, 47, 0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Eraser end
    ctx.fillStyle = 'rgba(255, 182, 193, 0.4)';
    ctx.beginPath();
    ctx.arc(-60, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Add subtle particles
    if (Math.random() < 0.1) {
        addParticle(
            ghostPencil.x + (Math.random() - 0.5) * 40,
            ghostPencil.y + (Math.random() - 0.5) * 40,
            "gentle_flutter"
        );
    }
}

// =============================================================================
// UI AND ENVIRONMENT UPDATES
// =============================================================================

function updateEnvironmentMood() {
    const wasDrawing = someoneDrawing;
    someoneDrawing = activeHands.some(hand => hand.isWritingPose && hand.velocity > 3);
    
    if (someoneDrawing) {
        lastActivityTime = Date.now();
        distractionLevel = Math.min(distractionLevel + 0.02, 1.0);
        creativityLevel = Math.min(creativityLevel + 0.002688, 1.0);
        
        if (!wasDrawing) {
            // Add environment particles when drawing starts
            for (let i = 0; i < 8; i++) {
                addParticle(
                    Math.random() * canvas.width,
                    Math.random() * canvas.height,
                    "flutter"
                );
            }
        }
    } else {
        if (Date.now() - lastActivityTime > 2000) {
            distractionLevel = Math.max(distractionLevel - 0.015, 0.0);
        }
    }
    
    notebookAge += 0.001;
}

function updateCollaborationPrompt() {
    if (activeHands.length >= 2) {
        const bothDrawing = activeHands.every(hand => 
            hand.isWritingPose && hand.velocity > 3
        );
        
        if (bothDrawing) {
            showCollabPrompt = false;
            collabPromptTimer = 0;
        } else {
            const anyPaused = activeHands.some(hand => 
                hand.velocity < 1 && hand.isWritingPose
            );
            
            if (anyPaused) {
                collabPromptTimer += 16;
                if (collabPromptTimer > 3000) {
                    showCollabPrompt = true;
                }
            } else {
                collabPromptTimer = 0;
            }
        }
    } else {
        showCollabPrompt = false;
        collabPromptTimer = 0;
    }
}

function updateHandTracking() {
    // Update UI elements if they exist
    if (typeof window.updatePencilUI === 'function') {
        let handsData = [null, null];
        activeHands.forEach(hand => {
            if (hand.playerIndex < 2) {
                handsData[hand.playerIndex] = {
                    active: true,
                    isWriting: hand.isWritingPose && hand.velocity > 3
                };
            }
        });
        
        window.updatePencilUI({
            showPencils: showPencilVisualization,
            hands: handsData,
            strokeCount: userStrokes.length
        });
    }
}

function drawUI() {
    // Draw collaboration prompt
    if (showCollabPrompt && gameMode === "freeplay") {
        ctx.fillStyle = 'rgba(78, 205, 196, 0.8)';
        ctx.fillRect(canvas.width/2 - 150, canvas.height - 80, 300, 50);
        
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👋 Wave together to play a game!', canvas.width/2, canvas.height - 50);
    }
    
    // Draw game-specific UI
    drawGameUI();
}

function drawGameUI() {
    if (gameMode === "game_selection") {
        drawGameSelectionUI();
    } else if (gameMode === "tracing") {
        drawTracingUI();
    } else if (gameMode === "continuous_line") {
        drawContinuousLineUI();
    } else if (gameMode === "blind_portraits") {
        drawBlindPortraitsUI();
    } else if (gameMode === "waiting_for_highfive") {
        drawHighFivePrompt();
    } else if (gameMode === "replay") {
        drawReplayUI();
    }
}

function drawGameSelectionUI() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(canvas.width/2 - 200, canvas.height/2 - 150, 400, 300);
    
    ctx.fillStyle = 'black';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎮 Game Starting!', canvas.width/2, canvas.height/2 - 100);
    
    const gameInfo = getGameInfo(currentGameType);
    ctx.font = '18px Arial';
    ctx.fillText(gameInfo.icon + ' ' + gameInfo.title, canvas.width/2, canvas.height/2 - 60);
    
    ctx.font = '14px Arial';
    ctx.fillStyle = 'gray';
    ctx.fillText(gameInfo.description, canvas.width/2, canvas.height/2 - 30);
    
    // Countdown
    const elapsed = Date.now() - gameStartTime;
    const remaining = Math.max(0, 3 - Math.floor(elapsed / 1000));
    
    ctx.font = '48px Arial';
    ctx.fillStyle = hand1Color;
    ctx.fillText(remaining > 0 ? remaining : 'GO!', canvas.width/2, canvas.height/2 + 30);
}

function drawTracingUI() {
    // Placeholder for tracing game UI
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(canvas.width/2 - 100, 20, 200, 60);
    
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏛️ Tracing Game', canvas.width/2, 45);
    ctx.fillText('Trace the monastery!', canvas.width/2, 65);
}

function drawContinuousLineUI() {
    // Placeholder for continuous line game UI
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(canvas.width/2 - 120, 20, 240, 60);
    
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('➰ One Continuous Line', canvas.width/2, 45);
    ctx.fillText('Create together - never lift!', canvas.width/2, 65);
}

function drawBlindPortraitsUI() {
    // Placeholder for blind portraits game UI
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(canvas.width/2 - 120, 20, 240, 60);
    
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('👤 Blind Portraits', canvas.width/2, 45);
    ctx.fillText('Draw without looking!', canvas.width/2, 65);
}

function drawHighFivePrompt() {
    const pulse = Math.sin(Date.now() * 0.01) * 20 + 230;
    
    ctx.fillStyle = `rgba(255, 215, 0, ${pulse/255})`;
    ctx.fillRect(canvas.width/2 - 250, canvas.height/2 - 60, 500, 120);
    
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 Game Complete! 🎉', canvas.width/2, canvas.height/2 - 20);
    ctx.font = '16px Arial';
    ctx.fillText('🙏 Bring hands together for replay!', canvas.width/2, canvas.height/2 + 20);
}

function drawReplayUI() {
    const progress = replayIndex / Math.max(1, replayStrokes.length);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(canvas.width/2 - 200, canvas.height - 100, 400, 60);
    
    ctx.fillStyle = 'gold';
    ctx.fillRect(canvas.width/2 - 190, canvas.height - 85, 380 * progress, 30);
    
    ctx.fillStyle = 'white';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`🎬 Replay: ${Math.floor(progress * 100)}%`, canvas.width/2, canvas.height - 65);
}

function getGameInfo(gameType) {
    switch (gameType) {
        case "tracing":
            return {
                icon: "🏛️",
                title: "Trace Together",
                description: "New to collaborating? Trace the monastery!"
            };
        case "continuous_line":
            return {
                icon: "➰", 
                title: "One Line Story",
                description: "Feeling creative? Create with one line!"
            };
        case "blind_portraits":
            return {
                icon: "👤",
                title: "Silly Portraits", 
                description: "Ready to be silly? Draw without looking!"
            };
        default:
            return {
                icon: "🎮",
                title: "Unknown Game",
                description: "A mystery game!"
            };
    }
}

// =============================================================================
// EVENT LISTENERS
// =============================================================================

function setupEventListeners() {
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        switch(e.key.toLowerCase()) {
            case 'c':
                clearCanvas();
                break;
            case 't':
                togglePencilView();
                break;
            case 'p':
                togglePresentationMode();
                break;
            case '1':
                if (gameMode === "freeplay") {
                    startGameSelection();
                }
                break;
        }
    });
    
    // Mouse fallback for drawing
    let isMouseDown = false;
    
    canvas.addEventListener('mousedown', (e) => {
        if (gameMode === "freeplay") {
            isMouseDown = true;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            currentStrokes[0] = [{ x, y }];
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isMouseDown && gameMode === "freeplay") {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            currentStrokes[0].push({ x, y });
            
            addParticle(x, y, "pencil");
            lastActivityTime = Date.now();
            someoneDrawing = true;
        }
    });
    
    canvas.addEventListener('mouseup', () => {
        if (isMouseDown && gameMode === "freeplay") {
            isMouseDown = false;
            finishStroke(0);
        }
    });
    
    // Prevent context menu on right click
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

function clearCanvas() {
    userStrokes = [];
    currentStrokes = [[], []];
    particles = [];
    creativityLevel = 0;
    distractionLevel = 0;
    console.log("🧹 Canvas cleared");
}

function togglePencilView() {
    showPencilVisualization = !showPencilVisualization;
    console.log(`✏️ Pencil visualization: ${showPencilVisualization ? 'ON' : 'OFF'}`);
}

function togglePresentationMode() {
    presentationMode = !presentationMode;
    showControls = !presentationMode;
    
    // Hide/show camera if it exists
    if (videoElement) {
        videoElement.style.display = presentationMode ? 'none' : 'block';
    }
    
    console.log(presentationMode ? '🎭 Presentation mode ON' : '🎭 Presentation mode OFF');
}

// =============================================================================
// ANIMATION LOOP
// =============================================================================

function animate() {
    // Update systems
    updateEnvironmentMood();
    updateGameMode();
    updateGhostPencil();
    updateParticles();
    
    // Draw frame
    drawFrame();
    
    // Continue animation loop
    requestAnimationFrame(animate);
}

// =============================================================================
// GLOBAL FUNCTIONS
// =============================================================================

// Make key functions available globally
window.togglePencilView = togglePencilView;
window.clearCanvas = clearCanvas;
window.togglePresentationMode = togglePresentationMode;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log("🎨 Permission to Play - Complete Drawing Tool Loaded");
console.log("📖 Controls:");
console.log("   C - Clear canvas");
console.log("   T - Toggle pencil view");
console.log("   P - Toggle presentation mode");
console.log("   1 - Start game selection (testing)");
console.log("🎮 Make a writing grip to draw!");
console.log("👋 Wave both hands together for collaborative games!");