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
