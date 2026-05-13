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
