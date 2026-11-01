// ============================================================================
// Spatial Hash Grid (Células de 16x16 metros para física e raycasts em O(1))
// Reduz testes de colisão de milhares de iterações O(N) para < 10 por frame.
// ============================================================================

const CELL_SIZE = 16.0;
const INV_CELL = 1.0 / CELL_SIZE;

export class SpatialHashGrid {
  constructor(cellSize = CELL_SIZE) {
    this.cellSize = cellSize;
    this.invCell = 1.0 / cellSize;
    this.cells = new Map();
    this.queryStamp = 1;
  }

  _cellKey(cx, cz) {
    // Chave inteira otimizada ou string
    return `${cx}_${cz}`;
  }

  insert(item, minX, minZ, maxX, maxZ) {
    if (!item) return;
    const minCX = Math.floor(minX * this.invCell);
    const maxCX = Math.floor(maxX * this.invCell);
    const minCZ = Math.floor(minZ * this.invCell);
    const maxCZ = Math.floor(maxZ * this.invCell);

    item._spatialCells = item._spatialCells || [];
    item._spatialCells.length = 0;

    for (let cz = minCZ; cz <= maxCZ; cz++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const key = this._cellKey(cx, cz);
        let cell = this.cells.get(key);
        if (!cell) {
          cell = [];
          this.cells.set(key, cell);
        }
        cell.push(item);
        item._spatialCells.push(cell);
      }
    }
  }

  insertCircle(item, x, z, radius) {
    this.insert(item, x - radius, z - radius, x + radius, z + radius);
  }

  remove(item) {
    if (!item || !item._spatialCells) return;
    const cells = item._spatialCells;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const idx = cell.indexOf(item);
      if (idx !== -1) {
        cell.splice(idx, 1);
      }
    }
    cells.length = 0;
  }

  queryRadius(x, z, radius, outList) {
    outList.length = 0;
    const stamp = ++this.queryStamp;

    const minCX = Math.floor((x - radius) * this.invCell);
    const maxCX = Math.floor((x + radius) * this.invCell);
    const minCZ = Math.floor((z - radius) * this.invCell);
    const maxCZ = Math.floor((z + radius) * this.invCell);

    for (let cz = minCZ; cz <= maxCZ; cz++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const cell = this.cells.get(this._cellKey(cx, cz));
        if (!cell) continue;

        for (let i = 0; i < cell.length; i++) {
          const item = cell[i];
          if (item._spatialStamp !== stamp) {
            item._spatialStamp = stamp;
            outList.push(item);
          }
        }
      }
    }
    return outList;
  }

  queryBox(minX, minZ, maxX, maxZ, outList) {
    outList.length = 0;
    const stamp = ++this.queryStamp;

    const minCX = Math.floor(minX * this.invCell);
    const maxCX = Math.floor(maxX * this.invCell);
    const minCZ = Math.floor(minZ * this.invCell);
    const maxCZ = Math.floor(maxZ * this.invCell);

    for (let cz = minCZ; cz <= maxCZ; cz++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const cell = this.cells.get(this._cellKey(cx, cz));
        if (!cell) continue;

        for (let i = 0; i < cell.length; i++) {
          const item = cell[i];
          if (item._spatialStamp !== stamp) {
            item._spatialStamp = stamp;
            outList.push(item);
          }
        }
      }
    }
    return outList;
  }

  clear() {
    this.cells.clear();
  }
}
