const MATCH_CONFIGS = {
  cnA: { matchId:"cn-a", server:"国服", group:"A", phase:"A组", participants:GROUPS.A.participants },
  cnB: { matchId:"cn-b", server:"国服", group:"B", phase:"B组", participants:GROUPS.B.participants }
};

// 当前国服 A 组上半场排名数据源。用于复盘下半场固定开局，不能用最终排名覆盖。
const RANKING_SOURCES = {
  cnA: {
    server: "国服",
    group: "A",
    label: "国服 A 组上半场结果（05.09）",
    note: "A 组上半场排名仅用于生成下半场固定站位；最终晋级只看下半场结果。",
    ranking: ["danjin", "phoebe", "cantarella", "camellya", "roccia", "cartethyia"]
  }
};
const DEFAULT_RANKING_KEY = "cnA";
