// Серверное updated_at облачных схем, на которых основана локальная копия. Уходит в PATCH как
// base_updated_at: если на сервере версия новее (правка с другого устройства), он отвечает 409,
// а не затирает чужие изменения. Только в памяти: после перезагрузки pull заполняет заново.
const versions = new Map<string, string>();

export const getCloudVersion = (id: string): string | undefined =>
    versions.get(id);

export const setCloudVersion = (id: string, updatedAt: string): void => {
    versions.set(id, updatedAt);
};

export const clearCloudVersions = (): void => versions.clear();
