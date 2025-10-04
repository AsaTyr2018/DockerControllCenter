(function () {
  const API_BASE_URL = __DCC_API_BASE_URL__;
  const addAppDialog = document.querySelector('[data-dialog-id="add-app"]');
  const marketplaceDialog = document.querySelector('[data-dialog-id="marketplace"]');
  const addAppForm = addAppDialog.querySelector('form');
  const marketplaceGrid = marketplaceDialog.querySelector('[data-marketplace-grid]');
  const templateSelect = addAppForm.querySelector('select[name="template"]');
  const fleetTableBody = document.querySelector('[data-fleet-body]');
  const emptyRow = fleetTableBody?.querySelector('[data-empty-row]') || null;
  const statsElements = {
    running: document.querySelector('[data-stat="running"]'),
    starting: document.querySelector('[data-stat="starting"]'),
    stopped: document.querySelector('[data-stat="stopped"]'),
    templates: document.querySelector('[data-stat="templates"]')
  };
  let editingId = null;
  let templates = [];
  let apps = [];
  let loading = false;

  function setLoading(next) {
    loading = Boolean(next);
    if (loading) {
      document.body.dataset.loading = 'true';
    } else {
      delete document.body.dataset.loading;
    }
  }

  function displayError(message, error) {
    console.error(message, error);
    window.alert(message);
  }

  async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
    const requestInit = { method, headers: { ...headers } };

    if (body !== undefined) {
      if (typeof body === 'string') {
        requestInit.body = body;
      } else {
        requestInit.body = JSON.stringify(body);
      }

      if (!requestInit.headers['Content-Type']) {
        requestInit.headers['Content-Type'] = 'application/json';
      }
    }

    let response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, requestInit);
    } catch (networkError) {
      const failure = new Error('Failed to reach the Docker Control Center API.');
      failure.cause = networkError;
      throw failure;
    }

    let payload = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch (parseError) {
        payload = null;
      }
    }

    if (!response.ok) {
      const message = payload?.error?.message || `Request failed with status ${response.status}`;
      const failure = new Error(message);
      failure.response = response;
      failure.payload = payload;
      throw failure;
    }

    return payload;
  }

  async function loadTemplates() {
    const result = await apiRequest('/templates');
    templates = Array.isArray(result?.data) ? result.data : [];
  }

  async function loadApps() {
    const result = await apiRequest('/apps');
    apps = Array.isArray(result?.data) ? result.data : [];
  }

  function renderTemplateOptions(list) {
    templateSelect
      .querySelectorAll('[data-dynamic-option]')
      .forEach((option) => option.remove());

    list.forEach((template) => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.name;
      option.dataset.dynamicOption = 'true';
      templateSelect.appendChild(option);
    });
  }

  function createActionButton(action, label, iconPath) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    button.title = label;
    button.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true">' +
      '<path fill="currentColor" d="' +
      iconPath +
      '" />' +
      '</svg>' +
      '<span>' +
      label +
      '</span>';
    return button;
  }

  function createStatusPill(status) {
    const normalized = (status || 'STOPPED').toString().toUpperCase();
    const pill = document.createElement('span');
    pill.className = 'status-pill';
    let visual = normalized;
    if (normalized === 'INSTALLING') {
      visual = 'STARTING';
    } else if (normalized === 'FAILED') {
      visual = 'STOPPED';
    }
    pill.dataset.status = visual;

    const dot = document.createElement('span');
    dot.className = 'status-dot';
    pill.appendChild(dot);

    const label = document.createElement('span');
    if (normalized === 'INSTALLING') {
      label.textContent = 'Installing';
    } else if (normalized === 'FAILED') {
      label.textContent = 'Failed';
    } else {
      label.textContent = normalized;
    }
    pill.appendChild(label);

    return pill;
  }

  function formatTimestamp(value) {
    if (!value) return 'Never';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Never';
    }
    return date.toLocaleString();
  }

  function renderStats(appList, templateList) {
    const running = appList.filter((app) => app.status === 'RUNNING').length;
    const installing = appList.filter((app) => app.status === 'INSTALLING').length;
    const stopped = appList.length - running - installing;

    if (statsElements.running) statsElements.running.textContent = String(running);
    if (statsElements.starting) statsElements.starting.textContent = String(installing);
    if (statsElements.stopped) statsElements.stopped.textContent = String(Math.max(stopped, 0));
    if (statsElements.templates) statsElements.templates.textContent = String(templateList.length);
  }

  function renderFleet(list) {
    if (!fleetTableBody) return;

    fleetTableBody
      .querySelectorAll('[data-app-row]')
      .forEach((row) => row.remove());

    if (!list.length) {
      if (emptyRow) emptyRow.hidden = false;
      return;
    }

    if (emptyRow) emptyRow.hidden = true;

    list.forEach((app) => {
      const row = document.createElement('tr');
      row.dataset.appRow = 'true';
      row.dataset.appId = app.id;

      const nameCell = document.createElement('td');
      const nameLabel = document.createElement('strong');
      nameLabel.textContent = app.name;
      nameCell.appendChild(nameLabel);

      if (app.repositoryUrl) {
        const repo = document.createElement('p');
        repo.className = 'table-hint';
        repo.textContent = app.repositoryUrl;
        nameCell.appendChild(repo);
      }

      if (app.openAppUrl) {
        const link = document.createElement('a');
        link.href = app.openAppUrl;
        link.textContent = 'Open App';
        link.target = '_blank';
        link.rel = 'noreferrer noopener';
        link.className = 'table-hint';
        nameCell.appendChild(link);
      }

      const statusCell = document.createElement('td');
      statusCell.appendChild(createStatusPill(app.status));

      const portCell = document.createElement('td');
      portCell.textContent = app.port ? String(app.port) : '—';

      const seenCell = document.createElement('td');
      seenCell.textContent = formatTimestamp(app.lastSeenAt || app.updatedAt);

      const actionsCell = document.createElement('td');
      actionsCell.className = 'table-actions';

      const status = app.status || 'STOPPED';
      const startStopConfig =
        status === 'RUNNING'
          ? {
              action: 'stop',
              label: 'Stop',
              icon: 'M5.5 3A1.5 1.5 0 0 0 4 4.5v7A1.5 1.5 0 0 0 5.5 13h5A1.5 1.5 0 0 0 12 11.5v-7A1.5 1.5 0 0 0 10.5 3h-5z'
            }
          : {
              action: 'start',
              label: 'Start',
              icon:
                'M6.5 3.5a.5.5 0 0 1 .79-.407l5 3.5a.5.5 0 0 1 0 .814l-5 3.5A.5.5 0 0 1 6.5 10.5v-7zM5 3.5a.5.5 0 0 0-1 0v7a.5.5 0 0 0 1 0v-7z'
            };

      const startStopButton = createActionButton(
        startStopConfig.action,
        startStopConfig.label,
        startStopConfig.icon
      );

      if (status === 'INSTALLING') {
        startStopButton.disabled = true;
        const label = startStopButton.querySelector('span');
        if (label) label.textContent = 'Installing…';
      }

      const reinstallButton = createActionButton(
        'reinstall',
        'Reinstall',
        'M8 3a5 5 0 1 0 4.546 2.914.5.5 0 1 0-.894-.448A4 4 0 1 1 8 4a.5.5 0 0 0 0 1h3a.5.5 0 0 0 .5-.5V2a.5.5 0 0 0-1 0v.8A5 5 0 0 0 8 3z'
      );

      if (status === 'INSTALLING') {
        reinstallButton.disabled = true;
        const label = reinstallButton.querySelector('span');
        if (label) label.textContent = 'Installing…';
      }

      const uninstallButton = createActionButton(
        'uninstall',
        'Deinstall',
        'M5.5 5a.5.5 0 0 0-.5.5V11a.5.5 0 0 0 1 0V5.5A.5.5 0 0 0 5.5 5zm2.5.5a.5.5 0 0 1 1 0V11a.5.5 0 0 1-1 0V5.5zm3-.5a.5.5 0 0 1 .5.5V11a.5.5 0 0 1-1 0V5.5a.5.5 0 0 1 .5-.5zM4.118 2.5 4 3h8l-.118-.5H4.118zM2.5 3a.5.5 0 0 1 .5-.5h2.5L5.618 1.5A1 1 0 0 1 6.577 1h2.846a1 1 0 0 1 .959.5L10.5 2.5H13a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5h-.5v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4H2.5a.5.5 0 0 1-.5-.5V3z'
      );

      if (status === 'INSTALLING') {
        uninstallButton.disabled = true;
      }

      actionsCell.appendChild(startStopButton);
      actionsCell.appendChild(reinstallButton);
      actionsCell.appendChild(uninstallButton);

      row.appendChild(nameCell);
      row.appendChild(statusCell);
      row.appendChild(portCell);
      row.appendChild(seenCell);
      row.appendChild(actionsCell);

      fleetTableBody.appendChild(row);
    });
  }

  function refreshUI() {
    renderTemplateOptions(templates);
    renderMarketplace(templates);
    renderFleet(apps);
    renderStats(apps, templates);
  }

  function populateForm(template) {
    addAppForm.name.value = template?.name ?? '';
    addAppForm.repository.value = template?.repositoryUrl ?? '';
    addAppForm.startCommand.value = template?.startCommand ?? '';
    addAppForm.port.value = template?.defaultPort ? String(template.defaultPort) : '';
  }

  function beginCreate() {
    editingId = null;
    delete addAppDialog.dataset.mode;
    templateSelect.value = '';
    populateForm(null);
  }

  function beginEdit(template) {
    if (!template) {
      beginCreate();
      return;
    }
    editingId = template.id;
    addAppDialog.dataset.mode = 'edit';
    templateSelect.value = template.id;
    populateForm(template);
  }

  async function handleTemplateDeploy(template) {
    const defaultName = template?.name || '';
    const name = window.prompt('Application name', defaultName);

    if (!name) {
      return;
    }

    try {
      setLoading(true);
      await apiRequest('/apps', {
        method: 'POST',
        body: {
          name,
          templateId: template.id,
          repositoryUrl: template.repositoryUrl,
          startCommand: template.startCommand,
          port: template.defaultPort,
          install: true
        }
      });
      await loadApps();
      refreshUI();
    } catch (error) {
      displayError('Failed to deploy application.', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleStart(appId) {
    if (loading) return;
    try {
      setLoading(true);
      await apiRequest(`/apps/${appId}/start`, { method: 'POST' });
      await loadApps();
      refreshUI();
    } catch (error) {
      displayError('Failed to start application.', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleStop(appId) {
    if (loading) return;
    try {
      setLoading(true);
      await apiRequest(`/apps/${appId}/stop`, { method: 'POST', body: { removeVolumes: false } });
      await loadApps();
      refreshUI();
    } catch (error) {
      displayError('Failed to stop application.', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleReinstall(appId) {
    if (loading) return;
    try {
      setLoading(true);
      await apiRequest(`/apps/${appId}/reinstall`, { method: 'POST', body: { skipClone: false } });
      await loadApps();
      refreshUI();
    } catch (error) {
      displayError('Failed to reinstall application.', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUninstall(appId) {
    if (loading) return;
    if (!window.confirm('Remove application and its workspace?')) {
      return;
    }
    try {
      setLoading(true);
      await apiRequest(`/apps/${appId}`, { method: 'DELETE', body: { removeVolumes: true } });
      await loadApps();
      refreshUI();
    } catch (error) {
      displayError('Failed to remove application.', error);
    } finally {
      setLoading(false);
    }
  }

  if (fleetTableBody) {
    fleetTableBody.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      const row = button.closest('[data-app-row]');
      if (!row) return;

      const appId = row.dataset.appId;
      if (!appId) return;

      event.preventDefault();

      switch (button.dataset.action) {
        case 'start':
          handleStart(appId);
          break;
        case 'stop':
          handleStop(appId);
          break;
        case 'reinstall':
          handleReinstall(appId);
          break;
        case 'uninstall':
          handleUninstall(appId);
          break;
        default:
          break;
      }
    });
  }

  addAppForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(addAppForm);
    const name = (formData.get('name') || '').toString().trim();
    if (!name) {
      addAppForm.name.focus();
      return;
    }

    const repository = (formData.get('repository') || '').toString().trim();
    const startCommand = (formData.get('startCommand') || '').toString().trim();
    const portValue = (formData.get('port') || '').toString().trim();
    const defaultPort = portValue ? Number.parseInt(portValue, 10) : null;

    const payload = {
      name,
      repositoryUrl: repository || null,
      startCommand: startCommand || null,
      defaultPort: Number.isFinite(defaultPort) ? defaultPort : null
    };

    try {
      setLoading(true);
      if (editingId) {
        await apiRequest(`/templates/${editingId}`, { method: 'PATCH', body: payload });
      } else {
        await apiRequest('/templates', { method: 'POST', body: payload });
      }
      await loadTemplates();
      refreshUI();
      addAppDialog.close('submit');
      beginCreate();
    } catch (error) {
      displayError('Failed to save template.', error);
    } finally {
      setLoading(false);
    }
  });

  addAppDialog.addEventListener('close', () => {
    if (addAppDialog.returnValue !== 'submit') {
      beginCreate();
    }
    addAppDialog.returnValue = '';
  });

  marketplaceDialog.addEventListener('close', () => {
    marketplaceDialog.returnValue = '';
  });

  templateSelect.addEventListener('change', () => {
    const selected = templateSelect.value;
    if (!selected) {
      beginCreate();
      return;
    }
    const template = templates.find((entry) => entry.id === selected) || null;
    if (template) {
      beginEdit(template);
    }
  });

  document.querySelectorAll('[data-dialog-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-dialog-target');
      const dialog = document.querySelector('[data-dialog-id="' + target + '"]');
      if (!dialog || typeof dialog.showModal !== 'function') {
        return;
      }
      if (target === 'add-app') {
        beginCreate();
      }
      dialog.showModal();
    });
  });

  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        const withinX = event.clientX >= rect.left && event.clientX <= rect.right;
        const withinY = event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!withinX || !withinY) {
          dialog.close('backdrop');
        }
      }
    });
  });

  async function bootstrap() {
    try {
      setLoading(true);
      await Promise.all([loadTemplates(), loadApps()]);
    } catch (error) {
      displayError('Failed to load dashboard data.', error);
    } finally {
      setLoading(false);
      refreshUI();
    }
  }

  bootstrap();
})();
