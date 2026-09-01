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

# Login admin tenant 1 (dg@lucepress.com)
s, b, sc = post("auth.login", {"json": {"email": "dg@lucepress.com", "password": "Yeo?KVK74%b%?@OfVx"}})
print(f"[1] login admin tenant 1 -> {s}")
tok = re.search(r"app_session_id=([^;]+)", sc)
cookie = f"app_session_id={tok.group(1)}" if tok else ""

# auth.me
s2, b2 = get("auth.me", cookie)
try:
    d = json.loads(b2); me = d["result"]["data"]["json"]
    print(f"[2] auth.me -> email: {me.get('email')}, role: {me.get('role')}, tenantId: {me.get('tenantId')}" if me else "[2] auth.me -> null")
except: print(f"[2] body: {b2[:200]}")

# clients.list (doit voir 21 clients)
s3, b3 = get("billing.clients.list", cookie)
try:
    d = json.loads(b3); clients = d["result"]["data"]["json"]
    print(f"[3] clients.list -> {len(clients)} clients")
except: print(f"[3] body: {b3[:200]}")

# users.list (doit voir 4 users)
s4, b4 = get("users.list", cookie)
try:
    d = json.loads(b4); users = d["result"]["data"]["json"]
    print(f"[4] users.list -> {len(users)} users")
except: print(f"[4] body: {b4[:200]}")

print("\nVERDICT:")
print("  MULTI-TENANT OPERATIONNEL" if me and me.get('tenantId') == 1 else "A VERIFIER")
