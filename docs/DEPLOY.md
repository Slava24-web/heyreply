# Деплой в production

Схема: образы собирает GitHub Actions и кладёт в GHCR, сервер только делает `pull`. Стек описан в [docker-compose.prod.yml](../docker-compose.prod.yml) (Postgres, API, веб, Caddy на 80/443, контейнер бэкапов).

## 1. Сервер (один раз)

Нужен Linux с Docker и Docker Compose v2, домен с A-записью на IP сервера.

### Файрвол и SSH

Сначала убедитесь, что вход по ключу работает (`ssh-copy-id`), и **не закрывая текущую сессию** проверьте новую во втором окне — иначе можно остаться без доступа.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp   # HTTP/3
sudo ufw enable
```

```bash
# /etc/ssh/sshd_config.d/10-hardening.conf
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
```

```bash
sudo sshd -t && sudo systemctl reload ssh   # на RHEL-подобных: sshd
```

Docker пробрасывает опубликованные порты в iptables в обход ufw, поэтому правило ufw не защищает контейнерные порты. В prod-compose наружу опубликованы только 80 и 443 у Caddy, Postgres и API портов не публикуют — не добавляйте им `ports:`.

### Ротация логов Docker

В compose у каждого сервиса стоит `json-file` с лимитом 10 МБ × 3 файла. Чтобы то же действовало для любых других контейнеров на сервере, добавьте умолчание в `/etc/docker/daemon.json` (потом `sudo systemctl restart docker`):

```json
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
```

### Код и `.env`

```bash
git clone https://github.com/Slava24-web/heyreply.git && cd heyreply
cp .env.example .env && chmod 600 .env
```

Заполните в `.env`: `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET` (`openssl rand -base64 48`), `SITE_ADDRESS`, `WEB_ORIGIN`, `BACKUP_S3_*`; для импорта почты ещё `INBOUND_*`. Строки раздела «Production only» в `.env.example` закомментированы — раскомментируйте нужные. `IMAGE_TAG` запишет `deploy/deploy.sh`.

### Доступ к GHCR

Пакеты по умолчанию приватные. Либо сделайте три пакета публичными (GitHub → Packages → Package settings), либо залогиньтесь на сервере токеном с правом `read:packages`:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u Slava24-web --password-stdin
```

## 2. Выкладка

1. Пуш в `main` запускает workflow `images` (вкладка Actions). Он публикует `heyreply-api`, `heyreply-web`, `heyreply-backup` с тегами `sha-<коммит>` и `latest`.
2. Когда сборка зелёная, на сервере:

```bash
deploy/deploy.sh sha-abc1234
```

Скрипт делает `git pull`, пишет тег в `.env`, `docker compose pull` и `up -d`. Миграции Prisma применяются при старте API.

**Откат** — тот же скрипт с предыдущим тегом (он печатается в начале вывода). Откатить можно образы, но не миграции: деструктивные миграции делайте в два релиза.

Сервер образы не собирает, поэтому памяти хватает и 1 ГБ. Образы собираются под `linux/amd64`; для ARM-сервера (например, Hetzner CAX) поменяйте `platforms` в workflow.

## 3. Бэкапы

Контейнер `backup` каждый день в 03:15 UTC делает `pg_dump -Fc`, проверяет дамп через `pg_restore -l` и загружает в бакет как `heyreply/heyreply-<время>.dump`. Расписание меняется переменной `BACKUP_CRON`.

**Cloudflare R2** (на Backblaze B2 всё то же, endpoint вида `https://s3.<регион>.backblazeb2.com`):

1. Создайте бакет, например `heyreply-backups`.
2. R2 → Manage API tokens → токен с правом *Object Read & Write* только на этот бакет. Значения пойдут в `BACKUP_S3_ACCESS_KEY_ID` и `BACKUP_S3_SECRET_ACCESS_KEY`.
3. `BACKUP_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`.
4. Срок хранения: Bucket → Settings → Object lifecycle rules → удалять объекты с префиксом `heyreply/` через 30 дней. Скрипт сам старые дампы не чистит.

Проверка работы после первой выкладки:

```bash
docker compose -f docker-compose.prod.yml exec backup backup.sh   # внеочередной бэкап
docker compose -f docker-compose.prod.yml logs backup
```

**Проверка восстановления** (после первого бэкапа и затем раз в месяц, например по напоминанию в календаре):

```bash
deploy/restore-test.sh
```

Скрипт скачивает последний дамп, поднимает временный Postgres, восстанавливает базу и выводит число строк по таблицам. Он падает, если дамп старше 36 часов, то есть заодно ловит остановившиеся бэкапы. В конце печатает `restore OK`.

Для оповещений о пропущенном бэкапе заведите heartbeat-проверку (healthchecks.io или heartbeat-монитор UptimeRobot) и положите её URL в `BACKUP_PING_URL`: контейнер пингует старт, успех и `/fail`.

Восстановление в боевую базу при аварии:

```bash
docker compose -f docker-compose.prod.yml run --rm --no-deps -T backup fetch-latest.sh > latest.dump
docker compose -f docker-compose.prod.yml stop api web
docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U heyreply -d heyreply --clean --if-exists --no-owner < latest.dump
docker compose -f docker-compose.prod.yml start api web
```

## 4. Мониторинг

UptimeRobot (бесплатный план): монитор типа HTTP(s) на `https://<домен>/api/health`, интервал 5 минут, тип проверки «Keyword» со словом `ok`. Эндпоинт делает `SELECT 1` в базе, поэтому ловит и падение API, и падение Postgres. Уведомления подключите на почту или в Telegram.

## 5. Чек-лист перед запуском

- [ ] Файрвол включён, `ssh -o PasswordAuthentication=no` пускает только по ключу
- [ ] `.env` с правами 600, секреты не из примеров
- [ ] Сборка `images` зелёная, `deploy/deploy.sh` отработал, сайт открывается по https
- [ ] `docker compose -f docker-compose.prod.yml ps`: все сервисы `healthy` / `Up`
- [ ] Первый бэкап вручную, `deploy/restore-test.sh` печатает `restore OK`
- [ ] Монитор UptimeRobot зелёный
- [ ] `sudo reboot` — стек поднялся сам (`restart: unless-stopped`)
