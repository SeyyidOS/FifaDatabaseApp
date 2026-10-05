# Self-hosted deployment

Runs FIFA Manager on this server behind the shared Caddy proxy (the one that serves MLflow), at
**https://fifa.173.249.40.69.sslip.io**. Caddy handles HTTPS; this folder only adds a site block.

| Container  | What it is                                                                 | Networks                     |
|------------|-----------------------------------------------------------------------------|------------------------------|
| `fifa_web` | nginx: the built React app, `/api` proxy, admin-key check on admin writes   | `mlflow_net`, `fifa_internal` |
| `fifa_api` | the FastAPI backend (`backend/`)                                            | `fifa_internal` (no internet) |
| `fifa_db`  | Postgres 16, data in `/root/programs/fifa-app/pgdata`                       | `fifa_internal` (no internet) |

```bash
deploy/deploy.sh                 # publish or update after pulling new code (safe to re-run)
deploy/deploy.sh --backup        # gzipped SQL dump into /root/programs/fifa-app/backups
deploy/deploy.sh --admin-key     # print the key that unlocks the Admin page
deploy/deploy.sh --import FILE   # first run only: load a plain SQL dump into the empty database
deploy/deploy.sh --remove        # unpublish; containers go, data stays
```

Secrets live in `/root/programs/fifa-app/secrets.env` (created on the first run, mode 600):
`POSTGRES_PASSWORD` and `ADMIN_KEY`. Rotate the admin key by editing it there and re-running the script.

Reading data, adding players and logging matches stay open to anyone with the link. Deleting players or
matches and changing the K-factor need the admin key (nginx answers 401 without it).
