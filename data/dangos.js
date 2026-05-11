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
  aemis: { id:"aemis", name:"爱弥斯", short:"爱", group:"B", cls:"camellya", img:"assets/B4.png", skillName:"电子幽灵登场", skillDescription:"每场最多传送一次。经过第17格后，根据所选规则判定是否传送到前方最近团子顶端。", skillType:"midpoint_teleport", skill:"ghost", skillParams:{ midpoint:17 } },
  shorekeeper: { id:"shorekeeper", name:"守岸人", short:"守", group:"B", cls:"cantarella", img:"assets/B5.png", skillName:"收束的未来", skillDescription:"骰子只会掷出 2 或 3。", skillType:"roll_only_2_or_3", skill:"future", skillParams:{ values:[2,3] } },
  carlotta: { id:"carlotta", name:"珂莱塔", short:"珂", group:"B", cls:"danjin", img:"assets/B6.png", skillName:"利润加倍", skillDescription:"28% 概率按骰子的双倍点数前进。", skillType:"double_roll_chance", skill:"profit", skillParams:{ chance:0.28 } }
};
const GROUPS = {
  A: { label:"国服 A 组", participants:["roccia","cartethyia","cantarella","danjin","camellya","phoebe"] },
  B: { label:"国服 B 组", participants:["chisaki","moning","linne","aemis","shorekeeper","carlotta"] }
};
