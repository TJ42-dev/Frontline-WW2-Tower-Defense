import { GRID_WIDTH, GRID_HEIGHT, END_POS } from '../constants';
import { Cell, FlowDirection, Point } from '../types';

// Returns a 2D array of FlowDirections.
// If a cell has dist = Infinity, it is unreachable.
export const calculateFlowField = (grid: Cell[][], target: Point): FlowDirection[][] => {
  // CRITICAL FIX: Use Array.from to create unique objects for each cell. 
  // Previous .fill() created shared references which broke the pathfinding.
  const field: FlowDirection[][] = Array.from({ length: GRID_WIDTH }, () => 
    Array.from({ length: GRID_HEIGHT }, () => ({ dx: 0, dy: 0, dist: Infinity }))
  );

  const queue: Point[] = [];
  
  // Initialize target
  if (target.x >= 0 && target.x < GRID_WIDTH && target.y >= 0 && target.y < GRID_HEIGHT) {
    field[target.x][target.y] = { dx: 0, dy: 0, dist: 0 };
    queue.push(target);
  }

  const directions = [
    { x: 0, y: -1 }, // Up
    { x: 1, y: 0 },  // Right
    { x: 0, y: 1 },  // Down
    { x: -1, y: 0 }  // Left
  ];

  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const currentDist = field[current.x][current.y].dist;

    for (const dir of directions) {
      const neighbor = { x: current.x + dir.x, y: current.y + dir.y };

      // Bounds check
      if (
        neighbor.x >= 0 && neighbor.x < GRID_WIDTH &&
        neighbor.y >= 0 && neighbor.y < GRID_HEIGHT
      ) {
        // Wall check
        if (grid[neighbor.x][neighbor.y].isWall) continue;

        // If we found a shorter path to this neighbor
        if (field[neighbor.x][neighbor.y].dist > currentDist + 1) {
            // The direction for the neighbor to travel IS towards current
            // so dx/dy is -dir.x, -dir.y
            field[neighbor.x][neighbor.y] = {
                dx: -dir.x,
                dy: -dir.y,
                dist: currentDist + 1
            };
            queue.push(neighbor);
        }
      }
    }
  }

  return field;
};

// Check if a path exists from start to end
export const isPathPossible = (grid: Cell[][], start: Point, end: Point): boolean => {
  const field = calculateFlowField(grid, end);
  return field[start.x][start.y].dist !== Infinity;
};
