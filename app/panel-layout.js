'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const main = document.querySelector('main');
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const button = (text, fn, className) => {
    const node = make('button', className, text);
    node.type = 'button'; node.addEventListener('click', fn); return node;
  };
  const icon = shape => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', shape); svg.append(path); return svg;
  };
  const pages = {
    chat: ['聊聊', '会话', '心事、想法和手边的事，都可以慢慢说。', 'M4 4h16v12H9l-5 4zM8 8h8M8 12h5'],
    companion: ['相处', '日常相处', '手持一卷，陪你一程。', 'M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z'],
    growth: ['习惯与收藏', '习惯与收藏', '一格进度，一份心意，一页新灵感。', 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5'],
    interaction: ['交给颉', '交给颉', '递一页文字，叫一声名字，落一枚棋子。', 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5'],
    atelier: ['互动工坊', '颉的互动工坊', '一起走进故事，留下一张合影，或认真下一盘棋。', 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5'],
    qq: ['颉的QQ', '颉的QQ', '换一个入口，接着和她聊。', 'M4 4h16v12H9l-5 4zM8 8h8M8 12h5'],
    software: ['软件与回顾', '软件与回顾', '让手边的软件互通，留下每周走过的路。', 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5'],
    tools: ['手边的事', '手边的事', '留一点专注，把眼前的事慢慢做好。', 'M12 3a9 9 0 1 0 9 9M12 7v5l3 2M17 3h4v4'],
    memories: ['共同经历', '共同经历', '那些一起说过、一起做过的事。', 'M4 5h7l1 2 1-2h7v15h-7l-1 1-1-1H4zM12 7v14'],
    journal: ['小记', '她的每日小记', '一页一页，记下相伴的片刻。', 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h4'],
    extensions: ['相伴与扩展', '相伴与扩展', '一起推进项目，也给相伴留出更多可能。', 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'],
    character: ['角色卡', '角色卡', '她的来处、习惯，以及说话的方式。', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21v-3c0-6 16-6 16 0v3'],
    voice: ['声音', '声音与朗读', '选一个熟悉的声音，让话语慢慢落下。', 'M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4'],
    utilities: ['小工具', '小工具', '便签、提醒和常用入口，就放在手边。', 'M4 4h16v16H4zM4 10h16M10 10v10'],
    assistant: ['任务与状态', '任务与状态', '说一件手边的事，一步一步做好。', 'M4 5h16v15H4zM8 9h8M8 13h5M8 17h6'],
    settings: ['设置', '设置', '把桌面陪伴调成自己喜欢的样子。', 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6']
  };
  main.classList.add('workbench');
  const sidebar = make('aside', 'work-sidebar');
  sidebar.setAttribute('aria-label', '颉的陪伴空间');
  sidebar.append(document.querySelector('main > header'), document.querySelector('.status'), document.querySelector('.care'));
  const nav = document.querySelector('.tabs');
  const groups = [['相伴', ['chat', 'companion', 'interaction', 'atelier', 'growth', 'tools', 'memories', 'journal']], ['角色与扩展', ['extensions', 'character', 'voice', 'qq']], ['手边', ['software', 'assistant', 'utilities', 'settings']]];
  const navigation = [...nav.querySelectorAll('[data-page]')];
  nav.replaceChildren();
  for (const [title, ids] of groups) {
    nav.append(make('p', 'nav-group', title));
    for (const id of ids) {
      const node = navigation.find(b => b.dataset.page === id);
      node.replaceChildren(icon(pages[id][3]), make('span', '', pages[id][0]));
      node.setAttribute('aria-controls', 'page-' + id); nav.append(node);
    }
  }
  sidebar.append(nav, document.querySelector('main > footer'));
  const workspace = make('div', 'work-space');
  const topbar = make('div', 'work-topbar');
  const identity = make('div', 'work-identity');
  identity.append(make('span', 'work-wordmark', '颉'), make('span', 'work-tagline', '一卷书 · 一程相伴'));
  const connection = make('span', 'work-connection', '本机相伴'); connection.id = 'work-connection';
  topbar.append(identity, connection);
  const heading = make('div', 'work-heading');
  const headingCopy = make('div');
  headingCopy.append(make('p', 'eyebrow', '相伴 / COMPANION'));
  const title = make('h2'); title.id = 'work-title';
  const subtitle = make('p', 'work-subtitle'); subtitle.id = 'work-subtitle';
  headingCopy.append(title, subtitle); heading.append(headingCopy);
  const drawerToggle = button('连接与陪玩', () => setDrawer(drawer.hidden));
  drawerToggle.id = 'chat-drawer-toggle'; drawerToggle.setAttribute('aria-controls', 'chat-drawer');
  drawerToggle.setAttribute('aria-expanded', 'false'); heading.append(drawerToggle);
  workspace.append(topbar, heading, $('watch-strip'));
  const canvas = make('div', 'work-canvas');
  for (const article of main.querySelectorAll(':scope > article')) canvas.append(article);
  workspace.append(canvas); main.prepend(sidebar, workspace);
  // Reuse every existing form and event handler; only change their containers.
  const chat = $('page-chat');
  const conversation = make('div', 'conversation-column');
  const meta = make('div', 'conversation-meta');
  meta.append($('chat-session-status'), $('chat-history-more'));
  const timeline = make('div', 'conversation-timeline');
  timeline.append($('chat-messages'));
  const feedback = make('div', 'conversation-feedback');
  feedback.setAttribute('aria-label', '聊天状态');
  feedback.append($('chat-error'), $('chat-working'), $('speech-status'), $('speech-live'));
  const form = $('chat-form');
  const help = make('details', 'composer-help');
  help.append(make('summary', '', '附件说明与对话管理'));
  const attachmentHint = [...form.children].find(n => n.matches('p.hint') && n.id !== 'chat-key-hint');
  if (attachmentHint) help.append(attachmentHint);
  const manage = make('div', 'chat-buttons'); manage.append($('chat-export'), $('chat-clear')); help.append(manage);
  form.append(help);
  const examples = document.querySelector('.chat-examples');
  examples.classList.add('composer-examples');
  form.insertBefore(examples, form.firstChild);
  conversation.append(meta, timeline, feedback, form);
  const drawer = make('aside', 'chat-drawer'); drawer.id = 'chat-drawer'; drawer.hidden = true;
  drawer.setAttribute('aria-label', '聊天连接、陪玩与对话设置');
  const drawerHeader = make('div', 'drawer-heading');
  drawerHeader.append(make('h3', '', '聊天与陪玩'), button('收起', () => setDrawer(false)));
  const drawerContent = make('div', 'drawer-content');
  const chatIntro = chat.querySelector('.chat-intro'); chatIntro.remove();
  // All remaining settings stay reachable in the drawer, including memory and model forms.
  while (chat.firstChild) drawerContent.append(chat.firstChild);
  drawer.append(drawerHeader, drawerContent); chat.append(conversation, drawer);
  function setDrawer(open, focus = false) {
    drawer.hidden = !open; chat.classList.toggle('drawer-open', open);
    drawerToggle.setAttribute('aria-expanded', String(open));
    if (!open && focus) drawerToggle.focus();
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !drawer.hidden && !$('chat-welcome').open) { setDrawer(false, true); }
  });
  // Short sections instead of one long extensions page.
  const extensions = $('page-extensions');
  const sections = [...extensions.querySelectorAll(':scope > section')];
  const extensionTabs = make('div', 'extension-tabs'); extensionTabs.setAttribute('role', 'tablist');
  extensionTabs.setAttribute('aria-label', '相伴与扩展功能');
  const names = ['交流与情绪', '共同项目', '划词提问', '角色知识库', '角色包与插件', '备份与搬家'];
  let extensionIndex = 0;
  function switchExtension(index, focus = false) {
    if (!sections[index]) return;
    extensionIndex = index;
    sections.forEach((s, i) => { s.hidden = i !== index; });
    [...extensionTabs.children].forEach((b, i) => { b.setAttribute('aria-selected', String(i === index)); b.tabIndex = i === index ? 0 : -1; b.classList.toggle('selected', i === index); });
    if (focus) extensionTabs.children[index].focus();
    extensions.scrollTop = 0;
  }
  sections.forEach((section, i) => {
    section.id = 'extension-section-' + i; section.setAttribute('role', 'tabpanel');
    const tab = button(names[i], () => switchExtension(i)); tab.id = 'extension-tab-' + i;
    tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', section.id);
    section.setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('keydown', e => {
      if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
        e.preventDefault(); switchExtension(e.key === 'Home' ? 0 : e.key === 'End' ? sections.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + sections.length) % sections.length, true);
      }
    });
    extensionTabs.append(tab);
  });
  extensions.insertBefore(extensionTabs, sections[0]); switchExtension(0);
  extensions.append($('plus-status'));
  let currentPage = 'chat';
  for (const node of navigation) node.addEventListener('click', () => {
    currentPage = node.dataset.page; const page = pages[currentPage];
    title.textContent = page[1]; subtitle.textContent = page[2];
    drawerToggle.hidden = currentPage !== 'chat';
    navigation.forEach(b => b.setAttribute('aria-current', b === node ? 'page' : 'false'));
    try { localStorage.setItem('jie-workspace-page', currentPage); } catch {}
  });
  let lastSelection = -1, initial = true;
  function status(state) {
    const auth = state.auth, c = state.chat;
    const model = auth.model || '';
    const label = auth.catalog?.find(m => m.id === model)?.label || model;
    connection.textContent = auth.connected ? '已连接' + (label ? ' · ' + label : '') : '还未连接聊天服务';
    connection.classList.toggle('connected', auth.connected);
    connection.title = connection.textContent;
    const portrait = state.extensions?.packages?.appearance?.portrait;
    main.style.setProperty('--conversation-portrait', portrait ? 'url("' + portrait + '")' : 'url("assets/icon.png")');
    if (initial) { initial = false; if (!auth.connected) { setDrawer(true); $('chat-connection').open = true; } }
    const revision = state.extensions?.selectionRevision;
    if (revision != null && revision !== lastSelection) {
      if (state.extensions.selection && (lastSelection !== -1 || revision > 0)) switchExtension(2);
      lastSelection = revision;
    }
    // The empty state vanishes naturally as soon as the original chat renderer adds messages.
    const empty = $('chat-messages').querySelector(':scope > .empty');
    if (empty && !c.history.length) empty.classList.add('conversation-empty');
  }
  window.jie.onChat(status); window.jie.chatState().then(status);
  window.jie.onPage(name => {
    // Existing handlers cover the other pages; this also covers the new entry.
    if (name === 'extensions') navigation.find(b => b.dataset.page === name)?.click();
  });
  let savedPage;
  try { savedPage = localStorage.getItem('jie-workspace-page'); } catch {}
  navigation.find(b => b.dataset.page === (pages[savedPage] ? savedPage : 'chat')).click();
})();
