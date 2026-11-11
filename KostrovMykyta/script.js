/**
 * Практична робота №2. Логіка та інтерактивність гри у JavaScript та DOM
 * Гра «Сапер» (Minesweeper) — Розділення Data Layer та DOM Rendering Layer
 */

'use strict';

// Конфігурації рівнів складності
const DIFFICULTY_PRESETS = {
  beginner: { rows: 9, cols: 9, minesCount: 10 },
  standard: { rows: 10, cols: 10, minesCount: 15 },
  intermediate: { rows: 16, cols: 16, minesCount: 40 },
};

// ============================================================================
// КРОК 1. Моделювання даних (Data Layer)
// ============================================================================
const gameState = {
  rows: 10,
  cols: 10,
  minesCount: 15,
  status: 'process', // 'process' | 'win' | 'lose'
  gameTime: 0,
  timerId: null,
  flagsPlaced: 0,
  firstClickDone: false,
  board: [],
};

/**
 * Створює порожню двовимірну сітку клітинок
 */
function createEmptyBoard(rows, cols) {
  const field = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        row: r,
        col: c,
        type: 'empty',       // 'empty' | 'mine'
        state: 'closed',     // 'closed' | 'opened' | 'flagged'
        neighborMines: 0,    // Число від 0 до 8
        exploded: false,
      });
    }
    field.push(row);
  }
  return field;
}

// ============================================================================
// КРОК 2. Генерація поля та мін (з гарантією безпечного першого кліку)
// ============================================================================
function placeMines(field, rows, cols, minesCount, safeRow = -1, safeCol = -1) {
  let placed = 0;
  while (placed < minesCount) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);

    // Забороняємо ставити міну у клітинку першого кліку та її безпосередніх сусідів
    const isSafeZone =
      safeRow !== -1 &&
      Math.abs(r - safeRow) <= 1 &&
      Math.abs(c - safeCol) <= 1;

    if (field[r][c].type !== 'mine' && !isSafeZone) {
      field[r][c].type = 'mine';
      placed++;
    }
  }
}

function generateField(rows, cols, minesCount, safeRow = -1, safeCol = -1) {
  const field = createEmptyBoard(rows, cols);
  placeMines(field, rows, cols, minesCount, safeRow, safeCol);
  countNeighbourMines(field, rows, cols);
  return field;
}

// ============================================================================
// КРОК 3. Алгоритмічна частина (Business Logic)
// ============================================================================
function countNeighbourMines(field, rows = field.length, cols = field[0].length) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (field[r][c].type === 'mine') {
        field[r][c].neighborMines = 0;
        continue;
      }

      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            if (field[nr][nc].type === 'mine') {
              count++;
            }
          }
        }
      }
      field[r][c].neighborMines = count;
    }
  }
}

// Аліас відповідно до специфікації
const calculateNeighbors = countNeighbourMines;

/**
 * Рекурсивне відкриття порожніх сусідніх клітинок (Flood-Fill / DFS)
 */
function revealEmptyCells(row, col) {
  const { rows, cols, board } = gameState;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        const neighbor = board[nr][nc];
        if (neighbor.state === 'closed' && neighbor.type === 'empty') {
          neighbor.state = 'opened';
          if (neighbor.neighborMines === 0) {
            revealEmptyCells(nr, nc);
          }
        }
      }
    }
  }
}

/**
 * Відкриття клітинки користувачем
 */
function openCell(row, col) {
  if (gameState.status !== 'process') return;

  const cell = gameState.board[row][col];

  // Якщо клітинка вже відкрита або позначена прапорцем — ігноруємо
  if (cell.state === 'opened' || cell.state === 'flagged') {
    return;
  }

  // Якщо це перший клік у грі — генеруємо міни так, щоб (row, col) була безпечною
  if (!gameState.firstClickDone) {
    gameState.firstClickDone = true;
    placeMines(gameState.board, gameState.rows, gameState.cols, gameState.minesCount, row, col);
    countNeighbourMines(gameState.board, gameState.rows, gameState.cols);
    startTimer();
  }

  cell.state = 'opened';

  // Перевірка на підрив міни
  if (cell.type === 'mine') {
    cell.exploded = true;
    gameState.status = 'lose';
    stopTimer();
    revealAllMines();
    updateUI();
    return;
  }

  // Якщо навколо немає мін — рекурсивно відкриваємо сусідню область
  if (cell.neighborMines === 0) {
    revealEmptyCells(row, col);
  }

  // Перевірка умови перемоги
  checkWinCondition();
  updateUI();
}

/**
 * Розкриває всі міни після поразки
 */
function revealAllMines() {
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = gameState.board[r][c];
      if (cell.type === 'mine' && cell.state !== 'flagged') {
        cell.state = 'opened';
      }
    }
  }
}

/**
 * КРОК 8. Перевірка умови перемоги (всі безпечні клітинки відкриті)
 */
function checkWinCondition() {
  let unopenedSafeCells = 0;
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = gameState.board[r][c];
      if (cell.type === 'empty' && cell.state !== 'opened') {
        unopenedSafeCells++;
      }
    }
  }

  if (unopenedSafeCells === 0 && gameState.status === 'process') {
    gameState.status = 'win';
    stopTimer();
    // Автоматично позначаємо всі міни прапорцями при перемозі
    for (let r = 0; r < gameState.rows; r++) {
      for (let c = 0; c < gameState.cols; c++) {
        const cell = gameState.board[r][c];
        if (cell.type === 'mine') {
          cell.state = 'flagged';
        }
      }
    }
    gameState.flagsPlaced = gameState.minesCount;
  }
}

// ============================================================================
// КРОК 4. Таймер та прапорці
// ============================================================================
function toggleFlag(row, col) {
  if (gameState.status !== 'process') return;

  const cell = gameState.board[row][col];
  if (cell.state === 'opened') return;

  if (cell.state === 'closed') {
    if (gameState.flagsPlaced >= gameState.minesCount) return;
    cell.state = 'flagged';
    gameState.flagsPlaced++;
  } else if (cell.state === 'flagged') {
    cell.state = 'closed';
    gameState.flagsPlaced--;
  }

  updateUI();
}

function startTimer() {
  stopTimer();
  gameState.timerId = setInterval(() => {
    if (gameState.status === 'process' && gameState.gameTime < 999) {
      gameState.gameTime++;
      updateHeaderDisplays();
    }
  }, 1000);
}

function stopTimer() {
  if (gameState.timerId !== null) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

// ============================================================================
// КРОК 5 та КРОК 6. Рендеринг ігрового поля та оновлення DOM
// ============================================================================
const boardElement = document.getElementById('game-board');
const flagsCounterEl = document.getElementById('flags-counter');
const timerDisplayEl = document.getElementById('timer-display');
const statusEmojiEl = document.getElementById('status-emoji');
const statusBannerEl = document.getElementById('status-banner');
const restartBtn = document.getElementById('restart-btn');
const newGameBtn = document.getElementById('new-game-btn');
const difficultySelect = document.getElementById('difficulty-select');

function formatThreeDigits(num) {
  const clamped = Math.max(-99, Math.min(999, num));
  return clamped < 0
    ? '-' + String(Math.abs(clamped)).padStart(2, '0')
    : String(clamped).padStart(3, '0');
}

function updateHeaderDisplays() {
  const remainingFlags = gameState.minesCount - gameState.flagsPlaced;
  flagsCounterEl.textContent = formatThreeDigits(remainingFlags);
  timerDisplayEl.textContent = formatThreeDigits(gameState.gameTime);

  if (gameState.status === 'win') {
    statusEmojiEl.textContent = '😎';
    statusBannerEl.textContent = `Перемога! Ви успішно розмінували поле за ${gameState.gameTime} с!`;
    statusBannerEl.className = 'status-banner status-banner--win';
  } else if (gameState.status === 'lose') {
    statusEmojiEl.textContent = '😵';
    statusBannerEl.textContent = 'Поразка! Ви натрапили на міну. Натисніть «Нова гра» або смайлик для повтору.';
    statusBannerEl.className = 'status-banner status-banner--lose';
  } else {
    statusEmojiEl.textContent = '😊';
    statusBannerEl.textContent = gameState.firstClickDone
      ? 'Статус: Гра триває — відкривайте безпечні клітинки'
      : 'Статус: У процесі гри — зробіть перший хід (перший клік завжди безпечний)';
    statusBannerEl.className = 'status-banner status-banner--process';
  }
}

function renderBoard() {
  boardElement.innerHTML = '';
  boardElement.style.gridTemplateColumns = `repeat(${gameState.cols}, var(--cell-size))`;
  boardElement.style.gridTemplateRows = `repeat(${gameState.rows}, var(--cell-size))`;

  const fragment = document.createDocumentFragment();

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cellData = gameState.board[r][c];
      const cellDiv = document.createElement('div');
      cellDiv.classList.add('cell');
      cellDiv.dataset.row = String(r);
      cellDiv.dataset.col = String(c);
      cellDiv.setAttribute('role', 'gridcell');

      if (cellData.state === 'closed') {
        cellDiv.classList.add('cell--closed');
      } else if (cellData.state === 'flagged') {
        cellDiv.classList.add('cell--flagged');
        cellDiv.textContent = '🚩';
      } else if (cellData.state === 'opened') {
        if (cellData.type === 'mine') {
          if (cellData.exploded) {
            cellDiv.classList.add('cell--mine-exploded');
            cellDiv.textContent = '💥';
          } else {
            cellDiv.classList.add('cell--mine');
            cellDiv.textContent = '💣';
          }
        } else {
          cellDiv.classList.add('cell--opened');
          if (cellData.neighborMines > 0) {
            cellDiv.classList.add(`cell--num-${cellData.neighborMines}`);
            cellDiv.textContent = String(cellData.neighborMines);
          }
        }
      }

      fragment.appendChild(cellDiv);
    }
  }

  boardElement.appendChild(fragment);
}

function updateUI() {
  updateHeaderDisplays();
  renderBoard();
}

// ============================================================================
// КРОК 7. Обробка подій користувача (Event Delegation)
// ============================================================================
boardElement.addEventListener('click', (event) => {
  const target = event.target.closest('.cell');
  if (!target) return;
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  openCell(row, col);
});

boardElement.addEventListener('contextmenu', (event) => {
  event.preventDefault(); // Блокуємо стандартне контекстне меню браузера
  const target = event.target.closest('.cell');
  if (!target) return;
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  toggleFlag(row, col);
});

function initNewGame() {
  const presetKey = difficultySelect.value;
  const preset = DIFFICULTY_PRESETS[presetKey] || DIFFICULTY_PRESETS.standard;

  stopTimer();
  gameState.rows = preset.rows;
  gameState.cols = preset.cols;
  gameState.minesCount = preset.minesCount;
  gameState.status = 'process';
  gameState.gameTime = 0;
  gameState.flagsPlaced = 0;
  gameState.firstClickDone = false;
  gameState.board = createEmptyBoard(preset.rows, preset.cols);

  updateUI();
}

restartBtn.addEventListener('click', initNewGame);
newGameBtn.addEventListener('click', initNewGame);
difficultySelect.addEventListener('change', initNewGame);

// Ініціалізація при завантаженні сторінки
document.addEventListener('DOMContentLoaded', initNewGame);
