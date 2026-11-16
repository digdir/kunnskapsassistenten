# Run Kunnskapsassistenten locally

This is how you get the app running on your own machine, against genki-test,
the shared test platform, and Typesense, with real answers and real filters.
The guide is for you if you are not a developer and have Claude Code to help.
Each step is one command or one action, and below it is what you should see
when it has worked. The commands are typed in Terminal on a Mac.

## 1. Git and Node 24

```sh
git --version
```

You should see `git version` and a number. If the Mac offers to install
developer tools, say yes, wait until it is done and run the command again.

Node is installed with nvm:

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
```

Close Terminal and open it again, so it finds nvm. Then:

```sh
nvm install 24
node --version
```

The last one should print `v24` and more, for example `v24.21.0`.

## 2. The code

```sh
git clone https://github.com/digdir/kunnskapsassistenten.git
cd kunnskapsassistenten/src
npm ci
```

`npm ci` takes a minute or two and ends with `added` and a number of packages.
Warnings about `install-scripts` at the end are expected. All the commands
from here on are run in `src/`.

## 3. The keys

```sh
cp apps/web/.env.example apps/web/.env.local
```

Open `apps/web/.env.local` in a text editor. Everything is filled in except
two lines, `KA_API_KEY=` and `TYPESENSE_API_KEY=`. Paste each key right after
`=`, with no spaces, and not into Claude Code either. `.env.local` is kept out
of git and must never be committed.

`KA_API_KEY` is your own key to genki, which you make yourself. It reaches only
the service Kunnskapsassistenten, and it can be revoked without touching anyone
else's.

1. Go to https://portal.genki-test.digdir.cloud, choose Entra ID and sign in
   with your Digdir email.
2. Choose «Tjenester», then «Kunnskapsassistenten», then «Kanaler og
   frontend».
3. Scroll down to «API-nøkler for tjenesten» and press «Lag API-nøkkel».
4. Give it a name you recognise, such as `ka-lokal-yourname`, so it can be
   revoked on its own.
5. Copy the key straight away: the portal shows it only once. Paste it after
   `KA_API_KEY=`.

`TYPESENSE_API_KEY` is the search key to Typesense, which gives the filters and
the excerpts in the sources. Ask the team for it. It is shared in the password
manager, never in chat or email.

## 4. Start the app

```sh
npm run web
```

After a few seconds it says `Local:   http://localhost:5173/`. Open that
address in the browser. If there is a line that starts with
`[ka] Live mangler`, see step 5 first.

Ask a question, for example «Hva skriver Statens vegvesen om
trafikksikkerhet i årsrapporten for 2024?». A real answer looks like this:
first «Fremgangsmåte» shows while the app searches, then the answer comes with
small numbers such as [1] and [2] that point to the sources, and below the
answer «Kilder brukt i svaret» with documents from Kudos. The filter panel has
Dokumenttyper, Virksomheter and År.

Stop the app with Ctrl+C in Terminal. If 5173 is taken, it picks the next free
port and prints it. To choose another port, use `npm run web -- --port 5180`.

## 5. When it fails

After every change to `.env.local`, stop the app with Ctrl+C and start it
again with `npm run web`. It reads the file only when it starts.

| You see                                                              | It means                                                                                                                                              | Do this                                                                                                                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[ka] Live mangler` and some names, in Terminal                      | Those lines are empty in `.env.local`. When you ask, the app then says «Ingen tilgang», or «Filtrering er ikke tilgjengelig ennå» in the filter panel | Fill in the lines it names                                                                                                                                             |
| «Oppsettet mangler» in the app                                       | `KA_API_URL` is missing from `.env.local`                                                                                                             | Copy `.env.example` again (step 3), and paste the keys in again                                                                                                        |
| 403 when you make the key in the portal                              | You are on «Integrasjoner», which makes keys for the whole organisation, or your login has no access to the service                                   | Make the key in the service's own list, «API-nøkler for tjenesten» (step 3), or ask the team for access under «Tilgang»                                                |
| «Ingen tilgang» when you ask                                         | genki refused `KA_API_KEY`                                                                                                                            | Check that it is the key you made under «API-nøkler for tjenesten» (step 3), all of it, with no spaces. A key made without an Entra ID sign-in is refused the same way |
| «Ingen tilgang» when you ask, with the right key                     | `VITE_KA_TENANT` and `VITE_KA_DATASET_CONFIG_KEY` name a dataset the service does not have                                                            | Set both back to the values in `.env.example`                                                                                                                          |
| «Klarte ikke å hente filtrene.» and «Prøv igjen» in the filter panel | Typesense did not accept the key, or did not find the collections                                                                                     | Check `TYPESENSE_API_KEY`, and that `TYPESENSE_URL`, `KA_FACET_COLLECTIONS` and `KA_CHUNK_COLLECTIONS` are as in `.env.example`                                        |
| «Svaret kom ikke fram» when you ask                                  | The backend answered with an error                                                                                                                    | Tell the team, with the time                                                                                                                                           |

## 6. Working with Claude Code

Start Claude Code in `src/`:

```sh
claude
```

Ask it to read `apps/web/CLAUDE.md` first. That is where the rules for the code
are, and where things are. Then, one thing at a time:

1. Ask for a branch of its own for the change before anything is changed,
   never `main`.
2. Describe the change, and look at it in the browser while `npm run web` runs.
3. Ask Claude Code to run the checks listed in `CLAUDE.md`, and to open a
   draft PR against `main` with a short description in English. You get the
   link to the PR back.
4. Someone on the team reviews the PR and merges it.
