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

Docker пробрасывает опубликованные порты в iptables в обход ufw, поэтому правило ufw не защищает контейнерные порты. В prod-compose наружу опубликованы только 80 и 443 у Caddy, Postgres и API портов не публикуют — не добавляйте им `ports:`. По той же причине «только с адресов Cloudflare» ограничивает сам Caddy (раздел 4), а не ufw.

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

Заполните в `.env`: `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET` (`openssl rand -base64 48`), `SITE_ADDRESS`, `WEB_ORIGIN`, `BACKUP_S3_*`, реквизиты оператора `LEGAL_OPERATOR_NAME`, `LEGAL_OPERATOR_ADDRESS`, `LEGAL_CONTACT_EMAIL`, `LEGAL_HOSTING` (они подставляются в политику конфиденциальности, соглашение и согласие, без них веб не стартует); для импорта почты ещё `INBOUND_*`. Строки раздела «Production only» в `.env.example` закомментированы — раскомментируйте нужные. `IMAGE_TAG` запишет `deploy/deploy.sh`.

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

Контейнер `backup` каждый день в 03:15 UTC делает `pg_dump -Fc`, проверяет дамп через `pg_restore -l`, **шифрует его публичным ключом age** и загружает в бакет как `heyreply/heyreply-<время>.dump.age`. Открытый дамп с контейнера не уходит. Расписание меняется переменной `BACKUP_CRON`.

### Шифрование бэкапов (обязательно)

Бэкап содержит все персональные данные, поэтому шифруется до загрузки. На сервере лежит только **публичный** ключ: даже при взломе сервера или бакета старые копии не прочитать. Приватный ключ нужен лишь для восстановления.

```bash
age-keygen -o heyreply-backup.key        # brew install age / apk add age
```

Команда печатает `Public key: age1…`: это значение кладите в `BACKUP_AGE_RECIPIENT` в `.env` на сервере. Файл `heyreply-backup.key` (приватный ключ) сохраните в менеджере паролей и в офлайн-копии, **на сервер не копируйте**. Потеряете ключ: потеряете все бэкапы. Бэкап не стартует, если вместо публичного ключа указан приватный.

Расшифровка вручную: `age -d -i heyreply-backup.key heyreply-….dump.age > restore.dump`.

### Хранилище

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

Ключ передаётся так же: `AGE_IDENTITY_FILE=/абсолютный/путь/heyreply-backup.key deploy/restore-test.sh`. Старые бэкапы без шифрования (`.dump`) скрипт тоже понимает.

Для оповещений о пропущенном бэкапе заведите heartbeat-проверку (healthchecks.io или heartbeat-монитор UptimeRobot) и положите её URL в `BACKUP_PING_URL`: контейнер пингует старт, успех и `/fail`.

Восстановление в боевую базу при аварии:

```bash
docker compose -f docker-compose.prod.yml run --rm --no-deps -T backup fetch-latest.sh > latest.dump
docker compose -f docker-compose.prod.yml stop api web
docker compose -f docker-compose.prod.yml exec -T postgres pg_restore -U heyreply -d heyreply --clean --if-exists --no-owner < latest.dump
docker compose -f docker-compose.prod.yml start api web
```

## 4. Защита от DDoS: Cloudflare

Лимиты внутри приложения (по IP, по маршруту, ограничитель argon2) отсекают злоупотребления одного клиента, но не объёмную атаку: канал и CPU сервера забьются раньше. Для этого перед сервером нужен CDN. Бесплатного плана Cloudflare достаточно.

Что делает приложение само, и что можно настроить:

| Мера | Где | Настройка |
|---|---|---|
| Лимиты запросов по IP, у `login`/`register` 10 в минуту | API | в коде |
| Не более `ARGON2_CONCURRENCY` (по умолчанию 2) одновременных хэшей паролей, `ARGON2_QUEUE` (32) в очереди; сверх этого `503 SERVER_BUSY` | API | переменные в `.env` |
| Таймауты медленных клиентов (`read_header` 10 с, `read_body` 30 с) | Caddy | [deploy/Caddyfile](../deploy/Caddyfile) |

Ответ 503 при всплеске входов означает, что очередь хэширования заполнена: сервис отбрасывает лишнее, а не копит. Если он появляется при обычной нагрузке, поднимите `ARGON2_CONCURRENCY` (каждый хэш держит 64 МБ памяти).

### Подключение Cloudflare

Порядок важен: если пропустить проверку на шаге 4, лимиты начнут считать всех пользователей одним IP.

1. Добавьте домен в Cloudflare, переключите NS у регистратора.
2. A-запись на IP сервера с включённым проксированием (оранжевое облако). SSL/TLS → режим **Full (strict)**.
3. На сервере:

```bash
deploy/cloudflare.sh on
docker compose -f docker-compose.prod.yml up -d
```

   Скрипт скачивает актуальные диапазоны Cloudflare, прописывает их как доверенные для Caddy и ставит `TRUST_PROXY_HOPS=2`: цепочка стала на один узел длиннее, и реальный адрес клиента теперь на шаг левее.
4. Войдите в приложение и откройте Настройки → сессии. Там должен быть **ваш** адрес, не адрес Cloudflare. Если там адрес Cloudflare, лимиты общие на всех: верните `deploy/cloudflare.sh off`.
5. Закройте прямой доступ к серверу в обход Cloudflare:

```bash
deploy/cloudflare.sh lock
docker compose -f docker-compose.prod.yml up -d edge
```

   Теперь Caddy отбрасывает всё, что пришло не с адресов Cloudflare, и атаковать IP сервера напрямую нельзя. Если после этого не выпускается или не продлевается сертификат, выполните `deploy/cloudflare.sh unlock`.

Раз в несколько месяцев запускайте `cloudflare.sh on` и `lock` повторно: диапазоны Cloudflare меняются.

В панели Cloudflare включите Bot Fight Mode и добавьте правило ограничения запросов на `/api/v1/auth/*`; число бесплатных правил и их параметры зависят от плана, смотрите актуальные ограничения в панели. При настоящей атаке помогает режим Under Attack Mode.

## 5. Мониторинг

UptimeRobot (бесплатный план): монитор типа HTTP(s) на `https://<домен>/api/health`, интервал 5 минут, тип проверки «Keyword» со словом `ok`. Эндпоинт делает `SELECT 1` в базе, поэтому ловит и падение API, и падение Postgres. Уведомления подключите на почту или в Telegram.

## 6. Чек-лист перед запуском

- [ ] Файрвол включён, `ssh -o PasswordAuthentication=no` пускает только по ключу
- [ ] `.env` с правами 600, секреты не из примеров
- [ ] Сборка `images` зелёная, `deploy/deploy.sh` отработал, сайт открывается по https
- [ ] `docker compose -f docker-compose.prod.yml ps`: все сервисы `healthy` / `Up`
- [ ] `BACKUP_AGE_RECIPIENT` задан, приватный ключ сохранён вне сервера, диск сервера зашифрован
- [ ] Первый бэкап вручную, `deploy/restore-test.sh` печатает `restore OK`
- [ ] Монитор UptimeRobot зелёный
- [ ] Cloudflare: в сессиях виден реальный IP, затем `cloudflare.sh lock`
- [ ] `sudo reboot` — стек поднялся сам (`restart: unless-stopped`)
