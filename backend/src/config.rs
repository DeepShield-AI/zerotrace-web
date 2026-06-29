use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub session_cookie_name: String,
    pub bind_addr: String,
    /// URL of zerotrace-server for infrastructure data queries
    pub zerotrace_server_url: String,
    /// URL of zerotrace-server for usage metering API calls (same server, different port/path)
    pub zerotrace_metering_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            // MySQL database — requires external server.
            // Override with DATABASE_URL env var for production.
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "mysql://root:deepflow@127.0.0.1:30130/deepflow".to_string()),
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "zerotrace-dev-secret-change-in-production".to_string()),
            session_cookie_name: env::var("SESSION_COOKIE_NAME")
                .unwrap_or_else(|_| "zt_session".to_string()),
            bind_addr: env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:3001".to_string()),
            zerotrace_server_url: env::var("ZEROTRACE_SERVER_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:30417".to_string()),
            zerotrace_metering_url: env::var("ZEROTRACE_METERING_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:30417".to_string()),
        }
    }
}
