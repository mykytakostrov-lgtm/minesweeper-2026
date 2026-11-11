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
