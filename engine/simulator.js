// Core race simulator state and rules. Kept as global functions for index.html compatibility.
function groupDangos(group){ return (GROUPS[group]?.participants || GROUPS.A.participants).map(id=>DANGO_LIBRARY[id]); }
let CURRENT_GROUP = "A";
let DANGOS = groupDangos(CURRENT_GROUP);
function setCurrentGroup(group){ CURRENT_GROUP = GROUPS[group] ? group : "A"; DANGOS = groupDangos(CURRENT_GROUP); }
const SPECIAL = {1:"终点",2:"起点",4:"推进",7:"裂隙",11:"阻遏",12:"推进",17:"推进",21:"裂隙",24:"推进",29:"阻遏"};
const AEMIS_MIDPOINT = 18;
const YUNO_MIDPOINT = 18;
const tileType = n => SPECIAL[n] || "普通";
const nextTile = (n, step=1) => ((n - 1 + step) % 32) + 1;
const prevTile = (n, step=1) => ((n - 1 - step + 3200) % 32) + 1;
const nameOf = id => DANGOS.find(d=>d.id===id)?.name || id;
const shortOf = id => DANGOS.find(d=>d.id===id)?.short || id;
const clsOf = id => DANGOS.find(d=>d.id===id)?.cls || "";
const imgOf = id => DANGOS.find(d=>d.id===id)?.img || "";
function rngFromSeed(seed){ let s = Number(seed) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function randInt(rng,a,b){ return Math.floor(rng() * (b-a+1)) + a; }
function shuffle(list,rng){ const a=[...list]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function initialStatus(){ return Object.fromEntries(DANGOS.map(d=>[d.id,{tile:2,lastRoll:null,metKing:false,comeback:false,comebackUsed:false,canFinish:true,rollCount:0,ghostUsed:false,hasPassedMidpoint:false,skipActiveThisRound:false,forceLastNextRound:false,activeMoveBonus:0,yunoUsed:false}])); }
function prepareRoundRolls(s){
  s.baseRolls = {};
  for(const d of DANGOS){
    const st=s.status[d.id];
    if(d.skill==="precision") s.baseRolls[d.id] = [3,2,1][(st.rollCount||0) % 3];
    else if(d.skill==="future") s.baseRolls[d.id] = randInt(s.rng,2,3);
    else s.baseRolls[d.id] = randInt(s.rng,1,3);
  }
  if(s.round >= 3) s.baseRolls.king = randInt(s.rng,1,6);
}
function makeInitial(seed, camellyaEarlyTrigger=false, group=CURRENT_GROUP){ setCurrentGroup(group); const rng=rngFromSeed(seed); const opening=shuffle(DANGOS.map(d=>d.id), rng); const s={ seed, rng, group:CURRENT_GROUP, startMode:"random", round:1, turnIndex:0, order:opening, baseRolls:{}, stacks:{1:["king"],2:[...opening]}, status:initialStatus(), king:{tile:1,active:true}, winner:null, lastAction:null, camellyaEarlyTrigger, log:[`当前模拟组别：${GROUPS[CURRENT_GROUP].label}。`,`布大王开局位于第1格终点，第3回合开始移动。`,`绯雪相遇规则：${camellyaEarlyTrigger?"第3回合后才可触发":"第3回合后才可触发"}。`,`开局顺序 / 第2格起点堆叠：${opening.map(shortOf).join(" → ")}`] }; prepareRoundRolls(s); applyRoundStartSkills(s); return s; }
function cloneState(s){ setCurrentGroup(s.group||CURRENT_GROUP); return {...s, baseRolls:{...(s.baseRolls||{})}, stacks:Object.fromEntries(Object.entries(s.stacks).map(([k,v])=>[k,[...v]])), status:Object.fromEntries(Object.entries(s.status).map(([k,v])=>[k,{...v}])), king:{...s.king}, order:[...s.order], log:[...s.log]}; }
function stackAt(s,t){ return s.stacks[t] || []; }
function setStack(s,t,st){ const clean=[...new Set(st)]; if(!clean.length) delete s.stacks[t]; else s.stacks[t]=clean; }
function isDango(id){ return id && id!=="king"; }
function getIdTile(s,id){ return id==="king" ? s.king.tile : s.status[id].tile; }
function setIdTile(s,id,tile){ if(id==="king") s.king.tile=tile; else if(s.status[id]) s.status[id].tile=tile; }
function removeIdFromAllStacks(s,id){ for(const k of Object.keys(s.stacks)){ const next=s.stacks[k].filter(x=>x!==id); setStack(s,Number(k),next); } }
function placeKingAt(s,tile){ removeIdFromAllStacks(s,"king"); const st=stackAt(s,tile).filter(id=>id!=="king"); st.push("king"); setStack(s,tile,st); s.king.tile=tile; s.king.active=true; }
function ensureKingActive(s){ if(!s.king.active){ placeKingAt(s,1); s.log.push("布大王从第1格登场。 "); } else { const st=stackAt(s,s.king.tile); if(!st.includes("king")) placeKingAt(s,s.king.tile); } }
function raceScore(s,id){
  const st=s.status[id];
  // 普通开局：第2格是起点，第1格是终点；分数用格子顺序近似排名。
  // 下半场固定开局：国服 A 组排名第1名从第1格出发，应被视为领先；
  // 其他团子第一次经过第1格只解锁终点结算资格，之后才进入下一圈。
  if(s.startMode==="secondHalf" && st.canFinish) return 32 + (st.tile - 1);
  return st.tile - 1;
}
function rank(s){ return DANGOS.map(d=>({id:d.id,tile:s.status[d.id].tile,score:raceScore(s,d.id)})).sort((a,b)=>{ if(b.score!==a.score) return b.score-a.score; return stackAt(s,a.tile).indexOf(a.id)-stackAt(s,b.tile).indexOf(b.id); }).map(x=>x.id); }
function passesTileForward(from,steps,target){ for(let i=1;i<=steps;i++) if(nextTile(from,i)===target) return true; return false; }
function passesTileBackward(from,steps,target){ for(let i=1;i<=steps;i++) if(prevTile(from,i)===target) return true; return false; }
function ordinaryStackAt(s,tile){ return stackAt(s,tile).filter(isDango); }
function ordinaryStackFromSnapshot(snapshot,tile){ return (snapshot[tile] || []).filter(isDango); }
function ordinaryStackInfo(s,id){
  const st=s.status[id];
  if(!st) return {stack:[], index:-1, tile:null};
  const stack=ordinaryStackAt(s,st.tile);
  return {stack, index:stack.indexOf(id), tile:st.tile};
}
function hasOrdinaryAboveInStack(stack,id){ const idx=stack.indexOf(id); return idx>0; }
function hasOrdinaryBelowInStack(stack,id){ const idx=stack.indexOf(id); return idx>=0 && idx<stack.length-1; }
function stackSnapshot(s){ return Object.fromEntries(Object.entries(s.stacks).map(([tile,ids])=>[tile,[...ids]])); }
function snapshotHasOrdinaryAbove(snapshot,id){
  for(const tile of Object.keys(snapshot)){
    const stack=ordinaryStackFromSnapshot(snapshot,tile);
    if(hasOrdinaryAboveInStack(stack,id)) return true;
  }
  return false;
}
function stateHasOrdinaryAbove(s,id){
  const info=ordinaryStackInfo(s,id);
  return hasOrdinaryAboveInStack(info.stack,id);
}
function moveDangoToTopNoStackCheck(s,id){
  const tile=s.status[id]?.tile;
  if(!tile) return;
  const st=stackAt(s,tile).filter(x=>x!==id);
  setStack(s,tile,[id,...st]);
  s.status[id].tile=tile;
}
function checkJinhsiAboveAppearedFromSnapshot(s,before,reason=""){
  if(s.group!=="C" || !s.status.jinhsi || s.winner) return false;
  const beforeAbove=snapshotHasOrdinaryAbove(before,"jinhsi");
  const afterAbove=stateHasOrdinaryAbove(s,"jinhsi");
  if(beforeAbove || !afterAbove) return false;
  const ok=s.rng()<0.4;
  const prefix=reason ? `${reason}，` : "";
  if(ok){
    moveDangoToTopNoStackCheck(s,"jinhsi");
    s.log.push(`${prefix}今汐头顶出现普通团子，40% 判定成功，移动到当前格最上方。`);
    if(s.lastAction) s.lastAction.notes.push("今汐登顶成功");
  } else {
    s.log.push(`${prefix}今汐头顶出现普通团子，40% 判定失败，保持原位。`);
    if(s.lastAction) s.lastAction.notes.push("今汐登顶失败");
  }
  return true;
}
function applyRoundStartSkills(s){
  if(s.group!=="C") return;
  for(const st of Object.values(s.status)){
    st.skipActiveThisRound=false;
    st.activeMoveBonus=0;
  }
  const aug=ordinaryStackInfo(s,"augusta");
  if(aug.stack.length>=2 && aug.index===0){
    s.status.augusta.skipActiveThisRound=true;
    s.status.augusta.forceLastNextRound=true;
    s.log.push(`回合开始：奥古斯塔位于第${aug.tile}格普通团子堆叠最顶端，本回合不能主动行动，并标记下回合最后行动。`);
  }
  const flo=ordinaryStackInfo(s,"flololo");
  if(flo.stack.length>=2 && flo.index===flo.stack.length-1){
    s.status.flololo.activeMoveBonus=3;
    s.log.push(`回合开始：弗洛洛位于第${flo.tile}格普通团子堆叠最底层，本回合主动移动 +3。`);
  }
}
function applyMoveStartSkills(s,id,steps,notes){
  if(s.group!=="C") return steps;
  const info=s.status[id];
  if(info?.activeMoveBonus){
    steps+=info.activeMoveBonus;
    notes.push(`弗洛洛底层加速 +${info.activeMoveBonus}`);
  }
  if(id==="calcharo" && rank(s).at(-1)===id){
    steps+=3;
    notes.push("卡卡罗最后一名 +3");
  }
  return steps;
}
function applyRoundEndSkills(s){
  if(s.group!=="C" || !s.status.changli) return;
  const info=ordinaryStackInfo(s,"changli");
  if(info.stack.length>=2 && hasOrdinaryBelowInStack(info.stack,"changli")){
    if(s.rng()<0.65){
      s.status.changli.forceLastNextRound=true;
      s.log.push(`回合结束：长离下方有普通团子，65% 判定成功，标记下回合最后行动。`);
    } else {
      s.log.push(`回合结束：长离下方有普通团子，65% 判定失败。`);
    }
  }
}
function consumeForcedLastIds(s){
  if(s.group!=="C") return new Set();
  const ids=DANGOS.map(d=>d.id).filter(id=>s.status[id]?.forceLastNextRound);
  ids.forEach(id=>{ s.status[id].forceLastNextRound=false; });
  if(ids.length) s.log.push(`下回合最后行动标记生效：${ids.map(nameOf).join("、")}。`);
  return new Set(ids);
}
function checkYunoTeleportAfterAction(s,reason=""){
  if(s.group!=="C" || !s.status.yuno || s.status.yuno.yunoUsed || s.winner) return false;
  const action=s.lastAction;
  const path=action?.path || [];
  const moved=action?.groupIds || [];
  if(!moved.includes("yuno") || !path.slice(1).includes(YUNO_MIDPOINT)) return false;
  const before=stackSnapshot(s);
  const ranking=rank(s);
  const target=s.status.yuno.tile;
  for(const tile of Object.keys(s.stacks)){
    const onlyKing=stackAt(s,Number(tile)).filter(id=>id==="king");
    setStack(s,Number(tile),onlyKing);
  }
  const hasKing=s.king.active && s.king.tile===target;
  setStack(s,target,hasKing?[...ranking,"king"]:[...ranking]);
  ranking.forEach(id=>{ s.status[id].tile=target; });
  s.status.yuno.yunoUsed=true;
  const prefix=reason ? `${reason}，` : "";
  s.log.push(`${prefix}尤诺经过第${YUNO_MIDPOINT}格，触发中点重排：所有普通团子按传送前排名堆叠到第${target}格。`);
  if(s.lastAction){ s.lastAction.notes.push(`尤诺中点重排→第${target}格`); s.lastAction.path.push(target); }
  checkJinhsiAboveAppearedFromSnapshot(s,before,"尤诺中点重排后");
  return true;
}
function mergeMovingGroupOnTile(s, group, tile, mode="normal"){
  const existing=stackAt(s,tile).filter(id=>!group.includes(id));
  // normal: 普通团子/团子叠移动，移动来的整叠放到最上方。
  // king: 布大王移动时钻到当前格最底部；被追上的团子会在整叠上方。
  const merged = mode==="king" ? [...existing, ...group] : [...group, ...existing];
  setStack(s,tile,merged);
  group.forEach(id=>setIdTile(s,id,tile));
}
function canCamellyaMeetKingNow(s){ return s.camellyaEarlyTrigger !== false || s.round >= 3; }
function moveForward(s,ids,steps,actorId,label){ if(!ids.length||s.winner) return; const from=getIdTile(s,ids[0]); if(s.lastAction){ s.lastAction.groupIds=[...ids]; s.lastAction.path=[from]; } const oldStack=stackAt(s,from); setStack(s,from,oldStack.filter(id=>!ids.includes(id))); let to=from; for(let i=0;i<steps;i++){ to=nextTile(to); if(s.lastAction) s.lastAction.path.push(to); } if(steps>0 && passesTileForward(from,steps,1)){
    if(s.status[ids[0]]?.canFinish !== false){
      s.winner=ids[0];
      s.log.push(`${label} 到达终点，堆叠最上方 ${nameOf(ids[0])} 获胜。`);
      return;
    } else {
      ids.forEach(id=>{ if(s.status[id]) s.status[id].canFinish=true; });
      s.log.push(`${label} 第一次经过终点，本次不结算；该叠团子已获得下一次终点结算资格。`);
    }
  }
  if(s.king.active && ids.includes("camellya") && (passesTileForward(from,steps,s.king.tile)||to===s.king.tile)){
    if(canCamellyaMeetKingNow(s)){
      if(!s.status.camellya.metKing) s.log.push("绯雪与布大王相遇，后续主动移动 +1。");
      s.status.camellya.metKing=true;
    } else {
      s.log.push("绯雪经过布大王，但当前规则设置为第3回合后才触发，因此本次不触发技能。");
    }
  }
  let beforeStackChange=stackSnapshot(s);
  mergeMovingGroupOnTile(s,ids,to,"normal");
  checkJinhsiAboveAppearedFromSnapshot(s,beforeStackChange,`${label}移动落点结算后`);
  const type=tileType(to);
  if(type==="裂隙"){ const st=stackAt(s,to); const hasKing=st.includes("king"); const dangos=st.filter(isDango); const shuffled=shuffle(dangos,s.rng); beforeStackChange=stackSnapshot(s); setStack(s,to,hasKing?[...shuffled,"king"]:shuffled); s.log.push(`${label} 落在第${to}格裂隙，该格堆叠随机重排。`); checkJinhsiAboveAppearedFromSnapshot(s,beforeStackChange,`${label}触发空间裂隙后`); return; }
  if(type==="推进"||type==="阻遏"){ let extra=type==="推进"?1:-1; if(actorId==="roccia") extra += type==="推进"?3:-1; s.log.push(`${label} 触发第${to}格${type}，${extra>0?"前进":"后退"}${Math.abs(extra)}格。`); const group=stackAt(s,to).filter(id=>ids.includes(id)); setStack(s,to,stackAt(s,to).filter(id=>!group.includes(id))); let finalTile=to; for(let i=0;i<Math.abs(extra);i++){ finalTile=extra>0?nextTile(finalTile):prevTile(finalTile); if(s.lastAction) s.lastAction.path.push(finalTile); } beforeStackChange=stackSnapshot(s); mergeMovingGroupOnTile(s,group,finalTile,"normal"); checkJinhsiAboveAppearedFromSnapshot(s,beforeStackChange,`${label}触发${type}后`); }
}
function activeGroup(s,id){ const tile=s.status[id].tile; const st=stackAt(s,tile); const idx=st.indexOf(id); return idx<0?[]:st.slice(0,idx+1); }
function kingGroup(s){ ensureKingActive(s); const tile=s.king.tile; const st=stackAt(s,tile); const idx=st.indexOf("king"); return idx<0?["king"]:st.slice(0,idx+1); }
function kingMoveOneStep(s,dir){
  let group=kingGroup(s);
  const from=s.king.tile;
  setStack(s,from,stackAt(s,from).filter(id=>!group.includes(id)));
  const to=dir>0?nextTile(from):prevTile(from);
  const beforeStackChange=stackSnapshot(s);
  mergeMovingGroupOnTile(s,group,to,"king");
  checkJinhsiAboveAppearedFromSnapshot(s,beforeStackChange,"布大王移动结算后");
  if(s.lastAction) s.lastAction.path.push(to);
  const st=stackAt(s,to);
  if(st.includes("camellya")){
    if(canCamellyaMeetKingNow(s)){
      if(!s.status.camellya.metKing) s.log.push("布大王与绯雪相遇，绯雪后续主动移动 +1。");
      s.status.camellya.metKing=true;
    } else {
      s.log.push("布大王经过绯雪，但当前规则设置为第3回合后才触发，因此本次不触发技能。");
    }
  }
  // 经过其他团子后，下一步会携带当前格全部位于布大王上方的团子继续移动。
  return to;
}
function kingApplySpecialOnce(s){
  const tile=s.king.tile;
  const type=tileType(tile);
  if(type==="推进"||type==="阻遏"){
    const dir=type==="推进"?1:-1; // 地图固定方向：推进永远 +1，阻遏永远 -1。
    const before=s.king.tile;
    kingMoveOneStep(s,dir);
    s.log.push(`布大王触发第${before}格${type}，按地图固定方向${dir>0?"前进":"后退"}1格，到第${s.king.tile}格。`);
    if(s.lastAction) s.lastAction.notes.push(`${type}${dir>0?"+1":"-1"}`);
  } else if(type==="裂隙"){
    const st=stackAt(s,tile);
    const dangos=st.filter(isDango);
    const shuffled=shuffle(dangos,s.rng);
    const beforeStackChange=stackSnapshot(s);
    setStack(s,tile,[...shuffled,"king"]);
    s.log.push(`布大王落在第${tile}格空间裂隙，该格布大王上方团子随机重排；本次行动只触发一次特殊格。`);
    checkJinhsiAboveAppearedFromSnapshot(s,beforeStackChange,"布大王触发空间裂隙后");
    if(s.lastAction) s.lastAction.notes.push("裂隙重排");
  }
}
function kingHasDangoAbove(s){ if(!s.king.active) return false; const st=stackAt(s,s.king.tile); const idx=st.indexOf("king"); return idx>0; }
function hasDangoAheadOfKing(s){
  if(!s.king.active) return false;
  let t=s.king.tile;
  // 布大王前方：沿其反向移动方向，从当前位置前一格检查到第1格，不绕完整圈。
  while(t!==1){
    t=prevTile(t);
    if(DANGOS.some(d=>s.status[d.id].tile===t)) return true;
  }
  return false;
}
function checkKingReturnAtRoundEnd(s){
  if(!s.king.active || s.round < 3) return;
  if(kingHasDangoAbove(s)){
    s.log.push("回合结束检查：布大王上方有团子，不传送回起点。 ");
    return;
  }
  if(!hasDangoAheadOfKing(s)){
    const old=s.king.tile;
    placeKingAt(s,1);
    if(old!==1) s.log.push(`回合结束检查：布大王前方没有团子，传送回第1格。`);
  } else {
    s.log.push("回合结束检查：布大王前方仍有团子，留在当前位置。 ");
  }
}
function kingMove(s,forcedRoll=null){
  if(!s.king.active) return;
  ensureKingActive(s);
  const roll=forcedRoll ?? (s.baseRolls&&s.baseRolls.king) ?? randInt(s.rng,1,6);
  const from=s.king.tile;
  s.lastAction={actor:"king", actorName:"布大王", baseRoll:roll, actualSteps:roll, carryCount:Math.max(0,kingGroup(s).length-1), carried:kingGroup(s).filter(isDango).map(shortOf), notes:["反向移动"], groupIds:[...kingGroup(s)], path:[from]};
  for(let i=0;i<roll;i++) kingMoveOneStep(s,-1);
  s.log.push(`布大王掷出 ${roll}，反向移动：第${from}格 → 第${s.king.tile}格。`);
  kingApplySpecialOnce(s);
  const finalGroup=kingGroup(s);
  s.lastAction.groupIds=[...finalGroup];
  s.lastAction.carryCount=Math.max(0,finalGroup.length-1);
  s.lastAction.carried=finalGroup.filter(isDango).map(shortOf);
  if(s.group==="C") checkYunoTeleportAfterAction(s,"布大王行动结算后");
}
function dangoDef(id){ return DANGOS.find(d=>d.id===id) || {}; }
function getBaseRollForDango(s,id,forcedRoll=null){
  const def=dangoDef(id);
  if(!s.baseRolls) s.baseRolls={};
  if(forcedRoll != null){
    let v=Number(forcedRoll);
    if(def.skill==="future") v = v<=2 ? 2 : 3;
    else v = Math.max(1, Math.min(3, v));
    s.baseRolls[id]=v;
    return v;
  }
  if(s.baseRolls[id]) return s.baseRolls[id];
  if(def.skill==="precision"){ s.baseRolls[id]=[3,2,1][(s.status[id].rollCount||0)%3]; return s.baseRolls[id]; }
  if(def.skill==="future"){ s.baseRolls[id]=randInt(s.rng,2,3); return s.baseRolls[id]; }
  s.baseRolls[id]=randInt(s.rng,1,3);
  return s.baseRolls[id];
}
function bGroupMinRoll(s){ const vals=Object.values(s.baseRolls||{}); return vals.length?Math.min(...vals):1; }
function findNearestDangoAhead(s, fromTile, selfId){
  // 爱弥斯只检查当前位置到第1格终点之间的前方目标，不允许越过终点继续绕圈搜索。
  if(fromTile === 1) return null;
  let t=fromTile;
  for(let guard=0; guard<32; guard++){
    t=nextTile(t);
    const found=stackAt(s,t).find(x=>isDango(x) && x!==selfId);
    if(found) return {tile:t, id:found};
    if(t===1) break;
  }
  return null;
}
function teleportDangoToTop(s,id,targetTile){
  const beforeStackChange=stackSnapshot(s);
  removeIdFromAllStacks(s,id);
  const st=stackAt(s,targetTile);
  setStack(s,targetTile,[id,...st]);
  s.status[id].tile=targetTile;
  checkJinhsiAboveAppearedFromSnapshot(s,beforeStackChange,`${nameOf(id)}传送后`);
}
function attemptAemisTeleport(s, reason=""){
  if(s.group!=="B" || !s.status.aemis || s.winner) return false;
  const st=s.status.aemis;
  if(st.ghostUsed || !st.hasPassedMidpoint) return false;
  const near=findNearestDangoAhead(s, st.tile, "aemis");
  const prefix = reason ? `${reason}，` : "";
  if(near){
    teleportDangoToTop(s,"aemis",near.tile);
    st.ghostUsed=true;
    s.log.push(`${prefix}爱弥斯触发电子幽灵登场，单独传送到前方最近的${nameOf(near.id)}所在格顶端。`);
    if(s.lastAction){ s.lastAction.notes.push(`电子幽灵→第${near.tile}格`); s.lastAction.path.push(near.tile); }
    return true;
  }
  s.log.push(`${prefix}爱弥斯前方到终点之间暂时没有其他非布大王团子，保持待触发状态。`);
  return false;
}
function recordAemisMidpointPass(s){
  if(s.group!=="B" || !s.status.aemis || s.winner) return;
  const st=s.status.aemis;
  if(st.ghostUsed || st.hasPassedMidpoint) return;
  const path=(s.lastAction && s.lastAction.path) || [];
  const moved=(s.lastAction && s.lastAction.groupIds) || [];
  const includesAemis = moved.includes("aemis") || s.lastAction?.actor === "aemis";
  if(!includesAemis || !path.includes(AEMIS_MIDPOINT)) return;
  st.hasPassedMidpoint=true;
  s.log.push(`爱弥斯经过第${AEMIS_MIDPOINT}格中点，进入电子幽灵待触发状态；仅在她自己的主动行动结束后检查传送。`);
}
function checkAemisTeleportAfterOwnAction(s, actorId){
  if(actorId!=="aemis" || s.group!=="B" || !s.status.aemis || s.winner) return;
  const st=s.status.aemis;
  if(st.ghostUsed || !st.hasPassedMidpoint) return;
  attemptAemisTeleport(s, "爱弥斯主动行动结束");
}
function stepDango(s,id,forcedRoll=null){
  if(s.winner) return;
  const info=s.status[id];
  const def=dangoDef(id);
  if(s.group==="C" && info?.skipActiveThisRound){
    s.lastAction={actor:id, actorName:nameOf(id), baseRoll:0, actualSteps:0, carryCount:0, carried:[], notes:["奥古斯塔顶端惩罚：本回合不能主动行动"], groupIds:[], path:[info.tile]};
    s.log.push(`${nameOf(id)} 因回合开始时位于普通团子堆叠最顶端，本回合不能主动行动。`);
    return;
  }
  const group=activeGroup(s,id);
  const baseRoll=getBaseRollForDango(s,id,forcedRoll);
  let steps=baseRoll;
  const notes=[];

  if(s.group === "A"){
    const ranking=rank(s);
    const ci=ranking.indexOf("cantarella");
    const marked=new Set((s.round>1 && ci>0)?ranking.slice(Math.max(0,ci-2),ci):[]);
    if(marked.has(id)){ steps=Math.max(1,steps-1); notes.push("被西格莉卡 -1"); }
    if(id==="danjin"&&info.lastRoll===baseRoll){ steps+=2; notes.push("达妮娅重复点数 +2"); }
    if(id==="camellya"&&info.metKing){ steps+=1; notes.push("绯雪 +1"); }
    if(id==="phoebe"&&s.rng()<.5){ steps+=1; notes.push("菲比 +1"); }
    if(id==="cartethyia"&&info.comeback&&s.rng()<.6){ steps+=2; notes.push("卡提希娅 +2"); }
  } else if(s.group === "B"){
    if(def.skill==="vision" && baseRoll===bGroupMinRoll(s)){ steps+=2; notes.push("视阈解明 +2"); }
    if(def.skill==="precision"){ notes.push("精密演算固定点数"); }
    if(def.skill==="colorful"){ const r=s.rng(); if(r<0.6){ steps=baseRoll*2; notes.push("炫彩时刻双倍"); } else if(r<0.8){ steps=0; notes.push("炫彩时刻无法移动"); } else { notes.push("炫彩时刻正常移动"); } }
    if(def.skill==="future"){ notes.push("收束的未来：只出2或3"); }
    if(def.skill==="profit" && s.rng()<0.28){ steps=baseRoll*2; notes.push("利润加倍：双倍点数"); }
  }
  steps=applyMoveStartSkills(s,id,steps,notes);

  info.lastRoll=baseRoll;
  info.rollCount=(info.rollCount||0)+1;
  s.lastAction={actor:id, actorName:nameOf(id), baseRoll, actualSteps:steps, carryCount:group.length, carried:group.map(shortOf), notes:[...notes], groupIds:[...group], path:[]};
  s.log.push(`${nameOf(id)} 掷出 ${baseRoll}，实际移动 ${steps}${notes.length?`（${notes.join("；")}）`:""}，携带：${group.map(shortOf).join("、")}`);
  moveForward(s,group,steps,id,nameOf(id));

  if(s.group==="A" && id==="cartethyia"&&!info.comebackUsed&&!s.winner){ const r=rank(s); if(r[r.length-1]===id){ info.comeback=true; info.comebackUsed=true; s.log.push("卡提希娅处于最后一名，激活追赶技能。"); } }
  if(s.group==="B"){ recordAemisMidpointPass(s); checkAemisTeleportAfterOwnAction(s,id); }
  if(s.group==="C") checkYunoTeleportAfterAction(s,`${nameOf(id)}行动结算后`);
}
function buildRoundOrder(s){
  const base=DANGOS.map(d=>d.id);
  const shuffled=s.round>=3 ? shuffle([...base,"king"], s.rng) : shuffle(base, s.rng);
  const forced=consumeForcedLastIds(s);
  if(!forced.size) return shuffled;
  return [...shuffled.filter(id=>!forced.has(id)), ...shuffled.filter(id=>forced.has(id))];
}
function advanceTurn(inputState,forcedRoll=null){
  const s=cloneState(inputState);
  if(s.winner) return s;
  if(s.round>=3) ensureKingActive(s);
  const current=s.order[s.turnIndex];
  if(current==="king"){ kingMove(s,forcedRoll); recordAemisMidpointPass(s); }
  else stepDango(s,current,forcedRoll);
  if(s.winner){ const last=rank(s).at(-1); s.log.push(`比赛结束：最后一名为 ${nameOf(last)}，布大王位于第${s.king.tile}格。`); return s; }
  s.turnIndex++;
  if(s.turnIndex>=s.order.length){
    checkKingReturnAtRoundEnd(s);
    applyRoundEndSkills(s);
    s.round++;
    s.turnIndex=0;
    s.order=buildRoundOrder(s);
    prepareRoundRolls(s);
    applyRoundStartSkills(s);
    s.log.push(`--- 第 ${s.round} 回合，行动顺序：${s.order.map(x=>x==="king"?"布":shortOf(x)).join(" → ")} ---`);
  }
  return s;
}
function simulateOne(seed,maxTurns=1000,startMode="random", rankingKey=DEFAULT_RANKING_KEY, camellyaEarlyTrigger=true, group=CURRENT_GROUP, rankingIds=null, sourceLabel="自定义排名"){
  setCurrentGroup(group);
  const src=getRankingSource(rankingKey);
  let s=startMode==="customRanking"
    ? makeRankingBasedState(group, rankingIds, seed, sourceLabel, camellyaEarlyTrigger)
    : (startMode==="secondHalf" ? makeRankingBasedState(src.group || group, src.ranking, seed, src.label, camellyaEarlyTrigger) : makeInitial(seed, camellyaEarlyTrigger, group));
  let safe=0;
  while(!s.winner&&safe++<maxTurns) s=advanceTurn(s);
  if(!s.winner) s.winner=rank(s)[0];
  return s;
}
function finalRanking(s){
  const base=rank(s).filter(id=>id!==s.winner);
  return s.winner ? [s.winner, ...base] : base;
}

function rowsFromStats(stats, done, advanceCount=4){
  return DANGOS.map(d=>{
    const s=stats[d.id];
    const winRate=done?s.wins/done:0;
    const advanceRate=done?s.top4/done:0;
    const elimRate=1-advanceRate;
    const avgRank=done?s.rankSum/done:0;
    return {...d,wins:s.wins,top4:s.top4,rankSum:s.rankSum,winRate,advanceRate,elimRate,avgRank,advanceCount,rate:winRate};
  }).sort((a,b)=>{
    if(b.advanceRate!==a.advanceRate) return b.advanceRate-a.advanceRate;
    return b.winRate-a.winRate;
  });
}
function runBatchAsync(n,seed,autoSeed,onProgress,onDone,startMode="random",rankingKey=DEFAULT_RANKING_KEY,camellyaEarlyTrigger=true,group=CURRENT_GROUP,advanceCount=4,rankingIds=null,sourceLabel="自定义排名"){ setCurrentGroup(group);
  const stats=Object.fromEntries(DANGOS.map(d=>[d.id,{wins:0,top4:0,rankSum:0}]));
  const realSeed=Number(seed||1);
  let done=0;
  const batchSize = n <= 1000 ? 25 : n <= 10000 ? 100 : 250;
  function chunk(){
    const end=Math.min(n,done+batchSize);
    for(let i=done;i<end;i++){
      const s=simulateOne((realSeed+i*9973)>>>0,1000,startMode,rankingKey,camellyaEarlyTrigger,group,rankingIds,sourceLabel);
      const fr=finalRanking(s);
      fr.forEach((id,idx)=>{
        if(!stats[id]) return;
        if(idx===0) stats[id].wins++;
        if(idx<advanceCount) stats[id].top4++;
        stats[id].rankSum += idx+1;
      });
    }
    done=end;
    const rows=rowsFromStats(stats,done,advanceCount);
    onProgress({seed:realSeed,done,total:n,rows});
    if(done<n) setTimeout(chunk,0);
    else onDone({seed:realSeed,done,total:n,rows});
  }
  setTimeout(chunk,0);
}

function getRankingSource(key){ return RANKING_SOURCES[key] || RANKING_SOURCES[DEFAULT_RANKING_KEY]; }

function makeRankingBasedState(groupKey, rankingIds, seed, sourceLabel="自定义排名", camellyaEarlyTrigger=false){
  setCurrentGroup(groupKey);
  const participants=DANGOS.map(d=>d.id);
  const ranking=[...(rankingIds || [])];
  if(ranking.length!==participants.length || new Set(ranking).size!==participants.length || ranking.some(id=>!participants.includes(id))){
    throw new Error(`Invalid ranking for group ${groupKey}: ${ranking.join(",")}`);
  }
  const rng = rngFromSeed(seed);
  const [r1,r2,r3,r4,r5,r6] = ranking;
  const stacks = {
    1: [r1, "king"],
    32: [r2, r3],
    31: [r4, r5],
    30: [r6],
  };
  const status = initialStatus();
  Object.values(status).forEach(st=>{ st.tile=2; st.canFinish=false; });
  Object.entries(stacks).forEach(([tile, ids])=>ids.filter(isDango).forEach(id=>{ status[id].tile = Number(tile); }));
  status[r1].canFinish = true;
  const firstOrder = shuffle(DANGOS.map(d=>d.id), rng);
  const s={
    seed, rng, group:CURRENT_GROUP, startMode:"secondHalf", round:1, turnIndex:0, order:firstOrder, baseRolls:{}, stacks, status,
    king:{tile:1,active:true}, winner:null, lastAction:null, camellyaEarlyTrigger,
    log:[
      `当前模拟组别：${GROUPS[CURRENT_GROUP].label}。`,
      `已应用${sourceLabel}的下半场固定开局。`,
      `布大王开局位于第1格终点，第3回合开始移动；绯雪相遇规则：${camellyaEarlyTrigger?"第3回合后才可触发":"第3回合后才可触发"}。`,
      `上半场排名仅决定站位和同格堆叠顺序；第一回合行动顺序随机：${firstOrder.map(shortOf).join(" → ")}`,
      `站位：第1格 ${nameOf(r1)}；第32格 ${nameOf(r2)}在上、${nameOf(r3)}在下；第31格 ${nameOf(r4)}在上、${nameOf(r5)}在下；第30格 ${nameOf(r6)}。`,
      `终点规则：非第1格出发的团子第一次经过终点不结算，之后再次经过才可获胜。`
    ]
  };
  prepareRoundRolls(s);
  applyRoundStartSkills(s);
  return s;
}

function makeSecondHalfState(seed, ranking = getRankingSource(DEFAULT_RANKING_KEY).ranking, sourceLabel = getRankingSource(DEFAULT_RANKING_KEY).label, camellyaEarlyTrigger=false){
  return makeRankingBasedState("A", ranking, seed, sourceLabel, camellyaEarlyTrigger);
}
