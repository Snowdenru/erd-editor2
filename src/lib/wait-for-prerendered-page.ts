interface InitializableRouter {
    state: { initialized: boolean };
    subscribe: (fn: (state: { initialized: boolean }) => void) => () => void;
}

// Предрендеренная страница (например, about.html) лежит в #root. Первый commit
// createRoot() очищает контейнер, а пока ленивый маршрут не загружен, роутер
// рендерит null — страница бы мигнула пустотой. Поэтому ждём инициализации роутера.
export const hasPrerenderedContent = (root: Element): boolean =>
    root.querySelector('h1') !== null;

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
