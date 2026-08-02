use tauri::Manager;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::PathBuf, time::Duration};

#[derive(Serialize)]
struct AppStatus { version: String, schema_version: i32, database_ready: bool, provider: String }
#[derive(Deserialize)]
struct PreferenceInput { key: String, value: String }

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}
fn initialize_db(app: &tauri::AppHandle) -> Result<Connection, String> {
    let db_path = app_data_dir(app)?.join("onlybeats.db");
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute_batch(include_str!("../../database/schema.sql")).map_err(|e| e.to_string())?;
    Ok(conn)
}
#[tauri::command]
fn app_status(app: tauri::AppHandle) -> Result<AppStatus, String> {
    initialize_db(&app)?;
    Ok(AppStatus { version: env!("CARGO_PKG_VERSION").into(), schema_version: 1, database_ready: true, provider: "ESPN Scoreboard".into() })
}
#[tauri::command]
fn save_preference(app: tauri::AppHandle, input: PreferenceInput) -> Result<(), String> {
    let conn = initialize_db(&app)?;
    conn.execute("INSERT INTO preferences(key,value,updated_at) VALUES(?1,?2,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at", params![input.key,input.value]).map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
async fn fetch_scoreboard() -> Result<Value, String> {
    let client = reqwest::Client::builder().timeout(Duration::from_secs(15)).user_agent("OnlyBeats-Command-Center/0.5.0").build().map_err(|e| e.to_string())?;
    let url = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?limit=200";
    client.get(url).send().await.map_err(|e| format!("Score provider connection failed: {e}"))?.error_for_status().map_err(|e| format!("Score provider returned an error: {e}"))?.json::<Value>().await.map_err(|e| format!("Invalid score response: {e}"))
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| { initialize_db(app.handle()).map(|_| ()).map_err(|e| e.into()) })
        .invoke_handler(tauri::generate_handler![app_status, save_preference, fetch_scoreboard])
        .run(tauri::generate_context!())
        .expect("error while running OnlyBeats Command Center");
}
