module.exports = {
    apps: [
        {
            name: "Live-Face-Tracker-Server",
            script: "server.js",
            interpreter: "node",
            env: {
                PORT: "8196",
                MONGO_DBNAME: "live_face_tracker",

                EMPLOYEE_IMAGE_MAX_COUNT: "10",
                EMPLOYEE_IMAGE_MAX_SIZE: "2", // MB

                MINIO_EMPLOYEE_BUCKET_NAME: "live-face-tracker",

                // Minio
                MINIO_ENDPOINT: "http://160.25.62.109:9000",
                MINIO_ACCESS_KEY: "minioadmin",
                MINIO_SECRET_KEY: "minioadmin",

                // Embedding API
                EMBEDDING_API_URL: "http://160.25.62.109:8195",

                // Redis
                REDIS_HOST: "160.25.62.109",
                REDIS_PORT: "6379",
                REDIS_PASSWORD: "msspl@123",
                REDIS_DB: "0",

                // LiveKit
                LIVEKIT_INGRESS_HOST: "ws://184.168.126.114:7880",
                LIVEKIT_API_KEY: "APIeRxMYAsQbTWq",
                LIVEKIT_API_SECRET: "fmGQuX3ZnNddKj6msJSRxQ9eOkYYWt3q5cfdmIOYmQmB",

                // Camera Status
                WATCHDOG_INTERVAL: "3000", //  # in ms
                OFFLINE_THRESHOLD: "5000", // # in ms

                // Camera Attendence Timeouts
                EXIT_TIMEOUT_AFTER_EXIT_GATE: "45s", // EXIT_TIMEOUT_AFTER_EXIT_GATE
                EXIT_TIMEOUT_AFTER_ENTRY_GATE: "3h", 

                // ffmpef engine
                FFMPEG_PATH: "C:\\ffmpeg\\ffmpeg-8.0.1-essentials_build\\bin\\ffmpeg.exe",
		OFFICE_START_TIME: "09:00",
		OFFICE_END_TIME: "21:00"
            }
        }
    ]
};
