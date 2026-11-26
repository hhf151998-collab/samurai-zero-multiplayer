
    (() => {
      "use strict";

      const WORLD_W = 2200;
      const WORLD_H = 1500;
      const MATCH_DURATION = 180;
      const MAX_PER_TEAM = 5;
      const MAX_LEVEL = 10;

      const CHARACTERS = [
        {
          id: "ronin",
          name: "SHADOW RONIN",
          role: "Duelist / Flanker",
          desc: "High speed & burst katana arcs with long-range dash strike.",
          hp: 110,
          speed: 245,
          slashDmg: 34,
          slashCooldown: 0.34,
          dashCooldown: 1.5,
          skillCooldown: 4.5,
          primaryColor: "#ff3b6b",
          accentColor: "#ffd166",
          slashInfo: "Wide crimson katana wave",
          dashInfo: "Phase Dash + bonus slash",
          skillInfo: "Blink Slash across nearby targets"
        },
        {
          id: "guardian",
          name: "CYBER GUARDIAN",
          role: "Vanguard / Control",
          desc: "Heavy armor, high HP, shockwave slam & shield resilience.",
          hp: 165,
          speed: 195,
          slashDmg: 30,
          slashCooldown: 0.44,
          dashCooldown: 2.0,
          skillCooldown: 5.2,
          primaryColor: "#00d9ff",
          accentColor: "#2ee59d",
          slashInfo: "Heavy cleave + knockback",
          dashInfo: "Ramming shield charge",
          skillInfo: "Shock Slam stuns & damages foes"
        },
        {
          id: "ninja",
          name: "NEON TECH-NINJA",
          role: "Saboteur / Recon",
          desc: "Agile tech-shinobi with EMP pulse, fast stealth & objective speed.",
          hp: 100,
          speed: 260,
          slashDmg: 27,
          slashCooldown: 0.28,
          dashCooldown: 1.25,
          skillCooldown: 4.0,
          primaryColor: "#b565ff",
          accentColor: "#00f5d4",
          slashInfo: "Rapid twin-edge strikes",
          dashInfo: "Quick zip + brief invisibility",
          skillInfo: "EMP Pulse slows & damages nearby foes"
        }
      ];

      const lobbyState = {
        playerName: "HUSSEIN_ZERO",
        playerTeam: "crimson",
        playerChar: "ronin",
        crimsonBots: 4,
        azureBots: 5
      };

      const camera = {
        x: WORLD_W * 0.5,
        y: WORLD_H * 0.5,
        zoom: 0.72,
        targetZoom: 0.72,
        zoomMode: "WIDE",
        shake: 0
      };

      const game = {
        running: false,
        ended: false,
        guideOpen: false,
        timeLeft: MATCH_DURATION,
        scores: { crimson: 0, azure: 0 },
        fighters: [],
        bamboos: [],
        barrels: [],
        plates: [],
        bridges: [],
        mirrors: [],
        vaults: [],
        stealthZones: [],
        windPads: [],
        shrines: [],
        teleporters: [],
        scrolls: [],
        radars: [],
        levers: [],
        ironGates: [],
        gravityFields: [],
        oniBoss: null,
        oniRespawnTimer: 22,
        scrollSpawnTimer: 6,
        laserPaths: [],
        particles: [],
        floatingTexts: [],
        sakuraPetals: [],
        koiFish: [],
        bannerText: "NEON CORE ONLINE — CAPTURE ZONES, RADARS & ONI IDOL",
        bannerTimer: 6,
        lastFrameTime: 0,
        accumulator: 0
      };

      const input = {
        keys: new Set(),
        joyActive: false,
        joyDx: 0,
        joyDy: 0,
        touchOverride: "AUTO",
        isTouchDevice: false
      };

      const canvas = document.getElementById("gameCanvas");
      const ctx = canvas.getContext("2d");
      const minimapCanvas = document.getElementById("minimap-canvas");
      const miniCtx = minimapCanvas.getContext("2d");

      const lobbyScreen = document.getElementById("lobby-screen");
      const hudLayer = document.getElementById("hud-layer");
      const touchControls = document.getElementById("touch-controls");
      const matchEndModal = document.getElementById("match-end-modal");
      const mapGuideModal = document.getElementById("map-guide-modal");

      function getXpRequiredForLevel(level) {
        return 100 + (level - 1) * 45;
      }

      function getFighterStats(f) {
        const lvlBonus = Math.max(0, f.level - 1);
        const maxHp = Math.round(f.charDef.hp * (1 + lvlBonus * 0.08));
        const slashDmg = Math.round(f.charDef.slashDmg * (1 + lvlBonus * 0.09));
        const buffMult = f.buffType === "SPEED" ? 1.35 : f.buffType === "SLOW" ? 0.52 : 1;
        const speed = f.charDef.speed * (1 + lvlBonus * 0.035) * buffMult;
        return { maxHp, slashDmg, speed };
      }

      function grantXp(f, amount) {
        if (!f || amount <= 0) return;
        f.xp += amount;
        while (f.level < MAX_LEVEL) {
          const req = getXpRequiredForLevel(f.level);
          if (f.xp >= req) {
            f.xp -= req;
            f.level += 1;
            const oldMax = f.maxHp;
            const stats = getFighterStats(f);
            f.maxHp = stats.maxHp;
            const hpGain = Math.max(15, f.maxHp - oldMax);
            f.hp = Math.min(f.maxHp, f.hp + hpGain);
            spawnBurst(f.x, f.y, "#ffd166", 18);
            addFloatingText(f.x, f.y - 32, `LEVEL UP! LV.${f.level}`, "#ffd166");
          } else {
            break;
          }
        }
        if (f.level >= MAX_LEVEL) {
          f.xp = getXpRequiredForLevel(MAX_LEVEL);
        }
      }

      function setGuideOpen(open) {
        game.guideOpen = !!open;
        mapGuideModal.classList.toggle("active", game.guideOpen);
        if (game.guideOpen) {
          touchControls.classList.remove("active");
        } else {
          updateTouchVisibility();
        }
      }

      function detectTouch() {
        input.isTouchDevice =
          "ontouchstart" in window ||
          navigator.maxTouchPoints > 0 ||
          window.innerWidth <= 820;
        updateTouchVisibility();
      }

      function updateTouchVisibility() {
        if (!game.running || game.ended || game.guideOpen) {
          touchControls.classList.remove("active");
          return;
        }
        const show =
          input.touchOverride === "ON" ||
          (input.touchOverride === "AUTO" && input.isTouchDevice);
        touchControls.classList.toggle("active", show);
      }

      function resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
        canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function getResponsiveBaseZoom() {
        const minDim = Math.min(window.innerWidth, window.innerHeight);
        let factor = 0.72;
        if (minDim < 460) factor = 0.54;
        else if (minDim < 720) factor = 0.64;
        else factor = 0.76;

        if (camera.zoomMode === "TACTICAL") factor *= 1.18;
        else if (camera.zoomMode === "CLOSE") factor *= 1.36;
        return Math.max(0.42, Math.min(1.45, factor));
      }

      function buildCharacterCards() {
        const grid = document.getElementById("charGrid");
        grid.innerHTML = "";

        CHARACTERS.forEach((char) => {
          const card = document.createElement("div");
          card.className = "char-card" + (lobbyState.playerChar === char.id ? " selected" : "");
          card.dataset.charId = char.id;

          const pCanvas = document.createElement("canvas");
          pCanvas.width = 72;
          pCanvas.height = 72;
          pCanvas.className = "char-preview-canvas";

          card.innerHTML = `
            <div class="char-name" style="color:${char.primaryColor}">${char.name}</div>
            <div class="char-role">${char.role}</div>
            <div class="char-desc">${char.desc}</div>
            <div class="ability-pills">
              <div class="ability-pill"><b>SLASH:</b> ${char.slashInfo}</div>
              <div class="ability-pill"><b>DASH:</b> ${char.dashInfo}</div>
              <div class="ability-pill"><b>SKILL:</b> ${char.skillInfo}</div>
            </div>
          `;
          card.insertBefore(pCanvas, card.firstChild);

          card.addEventListener("click", () => {
            lobbyState.playerChar = char.id;
            renderLobby();
          });

          grid.appendChild(card);
        });
      }

      function oldPixelSprite(targetCtx, cx, cy, scale, charDef, team, facingAngle, animTime, isStealthed) {
        targetCtx.save();
        targetCtx.translate(cx, cy);
        if (isStealthed) {
          targetCtx.globalAlpha = 0.32;
        }

        const bob = Math.sin(animTime * 8) * 1.5 * scale;
        const teamTint = team === "crimson" ? "#ff2e55" : "#00d9ff";
        const px = Math.max(2, Math.round(2.5 * scale));

        targetCtx.fillStyle = "rgba(0,0,0,0.42)";
        targetCtx.beginPath();
        targetCtx.ellipse(0, 12 * scale, 10 * scale, 4.5 * scale, 0, 0, Math.PI * 2);
        targetCtx.fill();

        targetCtx.strokeStyle = teamTint;
        targetCtx.lineWidth = Math.max(1.5, scale);
        targetCtx.beginPath();
        targetCtx.ellipse(0, 11 * scale, 12 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
        targetCtx.stroke();

        const stride = Math.sin(animTime * 12) * 3 * scale;
        targetCtx.fillStyle = "#1c2236";
        targetCtx.fillRect(-5 * scale, 3 * scale + bob + stride * 0.4, 4 * scale, 8 * scale);
        targetCtx.fillRect(1 * scale, 3 * scale + bob - stride * 0.4, 4 * scale, 8 * scale);

        targetCtx.fillStyle = charDef.primaryColor;
        targetCtx.fillRect(-6 * scale, -5 * scale + bob, 12 * scale, 9 * scale);

        targetCtx.fillStyle = teamTint;
        targetCtx.fillRect(-2 * scale, -3 * scale + bob, 4 * scale, 4 * scale);

        targetCtx.fillStyle = "#ffd9b3";
        targetCtx.fillRect(-4 * scale, -11 * scale + bob, 8 * scale, 6 * scale);

        targetCtx.fillStyle = "#121624";
        targetCtx.fillRect(-6 * scale, -13 * scale + bob, 12 * scale, 3.5 * scale);

        const lookX = Math.cos(facingAngle) * 2 * scale;
        targetCtx.fillStyle = charDef.accentColor;
        targetCtx.fillRect(-2 * scale + lookX, -9 * scale + bob, 4 * scale, 2 * scale);

        const bladeLen = 14 * scale;
        const bx = Math.cos(facingAngle) * (8 * scale);
        const by = Math.sin(facingAngle) * (8 * scale) + bob;
        targetCtx.strokeStyle = charDef.accentColor;
        targetCtx.lineWidth = Math.max(2, px * 0.85);
        targetCtx.beginPath();
        targetCtx.moveTo(bx, by);
        targetCtx.lineTo(bx + Math.cos(facingAngle) * bladeLen, by + Math.sin(facingAngle) * bladeLen);
        targetCtx.stroke();

        targetCtx.restore();
      }

      function originalRenderLobby() {
        const nameInput = document.getElementById("playerNameInput");
        if (document.activeElement !== nameInput) {
          nameInput.value = lobbyState.playerName;
        }

        const crimsonPanel = document.getElementById("crimsonPanel");
        const azurePanel = document.getElementById("azurePanel");
        const selCrimsonBtn = document.getElementById("selectCrimsonBtn");
        const selAzureBtn = document.getElementById("selectAzureBtn");

        crimsonPanel.classList.toggle("active-team", lobbyState.playerTeam === "crimson");
        azurePanel.classList.toggle("active-team", lobbyState.playerTeam === "azure");
        selCrimsonBtn.classList.toggle("selected", lobbyState.playerTeam === "crimson");
        selAzureBtn.classList.toggle("selected", lobbyState.playerTeam === "azure");

        const renderRoster = (teamKey, botCount, elId) => {
          const container = document.getElementById(elId);
          container.innerHTML = "";
          const slots = [];

          if (lobbyState.playerTeam === teamKey) {
            slots.push({
              name: lobbyState.playerName || "YOU",
              tag: "YOU",
              charId: lobbyState.playerChar,
              isYou: true
            });
          }

          const charPool = CHARACTERS.map((c) => c.id);
          for (let i = 0; i < botCount && slots.length < MAX_PER_TEAM; i++) {
            slots.push({
              name: `${teamKey === "crimson" ? "ONI" : "KAI"}_BOT_${i + 1}`,
              tag: "AI",
              charId: charPool[(i + (teamKey === "azure" ? 1 : 0)) % charPool.length],
              isYou: false
            });
          }

          for (let s = 0; s < MAX_PER_TEAM; s++) {
            const row = document.createElement("div");
            if (slots[s]) {
              const cObj = CHARACTERS.find((c) => c.id === slots[s].charId) || CHARACTERS[0];
              row.className = "roster-slot" + (slots[s].isYou ? " is-you" : "");
              row.innerHTML = `
                <span><b style="color:${cObj.primaryColor}">●</b> ${slots[s].name} <small style="color:var(--text-muted)">(${cObj.name.split(" ")[1]})</small></span>
                <span style="font-size:10px; font-weight:800; color:${slots[s].isYou ? "var(--gold)" : "var(--text-muted)"}">${slots[s].tag}</span>
              `;
            } else {
              row.className = "roster-slot empty";
              row.innerHTML = `<span>EMPTY SLOT</span><span>5v5</span>`;
            }
            container.appendChild(row);
          }
        };

        renderRoster("crimson", lobbyState.crimsonBots, "crimsonRoster");
        renderRoster("azure", lobbyState.azureBots, "azureRoster");

        document.querySelectorAll(".char-card").forEach((card) => {
          const cId = card.dataset.charId;
          card.classList.toggle("selected", cId === lobbyState.playerChar);
          const pCanvas = card.querySelector("canvas.char-preview-canvas");
          if (pCanvas) {
            const pCtx = pCanvas.getContext("2d");
            const cDef = CHARACTERS.find((c) => c.id === cId) || CHARACTERS[0];
            pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
            drawPixelSamuraiSprite(
              pCtx,
              36,
              42,
              1.65,
              cDef,
              lobbyState.playerTeam,
              0,
              performance.now() * 0.001,
              false
            );
          }
        });
      }

      function initEnvironmentDecor() {
        game.sakuraPetals = [];
        for (let i = 0; i < 65; i++) {
          game.sakuraPetals.push({
            x: Math.random() * WORLD_W,
            y: Math.random() * WORLD_H,
            vx: -18 - Math.random() * 22,
            vy: 14 + Math.random() * 18,
            size: 3 + Math.random() * 3,
            phase: Math.random() * Math.PI * 2
          });
        }

        game.koiFish = [];
        for (let i = 0; i < 14; i++) {
          game.koiFish.push({
            angle: (i / 14) * Math.PI * 2,
            radius: 252 + (i % 2) * 14,
            speed: (i % 2 === 0 ? 1 : -1) * (0.28 + (i % 3) * 0.07),
            color: i % 3 === 0 ? "#ff6b4a" : i % 3 === 1 ? "#ffd166" : "#ffffff"
          });
        }
      }

      function buildWorldEntities() {
        initEnvironmentDecor();

        game.bamboos = [
          { x: 640, y: 420, w: 34, h: 120, hp: 55, maxHp: 55 },
          { x: 640, y: 960, w: 34, h: 120, hp: 55, maxHp: 55 },
          { x: 1526, y: 420, w: 34, h: 120, hp: 55, maxHp: 55 },
          { x: 1526, y: 960, w: 34, h: 120, hp: 55, maxHp: 55 },
          { x: 960, y: 270, w: 120, h: 34, hp: 55, maxHp: 55 },
          { x: 1120, y: 1196, w: 120, h: 34, hp: 55, maxHp: 55 }
        ];

        game.barrels = [
          { x: 760, y: 520, r: 18, hp: 25, exploded: false },
          { x: 1440, y: 520, r: 18, hp: 25, exploded: false },
          { x: 760, y: 980, r: 18, hp: 25, exploded: false },
          { x: 1440, y: 980, r: 18, hp: 25, exploded: false }
        ];

        game.plates = [
          { id: "bridge_n", x: 1100, y: 410, r: 24, active: false },
          { id: "bridge_s", x: 1100, y: 1090, r: 24, active: false }
        ];

        game.bridges = [
          { id: "bridge_n", x: 1060, y: 455, w: 80, h: 55, active: false },
          { id: "bridge_s", x: 1060, y: 990, w: 80, h: 55, active: false }
        ];

        game.mirrors = [
          { x: 720, y: 1240, r: 22, angle: 0, cd: 0 },
          { x: 1480, y: 1240, r: 22, angle: 1, cd: 0 }
        ];

        game.vaults = [
          { id: "vault_w", x: 540, y: 1240, w: 56, h: 56, unlocked: false, cooldown: 0 },
          { id: "vault_e", x: 1604, y: 1240, w: 56, h: 56, unlocked: false, cooldown: 0 }
        ];

        game.stealthZones = [
          { x: 340, y: 220, w: 260, h: 190 },
          { x: 1600, y: 220, w: 260, h: 190 },
          { x: 420, y: 660, w: 180, h: 180 },
          { x: 1600, y: 660, w: 180, h: 180 }
        ];

        game.windPads = [
          { x: 430, y: 480, r: 24, vx: 620, vy: -120 },
          { x: 1770, y: 480, r: 24, vx: -620, vy: -120 },
          { x: 430, y: 1020, r: 24, vx: 620, vy: 120 },
          { x: 1770, y: 1020, r: 24, vx: -620, vy: 120 }
        ];

        game.shrines = [
          { x: 260, y: 750, r: 44, team: "crimson" },
          { x: 1940, y: 750, r: 44, team: "azure" }
        ];

        game.teleporters = [
          { id: "tp_a1", pairId: "tp_a2", x: 320, y: 1260, r: 26, color: "#ff6b88" },
          { id: "tp_a2", pairId: "tp_a1", x: 1880, y: 240, r: 26, color: "#ff6b88" },
          { id: "tp_b1", pairId: "tp_b2", x: 1880, y: 1260, r: 26, color: "#5ce1ff" },
          { id: "tp_b2", pairId: "tp_b1", x: 320, y: 240, r: 26, color: "#5ce1ff" }
        ];

        game.radars = [
          { id: "radar_nw", x: 760, y: 260, r: 30, owner: null, revealTimer: 0, hp: 70, maxHp: 70 },
          { id: "radar_ne", x: 1440, y: 260, r: 30, owner: null, revealTimer: 0, hp: 70, maxHp: 70 }
        ];

        game.levers = [
          { id: "gate_w", x: 690, y: 750, r: 20, closed: false, cd: 0 },
          { id: "gate_e", x: 1510, y: 750, r: 20, closed: false, cd: 0 }
        ];

        game.ironGates = [
          { id: "gate_w", x: 615, y: 650, w: 26, h: 200, closed: false },
          { id: "gate_e", x: 1559, y: 650, w: 26, h: 200, closed: false }
        ];

        game.gravityFields = [
          { x: 880, y: 580, w: 120, h: 100 },
          { x: 1200, y: 820, w: 120, h: 100 }
        ];

        game.scrolls = [];
        game.scrollSpawnTimer = 4;
        game.oniBoss = null;
        game.oniRespawnTimer = 18;
      }

      function spawnOniBoss() {
        game.oniBoss = {
          x: WORLD_W * 0.5,
          y: WORLD_H * 0.5,
          r: 36,
          hp: 360,
          maxHp: 360,
          hitFlash: 0
        };
        setBanner("GOLDEN ONI IDOL AWAKENED AT NEON CORE (+250 TEAM PTS)!", 5);
      }

      function spawnScroll() {
        const types = [
          { kind: "SPEED", label: "WIND SPEED", color: "#2ee59d" },
          { kind: "SHIELD", label: "AEGIS SHIELD", color: "#00d9ff" },
          { kind: "SURGE", label: "2X SURGE", color: "#ffd166" }
        ];
        const pick = types[Math.floor(Math.random() * types.length)];
        const spots = [
          { x: 850, y: 340 },
          { x: 1350, y: 340 },
          { x: 850, y: 1160 },
          { x: 1350, y: 1160 },
          { x: 1100, y: 750 }
        ];
        const spot = spots[Math.floor(Math.random() * spots.length)];
        game.scrolls.push({
          x: spot.x,
          y: spot.y,
          r: 16,
          kind: pick.kind,
          label: pick.label,
          color: pick.color,
          bob: Math.random() * Math.PI * 2
        });
      }

      function createFighter(opts) {
        const charDef = CHARACTERS.find((c) => c.id === opts.charId) || CHARACTERS[0];
        return {
          id: opts.id,
          name: opts.name,
          team: opts.team,
          charId: charDef.id,
          charDef,
          isHuman: !!opts.isHuman,
          x: opts.x,
          y: opts.y,
          spawnX: opts.x,
          spawnY: opts.y,
          vx: 0,
          vy: 0,
          r: 16,
          facing: opts.team === "crimson" ? 0 : Math.PI,
          level: 1,
          xp: 0,
          hp: charDef.hp,
          maxHp: charDef.hp,
          shield: 0,
          deadTimer: 0,
          slashCd: 0,
          dashCd: 0,
          skillCd: 0,
          dashTimer: 0,
          stunTimer: 0,
          tpCd: 0,
          stealthed: false,
          buffType: null,
          buffTimer: 0,
          animTime: Math.random() * 10,
          slashAnim: 0,
          aiTargetTimer: 0,
          aiMoveAngle: 0
        };
      }

      function buildFighters() {
        game.fighters = [];
        let idx = 1;

        const addTeam = (teamKey, botCount, includeHuman) => {
          const baseX = teamKey === "crimson" ? 210 : WORLD_W - 210;
          const offsetsY = [430, 590, 750, 910, 1070];
          let slot = 0;

          if (includeHuman) {
            const yPos = offsetsY[slot % offsetsY.length];
            game.fighters.push(
              createFighter({
                id: `f_${idx++}`,
                name: lobbyState.playerName || "PLAYER",
                team: teamKey,
                charId: lobbyState.playerChar,
                isHuman: true,
                x: baseX + (teamKey === "crimson" ? 40 : -40),
                y: yPos
              })
            );
            slot++;
          }

          const charPool = CHARACTERS.map((c) => c.id);
          for (let b = 0; b < botCount && slot < MAX_PER_TEAM; b++) {
            const yPos = offsetsY[slot % offsetsY.length];
            game.fighters.push(
              createFighter({
                id: `f_${idx++}`,
                name: `${teamKey === "crimson" ? "ONI" : "KAI"}_BOT_${b + 1}`,
                team: teamKey,
                charId: charPool[(b + (teamKey === "azure" ? 1 : 0)) % charPool.length],
                isHuman: false,
                x: baseX + (teamKey === "crimson" ? -15 : 15),
                y: yPos
              })
            );
            slot++;
          }
        };

        addTeam("crimson", lobbyState.crimsonBots, lobbyState.playerTeam === "crimson");
        addTeam("azure", lobbyState.azureBots, lobbyState.playerTeam === "azure");
      }

      function startMatch() {
        lobbyState.playerName =
          (document.getElementById("playerNameInput").value || "HUSSEIN_ZERO").trim() ||
          "HUSSEIN_ZERO";

        game.running = true;
        game.ended = false;
        game.guideOpen = false;
        game.timeLeft = MATCH_DURATION;
        game.scores = { crimson: 0, azure: 0 };
        game.particles = [];
        game.floatingTexts = [];
        game.accumulator = 0;
        game.lastFrameTime = performance.now();

        buildWorldEntities();
        buildFighters();

        const human = game.fighters.find((f) => f.id === net.id);
        if (human) {
          camera.x = human.x;
          camera.y = human.y;
        } else {
          camera.x = WORLD_W * 0.5;
          camera.y = WORLD_H * 0.5;
        }
        camera.targetZoom = getResponsiveBaseZoom();
        camera.zoom = camera.targetZoom;

        lobbyScreen.classList.add("hidden");
        matchEndModal.classList.remove("active");
        mapGuideModal.classList.remove("active");
        hudLayer.classList.add("active");
        updateTouchVisibility();
      }

      function returnToLobby() {
        game.running = false;
        game.ended = false;
        game.guideOpen = false;
        hudLayer.classList.remove("active");
        matchEndModal.classList.remove("active");
        mapGuideModal.classList.remove("active");
        touchControls.classList.remove("active");
        lobbyScreen.classList.remove("hidden");
        renderLobby();
      }

      function setBanner(msg, sec = 4) {
        game.bannerText = msg;
        game.bannerTimer = sec;
        const el = document.getElementById("eventBannerText");
        if (el) el.textContent = msg;
      }

      function addFloatingText(x, y, text, color = "#ffd166") {
        game.floatingTexts.push({ x, y, text, color, life: 1.05 });
      }

      function spawnBurst(x, y, color, count = 12) {
        for (let i = 0; i < count; i++) {
          const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
          const spd = 60 + Math.random() * 170;
          game.particles.push({
            x,
            y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            size: 3 + Math.random() * 3.5,
            color,
            life: 0.35 + Math.random() * 0.25
          });
        }
      }

      function applyDamageToFighter(target, amount, attacker, knockDx = 0, knockDy = 0) {
        if (!target || target.deadTimer > 0) return;

        let dmg = amount;
        if (attacker && attacker.buffType === "SURGE") {
          dmg = Math.round(dmg * 1.35);
        }

        if (target.shield > 0) {
          const absorbed = Math.min(target.shield, dmg);
          target.shield -= absorbed;
          dmg -= absorbed;
        }

        if (dmg > 0) {
          target.hp -= dmg;
          addFloatingText(target.x, target.y - 20, `-${dmg}`, "#ff758f");
        }

        target.vx += knockDx;
        target.vy += knockDy;

        if (target.hp <= 0) {
          target.hp = 0;
          target.deadTimer = 4.5;
          spawnBurst(target.x, target.y, target.charDef.primaryColor, 18);
          if (attacker && attacker.team !== target.team) {
            const pts = attacker.buffType === "SURGE" ? 30 : 15;
            game.scores[attacker.team] += pts;
            grantXp(attacker, 45);
            addFloatingText(attacker.x, attacker.y - 28, `+${pts} KO`, "#2ee59d");
          }
        }
      }

      function performSlash(f) {
        if (f.deadTimer > 0 || f.stunTimer > 0 || f.slashCd > 0) return;
        f.slashCd = f.charDef.slashCooldown;
        f.slashAnim = 0.18;

        const stats = getFighterStats(f);
        const reach = f.charId === "ronin" ? 78 : f.charId === "guardian" ? 70 : 66;
        const arcHalf = f.charId === "guardian" ? 1.15 : 0.92;
        const knockForce = f.charId === "guardian" ? 290 : 170;

        spawnBurst(
          f.x + Math.cos(f.facing) * 34,
          f.y + Math.sin(f.facing) * 34,
          f.charDef.accentColor,
          7
        );

        for (const other of game.fighters) {
          if (other.team === f.team || other.deadTimer > 0) continue;
          const dx = other.x - f.x;
          const dy = other.y - f.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= reach + other.r) {
            const ang = Math.atan2(dy, dx);
            let diff = Math.abs(ang - f.facing);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff <= arcHalf) {
              const nx = dist > 0 ? (dx / dist) * knockForce : Math.cos(f.facing) * knockForce;
              const ny = dist > 0 ? (dy / dist) * knockForce : Math.sin(f.facing) * knockForce;
              applyDamageToFighter(other, stats.slashDmg, f, nx, ny);
            }
          }
        }

        for (let i = game.bamboos.length - 1; i >= 0; i--) {
          const b = game.bamboos[i];
          const cx = b.x + b.w * 0.5;
          const cy = b.y + b.h * 0.5;
          if (Math.hypot(cx - f.x, cy - f.y) <= reach + 34) {
            b.hp -= stats.slashDmg;
            spawnBurst(cx, cy, "#2ee59d", 6);
            if (b.hp <= 0) {
              grantXp(f, 12);
              spawnBurst(cx, cy, "#6ee7b7", 14);
              game.bamboos.splice(i, 1);
            }
          }
        }

        for (const br of game.barrels) {
          if (br.exploded) continue;
          if (Math.hypot(br.x - f.x, br.y - f.y) <= reach + br.r) {
            detonateBarrel(br, f);
          }
        }

        for (const m of game.mirrors) {
          if (m.cd <= 0 && Math.hypot(m.x - f.x, m.y - f.y) <= reach + m.r) {
            m.angle = (m.angle + 1) % 2;
            m.cd = 0.35;
            addFloatingText(m.x, m.y - 22, "MIRROR 90°", "#00d9ff");
          }
        }

        for (const lv of game.levers) {
          if (lv.cd <= 0 && Math.hypot(lv.x - f.x, lv.y - f.y) <= reach + lv.r) {
            lv.closed = !lv.closed;
            lv.cd = 0.45;
            const gate = game.ironGates.find((g) => g.id === lv.id);
            if (gate) gate.closed = lv.closed;
            addFloatingText(lv.x, lv.y - 24, lv.closed ? "GATE CLOSED" : "GATE OPEN", "#ffd166");
          }
        }

        for (const rd of game.radars) {
          if (Math.hypot(rd.x - f.x, rd.y - f.y) <= reach + rd.r) {
            if (rd.owner !== f.team) {
              rd.hp -= stats.slashDmg;
              if (rd.hp <= 0) {
                rd.owner = f.team;
                rd.hp = rd.maxHp;
                rd.revealTimer = 15;
                game.scores[f.team] += 40;
                grantXp(f, 35);
                addFloatingText(rd.x, rd.y - 28, `${f.team.toUpperCase()} RADAR +40`, "#00f5d4");
              }
            } else {
              rd.revealTimer = Math.max(rd.revealTimer, 12);
            }
          }
        }

        if (game.oniBoss && Math.hypot(game.oniBoss.x - f.x, game.oniBoss.y - f.y) <= reach + game.oniBoss.r) {
          game.oniBoss.hp -= stats.slashDmg;
          game.oniBoss.hitFlash = 0.12;
          grantXp(f, 10);
          spawnBurst(game.oniBoss.x, game.oniBoss.y, "#ffd166", 7);
          if (game.oniBoss.hp <= 0) {
            game.scores[f.team] += 250;
            setBanner(`${f.team.toUpperCase()} SHATTERED GOLDEN ONI (+250 TEAM PTS & BUFFS)!`, 5);
            for (const ally of game.fighters) {
              if (ally.team === f.team) {
                grantXp(ally, 80);
                if (ally.deadTimer <= 0) {
                  ally.shield = Math.max(ally.shield, 45);
                  ally.buffType = "SPEED";
                  ally.buffTimer = 8;
                }
              }
            }
            game.oniBoss = null;
            game.oniRespawnTimer = 38;
          }
        }
      }

      function detonateBarrel(br, attacker) {
        br.exploded = true;
        const radius = 145;
        spawnBurst(br.x, br.y, "#ff7b00", 24);
        spawnBurst(br.x, br.y, "#ffd166", 14);
        if (attacker && attacker.isHuman) camera.shake = 10;

        for (const other of game.fighters) {
          if (other.deadTimer > 0) continue;
          const dx = other.x - br.x;
          const dy = other.y - br.y;
          const d = Math.hypot(dx, dy);
          if (d <= radius) {
            const nx = d > 0 ? (dx / d) * 380 : 0;
            const ny = d > 0 ? (dy / d) * 380 : 0;
            applyDamageToFighter(other, 55, attacker, nx, ny);
          }
        }

        for (let i = game.bamboos.length - 1; i >= 0; i--) {
          const b = game.bamboos[i];
          const cx = b.x + b.w * 0.5;
          const cy = b.y + b.h * 0.5;
          if (Math.hypot(cx - br.x, cy - br.y) <= radius) {
            game.bamboos.splice(i, 1);
          }
        }
      }

      function performDash(f) {
        if (f.deadTimer > 0 || f.stunTimer > 0 || f.dashCd > 0) return;
        f.dashCd = f.charDef.dashCooldown;
        f.dashTimer = 0.22;

        const spd = 620;
        f.vx = Math.cos(f.facing) * spd;
        f.vy = Math.sin(f.facing) * spd;
        spawnBurst(f.x, f.y, f.charDef.accentColor, 9);

        if (f.isHuman) {
          camera.targetZoom = Math.max(0.42, getResponsiveBaseZoom() * 0.92);
        }
      }

      function performSkill(f) {
        if (f.deadTimer > 0 || f.stunTimer > 0 || f.skillCd > 0) return;
        f.skillCd = f.charDef.skillCooldown;
        const stats = getFighterStats(f);

        if (f.charId === "ronin") {
          let bestFoe = null;
          let bestDist = 230;
          for (const other of game.fighters) {
            if (other.team !== f.team && other.deadTimer <= 0) {
              const d = Math.hypot(other.x - f.x, other.y - f.y);
              if (d < bestDist) {
                bestDist = d;
                bestFoe = other;
              }
            }
          }
          const targetX = bestFoe ? bestFoe.x : f.x + Math.cos(f.facing) * 185;
          const targetY = bestFoe ? bestFoe.y : f.y + Math.sin(f.facing) * 185;
          spawnBurst(f.x, f.y, "#ff3b6b", 10);
          f.x = Math.max(40, Math.min(WORLD_W - 40, targetX));
          f.y = Math.max(40, Math.min(WORLD_H - 40, targetY));
          spawnBurst(f.x, f.y, "#ffd166", 14);
          performSlash(f);
        } else if (f.charId === "guardian") {
          const radius = 135;
          spawnBurst(f.x, f.y, "#00d9ff", 20);
          for (const other of game.fighters) {
            if (other.team !== f.team && other.deadTimer <= 0) {
              const d = Math.hypot(other.x - f.x, other.y - f.y);
              if (d <= radius) {
                other.stunTimer = 1.1;
                applyDamageToFighter(other, Math.round(stats.slashDmg * 1.25), f, 0, 0);
              }
            }
          }
        } else if (f.charId === "ninja") {
          const radius = 150;
          spawnBurst(f.x, f.y, "#b565ff", 18);
          for (const other of game.fighters) {
            if (other.team !== f.team && other.deadTimer <= 0) {
              const d = Math.hypot(other.x - f.x, other.y - f.y);
              if (d <= radius) {
                other.buffType = "SLOW";
                other.buffTimer = 2.5;
                applyDamageToFighter(other, Math.round(stats.slashDmg * 1.15), f, 0, 0);
              }
            }
          }
        }
      }

      function resolveSolidObstacles(f) {
        f.x = Math.max(24, Math.min(WORLD_W - 24, f.x));
        f.y = Math.max(24, Math.min(WORLD_H - 24, f.y));

        const cx = WORLD_W * 0.5;
        const cy = WORLD_H * 0.5;
        const dx = f.x - cx;
        const dy = f.y - cy;
        const dist = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);

        const onCardinalBridge =
          Math.abs(Math.sin(ang)) < 0.22 || Math.abs(Math.cos(ang)) < 0.16;

        if (!onCardinalBridge && dist > 236 && dist < 280) {
          const pushTarget = dist < 258 ? 235 : 281;
          f.x = cx + (dx / dist) * pushTarget;
          f.y = cy + (dy / dist) * pushTarget;
        }

        for (const b of game.bamboos) {
          const closestX = Math.max(b.x, Math.min(f.x, b.x + b.w));
          const closestY = Math.max(b.y, Math.min(f.y, b.y + b.h));
          const ox = f.x - closestX;
          const oy = f.y - closestY;
          const d = Math.hypot(ox, oy);
          if (d < f.r) {
            const overlap = f.r - d;
            if (d > 0.001) {
              f.x += (ox / d) * overlap;
              f.y += (oy / d) * overlap;
            } else {
              f.x += overlap;
            }
          }
        }

        for (const g of game.ironGates) {
          if (!g.closed) continue;
          const closestX = Math.max(g.x, Math.min(f.x, g.x + g.w));
          const closestY = Math.max(g.y, Math.min(f.y, g.y + g.h));
          const ox = f.x - closestX;
          const oy = f.y - closestY;
          const d = Math.hypot(ox, oy);
          if (d < f.r) {
            const overlap = f.r - d;
            if (d > 0.001) {
              f.x += (ox / d) * overlap;
              f.y += (oy / d) * overlap;
            }
          }
        }

        for (const v of game.vaults) {
          if (v.unlocked) continue;
          const closestX = Math.max(v.x, Math.min(f.x, v.x + v.w));
          const closestY = Math.max(v.y, Math.min(f.y, v.y + v.h));
          const ox = f.x - closestX;
          const oy = f.y - closestY;
          const d = Math.hypot(ox, oy);
          if (d < f.r) {
            const overlap = f.r - d;
            if (d > 0.001) {
              f.x += (ox / d) * overlap;
              f.y += (oy / d) * overlap;
            }
          }
        }

        for (const br of game.bridges) {
          if (br.active) continue;
          const closestX = Math.max(br.x, Math.min(f.x, br.x + br.w));
          const closestY = Math.max(br.y, Math.min(f.y, br.y + br.h));
          const ox = f.x - closestX;
          const oy = f.y - closestY;
          const d = Math.hypot(ox, oy);
          if (d < f.r) {
            const overlap = f.r - d;
            if (d > 0.001) {
              f.x += (ox / d) * overlap;
              f.y += (oy / d) * overlap;
            }
          }
        }
      }

      function updateLasersAndVaults(dt) {
        game.laserPaths = [];

        const emitters = [
          { x: 720, y: 1420, dirX: 0, dirY: -1, mirrorIdx: 0, vaultIdx: 0 },
          { x: 1480, y: 1420, dirX: 0, dirY: -1, mirrorIdx: 1, vaultIdx: 1 }
        ];

        for (const em of emitters) {
          const m = game.mirrors[em.mirrorIdx];
          const v = game.vaults[em.vaultIdx];
          if (v.cooldown > 0) v.cooldown = Math.max(0, v.cooldown - dt);

          const pts = [{ x: em.x, y: em.y }];
          if (m) {
            pts.push({ x: m.x, y: m.y });
            const outDx = m.angle === 0 ? -1 : 1;
            const endX = m.x + outDx * 220;
            const endY = m.y;
            pts.push({ x: endX, y: endY });

            const vCx = v.x + v.w * 0.5;
            const vCy = v.y + v.h * 0.5;
            const hitsVault =
              Math.abs(endX - vCx) <= v.w * 0.65 && Math.abs(endY - vCy) <= v.h * 0.65;

            if (hitsVault && v.cooldown <= 0) {
              v.unlocked = true;
              v.cooldown = 16;
              let winnerFighter = null;
              let bestD = Infinity;
              for (const f of game.fighters) {
                if (f.deadTimer <= 0) {
                  const d = Math.hypot(f.x - vCx, f.y - vCy);
                  if (d < bestD) {
                    bestD = d;
                    winnerFighter = f;
                  }
                }
              }
              const winnerTeam = winnerFighter ? winnerFighter.team : "crimson";
              game.scores[winnerTeam] += 150;
              if (winnerFighter) grantXp(winnerFighter, 50);
              addFloatingText(vCx, vCy - 24, `${winnerTeam.toUpperCase()} VAULT +150`, "#ffd166");
              setTimeout(() => {
                if (game.running) v.unlocked = false;
              }, 3500);
            }
          }
          game.laserPaths.push({ pts, active: v.unlocked || v.cooldown > 12 });
        }
      }

      function updateFighterAI(f, dt) {
        f.aiTargetTimer -= dt;
        if (f.aiTargetTimer <= 0) {
          f.aiTargetTimer = 0.55 + Math.random() * 0.65;

          let nearestFoe = null;
          let nearestDist = 420;
          for (const other of game.fighters) {
            if (other.team !== f.team && other.deadTimer <= 0) {
              const d = Math.hypot(other.x - f.x, other.y - f.y);
              if (d < nearestDist) {
                nearestDist = d;
                nearestFoe = other;
              }
            }
          }

          if (nearestFoe) {
            f.aiMoveAngle = Math.atan2(nearestFoe.y - f.y, nearestFoe.x - f.x);
            f.facing = f.aiMoveAngle;
            if (nearestDist < 72 && f.slashCd <= 0) {
              performSlash(f);
            } else if (nearestDist < 190 && f.skillCd <= 0 && Math.random() < 0.45) {
              performSkill(f);
            } else if (nearestDist > 120 && nearestDist < 260 && f.dashCd <= 0 && Math.random() < 0.3) {
              performDash(f);
            }
          } else if (game.oniBoss) {
            f.aiMoveAngle = Math.atan2(game.oniBoss.y - f.y, game.oniBoss.x - f.x);
            f.facing = f.aiMoveAngle;
            if (Math.hypot(game.oniBoss.x - f.x, game.oniBoss.y - f.y) < 85 && f.slashCd <= 0) {
              performSlash(f);
            }
          } else {
            const tx = WORLD_W * 0.5 + (Math.random() - 0.5) * 900;
            const ty = WORLD_H * 0.5 + (Math.random() - 0.5) * 650;
            f.aiMoveAngle = Math.atan2(ty - f.y, tx - f.x);
            f.facing = f.aiMoveAngle;
          }
        }

        const stats = getFighterStats(f);
        f.vx += Math.cos(f.aiMoveAngle) * stats.speed * 7 * dt;
        f.vy += Math.sin(f.aiMoveAngle) * stats.speed * 7 * dt;
      }

      function updateHumanInput(f, dt) {
        let mx = 0;
        let my = 0;
        if (input.keys.has("KeyW") || input.keys.has("ArrowUp")) my -= 1;
        if (input.keys.has("KeyS") || input.keys.has("ArrowDown")) my += 1;
        if (input.keys.has("KeyA") || input.keys.has("ArrowLeft")) mx -= 1;
        if (input.keys.has("KeyD") || input.keys.has("ArrowRight")) mx += 1;

        if (input.joyActive) {
          mx += input.joyDx;
          my += input.joyDy;
        }

        const mag = Math.hypot(mx, my);
        if (mag > 0.08) {
          const nx = mx / Math.max(1, mag);
          const ny = my / Math.max(1, mag);
          const stats = getFighterStats(f);
          f.vx += nx * stats.speed * 9 * dt;
          f.vy += ny * stats.speed * 9 * dt;
          f.facing = Math.atan2(ny, nx);
        }
      }

      function stepSimulation(dt) {
        if (!game.running || game.ended || game.guideOpen) return;

        game.timeLeft = Math.max(0, game.timeLeft - dt);
        if (game.bannerTimer > 0) {
          game.bannerTimer = Math.max(0, game.bannerTimer - dt);
        }

        const cx = WORLD_W * 0.5;
        const cy = WORLD_H * 0.5;
        let coreCrimson = 0;
        let coreAzure = 0;

        for (const f of game.fighters) {
          if (f.deadTimer <= 0 && Math.hypot(f.x - cx, f.y - cy) < 130) {
            grantXp(f, 8 * dt);
            if (f.team === "crimson") coreCrimson++;
            else coreAzure++;
          }
        }
        if (coreCrimson > coreAzure) {
          game.scores.crimson += 12 * dt;
        } else if (coreAzure > coreCrimson) {
          game.scores.azure += 12 * dt;
        }

        if (!game.oniBoss) {
          game.oniRespawnTimer -= dt;
          if (game.oniRespawnTimer <= 0) {
            spawnOniBoss();
          }
        } else if (game.oniBoss.hitFlash > 0) {
          game.oniBoss.hitFlash = Math.max(0, game.oniBoss.hitFlash - dt);
        }

        game.scrollSpawnTimer -= dt;
        if (game.scrollSpawnTimer <= 0 && game.scrolls.length < 4) {
          spawnScroll();
          game.scrollSpawnTimer = 11;
        }

        for (const rd of game.radars) {
          if (rd.revealTimer > 0) {
            rd.revealTimer = Math.max(0, rd.revealTimer - dt);
            if (rd.revealTimer === 0) rd.owner = null;
          }
        }

        for (const lv of game.levers) {
          if (lv.cd > 0) lv.cd = Math.max(0, lv.cd - dt);
        }
        for (const m of game.mirrors) {
          if (m.cd > 0) m.cd = Math.max(0, m.cd - dt);
        }

        for (const pl of game.plates) {
          let pressed = false;
          for (const f of game.fighters) {
            if (f.deadTimer <= 0 && Math.hypot(f.x - pl.x, f.y - pl.y) <= pl.r + f.r) {
              pressed = true;
              break;
            }
          }
          pl.active = pressed;
          const br = game.bridges.find((b) => b.id === pl.id);
          if (br) br.active = pressed;
        }

        for (const f of game.fighters) {
          f.animTime += dt;
          if (f.slashCd > 0) f.slashCd = Math.max(0, f.slashCd - dt);
          if (f.dashCd > 0) f.dashCd = Math.max(0, f.dashCd - dt);
          if (f.skillCd > 0) f.skillCd = Math.max(0, f.skillCd - dt);
          if (f.slashAnim > 0) f.slashAnim = Math.max(0, f.slashAnim - dt);
          if (f.dashTimer > 0) f.dashTimer = Math.max(0, f.dashTimer - dt);
          if (f.stunTimer > 0) f.stunTimer = Math.max(0, f.stunTimer - dt);
          if (f.tpCd > 0) f.tpCd = Math.max(0, f.tpCd - dt);

          if (f.buffTimer > 0) {
            f.buffTimer = Math.max(0, f.buffTimer - dt);
            if (f.buffTimer === 0) f.buffType = null;
          }

          if (f.deadTimer > 0) {
            f.deadTimer = Math.max(0, f.deadTimer - dt);
            if (f.deadTimer === 0) {
              const stats = getFighterStats(f);
              f.x = f.spawnX;
              f.y = f.spawnY;
              f.vx = 0;
              f.vy = 0;
              f.maxHp = stats.maxHp;
              f.hp = f.maxHp;
              f.shield = 0;
              spawnBurst(f.x, f.y, f.charDef.accentColor, 14);
            }
            continue;
          }

          if (f.stunTimer <= 0) {
            if (f.isHuman) updateHumanInput(f, dt);
            else updateFighterAI(f, dt);
          }

          let inGravity = false;
          for (const gf of game.gravityFields) {
            if (f.x >= gf.x && f.x <= gf.x + gf.w && f.y >= gf.y && f.y <= gf.y + gf.h) {
              inGravity = true;
              break;
            }
          }

          for (const wp of game.windPads) {
            if (Math.hypot(f.x - wp.x, f.y - wp.y) <= wp.r + f.r) {
              f.vx += wp.vx * dt * 2.2;
              f.vy += wp.vy * dt * 2.2;
              if (f.isHuman) {
                camera.targetZoom = Math.max(0.42, getResponsiveBaseZoom() * 0.9);
              }
            }
          }

          for (const sh of game.shrines) {
            if (sh.team === f.team && Math.hypot(f.x - sh.x, f.y - sh.y) <= sh.r + f.r) {
              f.hp = Math.min(f.maxHp, f.hp + 18 * dt);
              f.skillCd = Math.max(0, f.skillCd - 1.5 * dt);
            }
          }

          if (f.tpCd <= 0) {
            for (const tp of game.teleporters) {
              if (Math.hypot(f.x - tp.x, f.y - tp.y) <= tp.r) {
                const dest = game.teleporters.find((t) => t.id === tp.pairId);
                if (dest) {
                  spawnBurst(f.x, f.y, tp.color, 12);
                  f.x = dest.x;
                  f.y = dest.y;
                  f.tpCd = 2.6;
                  spawnBurst(f.x, f.y, dest.color, 14);
                  break;
                }
              }
            }
          }

          for (let i = game.scrolls.length - 1; i >= 0; i--) {
            const sc = game.scrolls[i];
            if (Math.hypot(f.x - sc.x, f.y - sc.y) <= sc.r + f.r + 6) {
              f.buffType = sc.kind;
              f.buffTimer = 8;
              if (sc.kind === "SHIELD") f.shield = Math.max(f.shield, 55);
              grantXp(f, 20);
              addFloatingText(f.x, f.y - 24, sc.label, sc.color);
              spawnBurst(sc.x, sc.y, sc.color, 12);
              game.scrolls.splice(i, 1);
            }
          }

          const drag = f.dashTimer > 0 ? 0.94 : inGravity ? 0.78 : 0.86;
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.vx *= Math.pow(drag, dt * 60);
          f.vy *= Math.pow(drag, dt * 60);

          resolveSolidObstacles(f);

          let insideStealth = false;
          for (const sz of game.stealthZones) {
            if (f.x >= sz.x && f.x <= sz.x + sz.w && f.y >= sz.y && f.y <= sz.y + sz.h) {
              insideStealth = true;
              break;
            }
          }
          f.stealthed = insideStealth;
        }

        updateLasersAndVaults(dt);

        for (const p of game.sakuraPetals) {
          p.phase += dt * 2.5;
          p.x += (p.vx + Math.sin(p.phase) * 14) * dt;
          p.y += p.vy * dt;
          if (p.x < 0) p.x += WORLD_W;
          if (p.y > WORLD_H) {
            p.y = 0;
            p.x = Math.random() * WORLD_W;
          }
        }

        for (const k of game.koiFish) {
          k.angle += k.speed * dt;
        }

        for (let i = game.particles.length - 1; i >= 0; i--) {
          const pt = game.particles[i];
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.life -= dt;
          if (pt.life <= 0) game.particles.splice(i, 1);
        }

        for (let i = game.floatingTexts.length - 1; i >= 0; i--) {
          const ft = game.floatingTexts[i];
          ft.y -= 28 * dt;
          ft.life -= dt;
          if (ft.life <= 0) game.floatingTexts.splice(i, 1);
        }

        const human = game.fighters.find((f) => f.id === net.id);
        if (human && human.deadTimer <= 0) {
          const lookAheadX = human.facing ? Math.cos(human.facing) * 48 : 0;
          const lookAheadY = human.facing ? Math.sin(human.facing) * 34 : 0;
          const targetX = human.x + lookAheadX;
          const targetY = human.y + lookAheadY;

          camera.x += (targetX - camera.x) * Math.min(1, dt * 6.5);
          camera.y += (targetY - camera.y) * Math.min(1, dt * 6.5);
        }

        const baseZ = getResponsiveBaseZoom();
        camera.targetZoom += (baseZ - camera.targetZoom) * Math.min(1, dt * 2.8);
        camera.zoom += (camera.targetZoom - camera.zoom) * Math.min(1, dt * 7);

        if (camera.shake > 0) {
          camera.shake = Math.max(0, camera.shake - dt * 28);
        }

        const viewW = window.innerWidth / camera.zoom;
        const viewH = window.innerHeight / camera.zoom;
        const halfW = viewW * 0.5;
        const halfH = viewH * 0.5;

        if (viewW >= WORLD_W) {
          camera.x = WORLD_W * 0.5;
        } else {
          camera.x = Math.max(halfW, Math.min(WORLD_W - halfW, camera.x));
        }

        if (viewH >= WORLD_H) {
          camera.y = WORLD_H * 0.5;
        } else {
          camera.y = Math.max(halfH, Math.min(WORLD_H - halfH, camera.y));
        }

        if (game.timeLeft <= 0 && !game.ended) {
          finishMatch();
        }

        updateHudDom();
      }

      function finishMatch() {
        game.ended = true;
        game.running = false;
        game.guideOpen = false;
        mapGuideModal.classList.remove("active");
        touchControls.classList.remove("active");

        const cScore = Math.round(game.scores.crimson);
        const aScore = Math.round(game.scores.azure);
        const winnerEl = document.getElementById("winnerTitle");
        const sumEl = document.getElementById("matchSummaryText");

        if (cScore > aScore) {
          winnerEl.textContent = "CRIMSON CLAN VICTORY";
          winnerEl.style.color = "#ff6b88";
        } else if (aScore > cScore) {
          winnerEl.textContent = "AZURE CLAN VICTORY";
          winnerEl.style.color = "#5ce1ff";
        } else {
          winnerEl.textContent = "CLASH DRAW";
          winnerEl.style.color = "#ffd166";
        }

        document.getElementById("finalCrimsonScore").textContent = `CRIMSON: ${cScore}`;
        document.getElementById("finalAzureScore").textContent = `AZURE: ${aScore}`;

        const human = game.fighters.find((f) => f.id === net.id);
        const playerWon =
          human &&
          ((human.team === "crimson" && cScore > aScore) ||
            (human.team === "azure" && aScore > cScore));
        sumEl.textContent = human
          ? playerWon
            ? `${human.name} (LV.${human.level}), your clan dominated the Stronghold!`
            : `${human.name} (LV.${human.level}), intense PvPvE clash in the Stronghold!`
          : "Simulation complete.";

        matchEndModal.classList.add("active");
      }

      function updateHudDom() {
        document.getElementById("crimsonScoreText").textContent = Math.round(game.scores.crimson);
        document.getElementById("azureScoreText").textContent = Math.round(game.scores.azure);

        const secs = Math.ceil(game.timeLeft);
        const mm = String(Math.floor(secs / 60)).padStart(2, "0");
        const ss = String(secs % 60).padStart(2, "0");
        document.getElementById("matchTimerText").textContent = `${mm}:${ss}`;

        const human = game.fighters.find((f) => f.id === net.id);
        if (human) {
          const stats = getFighterStats(human);
          const reqXp = getXpRequiredForLevel(human.level);
          const hpPct = Math.max(0, Math.min(100, (human.hp / human.maxHp) * 100));
          const xpPct =
            human.level >= MAX_LEVEL
              ? 100
              : Math.max(0, Math.min(100, (human.xp / reqXp) * 100));

          document.getElementById("hpBarFill").style.width = `${hpPct}%`;
          document.getElementById("xpBarFill").style.width = `${xpPct}%`;
          document.getElementById("playerLevelText").textContent = `LV.${human.level} • ${human.charDef.name}`;
          document.getElementById("playerXpText").textContent =
            human.level >= MAX_LEVEL ? "MAX LV.10" : `XP ${Math.floor(human.xp)} / ${reqXp}`;

          const stateTxt =
            human.deadTimer > 0
              ? `RESPAWN ${human.deadTimer.toFixed(1)}s`
              : `HP ${Math.ceil(human.hp)}/${human.maxHp} | ATK ${stats.slashDmg}`;
          const shTxt = human.shield > 0 ? ` | SHD ${Math.ceil(human.shield)}` : "";
          document.getElementById("playerMetaText").textContent = `${stateTxt}${shTxt}`;
          document.getElementById("buffMetaText").textContent = human.buffType
            ? `BUFF: ${human.buffType} (${human.buffTimer.toFixed(1)}s)`
            : "BUFF: NONE";
        }
      }

      let dojoFloor=null;
      const sakuraSites=[[130,170],[530,130],[1670,130],[2070,170],[140,1300],[480,1390],[1720,1390],[2060,1300],[520,530],[1680,960]];
      function pixelRect(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),w,h);}
      function torii(c,x,y,col,scale=1){c.save();c.translate(x,y);c.scale(scale,scale);pixelRect(c,-34,-42,9,80,'#17283b');pixelRect(c,25,-42,9,80,'#17283b');pixelRect(c,-44,-48,88,10,col);pixelRect(c,-50,-53,100,5,'#090e1b');pixelRect(c,-38,-27,76,7,col);pixelRect(c,-30,30,18,8,'#354356');pixelRect(c,17,30,18,8,'#354356');pixelRect(c,-6,-47,12,23,'#e0b66b');c.restore();}
      function drawDojoArt(c){
       if(!dojoFloor){dojoFloor=document.createElement('canvas');dojoFloor.width=WORLD_W;dojoFloor.height=WORLD_H;const p=dojoFloor.getContext('2d');
        p.fillStyle='#101725';p.fillRect(0,0,WORLD_W,WORLD_H);
        for(let y=0;y<WORLD_H;y+=40)for(let x=0;x<WORLD_W;x+=40){let n=(x*17+y*23)%97;pixelRect(p,x+1,y+1,38,38,n<30?'#17202e':n<65?'#131c2a':'#1a2330');pixelRect(p,x+4,y+4,30,1,'#273040');}
        // Raised stone paths and contrasting woven tatami wings.
        for(const x of [95,1775]){pixelRect(p,x-10,340,340,820,'#050b15');for(let y=350;y<1150;y+=80)for(let xx=x;xx<x+320;xx+=80){pixelRect(p,xx,y,77,77,'#384038');for(let k=4;k<76;k+=5)pixelRect(p,xx+3,y+k,70,1,'#4c5444');pixelRect(p,xx,y,4,77,'#85794d');}pixelRect(p,x,340,320,7,'#9d8558');pixelRect(p,x,1154,320,7,'#9d8558');}
        pixelRect(p,620,1140,960,300,'#161c2c');for(let x=620;x<1580;x+=60){pixelRect(p,x,1140,2,300,'#283b50');for(let y=1140;y<1440;y+=60)pixelRect(p,x+5,y+5,50,50,'#1b2939');}
        p.strokeStyle='#102e42';p.lineWidth=8;p.beginPath();p.arc(1100,750,225,0,Math.PI*2);p.stroke();p.fillStyle='#101f30';p.beginPath();p.arc(1100,750,225,0,Math.PI*2);p.fill();
        for(let a=0;a<Math.PI*2;a+=Math.PI/12){p.strokeStyle='#1f4b5e';p.lineWidth=2;p.beginPath();p.moveTo(1100+Math.cos(a)*145,750+Math.sin(a)*145);p.lineTo(1100+Math.cos(a)*210,750+Math.sin(a)*210);p.stroke();pixelRect(p,1100+Math.cos(a)*205-3,750+Math.sin(a)*205-3,6,6,'#28a9b5');}
        p.font='bold 65px serif';p.textAlign='center';p.fillStyle='#15526a';p.fillText('零',1100,774);
        // Boundary walls, eaves and northern bamboo forest.
        for(let x=0;x<2200;x+=32){pixelRect(p,x,0,30,35,'#273149');pixelRect(p,x,1460,30,40,'#273149');pixelRect(p,x,30,30,4,'#ab7951');}for(let y=0;y<1500;y+=32){pixelRect(p,0,y,34,30,'#26334a');pixelRect(p,2166,y,34,30,'#26334a');}
        for(let x=650;x<1570;x+=50){const y=130+(x*13%90);pixelRect(p,x,y,6,100,'#22644e');for(let n=0;n<5;n++){pixelRect(p,x-1,y+n*20,9,3,'#61a56b');pixelRect(p,x-16,y+n*20-5,18,3,'#285f4c');pixelRect(p,x+3,y+n*20-9,20,3,'#388565');}}
        // Monument: a large layered pixel samurai guarding the core.
        pixelRect(p,1000,280,200,28,'#343e51');pixelRect(p,1022,256,156,24,'#50546a');pixelRect(p,1060,165,80,91,'#374258');pixelRect(p,1041,185,118,24,'#46536a');pixelRect(p,1070,127,60,40,'#77828d');pixelRect(p,1058,116,84,15,'#333e55');pixelRect(p,1040,103,120,13,'#58647a');pixelRect(p,1032,87,18,27,'#bba266');pixelRect(p,1150,87,18,27,'#bba266');pixelRect(p,1080,143,40,5,'#51d9dc');pixelRect(p,1165,169,8,88,'#8cbbbd');
        for(const [x,y]of sakuraSites){pixelRect(p,x-8,y,16,74,'#523847');pixelRect(p,x-20,y+66,40,8,'#302c3e');for(let i=0;i<14;i++){const xx=x+Math.sin(i*2.4)*48,yy=y-35+Math.cos(i*1.6)*27;pixelRect(p,xx-17,yy,34,22,i%3?'#9b436e':'#d76f9a');pixelRect(p,xx-12,yy,22,4,'#f59ebe');}}
        torii(p,160,750,'#ff4669',1.4);torii(p,2040,750,'#24c9ed',1.4);
       }c.drawImage(dojoFloor,0,0);
      }
      function drawWaterDetails(c){const t=performance.now()/1000;
       for(let i=0;i<95;i++){const a=i*.47+t*.11,r=244+(i%5)*6,x=1100+Math.cos(a)*r,y=750+Math.sin(a)*r;pixelRect(c,x,y,8+i%7,2,i%3?'#167d99':'#51d6e3');}
       for(const x of [826,1346]){for(let i=0;i<10;i++)pixelRect(c,x+(i%4)*5,718+((i*12+t*45)%62),3,12,'#35a8cc');}
       // Four arched wooden bridges; north/south light bridges remain tactical.
       for(const [x,y,rot]of [[844,750,0],[1356,750,0],[1100,494,Math.PI/2],[1100,1006,Math.PI/2]]){c.save();c.translate(x,y);c.rotate(rot);for(let i=-28;i<28;i+=7){let rise=Math.round(Math.cos(i/28*Math.PI/2)*5);pixelRect(c,i,-22-rise,6,44,'#8d6845');pixelRect(c,i,-22-rise,6,2,'#c79963');}pixelRect(c,-32,-28,64,4,'#dab377');pixelRect(c,-32,25,64,4,'#54b9b5');c.restore();}
      }
      function drawLivingDetails(c){const t=performance.now()/1000;
       for(const [x,y]of [[370,420],[1830,420],[370,1100],[1830,1100],[730,180],[1470,180],[900,1320],[1300,1320]]){const sway=Math.sin(t*1.8+x)*4;pixelRect(c,x,y-45,3,35,'#61536c');c.save();c.translate(x+sway,y);c.fillStyle='#ffb76c20';c.fillRect(-22,-28,44,52);pixelRect(c,-10,-20,20,28,'#ec8d73');pixelRect(c,-8,-18,16,24,'#ffc38a');for(let i=-6;i<8;i+=5)pixelRect(c,i,-18,1,24,'#ba6a6c');pixelRect(c,-12,-23,24,3,'#654256');pixelRect(c,-12,8,24,3,'#654256');pixelRect(c,-1,11,2,9,'#ff7e9c');c.restore();}
       c.textAlign='center';c.font='bold 24px serif';for(const [x,y,txt]of [[950,175,'影'],[1250,175,'忍'],[930,1370,'宝'],[1270,1370,'光']]){c.fillStyle='#39d9ef18';c.fillRect(x-24,y-38,48,65);c.fillStyle='#5edee6';c.fillText(txt,x,y);for(let i=0;i<7;i++)pixelRect(c,x-22,y-33+i*8+(t*6%8),44,1,'#48d3ee20');}
       for(const sh of game.shrines){c.save();c.translate(sh.x,sh.y);pixelRect(c,-28,-25,56,45,'#384151');pixelRect(c,-22,-18,44,30,'#1e2939');pixelRect(c,-10,-8,20,20,'#5ce9be');pixelRect(c,-38,-30,76,7,'#61727d');pixelRect(c,-30,-37,60,7,'#80918a');pixelRect(c,-18,-43,36,6,'#b6ad7c');c.strokeStyle='#67e6bb70';c.beginPath();c.arc(0,0,sh.r+Math.sin(t*2)*4,0,Math.PI*2);c.stroke();c.restore();}
       for(const tp of game.teleporters){torii(c,tp.x,tp.y,tp.color,.8);c.strokeStyle=tp.color;c.lineWidth=2;c.beginPath();c.ellipse(tp.x,tp.y,13+Math.sin(t*3)*3,25,0,0,Math.PI*2);c.stroke();}
       for(const rd of game.radars){pixelRect(c,rd.x-10,rd.y-38,20,40,'#35445b');pixelRect(c,rd.x-18,rd.y-42,36,7,'#89c2c8');if(rd.revealTimer>0){c.strokeStyle=rd.owner==='crimson'?'#ff3b6b70':'#3de7ff70';for(let i=0;i<3;i++){c.beginPath();c.arc(rd.x,rd.y,((t*75+i*70)%220),0,Math.PI*2);c.stroke();}}}
       for(const z of game.stealthZones)for(let i=0;i<12;i++){const x=z.x+15+(i*43%Math.floor(z.w-20)),y=z.y+20+(i*31%Math.floor(z.h-20));pixelRect(c,x,y-22,4,30,'#3b9a72');pixelRect(c,x-6,y-12,16,3,'#61a981');}
       for(const [x,y]of [[720,1420],[1480,1420]]){pixelRect(c,x-18,y-12,36,24,'#3c4c61');pixelRect(c,x-8,y-10,16,8,'#6bfbda');for(let i=0;i<4;i++){const phase=(t*3+i*.25)%1;pixelRect(c,x+Math.sin(i*8+t)*phase*23,y-phase*35,3,3,'#abffec');}}
      }
      function drawPixelSamuraiSprite(c,x,y,scale,char,team,facing,time,stealth){
       c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale*1.25,scale*1.25);if(stealth)c.globalAlpha=.38;
       const bob=Math.round(Math.sin(time*6)),stride=Math.round(Math.sin(time*10)*2),col=char.primaryColor,accent=char.accentColor;
       pixelRect(c,-12,13,24,4,'#00000050');pixelRect(c,-7,7+stride,5,9,'#232b42');pixelRect(c,2,7-stride,5,9,'#232b42');pixelRect(c,-9,15+stride,8,3,'#8595a4');pixelRect(c,1,15-stride,8,3,'#8595a4');
       pixelRect(c,-9,-5+bob,18,15,col);pixelRect(c,-7,-3+bob,14,5,'#ffffff25');pixelRect(c,-10,6+bob,20,3,'#bd9b60');pixelRect(c,-3,-4+bob,6,12,team==='crimson'?'#ff335c':'#1ccde6');
       pixelRect(c,-7,-16+bob,14,12,'#e8bb96');pixelRect(c,-9,-20+bob,18,6,'#20283e');pixelRect(c,-11,-17+bob,22,3,col);pixelRect(c,-7,-10+bob,14,4,'#1a2337');pixelRect(c,Math.cos(facing)>0?1:-5,-13+bob,5,3,accent);
       if(char.id==='guardian'){pixelRect(c,-15,-5+bob,7,12,'#789aaa');pixelRect(c,8,-5+bob,7,12,'#789aaa');pixelRect(c,-12,-23+bob,4,9,'#d1b676');pixelRect(c,8,-23+bob,4,9,'#d1b676');pixelRect(c,-17,0,8,14,'#4bbbe0');}
       else if(char.id==='ninja'){pixelRect(c,-8,-16+bob,16,5,'#7a44ba');pixelRect(c,9,-14+bob,8+stride,3,'#bd7fff');pixelRect(c,-5,-7+bob,10,4,'#0e1c2a');pixelRect(c,-14,0,4,12,accent);}
       else{pixelRect(c,-11,-24+bob,22,4,'#443649');pixelRect(c,-15,-21+bob,30,3,'#c0a16c');pixelRect(c,-13,-7+bob,5,13,'#9b234e');pixelRect(c,9,-6+bob,4,15,'#c43968');}
       c.rotate(facing);pixelRect(c,10,-1,7,4,'#cb9f68');pixelRect(c,17,-3,2,8,'#e2b465');pixelRect(c,19,-2,18,3,'#d7f1e8');pixelRect(c,19,-3,15,1,accent);c.restore();
      }

      function drawWorld() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        ctx.clearRect(0, 0, vw, vh);

        const shakeX = camera.shake > 0 ? (Math.random() - 0.5) * camera.shake : 0;
        const shakeY = camera.shake > 0 ? (Math.random() - 0.5) * camera.shake : 0;

        ctx.save();
        ctx.translate(vw * 0.5 + shakeX, vh * 0.5 + shakeY);
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);

        ctx.fillStyle = "#101626";
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);

        const tile = 64;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= WORLD_W; x += tile) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, WORLD_H);
          ctx.stroke();
        }
        for (let y = 0; y <= WORLD_H; y += tile) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(WORLD_W, y);
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(92, 130, 74, 0.14)";
        ctx.fillRect(110, 360, 260, 780);
        ctx.fillRect(WORLD_W - 370, 360, 260, 780);

        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.font = "900 22px monospace";
        ctx.textAlign = "center";
        ctx.fillText("NORTHERN SHADOW SANCTUM", WORLD_W * 0.5, 110);
        ctx.fillText("SOUTHERN LASER FOUNDRY", WORLD_W * 0.5, WORLD_H - 65);

        drawDojoArt(ctx);
        const cx = WORLD_W * 0.5;
        const cy = WORLD_H * 0.5;
        ctx.strokeStyle = "#0b4f6c";
        ctx.lineWidth = 34;
        ctx.beginPath();
        ctx.arc(cx, cy, 258, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(0, 217, 255, 0.25)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 241, 0, Math.PI * 2);
        ctx.arc(cx, cy, 275, 0, Math.PI * 2);
        ctx.stroke();

        drawWaterDetails(ctx);
        for (const k of game.koiFish) {
          const kx = cx + Math.cos(k.angle) * k.radius;
          const ky = cy + Math.sin(k.angle) * k.radius;
          ctx.fillStyle = k.color;
          ctx.beginPath();
          ctx.ellipse(kx, ky, 9, 4, k.angle+Math.PI/2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "#5c3a21";
        ctx.fillRect(cx - 282, cy - 26, 52, 52);
        ctx.fillRect(cx + 230, cy - 26, 52, 52);
        ctx.fillRect(cx - 26, cy - 282, 52, 52);
        ctx.fillRect(cx - 26, cy + 230, 52, 52);

        ctx.fillStyle = "rgba(0, 217, 255, 0.08)";
        ctx.beginPath();
        ctx.arc(cx, cy, 130, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 209, 102, 0.45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 130, 0, Math.PI * 2);
        ctx.stroke();

        for (const gf of game.gravityFields) {
          ctx.fillStyle = "rgba(138, 43, 226, 0.18)";
          ctx.fillRect(gf.x, gf.y, gf.w, gf.h);
          ctx.strokeStyle = "rgba(181, 101, 255, 0.55)";
          ctx.strokeRect(gf.x, gf.y, gf.w, gf.h);
        }

        for (const pl of game.plates) {
          ctx.fillStyle = pl.active ? "#2ee59d" : "#28324a";
          ctx.beginPath();
          ctx.arc(pl.x, pl.y, pl.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffd166";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        for (const br of game.bridges) {
          if (br.active) {
            ctx.fillStyle = "rgba(46, 229, 157, 0.35)";
            ctx.fillRect(br.x, br.y, br.w, br.h);
            ctx.strokeStyle = "#2ee59d";
            ctx.strokeRect(br.x, br.y, br.w, br.h);
          } else {
            ctx.strokeStyle = "rgba(255, 46, 85, 0.35)";
            ctx.setLineDash([6, 6]);
            ctx.strokeRect(br.x, br.y, br.w, br.h);
            ctx.setLineDash([]);
          }
        }

        for (const wp of game.windPads) {
          ctx.strokeStyle = "#7ff7c7";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, wp.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "rgba(127, 247, 199, 0.14)";
          ctx.fill();
        }

        for (const sh of game.shrines) {
          ctx.fillStyle = sh.team === "crimson" ? "rgba(255, 46, 85, 0.16)" : "rgba(0, 217, 255, 0.16)";
          ctx.beginPath();
          ctx.arc(sh.x, sh.y, sh.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#2ee59d";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "#2ee59d";
          ctx.font = "bold 11px monospace";
          ctx.fillText("SHRINE", sh.x, sh.y + 4);
        }

        for (const tp of game.teleporters) {
          ctx.strokeStyle = tp.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, tp.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = tp.color;
          ctx.font = "bold 10px monospace";
          ctx.fillText("TORII", tp.x, tp.y + 3);
        }

        for (const rd of game.radars) {
          const rCol =
            rd.owner === "crimson" ? "#ff2e55" : rd.owner === "azure" ? "#00d9ff" : "#ffd166";
          ctx.fillStyle = "rgba(20, 28, 48, 0.9)";
          ctx.beginPath();
          ctx.arc(rd.x, rd.y, rd.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = rCol;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = rCol;
          ctx.font = "bold 10px monospace";
          ctx.fillText(rd.revealTimer > 0 ? `RADAR ${Math.ceil(rd.revealTimer)}s` : "RADAR", rd.x, rd.y + 3);
        }

        for (const lv of game.levers) {
          ctx.fillStyle = lv.closed ? "#ff6b88" : "#ffd166";
          ctx.fillRect(lv.x - 10, lv.y - 10, 20, 20);
          ctx.font = "bold 9px monospace";
          ctx.fillText("LEVER", lv.x, lv.y - 14);
        }

        for (const g of game.ironGates) {
          ctx.fillStyle = g.closed ? "#ff2e55" : "rgba(150, 165, 195, 0.16)";
          ctx.fillRect(g.x, g.y, g.w, g.h);
          ctx.strokeStyle = g.closed ? "#ffd166" : "rgba(150, 165, 195, 0.35)";
          ctx.strokeRect(g.x, g.y, g.w, g.h);
        }

        for (const lp of game.laserPaths) {
          if (lp.pts.length >= 2) {
            ctx.strokeStyle = lp.active ? "#2ee59d" : "#ff2e55";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(lp.pts[0].x, lp.pts[0].y);
            for (let i = 1; i < lp.pts.length; i++) {
              ctx.lineTo(lp.pts[i].x, lp.pts[i].y);
            }
            ctx.stroke();
          }
        }

        for (const m of game.mirrors) {
          ctx.save();
          ctx.translate(m.x, m.y);
          ctx.fillStyle = "#1c2842";
          ctx.beginPath();
          ctx.arc(0, 0, m.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#00d9ff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (m.angle === 0) {
            ctx.moveTo(-14, 14);
            ctx.lineTo(14, -14);
          } else {
            ctx.moveTo(-14, -14);
            ctx.lineTo(14, 14);
          }
          ctx.stroke();
          ctx.restore();
        }

        for (const v of game.vaults) {
          ctx.fillStyle = v.unlocked ? "rgba(46, 229, 157, 0.35)" : "#281e38";
          ctx.fillRect(v.x, v.y, v.w, v.h);
          ctx.strokeStyle = v.unlocked ? "#2ee59d" : "#ffd166";
          ctx.lineWidth = 2.5;
          ctx.strokeRect(v.x, v.y, v.w, v.h);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 10px monospace";
          ctx.fillText("VAULT", v.x + v.w * 0.5, v.y + v.h * 0.5 + 3);
        }

        for (const b of game.bamboos) {
          ctx.fillStyle = "#228b5e";
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = "#6ee7b7";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(b.x, b.y, b.w, b.h);for(let y=b.y+8;y<b.y+b.h;y+=12)pixelRect(ctx,b.x,y,b.w,2,"#94c88b");for(let x=b.x+5;x<b.x+b.w;x+=9)pixelRect(ctx,x,b.y,2,b.h,"#174932");
        }

        for (const br of game.barrels) {
          if (br.exploded) continue;
          ctx.fillStyle = "#c92a2a";
          ctx.beginPath();
          ctx.arc(br.x, br.y, br.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffd166";
          ctx.lineWidth = 2;
          ctx.stroke();pixelRect(ctx,br.x-12,br.y-12,24,24,"#a52d44");pixelRect(ctx,br.x-14,br.y-9,28,4,"#d68b58");pixelRect(ctx,br.x-14,br.y+7,28,4,"#d68b58");
        }

        for (const sc of game.scrolls) {
          sc.bob += 0.08;
          const by = sc.y + Math.sin(sc.bob) * 4;
          ctx.fillStyle = sc.color;
          ctx.beginPath();
          ctx.arc(sc.x, by, sc.r * 0.65, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "bold 9px monospace";
          ctx.fillText(sc.label, sc.x, by - 14);
        }

        if (game.oniBoss) {
          const ob = game.oniBoss;
          ctx.fillStyle = ob.hitFlash > 0 ? "#ffffff" : "#ffd166";
          ctx.beginPath();
          ctx.arc(ob.x, ob.y, ob.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ff2e55";
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.fillStyle = "#111";
          ctx.font = "900 11px monospace";
          ctx.fillText("ONI", ob.x, ob.y + 4);

          const bw = 76;
          ctx.fillStyle = "rgba(0,0,0,0.65)";
          ctx.fillRect(ob.x - bw * 0.5, ob.y - ob.r - 14, bw, 7);
          ctx.fillStyle = "#ffd166";
          ctx.fillRect(ob.x - bw * 0.5, ob.y - ob.r - 14, bw * Math.max(0, ob.hp / ob.maxHp), 7);
        }

        const radarActiveForTeam = (team) =>
          game.radars.some((rd) => rd.owner === team && rd.revealTimer > 0);

        for (const f of game.fighters) {
          if (f.deadTimer > 0) continue;

          const viewerHuman = game.fighters.find((f) => f.id === net.id);
          const enemyCanSeeStealth =
            viewerHuman && radarActiveForTeam(viewerHuman.team);
          const hideCompletely =
            f.stealthed &&
            viewerHuman &&
            viewerHuman.team !== f.team &&
            !enemyCanSeeStealth;

          if (hideCompletely) continue;

          drawPixelSamuraiSprite(
            ctx,
            f.x,
            f.y,
            1.15,
            f.charDef,
            f.team,
            f.facing,
            f.animTime,
            f.stealthed
          );

          if (f.slashAnim > 0) {
            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.facing);
            ctx.strokeStyle = f.charDef.accentColor;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, 56, -0.85, 0.85);
            ctx.stroke();
            ctx.restore();
          }

          ctx.font = "bold 10px monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = f.isHuman ? "#ffd166" : "#e2e8f0";
          ctx.fillText(`LV.${f.level} ${f.name}`, f.x, f.y - 26);

          const w = 34;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(f.x - w * 0.5, f.y - 21, w, 4);
          ctx.fillStyle = f.team === "crimson" ? "#ff2e55" : "#00d9ff";
          ctx.fillRect(f.x - w * 0.5, f.y - 21, w * Math.max(0, f.hp / f.maxHp), 4);
        }

        drawLivingDetails(ctx);
        for (const sz of game.stealthZones) {
          ctx.fillStyle = "rgba(22, 101, 52, 0.34)";
          ctx.fillRect(sz.x, sz.y, sz.w, sz.h);
          ctx.strokeStyle = "rgba(74, 222, 128, 0.45)";
          ctx.strokeRect(sz.x, sz.y, sz.w, sz.h);
        }

        ctx.fillStyle = "#ffb3d1";
        for (const p of game.sakuraPetals) {
          ctx.fillRect(p.x, p.y, p.size, p.size * 0.75);
        }

        for (const pt of game.particles) {
          ctx.fillStyle = pt.color;
          ctx.globalAlpha = Math.max(0, Math.min(1, pt.life * 2.2));
          ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
          ctx.globalAlpha = 1;
        }

        for (const ft of game.floatingTexts) {
          ctx.font = "900 12px monospace";
          ctx.textAlign = "center";
          ctx.fillStyle = ft.color;
          ctx.globalAlpha = Math.max(0, Math.min(1, ft.life));
          ctx.fillText(ft.text, ft.x, ft.y);
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      }

      function drawMinimap() {
        const mw = minimapCanvas.width;
        const mh = minimapCanvas.height;
        miniCtx.clearRect(0, 0, mw, mh);

        const sx = mw / WORLD_W;
        const sy = mh / WORLD_H;

        miniCtx.strokeStyle = "rgba(0, 217, 255, 0.45)";
        miniCtx.beginPath();
        miniCtx.arc(WORLD_W * 0.5 * sx, WORLD_H * 0.5 * sy, 14, 0, Math.PI * 2);
        miniCtx.stroke();

        if (game.oniBoss) {
          miniCtx.fillStyle = "#ffd166";
          miniCtx.fillRect(game.oniBoss.x * sx - 3, game.oniBoss.y * sy - 3, 6, 6);
        }

        for (const f of game.fighters) {
          if (f.deadTimer > 0) continue;
          miniCtx.fillStyle = f.isHuman ? "#ffd166" : f.team === "crimson" ? "#ff2e55" : "#00d9ff";
          miniCtx.fillRect(f.x * sx - 2.5, f.y * sy - 2.5, 5, 5);
        }

        const vw = (window.innerWidth / camera.zoom) * sx;
        const vh = (window.innerHeight / camera.zoom) * sy;
        const vx = (camera.x - window.innerWidth / camera.zoom * 0.5) * sx;
        const vy = (camera.y - window.innerHeight / camera.zoom * 0.5) * sy;
        miniCtx.strokeStyle = "rgba(255, 255, 255, 0.65)";
        miniCtx.lineWidth = 1;
        miniCtx.strokeRect(vx, vy, vw, vh);
      }

      const net={socket:null,id:null,code:null,lobby:null,pendingStart:false,shots:[],aim:undefined,last:0};
      const actions={slash:0,dash:0,skill:0};
      function notice(t){document.getElementById('onlineStatus').textContent=t;}
      function sendProfile(){if(net.id)net.socket.emit('profile',{name:document.getElementById('playerNameInput').value,team:lobbyState.playerTeam,charId:lobbyState.playerChar});}
      function joinOnline(start=false){if(!net.socket.connected){notice('Connecting to server… please wait');return;}net.pendingStart=start;if(net.id){if(start)net.socket.emit('start');return;}net.socket.emit('join',{code:document.getElementById('roomCode').value,name:document.getElementById('playerNameInput').value,team:lobbyState.playerTeam,charId:lobbyState.playerChar});}
      let lastLobbyPaint=0;
      function renderLobby(){
       if(performance.now()-lastLobbyPaint<80)return;lastLobbyPaint=performance.now();
       lobbyState.playerName=(document.getElementById('playerNameInput').value||'RONIN').replace(/[<>]/g,'');
       originalRenderLobby();
       if(net.lobby){for(const t of ['crimson','azure']){const roster=document.getElementById(t+'Roster');roster.replaceChildren();const list=net.lobby.members.filter(m=>m.team===t);for(let i=0;i<5;i++){const row=document.createElement('div');row.className='roster-slot'+(list[i]?.id===net.id?' is-you':'');const p=list[i];row.textContent=p?(p.name+(p.id===net.id?' · YOU':' · ONLINE')):i<list.length+net.lobby.bots[t]?'BOT '+(i-list.length+1):'EMPTY SLOT';roster.appendChild(row);}}}
       document.getElementById('enterClashBtn').textContent=net.id&&net.lobby?.host!==net.id?'WAITING FOR HOST':'ENTER CLASH';
       document.getElementById('enterClashBtn').disabled=!!net.id&&net.lobby?.host!==net.id;
      }
      function installNetwork(){
       net.socket=io({transports:['websocket','polling']});
       document.getElementById('roomCode').value=new URLSearchParams(location.search).get('room')||'';
       document.getElementById('playerNameInput').value='RONIN';
       const update=()=>sendProfile();document.getElementById('playerNameInput').addEventListener('change',update);
       for(const id of ['selectCrimsonBtn','selectAzureBtn'])document.getElementById(id).addEventListener('click',update);
       document.getElementById('charGrid').addEventListener('click',update);
       for(const id of ['addCrimsonBotBtn','rmCrimsonBotBtn','addAzureBotBtn','rmAzureBotBtn','fill5v5Btn'])document.getElementById(id).addEventListener('click',()=>{if(net.id)net.socket.emit('bots',{crimson:lobbyState.crimsonBots,azure:lobbyState.azureBots});});
       document.getElementById('joinRoom').onclick=()=>joinOnline();
       document.getElementById('inviteRoom').onclick=async()=>{if(!net.code){joinOnline();return;}const u=location.origin+'/?room='+net.code;try{await navigator.clipboard.writeText(u);notice('Invite copied — send it to your friends');}catch{notice(u);}};
       net.socket.on('connect',()=>notice('ONLINE · create a room or enter an invite code'));
       net.socket.on('connect_error',()=>notice('Server is waking up… reconnecting'));
       net.socket.on('notice',t=>{notice(t);net.pendingStart=false;});
       net.socket.on('disconnect',()=>{net.id=null;net.lobby=null;net.shots=[];game.running=false;game.ended=false;lobbyScreen.classList.remove('hidden');hudLayer.classList.remove('active');touchControls.classList.remove('active');matchEndModal.classList.remove('active');notice('Connection lost. Rejoin your room when connected.');});
       net.socket.on('joined',d=>{net.id=d.id;net.code=d.code;document.getElementById('roomCode').value=d.code;history.replaceState(null,'','/?room='+d.code);if(net.pendingStart){net.socket.emit('bots',{crimson:lobbyState.crimsonBots,azure:lobbyState.azureBots});net.socket.emit('start');net.pendingStart=false;}});
       net.socket.on('lobby',s=>{net.lobby=s;lobbyState.crimsonBots=s.bots.crimson;lobbyState.azureBots=s.bots.azure;const me=s.members.find(m=>m.id===net.id);if(me){lobbyState.playerTeam=me.team;lobbyState.playerChar=me.charId;}notice('ROOM '+s.code+' · '+s.members.length+'/10 online · '+(s.host===net.id?'YOU ARE HOST':'HOST STARTS THE MATCH'));});
       net.socket.on('state',s=>{const was=game.running,ended=game.ended;const previous=new Map(game.fighters.map(f=>[f.id,f]));Object.assign(game,s);game.fighters=s.fighters.map(f=>{const p=previous.get(f.id);return {...f,charDef:CHARACTERS.find(c=>c.id===f.charId),tx:f.x,ty:f.y,x:p&&Math.hypot(p.x-f.x,p.y-f.y)<200?p.x:f.x,y:p&&Math.hypot(p.x-f.x,p.y-f.y)<200?p.y:f.y};});if(s.running){if(!was){initEnvironmentDecor();const me=game.fighters.find(f=>f.id===net.id);if(me){camera.x=me.x;camera.y=me.y;}camera.zoom=getResponsiveBaseZoom();}lobbyScreen.classList.add('hidden');hudLayer.classList.add('active');matchEndModal.classList.remove('active');updateTouchVisibility();}if(s.ended&&!ended)finishMatch();document.getElementById('eventBannerText').textContent=s.bannerText;});
       // Override local simulation actions; all effects are decided by the server.
       startMatch=()=>joinOnline(true);
       performSlash=()=>{actions.slash=2};performDash=()=>{actions.dash=2};performSkill=()=>{actions.skill=2};
       const oldReturn=returnToLobby;returnToLobby=()=>{net.socket.emit('leave');net.id=null;net.code=null;net.lobby=null;game.fighters=[];document.getElementById('roomCode').value='';history.replaceState(null,'','/');oldReturn();};
       // Existing listeners captured original functions: replace only these buttons.
       for(const [id,fn]of [['enterClashBtn',startMatch],['rematchBtn',startMatch],['backToLobbyBtn',returnToLobby],['lobbyReturnBtn',returnToLobby]]){const old=document.getElementById(id),b=old.cloneNode(true);old.replaceWith(b);b.onclick=fn;}
       window.addEventListener('blur',()=>{input.keys.clear();input.joyDx=input.joyDy=0;input.joyActive=false;});
       window.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')input.keys.clear();});
       canvas.addEventListener('pointerdown',e=>{const me=game.fighters.find(f=>f.id===net.id);if(me)net.aim=Math.atan2((e.clientY-innerHeight/2)/camera.zoom+camera.y-me.y,(e.clientX-innerWidth/2)/camera.zoom+camera.x-me.x);});
       setInterval(()=>{if(!net.id||!game.running)return;const k=input.keys;let x=(k.has('KeyD')||k.has('ArrowRight')?1:0)-(k.has('KeyA')||k.has('ArrowLeft')?1:0)+(input.joyActive?input.joyDx:0),y=(k.has('KeyS')||k.has('ArrowDown')?1:0)-(k.has('KeyW')||k.has('ArrowUp')?1:0)+(input.joyActive?input.joyDy:0);net.socket.emit('input',{x:game.guideOpen?0:x,y:game.guideOpen?0:y,aim:net.aim,slash:!game.guideOpen&&(actions.slash>0||k.has('KeyJ')),dash:!game.guideOpen&&(actions.dash>0||k.has('Space')),skill:!game.guideOpen&&(actions.skill>0||k.has('KeyK')||k.has('KeyE'))});net.aim=undefined;for(const a in actions)actions[a]=Math.max(0,actions[a]-1);},50);
       setTimeout(()=>document.querySelectorAll('.char-card').forEach(c=>{c.tabIndex=0;c.setAttribute('role','button');c.setAttribute('aria-label',c.querySelector('.char-name').textContent);c.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')c.click();}}),0);
      }
      getResponsiveBaseZoom=()=>{const w=window.innerWidth,h=window.innerHeight;let z=Math.min(w/1250,h/860);z*=camera.zoomMode==='NORMAL'?1.3:camera.zoomMode==='TACTICAL'?1.65:1;return Math.max(w/WORLD_W,h/WORLD_H,Math.min(1.3,z));};
      function stepVisuals(dt){
       for(const f of game.fighters){f.x+=(f.tx-f.x)*Math.min(1,dt*16);f.y+=(f.ty-f.y)*Math.min(1,dt*16);f.animTime+=dt;}
       const me=game.fighters.find(f=>f.id===net.id);if(me){const tx=me.x+Math.cos(me.facing)*65,ty=me.y+Math.sin(me.facing)*45;const dx=tx-camera.x,dy=ty-camera.y;camera.x+=Math.sign(dx)*Math.max(0,Math.abs(dx)-25)*(1-Math.exp(-dt*7));camera.y+=Math.sign(dy)*Math.max(0,Math.abs(dy)-20)*(1-Math.exp(-dt*7));const zoom=Math.max(innerWidth/WORLD_W,innerHeight/WORLD_H,getResponsiveBaseZoom()*(me.dashTimer>0?.9:1));camera.zoom+=(zoom-camera.zoom)*(1-Math.exp(-dt*6));}
       const hw=innerWidth/camera.zoom/2,hh=innerHeight/camera.zoom/2;camera.x=Math.max(hw,Math.min(WORLD_W-hw,camera.x));camera.y=Math.max(hh,Math.min(WORLD_H-hh,camera.y));
       for(const p of game.sakuraPetals){p.phase+=dt*2;p.x=(p.x+(p.vx+Math.sin(p.phase)*12)*dt+WORLD_W)%WORLD_W;p.y=(p.y+p.vy*dt)%WORLD_H;}for(const k of game.koiFish)k.angle+=k.speed*dt;
       updateHudDom();const labels=[['touchSlashBtn','SLASH',me?.slashCd],['touchDashBtn','DASH',me?.dashCd],['touchSkillBtn','SKILL',me?.skillCd]];for(const [id,name,cd]of labels){const b=document.getElementById(id);b.textContent=name+(cd>0?' '+cd.toFixed(1):'');}document.getElementById('rematchBtn').disabled=net.lobby?.host!==net.id;
      }

      function mainLoop(now) {
        const rawDt = (now - game.lastFrameTime) / 1000;
        game.lastFrameTime = now;
        const clampedDt = Math.max(0, Math.min(0.05, rawDt || 0.016));

        try {
          if (!game.running) {
            if(!game.ended)renderLobby();
          } else {
            game.accumulator += clampedDt;
            const fixedStep = 1 / 60;
            while (game.accumulator >= fixedStep) {
              stepVisuals(fixedStep);
              game.accumulator -= fixedStep;
            }
            drawWorld();
            drawMinimap();
          }
        } catch (err) {
          console.error("Loop guard caught error:", err);
        }

        requestAnimationFrame(mainLoop);
      }

      window.addEventListener("resize", () => {
        resizeCanvas();
        detectTouch();
        camera.targetZoom = getResponsiveBaseZoom();
      });

      window.addEventListener("keydown", (e) => {
        input.keys.add(e.code);
        if (e.code === "Escape" && game.guideOpen) {
          setGuideOpen(false);
          return;
        }
        const human = game.fighters.find((f) => f.id === net.id);
        if (!game.running || game.ended || game.guideOpen || !human) return;
        if (e.code === "KeyJ") performSlash(human);
        if (e.code === "Space") {
          e.preventDefault();
          performDash(human);
        }
        if (e.code === "KeyK" || e.code === "KeyE") performSkill(human);
      });

      window.addEventListener("keyup", (e) => {
        input.keys.delete(e.code);
      });

      canvas.addEventListener("pointerdown", (e) => {
        const human = game.fighters.find((f) => f.id === net.id);
        if (!game.running || game.ended || game.guideOpen || !human) return;
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const wx = (sx - window.innerWidth * 0.5) / camera.zoom + camera.x;
        const wy = (sy - window.innerHeight * 0.5) / camera.zoom + camera.y;
        human.facing = Math.atan2(wy - human.y, wx - human.x);
        performSlash(human);
      });

      const joyZone = document.getElementById("joystick-zone");
      const joyKnob = document.getElementById("joystick-knob");
      let activeJoyPointerId = null;

      joyZone.addEventListener("pointerdown", (e) => {
        activeJoyPointerId = e.pointerId;
        joyZone.setPointerCapture(e.pointerId);
        input.joyActive = true;
      });

      joyZone.addEventListener("pointermove", (e) => {
        if (e.pointerId !== activeJoyPointerId) return;
        const rect = joyZone.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        const maxR = rect.width * 0.38;
        let dx = e.clientX - cx;
        let dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxR) {
          dx = (dx / dist) * maxR;
          dy = (dy / dist) * maxR;
        }
        joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        input.joyDx = dx / maxR;
        input.joyDy = dy / maxR;
      });

      const releaseJoy = (e) => {
        if (e.pointerId !== activeJoyPointerId) return;
        activeJoyPointerId = null;
        input.joyActive = false;
        input.joyDx = 0;
        input.joyDy = 0;
        joyKnob.style.transform = "translate(0px, 0px)";
      };

      joyZone.addEventListener("pointerup", releaseJoy);
      joyZone.addEventListener("pointercancel", releaseJoy);

      document.getElementById("touchSlashBtn").addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const human = game.fighters.find((f) => f.id === net.id);
        if (human && game.running && !game.ended && !game.guideOpen) performSlash(human);
      });

      document.getElementById("touchDashBtn").addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const human = game.fighters.find((f) => f.id === net.id);
        if (human && game.running && !game.ended && !game.guideOpen) performDash(human);
      });

      document.getElementById("touchSkillBtn").addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const human = game.fighters.find((f) => f.id === net.id);
        if (human && game.running && !game.ended && !game.guideOpen) performSkill(human);
      });

      document.getElementById("selectCrimsonBtn").addEventListener("click", () => {
        lobbyState.playerTeam = "crimson";
        if (lobbyState.playerTeam === "crimson" && lobbyState.crimsonBots > 4) {
          lobbyState.crimsonBots = 4;
        }
        renderLobby();
      });

      document.getElementById("selectAzureBtn").addEventListener("click", () => {
        lobbyState.playerTeam = "azure";
        if (lobbyState.playerTeam === "azure" && lobbyState.azureBots > 4) {
          lobbyState.azureBots = 4;
        }
        renderLobby();
      });

      document.getElementById("addCrimsonBotBtn").addEventListener("click", () => {
        const cap = lobbyState.playerTeam === "crimson" ? 4 : 5;
        lobbyState.crimsonBots = Math.min(cap, lobbyState.crimsonBots + 1);
        renderLobby();
      });

      document.getElementById("rmCrimsonBotBtn").addEventListener("click", () => {
        lobbyState.crimsonBots = Math.max(0, lobbyState.crimsonBots - 1);
        renderLobby();
      });

      document.getElementById("addAzureBotBtn").addEventListener("click", () => {
        const cap = lobbyState.playerTeam === "azure" ? 4 : 5;
        lobbyState.azureBots = Math.min(cap, lobbyState.azureBots + 1);
        renderLobby();
      });

      document.getElementById("rmAzureBotBtn").addEventListener("click", () => {
        lobbyState.azureBots = Math.max(0, lobbyState.azureBots - 1);
        renderLobby();
      });

      document.getElementById("fill5v5Btn").addEventListener("click", () => {
        lobbyState.crimsonBots = lobbyState.playerTeam === "crimson" ? 4 : 5;
        lobbyState.azureBots = lobbyState.playerTeam === "azure" ? 4 : 5;
        renderLobby();
      });

      document.getElementById("enterClashBtn").addEventListener("click", startMatch);

      document.getElementById("lobbyGuideBtn").addEventListener("click", () => setGuideOpen(true));
      document.getElementById("mapGuideBtn").addEventListener("click", () => setGuideOpen(true));
      document.getElementById("closeGuideBtn").addEventListener("click", () => setGuideOpen(false));
      mapGuideModal.addEventListener("click", (e) => {
        if (e.target === mapGuideModal) setGuideOpen(false);
      });

      document.getElementById("camZoomBtn").addEventListener("click", (e) => {
        if (camera.zoomMode === "WIDE") camera.zoomMode = "NORMAL";
        else if (camera.zoomMode === "NORMAL") camera.zoomMode = "TACTICAL";
        else camera.zoomMode = "WIDE";
        e.target.textContent = `ZOOM: ${camera.zoomMode}`;
        camera.targetZoom = getResponsiveBaseZoom();
      });

      document.getElementById("touchToggleBtn").addEventListener("click", (e) => {
        if (input.touchOverride === "AUTO") input.touchOverride = "ON";
        else if (input.touchOverride === "ON") input.touchOverride = "OFF";
        else input.touchOverride = "AUTO";
        e.target.textContent = `PAD: ${input.touchOverride}`;
        updateTouchVisibility();
      });

      document.getElementById("lobbyReturnBtn").addEventListener("click", returnToLobby);
      document.getElementById("rematchBtn").addEventListener("click", startMatch);
      document.getElementById("backToLobbyBtn").addEventListener("click", returnToLobby);

      installNetwork();
      resizeCanvas();
      detectTouch();
      buildCharacterCards();
      renderLobby();
      game.lastFrameTime = performance.now();
      requestAnimationFrame(mainLoop);
    })();
  