import Fastify from "fastify";
import { healthRoutes } from "./routes/health.js";
import { walletRoutes } from "./routes/wallet.js";
const app = Fastify({ logger: true });
app.register(healthRoutes);
app.register(walletRoutes, { prefix: "/wallet" });
const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST ?? "0.0.0.0";
app.listen({ port, host }, (err) => {
    if (err) {
        app.log.error(err);
        process.exit(1);
    }
});
//# sourceMappingURL=index.js.map