(()=>{"use strict";
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;
let mx=-999,my=-999;

/* name: letters swell toward the cursor */
const name=$("#name");name.innerHTML=[..."aby mathew"].map(c=>c===" "?"<br>":`<span>${c}</span>`).join("");
const L=$$("#name span");
let letterCenters = [];
function cacheLetters(){
  const sy = window.scrollY;
  letterCenters = L.map(s => {
    const r = s.getBoundingClientRect();
    return { el: s, cx: r.left + r.width / 2, cy: r.top + sy + r.height / 2 };
  });
}
document.fonts.ready.then(()=>{
  L.forEach(s=>{s.style.fontVariationSettings='"wght" 800';s.style.width=s.getBoundingClientRect().width+"px";s.style.fontVariationSettings='"wght" 300'});
  cacheLetters();
  requestFrame();
});

/* dot grid */
const cv=$("#bg"),g=cv.getContext("2d");let W,H,D;
const size=()=>{D=Math.min(devicePixelRatio||1,2);W=cv.width=innerWidth*D;H=cv.height=innerHeight*D};size();
addEventListener("resize",()=>{size();cacheLetters();requestFrame()},{passive:true});

let animPending = false;
function requestFrame(){
  if(!animPending && !reduce){
    animPending = true;
    requestAnimationFrame(render);
  }
}

function render(){
  animPending = false;
  g.clearRect(0,0,W,H);
  const gap = 34 * D;
  const radius = 1 * D;
  const twoPi = 6.2831853;
  const hoverDist = 230;

  g.fillStyle = "rgba(255,255,255,.09)";
  g.beginPath();
  const startX = ((W % gap) / 2) || (gap / 2);
  const startY = ((H % gap) / 2) || (gap / 2);
  const active = [];

  for(let y = startY; y < H; y += gap){
    for(let x = startX; x < W; x += gap){
      const dist = Math.hypot(x / D - mx, y / D - my);
      if(dist < hoverDist){
        active.push({ x, y, k: 1 - dist / hoverDist });
      } else {
        g.moveTo(x + radius, y);
        g.arc(x, y, radius, 0, twoPi);
      }
    }
  }
  g.fill();

  for(let i = 0; i < active.length; i++){
    const dot = active[i];
    g.fillStyle = `rgba(212,116,85,${.2 + .8 * dot.k})`;
    g.beginPath();
    g.arc(dot.x, dot.y, (1 + 2.4 * dot.k) * D, 0, twoPi);
    g.fill();
  }

  const sy = window.scrollY;
  if(sy < innerHeight && letterCenters.length){
    for(let i = 0; i < letterCenters.length; i++){
      const item = letterCenters[i];
      const d = Math.hypot(mx - item.cx, my - (item.cy - sy));
      const k = Math.max(0, 1 - d / 300);
      item.el.style.fontVariationSettings = `"wght" ${300 + 500 * k | 0}`;
      item.el.style.color = k > .55 ? "var(--accent)" : "";
    }
  }
}

addEventListener("pointermove",e=>{mx=e.clientX;my=e.clientY;requestFrame()},{passive:true});
addEventListener("scroll",()=>{if(window.scrollY<innerHeight)requestFrame()},{passive:true});
requestFrame();

/* last push */
const recentEl = $("#recentPush");
if (recentEl) {
  fetch("https://worker-round-credit-5733.abyperhaps.workers.dev").then(r=>r.ok?r.json():Promise.reject()).then(d=>{
    const m=(Date.now()-new Date(d.at))/6e4,t=m<60?`${m|0}m`:m<1440?`${m/60|0}h`:`${m/1440|0}d`;
    recentEl.textContent=`shipped ${t} ago${d.name?" · 4ofl/"+d.name:""}`}).catch(()=>{recentEl.textContent="active on github · 4ofl"});
}

/* accordion */
$$(".rh").forEach(b=>b.onclick=()=>{const row=b.parentElement,o=!row.classList.contains("open");
  row.classList.toggle("open",o);b.setAttribute("aria-expanded",o);$(".pi",row).toggleAttribute("inert",!o)});

/* citecamp */
const CC=[["attendance for exams?",[["You need at least 75% attendance in every course to sit the end-semester exam.",1],["Up to 10% shortfall can be condoned with a valid medical certificate.",2]],["academic regulations · clause 4.2","syndicate condonation circular #112"]],
["get an official transcript?",[["Submit the transcript request form to the Controller of Examinations office with your student ID.",1],["Sealed copies dispatch within 5 working days.",2]],["examination manual · section 9.1","student service charter v2"]],
["re-evaluate a paper?",[["Re-evaluation requests open for 10 days after results.",1],["If marks rise by 10% or more, the fee is refunded.",2]],["ordinance 14.3 · revaluation window","fee schedule · clause 14.8"]]];
const chat=$("#ccChat");
$$("#ccChips button").forEach((b,i)=>b.onclick=()=>{chat.innerHTML="";
  const u=document.createElement("p");u.className="u";u.textContent=CC[i][0];chat.append(u);
  const a=document.createElement("div");a.innerHTML='<small>retrieving…</small>';chat.append(a);
  setTimeout(()=>{a.innerHTML=CC[i][1].map(([t,n])=>`${t}<sup>${n}</sup>`).join(" ")+"<small>"+CC[i][2].map((s,j)=>`[${j+1}] ${s}`).join("<br>")+"</small>"},650)});

/* johns fitness */
let on=true,q=0;const net=$("#net"),log=$("#jlog"),res=$("#jres");
const add=t=>{const li=document.createElement("li");li.textContent=t;log.prepend(li);while(log.children.length>4)log.lastChild.remove()};
net.onclick=()=>{on=!on;net.setAttribute("aria-pressed",on);net.textContent=on?"network online":"network offline";
  if(on&&q){add(`synced ${q} scan${q>1?"s":""} to cloud`);q=0;$("#q").textContent=0}};
$("#fp").onclick=()=>{res.textContent="verified · door open · 12 ms";add(on?"scan → local → cloud":"scan → local (queued)");if(!on){q++;$("#q").textContent=q}};

/* june */
const jt=$("#jt"),ji=$("#ji");
const out=(t,c)=>{const d=document.createElement("div");d.textContent=t;if(c)d.className="c";jt.append(d);jt.scrollTop=1e9};
function run(c){out("> "+c,1);const m=c.match(/^\/remind (\d+)s (.+)/);
  if(m){out(`reminder set for ${m[1]}s`);setTimeout(()=>out("⏰ "+m[2],1),m[1]*1e3)}
  else if(c==="/ping")out(`pong · gateway ${20+Math.random()*30|0}ms`);
  else if(c==="/status")out("shard 0/1 · heartbeat ok · uptime 41d 6h");
  else if(c==="/help")out("/ping  /status  /remind <n>s <text>");
  else out("unknown command. try /help")}
ji.onkeydown=e=>{if(e.key==="Enter"&&ji.value.trim()){run(ji.value.trim());ji.value=""}};

/* email + clock */
$("#mail").onclick=async function(){try{await navigator.clipboard.writeText("aby@4ofl.dev");this.textContent="copied"}catch{location.href="mailto:aby@4ofl.dev"}setTimeout(()=>this.textContent="aby@4ofl.dev",1600)};
const f=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Kolkata"});
const tick=()=>$("#clock").textContent="kerala · "+f.format(new Date())+" IST";tick();setInterval(tick,2e4);

/* command palette */
const pal=$("#pal"),pin=$("#pin"),pl=$("#plist");
const CMD=[["work","#work"],["about","#about"],["contact","#contact"],["citecamp","https://citecamp.4ofl.dev"],["june docs","https://docs.june.4ofl.dev"],["github","https://github.com/4ofl"],["linkedin","https://linkedin.com/in/abyperhaps"],["discord","https://discord.com/users/1310480351008657420"],["copy email",()=>$("#mail").click()]];
let sel=0,list=CMD;
function paint(){pl.innerHTML="";list.forEach(([n,t],i)=>{const li=document.createElement("li");li.className=i===sel?"on":"";
  li.innerHTML=`${n}<span>${typeof t==="string"?(t[0]==="#"?"jump":"open ↗"):"action"}</span>`;li.onclick=()=>go(i);pl.append(li)})}
function go(i){const t=list[i]?.[1];if(!t)return;shut();typeof t==="function"?t():t[0]==="#"?(location.hash=t):open(t,"_blank","noopener")}
function openP(){pal.hidden=false;pin.value="";list=CMD;sel=0;paint();pin.focus()}
function shut(){pal.hidden=true}
$("#kBtn").onclick=openP;pal.onclick=e=>{if(e.target===pal)shut()};
pin.oninput=()=>{const v=pin.value.toLowerCase();list=CMD.filter(c=>c[0].includes(v));sel=0;paint()};
addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();pal.hidden?openP():shut();return}
  if(pal.hidden)return;
  if(e.key==="Escape")shut();
  else if(e.key==="ArrowDown"){e.preventDefault();sel=(sel+1)%list.length;paint()}
  else if(e.key==="ArrowUp"){e.preventDefault();sel=(sel-1+list.length)%list.length;paint()}
  else if(e.key==="Enter")go(sel)});
})();
