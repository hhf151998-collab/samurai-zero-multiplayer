'use strict';
module.exports=function createEngine(){
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
          { id: "bridge_n", x: 1060, y: 470, w: 80, h: 60, active: false },
          { id: "bridge_s", x: 1060, y: 970, w: 80, h: 60, active: false }
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
        game.oniRespawnTimer = 45;
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
          dmg = Math.round(dmg * 2);
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
            m.angle = (m.angle + 1) % 2; m.owner=f.team;
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
            game.oniRespawnTimer = 45;
          }
        }
      }


      function detonateBarrel(br, attacker) {
        br.exploded = true;
        const radius = 145;
        spawnBurst(br.x, br.y, "#ff7b00", 24);
        spawnBurst(br.x, br.y, "#ffd166", 14);
        

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
        f.dashTimer = 0.22; if(f.charId==="ninja")f.stealthTimer=.8;if(f.charId==="guardian")f.shield=Math.max(f.shield,25);if(f.charId==="ronin"){f.slashCd=0;performSlash(f);}

        const spd = 620;
        f.vx = Math.cos(f.facing) * spd;
        f.vy = Math.sin(f.facing) * spd;
        spawnBurst(f.x, f.y, f.charDef.accentColor, 9);


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
          const targetX = bestFoe ? bestFoe.x-Math.cos(f.facing)*25 : f.x + Math.cos(f.facing) * 185;
          const targetY = bestFoe ? bestFoe.y-Math.sin(f.facing)*25 : f.y + Math.sin(f.facing) * 185;
          spawnBurst(f.x, f.y, "#ff3b6b", 10);
          f.x = Math.max(40, Math.min(WORLD_W - 40, targetX));
          f.y = Math.max(40, Math.min(WORLD_H - 40, targetY));
          spawnBurst(f.x, f.y, "#ffd166", 14);
          if(bestFoe)f.facing=Math.atan2(bestFoe.y-f.y,bestFoe.x-f.x);f.slashCd=0;resolveSolidObstacles(f);performSlash(f);
        } else if (f.charId === "guardian") {
          f.shield=Math.max(f.shield,40); const radius = 135;
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
          for(const m of game.mirrors)if(Math.hypot(m.x-f.x,m.y-f.y)<190){m.angle=game.mirrors.indexOf(m)===0?0:1;m.owner=f.team;} for(const g of game.ironGates)if(Math.hypot(g.x-f.x,g.y-f.y)<190){g.closed=false; const l=game.levers.find(l=>l.id===g.id);if(l)l.closed=false;} const radius = 150;
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
          if(d<f.r){if(d>.001){f.x+=ox/d*(f.r-d);f.y+=oy/d*(f.r-d);}else{f.x=closestX-f.r-1;}}
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
          if(v.openTimer>0){v.openTimer-=dt;if(v.openTimer<=0)v.unlocked=false;} if (v.cooldown > 0) v.cooldown = Math.max(0, v.cooldown - dt);

          const pts = [{ x: em.x, y: em.y }];
          if (m) {
            pts.push({ x: m.x, y: m.y });
            const outDx = m.angle === 0 ? -1 : 1;
            const endX = m.x + outDx * 180;
            const endY = m.y;
            pts.push({ x: endX, y: endY });

            const vCx = v.x + v.w * 0.5;
            const vCy = v.y + v.h * 0.5;
            const hitsVault =
              Math.abs(endX - vCx) <= v.w * 0.65 && Math.abs(endY - vCy) <= v.h * 0.65;

            if (hitsVault && m.owner && v.cooldown <= 0) {
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
              const winnerTeam = m.owner;
              game.scores[winnerTeam] += 150;
              if (winnerFighter) grantXp(winnerFighter, 50);
              addFloatingText(vCx, vCy - 24, `${winnerTeam.toUpperCase()} VAULT +150`, "#ffd166");
              v.openTimer=3.5;
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
          if(br){const was=br.active;br.active=pressed;if(was&&!pressed)for(const f of game.fighters)if(f.deadTimer<=0&&f.x>br.x&&f.x<br.x+br.w&&f.y>br.y&&f.y<br.y+br.h){applyDamageToFighter(f,35,null);f.x=f.spawnX;f.y=f.spawnY;f.vx=f.vy=0;addFloatingText(f.x,f.y,'BRIDGE FALL','#ff6b88');}}
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
      
            }
          }

          for (const sh of game.shrines) {
            if (sh.team === f.team && Math.hypot(f.x - sh.x, f.y - sh.y) <= sh.r + f.r) {
              f.hp = Math.min(f.maxHp, f.hp + 18 * dt);
              f.skillCd = Math.max(0, f.skillCd - 1.5 * dt); f.shield = Math.min(50,f.shield+8*dt);
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
          f.stealthTimer=Math.max(0,(f.stealthTimer||0)-dt); f.stealthed = insideStealth||f.stealthTimer>0;
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

        if(game.timeLeft<=0)finishMatch();
      }


function setBanner(msg,sec=4){game.bannerText=msg;game.bannerTimer=sec;}
function finishMatch(){game.ended=true;game.running=false;}
function updateHumanInput(f,dt){
 const i=f.netInput||{};let x=i.x||0,y=i.y||0,mag=Math.hypot(x,y);
 if(mag>.08){x/=Math.max(1,mag);y/=Math.max(1,mag);const st=getFighterStats(f);f.vx+=x*st.speed*9*dt;f.vy+=y*st.speed*9*dt;f.facing=Math.atan2(y,x);}
 if(Number.isFinite(i.aim))f.facing=i.aim;
 if(i.slash)performSlash(f);if(i.dash)performDash(f);if(i.skill)performSkill(f);
}
function reset(members,bots){game.running=true;game.ended=false;game.timeLeft=MATCH_DURATION;game.scores={crimson:0,azure:0};game.particles=[];game.floatingTexts=[];buildWorldEntities();game.fighters=[];
 for(const t of ['crimson','azure']){const humans=members.filter(p=>p.team===t);const roster=[...humans];for(let i=0;i<Math.min(bots[t],5-humans.length);i++)roster.push({id:'bot-'+t+'-'+i,name:(t==='crimson'?'ONI':'KAI')+' '+(i+1),team:t,charId:CHARACTERS[i%3].id,bot:true});roster.forEach((p,i)=>game.fighters.push(createFighter({...p,isHuman:!p.bot,x:t==='crimson'?250:1950,y:430+i*145})));}setBanner('CAPTURE THE NEON CORE · SLASH TO INTERACT',6);}
function addHuman(p){const bot=game.fighters.find(f=>!f.isHuman&&f.team===p.team);if(bot)game.fighters.splice(game.fighters.indexOf(bot),1);game.fighters.push(createFighter({...p,isHuman:true,x:p.team==='crimson'?250:1950,y:750}));}
function removeHuman(id){const f=game.fighters.find(f=>f.id===id);if(f){f.id='bot-replace-'+id;f.name='RONIN BOT';f.isHuman=false;delete f.netInput;}}
return {game,CHARACTERS,WORLD_W,WORLD_H,reset,step:stepSimulation,addHuman,removeHuman,createFighter,slash:performSlash,dash:performDash,skill:performSkill,damage:applyDamageToFighter,resolve:resolveSolidObstacles,lasers:updateLasersAndVaults,spawnOniBoss};

};