(() => {
const $=id=>document.getElementById(id);
const screens=["home","setup","lobby","game","winner"];
const S={mode:"offline",players:[],turn:0,round:1,started:false,room:"",host:false,myId:"",peer:null,hostConn:null,conns:new Map(),ready:false,rolling:false,peerReady:false,offlineNames:[]};
const colors=["#1da8ff","#ff5361","#42df8d","#ffc52c","#a66bff","#aeb8c5"];
const show=id=>{screens.forEach(s=>$(s).classList.toggle("active",s===id));scrollTo(0,0)};
function toast(t){const e=$("toast");e.textContent=t;e.classList.add("show");clearTimeout(window.tt);window.tt=setTimeout(()=>e.classList.remove("show"),2800)}
function status(t){$("onlineStatus").textContent=t}
function badge(on){$("netBadge").textContent=on?"ONLINE":"OFFLINE";$("netBadge").className="badge "+(on?"online":"offline")}
function esc(s){return String(s||"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]))}
function players6(){return Array.from({length:6},(_,i)=>({id:"p"+(i+1),slot:i,name:"Player "+(i+1),city:"City "+(i+1),lives:3,alive:true,ready:false,isHost:i===0}))}
function makeInputs(){
  $("playerInputs").innerHTML=Array.from({length:6},(_,i)=>`<div class="pinput"><div class="num" style="border:1px solid ${colors[i]}">${i+1}</div><label>PLAYER ${i+1}<input id="pn${i}" maxlength="18" value="${esc(S.offlineNames[i]?.name||`Player ${i+1}`)}"></label><label>CITY<input id="pc${i}" maxlength="24" value="${esc(S.offlineNames[i]?.city||`City ${i+1}`)}"></label></div>`).join("");
}
function renderLobby(){
 const ps=S.players,ready=ps.filter(p=>p.ready).length;
 $("roomCode").textContent=S.room;$("count").textContent=`${ps.length}/6 PLAYERS`;$("readyCount").textContent=`${ready}/6 READY`;
 $("lobbyText").textContent=ps.length<6?`Waiting for ${6-ps.length} more player${6-ps.length===1?"":"s"}...`:ready<6?`All players joined. Waiting for ${6-ready} READY.`:"All players READY. Host can start.";
 $("hostText").textContent=S.host?"★ You are the HOST.":"Waiting for the HOST.";
 $("lobbyGrid").innerHTML=Array.from({length:6},(_,i)=>{const p=ps.find(x=>x.slot===i);return p?`<div class="slot"><span>PLAYER ${i+1}</span><span class="status ${p.ready?"ready":"waiting"}">${p.ready?"READY":"WAITING"}</span><h3>${esc(p.name)}</h3><p>📍 ${esc(p.city)}</p>${p.isHost?'<div class="host">★ HOST</div>':""}</div>`:`<div class="slot empty">PLAYER ${i+1}<br>WAITING...</div>`}).join("");
 const me=ps.find(p=>p.id===S.myId);
 $("readyBtn").textContent=me?.ready?"NOT READY":"READY ✓";
 $("startOnline").disabled=!(S.host&&ps.length===6&&ready===6);
}
function renderBoard(){
 $("board").innerHTML=S.players.slice().sort((a,b)=>a.slot-b.slot).map(p=>`<div class="player ${p.alive?"":"dead"} ${p.slot===S.turn&&p.alive?"current":""}"><div class="ptop"><div class="avatar" style="border-color:${colors[p.slot]}">P${p.slot+1}</div><div><h3>${esc(p.name)}</h3><div class="city">📍 ${esc(p.city)}</div></div></div><div class="hearts">${[0,1,2].map(i=>`<span class="${i<p.lives?"":"empty"}">❤️</span>`).join("")}</div>${p.slot===S.turn&&p.alive?'<div class="currentlabel">CURRENT</div>':""}${!p.alive?'<div class="deadlabel">ELIMINATED</div>':""}</div>`).join("");
 $("round").textContent=`ROUND ${Math.max(1,S.round)}`;
 const cur=S.players.find(p=>p.slot===S.turn&&p.alive);
 $("turn").textContent=cur?`${cur.name.toUpperCase()}'S TURN`:"GAME OVER";$("hint").textContent=cur?"Roll the dice":"";
 const mine=S.mode==="offline"||cur?.id===S.myId;
 $("roll").disabled=!S.started||S.rolling||!cur||!mine;
 $("roll").textContent=mine?"ROLL THE DICE":"WAIT FOR YOUR TURN";
}
function log(t){const e=document.createElement("div");e.className="logitem";e.textContent=t;$("log").prepend(e)}
function nextAlive(from){for(let n=1;n<=6;n++){const slot=(from+n)%6,p=S.players.find(x=>x.slot===slot);if(p?.alive)return slot}return from}
function winner(){const a=S.players.filter(p=>p.alive);return a.length===1?a[0]:null}
function showWin(w){$("winnerAvatar").textContent="P"+(w.slot+1);$("winnerName").textContent=w.name;$("winnerCity").textContent="📍 "+w.city;$("winnerLives").textContent="❤️".repeat(Math.max(1,w.lives));S.started=false;show("winner")}
function animate(value,done){S.rolling=true;$("roll").disabled=true;$("dice").classList.add("rolling");setTimeout(()=>{$("dice").textContent=value;$("dice").classList.remove("rolling");S.rolling=false;done()},650)}
function offlineRoll(){
 if(S.rolling||!S.started)return;
 const cur=S.players.find(p=>p.slot===S.turn&&p.alive);if(!cur)return;
 const v=Math.floor(Math.random()*6)+1;
 animate(v,()=>{
   const t=S.players.find(p=>p.slot===v-1);
   if(t?.alive){t.lives--;if(t.lives<1)t.alive=false;$("result").textContent=`🎲 ${v} → ${t.name} loses 1 life!`;log(`${cur.name} rolled ${v} → ${t.name} -1 ❤️`)}
   else{$("result").textContent=`🎲 ${v} → Player ${v} is already eliminated.`;log(`${cur.name} rolled ${v} → no damage`)}
   const w=winner();if(w)return showWin(w);
   S.turn=nextAlive(S.turn);S.round++;renderBoard();
 });
}
function setupOffline(){
 S.mode="offline";S.players=players6();S.started=false;S.turn=0;S.round=1;badge(false);
 $("setupEyebrow").textContent="OFFLINE";$("setupTitle").textContent="Set up 6 players";
 $("offlineSetup").classList.remove("hidden");$("onlineSetup").classList.add("hidden");makeInputs();show("setup");
}
function setupOnline(){
 $("safetyModal").classList.remove("hidden");
 $("setupEyebrow").textContent="ONLINE";$("setupTitle").textContent="Create or join a room";
 $("offlineSetup").classList.add("hidden");$("onlineSetup").classList.remove("hidden");status("Ready to connect.");show("setup");
}
function cleanPeer(){try{S.peer?.destroy()}catch{}S.peer=null;S.hostConn=null;S.conns.clear();S.peerReady=false}
function makeRoomCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
function initPeerForHost(code,name,city){
 cleanPeer();status("Creating secure room…");
 S.host=true;S.room=code;
 S.peer=new Peer(code.toLowerCase(),{debug:0,secure:true,config:{iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:global.stun.twilio.com:3478"}]}});
 S.peer.on("open",id=>{
   S.myId=id;S.peerReady=true;S.mode="online";S.players=[{id,peer:null,slot:0,name,city,lives:3,alive:true,ready:false,isHost:true,connected:true}];
   badge(true);status("Room created. Share the code with 5 players.");renderLobby();show("lobby");
 });
 S.peer.on("connection",c=>setupIncoming(c));
 S.peer.on("error",e=>{status("Connection error: "+e.type);toast("Online connection error: "+e.type);if(e.type==="unavailable-id")status("Room code collision. Please create a new room.");});
 S.peer.on("disconnected",()=>{if(S.started)showConnection("Connection to online service was interrupted.");});
}
function initPeerForJoin(code,name,city){
 cleanPeer();status("Connecting to room…");
 S.host=false;S.room=code;
 S.peer=new Peer(undefined,{debug:0,secure:true,config:{iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:global.stun.twilio.com:3478"}]}});
 S.peer.on("open",id=>{
   S.myId=id;S.peerReady=true;
   const c=S.peer.connect(code.toLowerCase(),{reliable:true});
   S.hostConn=c;
   c.on("open",()=>{status("Connected to host. Waiting for lobby…");c.send({type:"join",id,name,city})});
   c.on("data",m=>handleNet(m,c));
   c.on("close",()=>{toast("Host disconnected.");status("Host disconnected.");showConnection("Host disconnected. Return to Main Menu and join a new room.")});
 });
 S.peer.on("error",e=>{status("Could not connect: "+e.type);toast("Could not join room: "+e.type)});
}
function setupIncoming(c){
 S.conns.set(c.peer,c);
 c.on("open",()=>{if(S.host) c.send({type:"hello",room:S.room})});
 c.on("data",m=>handleNet(m,c));
 c.on("close",()=>{if(S.host){const p=S.players.find(x=>x.peer===c.peer);if(p&&!S.started){S.players=S.players.filter(x=>x.peer!==c.peer);renderLobby();broadcastState()}}});
}
function broadcastState(){
 if(!S.host)return;
 const data={type:"state",room:S.room,players:S.players.map(p=>({id:p.id,slot:p.slot,name:p.name,city:p.city,lives:p.lives,alive:p.alive,ready:p.ready,isHost:p.isHost})),turn:S.turn,round:S.round,phase:S.started?"game":"lobby"};
 S.conns.forEach(c=>{try{if(c.open)c.send(data)}catch{}});
}
function handleNet(m,c){
 if(m.type==="join"&&S.host){
   if(S.players.length>=6){c.send({type:"error",message:"Room is full. Maximum 6 players."});return}
   if(S.started){c.send({type:"error",message:"Game already started."});return}
   if(S.players.some(p=>p.id===m.id)){return}
   const slot=[0,1,2,3,4,5].find(x=>!S.players.some(p=>p.slot===x));
   S.players.push({id:m.id,peer:c.peer,slot,name:String(m.name).slice(0,18)||`Player ${slot+1}`,city:String(m.city).slice(0,24)||"Unknown City",lives:3,alive:true,ready:false,isHost:false,connected:true});
   S.conns.set(c.peer,c);c.send({type:"welcome",room:S.room,players:S.players.length});
   renderLobby();broadcastState();return;
 }
 if(m.type==="ready"&&S.host){
   const p=S.players.find(x=>x.id===m.id);if(p&&!S.started){p.ready=!p.ready;renderLobby();broadcastState()}return;
 }
 if(m.type==="start"&&S.host){
   if(S.players.length!==6)return c?.send({type:"error",message:"Exactly 6 players are required."});
   if(!S.players.every(p=>p.ready))return c?.send({type:"error",message:"All 6 players must be READY."});
   S.started=true;S.turn=0;S.round=1;broadcastState();startGameUI();return;
 }
 if(m.type==="roll"&&S.host){
   const p=S.players.find(x=>x.id===m.id);if(!p||!S.started||p.slot!==S.turn)return;
   const v=Math.floor(Math.random()*6)+1,t=S.players.find(x=>x.slot===v-1);let hit=false;
   if(t?.alive){t.lives--;hit=true;if(t.lives<1)t.alive=false}
   const w=winner();if(!w)S.turn=nextAlive(S.turn);S.round++;
   const packet={type:"roll",value:v,hit,target:t?.name||`Player ${v}`,roller:p.name,players:S.players.map(x=>({id:x.id,slot:x.slot,name:x.name,city:x.city,lives:x.lives,alive:x.alive,ready:x.ready,isHost:x.isHost})),turn:S.turn,round:S.round,winnerSlot:w?.slot??null};
   sendAll(packet);applyRoll(packet);return;
 }
 if(m.type==="state"){
   S.mode="online";S.players=m.players;S.turn=m.turn;S.round=m.round;S.started=m.phase==="game";badge(true);
   renderLobby();if(S.started)startGameUI();return;
 }
 if(m.type==="roll"){applyRoll(m);return}
 if(m.type==="error"){toast(m.message);status(m.message)}
}
function sendAll(m){if(!S.host)return;S.conns.forEach(c=>{try{if(c.open)c.send(m)}catch{}})}
function applyRoll(m){
 S.players=m.players;S.turn=m.turn;S.round=m.round;
 animate(m.value,()=>{
   const target=S.players.find(p=>p.slot===m.value-1);
   $("result").textContent=`🎲 ${m.value} → ${target?.name||m.target} ${m.hit?"loses 1 life!":"is already eliminated."}`;
   log(`${m.roller} rolled ${m.value} → ${target?.name||m.target} ${m.hit?"-1 ❤️":"no damage"}`);
   renderBoard();
   if(m.winnerSlot!==null&&m.winnerSlot!==undefined){const w=S.players.find(p=>p.slot===m.winnerSlot);if(w)showWin(w)}
 });
}
function showConnection(t){$("connectionNotice").textContent=t;$("connectionNotice").classList.remove("hidden")}
function startGameUI(){
 $("modeText").textContent=S.mode.toUpperCase();$("log").innerHTML="";$("result").textContent="The number decides who loses a life.";show("game");renderBoard();
}
$("goOffline").onclick=setupOffline;
$("goOnline").onclick=setupOnline;
$("backHome").onclick=()=>show("home");
$("startOffline").onclick=()=>{
 S.offlineNames=Array.from({length:6},(_,i)=>({name:$("pn"+i).value.trim()||`Player ${i+1}`,city:$("pc"+i).value.trim()||`City ${i+1}`}));
 S.players=players6();S.players.forEach((p,i)=>{p.name=S.offlineNames[i].name;p.city=S.offlineNames[i].city;p.ready=true});
 S.mode="offline";S.started=true;S.turn=0;S.round=1;startGameUI();
};
$("roll").onclick=()=>{
 if(S.mode==="offline")offlineRoll();
 else {const c=S.players.find(p=>p.id===S.myId);if(c?.slot===S.turn){if(S.host)handleNet({type:"roll",id:S.myId});else S.hostConn?.send({type:"roll",id:S.myId})}}
};
$("createRoom").onclick=()=>{
 const name=$("myName").value.trim()||"Player 1",city=$("myCity").value.trim()||"Unknown City";
 const code=makeRoomCode();initPeerForHost(code,name,city);
};
$("joinRoom").onclick=()=>{
 const code=$("roomInput").value.trim().toUpperCase(),name=$("myName").value.trim()||"Player",city=$("myCity").value.trim()||"Unknown City";
 if(!/^[A-Z0-9]{6}$/.test(code))return toast("Enter the 6-character room code.");
 initPeerForJoin(code,name,city);
};
$("readyBtn").onclick=()=>{
 if(S.host){const p=S.players.find(x=>x.id===S.myId);if(p){p.ready=!p.ready;renderLobby();broadcastState()}}
 else S.hostConn?.send({type:"ready",id:S.myId});
};
$("startOnline").onclick=()=>{
 if(!S.host)return;
 if(S.players.length!==6)return toast("Need exactly 6 players.");
 if(!S.players.every(p=>p.ready))return toast("All 6 players must be READY.");
 S.started=true;S.turn=0;S.round=1;broadcastState();startGameUI();
};
$("copyRoom").onclick=async()=>{try{await navigator.clipboard.writeText(S.room);toast("Room code copied.")}catch{toast(S.room)}};
$("again").onclick=()=>{
 if(S.mode==="offline"){S.players.forEach(p=>{p.lives=3;p.alive=true;p.ready=true});S.turn=0;S.round=1;S.started=true;startGameUI();}
 else if(S.host){S.players.forEach(p=>{p.lives=3;p.alive=true;p.ready=false});S.started=false;S.turn=0;S.round=1;renderLobby();broadcastState();show("lobby");}
 else toast("Ask the host to start the next game.");
};
$("menu").onclick=()=>location.reload();
makeInputs();badge(false);
$("safetyOk").onclick=()=>{$("safetyModal").classList.add("hidden")};
let deferred;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferred=e;$("installBtn").classList.remove("hidden")});
$("installBtn").onclick=async()=>{if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;$("installBtn").classList.add("hidden")}};
if("serviceWorker"in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
