use tauri::Manager;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::PathBuf, time::Duration};

#[derive(Serialize)]
struct AppStatus { version: String, schema_version: i32, database_ready: bool, provider: String }
#[derive(Deserialize)]
struct PreferenceInput { key: String, value: String }
#[derive(Deserialize)]
struct WeatherInput { location: String }

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
    let client = reqwest::Client::builder().timeout(Duration::from_secs(15)).user_agent("OnlyBeats-Command-Center/0.6.0").build().map_err(|e| e.to_string())?;
    let url = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?limit=200";
    client.get(url).send().await.map_err(|e| format!("Score provider connection failed: {e}"))?.error_for_status().map_err(|e| format!("Score provider returned an error: {e}"))?.json::<Value>().await.map_err(|e| format!("Invalid score response: {e}"))
}

#[tauri::command]
async fn fetch_weather(input: WeatherInput) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("OnlyBeats-Command-Center/0.6.0")
        .build().map_err(|e| e.to_string())?;
    let query = urlencoding::encode(&input.location);
    let geo_url = format!("https://geocoding-api.open-meteo.com/v1/search?name={query}&count=1&language=en&format=json");
    let geo: Value = client.get(geo_url).send().await.map_err(|e| format!("Weather location lookup failed: {e}"))?
        .error_for_status().map_err(|e| format!("Weather location provider returned an error: {e}"))?
        .json().await.map_err(|e| format!("Invalid location response: {e}"))?;
    let result = geo.get("results").and_then(|v| v.as_array()).and_then(|v| v.first()).ok_or("No weather location match found")?;
    let lat = result.get("latitude").and_then(|v| v.as_f64()).ok_or("Missing latitude")?;
    let lon = result.get("longitude").and_then(|v| v.as_f64()).ok_or("Missing longitude")?;
    let forecast_url = format!("https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&forecast_days=7&timezone=auto");
    let mut forecast: Value = client.get(forecast_url).send().await.map_err(|e| format!("Weather provider connection failed: {e}"))?
        .error_for_status().map_err(|e| format!("Weather provider returned an error: {e}"))?
        .json().await.map_err(|e| format!("Invalid weather response: {e}"))?;
    forecast["resolved_location"] = serde_json::json!({
        "name": result.get("name").cloned().unwrap_or(Value::Null),
        "admin1": result.get("admin1").cloned().unwrap_or(Value::Null),
        "country": result.get("country").cloned().unwrap_or(Value::Null)
    });
    Ok(forecast)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| { initialize_db(app.handle()).map(|_| ()).map_err(|e| e.into()) })
        .invoke_handler(tauri::generate_handler![app_status, save_preference, fetch_scoreboard, fetch_weather])
        .run(tauri::generate_context!())
        .expect("error while running OnlyBeats Command Center");
}
