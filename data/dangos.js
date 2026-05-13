// v18: 统一团子库，后续淘汰赛可直接通过团子 id 调用数据。
const DANGO_LIBRARY = {
  roccia: { id:"roccia", name:"陆·赫斯", short:"陆", group:"A", cls:"roccia", img:"assets/roccia.png", skillName:"机关联动", skillDescription:"触发推进额外前进 3 格，触发阻遏额外后退 1 格。", skillType:"roccia", skill:"roccia", skillParams:{} },
  cartethyia: { id:"cartethyia", name:"卡提希娅", short:"卡", group:"A", cls:"cartethyia", img:"assets/cartethyia.png", skillName:"追赶补正", skillDescription:"主动行动后若处于最后一名，后续每次主动行动有 60% 概率额外前进 2 格。", skillType:"cartethyia", skill:"cartethyia", skillParams:{ chance:0.6, bonus:2 } },
  cantarella: { id:"cantarella", name:"西格莉卡", short:"西", group:"A", cls:"cantarella", img:"assets/cantarella.png", skillName:"前排压制", skillDescription:"第 2 回合开始，压制排名紧邻且高于自身的最多两个团子。", skillType:"cantarella", skill:"cantarella", skillParams:{ penalty:1 } },
  danjin: { id:"danjin", name:"达妮娅", short:"达", group:"A", cls:"danjin", img:"assets/danjin.png", skillName:"好事成双", skillDescription:"本次点数与上次相同时额外前进 2 格。", skillType:"repeat_roll_bonus", skill:"danjin", skillParams:{ bonus:2 } },
  camellya: { id:"camellya", name:"绯雪", short:"绯", group:"A", cls:"camellya", img:"assets/camellya.png", skillName:"布大王相遇", skillDescription:"第 3 回合开始，与布大王相遇后，后续主动移动额外 +1。", skillType:"camellya_king_bonus", skill:"camellya", skillParams:{ bonus:1, triggerFromRound:3 } },
  phoebe: { id:"phoebe", name:"菲比", short:"菲", group:"A", cls:"phoebe", img:"assets/phoebe.png", skillName:"概率加速", skillDescription:"每次主动行动 50% 概率额外前进 1 格。", skillType:"chance_bonus", skill:"phoebe", skillParams:{ chance:0.5, bonus:1 } },
  chisaki: { id:"chisaki", name:"千咲", short:"千", group:"B", cls:"roccia", img:"assets/B1.png", skillName:"视阈解明", skillDescription:"若基础点数为本轮最低点之一，额外前进 2 格。", skillType:"round_min_roll_bonus", skill:"vision", skillParams:{ bonus:2 } },
  moning: { id:"moning", name:"莫宁", short:"莫", group:"B", cls:"phoebe", img:"assets/B2.png", skillName:"精密演算", skillDescription:"点数固定按 3 / 2 / 1 循环。", skillType:"fixed_roll_cycle", skill:"precision", skillParams:{ cycle:[3,2,1] } },
  linne: { id:"linne", name:"琳奈", short:"琳", group:"B", cls:"cartethyia", img:"assets/B3.png", skillName:"炫彩时刻！", skillDescription:"60% 双倍移动，20% 无法移动，20% 正常移动。", skillType:"double_or_stun", skill:"colorful", skillParams:{ doubleChance:0.6, stunChance:0.2 } },
  aemis: { id:"aemis", name:"爱弥斯", short:"爱", group:"B", cls:"camellya", img:"assets/B4.png", skillName:"电子幽灵登场", skillDescription:"每场最多传送一次。经过第18格后进入待触发状态；仅在爱弥斯自己的主动行动结束后，若前方到终点之间存在最近非布大王团子，则单独传送到其所在格顶端；前方无人则继续等待。", skillType:"midpoint_teleport", skill:"ghost", skillParams:{ midpoint:18 } },
  shorekeeper: { id:"shorekeeper", name:"守岸人", short:"守", group:"B", cls:"cantarella", img:"assets/B5.png", skillName:"收束的未来", skillDescription:"骰子只会掷出 2 或 3。", skillType:"roll_only_2_or_3", skill:"future", skillParams:{ values:[2,3] } },
  carlotta: { id:"carlotta", name:"珂莱塔", short:"珂", group:"B", cls:"danjin", img:"assets/B6.png", skillName:"利润加倍", skillDescription:"28% 概率按骰子的双倍点数前进。", skillType:"double_roll_chance", skill:"profit", skillParams:{ chance:0.28 } },
  augusta: { id:"augusta", name:"奥古斯塔", short:"奥", group:"C", cls:"roccia", img:"assets/C1.png", skillName:"顶端压制", skillDescription:"主动行动前判定：若处于至少 2 位普通团子的堆叠最顶端，本次主动行动跳过，并在下回合最后行动；强制最后行动的回合不会再次触发。", skillType:"round_start_top_skip_force_last_next", skill:"augusta", skillParams:{} },
  yuno: { id:"yuno", name:"尤诺", short:"尤", group:"C", cls:"phoebe", img:"assets/C2.png", skillName:"中点重排", skillDescription:"每场一次。经过第 18 格后进入待触发状态；主动经过、被带着经过或被布大王带着经过都只记录状态；只有尤诺自己的主动行动结束后，才按线性赛道进度检查前后是否同时存在其他普通团子，满足时将所有普通团子按触发前排名顺序重排到尤诺所在格。同格、布大王、越过起终点绕圈后的团子不计入前后；本局最多触发一次。", skillType:"midpoint_all_ranked_stack_teleport_once", skill:"yuno", skillParams:{ midpoint:18 } },
  flololo: { id:"flololo", name:"弗洛洛", short:"弗", group:"C", cls:"cantarella", img:"assets/C3.png", skillName:"底层加速", skillDescription:"主动行动前判定：若处于至少 2 位普通团子的堆叠最底层，本次主动移动额外前进 3 格。", skillType:"round_start_bottom_active_move_bonus", skill:"flololo", skillParams:{ bonus:3 } },
  changli: { id:"changli", name:"长离", short:"长", group:"C", cls:"danjin", img:"assets/C4.png", skillName:"下层牵制", skillDescription:"回合结束时，若所在堆叠下方有其他普通团子，有 65% 概率下回合最后行动。", skillType:"round_end_below_stack_chance_force_last_next", skill:"changli", skillParams:{ chance:0.65 } },
  jinhsi: { id:"jinhsi", name:"今汐", short:"今", group:"C", cls:"camellya", img:"assets/C5.png", skillName:"登顶回避", skillDescription:"当头顶从没有普通团子变为出现普通团子时，进行 40% 判定；成功则移动到当前格最上方。", skillType:"stack_above_appears_chance_move_top", skill:"jinhsi", skillParams:{ chance:0.4 } },
  calcharo: { id:"calcharo", name:"卡卡罗", short:"卡", group:"C", cls:"cartethyia", img:"assets/C6.png", skillName:"末位冲刺", skillDescription:"主动行动开始时若当前排名最后，本次实际移动步数额外 +3。", skillType:"move_start_last_place_bonus", skill:"calcharo", skillParams:{ bonus:3 } }
};
const GROUPS = {
  A: { label:"国服 A 组", participants:["roccia","cartethyia","cantarella","danjin","camellya","phoebe"] },
  B: { label:"国服 B 组", participants:["chisaki","moning","linne","aemis","shorekeeper","carlotta"] },
  C: { label:"国服 C 组", participants:["augusta","yuno","flololo","changli","jinhsi","calcharo"] }
};
