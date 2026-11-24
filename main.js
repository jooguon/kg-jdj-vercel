/* =========================================================
   앱디의 하루 — 앱디자인팀 주다정의 출근부터 모닥불까지
   구조 참고: Bruno Simon(맵 이동) · Tamara's Village(탑뷰 마을, ! → E → 대화창)
   아트 참고: 힐링게임풍 + 앱디 팀 자기소개 아바타 + 코코비 IP
   ========================================================= */
(() => {
  "use strict";
  const D = window.SITE;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const KEY = coarse ? "탭" : "E";
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

  const ME = D.members.find((m) => m.me);
  const TEAM = D.members.filter((m) => !m.me);
  const projectOf = (m) => D.apps.find((a) => a.title === m.project) || D.extraProjects[m.project] || { title: m.project };
  const MY_APP = projectOf(ME);

  /* =========================================================
     1. 하루 일정 (진행 단계)
     ========================================================= */
  // 팀원에게 일을 하나 받고(from) → 내 자리 / DB / 라운지에서 처리 → 다음 일 받기
  const task = (id, at) => ({ id, at, e: D.tasks[id].e, label: D.tasks[id].title, where: D.tasks[id].where, from: D.tasks[id].from });
  const STEPS = [
    { id: "commute", e: "🏢", label: "키글 본사로 출근", at: 530, where: "섬 북쪽 키글 본사" },
    task("design", 540), task("lunch", 720), task("resource", 790), task("spine", 900), task("thumb", 990),
    { id: "leave", e: "🚪", label: "퇴근하기", at: 1080, where: "1층 출입구" },
    { id: "fire", e: "🔥", label: "바닷가 모닥불에 참여", at: 1130, where: "섬 남쪽 바닷가" },
  ];
  const state = { step: 0, got: false, greeted: new Set(), doors: new Set(), hobbies: new Set(), done: false };
  const cur = () => STEPS[state.step].id;
  const minutesNow = () => state.done ? 1230 : STEPS[state.step].at + (state.got ? 15 : 0);

  /* =========================================================
     소리 (Web Audio로 직접 만듦 — 파일 없음)
     ========================================================= */
  const SFX = (() => {
    let ctx = null, master = null, musicGain = null, on = true, mode = null, timer = null, beat = 0, noiseBuf = null;
    try { on = localStorage.getItem("appdi-sound") !== "off"; } catch (e) { /* 저장 안 되면 기본값 */ }
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    function init() {
      if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = on ? 0.9 : 0; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.55; musicGain.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      if (mode) startMusic(mode);
    }
    function tone(f, dur, { type = "sine", vol = 0.12, at = 0, slide = 0, out = master } = {}) {
      if (!ctx || !on) return;
      const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
    function noise(dur, { vol = 0.08, at = 0, freq = 1000, q = 1.2 } = {}) {
      if (!ctx || !on) return;
      const t = ctx.currentTime + at, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    }
    // 배경음: 낮은 오르골풍 아르페지오, 밤은 느리고 잔잔하게
    const SONGS = {
      day:   { bpm: 92, type: "triangle", vol: 0.04, len: 0.55, chords: [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]], pat: [0, 1, 2, 3, 2, 1, 2, 1] },
      night: { bpm: 62, type: "sine", vol: 0.05, len: 1.3, chords: [[57, 60, 64, 69], [53, 57, 60, 65], [60, 64, 67, 72], [55, 59, 62, 67]], pat: [0, 2, 3, -1, 1, 2, 3, -1] },
    };
    function startMusic(m) {
      mode = m; clearInterval(timer); timer = null; beat = 0;
      if (!ctx || !m) return;
      const S = SONGS[m];
      timer = setInterval(() => {
        if (!on || document.hidden) return;
        const ch = S.chords[Math.floor(beat / 8) % S.chords.length], step = beat % 8, n = S.pat[step];
        if (n >= 0) tone(midi(ch[n]), S.len, { type: S.type, vol: S.vol, out: musicGain });
        if (step === 0) tone(midi(ch[0] - 12), 1.8, { vol: 0.055, out: musicGain });
        if (m === "day" && step === 4) tone(midi(ch[2] - 12), 0.9, { vol: 0.03, out: musicGain });
        beat++;
      }, 60000 / S.bpm / 2);
    }
    return {
      init,
      isOn: () => on,
      toggle() { on = !on; try { localStorage.setItem("appdi-sound", on ? "on" : "off"); } catch (e) { /* 무시 */ } if (master) master.gain.value = on ? 0.9 : 0; return on; },
      music(m) { if (m !== mode || !timer) startMusic(m); },
      blip: (f) => tone(f * (0.9 + Math.random() * 0.22), 0.055, { type: "square", vol: 0.022 }),
      pop: () => tone(620, 0.09, { vol: 0.07, slide: 1.6 }),
      tick: () => tone(900, 0.04, { vol: 0.035, type: "triangle" }),
      step: (soft) => noise(0.05, { vol: soft ? 0.06 : 0.05, freq: soft ? 450 : 1300, q: 0.9 }),
      knock: () => { noise(0.08, { vol: 0.4, freq: 240, q: 2 }); noise(0.08, { vol: 0.4, freq: 240, q: 2, at: 0.17 }); },
      chime: () => [72, 76, 79].forEach((n, i) => tone(midi(n), 0.35, { vol: 0.07, at: i * 0.08, type: "triangle" })),
      done: () => [67, 72, 76, 79, 84].forEach((n, i) => tone(midi(n), 0.45, { vol: 0.07, at: i * 0.07, type: "triangle" })),
      press: (kind) => kind === "resource" ? tone(500 + Math.random() * 200, 0.07, { vol: 0.05, slide: 1.5 })
        : kind === "spine" ? tone(280 + Math.random() * 320, 0.06, { vol: 0.035, type: "square" })
        : kind === "thumb" ? tone(700 + Math.random() * 300, 0.08, { vol: 0.05, slide: 0.7 })
        : noise(0.09, { vol: 0.14, freq: 2400 + Math.random() * 1600, q: 3 }),
      crackle: (k) => noise(0.03 + Math.random() * 0.05, { vol: (0.05 + Math.random() * 0.08) * k, freq: 1600 + Math.random() * 2600, q: 4 }),
      cricket: () => [0, 0.07, 0.14].forEach((at) => tone(4300, 0.04, { vol: 0.012, at })),
      whoosh: () => noise(0.6, { vol: 0.07, freq: 500, q: 0.5 }),
    };
  })();

  /* =========================================================
     2. 그리기 도구
     ========================================================= */
  const shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
    return "#" + [n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("");
  };
  const fmt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  function smoothPath(pts) {
    const n = pts.length;
    let d = `M${fmt(pts[0])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += ` C${fmt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${fmt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${fmt(p2)}`;
    }
    return d + "Z";
  }
  const lineD = (pts) => "M" + pts.map((p) => p.join(",")).join(" L");

  /* --- 사람 캐릭터 (힐링게임풍 2등신, 정면. 좌우 반전만 사용) --- */
  const CH_W = 64, CH_H = 110; // viewBox 0 -22 100 172
  function person(L) {
    const skin = "#ffe2cf", h = L.hair;
    const hat = L.hat || {};
    let s = `<svg class="person" width="${CH_W}" height="${CH_H}" viewBox="0 -22 100 172">`;
    // 뒷머리
    if (L.style === "long") s += `<path d="M15 50 Q13 18 50 17 Q87 18 85 50 L87 112 Q87 121 78 121 L22 121 Q13 121 13 112Z" fill="${h}"/>`;
    if (L.style === "bob") s += `<path d="M15 50 Q14 17 50 16 Q86 17 85 50 L86 86 Q86 92 80 92 L20 92 Q14 92 14 86Z" fill="${h}"/>`;
    if (L.style === "twinbuns") s += `<circle cx="20" cy="22" r="14" fill="${h}"/><circle cx="80" cy="22" r="14" fill="${h}"/><path d="M16 50 Q14 19 50 18 Q86 19 84 50 L84 88 Q84 94 78 94 L22 94 Q16 94 16 88Z" fill="${h}"/>`;
    if (L.style === "bun") s += `<circle cx="56" cy="12" r="12" fill="${h}"/>`;
    // 다리
    s += `<g class="leg l"><rect x="37" y="110" width="12" height="26" rx="6" fill="${L.pants}"/><ellipse cx="42" cy="138" rx="9" ry="6" fill="${L.shoes}"/></g>
          <g class="leg r"><rect x="51" y="110" width="12" height="26" rx="6" fill="${L.pants}"/><ellipse cx="58" cy="138" rx="9" ry="6" fill="${L.shoes}"/></g>`;
    // 몸통
    s += `<path d="M32 86 Q32 80 40 80 L60 80 Q68 80 68 86 L71 116 Q71 121 66 121 L34 121 Q29 121 29 116Z" fill="${L.top}"/>`;
    if (L.overalls) s += `<rect x="36" y="96" width="28" height="25" rx="6" fill="${L.overalls}"/><path d="M39 97 L37 82 M61 97 L63 82" stroke="${L.overalls}" stroke-width="5" stroke-linecap="round"/><circle cx="40" cy="100" r="2.2" fill="#ffd23f"/><circle cx="60" cy="100" r="2.2" fill="#ffd23f"/>`;
    const side = L.jacket || L.vest;
    if (side) {
      s += `<path d="M32 86 Q32 80 40 80 L45 80 L45 121 L34 121 Q29 121 29 116Z" fill="${side}"/><path d="M55 80 L60 80 Q68 80 68 86 L71 116 Q71 121 66 121 L55 121Z" fill="${side}"/>`;
      if (L.vest) s += `<path d="M31 92 H45 M31 102 H45 M31 112 H45 M55 92 H70 M55 102 H70 M55 112 H70 M38 81 V121 M62 81 V121" stroke="${shade(L.vest, -0.16)}" stroke-width="1.6"/>`;
    }
    if (L.star) s += `<path d="M50 90 l3 6 6.5 1 -4.7 4.5 1.1 6.5 -5.9 -3.1 -5.9 3.1 1.1 -6.5 -4.7 -4.5 6.5 -1z" fill="#ffd23f"/>`;
    // 팔
    const sleeve = L.jacket || L.top;
    s += `<g class="arm l"><rect x="20" y="83" width="12" height="28" rx="6" fill="${sleeve}"/><circle cx="26" cy="112" r="6" fill="${skin}"/></g>
          <g class="arm r"><rect x="68" y="83" width="12" height="28" rx="6" fill="${sleeve}"/><circle cx="74" cy="112" r="6" fill="${skin}"/></g>`;
    // 머리
    if (hat.type === "shark") {
      s += `<path d="M42 16 L56 -14 L64 18Z" fill="${hat.color}"/><circle cx="50" cy="52" r="40" fill="${hat.color}"/><path d="M14 64 L4 74 L18 76Z M86 64 L96 74 L82 76Z" fill="${hat.color}"/>
            <circle cx="50" cy="58" r="28" fill="${skin}"/><path d="M26 44 l5 7 5 -9 5 8 5 -9 4 9 5 -9 5 8 5 -9 4 9 5 -6" stroke="#fff" stroke-width="3.2" fill="none" stroke-linejoin="round"/>`;
    } else {
      s += `<circle cx="16" cy="58" r="6" fill="${skin}"/><circle cx="84" cy="58" r="6" fill="${skin}"/><circle cx="50" cy="52" r="34" fill="${skin}"/>`;
    }
    // 얼굴
    s += `<ellipse cx="38" cy="59" rx="4.6" ry="6" fill="#3a2a26"/><ellipse cx="62" cy="59" rx="4.6" ry="6" fill="#3a2a26"/>
          <circle cx="39.6" cy="56.4" r="1.8" fill="#fff"/><circle cx="63.6" cy="56.4" r="1.8" fill="#fff"/>
          <ellipse cx="28" cy="69" rx="6" ry="3.6" fill="#ff9e9e" opacity=".55"/><ellipse cx="72" cy="69" rx="6" ry="3.6" fill="#ff9e9e" opacity=".55"/>
          <path d="M46 71 Q50 75.5 54 71" stroke="#a4523f" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    if (L.freckles) s += `<g fill="#d99a72"><circle cx="30" cy="64" r="1.2"/><circle cx="34" cy="66" r="1.2"/><circle cx="70" cy="64" r="1.2"/><circle cx="66" cy="66" r="1.2"/></g>`;
    // 앞머리
    if (hat.type !== "shark") {
      if (["long", "bob", "twinbuns"].includes(L.style)) s += `<path d="M15 56 Q11 15 50 15 Q89 15 85 56 Q81 40 70 34 Q62 45 48 36 Q36 45 26 38 Q19 44 15 56Z" fill="${h}"/>`;
      else s += `<path d="M15 54 Q13 13 50 14 Q87 13 85 54 Q79 36 67 33 L63 41 L55 32 L47 41 L40 32 L32 41 Q21 40 15 54Z" fill="${h}"/>`;
    }
    // 모자 · 소품
    if (hat.type === "beanie" || hat.type === "bunny") {
      if (hat.type === "bunny") s += `<g transform="rotate(-16 32 10)"><ellipse cx="32" cy="2" rx="8" ry="19" fill="${hat.color}"/><ellipse cx="32" cy="4" rx="3.6" ry="12" fill="#f4a6c0"/></g><g transform="rotate(16 68 10)"><ellipse cx="68" cy="2" rx="8" ry="19" fill="${hat.color}"/><ellipse cx="68" cy="4" rx="3.6" ry="12" fill="#f4a6c0"/></g>`;
      s += `<path d="M14 48 Q12 9 50 9 Q88 9 86 48Z" fill="${hat.color}"/><rect x="12" y="36" width="76" height="15" rx="7.5" fill="${shade(hat.color, hat.type === "bunny" ? 0.15 : -0.18)}"/>`;
      if (hat.type === "beanie") s += `<rect x="44" y="38" width="12" height="10" rx="2" fill="#fff"/><circle cx="50" cy="43" r="2.4" fill="#e8a23a"/>`;
      else s += `<circle cx="22" cy="44" r="2.4" fill="#ccc"/><circle cx="78" cy="44" r="2.4" fill="#ccc"/>`;
    }
    if (hat.type === "visor") s += `<path d="M15 42 Q50 22 85 42 L85 47 Q50 30 15 47Z" fill="${hat.color}"/><path d="M17 45 Q50 30 83 45 Q86 52 80 55 Q50 44 20 55 Q14 52 17 45Z" fill="${shade(hat.color, -0.12)}"/>`;
    if (hat.type === "party") s += `<g transform="rotate(16 50 16)"><path d="M50 -16 L65 19 L35 19Z" fill="#fff"/><path d="M50 -16 L54.5 -5.5 L45.5 -5.5Z M41.5 4 L58.5 4 L61.5 11 L38.5 11Z" fill="${hat.color}"/><circle cx="50" cy="-16" r="4.5" fill="#ffd23f"/></g>`;
    if (L.headphones) s += `<path d="M15 54 Q13 6 50 6 Q87 6 85 54" stroke="#9aa3b5" stroke-width="6" fill="none"/><rect x="5" y="44" width="17" height="27" rx="8" fill="${L.headphones}"/><rect x="78" y="44" width="17" height="27" rx="8" fill="${L.headphones}"/>`;
    if (L.cat) s += `<g class="cat"><path d="M74 14 Q84 10 82 2" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="56" cy="15" rx="21" ry="10" fill="#fff"/><path d="M50 7 Q60 3 70 9 Q64 16 52 14Z" fill="#2c2a2b"/>
            <circle cx="36" cy="13" r="10.5" fill="#fff"/><path d="M27 7 L29 -1 L34 5Z M38 3 L44 -2 L44 7Z" fill="#2c2a2b"/><path d="M31 14 q2 2 4 0 M37 14 q2 2 4 0" stroke="#333" stroke-width="1.4" fill="none"/><path d="M30 20 H44" stroke="#7fb6e8" stroke-width="3" stroke-linecap="round"/></g>`;
    if (L.glasses === "round") s += `<g fill="none" stroke="#c89b3c" stroke-width="2.4"><circle cx="38" cy="59" r="9.5"/><circle cx="62" cy="59" r="9.5"/><path d="M47.5 59 H52.5"/></g>`;
    if (L.glasses === "square") s += `<g fill="none" stroke="#222" stroke-width="3"><rect x="27" y="51" width="21" height="16" rx="5"/><rect x="52" y="51" width="21" height="16" rx="5"/><path d="M48 58 H52"/></g>`;
    if (L.prop === "coffee") s += `<rect x="69" y="98" width="13" height="19" rx="3" fill="#7a4a2a"/><rect x="68" y="95" width="15" height="5" rx="2" fill="#fff"/><path d="M77 95 L80 85" stroke="#3f8f3a" stroke-width="2.2"/>`;
    if (L.prop === "puppy") s += `<g><circle cx="50" cy="101" r="14" fill="#fff"/><circle cx="39" cy="92" r="7" fill="#fff"/><circle cx="61" cy="92" r="7" fill="#fff"/><circle cx="45" cy="99" r="1.9" fill="#333"/><circle cx="55" cy="99" r="1.9" fill="#333"/><ellipse cx="50" cy="104" rx="2.4" ry="1.8" fill="#333"/></g>`;
    return s + "</svg>";
  }
  const portrait = (m, cls = "portrait") => `<img class="${cls}" src="${m.avatar}" alt="${m.name} 아바타">`;
  const appIcon = (a, size = 40) => a.icon
    ? `<img src="${a.icon}" alt="" loading="lazy" referrerpolicy="no-referrer" style="width:${size}px;height:${size}px;border-radius:${size * 0.24}px">`
    : `<span class="app-emoji" style="width:${size}px;height:${size}px;font-size:${size * 0.55}px">${a.emoji || "📱"}</span>`;

  // 섬 소품
  function house({ w, wallH, roofH, wall, roof, roofType = "tri", door = "#9b6b47", wins = 2, rows = 1, chimney = false, extra = "" }) {
    const TH = roofH + wallH, top = roofH - 8;
    let s = `<svg width="${w}" height="${TH}" viewBox="0 0 ${w} ${TH}"><ellipse cx="${w / 2}" cy="${TH - 5}" rx="${w / 2}" ry="12" fill="rgba(40,70,30,.22)"/>`;
    if (chimney) s += `<rect x="${w * 0.66}" y="${roofH * 0.12}" width="${w * 0.11}" height="${roofH * 0.7}" rx="5" fill="#c86a50"/><rect x="${w * 0.64}" y="${roofH * 0.06}" width="${w * 0.15}" height="12" rx="5" fill="#a95540"/>`;
    s += `<rect x="10" y="${top}" width="${w - 20}" height="${wallH}" rx="14" fill="${wall}"/><rect x="10" y="${TH - 24}" width="${w - 20}" height="18" rx="7" fill="${shade(wall, -0.13)}"/>`;
    const cols = wins === 2 ? [0.24, 0.76] : wins === 6 ? [0.1, 0.23, 0.36, 0.64, 0.77, 0.9] : [];
    const ww = wins >= 6 ? 34 : Math.min(40, w * 0.18), wh = ww * 0.9;
    for (let r = 0; r < rows; r++) for (const c of cols) {
      const x = c * w - ww / 2, y = top + 20 + r * (wh + 16);
      s += `<rect class="win" x="${x}" y="${y}" width="${ww}" height="${wh}" rx="8" stroke="#fff" stroke-width="4"/><path d="M${c * w} ${y} v${wh}" stroke="#fff" stroke-width="3"/>`;
    }
    const dw = Math.min(50, w * 0.22), dh = Math.min(66, wallH * 0.58);
    s += `<path d="M${w / 2 - dw / 2} ${TH - 10} v-${dh - dw / 2} a${dw / 2} ${dw / 2} 0 0 1 ${dw} 0 v${dh - dw / 2} z" fill="${door}"/><circle cx="${w / 2 + dw * 0.28}" cy="${TH - 10 - dh * 0.42}" r="3.5" fill="#ffd23f"/>`;
    if (roofType === "tri") s += `<path d="M${w / 2} 12 L${w - 8} ${roofH} L8 ${roofH} Z" fill="${roof}" stroke="${roof}" stroke-width="16" stroke-linejoin="round"/>`;
    if (roofType === "flat") s += `<rect x="2" y="${roofH - 24}" width="${w - 4}" height="28" rx="12" fill="${roof}"/>`;
    s += `<rect x="2" y="${roofH - 4}" width="${w - 4}" height="12" rx="6" fill="${shade(roof, -0.16)}"/>`;
    return s + extra + "</svg>";
  }
  const tree = (c) => `<svg width="96" height="116" viewBox="0 0 96 116"><ellipse cx="48" cy="110" rx="32" ry="8" fill="rgba(40,70,30,.2)"/><rect x="42" y="70" width="12" height="40" rx="6" fill="#a87650"/><ellipse cx="48" cy="48" rx="38" ry="36" fill="${c}"/><ellipse cx="34" cy="34" rx="16" ry="13" fill="${shade(c, 0.22)}"/><circle cx="64" cy="60" r="10" fill="${shade(c, -0.08)}"/><circle cx="30" cy="58" r="3.5" fill="#ff8fa8"/><circle cx="62" cy="34" r="3.5" fill="#ff8fa8"/></svg>`;
  const palm = () => `<svg width="100" height="140" viewBox="0 0 100 140"><ellipse cx="50" cy="134" rx="26" ry="6" fill="rgba(40,70,30,.2)"/><path d="M48 134 Q42 92 54 50" stroke="#b07a4f" stroke-width="11" fill="none" stroke-linecap="round"/><g fill="#45b062"><path d="M54 50 Q20 30 4 54 Q30 40 54 56Z"/><path d="M54 50 Q86 28 98 56 Q74 42 54 56Z"/><path d="M54 50 Q40 12 14 14 Q42 26 52 54Z"/><path d="M54 50 Q70 8 94 18 Q66 26 56 54Z"/></g><circle cx="50" cy="56" r="6" fill="#7a4e2d"/><circle cx="59" cy="58" r="6" fill="#7a4e2d"/></svg>`;
  const flower = (c) => `<svg width="30" height="26" viewBox="0 0 30 26"><path d="M15 26 v-10" stroke="#4f9e3f" stroke-width="3"/><g fill="${c}"><circle cx="15" cy="7" r="5"/><circle cx="9" cy="12" r="5"/><circle cx="21" cy="12" r="5"/><circle cx="15" cy="16" r="5"/></g><circle cx="15" cy="12" r="3.5" fill="#ffd23f"/></svg>`;
  const lamp = () => `<svg width="60" height="120" viewBox="0 0 60 120"><circle class="lamp-glow" cx="30" cy="22" r="28" fill="rgba(255,214,90,.5)"/><ellipse cx="30" cy="116" rx="12" ry="4" fill="rgba(40,70,30,.25)"/><rect x="27" y="30" width="6" height="86" rx="3" fill="#6b5a4a"/><path d="M18 34 h24 l-4 -22 h-16z" fill="#6b5a4a"/><rect class="win" x="22" y="14" width="16" height="16" rx="3"/></svg>`;
  const deco = (name, w, h) => `<img src="assets/deco/${name}.png" alt="" style="width:${w}px;height:${h}px">`;

  /* =========================================================
     3. 장면 (사무실 / 섬)
     ========================================================= */
  const stage = $("#stage");
  const scenes = {};
  let B = null;   // 지금 만드는 장면
  let SC = null;  // 지금 보이는 장면
  function makeScene(id, W, H, bg) {
    const el = document.createElement("div");
    el.className = "world"; el.hidden = true;
    el.style.width = W + "px"; el.style.height = H + "px";
    el.innerHTML = `<svg class="ground" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"></svg><div class="sprites"></div>`;
    stage.insertBefore(el, $("#tint"));
    return (scenes[id] = { id, W, H, bg, el, ground: $(".ground", el), spritesEl: $(".sprites", el), rects: [], circles: [], spots: [], pins: [], extraBlock: () => false });
  }
  function sprite({ x, y, w, h, html, cls = "", z }) {
    const el = document.createElement("div");
    el.className = "sp " + cls;
    el.style.cssText = `left:${x - w / 2}px;top:${y - h}px;width:${w}px;height:${h}px;z-index:${Math.round(z ?? y)}`;
    el.innerHTML = html;
    B.spritesEl.appendChild(el);
    return el;
  }
  const label = (el, text, top = -16) => el.insertAdjacentHTML("beforeend", `<div class="label" style="top:${top}px">${text}</div>`);
  function spot(o) {
    o.r ??= 95; o.scene = B;
    B.spots.push(o);
    if (o.el) {
      o.el.classList.add("hit");
      o.el.dataset.spot = `${B.id}:${B.spots.length - 1}`;
      o.el.insertAdjacentHTML("beforeend", `<div class="mark" style="top:${o.markTop ?? -60}px" hidden>!</div><div class="prompt" style="top:${(o.markTop ?? -60) + 4}px"><b>${KEY}</b>${o.verb ?? "보기"}</div>`);
    }
    return o;
  }
  const rect = (x, y, w, h) => B.rects.push({ x, y, w, h });
  const circle = (x, y, r) => B.circles.push({ x, y, r });
  function charSprite(m, x, y, extraCls = "") {
    const el = sprite({ x, y, w: CH_W, h: CH_H, cls: "char " + extraCls, html: `<div class="shadow"></div><div class="body">${person(m.look)}</div><div class="name">${m.me ? "나 · " : ""}${m.name}</div>` });
    return { m, el, body: $(".body", el), x, y, face: 1 };
  }
  const placeChar = (c, x, y) => { c.x = x; c.y = y; c.el.style.left = x - CH_W / 2 + "px"; c.el.style.top = y - CH_H + "px"; c.el.style.zIndex = Math.round(y); };

  /* ---------------------------------------------------------
     3-1. 키글 본사 (실내)
     --------------------------------------------------------- */
  const OW = 2200, OH = 1520;
  const SIDE_DOOR = [1186, 1300]; // 로비 양옆 문 (y 범위)
  const office = makeScene("office", OW, OH, "#5a4757");
  B = office;
  {
    const F = { corridor: [64, 400, 2072, 300], design: [64, 700, 936, 756], lobby: [1024, 700, 252, 756], lounge: [1300, 700, 836, 756] };
    let g = `<defs>
      <pattern id="wood" width="120" height="40" patternUnits="userSpaceOnUse"><rect width="120" height="40" fill="#f0c995"/><path d="M0 39.5 H120 M70 0 V40" stroke="#dcae78" stroke-width="2"/><path d="M10 14 h22 M84 26 h18" stroke="#e6ba86" stroke-width="2" stroke-linecap="round"/></pattern>
      <pattern id="wood2" width="140" height="44" patternUnits="userSpaceOnUse"><rect width="140" height="44" fill="#ead2b0"/><path d="M0 43.5 H140 M40 0 V44" stroke="#d6b88f" stroke-width="2"/></pattern>
      <pattern id="tile" width="64" height="64" patternUnits="userSpaceOnUse"><rect width="64" height="64" fill="#f7efe2"/><rect x="2" y="2" width="60" height="60" rx="8" fill="#fbf6ee"/></pattern>
      <pattern id="check" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#fde6d3"/><rect width="40" height="40" fill="#f8d2b7"/><rect x="40" y="40" width="40" height="40" fill="#f8d2b7"/></pattern>
      <pattern id="paper" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#fff2dc"/><path d="M20 0 V40" stroke="#fbe6c4" stroke-width="10"/></pattern>
    </defs>
    <rect width="${OW}" height="${OH}" fill="${office.bg}"/>`;
    const r = (k, fill) => { const [x, y, w, h] = F[k]; return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`; };
    g += r("corridor", "url(#wood)") + r("design", "url(#wood2)") + r("lobby", "url(#tile)") + r("lounge", "url(#check)");
    // 러그
    g += `<rect x="150" y="860" width="770" height="560" rx="40" fill="#bfe0c9" opacity=".55"/><rect x="170" y="880" width="730" height="520" rx="30" fill="none" stroke="#fff" stroke-width="6" stroke-dasharray="2 14" stroke-linecap="round" opacity=".8"/>
      <ellipse cx="1150" cy="1080" rx="100" ry="140" fill="#ffd9e6"/><text x="1150" y="1095" text-anchor="middle" font-family="Jua" font-size="40" fill="#ec5f9f">kigle</text>
      <rect x="140" y="500" width="1920" height="110" rx="55" fill="#f7b9a1" opacity=".45"/>`;
    // 벽 (윗면 + 정면)
    const wallFace = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#paper)"/><rect x="${x}" y="${y + h - 46}" width="${w}" height="46" fill="#e7bb8b"/><rect x="${x}" y="${y + h - 50}" width="${w}" height="6" fill="#cf9a66"/><rect x="${x}" y="${y + h - 8}" width="${w}" height="8" fill="#b9844f"/>`;
    const cap = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#a98266"/>`;
    g += wallFace(40, 226, 2120, 174) + cap(40, 200, 2120, 26);
    [[64, 300], [420, 1024], [1276, 1640], [1760, 2136]].forEach(([a, b]) => { g += wallFace(a, 720, b - a, 80) + cap(a, 700, b - a, 20); });
    g += cap(40, 200, 24, 1280) + cap(2136, 200, 24, 1280);
    // 로비 양옆 벽 (가운데에 문 — 왼쪽 앱디자인팀 · 오른쪽 라운지)
    [1000, 1276].forEach((x) => {
      g += cap(x, 700, 24, SIDE_DOOR[0] - 700) + cap(x, SIDE_DOOR[1], 24, 1480 - SIDE_DOOR[1]);
      g += `<rect x="${x - 4}" y="${SIDE_DOOR[0] - 10}" width="32" height="12" rx="4" fill="#9a6e4c"/><rect x="${x - 4}" y="${SIDE_DOOR[1] - 2}" width="32" height="12" rx="4" fill="#9a6e4c"/>
        <rect x="${x - 30}" y="${SIDE_DOOR[0] + 8}" width="84" height="${SIDE_DOOR[1] - SIDE_DOOR[0] - 16}" rx="12" fill="${x === 1000 ? "#bfe0c9" : "#f8c9b0"}" opacity=".8"/>`;
    });
    g += cap(40, 1456, 1060, 24) + cap(1200, 1456, 960, 24);
    // 문틀 (앱디 · 라운지)
    [[300, 420], [1640, 1760]].forEach(([a, b]) => { g += `<rect x="${a - 8}" y="700" width="12" height="100" rx="4" fill="#9a6e4c"/><rect x="${b - 4}" y="700" width="12" height="100" rx="4" fill="#9a6e4c"/><rect x="${a}" y="${800 - 10}" width="${b - a}" height="18" fill="#d6b88f" opacity=".6"/>`; });
    // 출입구
    g += `<rect x="1100" y="1452" width="100" height="40" rx="6" fill="#9fd6ec"/><rect x="1104" y="1456" width="44" height="34" rx="3" fill="#c9ecf8"/><rect x="1152" y="1456" width="44" height="34" rx="3" fill="#c9ecf8"/>
      <rect x="1090" y="1392" width="120" height="56" rx="12" fill="#8fb98a"/><text x="1150" y="1428" text-anchor="middle" font-family="Jua" font-size="20" fill="#fff">EXIT</text>`;
    office.ground.innerHTML = g;

    // 충돌: 벽
    rect(0, 0, OW, 410); rect(0, 0, 64, OH); rect(2136, 0, 64, OH); rect(0, 1456, OW, 100);
    [[64, 300], [420, 1024], [1276, 1640], [1760, 2136]].forEach(([a, b]) => rect(a, 700, b - a, 100));
    [1000, 1276].forEach((x) => { rect(x, 700, 24, SIDE_DOOR[0] - 700); rect(x, SIDE_DOOR[1], 24, 1480 - SIDE_DOOR[1]); });
  }

  /* --- 복도: 팀 사무실 문 8개 + 출시 앱 액자 --- */
  const DOOR_X = D.teams.map((_, i) => 180 + i * 262);
  D.teams.forEach((t, i) => {
    const x = DOOR_X[i];
    const el = sprite({ x, y: 402, w: 140, h: 176, z: 400, cls: "door", html: `<svg width="140" height="176" viewBox="0 0 140 176">
        <rect x="14" y="0" width="112" height="40" rx="12" fill="${t.color}"/><rect x="14" y="30" width="112" height="10" rx="5" fill="${shade(t.color, -0.18)}"/>
        <text x="70" y="27" text-anchor="middle" font-family="Jua" font-size="18" fill="#fff">${t.emoji} ${t.name}</text>
        <rect x="22" y="50" width="96" height="124" rx="10" fill="#8a5a3c"/>
        <g class="door-leaf"><rect x="28" y="56" width="84" height="118" rx="8" fill="${shade(t.color, 0.55)}"/>
        <circle cx="70" cy="88" r="17" fill="#d8f1fb" stroke="#fff" stroke-width="4"/><rect x="40" y="118" width="60" height="44" rx="6" fill="${shade(t.color, 0.38)}"/><circle cx="98" cy="122" r="4.5" fill="#ffd23f"/></g></svg>` });
    sprite({ x, y: 440, w: 110, h: 24, z: 401, html: `<svg width="110" height="24" viewBox="0 0 110 24"><rect x="4" y="2" width="102" height="20" rx="10" fill="${shade(t.color, 0.3)}"/></svg>` });
    spot({ id: "door-" + t.id, kind: "door", team: t, x, y: 452, el, r: 82, verb: "노크하기", markTop: -36 });
  });
  D.apps.forEach((a, i) => {
    if (i > 6) return;
    const x = (DOOR_X[i] + DOOR_X[i + 1]) / 2;
    const el = sprite({ x, y: 330, w: 96, h: 92, z: 330, cls: "frame", html: `<div class="frame-in">${appIcon(a, 56)}</div>` });
    spot({ id: "frame-" + i, kind: "frame", app: a, x, y: 440, el, r: 62, verb: "액자 보기", markTop: -26 });
  });
  [[2090, 470], [110, 470]].forEach(([x, y]) => { sprite({ x, y, w: 60, h: 80, html: deco("plant", 60, 80) }); circle(x, y - 8, 20); });

  /* --- 앱디자인팀 사무실 --- */
  const doorLabel = sprite({ x: 360, y: 700, w: 10, h: 10, z: 690, html: "" });
  label(doorLabel, "🎨 앱디자인팀", -14);
  const loungeLabel = sprite({ x: 1700, y: 700, w: 10, h: 10, z: 690, html: "" });
  label(loungeLabel, "🍱 라운지", -14);

  // 미션 화이트보드 · 사진 · 시계 (벽에 걸림)
  const board = sprite({ x: 180, y: 796, w: 200, h: 74, z: 700, html: `<svg width="200" height="74" viewBox="0 0 200 74"><rect x="2" y="2" width="196" height="70" rx="8" fill="#fff" stroke="#b9c3cf" stroke-width="4"/>
      <text class="fit" data-max="176" x="100" y="25" text-anchor="middle" font-family="Jua" font-size="12" fill="#ec5f9f">앱디자인팀 MISSION</text>
      <text class="fit" data-max="176" x="100" y="52" text-anchor="middle" font-family="Jua" font-size="15" fill="#4a3528">${D.mission.join(" · ")}</text></svg>` });
  // 간판 글씨가 판보다 길면 판 안에 맞게 줄이기 (폰트가 늦게 로드돼도 다시 맞춤)
  const fitSignText = () => $$("text.fit", board).forEach((t) => {
    t.removeAttribute("textLength");
    if (t.getComputedTextLength() > +t.dataset.max) { t.setAttribute("textLength", t.dataset.max); t.setAttribute("lengthAdjust", "spacingAndGlyphs"); }
  });
  if (document.fonts) document.fonts.ready.then(fitSignText);
  spot({ id: "board", kind: "board", x: 180, y: 846, el: board, r: 72, markTop: -24 });
  sprite({ x: 520, y: 790, w: 110, h: 57, z: 700, html: deco("photos", 110, 57) });
  sprite({ x: 920, y: 786, w: 50, h: 50, z: 700, html: deco("clock", 50, 50) });

  // 자리 배치: 3열 × 3줄, 가운데 맨 아래가 내 자리
  const SEAT_X = [190, 500, 810], SEAT_Y = [960, 1150, 1340];
  const ORDER = ["한수민", "김현수", "고재영", "이희진", "이서정", "박소정", "박화진", "주다정", "김민성"];
  const deskSvg = (color, mine) => `<svg width="150" height="112" viewBox="0 0 150 112">
      <ellipse cx="75" cy="106" rx="70" ry="7" fill="rgba(60,40,20,.16)"/>
      <rect x="40" y="4" width="72" height="48" rx="7" fill="#4a3f4f"/><rect class="screen" x="45" y="9" width="62" height="36" rx="3" fill="${shade(color, 0.75)}"/>
      <rect x="70" y="50" width="12" height="8" fill="#4a3f4f"/>
      <rect x="4" y="54" width="142" height="24" rx="8" fill="#eab983"/><rect x="8" y="74" width="134" height="30" rx="6" fill="#c98d57"/>
      <rect x="16" y="80" width="40" height="18" rx="4" fill="#b67b48"/><circle cx="36" cy="89" r="2.5" fill="#f3d9a6"/><rect x="94" y="80" width="40" height="18" rx="4" fill="#b67b48"/><circle cx="114" cy="89" r="2.5" fill="#f3d9a6"/>
      <rect x="98" y="57" width="36" height="14" rx="3" fill="#3a3540"/><path d="M128 58 L138 50" stroke="#555" stroke-width="3" stroke-linecap="round"/>
      <rect x="14" y="56" width="11" height="14" rx="3" fill="${color}"/><rect x="25" y="59" width="4" height="7" rx="2" fill="none" stroke="${color}" stroke-width="2"/>
      ${mine ? `<path d="M120 50 q-6 -14 4 -18 q8 6 -4 18z M122 50 q8 -12 16 -8 q-4 10 -16 8z" fill="#5cb85c"/><rect x="116" y="48" width="14" height="10" rx="3" fill="#e0855b"/>` : ""}</svg>`;
  const members = {}; // name → { char, desk, spot }
  let myDesk = null;
  ORDER.forEach((name, k) => {
    const m = D.members.find((x) => x.name === name);
    const x = SEAT_X[k % 3], y = SEAT_Y[Math.floor(k / 3)];
    const app = projectOf(m);
    const desk = sprite({ x, y, w: 150, h: 112, html: deskSvg(m.me ? "#ec5f9f" : "#6fa8dc", m.me) });
    desk.insertAdjacentHTML("beforeend", `<div class="desk-app">${appIcon(app, 26)}</div>`);
    rect(x - 70, y - 44, 140, 42);
    if (m.me) {
      label(desk, "⭐ 내 자리", -18);
      myDesk = spot({ id: "mydesk", kind: "mydesk", x, y: y + 52, el: desk, r: 92, verb: "작업하기", markTop: -64 });
    } else {
      const c = charSprite(m, x + 92, y + 2, "npc");
      const cc = { x: c.x, y: c.y - 6, r: 24 };
      B.circles.push(cc);
      const s = spot({ id: "member-" + name, kind: "member", m, x: c.x, y: c.y, el: c.el, r: 78, verb: "말 걸기", markTop: -36 });
      members[name] = { char: c, home: { x: c.x, y: c.y }, spot: s, circle: cc };
    }
  });
  // 디자인 DB (서랍장 + 서버)
  const db = sprite({ x: 700, y: 846, w: 170, h: 150, html: `<svg width="170" height="150" viewBox="0 0 170 150">
      <ellipse cx="85" cy="144" rx="80" ry="7" fill="rgba(60,40,20,.16)"/>
      <rect x="6" y="10" width="110" height="134" rx="10" fill="#9ccbe8"/><rect x="6" y="10" width="110" height="18" rx="9" fill="#7fb4d8"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="14" y="${34 + i * 27}" width="94" height="21" rx="5" fill="#d9eefa"/><rect x="50" y="${41 + i * 27}" width="22" height="6" rx="3" fill="#7fb4d8"/><text x="22" y="${50 + i * 27}" font-size="12">${["🦖", "🏝️", "🧸", "🔘"][i]}</text>`).join("")}
      <rect x="122" y="54" width="42" height="90" rx="8" fill="#4a4458"/>${[0, 1, 2, 3].map((i) => `<rect x="128" y="${62 + i * 19}" width="30" height="12" rx="3" fill="#5d576c"/><circle class="led" cx="152" cy="${68 + i * 19}" r="2.6" fill="#69f0ae"/>`).join("")}</svg>` });
  label(db, "🗂️ 디자인 DB", -20);
  rect(620, 800, 160, 44);
  const dbSpot = spot({ id: "db", kind: "db", x: 700, y: 892, el: db, r: 80, verb: "리소스 정리", markTop: -44 });
  [[100, 1440], [965, 1440], [960, 830]].forEach(([x, y]) => { sprite({ x, y, w: 56, h: 74, html: deco("plant", 56, 74) }); circle(x, y - 8, 18); });

  /* --- 로비 --- */
  const cocoStand = sprite({ x: 1068, y: 960, w: 58, h: 104, html: `<img src="assets/coco.png" alt="코코 등신대" style="width:58px">` });
  circle(1068, 952, 20);
  const lobiStand = sprite({ x: 1232, y: 960, w: 60, h: 60, html: `<img src="assets/lobi.png" alt="러비 등신대" style="width:60px">` });
  circle(1232, 952, 20);
  spot({ id: "coco", kind: "coco", x: 1068, y: 1000, el: cocoStand, r: 62, verb: "코코 보기", markTop: -24 });
  [[1050, 1440], [1250, 1440]].forEach(([x, y]) => { sprite({ x, y, w: 50, h: 66, html: deco("plant", 50, 66) }); circle(x, y - 6, 16); });
  const exitEl = sprite({ x: 1150, y: 1458, w: 120, h: 40, z: 1458, html: "" });
  const exitSpot = spot({ id: "exit", kind: "exit", x: 1150, y: 1414, el: exitEl, r: 72, verb: "퇴근하기", markTop: -54 });

  /* --- 라운지 --- */
  const counter = sprite({ x: 1960, y: 866, w: 330, h: 150, html: `<svg width="330" height="150" viewBox="0 0 330 150">
      <ellipse cx="165" cy="144" rx="160" ry="7" fill="rgba(60,40,20,.16)"/>
      <rect x="250" y="0" width="74" height="144" rx="12" fill="#cfe8f5"/><rect x="250" y="54" width="74" height="4" fill="#a9cfe3"/><rect x="306" y="20" width="6" height="24" rx="3" fill="#9bbfd3"/><rect x="306" y="72" width="6" height="30" rx="3" fill="#9bbfd3"/>
      <rect x="6" y="64" width="238" height="80" rx="10" fill="#f6dcb8"/><rect x="6" y="58" width="238" height="14" rx="7" fill="#e0b98a"/>
      <rect x="16" y="84" width="70" height="50" rx="6" fill="#efcfa4"/><rect x="92" y="84" width="70" height="50" rx="6" fill="#efcfa4"/><rect x="168" y="84" width="70" height="50" rx="6" fill="#efcfa4"/>
      <rect x="28" y="22" width="44" height="40" rx="6" fill="#5b4f5f"/><rect x="36" y="44" width="16" height="12" rx="2" fill="#fff"/><circle cx="62" cy="32" r="4" fill="#ff7a7a"/>
      <text x="110" y="56" font-size="26">🍎</text><text x="160" y="56" font-size="24">🥤</text><text x="200" y="56" font-size="22">🍪</text></svg>` });
  rect(1800, 800, 330, 64);
  const vend = sprite({ x: 1370, y: 870, w: 80, h: 140, html: `<svg width="80" height="140" viewBox="0 0 80 140"><rect x="4" y="4" width="72" height="132" rx="10" fill="#ec5f9f"/><rect x="12" y="14" width="40" height="80" rx="5" fill="#ffe9f2"/>
      ${[0, 1, 2].map((r) => [0, 1].map((c) => `<circle cx="${22 + c * 20}" cy="${28 + r * 25}" r="7" fill="${["#ffd23f", "#6fcbe9", "#8fd06a"][r]}"/>`).join("")).join("")}
      <rect x="58" y="22" width="12" height="30" rx="4" fill="#fff"/><rect x="12" y="104" width="56" height="20" rx="5" fill="#b9437a"/></svg>` });
  rect(1332, 824, 76, 46);
  sprite({ x: 1420, y: 796, w: 100, h: 72, z: 700, html: deco("window", 100, 72) });
  sprite({ x: 1550, y: 796, w: 100, h: 72, z: 700, html: deco("window", 100, 72) });
  // 점심 식탁
  const TABLE = { x: 1560, y: 1140 };
  const SEATS = { left: { x: TABLE.x - 150, y: TABLE.y + 10 }, top: { x: TABLE.x, y: TABLE.y - 88 }, right: { x: TABLE.x + 150, y: TABLE.y + 10 }, me: { x: TABLE.x, y: TABLE.y + 96 } };
  Object.values(SEATS).forEach((s) => sprite({ x: s.x, y: s.y + 6, w: 54, h: 30, z: s.y - 2, html: `<svg width="54" height="30" viewBox="0 0 54 30"><ellipse cx="27" cy="22" rx="24" ry="8" fill="rgba(60,40,20,.15)"/><ellipse cx="27" cy="14" rx="24" ry="11" fill="#f2a65a"/><ellipse cx="27" cy="11" rx="20" ry="8" fill="#ffc27d"/></svg>` }));
  const table = sprite({ x: TABLE.x, y: TABLE.y + 30, w: 230, h: 120, html: `<svg width="230" height="120" viewBox="0 0 230 120">
      <ellipse cx="115" cy="110" rx="90" ry="9" fill="rgba(60,40,20,.16)"/><rect x="105" y="60" width="20" height="50" rx="6" fill="#b47b4c"/>
      <ellipse cx="115" cy="58" rx="110" ry="50" fill="#d9a66a"/><ellipse cx="115" cy="52" rx="106" ry="46" fill="#f6d7a7"/>
      <ellipse cx="44" cy="58" rx="24" ry="13" fill="#fff"/><ellipse cx="186" cy="58" rx="24" ry="13" fill="#fff"/><ellipse cx="115" cy="24" rx="24" ry="12" fill="#fff"/><ellipse cx="115" cy="86" rx="24" ry="12" fill="#fff"/>
      <text x="44" y="66" text-anchor="middle" font-size="20">🍝</text><text x="186" y="66" text-anchor="middle" font-size="20">🍛</text><text x="115" y="32" text-anchor="middle" font-size="20">🍙</text><text x="115" y="94" text-anchor="middle" font-size="20">🍱</text>
      <text x="115" y="62" text-anchor="middle" font-size="22">🌷</text></svg>` });
  rect(TABLE.x - 104, TABLE.y - 30, 208, 64);
  const seatEl = sprite({ x: SEATS.me.x, y: SEATS.me.y, w: 60, h: 40, html: "" });
  const lunchSpot = spot({ id: "lunch", kind: "lunch", x: SEATS.me.x, y: SEATS.me.y + 20, el: seatEl, r: 80, verb: "같이 먹기", markTop: -70 });
  // 쉼터 코너
  sprite({ x: 1980, y: 1260, w: 200, h: 127, html: deco("sofa", 200, 127) }); rect(1890, 1210, 180, 50);
  sprite({ x: 1980, y: 1350, w: 140, h: 54, html: deco("lowtable", 140, 54) }); rect(1916, 1320, 128, 30);
  sprite({ x: 1800, y: 1330, w: 96, h: 112, html: deco("armchair", 96, 112) }); circle(1800, 1310, 36);
  [[2100, 1440], [1330, 1440], [1810, 1100]].forEach(([x, y]) => { sprite({ x, y, w: 56, h: 74, html: deco("plant", 56, 74) }); circle(x, y - 8, 18); });

  office.start = { x: 1150, y: 1290 };
  office.pins = [
    { id: "member-한수민", label: "앱디자인팀" }, { id: "mydesk", label: "내 자리" }, { id: "db", label: "디자인 DB" },
    { id: "lunch", label: "라운지 식탁" }, { id: "exit", label: "출입구" }, { id: "door-ceo", label: "팀 사무실 복도", dx: 260 },
  ];
  office.drawMap = (ctx) => {
    ctx.fillStyle = office.bg; ctx.fillRect(0, 0, OW, OH);
    [["#f0c995", 64, 400, 2072, 300], ["#ead2b0", 64, 700, 936, 756], ["#f7efe2", 1024, 700, 252, 756], ["#fde6d3", 1300, 700, 836, 756]].forEach(([c, x, y, w, h]) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); });
    ctx.fillStyle = "#a98266";
    office.rects.forEach((r) => { if (r.w > 200 && r.h > 90 && r.y < 800) ctx.fillRect(r.x, r.y, r.w, Math.min(r.h, 100)); });
    ctx.fillStyle = "#c98d57";
    office.rects.forEach((r) => { if (r.h < 70) ctx.fillRect(r.x, r.y - 20, r.w, r.h + 20); });
    DOOR_X.forEach((x, i) => { ctx.fillStyle = D.teams[i].color; ctx.fillRect(x - 50, 330, 100, 70); });
  };

  /* ---------------------------------------------------------
     3-2. 섬 (출근 전 아침 · 퇴근 후 밤)
     --------------------------------------------------------- */
  const IW = 3200, IH = 2400;
  const island = makeScene("island", IW, IH, "#6fcbe9");
  B = island;
  const ISLAND = [[420, 330], [900, 230], [1600, 250], [2300, 220], [2850, 380], [3020, 900], [2980, 1500], [2820, 2020], [2200, 2170],
    [1850, 2230], [1600, 2300], [1350, 2230], [1000, 2200], [450, 2030], [250, 1500], [290, 880]];
  const ISLAND_D = smoothPath(ISLAND);
  const ROADS = [[[1600, 1990], [1600, 640]], [[1600, 1350], [420, 1350]], [[1600, 1350], [2600, 1350]]];
  const PLAZA = { x: 1600, y: 1350, r: 150 };
  const FIRE = { x: 1600, y: 2110 };
  {
    let g = `<defs>
      <pattern id="waves" width="160" height="90" patternUnits="userSpaceOnUse"><path d="M14 30 q16 -12 32 0" stroke="#a6e6f7" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M96 70 q16 -12 32 0" stroke="#a6e6f7" stroke-width="5" fill="none" stroke-linecap="round"/></pattern>
      <pattern id="grass" width="120" height="110" patternUnits="userSpaceOnUse"><path d="M20 40 l4 -10 l4 10 M30 40 l4 -8 l4 8" stroke="#93cf63" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M80 90 l4 -10 l4 10" stroke="#93cf63" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="96" cy="30" r="3" fill="#fff" opacity=".6"/></pattern>
    </defs>
    <rect width="${IW}" height="${IH}" fill="#6fcbe9"/><rect class="sea-wave" width="${IW}" height="${IH}" fill="url(#waves)"/>
    <path d="${ISLAND_D}" fill="none" stroke="#c6f1fb" stroke-width="270" stroke-linejoin="round"/>
    <path d="${ISLAND_D}" fill="#f6e0a8" stroke="#f6e0a8" stroke-width="175" stroke-linejoin="round"/>
    <path d="${ISLAND_D}" fill="#a9dc74"/><path d="${ISLAND_D}" fill="url(#grass)"/>
    <ellipse cx="${FIRE.x}" cy="${FIRE.y + 30}" rx="390" ry="245" fill="#f6e0a8"/>`;
    ROADS.forEach((r) => { g += `<path d="${lineD(r)}" stroke="#e3c48f" stroke-width="106" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`; });
    g += `<circle cx="${PLAZA.x}" cy="${PLAZA.y}" r="${PLAZA.r + 8}" fill="#e3c48f"/>`;
    ROADS.forEach((r) => { g += `<path d="${lineD(r)}" stroke="#f7e7c2" stroke-width="88" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`; });
    g += `<circle cx="${PLAZA.x}" cy="${PLAZA.y}" r="${PLAZA.r - 6}" fill="#f7e7c2"/><circle cx="${PLAZA.x}" cy="${PLAZA.y}" r="62" fill="#7fc15a" stroke="#c9a46a" stroke-width="10"/>`;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, c = ["#ec5f9f", "#ffd23f", "#ffffff", "#ff8a65"][i % 4];
      g += `<circle cx="${PLAZA.x + Math.cos(a) * 34}" cy="${PLAZA.y + Math.sin(a) * 34}" r="9" fill="${c}"/>`;
    }
    g += `<circle cx="${PLAZA.x}" cy="${PLAZA.y}" r="12" fill="#ec5f9f"/>`;
    // 모닥불 자리 (모래 위 원형 돌)
    g += `<ellipse cx="${FIRE.x}" cy="${FIRE.y + 6}" rx="70" ry="40" fill="#e8cf95"/>`;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g += `<ellipse cx="${FIRE.x + Math.cos(a) * 58}" cy="${FIRE.y + 6 + Math.sin(a) * 32}" rx="13" ry="9" fill="#b8a99a"/>`; }
    island.ground.innerHTML = g;
  }

  // 키글 본사
  const kigleLogo = `<g font-family="Jua, sans-serif" font-size="46" text-anchor="middle"><rect x="140" y="0" width="180" height="58" rx="18" fill="#fff"/>
      <text x="172" y="44" fill="#e8473f">k</text><text x="199" y="44" fill="#f5a623">i</text><text x="226" y="44" fill="#4caf50">g</text><text x="254" y="44" fill="#3a7bd5">l</text><text x="284" y="44" fill="#e8473f">e</text></g>`;
  const hq = sprite({ x: 1600, y: 520, w: 460, h: 306, html: house({ w: 460, wallH: 220, roofH: 86, wall: "#fffdf7", roof: "#ec5f9f", roofType: "flat", wins: 6, rows: 2, door: "#ec5f9f", extra: kigleLogo }) });
  label(hq, "🏢 키글 본사", -40);
  rect(1600 - 218, 520 - 64, 436, 58);
  sprite({ x: 1830, y: 330, w: 70, h: 120, z: 330, html: `<svg width="70" height="120" viewBox="0 0 70 120"><rect x="6" y="0" width="5" height="120" fill="#8a7a6a"/><path class="flag" d="M11 6 h46 l-8 14 l8 14 h-46z" fill="#ffd23f"/></svg>` });
  const hqSpot = spot({ id: "hq", kind: "hq", x: 1600, y: 566, el: hq, verb: "출근하기", markTop: -78 });

  // 팀원들의 집 (다정이네 집 포함)
  const HOME_POS = [[560, 1260], [790, 1260], [1020, 1260], [1250, 1260], [520, 1580], [740, 1580], [960, 1580], [1180, 1580], [1400, 1580]];
  const HOME_C = ["#f28b82", "#81c995", "#7fb4e8", "#f7a8c4", "#c59be0", "#ffb36b", "#6fd0dc", "#b99a85", "#a99be6"];
  let myHome = null;
  D.members.forEach((m, i) => {
    const [hx, hy] = HOME_POS[i];
    const el = sprite({ x: hx, y: hy, w: 150, h: 150, html: house({ w: 150, wallH: 84, roofH: 66, wall: "#fff7ea", roof: m.me ? "#f0643c" : HOME_C[i], door: shade(HOME_C[i], -0.25), chimney: i % 3 === 0 }) });
    rect(hx - 63, hy - 56, 126, 50);
    if (m.me) { label(el, "🏠 다정이네 집", -18); myHome = spot({ id: "home", kind: "home", x: hx, y: hy + 40, el, verb: "집 보기", markTop: -40 }); }
  });
  // 가로등
  [[1490, 1150], [1712, 1560], [1490, 1760], [1000, 1440], [2300, 1440], [1712, 900], [1490, 700], [700, 1440]].forEach(([x, y]) => {
    sprite({ x, y, w: 60, h: 120, html: lamp() }); circle(x, y - 4, 10);
  });

  // 모닥불 + 둘러앉은 팀원 (밤에만 보임)
  const fireEl = sprite({ x: FIRE.x, y: FIRE.y + 24, w: 120, h: 130, cls: "night-only", html: `<div class="fire"><i></i><i></i><i></i><b></b><b></b><b></b></div>
      <svg width="120" height="50" viewBox="0 0 120 50" style="position:absolute;left:0;bottom:0"><rect x="18" y="20" width="84" height="16" rx="8" fill="#8a5a3c" transform="rotate(14 60 28)"/><rect x="18" y="20" width="84" height="16" rx="8" fill="#a06a45" transform="rotate(-14 60 28)"/></svg>` });
  circle(FIRE.x, FIRE.y + 8, 48);
  const RING = { rx: 275, ry: 185 };
  const ringPos = (deg) => ({ x: FIRE.x + Math.cos((deg * Math.PI) / 180) * RING.rx, y: FIRE.y + 12 + Math.sin((deg * Math.PI) / 180) * RING.ry });
  const FIRE_ORDER = ["이서정", "박소정", "한수민", "김현수", "고재영", "이희진", "박화진", "김민성"];
  const FIRE_ANGLE = [130, 170, 210, 250, 290, 330, 10, 50]; // 내 자리는 90° (맨 앞)
  const HOBBY_ANIM = { "박소정": "dance", "박화진": "bang", "김민성": "bob", "이희진": "sway", "한수민": "sway", "이서정": "bob" };
  const fireChars = [];
  FIRE_ORDER.forEach((name, i) => {
    const m = D.members.find((x) => x.name === name);
    const p = ringPos(FIRE_ANGLE[i]);
    sprite({ x: p.x, y: p.y + 4, w: 70, h: 24, z: p.y - 3, cls: "night-only", html: `<svg width="70" height="24" viewBox="0 0 70 24"><rect x="3" y="6" width="64" height="16" rx="8" fill="#9b6b47"/><ellipse cx="7" cy="14" rx="5" ry="8" fill="#d9b48a"/></svg>` });
    const c = charSprite(m, p.x, p.y, "npc sit night-only " + (HOBBY_ANIM[name] || ""));
    c.el.insertAdjacentHTML("beforeend", `<div class="hobby-bubble ${p.x < FIRE.x ? "left" : ""}">${m.hobby.e}</div>`);
    c.face = p.x < FIRE.x ? 1 : -1;
    c.body.style.transform = `scaleX(${c.face})`;
    circle(p.x, p.y - 6, 18);
    fireChars.push(c);
    spot({ id: "fire-" + name, kind: "hobby", m, x: p.x, y: p.y, el: c.el, r: 70, verb: "이야기", markTop: -36 });
  });
  const MY_SEAT = ringPos(90);
  sprite({ x: MY_SEAT.x, y: MY_SEAT.y + 4, w: 70, h: 24, z: MY_SEAT.y - 3, cls: "night-only", html: `<svg width="70" height="24" viewBox="0 0 70 24"><rect x="3" y="6" width="64" height="16" rx="8" fill="#9b6b47"/><ellipse cx="7" cy="14" rx="5" ry="8" fill="#d9b48a"/></svg>` });
  const mySeatEl = sprite({ x: MY_SEAT.x, y: MY_SEAT.y, w: 70, h: 40, cls: "night-only", html: "" });
  const joinSpot = spot({ id: "join", kind: "join", x: MY_SEAT.x, y: MY_SEAT.y - 30, el: mySeatEl, r: 84, verb: "같이 앉기", markTop: -60 });

  // 섬 충돌 판정
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  function inPoly(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  const edgeDist = (x, y) => Math.min(...ISLAND.map((p, i) => { const q = ISLAND[(i + 1) % ISLAND.length]; return segDist(x, y, p[0], p[1], q[0], q[1]); }));
  const onLand = (x, y) => inPoly(x, y, ISLAND) || edgeDist(x, y) < 50;
  const roadDist = (x, y) => Math.min(...ROADS.flatMap((r) => r.slice(1).map((q, i) => segDist(x, y, r[i][0], r[i][1], q[0], q[1]))), Math.hypot(x - PLAZA.x, y - PLAZA.y) - PLAZA.r);
  island.extraBlock = (x, y) => !onLand(x, y) || Math.hypot(x - PLAZA.x, y - PLAZA.y) < 76;

  // 나무 · 야자수 · 꽃 (고정 시드)
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const clearAt = (x, y, pad) =>
    roadDist(x, y) > 66 + pad &&
    Math.hypot(x - FIRE.x, y - FIRE.y) > 400 &&
    !island.rects.some((r) => x > r.x - pad - 30 && x < r.x + r.w + pad + 30 && y > r.y - pad - 40 && y < r.y + r.h + pad + 70) &&
    !island.spots.some((s) => Math.hypot(x - s.x, y - s.y) < 110) &&
    !island.circles.some((c) => Math.hypot(x - c.x, y - c.y) < c.r + pad + 30);
  const TREE_C = ["#5cb85c", "#4fae5f", "#6cc24a", "#3f9f5a", "#7acb5a"];
  for (let n = 0, made = 0; n < 4000 && made < 130; n++) {
    const x = 300 + rnd() * 2700, y = 300 + rnd() * 1850;
    if (!inPoly(x, y, ISLAND) || edgeDist(x, y) < 110 || !clearAt(x, y, 20)) continue;
    sprite({ x, y, w: 96, h: 116, html: tree(TREE_C[made % 5]) }); circle(x, y - 6, 18); made++;
  }
  for (let n = 0, made = 0; n < 5000 && made < 44; n++) {
    const x = 200 + rnd() * 2850, y = 200 + rnd() * 2100, d = edgeDist(x, y);
    if (!inPoly(x, y, ISLAND) || d < 15 || d > 80 || !clearAt(x, y, 10)) continue;
    sprite({ x, y, w: 100, h: 140, html: palm() }); circle(x, y - 6, 14); made++;
  }
  const FL = ["#ec5f9f", "#ffd23f", "#ffffff", "#ff8a65", "#b39ddb"];
  for (let n = 0, made = 0; n < 4000 && made < 150; n++) {
    const x = 300 + rnd() * 2700, y = 300 + rnd() * 1850;
    if (!inPoly(x, y, ISLAND) || edgeDist(x, y) < 70 || roadDist(x, y) < 60 || Math.hypot(x - FIRE.x, y - FIRE.y) < 380) continue;
    sprite({ x, y, w: 30, h: 26, html: flower(FL[made % 5]) }); made++;
  }
  island.start = { x: 1330, y: 1330 };
  island.pins = [{ id: "home", label: "다정이네 집" }, { id: "hq", label: "키글 본사" }, { id: "join", label: "바닷가 모닥불" }];
  island.drawMap = (ctx) => {
    ctx.fillStyle = "#6fcbe9"; ctx.fillRect(0, 0, IW, IH);
    const p = new Path2D(ISLAND_D);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = "#f6e0a8"; ctx.lineWidth = 175; ctx.stroke(p);
    ctx.fillStyle = "#a9dc74"; ctx.fill(p);
    ctx.fillStyle = "#f6e0a8"; ctx.beginPath(); ctx.ellipse(FIRE.x, FIRE.y + 30, 390, 245, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "#f7e7c2"; ctx.lineWidth = 90;
    ROADS.forEach((r) => ctx.stroke(new Path2D(lineD(r))));
    ctx.fillStyle = "#f7e7c2"; ctx.beginPath(); ctx.arc(PLAZA.x, PLAZA.y, PLAZA.r, 0, 7); ctx.fill();
    ctx.fillStyle = "#c9876a";
    island.rects.forEach((r) => { ctx.beginPath(); ctx.roundRect(r.x, r.y - 70, r.w, r.h + 70, 18); ctx.fill(); });
    ctx.fillStyle = "#ff9a3c"; ctx.beginPath(); ctx.arc(FIRE.x, FIRE.y, 40, 0, 7); ctx.fill();
  };

  /* =========================================================
     4. 주인공 (주다정)
     ========================================================= */
  B = island;
  const me = charSprite(ME, island.start.x, island.start.y, "player");
  me.t = 0; me.moving = false; me.face = 1;

  /* =========================================================
     5. 대화창 · 토스트 · HUD
     ========================================================= */
  // pages: HTML 문자열(정보 화면) 또는 { who, say, after } (말하는 대사 — 한 글자씩 타이핑 + 목소리)
  const dlg = { open: false, pages: [], i: 0, tag: "", onShow: null, onClose: null, closedAt: 0, typing: null };
  const dialogEl = $("#dialog"), dlgBody = $("#dlg-body"), dlgNext = $("#dlg-next");
  const meTag = `${portrait(ME, "tag-face")}주다정`;
  const say = (m) => `${portrait(m, "tag-face")}${m.name}`;
  function openDialog({ tag = meTag, pages, onShow, onClose }) {
    Object.assign(dlg, { open: true, pages, i: 0, tag, onShow, onClose });
    dialogEl.hidden = false;
    keys.clear();
    SFX.pop();
    renderPage();
  }
  function stopTyping() { if (dlg.typing) { clearInterval(dlg.typing.timer); dlg.typing = null; } }
  function renderPage() {
    stopTyping();
    const pg = dlg.pages[dlg.i];
    dlgBody.className = "dlg-body";
    if (typeof pg === "string") {
      $("#dlg-tag").innerHTML = dlg.tag;
      dialogEl.classList.remove("me-talk");
      dlgBody.innerHTML = pg;
    } else {
      const who = pg.who || ME, text = [...pg.say];
      $("#dlg-tag").innerHTML = say(who);
      dialogEl.classList.toggle("me-talk", who === ME);
      dlgBody.innerHTML = `<p class="speech"><span class="typed"></span><span class="caret"></span></p>${pg.after ? `<div class="after" hidden>${pg.after}</div>` : ""}`;
      const out = $(".typed", dlgBody);
      let k = 0;
      const finish = () => {
        stopTyping();
        out.textContent = pg.say;
        dlgBody.classList.add("said");
        const a = $(".after", dlgBody); if (a) a.hidden = false;
      };
      if (reduce) finish();
      else dlg.typing = { finish, timer: setInterval(() => {
        out.textContent += text[k];
        if (k % 2 === 0 && text[k].trim()) SFX.blip(who.voice || 500);
        if (++k >= text.length) finish();
      }, 34) };
    }
    dlgBody.scrollTop = 0;
    const last = dlg.i === dlg.pages.length - 1;
    $("#dlg-dots").innerHTML = dlg.pages.length > 1 ? dlg.pages.map((_, i) => `<i class="${i === dlg.i ? "on" : ""}"></i>`).join("") : "";
    dlgNext.innerHTML = `${last ? "닫기" : "다음"} <kbd>${KEY}</kbd>`;
    dlg.onShow && dlg.onShow(dlgBody, dlg.i);
  }
  function advance() {
    if (dlg.typing) { dlg.typing.finish(); return; } // 타이핑 중이면 먼저 한 번에 보여주기
    if (dlg.i < dlg.pages.length - 1) { dlg.i++; SFX.tick(); renderPage(); } else closeDialog();
  }
  function closeDialog() {
    stopTyping();
    dlg.open = false; dialogEl.hidden = true; dlg.closedAt = performance.now();
    const cb = dlg.onClose; dlg.onClose = null; cb && cb();
  }
  dlgNext.addEventListener("click", advance);

  function toast(e, title, small) {
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<span class="e">${e}</span><div><small>${small}</small><b>${title}</b></div>`;
    $("#toasts").appendChild(t);
    setTimeout(() => t.remove(), 3300);
  }
  const bump = (sel) => { const el = $(sel).closest(".chip"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); };

  // 조명 (시간대)
  const TINT = [[530, [255, 238, 214]], [600, [255, 250, 240]], [720, [255, 255, 255]], [900, [255, 246, 232]], [990, [255, 222, 186]], [1080, [255, 200, 160]]];
  function tintAt(m) {
    let i = TINT.findIndex((k) => k[0] >= m);
    if (i < 0) return TINT[TINT.length - 1][1];
    const [m0, c0] = TINT[Math.max(0, i - 1)], [m1, c1] = TINT[i];
    const t = m1 === m0 ? 1 : (m - m0) / (m1 - m0);
    return c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
  }
  const isNight = () => SC === island && state.step >= STEPS.findIndex((s) => s.id === "fire");
  function updateTime() {
    const m = minutesNow();
    $("#clock").textContent = hhmm(m);
    $("#clock-label").textContent = state.done ? "모닥불" : m < 540 ? "출근 중" : m < 720 ? "오전 업무" : m < 780 ? "점심" : m < 1080 ? "오후 업무" : "퇴근!";
    document.body.classList.toggle("night", isNight());
    if (!isNight()) $("#tint").style.background = `rgb(${tintAt(m).join(",")})`;
  }

  // 할 일 체크리스트 · 다음 목표
  const TEAM_N = TEAM.length;
  const needsAsk = () => !!STEPS[state.step].from && !state.got;
  function renderQuest() {
    $("#quest-list").innerHTML = STEPS.map((s, i) => {
      const done = i < state.step || state.done, now = i === state.step && !state.done;
      const from = s.from ? ` <small class="from">💬 ${s.from}</small>` : "";
      return `<li class="${done ? "done" : ""} ${now ? "now" : ""}"><time>${hhmm(s.at)}</time>${s.e} ${s.label}${from}<span class="ck">${done ? "✅" : now ? "👉" : ""}</span></li>`;
    }).join("");
    const doneN = state.done ? STEPS.length : state.step;
    $("#c-tasks").textContent = `${doneN}/${STEPS.length}`;
    const s = STEPS[state.step];
    $("#next").innerHTML = state.done
      ? `🌙 오늘 하루 끝! <button id="next-sum">한눈에 보기</button>`
      : needsAsk()
        ? `<span class="next-k">다음 할 일</span> 💬 <b>${s.from}님에게 할 일 받기</b> <span class="muted">· ${s.e} ${s.label}</span>`
        : `<span class="next-k">다음 할 일</span> ${s.e} <b>${s.label}</b> <span class="muted">· ${s.where}</span>`;
    const ns = $("#next-sum"); if (ns) ns.onclick = openSummary;
  }
  const isGoal = (s) => {
    if (state.done) return false;
    const c = cur();
    if (needsAsk()) return s.kind === "member" && s.m.name === STEPS[state.step].from;
    return (c === "commute" && s.id === "hq") ||
      (["design", "spine", "thumb"].includes(c) && s.id === "mydesk") ||
      (c === "lunch" && s.id === "lunch") || (c === "resource" && s.id === "db") ||
      (c === "leave" && s.id === "exit") || (c === "fire" && s.id === "join");
  };
  function refreshMarks() {
    Object.values(scenes).forEach((sc) => sc.spots.forEach((s) => { const mk = s.el && $(".mark", s.el); if (mk) mk.hidden = !isGoal(s); }));
    renderQuest();
  }
  function giveTask() {
    const s = STEPS[state.step];
    state.got = true;
    updateTime();
    SFX.chime();
    toast("📌", `새 할 일: ${s.e} ${s.label}`, `${s.from}님에게 받았어요 · ${s.where}`);
    if (s.id === "lunch") goLunch(true);
    refreshMarks();
  }
  function completeStep(id) {
    if (cur() !== id) return;
    const done = STEPS[state.step];
    state.step++; state.got = false;
    updateTime();
    SFX.done();
    const next = STEPS[state.step];
    toast(done.e, `${done.label} 완료!`, `${hhmm(next.at)} · 다음: ${next.from ? `💬 ${next.from}님에게 할 일 받기` : `${next.e} ${next.label}`}`);
    bump("#c-tasks");
    if (done.id === "lunch") goLunch(false);
    refreshMarks();
  }

  /* =========================================================
     6. 장면 전환
     ========================================================= */
  function show(sc, pos) {
    if (SC) SC.el.hidden = true;
    SC = sc; sc.el.hidden = false;
    sc.spritesEl.appendChild(me.el);
    placeChar(me, pos.x, pos.y);
    me.el.classList.remove("sit");
    stage.style.background = sc.bg;
    path = null; pending = null; nearest && nearest.el && nearest.el.classList.remove("near"); nearest = null;
    cam.x = me.x; cam.y = me.y - 40;
    paintMiniBg();
    updateTime();
    if (sc === office) fitSignText();
  }
  function fade(text, mid, after) {
    const f = $("#fade");
    f.innerHTML = text; f.hidden = false; f.classList.remove("out");
    keys.clear();
    setTimeout(() => { mid(); setTimeout(() => { f.classList.add("out"); setTimeout(() => { f.hidden = true; after && after(); }, 600); }, 900); }, reduce ? 50 : 650);
  }
  function enterOffice() {
    completeStep("commute");
    SFX.whoosh();
    fade(`<small>09:00</small>출근!`, () => show(office, office.start), () => openDialog({ pages: [
      { say: "좋은 아침! 키글 본사에 도착했어요 ☀️" },
      { say: "복도에는 팀 사무실 문이 쭉 있어요. 문 앞에서 노크하면 그 팀이 무슨 일을 하는지 알 수 있어요." },
      { say: `우리 팀은 왼쪽 앱디자인팀 사무실! ${D.tasks.design.from}님한테 오늘 첫 일을 받으러 가 볼까요?`, after: `<p class="muted">로비 양옆 문으로 앱디자인팀 사무실과 라운지에 바로 갈 수 있어요.</p>` },
    ] }));
  }
  function leaveOffice() {
    completeStep("leave");
    SFX.whoosh();
    fade(`<small>18:00</small>퇴근!`, () => show(island, { x: 1600, y: 610 }), () => openDialog({ pages: [
      { say: "오늘도 고생했어요 🌙 밖은 벌써 깜깜하네요." },
      { say: "팀원들이 섬 남쪽 바닷가 모닥불에 모여 있대요. 나도 가 볼까요?" },
    ] }));
  }

  /* =========================================================
     7. 점심 (세 명이 식탁으로 이동)
     ========================================================= */
  const LUNCH_SEATS = [SEATS.left, SEATS.top, SEATS.right];
  function goLunch(on) {
    D.lunchWith.forEach((name, i) => {
      const mm = members[name];
      if (!mm) return;
      const p = on ? LUNCH_SEATS[i] : mm.home;
      placeChar(mm.char, p.x, p.y);
      mm.spot.x = p.x; mm.spot.y = p.y;
      mm.circle.x = p.x; mm.circle.y = p.y - 6;
      mm.char.el.classList.toggle("sit", on);
    });
  }

  /* =========================================================
     8. 업무 작업창 (디자인 · 리소스 · 스파인 · 썸네일)
     ========================================================= */
  const work = { open: false, id: null, p: 0, done: false };
  const workEl = $("#work"), screenEl = $("#work-screen"), barEl = $("#work-bar");
  const COCO = `<img src="assets/coco.png" alt="코코">`, LOBI = `<img src="assets/lobi.png" alt="러비">`;
  const FILES = [["coco_brush.png", 0], ["bathroom_bg.png", 1], ["toothbrush.png", 2], ["btn_play.png", 3], ["lobi_wash.png", 0], ["bedroom_bg.png", 1],
    ["towel.png", 2], ["btn_home.png", 3], ["coco_sleep.png", 0], ["park_bg.png", 1], ["soap.png", 2], ["popup.png", 3]];
  const WORK = {
    design: {
      init: () => `<div class="wk-design"><div class="artboard"><div class="art">${COCO}</div><span class="prop p1">🪥</span><span class="prop p2">🫧</span><span class="prop p3">✨</span></div>
        <div class="stages">${D.tasks.design.stages.map((s) => `<span>${s}</span>`).join("")}</div></div>`,
      update: (p) => {
        const art = $(".art", screenEl);
        const sk = clamp(p / 0.34, 0, 1), col = clamp((p - 0.34) / 0.4, 0, 1);
        art.style.filter = `grayscale(${1 - col}) contrast(${1 + (1 - col) * 0.6}) brightness(${1 + (1 - col) * 0.25})`;
        art.style.opacity = 0.25 + sk * 0.75;
        art.style.clipPath = `inset(${(1 - sk) * 100}% 0 0 0)`;
        $$(".prop", screenEl).forEach((e, i) => e.classList.toggle("on", p > 0.78 + i * 0.07));
        $$(".stages span", screenEl).forEach((e, i) => e.classList.toggle("on", p >= [0, 0.34, 0.74][i]));
      },
    },
    resource: {
      init: () => `<div class="wk-res"><div class="pile">${FILES.map(([f], i) => `<span class="file" data-i="${i}">🖼️ ${f}</span>`).join("")}</div>
        <div class="folders">${D.tasks.resource.folders.map((f, i) => `<div class="folder" data-f="${i}"><b>📁 ${f}</b><div class="in"></div></div>`).join("")}</div></div>`,
      update: (p) => {
        const n = Math.floor(p * FILES.length + 0.001);
        FILES.forEach(([, f], i) => {
          const el = $(`.file[data-i="${i}"]`, screenEl);
          if (i < n && el.parentElement.classList.contains("pile")) $(`.folder[data-f="${f}"] .in`, screenEl).appendChild(el);
        });
      },
    },
    spine: {
      init: () => `<div class="wk-spine"><div class="rig"><div class="rig-body">${COCO}</div>
        <svg class="bones" viewBox="0 0 120 200"><g stroke="#ff4fa0" stroke-width="5" stroke-linecap="round"><path class="b b1" d="M60 160 L60 110"/><path class="b b2" d="M60 110 L58 60"/><path class="b b3" d="M58 60 L40 30"/><path class="b b4" d="M60 118 L30 130"/><path class="b b5" d="M60 118 L92 126"/></g>
        <g fill="#fff" stroke="#ff4fa0" stroke-width="3.5"><circle class="b b1" cx="60" cy="160" r="7"/><circle class="b b2" cx="60" cy="110" r="7"/><circle class="b b3" cx="58" cy="60" r="7"/><circle class="b b4" cx="30" cy="130" r="6"/><circle class="b b5" cx="92" cy="126" r="6"/></g></svg></div>
        <div class="timeline"><div class="ruler">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<i>${i * 5}</i>`).join("")}</div><div class="keys">${[0, 1, 2, 3, 4].map((i) => `<em class="k" style="left:${6 + i * 21}%"></em>`).join("")}</div><div class="head"></div></div></div>`,
      update: (p) => {
        $$(".b", screenEl).forEach((e) => { const k = +e.classList[1].slice(1); e.classList.toggle("on", p >= k * 0.09); });
        $$(".k", screenEl).forEach((e, i) => e.classList.toggle("on", p >= 0.45 + i * 0.1));
        const rig = $(".rig-body", screenEl);
        rig.style.transform = p < 1 ? `rotate(${Math.sin(p * 18) * 6 * clamp((p - 0.45) / 0.3, 0, 1)}deg)` : "";
        $(".wk-spine", screenEl).classList.toggle("play", p >= 1);
      },
    },
    thumb: {
      init: () => `<div class="wk-thumb"><div class="tframe"><div class="t-bg"></div><div class="t-coco">${COCO}</div><div class="t-lobi">${LOBI}</div>
        <div class="t-title">${D.tasks.thumb.headline}</div><div class="t-new">NEW</div><div class="t-play">▶</div></div>
        <div class="layers">${["배경", "코코", "러비", "타이틀", "스티커"].map((l) => `<span>${l}</span>`).join("")}</div></div>`,
      update: (p) => {
        ["t-bg", "t-coco", "t-lobi", "t-title", "t-new"].forEach((c, i) => {
          const on = p >= 0.12 + i * 0.19;
          $("." + c, screenEl).classList.toggle("on", on);
          $$(".layers span", screenEl)[i].classList.toggle("on", on);
        });
        $(".t-play", screenEl).classList.toggle("on", p >= 1);
      },
    },
  };
  function openWork(id) {
    const t = D.tasks[id];
    Object.assign(work, { open: true, id, p: 0, done: false });
    $("#work-tag").innerHTML = `${t.e} ${hhmm(minutesNow())} · ${t.where}`;
    $("#work-title").textContent = `${t.title} — ${MY_APP.title}`;
    $("#work-desc").textContent = t.desc;
    screenEl.innerHTML = WORK[id].init();
    $("#work-stamp").hidden = true;
    $("#work-btn").innerHTML = coarse ? "탭! 탭! 작업하기" : `<kbd>E</kbd> 또는 <kbd>Space</kbd> 연타로 작업하기`;
    workEl.hidden = false;
    keys.clear();
    setWork(0);
  }
  function setWork(p) {
    work.p = clamp(p, 0, 1);
    barEl.style.width = work.p * 100 + "%";
    WORK[work.id].update(work.p);
    if (work.p >= 1 && !work.done) {
      work.done = true;
      $("#work-stamp").hidden = false;
      setTimeout(() => {
        workEl.hidden = true; work.open = false;
        const id = work.id;
        completeStep(id);
        const next = STEPS[state.step];
        const line = {
          design: "코코 디자인 완성! ✏️",
          resource: "정리 끝! 공통 디자인 DB에 차곡차곡 🗂️",
          spine: "코코가 움직인다! 액팅 완성 🦴",
          thumb: "썸네일까지 완성! 오늘 일 끝~ 🎉",
        }[id];
        const pages = [{ say: line, after: id === "resource"
          ? `<p class="muted">올해 앱디자인팀이 집중하는 것도 여기서 시작돼요.</p><ul class="list">${D.lab.map((l) => `<li><span class="e">✨</span>${l}</li>`).join("")}</ul>`
          : id === "thumb" ? `<p class="muted">앱디자인팀은 이렇게 <b>${D.mission.join("</b>과 <b>")}</b>으로 앱을 만들어요.</p>` : "" }];
        pages.push({ say: next.from ? `${next.from}님한테 다음 할 일 받으러 가 볼까요?` : "이제 1층 출입구로 퇴근해요! 🚪" });
        openDialog({ pages });
      }, reduce ? 300 : 1300);
    }
  }
  const workPress = () => { if (!work.done) { SFX.press(work.id); setWork(work.p + (coarse ? 0.09 : 0.075)); } };
  $("#work-btn").addEventListener("click", workPress);
  $("#work-close").addEventListener("click", () => { if (!work.done) { workEl.hidden = true; work.open = false; } });

  /* =========================================================
     9. 상호작용
     ========================================================= */
  const nowHint = () => {
    const s = STEPS[state.step];
    return `<p class="muted">지금 할 일: ${needsAsk() ? `💬 ${s.from}님에게 할 일 받기` : `${s.e} ${s.label} · ${s.where}`}</p>`;
  };
  const notYet = (what) => openDialog({ pages: [{ say: what, after: nowHint() }] });
  const taskCard = (s) => `<div class="proj">${s.id === "lunch" ? `<span class="app-emoji" style="width:48px;height:48px;font-size:26px">🍱</span>` : appIcon(MY_APP, 48)}
    <div><small>📌 새 할 일 · ${s.where}</small><b>${s.e} ${s.label}</b><span>${s.id === "lunch" ? D.lunchWith.join(" · ") + "님과 함께" : `${MY_APP.title} — ${D.tasks[s.id].desc}`}</span></div></div>`;
  const projectCard = (m) => {
    const a = projectOf(m);
    return `<div class="proj">${appIcon(a, 48)}<div><small>${m.me ? "오늘 내 담당 프로젝트" : "담당 프로젝트"}</small><b>${a.title}</b>
      <span>${a.released ? `${a.released} 출시 · ${a.downloads} 다운로드` : a.note || ""}</span></div></div>`;
  };
  function interact(s) {
    if (!s) return;
    path = null; pending = null;
    const c = cur();
    switch (s.kind) {
      case "hq":
        if (c === "commute") enterOffice();
        else notYet("오늘은 퇴근했어요! 모닥불로 가 볼까요? 🔥");
        break;
      case "home":
        openDialog({ pages: c === "commute"
          ? [{ say: "집이 최고지만… 출근할 시간이에요 🛋️" }, { say: "소파에서 모든 걸 해결하고 싶은 마음을 꾹 참고, 섬 북쪽 키글 본사로 가요!" }]
          : [{ say: "집에 가기 전에 모닥불부터 들렀다 갈까요? 🔥" }] });
        break;
      case "door": {
        const t = s.team;
        SFX.knock();
        if (!state.doors.has(t.id)) { state.doors.add(t.id); $("#c-doors").textContent = `${state.doors.size}/${D.teams.length}`; bump("#c-doors"); }
        s.el.classList.remove("knock"); void s.el.offsetWidth; s.el.classList.add("knock");
        openDialog({ tag: `${t.emoji} ${t.name}`, pages: [`<p class="muted">똑똑! 🚪</p><h2 style="color:${shade(t.color, -0.25)}">${t.emoji} ${t.name}</h2><p class="lead">${t.desc}</p>
          ${t.withUs ? `<div class="with"><b>🎨 앱디자인팀과는</b> ${t.withUs}</div>` : ""}
          <p class="muted" style="margin-top:8px">둘러본 팀 사무실 ${state.doors.size} / ${D.teams.length}</p>`] });
        if (state.doors.size === D.teams.length) toast("🗺️", "키글의 모든 팀을 둘러봤어요", "복도 탐방 완료");
        break;
      }
      case "frame": {
        const a = s.app;
        openDialog({ tag: "🖼️ 복도 액자 · 최근 출시 앱", pages: [`<a class="app wide" href="https://play.google.com/store/apps/details?id=${a.id}" target="_blank" rel="noopener">
          <img class="shot" src="${a.shot}" alt="${a.title} 화면" loading="lazy" referrerpolicy="no-referrer">
          <div class="meta">${appIcon(a, 44)}<div><b>${a.title}</b><small>디자인 ${a.designer} · ${a.released} 출시 · ${a.downloads} 다운로드 · 스토어에서 보기 ↗</small></div></div></a>`] });
        break;
      }
      case "board":
        openDialog({ tag: "🎨 앱디자인팀", pages: [`<h2>앱디자인팀의 미션</h2><div class="mission">${D.mission.map((m) => `<div>${m}</div>`).join("")}</div>
          <div class="grid2">${D.jobs.map((j) => `<div class="tile"><span class="e">${j.emoji}</span><b>${j.title}</b><span>${j.desc}</span></div>`).join("")}</div>`] });
        break;
      case "coco":
        openDialog({ tag: "🦖 로비", pages: [`<div class="member">${COCO.replace("<img", '<img class="portrait"')}<div><h2>꼬마공룡 코코비</h2><p class="lead">${D.company.slogan}</p><p>${D.company.mission}. ${D.company.intro}</p><div class="pill-row"><span class="pill">📱 ${D.company.stat}</span></div></div></div>`] });
        break;
      case "member": {
        const m = s.m, st = STEPS[state.step];
        const first = !state.greeted.has(m.name);
        if (first) { state.greeted.add(m.name); $("#c-team").textContent = `${state.greeted.size}/${TEAM_N}`; bump("#c-team"); }
        // 1) 지금 일을 줄 차례인 팀원 → 인사 + 오늘 할 일
        if (needsAsk() && st.from === m.name) {
          const t = D.tasks[st.id], pages = [];
          if (first && st.id !== "lunch") pages.push({ who: m, say: m.hi });
          t.ask.forEach((line, i) => pages.push({ who: m, say: line, after: i === t.ask.length - 1 ? taskCard(st) : "" }));
          pages.push({ who: ME, say: st.id === "lunch" ? "좋아요, 같이 가요! 🍱" : "네, 바로 할게요! 💪" });
          openDialog({ pages, onClose: giveTask });
          break;
        }
        // 2) 점심 식탁에 앉아 있는 팀원
        if (c === "lunch" && state.got && D.lunchWith.includes(m.name)) {
          openDialog({ pages: [{ who: m, say: (D.lunchTalk.find((l) => l.who === m.name) || {}).text || "점심 맛있게 먹어요!", after: `<p class="muted">앞쪽 빈 의자에 앉으면 같이 먹을 수 있어요.</p>` }] });
          break;
        }
        // 3) 그 밖에는 인사 + 요즘 하는 일 (이미 일을 준 사람은 고맙다는 말)
        const gave = STEPS.find((x, i) => x.from === m.name && i < state.step);
        const pages = [];
        if (first) pages.push({ who: m, say: m.hi });
        pages.push({ who: m, say: gave ? D.tasks[gave.id].thanks : m.talk,
          after: (gave ? "" : projectCard(m)) + (needsAsk() ? `<p class="muted" style="margin-top:8px">💬 지금 할 일은 ${st.from}님에게 받아요.</p>` : "") });
        openDialog({ pages });
        break;
      }
      case "mydesk":
        if (needsAsk()) notYet(`먼저 ${STEPS[state.step].from}님에게 할 일을 받아 올까요?`);
        else if (["design", "spine", "thumb"].includes(c)) openWork(c);
        else if (c === "lunch") notYet("배고파요… 점심 먹고 해요! 🍱 로비 오른쪽 라운지로 가요.");
        else if (c === "resource") notYet("리소스는 디자인 DB에서 정리해요!");
        else notYet("오늘 할 일은 다 끝났어요. 이제 퇴근! 🚪");
        break;
      case "db":
        if (c === "resource" && state.got) openWork("resource");
        else notYet("공통 디자인 DB예요. 캐릭터·배경·소품·UI 리소스가 앱별로 정리되어 있어요.");
        break;
      case "lunch":
        if (c !== "lunch") { notYet(state.step < STEPS.findIndex((x) => x.id === "lunch") ? "점심은 12시부터! 라운지 식탁이에요 🍱" : "점심은 맛있게 먹었어요 😋"); break; }
        if (!state.got) { notYet(`${D.tasks.lunch.from}님이 점심 같이 먹자고 했던 것 같은데… 먼저 말을 걸어 볼까요?`); break; }
        placeChar(me, SEATS.me.x, SEATS.me.y); me.el.classList.add("sit");
        openDialog({ tag: "🍱 12:00 점심시간", pages: [
          ...D.lunchTalk.map((l) => ({ who: D.members.find((x) => x.name === l.who), say: l.text })),
          { who: ME, say: "잘 먹겠습니다! 🍱" },
          `<h2>🍱 식탁에서 나온 앱디팀 이야기</h2><ul class="list">${D.lunch.map((l) => `<li><span class="e">${l.emoji}</span>${l.text}</li>`).join("")}</ul>`,
        ], onClose: () => { me.el.classList.remove("sit"); placeChar(me, SEATS.me.x, SEATS.me.y + 40); completeStep("lunch"); } });
        break;
      case "exit":
        if (c === "leave") leaveOffice();
        else {
          const left = STEPS.slice(state.step, STEPS.findIndex((x) => x.id === "leave")).map((x) => `${x.e} ${x.label}`);
          openDialog({ tag: "🚪 출입구", pages: [`<h2>아직 퇴근하기엔 일러요!</h2><p>남은 일을 끝내야 퇴근할 수 있어요.</p><ul class="list">${left.map((l) => `<li>${l}</li>`).join("")}</ul>`] });
        }
        break;
      case "hobby": {
        const m = s.m;
        state.hobbies.add(m.name);
        openDialog({ pages: [{ who: m, say: m.hobby.text, after: `<p class="muted">${m.hobby.e} ${m.hobby.act}</p><div class="tags">${m.tags.map((t) => `<span>${t}</span>`).join("")}</div>` }] });
        break;
      }
      case "join":
        if (c !== "fire") return;
        placeChar(me, MY_SEAT.x, MY_SEAT.y); me.el.classList.add("sit"); me.face = 1; me.body.style.transform = "";
        me.el.insertAdjacentHTML("beforeend", `<div class="hobby-bubble">${ME.hobby.e}</div>`);
        mySeatEl.classList.remove("hit"); mySeatEl.innerHTML = "";
        island.spots.splice(island.spots.indexOf(joinSpot), 1);
        state.done = true;
        updateTime(); refreshMarks();
        toast("🔥", "모닥불에 함께 앉았어요", "오늘 하루 완료!");
        openDialog({ pages: [
          { say: ME.hobby.text, after: `<p class="muted">${ME.hobby.e} ${ME.hobby.act}</p>` },
          { say: "각자 좋아하는 걸 하면서도 한자리에 모이는 팀. 이게 앱디자인팀이에요 🔥" },
          `<h2>🌙 오늘 하루 끝!</h2><p class="lead">${D.outro}</p>
           <p class="muted">인사한 팀원 ${state.greeted.size}/${TEAM_N} · 둘러본 팀 사무실 ${state.doors.size}/${D.teams.length} · 들은 취미 이야기 ${state.hobbies.size}/${TEAM_N}</p>
           <button class="primary-btn" id="again">↺ 처음부터 다시</button> <button class="go-btn" id="to-sum">📄 내용 한눈에 보기</button>`,
        ], onShow: (b, i) => { if (i === 2) { $("#again", b).onclick = () => location.reload(); $("#to-sum", b).onclick = () => { closeDialog(); openSummary(); }; } } });
        break;
    }
  }

  /* =========================================================
     10. 입력
     ========================================================= */
  const keys = new Set();
  let path = null, pending = null, nearest = null, keysShift = false;
  const locked = () => dlg.open || work.open || !$("#mapbox").hidden || !$("#intro").hidden || !$("#summary").hidden || !$("#fade").hidden;
  const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  const ACT = ["KeyE", "Enter", "Space"];
  addEventListener("keydown", (e) => {
    keysShift = e.shiftKey;
    if (!$("#intro").hidden) { if (e.key === "Enter") start(); return; }
    if (!$("#summary").hidden) { if (e.key === "Escape") closeSummary(); return; }
    if (!$("#mapbox").hidden) { if (e.key === "Escape" || e.code === "KeyM") closeMap(); return; }
    if (work.open) { if (ACT.includes(e.code)) { e.preventDefault(); workPress(); } if (e.key === "Escape") $("#work-close").click(); return; }
    if (dlg.open) {
      if (ACT.includes(e.code)) { e.preventDefault(); if (!e.repeat) advance(); }
      if (e.key === "Escape") closeDialog();
      return;
    }
    if (!$("#fade").hidden) return;
    if (MOVE[e.code]) { e.preventDefault(); keys.add(e.code); path = null; pending = null; }
    if (ACT.includes(e.code) && !e.repeat && performance.now() - dlg.closedAt > 250) { e.preventDefault(); interact(nearest); }
    if (e.code === "KeyM") openMap();
  });
  addEventListener("keyup", (e) => { keysShift = e.shiftKey; keys.delete(e.code); });
  addEventListener("blur", () => keys.clear());

  stage.addEventListener("pointerdown", (e) => {
    if (locked()) return;
    const hit = e.target.closest("[data-spot]");
    if (hit) {
      const [sid, idx] = hit.dataset.spot.split(":");
      const s = scenes[sid].spots[+idx];
      if (Math.hypot(me.x - s.x, me.y - s.y) < s.r) { interact(s); return; }
      pending = s; path = findPath(s.x, s.y, s.r * 0.5);
    } else {
      pending = null; path = findPath((e.clientX - cam.tx) / cam.z, (e.clientY - cam.ty) / cam.z, 10);
    }
  });

  // 클릭한 곳까지 길찾기 (격자 BFS → 보이는 점끼리 이어 매끄럽게)
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function clearLine(ax, ay, bx, by) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
    for (let i = 1; i <= n; i++) if (blocked(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n)) return false;
    return true;
  }
  function findPath(tx, ty, reach) {
    const C = SC === office ? 20 : 32, cols = Math.ceil(SC.W / C), rows = Math.ceil(SC.H / C);
    const free = new Int8Array(cols * rows).fill(-1), prev = new Int32Array(cols * rows).fill(-2);
    const ok = (cx, cy) => { const i = cy * cols + cx; if (free[i] < 0) free[i] = blocked(cx * C + C / 2, cy * C + C / 2) ? 0 : 1; return free[i] === 1; };
    const s0 = Math.floor(me.y / C) * cols + Math.floor(me.x / C);
    const q = [s0]; prev[s0] = -1;
    let best = s0, bestD = Infinity, head = 0;
    while (head < q.length && head < 30000) {
      const i = q[head++], cx = i % cols, cy = (i / cols) | 0;
      const d = Math.hypot(cx * C + C / 2 - tx, cy * C + C / 2 - ty);
      if (d < bestD) { bestD = d; best = i; }
      if (d < Math.max(reach, C * 0.75)) break;
      for (const [ox, oy] of DIRS) {
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const j = ny * cols + nx;
        if (prev[j] !== -2 || !ok(nx, ny) || (ox && oy && (!ok(cx + ox, cy) || !ok(cx, cy + oy)))) continue;
        prev[j] = i; q.push(j);
      }
    }
    const pts = [];
    for (let i = best; i !== -1; i = prev[i]) pts.push({ x: (i % cols) * C + C / 2, y: ((i / cols) | 0) * C + C / 2 });
    pts.reverse();
    if (!blocked(tx, ty) && clearLine(pts[pts.length - 1].x, pts[pts.length - 1].y, tx, ty)) pts.push({ x: tx, y: ty });
    // 매끄럽게: 지금 위치에서 곧장 보이는 가장 먼 점으로 건너뛰기
    const out = [];
    let ax = me.x, ay = me.y, k = 0;
    while (k < pts.length) {
      let j = pts.length - 1;
      while (j > k && !clearLine(ax, ay, pts[j].x, pts[j].y)) j--;
      out.push(pts[j]); ax = pts[j].x; ay = pts[j].y; k = j + 1;
    }
    return out.length ? out : null;
  }
  $("#act").addEventListener("click", () => interact(nearest));

  function blocked(x, y) {
    const sc = SC;
    if (x < 0 || y < 0 || x > sc.W || y > sc.H || sc.extraBlock(x, y)) return true;
    for (const r of sc.rects) if (x > r.x - 14 && x < r.x + r.w + 14 && y > r.y - 6 && y < r.y + r.h + 6) return true;
    for (const c of sc.circles) if ((x - c.x) ** 2 + (y - c.y) ** 2 < (c.r + 14) ** 2) return true;
    return false;
  }
  // 밤 장면 전에는 모닥불 쪽 충돌 없음
  const fireCircles = island.circles.filter((c) => Math.hypot(c.x - FIRE.x, c.y - FIRE.y) < 300);
  island.circles = island.circles.filter((c) => !fireCircles.includes(c));
  const setFireScene = (on) => { if (on) island.circles.push(...fireCircles); };

  /* =========================================================
     11. 지도 · 미니맵
     ========================================================= */
  const mini = $("#minimap"), mctx = mini.getContext("2d");
  const miniBg = document.createElement("canvas");
  function paintMiniBg() {
    const s = Math.min(440 / SC.W, 330 / SC.H);
    miniBg.width = 440; miniBg.height = 330;
    const c = miniBg.getContext("2d");
    c.fillStyle = SC.bg; c.fillRect(0, 0, 440, 330);
    c.save(); c.translate((440 - SC.W * s) / 2, (330 - SC.H * s) / 2); c.scale(s, s); SC.drawMap(c); c.restore();
    miniBg.s = s; miniBg.ox = (440 - SC.W * s) / 2; miniBg.oy = (330 - SC.H * s) / 2;
  }
  function drawMini() {
    mctx.clearRect(0, 0, mini.width, mini.height);
    mctx.drawImage(miniBg, 0, 0, mini.width, mini.height);
    const k = mini.width / 440;
    mctx.fillStyle = "#ec5f9f"; mctx.strokeStyle = "#fff"; mctx.lineWidth = 2;
    mctx.beginPath(); mctx.arc((miniBg.ox + me.x * miniBg.s) * k, (miniBg.oy + me.y * miniBg.s) * k, 5, 0, 7); mctx.fill(); mctx.stroke();
  }
  mini.addEventListener("click", () => openMap());

  function openMap() {
    const big = $("#bigmap"), wrap = $("#map-wrap");
    big.width = 960; big.height = Math.round((960 * SC.H) / SC.W);
    const s = 960 / SC.W, c = big.getContext("2d");
    c.save(); c.scale(s, s); SC.drawMap(c); c.restore();
    $("#map-title").textContent = SC === office ? "키글 본사 지도" : "앱디 섬 지도";
    $$(".map-pin", wrap).forEach((p) => p.remove());
    SC.pins.forEach((pin, n) => {
      const sp = SC.spots.find((x) => x.id === pin.id);
      if (!sp || (sp.id === "join" && !isNight())) return;
      const b = document.createElement("button");
      b.className = "map-pin" + (isGoal(sp) || (pin.id === "member-한수민" && needsAsk()) ? " goal" : "");
      b.style.left = ((sp.x + (pin.dx ?? 0)) / SC.W) * 100 + "%"; b.style.top = ((sp.y + (pin.dy ?? 0)) / SC.H) * 100 + "%";
      b.innerHTML = `<i>${n + 1}</i><span>${pin.label}</span>`;
      b.addEventListener("click", () => warp(sp));
      wrap.appendChild(b);
    });
    const you = document.createElement("div");
    you.className = "map-pin you";
    you.style.left = (me.x / SC.W) * 100 + "%"; you.style.top = (me.y / SC.H) * 100 + "%";
    you.innerHTML = `<i>나</i>`;
    wrap.appendChild(you);
    $("#mapbox").hidden = false;
    keys.clear();
  }
  function closeMap() { $("#mapbox").hidden = true; }
  $("#map-close").addEventListener("click", closeMap);
  $("#mapbox").addEventListener("click", (e) => { if (e.target.id === "mapbox") closeMap(); });
  $("#btn-map").addEventListener("click", openMap);
  function warp(s) {
    const tries = [[0, 0], [0, 30], [40, 20], [-40, 20], [0, 60], [60, 0], [-60, 0], [0, -40]];
    for (const [dx, dy] of tries) if (!blocked(s.x + dx, s.y + dy)) { placeChar(me, s.x + dx, s.y + dy); break; }
    path = null; pending = null;
    cam.x = me.x; cam.y = me.y - 40;
    closeMap();
  }
  $("#btn-quest").addEventListener("click", () => { renderQuest(); $("#quest").hidden = !$("#quest").hidden; });

  /* =========================================================
     12. 시작 화면 · 건너뛰기 요약
     ========================================================= */
  $("#intro-me").innerHTML = person(ME.look);
  function start() {
    $("#intro").hidden = true;
    SFX.init(); SFX.music("day");
    openDialog({ pages: [
      { say: "좋은 아침! 나는 앱디자인팀 주다정이에요 👋 머리 위의 고양이는 우리 집 다니예요." },
      { say: "집이 최고지만… 오늘도 출근해 볼까요?", after: `<p class="muted">${coarse ? "가고 싶은 곳을 탭하면 걸어가요." : "<kbd>WASD</kbd> 나 방향키로 걷고 <kbd>Shift</kbd> 로 달려요. 클릭한 곳으로도 걸어가요."}
        머리 위 <b style="color:var(--pink)">!</b> 가 다음 할 일이에요. 가까이 가서 <kbd>${KEY}</kbd> 를 누르세요.</p>` },
      { say: "팀원들한테 일을 하나씩 받아서 내 자리에서 끝내고, 또 받고! 퇴근하면 바닷가 모닥불에서 다 같이 모인대요.", after: `<p class="muted">먼저 섬 북쪽 🏢 키글 본사로 출근해요. 🔊 버튼으로 소리를 켜고 끌 수 있어요.</p>` },
    ] });
  }
  $("#btn-start").addEventListener("click", start);
  const syncSoundBtn = () => { $("#btn-sound").textContent = SFX.isOn() ? "🔊" : "🔇"; };
  $("#btn-sound").addEventListener("click", () => { SFX.init(); SFX.toggle(); syncSoundBtn(); });
  syncSoundBtn();
  addEventListener("pointerdown", () => SFX.init(), { once: true });
  addEventListener("keydown", () => SFX.init(), { once: true });

  function openSummary() {
    const sec = (h) => `<section class="sum-sec">${h}</section>`;
    $("#sum-inner").innerHTML = `
      <div class="sum-top"><h1>앱디의 하루 한눈에 보기</h1><button class="go-btn" id="sum-back">← 돌아가기</button></div>
      ${sec(`<h2>🏢 키글은 이런 회사예요</h2><p class="lead">${D.company.slogan} — ${D.company.mission}</p><p>${D.company.intro}</p>
        <ul class="list">${D.teams.map((t) => `<li><span class="e">${t.emoji}</span><b>${t.name}</b><span>${t.desc}</span></li>`).join("")}</ul>`)}
      ${sec(`<h2>👋 앱디자인팀 9인방</h2><div class="sum-members">${D.members.map((m) => `<div class="m">${portrait(m, "mini")}<div><b>${m.name}</b><p>${m.line}</p>
        <p>📌 ${projectOf(m).title}<br>${m.hobby.e} ${m.hobby.act}</p></div></div>`).join("")}</div>`)}
      ${sec(`<h2>🎨 앱디자인팀의 미션</h2><div class="mission">${D.mission.map((m) => `<div>${m}</div>`).join("")}</div>
        <div class="grid2">${D.jobs.map((j) => `<div class="tile"><span class="e">${j.emoji}</span><b>${j.title}</b><span>${j.desc}</span></div>`).join("")}</div>`)}
      ${sec(`<h2>🕘 앱디자이너의 하루</h2><ul class="list">${STEPS.map((s) => `<li><b>${hhmm(s.at)}</b><span>${s.e} ${s.label}${D.tasks[s.id] ? ` — ${D.tasks[s.id].desc}` : ""}</span></li>`).join("")}</ul>`)}
      ${sec(`<h2>🛠️ 앱이 만들어지는 길</h2><div class="steps">${D.process.map((p, i) => `<div class="st"><span class="e">${p.emoji}</span><b>${i + 1}. ${p.title}</b><small>${p.who}</small></div>`).join("")}</div>`)}
      ${sec(`<h2>🧪 2026년에 집중하는 것</h2><ul class="list">${D.lab.map((l) => `<li><span class="e">✨</span>${l}</li>`).join("")}</ul>`)}
      ${sec(`<h2>🏆 최근 출시한 앱</h2><div class="apps">${D.apps.map((a) => `<a class="app" href="https://play.google.com/store/apps/details?id=${a.id}" target="_blank" rel="noopener">
          <img class="shot" src="${a.shot}" alt="${a.title} 화면" loading="lazy" referrerpolicy="no-referrer">
          <div class="meta">${appIcon(a, 38)}<div><b>${a.title}</b><small>디자인 ${a.designer} · ${a.released} · ${a.downloads}</small></div></div></a>`).join("")}</div>`)}
      ${sec(`<h2>🔥 퇴근 후 모닥불</h2><ul class="list">${D.members.map((m) => `<li><span class="e">${m.hobby.e}</span><b>${m.name}</b><span>${m.hobby.text}</span></li>`).join("")}</ul><p class="lead" style="margin-top:14px">${D.outro}</p>`)}`;
    $("#summary").hidden = false;
    $("#sum-back").addEventListener("click", closeSummary);
  }
  function closeSummary() { $("#summary").hidden = true; }
  $("#btn-skip").addEventListener("click", openSummary);
  $("#btn-skip2").addEventListener("click", openSummary);

  /* =========================================================
     13. 카메라 · 매 프레임
     ========================================================= */
  const cam = { x: me.x, y: me.y - 40, z: 1, tx: 0, ty: 0 };
  function layout() { cam.z = innerWidth < 720 ? 0.72 : innerHeight < 720 ? 0.85 : 1; }
  addEventListener("resize", layout);
  layout();

  let last = performance.now(), wasNight = false, stepDist = 0, lastX = 0, lastY = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const night = isNight();
    if (night !== wasNight) { wasNight = night; island.el.classList.toggle("is-night", night); setFireScene(night); updateTime(); SFX.music(night ? "night" : "day"); }

    let dx = 0, dy = 0;
    if (!locked()) {
      keys.forEach((k) => { dx += MOVE[k][0]; dy += MOVE[k][1]; });
      if (!dx && !dy && path) {
        const wp = path[0], tx = wp.x - me.x, ty = wp.y - me.y, d = Math.hypot(tx, ty);
        if (pending && Math.hypot(me.x - pending.x, me.y - pending.y) < pending.r * 0.6) { const p = pending; path = null; pending = null; interact(p); }
        else if (d < 10) {
          path.shift();
          if (!path.length) { const p = pending; path = null; pending = null; if (p && Math.hypot(me.x - p.x, me.y - p.y) < p.r) interact(p); }
        } else { dx = tx / d; dy = ty / d; }
      }
    }
    const len = Math.hypot(dx, dy);
    me.moving = len > 0 && !me.el.classList.contains("sit");
    if (me.moving) {
      dx /= len; dy /= len;
      const sp = (keys.size && keysShift ? 420 : 260) * dt;
      let moved = false;
      for (const a of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
        const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
        const nx = me.x + rx * sp, ny = me.y + ry * sp;
        if (!blocked(nx, ny)) { me.x = nx; me.y = ny; moved = true; break; }
      }
      if (!moved && path) {
        if (pending && Math.hypot(me.x - pending.x, me.y - pending.y) < pending.r) { const p = pending; path = null; pending = null; interact(p); }
        else { path = null; pending = null; }
      }
      if (Math.abs(dx) > 0.1) me.face = dx > 0 ? -1 : 1;
      me.t += dt;
      placeChar(me, me.x, me.y);
      // 발소리 (사무실은 나무 바닥, 섬은 풀밭)
      stepDist += Math.hypot(me.x - lastX, me.y - lastY);
      if (stepDist > (keysShift ? 48 : 38)) { stepDist = 0; SFX.step(SC === island); }
    }
    me.el.classList.toggle("walking", me.moving && !reduce);
    me.body.style.transform = me.moving && !reduce
      ? `translateY(${-Math.abs(Math.sin(me.t * 11)) * 5}px) scaleX(${me.face})`
      : `scaleY(${1 + Math.sin(now / 420) * 0.012}) scaleX(${me.face})`;

    // 사무실 팀원은 나를 바라봄
    if (SC === office) Object.values(members).forEach(({ char: c }) => { c.body.style.transform = `scaleX(${me.x > c.x ? -1 : 1})`; });

    // 가장 가까운 지점
    let best = null, bd = Infinity;
    SC.spots.forEach((s) => {
      if (s.el && s.el.classList.contains("night-only") && !night) return;
      const d = Math.hypot(me.x - s.x, me.y - s.y);
      if (d < s.r && d < bd) { bd = d; best = s; }
    });
    if (best !== nearest) {
      nearest && nearest.el && nearest.el.classList.remove("near");
      nearest = best;
      nearest && nearest.el && nearest.el.classList.add("near");
      if (nearest) $("#act").innerHTML = `💬 ${nearest.verb ?? "보기"}`;
    }
    $("#act").hidden = !(coarse && nearest && !locked());

    // 카메라
    const vw = innerWidth / cam.z, vh = innerHeight / cam.z;
    const k = reduce ? 1 : Math.min(1, dt * 6);
    cam.x += (me.x - cam.x) * k; cam.y += (me.y - 40 - cam.y) * k;
    const cx = SC.W < vw ? SC.W / 2 : clamp(cam.x, vw / 2, SC.W - vw / 2);
    const cy = SC.H < vh ? SC.H / 2 : clamp(cam.y, vh / 2, SC.H - vh / 2);
    cam.tx = innerWidth / 2 - cx * cam.z; cam.ty = innerHeight / 2 - cy * cam.z;
    SC.el.style.transform = `translate3d(${cam.tx}px,${cam.ty}px,0) scale(${cam.z})`;

    lastX = me.x; lastY = me.y;
    // 밤 소리: 모닥불 타닥타닥(가까울수록 크게) + 풀벌레
    if (night) {
      const k = clamp(1 - Math.hypot(me.x - FIRE.x, me.y - FIRE.y) / 900, 0, 1);
      if (k > 0 && Math.random() < dt * 10 * k) SFX.crackle(k);
      if (Math.random() < dt * 0.5) SFX.cricket();
    }
    // 밤: 모닥불 주변만 따뜻하게
    if (night) {
      const fx = cam.tx + FIRE.x * cam.z, fy = cam.ty + (FIRE.y - 20) * cam.z, flick = reduce ? 0 : Math.sin(now / 90) * 6 + Math.sin(now / 37) * 4;
      $("#tint").style.background = `radial-gradient(circle at ${fx}px ${fy}px, rgb(255,236,200) 0, rgb(255,214,170) ${(150 + flick) * cam.z}px, rgb(92,96,168) ${(470 + flick) * cam.z}px)`;
    }
    drawMini();
    requestAnimationFrame(frame);
  }

  // 디테일 수정용 바로가기: 주소 끝에 #office 또는 #night
  const jump = location.hash.slice(1);
  if (jump === "office" || jump === "night") {
    $("#intro").hidden = true;
    state.step = STEPS.findIndex((s) => s.id === (jump === "office" ? "design" : "fire"));
    if (jump === "office") show(office, office.start); else show(island, { x: FIRE.x, y: FIRE.y - 330 });
  } else show(island, island.start);
  refreshMarks();
  requestAnimationFrame(frame);
})();
