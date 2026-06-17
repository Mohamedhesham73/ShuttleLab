import { state, esc, toast, autoGrow } from "../core.js";
import { listenGiftJar, saveGiftJar, getPrivate, savePrivate, addMessage, listenMessages, notify } from "../data.js";

// =============================================================
//  MIND ROOM — a quiet, ever-changing place to land.
//  Every entry: a different world, a different greeting, a
//  different gift (always in Coach Ahmed's voice). Door to fall
//  through, hidden surprises, shake for a new world, a calming
//  bubble game, a private "sky" of how you've felt, and a real
//  one-tap line to the coach.
// =============================================================

const R = (a,b)=>a+Math.random()*(b-a);
const pick = a=>a[Math.floor(Math.random()*a.length)];

// Powerful, confidence-building words — written in Coach Ahmed's voice.
const GIFTS = [
  "Listen to me. You were built for the big points. Now go take them.",
  "I've watched you earn every bit of this. Walk in like you own the court.",
  "Nerves mean you care. Breathe them in, then play your game.",
  "You don't rise to the occasion — you sink to your training. And you've trained like a champion.",
  "On the hard days, find that fire again. I still see it. So do they.",
  "You are dangerous the moment you believe. So believe.",
  "I'd send you onto that court a thousand times over. Go prove me right.",
  "Heavy legs, heavy heart — swing anyway. That's what makes you different.",
  "One more point. One more breath. You always have one more in you.",
  "The shuttle doesn't lie, and neither do I: you belong here.",
  "Champions aren't fearless. They show up scared and play anyway. Like you do.",
  "You've already beaten the toughest opponent — the voice that said you couldn't.",
  "Stand tall. Shoulders back. You're a ShuttleLab athlete. Play like it.",
  "I'm proud of you on the days you win, and prouder on the days you fight.",
  "Reset. The last point is gone. This one is yours.",
  "When it gets loud out there, find my voice: I believe in you.",
  "Talent got you here. Your heart takes you the rest of the way — and yours is huge.",
  "Breathe. Then go remind them why your name is on that board.",
  "Doubt is a liar. The work you've put in is the truth.",
  "Whatever the score, you walk off with your head high. Always. That's an order.",
  "You are enough, exactly as you are today. Now let's go to work.",
  "I didn't pick you by accident. I picked you because you've got something rare."
];

const BUBBLE_WORDS = ["calm","breathe","enough","strong","here","safe","proud","steady","brave","light","okay","rise"];
const MOODS = [
  { key:"great", label:"Great",  col:"#a4dd2b" },
  { key:"okay",  label:"Okay",   col:"#9ccf6a" },
  { key:"flat",  label:"Flat",   col:"#d9c45a" },
  { key:"heavy", label:"Heavy",  col:"#d98a6a" }
];

const SCENES = {
  night:   { sky:["#0b1230","#1b2350"], accent:"#9ad7ff", kind:"stars" },
  fire:    { sky:["#101d18","#1d3b2e"], accent:"#bdf06a", kind:"fire" },
  lantern: { sky:["#241636","#3a2350"], accent:"#ffb86b", kind:"lantern" },
  petal:   { sky:["#2a1726","#4a2742"], accent:"#ffb6d2", kind:"petal" },
  rain:    { sky:["#10151c","#1c2733"], accent:"#86c8ff", kind:"rain" }
};
const SCENE_KEYS = Object.keys(SCENES);

export function renderMindRoom(){
  const view = document.getElementById("view");
  const coach = state.role === "coach";
  const firstName = (state.name||"champion").split(" ")[0];
  const coachMember = state.roster.find(u=>u.role==="coach");
  const coachName = coachMember ? coachMember.name : "your coach";
  const hour = new Date().getHours();
  const tod = hour<12 ? "morning" : hour<18 ? "afternoon" : "evening";

  const GREETS = [
    "There you are, "+firstName+". I'm really glad you came.",
    "Hey "+firstName+". You made it here — that already counts.",
    "Good "+tod+". Put the weight down for a minute.",
    "Breathe, "+firstName+". Everything out there can wait.",
    "Welcome back. This place is just for you.",
    "However today went — you're allowed to rest here.",
    "You don't have to be strong in this room.",
    "One slow breath, then another. I've got you."
  ];

  let coachGifts = [];
  state.unsub.push(listenGiftJar(list=>{ coachGifts = list||[]; }));

  // player's private store — mood "sky", gratitude jar, and a breathing streak
  let stars = [], priv = {};
  getPrivate(state.uid).then(p=>{ priv = p||{}; stars = priv.stars || []; bumpStreak(); }).catch(()=>{});
  function bumpStreak(){
    const today=new Date(); today.setHours(0,0,0,0); const tISO=today.toISOString().slice(0,10);
    if(priv.lastVisit!==tISO){
      const y=new Date(today); y.setDate(y.getDate()-1); const yISO=y.toISOString().slice(0,10);
      priv.streak = (priv.lastVisit===yISO) ? (priv.streak||0)+1 : 1;
      priv.lastVisit = tISO;
      savePrivate(state.uid, { streak:priv.streak, lastVisit:priv.lastVisit }).catch(()=>{});
    }
    updateStreak();
  }
  function updateStreak(){ const el=document.getElementById("mrStreak"); if(el) el.textContent = (priv.streak>1) ? ("🔥 "+priv.streak+"-day streak") : ""; }

  const allGifts = ()=> GIFTS.concat(coachGifts);

  // ---------------- DOOR (entry) ----------------
  renderDoor();

  function renderDoor(){
    view.innerHTML = `
      <div id="mrDoorWrap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;transition:opacity .5s, transform .5s;">
        <div class="muted" style="font-size:13px;letter-spacing:.1em;margin-bottom:18px;">THE MIND ROOM</div>
        <button id="mrDoor" aria-label="Open the Mind Room" style="position:relative;width:150px;height:210px;border-radius:80px 80px 14px 14px;border:2px solid var(--brand);background:radial-gradient(circle at 50% 38%, rgba(164,221,43,.22), rgba(8,12,10,.6));cursor:pointer;">
          <span style="position:absolute;right:22px;top:50%;width:9px;height:9px;border-radius:50%;background:var(--brand);box-shadow:0 0 14px var(--brand);"></span>
        </button>
        <div style="font-size:18px;margin-top:22px;">A quiet place to land.</div>
        <div class="muted" style="font-size:13px;margin-top:6px;">Tap the door — step inside.</div>
      </div>`;
    const door = document.getElementById("mrDoor");
    const wrap = document.getElementById("mrDoorWrap");
    const go = ()=>{ wrap.style.opacity="0"; wrap.style.transform="scale(1.15)"; setTimeout(renderRoom, 360); };
    door.onclick = go;
  }

  // ---------------- ROOM (the experience) ----------------
  function renderRoom(){
    const Wd = Math.max(260, view.clientWidth || 340);
    const Hd = Math.max(460, Math.min(Math.round(window.innerHeight*0.70), 620));

    let gift = pick(allGifts());
    let greet = pick(GREETS);

    view.innerHTML = `
      <div id="mrRoom" style="position:relative;width:100%;height:${Hd}px;border-radius:22px;overflow:hidden;border:1px solid #20261f;">
        <canvas id="mrCv" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none;"></canvas>

        <div style="position:absolute;top:14px;left:16px;right:16px;display:flex;align-items:center;justify-content:space-between;z-index:2;">
          <div style="display:flex;align-items:center;gap:8px;"><span style="font-size:13px;color:#fff;opacity:.85;">Mind room</span><span id="mrStreak" style="font-size:12px;color:var(--brand);"></span></div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span id="mrSky" style="font-size:12px;color:#fff;opacity:.8;"></span>
            <button id="mrNew" style="display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.28);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:20px;padding:6px 11px;font-size:12px;">new world</button>
          </div>
        </div>

        <div id="mrGreet" style="position:absolute;top:54px;left:18px;right:18px;z-index:2;color:#fff;font-size:18px;line-height:1.5;text-shadow:0 1px 12px rgba(0,0,0,.55);"></div>

        <div id="mrBreathWrap" style="position:absolute;left:0;right:0;top:42%;text-align:center;z-index:2;">
          <div id="mrBreath" style="font-size:13px;color:#fff;opacity:.85;letter-spacing:.1em;">breathe</div>
        </div>

        <div style="position:absolute;left:14px;right:14px;bottom:14px;z-index:2;">
          <div style="background:rgba(8,10,12,.46);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:14px 15px;">
            <div style="font-size:11px;color:#fff;opacity:.7;letter-spacing:.06em;margin-bottom:7px;">A WORD FOR YOU</div>
            <div id="mrGift" style="font-size:15px;line-height:1.55;color:#fff;"></div>
            <div style="font-size:12px;color:#fff;opacity:.65;margin-top:8px;">— Coach Ahmed</div>
            <button id="mrMore" style="margin-top:11px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.28);border-radius:20px;padding:6px 13px;font-size:12px;">open another</button>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            <button id="mrStar" style="flex:1;min-width:96px;background:rgba(0,0,0,.3);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:9px;font-size:12px;">Leave a star</button>
            <button id="mrGame" style="flex:1;min-width:96px;background:rgba(0,0,0,.3);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:9px;font-size:12px;">Hold my hand</button>
            <button id="mrGrat" style="flex:1;min-width:96px;background:rgba(0,0,0,.3);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:9px;font-size:12px;">🫙 Gratitude</button>
            ${coach
              ? `<button id="mrJar" style="flex:1;min-width:96px;background:rgba(0,0,0,.3);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:9px;font-size:12px;">My words</button><button id="mrInbox" style="flex:1;min-width:96px;background:rgba(0,0,0,.3);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:9px;font-size:12px;">Messages</button>`
              : `<button id="mrTalk" style="flex:1;min-width:96px;background:var(--brand);color:#0b0e0c;border:none;border-radius:12px;padding:9px;font-size:12px;font-weight:600;">Talk to ${esc(coachName.split(" ")[0])}</button>`}
          </div>
        </div>
      </div>`;

    const cv = document.getElementById("mrCv");
    document.getElementById("mrGreet").textContent = greet;
    document.getElementById("mrGift").textContent = gift;
    updateSky(); updateStreak();

    const engine = mountScene(cv, Wd, Hd, pick(SCENE_KEYS));

    // tap to scatter light
    cv.addEventListener("pointerdown", e=>{
      const r = cv.getBoundingClientRect();
      engine.burst(e.clientX-r.left, e.clientY-r.top);
    });

    // reroll everything
    function reroll(){
      engine.reroll(pickDifferent(engine.key));
      greet = pick(GREETS); gift = pick(allGifts());
      document.getElementById("mrGreet").textContent = greet;
      document.getElementById("mrGift").textContent = gift;
    }
    document.getElementById("mrNew").onclick = reroll;
    document.getElementById("mrMore").onclick = ()=>{ gift = pick(allGifts()); document.getElementById("mrGift").textContent = gift; };

    // shake to tumble into a new world (mobile)
    let lastShake = 0;
    const onShake = ev=>{
      if(!document.body.contains(cv)){ window.removeEventListener("devicemotion", onShake); return; }
      const a = ev.accelerationIncludingGravity; if(!a) return;
      const mag = Math.abs(a.x||0)+Math.abs(a.y||0)+Math.abs(a.z||0);
      const now = Date.now();
      if(mag > 34 && now-lastShake > 1200){ lastShake = now; reroll(); engine.celebrate(); }
    };
    window.addEventListener("devicemotion", onShake);

    // easter egg: tap the breathing orb 5x
    let taps=0, tapsT=0;
    document.getElementById("mrBreathWrap").addEventListener("pointerdown", ()=>{
      const now=Date.now(); if(now-tapsT>1500) taps=0; tapsT=now; taps++;
      if(taps>=5){ taps=0; engine.celebrate(); gift = "You found the quiet star. It's been here the whole time — just like your strength. — Coach Ahmed"; document.getElementById("mrGift").textContent = gift; }
    });

    // leave a star (private mood)
    document.getElementById("mrStar").onclick = ()=> openStar(reroll);
    document.getElementById("mrGame").onclick = ()=> renderGame();
    document.getElementById("mrGrat").onclick = ()=> openGratitude();
    const talk = document.getElementById("mrTalk");
    if(talk) talk.onclick = ()=> composeMessage();
    const jar = document.getElementById("mrJar");
    if(jar) jar.onclick = ()=> renderJar();
    const inbox = document.getElementById("mrInbox");
    if(inbox) inbox.onclick = ()=> renderInbox();

    // player → coach private message (in-app, straight to the coach's inbox)
    function composeMessage(){
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:absolute;inset:0;z-index:5;background:rgba(6,8,7,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;";
      wrap.innerHTML = `
        <div style="color:#fff;font-size:17px;">Tell ${esc(coachName.split(" ")[0])} anything.</div>
        <div style="color:#fff;opacity:.7;font-size:12px;margin-top:-4px;">It goes straight to your coach — no one else sees it.</div>
        <textarea id="mrMsg" rows="4" placeholder="What's on your mind?" style="width:100%;max-width:300px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);border-radius:12px;color:#fff;padding:11px;font-size:14px;resize:none;overflow:hidden;"></textarea>
        <div style="display:flex;gap:10px;">
          <button id="mrSend" style="background:var(--brand);color:#0b0e0c;border:none;border-radius:20px;padding:9px 18px;font-size:13px;font-weight:600;">Send</button>
          <button id="mrMsgClose" style="background:transparent;color:#fff;opacity:.75;border:1px solid rgba(255,255,255,.25);border-radius:20px;padding:9px 16px;font-size:13px;">close</button>
        </div>
        <div id="mrMsgOk" style="color:var(--brand);font-size:13px;min-height:16px;"></div>`;
      document.getElementById("mrRoom").appendChild(wrap);
      autoGrow(wrap.querySelector("#mrMsg"));
      wrap.querySelector("#mrMsgClose").onclick = ()=> wrap.remove();
      wrap.querySelector("#mrSend").onclick = async ()=>{
        const txt = wrap.querySelector("#mrMsg").value.trim();
        const ok = wrap.querySelector("#mrMsgOk");
        if(!txt){ ok.style.color="#ff8a8a"; ok.textContent="Write a little something first."; return; }
        ok.style.color="#fff"; ok.textContent="Sending…";
        try{
          await addMessage({ fromUid:state.uid, fromName:state.name, fromId:String(state.user.id), text:txt, ts:Date.now() });
          notify("mind", {});
          ok.style.color="var(--brand)"; ok.textContent="Sent. "+esc(coachName.split(" ")[0])+" will see it. You're not alone. ♥";
          engine.celebrate();
          setTimeout(()=> wrap.remove(), 1800);
        }catch(e){ ok.style.color="#ff8a8a"; ok.textContent="Couldn't send: "+(e.message||e); }
      };
    }

    function updateSky(){
      const el=document.getElementById("mrSky"); if(!el) return;
      el.textContent = stars.length ? "★ "+stars.length : "";
    }

    // small popover to leave a star
    function openStar(after){
      const wrap = document.createElement("div");
      wrap.style.cssText="position:absolute;inset:0;z-index:5;background:rgba(6,8,7,.78);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;";
      wrap.innerHTML = `
        <div style="color:#fff;font-size:17px;">How are you, really?</div>
        <div style="color:#fff;opacity:.7;font-size:12px;margin-top:-6px;">Only you will ever see this.</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
          ${MOODS.map(m=>`<button data-m="${m.key}" style="background:rgba(255,255,255,.06);border:1px solid ${m.col};color:#fff;border-radius:12px;padding:10px 14px;font-size:13px;">${m.label}</button>`).join("")}
        </div>
        <div id="mrSkyView" style="margin-top:6px;"></div>
        <button id="mrStarClose" style="margin-top:6px;background:transparent;color:#fff;opacity:.7;border:none;font-size:12px;">close</button>`;
      document.getElementById("mrRoom").appendChild(wrap);
      const renderSky = ()=>{
        const v=wrap.querySelector("#mrSkyView");
        v.innerHTML = stars.length
          ? `<div style="color:#fff;opacity:.7;font-size:12px;margin-bottom:6px;">your sky · ${stars.length} night${stars.length>1?"s":""}</div>
             <div style="display:flex;gap:5px;flex-wrap:wrap;max-width:240px;justify-content:center;">${stars.slice(-40).map(s=>{const m=MOODS.find(x=>x.key===s.mood)||MOODS[1];return `<span style="width:7px;height:7px;border-radius:50%;background:${m.col};opacity:.85;"></span>`;}).join("")}</div>`
          : `<div style="color:#fff;opacity:.5;font-size:12px;">your first star is waiting.</div>`;
      };
      renderSky();
      wrap.querySelectorAll("[data-m]").forEach(b=>b.onclick=async ()=>{
        const star = { mood:b.dataset.m, ts:Date.now() };
        stars = stars.concat([star]);
        renderSky(); updateSky(); engine.celebrate();
        try{ await savePrivate(state.uid, { stars }); }catch(e){ toast("Couldn't save your star — check your connection.","err"); }
        setTimeout(()=>{ wrap.remove(); }, 700);
      });
      wrap.querySelector("#mrStarClose").onclick = ()=> wrap.remove();
    }

    // gratitude jar (private)
    function openGratitude(){
      const wrap=document.createElement("div");
      wrap.style.cssText="position:absolute;inset:0;z-index:5;background:rgba(6,8,7,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;";
      wrap.innerHTML=`
        <div style="color:#fff;font-size:17px;">🫙 Gratitude jar</div>
        <div style="color:#fff;opacity:.7;font-size:12px;margin-top:-4px;">One small good thing. Only you ever see this.</div>
        <input id="mrGratIn" placeholder="Today I'm grateful for…" style="width:100%;max-width:300px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);border-radius:12px;color:#fff;padding:11px;font-size:14px;">
        <div style="display:flex;gap:10px;">
          <button id="mrGratAdd" style="background:var(--brand);color:#0b0e0c;border:none;border-radius:20px;padding:9px 18px;font-size:13px;font-weight:600;">Drop it in</button>
          <button id="mrGratClose" style="background:transparent;color:#fff;opacity:.75;border:1px solid rgba(255,255,255,.25);border-radius:20px;padding:9px 16px;font-size:13px;">close</button>
        </div>
        <div id="mrGratList" style="max-width:300px;width:100%;"></div>`;
      document.getElementById("mrRoom").appendChild(wrap);
      const renderList=()=>{ const el=wrap.querySelector("#mrGratList"); const items=(priv.gratitude||[]).slice(-6).reverse();
        el.innerHTML = items.length ? items.map(g=>`<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px 11px;margin-top:7px;color:#fff;font-size:13px;text-align:left;">${esc(g.text)}</div>`).join("") : `<div style="color:#fff;opacity:.5;font-size:12px;margin-top:8px;">Your jar is empty — drop the first one in.</div>`; };
      renderList();
      wrap.querySelector("#mrGratAdd").onclick=async ()=>{
        const t=wrap.querySelector("#mrGratIn").value.trim(); if(!t) return;
        priv.gratitude=(priv.gratitude||[]).concat([{ text:t, ts:Date.now() }]);
        wrap.querySelector("#mrGratIn").value=""; renderList(); engine.celebrate();
        try{ await savePrivate(state.uid, { gratitude:priv.gratitude }); }catch(e){ toast("Couldn't save — check your connection.","err"); }
      };
      wrap.querySelector("#mrGratClose").onclick=()=> wrap.remove();
    }
  }

  // ---------------- BUBBLE GAME ----------------
  function renderGame(){
    const Wd = Math.max(260, view.clientWidth || 340);
    const Hd = Math.max(460, Math.min(Math.round(window.innerHeight*0.70), 620));
    view.innerHTML = `
      <div style="position:relative;width:100%;height:${Hd}px;border-radius:22px;overflow:hidden;border:1px solid #20261f;background:#0a1014;">
        <canvas id="mrGcv" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none;"></canvas>
        <div style="position:absolute;top:14px;left:16px;right:16px;z-index:2;color:#fff;">
          <div style="font-size:15px;">Pop the bubbles. Slowly.</div>
          <div style="opacity:.7;font-size:12px;">Each one has a little word for you.</div>
        </div>
        <button id="mrGback" style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:2;background:var(--brand);color:#0b0e0c;border:none;border-radius:20px;padding:9px 18px;font-size:13px;font-weight:600;">I feel a bit better</button>
      </div>`;
    const cv=document.getElementById("mrGcv"), ctx=cv.getContext("2d");
    const dpr=Math.min(window.devicePixelRatio||1,2);
    cv.width=Wd*dpr; cv.height=Hd*dpr; ctx.scale(dpr,dpr);
    let bubbles=[], words=[];
    for(let i=0;i<10;i++) bubbles.push(newBubble(Wd,Hd));
    function newBubble(W,H){ return { x:R(30,W-30), y:H+R(0,H), r:R(16,30), vy:-R(.3,.8), hue:pick(["#a4dd2b","#5dd0b1","#86c8ff","#ffb6d2","#ffd9a0"]) }; }
    cv.addEventListener("pointerdown",e=>{
      const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
      for(let i=bubbles.length-1;i>=0;i--){ const b=bubbles[i]; if(Math.hypot(x-b.x,y-b.y)<b.r+6){ words.push({x:b.x,y:b.y,t:pick(BUBBLE_WORDS),life:60,col:b.hue}); bubbles.splice(i,1); bubbles.push(newBubble(Wd,Hd)); break; } }
    });
    function loop(){
      if(!document.body.contains(cv)) return;
      ctx.fillStyle="#0a1014"; ctx.fillRect(0,0,Wd,Hd);
      bubbles.forEach(b=>{ b.y+=b.vy; if(b.y<-40){ b.y=Hd+30; b.x=R(30,Wd-30); }
        ctx.globalAlpha=.18; ctx.fillStyle=b.hue; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,6.28); ctx.fill();
        ctx.globalAlpha=.9; ctx.strokeStyle=b.hue; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,6.28); ctx.stroke(); ctx.globalAlpha=1; });
      for(let i=words.length-1;i>=0;i--){ const w=words[i]; w.y-=.5; w.life--; ctx.globalAlpha=Math.max(0,w.life/60); ctx.fillStyle=w.col; ctx.font="500 15px sans-serif"; ctx.textAlign="center"; ctx.fillText(w.t,w.x,w.y); ctx.globalAlpha=1; if(w.life<=0) words.splice(i,1); }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    document.getElementById("mrGback").onclick = ()=> renderRoom();
  }

  // ---------------- COACH: gift jar editor ----------------
  function renderJar(){
    let list = coachGifts.slice();
    const draw = ()=>{
      view.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <button class="btn" id="jarBack" style="padding:7px 12px;font-size:12px;">← Back</button>
          <div class="disp" style="font-size:18px;">Your words for the team</div>
        </div>
        <div class="muted" style="font-size:13px;margin-bottom:14px;">These get mixed into the gifts your players open in the Mind Room, signed by you. Speak to them like only you can.</div>
        <div class="card" style="padding:16px;margin-bottom:14px;">
          <textarea id="jarText" rows="3" placeholder="e.g. I've seen you do the impossible in training. Tonight, just let it out." style="resize:none;overflow:hidden;margin-bottom:10px;"></textarea>
          <button class="btn pri" id="jarAdd">Add to the jar</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${list.length ? list.map((g,i)=>`<div style="display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:11px 13px;">
              <div style="flex:1;font-size:14px;line-height:1.5;">${esc(g)}</div>
              <button class="btn" data-jdel="${i}" style="padding:4px 9px;font-size:12px;color:var(--down);border-color:var(--down);">Remove</button>
            </div>`).join("") : `<div class="muted" style="font-size:13px;">The jar is empty — your players currently get the built-in encouragements. Add your own to make it personal.</div>`}
        </div>`;
      document.getElementById("jarBack").onclick = ()=> renderRoom();
      autoGrow(document.getElementById("jarText"));
      document.getElementById("jarAdd").onclick = async ()=>{
        const t=document.getElementById("jarText").value.trim(); if(!t) return;
        list = list.concat([t]); coachGifts = list;
        try{ await saveGiftJar(list); }catch(e){ toast("Couldn't save — check your connection.","err"); }
        draw();
      };
      view.querySelectorAll("[data-jdel]").forEach(b=>b.onclick=async ()=>{
        list = list.filter((_,i)=>i!==parseInt(b.dataset.jdel,10)); coachGifts = list;
        try{ await saveGiftJar(list); }catch(e){ toast("Couldn't save — check your connection.","err"); }
        draw();
      });
    };
    draw();
  }

  // ---------------- COACH: inbox of players' messages ----------------
  function renderInbox(){
    let un = null;
    view.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <button class="btn" id="ibBack" style="padding:7px 12px;font-size:12px;">← Back</button>
        <div class="disp" style="font-size:18px;">Messages from your players</div>
      </div>
      <div class="muted" style="font-size:13px;margin-bottom:14px;">Private notes players sent you from the Mind Room. If one feels heavy, reach out to them.</div>
      <div id="ibList"><div class="muted">Loading…</div></div>`;
    document.getElementById("ibBack").onclick = ()=>{ if(un){ try{ un(); }catch(e){} } renderRoom(); };
    un = listenMessages((items, err)=>{
      const el = document.getElementById("ibList"); if(!el) return;
      if(err){ el.innerHTML = `<div class="err">${esc(err.message)}</div>`; return; }
      const msgs = items || [];
      el.innerHTML = msgs.length ? msgs.map(m=>`
        <div class="card fade" style="padding:14px;margin-bottom:10px;">
          <div class="muted" style="font-size:12px;margin-bottom:5px;">${esc(m.fromName||"A player")} · ${esc(new Date(m.ts||Date.now()).toLocaleDateString(undefined,{month:"short",day:"numeric"}))}</div>
          <div style="font-size:14px;line-height:1.55;white-space:pre-wrap;">${esc(m.text)}</div>
        </div>`).join("") : `<div class="muted">No messages yet.</div>`;
    });
    state.unsub.push(()=>{ if(un){ try{ un(); }catch(e){} } });
  }

  function pickDifferent(cur){ let k; do{ k=pick(SCENE_KEYS); }while(SCENES[k]===SCENES[cur] && SCENE_KEYS.length>1); return k; }
}

// ---------------- canvas scene engine ----------------
function mountScene(cv, W, H, key){
  const ctx = cv.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  cv.width = W*dpr; cv.height = H*dpr; ctx.scale(dpr,dpr);
  let scene = SCENES[key], parts=[], sparks=[], t=0, shoot=null, shootT=R(120,300);

  function spawn(){
    parts=[]; const k=scene.kind;
    const n = k==="lantern"?9 : k==="petal"?26 : k==="fire"?24 : k==="rain"?60 : 70;
    for(let i=0;i<n;i++){
      if(k==="stars") parts.push({x:R(0,W),y:R(0,H*.6),r:R(.6,1.7),tw:R(0,6.28),sp:R(1,2.5)});
      else if(k==="fire") parts.push({x:R(0,W),y:R(60,H),vx:R(-.2,.2),vy:R(-.25,-.05),ph:R(0,6.28),r:R(1.2,2.4)});
      else if(k==="lantern") parts.push({x:R(20,W-20),y:R(0,H*1.2),vy:R(-.5,-.22),sw:R(0,6.28),r:R(6,11)});
      else if(k==="rain") parts.push({x:R(0,W),y:R(0,H),len:R(8,18),vy:R(7,12)});
      else parts.push({x:R(0,W),y:R(-40,H),vy:R(.35,.9),vx:R(-.3,.3),rot:R(0,6.28),r:R(4,8)});
    }
  }
  function setScene(k){ scene=SCENES[k]; key=k; spawn(); }
  setScene(key);

  function glow(x,y,r,col,a){ const g=ctx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,col); g.addColorStop(1,"rgba(0,0,0,0)"); ctx.globalAlpha=a; ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,6.28); ctx.fill(); ctx.globalAlpha=1; }

  function frame(){
    if(!document.body.contains(cv)) return;
    t++;
    const sg=ctx.createLinearGradient(0,0,0,H); sg.addColorStop(0,scene.sky[0]); sg.addColorStop(1,scene.sky[1]);
    ctx.fillStyle=sg; ctx.fillRect(0,0,W,H);
    const k=scene.kind;
    if(k==="lantern") glow(W*.78,H*.18,140,"rgba(255,180,110,.10)",1);
    if(k==="stars"){ ctx.fillStyle="rgba(230,240,255,.92)"; ctx.beginPath(); ctx.arc(W-58,92,19,0,6.28); ctx.fill(); ctx.fillStyle=scene.sky[0]; ctx.beginPath(); ctx.arc(W-66,86,17,0,6.28); ctx.fill(); }

    parts.forEach(p=>{
      if(k==="stars"){ const a=.4+.6*Math.abs(Math.sin(t*.03*p.sp+p.tw)); ctx.globalAlpha=a; ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.28); ctx.fill(); ctx.globalAlpha=1; }
      else if(k==="fire"){ p.x+=p.vx; p.y+=p.vy; if(p.y<-5){p.y=H+5;p.x=R(0,W);} const fl=.35+.65*Math.abs(Math.sin(t*.05+p.ph)); glow(p.x,p.y,9,"rgba(190,245,120,"+(.5*fl)+")",1); ctx.globalAlpha=fl; ctx.fillStyle="#e8ffa8"; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.28); ctx.fill(); ctx.globalAlpha=1; }
      else if(k==="lantern"){ p.y+=p.vy; p.x+=Math.sin(t*.02+p.sw)*.25; if(p.y<-20){p.y=H+20;p.x=R(20,W-20);} glow(p.x,p.y,p.r*3,"rgba(255,170,90,.5)",1); ctx.fillStyle="#ffd9a0"; ctx.beginPath(); ctx.ellipse(p.x,p.y,p.r*.7,p.r,0,0,6.28); ctx.fill(); }
      else if(k==="rain"){ p.y+=p.vy; if(p.y>H){p.y=-p.len;p.x=R(0,W);} ctx.strokeStyle="rgba(150,200,255,.4)"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x,p.y+p.len); ctx.stroke(); }
      else { p.y+=p.vy; p.x+=p.vx+Math.sin(t*.03+p.rot)*.3; p.rot+=.02; if(p.y>H+10){p.y=-10;p.x=R(0,W);} ctx.globalAlpha=.85; ctx.fillStyle=scene.accent; ctx.beginPath(); ctx.ellipse(p.x,p.y,p.r,p.r*.5,p.rot,0,6.28); ctx.fill(); ctx.globalAlpha=1; }
    });

    if(k==="stars"){ if(shoot){ shoot.x+=shoot.vx; shoot.y+=shoot.vy; shoot.life--; ctx.strokeStyle="rgba(255,255,255,"+(shoot.life/40)+")"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(shoot.x,shoot.y); ctx.lineTo(shoot.x-shoot.vx*8,shoot.y-shoot.vy*8); ctx.stroke(); if(shoot.life<=0)shoot=null; } else if(--shootT<0){ shoot={x:R(0,W),y:R(0,120),vx:R(2,4),vy:R(1,2),life:40}; shootT=R(160,360); } }

    // breathing orb
    const br=.5+.5*Math.sin(t*.012), rad=38+br*26, cx=W/2, cy=H*0.45;
    glow(cx,cy,rad+50,scene.accent,.16+br*.12);
    ctx.globalAlpha=.5+br*.4; ctx.strokeStyle=scene.accent; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,cy,rad,0,6.28); ctx.stroke(); ctx.globalAlpha=1;
    const bt=document.getElementById("mrBreath"); if(bt) bt.textContent = Math.sin(t*.012)>0 ? "breathe in" : "breathe out";

    for(let i=sparks.length-1;i>=0;i--){ const s=sparks[i]; s.x+=s.vx; s.y+=s.vy; s.vy+=.02; s.life--; ctx.globalAlpha=Math.max(0,s.life/s.max); ctx.fillStyle=s.c; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.28); ctx.fill(); ctx.globalAlpha=1; if(s.life<=0)sparks.splice(i,1); }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function burst(x,y){ const cols=["#fff",scene.accent,"#ffe9a8"]; for(let i=0;i<16;i++){ const a=R(0,6.28),sp=R(.6,2.6); sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-.6,r:R(1,2.6),life:R(30,60),max:60,c:pick(cols)}); } }

  return {
    get key(){ return key; },
    burst,
    reroll(k){ setScene(k); },
    celebrate(){ for(let j=0;j<5;j++) burst(R(W*.2,W*.8), R(H*.25,H*.6)); }
  };
}
