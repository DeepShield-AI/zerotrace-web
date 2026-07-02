use crate::clickhouse::{ch_client, ch_query, org_filter, time_filter};
use crate::db::DbPool;
use crate::errors::AppError;
use crate::middleware::auth::AuthContext;
use axum::extract::{Path, Query, State};
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize, Default)]
pub struct HostsQuery {
    pub start: Option<i64>,
    pub end: Option<i64>,
    pub search: Option<String>,
}

/// GET /api/v1/infra/hosts — host list with metrics from zerotrace-server vtap API + ClickHouse flow_metrics.
pub async fn infra_hosts(
    State(pool): State<DbPool>,
    auth: AuthContext,
    Query(q): Query<HostsQuery>,
) -> Result<axum::response::Response, AppError> {
    let client = ch_client()?;

    // 1. Fetch agents from zerotrace-server
    let zt_url = std::env::var("ZEROTRACE_SERVER_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:30417".to_string());
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| AppError::internal(e.to_string()))?;

    let vtap_resp = http_client
        .get(format!("{}/v1/vtaps/", zt_url))
        .header("Content-Type", "application/json")
        .send()
        .await;

    let agents: Vec<Value> = match vtap_resp {
        Ok(r) if r.status().is_success() => {
            let body = r.text().await.unwrap_or_default();
            if let Ok(val) = serde_json::from_str::<Value>(&body) {
                val.get("DATA")
                    .and_then(|d| d.as_array())
                    .cloned()
                    .unwrap_or_default()
                    .into_iter()
                    .filter(|a| {
                        a.get("ORG_ID").and_then(|v| v.as_i64()).unwrap_or(1) == auth.org_id
                    })
                    .collect()
            } else {
                vec![]
            }
        }
        _ => vec![],
    };

    // 2. Get network metrics from ClickHouse
    let db = crate::clickhouse::effective_flow_log_db(auth.org_id);
    let time_f = time_filter(q.start, q.end, "1 HOUR");
    let org_f = org_filter(auth.org_id);

    // Per-agent network stats (last hour)
    let net_sql = format!(
        "SELECT \
            host_id, \
            SUM(byte_tx) AS byte_tx, \
            SUM(byte_rx) AS byte_rx, \
            SUM(new_flow) AS flow_count, \
            AVG(flow_load) AS avg_flow_load \
         FROM `flow_metrics`.`network.1m` \
         WHERE {time_f} {org_f} \
         GROUP BY host_id FORMAT JSONEachRow"
    );
    let net_rows = ch_query(&client, &net_sql).await;

    // Process count per host (from l7_flow_log)
    let proc_sql = format!(
        "SELECT \
            host_id_1 AS host_id, \
            COUNT(DISTINCT process_kname_1) AS process_count \
         FROM {db}.l7_flow_log \
         WHERE {time_f} {org_f} AND process_kname_1 != '' \
         GROUP BY host_id FORMAT JSONEachRow"
    );
    let proc_rows = ch_query(&client, &proc_sql).await;

    // 3. Merge agent data with metrics.
    // When host_id=0 (unresolved traffic), apply metrics to all hosts.
    let mut hosts: Vec<Value> = agents
        .into_iter()
        .map(|mut agent| {
            let agent_id = agent.get("ID").and_then(|v| v.as_i64()).unwrap_or(0);

            // Find network metrics: try exact host_id match first, then fall back to host_id=0
            if let Value::Array(ref net) = net_rows {
                for row in net {
                    let row_host = row.get("host_id").and_then(|v| v.as_i64()).unwrap_or(-1);
                    if row_host == agent_id || (row_host == 0 && agent_id > 0) {
                        if let Some(obj) = agent.as_object_mut() {
                            obj.insert("byte_tx".to_string(), row.get("byte_tx").cloned().unwrap_or(json!(0)));
                            obj.insert("byte_rx".to_string(), row.get("byte_rx").cloned().unwrap_or(json!(0)));
                            obj.insert("flow_count".to_string(), row.get("flow_count").cloned().unwrap_or(json!(0)));
                            obj.insert("avg_flow_load".to_string(), row.get("avg_flow_load").cloned().unwrap_or(json!(0)));
                        }
                        break;
                    }
                }
            }
            // Set defaults if no metrics found
            if let Some(obj) = agent.as_object_mut() {
                obj.entry("byte_tx".to_string()).or_insert(json!(0));
                obj.entry("byte_rx".to_string()).or_insert(json!(0));
                obj.entry("flow_count".to_string()).or_insert(json!(0));
                obj.entry("avg_flow_load".to_string()).or_insert(json!(0));
            }

            // Find process count for this agent (host_id=0 = all hosts)
            if let Value::Array(ref proc) = proc_rows {
                for row in proc {
                    let row_host = row.get("host_id").and_then(|v| v.as_i64()).unwrap_or(-1);
                    if row_host == agent_id || (row_host == 0 && agent_id > 0) {
                        if let Some(obj) = agent.as_object_mut() {
                            let pc = crate::clickhouse::val_i64(&row["process_count"]).unwrap_or(0);
                            obj.insert("process_count".to_string(), json!(pc));
                        }
                        break;
                    }
                }
            }
            if let Some(obj) = agent.as_object_mut() {
                obj.entry("process_count".to_string()).or_insert(json!(0));
            }

            agent
        })
        .collect();

    // Search filter
    if let Some(ref search) = q.search {
        let s = search.to_lowercase();
        hosts.retain(|h| {
            let name = h
                .get("NAME")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            let ip = h
                .get("CTRL_IP")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_lowercase();
            name.contains(&s) || ip.contains(&s)
        });
    }

    Ok(Json(json!({ "hosts": hosts })).into_response())
}

/// GET /api/v1/infra/processes — process list from l7_flow_log grouped by process_kname.
pub async fn infra_processes(
    State(_pool): State<DbPool>,
    auth: AuthContext,
    Query(q): Query<HostsQuery>,
) -> Result<axum::response::Response, AppError> {
    let client = ch_client()?;
    let db = crate::clickhouse::effective_flow_log_db(auth.org_id);
    let time_f = time_filter(q.start, q.end, "1 HOUR");
    let org_f = org_filter(auth.org_id);

    let sql = format!(
        "SELECT \
            process_kname_1 AS process_name, \
            host_id_1 AS host_id, \
            COUNT(*) AS request_count, \
            AVG(response_duration) / 1000 AS avg_latency_ms, \
            COUNT_IF(response_code >= 500 OR response_code = 0) AS error_count \
         FROM {db}.l7_flow_log \
         WHERE {time_f} {org_f} AND process_kname_1 != '' \
         GROUP BY process_name, host_id \
         ORDER BY request_count DESC \
         LIMIT 100 FORMAT JSONEachRow"
    );

    let rows = ch_query(&client, &sql).await;

    Ok(Json(json!({ "processes": rows })).into_response())
}
