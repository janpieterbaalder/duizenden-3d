const { test, expect } = require('@playwright/test');

async function start(page) {
  await page.goto('/');
  await page.waitForFunction(()=>window.Renderer3D?.ready);
  await page.getByRole('button',{name:'👥 Multiplayer',exact:true}).click();
  await page.getByRole('button',{name:'2',exact:true}).click();
  await page.getByRole('button',{name:'VOLGENDE',exact:true}).click();
  await page.getByRole('button',{name:'STARTEN',exact:true}).click();
}

test('werkelijke worp, selectie, wegpakken, volgende speler en geen browserfouten',async({page})=>{
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  for(let n=0;n<3;n++) {
    await page.locator('#btn-roll').click();
    await page.waitForFunction(()=>!gameGetState().rolling,{},{timeout:20000});
    const values=await page.evaluate(()=>gameGetState().dice.map(d=>d.value));
    expect(values.length).toBe(6);
    expect(values.every(v=>v>=1&&v<=6)).toBeTruthy();
    await page.waitForTimeout(1700);
    if(await page.evaluate(()=>gameGetState().phase==='select')) break;
  }
  // A controlled rules fixture exercises the physical keep-animation's callback.
  await page.evaluate(()=>{
    const s=gameGetState();s.phase='select';s.turnScore=350;s.selectedScore=0;
    s.dice.forEach(d=>{d.kept=false;d.selected=false;d.value=1;});
    gameSelectDie(0);
  });
  await page.keyboard.press('Digit1');
  expect(await page.evaluate(()=>gameGetState().dice[0].selected)).toBe(false);
  await page.keyboard.press('Digit1');
  await page.locator('#btn-bank').click();
  await page.waitForFunction(()=>gameGetState().currentPlayer===1);
  expect(await page.evaluate(()=>gameGetState().scores[0])).toBe(450);
  expect(errors).toEqual([]);
});

test('onvoldoende punten pakken verandert geen beurt of score',async({page})=>{
  await start(page);
  const result=await page.evaluate(()=>{
    const s=gameGetState();s.phase='select';s.turnScore=100;s.dice=[];
    bankScore();return {turn:s.turnScore,player:s.currentPlayer,score:s.scores[0]};
  });
  expect(result).toEqual({turn:100,player:0,score:0});
});

test('laatste ronde geeft alle spelers evenveel beurten',async({page})=>{
  await start(page);
  await page.evaluate(()=>{
    const s=gameGetState();s.finalRound=true;s.finalRoundTrigger=0;s.scores=[10000,10100];
    nextPlayer();
  });
  expect(await page.evaluate(()=>gameGetState().gameOver)).toBe(false);
  await page.evaluate(()=>nextPlayer());
  await expect(page.locator('#win-overlay')).toHaveClass(/show/);
});

test('tafel en worp starten offline na installatie',async({page,context})=>{
  await page.goto('/');
  await page.waitForFunction(()=>window.Renderer3D?.ready);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  await context.setOffline(true);
  await start(page);
  await page.locator('#btn-roll').click();
  await page.waitForFunction(()=>!gameGetState().rolling,{},{timeout:20000});
  expect(await page.evaluate(()=>gameGetState().dice.length)).toBe(6);
});

test('landscape telefoon en minder beweging',async({page})=>{
  await page.setViewportSize({width:844,height:390});
  await page.emulateMedia({reducedMotion:'reduce'});
  await start(page);
  await expect(page.locator('#btn-roll')).toBeInViewport();
  await page.locator('#btn-roll').click();
  await page.waitForFunction(()=>!gameGetState().rolling,{},{timeout:20000});
  await page.screenshot({path:'test-results/mobile.png'});
});

test('onderbroken tab rondt een worp niet voortijdig af',async({page})=>{
  await start(page);
  await page.evaluate(()=>{
    rollDice();
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
  });
  await page.waitForTimeout(8500);
  expect(await page.evaluate(()=>gameGetState().rolling)).toBe(true);
  await page.evaluate(()=>{
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(()=>gameGetState().rolling)).toBe(true);
  await page.waitForFunction(()=>!gameGetState().rolling,null,{timeout:20000});
});
