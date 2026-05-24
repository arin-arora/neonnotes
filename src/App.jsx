import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase";

// ── Theme ─────────────────────────────────────────────────────
const DARK = {
  bg: "#080808", sidebar: "#0c0c0c", border: "#ffffff08",
  text: "#aaa", subtext: "#444", dim: "#2a2a2a",
  inputBg: "#141414", inputBorder: "#1e1e1e",
  noteHover: "#161616", activeNoteBg: ac => `${ac}0c`,
  summaryBg: ac => `${ac}08`, grid: "#ffffff03", toastBg: "#111",
  blockBg: "#141414", blockBorder: ac => `${ac}30`,
};
const LIGHT = {
  bg: "#f2f2f2", sidebar: "#e8e8e8", border: "#00000010",
  text: "#333", subtext: "#888", dim: "#bbb",
  inputBg: "#fff", inputBorder: "#ddd",
  noteHover: "#ddd", activeNoteBg: ac => `${ac}18`,
  summaryBg: ac => `${ac}12`, grid: "#00000004", toastBg: "#fff",
  blockBg: "#fff", blockBorder: ac => `${ac}40`,
};

const DARK_NEON = [
  { accent: "#00ffe0", glow: "#00ffe025" }, { accent: "#ff2d78", glow: "#ff2d7825" },
  { accent: "#afe600", glow: "#afe60025" }, { accent: "#bf00ff", glow: "#bf00ff25" },
  { accent: "#ff7a00", glow: "#ff7a0025" }, { accent: "#00cfff", glow: "#00cfff25" },
];
const LIGHT_NEON = [
  { accent: "#00897b", glow: "#00897b20" }, { accent: "#d81b60", glow: "#d81b6020" },
  { accent: "#7cb300", glow: "#7cb30020" }, { accent: "#6a00cc", glow: "#6a00cc20" },
  { accent: "#e65100", glow: "#e6510020" }, { accent: "#0077b6", glow: "#0077b620" },
];

const uid = () => Math.random().toString(36).slice(2, 9);
function makeTextBlock(content = "") { return { type: "text", id: uid(), content }; }
function makeMediaBlock(type, src, extra = {}) { return { type, id: uid(), src, width: 200, ...extra }; }

function timeAgo(ts) {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

// ── PIN Modal ─────────────────────────────────────────────────
function PinModal({ accent, mode, onConfirm, onCancel, isDark }) {
  const [pin, setPin] = useState(""); const [confirm, setConfirm] = useState(""); const [err, setErr] = useState("");
  const T = isDark ? DARK : LIGHT;
  function submit() {
    if (mode === "set") { if (pin.length < 4) return setErr("Min 4 digits"); if (pin !== confirm) return setErr("PINs don't match"); onConfirm(pin); }
    else { if (!pin) return setErr("Enter PIN"); onConfirm(pin); }
  }
  return (
    <div style={{ position:"fixed",inset:0,background:isDark?"#000000dd":"#00000055",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)" }}>
      <div style={{ background:T.sidebar,border:`1px solid ${accent}50`,borderRadius:18,padding:"36px 32px",width:320,boxShadow:`0 0 60px ${accent}25`,fontFamily:"'DM Mono',monospace" }}>
        <div style={{ fontSize:28,textAlign:"center",marginBottom:8 }}>{mode==="set"?"🔒":"🔓"}</div>
        <div style={{ fontSize:12,color:accent,letterSpacing:3,marginBottom:24,textAlign:"center" }}>{mode==="set"?"SET A PIN":mode==="remove"?"CONFIRM TO REMOVE":"ENTER PIN"}</div>
        <input autoFocus type="password" inputMode="numeric" maxLength={8} placeholder="••••" value={pin}
          onChange={e=>{setPin(e.target.value.replace(/\D/,""));setErr("");}} onKeyDown={e=>e.key==="Enter"&&submit()}
          style={{ width:"100%",background:T.inputBg,border:`1px solid ${accent}40`,borderRadius:10,padding:"12px 16px",color:T.text,fontSize:20,fontFamily:"inherit",outline:"none",marginBottom:12,letterSpacing:8,textAlign:"center",boxSizing:"border-box" }} />
        {mode==="set"&&<input type="password" inputMode="numeric" maxLength={8} placeholder="Confirm" value={confirm}
          onChange={e=>{setConfirm(e.target.value.replace(/\D/,""));setErr("");}} onKeyDown={e=>e.key==="Enter"&&submit()}
          style={{ width:"100%",background:T.inputBg,border:`1px solid ${accent}40`,borderRadius:10,padding:"12px 16px",color:T.text,fontSize:20,fontFamily:"inherit",outline:"none",marginBottom:12,letterSpacing:8,textAlign:"center",boxSizing:"border-box" }} />}
        {err&&<div style={{ color:"#ff2d78",fontSize:11,marginBottom:12,textAlign:"center" }}>{err}</div>}
        <div style={{ display:"flex",gap:10,marginTop:8 }}>
          <button onClick={onCancel} style={{ flex:1,padding:"11px 0",background:"transparent",border:`1px solid ${T.inputBorder}`,borderRadius:10,color:T.subtext,cursor:"pointer",fontFamily:"inherit",fontSize:11,letterSpacing:1 }}>CANCEL</button>
          <button onClick={submit} style={{ flex:1,padding:"11px 0",background:`${accent}18`,border:`1px solid ${accent}`,borderRadius:10,color:accent,cursor:"pointer",fontFamily:"inherit",fontSize:11,letterSpacing:1 }}>{mode==="set"?"LOCK IT":"CONFIRM"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Mic Button ────────────────────────────────────────────────
function MicButton({ accent, onAudioReady, isDark }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef(null); const chunksRef = useRef([]); const timerRef = useRef(null); const secRef = useRef(0);
  async function toggle() {
    if (recording) { recRef.current?.stop(); clearInterval(timerRef.current); setRecording(false); setSeconds(0); secRef.current=0; return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size>0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type:"audio/webm" });
        const reader = new FileReader();
        reader.onload = ev => onAudioReady({ id:uid(), src:ev.target.result, duration:secRef.current });
        reader.readAsDataURL(blob); stream.getTracks().forEach(t=>t.stop());
      };
      mr.start(); recRef.current=mr; setRecording(true); setSeconds(0); secRef.current=0;
      timerRef.current = setInterval(()=>{ secRef.current+=1; setSeconds(s=>s+1); }, 1000);
    } catch { alert("Microphone access denied."); }
  }
  const fmt = s => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  return (
    <div style={{ display:"flex",alignItems:"center",gap:6,flexShrink:0 }}>
      {recording&&<div style={{ display:"flex",alignItems:"center",gap:5,background:"#ff2d7815",border:"1px solid #ff2d7840",borderRadius:20,padding:"3px 10px" }}>
        <div style={{ width:6,height:6,borderRadius:"50%",background:"#ff2d78",boxShadow:"0 0 6px #ff2d78",animation:"blink 1s ease infinite" }} />
        <span style={{ fontSize:11,color:"#ff2d78",fontFamily:"'DM Mono',monospace",letterSpacing:1 }}>{fmt(seconds)}</span>
      </div>}
      <button onClick={toggle} title={recording?"Stop":"Record voice"}
        style={{ width:36,height:36,borderRadius:"50%",border:`1px solid ${recording?"#ff2d78":(isDark?"#2a2a2a":"#ccc")}`,background:recording?"#ff2d7820":"transparent",color:recording?"#ff2d78":(isDark?"#444":"#999"),cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:recording?"0 0 16px #ff2d7850":"none",transition:"all 0.2s" }}>🎤</button>
    </div>
  );
}

// ── Media Block ───────────────────────────────────────────────
function MediaBlock({ block, accent, isDark, onSizeChange, onDelete }) {
  const T = isDark ? DARK : LIGHT;
  const [width, setWidth] = useState(block.width || 200);
  const widthRef = useRef(block.width || 200);
  function startResize(e) {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX, startW = widthRef.current;
    const move = me => { const nw = Math.max(120, Math.min(480, startW + (me.clientX - startX))); widthRef.current = nw; setWidth(nw); };
    const up = () => { onSizeChange({ width: widthRef.current }); window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }
  const h = Math.round(width * 16 / 9);
  return (
    <div style={{ display:"inline-block", position:"relative", margin:"10px 12px 10px 0", verticalAlign:"top" }}>
      <div style={{ width, height: block.type==="audio" ? "auto" : h, borderRadius:12, overflow:"hidden", border:`1px solid ${T.blockBorder(accent)}`, boxShadow:`0 0 20px ${accent}25`, background:"#000", position:"relative" }}>
        {block.type==="image" && <img src={block.src} alt="upload" style={{ width:"100%", height:"100%", display:"block", objectFit:"cover" }} />}
        {block.type==="video" && <video src={block.src} controls style={{ width:"100%", height:"100%", display:"block", background:"#000", objectFit:"contain" }} />}
        {block.type==="audio" && (
          <div style={{ width:240, padding:"12px 14px", display:"flex", alignItems:"center", gap:10, background:T.blockBg }}>
            <span style={{ fontSize:16, flexShrink:0 }}>🎙️</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:9, color:accent, letterSpacing:1, marginBottom:4 }}>Voice · {block.duration ?? "?"}s</div>
              <audio src={block.src} controls style={{ width:"100%", height:24, accentColor:accent }} />
            </div>
            <button onClick={onDelete} style={{ background:"transparent", border:"none", color:"#ff2d78", cursor:"pointer", fontSize:16, lineHeight:1, padding:0, flexShrink:0 }}>×</button>
          </div>
        )}
      </div>
      {block.type!=="audio" && (
        <div onMouseDown={startResize} style={{ position:"absolute", top:0, bottom:0, right:-10, width:10, cursor:"ew-resize", display:"flex", alignItems:"center", justifyContent:"center", userSelect:"none", zIndex:10 }}>
          <div style={{ width:4, height:36, borderRadius:2, background:accent, opacity:0.8, boxShadow:`0 0 8px ${accent}` }} />
        </div>
      )}
    </div>
  );
}

// ── Content Editor ────────────────────────────────────────────
function ContentEditor({ blocks, onChange, accent, isDark, focusedBlockId, setFocusedBlockId, fontSize }) {
  const T = isDark ? DARK : LIGHT;
  const refs = useRef({});
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [dragPos, setDragPos] = useState({x:0,y:0});
  const blockRefs = useRef({});
  const overIdRef = useRef(null);
  const blocksRef = useRef(blocks);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  // ── Blocks-level undo stack (for media delete, drag reorder, resize) ──
  const blocksHistory = useRef([blocks]);
  const blocksHistPtr = useRef(0);

  function pushBlocksHistory(newBlocks) {
    const history = blocksHistory.current.slice(0, blocksHistPtr.current + 1);
    history.push(newBlocks);
    if (history.length > 50) history.shift();
    blocksHistory.current = history;
    blocksHistPtr.current = history.length - 1;
  }

  // Wrap onChange to record history for media-level operations
  function onChangeWithHistory(newBlocks) {
    pushBlocksHistory(newBlocks);
    onChange(newBlocks);
  }

  // ── Undo stack per block (text) ──
  const undoStack = useRef({});  // { blockId: [string, ...] }
  const undoPtr   = useRef({});  // { blockId: number }
  const skipPush  = useRef(false);

  function getStack(id) {
    if (!undoStack.current[id]) { undoStack.current[id] = [""]; undoPtr.current[id] = 0; }
    return { stack: undoStack.current[id], ptr: undoPtr.current[id] };
  }

  function pushUndo(id, val) {
    if (skipPush.current) { skipPush.current = false; return; }
    const { stack, ptr } = getStack(id);
    const trimmed = stack.slice(0, ptr + 1);
    // Only push if value changed meaningfully (every ~300ms debounce handled by batching)
    if (trimmed[trimmed.length - 1] === val) return;
    trimmed.push(val);
    if (trimmed.length > 100) trimmed.shift();
    undoStack.current[id] = trimmed;
    undoPtr.current[id] = trimmed.length - 1;
  }

  function updateText(id, val) {
    pushUndo(id, val);
    onChange(blocksRef.current.map(b => b.id===id ? {...b, content:val} : b));
  }

  function handleUndoRedo(e, id) {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const ctrl = isMac ? e.metaKey : e.ctrlKey;
    if (!ctrl) return false;

    if (e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      // First try text undo within the block
      const { stack, ptr } = getStack(id);
      if (ptr > 0) {
        const newPtr = ptr - 1;
        undoPtr.current[id] = newPtr;
        skipPush.current = true;
        const val = stack[newPtr];
        onChange(blocksRef.current.map(b => b.id===id ? {...b, content:val} : b));
        setTimeout(() => { const el = refs.current[id]; if (el) { el.selectionStart = el.selectionEnd = val.length; } }, 0);
        return true;
      }
      // Fall back to blocks-level undo (media delete/reorder/resize)
      const hptr = blocksHistPtr.current;
      if (hptr > 0) {
        blocksHistPtr.current = hptr - 1;
        onChange(blocksHistory.current[hptr - 1]);
      }
      return true;
    }

    if ((e.key === "z" && e.shiftKey) || e.key === "y") {
      e.preventDefault();
      // First try text redo
      const { stack, ptr } = getStack(id);
      if (ptr < stack.length - 1) {
        const newPtr = ptr + 1;
        undoPtr.current[id] = newPtr;
        skipPush.current = true;
        const val = stack[newPtr];
        onChange(blocksRef.current.map(b => b.id===id ? {...b, content:val} : b));
        setTimeout(() => { const el = refs.current[id]; if (el) { el.selectionStart = el.selectionEnd = val.length; } }, 0);
        return true;
      }
      // Fall back to blocks-level redo
      const hptr = blocksHistPtr.current;
      if (hptr < blocksHistory.current.length - 1) {
        blocksHistPtr.current = hptr + 1;
        onChange(blocksHistory.current[hptr + 1]);
      }
      return true;
    }
    return false;
  }

  // Global Ctrl+Z listener for when no text block is focused (e.g. after dragging)
  useEffect(() => {
    function globalUndoRedo(e) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrl) return;
      // Only handle if no textarea is focused
      if (document.activeElement?.tagName === "TEXTAREA") return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const hptr = blocksHistPtr.current;
        if (hptr > 0) { blocksHistPtr.current = hptr - 1; onChange(blocksHistory.current[hptr - 1]); }
      }
      if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        const hptr = blocksHistPtr.current;
        if (hptr < blocksHistory.current.length - 1) { blocksHistPtr.current = hptr + 1; onChange(blocksHistory.current[hptr + 1]); }
      }
    }
    window.addEventListener("keydown", globalUndoRedo);
    return () => window.removeEventListener("keydown", globalUndoRedo);
  }, [onChange]);

  function handleKeyDown(e, idx) {
    const block = blocks[idx];
    if (block.type === "text" && handleUndoRedo(e, block.id)) return;
    if (e.key !== "Backspace") return;
    if (block.type==="text" && block.content==="" && idx > 0) {
      const prev = blocks[idx-1];
      if (prev.type !== "text") { e.preventDefault(); onChange(blocks.filter((_,i) => i !== idx-1)); return; }
      if (blocks.length > 1) {
        e.preventDefault();
        const nb = blocks.filter((_,i) => i !== idx);
        onChange(nb);
        setTimeout(()=>{ const p = nb[Math.max(0,idx-1)]; if(p?.type==="text") refs.current[p.id]?.focus(); },0);
      }
    }
  }

  function deleteBlock(id) { const nb = blocks.filter(b=>b.id!==id); onChangeWithHistory(nb.length===0 ? [makeTextBlock()] : nb); }

  function startDrag(e, id) {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = blockRefs.current[id];
    const rect = el?.getBoundingClientRect() || {left:0,top:0};
    const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
    setDragId(id); overIdRef.current = null;
    const move = me => {
      setDragPos({ x: me.clientX - ox, y: me.clientY - oy });
      let found = null, bestDist = Infinity;
      Object.entries(blockRefs.current).forEach(([bid, el]) => {
        if (!el || bid === id) return;
        const r = el.getBoundingClientRect();
        const dist = Math.abs(me.clientY - (r.top + r.bottom) / 2);
        if (me.clientY >= r.top - 40 && me.clientY <= r.bottom + 40 && dist < bestDist) { bestDist = dist; found = bid; }
      });
      overIdRef.current = found; setOverId(found);
    };
    const up = () => {
      const targetId = overIdRef.current;
      if (targetId && targetId !== id) {
        const cur = blocksRef.current;
        const from = cur.findIndex(b=>b.id===id), to = cur.findIndex(b=>b.id===targetId);
        if (from !== -1 && to !== -1) { const nb = [...cur]; const [moved] = nb.splice(from, 1); nb.splice(to, 0, moved); onChangeWithHistory(nb); }
      }
      setDragId(null); setOverId(null); overIdRef.current = null;
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }

  const dragBlock = blocks.find(b=>b.id===dragId);
  return (
    <div style={{ padding:"20px 36px", minHeight:"100%", boxSizing:"border-box", position:"relative" }}
      onClick={e => { if (e.target===e.currentTarget) { const last = blocks[blocks.length-1]; if (last?.type==="text") refs.current[last.id]?.focus(); } }}>
      {dragId && dragBlock && dragBlock.type !== "text" && (
        <div style={{ position:"fixed", left:dragPos.x, top:dragPos.y, pointerEvents:"none", zIndex:9999, opacity:0.85, transform:"rotate(2deg) scale(1.04)" }}>
          <MediaBlock block={dragBlock} accent={accent} isDark={isDark} onSizeChange={()=>{}} onDelete={()=>{}} />
        </div>
      )}
      {blocks.map((block, idx) => {
        const isBeingDragged = block.id === dragId && block.type !== "text";
        const isOverTarget = block.id === overId && block.id !== dragId;
        if (block.type==="text") return (
          <textarea key={block.id} ref={el=>{ refs.current[block.id]=el; blockRefs.current[block.id]=el; }}
            value={block.content} onChange={e=>updateText(block.id, e.target.value)}
            onKeyDown={e=>handleKeyDown(e,idx)} onFocus={()=>setFocusedBlockId(block.id)}
            placeholder={idx===0?"Start writing, or use 🎤 📎 above...":""}
            style={{ display:"block", width:"100%", background:"transparent", border:"none", outline:"none", resize:"none", fontSize: fontSize||13, lineHeight:2, color:T.text, fontFamily:"'DM Mono',monospace", caretColor:accent, boxSizing:"border-box", minHeight:40, overflow:"hidden" }}
            rows={1} onInput={e=>{ e.target.style.height="auto"; e.target.style.height=Math.max(40,e.target.scrollHeight)+"px"; }}
          />
        );
        return (
          <div key={block.id} ref={el=>blockRefs.current[block.id]=el}
            style={{ display:"inline-block", verticalAlign:"top", opacity: isBeingDragged ? 0.2 : 1, transform: isOverTarget ? "translateY(-6px) scale(1.03)" : "translateY(0) scale(1)", transition:"transform 0.18s ease, opacity 0.15s ease", cursor: dragId ? "grabbing" : "grab", marginRight: isOverTarget ? 18 : 0, filter: isOverTarget ? `drop-shadow(0 0 12px ${accent})` : "none" }}>
            <div onMouseDown={e => startDrag(e, block.id)} style={{ height:14, display:"flex", alignItems:"center", justifyContent:"center", cursor:"grab", marginBottom:2, userSelect:"none" }}>
              <div style={{ width:28, height:3, borderRadius:2, background: isDark?"#333":"#ccc" }} />
            </div>
            <MediaBlock block={block} accent={accent} isDark={isDark}
              onSizeChange={s=>onChangeWithHistory(blocks.map(b=>b.id===block.id?{...b,...s}:b))}
              onDelete={()=>deleteBlock(block.id)} />
          </div>
        );
      })}
    </div>
  );
}

// ── Note Editor ───────────────────────────────────────────────
function NoteEditor({ note, onUpdate, onClose, onAI, aiLoading, isDark, NEON, onToast }) {
  const accent = NEON[note.color].accent;
  const T = isDark ? DARK : LIGHT;
  const [unlocked, setUnlocked] = useState(!note.locked);
  const [pinModal, setPinModal] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(note.title);
  const [wrongPin, setWrongPin] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState(null);
  const [fontSize, setFontSize] = useState(note.fontSize || 13);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const fileRef = useRef();

  useEffect(()=>{ setUnlocked(!note.locked); setWrongPin(false); },[note.id,note.locked]);
  useEffect(()=>{ setTitleVal(note.title); },[note.title]);
  useEffect(()=>{
    if (!showFontMenu) return;
    const close = () => setShowFontMenu(false);
    setTimeout(() => window.addEventListener("click", close), 0);
    return () => window.removeEventListener("click", close);
  }, [showFontMenu]);

  const blocks = note.blocks || [makeTextBlock()];
  function setBlocks(b) { onUpdate({ blocks: b }); }
  function changeFontSize(s) { setFontSize(s); setShowFontMenu(false); onUpdate({ fontSize: s }); }

  function insertMediaAfterCursor(mediaBlock) {
    const idx = focusedBlockId ? blocks.findIndex(b=>b.id===focusedBlockId) : blocks.length-1;
    const insertAt = idx>=0 ? idx+1 : blocks.length;
    const nb = [...blocks];
    nb.splice(insertAt, 0, mediaBlock);
    if (!nb[insertAt+1] || nb[insertAt+1].type!=="text") nb.splice(insertAt+1,0,makeTextBlock());
    setBlocks(nb);
  }

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = e => insertMediaAfterCursor(makeMediaBlock("image", e.target.result));
        reader.readAsDataURL(file);
      } else if (file.type.startsWith("video/")) {
        const url = URL.createObjectURL(file);
        const v = document.createElement("video"); v.src=url;
        v.onloadedmetadata = () => {
          if (v.duration>30) { URL.revokeObjectURL(url); onToast("❌ Video must be ≤30 seconds"); return; }
          const reader = new FileReader();
          reader.onload = e => { insertMediaAfterCursor(makeMediaBlock("video", e.target.result)); URL.revokeObjectURL(url); };
          reader.readAsDataURL(file);
        };
      }
    });
  }

  function handleAudio(audio) { insertMediaAfterCursor(makeMediaBlock("audio", audio.src, { duration: audio.duration })); onToast("🎤 Voice recorded!"); }

  function handlePinConfirm(pin) {
    if (pinModal==="set") { onUpdate({ locked:true, pin }); setUnlocked(false); setPinModal(null); }
    else if (pinModal==="unlock") { if (pin===note.pin) { setUnlocked(true); setWrongPin(false); setPinModal(null); } else { setWrongPin(true); setPinModal(null); } }
    else if (pinModal==="remove") { if (pin===note.pin) { onUpdate({ locked:false, pin:null }); setUnlocked(true); setPinModal(null); } else { setWrongPin(true); setPinModal(null); } }
  }

  function toggleLock() {
    if (!note.locked) setPinModal("set");
    else if (!unlocked) setPinModal("unlock");
    else setPinModal("remove");
  }

  function saveTitle() { onUpdate({ title: titleVal.trim()||"Untitled" }); setEditingTitle(false); }

  const blurred = note.locked && !unlocked;
  const allText = blocks.filter(b=>b.type==="text").map(b=>b.content).join("\n");
  const wordCount = allText.trim() ? allText.trim().split(/\s+/).length : 0;

  return (
    <>
      {pinModal && <PinModal accent={accent} mode={pinModal} onConfirm={handlePinConfirm} onCancel={()=>setPinModal(null)} isDark={isDark} />}
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display:"none" }} onChange={e=>{ handleFiles(e.target.files); e.target.value=""; }} />
      <div style={{ flex:1,display:"flex",flexDirection:"column",height:"100%",animation:"slideIn 0.25s cubic-bezier(.22,1,.36,1)" }}>
        <div style={{ padding:"22px 36px 14px",borderBottom:`1px solid ${accent}18`,background:`linear-gradient(180deg,${accent}05 0%,transparent 100%)`,flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap" }}>
            {editingTitle
              ? <input autoFocus value={titleVal} onChange={e=>setTitleVal(e.target.value)} onBlur={saveTitle} onKeyDown={e=>e.key==="Enter"&&saveTitle()}
                  style={{ flex:1,minWidth:120,background:"transparent",border:"none",borderBottom:`1px solid ${accent}60`,outline:"none",color:accent,fontSize:24,fontFamily:"'DM Mono',monospace",fontWeight:700,letterSpacing:1,paddingBottom:4 }} />
              : <h1 onDoubleClick={()=>setEditingTitle(true)} title="Double-click to rename"
                  style={{ flex:1,minWidth:0,fontSize:24,fontWeight:700,color:accent,letterSpacing:1,textShadow:isDark?`0 0 24px ${accent}60`:"none",cursor:"text",margin:0,fontFamily:"'DM Mono',monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                  {note.title}
                </h1>}
            <div style={{ display:"flex",alignItems:"center",gap:7,flexShrink:0 }}>
              {NEON.map((c,i)=>(
                <div key={i} onClick={()=>onUpdate({color:i})}
                  style={{ width:note.color===i?14:9,height:note.color===i?14:9,borderRadius:"50%",background:c.accent,cursor:"pointer",boxShadow:note.color===i?`0 0 10px ${c.accent}`:"none",border:note.color===i?`2px solid ${isDark?"#fff":"#333"}`:"2px solid transparent",transition:"all 0.2s" }} />
              ))}
              {!blurred && <button onClick={()=>fileRef.current?.click()} title="Upload image or video (≤30s)"
                style={{ width:34,height:34,borderRadius:"50%",border:`1px solid ${isDark?"#2a2a2a":"#ccc"}`,background:"transparent",color:isDark?"#444":"#999",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s" }}>📎</button>}
              {!blurred && <MicButton accent={accent} onAudioReady={handleAudio} isDark={isDark} />}
              <button onClick={toggleLock}
                style={{ width:34,height:34,borderRadius:"50%",background:note.locked?`${accent}15`:"transparent",border:`1px solid ${note.locked?accent+"50":(isDark?"#2a2a2a":"#ccc")}`,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",color:note.locked?accent:(isDark?"#444":"#999"),transition:"all 0.2s" }}>
                {note.locked?(unlocked?"🔓":"🔒"):"🔓"}
              </button>
              {/* Font size dropdown */}
              {!blurred && (
                <div style={{ position:"relative" }}>
                  <button onClick={e=>{ e.stopPropagation(); setShowFontMenu(m=>!m); }}
                    style={{ height:34,padding:"0 10px",borderRadius:8,border:`1px solid ${showFontMenu?accent:(isDark?"#2a2a2a":"#ccc")}`,background:showFontMenu?`${accent}15`:"transparent",color:showFontMenu?accent:(isDark?"#888":"#777"),cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap",transition:"all 0.2s",letterSpacing:1 }}>
                    <span style={{ fontSize:13 }}>Aa</span><span>{fontSize}px</span><span style={{ fontSize:9,opacity:0.6 }}>▾</span>
                  </button>
                  {showFontMenu && (
                    <div style={{ position:"absolute",top:"calc(100% + 8px)",right:0,background:isDark?"#111":"#fff",border:`1px solid ${accent}40`,borderRadius:12,padding:"6px",zIndex:999,boxShadow:`0 8px 32px #00000060,0 0 20px ${accent}15`,minWidth:130 }}>
                      <div style={{ fontSize:9,color:isDark?"#333":"#bbb",letterSpacing:2,padding:"4px 10px 8px",borderBottom:`1px solid ${isDark?"#1e1e1e":"#eee"}`,marginBottom:4 }}>TEXT SIZE</div>
                      {[{label:"Tiny",size:10},{label:"Small",size:12},{label:"Normal",size:14},{label:"Medium",size:16},{label:"Large",size:20},{label:"Huge",size:26}].map(({label,size})=>(
                        <div key={size} onClick={()=>changeFontSize(size)}
                          style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 12px",borderRadius:8,cursor:"pointer",background:fontSize===size?`${accent}18`:"transparent",color:fontSize===size?accent:(isDark?"#aaa":"#444"),transition:"background 0.15s" }}>
                          <span style={{ fontSize:11,fontFamily:"'DM Mono',monospace",letterSpacing:1 }}>{label}</span>
                          <span style={{ fontSize:Math.min(size,16),color:fontSize===size?accent:(isDark?"#555":"#aaa") }}>Aa</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!blurred && <button onClick={()=>onAI(note.id)} disabled={aiLoading===note.id}
                style={{ padding:"7px 14px",background:aiLoading===note.id?T.inputBg:`${accent}15`,border:`1px solid ${aiLoading===note.id?T.inputBorder:accent}`,borderRadius:8,color:aiLoading===note.id?T.subtext:accent,fontSize:10,fontFamily:"'DM Mono',monospace",cursor:aiLoading===note.id?"not-allowed":"pointer",letterSpacing:1.5,transition:"all 0.3s",whiteSpace:"nowrap" }}>
                {aiLoading===note.id?"⟳ THINKING...":"✦ AI SUMMARY"}
              </button>}
              <button onClick={onClose}
                style={{ width:34,height:34,borderRadius:"50%",background:"transparent",border:`1px solid ${isDark?"#2a2a2a":"#ccc"}`,color:isDark?"#444":"#999",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s" }}>×</button>
            </div>
          </div>
          <div style={{ fontSize:9,color:T.dim,letterSpacing:2 }}>
            {timeAgo(note.created_at||note.createdAt)} · {wordCount} WORDS
            {note.summary&&<span style={{ color:accent,marginLeft:12 }}>· ✦ SUMMARIZED</span>}
          </div>
        </div>
        <div style={{ flex:1,overflowY:"auto",position:"relative" }}>
          {blurred ? (
            <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,cursor:"pointer" }} onClick={()=>setPinModal("unlock")}>
              <div style={{ fontSize:52 }}>🔒</div>
              <div style={{ fontSize:11,color:T.subtext,letterSpacing:3 }}>CLICK TO UNLOCK</div>
              {wrongPin&&<div style={{ fontSize:11,color:"#ff2d78",letterSpacing:1,animation:"shake 0.4s ease" }}>WRONG PIN — TRY AGAIN</div>}
            </div>
          ) : (
            <ContentEditor blocks={blocks} onChange={setBlocks} accent={accent} isDark={isDark}
              focusedBlockId={focusedBlockId} setFocusedBlockId={setFocusedBlockId} fontSize={fontSize} />
          )}
        </div>
        {note.summary&&!blurred&&(
          <div style={{ margin:"0 36px 20px",padding:"16px 20px",background:T.summaryBg(accent),border:`1px solid ${accent}25`,borderRadius:14,flexShrink:0 }}>
            <div style={{ fontSize:9,color:accent,letterSpacing:4,marginBottom:8 }}>✦ AI SUMMARY</div>
            <div style={{ fontSize:12,color:T.text,lineHeight:1.9,whiteSpace:"pre-wrap",fontFamily:"'DM Mono',monospace" }}>{note.summary}</div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Auth Modal ────────────────────────────────────────────────
function AuthModal({ accent, onClose, isDark, onSignIn }) {
  const T = isDark ? DARK : LIGHT;
  async function signInGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
    if (error) alert(error.message);
  }
  async function signInApple() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "apple" });
    if (error) alert(error.message);
  }
  return (
    <div style={{ position:"fixed",inset:0,background:isDark?"#000000dd":"#00000055",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)" }}>
      <div style={{ background:T.sidebar,border:`1px solid ${accent}40`,borderRadius:20,padding:"40px 36px",width:340,boxShadow:`0 0 60px ${accent}20`,fontFamily:"'DM Mono',monospace",textAlign:"center" }}>
        <div style={{ fontSize:32,marginBottom:12 }}>⚡</div>
        <div style={{ fontSize:14,color:accent,letterSpacing:3,marginBottom:6,textShadow:isDark?`0 0 12px ${accent}`:"none" }}>NEONNOTES</div>
        <div style={{ fontSize:10,color:T.subtext,letterSpacing:2,marginBottom:32 }}>SIGN IN TO SYNC YOUR NOTES</div>
        <button onClick={signInGoogle}
          style={{ width:"100%",padding:"13px 0",background:"transparent",border:`1px solid ${isDark?"#333":"#ddd"}`,borderRadius:12,color:T.text,cursor:"pointer",fontFamily:"inherit",fontSize:12,letterSpacing:1,display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:12,transition:"all 0.2s" }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.2 30.3 0 24 0 14.6 0 6.6 5.6 2.7 13.8l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/><path fill="#FBBC05" d="M10.6 28.6A14.9 14.9 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.8.9 7.4 2.5 10.6l8.1-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.2 1.5-5 2.3-8.4 2.3-6.2 0-11.5-4.2-13.4-9.9l-8.1 6C6.6 42.4 14.6 48 24 48z"/></svg>
          Continue with Google
        </button>
        <button onClick={signInApple}
          style={{ width:"100%",padding:"13px 0",background:isDark?"#fff":"#000",border:"none",borderRadius:12,color:isDark?"#000":"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:12,letterSpacing:1,display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:24,transition:"all 0.2s" }}>
          <svg width="18" height="18" viewBox="0 0 814 1000" fill={isDark?"#000":"#fff"}><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-54.2-155.5-127.5C46.7 790.7 0 663.8 0 541.8c0-203.1 132.4-310.3 261.7-310.3 61.2 0 111.9 40.2 149.9 40.2 36 0 92.7-42.8 161.3-42.8 25.8 0 111.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/></svg>
          Continue with Apple
        </button>
        <button onClick={onClose} style={{ background:"transparent",border:"none",color:T.subtext,cursor:"pointer",fontSize:11,fontFamily:"inherit",letterSpacing:2 }}>MAYBE LATER</button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState("");
  const [aiLoading, setAiLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [isDark, setIsDark] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const NEON = isDark ? DARK_NEON : LIGHT_NEON;
  const T = isDark ? DARK : LIGHT;

  // ── Auth listener ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch notes ──
  useEffect(() => { fetchNotes(); }, [user]);

  async function fetchNotes() {
    setLoading(true);
    const query = supabase.from("notes").select("*").order("created_at", { ascending: false });
    if (user) query.eq("user_id", user.id);
    const { data, error } = await query;
    if (!error && data) setNotes(data);
    setLoading(false);
  }

  // ── CRUD — fixed: no nested function, all ops sync to Supabase ──
  async function addNote() {
    const newNote = {
      title: "New Note",
      blocks: [makeTextBlock()],
      summary: null,
      color: Math.floor(Math.random() * NEON.length),
      locked: false,
      pin: null,
      font_size: 13,
      ...(user ? { user_id: user.id } : {}),
    };
    const { data, error } = await supabase.from("notes").insert([newNote]).select();
    if (error) { showToast("❌ Could not create note"); console.error(error); return; }
    if (data?.[0]) { setNotes(prev => [data[0], ...prev]); setActiveId(data[0].id); }
  }

  async function updateNote(id, patch) {
    // Optimistic update
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
    await supabase.from("notes").update(patch).eq("id", id);
  }

  async function deleteNote(id) {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (activeId === id) setActiveId(null);
    await supabase.from("notes").delete().eq("id", id);
  }

  async function aiSummarize(id) {
    const note = notes.find(n => n.id === id);
    const text = note?.blocks?.filter(b => b.type === "text").map(b => b.content).join("\n").trim();
    if (!text) return showToast("✍️ Write something first!");
    setAiLoading(id);
    try {
      const res = await fetch("YOUR_BACKEND_URL/summarize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      await updateNote(id, { summary: data.summary });
      showToast("✨ Summary ready!");
    } catch { showToast("❌ AI error — check your backend URL"); }
    finally { setAiLoading(null); }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  const activeNote = notes.find(n => n.id === activeId) ?? null;
  const filtered = notes.filter(n =>
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.blocks?.some(b => b.type === "text" && b.content?.toLowerCase().includes(search.toLowerCase()))
  );

  const globalAccent = activeNote ? NEON[activeNote.color].accent : NEON[0].accent;
  const globalGlow   = activeNote ? NEON[activeNote.color].glow   : NEON[0].glow;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{overflow:hidden;}
        textarea,input{user-select:text!important;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:#33333360;border-radius:4px;}
        @keyframes slideIn{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
        .note-row:hover{background:${T.noteHover}!important;}
        .note-row:hover .del-btn{opacity:1!important;}
        textarea{overflow:hidden;}
      `}</style>

      {showAuth && <AuthModal accent={globalAccent} isDark={isDark} onClose={() => setShowAuth(false)} />}

      <div style={{ width:"100vw",height:"100vh",background:T.bg,display:"flex",fontFamily:"'DM Mono',monospace",overflow:"hidden",transition:"background 0.4s" }}>
        <div style={{ position:"fixed",width:700,height:700,borderRadius:"50%",background:`radial-gradient(circle,${globalGlow} 0%,transparent 70%)`,top:"10%",left:"35%",pointerEvents:"none",transition:"background 0.6s",zIndex:0 }} />
        <div style={{ position:"fixed",inset:0,backgroundImage:`linear-gradient(${T.grid} 1px,transparent 1px),linear-gradient(90deg,${T.grid} 1px,transparent 1px)`,backgroundSize:"48px 48px",pointerEvents:"none",zIndex:0 }} />

        {/* SIDEBAR */}
        <div style={{ width:260,minWidth:260,background:T.sidebar,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",zIndex:10,transition:"background 0.4s" }}>
          <div style={{ padding:"20px 18px 14px",borderBottom:`1px solid ${T.border}` }}>
            <div style={{ fontSize:13,fontWeight:500,color:globalAccent,letterSpacing:4,textShadow:isDark?`0 0 16px ${globalAccent}70`:"none",transition:"color 0.4s" }}>NEONNOTES</div>
            <div style={{ fontSize:8,color:T.dim,letterSpacing:3,marginTop:2 }}>AI · POWERED · NOTES</div>
          </div>
          <div style={{ padding:"10px 14px",borderBottom:`1px solid ${T.border}` }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes..."
              style={{ width:"100%",background:T.inputBg,border:`1px solid ${T.inputBorder}`,borderRadius:8,padding:"8px 12px",color:T.text,fontSize:11,fontFamily:"inherit",outline:"none",transition:"all 0.3s" }} />
          </div>
          <div style={{ padding:"10px 14px",borderBottom:`1px solid ${T.border}` }}>
            <button onClick={addNote}
              style={{ width:"100%",padding:"9px 0",background:"transparent",border:`1px solid ${globalAccent}50`,borderRadius:9,color:globalAccent,fontSize:10,fontFamily:"inherit",cursor:"pointer",letterSpacing:2,textShadow:isDark?`0 0 8px ${globalAccent}60`:"none",transition:"all 0.25s" }}>
              + NEW NOTE
            </button>
          </div>
          <div style={{ flex:1,overflowY:"auto",padding:"6px 0" }}>
            {loading && <div style={{ padding:"32px 20px",textAlign:"center",color:T.dim,fontSize:10,letterSpacing:2 }}>LOADING...</div>}
            {!loading && filtered.length===0 && <div style={{ padding:"32px 20px",textAlign:"center",color:T.dim,fontSize:10,letterSpacing:2 }}>NO NOTES</div>}
            {filtered.map(note => {
              const ac = NEON[note.color]?.accent || NEON[0].accent;
              const isActive = note.id === activeId;
              const preview = note.blocks?.find(b=>b.type==="text")?.content?.slice(0,30) || "";
              const mediaCount = note.blocks?.filter(b=>b.type!=="text").length || 0;
              return (
                <div key={note.id} className="note-row" onClick={()=>setActiveId(note.id)}
                  style={{ padding:"11px 16px",cursor:"pointer",position:"relative",background:isActive?T.activeNoteBg(ac):"transparent",borderLeft:`2px solid ${isActive?ac:"transparent"}`,transition:"all 0.2s",marginBottom:1 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3 }}>
                    <div style={{ width:6,height:6,borderRadius:"50%",background:ac,boxShadow:isDark?`0 0 6px ${ac}`:"none",flexShrink:0 }} />
                    <span style={{ fontSize:11,fontWeight:500,color:isActive?ac:T.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",transition:"all 0.2s" }}>{note.title}</span>
                    {note.locked&&<span style={{ fontSize:10 }}>🔒</span>}
                    {mediaCount>0&&<span style={{ fontSize:9,color:T.subtext }}>📎{mediaCount}</span>}
                    {note.summary&&<span style={{ fontSize:8,color:ac,letterSpacing:1 }}>AI</span>}
                  </div>
                  <div style={{ fontSize:10,color:T.dim,paddingLeft:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{note.locked?"•••••••":preview||"Empty note..."}</div>
                  <div style={{ fontSize:9,color:T.dim,paddingLeft:12,marginTop:3,letterSpacing:1,opacity:.6 }}>{timeAgo(note.created_at||Date.now())}</div>
                  <button className="del-btn" onClick={e=>{e.stopPropagation();deleteNote(note.id);}}
                    style={{ position:"absolute",top:10,right:10,background:"transparent",border:"none",color:"#ff2d78",cursor:"pointer",fontSize:14,opacity:0,transition:"opacity 0.2s",padding:2,lineHeight:1 }}>×</button>
                </div>
              );
            })}
          </div>
          <div style={{ borderTop:`1px solid ${T.border}`,padding:"12px 14px",display:"flex",flexDirection:"column",gap:8 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <span style={{ fontSize:9,color:T.dim,letterSpacing:2 }}>{isDark?"DARK MODE":"LIGHT MODE"}</span>
              <button onClick={()=>setIsDark(d=>!d)}
                style={{ width:44,height:24,borderRadius:12,background:isDark?`${globalAccent}30`:"#ddd",border:`1px solid ${isDark?globalAccent+"50":"#ccc"}`,cursor:"pointer",position:"relative",transition:"all 0.3s" }}>
                <div style={{ position:"absolute",top:3,left:isDark?"calc(100% - 20px)":3,width:16,height:16,borderRadius:"50%",background:isDark?globalAccent:"#888",transition:"all 0.3s",boxShadow:isDark?`0 0 6px ${globalAccent}`:"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8 }}>
                  {isDark?"🌙":"☀️"}
                </div>
              </button>
            </div>
            <button onClick={()=>setShowAuth(true)}
              style={{ width:"100%",padding:"10px 0",background:isDark?`${globalAccent}10`:"#f5f5f5",border:`1px solid ${globalAccent}30`,borderRadius:10,color:globalAccent,fontSize:10,fontFamily:"inherit",cursor:"pointer",letterSpacing:1.5,display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all 0.2s" }}>
              <span style={{ fontSize:15 }}>{user?"👤":"🔑"}</span>
              {user ? (user.user_metadata?.name||user.email||"ACCOUNT").toUpperCase() : "SIGN IN / ACCOUNT"}
            </button>
            <div style={{ fontSize:9,color:T.dim,letterSpacing:1,textAlign:"center" }}>{notes.length} NOTE{notes.length!==1?"S":""}</div>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex:1,display:"flex",flexDirection:"column",zIndex:1,overflow:"hidden" }}>
          {!activeNote ? (
            <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,animation:"fadeUp 0.4s ease" }}>
              <div style={{ fontSize:54 }}>📝</div>
              <div style={{ fontSize:11,color:T.dim,letterSpacing:4 }}>SELECT A NOTE OR CREATE ONE</div>
              <button onClick={addNote}
                style={{ marginTop:4,padding:"10px 20px",background:"transparent",border:`1px solid ${globalAccent}50`,borderRadius:10,color:globalAccent,fontSize:10,fontFamily:"inherit",cursor:"pointer",letterSpacing:2 }}>
                + NEW NOTE
              </button>
            </div>
          ) : (
            <NoteEditor key={activeNote.id} note={activeNote} onUpdate={p=>updateNote(activeNote.id,p)} onClose={()=>setActiveId(null)} onAI={aiSummarize} aiLoading={aiLoading} isDark={isDark} NEON={NEON} onToast={showToast} />
          )}
        </div>

        {toast&&<div style={{ position:"fixed",bottom:26,right:26,background:T.toastBg,border:`1px solid ${globalAccent}40`,borderRadius:12,padding:"11px 18px",fontSize:11,color:globalAccent,boxShadow:`0 0 24px ${globalAccent}20`,zIndex:99999,fontFamily:"'DM Mono',monospace",letterSpacing:1,animation:"fadeUp 0.3s ease" }}>{toast}</div>}
      </div>
    </>
  );
}