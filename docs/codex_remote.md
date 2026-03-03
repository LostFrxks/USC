# Codex Remote: Setup, Phone Access, and Usage Rules

This project uses a local `codex_remote` checkout at:

- `ops/codex_remote` (auto-cloned by bootstrap if missing)

Use it to control Codex sessions from a phone browser on the same local network.

## 1) One-time bootstrap

From project root:

```powershell
.\scripts\codex_remote\bootstrap.ps1
```

What it does:

- installs JS deps in `ops/codex_remote`
- installs JS deps in `ops/codex_remote/services/anchor`
- installs Python deps for FastAPI control-plane
- creates/updates `ops/codex_remote/.env` with LAN settings

## 2) Start / stop

Start stack (backend + frontend + anchor):

```powershell
.\scripts\codex_remote\start.ps1
```

Stop stack:

```powershell
.\scripts\codex_remote\stop.ps1
```

If your IP changed (different Wi-Fi), run:

```powershell
.\scripts\codex_remote\setup-lan.ps1
```

## 3) Connect from phone

Requirements:

- phone and laptop are on the same Wi-Fi/LAN
- local firewall allows inbound TCP `5173` and `8080`

Pipeline:

1. Start `codex_remote` with `.\scripts\codex_remote\start.ps1`.
2. In terminal output, copy `Network` URL (example: `http://172.19.226.148:5173`).
3. Open that URL on phone browser.
4. Register/login in basic auth mode.
5. Use phone UI to view and control Codex sessions.

Health checks:

- backend: `http://<LAN_IP>:8080/health`
- frontend: `http://<LAN_IP>:5173`

## 4) Current auth mode

Configured mode is `AUTH_MODE=basic` in `ops/codex_remote/.env` for fast local MVP use.

For stronger auth later, migrate to passkey mode and HTTPS public origin.

## 5) Usage conditions and security notes

License:

- `codex_remote` is MIT licensed (`ops/codex_remote/LICENSE`).

Operational conditions:

- keep this setup for local/dev use unless you harden it
- do not expose ports 5173/8080 directly to public internet
- rotate JWT secrets if `.env` leaks
- keep machine and browser protected (web tokens are stored on client side)

Known limitations (from upstream docs):

- web tokens can be exposed if device/browser is compromised
- websocket token may appear in infra logs if logging query strings
- app-level rate limiting for auth/ws routes is limited
- public anchor mode requires extra caution

## 6) Troubleshooting

If `webauthn`/Python import errors appear:

```powershell
cd .\ops\codex_remote\services\control-plane
py -3 -m pip install -r requirements.txt
```

If `bun` is not found:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm bun.sh/install.ps1|iex"
```

If phone cannot connect:

1. verify laptop IP changed and rerun `setup-lan.ps1`
2. verify firewall rules for 5173/8080
3. verify both devices are in same network
