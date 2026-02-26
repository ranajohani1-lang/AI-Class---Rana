/* =================================================================
   GUESS THE COLOR – Full Game Logic
   Features: Timer | Difficulty | Trick Mode | Combos | Sound
             High Score | Accuracy | Motivational Feedback
================================================================= */

'use strict';

// ─── COLOUR DATA ──────────────────────────────────────────────────────────────

const EASY_COLORS = [
    { name: 'Red', hex: '#ef4444' },
    { name: 'Blue', hex: '#3b82f6' },
    { name: 'Green', hex: '#22c55e' },
    { name: 'Yellow', hex: '#eab308' },
    { name: 'Purple', hex: '#a855f7' },
    { name: 'Orange', hex: '#f97316' },
];

const MEDIUM_COLORS = [
    ...EASY_COLORS,
    { name: 'Pink', hex: '#ec4899' },
    { name: 'Cyan', hex: '#06b6d4' },
    { name: 'Indigo', hex: '#6366f1' },
];

const HARD_COLORS = [
    { name: 'Red', hex: '#ef4444' },
    { name: 'Crimson', hex: '#dc2626' },
    { name: 'Blue', hex: '#3b82f6' },
    { name: 'Navy', hex: '#1e3a8a' },
    { name: 'Cyan', hex: '#06b6d4' },
    { name: 'Teal', hex: '#0d9488' },
    { name: 'Green', hex: '#22c55e' },
    { name: 'Lime', hex: '#84cc16' },
    { name: 'Purple', hex: '#a855f7' },
    { name: 'Violet', hex: '#7c3aed' },
    { name: 'Orange', hex: '#f97316' },
    { name: 'Amber', hex: '#d97706' },
];

const OPTION_COUNT = { easy: 3, medium: 6, hard: 6 };

const WORDS = [
    'APPLE', 'OCEAN', 'FOREST', 'SUN', 'GRAPE',
    'TIGER', 'FLOWER', 'SKY', 'MOUNTAIN', 'RIVER',
    'BIRD', 'CLOUD', 'STAR', 'MOON', 'FIRE',
    'WIND', 'RAIN', 'SNOW', 'LEAF', 'STONE',
];

// ─── MOTIVATIONAL TEXT ───────────────────────────────────────────────────────

const MSG_CORRECT = [
    'Nice one! 🎯', 'Nailed it! 💥', "You're on fire! 🔥",
    'Amazing! 🌟', 'Keep it up! 💪', 'Color genius! 🎨',
    'Unstoppable! 🚀', 'Brilliant! ✨', 'Perfect eye! 👁️',
];
const MSG_COMBO = ['Double points! 🎉', 'On a streak! 🔥', 'COMBO KING! 👑'];
const MSG_WRONG = [
    'So close! Try again 😅', "Don't give up! 💙",
    'Better luck next time 🍀', 'Almost! 😬',
    "You'll get the next one! 🌈",
];
const MSG_TIMEOUT = [
    'Too slow! ⏰', 'Time ran out! 💨', 'Tick tock! ⏱️',
];

// ─── DOM REFS ─────────────────────────────────────────────────────────────────

const screens = {
    menu: document.getElementById('screen-menu'),
    game: document.getElementById('screen-game'),
    result: document.getElementById('screen-result'),
};

// Menu
const menuHighscore = document.getElementById('menu-highscore');
const menuAccuracy = document.getElementById('menu-accuracy');
const diffGroup = document.getElementById('difficulty-group');
const modeGroup = document.getElementById('mode-group');
const soundToggle = document.getElementById('sound-toggle');
const btnStart = document.getElementById('btn-start');

// Game
const scoreEl = document.getElementById('score');
const comboCEl = document.getElementById('combo-chip');
const comboCountEl = document.getElementById('combo-count');
const timerNum = document.getElementById('timer-num');
const ringProgress = document.getElementById('ring-progress');
const modeTag = document.getElementById('mode-tag');
const wordDisplay = document.getElementById('word-display');
const msgMain = document.getElementById('msg-main');
const msgMotivation = document.getElementById('msg-motivation');
const optionsGrid = document.getElementById('options-grid');
const accuracyLive = document.getElementById('accuracy-live');
const btnRestart = document.getElementById('btn-restart');
const gameCard = document.getElementById('game-card');

// Result
const resultIcon = document.getElementById('result-icon');
const resultTitle = document.getElementById('result-title');
const resultSub = document.getElementById('result-sub');
const rsScore = document.getElementById('rs-score');
const rsBest = document.getElementById('rs-best');
const rsAccuracy = document.getElementById('rs-accuracy');
const rsCombo = document.getElementById('rs-combo');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnMenu = document.getElementById('btn-menu');

// ─── GAME STATE ───────────────────────────────────────────────────────────────

let state = {};
let settings = { difficulty: 'easy', mode: 'normal', sound: true };
let timerInterval = null;
let showTimer = null;

const RING_CIRCUMFERENCE = 2 * Math.PI * 18; // r=18 => ~113.1

// ─── SOUND ENGINE (Web Audio API) ────────────────────────────────────────────

let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function playTone(freq, type, duration, volume = 0.3) {
    if (!settings.sound) return;
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch (e) { }
}

function soundCorrect() { playTone(880, 'sine', 0.18); setTimeout(() => playTone(1100, 'sine', 0.18), 80); }
function soundWrong() { playTone(180, 'sawtooth', 0.35, 0.2); }
function soundCombo() { [660, 880, 1100].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.15), i * 80)); }
function soundTimeout() { playTone(200, 'triangle', 0.5, 0.2); }
function soundClick() { playTone(600, 'sine', 0.08, 0.15); }

// ─── STORAGE ─────────────────────────────────────────────────────────────────

function loadStorage() {
    return {
        highscore: parseInt(localStorage.getItem('gtc_highscore') || '0'),
        totalCorrect: parseInt(localStorage.getItem('gtc_totalCorrect') || '0'),
        totalAnswers: parseInt(localStorage.getItem('gtc_totalAnswers') || '0'),
    };
}

function saveHighscore(score) {
    const s = loadStorage();
    if (score > s.highscore) localStorage.setItem('gtc_highscore', score);
}

function saveAccuracy(correct, total) {
    const s = loadStorage();
    localStorage.setItem('gtc_totalCorrect', s.totalCorrect + correct);
    localStorage.setItem('gtc_totalAnswers', s.totalAnswers + total);
}

function globalAccuracyStr() {
    const s = loadStorage();
    if (s.totalAnswers === 0) return '0%';
    return Math.round((s.totalCorrect / s.totalAnswers) * 100) + '%';
}

// ─── PILL SELECT HELPER ───────────────────────────────────────────────────────

function initPillGroup(groupEl, onChange) {
    groupEl.querySelectorAll('.pill').forEach(pill => {
        pill.addEventListener('click', () => {
            soundClick();
            groupEl.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            onChange(pill.dataset.val);
        });
    });
}

// ─── SCREEN TRANSITIONS ───────────────────────────────────────────────────────

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
    // Re-trigger fade animation
    screens[name].style.animation = 'none';
    void screens[name].offsetWidth;
    screens[name].style.animation = '';
}

// ─── TIMER RING ───────────────────────────────────────────────────────────────

const ROUND_TIME = 5; // seconds

function setRing(secondsLeft) {
    const fraction = secondsLeft / ROUND_TIME;
    const offset = RING_CIRCUMFERENCE * (1 - fraction);
    ringProgress.style.strokeDashoffset = offset;
    ringProgress.style.strokeDasharray = RING_CIRCUMFERENCE;

    ringProgress.classList.remove('warn', 'danger');
    if (fraction <= 0.4) ringProgress.classList.add('danger');
    else if (fraction <= 0.6) ringProgress.classList.add('warn');

    timerNum.textContent = secondsLeft;
}

function startTimer(onExpire) {
    clearInterval(timerInterval);
    let left = ROUND_TIME;
    setRing(left);
    timerInterval = setInterval(() => {
        left--;
        setRing(left);
        if (left <= 0) {
            clearInterval(timerInterval);
            onExpire();
        }
    }, 1000);
}

function stopTimer() { clearInterval(timerInterval); }

// ─── INIT MENU ────────────────────────────────────────────────────────────────

function initMenu() {
    const s = loadStorage();
    menuHighscore.textContent = s.highscore;
    menuAccuracy.textContent = globalAccuracyStr();

    initPillGroup(diffGroup, val => { settings.difficulty = val; });
    initPillGroup(modeGroup, val => { settings.mode = val; });

    soundToggle.addEventListener('change', () => { settings.sound = soundToggle.checked; });
    btnStart.addEventListener('click', () => { soundClick(); startGame(); });
}

// ─── START GAME ───────────────────────────────────────────────────────────────

function startGame() {
    state = {
        score: 0,
        streak: 0,        // consecutive correct
        maxStreak: 0,
        totalAnswered: 0,
        totalCorrect: 0,
        difficulty: settings.difficulty,
        mode: settings.mode,
    };

    updateScoreUI();
    updateComboUI();
    updateAccuracyUI();

    modeTag.textContent = settings.mode === 'trick'
        ? '🤯 TRICK MODE — pick the FONT color, not the word!'
        : '';

    showScreen('game');
    nextRound();
}

// ─── NEXT ROUND ───────────────────────────────────────────────────────────────

function nextRound() {
    stopTimer();

    const colorPool = settings.difficulty === 'hard' ? HARD_COLORS
        : settings.difficulty === 'medium' ? MEDIUM_COLORS
            : EASY_COLORS;

    const optionCount = OPTION_COUNT[settings.difficulty];

    // The "answer" color is the true answer (font color)
    const answerColor = colorPool[Math.floor(Math.random() * colorPool.length)];

    // The displayed word text
    let displayWord;
    if (settings.mode === 'trick') {
        // Pick a different color name for the word text
        const others = colorPool.filter(c => c.name !== answerColor.name);
        const wordColor = others[Math.floor(Math.random() * others.length)];
        displayWord = wordColor.name.toUpperCase();
    } else {
        displayWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    }

    // Store round data
    state.answerColor = answerColor;
    state.displayWord = displayWord;

    // Reset card
    wordDisplay.textContent = displayWord;
    wordDisplay.style.color = answerColor.hex;
    wordDisplay.classList.remove('word-pop');
    gameCard.classList.remove('flash-green', 'flash-red');

    void wordDisplay.offsetWidth;
    wordDisplay.classList.add('word-pop');

    msgMain.style.color = 'var(--muted)';
    msgMain.textContent = settings.mode === 'trick'
        ? 'What is the FONT color?'
        : 'Memorize the color!';
    hideMotivation();

    optionsGrid.classList.remove('visible');
    optionsGrid.innerHTML = '';

    // After 1.5s, hide color and show options
    clearTimeout(showTimer);
    showTimer = setTimeout(() => {
        wordDisplay.style.color = 'var(--text)';
        wordDisplay.classList.remove('word-pop');
        msgMain.textContent = 'What was the color?';
        showOptions(answerColor, colorPool, optionCount);
        startTimer(onTimeout);
    }, 1500);
}

// ─── SHOW OPTIONS ─────────────────────────────────────────────────────────────

function showOptions(correctColor, colorPool, count) {
    const options = buildOptions(correctColor, colorPool, count);
    optionsGrid.innerHTML = '';
    optionsGrid.style.gridTemplateColumns = count === 3
        ? 'repeat(3,1fr)'
        : 'repeat(3,1fr)';

    options.forEach(color => {
        const btn = document.createElement('button');
        btn.className = 'color-btn';
        btn.id = `btn-color-${color.name.replace(/\s/g, '')}`;
        btn.style.backgroundColor = color.hex;
        btn.textContent = color.name;
        btn.addEventListener('click', () => handleGuess(color, correctColor));
        optionsGrid.appendChild(btn);
    });

    optionsGrid.classList.add('visible');
}

function buildOptions(correct, pool, count) {
    const others = pool.filter(c => c.name !== correct.name);
    others.sort(() => 0.5 - Math.random());
    const picks = [correct, ...others.slice(0, count - 1)];
    picks.sort(() => 0.5 - Math.random());
    return picks;
}

// ─── HANDLE GUESS ─────────────────────────────────────────────────────────────

function handleGuess(guessed, correct) {
    stopTimer();
    disableOptions();
    state.totalAnswered++;

    if (guessed.name === correct.name) {
        onCorrect(guessed);
    } else {
        onWrong(guessed, correct);
    }
}

function onCorrect(guessed) {
    state.totalCorrect++;
    state.streak++;
    if (state.streak > state.maxStreak) state.maxStreak = state.streak;

    // Points
    let points = 10;
    let bonusMsg = '';
    if (state.streak >= 5) {
        points = 30;
        bonusMsg = '🎉 BONUS x3!';
        soundCombo();
    } else if (state.streak >= 3) {
        points = 20;
        bonusMsg = '🔥 DOUBLE points!';
        soundCombo();
    } else {
        soundCorrect();
    }
    state.score += points;

    // Find button and mark correct
    const btn = findBtn(guessed.name);
    if (btn) btn.classList.add('correct');

    // Flash card green
    flashCard('green');

    // Messages
    const motIdx = Math.min(state.streak - 1, MSG_CORRECT.length - 1);
    const motText = bonusMsg || MSG_CORRECT[motIdx];
    msgMain.textContent = `Correct! +${points} pts`;
    msgMain.style.color = 'var(--green)';
    showMotivation(motText, bonusMsg ? '#f59e0b' : '#38bdf8');

    updateScoreUI();
    updateComboUI();
    updateAccuracyUI();

    setTimeout(nextRound, 1300);
}

function onWrong(guessed, correct) {
    state.streak = 0;
    soundWrong();

    const btn = findBtn(guessed.name);
    if (btn) btn.classList.add('wrong');

    // Reveal correct
    const correctBtn = findBtn(correct.name);
    if (correctBtn) correctBtn.classList.add('correct');

    // Fade others
    document.querySelectorAll('.color-btn').forEach(b => {
        if (b !== btn && b !== correctBtn) b.classList.add('faded');
    });

    flashCard('red');

    const mot = MSG_WRONG[Math.floor(Math.random() * MSG_WRONG.length)];
    msgMain.textContent = `Wrong! It was ${correct.name}.`;
    msgMain.style.color = 'var(--red)';
    showMotivation(mot, '#f97316');

    updateComboUI();
    updateAccuracyUI();

    setTimeout(showResult, 2200);
}

function onTimeout() {
    state.streak = 0;
    soundTimeout();
    disableOptions();

    // Reveal correct answer
    const correctBtn = findBtn(state.answerColor.name);
    if (correctBtn) correctBtn.classList.add('correct');

    document.querySelectorAll('.color-btn').forEach(b => {
        if (b !== correctBtn) b.classList.add('faded');
    });

    const mot = MSG_TIMEOUT[Math.floor(Math.random() * MSG_TIMEOUT.length)];
    msgMain.textContent = `Time's up! It was ${state.answerColor.name}.`;
    msgMain.style.color = '#f59e0b';
    showMotivation(mot, '#f59e0b');

    flashCard('red');
    updateComboUI();
    updateAccuracyUI();

    setTimeout(showResult, 2200);
}

// ─── RESULT SCREEN ───────────────────────────────────────────────────────────

function showResult() {
    stopTimer();
    clearTimeout(showTimer);

    const s = loadStorage();
    const isNewBest = state.score > s.highscore;

    saveHighscore(state.score);
    saveAccuracy(state.totalCorrect, state.totalAnswered);

    const accuracy = state.totalAnswered === 0
        ? '0%'
        : Math.round((state.totalCorrect / state.totalAnswered) * 100) + '%';

    const newBest = Math.max(state.score, s.highscore);

    // Populate result screen
    resultIcon.textContent = state.score >= 50 ? '🏆' : state.score >= 20 ? '🎉' : '😅';
    resultTitle.textContent = isNewBest ? 'New High Score!' : 'Game Over!';
    resultSub.textContent = isNewBest
        ? 'You crushed it! 🚀'
        : state.score >= 30 ? 'Great effort! Keep going!' : 'Practice makes perfect!';

    rsScore.textContent = state.score;
    rsBest.textContent = newBest;
    rsAccuracy.textContent = accuracy;
    rsCombo.textContent = `x${state.maxStreak}`;

    showScreen('result');
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────

function updateScoreUI() {
    scoreEl.textContent = state.score;
    scoreEl.parentElement.style.transform = 'scale(1.3)';
    setTimeout(() => { scoreEl.parentElement.style.transform = 'scale(1)'; }, 250);
}

function updateComboUI() {
    if (state.streak >= 3) {
        comboCEl.classList.remove('hidden');
        comboCountEl.textContent = state.streak;
    } else {
        comboCEl.classList.add('hidden');
    }
}

function updateAccuracyUI() {
    if (state.totalAnswered === 0) { accuracyLive.textContent = '100%'; return; }
    const pct = Math.round((state.totalCorrect / state.totalAnswered) * 100);
    accuracyLive.textContent = pct + '%';
}

function flashCard(type) {
    gameCard.classList.remove('flash-green', 'flash-red');
    void gameCard.offsetWidth;
    gameCard.classList.add(`flash-${type}`);
    setTimeout(() => gameCard.classList.remove(`flash-${type}`), 600);
}

function findBtn(colorName) {
    return document.getElementById(`btn-color-${colorName.replace(/\s/g, '')}`);
}

function disableOptions() {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.add('disabled'));
}

function showMotivation(text, color = '#38bdf8') {
    msgMotivation.classList.remove('show');
    void msgMotivation.offsetWidth;
    msgMotivation.textContent = text;
    msgMotivation.style.color = color;
    msgMotivation.classList.add('show');
    setTimeout(() => msgMotivation.classList.remove('show'), 1200);
}

function hideMotivation() {
    msgMotivation.classList.remove('show');
    msgMotivation.textContent = '';
}

// ─── RESTART ─────────────────────────────────────────────────────────────────

function restartGame() {
    soundClick();
    stopTimer();
    clearTimeout(showTimer);

    // Show result first if any answers were given
    if (state.totalAnswered > 0) {
        showResult();
    } else {
        startGame();
    }
}

// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────

btnRestart.addEventListener('click', restartGame);
btnPlayAgain.addEventListener('click', () => { soundClick(); startGame(); });
btnMenu.addEventListener('click', () => {
    soundClick();
    stopTimer();
    clearTimeout(showTimer);
    showScreen('menu');
    initMenu();
});

// ─── BOOT ────────────────────────────────────────────────────────────────────

initMenu();
