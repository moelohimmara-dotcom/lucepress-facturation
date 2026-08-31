# Base44 development notes

- Run the editable development stack with `docker compose -f docker-compose.base44.yml up -d`.
- MySQL migrations run through the one-shot `migrate` service before the web service starts.
- The Express server embeds Vite middleware in development, so both the UI and API use port 3000 and source edits hot-reload.
- OAuth and external integration credentials are optional for local preview. From the sign-in screen, use **Entrer en mode démo local** to inspect the app without external authentication.
- Verify the stack with `docker compose -f docker-compose.base44.yml ps`, `curl http://localhost:3000/`, and an external-host-header curl.
