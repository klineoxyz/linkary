export async function healthRoutes(app) {
    app.get("/health", async () => {
        return { ok: true, service: "linkary-api" };
    });
}
//# sourceMappingURL=health.js.map