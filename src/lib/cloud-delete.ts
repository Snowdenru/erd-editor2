import { authFetch, getAccessToken } from '@/lib/sqllab-auth';

// Без этого удалённая локально схема возвращается из облака при следующем pull
// и занимает слот бесплатного плана. Ошибки не бросаем: локальное удаление важнее.
export async function deleteCloudDiagram(id: string): Promise<boolean> {
    if (!getAccessToken()) return true;
    try {
        const res = await authFetch(`/api/erd2/diagrams/${id}/`, {
            method: 'DELETE',
        });
        if (res.ok || res.status === 404) return true;
        console.error(
            `cloud-delete: не удалось удалить облачную копию — статус ${res.status}`
        );
        return false;
    } catch (err) {
        console.error('cloud-delete: сетевая ошибка при удалении', err);
        return false;
    }
}
