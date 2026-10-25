// Bingo on start.ng. The host picks the kind of game and starts the room; start.ng's server draws, keeps every card private and
// checks every claim. Needs https://start.ng/kit.js (loaded in index.html).
(() => {
  const $ = (id) => document.getElementById(id);
  const REASONS = {
    not_found: 'That room has closed, or the code is wrong.',
    nobody_came: 'Nobody joined in time, so the room closed.',
    inactive: 'The room closed because nothing happened for a while.',
    empty: 'The room closed because everyone left.',
    finished: 'That game is over and the room closed.',
    too_old: 'That room was open too long, so it closed.',
    offline: "Couldn't reconnect. Check your connection and try again.",
    code_4403: 'That room is full (100 players).',
    code_4404: 'That room has closed, or the code is wrong.',
    code_4409: 'You joined from another tab, so this one stopped.',
    code_4429: 'Too many wrong codes. Wait a minute and try again.',
    code_4401: 'Sign in with start.ng to play.',
  };

  let room = null;
  let pendingSetup = null; // what the host chose, sent as soon as the room exists

  const show = (name) => { for (const id of ['lobby', 'builder', 'waiting', 'game']) $(id).hidden = id !== name; };
  const problem = (text) => { $('lobby-problem').textContent = text || ''; $('lobby-problem').hidden = !text; };
  const builderProblem = (text) => { $('builder-problem').textContent = text || ''; $('builder-problem').hidden = !text; };
  const reasonText = (reason) => REASONS[reason] || 'The room closed.';
  const note = (text) => { $('game-note').textContent = text || ''; };
  const nameOf = (seat) => room?.players.find((p) => p.seat === seat)?.name ?? 'Someone';
  const el = (tag, props = {}, text) => { const e = Object.assign(document.createElement(tag), props); if (text !== undefined) e.textContent = text; return e; };
  const isHost = () => room?.host === 0 && room.you === 0;

  // ---------- the lobby ----------

  function needSignIn(why) { problem(why); $('signin').hidden = false; }

  async function guarded(open) {
    problem('');
    $('signin').hidden = true;
    try {
      return await open();
    } catch (err) {
      if (err.message === 'signin') needSignIn('Sign in with start.ng to play.');
      else if (/^closed:/.test(err.message)) problem(reasonText(`code_${err.message.slice(7)}`));
      else problem(err.message || "Couldn't start. Try again.");
      return null;
    }
  }

  function wire(r) {
    room = r;
    r.on('welcome', () => {
      if (pendingSetup && r.host === 0 && r.status === 'waiting') r.setup(pendingSetup);
      render();
    });
    r.on('setup_ok', () => { pendingSetup = null; render(); });
    r.on('state', render);
    r.on('join', render);
    r.on('away', render);
    r.on('back', render);
    r.on('reconnecting', () => note('Reconnecting…'));
    r.on('open', () => note(''));
    r.on('error', (m) => {
      if (m.code === 'bad_setup') { leaveRoom(''); show('builder'); builderProblem(m.message); } else note(m.message);
    });
    r.on('closed', (m) => leaveRoom(reasonText(m.reason)));
    render();
  }

  async function open(make) {
    const r = await guarded(make);
    if (r) wire(r);
    return r;
  }

  async function joinRoom(code) {
    const r = await open(() => startng.rooms.join(code));
    if (!r && new URLSearchParams(location.search).has('room')) history.replaceState(null, '', location.pathname);
  }

  function leaveRoom(message) {
    room?.leave();
    room = null;
    pendingSetup = null;
    history.replaceState(null, '', location.pathname);
    show('lobby');
    problem(message || '');
  }

  // ---------- drawing the room ----------

  function render() {
    if (!room) return;
    if (room.code) history.replaceState(null, '', `${location.pathname}?room=${room.code}`);
    if (room.status === 'waiting' || room.status === null) { drawWaiting(); return; }
    show('game');
    drawGame();
  }

  function drawWaiting() {
    show('waiting');
    $('room-code').textContent = room.code || '';
    const players = room.players.filter((p) => !p.host);
    $('people').textContent = players.length ? `${players.length} ${players.length === 1 ? 'player' : 'players'} in` : 'Nobody has joined yet';
    $('names').replaceChildren(...players.map((p) => el('li', { className: p.online ? '' : 'away' }, p.seat === room.you ? `${p.name} (you)` : p.name)));
    $('start').hidden = !isHost();
    $('start').disabled = !players.length;
    $('waiting-title').textContent = isHost() ? 'Share this code' : 'You are in. Waiting for the host to start.';
    $('waiting-note').textContent = isHost() ? 'People join with the code or the link. Start when everyone is in; people can still join after.' : '';
  }

  function cellButton(cell, i, { line, mine }) {
    const b = el('button', { type: 'button', className: 'cell' });
    b.append(el('span', {}, cell.label));
    if (cell.label === 'Free') b.classList.add('free');
    if (cell.marked) b.classList.add('marked');
    else if (cell.called && mine) b.classList.add('called');
    if (line?.includes(i)) b.classList.add('win');
    b.disabled = !mine || cell.label === 'Free' || room.state.phase !== 'playing';
    b.setAttribute('aria-pressed', String(!!cell.marked));
    if (mine) b.onclick = () => room.send({ mark: i });
    return b;
  }

  function drawGame() {
    const s = room.state;
    const host = isHost();
    const result = room.result;
    $('last').textContent = result ? 'Game over' : s.last ?? 'Get ready…';
    $('last').classList.toggle('long', (s.last || '').length > 12);

    let status = '';
    if (result) {
      if (result.winner === null) status = 'Everything was drawn and nobody got bingo.';
      else if (result.winner === room.you) status = 'BINGO! You won! 🎉';
      else status = `${nameOf(result.winner)} got bingo!`;
    } else if (s.paused) status = 'Paused by the host';
    else if (host) status = `${s.called.length} drawn, ${s.left} left · ${s.players} players`;
    else status = s.called.length ? `${s.called.length} called` : 'The first one is coming…';
    $('status').textContent = status;

    // a player's card; after the game, the winning card
    const showCard = result?.card ? { cells: result.card.map((label) => ({ label: label ?? 'Free', marked: true, called: true })), line: result.line, mine: false }
      : s.card ? { cells: s.card, line: null, mine: true } : null;
    $('card').hidden = !showCard;
    $('letters').hidden = !showCard || s.mode !== 'numbers';
    $('grid').dataset.mode = s.mode;
    $('grid').replaceChildren(...(showCard ? showCard.cells.map((cell, i) => cellButton(cell, i, showCard)) : []));

    $('claim').hidden = host || !s.card || !!result;
    $('draw').hidden = !host || !!result;
    $('pause').hidden = !host || !!result;
    $('pause').textContent = s.paused ? 'Resume' : 'Pause';
    $('share').hidden = !result;
    $('back').hidden = !result;
    $('history').replaceChildren(...[...s.called].reverse().slice(0, 80).map((label) => el('li', {}, label)));
    note('');
  }

  // ---------- buttons ----------

  const modeValue = () => document.querySelector('input[name="mode"]:checked').value;
  for (const radio of document.querySelectorAll('input[name="mode"]')) radio.onchange = () => { $('terms-field').hidden = modeValue() !== 'terms'; };

  $('host').onclick = () => { builderProblem(''); show('builder'); };
  $('builder-cancel').onclick = () => { show('lobby'); builderProblem(''); };
  $('create').onclick = async () => {
    builderProblem('');
    const setup = { mode: modeValue(), speed: Number($('speed').value), pattern: $('pattern').value };
    if (setup.mode === 'terms') setup.terms = $('terms').value.split('\n').map((t) => t.trim()).filter(Boolean);
    pendingSetup = setup;
    const r = await open(() => startng.rooms.create());
    if (!r) { pendingSetup = null; show('lobby'); }
  };
  $('join').onsubmit = (e) => { e.preventDefault(); const code = $('code').value.trim(); if (code) joinRoom(code); };
  $('signin').onclick = () => startng.signIn();
  $('start').onclick = () => room?.start();
  $('claim').onclick = () => room?.send({ bingo: true });
  $('draw').onclick = () => room?.send({ draw: true });
  $('pause').onclick = () => room?.send({ pause: !room.state.paused });
  $('wait-cancel').onclick = () => leaveRoom('');
  $('back').onclick = () => leaveRoom('');
  $('share').onclick = () => startng.share({ text: 'I just played bingo on start.ng. Host one for your friends!' });
  $('copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(room?.inviteUrl() ?? '');
      $('copy').textContent = 'Link copied';
    } catch {
      $('copy').textContent = room?.inviteUrl() ?? 'Copy failed';
    }
    setTimeout(() => { $('copy').textContent = 'Copy invite link'; }, 2000);
  };

  // ---------- start ----------

  async function start() {
    if (!window.startng) { problem('start.ng could not load. Check your connection.'); return; }
    const player = await startng.getPlayer();
    const code = startng.rooms.codeFromUrl();
    if (code && player?.user) joinRoom(code);
    else if (code) {
      $('invite').textContent = `You were invited to a bingo game (room ${code}).`;
      $('invite').hidden = false;
      needSignIn('Sign in with start.ng to join the game.');
    }
  }

  if (window.startng) start();
  else addEventListener('load', start);
})();
