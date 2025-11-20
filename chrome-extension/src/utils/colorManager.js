// ABOUTME: Manages color cycling for tab groups across the extension.
// ABOUTME: Provides shared state and functions to ensure consistent color assignment.

const COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
let colorIndex = 0;

function getNextColor() {
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex++;
  return color;
}

function resetColorIndex() {
  colorIndex = 0;
}

module.exports = { getNextColor, COLORS, resetColorIndex };
