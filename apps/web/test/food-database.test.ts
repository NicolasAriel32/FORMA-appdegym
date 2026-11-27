import assert from "node:assert/strict";
import test from "node:test";
import { caloriesFor, FOODS, macrosFor, searchFoods, sumMacros } from "../src/nutrition/food-database.js";

test("every food has unique id, sane macros and at least one portion", () => {
  assert.equal(new Set(FOODS.map((food) => food.id)).size, FOODS.length);
  for (const food of FOODS) {
    const { protein, carbs, fats } = food.per100;
    assert.ok([protein, carbs, fats].every((value) => value >= 0), food.id);
    assert.ok(protein + carbs + fats <= 100.5, `${food.id} supera 100 g de macros cada 100 g`);
    assert.ok(food.portions.length > 0 && food.portions.every((portion) => portion.grams > 0), food.id);
  }
});

test("search ignores accents and finds synonyms", () => {
  assert.equal(searchFoods("fideos")[0]?.id, "fideos-cocidos");
  assert.ok(searchFoods("codito").some((food) => food.id === "fideos-cocidos"));
  assert.ok(searchFoods("milanesa").length >= 4);
  assert.ok(searchFoods("platano").some((food) => food.id === "banana"));
  assert.equal(searchFoods("brocoli")[0]?.id, "brocoli");
  assert.deepEqual(searchFoods("   "), []);
});

test("macros scale with grams and add up", () => {
  const pasta = macrosFor(FOODS.find((food) => food.id === "fideos-cocidos")!, 250);
  assert.deepEqual(pasta, { protein: 14.5, carbs: 77.3, fats: 2.3 });
  const milanesa = macrosFor(FOODS.find((food) => food.id === "milanesa-carne-frita")!, 150);
  assert.deepEqual(milanesa, { protein: 27, carbs: 21, fats: 24 });
  const total = sumMacros([pasta, milanesa]);
  assert.deepEqual(total, { protein: 41.5, carbs: 98.3, fats: 26.3 });
  assert.equal(caloriesFor(total), 796);
});
