import test from "node:test";
import assert from "node:assert/strict";
import {
  uidForId, assignedStaff, trainingCountSince, ladderRank,
  assignedToPlayer, newest, lastTsForChannels, playerChannels
} from "../js/views/player360.data.js";

const roster = [
  { id:"1", name:"H",    role:"player",          uid:"uH" },
  { id:"2", name:"Koka", role:"player",          uid:"uK" },
  { uid:"sM", name:"Bassem",  role:"mental_coach",    assigned:["uK"] },
  { uid:"sF", name:"Mostafa", role:"fitness_trainer", assigned:["uK"] },
];

test("uidForId maps data id to auth uid", () => {
  assert.equal(uidForId(roster, "2"), "uK");
  assert.equal(uidForId(roster, "9"), null);
});

test("assignedStaff finds mental + fitness for a player uid", () => {
  const s = assignedStaff(roster, "uK");
  assert.equal(s.mental.name, "Bassem");
  assert.equal(s.fitness.name, "Mostafa");
  const none = assignedStaff(roster, "uH");
  assert.equal(none.mental, null);
  assert.equal(none.fitness, null);
});

test("trainingCountSince counts sessions on/after cutoff", () => {
  const tr = [{ ts:100 }, { ts:200 }, { ts:50 }];
  assert.equal(trainingCountSince(tr, 100), 2);
  assert.equal(trainingCountSince([], 100), 0);
});

test("ladderRank returns 1-based position or null", () => {
  assert.equal(ladderRank({ order:["3","1","2"] }, "1"), 2);
  assert.equal(ladderRank({ order:["3","1"] }, "9"), null);
  assert.equal(ladderRank(null, "1"), null);
});

test("assignedToPlayer matches team or id arrays", () => {
  const items = [{ assignedTo:"team" }, { assignedTo:["2","3"] }, { assignedTo:["4"] }];
  assert.equal(assignedToPlayer(items, "2").length, 2);
  assert.equal(assignedToPlayer(items, "4").length, 2);
  assert.equal(assignedToPlayer(items, "9").length, 1);
});

test("newest returns max-ts item, null when empty", () => {
  assert.equal(newest([{ ts:1, v:"a" }, { ts:3, v:"c" }, { ts:2 }]).v, "c");
  assert.equal(newest([]), null);
});

test("lastTsForChannels returns max ts among matching channels", () => {
  const msgs = [{ channelId:"a", ts:10 }, { channelId:"b", ts:30 }, { channelId:"a", ts:20 }];
  assert.equal(lastTsForChannels(msgs, ["a"]), 20);
  assert.equal(lastTsForChannels(msgs, ["b"]), 30);
  assert.equal(lastTsForChannels(msgs, ["z"]), null);
});

test("playerChannels filters by playerUid", () => {
  const ch = [{ playerUid:"uK", id:"c1" }, { playerUid:"uH", id:"c2" }];
  assert.equal(playerChannels(ch, "uK").length, 1);
  assert.equal(playerChannels(ch, "uK")[0].id, "c1");
});
