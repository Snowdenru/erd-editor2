interface InitializableRouter {
    state: { initialized: boolean };
    subscribe: (fn: (state: { initialized: boolean }) => void) => () => void;
}

// В #root до старта React лежит либо предрендеренная страница (about.html), либо
// сплэш-спиннер из index.html. Первый commit createRoot() очищает контейнер, а пока
// ленивый маршрут не загружен, роутер рендерит null — вместо страницы/спиннера был бы
// белый экран. Поэтому, если в #root что-то есть, ждём инициализации роутера.
export const hasPrerenderedContent = (root: Element): boolean =>
    root.firstElementChild !== null;

export const waitForPrerenderedPage = (
    root: Element,
    router: InitializableRouter,
    timeoutMs = 3000
): Promise<void> => {
    if (!hasPrerenderedContent(root) || router.state.initialized) {
        return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
        let unsubscribe: () => void = () => {};
        const timer = setTimeout(done, timeoutMs);
        function done() {
            clearTimeout(timer);
            unsubscribe();
            resolve();
        }
        unsubscribe = router.subscribe((state) => {
            if (state.initialized) {
                done();
            }
        });
    });
};
