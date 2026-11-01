// ============================================================================
// SpatialGrid.js — Otimização Espacial 2D em Grade Hash (Células de 30x30 metros)
// Elimina loops globais O(N^2): raycasts, visão de IA e colisões consultam apenas
// a célula atual e as 8 vizinhas imediatas.
// Matemática 100% otimizada: usa lengthSq e distanceToSquared sem raízes quadradas.
// ============================================================================

export const DEFAULT_CELL_SIZE = 30.0;

export class SpatialGrid {
  /**
   * @param {number} [cellSize=30.0] Tamanho de cada célula em metros
   */
  constructor(cellSize = DEFAULT_CELL_SIZE) {
    this.cellSize = cellSize;
    this.invCell = 1.0 / cellSize;
    this.cells = new Map();
    this.queryStamp = 1;
    this._candidateResults = [];
  }

  /**
   * Converte coordenadas mundiais (X, Z) em chave inteira de célula.
   * @param {number} x
   * @param {number} z
   * @returns {string}
   */
  cellKey(x, z) {
    const cx = Math.floor(x * this.invCell);
    const cz = Math.floor(z * this.invCell);
    return `${cx}_${cz}`;
  }

  /**
   * Insere uma entidade na grade espacial.
   * @param {object} entity Objeto com x e z (e raio opcional)
   * @param {number} [radius=0.5]
   */
  insertEntity(entity, radius = 0.5) {
    if (!entity) return;
    const x = entity.x ?? 0;
    const z = entity.z ?? 0;
    const rad = entity.radius ?? radius;

    const minCX = Math.floor((x - rad) * this.invCell);
    const maxCX = Math.floor((x + rad) * this.invCell);
    const minCZ = Math.floor((z - rad) * this.invCell);
    const maxCZ = Math.floor((z + rad) * this.invCell);

    entity._spatialCells = entity._spatialCells || [];
    entity._spatialCells.length = 0;
    entity._lastGridX = x;
    entity._lastGridZ = z;

    for (let cz = minCZ; cz <= maxCZ; cz++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const key = `${cx}_${cz}`;
        let cell = this.cells.get(key);
        if (!cell) {
          cell = [];
          this.cells.set(key, cell);
        }
        cell.push(entity);
        entity._spatialCells.push(cell);
      }
    }
  }

  /**
   * Atualiza a posição de uma entidade na grade apenas se cruzar o limiar de célula.
   * @param {object} entity
   * @param {number} newX
   * @param {number} newZ
   * @param {number} [radius=0.5]
   */
  updateEntity(entity, newX, newZ, radius = 0.5) {
    if (!entity) return;
    const lx = entity._lastGridX ?? entity.x ?? 0;
    const lz = entity._lastGridZ ?? entity.z ?? 0;

    // Se moveu menos que 2.5 metros e permaneceu na mesma célula básica, evita realocação
    const dSq = (newX - lx) * (newX - lx) + (newZ - lz) * (newZ - lz);
    if (dSq < 6.25 && entity._spatialCells && entity._spatialCells.length > 0) {
      entity.x = newX;
      entity.z = newZ;
      return;
    }

    this.removeEntity(entity);
    entity.x = newX;
    entity.z = newZ;
    this.insertEntity(entity, radius);
  }

  /**
   * Remove uma entidade da grade espacial.
   * @param {object} entity
   */
  removeEntity(entity) {
    if (!entity || !entity._spatialCells) return;
    const cells = entity._spatialCells;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const idx = cell.indexOf(entity);
      if (idx !== -1) {
        cell.splice(idx, 1);
      }
    }
    cells.length = 0;
  }

  /**
   * Consulta rápida de entidades na célula atual e nas 8 vizinhas imediatas (bloco 3x3).
   * @param {number} x
   * @param {number} z
   * @param {Array} [outList=this._candidateResults] Array reutilizado (Zero-GC)
   * @returns {Array} Lista de candidatos preenchida
   */
  queryNeighborCells(x, z, outList = this._candidateResults) {
    outList.length = 0;
    const stamp = ++this.queryStamp;

    const centerCX = Math.floor(x * this.invCell);
    const centerCZ = Math.floor(z * this.invCell);

    for (let cz = centerCZ - 1; cz <= centerCZ + 1; cz++) {
      for (let cx = centerCX - 1; cx <= centerCX + 1; cx++) {
        const cell = this.cells.get(`${cx}_${cz}`);
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

  /**
   * Consulta exata por raio utilizando distanceToSquared (sem raiz quadrada pesada).
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {Array} [outList=this._candidateResults]
   * @returns {Array}
   */
  queryRadius(x, z, radius, outList = this._candidateResults) {
    outList.length = 0;
    const stamp = ++this.queryStamp;
    const radiusSq = radius * radius;

    const minCX = Math.floor((x - radius) * this.invCell);
    const maxCX = Math.floor((x + radius) * this.invCell);
    const minCZ = Math.floor((z - radius) * this.invCell);
    const maxCZ = Math.floor((z + radius) * this.invCell);

    for (let cz = minCZ; cz <= maxCZ; cz++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const cell = this.cells.get(`${cx}_${cz}`);
        if (!cell) continue;

        for (let i = 0; i < cell.length; i++) {
          const item = cell[i];
          if (item._spatialStamp !== stamp) {
            item._spatialStamp = stamp;
            const ix = item.x ?? item.centerX ?? 0;
            const iz = item.z ?? item.centerZ ?? 0;
            const irad = item.radius ?? 0;
            const totalRad = radius + irad;
            const dSq = (ix - x) * (ix - x) + (iz - z) * (iz - z);
            if (dSq <= totalRad * totalRad) {
              outList.push(item);
            }
          }
        }
      }
    }
    return outList;
  }

  /**
   * Limpa a grade inteira.
   */
  clear() {
    this.cells.clear();
    this._candidateResults.length = 0;
  }
}
