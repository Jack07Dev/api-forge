export const normalizeRoutePattern = (path: string): string => {
    const segments = path.split("/").filter(Boolean);

    return (
        "/" +
        segments
            .map((segment) => {
                if (segment.startsWith("{") && segment.endsWith("}")) {
                    return "{}";
                }

                return segment;
            })
            .join("/")
    );
};

export const hasRouteConflict = (
    first: { method: string; path: string },
    second: { method: string; path: string }
): boolean => {
    return (
        first.method.toUpperCase() === second.method.toUpperCase() &&
        normalizeRoutePattern(first.path) ===
        normalizeRoutePattern(second.path)
    );
};