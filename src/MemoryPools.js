import * as THREE from "three";

// ============================================================================
// MemoryPools.js — Erradicação do Garbage Collector & Gerenciamento de Pools
// Pré-aloca instâncias fixas no boot. Proibido scene.add/remove dinâmicos.
// Todos os vetores, matrizes e quatérnios auxiliares são reutilizados globalmente.
// ============================================================================

// 1. Vetores e Matrizes Auxiliares Globais de Scratch (Zero-GC no loop principal)
export const SCRATCH = Object.freeze({
  VEC3_0: new THREE.Vector3(),
  VEC3_1: new THREE.Vector3(),
  VEC3_2: new THREE.Vector3(),
  VEC3_3: new THREE.Vector3(),
  QUAT_0: new THREE.Quaternion(),
  QUAT_1: new THREE.Quaternion(),
  EULER_0: new THREE.Euler(),
  MAT4_0: new THREE.Matrix4(),
  MAT4_1: new THREE.Matrix4(),
  COLOR_0: new THREE.Color(),
  COLOR_1: new THREE.Color(),
  BOX3_0: new THREE.Box3(),
  SPHERE_0: new THREE.Sphere(),
});

/**
 * Classe Genérica de Object Pool (Zero-GC).
 */
export class ObjectPool {
  /**
   * @param {Function} factoryFn Cria um novo item pré-alocado
   * @param {number} [initialCapacity=32]
   * @param {THREE.Scene|THREE.Group} [parentContainer=null] Contêiner onde os itens são adicionados 1 única vez
   */
  constructor(factoryFn, initialCapacity = 32, parentContainer = null) {
    this.factoryFn = factoryFn;
    this.parent = parentContainer;
    this.pool = [];
    this.active = [];

    // Pré-alocação inicial obrigatória
    for (let i = 0; i < initialCapacity; i++) {
      const item = this.factoryFn(i);
      if (item.visible !== undefined) item.visible = false;
      if (item.root && item.root.visible !== undefined) item.root.visible = false;
      if (this.parent) {
        if (item.isObject3D) this.parent.add(item);
        else if (item.root && item.root.isObject3D) this.parent.add(item.root);
      }
      this.pool.push(item);
    }
  }

  /**
   * Obtém um objeto inativo do pool e o ativa.
   * @returns {*}
   */
  acquire() {
    let item = this.pool.pop();
    if (!item) {
      // Se estourar a capacidade inicial, expande mantendo a regra de integridade
      item = this.factoryFn(this.active.length + this.pool.length);
      if (this.parent) {
        if (item.isObject3D) this.parent.add(item);
        else if (item.root && item.root.isObject3D) this.parent.add(item.root);
      }
    }

    if (item.visible !== undefined) item.visible = true;
    if (item.root && item.root.visible !== undefined) item.root.visible = true;
    if (item.onAcquire) item.onAcquire();

    this.active.push(item);
    return item;
  }

  /**
   * Devolve o objeto ao pool, desativando sua renderização.
   * @param {*} item
   */
  release(item) {
    if (!item) return;
    const idx = this.active.indexOf(item);
    if (idx !== -1) {
      this.active.splice(idx, 1);
    }

    if (item.visible !== undefined) item.visible = false;
    if (item.root && item.root.visible !== undefined) item.root.visible = false;
    if (item.onRelease) item.onRelease();

    this.pool.push(item);
  }

  /**
   * Devolve todos os itens ativos para o pool.
   */
  releaseAll() {
    while (this.active.length > 0) {
      const item = this.active.pop();
      if (item.visible !== undefined) item.visible = false;
      if (item.root && item.root.visible !== undefined) item.root.visible = false;
      if (item.onRelease) item.onRelease();
      this.pool.push(item);
    }
  }

  get activeCount() {
    return this.active.length;
  }

  get totalCapacity() {
    return this.active.length + this.pool.length;
  }
}

// 2. Gerenciador Global Centralizado de Pools de Memória
export class MemoryPoolManager {
  constructor(scene = null) {
    this.scene = scene;
    this.pools = new Map();
  }

  registerPool(name, factoryFn, capacity = 32, container = this.scene) {
    const p = new ObjectPool(factoryFn, capacity, container);
    this.pools.set(name, p);
    return p;
  }

  getPool(name) {
    return this.pools.get(name) || null;
  }

  acquire(name) {
    const p = this.pools.get(name);
    return p ? p.acquire() : null;
  }

  release(name, item) {
    const p = this.pools.get(name);
    if (p) p.release(item);
  }
}

export const GlobalMemoryPools = new MemoryPoolManager();
