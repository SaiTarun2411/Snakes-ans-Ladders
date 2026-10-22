/* Streamlit component bridge, responsive UI, animation and synthesised sound. */
(() => {
'use strict';
const root = document.getElementById('app');
const COLORS = ['#35b9ee','#ff7388','#9bd465','#ffd06a'];
const NAMES = ['Sky','Rose','Fern','Sun'];
const PIPS = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
let receivedAt=Date.now();
const serverNow=()=>data?data.now+(Date.now()-receivedAt)/1000:0;
let data = null, game = null, view = 'home', count = 2, friendTab = 'create';
let pendingNonce = null;
let pending = false, pendingAt = 0, busy = false, gameId = null, seen = 0;
let renderedSignature = '', queue = [], positions = [], displayedDice = [], animPlayer = null;
let computerTimer = null, lastError = '', helpOpen = false, displayName = '', joinCode = '';
let soundEnabled = localStorage.getItem('clubhouse-sound') !== 'off', audio = null, generation = 0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function bridge(type, extra={}) { window.parent.postMessage({isStreamlitMessage:true,type,...extra},'*'); }
function resize() { bridge('streamlit:setFrameHeight',{height:Math.ceil(document.body.scrollHeight)+2}); }
new ResizeObserver(resize).observe(root);
function send(action, extra={}) {
  if (pending) return;
  clearTimeout(computerTimer); computerTimer = null;
  pending = true; pendingAt = Date.now();
  const nonce = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  pendingNonce=nonce;
  bridge('streamlit:setComponentValue',{value:{action,nonce,...extra},dataType:'json'});
  refreshButtons();
}
function unlockAudio() {
  try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state==='suspended') audio.resume(); } catch (_) {}
}
function tone(frequency,duration=.08,type='sine',delay=0,volume=.065,end=null) {
  if (!soundEnabled || !audio || audio.state !== 'running') return;
  const t=audio.currentTime+delay, osc=audio.createOscillator(), gain=audio.createGain();
  osc.type=type; osc.frequency.setValueAtTime(frequency,t);
  if(end) osc.frequency.exponentialRampToValueAtTime(end,t+duration);
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(.001,t+duration);
  osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+duration+.02);
}
function sound(kind) {
  if(kind==='roll') for(let i=0;i<8;i++) tone(180+Math.random()*350,.045,'triangle',i*.075,.045);
  if(kind==='step') tone(390,.075,'sine',0,.07,520);
  if(kind==='ladder') [440,554,659,880,1108].forEach((n,i)=>tone(n,.15,'triangle',i*.13,.065));
  if(kind==='snake') {
    tone(520,.6,'sawtooth',0,.035,90);
    if(soundEnabled && audio && audio.state==='running') {
      const length=Math.floor(audio.sampleRate*.65), buffer=audio.createBuffer(1,length,audio.sampleRate);
      const samples=buffer.getChannelData(0);for(let i=0;i<length;i++)samples[i]=(Math.random()*2-1)*(1-i/length);
      const source=audio.createBufferSource(), filter=audio.createBiquadFilter(),gain=audio.createGain();
      source.buffer=buffer;filter.type='highpass';filter.frequency.value=4500;gain.gain.value=.07;
      source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start();
    }
  }
  if(kind==='win') [523,659,784,1047].forEach((n,i)=>tone(n,.3,'triangle',i*.16,.065));
}
function pin(color) {
  return `<svg viewBox="0 0 32 44" aria-hidden="true"><path d="M16 42C12 35 2 23 2 16a14 14 0 1 1 28 0c0 7-10 19-14 26Z" fill="${color}" stroke="white" stroke-width="2"/><ellipse cx="16" cy="15" rx="8" ry="8" fill="#fff"/><path d="M6 13a10 10 0 0 1 12-9" fill="none" stroke="#fff8" stroke-width="2" stroke-linecap="round"/></svg>`;
}
function dice(value=1) {return `<span class="die-grid" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i class="pip ${PIPS[value]?.includes(i)?'':'empty'}"></i>`).join('')}</span>`;}
function header() {return `<header><div class="brand"><span class="brand-mark">⚄</span><span>SNAKES &amp; LADDERS<small>THE LITTLE BOARD GAME CLUB</small></span></div><div class="tools"><button class="quiet" id="sound" aria-label="${soundEnabled?'Mute':'Enable'} sound">${soundEnabled?'♫ Sound on':'♫ Sound off'}</button><button class="quiet" id="help" aria-label="How to play">?</button></div></header>`;}
function art() {return `<div class="hero-art" aria-hidden="true"><div class="mini-board">${data.board}</div><div class="art-label">100 squares. Endless surprises.</div><div class="floating-die">${dice(5)}</div></div>`;}
function footer() {return `<footer class="footer"><span>MADE FOR GOOD COMPANY.</span><span>NO DOWNLOADS. JUST ONE MORE GAME.</span></footer>`;}
function shell(html) {
  helpOpen=false;
  root.innerHTML=`<div class="shell"><div class="content">${header()}${data.error?`<div class="error" role="alert">${esc(data.error)}</div>`:''}${html}${footer()}</div></div>`;
  document.getElementById('sound').onclick=()=>{unlockAudio();soundEnabled=!soundEnabled;localStorage.setItem('clubhouse-sound',soundEnabled?'on':'off');document.getElementById('sound').textContent=soundEnabled?'♫ Sound on':'♫ Sound off';document.getElementById('sound').setAttribute('aria-label',soundEnabled?'Mute sound':'Enable sound');const note=document.getElementById('audio-note');if(note)note.textContent=soundEnabled?'♫ Sound is on. Tap a dice to hear the game.':'♫ Sound is off. Turn it on at the top.';};
  document.getElementById('help').onclick=showHelp;
  resize();
}
function home() {
  shell(`<section class="hero"><div><span class="pill"><i></i> YOUR NEXT FAVOURITE GAME NIGHT</span><h1>A little luck.<br>A big <span>adventure.</span></h1><p>Climb a little higher. Dodge a slippery surprise. Bring your favourite people along for the ride.</p></div>${art()}</section><div class="section-heading"><h2>How are we playing?</h2><span>Pick your kind of company</span></div><section class="mode-grid"><button class="mode-card" data-mode="friends" style="--accent:var(--mint)"><span class="icon">♧</span><span class="arrow">↗</span><h3>Play with friends</h3><p>A private room. Your favourite people.<br>Join from different devices.</p></button><button class="mode-card" data-mode="computer" style="--accent:var(--purple)"><span class="icon">⚙</span><span class="arrow">↗</span><h3>Play with computer</h3><p>A worthy little rival.<br>You versus up to three computers.</p></button><button class="mode-card" data-mode="local" style="--accent:var(--coral)"><span class="icon">⚄</span><span class="arrow">↗</span><h3>Play local</h3><p>Pass the screen. Share the fun.<br>One device, one to four players.</p></button></section>`);
  root.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{unlockAudio();view=button.dataset.mode;count=2;setup();});
}
function countButtons(values) {return `<div class="count-options">${values.map(i=>`<button data-count="${i}" class="${count===i?'selected':''}" aria-pressed="${count===i}">${view==='computer'?`${i-1} CPU`:`${i}P`}</button>`).join('')}</div>`;}
function setup() {
  const friends=view==='friends', local=view==='local';
  const title=friends?'Good games. Great company.':local?'Same screen.<br>Different rivals.':'Meet your new rivals.';
  const sub=friends?'Create a private room and share the code. Everyone joins from their own device.':local?'Gather around, choose your crew, and pass the device when it’s the next player’s turn.':'You take the first turn. The computers roll and move automatically. Let luck decide the rest.';
  shell(`<section class="setup"><div><span class="eyebrow">${friends?'ACROSS THE MILES':local?'THE SOFA CLUB':'A LITTLE FRIENDLY COMPETITION'}</span><h1>${title}</h1><p>${sub}</p><button class="back" id="back">← Back to the clubhouse</button></div><div class="setup-panel"><span class="eyebrow">${friends?'PRIVATE TABLE':local?'PASS & PLAY':'YOU VS COMPUTER'}</span>${friends?`<div class="tabs"><button data-tab="create" class="${friendTab==='create'?'selected':''}">Create room</button><button data-tab="join" class="${friendTab==='join'?'selected':''}">Join room</button></div><label for="name">Your name</label><input id="name" class="field" maxlength="24" placeholder="Your game-night name" value="${esc(displayName)}">`:''}${!friends||friendTab==='create'?`<label>${view==='computer'?'Computer opponents':'Number of players'}</label>${countButtons(local?[1,2,3,4]:[2,3,4])}`:`<label for="room-input">Room code</label><input id="room-input" class="field" maxlength="6" autocomplete="off" placeholder="ABC123" value="${esc(joinCode)}" style="text-transform:uppercase;letter-spacing:.2em">`}<button class="primary wide" id="start">${friends?(friendTab==='create'?'Create a room ↗':'Join the table ↗'):'Let’s play →'}</button><p class="sound-hint">${friends?'Rooms expire after six hours without activity. Keep your game tab open; a server restart ends the room.':local&&count===1?'Solo practice: take your time and climb to 100.':'Land exactly on 100 to win. A six passes the turn, too.'}</p></div></section>`);
  document.getElementById('back').onclick=()=>{view='home';home();};
  root.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{count=Number(b.dataset.count);setup();});
  root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{friendTab=b.dataset.tab;count=2;setup();});
  const name=document.getElementById('name'),code=document.getElementById('room-input');
  if(name) name.oninput=()=>displayName=name.value;
  if(code) code.oninput=()=>joinCode=code.value.toUpperCase();
  document.getElementById('start').onclick=()=>{unlockAudio();send(friends?friendTab==='create'?'create':'join':'new',{mode:view,count,name:displayName||'Player',code:joinCode.trim()});};
  if(code) code.onkeydown=e=>{if(e.key==='Enter')document.getElementById('start').click();};
  refreshButtons();
}
function lobby() {
  const host=data.seat===0, full=game.players.length===data.capacity;
  shell(`<section class="setup"><div><span class="eyebrow">A SEAT FOR EVERY FRIEND</span><h1>Your table is ready.</h1><p>Share this code with your friends. They can open game.aiinc.uk, choose Play with friends, and join your room.</p><div class="room-code">${esc(data.room)}</div><button class="quiet" id="copy">Copy room code</button><div class="toast" id="copy-status"></div><button class="back" id="leave">← Leave room</button></div><div class="setup-panel"><div class="section-heading"><h2>The guest list</h2><span>${game.players.length} / ${data.capacity}</span></div><div class="lobby-list">${Array.from({length:data.capacity},(_,i)=>`<div class="lobby-player">${pin(COLORS[i])}<b>${game.players[i]?esc(game.players[i].name):'Waiting for a friend…'}</b><span>${i===0?'HOST':game.players[i]?'READY':'OPEN'}</span></div>`).join('')}</div><button class="primary wide" id="begin" ${!host||!full?'disabled':''}>${host?full?'Everyone’s here. Let’s play →':'Waiting for your friends…':'The host will start the game'}</button><p class="sound-hint">${data.error?'':`You’re ${esc(game.players[data.seat]?.name)}. Each player rolls only on their own turn.`}</p></div></section>`);
  document.getElementById('begin').onclick=()=>{unlockAudio();send('start');};
  document.getElementById('leave').onclick=()=>send('home');
  document.getElementById('copy').onclick=async()=>{try{await navigator.clipboard.writeText(data.room);document.getElementById('copy-status').textContent='Copied. Send it to your crew!';}catch(_){document.getElementById('copy-status').textContent=`Room code: ${data.room}`;}};
}
function canRoll(index) {return game && game.winner===null && index===game.turn && serverNow()>=game.ready_at && !busy && !pending && game.players[index].kind!=='computer' && (data.seat===null || data.seat===index);}
function playerCard(index) {
  if(!game.players[index])return `<div class="empty-seat">${game.players.length===1?'A solo adventure':'Enjoy the climb'}</div>`;
  const p=game.players[index], active=game.winner===null&&(busy?index===animPlayer:index===game.turn);
  const value=displayedDice[index]||1;
  return `<article class="player-card ${active?'active':''}" style="--player:${COLORS[index]}" data-player="${index}"><span class="player-pin">${pin(COLORS[index])}</span><div><div class="player-name">${esc(p.name)}${data.seat===index?' · You':''}</div><div class="player-meta" id="position-${index}">${positions[index]===0?'At the start':`Square ${positions[index]}`}</div><div class="turn-indicator" id="turn-${index}">${active?busy?'On the move':p.kind==='computer'?'Thinking…':data.seat!==null&&data.seat!==index?'Their turn':'Your turn':'&nbsp;'}</div></div><button class="dice-button ${active?'active':''}" id="dice-${index}" data-roll="${index}" aria-label="Roll dice for ${esc(p.name)}" ${canRoll(index)?'':'disabled'}>${dice(value)}${active?'<span class="roll-label">'+(p.kind==='computer'?'CPU':'ROLL')+'</span>':''}</button></article>`;
}
function gamePage() {
  const mode=game.mode==='friends'?`ROOM ${esc(data.room)}`:game.mode==='computer'?'VS COMPUTER':game.players.length===1?'SOLO PRACTICE':`${game.players.length} PLAYER LOCAL`;
  const top=game.players.length>=3?[1,2]:[1,3];
  shell(`<div class="game-topline"><h1>Let the good times roll.</h1><span class="pill"><i></i>${mode}</span></div><section class="game-layout"><div class="arena"><div class="players-row">${top.map(playerCard).join('')}</div><div class="board-wrap"><div class="art">${data.board}</div><div class="tokens" id="tokens">${game.players.map((p,i)=>`<div class="token" id="token-${i}" role="img" aria-label="${esc(p.name)}, ${NAMES[i]} token">${pin(COLORS[i])}</div>`).join('')}</div><div class="start-dock">START LINE</div><div id="winner-slot"></div></div><div class="players-row">${[0,3].map(playerCard).join('')}</div></div><aside class="game-aside"><div class="aside-heading"><span class="eyebrow">THE ADVENTURE LOG</span><h2 id="turn-heading">${game.winner!==null?'A winner’s circle':esc(game.players[game.turn].name)+'’s turn'}</h2></div><div class="status" id="status">${esc(game.message)}</div><div><div class="rule"><span>Finish line</span><b>Exactly 100</b></div><div class="rule"><span>A roll of six</span><b>Pass the turn</b></div><div class="rule"><span>Golden ladders</span><b>Up you go ↗</b></div><div class="rule"><span>Colourful snakes</span><b>Down you slide ↘</b></div></div><div><hr><p>${game.mode==='friends'?'Your friends’ moves appear here automatically.':game.mode==='computer'?'Computers take their turns automatically.':'Pass the device when the next player’s dice lights up.'}</p><div class="history" id="history"></div><button class="quiet" id="exit">← Back to home</button>${game.mode!=='friends'?'<button class="quiet" id="reset">↻ New game</button>':''}</div><p class="sound-hint" id="audio-note">♫ ${soundEnabled?'Sound is on. Tap a dice to hear the game.':'Sound is off. Turn it on at the top.'}</p></aside></section>`);
  root.querySelectorAll('[data-roll]').forEach(b=>b.onclick=()=>{unlockAudio();if(canRoll(Number(b.dataset.roll)))send('roll',{version:game.version,computer:false});});
  document.getElementById('exit').onclick=()=>{if(!busy)send('home');};
  const reset=document.getElementById('reset');if(reset)reset.onclick=()=>{if(!busy)send('restart');};
  positions.forEach((p,i)=>placeToken(i,p,false));
  updateHistory();showWinner();refreshButtons();
}
function coords(square,index) {
  if(square===0)return {x:18+index*6,y:104.2};
  const row=Math.floor((square-1)/10),c=(square-1)%10,col=row%2?9-c:c;
  const offsets=[[-1.8,1.1],[1.8,1.1],[-1.8,4],[1.8,4]];
  return {x:col*10+5+offsets[index][0],y:(9-row)*10+4+offsets[index][1]};
}
function placeToken(index,square,transition=true) {
  const token=document.getElementById(`token-${index}`);if(!token)return;
  const c=coords(square,index);if(!transition)token.style.transition='none';else token.style.transition='';
  token.style.left=c.x+'%';token.style.top=c.y+'%';
  const label=document.getElementById(`position-${index}`);if(label)label.textContent=square===0?'At the start':`Square ${square}`;
}
function refreshButtons() {
  if(!game){const start=document.getElementById('start');if(start){start.disabled=pending;if(pending)start.textContent='Setting the table…';}return;}
  root.querySelectorAll('[data-roll]').forEach(b=>{const i=Number(b.dataset.roll);b.disabled=!canRoll(i);});
  ['reset','exit'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=busy||pending;});
}
function updateHistory() {
 const element=document.getElementById('history');if(!element)return;
 element.innerHTML=game.events.slice(-4).reverse().map(e=>`<div>${esc(game.players[e.player].name)} · rolled ${e.roll}<br>${e.origin} → ${e.destination}${e.special==='ladder'?' · A lovely ladder!':e.special==='snake'?' · A slippery snake!':''}</div>`).join('');
}
function showWinner() {
 const slot=document.getElementById('winner-slot');if(!slot||game.winner===null||busy)return;
 const host=data.seat===null||data.seat===0;
 slot.innerHTML=`<div class="winner"><div>${Array.from({length:22},(_,i)=>`<i class="confetti" style="--x:${(i*19)%100}%;--c:${COLORS[i%4]};--d:${2+i%3}s;--delay:-${i*.17}s"></i>`).join('')}<div class="trophy">♛</div><span class="eyebrow">THE TOP OF THE WORLD</span><h2>${esc(game.players[game.winner].name)} wins!</h2><p>One hundred squares. One brilliant finish.</p><button class="primary wide" id="rematch" ${host?'':'disabled'}>${host?'One more adventure →':'Waiting for the host’s rematch'}</button></div></div>`;
 document.getElementById('rematch').onclick=()=>send('restart');
}
async function animate(event) {
 const currentGeneration=generation;busy=true;animPlayer=event.player;
 const index=event.player;
 const status=document.getElementById('status');if(status)status.textContent=`${game.players[index].name} is rolling…`;
 // Update cards without rebuilding the board or interrupting token transitions.
 root.querySelectorAll('.player-card').forEach(card=>{
  const i=Number(card.dataset.player);card.classList.toggle('active',i===index);
  const b=document.getElementById(`dice-${i}`);if(b)b.classList.toggle('active',i===index);
  const indicator=document.getElementById(`turn-${i}`);if(indicator)indicator.textContent=i===index?'On the move':'';
 });
 refreshButtons();sound('roll');
 const button=document.getElementById(`dice-${index}`);button?.classList.add('rolling');
 for(let i=0;i<8;i++){if(button)button.innerHTML=dice(1+Math.floor(Math.random()*6));await sleep(reduced?35:80);if(currentGeneration!==generation)return;}
 button?.classList.remove('rolling');if(button)button.innerHTML=dice(event.roll);displayedDice[index]=event.roll;
 const token=document.getElementById(`token-${index}`);token?.classList.add('moving');
 if(status)status.textContent=event.walk.length?`${game.players[index].name} rolled ${event.roll}. Here we go…`:'An exact roll is needed. Staying put this turn.';
 for(const square of event.walk){positions[index]=square;placeToken(index,square);sound('step');await sleep(170);if(currentGeneration!==generation)return;}
 token?.classList.remove('moving');
 if(event.special){
  if(status)status.textContent=event.special==='ladder'?`A ladder! Climbing ${event.landing} → ${event.destination}.`:`A snake! Sliding ${event.landing} → ${event.destination}.`;
  sound(event.special);token?.classList.add('jump');positions[index]=event.destination;placeToken(index,event.destination);await sleep(1050);token?.classList.remove('jump');
 }
 await sleep(Math.max(220,(game.ready_at-serverNow())*1000+30));if(currentGeneration!==generation)return;
 positions[index]=event.destination;seen=event.id;busy=false;animPlayer=null;
 if(!queue.length){positions=game.players.map(p=>p.position);gamePage();if(game.winner!==null)sound('win');scheduleComputer();}
}
function scheduleComputer() {
 clearTimeout(computerTimer);computerTimer=null;
 if(!game||busy||pending||queue.length||game.winner!==null||game.status!=='playing'||game.mode!=='computer')return;
 if(game.players[game.turn].kind!=='computer')return;
 const expected=game.version;
 const remaining=Math.max(0,(game.ready_at-serverNow())*1000);
 computerTimer=setTimeout(()=>{if(game&&game.version===expected&&!busy&&!pending)send('roll',{version:expected,computer:true});},Math.max(650,remaining+200));
}
function showHelp() {
 if(helpOpen)return;helpOpen=true;const modal=document.createElement('div');modal.className='help';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','How to play');
 modal.innerHTML='<article><span class="eyebrow">A QUICK LITTLE GUIDE</span><h2>Up, down, and around.</h2><p>Tap the glowing dice beside the active player. Your pin walks one square at a time. Start at 0; any roll gets you onto the board.</p><p>Land at the foot of a ladder to climb. Land on a snake’s head to slide. Reach exactly 100 to win. Overshoot? Stay put and pass the turn. A six does not grant an extra turn.</p><p>Local: 1–4 people on one device. Computer: you and 1–3 automatic opponents. Friends: create a private 2–4 player room and share its code. Keep the tab open; rooms expire after six hours of inactivity and reset if the server restarts.</p><p>Sound starts after your first tap. Use the sound button to mute it. Your device may need media volume enabled.</p><button class="primary" id="close-help">Got it. Let’s play.</button></article>';
 root.appendChild(modal);const close=()=>{modal.remove();helpOpen=false;resize();};modal.querySelector('button').onclick=close;modal.onclick=e=>{if(e.target===modal)close();};modal.onkeydown=e=>{if(e.key==='Escape')close();};modal.querySelector('button').focus();resize();
}
function receive(next) {
 const wasPending=pending;
 data=next;receivedAt=Date.now();game=data.game;
 // Poll responses can race the command response. Keep the lock until state changes or an error arrives.
 if(pending && (data.ack===pendingNonce || Date.now()-pendingAt>10000 || data.error))pending=false;
 if(!game){
  if(gameId!==null){generation++;gameId=null;busy=false;queue=[];view='home';renderedSignature='';}
  const signature=`home:${view}:${data.error}`;
  if(renderedSignature!==signature||wasPending&&!pending){renderedSignature=signature;if(view==='home')home();else setup();}
  refreshButtons();return;
 }
 const signature=`${game.id}:${game.status}:${game.players.length}:${data.error}`;
 if(game.id!==gameId){generation++;gameId=game.id;seen=game.version;positions=game.players.map(p=>p.position);displayedDice=[...game.dice];busy=false;queue=[];pending=false;renderedSignature='';}
 if(game.status==='lobby'){
  if(renderedSignature!==signature){renderedSignature=signature;lobby();}
  return;
 }
 if(renderedSignature!==signature){renderedSignature=signature;gamePage();}
 const maxQueued=Math.max(seen,...queue.map(e=>e.id),busy?animatingId:0);
 const events=game.events.filter(e=>e.id>maxQueued);
 if(events.length){pending=false;queue.push(...events);drainTracked();}
 else if(!busy&&!queue.length){
  if(positions.some((p,i)=>p!==game.players[i].position)){positions=game.players.map(p=>p.position);gamePage();}
  refreshButtons();scheduleComputer();
 }
 if(data.error!==lastError){lastError=data.error;if(data.error){pending=false;refreshButtons();}}
}
let animatingId=0;
async function drainTracked(){if(busy)return;while(queue.length){const e=queue.shift();animatingId=e.id;await animate(e);}animatingId=0;}
window.addEventListener('message',event=>{if(event.data?.type==='streamlit:render'&&event.source===window.parent)receive(event.data.args.data);});
bridge('streamlit:componentReady',{apiVersion:1});
bridge('streamlit:setFrameHeight',{height:900});
})();
