# Epsilon Tau Pi Mario Kart Championship

November 19, 2026 · 6–8 PM · Reitz Game Room

## Preview locally

Use Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. With no Supabase settings, the app opens in **Demo mode** with sample scores. Select **Admin** to try entering results or picking cups. Choose **Start empty demo** to try managing the roster and drawing groups. Demo edits live in browser storage and stay separate from the shared tournament.

```sh
npm test
npm run build
```

## Connect Supabase

1. Create a Free project in the [Supabase dashboard](https://supabase.com/dashboard).
2. Open **SQL Editor**, paste [supabase/schema.sql](supabase/schema.sql), and run it. This creates an empty tournament, enables public reads, limits writes to the selected admin UUID, and publishes updates through Supabase Realtime.
3. Open **Authentication → Users**. Choose **Add user → Create new user**, enter your email and a strong password, and enable auto-confirm for that user so you can sign in immediately. Copy the user's UUID. Keep the Email provider enabled. You can disable public signups in the Auth configuration.
4. Run this separately in SQL Editor using your Auth user UUID.

   ```sql
   insert into tournament_private.admin (user_id)
   values ('YOUR-AUTH-USER-UUID')
   on conflict (singleton) do update set user_id = excluded.user_id;
   ```

5. Copy [.env.example](.env.example) to `.env.local`. Enter the project URL and the **publishable** key from your project's Connect dialog or API settings. Keep the admin password, database password, and secret or service-role keys out of `VITE_*` variables and GitHub. [Supabase API key documentation](https://supabase.com/docs/guides/getting-started/api-keys)
6. Restart Vite. Open **Admin**, sign in, and add a player. In a separate private browser window, confirm the player appears without logging in. Remove the test player before drawing groups. If Realtime is temporarily unavailable, visible tabs refresh every 30 seconds and when they regain focus.

## Publish with GitHub Pages

1. In your GitHub repository, open **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**. GitHub Free supports Pages for public repositories. [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
2. Under **Settings → Secrets and variables → Actions → Variables**, add repository variables named `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, using the same values as your local configuration.
3. Commit and push the app files, including the lockfile and [.github/workflows/pages.yml](.github/workflows/pages.yml), to `main`. The workflow tests, builds, and deploys the app. If the files are already pushed when you finish configuring Pages, open **Actions → Deploy tournament to GitHub Pages → Run workflow**. Run it again whenever the build-time Supabase variables change. [Vite deployment guide](https://vite.dev/guide/static-deploy.html)
4. Open the deployed URL from the workflow or **Settings → Pages**. Check both public standings and admin sign-in on that URL. The Pages workflow fails before deployment if the project URL or publishable key is missing.

## Run the tournament

- Add 16 human players. Draw groups when the roster is final.
- Enter each human player's total Grand Prix points, including any zero scores, and confirm each result. The app creates the next round when all matches in the current round are confirmed.
- When a tie affects qualification, semifinal seeding, or the championship, select the players in their tiebreaker finishing order.
- To correct a score, select the earlier match. Corrections after advancement require a second confirmation. A downstream match keeps its scores if its set of players stays the same. If its players change, it needs fresh scores and confirmation.
- Edit the cup list to match the cups available on your console. Each pick is excluded from subsequent draws, even if the cup is removed and re-added to the list.
