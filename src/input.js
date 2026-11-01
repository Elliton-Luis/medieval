export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.zoomDelta = 0;
    this.wheelAccum = 0;
    this.jumpPressed = false;
    this.attackPressed = false;
    this.attackHeld = false;
    this.aimHeld = false;
    this.interactPressed = false;
    this.usePressed = false;
    this.dodgePressed = false;
    this.candlePressed = false;
    this.whistlePressed = false;
    this.mountPressed = false;
    this.crouchPressed = false;
    this.aimAssistPressed = false;
    this.cycleTargetPressed = false;
    this.hayBaitPressed = false;
    this.buildModePressed = false;
    this.craftMenuPressed = false;
    this.weaponsCodexPressed = false;
    this.diaryPressed = false;
    this.weaponSelection = -1;
    this._lastWheelTime = 0;
    this.modalOpen = false;
    this.locked = false;
    this._onKeyDown = (event) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
      if (event.code === "Space" && !event.repeat) this.jumpPressed = true;
      if (event.code === "KeyJ" && !event.repeat) {
        this.attackPressed = true;
        this.attackHeld = true;
      }
      if (event.code === "KeyE" && !event.repeat) this.interactPressed = true;
      if (event.code === "KeyR" && !event.repeat) this.usePressed = true;
      if ((event.code === "AltLeft" || event.code === "KeyX") && !event.repeat) this.dodgePressed = true;
      if (event.code === "KeyC" && !event.repeat) this.buildModePressed = true;
      if (event.code === "KeyI" && !event.repeat) this.craftMenuPressed = true;
      if (event.code === "KeyB" && !event.repeat) this.weaponsCodexPressed = true;
      if (event.code === "KeyL" && !event.repeat) this.diaryPressed = true;
      if (event.code === "KeyV" && !event.repeat) this.candlePressed = true;
      if (event.code === "KeyH" && !event.repeat) this.whistlePressed = true;
      if (event.code === "KeyF" && !event.repeat) this.mountPressed = true;
      if (event.code === "KeyU" && !event.repeat) this.crouchPressed = true;
      if (event.code === "KeyT" && !event.repeat) this.aimAssistPressed = true;
      if (event.code === "KeyY" && !event.repeat) this.cycleTargetPressed = true;
      if (event.code === "KeyG" && !event.repeat) this.hayBaitPressed = true;
      if (!event.repeat) {
        if (/^Digit[0-9]$/.test(event.code)) {
          this.weaponSelection = Number(event.code.slice(5));
        } else if (/^Numpad[0-9]$/.test(event.code)) {
          this.weaponSelection = Number(event.code.slice(6));
        }
      }
      this.keys.add(event.code);
    };
    this._onKeyUp = (event) => {
      if (event.code === "KeyJ") this.attackHeld = false;
      this.keys.delete(event.code);
    };
    this._onBlur = () => {
      this.keys.clear();
      this.attackHeld = false;
      this.aimHeld = false;
    };
    this._onPointerMove = (event) => {
      if (document.pointerLockElement === this.canvas && !this.modalOpen) {
        this.lookX += event.movementX;
        this.lookY += event.movementY;
      }
    };
    // roda do mouse: troca de arma; com Shift, zoom da câmera
    this._onWheel = (event) => {
      if (this.modalOpen) return;
      if (event.shiftKey) this.zoomDelta += event.deltaY || event.deltaX;
      else this.wheelAccum += event.deltaY;
      event.preventDefault();
    };
    this._onClick = () => {
      if (this.modalOpen) return;
      if (document.pointerLockElement !== this.canvas && this.canvas.requestPointerLock) this.canvas.requestPointerLock();
    };
    this._onPointerDown = (event) => {
      if (!this.locked || this.modalOpen) return;
      if (event.button === 0) {
        this.attackPressed = true;
        this.attackHeld = true;
      } else if (event.button === 2) {
        this.aimHeld = true;
      }
    };
    this._onPointerUp = (event) => {
      if (event.button === 0) this.attackHeld = false;
      else if (event.button === 2) this.aimHeld = false;
    };
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) {
        this.attackHeld = false;
        this.aimHeld = false;
      }
      document.dispatchEvent(new CustomEvent("game-pointer-lock", { detail: this.locked }));
    };

    window.addEventListener("keydown", this._onKeyDown, { passive: false });
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);
    document.addEventListener("pointermove", this._onPointerMove);
    document.addEventListener("pointerlockchange", this._onLockChange);
    canvas.addEventListener("click", this._onClick);
    // mousedown/mouseup disparam para cada botão; pointerdown só para o primeiro,
    // o que impedia atirar (esquerdo) com o botão de mira (direito) já pressionado.
    window.addEventListener("mousedown", this._onPointerDown);
    window.addEventListener("mouseup", this._onPointerUp);
    canvas.addEventListener("wheel", this._onWheel, { passive: false });
  }

  isDown(code) {
    return this.keys.has(code);
  }

  readMovement(out) {
    if (this.modalOpen) {
      out.x = 0;
      out.z = 0;
      out.run = false;
      return out;
    }
    const left = this.keys.has("KeyA") || this.keys.has("ArrowLeft");
    const right = this.keys.has("KeyD") || this.keys.has("ArrowRight");
    const forward = this.keys.has("KeyW") || this.keys.has("ArrowUp");
    const back = this.keys.has("KeyS") || this.keys.has("ArrowDown");
    out.x = Number(right) - Number(left);
    out.z = Number(forward) - Number(back);
    const length = Math.hypot(out.x, out.z);
    if (length > 1) { out.x /= length; out.z /= length; }
    out.run = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    return out;
  }

  consumeJumpPressed() {
    const pressed = this.jumpPressed;
    this.jumpPressed = false;
    return pressed;
  }

  consumeLook(out) {
    if (this.modalOpen) {
      out.x = 0;
      out.y = 0;
      this.lookX = 0;
      this.lookY = 0;
      return out;
    }
    out.x = this.lookX;
    out.y = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
    return out;
  }

  consumeZoom() {
    const delta = this.zoomDelta;
    this.zoomDelta = 0;
    return delta;
  }

  consumeAttackPressed() {
    const pressed = this.attackPressed && !this.modalOpen;
    this.attackPressed = false;
    return pressed;
  }

  consumeInteractPressed() {
    const pressed = this.interactPressed;
    this.interactPressed = false;
    return pressed;
  }

  consumeUsePressed() {
    const pressed = this.usePressed && !this.modalOpen;
    this.usePressed = false;
    return pressed;
  }

  consumeCrouchPressed() {
    const pressed = this.crouchPressed && !this.modalOpen;
    this.crouchPressed = false;
    return pressed;
  }

  consumeAimAssistPressed() {
    const pressed = this.aimAssistPressed && !this.modalOpen;
    this.aimAssistPressed = false;
    return pressed;
  }

  consumeCycleTargetPressed() {
    const pressed = this.cycleTargetPressed && !this.modalOpen;
    this.cycleTargetPressed = false;
    return pressed;
  }

  consumeHayBaitPressed() {
    const pressed = this.hayBaitPressed && !this.modalOpen;
    this.hayBaitPressed = false;
    return pressed;
  }

  consumeBuildModePressed() {
    const pressed = this.buildModePressed && !this.modalOpen;
    this.buildModePressed = false;
    return pressed;
  }

  consumeCraftMenuPressed() {
    const pressed = this.craftMenuPressed;
    this.craftMenuPressed = false;
    return pressed;
  }

  consumeWeaponsCodexPressed() {
    const pressed = this.weaponsCodexPressed;
    this.weaponsCodexPressed = false;
    return pressed;
  }

  consumeDiaryPressed() {
    const pressed = this.diaryPressed;
    this.diaryPressed = false;
    return pressed;
  }

  // -1 (para cima), 0 ou +1 por "clique" da roda
  consumeWheelStep() {
    if (this.modalOpen) {
      this.wheelAccum = 0;
      return 0;
    }
    if (Math.abs(this.wheelAccum) < 30) return 0;
    const now = performance.now();
    if (now - this._lastWheelTime < 75) {
      this.wheelAccum = 0;
      return 0;
    }
    const step = this.wheelAccum > 0 ? 1 : -1;
    this.wheelAccum = 0;
    this._lastWheelTime = now;
    return step;
  }

  consumeCandlePressed() {
    const pressed = this.candlePressed && !this.modalOpen;
    this.candlePressed = false;
    return pressed;
  }

  consumeWhistlePressed() {
    const pressed = this.whistlePressed && !this.modalOpen;
    this.whistlePressed = false;
    return pressed;
  }

  consumeMountPressed() {
    const pressed = this.mountPressed && !this.modalOpen;
    this.mountPressed = false;
    return pressed;
  }

  consumeDodgePressed() {
    const pressed = this.dodgePressed && !this.modalOpen;
    this.dodgePressed = false;
    return pressed;
  }

  consumeWeaponSelection() {
    const selection = this.modalOpen ? -1 : this.weaponSelection;
    this.weaponSelection = -1;
    return selection;
  }

  isKeyPressed(code) {
    if (this.modalOpen) return false;
    return this.keys.has(code);
  }

  setModalOpen(open) {
    this.modalOpen = open;
    this.lookX = 0;
    this.lookY = 0;
    if (open) {
      this.keys.clear();
      this.attackHeld = false;
      this.aimHeld = false;
      if (document.pointerLockElement) {
        try {
          document.exitPointerLock?.();
        } catch (_) {}
      }
    }
  }
}
