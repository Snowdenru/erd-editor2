// После удаления текущей (или единственной) схемы уходим на пустой холст;
// удаление другой схемы из списка оставляет пользователя на месте.
export function shouldLeaveAfterDelete(p: {
    deletedId: string;
    currentId: string | undefined;
    totalBefore: number;
}): boolean {
    return p.deletedId === p.currentId || p.totalBefore <= 1;
}
