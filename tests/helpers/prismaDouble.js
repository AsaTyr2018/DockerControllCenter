export function createPrismaDouble({ apps = [], templates = [], containerStates = [], appSettings = [] } = {}) {
  const state = {
    apps: apps.map((app) => ({ ...app })),
    templates: templates.map((template) => ({ ...template })),
    containerStates: containerStates.map((entry) => ({ ...entry })),
    appSettings: appSettings.map((entry) => ({ ...entry }))
  };

  function cloneApp(app, include) {
    if (!app) {
      return null;
    }

    const copy = { ...app };

    if (include?.containerStates) {
      copy.containerStates = state.containerStates
        .filter((entry) => entry.appId === app.id)
        .map((entry) => ({ ...entry }));
    }

    if (include?.settings) {
      copy.settings = state.appSettings.find((entry) => entry.appId === app.id) ?? null;
      if (copy.settings) {
        copy.settings = { ...copy.settings };
      }
    }

    return copy;
  }

  const appModel = {
    async findUnique({ where, select, include } = {}) {
      const entries = Object.entries(where ?? {});

      if (entries.length === 0) {
        return null;
      }

      const [key, value] = entries[0];
      const record = state.apps.find((app) => app[key] === value);

      if (!record) {
        return null;
      }

      if (select) {
        const selected = {};
        for (const [field, enabled] of Object.entries(select)) {
          if (enabled) {
            selected[field] = record[field];
          }
        }
        return selected;
      }

      return cloneApp(record, include);
    },

    async findMany({ include } = {}) {
      return state.apps.map((app) => cloneApp(app, include));
    },

    async create({ data }) {
      const record = {
        id: data.id ?? `app_${state.apps.length + 1}`,
        createdAt: data.createdAt ?? new Date(),
        updatedAt: data.updatedAt ?? new Date(),
        status: data.status ?? 'STOPPED',
        lastSeenAt: data.lastSeenAt ?? null,
        openAppBaseUrl: data.openAppBaseUrl ?? null,
        ...data
      };
      state.apps.push(record);
      return { ...record };
    },

    async update({ where, data }) {
      const index = state.apps.findIndex((app) => app.id === where.id);

      if (index === -1) {
        throw new Error(`App with id ${where.id} not found.`);
      }

      const updated = {
        ...state.apps[index],
        ...data,
        updatedAt: data.updatedAt ?? new Date()
      };
      state.apps[index] = updated;
      return { ...updated };
    }
  };

  const marketplaceTemplateModel = {
    async findUnique({ where }) {
      if (where.id) {
        return state.templates.find((template) => template.id === where.id) ?? null;
      }

      if (where.name) {
        return state.templates.find((template) => template.name === where.name) ?? null;
      }

      return null;
    }
  };

  const appSettingsModel = {
    async upsert({ where, update, create }) {
      const index = state.appSettings.findIndex((entry) => entry.appId === where.appId);

      if (index === -1) {
        const record = {
          id: create.id ?? `settings_${state.appSettings.length + 1}`,
          createdAt: create.createdAt ?? new Date(),
          updatedAt: create.updatedAt ?? new Date(),
          ...create
        };
        state.appSettings.push(record);
        return { ...record };
      }

      const updated = {
        ...state.appSettings[index],
        ...update,
        updatedAt: update.updatedAt ?? new Date()
      };
      state.appSettings[index] = updated;
      return { ...updated };
    }
  };

  const dockerContainerStateModel = {
    async upsert({ where, update, create }) {
      const index = state.containerStates.findIndex((entry) => entry.appId === where.appId);

      if (index === -1) {
        const record = {
          id: create.id ?? `state_${state.containerStates.length + 1}`,
          createdAt: create.createdAt ?? new Date(),
          updatedAt: create.updatedAt ?? new Date(),
          ...create
        };
        state.containerStates.push(record);
        return { ...record };
      }

      const updated = {
        ...state.containerStates[index],
        ...update,
        updatedAt: update.updatedAt ?? new Date()
      };
      state.containerStates[index] = updated;
      return { ...updated };
    },

    async update({ where, data }) {
      const index = state.containerStates.findIndex((entry) => entry.appId === where.appId);

      if (index === -1) {
        throw new Error(`Container state for app ${where.appId} not found.`);
      }

      const updated = {
        ...state.containerStates[index],
        ...data,
        updatedAt: data.updatedAt ?? new Date()
      };
      state.containerStates[index] = updated;
      return { ...updated };
    },

    async delete({ where }) {
      const index = state.containerStates.findIndex((entry) => {
        if (where.appId) {
          return entry.appId === where.appId;
        }

        if (where.id) {
          return entry.id === where.id;
        }

        return false;
      });

      if (index === -1) {
        throw new Error('Container state not found.');
      }

      const [removed] = state.containerStates.splice(index, 1);
      return { ...removed };
    }
  };

  return {
    state,
    app: appModel,
    marketplaceTemplate: marketplaceTemplateModel,
    appSettings: appSettingsModel,
    dockerContainerState: dockerContainerStateModel
  };
}
