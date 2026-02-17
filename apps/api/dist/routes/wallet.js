export async function walletRoutes(app) {
    app.post("/nonce", async (_request, reply) => {
        return reply.code(501).send({
            error: "Not Implemented",
            message: "POST /wallet/nonce is not implemented yet",
        });
    });
    app.post("/verify", async (_request, reply) => {
        return reply.code(501).send({
            error: "Not Implemented",
            message: "POST /wallet/verify is not implemented yet",
        });
    });
}
//# sourceMappingURL=wallet.js.map