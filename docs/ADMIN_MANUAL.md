# QASSA — Platform Operator Manual

**Who this is for:** the person who runs QASSA as a business — approving shops,
removing bad ones, keeping the marketplace trustworthy. Not the shop owner
(you will be answering their questions, so their workflow is documented too).

**Live system as of 2026-11-06**

| | |
| --- | --- |
| Site | `https://qassa-xi.vercel.app` (default locale: French; `/ar`, `/en`) |
| Repository | `github.com/ahmeedammar/QASSA`, branch `main` deploys automatically |
| Database | Supabase project `nqpqtmxowmuuvnljqnkc` (Postgres + Auth + Storage) |
| Media bucket | `shop-media` (public read, guarded write) |
| Reference shop | **Zitouna Barber Club** — `/fr/shop/zitouna-barber-club`, closed Mondays, fully populated. Use it to learn the flows and to test before touching a real shop. |

There is no staging environment. Everything below is production.

---

## 1. The two jobs, and where the line is

QASSA deliberately splits power between the shop owner and the platform.

**The shop owner does all of this themselves** — you cannot and should not do it
for them, and there is no UI for it:

- create the shop, write its name/address/description/phone
- set services and prices (TND)
- add barbers, assign each barber to services
- set opening hours and each barber's weekly schedule and breaks
- choose the shop's **weekly rest day**
- upload logo, cover and gallery photos
- choose the storefront template
- publish and unpublish the website
- accept, move or cancel appointments in their own Studio

**The platform operator does this, in QASSA Control:**

- see every shop (name, city, published/draft, suspended, created date, reason)
- **suspend** a shop, with a reason, and **restore** it

That is the complete admin lever set today. Suspension is the instrument: it
hides the shop from Discover and the public website, blocks new bookings, and
blocks re-publication. It does not delete content and does not cancel existing
bookings.

> There is no admin "unpublish" button and no admin content editing. If a shop
> must be unpublished without suspending it, that is a database operation
> ([§8](#8-emergency-database-operations)) — treat it as an exception, not a routine.

---

## 2. Getting in the first time

1. Sign in at `/fr/login` with the founder account (`ahmeed.ammar123@gmail.com`).
2. Open `/fr/control`. Because MFA is not enrolled yet you are redirected to
   `/fr/control/mfa`.
3. Press **Générer le secret d'authentification**. The secret and the setup URL
   are shown **once** — the page cannot show them again. Add it to your
   authenticator app (1Password, Google Authenticator, Authy, Bitwarden).
4. Enter the 6-digit code → **Vérifier et continuer**. You land on QASSA Control.

Do this from a device you will still own in a year. If you lose the second
factor there is no self-service recovery: it means editing `auth.users` in
Supabase while logged in as a database superuser.

**Why the friction:** every Control action requires (a) a valid session,
(b) an active row in `platform_admins`, (c) the role permitting the permission,
(d) session level **AAL2** — i.e. MFA verified — and for suspension (e) a login
no older than **10 minutes**.

---

## 3. The daily loop

Open **`/fr/control`** (or `/en/control`).

The header carries your role (`Propriétaire de la plateforme`, `Super
administrateur`, …) and an **MFA actif** badge. If the badge is missing you were
redirected to `/control/mfa` — enter the code first.

Below it, four tiles count the platform: **Total salons**, **Publiés**, **Non
publiés**, **Suspendus**. Each tile is also a filter — press **Suspendus** to see
only suspended shops, press **Total salons** to clear the filter. The search box
matches name, slug or city; the sort selector switches between newest-first and
name order. The line under the toolbar tells you how many of the total are
currently shown.

Each shop card shows: a monogram, name, city, one status badge (`Suspendu` /
`Publié` / `Non publié`), the slug, creation date in **Africa/Tunis** time, a
**Voir le site** link when the shop is published, and the suspension reason if
there is one.

- **Suspendre le salon** — fill in the reason (max 250 characters), press the
  button. Write the reason as if the owner will read it, because they will call
  you about it. `Règlement non respecté`, `Plaintes clients répétées`,
  `Faux rendez-vous`, `Contenu inapproprié`.
- **Rétablir le salon** — one press, no reason needed. Restoring clears the
  stored suspension reason. The shop returns to exactly the publication state it
  had before; if it was published it is visible again immediately.

If your role cannot suspend (support or finance admin), the cards render without
action buttons and a **Lecture seule** notice explains why.

**If you see `Reconnectez-vous avant de modifier la suspension d'un salon`**
your login is older than 10 minutes. Log out, log back in (with the code), act
again. Plan suspension sessions: do the batch right after signing in.

**If the list looks short:** it shows the 100 most recent shops only, and the
panel says so explicitly. There is no pagination. Past 100 shops, use SQL
([§8](#8-emergency-database-operations)).

**If you see `Trop de modifications en peu de temps…`**: admin actions are
capped at 30 per minute per admin. Wait and retry.

**If you see `Impossible de charger les salons. Réessayez.`**: the shop list
failed to load, not your access. Press **Réessayer** — it re-runs the query. Then
open **Détails techniques** and read the code; the panel already translates the
common ones into a next step. See the playbook in
[§11](#11-playbooks) if it persists.

### What suspension actually does

| Effect | Where it is enforced |
| --- | --- |
| Shop disappears from Discover and city lists | view `public_barbershops` filters `is_published and not is_suspended` |
| Public storefront serves nothing (404) | same filter on every public read path |
| Services and barbers become unreadable by the public | `0005`/`0015` public views carry the same predicate |
| New bookings are refused | `0008` booking insert and `get_available_slots` join on `not shop.is_suspended` |
| The shop cannot be (re)published | `set_shop_published` updates `... and not is_suspended` |
| Existing appointments survive | no cascade exists — nothing is deleted or cancelled |
| The owner cannot undo it | trigger `barbershops_suspension_guard` blocks `is_suspended`/`suspension_reason` writes that do not come from the admin RPC |

That last row matters: an owner cannot lift their own suspension, so nothing you
do here can be silently reversed by the other side.

---

## 4. Shop states, and what they mean

A shop has two independent booleans, which produce four real combinations.

| `is_published` | `is_suspended` | Control shows | Customers see |
| --- | --- | --- | --- |
| false | false | **Non publié** (draft) | nothing yet — onboarding incomplete or paused |
| true | false | **Publié** | storefront + Discover + bookings |
| true | true | **Suspendu** | nothing; the shop still has content stored |
| false | true | **Suspendu** | nothing; restoring will *not* publish it |

A suspended-then-restored shop that had been unpublished stays unpublished.
Tell the owner to press Publish in their Studio again.

---

## 5. "I can't publish my shop" — the six gates

This is the support call you will get most. Publication is checked by the
database, not the UI, and it is not negotiable. A shop publishes only when all
six are true (function `shop_website_missing_requirements`, token in brackets):

1. **At least one active service** (`services`).
2. **At least one barber assigned to an active service** (`barber_services`) —
   a barber who does nothing is not enough; this is step 2's "assign services"
   list, not just adding names.
3. **At least one week of opening hours** (`shop_hours`).
4. **At least one barber schedule** (`barber_schedules`) — the barber's working
   days/hours, set in the Hours step.
5. **At least 3 gallery photos** (`shop_media`). Logo and cover are optional;
   the gallery is not.
6. **A weekly rest day selected** (`rest_day`) — `closed_weekday` must be set.

The Studio's six steps map to these, and the progress rail marks a step complete
only when its requirement is satisfied. In French, which is what your owners
see: `Services → Équipe → Horaires → Pauses & absences → Photos → Site web`.

To read the exact blockers of any shop yourself, in the Supabase SQL editor:

```sql
select b.name, b.slug, b.is_published, b.is_suspended, b.closed_weekday,
       public.shop_website_missing_requirements(b.id) as missing
from public.barbershops b
where b.slug = 'zitouna-barber-club';
```

`missing` returns tokens from the list above. Empty array = ready to publish.

### The rest day is a legal requirement, not a preference

Tunisian barbershops close one day a week and that is the only closure the
platform models. There are no shop holidays any more — the `shop_holidays`
table was dropped in migration `0018`.

- `barbershops.closed_weekday` is `0…6`, Postgres `dow` numbering — the same
  labels the Studio shows you:

  | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
  | --- | --- | --- | --- | --- | --- | --- |
  | Dimanche | **Lundi** | Mardi | Mercredi | Jeudi | Vendredi | Samedi |

- Choosing the rest day **deletes that weekday's opening hours** in the same
  operation, so the shop cannot accidentally advertise a day it is closed.
- A trigger rejects any attempt to put opening hours on the rest day
  ("The weekly rest day cannot have opening hours.").
- Availability, the storefront timetable and the "closed today" pill in Discover
  all follow `closed_weekday`.

So: the Monday-closed shop on the reference storefront is not a bug. Its Hours
step carries the block **Jour de repos hebdomadaire** — "Conformément à la loi
tunisienne, le salon ferme un jour par semaine" — with Lundi selected, and Lundi
reads *Fermé* on the public page. If an owner wants Sunday off instead, they
change that one selector and re-save their hours.

### Photos

The gallery needs **at least 3 images and takes at most 12**; each file is
capped at **5 Mo** and must be `webp`, `jpg`, `jpeg`, `png` or `avif`. The
counter on the Photos step reads `x / 12 photos`. The first photo carries the
**Accroche** badge and the `←` button promotes any photo into that lead slot, so
an owner re-ordering their gallery is changing what customers see first.

Uploads go to the owner's own folder in the `shop-media` bucket and the object
path is validated by the database (`{shop_id}/gallery/{uuid}.webp`) — an owner
cannot write into another shop's folder. If an upload fails with a size or type
message, it is the browser-side check firing before anything reaches Supabase.

---

## 6. Supporting an owner: their journey, step by step

Knowing the exact screens saves you twenty minutes per phone call.

1. **Sign up / log in** → `/fr/register`. Email confirmation from Supabase Auth.
2. **`/fr/studio`** → "create a shop" → name, city, address, phone, description.
   This runs the database function `create_owned_shop`, which creates the shop,
   the `owner` membership and the settings row atomically. There is no admin
   approval step: onboarding is self-service, and the publication gate is the
   quality filter.
3. **Studio wizard, six steps** (see §5). They can leave and come back; the
   progress rail remembers what is missing.
4. **Publish** — the last step of the wizard is **Site web**, and it holds
   **Publier le site**. The storefront is
   `https://qassa-xi.vercel.app/fr/shop/{slug}` — that URL is what they print on
   the window and put in their Instagram bio. The same step has **Dépublier le
   site**, which is how they pause without calling you.
5. **Change the slug** and the old URL stops working. Warn them.
6. **Bookings** — `/fr/studio/{shopId}/appointments` lists everything from the
   last 30 days plus the future, with **Annuler le rendez-vous**, **Marquer comme
   terminé** and **Marquer comme absent**. A customer can cancel their own
   appointment right up to its start time; after it has started, only the shop
   can change it.
7. **Template** — the Website step switches the storefront design without
   touching content: Royal Gold, Urban Cut, Classic Gentleman, Minimal Studio,
   Dark Prestige. The reference shop uses Dark Prestige.

Things an owner will ask that you should have an answer for:

- *"Nobody can book on Mondays."* → correct, that is their rest day.
- *"My photos are gone."* → they restored from a suspension and the shop was
  unpublished; or they replaced media and did not save. Photos are not deleted
  by suspension.
- *"Publish does nothing."* → it did something: it refused. Read them the
  `missing` list from §5.

---

## 7. Who may be an admin, and how to add one

Roles live in `platform_admins.role`. Five values exist, but only three matter
today because only one capability is implemented (suspend/restore):

| Role | Can suspend? | Notes |
| --- | --- | --- |
| `platform_owner` | yes | You. Only role allowed to change platform settings (aspirational — nothing to change yet). |
| `super_admin` | yes | Everything the owner can do, minus platform settings. |
| `operations_admin` | yes | The role for a day-to-day moderator. Give this to staff. |
| `support_admin` | no | Read-only shop list + user read. For whoever answers the phone. |
| `finance_admin` | no | Read-only, plus subscription/payment permissions that **have no implementation yet** (there is no billing in QASSA). |

Support and finance roles therefore currently see exactly the Control list and
nothing else — which is a fine, safe thing for them to see.

**There is no UI to grant or revoke an admin.** The seed script's comment claims
later grants happen "through QASSA Control"; they do not — no such screen was
built, and the API roles are revoked write access to `platform_admins` by
migration `0017`. All admin membership changes are SQL, run by you, in the
Supabase dashboard:

```sql
-- Grant (or re-grant) a platform admin.
insert into public.platform_admins (user_id, role, created_by)
select u.id, 'operations_admin',
       (select pa.id from public.platform_admins pa
        join auth.users au on au.id = pa.user_id
        where au.email = 'ahmeed.ammar123@gmail.com')
from auth.users u
where u.email = 'newstaff@example.com'
  and not exists (
    select 1 from public.platform_admins pa where pa.user_id = u.id
  );
```

```sql
-- Revoke without deleting the audit trail link: deactivate.
update public.platform_admins
set is_active = false
where user_id = (select id from auth.users where email = 'newstaff@example.com');
```

Deactivating is instant: every Control check re-reads the `platform_admins` row
per request, and `is_active = false` fails the check. Prefer it over `delete`,
because `audit_logs.actor_id` references that row's history.

The person you grant to must sign in and enroll their own TOTP before Control
works for them.

---

## 8. Emergency database operations

Open **Supabase dashboard → SQL editor**, project `nqpqtmxowmuuvnljqnkc`.
You are `postgres` there, which bypasses RLS — but **not** triggers. Two triggers
still bite you, and both are fixable in the same batch.

The editor has two habits worth knowing: statements must be separated by `;`,
and it appends `limit 100;` to the batch, so do not end the last statement with
`;`. Only the first statement's result grid is shown — run one query per batch
when you want to read output.

### Read the audit trail (there is no admin screen for it)

Every suspension, restore, publication change and denied admin attempt is in
`audit_logs`. The table is append-only at the privilege level: nobody can update
or delete a row through the API.

```sql
select to_char(a.created_at at time zone 'Africa/Tunis', 'YYYY-MM-DD HH24:MI') as tunis_time,
       au.email as actor,
       a.actor_role,
       a.action,
       a.resource_type,
       b.name as shop,
       a.metadata,
       a.success
from public.audit_logs a
left join auth.users au on au.id = a.actor_id
left join public.barbershops b on b.id = nullif(a.resource_id, '')::uuid
order by a.id desc
limit 50
```

Actions you will see: `shops.suspend`, `shops.restore`, `admin.access_denied`
(the last with `success = false` — worth checking after any staff turnover).

### Force-unpublish a shop (no suspension)

Unpublishing is unrestricted; only the *transition to* published is gated.

```sql
update public.barbershops
set is_published = false
where slug = 'some-shop'
```

### Suspend or restore straight in the database

Editing `is_suspended` by hand is blocked on purpose (trigger
`barbershops_suspension_guard`, error 42501: "Shop suspension can only be
changed by platform administration."). Use the admin function instead, and give
it the authenticated context the UI would have had — all **in one batch**,
because the claim only lives as long as the connection:

```sql
select set_config('request.jwt.claims',
  json_build_object('sub',
    (select id from auth.users where email = 'ahmeed.ammar123@gmail.com'),
    'role', 'authenticated', 'aud', 'authenticated')::text, false);

select public.set_shop_suspension(
  '224ddbba-240a-466a-b0c2-9bd5b64ab715'::uuid, true, 'URGENCE: plaintes clients');

select set_config('request.jwt.claims', '', false)
```

The third statement resets the impersonation, and the batch ends without `;` so
the editor's appended ` limit 100` lands harmlessly. Splitting these across two
batches does not work — the second connection has no claim and the function
raises 28000.

Use this path only when the UI is down. It writes the same audit row.

### Publish on behalf of an owner (rare, justified when they are stuck)

`set_shop_published` refuses callers who are not an owner/manager of that shop,
and refuses suspended shops (error `P0002` "Shop not found or suspended."). To do
it as them, use the same one-batch trick with **their** user id and
`set_shop_published(shop_id, true)`. The publication gate still applies — you
cannot bypass the six requirements, and you should not want to.

### Delete a shop for good

Nothing in the UI deletes shops, and suspension is almost always what you
actually want. If you truly must remove one: every child table
(`shop_members`, `shop_settings`, `shop_services`, `barbers`,
`barber_services`, `shop_business_hours`, `barber_schedules`, `barber_breaks`,
`barber_days_off`) is `on delete cascade`, so removing the shop takes them with
it. The one blocker is `appointments`, which is `on delete restrict` — a shop
that has ever taken a real booking cannot be deleted without destroying that
booking history first. Count before you decide:

```sql
select count(*) from public.appointments where shop_id = '224ddbba-240a-466a-b0c2-9bd5b64ab715'
```

For a test shop with no bookings, that is the whole deletion:

```sql
delete from public.barbershops where id = '224ddbba-240a-466a-b0c2-9bd5b64ab715'
```

Their uploaded images are **not** removed by that — bucket files are only
deletable through the Storage API/UI (dashboard → Storage → `shop-media` →
`{shop_id}/`), so clean those too or you leak public photos of a dead shop. Note
that folder names in that browser are ordinary `storage.objects` rows
(`.emptyFolderPlaceholder`), and `DELETE` against the storage tables from SQL is
rejected by Supabase itself — use the Storage UI or API.

Before any of this: take a backup ([§9](#9-operations-deployments-and-safety)).

### Useful one-liners

```sql
-- Marketplace shape.
select is_published, is_suspended, count(*)
from public.barbershops
group by 1, 2
order by 3 desc
```

```sql
-- Last 7 days of bookings per shop.
select b.name, count(a.id) as bookings
from public.appointments a
join public.barbershops b on b.id = a.shop_id
where a.created_at > now() - interval '7 days'
group by b.name
order by bookings desc
```

```sql
-- Who is closing on which day (0 = Sunday … 6 = Saturday).
select name, city, closed_weekday
from public.barbershops
where is_published and not is_suspended
order by closed_weekday nulls last
```

---

## 9. Operations, deployments and safety

### Deployment order is migrations first, code second

The app queries columns that only exist after a migration (`closed_weekday`,
`is_suspended`, `gallery_paths`, …). If new code lands before its migration,
production pages error. So:

1. Apply `supabase/migrations/NNNN_*.sql` in the dashboard, in numeric order.
   Never skip one, never reorder.
2. Then push the code that uses it: push to `main` on `github.com/ahmeedammar/QASSA`
   and Vercel deploys.
3. Check `https://qassa-xi.vercel.app/api/health`.

Applied through 0018. The next migration you write is `0019_…`.

### Health check

`GET /api/health` probes the database and Redis. It returns `503` only when the
database fails. `"redis": "not_configured"` is a warning, not an outage — see
rate limits below.

### Backups

`npm run db:backup` runs `pg_dump` when a `DATABASE_URL`/`DIRECT_URL` is
available, writes `backups/qassa_backup_<timestamp>.sql` and records size + SHA256
in `backups/manifest.json`, keeping the last 30 entries. Two honest limitations:
the fallback path (no `pg_dump`) only concatenates migrations up to `0014`, so it
is a schema snapshot and **not** a backup — always confirm a real dump was
produced; and there is **no cron**, so nothing backs itself up. Take it manually
before every migration and every destructive SQL. Full procedure:
[`docs/BACKUP_AND_RECOVERY.md`](./BACKUP_AND_RECOVERY.md).

### Rate limits

| Bucket | Limit | Protects |
| --- | --- | --- |
| `public` | 60 / 60 s | anonymous browsing |
| `auth` | 5 / 60 s | login, register, password reset |
| `booking` | 10 / 60 s | appointment creation and cancellation |
| `admin` | 30 / 60 s | QASSA Control changes and Studio mutations |

They are backed by Upstash Redis. **If the Upstash variables are missing, the
limiter becomes a no-op that allows everything.** It does not crash, it does not
warn in the UI — the only visible symptom is `/api/health` reporting
`not_configured`. So an owner shouting "I can't create an account, it says too
many requests" means Redis *is* configured and they tripped 5/60s on `auth`.

### Environment variables

| Variable | Required | What breaks without it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | nothing renders |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | no auth, no data |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | admin/service paths |
| `NEXT_PUBLIC_SITE_URL` | yes in prod | auth redirects, absolute URLs |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | recommended | all rate limiting silently off |
| `PLATFORM_OWNER_EMAIL` | only for the seed script | first admin bootstrap |

`npm run check:env` validates them and masks values. Set these in Vercel →
Project → Settings → Environment Variables, never in the repository. Do not open
or commit `.env.local` into anything shared.

### Supabase auth configuration to keep an eye on

Site URL must be `https://qassa-xi.vercel.app` and the redirect allowlist must
contain `https://qassa-xi.vercel.app/auth/callback`. If an owner reports "the
confirmation email sends me to localhost", this is the setting, not the code.
(Verifying this page by hand is still open on the checklist.)

### Testing before you touch production

Use the reference shop. It is published, complete and closed Mondays, so it
exercises every path: booking UI, hours, gallery, suspension round-trip. Suspend
it, watch it vanish from `/fr/discover`, restore it. Nothing about that harms a
real business.

---

## 10. What QASSA does not do (yet)

Do not promise these to a shop owner. None of them exist in code, and this list
is as much a warning as it is a roadmap:

- **No email or SMS to customers or shops.** No provider is configured, no
  notification table, no jobs. Customers see confirmations on screen only; an
  appointment reminder does not happen. Owners must advertise their own link and
  will ask for reminders.
- **No payments, invoicing, subscriptions or revenue view.** Prices are display
  only, in TND, and collection happens in the shop's chair. The
  `finance_admin` role's permissions are placeholders.
- **No admin invites.** You cannot create a shop-owner account for somebody.
  They register themselves; that is the only supported path, and it keeps
  ownership of the shop tied to a mailbox they control.
- **No admin-created shops.** `create_owned_shop` requires the owner's own
  session. Onboarding the first shop for a hesitant owner means sitting next to
  them, not doing it in their account.
- **No cancellation of a shop's existing bookings by the platform.** Suspending
  stops *new* bookings. Already-confirmed appointments remain visible to the
  shop and the customer, and only the shop (`owner`/`manager`) or the customer
  can cancel them. Handling a suspended shop's backlog is a phone call.
- **No audit-log screen, no metrics dashboard, no pagination, no data export.**
  All of that is SQL today; `audit.read`, `data.export`, `users.manage`,
  `marketplace.manage` and `support.manage` exist as permission names with no
  screen behind them.
- **No scheduled jobs of any kind** — no `pg_cron`, no Vercel cron. Nothing
  auto-publishes, auto-expires, auto-reminds or auto-backs-up.
- **No per-day closures beyond the weekly rest day.** By design: law, not
  preference. A shop renovating for two weeks cannot express that today; it
  unpublishes.

---

## 11. Playbooks

**Fake bookings / someone is bombing a shop.** Suspend with reason
`Suspicion de faux rendez-vous`. That immediately stops new bookings and hides
the storefront. Then hand the backlog to the owner: they can cancel each
appointment in their own Studio (**Annuler le rendez-vous**), and they are the
ones who know which regular is real. You have no admin booking lever, and
editing `appointments` by hand skips the audit trail.

**Owner stopped paying / offboarding a shop.** Suspend, with the reason you will
stand behind if they screenshot it. Their content stays in the database, so a
later resolution is one press of Restore, not a rebuild.

**"My shop disappeared."** Suspension is visible to the owner: under the shop
name in `/fr/studio` the status line reads **Suspendu**, the "voir votre site"
link is gone, and **Publier le site** is disabled. So if they say "Suspendu",
believe them and go straight to the reason. If they say **Non publié** instead,
check `is_published` and then the `missing` list from §5 — in that order.

**Control shows `Vous n'avez pas accès…` / `forbidden`.** Two causes: your
`platform_admins` row is inactive, or the session lost AAL2. Sign out, sign in,
enter the code, retry.

**Control shows `Impossible de charger les salons. Réessayez.`** Your access is
fine — the page gate already passed — so the `list_platform_shops` RPC itself
failed. Open **Détails techniques** on the panel and read the code:

| Code | Meaning | What to do |
| --- | --- | --- |
| `PGRST202`, `42883` | the function is not in the database (or PostgREST has not refreshed its schema cache) | apply `0014_platform_shop_suspension.sql`, then reload the Supabase API schema |
| `unexpected_shape` | the function exists but returns different columns | the live database and the migrations have drifted; re-apply `0014` |
| `PGRST301`, `PGRST302` | the token did not reach PostgREST | **Se reconnecter**, enter the MFA code, come back |
| anything else | database-side failure | read the message, check the Supabase logs |

To confirm the first two rows yourself, run this **read-only** query in the
Supabase SQL editor (no trailing semicolon):

```sql
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_can_run
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('list_platform_shops', 'set_shop_suspension')
```

Zero rows means migration `0014` was never applied. `auth_can_run = false` means
the grants at the bottom of `0014` are missing. Both are fixed by re-running that
migration — it is idempotent (`create or replace`, `drop trigger if exists`).

**Something is wrong and you are scared of the database.** Suspend the affected
shop (reversible, one press), take a backup, then investigate. Suspension buys
you time without destroying evidence.

---

## 12. Reference

**URLs**

| | |
| --- | --- |
| Discover / marketplace | `/fr/discover` (filters: `?q=`, `?city=`) |
| Public storefront | `/fr/shop/{slug}` |
| Owner dashboard | `/fr/studio` → `/fr/studio/{shopId}?step={services\|team\|hours\|exceptions\|media\|site}` |
| Owner appointments | `/fr/studio/{shopId}/appointments` |
| QASSA Control | `/fr/control` |
| MFA enrollment | `/fr/control/mfa` |
| Health | `/api/health` |

**Roles**

- App: `customer`, `owner`, `employee` (`user_roles.role`).
- Shop membership: `owner`, `manager`, `barber` (`shop_members.role`).
- Platform: `platform_owner`, `super_admin`, `support_admin`, `finance_admin`,
  `operations_admin` (`platform_admins.role`).

**Functions you may call from SQL**

| Function | Purpose |
| --- | --- |
| `shop_website_missing_requirements(uuid)` | why a shop cannot publish |
| `set_shop_published(uuid, boolean)` | publish/unpublish (owner/manager context only) |
| `set_shop_suspension(uuid, boolean, text)` | suspend/restore (ops roles only) |
| `set_shop_rest_day(uuid, smallint)` | change the weekly closure (owner/manager only) |
| `get_available_slots(uuid, uuid, uuid, date)` | what a customer can book |
| `list_platform_shops()` | what the Control page shows (100 newest) |
| `log_audit_event(...)` | the only way in and out of `audit_logs` |

**Code map**

| Concern | File |
| --- | --- |
| Admin guard chain | `src/lib/auth/admin.ts` |
| Role → permission matrix | `src/lib/auth/permissions.ts` |
| Control page access helper | `src/lib/auth/control-page.ts` |
| Admin server actions | `src/lib/actions/control.ts` |
| Control UI | `src/app/[locale]/control/page.tsx`, `src/components/control/shop-suspension-list.tsx` |
| MFA UI | `src/components/control/mfa-setup.tsx` |
| Rate limits | `src/lib/ratelimit.ts` |
| Publication gate | `supabase/migrations/0011_shop_website_setup.sql`, `0015_shop_media.sql`, `0018_shop_rest_day.sql` |
| Suspension + admin list | `supabase/migrations/0014_platform_shop_suspension.sql` |
| Admin bootstrap | `supabase/seed_platform_owner.sql` |

**Verification suite** — run these before believing anything works:

```
npm run typecheck && npm run lint && npm run test && npm run build
```

129 unit and component tests (`vitest`). Separately, `npm run test:db` builds a
throwaway **local** Postgres (it refuses any non-loopback host and never reads
`.env` files), applies every migration and runs `supabase/tests/`:
`booking.test.sql`, `control.test.sql` (suspension semantics) and
`security.test.sql` (publication gate, RLS). That is the only honest check that
a migration you are about to apply to production behaves as claimed.
