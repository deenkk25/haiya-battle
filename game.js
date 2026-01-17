    const BOARD_SIZE = 8;
    const MAX_TURNS = 60;
    const MAX_HAND = 3;
    

    const PieceType = {
      KING:'king', KNIGHT:'knight', FOOTMAN:'footman', ARCHER:'archer',
      CASTLE:'castle', MONK:'monk', SHIELD:'shield', MAGE:'mage', ASSASSIN:'assassin',
    };

    const HP_KING=5, HP_FOOTMAN=2, HP_KNIGHT=2, HP_ARCHER=2, HP_MONK=1, HP_MAGE=1, HP_ASSASSIN=1, HP_SHIELD=3, HP_CASTLE=4;

    let gameMode='cpu';
    let cpuPlayer='black';

    let bgmEnabled=false;
    const bgmAudio=new Audio('bgm.mp3');
    bgmAudio.loop=true; bgmAudio.volume=0.4;

    const sfx = {
      move:new Audio('move.mp3'),
      attack:new Audio('attack.mp3'),
      card:new Audio('card.mp3'),
      win:new Audio('win.mp3'),
    };
    function playSfx(name){
      const a=sfx[name]; if(!a) return;
      try{ a.currentTime=0; a.play(); }catch(e){}
    }
    function toggleBgm(){
      bgmEnabled=!bgmEnabled;
      if(bgmEnabled) bgmAudio.play().catch(()=>{});
      else bgmAudio.pause();
      document.getElementById('bgmBtn').textContent = bgmEnabled ? 'BGM 停止' : 'BGM 再生';
    }
    function toggleFullscreen(){
      // ゲーム全体のレイアウト要素。なければ document.documentElement でもOK
      const root = document.getElementById('mainLayout') || document.documentElement;

      if (!document.fullscreenElement) {
        // フルスクリーンに入る
        if (root.requestFullscreen) {
          root.requestFullscreen();
        }
      } else {
        // フルスクリーン解除
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    }

    function handleFullscreenChange(){
      const btn = document.getElementById('fullscreenBtn');
      if (!btn) return;

      // フルスクリーン中かどうかでボタンの表示を変える
      if (document.fullscreenElement) {
        btn.textContent = '全画面解除';
      } else {
        btn.textContent = '全画面';
      }
    }

    let state = {
      board:[],
      currentPlayer:'white',
      selectedCell:null,
      validMoves:[],
      decks:{white:[],black:[]},
      hands:{white:[],black:[]},
      discard:[],
      activeEffect:null,
      targeting:null,
      prayerShield:{white:false, black:false},
      terrainBlocks:[],
      traps:[],
      aoePreview:[],
      winner:null,
      log:[],
      turnCount:1,
      cardPlayedThisTurn:false,
      guardBarrier:{white:null, black:null},
      timeStop:{white:null, black:null},
      cardLock:{white:false, black:false},
      turnActionCells:[],
      lastTurnHighlight:null,
      lastReplayText:'',
      turnStartLogIndex:0,
      usedCardThisTurn:null
    };
// 盤面エフェクト用レイヤー
let effectLayer = null;

function ensureEffectLayer(){
  if (effectLayer) return;
  const wrapper = document.getElementById('boardWrapper');
  if (!wrapper) return;
  const layer = document.createElement('div');
  layer.id = 'effectLayer';
  wrapper.appendChild(layer);
  effectLayer = layer;
}

// 指定したマスにカードエフェクトを出す
function spawnCardEffect(type, cells){
  ensureEffectLayer();
  if (!effectLayer) return;
  const cellSize = 100 / BOARD_SIZE; // 8マスなら 12.5%

  cells.forEach(c => {
    const el = document.createElement('div');
    el.className = `effect effect-${type}`;
    el.style.left   = (c.x * cellSize) + '%';
    el.style.top    = (c.y * cellSize) + '%';
    el.style.width  = cellSize + '%';
    el.style.height = cellSize + '%';
    effectLayer.appendChild(el);

    // アニメ終了で自動削除（保険でタイマーも）
    el.addEventListener('animationend', () => el.remove());
    setTimeout(() => { if (el.parentNode) el.remove(); }, 1200);
  });
}


    const CARD_TEMPLATES = [
      { id:'speed', name:'追い風', icon:'💨', description:'このターンだけ、歩兵・僧侶・弓兵・騎馬・盾兵・暗殺者・魔導士の移動性能が大幅アップ。', type:'speed' },
      { id:'smite', name:'隕石', icon:'☄', description:'敵の駒1体に2ダメージ（キングにも有効）。', type:'smite' },
      { id:'plague', name:'疫病', icon:'🦠', description:'指定したマスを中心に3×3に1ダメージ（敵味方問わず）。', type:'plague' },
      { id:'prayer', name:'祈り', icon:'🙏', description:'次の相手ターン、相手の最初のハイヤーを無効化。', type:'prayer' },
      { id:'terrain', name:'地の利', icon:'⛰', description:'指定マス1つを敵だけ通れない障害物にする。', type:'terrain' },
      { id:'divine', name:'飢餓', icon:'☠', description:'指定マスを中心に十字方向＋中心の敵駒に1ダメージ。', type:'divine' },
      { id:'boulder', name:'天変地異', icon:'🪨', description:'ランダム3マスが敵だけ通れない障害物になる（ダメージなし）。', type:'boulder' },
      { id:'escape', name:'逃亡', icon:'🏃', description:'自分のキングを任意の空きマスに移動させる。', type:'escape' },
      { id:'swamp', name:'沼', icon:'🕳', description:'ランダム2マスに罠を設置。敵が踏むと1ダメージ＆マス表示。', type:'swamp' },
      { id:'barrier', name:'守護結界', icon:'🛡', description:'自軍キングへの次のダメージ1回を無効化（相手ターンまで持続）。', type:'barrier' },
      { id:'chain', name:'神成', icon:'🌩', description:'敵1体に1ダメージ＋その周囲8マスの敵にも1ダメージ。', type:'chain' },
      { id:'timestop', name:'混乱', icon:'💫', description:'次の相手ターン、相手は駒を動かせない（ハイヤー使用は可）。', type:'timestop' },
      { id:'force', name:'フォースの導き', icon:'✨', description:'キングと城以外の自軍駒1体を選び、任意の空きマスへワープ移動（攻撃不可／罠は発動／障害物には乗れない）。', type:'force' },
    ];

    function getMaxHpByType(type){
      switch(type){
        case PieceType.KING: return HP_KING;
        case PieceType.FOOTMAN: return HP_FOOTMAN;
        case PieceType.KNIGHT: return HP_KNIGHT;
        case PieceType.ARCHER: return HP_ARCHER;
        case PieceType.MONK: return HP_MONK;
        case PieceType.MAGE: return HP_MAGE;
        case PieceType.ASSASSIN: return HP_ASSASSIN;
        case PieceType.SHIELD: return HP_SHIELD;
        case PieceType.CASTLE: return HP_CASTLE;
        default: return 1;
      }
    }

    function shuffle(array){
      for(let i=array.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [array[i],array[j]]=[array[j],array[i]];
      }
    }

    function initGame(mode='cpu'){
      gameMode=mode;
      cpuPlayer = (gameMode==='cpu') ? 'black' : null;

      state.board=[];
      for(let y=0;y<BOARD_SIZE;y++){
        const row=[];
        for(let x=0;x<BOARD_SIZE;x++) row.push(null);
        state.board.push(row);
      }

      let positions=[];
      for(let y=0;y<BOARD_SIZE;y++) for(let x=0;x<BOARD_SIZE;x++) positions.push({x,y});
      shuffle(positions);

      const piecesToPlace=[];
      piecesToPlace.push({player:'black', type:PieceType.KING});
      for(let i=0;i<2;i++) piecesToPlace.push({player:'black', type:PieceType.KNIGHT});
      for(let i=0;i<2;i++) piecesToPlace.push({player:'black', type:PieceType.FOOTMAN});
      for(let i=0;i<2;i++) piecesToPlace.push({player:'black', type:PieceType.ARCHER});
      piecesToPlace.push({player:'black', type:PieceType.MONK});
      for(let i=0;i<2;i++) piecesToPlace.push({player:'black', type:PieceType.SHIELD});
      piecesToPlace.push({player:'black', type:PieceType.MAGE});
      piecesToPlace.push({player:'black', type:PieceType.ASSASSIN});

      piecesToPlace.push({player:'white', type:PieceType.KING});
      for(let i=0;i<2;i++) piecesToPlace.push({player:'white', type:PieceType.KNIGHT});
      for(let i=0;i<2;i++) piecesToPlace.push({player:'white', type:PieceType.FOOTMAN});
      for(let i=0;i<2;i++) piecesToPlace.push({player:'white', type:PieceType.ARCHER});
      piecesToPlace.push({player:'white', type:PieceType.MONK});
      for(let i=0;i<2;i++) piecesToPlace.push({player:'white', type:PieceType.SHIELD});
      piecesToPlace.push({player:'white', type:PieceType.MAGE});
      piecesToPlace.push({player:'white', type:PieceType.ASSASSIN});

      for(let i=0;i<piecesToPlace.length;i++){
        const pos=positions[i];
        const spec=piecesToPlace[i];
        state.board[pos.y][pos.x]={ player:spec.player, type:spec.type, hp:getMaxHpByType(spec.type) };
      }

      placeCastlesAdjacent();

      state.decks.white=[]; state.decks.black=[];
      CARD_TEMPLATES.forEach(t=>{ state.decks.white.push({...t}); state.decks.black.push({...t}); });
      shuffle(state.decks.white); shuffle(state.decks.black);

      state.hands.white=[]; state.hands.black=[];
      state.discard=[];
      state.activeEffect=null;
      state.targeting=null;
      state.prayerShield={white:false, black:false};
      state.terrainBlocks=[];
      state.traps=[];
      state.aoePreview=[];
      state.winner=null;
      state.log=[];
      state.turnCount=1;
      state.currentPlayer='white';
      state.selectedCell=null;
      state.validMoves=[];
      state.cardPlayedThisTurn=false;
      state.guardBarrier={white:null, black:null};
      state.timeStop={white:null, black:null};
      state.cardLock={white:true, black:false}; // 白1ターン目ロック
      state.turnActionCells=[];
      state.lastTurnHighlight=null;
      state.lastReplayText='';
      state.turnStartLogIndex=0;
      state.usedCardThisTurn=null;

      for(let i=0;i<MAX_HAND;i++){ drawCard('white'); drawCard('black'); }

      if(gameMode==='cpu') logMessage('ゲーム開始。【CPU戦】白＝プレイヤー ／ 黒＝CPU');
      else logMessage('ゲーム開始。【対人戦】白＝P1 ／ 黒＝P2');
      logMessage('先行（白）は1ターン目のみハイヤーカード使用不可。');
      logMessage('白のターン。');
      state.turnStartLogIndex = state.log.length;

      updateModeButtons();
      renderAll();

      if(!state.winner && gameMode==='cpu' && state.currentPlayer===cpuPlayer){
        setTimeout(cpuTurn,400);
      }
    }

    function placeCastlesAdjacent(){
      ['white','black'].forEach(player=>{
        const kingPos=findKing(player);
        if(!kingPos) return;

        const dirs=[
          {dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},
          {dx:1,dy:1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:-1,dy:-1},
        ];
        for(const d of dirs){
          const nx=kingPos.x+d.dx, ny=kingPos.y+d.dy;
          if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) continue;
          if(!state.board[ny][nx]){
            state.board[ny][nx]={player, type:PieceType.CASTLE, hp:HP_CASTLE};
            return;
          }
        }
      });
    }

    function updateModeButtons(){
      const cpuBtn=document.getElementById('modeCpuBtn');
      const pvpBtn=document.getElementById('modePvpBtn');
      cpuBtn.classList.toggle('active', gameMode==='cpu');
      pvpBtn.classList.toggle('active', gameMode==='pvp');
    }

    function drawCard(player){
      const deck=state.decks[player];
      if(!deck||deck.length===0) return;
      if(state.hands[player].length>=MAX_HAND) return;
      const card=deck.pop();
      state.hands[player].push(card);
      logMessage(`${player==='white'?'白':'黒'}が「${card.name}」をドロー。`);
    }

    function glyphFor(piece){
      switch(piece.type){
        case PieceType.KING: return '♔';
        case PieceType.KNIGHT: return '♞';
        case PieceType.FOOTMAN: return '♙';
        case PieceType.ARCHER: return '➹';
        case PieceType.CASTLE: return '♖';
        case PieceType.MONK: return '✝';
        case PieceType.SHIELD: return '🛡';
        case PieceType.MAGE: return '❂';
        case PieceType.ASSASSIN: return '✧';
        default: return '?';
      }
    }

    function hpKanji(piece){
      if(!piece||piece.type!==PieceType.KING) return '';
      if(piece.hp>=5) return '寿';
      if(piece.hp>=3) return '栄';
      if(piece.hp===2) return '衰';
      if(piece.hp===1) return '滅';
      return '';
    }

    function renderBoard(){
  const boardDiv = document.getElementById('board');
  boardDiv.innerHTML = '';

  // ターン表示 + 混乱中クラスをまとめて制御
  boardDiv.classList.remove(
    'white-turn',
    'black-turn',
    'timestop-lock-white',
    'timestop-lock-black'
  );
  boardDiv.classList.add(
    state.currentPlayer === 'white' ? 'white-turn' : 'black-turn'
  );

  // 💫 混乱：そのターンのプレイヤーがロックされている場合にクラス付与
  const cp = state.currentPlayer;
  if (state.timeStop[cp] && state.timeStop[cp].active) {
    boardDiv.classList.add(
      cp === 'white' ? 'timestop-lock-white' : 'timestop-lock-black'
    );
  }




      for(let y=0;y<BOARD_SIZE;y++){
        for(let x=0;x<BOARD_SIZE;x++){
          const cellDiv=document.createElement('div');
          cellDiv.classList.add('cell');
          cellDiv.classList.add((x+y)%2===1?'dark':'light');
          cellDiv.dataset.x=x; cellDiv.dataset.y=y;

          const piece=state.board[y][x];

          const block=state.terrainBlocks.find(b=>b.x===x&&b.y===y);
          if(block){
            if(block.blockedFor==='white') cellDiv.classList.add('terrain-block-white');
            else if(block.blockedFor==='black') cellDiv.classList.add('terrain-block-black');
            else if(block.blockedFor==='both') cellDiv.classList.add('stone-block');
            const sym=document.createElement('span');
            sym.classList.add('cell-symbol');
            sym.textContent = block.kind==='terrain' ? '⛰' : '🪨';
            cellDiv.appendChild(sym);
          }

          const trap=state.traps.find(t=>t.x===x&&t.y===y&&t.revealed);
          if(trap){
            cellDiv.classList.add('trap-revealed');
            const sym=document.createElement('span');
            sym.classList.add('cell-symbol');
            sym.textContent='🕳';
            cellDiv.appendChild(sym);
          }

          if(piece){
            const span=document.createElement('span');
            span.textContent=glyphFor(piece);
            const cls=piece.player==='white'?'white-piece':'black-piece';
            span.classList.add(cls);
            if(piece.type===PieceType.KING) span.classList.add('king');
            if(piece.type===PieceType.CASTLE) span.classList.add('castle');
            if(piece.type===PieceType.MAGE) span.classList.add('mage');
            cellDiv.appendChild(span);

            const hpSpan=document.createElement('span');
            let labelText=String(piece.hp);
            if(piece.type===PieceType.KING){
              const label=hpKanji(piece);
              labelText=`${label}${piece.hp}`;
              if(piece.hp>=4) hpSpan.classList.add('hp-high');
              else if(piece.hp>=3) hpSpan.classList.add('hp-mid');
              else hpSpan.classList.add('hp-low');
            }
            hpSpan.textContent=labelText;
            hpSpan.classList.add('hp-label');
            cellDiv.appendChild(hpSpan);

            if (piece.type === PieceType.KING) {
  const player = piece.player;
  const gb = state.guardBarrier[player];

  // 🛡 守護結界：キングマスを光らせる
  if (gb && gb.active && gb.hitsLeft > 0) {
    cellDiv.classList.add('king-barrier-active');

    const shieldIcon = document.createElement('span');
    shieldIcon.classList.add('buff-symbol', 'buff-symbol-shield');
    shieldIcon.textContent = '🛡';
    cellDiv.appendChild(shieldIcon);
  }

  // 🙏 祈り：キングマスに祈りオーラ
  if (state.prayerShield[player]) {
    cellDiv.classList.add('king-prayer-active');

    const prayerIcon = document.createElement('span');
    prayerIcon.classList.add('buff-symbol', 'buff-symbol-prayer', 'buff-symbol-left');
    prayerIcon.textContent = '🙏';
    cellDiv.appendChild(prayerIcon);
        }
      }
    }

          if(state.selectedCell && state.selectedCell.x===x && state.selectedCell.y===y) cellDiv.classList.add('selected');
          if(state.validMoves.some(m=>m.x===x&&m.y===y)) cellDiv.classList.add('highlight');

          if(state.aoePreview.some(a=>a.x===x&&a.y===y)){
            cellDiv.classList.add(state.currentPlayer==='white'?'aoe-preview-white':'aoe-preview-black');
          }

          if(state.lastTurnHighlight && state.lastTurnHighlight.cells.some(c=>c.x===x&&c.y===y)){
            cellDiv.classList.add(state.lastTurnHighlight.player==='white'?'last-turn-white':'last-turn-black');
          }

          cellDiv.addEventListener('click', onCellClick);
          boardDiv.appendChild(cellDiv);
        }
      }
    }

    function renderHandFor(player, containerId){
      const handDiv=document.getElementById(containerId);
      handDiv.innerHTML='';
      const hand=state.hands[player];
      if(hand.length===0){ handDiv.textContent='手札なし'; return; }

      const isCpuSide=(gameMode==='cpu' && player===cpuPlayer);
      const isCurrentTurn=(state.currentPlayer===player);

      hand.forEach((card,index)=>{
        const cardDiv=document.createElement('div');
        cardDiv.classList.add('card');

        const clickable =
          !state.winner &&
          !state.cardPlayedThisTurn &&
          isCurrentTurn &&
          !isCpuSide &&
          !isCardLocked(player);

        if(!clickable) cardDiv.classList.add('disabled');

        let extra='';
        if(isCardLocked(player) && player==='white' && state.turnCount===1){
          extra='<br><small>※ 先行1ターン目は使用不可</small>';
        }

        const icon = card.icon ? card.icon + ' ' : '';
        cardDiv.innerHTML = `<strong>${icon}${card.name}</strong><br><small>${card.description}</small>${extra}`;

        if(clickable) cardDiv.addEventListener('click',()=>playCardFor(player,index));
        handDiv.appendChild(cardDiv);
      });
    }

    function renderEffectsBar(){
      const bar=document.getElementById('effectsBar');
      function iconsFor(player){
        const icons=[];
        if(state.prayerShield[player]) icons.push('🙏 祈り：次のハイヤー封印');
        const gb=state.guardBarrier[player];
        if(gb && gb.active && gb.hitsLeft>0) icons.push('🛡 守護結界：ダメージ1回無効');
        const ts=state.timeStop[player];
        if(ts && ts.active) icons.push('💫 混乱：駒移動不可');
        const hasSwamp=state.traps.some(t=>t.owner===player && !t.revealed);
        if(hasSwamp) icons.push('🕳 沼：罠設置中');
        return icons;
      }
      const wIcons=iconsFor('white');
      const bIcons=iconsFor('black');

      bar.innerHTML = `
        <div class="effects-side">
          <div class="effects-label">白の状態</div>
          <div class="effects-icons">${ wIcons.length ? wIcons.map(i=>`<span>${i}</span>`).join('') : '' }</div>
        </div>
        <div class="effects-side">
          <div class="effects-label">黒の状態</div>
          <div class="effects-icons">${ bIcons.length ? bIcons.map(i=>`<span>${i}</span>`).join('') : '' }</div>
        </div>
      `;
    }

    /* ✅ 盤面上に、このターン使用ハイヤーカードを表示 */
function renderBoardUsedOverlay(){
  const el = document.getElementById('boardUsedOverlay');
  const info = state.usedCardThisTurn;

  // クラス初期化
  el.classList.remove('overlay-empty', 'overlay-white', 'overlay-black');

  // まだこのターンにハイヤーカードを使っていない場合
  if (!info) {
    el.classList.add('overlay-empty');
    el.textContent = '使用ハイヤーカード：なし';
    return;
  }

  // どちらの陣営が使ったかで枠色変更
  el.classList.add(info.player === 'white' ? 'overlay-white' : 'overlay-black');

  const side = info.player === 'white' ? '白' : '黒';
  const icon = info.icon || '★';

  // 使用したハイヤーカード名を表示
  el.textContent = `使用ハイヤーカード：${icon} ${info.name}（${side}）`;
}


    function renderHayerStatus(){
      function build(containerId, player){
        const div=document.getElementById(containerId);
        div.innerHTML='';
        CARD_TEMPLATES.forEach(t=>{
          const pill=document.createElement('div');
          pill.classList.add('hayer-pill');
          pill.textContent=(t.icon ? t.icon+' ' : '') + t.name;

          const used =
            state.discard.some(c=>c.id===t.id && c.owner===player) ||
            (!state.decks[player].some(c=>c.id===t.id) && !state.hands[player].some(c=>c.id===t.id));

          if(used) pill.classList.add('used');
          div.appendChild(pill);
        });
      }
      build('hayerWhiteStatus','white');
      build('hayerBlackStatus','black');
    }

    function renderPhasePanel(){
      const panel=document.getElementById('phasePanel');

      if(state.winner){
        let title='', sub='';
        if(state.winner==='draw'){
          title='引き分け';
          sub='モードボタンから新しいゲームを開始してください。';
        }else{
          const isCpu=(gameMode==='cpu');
          if(state.winner==='white') title = isCpu ? '白（プレイヤー）の勝利！' : '白（P1）の勝利！';
          else title = isCpu ? (cpuPlayer==='black' ? '黒（CPU）の勝利！' : '黒の勝利！') : '黒（P2）の勝利！';
          sub='モードボタンを押すと新しい対局が始まります。';
        }
        panel.innerHTML=`
          <div class="phase-card phase-result ${state.winner==='white'?'phase-white':state.winner==='black'?'phase-black':''}">
            <div class="phase-main">${title}</div>
            <div class="phase-sub">${sub}</div>
          </div>`;
        return;
      }

      const remaining=Math.max(0, MAX_TURNS - state.turnCount + 1);
      const cp=state.currentPlayer;
      const hasHand=state.hands[cp].length>0;
      const locked=isCardLocked(cp);
      const playerLabel=(gameMode==='cpu')
        ? (cp==='white' ? '白（プレイヤー）' : '黒（CPU）')
        : (cp==='white' ? '白（P1）' : '黒（P2）');

      let phaseTitle='', phaseSub='';
      if(isPlayerTimeStopped(cp)){
        phaseTitle=`${playerLabel}：混乱中（駒移動不可）`;
        phaseSub='このターンはハイヤーカードのみ使用可能です。';
      }else if(hasHand && !state.cardPlayedThisTurn && !locked){
        phaseTitle=`${playerLabel} のハイヤーカード使用フェーズ`;
        phaseSub='ハイヤーカードを1枚選んで使用してください。';
      }else{
        phaseTitle=`${playerLabel} の駒移動フェーズ`;
        phaseSub='駒を1体選んで移動させてください。動かない場合はターン終了ボタンでもOK。';
      }
      const turnInfo=`ターン ${state.turnCount}/${MAX_TURNS}（残り ${remaining}）`;

      panel.innerHTML=`
        <div class="phase-card ${cp==='white'?'phase-white':'phase-black'}">
          <div class="phase-main">${phaseTitle}</div>
          <div class="phase-sub">${phaseSub}</div>
          <div class="phase-sub">${turnInfo}</div>
        </div>`;
    }

    function renderBattlePanel(){
      const bw=document.getElementById('battleWhite');
      const bb=document.getElementById('battleBlack');

      const wc=countPieces('white');
      const bc=countPieces('black');
      const wKing=findKing('white');
      const bKing=findKing('black');
      const wKingHp=wKing?state.board[wKing.y][wKing.x].hp:0;
      const bKingHp=bKing?state.board[bKing.y][bKing.x].hp:0;

      const wHayerRem=state.decks.white.length + state.hands.white.length;
      const bHayerRem=state.decks.black.length + state.hands.black.length;

      bw.innerHTML=`
        <div class="battle-side-title">白</div>
        <div>駒数：${wc}</div>
        <div>キングHP：${wKing ? wKingHp : '撃破'}</div>
        <div>ハイヤー残り：${wHayerRem}</div>
      `;
      bb.innerHTML=`
        <div class="battle-side-title">黒</div>
        <div>駒数：${bc}</div>
        <div>キングHP：${bKing ? bKingHp : '撃破'}</div>
        <div>ハイヤー残り：${bHayerRem}</div>
      `;
    }

    function renderReplayPanel(){
      const body=document.getElementById('replayBody');
      body.textContent = state.lastReplayText || 'まだ前ターンの情報はありません。';
    }

    /* ✅ シーンに合ったイラスト表示（ターン終了ボタンの下） */
    function updateSceneImage(){
      const img=document.getElementById('sceneImage');
      if(!img) return;

      let src='battle.png';
      if(state.winner==='white') src='white.png';
      else if(state.winner==='black') src='black.png';
      else if(state.winner==='draw') src='title.png';
      else src='battle.png';

      if(img.getAttribute('src') !== src) img.setAttribute('src', src);
    }

    function renderUI(){
      renderPhasePanel();
      renderHandFor('white','handWhite');
      renderHandFor('black','handBlack');
      renderBattlePanel();
      renderReplayPanel();
      renderEffectsBar();
      renderBoardUsedOverlay();
      renderHayerStatus();
      updateSceneImage();

      const logDiv=document.getElementById('log');
      logDiv.innerHTML = state.log.map(line=>`<div>${line}</div>`).join('');
      logDiv.scrollTop = logDiv.scrollHeight;

      const endBtn=document.getElementById('endTurnBtn');
      const isCpuTurn=(gameMode==='cpu' && state.currentPlayer===cpuPlayer);
      endBtn.disabled = !!state.winner || isCpuTurn;
    }

    function renderAll(){
  ensureEffectLayer();   // ★ ここを追加
  renderBoard();
  renderUI();
}


    function onCellClick(e){
      if(state.winner) return;
      if(gameMode==='cpu' && state.currentPlayer===cpuPlayer) return;

      const x=parseInt(e.currentTarget.dataset.x,10);
      const y=parseInt(e.currentTarget.dataset.y,10);
      const cellPiece=state.board[y][x];

      if(!state.targeting) state.aoePreview=[];

      if(state.targeting){
        handleTargetingClick(x,y,cellPiece);
        return;
      }

      const current=state.currentPlayer;
      if(cellPiece && cellPiece.player===current){
        state.selectedCell={x,y};
        state.validMoves=getValidMoves(x,y);
      }else if(state.selectedCell){
        const valid=state.validMoves.some(m=>m.x===x&&m.y===y);
        if(valid){
          movePiece(state.selectedCell.x,state.selectedCell.y,x,y);
          state.selectedCell=null;
          state.validMoves=[];
        }else{
          state.selectedCell=null;
          state.validMoves=[];
        }
      }
      renderAll();
    }

    function isSquareBlockedForPlayer(x,y,player){
      return state.terrainBlocks.some(b=>b.x===x&&b.y===y&&(b.blockedFor===player||b.blockedFor==='both'));
    }
    function speedActiveFor(player){
      return (state.activeEffect && state.activeEffect.type==='speed' && state.activeEffect.player===player);
    }
    function isPlayerTimeStopped(player){
      const info=state.timeStop[player];
      return info && info.active;
    }
    function isCardLocked(player){ return state.cardLock && state.cardLock[player]; }

    function findKing(player){
      for(let y=0;y<BOARD_SIZE;y++){
        for(let x=0;x<BOARD_SIZE;x++){
          const p=state.board[y][x];
          if(p && p.player===player && p.type===PieceType.KING) return {x,y};
        }
      }
      return null;
    }

    function countPieces(player){
      let count=0;
      for(let y=0;y<BOARD_SIZE;y++){
        for(let x=0;x<BOARD_SIZE;x++){
          const p=state.board[y][x];
          if(p && p.player===player) count++;
        }
      }
      return count;
    }

    function pieceName(piece){
      switch(piece.type){
        case PieceType.KING: return 'キング';
        case PieceType.KNIGHT: return '騎馬';
        case PieceType.FOOTMAN: return '歩兵';
        case PieceType.ARCHER: return '弓兵';
        case PieceType.CASTLE: return '城';
        case PieceType.MONK: return '僧侶';
        case PieceType.SHIELD: return '盾兵';
        case PieceType.MAGE: return '魔導士';
        case PieceType.ASSASSIN: return '暗殺者';
        default: return '？';
      }
    }

    function recordCellAction(x,y){
      if(x<0||x>=BOARD_SIZE||y<0||y>=BOARD_SIZE) return;
      if(!state.turnActionCells) state.turnActionCells=[];
      if(!state.turnActionCells.some(c=>c.x===x&&c.y===y)) state.turnActionCells.push({x,y});
    }

    function getValidMoves(x,y){
      const piece=state.board[y][x];
      if(!piece) return [];
      const moves=[];
      const enemy = piece.player==='white'?'black':'white';
      const speedOn = speedActiveFor(piece.player);

      if(piece.player===state.currentPlayer && isPlayerTimeStopped(piece.player)) return [];
      if(piece.type===PieceType.KING || piece.type===PieceType.CASTLE) return [];

      if(piece.type===PieceType.MONK){
        const maxRange=speedOn?3:2;
        const directions=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:1,dy:1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:-1,dy:-1}];
        for(const dir of directions){
          for(let step=1;step<=maxRange;step++){
            const nx=x+dir.dx*step, ny=y+dir.dy*step;
            if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) break;
            if(isSquareBlockedForPlayer(nx,ny,piece.player)) break;
            const target=state.board[ny][nx];
            if(target){
              if(target.player===piece.player) break;
              if(target.player===enemy){ moves.push({x:nx,y:ny}); break; }
            }else moves.push({x:nx,y:ny});
          }
        }
        return moves;
      }

      if(piece.type===PieceType.KNIGHT){
        const maxRange=speedOn?3:2;
        const directions=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:1,dy:1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:-1,dy:-1}];
        for(const dir of directions){
          for(let step=1;step<=maxRange;step++){
            const nx=x+dir.dx*step, ny=y+dir.dy*step;
            if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) break;
            if(isSquareBlockedForPlayer(nx,ny,piece.player)) break;
            const target=state.board[ny][nx];
            if(target){
              if(target.player===piece.player) break;
              if(target.player===enemy){ moves.push({x:nx,y:ny}); break; }
            }else moves.push({x:nx,y:ny});
          }
        }
        return moves;
      }

      if(piece.type===PieceType.FOOTMAN){
        if(!speedOn){
          const directions=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:1,dy:1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:-1,dy:-1}];
          for(const dir of directions){
            const nx=x+dir.dx, ny=y+dir.dy;
            if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) continue;
            if(isSquareBlockedForPlayer(nx,ny,piece.player)) continue;
            const target=state.board[ny][nx];
            if(target && target.player===piece.player) continue;
            moves.push({x:nx,y:ny});
          }
          return moves;
        }
        for(let dx=-2;dx<=2;dx++){
          for(let dy=-2;dy<=2;dy++){
            if(dx===0 && dy===0) continue;
            const nx=x+dx, ny=y+dy;
            if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) continue;
            if(isSquareBlockedForPlayer(nx,ny,piece.player)) continue;
            const target=state.board[ny][nx];
            if(target && target.player===piece.player) continue;
            moves.push({x:nx,y:ny});
          }
        }
        return moves;
      }

      if(piece.type===PieceType.ARCHER){
        const deltas = !speedOn
          ? [{dx:2,dy:0},{dx:-2,dy:0},{dx:0,dy:2},{dx:0,dy:-2},{dx:2,dy:2},{dx:2,dy:-2},{dx:-2,dy:2},{dx:-2,dy:-2}]
          : [{dx:3,dy:0},{dx:-3,dy:0},{dx:0,dy:3},{dx:0,dy:-3},{dx:3,dy:3},{dx:3,dy:-3},{dx:-3,dy:3},{dx:-3,dy:-3}];
        for(const d of deltas){
          const nx=x+d.dx, ny=y+d.dy;
          if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) continue;
          if(isSquareBlockedForPlayer(nx,ny,piece.player)) continue;
          const target=state.board[ny][nx];
          if(target && target.player===piece.player) continue;
          moves.push({x:nx,y:ny});
        }
        return moves;
      }

      if(piece.type===PieceType.SHIELD){
        const maxRange=speedOn?2:1;
        const directions=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
        for(const dir of directions){
          for(let step=1;step<=maxRange;step++){
            const nx=x+dir.dx*step, ny=y+dir.dy*step;
            if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) break;
            if(isSquareBlockedForPlayer(nx,ny,piece.player)) break;
            const target=state.board[ny][nx];
            if(target){
              if(target.player===piece.player) break;
              if(target.player===enemy){ moves.push({x:nx,y:ny}); break; }
            }else moves.push({x:nx,y:ny});
          }
        }
        return moves;
      }

      if(piece.type===PieceType.MAGE){
        const deltas=[{dx:1,dy:2},{dx:2,dy:1},{dx:-1,dy:2},{dx:-2,dy:1},{dx:1,dy:-2},{dx:2,dy:-1},{dx:-1,dy:-2},{dx:-2,dy:-1}];
        const scale=speedOn?2:1;
        for(const d of deltas){
          const nx=x+d.dx*scale, ny=y+d.dy*scale;
          if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) continue;
          if(isSquareBlockedForPlayer(nx,ny,piece.player)) continue;
          const target=state.board[ny][nx];
          if(target && target.player===piece.player) continue;
          moves.push({x:nx,y:ny});
        }
        return moves;
      }

      if(piece.type===PieceType.ASSASSIN){
        const maxRange=speedOn?3:2;
        const directions=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:1,dy:1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:-1,dy:-1}];

        for(const dir of directions){
          for(let step=1;step<=maxRange;step++){
            const nx=x+dir.dx*step, ny=y+dir.dy*step;
            if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) break;
            if(isSquareBlockedForPlayer(nx,ny,piece.player)) break;
            const target=state.board[ny][nx];
            if(target){
              if(target.player===piece.player) break;
              if(target.player===enemy){ moves.push({x:nx,y:ny}); break; }
            }else moves.push({x:nx,y:ny});
          }
        }

        for(const dir of directions){
          const landX=x+dir.dx*2, landY=y+dir.dy*2;
          if(landX<0||landX>=BOARD_SIZE||landY<0||landY>=BOARD_SIZE) continue;
          if(isSquareBlockedForPlayer(landX,landY,piece.player)) continue;
          const landPiece=state.board[landY][landX];
          if(landPiece && landPiece.player===piece.player) continue;
          moves.push({x:landX,y:landY});
        }
        return moves;
      }

      return moves;
    }

    function applyDamage(x,y,amount){
      const piece=state.board[y][x];
      if(!piece) return false;
      recordCellAction(x,y);

      if(piece.type===PieceType.KING){
        const info=state.guardBarrier[piece.player];
        if(info && info.active && info.hitsLeft>0){
          info.hitsLeft--;
          logMessage(`${piece.player==='white'?'白':'黒'}のキングは守護結界に守られ、ダメージを受けなかった。`);
          if(info.hitsLeft<=0) info.active=false;
          return false;
        }
      }

      playSfx('attack');
      piece.hp -= amount;
      logMessage(`${piece.player==='white'?'白':'黒'}の${pieceName(piece)}が${amount}ダメージ。（残りHP: ${piece.hp}）`);

      if(piece.hp<=0){
        state.board[y][x]=null;
        logMessage(`${piece.player==='white'?'白':'黒'}の${pieceName(piece)}が倒れた。`);
        checkAnnihilationVictory();
        return true;
      }
      return false;
    }

    function checkTrapAt(x,y,piece){
      const trap=state.traps.find(t=>t.x===x&&t.y===y&&!t.revealed);
      if(!trap) return;
      if(piece.player===trap.owner) return;

      logMessage('沼の罠が発動！踏んだ駒に1ダメージ。');
      state.aoePreview=[{x,y}];
      recordCellAction(x,y);
      applyDamage(x,y,1);
      trap.revealed=true;
    }

    function healAdjacentByMonk(player){
      for(let y=0;y<BOARD_SIZE;y++){
        for(let x=0;x<BOARD_SIZE;x++){
          const p=state.board[y][x];
          if(!p||p.player!==player||p.type!==PieceType.MONK) continue;

          const dirs=[{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:1,dy:1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:-1,dy:-1}];
          dirs.forEach(d=>{
            const nx=x+d.dx, ny=y+d.dy;
            if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) return;
            const target=state.board[ny][nx];
            if(!target||target.player!==player) return;

            const maxHp=getMaxHpByType(target.type);
            if(target.hp<maxHp){
              target.hp++;
              logMessage(`${player==='white'?'白':'黒'}の僧侶が${pieceName(target)}を回復。（HP: ${target.hp}）`);
            }
          });
        }
      }
    }

    function movePiece(fromX,fromY,toX,toY){
      if(state.winner) return;

      const current=state.currentPlayer;
      const handHasCard=state.hands[current].length>0;

      if(!state.cardPlayedThisTurn && handHasCard && !isCardLocked(current)){
        logMessage('このターンは先にハイヤーカードを1枚使ってください。');
        renderAll(); return;
      }

      const piece=state.board[fromY][fromX];
      if(!piece) return;

      const target=state.board[toY][toX];
      let moved=false;

      if(target && target.player!==piece.player){
        const died = applyDamage(toX,toY,1);
        if(died){
          state.board[toY][toX]=piece;
          state.board[fromY][fromX]=null;
          moved=true;
        }else{
          logMessage('攻撃したが敵はまだ立っている。マスには入れない。');
        }
      }else{
        state.board[toY][toX]=piece;
        state.board[fromY][fromX]=null;
        moved=true;
      }

      if(moved){
        playSfx('move');
        recordCellAction(fromX,fromY);
        recordCellAction(toX,toY);
        checkTrapAt(toX,toY,state.board[toY][toX]);
      }

      if(state.activeEffect && state.activeEffect.type==='speed' && state.activeEffect.player===state.currentPlayer){
        state.activeEffect=null;
      }

      endTurn();
    }

    function playCardFor(player, handIndex){
  if(state.winner) return;
  if(state.targeting) return;
  if(state.currentPlayer!==player) return;

  if(isCardLocked(player)){
    if(player==='white' && state.turnCount===1)
      logMessage('先行1ターン目はハイヤーカードを使えません。');
    else
      logMessage('このターンはハイヤーカードを使えません。');
    return;
  }

  const current = state.currentPlayer;
  const enemy   = current==='white' ? 'black' : 'white';
  const hand    = state.hands[current];
  const card    = hand[handIndex];
  if(!card) return;

  if(state.cardPlayedThisTurn){
    logMessage('このターンはすでにハイヤーカードを使っています。');
    return;
  }

  state.cardPlayedThisTurn = true;
  playSfx('card');
  state.aoePreview = [];

  // ✅ 盤面に出す用（相手も見える）
  state.usedCardThisTurn = {
    player: current,
    id:     card.id,
    name:   card.name,
    icon:   card.icon || ''
  };

  // ─────────────────────────
  // 祈りシールドにより無効化されたときの処理＋エフェクト
  // ─────────────────────────
  if (state.prayerShield[current]) {
    logMessage(`${current==='white'?'白':'黒'}の「${card.name}」は、相手の祈りにより無効化された。`);

    // 祈りを掛けていた側（enemy）のキング位置にエフェクト表示
    const prayOwner = enemy;
    const kingPos   = findKing(prayOwner);
    if (kingPos) {
      spawnCardEffect('prayer', [kingPos]);
    }

    state.prayerShield[current] = false;
    state.discard.push({ ...card, owner: current });
    hand.splice(handIndex, 1);
    renderAll();
    return;
  }

  // ─────────────────────────
  // 各カード効果
  // ─────────────────────────
  if(card.type === 'speed'){
    // 追い風：移動性能アップ＋対象駒を光らせる
    state.activeEffect = { type:'speed', player: current };
    logMessage(`${current==='white'?'白':'黒'}は「${card.name}」を発動。移動性能が一時的に強化される。`);

    const cells = [];
    for(let y=0; y<BOARD_SIZE; y++){
      for(let x=0; x<BOARD_SIZE; x++){
        const p = state.board[y][x];
        if(!p) continue;
        if(p.player !== current) continue;
        if(p.type === PieceType.KING || p.type === PieceType.CASTLE) continue;
        cells.push({x,y});
      }
    }
    if(cells.length) spawnCardEffect('speed', cells);

  }else if(card.type === 'smite'){
    // 隕石：単体2ダメージ（クリックで対象選択）
    state.targeting = { type:'smite' };
    logMessage(`「${card.name}」：敵の駒をクリックしてください（2ダメージ）。`);

  }else if(card.type === 'plague'){
    // 疫病：3×3（クリックで中心マス）
    state.targeting = { type:'plague' };
    logMessage(`「${card.name}」：中心にするマスをクリックしてください（敵味方問わず）。`);

  }else if(card.type === 'prayer'){
    // 祈り：次の相手ハイヤーを封印
    state.prayerShield[enemy] = true;
    logMessage(`${current==='white'?'白':'黒'}は「${card.name}」を捧げた。${enemy==='white'?'白':'黒'}の次のハイヤーは無効化される。`);

  }else if(card.type === 'terrain'){
    // 地の利：候補マスを事前ハイライトしてから選択
    const options = [];
    for(let y=0; y<BOARD_SIZE; y++){
      for(let x=0; x<BOARD_SIZE; x++){
        if(state.board[y][x]) continue;
        if(state.terrainBlocks.some(b => b.x===x && b.y===y)) continue;
        options.push({x,y});
      }
    }
    state.aoePreview = options;           // ここで全候補マスをハイライト
    state.targeting  = { type:'terrain' };
    logMessage(`「${card.name}」：敵だけ通れないマスを1つ選んでください。`);

  }else if(card.type === 'divine'){
    // 飢餓：十字方向に敵だけ1ダメージ（中心マス選択は handleTargetingClick）
    state.targeting = { type:'divine' };
    logMessage(`「${card.name}」：中心マスを選んでください（十字方向に攻撃）。`);

  }else if(card.type === 'boulder'){
    // 天変地異：ランダム3マスに障害物
    logMessage(`「${card.name}」発動。ランダムな3マスが敵だけ通れない障害物になる。`);
    dropRandomBoulders(3, current);

  } else if(card.type === 'escape'){
  // 逃亡：キングをワープ（実処理は handleTargetingClick）
  // まず「移動可能な空きマス」を全部プレビュー
  const cells = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (state.board[y][x]) continue;                        // 駒があるマスは不可
      if (isSquareBlockedForPlayer(x, y, current)) continue;  // 障害物で塞がれているマスは不可
      cells.push({ x, y });
    }
  }
  state.aoePreview = cells;  // ハイライトに使う

  state.targeting = { type:'escape' };
  logMessage(`「${card.name}」：キングの移動先マスをクリックしてください（空きマス）。`);


  }else if(card.type === 'swamp'){
    // 沼：ランダム罠
    placeRandomSwamp(current);

  }else if(card.type === 'barrier'){
    // 守護結界
    state.guardBarrier[current] = { active:true, hitsLeft:1 };
    logMessage(`${current==='white'?'白':'黒'}は「${card.name}」を展開。キングへの次のダメージを1回防ぐ。`);

  }else if(card.type === 'chain'){
    // 神成：クリックした敵＋周囲8マス
    state.targeting = { type:'chain' };
    logMessage(`「${card.name}」：敵の駒をクリックしてください（周囲も巻き込む）。`);

  }else if(card.type === 'timestop'){
    // 混乱：次ターン、相手駒移動不可 ＋ 相手駒を光らせる
    state.timeStop[enemy] = { active:true };
    logMessage(`${current==='white'?'白':'黒'}は「${card.name}」を発動。${enemy==='white'?'白':'黒'}は次のターン駒を動かせない。`);

    const cells = [];
    for(let y=0; y<BOARD_SIZE; y++){
      for(let x=0; x<BOARD_SIZE; x++){
        const p = state.board[y][x];
        if(p && p.player === enemy) cells.push({x,y});
      }
    }
    if(cells.length) spawnCardEffect('timestop', cells);

  } else if(card.type === 'force'){
  // フォースの導き：自軍駒 → 任意の空きマス（実処理は handleTargetingClick）

  // まず「選べる自軍駒」を全部プレビュー（キング・城以外）
  const cells = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const p = state.board[y][x];
      if (!p) continue;
      if (p.player !== current) continue;
      if (p.type === PieceType.KING || p.type === PieceType.CASTLE) continue;
      cells.push({ x, y });
    }
  }
  state.aoePreview = cells;

  state.targeting = { type:'force', from:null };
  logMessage('「フォースの導き」：キングと城以外の自軍駒を1つ選んでください。');
}


  // 共通：墓地送り＆手札から削除
  state.discard.push({ ...card, owner: current });
  hand.splice(handIndex, 1);
  renderAll();
}


    function dropRandomBoulders(count, owner){
      const enemy=owner==='white'?'black':'white';
      let placed=0, tries=0;
      while(placed<count && tries<200){
        tries++;
        const x=Math.floor(Math.random()*BOARD_SIZE);
        const y=Math.floor(Math.random()*BOARD_SIZE);
        if(state.terrainBlocks.some(b=>b.x===x&&b.y===y)) continue;
        state.terrainBlocks.push({x,y,blockedFor:enemy,kind:'stone'});
        recordCellAction(x,y);
        placed++;
        logMessage(`天変地異により (${x},${y}) に障害物が発生し、${enemy==='white'?'白':'黒'}だけ通れなくなった。`);
      }
    }

    function placeRandomSwamp(owner){
      let placed=0, tries=0;
      while(placed<2 && tries<200){
        tries++;
        const x=Math.floor(Math.random()*BOARD_SIZE);
        const y=Math.floor(Math.random()*BOARD_SIZE);
        if(state.traps.some(t=>t.x===x&&t.y===y)) continue;
        if(state.board[y][x]) continue;
        state.traps.push({x,y,owner,revealed:false});
        placed++;
      }
      if(placed>0) logMessage(`${owner==='white'?'白':'黒'}はどこかに${placed}つの「沼」を設置した…。`);
      else logMessage('沼を設置できる場所が見つかりませんでした。');
    }

        function handleTargetingClick(x,y,cellPiece){
  const t = state.targeting;
  if(!t) return;

  const current = state.currentPlayer;
  const enemy   = current === 'white' ? 'black' : 'white';

  // ターゲット決定後はプレビューを一旦クリア
  state.aoePreview = [];

  // ===== 隕石（smite） =====
  if(t.type === 'smite'){
    if(!cellPiece || cellPiece.player===current){
      logMessage('隕石は不発に終わった…。');
      state.targeting = null;
      renderAll();
      return;
    }
    logMessage('隕石が命中！（2ダメージ）');
    spawnCardEffect('smite', [{x,y}]);
    applyDamage(x,y,2);
    recordCellAction(x,y);
    state.targeting = null;
    renderAll();
    return;
  }

  // ===== 神成（chain） =====
  if(t.type === 'chain'){
    if(!cellPiece || cellPiece.player===current){
      logMessage('神成は不発に終わった…。');
      state.targeting = null;
      renderAll();
      return;
    }
    logMessage(`「神成」が発動。(${x},${y}) とその周囲の敵に1ダメージ。`);

    const aoe = [];
    for(let dy=-1;dy<=1;dy++){
      for(let dx=-1;dx<=1;dx++){
        const nx = x+dx, ny = y+dy;
        if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) continue;
        aoe.push({x:nx,y:ny});
        const p = state.board[ny][nx];
        if(p && p.player===enemy){
          applyDamage(nx,ny,1);
        }
      }
    }
    aoe.forEach(c=>recordCellAction(c.x,c.y));
    spawnCardEffect('chain', aoe);
    state.targeting = null;
    renderAll();
    return;
  }

  // ===== 疫病（plague） =====
  if(t.type === 'plague'){
    logMessage(`「疫病」が発動。(${x},${y}) を中心に3×3に1ダメージ。`);
    const aoe = [];
    for(let dy=-1;dy<=1;dy++){
      for(let dx=-1;dx<=1;dx++){
        const nx=x+dx, ny=y+dy;
        if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) continue;
        aoe.push({x:nx,y:ny});
        if(state.board[ny][nx]) applyDamage(nx,ny,1);
      }
    }
    aoe.forEach(c=>recordCellAction(c.x,c.y));
    spawnCardEffect('plague', aoe);
    state.targeting = null;
    renderAll();
    return;
  }

  // ===== 地の利（terrain） =====
  if(t.type === 'terrain'){
    if(state.board[y][x] || state.terrainBlocks.some(b=>b.x===x && b.y===y)){
      logMessage('地の利：空いているマスを選んでください。');
      return;
    }
    state.terrainBlocks.push({x,y,blockedFor:enemy,kind:'terrain'});
    recordCellAction(x,y);
    spawnCardEffect('terrain', [{x,y}]);
    logMessage(`「地の利」発動：${enemy==='white'?'白':'黒'}は (${x},${y}) に入れなくなった。`);
    state.targeting = null;
    renderAll();
    return;
  }

  // ===== 飢餓（divine） =====
  if(t.type === 'divine'){
    logMessage(`「飢餓」が発動。(${x},${y}) を中心に十字方向へ裁きが下る。`);
    const dirs=[{dx:0,dy:0},{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
    const aoe=[];
    for(const d of dirs){
      const nx=x+d.dx, ny=y+d.dy;
      if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) continue;
      aoe.push({x:nx,y:ny});
      const p=state.board[ny][nx];
      if(p && p.player===enemy) applyDamage(nx,ny,1);
    }
    aoe.forEach(c=>recordCellAction(c.x,c.y));
    spawnCardEffect('divine', aoe);
    state.targeting=null;
    renderAll();
    return;
  }

  // ===== 逃亡（escape） =====
if (t.type === 'escape') {
  const kingPos = findKing(current);
  if (!kingPos) {
    logMessage('キングがいないため「逃亡」は使えません。');
    state.targeting = null;
    renderAll();
    return;
  }

  // NGマスをクリックした場合 → メッセージ＋再プレビュー
  if (state.board[y][x] || isSquareBlockedForPlayer(x, y, current)) {
    logMessage('逃亡先は障害物のない空きマスを選んでください。');

    const cells = [];
    for (let yy = 0; yy < BOARD_SIZE; yy++) {
      for (let xx = 0; xx < BOARD_SIZE; xx++) {
        if (state.board[yy][xx]) continue;
        if (isSquareBlockedForPlayer(xx, yy, current)) continue;
        cells.push({ x: xx, y: yy });
      }
    }
    state.aoePreview = cells;
    renderAll();
    return;
  }

  // OKマスをクリックした場合 → 実際にキングを移動
  const king = state.board[kingPos.y][kingPos.x];
  recordCellAction(kingPos.x, kingPos.y);
  recordCellAction(x, y);

  state.board[kingPos.y][kingPos.x] = null;
  state.board[y][x] = king;

  spawnCardEffect('escape', [{ x, y }]);
  logMessage(`${current==='white'?'白':'黒'}のキングが「逃亡」で (${x},${y}) に移動した。`);
  checkTrapAt(x, y, king);

  state.targeting = null;
  // aoePreview は冒頭で一度空にしているので、そのままでOK
  renderAll();
  return;
}


  // ===== フォースの導き（force） =====
if (t.type === 'force') {
  // ① まだ駒を選んでいない段階
  if (!t.from) {
    if (!cellPiece || cellPiece.player !== current ||
        cellPiece.type === PieceType.KING || cellPiece.type === PieceType.CASTLE) {
      logMessage('フォースの導き：キングと城以外の自軍駒を選んでください。');
      return;
    }

    // ここで「どの駒を移動させるか」が決定
    t.from = { x, y };

    // 選択した駒に軽いエフェクト
    spawnCardEffect('force', [{ x, y }]);

    // 次に「移動先候補の空きマス」を全部ハイライト
    const cells = [];
    for (let yy = 0; yy < BOARD_SIZE; yy++) {
      for (let xx = 0; xx < BOARD_SIZE; xx++) {
        if (state.board[yy][xx]) continue;
        if (isSquareBlockedForPlayer(xx, yy, current)) continue;
        cells.push({ x: xx, y: yy });
      }
    }
    state.aoePreview = cells;

    logMessage('フォースの導き：移動先の空きマスを選んでください。');
    renderAll();
    return;
  }

  // ② 移動先マスを選んでいる段階
  if (state.board[y][x] || isSquareBlockedForPlayer(x, y, current)) {
    logMessage('フォースの導き：障害物のない空きマスを選んでください。');

    // NGマスクリック時ももう一度候補を再プレビューしておく
    const cells = [];
    for (let yy = 0; yy < BOARD_SIZE; yy++) {
      for (let xx = 0; xx < BOARD_SIZE; xx++) {
        if (state.board[yy][xx]) continue;
        if (isSquareBlockedForPlayer(xx, yy, current)) continue;
        cells.push({ x: xx, y: yy });
      }
    }
    state.aoePreview = cells;
    renderAll();
    return;
  }

  const from  = t.from;
  const piece = state.board[from.y][from.x];
  if (!piece) {
    state.targeting = null;
    renderAll();
    return;
  }

  recordCellAction(from.x, from.y);
  recordCellAction(x, y);

  state.board[from.y][from.x] = null;
  state.board[y][x]           = piece;

  spawnCardEffect('force', [{ x: from.x, y: from.y }, { x, y }]);
  logMessage(`${current==='white'?'白':'黒'}の${pieceName(piece)}が「フォースの導き」で (${x},${y}) に瞬間移動した。`);
  checkTrapAt(x, y, piece);

  state.targeting  = null;
  state.aoePreview = [];    // 移動完了後はハイライト消しておく
  renderAll();
  return;
}


  // ここまでどれにも当てはまらないケース（保険）
  state.targeting = null;
  renderAll();
}




    function cpuTurn(){
      if(state.winner) return;
      if(gameMode!=='cpu') return;
      if(state.currentPlayer!==cpuPlayer) return;

      const me=state.currentPlayer;
      logMessage('黒（CPU）が思考中…');

      const myHand=state.hands[me];
      if(myHand.length>0 && !state.cardPlayedThisTurn && !isCardLocked(me)){
        let idx=myHand.findIndex(c=>c.type==='smite'||c.type==='plague'||c.type==='divine'||c.type==='chain');
        if(idx===-1) idx=0;
        playCardFor(me,idx);
        if(state.targeting) cpuResolveTargeting();
      }

      if(!isPlayerTimeStopped(me)) cpuMovePiece();
      else{
        logMessage('混乱の効果でCPUは駒を動かせない。');
        endTurn();
      }
    }

    function cpuResolveTargeting(){
      const t=state.targeting;
      if(!t) return;

      const me=state.currentPlayer;
      const enemy=me==='white'?'black':'white';

      if(t.type==='smite'||t.type==='chain'){
        let targetCell=null, kingCell=null;
        for(let y=0;y<BOARD_SIZE;y++){
          for(let x=0;x<BOARD_SIZE;x++){
            const p=state.board[y][x];
            if(!p||p.player!==enemy) continue;
            if(p.type===PieceType.KING){ kingCell={x,y}; break; }
            if(!targetCell) targetCell={x,y};
          }
          if(kingCell) break;
        }
        const choice=kingCell||targetCell;
        if(choice) handleTargetingClick(choice.x,choice.y,state.board[choice.y][choice.x]);
        else{ state.targeting=null; state.aoePreview=[]; renderAll(); }
        return;
      }

      if(t.type==='plague'){
        let bestCell=null, bestScore=-1;
        for(let cy=0;cy<BOARD_SIZE;cy++){
          for(let cx=0;cx<BOARD_SIZE;cx++){
            let score=0;
            for(let dy=-1;dy<=1;dy++){
              for(let dx=-1;dx<=1;dx++){
                const nx=cx+dx, ny=cy+dy;
                if(nx<0||nx>=BOARD_SIZE||ny<0||ny>=BOARD_SIZE) continue;
                if(state.board[ny][nx]) score++;
              }
            }
            if(score>bestScore){ bestScore=score; bestCell={x:cx,y:cy}; }
          }
        }
        handleTargetingClick(bestCell.x,bestCell.y,state.board[bestCell.y][bestCell.x]||null);
        return;
      }

        // ▼ CPU用 飢餓（divine）
  if (t.type === 'divine') {
    // なるべく「敵キング」を狙う。いなければ最初に見つかった敵駒。
    let kingCell = null;
    let enemyCell = null;

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const p = state.board[y][x];
        if (!p || p.player !== enemy) continue;

        if (p.type === PieceType.KING) {
          kingCell = { x, y };
          break;
        }
        if (!enemyCell) enemyCell = { x, y };
      }
      if (kingCell) break;
    }

    const target = kingCell || enemyCell;

    if (target) {
      // プレイヤーと同じ処理を使う（handleTargetingClick に丸投げ）
      const cellPiece = state.board[target.y][target.x] || null;
      handleTargetingClick(target.x, target.y, cellPiece);
    } else {
      // 攻撃対象がいない場合は不発扱い
      logMessage('「飢餓」を発動しようとしたが、攻撃対象が見当たらなかった…。');
      state.targeting = null;
      state.aoePreview = [];
      renderAll();
    }
    return;
  }


      if(t.type==='terrain'){
        let cell=null;
        for(let y=0;y<BOARD_SIZE && !cell;y++){
          for(let x=0;x<BOARD_SIZE;x++){
            if(!state.board[y][x] && !state.terrainBlocks.some(b=>b.x===x&&b.y===y)){ cell={x,y}; break; }
          }
        }
        if(cell) handleTargetingClick(cell.x,cell.y,null);
        else{ state.targeting=null; state.aoePreview=[]; renderAll(); }
        return;
      }

      if(t.type==='escape'){
        let cell=null;
        for(let y=0;y<BOARD_SIZE && !cell;y++){
          for(let x=0;x<BOARD_SIZE;x++){
            if(!state.board[y][x] && !isSquareBlockedForPlayer(x,y,state.currentPlayer)){ cell={x,y}; break; }
          }
        }
        if(cell) handleTargetingClick(cell.x,cell.y,null);
        else{ state.targeting=null; state.aoePreview=[]; renderAll(); }
        return;
      }

      if(t.type==='force'){
        const candidates=[];
        for(let y=0;y<BOARD_SIZE;y++){
          for(let x=0;x<BOARD_SIZE;x++){
            const p=state.board[y][x];
            if(!p||p.player!==me) continue;
            if(p.type===PieceType.KING||p.type===PieceType.CASTLE) continue;
            candidates.push({x,y});
          }
        }
        if(candidates.length===0){ state.targeting=null; state.aoePreview=[]; renderAll(); return; }
        const from=candidates[Math.floor(Math.random()*candidates.length)];
        let dest=null;
        for(let y=0;y<BOARD_SIZE && !dest;y++){
          for(let x=0;x<BOARD_SIZE;x++){
            if(state.board[y][x]) continue;
            if(isSquareBlockedForPlayer(x,y,me)) continue;
            dest={x,y}; break;
          }
        }
        if(!dest){ state.targeting=null; state.aoePreview=[]; renderAll(); return; }
        const piece=state.board[from.y][from.x];
        state.board[from.y][from.x]=null;
        state.board[dest.y][dest.x]=piece;
        recordCellAction(from.x,from.y);
        recordCellAction(dest.x,dest.y);
        state.aoePreview=[{x:dest.x,y:dest.y}];
        logMessage(`黒の${pieceName(piece)}が「フォースの導き」で (${dest.x},${dest.y}) に瞬間移動した。`);
        checkTrapAt(dest.x,dest.y,piece);
        state.targeting=null;
        renderAll();
        return;
      }

      state.targeting=null; state.aoePreview=[]; renderAll();
    }

    function cpuMovePiece(){
      const me=state.currentPlayer;
      const enemy=me==='white'?'black':'white';
      let bestMove=null;

      for(let y=0;y<BOARD_SIZE;y++){
        for(let x=0;x<BOARD_SIZE;x++){
          const p=state.board[y][x];
          if(!p||p.player!==me) continue;
          const moves=getValidMoves(x,y);
          for(const m of moves){
            const target=state.board[m.y][m.x];
            if(target && target.player===enemy){
              movePiece(x,y,m.x,m.y);
              return;
            }
            if(!bestMove) bestMove={fromX:x,fromY:y,toX:m.x,toY:m.y};
          }
        }
      }

      if(bestMove) movePiece(bestMove.fromX,bestMove.fromY,bestMove.toX,bestMove.toY);
      else{ logMessage('CPUは動ける駒がなかった…。'); endTurn(); }
    }

    function checkAnnihilationVictory(){
      if(state.winner) return;
      const whiteCount=countPieces('white');
      const blackCount=countPieces('black');

      if(whiteCount===0 && blackCount===0){
        logMessage('両軍とも駒が全滅した…。');
        endGame('draw');
      }else if(whiteCount===0){
        logMessage('白の駒が全滅した！');
        endGame('black');
      }else if(blackCount===0){
        logMessage('黒の駒が全滅した！');
        endGame('white');
      }
    }

    function checkHiyerDepletionVictory(){
      if(state.winner) return;
      const decksEmpty = state.decks.white.length===0 && state.decks.black.length===0;
      const handsEmpty = state.hands.white.length===0 && state.hands.black.length===0;
      if(!(decksEmpty && handsEmpty)) return;

      const whiteCount=countPieces('white');
      const blackCount=countPieces('black');
      const whiteKingAlive=!!findKing('white');
      const blackKingAlive=!!findKing('black');

      logMessage(`ハイヤーが尽きた。白の駒:${whiteCount}／黒の駒:${blackCount}／白キング:${whiteKingAlive?'生存':'不在'}／黒キング:${blackKingAlive?'生存':'不在'}`);

      if(whiteKingAlive && !blackKingAlive) endGame('white');
      else if(!whiteKingAlive && blackKingAlive) endGame('black');
      else{
        if(whiteCount>blackCount) endGame('white');
        else if(blackCount>whiteCount) endGame('black');
        else endGame('draw');
      }
    }

    function checkTurnLimitVictory(){
      if(state.winner) return;
      if(state.turnCount<=MAX_TURNS) return;

      logMessage(`ターン制限（${MAX_TURNS}ターン）に到達。駒数・キング生存で判定。`);

      const whiteCount=countPieces('white');
      const blackCount=countPieces('black');
      const whiteKingAlive=!!findKing('white');
      const blackKingAlive=!!findKing('black');

      if(whiteKingAlive && !blackKingAlive) endGame('white');
      else if(!whiteKingAlive && blackKingAlive) endGame('black');
      else{
        if(whiteCount>blackCount) endGame('white');
        else if(blackCount>whiteCount) endGame('black');
        else endGame('draw');
      }
    }

    function endGame(winner){
      if(state.winner) return;
      state.winner=winner;
      if(winner==='draw') logMessage('引き分け。');
      else logMessage(`${winner==='white'?'白':'黒'}の勝利！`);
      playSfx('win');
      renderAll();
    }

    function pushReplayForCurrentTurn(){
      const player=state.currentPlayer;
      const label=player==='white'?'白':'黒';
      const start=state.turnStartLogIndex||0;
      const logs=state.log.slice(start);
      if(!logs.length && (!state.turnActionCells || !state.turnActionCells.length)){
        state.lastReplayText=`${label}の前ターン：特に行動はありませんでした。`;
      }else{
        const short=logs.slice(-5);
        state.lastReplayText=`${label}の前ターン：` + short.join(' / ');
      }
      state.lastTurnHighlight={ player, cells: state.turnActionCells ? state.turnActionCells.slice() : [] };
      state.turnActionCells=[];
      state.turnStartLogIndex=state.log.length;
    }

    function endTurn(){
      if(state.winner) return;

      const current=state.currentPlayer;
      const handHasCard=state.hands[current].length>0;

      if(!state.cardPlayedThisTurn && handHasCard && !isCardLocked(current)){
        logMessage('このターンはまだハイヤーカードを使っていません。');
        renderAll(); return;
      }

      pushReplayForCurrentTurn();

      state.targeting=null;
      state.aoePreview=[];

      if(state.activeEffect && state.activeEffect.type==='speed' && state.activeEffect.player===current){
        state.activeEffect=null;
      }

      if(state.timeStop[current] && state.timeStop[current].active){
        state.timeStop[current].active=false;
      }

      if(state.cardLock[current]) state.cardLock[current]=false;

      // ✅ ターンが変わるので「このターン使用カード」リセット
      state.usedCardThisTurn=null;

      state.currentPlayer = current==='white' ? 'black' : 'white';
      state.selectedCell=null;
      state.validMoves=[];
      state.turnCount += 1;
      state.cardPlayedThisTurn=false;

      const gb=state.guardBarrier[state.currentPlayer];
      if(gb && gb.active && gb.hitsLeft>0){
        gb.active=false;
        logMessage(`${state.currentPlayer==='white'?'白':'黒'}側の守護結界の効果が消えた。`);
      }

      healAdjacentByMonk(state.currentPlayer);
      drawCard(state.currentPlayer);

      const turnLabel = (gameMode==='cpu')
        ? (state.currentPlayer==='white' ? '白（プレイヤー）' : '黒（CPU）')
        : (state.currentPlayer==='white' ? '白（P1）' : '黒（P2）');

      logMessage(`${turnLabel}のターン。`);
      state.turnStartLogIndex = state.log.length;

      renderAll();
      if(!state.winner){
        checkHiyerDepletionVictory();
        checkTurnLimitVictory();
      }

      if(!state.winner && gameMode==='cpu' && state.currentPlayer===cpuPlayer){
        setTimeout(cpuTurn,400);
      }
    }

    function logMessage(msg){
      const time=new Date().toLocaleTimeString();
      state.log.push(`[${time}] ${msg}`);
      if(state.log.length>200){
        state.log.shift();
        if(typeof state.turnStartLogIndex==='number' && state.turnStartLogIndex>0){
          state.turnStartLogIndex=Math.max(0,state.turnStartLogIndex-1);
        }
      }
    }

        document.getElementById('modeCpuBtn').addEventListener('click',()=>initGame('cpu'));
    document.getElementById('modePvpBtn').addEventListener('click',()=>initGame('pvp'));
    document.getElementById('bgmBtn').addEventListener('click',toggleBgm);

    // ★ 追加：全画面ボタン
    document.getElementById('fullscreenBtn').addEventListener('click',toggleFullscreen);

    document.getElementById('endTurnBtn').addEventListener('click',()=>endTurn());

    // ★ 追加：フルスクリーン状態が変わったときにボタン表示を更新
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    initGame('cpu');
