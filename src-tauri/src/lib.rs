use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Json, Query, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::{
    net::UdpSocket,
    sync::{mpsc, Mutex},
    time::sleep,
};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

const SERVICE_PORT: u16 = 3101;
const DISCOVERY_PORT: u16 = 33145;
const DISCOVERY_PROTOCOL: &str = "sketchforge-lan-v1";

#[derive(Clone)]
struct LanState {
    rooms: Arc<Mutex<HashMap<String, Room>>>,
    discovered: Arc<Mutex<HashMap<String, DiscoveredEntry>>>,
}

struct Room {
    host_id: String,
    host_name: String,
    snapshot: Value,
    clients: HashMap<String, Client>,
}

struct Client {
    name: String,
    role: &'static str,
    sender: mpsc::UnboundedSender<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiscoveredSession {
    code: String,
    host_name: String,
    service_url: String,
}

struct DiscoveredEntry {
    session: DiscoveredSession,
    last_seen: Instant,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateRoomRequest {
    host_name: String,
    snapshot: Value,
}

#[derive(Deserialize)]
struct JoinRoomRequest {
    code: String,
    name: String,
}

#[derive(Deserialize)]
struct SocketQuery {
    code: String,
    #[serde(rename = "participantId")]
    participant_id: String,
    name: String,
}

#[derive(Serialize)]
struct RoomCreated {
    code: String,
    #[serde(rename = "participantId")]
    participant_id: String,
}

#[derive(Serialize)]
struct JoinedRoom {
    code: String,
    #[serde(rename = "participantId")]
    participant_id: String,
    snapshot: Value,
}

#[derive(Serialize, Deserialize)]
struct DiscoveryPacket {
    protocol: String,
    code: String,
    #[serde(rename = "hostName")]
    host_name: String,
    port: u16,
}

fn invite_code() -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let bytes = Uuid::new_v4().into_bytes();
    let compact: String = bytes
        .iter()
        .take(8)
        .map(|byte| ALPHABET[*byte as usize % ALPHABET.len()] as char)
        .collect();
    format!("{}-{}", &compact[..4], &compact[4..])
}

fn normalize_code(value: &str) -> String {
    let compact: String = value
        .to_uppercase()
        .chars()
        .filter(|character| {
            matches!(character, 'A'..='Z' | '2'..='9') && !matches!(character, 'I' | 'L' | 'O')
        })
        .take(8)
        .collect();
    if compact.len() == 8 {
        format!("{}-{}", &compact[..4], &compact[4..])
    } else {
        compact
    }
}

fn participants(room: &Room) -> Vec<Value> {
    room.clients
        .values()
        .map(|client| json!({ "name": client.name, "role": client.role }))
        .collect()
}

fn send_all(clients: impl Iterator<Item = mpsc::UnboundedSender<String>>, message: &Value) {
    let serialized = message.to_string();
    for sender in clients {
        let _ = sender.send(serialized.clone());
    }
}

async fn health() -> impl IntoResponse {
    Json(json!({ "ok": true }))
}

async fn create_room(
    State(state): State<LanState>,
    Json(request): Json<CreateRoomRequest>,
) -> impl IntoResponse {
    let host_name = request.host_name.trim();
    if host_name.len() < 2 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "A display name is required" })),
        )
            .into_response();
    }
    let mut code = invite_code();
    let mut rooms = state.rooms.lock().await;
    while rooms.contains_key(&code) {
        code = invite_code();
    }
    let host_id = Uuid::new_v4().to_string();
    rooms.insert(
        code.clone(),
        Room {
            host_id: host_id.clone(),
            host_name: host_name.to_owned(),
            snapshot: request.snapshot,
            clients: HashMap::new(),
        },
    );
    (
        StatusCode::CREATED,
        Json(json!(RoomCreated {
            code,
            participant_id: host_id
        })),
    )
        .into_response()
}

async fn join_room(
    State(state): State<LanState>,
    Json(request): Json<JoinRoomRequest>,
) -> impl IntoResponse {
    let code = normalize_code(&request.code);
    let name = request.name.trim();
    if name.len() < 2 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "A display name is required" })),
        )
            .into_response();
    }
    let rooms = state.rooms.lock().await;
    let Some(room) = rooms.get(&code) else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Invite code not found or session has ended" })),
        )
            .into_response();
    };
    (
        StatusCode::OK,
        Json(json!(JoinedRoom {
            code,
            participant_id: Uuid::new_v4().to_string(),
            snapshot: room.snapshot.clone()
        })),
    )
        .into_response()
}

async fn collaboration_socket(
    State(state): State<LanState>,
    Query(query): Query<SocketQuery>,
    socket: WebSocketUpgrade,
) -> impl IntoResponse {
    socket.on_upgrade(move |socket| handle_socket(socket, state, query))
}

async fn handle_socket(socket: WebSocket, state: LanState, query: SocketQuery) {
    let code = normalize_code(&query.code);
    let name = query.name.trim().to_owned();
    if name.len() < 2 {
        return;
    }
    let (mut writer, mut reader) = socket.split();
    let (sender, mut outbound) = mpsc::unbounded_channel::<String>();
    let writer_task = tauri::async_runtime::spawn(async move {
        while let Some(message) = outbound.recv().await {
            if writer.send(Message::Text(message.into())).await.is_err() {
                break;
            }
        }
    });

    let initial = {
        let mut rooms = state.rooms.lock().await;
        let Some(room) = rooms.get_mut(&code) else {
            writer_task.abort();
            return;
        };
        let role = if query.participant_id == room.host_id {
            "host"
        } else {
            "guest"
        };
        room.clients.insert(
            query.participant_id.clone(),
            Client {
                name,
                role,
                sender: sender.clone(),
            },
        );
        let current = json!({ "type": "snapshot", "snapshot": room.snapshot, "participants": participants(room) });
        let presence = json!({ "type": "presence", "participants": participants(room) });
        let recipients = room
            .clients
            .values()
            .map(|client| client.sender.clone())
            .collect::<Vec<_>>();
        (current, presence, recipients)
    };
    let _ = sender.send(initial.0.to_string());
    send_all(initial.2.into_iter(), &initial.1);

    while let Some(Ok(message)) = reader.next().await {
        let Message::Text(text) = message else {
            continue;
        };
        let Ok(payload) = serde_json::from_str::<Value>(&text) else {
            continue;
        };
        let message_type = payload.get("type").and_then(Value::as_str);
        if message_type == Some("end") {
            let ended = {
                let mut rooms = state.rooms.lock().await;
                if rooms
                    .get(&code)
                    .is_some_and(|room| room.host_id == query.participant_id)
                {
                    rooms.remove(&code)
                } else {
                    None
                }
            };
            if let Some(room) = ended {
                send_all(
                    room.clients.into_values().map(|client| client.sender),
                    &json!({ "type": "ended", "snapshot": room.snapshot }),
                );
            }
            break;
        }
        if message_type == Some("replace") && payload.get("snapshot").is_some() {
            let recipients = {
                let mut rooms = state.rooms.lock().await;
                let Some(room) = rooms.get_mut(&code) else {
                    break;
                };
                room.snapshot = payload["snapshot"].clone();
                room.clients
                    .iter()
                    .filter(|(id, _)| *id != &query.participant_id)
                    .map(|(_, client)| client.sender.clone())
                    .collect::<Vec<_>>()
            };
            send_all(recipients.into_iter(), &payload);
        }
    }

    writer_task.abort();
    let ended = {
        let mut rooms = state.rooms.lock().await;
        let host_left = rooms
            .get(&code)
            .is_some_and(|room| room.host_id == query.participant_id);
        if host_left {
            rooms.remove(&code)
        } else if let Some(room) = rooms.get_mut(&code) {
            room.clients.remove(&query.participant_id);
            None
        } else {
            None
        }
    };
    if let Some(room) = ended {
        send_all(
            room.clients.into_values().map(|client| client.sender),
            &json!({ "type": "ended", "snapshot": room.snapshot }),
        );
    }
}

async fn run_service(state: LanState) {
    let app = Router::new()
        .route("/healthz", get(health))
        .route("/rooms", post(create_room))
        .route("/rooms/join", post(join_room))
        .route("/collaboration", get(collaboration_socket))
        .layer(CorsLayer::permissive())
        .with_state(state);
    let listener = match tokio::net::TcpListener::bind(("0.0.0.0", SERVICE_PORT)).await {
        Ok(listener) => listener,
        Err(error) => {
            log::error!("Could not start the SketchForge LAN service: {error}");
            return;
        }
    };
    if let Err(error) = axum::serve(listener, app).await {
        log::error!("SketchForge LAN service stopped: {error}");
    }
}

async fn broadcast_sessions(state: LanState) {
    let Ok(socket) = UdpSocket::bind("0.0.0.0:0").await else {
        return;
    };
    let _ = socket.set_broadcast(true);
    loop {
        let sessions = {
            let rooms = state.rooms.lock().await;
            rooms
                .iter()
                .map(|(code, room)| DiscoveryPacket {
                    protocol: DISCOVERY_PROTOCOL.into(),
                    code: code.clone(),
                    host_name: room.host_name.clone(),
                    port: SERVICE_PORT,
                })
                .collect::<Vec<_>>()
        };
        for session in sessions {
            if let Ok(payload) = serde_json::to_vec(&session) {
                let _ = socket
                    .send_to(&payload, ("255.255.255.255", DISCOVERY_PORT))
                    .await;
            }
        }
        sleep(Duration::from_secs(2)).await;
    }
}

async fn listen_for_sessions(state: LanState) {
    let Ok(socket) = UdpSocket::bind(("0.0.0.0", DISCOVERY_PORT)).await else {
        log::error!("Could not start SketchForge LAN discovery");
        return;
    };
    let mut buffer = [0_u8; 2048];
    loop {
        let Ok((length, source)) = socket.recv_from(&mut buffer).await else {
            continue;
        };
        let Ok(packet) = serde_json::from_slice::<DiscoveryPacket>(&buffer[..length]) else {
            continue;
        };
        if packet.protocol != DISCOVERY_PROTOCOL {
            continue;
        }
        let session = DiscoveredSession {
            code: packet.code.clone(),
            host_name: packet.host_name,
            service_url: format!("http://{}:{}", source.ip(), packet.port),
        };
        state.discovered.lock().await.insert(
            packet.code,
            DiscoveredEntry {
                session,
                last_seen: Instant::now(),
            },
        );
    }
}

#[tauri::command]
async fn discover_sessions(
    state: tauri::State<'_, LanState>,
) -> Result<Vec<DiscoveredSession>, String> {
    let discovered = state.discovered.clone();
    let mut sessions = discovered.lock().await;
    let own_codes = state.rooms.lock().await.keys().cloned().collect::<Vec<_>>();
    sessions.retain(|_, entry| entry.last_seen.elapsed() < Duration::from_secs(6));
    Ok(sessions
        .values()
        .filter(|entry| !own_codes.contains(&entry.session.code))
        .map(|entry| entry.session.clone())
        .collect())
}

#[tauri::command]
fn local_service_url() -> String {
    format!("http://127.0.0.1:{SERVICE_PORT}")
}

pub fn run() {
    let state = LanState {
        rooms: Arc::new(Mutex::new(HashMap::new())),
        discovered: Arc::new(Mutex::new(HashMap::new())),
    };
    let service_state = state.clone();
    let broadcast_state = state.clone();
    let discovery_state = state.clone();
    tauri::async_runtime::spawn(async move { run_service(service_state).await });
    tauri::async_runtime::spawn(async move { broadcast_sessions(broadcast_state).await });
    tauri::async_runtime::spawn(async move { listen_for_sessions(discovery_state).await });
    tauri::Builder::default()
        .manage(state)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            discover_sessions,
            local_service_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running SketchForge LAN");
}
