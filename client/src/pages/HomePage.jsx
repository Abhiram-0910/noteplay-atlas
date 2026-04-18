import { useState, useEffect } from "react";
import RulesModal from "../components/RulesModal.jsx";
import { getRoomCodeFromUrl, normalizeRoomCode } from "../utils/roomLinks.js";
import { projectConfig } from "../projectConfig.js";

export default function HomePage({ connected, connectionState, createRoom, joinRoom, playerName, serverUrl, setPlayerName, setServerUrl, status }) {
  const [roomCode, setRoomCode] = useState(getRoomCodeFromUrl);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [category, setCategory] = useState("mixed");
  const qrJoin = Boolean(roomCode);

  useEffect(() => {
    if (!serverUrl || serverUrl.includes("localhost")) setServerUrl(window.location.origin);
  }, []);

  const connColor = connected ? "#3fb950" : connectionState === "error" ? "#f85149" : "#7d8590";
  const connLabel = connected ? "✓ Connected" : connectionState === "connecting" ? "Connecting…" : connectionState === "error" ? "Cannot connect" : "Not connected";

  const cats = [
    { id:"mixed", label:"🌍 Mixed", desc:"World + India" },
    { id:"india", label:"🇮🇳 India", desc:"Districts & cities" },
    { id:"world", label:"🌐 World", desc:"Global cities" },
  ];

  return (
    <main style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"20px",gap:"16px",background:"#0d1117"}}>
      <div style={{width:"100%",maxWidth:"420px",background:"#161b22",borderRadius:"20px",border:"1px solid rgba(255,255,255,.08)",padding:"28px 24px",display:"flex",flexDirection:"column",gap:"18px"}}>

        <div style={{textAlign:"center"}}>
          <div style={{fontSize:"2.5rem",marginBottom:"6px"}}>🌍</div>
          <h1 style={{fontSize:"1.6rem",fontWeight:900,color:"#e6edf3",margin:0}}>Atlas</h1>
          <p style={{color:"#7d8590",fontSize:".85rem",margin:"6px 0 0"}}>Geography word chain — name a place, keep it going</p>
        </div>

        <div style={{background:"rgba(255,255,255,.04)",borderRadius:"10px",padding:"10px 14px",display:"flex",alignItems:"center",gap:"8px"}}>
          <div style={{width:"8px",height:"8px",borderRadius:"50%",background:connColor,flexShrink:0}}></div>
          <span style={{fontSize:".82rem",color:connColor,fontWeight:600}}>{connLabel}</span>
        </div>

        <div>
          <label style={{fontSize:".72rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7d8590",display:"block",marginBottom:"8px"}}>Dataset</label>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            {cats.map(c => (
              <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                style={{flex:"1 1 100px",padding:"10px 8px",borderRadius:"10px",border:"1.5px solid",borderColor:category===c.id?"#3fb950":"rgba(255,255,255,.1)",background:category===c.id?"rgba(63,185,80,.1)":"rgba(255,255,255,.04)",color:category===c.id?"#3fb950":"#7d8590",fontWeight:700,fontSize:".82rem",cursor:"pointer",textAlign:"center"}}>
                {c.label}<br/><span style={{fontWeight:400,fontSize:".72rem",opacity:.8}}>{c.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{fontSize:".72rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7d8590",display:"block",marginBottom:"8px"}}>Your Name</label>
          <input maxLength={32} onChange={e => setPlayerName(e.target.value)} placeholder="Enter your name" value={playerName}
            style={{width:"100%",background:"rgba(255,255,255,.06)",border:"1.5px solid rgba(255,255,255,.1)",borderRadius:"10px",color:"#e6edf3",fontSize:".95rem",padding:"12px 14px",outline:"none",fontFamily:"inherit"}}/>
        </div>

        {!qrJoin && (
          <button type="button" disabled={!playerName.trim()}
            onClick={() => createRoom({ nextPlayerName: playerName, settings: { atlasCategory: category } })}
            style={{width:"100%",padding:"14px",background:"#3fb950",color:"#fff",border:"none",borderRadius:"12px",fontWeight:700,fontSize:"1rem",cursor:"pointer",opacity:playerName.trim()?1:.5}}>
            Create Room
          </button>
        )}

        <div>
          <label style={{fontSize:".72rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:"#7d8590",display:"block",marginBottom:"8px"}}>{qrJoin?`Join Room ${roomCode}`:"Join Existing Room"}</label>
          <div style={{display:"flex",gap:"8px"}}>
            {!qrJoin && <input autoCapitalize="characters" maxLength={8} onChange={e => setRoomCode(normalizeRoomCode(e.target.value))} placeholder="Room code" value={roomCode}
              style={{flex:1,background:"rgba(255,255,255,.06)",border:"1.5px solid rgba(255,255,255,.1)",borderRadius:"10px",color:"#e6edf3",fontSize:".9rem",padding:"12px",outline:"none",fontFamily:"inherit",textTransform:"uppercase",letterSpacing:".1em"}}/>}
            <button type="button" disabled={!playerName.trim()||!roomCode.trim()}
              onClick={() => joinRoom({ nextPlayerName: playerName, nextRoomCode: roomCode })}
              style={{padding:"12px 20px",background:qrJoin?"#3fb950":"rgba(63,185,80,.1)",color:"#3fb950",border:"1.5px solid rgba(63,185,80,.3)",borderRadius:"10px",fontWeight:700,cursor:"pointer",width:qrJoin?"100%":"auto",opacity:(playerName.trim()&&roomCode.trim())?1:.5}}>
              {qrJoin?"Join Room":"Join"}
            </button>
          </div>
        </div>

        <button type="button" onClick={() => setRulesOpen(true)} style={{background:"transparent",border:"1px solid rgba(255,255,255,.1)",borderRadius:"10px",color:"#7d8590",padding:"10px",cursor:"pointer",fontWeight:600,fontSize:".85rem"}}>📖 Read Rules</button>
      </div>
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
    </main>
  );
}
