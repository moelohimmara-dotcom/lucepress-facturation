import json, urllib.request, urllib.error, re

BASE = "https://lucepress.213.156.135.139.sslip.io"

def post(path, payload, cookie=None):
    req = urllib.request.Request(f"{BASE}/api/trpc/{path}", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    if cookie: req.add_header("Cookie", cookie)
    try:
        r = urllib.request.urlopen(req, timeout=30); return r.status, r.read().decode(), r.headers.get("Set-Cookie", "")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(), e.headers.get("Set-Cookie", "")

def get(path, cookie):
    req = urllib.request.Request(f"{BASE}/api/trpc/{path}"); req.add_header("Cookie", cookie)
    try:
        r = urllib.request.urlopen(req, timeout=30); return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# Login admin tenant 3
s, b, sc = post("auth.login", {"json": {"email": "admin@tenant3.com", "password": "MotDePasse123"}})
print(f"[1] login admin tenant 3 -> {s}")
tok = re.search(r"app_session_id=([^;]+)", sc)
cookie = f"app_session_id={tok.group(1)}" if tok else ""

# auth.me
s2, b2 = get("auth.me", cookie)
try:
    d = json.loads(b2); me = d["result"]["data"]["json"]
    print(f"[2] auth.me -> email: {me.get('email')}, role: {me.get('role')}, tenantId: {me.get('tenantId')}" if me else "[2] auth.me -> null")
except: print(f"[2] body: {b2[:200]}")

# Diagnostic: vérifier le token JWT
print(f"\n[3] Token JWT (décodé):")
try:
    token = tok.group(1)
    parts = token.split(".")
    payload = json.loads(__import__('base64').b64decode(parts[1] + "=="))
    print(f"   openId: {payload.get('openId')}")
    print(f"   email: {payload.get('email')}")
    print(f"   tenantId: {payload.get('tenantId')}")
except Exception as e:
    print(f"   erreur décodage: {e}")

# clients.list
s3, b3 = get("billing.clients.list", cookie)
try:
    d = json.loads(b3); clients = d["result"]["data"]["json"]
    print(f"\n[4] clients.list -> {len(clients)} clients")
    if len(clients) > 0:
        print(f"    premier: {clients[0].get('companyName')} tenantId: {clients[0].get('tenantId')}")
except Exception as e:
    print(f"[4] body: {b3[:200]}")
