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
Open `js/config.js` and edit the `USERS` list. Give each person a **fake** email
and password (not their real Gmail). Set `role` to `"player"` or `"coach"`.
You can also change the `TESTS` list there.

## 2. Set up the database (one time)
1. In the Firebase console, open **Firestore Database** and create a database.
2. Open the **Rules** tab, replace everything with this, and click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

(These open rules keep it simple. Anyone with the project could reach the data,
but the logins are fake and it's only badminton stats — fine to tighten later.)

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
