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
let selectedGame=localStorage.getItem('clubhouse-game')==='ludo'?'ludo':'snakes', inviteHandled=false, ludoPositions=[];
const isLudo=()=>game?.game_type==='ludo';
const gameTitle=()=> (game?.game_type||selectedGame)==='ludo'?'LUDO':'SNAKES &amp; LADDERS';
const boardArt=()=>data.boards?.[game?.game_type||selectedGame]||data.board;
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
function header() {return `<header><div class="brand"><button class="brand-mark game-switch" id="game-switch" aria-label="Switch game to ${selectedGame==='ludo'?'Snakes and Ladders':'Ludo'}" title="Switch games" ${game?'disabled':''}>⚄</button><span>${gameTitle()}<small>THE LITTLE BOARD GAME CLUB</small></span></div><div class="tools"><button class="quiet" id="sound" aria-label="${soundEnabled?'Mute':'Enable'} sound">${soundEnabled?'♫ Sound on':'♫ Sound off'}</button><button class="quiet" id="help" aria-label="How to play">?</button></div></header>`;}

function art() {return `<div class="hero-art"><div class="mini-board" aria-hidden="true">${boardArt()}</div><div class="art-label">${selectedGame==='ludo'?'Four tokens. One way home.':'100 squares. Endless surprises.'}</div><button class="floating-die game-switch" aria-label="Switch game to ${selectedGame==='ludo'?'Snakes and Ladders':'Ludo'}" title="Switch games">${dice(5)}</button><span class="switch-hint">Tap the dice to play ${selectedGame==='ludo'?'Snakes &amp; Ladders':'Ludo'} ↗</span></div>`;}

function footer() {return `<footer class="footer"><span>MADE FOR GOOD COMPANY.</span><span>NO DOWNLOADS. JUST ONE MORE GAME.</span></footer>`;}
function shell(html) {
  helpOpen=false;
  root.innerHTML=`<div class="shell"><div class="content">${header()}${data.error?`<div class="error" role="alert">${esc(data.error)}</div>`:''}${html}${game?.status==='playing'?'':footer()}</div></div>`;
  document.getElementById('sound').onclick=()=>{unlockAudio();soundEnabled=!soundEnabled;localStorage.setItem('clubhouse-sound',soundEnabled?'on':'off');document.getElementById('sound').textContent=soundEnabled?'♫ Sound on':'♫ Sound off';document.getElementById('sound').setAttribute('aria-label',soundEnabled?'Mute sound':'Enable sound');const note=document.getElementById('audio-note');if(note)note.textContent=soundEnabled?'♫ Sound is on. Tap a dice to hear the game.':'♫ Sound is off. Turn it on at the top.';};
  document.getElementById('help').onclick=showHelp;
  root.querySelectorAll('.game-switch').forEach(button=>button.onclick=()=>{if(game)return;unlockAudio();selectedGame=selectedGame==='snakes'?'ludo':'snakes';localStorage.setItem('clubhouse-game',selectedGame);view='home';renderedSignature='';home();});
  resize();
}
function home() {
  shell(`<section class="hero"><div><span class="pill"><i></i> YOUR NEXT FAVOURITE GAME NIGHT</span><h1>A little luck.<br>A big <span>adventure.</span></h1><p>${selectedGame==='ludo'?'Four colourful tokens. A race around the board. Bring your favourite people home for the win.':'Climb a little higher. Dodge a slippery surprise. Bring your favourite people along for the ride.'}</p></div>${art()}</section><div class="section-heading"><h2>How are we playing?</h2><span>Pick your kind of company</span></div><section class="mode-grid"><button class="mode-card" data-mode="friends" style="--accent:var(--mint)"><span class="icon">♧</span><span class="arrow">↗</span><h3>Play with friends</h3><p>A private room. Your favourite people.<br>Join from different devices.</p></button><button class="mode-card" data-mode="computer" style="--accent:var(--purple)"><span class="icon">⚙</span><span class="arrow">↗</span><h3>Play with computer</h3><p>A worthy little rival.<br>You versus up to three computers.</p></button><button class="mode-card" data-mode="local" style="--accent:var(--coral)"><span class="icon">⚄</span><span class="arrow">↗</span><h3>Play local</h3><p>Pass the screen. Share the fun.<br>One device, one to four players.</p></button></section>`);
  root.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{unlockAudio();view=button.dataset.mode;count=2;setup();});
}
function countButtons(values) {return `<div class="count-options">${values.map(i=>`<button data-count="${i}" class="${count===i?'selected':''}" aria-pressed="${count===i}">${view==='computer'?`${i-1} CPU`:`${i}P`}</button>`).join('')}</div>`;}
function setup() {
  const friends=view==='friends', local=view==='local';
  const title=friends?'Good games. Great company.':local?'Same screen.<br>Different rivals.':'Meet your new rivals.';
  const sub=friends?'Create a private room and share the code. Everyone joins from their own device.':local?'Gather around, choose your crew, and pass the device when it’s the next player’s turn.':'You take the first turn. The computers roll and move automatically. Let luck decide the rest.';
  shell(`<section class="setup"><div><span class="eyebrow">${friends?'ACROSS THE MILES':local?'THE SOFA CLUB':'A LITTLE FRIENDLY COMPETITION'}</span><h1>${title}</h1><p>${sub}</p><button class="back" id="back">← Back to the clubhouse</button></div><div class="setup-panel"><span class="eyebrow">${friends?'PRIVATE TABLE':local?'PASS & PLAY':'YOU VS COMPUTER'}</span>${friends?`<div class="tabs"><button data-tab="create" class="${friendTab==='create'?'selected':''}">Create room</button><button data-tab="join" class="${friendTab==='join'?'selected':''}">Join room</button></div><label for="name">Your name</label><input id="name" class="field" maxlength="24" placeholder="Your game-night name" value="${esc(displayName)}">`:''}${!friends||friendTab==='create'?`<label>${view==='computer'?'Computer opponents':'Number of players'}</label>${countButtons(local?[1,2,3,4]:[2,3,4])}`:`<label for="room-input">Room code</label><input id="room-input" class="field" maxlength="6" autocomplete="off" placeholder="ABC123" value="${esc(joinCode)}" style="text-transform:uppercase;letter-spacing:.2em">`}<button class="primary wide" id="start">${friends?(friendTab==='create'?'Create a room ↗':'Join the table ↗'):'Let’s play →'}</button><p class="sound-hint">${friends?'Rooms expire after six hours without activity. Keep your game tab open; a server restart ends the room.':selectedGame==='ludo'?'Roll six to leave the yard. Tap a token after rolling. Bring all four home to win.':local&&count===1?'Solo practice: take your time and climb to 100.':'Land exactly on 100 to win. A six passes the turn, too.'}</p></div></section>`);
  document.getElementById('back').onclick=()=>{view='home';home();};
  root.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{count=Number(b.dataset.count);setup();});
  root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{friendTab=b.dataset.tab;count=2;setup();});
  const name=document.getElementById('name'),code=document.getElementById('room-input');
  if(name) name.oninput=()=>displayName=name.value;
  if(code) code.oninput=()=>joinCode=code.value.toUpperCase();
  document.getElementById('start').onclick=()=>{unlockAudio();send(friends?friendTab==='create'?'create':'join':'new',{mode:view,count,name:displayName||'Player',code:joinCode.trim(),game_type:selectedGame});};
  if(code) code.onkeydown=e=>{if(e.key==='Enter')document.getElementById('start').click();};
  refreshButtons();
}
function lobby() {
  const host=data.seat===0, full=game.players.length===data.capacity;
  shell(`<section class="setup"><div><span class="eyebrow">A SEAT FOR EVERY FRIEND</span><h1>Your table is ready.</h1><p>Invite your friends with a direct link. They’ll land right at this table’s join screen.</p><div class="room-code">${esc(data.room)}</div><div class="share-actions"><button class="primary" id="share-room">↗ Share room</button><button class="quiet" id="copy">Copy join link</button></div><div class="toast" id="copy-status"></div><button class="back" id="leave">← Leave room</button></div><div class="setup-panel"><div class="section-heading"><h2>The guest list</h2><span>${game.players.length} / ${data.capacity}</span></div><div class="lobby-list">${Array.from({length:data.capacity},(_,i)=>`<div class="lobby-player">${pin(COLORS[i])}<b>${game.players[i]?esc(game.players[i].name):'Waiting for a friend…'}</b><span>${i===0?'HOST':game.players[i]?'READY':'OPEN'}</span></div>`).join('')}</div><button class="primary wide" id="begin" ${!host||!full?'disabled':''}>${host?full?'Everyone’s here. Let’s play →':'Waiting for your friends…':'The host will start the game'}</button><p class="sound-hint">${data.error?'':`You’re ${esc(game.players[data.seat]?.name)}. Each player rolls only on their own turn.`}</p></div></section>`);
  document.getElementById('begin').onclick=()=>{unlockAudio();send('start');};
  document.getElementById('leave').onclick=()=>send('home');
  document.getElementById('copy').onclick=copyRoom;
  document.getElementById('share-room').onclick=shareRoom;
}
function canRoll(index) {return game && (!isLudo()||game.phase==='roll') && game.winner===null && index===game.turn && serverNow()>=game.ready_at && !busy && !pending && game.players[index].kind!=='computer' && (data.seat===null || data.seat===index);}
function playerCard(index) {
  if(!game.players[index])return `<div class="empty-seat">${game.players.length===1?'A solo adventure':isLudo()?'A seat at the table':'Enjoy the climb'}</div>`;
  const p=game.players[index], active=game.winner===null&&(busy?index===animPlayer:index===game.turn);
  const value=displayedDice[index]||1;
  return `<article class="player-card ${active?'active':''}" style="--player:${COLORS[index]}" data-player="${index}"><span class="player-pin">${pin(COLORS[index])}</span><div><div class="player-name">${esc(p.name)}${data.seat===index?' · You':''}</div><div class="player-meta" id="position-${index}">${isLudo()?`${p.tokens.filter(t=>t===56).length} of 4 home`:positions[index]===0?'At the start':`Square ${positions[index]}`}</div><div class="turn-indicator" id="turn-${index}">${active?busy?'On the move':p.kind==='computer'?'Thinking…':isLudo()&&game.phase==='choose'?'Pick a token':data.seat!==null&&data.seat!==index?'Their turn':'Your turn':'&nbsp;'}</div></div><button class="dice-button ${active?'active':''}" id="dice-${index}" data-roll="${index}" aria-label="Roll dice for ${esc(p.name)}" ${canRoll(index)?'':'disabled'}>${dice(value)}${active?'<span class="roll-label">'+(p.kind==='computer'?'CPU':'ROLL')+'</span>':''}</button></article>`;
}
function gamePage() {
  const mode=game.mode==='friends'?`ROOM ${esc(data.room)}`:game.mode==='computer'?'VS COMPUTER':game.players.length===1?'SOLO PRACTICE':`${game.players.length} PLAYER LOCAL`;
  const top=game.players.length>=3?[1,2]:[1,3];
  const tokens=isLudo()?game.players.map((p,i)=>p.tokens.map((_,j)=>`<button class="token ludo-token" id="piece-${i}-${j}" data-piece="${j}" data-seat="${i}" aria-label="Move ${esc(p.name)} token ${j+1}" ${canMove(i,j)?'':'disabled'}>${pin(COLORS[i])}</button>`).join('')).join(''):game.players.map((p,i)=>`<div class="token" id="token-${i}" role="img" aria-label="${esc(p.name)}, ${NAMES[i]} token">${pin(COLORS[i])}</div>`).join('');
  shell(`<div class="game-topline"><h1>${isLudo()?'Every token has a way home.':'Let the good times roll.'}</h1><span class="pill"><i></i>${mode}</span></div><div class="game-toolbar"><button class="quiet" id="exit">← Home</button>${game.mode!=='friends'?'<button class="quiet" id="reset">↻ New game</button>':'<button class="quiet" id="share-room">↗ Share room</button>'}<span class="compact-status" id="status">${esc(game.message)}</span></div><section class="game-layout clean-game"><div class="arena"><div class="players-row">${top.map(playerCard).join('')}</div><div class="board-wrap ${isLudo()?'ludo-board':''}"><div class="art">${boardArt()}</div><div class="tokens" id="tokens">${tokens}</div>${isLudo()?'':'<div class="start-dock">START LINE</div>'}<div id="winner-slot"></div></div><div class="players-row">${[0,3].map(playerCard).join('')}</div></div></section>`);
  root.querySelectorAll('[data-roll]').forEach(b=>b.onclick=()=>{unlockAudio();if(canRoll(Number(b.dataset.roll)))send('roll',{version:game.version,computer:false});});
  root.querySelectorAll('[data-piece]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.seat),j=Number(b.dataset.piece);if(canMove(i,j)){unlockAudio();send('move',{version:game.version,token:j,computer:false});}});
  document.getElementById('exit').onclick=()=>{if(!busy)send('home');};
  const reset=document.getElementById('reset');if(reset)reset.onclick=()=>{if(!busy)send('restart');};
  const share=document.getElementById('share-room');if(share)share.onclick=shareRoom;
  if(isLudo())ludoPositions.forEach((tokens,i)=>tokens.forEach((p,j)=>placeLudo(i,j,p,false)));
  else positions.forEach((p,i)=>placeToken(i,p,false));
  showWinner();refreshButtons();
}
function canMove(seat,piece) {
  return isLudo()&&game.phase==='choose'&&seat===game.turn&&game.legal_tokens.includes(piece)&&game.winner===null&&!busy&&!pending&&serverNow()>=game.ready_at&&game.players[seat].kind!=='computer'&&(data.seat===null||data.seat===seat);
}
function ludoCoords(seat,piece,progress) {
  const layout=data.ludo_layout;
  let cell=progress<0?layout.yards[seat][piece]:progress<=50?layout.track[(seat*13+progress)%52]:layout.lanes[seat][progress-51];
  let x=(cell[0]+.5)*100/15,y=(cell[1]+.5)*100/15;
  if(progress>=0){x+=(piece%2?1:-1)*1.4;y+=(piece<2?-1:1)*1.4;}
  if(progress===56){x+=(seat===0||seat===1?-1:1)*2;y+=(seat===0||seat===3?1:-1)*2;}
  return {x,y};
}
function placeLudo(seat,piece,progress,transition=true) {
  const token=document.getElementById(`piece-${seat}-${piece}`);if(!token)return;
  const c=ludoCoords(seat,piece,progress);token.style.transition=transition?'':'none';token.style.left=c.x+'%';token.style.top=c.y+'%';
}
function roomLink() {
  const base=new URL(new URLSearchParams(location.search).get('streamlitUrl')||'https://game.aiinc.uk/');
  base.pathname='/';base.search='';base.hash='';base.searchParams.set('room',data.room);base.searchParams.set('game',game.game_type||'snakes');return base.href;
}
async function copyRoom(){
  try{await navigator.clipboard.writeText(roomLink());const status=document.getElementById('copy-status');if(status)status.textContent='Join link copied. Send it to your crew!';}
  catch(_){shareFallback();}
}
async function shareRoom(){
  const title=game.game_type==='ludo'?'Ludo':'Snakes and Ladders';
  const link=roomLink();
  if(navigator.share){try{await navigator.share({title:`Join my ${title} game`,text:`Let’s play ${title}! Room ${data.room}.`,url:link});return;}catch(error){if(error.name==='AbortError')return;}}
  shareFallback();
}
function shareFallback(){
  if(document.getElementById('share-dialog'))return;
  const link=roomLink(),title=game.game_type==='ludo'?'Ludo':'Snakes and Ladders',text=`Join my ${title} game! Room ${data.room}: ${link}`;
  const modal=document.createElement('div');modal.id='share-dialog';modal.className='help';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Share your room');
  modal.innerHTML=`<article><span class="eyebrow">SAVE A SEAT FOR YOUR FRIENDS</span><h2>Share your ${title} room</h2><p>Send the direct link. Your friends only need to enter their name to join.</p><input class="field" id="share-link" aria-label="Direct room link" readonly value="${esc(link)}"><div class="share-actions"><a class="quiet" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener noreferrer">WhatsApp</a><a class="quiet" href="https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join my '+title+' game! Room '+data.room)}" target="_blank" rel="noopener noreferrer">Telegram</a><a class="quiet" href="mailto:?subject=${encodeURIComponent('Join my '+title+' game')}&body=${encodeURIComponent(text)}">Email</a><button class="quiet" id="share-copy">Copy link</button></div><p id="share-feedback"></p><button class="primary" id="close-share">Done</button></article>`;
  root.appendChild(modal);const close=()=>{modal.remove();resize();};modal.querySelector('#close-share').onclick=close;modal.onclick=e=>{if(e.target===modal)close();};modal.onkeydown=e=>{if(e.key==='Escape')close();};modal.querySelector('#share-copy').onclick=async()=>{try{await navigator.clipboard.writeText(link);modal.querySelector('#share-feedback').textContent='Link copied!';}catch(_){modal.querySelector('#share-link').select();modal.querySelector('#share-feedback').textContent='Select and copy the link above.';}};modal.querySelector('#close-share').focus();resize();
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
async function followSnake(index,event,currentGeneration) {
  const token=document.getElementById(`token-${index}`);
  const path=root.querySelector(`.board-wrap .art [data-snake-start="${event.landing}"] path`);
  if(!token||!path||reduced){placeToken(index,event.destination,false);await sleep(1050);return;}
  const length=path.getTotalLength(), head=path.getPointAtLength(0), tail=path.getPointAtLength(length);
  const start={x:parseFloat(token.style.left)*6,y:parseFloat(token.style.top)*6};
  const finish=coords(event.destination,index);
  // Pin tip follows the actual SVG artwork, not a second approximation of the curve.
  token.style.transition='none';
  const previousTransform=token.style.transform;
  token.style.transform='translate(-50%,-100%)';
  const started=performance.now();
  await new Promise(resolve=>{
    function frame(now){
      if(currentGeneration!==generation){resolve();return;}
      const elapsed=Math.min(1050,now-started);
      let point;
      if(elapsed<100){const t=elapsed/100;point={x:start.x+(head.x-start.x)*t,y:start.y+(head.y-start.y)*t};}
      else if(elapsed<900){point=path.getPointAtLength(length*(elapsed-100)/800);}
      else{const t=(elapsed-900)/150;point={x:tail.x+(finish.x*6-tail.x)*t,y:tail.y+(finish.y*6-tail.y)*t};}
      token.style.left=point.x/6+'%';token.style.top=point.y/6+'%';
      if(elapsed<1050)requestAnimationFrame(frame);else resolve();
    }
    requestAnimationFrame(frame);
  });
  token.style.transform=previousTransform;
  placeToken(index,event.destination,false);
}
function refreshButtons() {
  if(!game){const start=document.getElementById('start');if(start){start.disabled=pending;if(pending)start.textContent='Setting the table…';}return;}
  root.querySelectorAll('[data-roll]').forEach(b=>{const i=Number(b.dataset.roll);b.disabled=!canRoll(i);});
  root.querySelectorAll('[data-piece]').forEach(b=>{const enabled=canMove(Number(b.dataset.seat),Number(b.dataset.piece));b.disabled=!enabled;b.classList.toggle('selectable',enabled);});
  ['reset','exit'].forEach(id=>{const b=document.getElementById(id);if(b)b.disabled=busy||pending;});
}
function showWinner() {
 const slot=document.getElementById('winner-slot');if(!slot||game.winner===null||busy)return;
 const host=data.seat===null||data.seat===0;
 slot.innerHTML=`<div class="winner"><div>${Array.from({length:22},(_,i)=>`<i class="confetti" style="--x:${(i*19)%100}%;--c:${COLORS[i%4]};--d:${2+i%3}s;--delay:-${i*.17}s"></i>`).join('')}<div class="trophy">♛</div><span class="eyebrow">THE TOP OF THE WORLD</span><h2>${esc(game.players[game.winner].name)} wins!</h2><p>${isLudo()?'Four tokens home. One brilliant finish.':'One hundred squares. One brilliant finish.'}</p><button class="primary wide" id="rematch" ${host?'':'disabled'}>${host?'One more adventure →':'Waiting for the host’s rematch'}</button></div></div>`;
 document.getElementById('rematch').onclick=()=>send('restart');
}
async function animate(event) {
 if(isLudo())return animateLudo(event);
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
  sound(event.special);
  if(event.special==='snake')await followSnake(index,event,currentGeneration);
  else{token?.classList.add('jump');placeToken(index,event.destination);await sleep(1050);token?.classList.remove('jump');}
  positions[index]=event.destination;
 }
 await sleep(Math.max(220,(game.ready_at-serverNow())*1000+30));if(currentGeneration!==generation)return;
 positions[index]=event.destination;seen=event.id;busy=false;animPlayer=null;
 if(!queue.length){positions=game.players.map(p=>p.position);gamePage();if(game.winner!==null)sound('win');scheduleComputer();}
}
async function animateLudo(event){
  const currentGeneration=generation;busy=true;animPlayer=event.player;refreshButtons();
  const seat=event.player,button=document.getElementById(`dice-${seat}`),status=document.getElementById('status');
  root.querySelectorAll('.player-card').forEach(card=>card.classList.toggle('active',Number(card.dataset.player)===seat));
  if(event.type==='roll'){
    sound('roll');button?.classList.add('rolling');
    if(status)status.textContent=`${game.players[seat].name} is rolling…`;
    for(let i=0;i<8;i++){if(button)button.innerHTML=dice(1+Math.floor(Math.random()*6));await sleep(reduced?35:80);if(currentGeneration!==generation)return;}
    button?.classList.remove('rolling');if(button)button.innerHTML=dice(event.roll);displayedDice[seat]=event.roll;
  }else{
    const token=document.getElementById(`piece-${seat}-${event.token}`);token?.classList.add('moving');
    for(const progress of event.walk){ludoPositions[seat][event.token]=progress;placeLudo(seat,event.token,progress);sound('step');await sleep(170);if(currentGeneration!==generation)return;}
    token?.classList.remove('moving');
    if(event.captures?.length){sound('snake');for(const captured of event.captures){ludoPositions[captured.player][captured.token]=-1;placeLudo(captured.player,captured.token,-1);}await sleep(500);}
    if(event.destination===56)sound('ladder');
  }
  await sleep(Math.max(120,(game.ready_at-serverNow())*1000+30));if(currentGeneration!==generation)return;
  seen=event.id;busy=false;animPlayer=null;
  if(!queue.length){ludoPositions=game.players.map(p=>[...p.tokens]);positions=game.players.map(p=>p.position);gamePage();if(game.winner!==null)sound('win');scheduleComputer();}
}
function scheduleComputer() {
 clearTimeout(computerTimer);computerTimer=null;
 if(!game||busy||pending||queue.length||game.winner!==null||game.status!=='playing'||game.mode!=='computer')return;
 if(game.players[game.turn].kind!=='computer')return;
 const expected=game.version;
 const remaining=Math.max(0,(game.ready_at-serverNow())*1000);
 computerTimer=setTimeout(()=>{
   if(!game||game.version!==expected||busy||pending)return;
   if(isLudo()&&game.phase==='choose'){
     // Prefer finishing, then releasing a new token on a six.
     const pieces=game.players[game.turn].tokens;
     const token=[...game.legal_tokens].sort((a,b)=>{
       const score=i=>pieces[i]+game.pending_roll===56?1000:pieces[i]===-1?100:pieces[i];return score(b)-score(a);
     })[0];
     send('move',{version:expected,computer:true,token});
   }else send('roll',{version:expected,computer:true});
 },Math.max(650,remaining+200));
}
function showHelp() {
 if(helpOpen)return;helpOpen=true;const modal=document.createElement('div');modal.className='help';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','How to play');
 modal.innerHTML=(isLudo()||!game&&selectedGame==='ludo')?'<article><span class="eyebrow">LUDO AT THE CLUBHOUSE</span><h2>Four tokens. One way home.</h2><p>Roll six to bring a token out of its yard. After rolling, tap one of your glowing tokens to move. Tokens walk each square around the track, then enter their own coloured lane.</p><p>Land on an opponent to send their token back to the yard. Star squares and coloured starting squares are safe. Tokens may share squares; there are no blockades in this version.</p><p>A six earns another roll. Three consecutive sixes forfeit the turn. Captures and reaching home do not earn extra rolls. Roll exactly to reach the centre; the first player with all four tokens home wins.</p><p>Local supports 1–4 players. Computers move automatically. Friend rooms work across devices; use Share room to send a direct join link. Rooms reset on server restart.</p><button class="primary" id="close-help">Got it. Let’s play.</button></article>':'<article><span class="eyebrow">A QUICK LITTLE GUIDE</span><h2>Up, down, and around.</h2><p>Tap the glowing dice beside the active player. Your pin walks one square at a time. Start at 0; any roll gets you onto the board.</p><p>Land at the foot of a ladder to climb. Land on a snake’s head to slide. Reach exactly 100 to win. Overshoot? Stay put and pass the turn. A six does not grant an extra turn.</p><p>Local: 1–4 people on one device. Computer: you and 1–3 automatic opponents. Friends: create a private 2–4 player room and share its code. Keep the tab open; rooms expire after six hours of inactivity and reset if the server restarts.</p><p>Sound starts after your first tap. Use the sound button to mute it. Your device may need media volume enabled.</p><button class="primary" id="close-help">Got it. Let’s play.</button></article>';
 root.appendChild(modal);const close=()=>{modal.remove();helpOpen=false;resize();};modal.querySelector('button').onclick=close;modal.onclick=e=>{if(e.target===modal)close();};modal.onkeydown=e=>{if(e.key==='Escape')close();};modal.querySelector('button').focus();resize();
}
function receive(next) {
 const wasPending=pending;
 data=next;receivedAt=Date.now();game=data.game;
 if(game)selectedGame=game.game_type||'snakes';
 if(!inviteHandled){inviteHandled=true;if(data.invite){selectedGame=data.invite_game||'snakes';view='friends';friendTab='join';joinCode=data.invite;}}
 // Poll responses can race the command response. Keep the lock until state changes or an error arrives.
 if(pending && (data.ack===pendingNonce || Date.now()-pendingAt>10000 || data.error))pending=false;
 if(!game){
  if(gameId!==null){generation++;gameId=null;busy=false;queue=[];view='home';renderedSignature='';}
  const signature=`home:${selectedGame}:${view}:${data.error}`;
  if(renderedSignature!==signature||wasPending&&!pending){renderedSignature=signature;if(view==='home')home();else setup();}
  refreshButtons();return;
 }
 const signature=`${game.id}:${game.status}:${game.players.length}:${data.error}`;
 if(game.id!==gameId){generation++;gameId=game.id;seen=game.version;positions=game.players.map(p=>p.position);displayedDice=[...game.dice];ludoPositions=game.players.map(p=>p.tokens?[...p.tokens]:[]);busy=false;queue=[];pending=false;renderedSignature='';}
 if(game.status==='lobby'){
  if(renderedSignature!==signature){renderedSignature=signature;lobby();}
  return;
 }
 if(renderedSignature!==signature){renderedSignature=signature;gamePage();}
 const maxQueued=Math.max(seen,...queue.map(e=>e.id),busy?animatingId:0);
 const events=game.events.filter(e=>e.id>maxQueued);
 if(events.length){pending=false;queue.push(...events);drainTracked();}
 else if(!busy&&!queue.length){
  if(positions.some((p,i)=>p!==game.players[i].position)||isLudo()&&JSON.stringify(ludoPositions)!==JSON.stringify(game.players.map(p=>p.tokens))){positions=game.players.map(p=>p.position);if(isLudo())ludoPositions=game.players.map(p=>[...p.tokens]);gamePage();}
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
