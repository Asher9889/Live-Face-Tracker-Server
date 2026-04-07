import pinoHttp, { Options } from "pino-http";

export default function createHttpLogger() {
    const isProd = process.env.NODE_ENV === "production";

    const options: Options = {
        level: isProd ? "info" : "debug",

        // Remove pid, hostname (noise)
        // base: null,

        // ISO timestamp
        timestamp: () => `,"time":"${new Date().toLocaleString()}"`,

        serializers: {
            req(req) {
                return {
                    method: req.method,
                    route: req.route?.path || req.url,
                };
            },
            res(res) {
                return {
                    statusCode: res.statusCode,
                };
            },
        },

        customSuccessMessage(req, res) {
            return `${req.method} ${req.url} ${res.statusCode}`;
        },

        customErrorMessage(req, res, err) {
            return `${req.method} ${req.url} ${res.statusCode} - ERROR`;
        },
    };

    // Dev-only pretty logs
    let transport;

    if (process.env.NODE_ENV !== "production") {
        try {
            require.resolve("pino-pretty");

            transport = {
                target: "pino-pretty",
                options: { colorize: true },
            };
        } catch {
            console.warn("pino-pretty not installed, skipping pretty logs");
        }
    }

    // Production (pure JSON, fast)
    return pinoHttp(options);
}