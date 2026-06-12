# ShuttleLab

Badminton performance tracker for a coach and players. Players log fitness tests,
see their trends and goals, and read the training their coach writes for them.
The coach sees everyone, ranks the team, writes per-player training, and can
export PDF reports.

## Files
```
index.html            page shell (loads everything)
css/styles.css        the look (black + green theme)
js/config.js          << EDIT THIS: the team logins + the list of tests
js/firebase.js        connects to your Firebase project
js/core.js            shared state + helpers
js/data.js            reads/writes to the database
js/shell.js           top bar + tabs
js/report.js          the printable PDF report
js/views/             one file per screen (login, dashboard, team, log, training, library)
js/app.js             ties it together
logo.png, cover.png   your branding
```

## 1. Set up the team
The team roster lives in **Firestore** (the `members` collection), not in the code,
so no names or emails ship to the browser. For each person:
1. **Authentication → Users → Add user**: a **fake** email + password (not a real Gmail).
2. Copy that user's **User UID**.
3. **Firestore → `members` collection → Add document**, with the **Document ID = the UID**,
   and fields: `id` (number), `name` (string), `role` (`"player"` or `"coach"`), `photo` (string, optional).

You can change the `TESTS` list in `js/config.js`.

## 2. Set up the database (one time)
1. In the Firebase console, open **Firestore Database** and create a database.
2. Open the **Rules** tab, replace everything with the contents of the
   **`firestore.rules`** file in this project, and click **Publish**.

These rules require a signed-in account for everything, lock video uploads to the
coach, and let players only mark videos as watched. Don't use open
(`allow read, write: if true`) rules — they let anyone reach the data.

## 3. Put it online (GitHub + Vercel)
1. Create a new repository on GitHub and upload **all of these files** (keep the
   folder structure — `index.html` at the top, with the `css/` and `js/` folders).
2. Go to vercel.com, **Add New → Project**, and import that GitHub repo.
3. Framework preset: **Other** (no build step needed). Click **Deploy**.
4. Open the link Vercel gives you. Sign in with one of the logins from `config.js`.

> Don't open `index.html` by double-clicking it on your computer — the browser
> blocks the app's modules from a local file. It only runs from a server (Vercel,
> or the VS Code "Live Server" extension for local testing).

## Photos (optional)
Put image files in an `imgs/` folder matching the paths in `config.js`
(e.g. `imgs/H.jpeg`), or delete the `photo:` lines to show each person's initial.
