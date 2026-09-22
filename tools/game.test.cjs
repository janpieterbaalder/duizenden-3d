const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('index.html', 'utf8');
const scoring = source.slice(source.indexOf('function calculateScore('), source.indexOf('// ===================== GAME LOGIC'));
const options = source.slice(source.indexOf('function botFindKeepOptions('), source.indexOf('// Bot strategie:'));
const context = vm.createContext({ state: { dice: [] } });
vm.runInContext(scoring + options, context);

test('puntentelling, straat, trio, losse stenen en ongeldige selectie', () => {
  for (const [dice, expected] of [[[1],100], [[5],50], [[2,2,2],200], [[1,1,1],1000], [[1,2,3,4,5,6],1000], [[2,3,4,6],0], [[1,1,1,1,5],1150]]) {
    assert.equal(context.calculateScore(dice), expected);
  }
  assert.equal(context.isValidSelection([{value:1},{value:2}]), false);
  assert.equal(context.isValidSelection([{value:2},{value:2},{value:2}]), true);
});

test('alle 55.986 mogelijke worpen: botopties zijn geldige selecties met dezelfde score', () => {
  function visit(values, remaining) {
    if (!remaining) {
      const options = context.botFindKeepOptions(values);
      assert.equal(context.canScoreAny(values), options.length > 0);
      for (const option of options) {
        const selected = option.kPerValue.flatMap((n, value) => Array(n).fill({value}));
        assert.equal(context.isValidSelection(selected), true);
        assert.equal(context.calculateScore(selected.map(d=>d.value)), option.score);
        assert.equal(selected.length, option.kept);
      }
      return;
    }
    for (let value=1; value<=6; value++) visit([...values,value],remaining-1);
  }
  for (let n=1;n<=6;n++) visit([],n);
});

test('selectie buiten het bereik van de stenen is veilig', () => {
  const functionSource = source.slice(source.indexOf('function selectDie('), source.indexOf('function bankScore('));
  vm.runInContext(functionSource, context);
  context.state = { phase:'select', dice:[], rolling:false, animating:false };
  assert.doesNotThrow(()=>context.selectDie(5));
});
