const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = [
  "data/dangos.js",
  "data/matches.js",
  "data/tournament.js",
  "engine/simulator.js",
].map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");

const context = { console, setTimeout };
vm.createContext(context);
vm.runInContext(`${source}
this.api = {
  registerStageGroup,
  makeInitial,
  setCurrentGroup,
  stepDango,
  simulateOne,
  runBatchAsync,
  advanceTurn,
  stackAt,
  raceProgress,
  triggerYunoTeleport,
  applyRoundEndSkills,
  attemptAemisTeleport,
  finalRanking,
  DEFAULT_RANKING_KEY,
};
`, context);

const api = context.api;

function sequenceRng(values) {
  let index = 0;
  return () => index < values.length ? values[index++] : 0.99;
}

function placeState(s, stacks) {
  s.stacks = {};
  Object.values(s.status).forEach(status => { status.tile = 2; status.canFinish = true; });
  let kingTile = 1;
  let hasKing = false;

  for (const [tileText, ids] of Object.entries(stacks)) {
    const tile = Number(tileText);
    s.stacks[tile] = [...ids];
    for (const id of ids) {
      if (id === "king") {
        kingTile = tile;
        hasKing = true;
      } else if (s.status[id]) {
        s.status[id].tile = tile;
      }
    }
  }

  if (!hasKing) s.stacks[1] = ["king"];
  s.king = { tile: hasKing ? kingTile : 1, active: true };
  s.lastAction = null;
  s.winner = null;
  s.log = [];
}

function makeStageState(ids, stacks, actor) {
  const group = api.registerStageGroup(ids, "zero move regression");
  const s = api.makeInitial(1, false, group);
  placeState(s, stacks);
  s.order = [actor, ...ids.filter(id => id !== actor)];
  s.turnIndex = 0;
  return s;
}

function makeGroupState(group, stacks, actor) {
  const s = api.makeInitial(1, false, group);
  placeState(s, stacks);
  s.order = [actor, ...Object.keys(s.status).filter(id => id !== actor)];
  s.turnIndex = 0;
  return s;
}

function act(s, actor, rngValues, forcedRoll = 1) {
  s.rng = sequenceRng(rngValues);
  api.setCurrentGroup(s.group);
  api.stepDango(s, actor, forcedRoll);
  return s;
}

function logsContain(s, text) {
  return s.log.some(line => line.includes(text));
}

function assertLinneZeroMoveOnTile(tile, expectedTile, expectedLog) {
  const s = makeGroupState("B", { [tile]: ["linne", "chisaki"] }, "linne");
  act(s, "linne", [0.7, 0.1]);
  assert.equal(s.lastAction.actualSteps, 0);
  assert.equal(s.status.linne.tile, expectedTile);
  assert.ok(logsContain(s, expectedLog), `expected log containing ${expectedLog}`);
}

function assertAugustaZeroMoveOnTile(tile, expectedTile, expectedLog) {
  const s = makeGroupState("C", { [tile]: ["augusta", "jinhsi"] }, "augusta");
  act(s, "augusta", [0.99, 0.1]);
  assert.equal(s.lastAction.actualSteps, 0);
  assert.deepEqual(Array.from(s.lastAction.groupIds), ["augusta"]);
  assert.equal(s.status.augusta.tile, expectedTile);
  assert.equal(s.status.augusta.forceLastNextRound, true);
  assert.ok(logsContain(s, expectedLog), `expected log containing ${expectedLog}`);
}

function testLinneNormalZeroMoveTriggersJinhsi() {
  const s = makeStageState(["linne", "jinhsi"], { 2: ["linne", "jinhsi"] }, "linne");
  act(s, "linne", [0.7, 0.99]);
  assert.equal(s.lastAction.actualSteps, 0);
  assert.deepEqual(Array.from(api.stackAt(s, 2)), ["linne", "jinhsi"]);
  assert.ok(logsContain(s, "今汐头顶出现普通团子"));
}

function testAugustaNormalZeroMoveTriggersJinhsi() {
  const s = makeGroupState("C", { 2: ["augusta", "jinhsi"] }, "augusta");
  act(s, "augusta", [0.99]);
  assert.equal(s.lastAction.actualSteps, 0);
  assert.deepEqual(Array.from(api.stackAt(s, 2)), ["augusta", "jinhsi"]);
  assert.ok(logsContain(s, "今汐头顶出现普通团子"));
  assert.ok(!logsContain(s, "主动行动跳过"));
}

function testLinneSpecialTiles() {
  assertLinneZeroMoveOnTile(7, 7, "裂隙");
  assertLinneZeroMoveOnTile(4, 5, "推进");
  assertLinneZeroMoveOnTile(11, 10, "阻遏");
}

function testAugustaSpecialTiles() {
  assertAugustaZeroMoveOnTile(7, 7, "裂隙");
  assertAugustaZeroMoveOnTile(4, 5, "推进");
  assertAugustaZeroMoveOnTile(11, 10, "阻遏");
}

function testWinnerStopsAfterZeroMove() {
  const s = makeGroupState("C", { 1: ["augusta", "jinhsi", "king"] }, "augusta");
  act(s, "augusta", [0.01]);
  assert.equal(s.winner, "augusta");
  assert.ok(logsContain(s, "重新落在终点"));
  assert.ok(!logsContain(s, "今汐头顶出现普通团子"));
}


function makeYunoReadyState(stacks) {
  const s = makeGroupState("C", stacks, "yuno");
  s.status.yuno.hasPassedMidpoint = true;
  s.status.yuno.yunoUsed = false;
  return s;
}

function testRaceProgressMapping() {
  assert.equal(api.raceProgress(2), 0);
  assert.equal(api.raceProgress(3), 1);
  assert.equal(api.raceProgress(32), 30);
  assert.equal(api.raceProgress(1), 31);
}

function testYunoLinearFrontBackAllowsTrigger() {
  const s = makeYunoReadyState({
    32: ["flololo"],
    1: ["jinhsi", "king"],
    2: ["changli"],
    10: ["yuno", "augusta"],
    12: ["calcharo"],
  });
  const triggered = api.triggerYunoTeleport(s, "测试");
  assert.equal(triggered, true);
  assert.equal(s.status.yuno.yunoUsed, true);
  assert.ok(Object.values(s.status).every(status => status.tile === 10));
}

function testYunoAtFinishHasNoFront() {
  const s = makeYunoReadyState({
    1: ["yuno", "king"],
    2: ["augusta"],
    3: ["flololo"],
    32: ["changli"],
  });
  const triggered = api.triggerYunoTeleport(s, "测试");
  assert.equal(triggered, false);
  assert.equal(s.status.yuno.yunoUsed, false);
  assert.ok(logsContain(s, "前方和后方不同时存在其他普通团子"));
}

function testYunoAtStartHasNoBehind() {
  const s = makeYunoReadyState({
    1: ["augusta", "king"],
    2: ["yuno"],
    3: ["flololo"],
    32: ["changli"],
  });
  const triggered = api.triggerYunoTeleport(s, "测试");
  assert.equal(triggered, false);
  assert.equal(s.status.yuno.yunoUsed, false);
  assert.ok(logsContain(s, "前方和后方不同时存在其他普通团子"));
}

function testYunoIgnoresSameTileAndKingForFrontBack() {
  const s = makeYunoReadyState({
    9: ["king"],
    10: ["yuno", "augusta", "flololo", "jinhsi"],
    11: ["changli"],
    12: ["calcharo"],
  });
  const triggered = api.triggerYunoTeleport(s, "测试");
  assert.equal(triggered, false);
  assert.equal(s.status.yuno.yunoUsed, false);
}

function testChangliSeesKingBelow() {
  const s = makeGroupState("C", { 5: ["changli", "king"] }, "changli");
  s.rng = sequenceRng([0.1]);
  api.applyRoundEndSkills(s);
  assert.equal(s.status.changli.forceLastNextRound, true);
  assert.ok(logsContain(s, "长离下方有堆叠单位"));
}

function testAugustaSeesKingAsPhysicalStack() {
  const s = makeGroupState("C", { 5: ["augusta", "king"] }, "augusta");
  act(s, "augusta", [0.99], 1);
  assert.equal(s.lastAction.actualSteps, 0);
  assert.deepEqual(Array.from(api.stackAt(s, 5)), ["augusta", "king"]);
  assert.equal(s.status.augusta.forceLastNextRound, true);
  assert.ok(logsContain(s, "物理堆叠最顶端"));
}

function testFlololoDoesNotTreatKingBelowAsBottom() {
  const s = makeGroupState("C", { 5: ["flololo", "king"] }, "flololo");
  act(s, "flololo", [0.99], 1);
  assert.equal(s.lastAction.actualSteps, 1);
  assert.equal(s.status.flololo.activeMoveBonus, 0);
  assert.ok(!s.lastAction.notes.some(note => note.includes("弗洛洛底层加速")));
}

function testFlololoBottomWithoutKingStillTriggers() {
  const s = makeGroupState("C", { 5: ["augusta", "flololo"] }, "flololo");
  act(s, "flololo", [0.99], 1);
  assert.equal(s.lastAction.actualSteps, 4);
  assert.equal(s.status.flololo.activeMoveBonus, 3);
  assert.ok(s.lastAction.notes.some(note => note.includes("弗洛洛底层加速 +3")));
}

function testFinalRankingExcludesKing() {
  const s = makeGroupState("C", { 1: ["augusta", "king"], 2: ["yuno"], 3: ["flololo"], 4: ["changli"], 5: ["jinhsi"], 6: ["calcharo"] }, "augusta");
  s.winner = "augusta";
  const ranking = api.finalRanking(s);
  assert.equal(ranking.length, 6);
  assert.ok(!ranking.includes("king"));
}

function testYunoReorderKeepsKingOutOfRanking() {
  const s = makeYunoReadyState({
    1: ["flololo"],
    9: ["changli"],
    10: ["yuno", "king"],
    12: ["augusta"],
    14: ["jinhsi"],
    16: ["calcharo"],
  });
  const triggered = api.triggerYunoTeleport(s, "测试");
  const stack = api.stackAt(s, 10);
  assert.equal(triggered, true);
  assert.equal(stack.length, 7);
  assert.equal(stack.at(-1), "king");
  assert.equal(stack.filter(id => id === "king").length, 1);
  assert.equal(stack.filter(id => id !== "king").length, 6);
}

function testAemisDoesNotTargetKing() {
  const s = makeGroupState("B", { 10: ["aemis"], 12: ["king"] }, "aemis");
  s.status.aemis.hasPassedMidpoint = true;
  const triggered = api.attemptAemisTeleport(s, "测试");
  assert.equal(triggered, false);
  assert.equal(s.status.aemis.ghostUsed, false);
  assert.equal(s.status.aemis.tile, 10);
  assert.ok(logsContain(s, "没有其他非布大王团子"));
}

function testBatchGroupsComplete() {
  for (const group of ["A", "B", "C"]) {
    for (let seed = 1; seed <= 25; seed++) {
      const s = api.simulateOne(seed, 1000, "random", api.DEFAULT_RANKING_KEY, true, group);
      assert.ok(s.winner, `${group} seed ${seed} should produce a winner`);
    }
  }
}

function runBatch(group) {
  return new Promise((resolve, reject) => {
    api.runBatchAsync(
      20,
      20260513,
      false,
      () => {},
      result => {
        try {
          assert.equal(result.done, 20);
          assert.equal(result.rows.length, 6);
          assert.ok(result.rows.every(row => Number.isFinite(row.winRate)));
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      "random",
      api.DEFAULT_RANKING_KEY,
      true,
      group,
      4,
    );
  });
}

async function testRunBatchAsyncCompletes() {
  for (const group of ["A", "B", "C"]) await runBatch(group);
}

function testStageGroupCompletes() {
  const group = api.registerStageGroup(["danjin", "shorekeeper", "augusta", "linne", "jinhsi", "aemis"], "stage flow smoke");
  const s = api.simulateOne(20260513, 1000, "random", api.DEFAULT_RANKING_KEY, true, group);
  assert.ok(s.winner, "stage group should produce a winner");
}

function testManualEngineEntrypoints() {
  let s = api.makeInitial(42, false, "B");
  s = api.advanceTurn(s);
  assert.ok(s.lastAction, "random manual step should record an action");
  s = api.advanceTurn(s, 2);
  assert.ok(s.lastAction, "forced manual step should record an action");
}

const tests = [
  testLinneNormalZeroMoveTriggersJinhsi,
  testAugustaNormalZeroMoveTriggersJinhsi,
  testLinneSpecialTiles,
  testAugustaSpecialTiles,
  testWinnerStopsAfterZeroMove,
  testRaceProgressMapping,
  testYunoLinearFrontBackAllowsTrigger,
  testYunoAtFinishHasNoFront,
  testYunoAtStartHasNoBehind,
  testYunoIgnoresSameTileAndKingForFrontBack,
  testChangliSeesKingBelow,
  testAugustaSeesKingAsPhysicalStack,
  testFlololoDoesNotTreatKingBelowAsBottom,
  testFlololoBottomWithoutKingStillTriggers,
  testFinalRankingExcludesKing,
  testYunoReorderKeepsKingOutOfRanking,
  testAemisDoesNotTargetKing,
  testBatchGroupsComplete,
  testRunBatchAsyncCompletes,
  testStageGroupCompletes,
  testManualEngineEntrypoints,
];

(async () => {
  for (const test of tests) await test();
  console.log(`ok - ${tests.length} zero-move regression checks passed`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
